import fs from 'fs';
import path from 'path';
import {
  DifficultyLevel,
  PuzzleSolverRecord,
  PuzzleSeedLeaderboardResponse,
  ErrorFilterCategory,
  AllTimeLeaderboardEntry,
  AllTimeLeaderboardResponse,
} from './types/game.ts';
import { getAllRegisteredUsers } from './authServer.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
const PUZZLE_LEADERBOARD_FILE = path.join(DATA_DIR, 'puzzle_leaderboards.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory map: puzzleSeed -> PuzzleSolverRecord[]
const puzzleSolversMap = new Map<string, PuzzleSolverRecord[]>();

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
export function getAllTimeLeaderboard(limit = 50): AllTimeLeaderboardResponse {
  const users = getAllRegisteredUsers();
  const entries: AllTimeLeaderboardEntry[] = [];

  for (const u of users) {
    const played = u.stats.gamesPlayed || 0;
    const won = u.stats.gamesWon || 0;
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    
    // Count flawless (0 error) matches from recent matches or estimate
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

  // Add top tournament veterans if user list is small
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

  // Assign ranks
  const rankedEntries = entries.slice(0, limit).map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  return {
    totalPlayers: entries.length,
    entries: rankedEntries,
  };
}
