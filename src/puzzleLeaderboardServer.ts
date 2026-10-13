import fs from 'fs';
import path from 'path';
import {
  DifficultyLevel,
  PuzzleSolverRecord,
  PuzzleSeedLeaderboardResponse,
  ErrorFilterCategory,
  AllTimeLeaderboardEntry,
  AllTimeLeaderboardResponse,
  DailyChallengeInfo,
  DailyStreakState,
  DailyChallengeSubmitResult,
} from './types/game.ts';
import { getAllRegisteredUsers } from './authServer.ts';
import { generateSudokuBoard, calculatePuzzleSeed } from './sudokuEngine.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
const PUZZLE_LEADERBOARD_FILE = path.join(DATA_DIR, 'puzzle_leaderboards.json');
const DAILY_CHALLENGE_FILE = path.join(DATA_DIR, 'daily_challenges.json');
const DAILY_STREAKS_FILE = path.join(DATA_DIR, 'daily_streaks.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory map: puzzleSeed -> PuzzleSolverRecord[]
const puzzleSolversMap = new Map<string, PuzzleSolverRecord[]>();

// Daily challenge cache: dateKey ("YYYY-MM-DD") -> DailyChallengeInfo & records
interface StoredDailyChallenge {
  dateKey: string;
  difficulty: DifficultyLevel;
  puzzleSeed: string;
  initialBoard: number[][];
  solutionBoard: number[][];
  totalEmptyCells: number;
  expiresAt: number;
}
const dailyChallengesMap = new Map<string, StoredDailyChallenge>();

// Player streaks map: userId/playerKey -> DailyStreakState
const playerStreaksMap = new Map<string, DailyStreakState>();

function loadDailyDataFromDisk() {
  if (fs.existsSync(DAILY_CHALLENGE_FILE)) {
    try {
      const data = fs.readFileSync(DAILY_CHALLENGE_FILE, 'utf-8');
      const parsed: Record<string, StoredDailyChallenge> = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        dailyChallengesMap.set(k, v);
      }
    } catch (err) {
      console.error('Failed to parse daily_challenges.json:', err);
    }
  }

  if (fs.existsSync(DAILY_STREAKS_FILE)) {
    try {
      const data = fs.readFileSync(DAILY_STREAKS_FILE, 'utf-8');
      const parsed: Record<string, DailyStreakState> = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        playerStreaksMap.set(k, v);
      }
    } catch (err) {
      console.error('Failed to parse daily_streaks.json:', err);
    }
  }
}

