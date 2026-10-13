import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  DifficultyLevel,
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  PlayerPublicState,
  RoomPublicState,
  RoomStateStatus,
  MoveValidationResponse,
  ChatMessage,
  UserAccount,
  FriendUser,
  LobbyInvite,
  ErrorFilterCategory,
  ActivePlayerSummary,
} from './src/types/game.ts';
import {
  generateSudokuBoard,
  calculateCompetitiveScore,
  calculatePuzzleSeed,
  calculateDifficultyMultiplier,
} from './src/sudokuEngine.ts';
import {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  mergeGuestStats,
  getUserFromToken,
  getUserById,
  updateUserProfile,
  recordMatchOutcome,
  addFriend,
  removeFriend,
  getFriendUsers,
  getDetailedCareerStats,
} from './src/authServer.ts';
import {
  recordPuzzleSolver,
  getPuzzleLeaderboard,
  getAllTimeLeaderboard,
  getDailyChallengePublicInfo,
  getOrCreateDailyChallenge,
  getPlayerDailyStreak,
  recordDailyChallengeCompletion,
  getCurrentUTCDateKey,
} from './src/puzzleLeaderboardServer.ts';

interface InternalPlayer extends PlayerPublicState {
  board: number[][]; // Current player's 9x9 progress
  botTimer?: ReturnType<typeof setTimeout>;
}

interface InternalRoom {
  code: string;
  hostId: string;
  difficulty: DifficultyLevel;
  status: RoomStateStatus;
  maxPlayers: number;
  mistakeLimit: number; // 0 = unlimited, 1, 3, 5, 10
  players: Map<string, InternalPlayer>;
  initialBoard: number[][] | null;
  solutionBoard: number[][] | null;
  puzzleSeed?: string | null;
  totalEmptyCells: number;
  startTime: number | null;
  firstFinishTimeMs: number | null;
  feedbackMode?: 'instant' | 'delayed';
  customClues?: number;
  finishedOrder: string[]; // player IDs in exact order of finishing
  messages: ChatMessage[];
}

const rooms = new Map<string, InternalRoom>();
const socketToRoom = new Map<string, string>();
const socketToUserId = new Map<string, string>(); // socket.id -> registered userId
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socket.id

const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Clear unambiguous 6-char alphanumeric

function generateUniqueRoomCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
    }
  } while (rooms.has(code));
  return code;
}

const BOT_CONFIGS = [
  { name: 'Kaito V.', avatarId: 'avatar-falcon' },
  { name: 'Elena R.', avatarId: 'avatar-owl' },
  { name: 'Soren M.', avatarId: 'avatar-wolf' },
  { name: 'Aria K.', avatarId: 'avatar-dragon' },
  { name: 'Marcus T.', avatarId: 'avatar-lion' },
];

function serializeRoom(room: InternalRoom): RoomPublicState {
  const playersList: PlayerPublicState[] = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    avatarId: p.avatarId,
    isHost: p.isHost,
    isReady: p.isReady,
    isBot: p.isBot,
    connected: p.connected,
    filledCount: p.filledCount,
    totalToFill: p.totalToFill,
    mistakes: p.mistakes,
    finished: p.finished,
    finishTimeMs: p.finishTimeMs,
    deltaTSeconds: p.deltaTSeconds,
    rank: p.rank,
    score: p.score,
    maxPossibleScore: p.maxPossibleScore,
    minPossibleScore: p.minPossibleScore,
    isEliminated: p.isEliminated,
    hintsUsed: p.hintsUsed,
    comboStreak: p.comboStreak,
    maxCombo: p.maxCombo,
    difficultyMultiplier: p.difficultyMultiplier,
    timeMultiplier: p.timeMultiplier,
    maxScoreCap: p.maxScoreCap,
    scoreBreakdown: p.scoreBreakdown,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    difficulty: room.difficulty,
    status: room.status,
    maxPlayers: room.maxPlayers,
    mistakeLimit: room.mistakeLimit,
    players: playersList,
    startTime: room.startTime,
    firstFinishTimeMs: room.firstFinishTimeMs,
    initialBoard: room.initialBoard,
    solutionBoard: room.status === 'PLAYING' || room.status === 'FINISHED' ? room.solutionBoard : null,
    puzzleSeed: room.puzzleSeed || undefined,
    feedbackMode: room.feedbackMode || 'instant',
    customClues: room.customClues,
    messages: room.messages,
  };
}

function clearRoomBots(room: InternalRoom) {
  for (const player of room.players.values()) {
    if (player.botTimer) {
      clearTimeout(player.botTimer);
      player.botTimer = undefined;
    }
  }
}

// Basic Profanity & Moderation filter
const BANNED_PATTERNS = [
  /\b(nigger|faggot|cunt|kike|chink)\b/gi,
  /\b(kill\s+yourself|kys)\b/gi,
];

function sanitizeMessageText(text: string): string {
  let cleaned = text.trim().slice(0, 200);
  for (const pattern of BANNED_PATTERNS) {
    cleaned = cleaned.replace(pattern, '***');
  }
  return cleaned;
}

