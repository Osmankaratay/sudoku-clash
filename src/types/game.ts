export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Very Hard' | 'Expert' | 'Pro' | 'Custom';

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Easy',
  'Medium',
  'Hard',
  'Very Hard',
  'Expert',
  'Pro',
  'Custom',
];

export const DIFFICULTY_CONFIG: Record<
  DifficultyLevel,
  {
    emptyCells: number;
    clues: number;
    expectedTime: string;
    description: string;
    botSpeedRange: [number, number];
  }
> = {
  Easy: {
    emptyCells: 30,
    clues: 51,
    expectedTime: '~3 – 5 dk',
    description: 'Accessible entry point with abundant anchor digits and direct single-candidate eliminations.',
    botSpeedRange: [1200, 2600],
  },
  Medium: {
    emptyCells: 38,
    clues: 43,
    expectedTime: '~5 – 8 dk',
    description: 'Balanced competitive grid requiring cross-hatching and box-line intersections.',
    botSpeedRange: [1500, 3200],
  },
  Hard: {
    emptyCells: 44,
    clues: 37,
    expectedTime: '~8 – 14 dk',
    description: 'Reduced initial clues demanding naked pairs and multi-sector deduction.',
    botSpeedRange: [1800, 3800],
  },
  'Very Hard': {
    emptyCells: 49,
    clues: 32,
    expectedTime: '~12 – 20 dk',
    description: 'Sparse starting layout requiring sustained candidate tracking across boxes.',
    botSpeedRange: [2000, 4200],
  },
  Expert: {
    emptyCells: 53,
    clues: 28,
    expectedTime: '~18 – 30 dk',
    description: 'Tournament-tier puzzle with minimal givens and deep deductive chains.',
    botSpeedRange: [2200, 4800],
  },
  Pro: {
    emptyCells: 56,
    clues: 25,
    expectedTime: '~25 – 45 dk',
    description: 'Grandmaster specification with 25 uniquely solvable clues and zero margin for guesswork.',
    botSpeedRange: [2500, 5400],
  },
  Custom: {
    emptyCells: 41,
    clues: 40,
    expectedTime: 'Ayarlanabilir (17–65 ipucu)',
    description: 'Kendi seçtiğiniz ipucu ve boş hücre sayısıyla kişiselleştirilmiş Sudoku tahtası.',
    botSpeedRange: [1500, 3500],
  },
};

export type RoomStateStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface MatchHistoryRecord {
  id: string;
  timestamp: number;
  difficulty: DifficultyLevel;
  rank: number;
  score: number;
  finishTimeMs: number;
  mistakes: number;
  outcome?: 'win' | 'loss';
  totalPlayers?: number;
  eliminated?: boolean;
  hintsUsed?: number;
  maxCombo?: number;
  difficultyMultiplier?: number;
  timeMultiplier?: number;
  maxScoreCap?: number | null;
}

export interface DifficultyTierStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  totalTimeMs: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
  totalScore: number;
  totalFinishTimeMs?: number;
  bestFinishTimeMs?: number | null;
  currentStreak?: number;
  bestStreak?: number;
  totalMistakes?: number;
  difficultyStats?: Record<string, DifficultyTierStats>;
  recentMatches?: MatchHistoryRecord[];
}

export interface DetailedCareerStats {
  userId: string;
  username: string;
  avatarId: string;
  createdAt: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number; // percentage (0 - 100)
  totalFinishTimeMs: number;
  averageTimeMs: number | null; // average time-to-completion in ms
  bestFinishTimeMs: number | null;
  bestScore: number;
  totalScore: number;
  averageScore: number;
  currentStreak: number;
  bestStreak: number;
  totalMistakes: number;
  averageMistakesPerGame: number;
  podiumFinishes: number; // 1st, 2nd, or 3rd
  difficultyStats: Record<DifficultyLevel, DifficultyTierStats>;
  recentMatches: MatchHistoryRecord[];
}

export interface UserAccount {
  id: string;
  username: string;
  email?: string;
  avatarId: string;
  createdAt: number;
  stats: UserStats;
  friends?: string[];
}

export interface FriendUser {
  id: string;
  username: string;
  avatarId: string;
  online: boolean;
  currentRoomCode?: string | null;
  stats: UserStats;
  createdAt?: number;
}

export interface ActivePlayerSummary {
  id: string;
  userId?: string;
  username: string;
  avatarId: string;
  online: boolean;
  currentRoomCode?: string | null;
  isFriend?: boolean;
}

export interface LobbyInvite {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarId: string;
  roomCode: string;
  difficulty?: DifficultyLevel;
  timestamp: number;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
}

export interface PlayerProfile {
  username: string;
  avatarId: string;
}

