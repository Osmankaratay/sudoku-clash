import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserAccount,
  UserStats,
  DetailedCareerStats,
  MatchHistoryRecord,
  DifficultyTierStats,
  DifficultyLevel,
} from './types/game.ts';

export interface StoredUser extends UserAccount {
  passwordHash: string;
  salt: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  createdAt: number;
  lastActive: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory maps backed by atomic JSON persistence
const usersByUsername = new Map<string, StoredUser>();
const usersById = new Map<string, StoredUser>();
const sessionsByToken = new Map<string, StoredSession>(); // token -> StoredSession

// Brute-force protection: track failed attempts per username
interface LoginAttemptRecord {
  count: number;
  firstAttemptTime: number;
  lockoutUntil?: number;
}
const failedLoginAttempts = new Map<string, LoginAttemptRecord>();

function loadUsersFromDisk() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed: StoredUser[] = JSON.parse(data);
      for (const u of parsed) {
        if (!u.friends) u.friends = [];
        if (!u.stats) {
          u.stats = { gamesPlayed: 0, gamesWon: 0, bestScore: 0, totalScore: 0 };
        }
        if (u.stats.totalFinishTimeMs === undefined) u.stats.totalFinishTimeMs = 0;
        if (u.stats.bestFinishTimeMs === undefined) u.stats.bestFinishTimeMs = null;
        if (u.stats.currentStreak === undefined) u.stats.currentStreak = 0;
        if (u.stats.bestStreak === undefined) u.stats.bestStreak = 0;
        if (u.stats.totalMistakes === undefined) u.stats.totalMistakes = 0;
        if (!u.stats.difficultyStats) u.stats.difficultyStats = {};
        if (!u.stats.recentMatches) u.stats.recentMatches = [];

        usersByUsername.set(u.username.toLowerCase(), u);
        usersById.set(u.id, u);
      }
    } catch (err) {
      console.error('Failed to parse users.json, starting with empty store:', err);
    }
  }
}

function saveUsersToDisk() {
  try {
    const list = Array.from(usersById.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write users.json:', err);
  }
}

function loadSessionsFromDisk() {
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed: StoredSession[] = JSON.parse(data);
      const now = Date.now();
      const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days session validity

      for (const s of parsed) {
        if (now - s.lastActive < MAX_SESSION_AGE_MS && usersById.has(s.userId)) {
          sessionsByToken.set(s.token, s);
        }
      }
    } catch (err) {
      console.error('Failed to parse sessions.json:', err);
    }
  }
}

function saveSessionsToDisk() {
  try {
    const list = Array.from(sessionsByToken.values());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write sessions.json:', err);
  }
}

// Load existing users and sessions upon startup
loadUsersFromDisk();
loadSessionsFromDisk();

