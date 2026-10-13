import { DifficultyLevel, DIFFICULTY_CONFIG } from './types/game.ts';

/**
 * Checks if placing `num` at `board[row][col]` is valid according to standard Sudoku rules.
 */
export function isValidPlacement(board: number[][], row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[startRow + r][startCol + c] === num) return false;
    }
  }

  return true;
}

/**
 * Hashes an arbitrary string seed into a 32-bit unsigned integer using FNV-1a.
 */
export function hashStringToSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 * Guarantees 100% reproducible random sequences across all JavaScript runtimes given the same seed.
 * Eliminates all reliance on Math.random() for puzzle generation.
 */
export class Mulberry32PRNG {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      this.state = hashStringToSeed(seed);
    } else {
      this.state = seed >>> 0;
    }
  }

  /**
   * Returns a pseudo-random 32-bit unsigned integer.
   */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return (z ^ (z >>> 14)) >>> 0;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /**
   * Returns a random integer in [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffles an array in-place using deterministic Fisher-Yates driven by this PRNG.
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
}

export const DIFFICULTY_CHAR_MAP: Record<string, DifficultyLevel> = {
  '1': 'Easy',
  E: 'Easy',
  '2': 'Medium',
  M: 'Medium',
  '3': 'Hard',
  H: 'Hard',
  '4': 'Very Hard',
  V: 'Very Hard',
  '5': 'Expert',
  X: 'Expert',
  '6': 'Pro',
  P: 'Pro',
  '7': 'Custom',
  C: 'Custom',
};

export const DIFFICULTY_TO_CHAR: Record<DifficultyLevel, string> = {
  Easy: '1',
  Medium: '2',
  Hard: '3',
  'Very Hard': '4',
  Expert: '5',
  Pro: '6',
  Custom: '7',
};

/**
 * Extracts or infers the difficulty level embedded inside a seed string.
 * Supports "SDK-1...", "SDK-2...", "SDK-E...", "SDK-MEDIUM-...", or falls back deterministically.
 */
export function extractDifficultyFromSeed(seed: string): DifficultyLevel {
  const clean = seed.trim().toUpperCase();
  if (clean.includes('VERY_HARD') || clean.includes('VERYHARD')) return 'Very Hard';
  if (clean.includes('EXPERT')) return 'Expert';
  if (clean.includes('PRO')) return 'Pro';
  if (clean.includes('HARD')) return 'Hard';
  if (clean.includes('MEDIUM')) return 'Medium';
  if (clean.includes('EASY')) return 'Easy';
  if (clean.includes('CUSTOM')) return 'Custom';

  if (clean.startsWith('SDK-')) {
    const payload = clean.slice(4);
    const firstChar = payload.charAt(0);
    if (DIFFICULTY_CHAR_MAP[firstChar]) {
      return DIFFICULTY_CHAR_MAP[firstChar];
    }
  }

  // Fallback: derive difficulty deterministically from the seed's hash
  const hash = hashStringToSeed(clean);
  const diffs: DifficultyLevel[] = ['Easy', 'Medium', 'Hard', 'Very Hard', 'Expert', 'Pro'];
  return diffs[hash % diffs.length];
}

/**
 * Creates a cryptographically sound random seed formatted as "SDK-XXXXXXXXXX" (e.g. "SDK-21A3964DBA")
 * where the first character after "SDK-" denotes the difficulty code ('1'-'6').
 */
export function createRandomSeed(difficulty: DifficultyLevel): string {
  const diffChar = DIFFICULTY_TO_CHAR[difficulty] || '2';
  let hex = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 9);
  } else {
    const h1 = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    const h2 = Math.floor(Math.random() * 0xf).toString(16);
    hex = (h1 + h2).slice(0, 9);
  }
  return `SDK-${diffChar}${hex.toUpperCase()}`;
}

/**
 * Fills a 9x9 grid completely using deterministic backtracking fed by the PRNG.
 */