function handlePlayerCompletion(room: InternalRoom, player: InternalPlayer, io: SocketIOServer) {
  if (player.finished || !room.startTime) return;

  const now = Date.now();
  const elapsedMs = Math.max(100, now - room.startTime);

  player.finished = true;
  player.finishTimeMs = elapsedMs;

  if (room.firstFinishTimeMs === null) {
    room.firstFinishTimeMs = elapsedMs;
  }

  room.finishedOrder.push(player.id);
  const rank = room.finishedOrder.length;

  const scoreResult = calculateCompetitiveScore(
    rank,
    room.firstFinishTimeMs,
    elapsedMs,
    room.difficulty,
    player.mistakes,
    player.hintsUsed || 0,
    player.score || undefined,
    room.customClues
  );

  player.rank = rank;
  player.score = scoreResult.score;
  player.maxPossibleScore = scoreResult.maxPossibleScore;
  player.minPossibleScore = scoreResult.minPossibleScore;
  player.deltaTSeconds = scoreResult.deltaTSeconds;
  player.difficultyMultiplier = scoreResult.difficultyMultiplier;
  player.timeMultiplier = scoreResult.difficultyMultiplier;
  player.maxScoreCap = scoreResult.maxScoreCap;
  player.scoreBreakdown = scoreResult.scoreBreakdown;

  // Record outcome for registered user account if present
  if (player.userId) {
    recordMatchOutcome(
      player.userId,
      player.score,
      rank,
      elapsedMs,
      room.difficulty,
      player.mistakes,
      player.difficultyMultiplier
    );
  }

  // Record outcome for global puzzle seed leaderboard
  if (room.puzzleSeed) {
    recordPuzzleSolver(room.puzzleSeed, room.difficulty, {
      playerName: player.name,
      avatarId: player.avatarId,
      userId: player.userId,
      score: player.score || 0,
      finishTimeMs: elapsedMs,
      mistakes: player.mistakes,
    });
  }

  // Add system announcement to room chat
  const completionMsg: ChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: 'system',
    senderName: 'System',
    senderAvatarId: 'avatar-dragon',
    text: `🏆 ${player.name} finished at Rank #${rank} with ${player.score.toFixed(1)} pts (${(elapsedMs / 1000).toFixed(1)}s)!`,
    timestamp: Date.now(),
    isSystem: true,
  };
  room.messages.push(completionMsg);

  // Check if all connected players have finished
  const allFinished = Array.from(room.players.values())
    .filter((p) => p.connected)
    .every((p) => p.finished);

  if (allFinished) {
    room.status = 'FINISHED';
    clearRoomBots(room);
  }

  io.to(room.code).emit('room:updated', serializeRoom(room));
  io.to(room.code).emit('player:finished', {
    playerId: player.id,
    playerName: player.name,
    rank: player.rank,
    score: player.score,
    deltaTSeconds: player.deltaTSeconds,
    finishTimeMs: player.finishTimeMs,
  });
}