function ensureDemoUserExists() {
  const now = Date.now();
  const demoMatches: MatchHistoryRecord[] = [
    { id: 'm_demo_1', timestamp: now - 1000 * 60 * 18, difficulty: 'Hard', rank: 1, score: 98, finishTimeMs: 145000, mistakes: 0 },
    { id: 'm_demo_2', timestamp: now - 1000 * 60 * 75, difficulty: 'Medium', rank: 1, score: 100, finishTimeMs: 112000, mistakes: 0 },
    { id: 'm_demo_3', timestamp: now - 1000 * 60 * 190, difficulty: 'Expert', rank: 2, score: 91, finishTimeMs: 230000, mistakes: 1 },
    { id: 'm_demo_4', timestamp: now - 1000 * 60 * 360, difficulty: 'Hard', rank: 1, score: 97, finishTimeMs: 154000, mistakes: 0 },
    { id: 'm_demo_5', timestamp: now - 1000 * 60 * 520, difficulty: 'Very Hard', rank: 3, score: 82, finishTimeMs: 290000, mistakes: 2 },
    { id: 'm_demo_6', timestamp: now - 1000 * 60 * 800, difficulty: 'Medium', rank: 1, score: 100, finishTimeMs: 118000, mistakes: 0 },
    { id: 'm_demo_7', timestamp: now - 1000 * 60 * 1200, difficulty: 'Easy', rank: 1, score: 100, finishTimeMs: 76000, mistakes: 0 },
    { id: 'm_demo_8', timestamp: now - 1000 * 60 * 1600, difficulty: 'Pro', rank: 2, score: 88, finishTimeMs: 340000, mistakes: 1 },
    { id: 'm_demo_9', timestamp: now - 1000 * 60 * 2100, difficulty: 'Hard', rank: 1, score: 96, finishTimeMs: 162000, mistakes: 0 },
    { id: 'm_demo_10', timestamp: now - 1000 * 60 * 2800, difficulty: 'Medium', rank: 4, score: 74, finishTimeMs: 195000, mistakes: 3 },
  ];

  if (!usersByUsername.has('mastersolver9')) {
    registerUser('MasterSolver9', 'solver123', 'avatar-falcon', 'solver@nueve.arena', {
      gamesPlayed: 14,
      gamesWon: 11,
      bestScore: 980,
      totalScore: 9450,
      bestFinishTimeMs: 145000,
      currentStreak: 4,
      bestStreak: 7,
      recentMatches: demoMatches,
    });
  } else {
    const existingDemo = usersByUsername.get('mastersolver9');
    if (existingDemo && (!existingDemo.stats.recentMatches || existingDemo.stats.recentMatches.length === 0)) {
      existingDemo.stats.recentMatches = demoMatches;
      saveUsersToDisk();
    }
  }
}
ensureDemoUserExists();

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 12000, 64, 'sha512').toString('hex');
}

export function sanitizeUser(u: StoredUser): UserAccount {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
    stats: u.stats,
    friends: u.friends || [],
  };
}