function saveDailyDataToDisk() {
  try {
    const dailyObj: Record<string, StoredDailyChallenge> = {};
    for (const [k, v] of dailyChallengesMap.entries()) {
      dailyObj[k] = v;
    }
    fs.writeFileSync(DAILY_CHALLENGE_FILE, JSON.stringify(dailyObj, null, 2), 'utf-8');

    const streakObj: Record<string, DailyStreakState> = {};
    for (const [k, v] of playerStreaksMap.entries()) {
      streakObj[k] = v;
    }
    fs.writeFileSync(DAILY_STREAKS_FILE, JSON.stringify(streakObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save daily data:', err);
  }
}

loadDailyDataFromDisk();

function loadPuzzleLeaderboardsFromDisk() {
  if (fs.existsSync(PUZZLE_LEADERBOARD_FILE)) {
    try {
      const data = fs.readFileSync(PUZZLE_LEADERBOARD_FILE, 'utf-8');
      const parsed: Record<string, PuzzleSolverRecord[]> = JSON.parse(data);
      for (const [seed, records] of Object.entries(parsed)) {
        puzzleSolversMap.set(seed, records);
      }
    } catch (err) {
      console.error('Failed to parse puzzle_leaderboards.json:', err);
    }
  }
}

function savePuzzleLeaderboardsToDisk() {
  try {
    const obj: Record<string, PuzzleSolverRecord[]> = {};
    for (const [seed, records] of puzzleSolversMap.entries()) {
      obj[seed] = records;
    }
    fs.writeFileSync(PUZZLE_LEADERBOARD_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write puzzle_leaderboards.json:', err);
  }
}

loadPuzzleLeaderboardsFromDisk();

/**
 * Returns UTC Date string "YYYY-MM-DD"
 */
export function getCurrentUTCDateKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns timestamp in ms for the next UTC midnight (refresh time)
 */
export function getNextUTCMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.getTime();
}

/**
 * Get or deterministically generate today's high-difficulty Daily Challenge board.
 * Alternates between "Expert" and "Pro" high-difficulty specification.
 */
export function getOrCreateDailyChallenge(dateKey = getCurrentUTCDateKey()): StoredDailyChallenge {
  let challenge = dailyChallengesMap.get(dateKey);
  if (challenge) {
    return challenge;
  }

  // Determine difficulty: alternate between Expert and Pro
  const dayNum = parseInt(dateKey.replace(/-/g, ''), 10);
  const difficulty: DifficultyLevel = dayNum % 2 === 0 ? 'Expert' : 'Pro';

  // Generate deterministic high-difficulty board for today
  const dailySeed = `DAILY-${dateKey}`;
  const { initialBoard, solutionBoard, emptyCellsCount, seed } = generateSudokuBoard(difficulty, dailySeed);
  const puzzleSeed = seed;
  const expiresAt = getNextUTCMidnight();

  challenge = {
    dateKey,
    difficulty,
    puzzleSeed,
    initialBoard,
    solutionBoard,
    totalEmptyCells: emptyCellsCount,
    expiresAt,
  };

  dailyChallengesMap.set(dateKey, challenge);
  saveDailyDataToDisk();

  // Seed competitive benchmarks for the daily puzzle
  seedInitialPuzzleCompetitors(puzzleSeed, difficulty);
  return challenge;
}

export function getDailyChallengePublicInfo(dateKey = getCurrentUTCDateKey()): DailyChallengeInfo {
  const challenge = getOrCreateDailyChallenge(dateKey);
  const solvers = puzzleSolversMap.get(challenge.puzzleSeed) || [];
  const topScore = solvers.length > 0 ? Math.max(...solvers.map((s) => s.score)) : null;

  return {
    dateKey: challenge.dateKey,
    difficulty: challenge.difficulty,
    puzzleSeed: challenge.puzzleSeed,
    initialBoard: challenge.initialBoard,
    solutionBoard: challenge.solutionBoard,
    totalEmptyCells: challenge.totalEmptyCells,
    expiresAt: challenge.expiresAt,
    totalSolvers: solvers.length,
    topScore,
  };
}

/**
 * Retrieve or init player daily streak
 */
export function getPlayerDailyStreak(playerKey: string): DailyStreakState {
  let streak = playerStreaksMap.get(playerKey);
  if (!streak) {
    streak = {
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDateKey: null,
      history: [],
      badges: [],
    };
    playerStreaksMap.set(playerKey, streak);
  }
  return streak;
}

/**
 * Submit completion of daily challenge, update consecutive streak, and award badges
 */
export function recordDailyChallengeCompletion(
  playerKey: string,
  playerName: string,
  avatarId: string,
  userId: string | undefined,
  finishTimeMs: number,
  mistakes: number,
  score: number
): DailyChallengeSubmitResult {
  const dateKey = getCurrentUTCDateKey();
  const challenge = getOrCreateDailyChallenge(dateKey);

  // Record solver
  const record = recordPuzzleSolver(challenge.puzzleSeed, challenge.difficulty, {
    playerName,
    avatarId,
    userId,
    score,
    finishTimeMs,
    mistakes,
  });

  // Calculate Rank
  const solvers = puzzleSolversMap.get(challenge.puzzleSeed) || [];
  const sorted = [...solvers].sort((a, b) => {
    if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;
    return a.finishTimeMs - b.finishTimeMs;
  });
  const rank = Math.max(1, sorted.findIndex((s) => s.id === record.id) + 1);

  // Update streak
  const streak = getPlayerDailyStreak(playerKey);

  // Check if today was already completed
  const alreadyCompletedToday = streak.lastCompletedDateKey === dateKey;
  if (!alreadyCompletedToday) {
    // Check if yesterday was completed
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterdayKey = getCurrentUTCDateKey(yesterdayDate);

    if (streak.lastCompletedDateKey === yesterdayKey) {
      streak.currentStreak += 1;
    } else {
      streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.bestStreak) {
      streak.bestStreak = streak.currentStreak;
    }

    streak.lastCompletedDateKey = dateKey;
  }

  streak.history.push({
    dateKey,
    score,
    finishTimeMs,
    rank,
  });

  // Badge rewards:
  // 1. "Committed" badge rewarded for consecutive daily streak (streak >= 1 or streak >= 3)
  const earnedCommittedBadge = streak.currentStreak >= 1;
  if (earnedCommittedBadge && !streak.badges.includes('committed')) {
    streak.badges.push('committed');
  }

  // 2. "Daily Master" badge for top performers (rank <= 3 on daily challenge board)
  const earnedDailyMasterBadge = rank <= 3;
  if (earnedDailyMasterBadge && !streak.badges.includes('daily-master')) {
    streak.badges.push('daily-master');
  }

  playerStreaksMap.set(playerKey, streak);
  saveDailyDataToDisk();

  return {
    dateKey,
    rank,
    score,
    finishTimeMs,
    mistakes,
    currentStreak: streak.currentStreak,
    earnedCommittedBadge,
    earnedDailyMasterBadge,
  };
}

/**
 * Generate believable competitor records for a new puzzle seed
 * so players immediately see global benchmarks across all error categories.
 */
function seedInitialPuzzleCompetitors(puzzleSeed: string, difficulty: DifficultyLevel): PuzzleSolverRecord[] {
  const seedNum = parseInt(puzzleSeed.replace(/\D/g, '').slice(0, 6) || '42', 10);
  const baseTimeMap: Record<DifficultyLevel, number> = {
    Easy: 95000,
    Medium: 165000,
    Hard: 240000,
    'Very Hard': 320000,
    Expert: 410000,
    Pro: 520000,
    Custom: 200000,
  };
  const baseMs = baseTimeMap[difficulty] || 160000;

  const mockUsers = [
    { name: 'VortexGrandmaster', avatar: 'avatar-dragon', err: 0, timeMul: 0.82, pts: 100 },
    { name: 'LunaSudoku', avatar: 'avatar-phoenix', err: 0, timeMul: 0.91, pts: 95 },
    { name: 'CyberGrid_99', avatar: 'avatar-ninja', err: 0, timeMul: 0.98, pts: 90 },
    { name: 'EchoLogic', avatar: 'avatar-falcon', err: 1, timeMul: 1.05, pts: 85 },
    { name: 'TacticalBlade', avatar: 'avatar-wolf', err: 1, timeMul: 1.14, pts: 80 },
    { name: 'NebulaSolver', avatar: 'avatar-lion', err: 1, timeMul: 1.22, pts: 75 },
    { name: 'AeroShift', avatar: 'avatar-tiger', err: 2, timeMul: 1.28, pts: 70 },
    { name: 'MatrixPencil', avatar: 'avatar-panther', err: 2, timeMul: 1.35, pts: 65 },
    { name: 'QuantumChallenger', avatar: 'avatar-bear', err: 3, timeMul: 1.48, pts: 55 },
    { name: 'RookieStriker', avatar: 'avatar-falcon', err: 4, timeMul: 1.65, pts: 45 },
  ];

  const now = Date.now();
  const records: PuzzleSolverRecord[] = mockUsers.map((u, i) => {
    const timeVariance = ((seedNum * (i + 1)) % 15000) - 7500;
    const finalTime = Math.max(25000, Math.round(baseMs * u.timeMul + timeVariance));

    return {
      id: `seed_rec_${puzzleSeed}_${i}`,
      puzzleSeed,
      difficulty,
      playerName: u.name,
      avatarId: u.avatar,
      score: u.pts,
      finishTimeMs: finalTime,
      mistakes: u.err,
      completedAt: now - (i * 3600000 + ((seedNum * (i + 3)) % 7200000)),
    };
  });

  return records;
}

/**
 * Record a player's completion for a specific puzzle seed.
 */
export function recordPuzzleSolver(
  puzzleSeed: string,
  difficulty: DifficultyLevel,
  data: {
    playerName: string;
    avatarId: string;
    userId?: string;
    score: number;
    finishTimeMs: number;
    mistakes: number;
  }
): PuzzleSolverRecord {
  let records = puzzleSolversMap.get(puzzleSeed);
  if (!records) {
    records = seedInitialPuzzleCompetitors(puzzleSeed, difficulty);
    puzzleSolversMap.set(puzzleSeed, records);
  }

  const newRecord: PuzzleSolverRecord = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    puzzleSeed,
    difficulty,
    playerName: data.playerName,
    avatarId: data.avatarId,
    userId: data.userId,
    score: data.score,
    finishTimeMs: data.finishTimeMs,
    mistakes: data.mistakes,
    completedAt: Date.now(),
  };

  records.push(newRecord);
  savePuzzleLeaderboardsToDisk();
  return newRecord;
}

/**
 * Retrieve the Global Puzzle Seed Leaderboard for a puzzle ID/seed,
 * supporting categorization by zero error, 1 error, 2 error, and 3+ errors.
 */
export function getPuzzleLeaderboard(
  puzzleSeed: string,
  difficulty: DifficultyLevel = 'Medium',
  errorFilter: ErrorFilterCategory = 'all'
): PuzzleSeedLeaderboardResponse {
  let records = puzzleSolversMap.get(puzzleSeed);
  if (!records || records.length === 0) {
    records = seedInitialPuzzleCompetitors(puzzleSeed, difficulty);
    puzzleSolversMap.set(puzzleSeed, records);
    savePuzzleLeaderboardsToDisk();
  }

  // Count breakdowns
  const zeroErrorCount = records.filter((r) => r.mistakes === 0).length;
  const oneErrorCount = records.filter((r) => r.mistakes === 1).length;
  const twoErrorCount = records.filter((r) => r.mistakes === 2).length;
  const threeOrMoreErrorCount = records.filter((r) => r.mistakes >= 3).length;

  // Filter records based on requested error category
  let filtered = [...records];
  if (errorFilter === 'zero') {
    filtered = filtered.filter((r) => r.mistakes === 0);
  } else if (errorFilter === '1') {
    filtered = filtered.filter((r) => r.mistakes === 1);
  } else if (errorFilter === '2') {
    filtered = filtered.filter((r) => r.mistakes === 2);
  } else if (errorFilter === '3plus') {
    filtered = filtered.filter((r) => r.mistakes >= 3);
  }

  // Rank sorting: Lowest mistakes first, then fastest completion time ascending
  filtered.sort((a, b) => {
    if (a.mistakes !== b.mistakes) {
      return a.mistakes - b.mistakes;
    }
    return a.finishTimeMs - b.finishTimeMs;
  });

  // Assign ranks
  const ranked = filtered.map((rec, idx) => ({
    ...rec,
    rank: idx + 1,
  }));

  return {
    puzzleSeed,
    difficulty,
    totalSolvers: records.length,
    breakdown: {
      zeroErrorCount,
      oneErrorCount,
      twoErrorCount,
      threeOrMoreErrorCount,
    },
    records: ranked,
  };
}

/**
 * Retrieve the All-Time Global Leaderboard across all players.
 */
export function getAllTimeLeaderboard(limit = 50, difficulty?: string): AllTimeLeaderboardResponse {
  const users = getAllRegisteredUsers();
  const entries: AllTimeLeaderboardEntry[] = [];
  const isTierFiltered = Boolean(difficulty && difficulty !== 'All' && difficulty !== 'all');
  const targetTier = isTierFiltered ? (difficulty as DifficultyLevel) : null;

  for (const u of users) {
    if (targetTier) {
      const dStats = u.stats.difficultyStats?.[targetTier];
      const tierMatches = (u.stats.recentMatches || []).filter((m) => m.difficulty === targetTier);
      const played = dStats?.played || tierMatches.length || 0;
      const won = dStats?.won || tierMatches.filter((m) => m.rank === 1).length || 0;
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
      const bestFinishTimeMs =
        dStats?.bestTimeMs ||
        (tierMatches.length > 0 ? Math.min(...tierMatches.map((m) => m.finishTimeMs)) : null);
      const flawlessCount = tierMatches.filter((m) => m.mistakes === 0).length;
      const totalScore = tierMatches.reduce((s, m) => s + m.score, 0) || (won * 95);
      const bestScore = tierMatches.length > 0 ? Math.max(...tierMatches.map((m) => m.score)) : (won > 0 ? 100 : 0);

      // Include all registered users so they see their standing in this tier
      entries.push({
        rank: 0,
        userId: u.id,
        playerName: u.username,
        avatarId: u.avatarId,
        gamesPlayed: played,
        gamesWon: won,
        winRate,
        bestFinishTimeMs,
        totalScore,
        bestScore,
        flawlessWins: flawlessCount,
      });
    } else {
      const played = u.stats.gamesPlayed || 0;
      const won = u.stats.gamesWon || 0;
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
      const flawlessCount = (u.stats.recentMatches || []).filter((m) => m.mistakes === 0).length;

      entries.push({
        rank: 0,
        userId: u.id,
        playerName: u.username,
        avatarId: u.avatarId,
        gamesPlayed: played,
        gamesWon: won,
        winRate,
        bestFinishTimeMs: u.stats.bestFinishTimeMs || null,
        totalScore: u.stats.totalScore || 0,
        bestScore: u.stats.bestScore || 0,
        flawlessWins: flawlessCount,
      });
    }
  }

  // Tier multiplier constants for veterans
  const tierTimeMultiplier: Record<DifficultyLevel, number> = {
    Easy: 0.65,
    Medium: 1.0,
    Hard: 1.5,
    'Very Hard': 2.05,
    Expert: 2.7,
    Pro: 3.5,
    Custom: 1.2,
  };

  const defaultVeterans = [
    { name: 'KronoMaster', avatar: 'avatar-dragon', played: 48, won: 44, bestTime: 62400, score: 4120, flawless: 39 },
    { name: 'AstraNova', avatar: 'avatar-phoenix', played: 42, won: 37, bestTime: 71200, score: 3640, flawless: 29 },
    { name: 'ZeroMistakePro', avatar: 'avatar-ninja', played: 39, won: 35, bestTime: 79500, score: 3380, flawless: 32 },
    { name: 'SudokuSamurai', avatar: 'avatar-lion', played: 35, won: 30, bestTime: 84100, score: 2950, flawless: 21 },
    { name: 'CipherGrid', avatar: 'avatar-wolf', played: 31, won: 25, bestTime: 92800, score: 2460, flawless: 18 },
    { name: 'HyperNexus', avatar: 'avatar-falcon', played: 28, won: 22, bestTime: 104500, score: 2120, flawless: 14 },
    { name: 'Vanguard9', avatar: 'avatar-tiger', played: 24, won: 19, bestTime: 112000, score: 1850, flawless: 11 },
  ];

  for (const v of defaultVeterans) {
    if (!entries.some((e) => e.playerName.toLowerCase() === v.name.toLowerCase())) {
      if (targetTier) {
        const timeMul = tierTimeMultiplier[targetTier] || 1;
        const played = Math.max(6, Math.round(v.played * 0.3));
        const won = Math.max(5, Math.round(v.won * 0.3));
        const score = Math.max(480, Math.round(v.score * 0.28));
        entries.push({
          rank: 0,
          playerName: v.name,
          avatarId: v.avatar,
          gamesPlayed: played,
          gamesWon: won,
          winRate: Math.round((won / played) * 100),
          bestFinishTimeMs: Math.round(v.bestTime * timeMul),
          totalScore: score,
          bestScore: 100,
          flawlessWins: Math.max(2, Math.round(v.flawless * 0.28)),
        });
      } else {
        entries.push({
          rank: 0,
          playerName: v.name,
          avatarId: v.avatar,
          gamesPlayed: v.played,
          gamesWon: v.won,
          winRate: Math.round((v.won / v.played) * 100),
          bestFinishTimeMs: v.bestTime,
          totalScore: v.score,
          bestScore: 100,
          flawlessWins: v.flawless,
        });
      }
    }
  }

  // Sort by Total Score descending, then Wins descending, then Best Time ascending
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    if (b.gamesWon !== a.gamesWon) {
      return b.gamesWon - a.gamesWon;
    }
    return (a.bestFinishTimeMs || 9999999) - (b.bestFinishTimeMs || 9999999);
  });

  // Assign ranks & badges
  const rankedEntries = entries.slice(0, limit).map((entry, idx) => {
    const playerKey = entry.userId || entry.playerName.toLowerCase();
    const streakData = playerStreaksMap.get(playerKey) || playerStreaksMap.get(entry.playerName.toLowerCase());
    
    const isDailyMaster = idx < 3 || (streakData?.badges?.includes('daily-master') ?? false);
    const isCommitted = (streakData?.currentStreak && streakData.currentStreak >= 1) || (streakData?.badges?.includes('committed') ?? false) || idx < 5;
    const dailyStreak = streakData?.currentStreak ?? (idx === 0 ? 7 : idx === 1 ? 5 : idx === 2 ? 4 : 0);

    return {
      ...entry,
      rank: idx + 1,
      isDailyMaster,
      isCommitted,
      dailyStreak,
    };
  });

  return {
    totalPlayers: entries.length,
    difficulty: targetTier || 'All',
    entries: rankedEntries,
  };
}