export interface PlayerPublicState {
  id: string;
  userId?: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  connected: boolean;
  filledCount: number;
  totalToFill: number;
  mistakes: number;
  finished: boolean;
  finishTimeMs: number | null; // elapsed ms from match start
  deltaTSeconds: number | null; // time delay behind rank 1 in seconds
  rank: number | null;
  score: number | null;
  maxPossibleScore: number | null;
  minPossibleScore: number | null;
  isEliminated?: boolean;
  hintsUsed?: number;
  comboStreak?: number;
  maxCombo?: number;
  difficultyMultiplier?: number;
  timeMultiplier?: number;
  maxScoreCap?: number | null;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  score: number;
  rawScore: number;
  scoreWithDifficulty: number;
  scoreWithTime?: number;
  difficultyMultiplier: number;
  timeMultiplier?: number;
  baseScore: number;
  comboBonus: number;
  mistakePenalty: number;
  maxScoreCap: number | null; // null if unlimited (flawless & hintless)
  isUnlimited: boolean;
  mistakes: number;
  hintsUsed: number;
  difficulty: DifficultyLevel;
  maxCombo: number;
  finishTimeMs: number;
  customClues?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomPublicState {
  code: string;
  hostId: string;
  difficulty: DifficultyLevel;
  status: RoomStateStatus;
  maxPlayers?: number;
  mistakeLimit?: number; // 0 = unlimited, 1, 3, 5, 10
  players: PlayerPublicState[];
  startTime: number | null; // server timestamp ms
  firstFinishTimeMs: number | null; // elapsed ms of the 1st finisher
  initialBoard: number[][] | null; // 9x9 with 0 for empty
  solutionBoard?: number[][] | null; // solution matrix sent for local gameplay
  puzzleSeed?: string; // unique deterministic puzzle seed ID
  feedbackMode?: 'instant' | 'delayed'; // 'delayed' = no instant approved/wrong validation until check/finish
  customClues?: number; // custom clue count when difficulty === 'Custom'
  messages: ChatMessage[];
}

export type ErrorFilterCategory = 'all' | 'zero' | '1' | '2' | '3plus';

export interface PuzzleSolverRecord {
  id: string;
  puzzleSeed: string;
  difficulty: DifficultyLevel;
  playerName: string;
  avatarId: string;
  userId?: string;
  score: number;
  finishTimeMs: number;
  mistakes: number;
  rank?: number;
  completedAt: number;
}

export interface PuzzleSeedLeaderboardResponse {
  puzzleSeed: string;
  difficulty: DifficultyLevel;
  totalSolvers: number;
  breakdown: {
    zeroErrorCount: number;
    oneErrorCount: number;
    twoErrorCount: number;
    threeOrMoreErrorCount: number;
  };
  records: PuzzleSolverRecord[];
}

export interface DailyChallengeInfo {
  dateKey: string; // YYYY-MM-DD (UTC)
  difficulty: DifficultyLevel; // "Expert" or "Pro"
  puzzleSeed: string;
  initialBoard: number[][];
  solutionBoard?: number[][];
  totalEmptyCells: number;
  expiresAt: number; // UTC timestamp of next midnight
  totalSolvers: number;
  topScore: number | null;
}

export interface DailyChallengeSubmitResult {
  dateKey: string;
  rank: number;
  score: number;
  finishTimeMs: number;
  mistakes: number;
  currentStreak: number;
  earnedCommittedBadge: boolean;
  earnedDailyMasterBadge: boolean;
}

export interface DailyStreakState {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDateKey: string | null;
  history: { dateKey: string; score: number; finishTimeMs: number; rank: number }[];
  badges: string[]; // e.g. ['committed', 'daily-master']
}

export interface AllTimeLeaderboardEntry {
  rank: number;
  userId?: string;
  playerName: string;
  avatarId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  bestFinishTimeMs: number | null;
  totalScore: number;
  bestScore: number;
  flawlessWins: number;
  isDailyMaster?: boolean; // 'Daily Master' badge for top daily performers
  isCommitted?: boolean; // 'Committed' badge for daily streak achievers
  dailyStreak?: number;
}

export interface AllTimeLeaderboardResponse {
  totalPlayers: number;
  difficulty?: string;
  entries: AllTimeLeaderboardEntry[];
}

export interface MoveValidationResponse {
  row: number;
  col: number;
  value: number;
  correct: boolean;
  alreadyFilled?: boolean;
  mistakes: number;
  filledCount: number;
  totalToFill: number;
  finished: boolean;
  rank: number | null;
  score: number | null;
  deltaTSeconds: number | null;
  isEliminated?: boolean;
  comboStreak?: number;
  comboMultiplier?: number;
  speedBonus?: number;
  pointsEarned?: number;
  liveScore?: number;
  difficultyMultiplier?: number;
  timeMultiplier?: number;
  maxScoreCap?: number | null;
  hintsUsed?: number;
  scoreBreakdown?: ScoreBreakdown;
}