function fillBoardBacktracking(board: number[][], prng: Mulberry32PRNG): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const candidates = prng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of candidates) {
          if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoardBacktracking(board, prng)) {
              return true;
            }
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Counts the number of valid solutions for a given Sudoku grid, stopping early if count reaches `limit` (default 2).
 * Uses Minimum Remaining Values (MRV) heuristic to pick the most constrained empty cell first for fast verification.
 */
export function countSolutions(board: number[][], limit = 2): number {
  let bestRow = -1;
  let bestCol = -1;
  let bestCandidates: number[] | null = null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const candidates: number[] = [];
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(board, r, c, num)) {
            candidates.push(num);
          }
        }
        if (candidates.length === 0) {
          return 0; // Dead end immediately
        }
        if (bestCandidates === null || candidates.length < bestCandidates.length) {
          bestCandidates = candidates;
          bestRow = r;
          bestCol = c;
          if (candidates.length === 1) break;
        }
      }
    }
    if (bestCandidates !== null && bestCandidates.length === 1) break;
  }

  // No empty cells left -> found 1 complete valid solution
  if (bestRow === -1 || bestCandidates === null) {
    return 1;
  }

  let totalSolutions = 0;
  for (const num of bestCandidates) {
    board[bestRow][bestCol] = num;
    totalSolutions += countSolutions(board, limit - totalSolutions);
    board[bestRow][bestCol] = 0;
    if (totalSolutions >= limit) {
      return totalSolutions;
    }
  }

  return totalSolutions;
}

/**
 * Solves a Sudoku puzzle using fast constraint backtracking.
 * Returns a completed 9x9 solution matrix or null if unsolvable.
 */
export function solveSudoku(board: number[][]): number[][] | null {
  const clone = board.map((r) => [...r]);
  function solve(): boolean {
    let bestR = -1;
    let bestC = -1;
    let bestCandidates: number[] | null = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (clone[r][c] === 0) {
          const cands: number[] = [];
          for (let n = 1; n <= 9; n++) {
            if (isValidPlacement(clone, r, c, n)) cands.push(n);
          }
          if (cands.length === 0) return false;
          if (bestCandidates === null || cands.length < bestCandidates.length) {
            bestCandidates = cands;
            bestR = r;
            bestC = c;
            if (cands.length === 1) break;
          }
        }
      }
      if (bestCandidates !== null && bestCandidates.length === 1) break;
    }
    if (bestR === -1 || bestCandidates === null) return true;
    for (const num of bestCandidates) {
      clone[bestR][bestC] = num;
      if (solve()) return true;
      clone[bestR][bestC] = 0;
    }
    return false;
  }
  return solve() ? clone : null;
}

export interface SudokuBoardGenerationResult {
  seed: string;
  initialBoard: number[][];
  solutionBoard: number[][];
  emptyCellsCount: number;
}

/**
 * Generates a uniquely solvable Sudoku puzzle and its master solution matrix.
 * If `customSeed` is provided, generates deterministically from that seed.
 * If omitted, generates a random secure seed formatted as "SDK-XXXXXXXXXX".
 */
