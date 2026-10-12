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
 * Shuffles an array in-place using Fisher-Yates algorithm.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

/**
 * Fills a 9x9 grid completely using randomized backtracking.
 */
function fillBoardBacktracking(board: number[][]): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of candidates) {
          if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoardBacktracking(board)) {
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
 * Generates a uniquely solvable Sudoku puzzle and its master solution matrix for one of the 6 difficulty levels.
 */
export function generateSudokuBoard(difficulty: DifficultyLevel): {
  initialBoard: number[][];
  solutionBoard: number[][];
  emptyCellsCount: number;
} {
  const targetEmpty = DIFFICULTY_CONFIG[difficulty].emptyCells;

  // 1. Create empty 9x9 matrix
  const solutionBoard: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  // 2. Fill diagonal 3x3 boxes first (independent of each other) to speed up initial generation
  for (let box = 0; box < 9; box += 3) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        solutionBoard[box + r][box + c] = nums[idx++];
      }
    }
  }

  // 3. Solve the rest of the board using backtracking
  fillBoardBacktracking(solutionBoard);

  // 4. Clone into initialBoard and remove cells while preserving unique solvability
  const initialBoard: number[][] = solutionBoard.map((row) => [...row]);

  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  let removed = 0;
  const startTime = Date.now();
  const MAX_GENERATION_MS = 350; // Guard to ensure instant responsiveness on Pro/Expert

  for (const [r, c] of positions) {
    if (removed >= targetEmpty) break;
    if (Date.now() - startTime > MAX_GENERATION_MS) break;

    const backup = initialBoard[r][c];
    if (backup === 0) continue;

    initialBoard[r][c] = 0;

    // Verify uniqueness using fast MRV backtracking solver
    const workCopy = initialBoard.map((row) => [...row]);
    const solutions = countSolutions(workCopy, 2);

    if (solutions !== 1) {
      // Cannot remove this cell without creating ambiguity; restore it
      initialBoard[r][c] = backup;
    } else {
      removed++;
    }
  }

  return {
    initialBoard,
    solutionBoard,
    emptyCellsCount: removed,
  };
}

/**
 * Competitive Time & Scoring Engine
 *
 * Rules:
 * - First player to finish correctly (rank k = 1) receives 100 points.
 * - For any subsequent player finishing at rank k (k >= 2):
 *   - Maximum possible score: MaxScore(k) = 100 - 5(k - 1)
 *   - Minimum possible score: MinScore(k) = 100 - 20(k - 1)
 * - Track time difference (Delta t in seconds) between the first player's finish time and current player's finish time.
 * - Linearly interpolate from MaxScore(k) down to MinScore(k) over a 120-second penalty window.
 * - Clamp the final score so it never drops below MinScore(k).
 */
export function calculateCompetitiveScore(
  rank: number,
  firstFinishTimeMs: number,
  currentFinishTimeMs: number
): {
  score: number;
  maxPossibleScore: number;
  minPossibleScore: number;
  deltaTSeconds: number;
} {
  if (rank <= 1) {
    return {
      score: 100,
      maxPossibleScore: 100,
      minPossibleScore: 100,
      deltaTSeconds: 0,
    };
  }

  const k = rank;
  const maxPossibleScore = Math.max(0, 100 - 5 * (k - 1));
  const minPossibleScore = Math.max(0, 100 - 20 * (k - 1));

  const rawDeltaMs = Math.max(0, currentFinishTimeMs - firstFinishTimeMs);
  const deltaTSeconds = Number((rawDeltaMs / 1000).toFixed(2));

  const PENALTY_WINDOW_SECONDS = 120;
  const clampedRatio = Math.min(1, Math.max(0, deltaTSeconds / PENALTY_WINDOW_SECONDS));

  // Linear interpolation from maxPossibleScore down to minPossibleScore over 120s
  const interpolated =
    maxPossibleScore - (maxPossibleScore - minPossibleScore) * clampedRatio;

  // Clamp so it never drops below minPossibleScore (or exceeds maxPossibleScore)
  const finalScore = Math.max(
    minPossibleScore,
    Math.min(maxPossibleScore, Math.round(interpolated * 10) / 10)
  );

  return {
    score: finalScore,
    maxPossibleScore,
    minPossibleScore,
    deltaTSeconds,
  };
}

/**
 * Calculates a unique, deterministic seed identifier from a Sudoku puzzle's initial board.
 * Returns a recognizable ID formatted like "SDK-A9F32BC1".
 */
export function calculatePuzzleSeed(initialBoard: number[][]): string {
  if (!initialBoard || initialBoard.length !== 9) return 'SDK-0000000000';
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
  return `SDK-${(s1 + s2).slice(0, 10).toUpperCase()}`;
}