export function registerUser(
  username: string,
  password: string,
  avatarId = 'avatar-falcon',
  email?: string,
  initialStats?: Partial<UserStats>
): { user?: UserAccount; token?: string; error?: string } {
  const cleanName = username.trim();
  if (cleanName.length < 3 || cleanName.length > 20) {
    return { error: 'Username must be between 3 and 20 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
    return { error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' };
  }

  let cleanEmail: string | undefined = undefined;
  if (email && email.trim()) {
    cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: 'Please provide a valid email address.' };
    }
  }

  const key = cleanName.toLowerCase();
  if (usersByUsername.has(key)) {
    return { error: 'Username is already taken. Please choose another handle.' };
  }

  const id = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const newUser: StoredUser = {
    id,
    username: cleanName,
    email: cleanEmail,
    avatarId: avatarId || 'avatar-falcon',
    createdAt: Date.now(),
    passwordHash,
    salt,
    stats: {
      gamesPlayed: initialStats?.gamesPlayed || 0,
      gamesWon: initialStats?.gamesWon || 0,
      bestScore: initialStats?.bestScore || 0,
      totalScore: initialStats?.totalScore || 0,
      bestFinishTimeMs: initialStats?.bestFinishTimeMs || null,
      totalFinishTimeMs: initialStats?.totalFinishTimeMs || 0,
      currentStreak: initialStats?.currentStreak || 0,
      bestStreak: initialStats?.bestStreak || 0,
      totalMistakes: initialStats?.totalMistakes || 0,
      difficultyStats: initialStats?.difficultyStats || {},
      recentMatches: initialStats?.recentMatches || [],
    },
    friends: [],
  };

  usersByUsername.set(key, newUser);
  usersById.set(id, newUser);
  saveUsersToDisk();

  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  const session: StoredSession = {
    token,
    userId: id,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  sessionsByToken.set(token, session);
  saveSessionsToDisk();

  return { user: sanitizeUser(newUser), token };
}

export function loginUser(
  username: string,
  password: string
): { user?: UserAccount; token?: string; error?: string } {
  const cleanName = username.trim();
  const key = cleanName.toLowerCase();

  // Check brute force throttling
  const now = Date.now();
  const attemptRecord = failedLoginAttempts.get(key);
  if (attemptRecord && attemptRecord.lockoutUntil && attemptRecord.lockoutUntil > now) {
    const remainingSecs = Math.ceil((attemptRecord.lockoutUntil - now) / 1000);
    return {
      error: `Too many failed login attempts. Please wait ${remainingSecs} seconds before trying again.`,
    };
  }

  const user = usersByUsername.get(key);
  if (!user) {
    recordFailedAttempt(key);
    return { error: 'Invalid username or password.' };
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    recordFailedAttempt(key);
    return { error: 'Invalid username or password.' };
  }

  // Login successful: reset failed attempt counter
  failedLoginAttempts.delete(key);

  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  const session: StoredSession = {
    token,
    userId: user.id,
    createdAt: now,
    lastActive: now,
  };
  sessionsByToken.set(token, session);
  saveSessionsToDisk();

  return { user: sanitizeUser(user), token };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const existing = failedLoginAttempts.get(key);
  if (!existing || now - existing.firstAttemptTime > 15 * 60 * 1000) {
    failedLoginAttempts.set(key, { count: 1, firstAttemptTime: now });
  } else {
    existing.count += 1;
    if (existing.count >= 5) {
      existing.lockoutUntil = now + 5 * 60 * 1000; // 5 minute lock
    }
  }
}

export function logoutUser(token: string): { ok: boolean } {
  if (!token) return { ok: true };
  if (sessionsByToken.has(token)) {
    sessionsByToken.delete(token);
    saveSessionsToDisk();
  }
  return { ok: true };
}

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; user?: UserAccount; error?: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, error: 'User not found.' };

  if (!currentPassword) {
    return { ok: false, error: 'Please enter your current password.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters long.' };
  }

  const currentHash = hashPassword(currentPassword, user.salt);
  if (currentHash !== user.passwordHash) {
    return { ok: false, error: 'Current password does not match.' };
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: 'New password must be different from current password.' };
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.salt = newSalt;
  user.passwordHash = hashPassword(newPassword, newSalt);

  saveUsersToDisk();
  return { ok: true, user: sanitizeUser(user) };
}

export function getUserFromToken(token: string): UserAccount | null {
  if (!token) return null;
  const session = sessionsByToken.get(token);
  if (!session) return null;

  const user = usersById.get(session.userId);
  if (!user) return null;

  // Touch session timestamp
  session.lastActive = Date.now();
  return sanitizeUser(user);
}

export function updateUserProfile(
  userId: string,
  avatarId?: string,
  username?: string,
  email?: string
): { user?: UserAccount; error?: string } {
  const user = usersById.get(userId);
  if (!user) return { error: 'User not found.' };

  if (username && username.trim() !== user.username) {
    const clean = username.trim();
    if (clean.length < 3 || clean.length > 20) {
      return { error: 'Username must be between 3 and 20 characters.' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
      return { error: 'Username can only contain alphanumeric characters, hyphens, and underscores.' };
    }
    const newKey = clean.toLowerCase();
    if (usersByUsername.has(newKey) && usersByUsername.get(newKey)?.id !== userId) {
      return { error: 'Username is already taken.' };
    }
    usersByUsername.delete(user.username.toLowerCase());
    user.username = clean;
    usersByUsername.set(newKey, user);
  }

  if (avatarId) {
    user.avatarId = avatarId;
  }

  if (email !== undefined) {
    if (email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { error: 'Please enter a valid email address.' };
      }
      user.email = cleanEmail;
    } else {
      user.email = undefined;
    }
  }

  saveUsersToDisk();
  return { user: sanitizeUser(user) };
}