export function generateSudokuBoard(
  difficulty: DifficultyLevel,
  customSeed?: string,
  customClues?: number
): SudokuBoardGenerationResult {
  const seed = customSeed && customSeed.trim() ? customSeed.trim().toUpperCase() : createRandomSeed(difficulty);
  const prng = new Mulberry32PRNG(seed);
  const targetEmpty =
    difficulty === 'Custom' && typeof customClues === 'number'
      ? Math.max(16, Math.min(64, 81 - customClues))
      : (DIFFICULTY_CONFIG[difficulty]?.emptyCells ?? 38);

  // 1. Create empty 9x9 matrix
  const solutionBoard: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  // 2. Fill diagonal 3x3 boxes first (box 0, 3, 6) deterministically using PRNG
  for (let box = 0; box < 9; box += 3) {
    const nums = prng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        solutionBoard[box + r][box + c] = nums[idx++];
      }
    }
  }

  // 3. Solve the rest of the board using deterministic backtracking fed by PRNG
  fillBoardBacktracking(solutionBoard, prng);

  // 4. Clone into initialBoard and remove cells while preserving unique solvability
  const initialBoard: number[][] = solutionBoard.map((row) => [...row]);

  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  prng.shuffle(positions);

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= targetEmpty) break;

    const backup = initialBoard[r][c];
    if (backup === 0) continue;

    initialBoard[r][c] = 0;

    // Verify uniqueness using MRV backtracking solver
    const workCopy = initialBoard.map((row) => [...row]);
    const solutions = countSolutions(workCopy, 2);

    if (solutions !== 1) {
      // Cannot remove this cell without creating ambiguity; restore it
      initialBoard[r][c] = backup;
    } else {
      removed++;
    }
  }

  // If target wasn't reached in first pass, attempt remaining cells deterministically
  if (removed < targetEmpty) {
    const remainingPositions: [number, number][] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (initialBoard[r][c] !== 0) {
          remainingPositions.push([r, c]);
        }
      }
    }
    prng.shuffle(remainingPositions);
    for (const [r, c] of remainingPositions) {
      if (removed >= targetEmpty) break;
      const backup = initialBoard[r][c];
      initialBoard[r][c] = 0;
      const workCopy = initialBoard.map((row) => [...row]);
      if (countSolutions(workCopy, 2) !== 1) {
        initialBoard[r][c] = backup;
      } else {
        removed++;
      }
    }
  }

  return {
    seed,
    initialBoard,
    solutionBoard,
    emptyCellsCount: removed,
  };
}

/**
 * Generates identical Sudoku board and solution directly from a seed string (e.g. "SDK-21A3964DBA").
 * 100% reversible: Entering the same seed always produces the exact same initialBoard & solutionBoard.
 */
export function generateSudokuBoardFromSeed(seed: string): SudokuBoardGenerationResult & {
  difficulty: DifficultyLevel;
} {
  const difficulty = extractDifficultyFromSeed(seed);
  const result = generateSudokuBoard(difficulty, seed);
  return {
    ...result,
    difficulty,
  };
}

/**
 * Yeni Puanlama Sistemi (New Performance Scoring Engine)
 *
 * Kurallar (Rules):
 * 1. Ard arda hızlıca bulunan hücreler ekstra puan artışına (kombo & hız bonusu) sahip olur.
 * 2. Hataların puan cezası yüksektir (-250+ puan) ve her hata alınabilecek MAKSİMUM puanı sınırlar.
 * 3. Yardım (Hint) kullanımı, zorluk seviyesine göre maksimum puanı sınırlar.
 * 4. Hatasız ve yardımsız oyunlarda MAKSİMUM SINIR BULUNMAZ (Sınırsız potansiyel!).
 * 5. Süre, ters orantılı olarak puan çarpanı haline gelir (T_hedef / T_geçen).
 */

export interface DifficultyScoreSettings {
  baseCellPoints: number;        // Taban hücre puanı
  targetTimeSeconds: number;     // Çarpan 1.0x için hedef/referans süre
  minTimeSeconds: number;        // Hile önleyici minimum süre eşiği
  hintMaxScoreCap: number;       // Yardım kullanıldığında zorluk başına azami tavan puan
  mistakePenaltyPoints: number;  // Hata başına doğrudan kesilen ceza puanı
  mistakeCaps: number[];         // Hata sayısına göre maksimum tavan [0=Inf, 1, 2, 3, ...]
}