function scheduleBotMove(room: InternalRoom, bot: InternalPlayer, io: SocketIOServer) {
  if (room.status !== 'PLAYING' || bot.finished || !room.solutionBoard) return;

  const [minDelay, maxDelay] = DIFFICULTY_CONFIG[room.difficulty].botSpeedRange;
  const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));

  bot.botTimer = setTimeout(() => {
    if (room.status !== 'PLAYING' || bot.finished || !room.solutionBoard) return;

    // Find all remaining empty cells on bot's board
    const emptyCells: [number, number][] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (bot.board[r][c] === 0) {
          emptyCells.push([r, c]);
        }
      }
    }

    if (emptyCells.length === 0) {
      handlePlayerCompletion(room, bot, io);
      return;
    }

    // Small 7% chance of a simulated mistake to make live telemetry realistic
    const makesMistake = Math.random() < 0.07;
    if (makesMistake) {
      bot.mistakes += 1;
      io.to(room.code).emit('room:updated', serializeRoom(room));
      scheduleBotMove(room, bot, io);
      return;
    }

    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    bot.board[r][c] = room.solutionBoard[r][c];
    bot.filledCount += 1;

    if (bot.filledCount >= bot.totalToFill) {
      handlePlayerCompletion(room, bot, io);
    } else {
      io.to(room.code).emit('room:updated', serializeRoom(room));
      scheduleBotMove(room, bot, io);
    }
  }, delay);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
    });
  });

  // REST Authentication Endpoints
  app.post('/api/auth/register', (req, res) => {
    const { username, password, avatarId, email, initialStats } = req.body;
    const result = registerUser(username || '', password || '', avatarId, email, initialStats);
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, user: result.user, token: result.token });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const result = loginUser(username || '', password || '');
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, user: result.user, token: result.token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    logoutUser(token);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session.' });
    }
    const { currentPassword, newPassword } = req.body;
    const result = changePassword(user.id, currentPassword || '', newPassword || '');
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, user: result.user });
  });

  app.post('/api/auth/merge-guest-stats', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session.' });
    }
    const { guestStats } = req.body;
    const result = mergeGuestStats(user.id, guestStats || {});
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, user: result.user });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }
    res.json({ ok: true, user });
  });

  app.post('/api/auth/profile', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }
    const { avatarId, username, email } = req.body;
    const result = updateUserProfile(user.id, avatarId, username, email);
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, user: result.user });
  });

  // Friends System Endpoints
  app.get('/api/friends/list', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }

    const storedFriends = getFriendUsers(user.id);
    const friends: FriendUser[] = storedFriends.map((f) => {
      const fSockets = userSockets.get(f.id);
      const isOnline = !!(fSockets && fSockets.size > 0);
      let currentRoomCode: string | null = null;
      if (isOnline && fSockets) {
        for (const sid of fSockets) {
          const rCode = socketToRoom.get(sid);
          if (rCode) {
            currentRoomCode = rCode;
            break;
          }
        }
      }
      return {
        id: f.id,
        username: f.username,
        avatarId: f.avatarId,
        online: isOnline,
        currentRoomCode,
        stats: f.stats,
        createdAt: f.createdAt,
      };
    });

    res.json({ ok: true, friends });
  });

  app.post('/api/friends/add', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }

    const { username } = req.body;
    const result = addFriend(user.id, username || '');
    if (!result.ok || !result.friend) {
      return res.status(400).json({ ok: false, error: result.error || 'Failed to add friend.' });
    }

    const f = result.friend;
    const fSockets = userSockets.get(f.id);
    const isOnline = !!(fSockets && fSockets.size > 0);
    let currentRoomCode: string | null = null;
    if (isOnline && fSockets) {
      for (const sid of fSockets) {
        const rCode = socketToRoom.get(sid);
        if (rCode) {
          currentRoomCode = rCode;
          break;
        }
      }
    }

    const friendPayload: FriendUser = {
      id: f.id,
      username: f.username,
      avatarId: f.avatarId,
      online: isOnline,
      currentRoomCode,
      stats: f.stats,
      createdAt: f.createdAt,
    };

    // If friend is online, notify them about the new friend
    if (isOnline && fSockets) {
      for (const sid of fSockets) {
        io.to(sid).emit('friends:presence_update', { userId: user.id, online: true });
      }
    }

    res.json({ ok: true, friend: friendPayload });
  });

  app.post('/api/friends/remove', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }

    const { friendId } = req.body;
    const result = removeFriend(user.id, friendId);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error || 'Failed to remove friend.' });
    }

    res.json({ ok: true });
  });

  function getActivePlayersList(): ActivePlayerSummary[] {
    const activeMap = new Map<string, ActivePlayerSummary>();

    // 1. All authenticated users with active socket connections
    for (const [userId, sids] of userSockets.entries()) {
      if (sids.size === 0) continue;
      const user = getUserById(userId);
      if (!user) continue;

      let roomCode: string | null = null;
      for (const sid of sids) {
        const r = socketToRoom.get(sid);
        if (r) {
          roomCode = r;
          break;
        }
      }

      activeMap.set(user.id, {
        id: user.id,
        userId: user.id,
        username: user.username,
        avatarId: user.avatarId,
        online: true,
        currentRoomCode: roomCode,
      });
    }

    // 2. All connected players in active rooms
    for (const room of rooms.values()) {
      for (const p of room.players.values()) {
        if (p.isBot) continue;
        const key = p.userId || p.id;
        if (!activeMap.has(key)) {
          activeMap.set(key, {
            id: p.id,
            userId: p.userId,
            username: p.name,
            avatarId: p.avatarId,
            online: true,
            currentRoomCode: room.code,
          });
        }
      }
    }

    return Array.from(activeMap.values());
  }

  app.get('/api/players/active', (_req, res) => {
    res.json({ ok: true, players: getActivePlayersList() });
  });

  // Detailed Career Statistics Endpoints
  app.get('/api/user/career-stats', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized session' });
    }
    const stats = getDetailedCareerStats(user.id);
    if (!stats) {
      return res.status(404).json({ ok: false, error: 'Career stats not found.' });
    }
    res.json({ ok: true, stats });
  });

  app.get('/api/user/career-stats/:userId', (req, res) => {
    const targetId = req.params.userId;
    const stats = getDetailedCareerStats(targetId);
    if (!stats) {
      return res.status(404).json({ ok: false, error: 'User career stats not found.' });
    }
    res.json({ ok: true, stats });
  });

  // Global Puzzle Seed Leaderboard (Filtered by zero error, 1 error, 2 error, 3+ error)
  app.get('/api/leaderboard/puzzle/:seed', (req, res) => {
    try {
      const seed = req.params.seed;
      const errorFilter = (req.query.errorFilter as ErrorFilterCategory) || 'all';
      const difficulty = (req.query.difficulty as DifficultyLevel) || 'Medium';

      const data = getPuzzleLeaderboard(seed, difficulty, errorFilter);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to retrieve puzzle leaderboard' });
    }
  });

  // Global All-Time Leaderboard
  app.get('/api/leaderboard/all-time', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const difficulty = (req.query.difficulty as string) || undefined;
      const data = getAllTimeLeaderboard(limit, difficulty);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to retrieve all-time leaderboard' });
    }
  });

  // Daily Challenge Information (High-difficulty 24h board + refresh window)
  app.get('/api/daily-challenge', (_req, res) => {
    try {
      const info = getDailyChallengePublicInfo();
      res.json({ ok: true, challenge: info });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to retrieve daily challenge' });
    }
  });

  // Player Daily Challenge Streak
  app.get('/api/daily-challenge/streak/:playerKey', (req, res) => {
    try {
      const streak = getPlayerDailyStreak(req.params.playerKey);
      res.json({ ok: true, streak });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to retrieve streak' });
    }
  });

  // Complete Daily Challenge Submission
  app.post('/api/daily-challenge/submit', express.json(), (req, res) => {
    try {
      const { playerKey, playerName, avatarId, userId, finishTimeMs, mistakes, score } = req.body;
      if (!playerKey || !playerName) {
        return res.status(400).json({ ok: false, error: 'Missing required player data' });
      }

      const result = recordDailyChallengeCompletion(
        playerKey,
        playerName,
        avatarId || 'avatar-dragon',
        userId,
        finishTimeMs || 120000,
        mistakes || 0,
        typeof score === 'number' ? score : 95
      );

      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to record daily challenge' });
    }
  });

  io.on('connection', (socket: Socket) => {
    // Associate Socket with authenticated user if token provided
    socket.on('auth:attach', (payload: { token: string }, callback?: (res: { ok: boolean; user?: UserAccount }) => void) => {
      if (payload?.token) {
        const user = getUserFromToken(payload.token);
        if (user) {
          socketToUserId.set(socket.id, user.id);
          if (!userSockets.has(user.id)) {
            userSockets.set(user.id, new Set());
          }
          userSockets.get(user.id)!.add(socket.id);
          io.emit('friends:presence_update', { userId: user.id, online: true });
          return callback?.({ ok: true, user });
        }
      }
      callback?.({ ok: false });
    });

    socket.on('players:get_active', (callback?: (res: { ok: boolean; players: ActivePlayerSummary[] }) => void) => {
      callback?.({ ok: true, players: getActivePlayersList() });
    });

    // Invite friend to private/public lobby
    socket.on(
      'lobby:invite',
      (
        payload: { targetUserId: string; roomCode: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const senderUserId = socketToUserId.get(socket.id);
          const room = rooms.get(payload?.roomCode);
          if (!room) {
            return callback?.({ ok: false, error: 'Room not found or no longer active.' });
          }

          const senderPlayer = room.players.get(socket.id);
          const senderName = senderPlayer?.name || 'A competitor';
          const senderAvatarId = senderPlayer?.avatarId || 'avatar-dragon';

          let targetSockets = userSockets.get(payload.targetUserId);
          if (!targetSockets || targetSockets.size === 0) {
            if (io.sockets.sockets.get(payload.targetUserId)) {
              targetSockets = new Set([payload.targetUserId]);
            } else {
              for (const [uId, sids] of userSockets.entries()) {
                const u = getUserById(uId);
                if (
                  u &&
                  (u.username.toLowerCase() === payload.targetUserId.toLowerCase() ||
                    u.id === payload.targetUserId)
                ) {
                  targetSockets = sids;
                  break;
                }
              }
            }
          }

          if (!targetSockets || targetSockets.size === 0) {
            return callback?.({ ok: false, error: 'Friend is currently offline.' });
          }

          const invite: LobbyInvite = {
            id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            fromUserId: senderUserId || socket.id,
            fromUsername: senderName,
            fromAvatarId: senderAvatarId,
            roomCode: room.code,
            difficulty: room.difficulty,
            timestamp: Date.now(),
          };

          for (const tSocketId of targetSockets) {
            io.to(tSocketId).emit('lobby:invite_received', invite);
          }

          callback?.({ ok: true });
        } catch (err) {
          callback?.({ ok: false, error: 'Failed to send invite.' });
        }
      }
    );

    // 1. Create a new room with profile support
    socket.on(
      'room:create',
      (
        payload: {
          playerName: string;
          avatarId?: string;
          difficulty?: DifficultyLevel;
          userId?: string;
          mistakeLimit?: number;
          feedbackMode?: 'instant' | 'delayed';
          customClues?: number;
        },
        callback?: (res: { ok: boolean; room?: RoomPublicState; error?: string }) => void
      ) => {
        try {
          const cleanName = (payload?.playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
          const avatarId = payload?.avatarId || 'avatar-falcon';
          const userId = payload?.userId || socketToUserId.get(socket.id);
          const difficulty: DifficultyLevel =
            payload?.difficulty && DIFFICULTY_LEVELS.includes(payload.difficulty)
              ? payload.difficulty
              : 'Medium';
          const feedbackMode = payload?.feedbackMode === 'delayed' ? 'delayed' : 'instant';
          const customClues =
            typeof payload?.customClues === 'number'
              ? Math.max(17, Math.min(65, payload.customClues))
              : undefined;

          leaveCurrentRoom(socket, io);

          const code = generateUniqueRoomCode();
          const hostPlayer: InternalPlayer = {
            id: socket.id,
            userId,
            name: cleanName,
            avatarId,
            isHost: true,
            isReady: false,
            isBot: false,
            connected: true,
            filledCount: 0,
            totalToFill: 0,
            mistakes: 0,
            finished: false,
            finishTimeMs: null,
            deltaTSeconds: null,
            rank: null,
            score: null,
            maxPossibleScore: null,
            minPossibleScore: null,
            board: [],
          };

          const room: InternalRoom = {
            code,
            hostId: socket.id,
            difficulty,
            status: 'LOBBY',
            maxPlayers: 999, // Unlimited player capacity
            mistakeLimit: typeof payload?.mistakeLimit === 'number' ? payload.mistakeLimit : 3,
            feedbackMode,
            customClues,
            players: new Map([[socket.id, hostPlayer]]),
            initialBoard: null,
            solutionBoard: null,
            totalEmptyCells: 0,
            startTime: null,
            firstFinishTimeMs: null,
            finishedOrder: [],
            messages: [
              {
                id: `welcome_${Date.now()}`,
                senderId: 'system',
                senderName: 'System',
                senderAvatarId: 'avatar-dragon',
                text: `Room ${code} created. Share the code to invite opponents!`,
                timestamp: Date.now(),
                isSystem: true,
              },
            ],
          };

          rooms.set(code, room);
          socketToRoom.set(socket.id, code);
          socket.join(code);

          const publicState = serializeRoom(room);
          callback?.({ ok: true, room: publicState });
        } catch (err) {
          callback?.({ ok: false, error: 'Failed to create room.' });
        }
      }
    );

    // 2. Join an existing room via 6-character code
    socket.on(
      'room:join',
      (
        payload: { code: string; playerName: string; avatarId?: string; userId?: string },
        callback?: (res: { ok: boolean; room?: RoomPublicState; error?: string }) => void
      ) => {
        const rawCode = (payload?.code || '').trim().toUpperCase();
        const cleanName = (payload?.playerName || 'Challenger').trim().slice(0, 20) || 'Challenger';
        const avatarId = payload?.avatarId || 'avatar-wolf';
        const userId = payload?.userId || socketToUserId.get(socket.id);

        if (!/^[A-Z0-9]{6}$/.test(rawCode)) {
          callback?.({
            ok: false,
            error: 'Invalid room code format. Room codes must be 6 alphanumeric characters.',
          });
          return;
        }

        const room = rooms.get(rawCode);
        if (!room) {
          callback?.({
            ok: false,
            error: `Room "${rawCode}" was not found. Verify the 6-character code with the host.`,
          });
          return;
        }

        if (room.status !== 'LOBBY') {
          callback?.({
            ok: false,
            error: `Match in room "${rawCode}" is already in progress.`,
          });
          return;
        }

        leaveCurrentRoom(socket, io);

        const newPlayer: InternalPlayer = {
          id: socket.id,
          userId,
          name: cleanName,
          avatarId,
          isHost: false,
          isReady: false,
          isBot: false,
          connected: true,
          filledCount: 0,
          totalToFill: 0,
          mistakes: 0,
          finished: false,
          finishTimeMs: null,
          deltaTSeconds: null,
          rank: null,
          score: null,
          maxPossibleScore: null,
          minPossibleScore: null,
          board: [],
        };

        room.players.set(socket.id, newPlayer);
        socketToRoom.set(socket.id, rawCode);
        socket.join(rawCode);

        // System join announcement
        room.messages.push({
          id: `join_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: avatarId,
          text: `${cleanName} joined the matchmaking room.`,
          timestamp: Date.now(),
          isSystem: true,
        });

        const publicState = serializeRoom(room);
        io.to(rawCode).emit('room:updated', publicState);
        callback?.({ ok: true, room: publicState });
      }
    );

    // Update Player Profile in-room
    socket.on(
      'player:update_profile',
      (
        payload: { username: string; avatarId: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        const player = room.players.get(socket.id);
        if (!player) return callback?.({ ok: false, error: 'Player not found.' });

        const oldName = player.name;
        player.name = (payload.username || player.name).trim().slice(0, 20);
        player.avatarId = payload.avatarId || player.avatarId;

        if (oldName !== player.name) {
          room.messages.push({
            id: `rename_${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderAvatarId: player.avatarId,
            text: `${oldName} changed handle to ${player.name}.`,
            timestamp: Date.now(),
            isSystem: true,
          });
        }

        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 3. Real-time Room Chat Broadcast with moderation
    socket.on(
      'chat:send',
      (
        payload: { text: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        const player = room.players.get(socket.id);
        if (!player) return callback?.({ ok: false, error: 'Player not found.' });

        const sanitized = sanitizeMessageText(payload.text || '');
        if (!sanitized) return callback?.({ ok: false, error: 'Empty message.' });

        const newMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: player.id,
          senderName: player.name,
          senderAvatarId: player.avatarId,
          text: sanitized,
          timestamp: Date.now(),
        };

        room.messages.push(newMsg);
        if (room.messages.length > 80) {
          room.messages.shift();
        }

        io.to(code).emit('chat:received', newMsg);
        callback?.({ ok: true });
      }
    );

    // Chat Moderation: Host can delete a disruptive message
    socket.on(
      'chat:delete',
      (
        payload: { messageId: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        if (room.hostId !== socket.id) {
          return callback?.({ ok: false, error: 'Only the host has moderation privileges.' });
        }

        room.messages = room.messages.filter((m) => m.id !== payload.messageId);
        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 4. Add an AI Challenger Bot
    socket.on(
      'room:add_bot',
      (callback?: (res: { ok: boolean; error?: string }) => void) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });
        if (room.hostId !== socket.id) {
          return callback?.({ ok: false, error: 'Only the room host can add AI challengers.' });
        }
        if (room.status !== 'LOBBY') {
          return callback?.({ ok: false, error: 'Cannot add challengers after match start.' });
        }

        const existingNames = new Set(Array.from(room.players.values()).map((p) => p.name));
        const botConfig =
          BOT_CONFIGS.find((b) => !existingNames.has(b.name)) || {
            name: `Challenger #${room.players.size + 1}`,
            avatarId: 'avatar-falcon',
          };
        const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const botPlayer: InternalPlayer = {
          id: botId,
          name: `${botConfig.name} (Bot)`,
          avatarId: botConfig.avatarId,
          isHost: false,
          isReady: true,
          isBot: true,
          connected: true,
          filledCount: 0,
          totalToFill: 0,
          mistakes: 0,
          finished: false,
          finishTimeMs: null,
          deltaTSeconds: null,
          rank: null,
          score: null,
          maxPossibleScore: null,
          minPossibleScore: null,
          board: [],
        };

        room.players.set(botId, botPlayer);
        room.messages.push({
          id: `bot_add_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: botConfig.avatarId,
          text: `Host added ${botPlayer.name} to the match.`,
          timestamp: Date.now(),
          isSystem: true,
        });

        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 5. Remove a Bot Challenger
    socket.on(
      'room:remove_bot',
      (payload: { botId: string }, callback?: (res: { ok: boolean; error?: string }) => void) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id || room.status !== 'LOBBY') {
          return callback?.({ ok: false, error: 'Action not permitted.' });
        }
        const target = room.players.get(payload.botId);
        if (target && target.isBot) {
          if (target.botTimer) clearTimeout(target.botTimer);
          room.players.delete(payload.botId);
          io.to(code).emit('room:updated', serializeRoom(room));
          callback?.({ ok: true });
        } else {
          callback?.({ ok: false, error: 'Bot not found.' });
        }
      }
    );

    // 6. Toggle Ready status
    socket.on(
      'player:toggle_ready',
      (callback?: (res: { ok: boolean; isReady?: boolean; error?: string }) => void) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not connected to any room.' });

        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room no longer exists.' });

        if (room.status !== 'LOBBY') {
          return callback?.({ ok: false, error: 'Game has already started.' });
        }

        const player = room.players.get(socket.id);
        if (!player) return callback?.({ ok: false, error: 'Player not found in room.' });

        player.isReady = !player.isReady;
        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true, isReady: player.isReady });
      }
    );

    // 7. Host changes difficulty level
    socket.on(
      'room:set_difficulty',
      (
        payload: { difficulty: DifficultyLevel; customClues?: number },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        if (room.hostId !== socket.id) {
          return callback?.({
            ok: false,
            error: 'Only the room creator (host) can change difficulty.',
          });
        }

        if (room.status !== 'LOBBY') {
          return callback?.({
            ok: false,
            error: 'Difficulty cannot be modified after the match starts.',
          });
        }

        if (!DIFFICULTY_LEVELS.includes(payload.difficulty)) {
          return callback?.({ ok: false, error: 'Invalid difficulty level selected.' });
        }

        room.difficulty = payload.difficulty;
        if (payload.difficulty === 'Custom' && typeof payload.customClues === 'number') {
          room.customClues = Math.max(17, Math.min(65, Math.floor(payload.customClues)));
        } else if (payload.difficulty !== 'Custom') {
          room.customClues = undefined;
        }

        const clueText = room.difficulty === 'Custom' && room.customClues ? `${room.customClues} clues` : `${DIFFICULTY_CONFIG[payload.difficulty].emptyCells} empty cells`;
        room.messages.push({
          id: `diff_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: 'avatar-dragon',
          text: `Match difficulty set to ${payload.difficulty} (${clueText}).`,
          timestamp: Date.now(),
          isSystem: true,
        });

        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 7.5. Host changes Mistake Limit configuration
    socket.on(
      'room:set_mistake_limit',
      (
        payload: { mistakeLimit: number },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        if (room.hostId !== socket.id) {
          return callback?.({
            ok: false,
            error: 'Only the room creator (host) can change the mistake limit.',
          });
        }

        if (room.status !== 'LOBBY') {
          return callback?.({
            ok: false,
            error: 'Mistake limit cannot be modified after match starts.',
          });
        }

        const limit = Math.max(0, Math.min(20, Math.floor(payload?.mistakeLimit ?? 3)));
        room.mistakeLimit = limit;
        const limitText = limit === 0 ? 'No Limit (Unlimited)' : `${limit} mistakes`;
        room.messages.push({
          id: `mistake_lim_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: 'avatar-dragon',
          text: `Match mistake limit configured to: ${limitText}.`,
          timestamp: Date.now(),
          isSystem: true,
        });

        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 8. Host triggers Start Game
    socket.on(
      'game:start',
      (callback?: (res: { ok: boolean; error?: string }) => void) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        if (room.hostId !== socket.id) {
          return callback?.({
            ok: false,
            error: 'Only the room host can start the match.',
          });
        }

        if (room.status !== 'LOBBY') {
          return callback?.({ ok: false, error: 'Match is already active.' });
        }

        const playersArray = Array.from(room.players.values());
        if (playersArray.length === 0) {
          return callback?.({ ok: false, error: 'No players in room.' });
        }

        const allReady = playersArray.every((p) => p.isReady);
        if (!allReady) {
          return callback?.({
            ok: false,
            error: 'All connected players must mark themselves as Ready before starting.',
          });
        }

        // Centrally generate the uniquely solvable Sudoku board on the server
        const { initialBoard, solutionBoard, emptyCellsCount, seed } = generateSudokuBoard(
          room.difficulty,
          undefined,
          room.customClues
        );

        room.puzzleSeed = seed;
        room.initialBoard = initialBoard;
        room.solutionBoard = solutionBoard;
        room.totalEmptyCells = emptyCellsCount;
        room.status = 'PLAYING';
        room.startTime = Date.now();
        room.firstFinishTimeMs = null;
        room.finishedOrder = [];

        room.messages.push({
          id: `start_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: 'avatar-dragon',
          text: `⚡ Match started! ${room.difficulty} difficulty. Good luck!`,
          timestamp: Date.now(),
          isSystem: true,
        });

        const startDiffMult = calculateDifficultyMultiplier(room.difficulty, room.customClues);

        // Initialize every player's board & telemetry
        for (const p of room.players.values()) {
          p.board = initialBoard.map((row) => [...row]);
          p.filledCount = 0;
          p.totalToFill = emptyCellsCount;
          p.mistakes = 0;
          p.hintsUsed = 0;
          p.comboStreak = 0;
          p.maxCombo = 1;
          p.difficultyMultiplier = startDiffMult;
          p.timeMultiplier = startDiffMult;
          p.finished = false;
          p.finishTimeMs = null;
          p.deltaTSeconds = null;
          p.rank = null;
          p.score = null;
          p.maxPossibleScore = null;
          p.minPossibleScore = null;

          if (p.isBot) {
            scheduleBotMove(room, p, io);
          }
        }

        const publicState = serializeRoom(room);
        io.to(code).emit('game:started', publicState);
        callback?.({ ok: true });
      }
    );

    // 9. Real-time Server-Side Move Validation against Master Solution Matrix
    socket.on(
      'game:submit_move',
      (
        payload: { row: number; col: number; value: number },
        callback?: (res: { ok: boolean; validation?: MoveValidationResponse; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room || room.status !== 'PLAYING' || !room.solutionBoard || !room.initialBoard) {
          return callback?.({ ok: false, error: 'No active match in progress.' });
        }

        const player = room.players.get(socket.id);
        if (!player || player.finished) {
          return callback?.({ ok: false, error: 'Player has already finished or is not active.' });
        }

        const { row, col, value } = payload;
        if (
          typeof row !== 'number' ||
          typeof col !== 'number' ||
          typeof value !== 'number' ||
          row < 0 ||
          row > 8 ||
          col < 0 ||
          col > 8 ||
          value < 1 ||
          value > 9
        ) {
          return callback?.({ ok: false, error: 'Coordinates or value out of range.' });
        }

        // If cell has already been occupied with a number, user cannot change it!
        if (player.board[row][col] !== 0) {
          return callback?.({
            ok: false,
            error: 'Cell is already occupied and cannot be changed.',
          });
        }

        // Handle delayed feedback mode (No immediate approved or wrong notification)
        if (room.feedbackMode === 'delayed') {
          player.board[row][col] = value;
          player.filledCount += 1;

          if (player.filledCount >= player.totalToFill) {
            let actualMistakes = 0;
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (player.board[r][c] !== room.solutionBoard[r][c]) {
                  actualMistakes++;
                }
              }
            }
            player.mistakes = actualMistakes;
            handlePlayerCompletion(room, player, io);
          } else {
            io.to(code).emit('room:updated', serializeRoom(room));
          }

          return callback?.({
            ok: true,
            validation: {
              row,
              col,
              value,
              correct: true,
              mistakes: 0,
              filledCount: player.filledCount,
              totalToFill: player.totalToFill,
              finished: player.finished,
              rank: player.rank,
              score: player.score,
              deltaTSeconds: player.deltaTSeconds,
              difficultyMultiplier: player.difficultyMultiplier,
              timeMultiplier: player.timeMultiplier,
            },
          });
        }

        const isCorrect = room.solutionBoard[row][col] === value;

        if (isCorrect) {
          player.board[row][col] = value;
          player.filledCount += 1;

          if (player.filledCount >= player.totalToFill) {
            handlePlayerCompletion(room, player, io);
          } else {
            io.to(code).emit('room:updated', serializeRoom(room));
          }
        } else {
          player.mistakes += 1;
          if (room.mistakeLimit > 0 && player.mistakes >= room.mistakeLimit && !player.finished) {
            player.isEliminated = true;
            player.finished = true;
            const elapsed = room.startTime ? Math.max(100, Date.now() - room.startTime) : 1000;
            player.finishTimeMs = elapsed;
            player.rank = room.players.size;
            player.score = 0;

            room.messages.push({
              id: `elim_${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderAvatarId: player.avatarId,
              text: `❌ ${player.name} reached the mistake limit (${player.mistakes}/${room.mistakeLimit}) and was knocked out!`,
              timestamp: Date.now(),
              isSystem: true,
            });

            const allFinished = Array.from(room.players.values())
              .filter((p) => p.connected)
              .every((p) => p.finished);
            if (allFinished) {
              room.status = 'FINISHED';
              clearRoomBots(room);
            }
          }
          io.to(code).emit('room:updated', serializeRoom(room));
        }

        const validation: MoveValidationResponse = {
          row,
          col,
          value,
          correct: isCorrect,
          mistakes: player.mistakes,
          filledCount: player.filledCount,
          totalToFill: player.totalToFill,
          finished: player.finished,
          rank: player.rank,
          score: player.score,
          deltaTSeconds: player.deltaTSeconds,
          isEliminated: player.isEliminated,
          difficultyMultiplier: player.difficultyMultiplier,
          timeMultiplier: player.timeMultiplier,
        };

        callback?.({ ok: true, validation });
      }
    );

    // 9.2. Local-authoritative gameplay telemetry sync: sends results & periodic time updates to other players
    socket.on(
      'player:sync_progress',
      (
        payload: {
          filledCount: number;
          mistakes: number;
          finished?: boolean;
          finishTimeMs?: number;
          isEliminated?: boolean;
          score?: number;
          hintsUsed?: number;
          comboStreak?: number;
          maxCombo?: number;
          difficultyMultiplier?: number;
          timeMultiplier?: number;
          maxScoreCap?: number | null;
          scoreBreakdown?: any;
        },
        callback?: (res: { ok: boolean; rank?: number | null; score?: number | null; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room || room.status !== 'PLAYING') return callback?.({ ok: false, error: 'No active match.' });

        const player = room.players.get(socket.id);
        if (!player) return callback?.({ ok: false, error: 'Player not found.' });

        if (typeof payload.filledCount === 'number') {
          player.filledCount = payload.filledCount;
        }
        if (typeof payload.mistakes === 'number') {
          player.mistakes = payload.mistakes;
        }
        if (typeof payload.hintsUsed === 'number') {
          player.hintsUsed = payload.hintsUsed;
        }
        if (typeof payload.comboStreak === 'number') {
          player.comboStreak = payload.comboStreak;
        }
        if (typeof payload.maxCombo === 'number') {
          player.maxCombo = payload.maxCombo;
        }
        if (typeof payload.difficultyMultiplier === 'number') {
          player.difficultyMultiplier = payload.difficultyMultiplier;
        }
        if (typeof payload.timeMultiplier === 'number') {
          player.timeMultiplier = payload.timeMultiplier;
        }
        if (payload.maxScoreCap !== undefined) {
          player.maxScoreCap = payload.maxScoreCap;
        }
        if (payload.scoreBreakdown) {
          player.scoreBreakdown = payload.scoreBreakdown;
        }
        if (typeof payload.score === 'number') {
          player.score = payload.score;
        }

        // Mistake limit elimination
        if (
          (payload.isEliminated || (room.mistakeLimit > 0 && player.mistakes >= room.mistakeLimit)) &&
          !player.finished
        ) {
          player.isEliminated = true;
          player.finished = true;
          const elapsed = room.startTime ? Math.max(100, Date.now() - room.startTime) : 1000;
          player.finishTimeMs = payload.finishTimeMs || elapsed;
          player.rank = room.players.size;
          player.score = 0;

          // Record match outcome for user account
          if (player.userId) {
            recordMatchOutcome(
              player.userId,
              0,
              player.rank,
              player.finishTimeMs,
              room.difficulty,
              player.mistakes
            );
          }

          room.messages.push({
            id: `elim_${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderAvatarId: player.avatarId,
            text: `❌ ${player.name} reached the mistake limit (${player.mistakes}/${room.mistakeLimit}) and was knocked out!`,
            timestamp: Date.now(),
            isSystem: true,
          });

          const allFinished = Array.from(room.players.values())
            .filter((p) => p.connected)
            .every((p) => p.finished);
          if (allFinished) {
            room.status = 'FINISHED';
            clearRoomBots(room);
          }

          io.to(code).emit('room:updated', serializeRoom(room));
          return callback?.({ ok: true, rank: player.rank, score: 0 });
        }

        // Finished completion
        if (payload.finished && !player.finished) {
          handlePlayerCompletion(room, player, io);
          return callback?.({ ok: true, rank: player.rank, score: player.score });
        }

        // Broadcast live progress telemetry to all competitors in room
        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true, rank: player.rank, score: player.score });
      }
    );

    // 9.5. Real-time Move Reversion / Undo
    socket.on(
      'game:undo_move',
      (
        payload: { row: number; col: number },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room || room.status !== 'PLAYING' || !room.initialBoard) {
          return callback?.({ ok: false, error: 'No active match.' });
        }

        const player = room.players.get(socket.id);
        if (!player || player.finished) {
          return callback?.({ ok: false, error: 'Player finished or inactive.' });
        }

        const { row, col } = payload;
        if (
          typeof row !== 'number' ||
          typeof col !== 'number' ||
          row < 0 ||
          row > 8 ||
          col < 0 ||
          col > 8
        ) {
          return callback?.({ ok: false, error: 'Invalid coordinates.' });
        }

        // Do not allow undoing initial clues
        if (room.initialBoard[row][col] !== 0) {
          return callback?.({ ok: false, error: 'Cannot undo puzzle initial clue.' });
        }

        if (player.board[row][col] !== 0) {
          player.board[row][col] = 0;
          player.filledCount = Math.max(0, player.filledCount - 1);
          io.to(code).emit('room:updated', serializeRoom(room));
        }

        callback?.({ ok: true });
      }
    );

    // 10. Return room to Lobby for a rematch
    socket.on(
      'room:return_to_lobby',
      (callback?: (res: { ok: boolean; error?: string }) => void) => {
        const code = socketToRoom.get(socket.id);
        if (!code) return callback?.({ ok: false, error: 'Not in a room.' });

        const room = rooms.get(code);
        if (!room) return callback?.({ ok: false, error: 'Room not found.' });

        if (room.hostId !== socket.id) {
          return callback?.({ ok: false, error: 'Only the room host can reset the lobby for a rematch.' });
        }

        clearRoomBots(room);
        room.status = 'LOBBY';
        room.initialBoard = null;
        room.solutionBoard = null;
        room.totalEmptyCells = 0;
        room.startTime = null;
        room.firstFinishTimeMs = null;
        room.finishedOrder = [];

        room.messages.push({
          id: `rematch_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderAvatarId: 'avatar-dragon',
          text: `Host reset match to Lobby for a rematch!`,
          timestamp: Date.now(),
          isSystem: true,
        });

        for (const [pid, p] of room.players.entries()) {
          if (!p.connected) {
            room.players.delete(pid);
            continue;
          }
          p.isReady = p.isBot ? true : false;
          p.filledCount = 0;
          p.totalToFill = 0;
          p.mistakes = 0;
          p.finished = false;
          p.finishTimeMs = null;
          p.deltaTSeconds = null;
          p.rank = null;
          p.score = null;
          p.maxPossibleScore = null;
          p.minPossibleScore = null;
          p.board = [];
        }

        io.to(code).emit('room:updated', serializeRoom(room));
        callback?.({ ok: true });
      }
    );

    // 11. Leave room explicitly
    socket.on('room:leave', (callback?: () => void) => {
      leaveCurrentRoom(socket, io);
      callback?.();
    });

    // 12. Handle unexpected disconnection
    socket.on('disconnect', () => {
      const uId = socketToUserId.get(socket.id);
      if (uId) {
        const set = userSockets.get(uId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(uId);
            io.emit('friends:presence_update', { userId: uId, online: false });
          }
        }
      }
      socketToUserId.delete(socket.id);
      leaveCurrentRoom(socket, io, true);
    });
  });

  function leaveCurrentRoom(socket: Socket, ioServer: SocketIOServer, isDisconnect = false) {
    const code = socketToRoom.get(socket.id);
    if (!code) return;

    socketToRoom.delete(socket.id);
    socket.leave(code);

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const departingName = player.name;

    if (room.status === 'LOBBY') {
      room.players.delete(socket.id);
    } else {
      player.connected = false;
    }

    room.messages.push({
      id: `leave_${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      senderAvatarId: player.avatarId,
      text: `${departingName} ${isDisconnect ? 'disconnected' : 'left'} the room.`,
      timestamp: Date.now(),
      isSystem: true,
    });

    const remainingHumans = Array.from(room.players.values()).filter(
      (p) => !p.isBot && p.connected
    );

    if (remainingHumans.length === 0) {
      clearRoomBots(room);
      rooms.delete(code);
      return;
    }

    if (room.hostId === socket.id) {
      player.isHost = false;
      const nextHost = remainingHumans[0];
      nextHost.isHost = true;
      room.hostId = nextHost.id;
      ioServer.to(code).emit('room:notification', {
        message: `${departingName} ${isDisconnect ? 'disconnected' : 'left'}. ${nextHost.name} is now the room host.`,
      });
    } else {
      ioServer.to(code).emit('room:notification', {
        message: `${departingName} ${isDisconnect ? 'disconnected from' : 'left'} the room.`,
      });
    }

    if (room.status === 'PLAYING') {
      const allActiveFinished = Array.from(room.players.values())
        .filter((p) => p.connected)
        .every((p) => p.finished);
      if (allActiveFinished) {
        room.status = 'FINISHED';
        clearRoomBots(room);
      }
    }

    ioServer.to(code).emit('room:updated', serializeRoom(room));
  }

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Nueve Multiplayer Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