export function mergeGuestStats(
  userId: string,
  guestStats: Partial<UserStats>
): { ok: boolean; user?: UserAccount; error?: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, error: 'User not found.' };

  if (guestStats.gamesPlayed) {
    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + guestStats.gamesPlayed;
  }
  if (guestStats.gamesWon) {
    user.stats.gamesWon = (user.stats.gamesWon || 0) + guestStats.gamesWon;
  }
  if (guestStats.totalScore) {
    user.stats.totalScore = (user.stats.totalScore || 0) + guestStats.totalScore;
  }
  if (guestStats.bestScore && guestStats.bestScore > (user.stats.bestScore || 0)) {
    user.stats.bestScore = guestStats.bestScore;
  }
  if (guestStats.bestFinishTimeMs) {
    if (!user.stats.bestFinishTimeMs || guestStats.bestFinishTimeMs < user.stats.bestFinishTimeMs) {
      user.stats.bestFinishTimeMs = guestStats.bestFinishTimeMs;
    }
  }

  saveUsersToDisk();
  return { ok: true, user: sanitizeUser(user) };
}

export function recordMatchOutcome(
  userId: string,
  score: number,
  rank: number,
  finishTimeMs = 0,
  difficulty = 'Medium',
  mistakes = 0
) {
  const user = usersById.get(userId);
  if (!user) return;

  if (user.stats.totalFinishTimeMs === undefined) user.stats.totalFinishTimeMs = 0;
  if (!user.stats.difficultyStats) user.stats.difficultyStats = {};
  if (!user.stats.recentMatches) user.stats.recentMatches = [];
  if (user.stats.totalMistakes === undefined) user.stats.totalMistakes = 0;
  if (user.stats.currentStreak === undefined) user.stats.currentStreak = 0;
  if (user.stats.bestStreak === undefined) user.stats.bestStreak = 0;

  user.stats.gamesPlayed += 1;
  const isWin = rank === 1;
  if (isWin) {
    user.stats.gamesWon += 1;
    user.stats.currentStreak = (user.stats.currentStreak || 0) + 1;
    if (user.stats.currentStreak > (user.stats.bestStreak || 0)) {
      user.stats.bestStreak = user.stats.currentStreak;
    }
  } else {
    user.stats.currentStreak = 0;
  }

  user.stats.totalScore += Math.round(score);
  if (score > user.stats.bestScore) {
    user.stats.bestScore = Math.round(score);
  }

  if (finishTimeMs > 0) {
    user.stats.totalFinishTimeMs = (user.stats.totalFinishTimeMs || 0) + finishTimeMs;
    if (
      !user.stats.bestFinishTimeMs ||
      finishTimeMs < user.stats.bestFinishTimeMs
    ) {
      user.stats.bestFinishTimeMs = finishTimeMs;
    }
  }

  user.stats.totalMistakes = (user.stats.totalMistakes || 0) + (mistakes || 0);

  // Difficulty tier tracking
  const diffKey = difficulty || 'Medium';
  if (!user.stats.difficultyStats[diffKey]) {
    user.stats.difficultyStats[diffKey] = {
      played: 0,
      won: 0,
      bestTimeMs: null,
      totalTimeMs: 0,
    };
  }
  const diffObj = user.stats.difficultyStats[diffKey];
  diffObj.played += 1;
  if (isWin) diffObj.won += 1;
  if (finishTimeMs > 0) {
    diffObj.totalTimeMs += finishTimeMs;
    if (!diffObj.bestTimeMs || finishTimeMs < diffObj.bestTimeMs) {
      diffObj.bestTimeMs = finishTimeMs;
    }
  }

  // Recent match log
  const record: MatchHistoryRecord = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    difficulty: diffKey as any,
    rank,
    score: Math.round(score),
    finishTimeMs,
    mistakes,
  };
  user.stats.recentMatches.unshift(record);
  if (user.stats.recentMatches.length > 25) {
    user.stats.recentMatches.pop();
  }

  saveUsersToDisk();
}