export const DIFFICULTY_SCORE_CONFIG: Record<DifficultyLevel, DifficultyScoreSettings> = {
  Easy: {
    baseCellPoints: 50,
    targetTimeSeconds: 150, // 2.5 dk
    minTimeSeconds: 15,
    hintMaxScoreCap: 600,
    mistakePenaltyPoints: 200,
    mistakeCaps: [Infinity, 1200, 800, 500, 300, 150],
  },
  Medium: {
    baseCellPoints: 80,
    targetTimeSeconds: 270, // 4.5 dk
    minTimeSeconds: 20,
    hintMaxScoreCap: 900,
    mistakePenaltyPoints: 250,
    mistakeCaps: [Infinity, 1600, 1100, 700, 450, 250],
  },
  Hard: {
    baseCellPoints: 120,
    targetTimeSeconds: 420, // 7 dk
    minTimeSeconds: 25,
    hintMaxScoreCap: 1300,
    mistakePenaltyPoints: 300,
    mistakeCaps: [Infinity, 2200, 1500, 950, 600, 350],
  },
  'Very Hard': {
    baseCellPoints: 140,
    targetTimeSeconds: 520, // 8.5 dk
    minTimeSeconds: 28,
    hintMaxScoreCap: 1500,
    mistakePenaltyPoints: 320,
    mistakeCaps: [Infinity, 2500, 1700, 1050, 680, 400],
  },
  Expert: {
    baseCellPoints: 160,
    targetTimeSeconds: 620, // ~10 dk
    minTimeSeconds: 30,
    hintMaxScoreCap: 1700,
    mistakePenaltyPoints: 350,
    mistakeCaps: [Infinity, 2800, 1900, 1200, 750, 450],
  },
  Pro: {
    baseCellPoints: 200,
    targetTimeSeconds: 780, // 13 dk
    minTimeSeconds: 35,
    hintMaxScoreCap: 2100,
    mistakePenaltyPoints: 400,
    mistakeCaps: [Infinity, 3400, 2300, 1450, 900, 550],
  },
  Custom: {
    baseCellPoints: 100,
    targetTimeSeconds: 360, // 6 dk
    minTimeSeconds: 20,
    hintMaxScoreCap: 1100,
    mistakePenaltyPoints: 260,
    mistakeCaps: [Infinity, 1800, 1200, 800, 500, 300],
  },
};

// 1. Kural: Hızlı ardışık hücre bulma penceresi (saniye) ve Maksimum Kombo Sınırı (5)
export const COMBO_WINDOW_SECONDS = 5.0;
export const MAX_COMBO_STREAK = 5;

export interface CellMoveScoreResult {
  isCombo: boolean;
  comboStreak: number;
  comboMultiplier: number;
  speedBonus: number;
  cellPointsEarned: number;
  timeSinceLastMoveSeconds: number;
}

/**
 * 1. Kural Hesabı: Ard arda hızlıca bulunan cell ekstra puan artışına sahip olur.
 * Maksimum kombo sayısı 5 ile sınırlandırılmıştır (Max Combo 5 & Max Luminosity).
 */
export function calculateCellMoveScore(
  difficulty: DifficultyLevel,
  previousMoveTimestamp: number | null,
  currentMoveTimestamp: number,
  currentComboStreak: number
): CellMoveScoreResult {
  const cfg = DIFFICULTY_SCORE_CONFIG[difficulty] || DIFFICULTY_SCORE_CONFIG.Medium;
  const basePoints = cfg.baseCellPoints;

  const timeDeltaSeconds = previousMoveTimestamp
    ? Math.max(0, (currentMoveTimestamp - previousMoveTimestamp) / 1000)
    : 999;

  let newComboStreak = 1;
  let isCombo = false;

  if (previousMoveTimestamp && timeDeltaSeconds <= COMBO_WINDOW_SECONDS) {
    newComboStreak = Math.min(MAX_COMBO_STREAK, currentComboStreak + 1);
    isCombo = true;
  } else {
    newComboStreak = 1;
    isCombo = false;
  }

  // Seri katlayıcısı (Maksimum 5 kombo):
  // Streak 1: 1.0x
  // Streak 2: 1.25x (+%25)
  // Streak 3: 1.50x (+%50)
  // Streak 4: 1.85x (+%85)
  // Streak 5: 2.50x (+%150 - Maks Kombo & Maks Çarpan)
  let comboMultiplier = 1.0;
  if (newComboStreak === 2) comboMultiplier = 1.25;
  else if (newComboStreak === 3) comboMultiplier = 1.50;
  else if (newComboStreak === 4) comboMultiplier = 1.85;
  else if (newComboStreak >= 5) comboMultiplier = 2.50;

  // Hızlı bulma anlık hız bonusu:
  let speedBonus = 0;
  if (isCombo) {
    if (timeDeltaSeconds < 1.5) speedBonus = 100;
    else if (timeDeltaSeconds < 3.0) speedBonus = 50;
    else if (timeDeltaSeconds < 5.0) speedBonus = 25;
  }

  const cellPointsEarned = Math.round(basePoints * comboMultiplier + speedBonus);

  return {
    isCombo,
    comboStreak: newComboStreak,
    comboMultiplier: Number(comboMultiplier.toFixed(2)),
    speedBonus,
    cellPointsEarned,
    timeSinceLastMoveSeconds: Number(timeDeltaSeconds.toFixed(2)),
  };
}

/**
 * Zorluk Çarpanı Hesabı (Difficulty & Clue Multiplier):
 * Bitirme süresi çarpanı kaldırılarak yerine doğrudan zorluk seviyesi ve
 * Custom modlarda adaletsizliği önlemek için sahip olunan ipucu sayısına dayalı çarpan.
 *
 * Standart Seviyeler:
 * - Easy (51 ipucu): 1.00x
 * - Medium (42 ipucu): 1.35x
 * - Hard (34 ipucu): 1.75x
 * - Very Hard (28 ipucu): 2.15x
 * - Expert (24 ipucu): 2.60x
 * - Pro (20 ipucu): 3.20x
 *
 * Custom Seviyeler (17 - 65 ipucu):
 * - 17 ipucu (matematiksel asgari sınır, en zor): 3.75x
 * - 51 ipucu (Easy referansı): 1.00x
 * - 65 ipucu (aşırı kolay): 0.60x
 */
export function calculateDifficultyMultiplier(
  difficulty: DifficultyLevel,
  cluesCount?: number
): number {
  if (difficulty === 'Custom' || typeof cluesCount === 'number') {
    const clues = typeof cluesCount === 'number'
      ? Math.max(17, Math.min(65, cluesCount))
      : 40;

    if (clues <= 51) {
      // 17 ila 51 ipucu arası (zorlaştıkça çarpan 1.00x'ten 3.75x'e çıkar)
      const mult = 1.0 + (51 - clues) * ((3.75 - 1.0) / (51 - 17));
      return Number(mult.toFixed(2));
    } else {
      // 52 ila 65 ipucu arası (kolaylaştıkça çarpan 1.00x'ten 0.60x'e düşer)
      const mult = 1.0 - (clues - 51) * ((1.0 - 0.60) / (65 - 51));
      return Number(Math.max(0.5, mult).toFixed(2));
    }
  }

  switch (difficulty) {
    case 'Easy':
      return 1.00;
    case 'Medium':
      return 1.35;
    case 'Hard':
      return 1.75;
    case 'Very Hard':
      return 2.15;
    case 'Expert':
      return 2.60;
    case 'Pro':
      return 3.20;
    default:
      return 1.00;
  }
}

/**
 * Geriye dönük uyumluluk için korunan yardımcı fonksiyon (artık süre çarpanı yerine sabit 1.0 döner)
 */
export function calculateTimeMultiplier(
  _difficulty: DifficultyLevel,
  _finishTimeMs: number
): number {
  return 1.0;
}

/**
 * 2, 3 ve 4. Kural Hesabı:
 * - 2: Her hatada maksimum alınacak puan miktarı kısıtlanır.
 * - 3: Yardım kullanımı puanı maksimum olarak her zorluk seviyesinde sınırlandırılır.
 * - 4: Hatasız ve yardımsızlarda MAKSİMUM SINIR BULUNMAZ (null).
 */