export function getDetailedCareerStats(userId: string): DetailedCareerStats | null {
  const user = usersById.get(userId);
  if (!user) return null;

  const stats = user.stats;
  const gamesPlayed = stats.gamesPlayed || 0;
  const gamesWon = stats.gamesWon || 0;
  const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
  const totalFinishTimeMs = stats.totalFinishTimeMs || 0;
  const averageTimeMs =
    gamesPlayed > 0 && totalFinishTimeMs > 0
      ? Math.round(totalFinishTimeMs / gamesPlayed)
      : null;
  const totalScore = stats.totalScore || 0;
  const averageScore = gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0;
  const totalMistakes = stats.totalMistakes || 0;
  const averageMistakesPerGame =
    gamesPlayed > 0 ? Number((totalMistakes / gamesPlayed).toFixed(1)) : 0;

  const recent = stats.recentMatches || [];
  const podiumFinishes = recent.filter((m) => m.rank <= 3).length;

  const allDifficulties: DifficultyLevel[] = [
    'Easy',
    'Medium',
    'Hard',
    'Very Hard',
    'Expert',
    'Pro',
  ];
  const diffRecord: Record<DifficultyLevel, DifficultyTierStats> = {} as any;
  for (const diff of allDifficulties) {
    const raw = stats.difficultyStats?.[diff];
    diffRecord[diff] = {
      played: raw?.played || 0,
      won: raw?.won || 0,
      bestTimeMs: raw?.bestTimeMs || null,
      totalTimeMs: raw?.totalTimeMs || 0,
    };
  }

  return {
    userId: user.id,
    username: user.username,
    avatarId: user.avatarId,
    createdAt: user.createdAt,
    gamesPlayed,
    gamesWon,
    winRate: Number(winRate.toFixed(1)),
    totalFinishTimeMs,
    averageTimeMs,
    bestFinishTimeMs: stats.bestFinishTimeMs || null,
    bestScore: stats.bestScore || 0,
    totalScore,
    averageScore,
    currentStreak: stats.currentStreak || 0,
    bestStreak: stats.bestStreak || 0,
    totalMistakes,
    averageMistakesPerGame,
    podiumFinishes,
    difficultyStats: diffRecord,
    recentMatches: recent,
  };
}

export function addFriend(
  userId: string,
  targetUsername: string
): { ok: boolean; friend?: UserAccount; error?: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, error: 'User not found.' };

  const cleanTarget = targetUsername.trim().toLowerCase();
  const targetUser = usersByUsername.get(cleanTarget);
  if (!targetUser) {
    return { ok: false, error: `User "${targetUsername.trim()}" not found.` };
  }

  if (targetUser.id === userId) {
    return { ok: false, error: 'You cannot add yourself as a friend.' };
  }

  if (!user.friends) user.friends = [];
  if (user.friends.includes(targetUser.id)) {
    return { ok: false, error: `${targetUser.username} is already in your friends list.` };
  }

  user.friends.push(targetUser.id);

  // Mutual friendship
  if (!targetUser.friends) targetUser.friends = [];
  if (!targetUser.friends.includes(userId)) {
    targetUser.friends.push(userId);
  }

  saveUsersToDisk();
  return { ok: true, friend: sanitizeUser(targetUser) };
}

export function removeFriend(userId: string, friendId: string): { ok: boolean; error?: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, error: 'User not found.' };

  if (user.friends) {
    user.friends = user.friends.filter((id) => id !== friendId);
  }

  const friend = usersById.get(friendId);
  if (friend && friend.friends) {
    friend.friends = friend.friends.filter((id) => id !== userId);
  }

  saveUsersToDisk();
  return { ok: true };
}

export function getFriendUsers(userId: string): StoredUser[] {
  const user = usersById.get(userId);
  if (!user || !user.friends) return [];

  const list: StoredUser[] = [];
  for (const fId of user.friends) {
    const friend = usersById.get(fId);
    if (friend) {
      list.push(friend);
    }
  }
  return list;
}

export function getAllRegisteredUsers(): StoredUser[] {
  return Array.from(usersById.values());
}