export function calculateMaxScoreCap(
  difficulty: DifficultyLevel,
  mistakes: number,
  hintsUsed: number
): number | null {
  // 4. Kural: Hatasız ve yardımsız oyunlarda tavan sınır YOKTUR!
  if (mistakes === 0 && hintsUsed === 0) {
    return null;
  }

  const cfg = DIFFICULTY_SCORE_CONFIG[difficulty] || DIFFICULTY_SCORE_CONFIG.Medium;

  let capFromMistakes = Infinity;
  if (mistakes > 0) {
    if (mistakes < cfg.mistakeCaps.length) {
      capFromMistakes = cfg.mistakeCaps[mistakes];
    } else {
      const lastCap = cfg.mistakeCaps[cfg.mistakeCaps.length - 1];
      capFromMistakes = Math.max(50, lastCap - (mistakes - (cfg.mistakeCaps.length - 1)) * 50);
    }
  }

  let capFromHints = Infinity;
  if (hintsUsed > 0) {
    // 3. Kural: Yardım kullanımı zorluk seviyesi tavanına kilitler
    // İlave her yardım tavanı %15 daha aşağı çeker
    capFromHints = Math.round(cfg.hintMaxScoreCap * Math.pow(0.85, Math.max(0, hintsUsed - 1)));
  }

  const effectiveCap = Math.min(capFromMistakes, capFromHints);
  return Number.isFinite(effectiveCap) ? effectiveCap : null;
}

export interface AdvancedScoreCalculation {
  score: number;
  rawScore: number;
  scoreWithDifficulty: number;
  scoreWithTime?: number;
  difficultyMultiplier: number;
  timeMultiplier: number;
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

/**
 * Performans ve Zorluk Temelli Puan Hesaplayıcı:
 * Süre çarpanı kaldırılmış, yerine doğrudan zorluk ve ipucu çarpanı entegre edilmiştir.
 */
export function calculateAdvancedPerformanceScore(options: {
  difficulty: DifficultyLevel;
  finishTimeMs?: number;
  mistakes: number;
  hintsUsed?: number;
  accumulatedScore?: number;
  maxCombo?: number;
  totalEmptyCells?: number;
  customClues?: number;
}): AdvancedScoreCalculation {
  const {
    difficulty,
    finishTimeMs = 0,
    mistakes,
    hintsUsed = 0,
    accumulatedScore,
    maxCombo = 1,
    totalEmptyCells,
    customClues,
  } = options;

  const cfg = DIFFICULTY_SCORE_CONFIG[difficulty] || DIFFICULTY_SCORE_CONFIG.Medium;

  // Hücre puanı: Ya oyun boyunca toplanan kombo destekli puan, ya da boş hücre bazlı
  const emptyCells = totalEmptyCells || (customClues ? (81 - customClues) : 40);
  const baseScore = typeof accumulatedScore === 'number' && accumulatedScore > 0
    ? accumulatedScore
    : emptyCells * cfg.baseCellPoints;

  // 2. Kural: Hataların puan cezası yüksek olmalı
  const mistakePenalty = mistakes * cfg.mistakePenaltyPoints;

  // Çarpandan önceki ham puan
  const rawScore = Math.max(0, baseScore - mistakePenalty);

  // Zorluk Çarpanı: Süre yerine doğrudan bulmaca zorluğuna ve ipucu sayısına göre puanlanır!
  const difficultyMultiplier = calculateDifficultyMultiplier(difficulty, customClues);
  const scoreWithDifficulty = Math.round(rawScore * difficultyMultiplier);

  // 2, 3 ve 4. Kurallar: Tavan sınırı (0 hata & 0 yardım ise sınırsız)
  const maxScoreCap = calculateMaxScoreCap(difficulty, mistakes, hintsUsed);

  let finalScore = scoreWithDifficulty;
  if (maxScoreCap !== null) {
    // Custom modda veya zor seviyelerde tavan puan da zorluk çarpanı ile uyumlu tutulur
    const scaledCap = Math.round(maxScoreCap * Math.max(1.0, difficultyMultiplier / 1.5));
    finalScore = Math.min(finalScore, scaledCap);
  }

  finalScore = Math.max(0, Math.round(finalScore));

  return {
    score: finalScore,
    rawScore,
    scoreWithDifficulty,
    scoreWithTime: scoreWithDifficulty, // backward compatibility
    difficultyMultiplier,
    timeMultiplier: difficultyMultiplier, // backward compatibility
    baseScore,
    comboBonus: Math.max(0, baseScore - (emptyCells * cfg.baseCellPoints)),
    mistakePenalty,
    maxScoreCap,
    isUnlimited: maxScoreCap === null,
    mistakes,
    hintsUsed,
    difficulty,
    maxCombo,
    finishTimeMs,
    customClues,
  };
}

/**
 * calculateCompetitiveScore - Geriye dönük uyumluluk wrapper'ı.
 * Sıralama (rank) yerine yeni performans ve zorluk çarpanı kurallarını çalıştırır!
 */
export function calculateCompetitiveScore(
  rank: number,
  firstFinishTimeMs: number,
  currentFinishTimeMs: number,
  difficulty: DifficultyLevel = 'Medium',
  mistakes: number = 0,
  hintsUsed: number = 0,
  accumulatedScore?: number,
  customClues?: number
): {
  score: number;
  maxPossibleScore: number;
  minPossibleScore: number;
  deltaTSeconds: number;
  difficultyMultiplier: number;
  timeMultiplier: number;
  maxScoreCap: number | null;
  isUnlimited: boolean;
  scoreBreakdown: AdvancedScoreCalculation;
} {
  const result = calculateAdvancedPerformanceScore({
    difficulty,
    finishTimeMs: currentFinishTimeMs,
    mistakes,
    hintsUsed,
    accumulatedScore,
    customClues,
  });

  const rawDeltaMs = Math.max(0, currentFinishTimeMs - firstFinishTimeMs);
  const deltaTSeconds = Number((rawDeltaMs / 1000).toFixed(2));

  return {
    score: result.score,
    maxPossibleScore: result.maxScoreCap ?? result.scoreWithDifficulty,
    minPossibleScore: 0,
    deltaTSeconds,
    difficultyMultiplier: result.difficultyMultiplier,
    timeMultiplier: result.difficultyMultiplier,
    maxScoreCap: result.maxScoreCap,
    isUnlimited: result.isUnlimited,
    scoreBreakdown: result,
  };
}

/**
 * Calculates a unique, deterministic seed identifier from a Sudoku puzzle's initial board.
 * Returns a recognizable ID formatted like "SDK-XXXXXXXXXX" consistent with the generator seed.
 */
export function calculatePuzzleSeed(
  initialBoard: number[][],
  explicitDifficulty?: DifficultyLevel
): string {
  if (!initialBoard || initialBoard.length !== 9) return 'SDK-2000000000';

  let emptyCount = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (initialBoard[r][c] === 0) emptyCount++;
    }
  }

  let diff: DifficultyLevel = explicitDifficulty || 'Medium';
  if (!explicitDifficulty) {
    if (emptyCount <= 34) diff = 'Easy';
    else if (emptyCount <= 40) diff = 'Medium';
    else if (emptyCount <= 46) diff = 'Hard';
    else if (emptyCount <= 51) diff = 'Very Hard';
    else if (emptyCount <= 54) diff = 'Expert';
    else diff = 'Pro';
  }

  const diffCode = DIFFICULTY_TO_CHAR[diff] || '2';
  const puzzleStr = initialBoard.map((row) => row.join('')).join('');
  let h1 = 0x811c9dc5;
  let h2 = 0x5bd1e995;
  for (let i = 0; i < puzzleStr.length; i++) {
    const code = puzzleStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code * (i + 1)), 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  const s1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const s2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex9 = (s1 + s2).slice(0, 9).toUpperCase();
  return `SDK-${diffCode}${hex9}`;
}

