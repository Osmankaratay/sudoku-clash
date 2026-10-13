import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Timer,
  Pencil,
  Eraser,
  CheckCircle2,
  AlertCircle,
  Trophy,
  BarChart3,
  X,
  Keyboard,
  LogOut,
  Disc,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  Zap,
  Lightbulb,
  Info,
  HelpCircle,
  Copy,
  Check,
  Hash,
  Lock,
  Focus,
  SlidersHorizontal,
} from 'lucide-react';
import { RoomPublicState, MoveValidationResponse, ScoreBreakdown } from '../types/game.ts';
import { soundEngine, triggerHaptic } from '../utils/sound.ts';
import { getBoardTheme } from '../utils/boardThemes.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { AvatarBadge } from './AvatarBadge.tsx';
import { TacticalNumberWheel } from './TacticalNumberWheel.tsx';
import { SparkleCelebration, SparkleEvent } from './SparkleCelebration.tsx';
import { VictoryCelebrationModal } from './VictoryCelebrationModal.tsx';
import { triggerVictoryCelebration } from '../utils/confettiCelebration.ts';
import { COMBO_WINDOW_SECONDS, MAX_COMBO_STREAK, calculateDifficultyMultiplier } from '../sudokuEngine.ts';

export interface MoveHistoryEntry {
  row: number;
  col: number;
  prevValue: number;
  newValue: number;
  prevNotes?: number[];
  clearedNotesAcrossBoard?: { row: number; col: number; digit: number }[];
}

interface GameScreenProps {
  room: RoomPublicState;
  currentPlayerId: string;
  onSubmitMove: (
    row: number,
    col: number,
    value: number,
    cb: (res: { ok: boolean; validation?: MoveValidationResponse; error?: string }) => void
  ) => void;
  onOpenLeaderboard: () => void;
  onSendMessage: (text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onLeaveRoom: () => void;
  onUndoMove?: (row: number, col: number) => void;
  onUseHint?: (
    row: number,
    col: number
  ) => { ok: boolean; digit?: number; cap?: number; error?: string } | null;
  boardThemeId?: string;
}

type CellFeedback = 'correct' | 'incorrect' | null;

/**
 * Progressive gameboard border luminosity scaling (Max Combo 5 & Max Luminosity).
 * Highlights ONLY the outer border of the Sudoku gameboard a little bit more with each combo move,
 * reaching MAX LUMINOSITY at combo 5.
 */
export function getBoardBorderLuminosityStyles(comboStreak: number) {
  if (comboStreak <= 0) {
    return {
      borderClasses: '',
      style: {} as React.CSSProperties,
    };
  }

  const level = Math.min(5, Math.max(1, comboStreak));
  switch (level) {
    case 1:
      return {
        borderClasses: 'border-emerald-500/80 ring-2 ring-emerald-500/30',
        style: {
          boxShadow: '0 0 16px 2px rgba(16, 185, 129, 0.40)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      };
    case 2:
      return {
        borderClasses: 'border-emerald-400 ring-2 ring-emerald-400/50',
        style: {
          boxShadow: '0 0 24px 4px rgba(52, 211, 153, 0.55)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      };
    case 3:
      return {
        borderClasses: 'border-emerald-300 ring-4 ring-emerald-400/60',
        style: {
          boxShadow: '0 0 36px 8px rgba(52, 211, 153, 0.70), 0 0 12px 2px rgba(16, 185, 129, 0.45)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      };
    case 4:
      return {
        borderClasses: 'border-amber-300 ring-4 ring-emerald-300',
        style: {
          boxShadow: '0 0 48px 12px rgba(52, 211, 153, 0.85), 0 0 24px 6px rgba(251, 191, 36, 0.65)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      };
    case 5:
    default:
      // Level 5: MAX LUMINOSITY on Gameboard Border!
      return {
        borderClasses: 'border-white ring-4 ring-amber-400 animate-pulse',
        style: {
          boxShadow:
            '0 0 64px 16px rgba(251, 191, 36, 0.95), 0 0 40px 10px rgba(52, 211, 153, 0.90), inset 0 0 18px rgba(255, 255, 255, 0.35)',
          filter: 'brightness(1.15) contrast(1.10)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      };
  }
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  room,
  currentPlayerId,
  onSubmitMove,
  onOpenLeaderboard,
  onSendMessage,
  onDeleteMessage,
  onLeaveRoom,
  onUndoMove,
  onUseHint,
  boardThemeId,
}) => {
  const currentTheme = getBoardTheme(boardThemeId);
  // Local 9x9 player board initialized from server's initialBoard
  const [board, setBoard] = useState<number[][]>(() =>
    room.initialBoard ? room.initialBoard.map((r) => [...r]) : Array.from({ length: 9 }, () => Array(9).fill(0))
  );
  // Track which cells were given clues vs user-solved
  const [givenMask] = useState<boolean[][]>(() =>
    room.initialBoard
      ? room.initialBoard.map((r) => r.map((val) => val !== 0))
      : Array.from({ length: 9 }, () => Array(9).fill(false))
  );

  // Move history stack for robust Undo functionality
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);

  // Pencil notes (candidate marks) per cell
  const [notes, setNotes] = useState<Set<number>[][]>(() =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()))
  );
  const notesRef = useRef<Set<number>[][]>(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const [notesMode, setNotesMode] = useState(false);

  // Currently selected cell [row, col]
  const [selectedCell, setSelectedCell] = useState<[number, number]>([0, 0]);

  // Keep a ref to selectedCell so global keyboard event listener never gets stale
  const selectedCellRef = useRef<[number, number]>(selectedCell);
  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  // Last chosen / filled cell number for tactical wheel memory
  const [lastChosenDigit, setLastChosenDigit] = useState<number>(1);
  const lastChosenDigitRef = useRef<number>(1);

  // Visual feedback state for each cell ('correct' | 'incorrect' | null)
  const [cellFeedback, setCellFeedback] = useState<Record<string, CellFeedback>>({});
  const [wrongValueOverlay, setWrongValueOverlay] = useState<Record<string, number>>({});
  const [lastActionBanner, setLastActionBanner] = useState<{
    type: 'correct' | 'incorrect' | 'info';
    text: string;
  } | null>(null);

  // Automatically dismiss action banner after 500ms so game screen remains completely clean and easy to read
  useEffect(() => {
    if (!lastActionBanner) return;
    const timer = setTimeout(() => {
      setLastActionBanner(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [lastActionBanner]);

  // Audio settings overlay popup state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundEngine.enabled);

  // Leave match confirmation modal
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Tactical dial wheel state for rapid cell number entry
  const [radialWheel, setRadialWheel] = useState<{
    open: boolean;
    row: number;
    col: number;
  } | null>(null);

  // Line & 3x3 square celebration sparkles (non-blocking, play alongside game)
  const [sparkleEvents, setSparkleEvents] = useState<SparkleEvent[]>([]);
  const completedLinesRef = useRef<{
    rows: Set<number>;
    cols: Set<number>;
    boxes: Set<number>;
  }>({
    rows: new Set(),
    cols: new Set(),
    boxes: new Set(),
  });

  const handleDismissSparkle = useCallback((id: string) => {
    setSparkleEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Persistent toggle for radial wheel mode (enabled by default on mobile / touch)
  const [radialWheelEnabled, setRadialWheelEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nueve_radial_wheel_enabled');
      if (saved !== null) return saved === 'true';
      return 'ontouchstart' in window || window.innerWidth <= 768;
    }
    return true;
  });

  const toggleRadialWheel = () => {
    const next = !radialWheelEnabled;
    setRadialWheelEnabled(next);
    localStorage.setItem('nueve_radial_wheel_enabled', String(next));
    if (!next) {
      setRadialWheel(null);
    }
  };

  // Keyboard hints helper modal
  const [showKeyHints, setShowKeyHints] = useState(false);

  // Side drawer tab for Mobile / Floating Chat or Opponents
  const [activeSideTab, setActiveSideTab] = useState<'standings' | 'chat'>('standings');

  // Manual digit highlight filter (for tapping digits on numpad or highlighting specific numbers)
  const [manualHighlightDigit, setManualHighlightDigit] = useState<number | null>(null);

  // Live Match Timer
  const [elapsedMs, setElapsedMs] = useState<number>(() =>
    room.startTime ? Math.max(0, Date.now() - room.startTime) : 0
  );

  const me = room.players.find((p) => p.id === currentPlayerId);
  const isFinished = Boolean(me?.finished);
  const isHost = room.hostId === currentPlayerId;

  // Live Advanced Scoring State (Satisfying the 5 Performance Scoring Rules)
  const [liveScore, setLiveScore] = useState<number>(me?.score || 0);
  const [comboStreak, setComboStreak] = useState<number>(me?.comboStreak || 0);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1.0);
  const [difficultyMultiplier, setDifficultyMultiplier] = useState<number>(
    () => me?.difficultyMultiplier || calculateDifficultyMultiplier(room.difficulty, room.customClues)
  );
  const [maxScoreCap, setMaxScoreCap] = useState<number | null>(me?.maxScoreCap ?? null);
  const [hintsUsed, setHintsUsed] = useState<number>(me?.hintsUsed || 0);
  const [showScoreInfoModal, setShowScoreInfoModal] = useState<boolean>(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [lastMoveTimestamp, setLastMoveTimestamp] = useState<number | null>(null);
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);

  // Zen Mode state: hides all non-essential UI (standings, chat) to focus solely on the puzzle board
  const [zenMode, setZenMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sudoku_zen_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sudoku_zen_mode', String(next));
      } catch {}
      soundEngine.playSelect();
      return next;
    });
  }, []);

  // Victory celebration trigger when finishing correctly
  const celebrationTriggeredRef = useRef(false);
  useEffect(() => {
    const isSuccess =
      isFinished &&
      !me?.isEliminated &&
      (room.feedbackMode !== 'delayed' || (me?.mistakes || 0) === 0);

    if (isSuccess && !celebrationTriggeredRef.current) {
      celebrationTriggeredRef.current = true;
      setShowCelebrationModal(true);
      triggerVictoryCelebration();
    }
  }, [isFinished, me?.isEliminated, me?.mistakes, room.feedbackMode]);

  const handleComboExpire = useCallback(() => {
    setComboStreak(0);
    setComboMultiplier(1.0);
    setLastMoveTimestamp(null);
  }, []);

  // Automatic combo window expiration timer (5.0s window)
  useEffect(() => {
    if (!lastMoveTimestamp || comboStreak === 0) return;
    const elapsed = Date.now() - lastMoveTimestamp;
    const remaining = Math.max(0, COMBO_WINDOW_SECONDS * 1000 - elapsed);
    const timer = setTimeout(() => {
      handleComboExpire();
    }, remaining);
    return () => clearTimeout(timer);
  }, [lastMoveTimestamp, comboStreak, handleComboExpire]);

  useEffect(() => {
    if (typeof me?.score === 'number') setLiveScore(me.score);
    if (typeof me?.comboStreak === 'number') setComboStreak(me.comboStreak);
    if (typeof me?.difficultyMultiplier === 'number') setDifficultyMultiplier(me.difficultyMultiplier);
    if (me?.maxScoreCap !== undefined) setMaxScoreCap(me.maxScoreCap);
    if (typeof me?.hintsUsed === 'number') setHintsUsed(me.hintsUsed);
  }, [me?.score, me?.comboStreak, me?.difficultyMultiplier, me?.maxScoreCap, me?.hintsUsed]);

  const toggleSound = () => {
    const next = soundEngine.toggleSound();
    setSoundEnabled(next);
    if (next && soundEngine.volume === 0) {
      soundEngine.setVolume(0.8);
    }
  };

  useEffect(() => {
    if (!room.startTime) return;
    if (isFinished && me?.finishTimeMs) {
      setElapsedMs(me.finishTimeMs);
      return;
    }
    const interval = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - (room.startTime || Date.now())));
    }, 200);
    return () => clearInterval(interval);
  }, [room.startTime, isFinished, me?.finishTimeMs]);

  // Select first empty cell only once when game mounts
  const initializedCellRef = useRef(false);
  useEffect(() => {
    if (initializedCellRef.current || !room.initialBoard) return;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (room.initialBoard[r][c] === 0) {
          setSelectedCell([r, c]);
          initializedCellRef.current = true;
          return;
        }
      }
    }
    initializedCellRef.current = true;
  }, [room.initialBoard]);

  // Count how many times each digit 1..9 is already placed on the board
  const digitCounts = React.useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val >= 1 && val <= 9) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
    }
    return counts;
  }, [board]);

  const handleCellSelect = useCallback(
    (r: number, c: number) => {
      soundEngine.playSelect();
      selectedCellRef.current = [r, c];
      setSelectedCell([r, c]);
      if (board[r][c] > 0) {
        lastChosenDigitRef.current = board[r][c];
        setLastChosenDigit(board[r][c]);
      }
    },
    [board]
  );

  // Holding press detection for radial number wheel ("Hücreye basılı tutarak tekerleği açma")
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggeredRef = useRef<boolean>(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const openRadialWheelForCell = useCallback(
    (r: number, c: number) => {
      // Occupied cells are locked and cannot be changed
      if (isFinished || givenMask[r][c] || board[r][c] !== 0) return;
      soundEngine.playSelect();
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(35);
        }
      } catch {}
      selectedCellRef.current = [r, c];
      setSelectedCell([r, c]);
      setRadialWheel({ open: true, row: r, col: c });
    },
    [board, givenMask, isFinished]
  );

  const handleCellPointerDown = (r: number, c: number, e: React.PointerEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdTriggeredRef.current = false;
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };

    // Only allow radial wheel if cell is empty and match is active
    if (radialWheelEnabled && !givenMask[r][c] && board[r][c] === 0 && !isFinished) {
      holdTimerRef.current = setTimeout(() => {
        holdTriggeredRef.current = true;
        openRadialWheelForCell(r, c);
      }, 300);
    }
  };

  const handleCellPointerMove = (e: React.PointerEvent) => {
    if (pointerOriginRef.current && holdTimerRef.current) {
      const dist = Math.hypot(
        e.clientX - pointerOriginRef.current.x,
        e.clientY - pointerOriginRef.current.y
      );
      // Cancel long press if user is scrolling or dragging
      if (dist > 10) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  };

  const handleCellPointerUpOrCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pointerOriginRef.current = null;
  };

  const handleMoveSelection = useCallback(
    (dRow: number, dCol: number) => {
      const [r, c] = selectedCellRef.current;
      const nextR = (r + dRow + 9) % 9;
      const nextC = (c + dCol + 9) % 9;
      handleCellSelect(nextR, nextC);
    },
    [handleCellSelect]
  );

  const handleJumpEmpty = useCallback(
    (forward: boolean) => {
      const [r, c] = selectedCellRef.current;
      for (let i = 1; i < 81; i++) {
        const offset = forward ? i : -i;
        const checkIdx = (r * 9 + c + offset + 81 * 10) % 81;
        const tr = Math.floor(checkIdx / 9);
        const tc = checkIdx % 9;
        if (!givenMask[tr][tc] && board[tr][tc] === 0) {
          handleCellSelect(tr, tc);
          break;
        }
      }
    },
    [givenMask, board, handleCellSelect]
  );

  // Touch Swipe Gesture Detection for Mobile Devices
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const dt = Date.now() - start.time;

    // Minimum swipe threshold 26px within 450ms
    if (dt < 450 && (Math.abs(dx) >= 26 || Math.abs(dy) >= 26)) {
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe (left or right)
        handleMoveSelection(0, dx > 0 ? 1 : -1);
      } else {
        // Vertical swipe (up or down)
        handleMoveSelection(dy > 0 ? 1 : -1, 0);
      }
    }
  };

  const handleDigitInput = useCallback(
    (num: number, forceNote?: boolean) => {
      if (isFinished) return;
      const [r, c] = selectedCellRef.current;

      // If cell is already occupied with ANY number (given clue or user-placed), users CANNOT change them!
      if (board[r][c] !== 0) {
        setManualHighlightDigit((prev) => (prev === num ? null : num));
        soundEngine.playSelect();
        setLastActionBanner({
          type: 'info',
          text: 'Bu hücre dolu ve değiştirilemez.',
        });
        return;
      }

      // Record last chosen / filled digit
      lastChosenDigitRef.current = num;
      setLastChosenDigit(num);

      const key = `${r}-${c}`;
      const isNoteAction = forceNote !== undefined ? forceNote : notesMode;

      // If in candidate notes mode or Shift-note forced, toggle note locally
      if (isNoteAction) {
        soundEngine.playSelect();
        setNotes((prev) => {
          const next = prev.map((row) => row.map((s) => new Set(s)));
          if (next[r][c].has(num)) {
            next[r][c].delete(num);
          } else {
            next[r][c].add(num);
          }
          notesRef.current = next;
          return next;
        });
        return;
      }

      // Close quick radial wheel when entering a number
      setRadialWheel(null);

      const isDelayedMode = room.feedbackMode === 'delayed';

      // Submit move to server for authoritative validation
      onSubmitMove(r, c, num, (res) => {
        if (!res.ok || !res.validation) {
          if (res?.error) {
            setLastActionBanner({
              type: 'info',
              text: res.error,
            });
          }
          return;
        }

        const {
          correct,
          finished,
          mistakes: resMistakes,
          score,
          rank,
          liveScore: newLiveScore,
          comboStreak: newCombo,
          comboMultiplier: newMult,
          speedBonus,
          pointsEarned,
          difficultyMultiplier: newDiffMult,
          timeMultiplier: newTimeMult,
          maxScoreCap: newCap,
          hintsUsed: newHints,
        } = res.validation;

        if (typeof newLiveScore === 'number') setLiveScore(newLiveScore);
        if (typeof newCombo === 'number') setComboStreak(newCombo);
        if (typeof newMult === 'number') setComboMultiplier(newMult);
        if (typeof newDiffMult === 'number') {
          setDifficultyMultiplier(newDiffMult);
        } else if (typeof newTimeMult === 'number') {
          setDifficultyMultiplier(newTimeMult);
        }
        if (newCap !== undefined) setMaxScoreCap(newCap);
        if (typeof newHints === 'number') setHintsUsed(newHints);

        // In Delayed Mode: No immediate approved or wrong notification when giving a number!
        if (isDelayedMode) {
          // Play neutral soft tap click, never reveals correct/incorrect approval
          soundEngine.playSelect();

          // Fill cell on board
          setBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = num;
            return next;
          });

          // Clear candidate notes in this cell
          setNotes((prev) => {
            const next = prev.map((row) => row.map((s) => new Set(s)));
            next[r][c].clear();
            notesRef.current = next;
            return next;
          });

          // Check if finished (all cells placed):
          if (finished) {
            const finalMistakes = typeof resMistakes === 'number' ? resMistakes : (me?.mistakes || 0);
            if (finalMistakes === 0) {
              soundEngine.playVictory();
              triggerVictoryCelebration();
              setShowCelebrationModal(true);
            } else {
              soundEngine.playError();
              setLastActionBanner({
                type: 'info',
                text: `Tamamlandı: Tahtada ${finalMistakes} hata bulundu.`,
              });
            }
          }

          selectedCellRef.current = [r, c];
          setSelectedCell([r, c]);
          return;
        }

        if (correct) {
          setLastMoveTimestamp(Date.now());
          // Distinct success chime
          soundEngine.playCorrect();

          // Automatically clear 'pencil mark' candidates in the cell's row, column, and 3x3 block
          const currentNotes = notesRef.current;
          const boxStartR = Math.floor(r / 3) * 3;
          const boxStartC = Math.floor(c / 3) * 3;

          // Deduplicated map of peer cells where candidate `num` is cleared
          const clearedPeersMap = new Map<string, { row: number; col: number; digit: number }>();

          // 1. Check Row peers
          for (let colIdx = 0; colIdx < 9; colIdx++) {
            if (colIdx !== c && currentNotes[r]?.[colIdx]?.has(num)) {
              clearedPeersMap.set(`${r}-${colIdx}`, { row: r, col: colIdx, digit: num });
            }
          }

          // 2. Check Column peers
          for (let rowIdx = 0; rowIdx < 9; rowIdx++) {
            if (rowIdx !== r && currentNotes[rowIdx]?.[c]?.has(num)) {
              clearedPeersMap.set(`${rowIdx}-${c}`, { row: rowIdx, col: c, digit: num });
            }
          }

          // 3. Check 3x3 Block peers
          for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
              const tr = boxStartR + br;
              const tc = boxStartC + bc;
              if ((tr !== r || tc !== c) && currentNotes[tr]?.[tc]?.has(num)) {
                clearedPeersMap.set(`${tr}-${tc}`, { row: tr, col: tc, digit: num });
              }
            }
          }

          const clearedNotesAcrossBoard = Array.from(clearedPeersMap.values());
          const peerNotesClearedCount = clearedNotesAcrossBoard.length;

          // Record in move history stack for Undo
          setMoveHistory((prev) => [
            ...prev,
            {
              row: r,
              col: c,
              prevValue: board[r][c],
              newValue: num,
              prevNotes: Array.from(currentNotes[r]?.[c] || []),
              clearedNotesAcrossBoard,
            },
          ]);

          setBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = num;
            return next;
          });

          // Automatically clear pencil marks in this cell and peer cells (row, column, and 3x3 block)
          setNotes((prev) => {
            const next = prev.map((row) => row.map((s) => new Set(s)));
            // Cell itself is now verified: clear all notes in this cell
            next[r][c].clear();

            // Clear `num` from all cells in the same row
            for (let i = 0; i < 9; i++) {
              next[r][i].delete(num);
            }
            // Clear `num` from all cells in the same column
            for (let i = 0; i < 9; i++) {
              next[i][c].delete(num);
            }
            // Clear `num` from all cells in the same 3x3 block
            for (let br = 0; br < 3; br++) {
              for (let bc = 0; bc < 3; bc++) {
                next[boxStartR + br][boxStartC + bc].delete(num);
              }
            }
            notesRef.current = next;
            return next;
          });

          setWrongValueOverlay((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
          // Feedback audio and cell visual indicators are preserved, but notifications are suppressed per user preference
          if (finished) {
            soundEngine.playVictory();
            triggerVictoryCelebration();
            setShowCelebrationModal(true);
          }

          // Check for newly completed line (row or column) or square (3x3 box)
          const boxR = Math.floor(r / 3);
          const boxC = Math.floor(c / 3);
          const boxIdx = boxR * 3 + boxC;

          let rowComplete = true;
          for (let colIdx = 0; colIdx < 9; colIdx++) {
            const v = colIdx === c ? num : board[r][colIdx];
            if (v === 0) { rowComplete = false; break; }
          }

          let colComplete = true;
          for (let rowIdx = 0; rowIdx < 9; rowIdx++) {
            const v = rowIdx === r ? num : board[rowIdx][c];
            if (v === 0) { colComplete = false; break; }
          }

          let boxComplete = true;
          for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
              const tr = boxR * 3 + br;
              const tc = boxC * 3 + bc;
              const v = (tr === r && tc === c) ? num : board[tr][tc];
              if (v === 0) { boxComplete = false; break; }
            }
            if (!boxComplete) break;
          }

          const newlyFinishedSparkles: SparkleEvent[] = [];
          if (rowComplete && !completedLinesRef.current.rows.has(r)) {
            completedLinesRef.current.rows.add(r);
            newlyFinishedSparkles.push({
              id: `sparkle-row-${r}-${Date.now()}-${Math.random()}`,
              type: 'row',
              index: r,
              timestamp: Date.now(),
            });
          }

          if (colComplete && !completedLinesRef.current.cols.has(c)) {
            completedLinesRef.current.cols.add(c);
            newlyFinishedSparkles.push({
              id: `sparkle-col-${c}-${Date.now()}-${Math.random()}`,
              type: 'col',
              index: c,
              timestamp: Date.now(),
            });
          }

          if (boxComplete && !completedLinesRef.current.boxes.has(boxIdx)) {
            completedLinesRef.current.boxes.add(boxIdx);
            newlyFinishedSparkles.push({
              id: `sparkle-box-${boxIdx}-${Date.now()}-${Math.random()}`,
              type: 'box',
              index: boxIdx,
              timestamp: Date.now(),
            });
          }

          if (newlyFinishedSparkles.length > 0) {
            setSparkleEvents((prev) => [...prev, ...newlyFinishedSparkles]);
          }

          setTimeout(() => {
            setCellFeedback((prev) => ({ ...prev, [key]: null }));
          }, 500);

          // Strictly keep selection on current cell — never change or auto-advance cell
          selectedCellRef.current = [r, c];
          setSelectedCell([r, c]);
        } else {
          setComboStreak(0);
          setComboMultiplier(1.0);
          setLastMoveTimestamp(null);
          // Distinct error buzzer chime
          soundEngine.playError();

          setWrongValueOverlay((prev) => ({ ...prev, [key]: num }));
          setCellFeedback((prev) => ({ ...prev, [key]: 'incorrect' }));
          // Notification banner suppressed per user preference

          setTimeout(() => {
            setCellFeedback((prev) => ({ ...prev, [key]: null }));
            setWrongValueOverlay((prev) => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }, 500);

          // Strictly keep selection on current cell
          selectedCellRef.current = [r, c];
          setSelectedCell([r, c]);
        }
      });
    },
    [board, givenMask, isFinished, notes, notesMode, onSubmitMove]
  );

  const handleRadialDigitSelect = useCallback(
    (digit: number) => {
      if (!radialWheel) return;
      const targetR = radialWheel.row;
      const targetC = radialWheel.col;
      selectedCellRef.current = [targetR, targetC];
      setSelectedCell([targetR, targetC]);
      handleDigitInput(digit);
      if (!notesMode) {
        setRadialWheel(null);
      }
    },
    [handleDigitInput, notesMode, radialWheel]
  );

  const handleUseHintClick = useCallback(() => {
    if (isFinished || !onUseHint) return;

    let [targetR, targetC] = selectedCellRef.current;

    // If current selected cell is given or already filled, find first empty editable cell
    if (givenMask[targetR]?.[targetC] || board[targetR]?.[targetC] !== 0) {
      let found = false;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!givenMask[r]?.[c] && board[r]?.[c] === 0) {
            targetR = r;
            targetC = c;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) return;
    }

    selectedCellRef.current = [targetR, targetC];
    setSelectedCell([targetR, targetC]);

    const res = onUseHint(targetR, targetC);
    if (res && res.ok && typeof res.digit === 'number') {
      soundEngine.playCorrect();
      handleDigitInput(res.digit);
      setHintsUsed((prev) => prev + 1);
      if (res.cap !== undefined) {
        setMaxScoreCap(res.cap);
      }
    }
  }, [board, givenMask, handleDigitInput, isFinished, onUseHint]);

  const handleClearCell = useCallback(() => {
    if (isFinished) return;
    const [r, c] = selectedCellRef.current;
    if (givenMask[r][c]) return;

    // Occupied cells are permanent and cannot be changed or cleared
    if (board[r][c] !== 0) {
      soundEngine.playSelect();
      setLastActionBanner({
        type: 'info',
        text: 'Bu hücre dolu ve değiştirilemez.',
      });
      return;
    }

    const key = `${r}-${c}`;
    soundEngine.playSelect();

    // Clear candidate notes in an empty cell
    setNotes((prev) => {
      const next = prev.map((row) => row.map((s) => new Set(s)));
      next[r][c].clear();
      notesRef.current = next;
      return next;
    });

    setWrongValueOverlay((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, [board, givenMask, isFinished]);

  // Undo the last placed move (only if not an occupied number)
  const handleUndo = useCallback(() => {
    if (isFinished || moveHistory.length === 0) return;

    const lastMove = moveHistory[moveHistory.length - 1];
    const { row: r, col: c, prevValue, prevNotes, clearedNotesAcrossBoard } = lastMove;

    // Occupied cells are permanent and cannot be reverted
    if (lastMove.newValue !== 0) {
      soundEngine.playSelect();
      setLastActionBanner({
        type: 'info',
        text: 'Dolu hücreler kilitlidir ve geri alınamaz.',
      });
      return;
    }

    // Provided it was a user move and not an initial puzzle value
    if (givenMask[r][c]) {
      setMoveHistory((prev) => prev.slice(0, -1));
      return;
    }

    soundEngine.playSelect();

    // Revert board cell
    setBoard((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = prevValue;
      return next;
    });

    // Restore candidate notes
    setNotes((prev) => {
      const next = prev.map((row) => row.map((s) => new Set(s)));
      if (prevNotes && prevNotes.length > 0) {
        next[r][c] = new Set(prevNotes);
      }
      if (clearedNotesAcrossBoard && clearedNotesAcrossBoard.length > 0) {
        for (const item of clearedNotesAcrossBoard) {
          next[item.row][item.col].add(item.digit);
        }
      }
      notesRef.current = next;
      return next;
    });

    // Clear feedback/overlay
    const key = `${r}-${c}`;
    setCellFeedback((prev) => ({ ...prev, [key]: null }));
    setWrongValueOverlay((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    // Select the reverted cell
    selectedCellRef.current = [r, c];
    setSelectedCell([r, c]);

    // Pop move from history
    setMoveHistory((prev) => prev.slice(0, -1));

    // Notify server to adjust filledCount if reverting a solved cell
    if (onUndoMove) {
      onUndoMove(r, c);
    }

    const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    completedLinesRef.current.rows.delete(r);
    completedLinesRef.current.cols.delete(c);
    completedLinesRef.current.boxes.delete(boxIdx);

    setLastActionBanner({
      type: 'info',
      text: `Geri Alındı: R${r + 1}C${c + 1} reverted`,
    });
  }, [givenMask, isFinished, moveHistory, onUndoMove]);

  // Populate valid candidate notes for all unfilled cells
  const handleAutoFillCandidateNotes = useCallback(() => {
    if (isFinished) return;
    soundEngine.playSelect();

    setNotes((prev) => {
      const next = prev.map((row) => row.map((s) => new Set(s)));
      let addedCount = 0;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] !== 0 || givenMask[r][c]) {
            next[r][c].clear();
            continue;
          }

          const boxStartR = Math.floor(r / 3) * 3;
          const boxStartC = Math.floor(c / 3) * 3;
          const used = new Set<number>();

          // Row & Col used numbers
          for (let i = 0; i < 9; i++) {
            if (board[r][i] !== 0) used.add(board[r][i]);
            if (board[i][c] !== 0) used.add(board[i][c]);
          }
          // 3x3 block used numbers
          for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
              const val = board[boxStartR + br][boxStartC + bc];
              if (val !== 0) used.add(val);
            }
          }

          next[r][c].clear();
          for (let digit = 1; digit <= 9; digit++) {
            if (!used.has(digit)) {
              next[r][c].add(digit);
              addedCount++;
            }
          }
        }
      }

      notesRef.current = next;
      setLastActionBanner({
        type: 'info',
        text: `Adaylar Dolduruldu: ${addedCount} aday notu hesaplandı.`,
      });
      return next;
    });
  }, [board, givenMask, isFinished]);

  // Comprehensive Global Keyboard Navigation Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside a chat input or form field
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl && activeEl.getAttribute('contenteditable') === 'true')
      ) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      const [r, c] = selectedCellRef.current;

      // 0. Undo: Ctrl+Z / Cmd+Z or 'u' / 'U'
      if (
        ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) ||
        e.key === 'u' ||
        e.key === 'U'
      ) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // 1. Arrow Keys Navigation (Arrow keys, WASD, Vim keys)
      let nextR = r;
      let nextC = c;
      let isNav = false;

      if (e.key === 'ArrowUp' || e.key === 'Up' || e.key === 'w' || e.key === 'W' || e.key === 'k') {
        e.preventDefault();
        nextR = (r - 1 + 9) % 9;
        isNav = true;
      } else if (e.key === 'ArrowDown' || e.key === 'Down' || e.key === 's' || e.key === 'S' || e.key === 'j') {
        e.preventDefault();
        nextR = (r + 1) % 9;
        isNav = true;
      } else if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'a' || e.key === 'A' || e.key === 'h') {
        e.preventDefault();
        nextC = (c - 1 + 9) % 9;
        isNav = true;
      } else if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'd' || e.key === 'D' || e.key === 'l') {
        e.preventDefault();
        nextC = (c + 1) % 9;
        isNav = true;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextC = 0;
        isNav = true;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextC = 8;
        isNav = true;
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        nextR = 0;
        isNav = true;
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        nextR = 8;
        isNav = true;
      }

      if (isNav) {
        handleCellSelect(nextR, nextC);
        return;
      }

      // 2. Tab / Shift+Tab Navigation to cycle between empty cells
      if (e.key === 'Tab') {
        e.preventDefault();
        handleJumpEmpty(!e.shiftKey);
        return;
      }

      // 3. Number Keys (1-9) from number row, numpad, or international codes
      let digitVal: number | null = null;
      if (e.key >= '1' && e.key <= '9') {
        digitVal = parseInt(e.key, 10);
      } else if (e.code && /^Numpad[1-9]$/.test(e.code)) {
        digitVal = parseInt(e.code.slice(6), 10);
      } else if (e.code && /^Digit[1-9]$/.test(e.code) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        digitVal = parseInt(e.code.slice(5), 10);
      }

      if (digitVal !== null && digitVal >= 1 && digitVal <= 9) {
        e.preventDefault();
        // Shift + 1..9 directly toggles pencil note for that digit
        handleDigitInput(digitVal, e.shiftKey ? true : undefined);
        return;
      }

      // 4. Clear / Erase: Backspace, Delete, 0, Numpad0, c, x
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === '0' ||
        e.code === 'Numpad0' ||
        e.key === 'c' ||
        e.key === 'C' ||
        e.key === 'x' ||
        e.key === 'X'
      ) {
        e.preventDefault();
        handleClearCell();
        return;
      }

      // 5. Toggle Pencil Notes: n, N, p, P
      if (e.key === 'n' || e.key === 'N' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setNotesMode((prev) => !prev);
        soundEngine.playSelect();
        return;
      }

      // 5.5. Toggle Zen Mode: z, Z
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        toggleZenMode();
        return;
      }

      // 6. Toggle keyboard shortcuts help drawer: ?
      if (e.key === '?' || (e.key === '/' && !e.shiftKey)) {
        e.preventDefault();
        setShowKeyHints((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [givenMask, board, handleDigitInput, handleClearCell, handleUndo, handleCellSelect, handleJumpEmpty, toggleZenMode]);

  const [selRow, selCol] = selectedCell;
  const selectedVal = board[selRow]?.[selCol] || 0;
  // Active highlighted digit: automatically uses currently selected cell's value, or manual highlight
  const activeHighlightDigit = selectedVal !== 0 ? selectedVal : manualHighlightDigit;
  const selBoxRow = Math.floor(selRow / 3);
  const selBoxCol = Math.floor(selCol / 3);

  // Visual Conflict Detection: analyze duplicate numbers in the selected cell's row, column, and 3x3 square
  const conflictInfo = React.useMemo(() => {
    if (selRow < 0 || selCol < 0 || room.feedbackMode === 'delayed') {
      return {
        rowHasConflict: false,
        colHasConflict: false,
        boxHasConflict: false,
        conflictingRowNums: new Set<number>(),
        conflictingColNums: new Set<number>(),
        conflictingBoxNums: new Set<number>(),
      };
    }

    // 1. Check Row conflicts in selRow
    const rowCounts = new Map<number, number>();
    for (let c = 0; c < 9; c++) {
      const val = board[selRow][c];
      if (val > 0) rowCounts.set(val, (rowCounts.get(val) || 0) + 1);
    }
    const conflictingRowNums = new Set<number>();
    rowCounts.forEach((count, val) => {
      if (count >= 2) conflictingRowNums.add(val);
    });
    const rowHasConflict = conflictingRowNums.size > 0;

    // 2. Check Column conflicts in selCol
    const colCounts = new Map<number, number>();
    for (let r = 0; r < 9; r++) {
      const val = board[r][selCol];
      if (val > 0) colCounts.set(val, (colCounts.get(val) || 0) + 1);
    }
    const conflictingColNums = new Set<number>();
    colCounts.forEach((count, val) => {
      if (count >= 2) conflictingColNums.add(val);
    });
    const colHasConflict = conflictingColNums.size > 0;

    // 3. Check 3x3 Box conflicts
    const bStartR = Math.floor(selRow / 3) * 3;
    const bStartC = Math.floor(selCol / 3) * 3;
    const boxCounts = new Map<number, number>();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const val = board[bStartR + r][bStartC + c];
        if (val > 0) boxCounts.set(val, (boxCounts.get(val) || 0) + 1);
      }
    }
    const conflictingBoxNums = new Set<number>();
    boxCounts.forEach((count, val) => {
      if (count >= 2) conflictingBoxNums.add(val);
    });
    const boxHasConflict = conflictingBoxNums.size > 0;

    return {
      rowHasConflict,
      colHasConflict,
      boxHasConflict,
      conflictingRowNums,
      conflictingColNums,
      conflictingBoxNums,
    };
  }, [board, selRow, selCol]);

  // Sort opponents for live standings
  const sortedPlayers = [...room.players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank || 99) - (b.rank || 99);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.filledCount - a.filledCount;
  });

  const mistakeLimit = room.mistakeLimit ?? 0;
  const boardLuminosity = getBoardBorderLuminosityStyles(comboStreak);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
      {/* HUD Bar - Clean, Compact, Simplified */}
      <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl px-3 sm:px-4 py-2 mb-2 flex items-center justify-between gap-2">
        {/* Left: Difficulty, Room & Match Stats */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 text-xs">
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] sm:text-xs shrink-0">
            {room.difficulty}
          </span>
          <span className="font-mono text-slate-400 hidden sm:inline">#{room.code}</span>
          <span className="text-slate-300 flex items-center gap-1 font-medium text-xs">
            <span className="text-slate-500 hidden sm:inline">İlerleme:</span>
            <strong className="font-mono text-slate-100 tabular-nums">
              {me?.filledCount || 0}/{me?.totalToFill || 0}
            </strong>
          </span>
          <span className="text-slate-300 flex items-center gap-1 font-medium text-xs">
            <span className="text-slate-500 hidden sm:inline">Hata:</span>
            <strong
              className={`font-mono tabular-nums ${
                mistakeLimit > 0 && (me?.mistakes || 0) >= mistakeLimit
                  ? 'text-rose-500 font-black animate-pulse'
                  : (me?.mistakes || 0) > 0
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {mistakeLimit > 0
                ? `${me?.mistakes || 0}/${mistakeLimit}`
                : me?.mistakes || 0}
            </strong>
          </span>
          {hintsUsed > 0 && (
            <span className="text-amber-400 flex items-center gap-1 font-medium text-xs hidden sm:inline-flex">
              <span className="text-amber-500/80">Yardım:</span>
              <strong className="font-mono text-amber-300 tabular-nums">
                {hintsUsed}
              </strong>
            </span>
          )}
        </div>

        {/* Center: Live Timer */}
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-[#0B0F17] border border-slate-800 shrink-0">
          <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-50 tabular-nums">
            {formatDurationMs(elapsedMs)}
          </span>
        </div>

        {/* Right: Quick Controls (Sound, Keyboard hint, Standings, Exit) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-[#0B0F17] hover:bg-slate-800 border-slate-800 text-amber-400'
                : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
            aria-label="Ses Ayarı"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowKeyHints((prev) => !prev)}
            className={`p-2 rounded-xl border hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
              showKeyHints
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Klavye Kısayolları (?)"
            aria-label="Klavye Kısayolları"
          >
            <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Zen Mode Toggle: hides non-essential UI (standings, chat) */}
          <button
            type="button"
            onClick={toggleZenMode}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              zenMode
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow-sm'
                : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title={
              zenMode
                ? 'Zen Modundan Çık (Kısayol: Z)'
                : 'Zen Modu (Kısayol: Z) - Oyuncu listesini ve sohbeti gizleyerek sadece bulmacaya odaklanın'
            }
            aria-label="Zen Modu"
          >
            <Focus
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                zenMode ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
              }`}
            />
            <span className="hidden sm:inline">{zenMode ? 'Zen Açık' : 'Zen Modu'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Canlı Skor Tablosu"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline">Sıralama</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:text-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Oyundan Ayrıl"
            aria-label="Oyundan Çık"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </div>

      {/* Performance & Score Ribbon: Displays Live Score, Rapid Combo Multiplier, Time Multiplier & Ceiling Cap */}
      <div className="bg-[#0e1626]/90 border border-slate-800/80 rounded-2xl px-3 sm:px-4 py-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Score & Info Modal trigger */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0B0F17] px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-medium">Puan:</span>
            <strong className="font-mono text-emerald-400 text-sm font-black tabular-nums">
              {Math.round(liveScore)} pts
            </strong>
          </div>

          <button
            type="button"
            onClick={() => setShowScoreInfoModal(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Yeni Puanlama Sistemi Kurallarını Görüntüle"
            aria-label="Puanlama Kuralları"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {room.puzzleSeed && (
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(room.puzzleSeed || '');
                  setCopiedSeed(true);
                  setTimeout(() => setCopiedSeed(false), 2000);
                }
              }}
              className="flex items-center gap-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-amber-300 px-2 py-1 rounded-xl border border-slate-800 text-[11px] font-mono transition-colors cursor-pointer"
              title="Tohumu (Seed) Kopyala - Bu seed ile aynı Sudoku tahtasını baştan kurabilirsiniz"
            >
              <Hash className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="hidden sm:inline text-slate-400">Seed:</span>
              <span className="text-amber-300 font-bold">{room.puzzleSeed}</span>
              {copiedSeed ? (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500 shrink-0" />
              )}
            </button>
          )}
        </div>

        {/* Center / Right: Dynamic Combo, Difficulty Multiplier, and Score Cap Status */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">

          {/* Rule 5: Difficulty & Clues Multiplier (Süre çarpanı kaldırıldı, zorluk ve ipucu çarpanı eklendi) */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px]"
            title={
              room.difficulty === 'Custom'
                ? `Özel Bulmaca Zorluk Çarpanı: ${room.customClues || 40} ipucu bazlı (${difficultyMultiplier.toFixed(2)}x çarpan)`
                : `${room.difficulty} Seviyesi Zorluk Çarpanı: ${difficultyMultiplier.toFixed(2)}x çarpan`
            }
          >
            <SlidersHorizontal className="w-3 h-3 text-amber-400" />
            <span>
              {difficultyMultiplier.toFixed(2)}x Zorluk
              {room.difficulty === 'Custom' && room.customClues ? ` (${room.customClues} İpucu)` : ''}
            </span>
          </div>

          {/* Rules 2, 3, 4: Cap Status */}
          {(me?.mistakes || 0) === 0 && hintsUsed === 0 ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold text-[11px]"
              title="Hatasız ve yardımsız oyunlarda MAKSİMUM SINIR BULUNMAZ!"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Sınırsız Tavan</span>
              <span className="sm:hidden">Sınırsız</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]"
              title="Hatalar ve yardım kullanımı maksimum puan tavanını sınırlar"
            >
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>Maks: <strong>{maxScoreCap ?? '—'} pts</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Action Notification Banner (Suppressed for correct/wrong moves per user request) */}
      {lastActionBanner && lastActionBanner.type !== 'correct' && lastActionBanner.type !== 'incorrect' && (
        <div className="text-xs px-3 py-1.5 rounded-xl border mb-2.5 flex items-center justify-between gap-2 animate-in fade-in duration-100 bg-[#131B2E] border-slate-700 text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{lastActionBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastActionBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Helper Drawer (Desktop Only - Hidden on Mobile) */}
      {showKeyHints && (
        <div className="hidden sm:flex bg-[#131B2E] border border-amber-500/40 rounded-2xl p-3.5 mb-3 text-xs text-slate-300 items-center justify-between gap-4 animate-in fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Keyboard Controls:</span>
            </span>
            <span><strong className="text-white">↑ ↓ ← → / WASD / HJKL:</strong> Move selection</span>
            <span><strong className="text-white">1–9 / Numpad:</strong> Enter digit</span>
            <span><strong className="text-white">Shift + 1–9:</strong> Direct candidate note</span>
            <span><strong className="text-white">Backspace / Del / 0 / C:</strong> Clear cell</span>
            <span><strong className="text-white">N / P:</strong> Toggle notes mode</span>
            <span><strong className="text-white">Tab / Shift+Tab:</strong> Cycle empty cells</span>
            <span><strong className="text-white">Home / End:</strong> Row start / end</span>
            <span><strong className="text-emerald-400">Z:</strong> Zen Modu (Odaklan)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyHints(false)}
            className="text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Focus Layout: Sudoku Square & Numpad in Main Center Area */}
      <div
        className={`grid grid-cols-1 ${
          zenMode ? 'max-w-2xl mx-auto' : 'lg:grid-cols-12'
        } gap-3 sm:gap-5 items-start`}
      >
        {/* Core Game Arena: Grid + Tactical Numpad */}
        <div
          className={`${
            zenMode ? 'col-span-1' : 'lg:col-span-8'
          } flex flex-col items-center space-y-3 sm:space-y-4 w-full`}
        >
          {/* Zen Mode Focus Bar */}
          {zenMode && (
            <div className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Focus className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                <span className="font-semibold text-emerald-200">Zen Modu Aktif</span>
                <span className="text-slate-400 hidden sm:inline text-[11px]">
                  · Sohbet ve oyuncu listeleri gizlendi, sadece bulmacaya odaklanılıyor
                </span>
              </div>
              <button
                type="button"
                onClick={toggleZenMode}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] border border-emerald-500/40 transition-colors cursor-pointer"
                title="Zen Modundan Çık (Kısayol: Z)"
              >
                Zen'den Çık (Z)
              </button>
            </div>
          )}
          {/* Victory or Elimination Modal Overlay if Finished */}
          {isFinished && (
            <div
              className={`w-full rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 ${
                me?.isEliminated
                  ? 'bg-rose-950/50 border border-rose-500/50'
                  : 'bg-emerald-950/40 border border-emerald-500/40'
              }`}
            >
              <div className="flex items-center gap-3">
                {me?.isEliminated ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      me?.isEliminated ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {me?.isEliminated
                      ? `Match Ended · Mistake Limit Reached (${me?.mistakes}/${room.mistakeLimit})`
                      : `Grid Complete! Ranked #${me?.rank}`}
                  </div>
                  <div className="text-xs text-slate-300">
                    {me?.isEliminated ? (
                      'You have reached the maximum allowed mistakes for this tournament match.'
                    ) : (
                      <>
                        Score:{' '}
                        <strong className="font-mono text-emerald-400 text-sm">
                          {me?.score?.toFixed(0)} pts
                        </strong>{' '}
                        · Time: {formatDurationMs(me?.finishTimeMs || 0)}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!me?.isEliminated && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerVictoryCelebration();
                      setShowCelebrationModal(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Kutlama ekranını ve konfetileri tekrar görüntüle"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kutlama</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowScoreInfoModal(true)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Puan Detayları"
                >
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>Puan Detayı</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-slate-950 font-semibold text-xs whitespace-nowrap cursor-pointer text-center ${
                    me?.isEliminated
                      ? 'bg-rose-400 hover:bg-rose-300'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  Inspect Final Scoreboard
                </button>
              </div>
            </div>
          )}

          {/* Conflict Highlight Indicator when selected cell belongs to conflicting row, column, or 3x3 box */}
          {(conflictInfo.rowHasConflict || conflictInfo.colHasConflict || conflictInfo.boxHasConflict) && !isFinished && (
            <div className="flex items-center justify-center gap-2 py-1.5 px-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Duplicate conflict in selected{' '}
                {[
                  conflictInfo.rowHasConflict && 'Row',
                  conflictInfo.colHasConflict && 'Column',
                  conflictInfo.boxHasConflict && '3×3 Square',
                ]
                  .filter(Boolean)
                  .join(' & ')}
              </span>
            </div>
          )}



          {/* 9x9 Sudoku Board: Dynamic color palette themes with Combo Border Luminosity */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={boardLuminosity.style}
            className={`relative w-full max-w-[min(96vw,calc(100dvh-260px),480px)] aspect-square ${
              currentTheme.boardBg
            } p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 ${
              comboStreak > 0
                ? boardLuminosity.borderClasses
                : `${currentTheme.boardBorder} shadow-2xl`
            } select-none mx-auto touch-manipulation`}
            role="grid"
            aria-label="9 by 9 Sudoku Grid"
          >
            <div className={`relative w-full h-full grid grid-cols-9 grid-rows-9 ${currentTheme.gridInnerBg} border ${currentTheme.gridBorder} rounded-lg sm:rounded-xl overflow-hidden`}>
              {board.map((rowArr, r) =>
                rowArr.map((cellValue, c) => {
                  const key = `${r}-${c}`;
                  const isGiven = givenMask[r][c];
                  const isSelected = r === selRow && c === selCol;
                  const isSameRow = r === selRow;
                  const isSameCol = c === selCol;
                  const isSameBox = Math.floor(r / 3) === selBoxRow && Math.floor(c / 3) === selBoxCol;
                  const isRowOrCol = isSameRow || isSameCol;
                  const isSameNumber =
                    activeHighlightDigit !== null &&
                    activeHighlightDigit !== 0 &&
                    cellValue === activeHighlightDigit &&
                    !isSelected;

                  // Duplicate conflict detection for cells
                  const isConflictingDuplicate =
                    cellValue > 0 &&
                    ((conflictInfo.rowHasConflict && isSameRow && conflictInfo.conflictingRowNums.has(cellValue)) ||
                      (conflictInfo.colHasConflict && isSameCol && conflictInfo.conflictingColNums.has(cellValue)) ||
                      (conflictInfo.boxHasConflict && isSameBox && conflictInfo.conflictingBoxNums.has(cellValue)));

                  const isCellInConflictingUnit =
                    (conflictInfo.rowHasConflict && isSameRow) ||
                    (conflictInfo.colHasConflict && isSameCol) ||
                    (conflictInfo.boxHasConflict && isSameBox);

                  const feedback = cellFeedback[key];
                  const wrongVal = wrongValueOverlay[key];
                  const cellNotes = notes[r][c];

                  // 3x3 sector borders with high-contrast demarcation for clean readability
                  const borderRight =
                    c === 2 || c === 5
                      ? `border-r-2 ${currentTheme.sectorBorder}`
                      : c < 8
                      ? `border-r ${currentTheme.cellBorder}`
                      : '';
                  const borderBottom =
                    r === 2 || r === 5
                      ? `border-b-2 ${currentTheme.sectorBorder}`
                      : r < 8
                      ? `border-b ${currentTheme.cellBorder}`
                      : '';

                  // In delayed mode after finishing, reveal any incorrect cells so user sees them for themselves
                  const isDelayedFinishedMistake =
                    isFinished &&
                    room.feedbackMode === 'delayed' &&
                    Boolean(room.solutionBoard) &&
                    cellValue !== 0 &&
                    cellValue !== room.solutionBoard![r][c];

                  // State coloring: Dynamic theme palette states with conflict highlighting (no cell combo luminosity)
                  let bgClass = `${currentTheme.cellBgDefault} ${currentTheme.cellBgHover}`;
                  let textClass = currentTheme.textGiven;

                  if (isDelayedFinishedMistake) {
                    bgClass = 'bg-rose-600/40 ring-2 ring-rose-500 animate-shake z-20';
                    textClass = 'text-rose-200 font-extrabold';
                  } else if (feedback === 'correct') {
                    bgClass = 'bg-emerald-500/20 animate-pop';
                    textClass = currentTheme.textUser;
                  } else if (feedback === 'incorrect') {
                    bgClass = 'bg-rose-500/40 animate-shake z-20';
                    textClass = 'text-rose-400 font-extrabold';
                  } else if (isConflictingDuplicate) {
                    // Visually highlight duplicate conflict numbers with bright warning
                    bgClass = 'bg-rose-600/35 ring-2 ring-rose-500 font-black animate-pulse z-20';
                    textClass = 'text-rose-200 font-black';
                  } else if (isSelected) {
                    bgClass = currentTheme.cellBgSelected;
                    if (isSameNumber) {
                      textClass = currentTheme.textSameNumber;
                    } else if (!isGiven) {
                      textClass = currentTheme.textUser;
                    }
                  } else if (isSameNumber) {
                    bgClass = currentTheme.cellBgSameNumber;
                    textClass = currentTheme.textSameNumber;
                  } else if (isCellInConflictingUnit) {
                    // Visually highlight the row, column, or 3x3 box containing conflicts
                    bgClass = 'bg-rose-950/45 border-rose-500/30';
                    if (!isGiven) textClass = currentTheme.textUser;
                  } else if (isSameBox && isRowOrCol) {
                    bgClass = currentTheme.cellBgCrossBox;
                    if (!isGiven) textClass = currentTheme.textUser;
                  } else if (isSameBox || isRowOrCol) {
                    bgClass = currentTheme.cellBgRowCol;
                    if (!isGiven) textClass = currentTheme.textUser;
                  } else if (!isGiven) {
                    textClass = currentTheme.textUser;
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-label={`Row ${r + 1} Column ${c + 1}, ${
                        cellValue ? `value ${cellValue}${isGiven ? ' (given)' : ' (occupied)'}` : 'empty'
                      }`}
                      onPointerDown={(e) => handleCellPointerDown(r, c, e)}
                      onPointerMove={handleCellPointerMove}
                      onPointerUp={handleCellPointerUpOrCancel}
                      onPointerCancel={handleCellPointerUpOrCancel}
                      onPointerLeave={handleCellPointerUpOrCancel}
                      onClick={() => {
                        if (holdTriggeredRef.current) {
                          holdTriggeredRef.current = false;
                          return;
                        }
                        // Only open radial wheel if cell is not given and not already occupied
                        if (isSelected && !isGiven && cellValue === 0 && !isFinished) {
                          openRadialWheelForCell(r, c);
                        } else {
                          handleCellSelect(r, c);
                        }
                      }}
                      className={`relative w-full h-full flex items-center justify-center transition-all duration-100 focus:outline-none cursor-pointer select-none p-0 ${borderRight} ${borderBottom} ${bgClass}`}
                    >
                      {wrongVal ? (
                        <span className="font-mono text-base sm:text-2xl font-bold text-rose-400 leading-none">
                          {wrongVal}
                        </span>
                      ) : cellValue !== 0 ? (
                        <span className={`font-mono text-lg sm:text-2xl leading-none ${textClass}`}>
                          {cellValue}
                        </span>
                      ) : cellNotes.size > 0 ? (
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 p-0.5 pointer-events-none">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                            const hasNote = cellNotes.has(n);
                            const isNoteHighlighted = hasNote && activeHighlightDigit === n;
                            return (
                              <span
                                key={n}
                                className={`font-mono text-[8px] sm:text-[10px] leading-none flex items-center justify-center transition-all ${
                                  !hasNote
                                    ? ''
                                    : isNoteHighlighted
                                    ? `${currentTheme.textNotesHighlight} rounded-xs shadow-xs scale-110`
                                    : `${currentTheme.textNotes}`
                                }`}
                              >
                                {hasNote ? n : ''}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
              {/* Non-blocking Celebration Sparkles on finishing lines or 3x3 squares (strictly 0.5s) */}
              <SparkleCelebration events={sparkleEvents} onDismiss={handleDismissSparkle} />

              {/* Tactical Single-Move Dial Wheel with Centered Number */}
              {radialWheel && radialWheel.open && !isFinished && (
                <TacticalNumberWheel
                  row={radialWheel.row}
                  col={radialWheel.col}
                  currentValue={board[radialWheel.row][radialWheel.col]}
                  lastChosenDigit={lastChosenDigit}
                  digitCounts={digitCounts}
                  notesMode={notesMode}
                  cellNotes={notes[radialWheel.row]?.[radialWheel.col] || new Set()}
                  onSelectDigit={(digit) => {
                    handleRadialDigitSelect(digit);
                  }}
                  onClearCell={handleClearCell}
                  onToggleNotesMode={() => setNotesMode((prev) => !prev)}
                  onClose={() => setRadialWheel(null)}
                />
              )}
            </div>
          </div>

          {/* Tactical On-Screen Numpad & Quick Action Controls */}
          <div className="w-full max-w-[min(96vw,calc(100dvh-260px),480px)] bg-[#131B2E] border border-slate-800/90 rounded-2xl p-2 sm:p-3.5 space-y-2 sm:space-y-3">
            {/* Action Bar: Coordinates, Undo, Clear, Notes, and Wheel */}
            <div className="flex items-center justify-between text-xs gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-0.5">
              {/* Coordinates & Active Digit Highlight Filter */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <span className="px-2 py-1 rounded-lg bg-[#0B0F17] border border-slate-800 text-slate-300 font-mono font-semibold text-[11px] sm:text-xs shrink-0">
                  R{selRow + 1}C{selCol + 1}
                </span>

                {board[selRow]?.[selCol] !== 0 ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px]"
                    title="Bu hücre bir sayıyla dolu ve kilitlidir. Değiştirilemez veya silinemez."
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Kilitli</span>
                  </span>
                ) : (
                  <span
                    className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]"
                    title="Doğrulanan rakam satır, sütun ve 3x3 kutudaki adayları otomatik temizler (Auto-clears row, column & 3x3 block)"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Oto-Temizle</span>
                  </span>
                )}

                {activeHighlightDigit !== null && activeHighlightDigit !== 0 && (
                  <button
                    type="button"
                    onClick={() => setManualHighlightDigit(null)}
                    className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-[10px] sm:text-[11px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer shrink-0"
                    title="Vurgulamayı Temizle / Clear Highlight"
                  >
                    <span>#{activeHighlightDigit}</span>
                    <span className="text-amber-400/80 font-normal hidden sm:inline">
                      ({digitCounts[activeHighlightDigit] || 0}/9)
                    </span>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: Geri Al (Undo), Sil (Clear), Notlar (Notes), Tekerlek (Wheel) */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Undo Button */}
                <button
                  type="button"
                  disabled={
                    isFinished ||
                    moveHistory.length === 0 ||
                    moveHistory[moveHistory.length - 1]?.newValue !== 0
                  }
                  onClick={handleUndo}
                  className={`min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 border transition-all shrink-0 ${
                    moveHistory.length > 0 &&
                    moveHistory[moveHistory.length - 1]?.newValue === 0 &&
                    !isFinished
                      ? 'bg-[#0B0F17] hover:bg-slate-800 border-slate-700 text-slate-200 active:scale-95 cursor-pointer'
                      : 'bg-[#0B0F17]/50 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    moveHistory.length > 0 && moveHistory[moveHistory.length - 1]?.newValue !== 0
                      ? 'Dolu hücreler kilitlidir ve geri alınamaz'
                      : 'Son aday notu hamlesini geri al (Ctrl+Z / U)'
                  }
                  aria-label="Geri Al"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Geri</span>
                  {moveHistory.length > 0 && (
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                      {moveHistory.length}
                    </span>
                  )}
                </button>

                {/* Clear Cell Button (Disabled if cell has a placed number) */}
                <button
                  type="button"
                  disabled={
                    isFinished ||
                    board[selRow]?.[selCol] !== 0 ||
                    (notes[selRow]?.[selCol]?.size || 0) === 0
                  }
                  onClick={handleClearCell}
                  className="min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
                  title={
                    board[selRow]?.[selCol] !== 0
                      ? 'Dolu hücreler kilitlidir ve silinemez'
                      : 'Hücredeki aday notlarını temizle (Backspace / Del / 0)'
                  }
                >
                  <Eraser className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Sil</span>
                </button>

                {/* Notes Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setNotesMode((prev) => !prev);
                    soundEngine.playSelect();
                  }}
                  className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    notesMode
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-sm ring-2 ring-sky-400/50'
                      : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Toggle Candidate Notes Mode (Shortcut: N or P)"
                >
                  <Pencil className={`w-3.5 h-3.5 shrink-0 ${notesMode ? 'text-sky-300' : 'text-slate-400'}`} />
                  <span className="hidden sm:inline">{notesMode ? 'Notes: ON' : 'Notes: OFF'}</span>
                </button>

                {/* Auto-Fill Candidate Notes Helper */}
                <button
                  type="button"
                  disabled={isFinished}
                  onClick={handleAutoFillCandidateNotes}
                  className="min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-xs font-semibold text-sky-300 hover:text-sky-200 flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
                  title="Tüm boş hücrelerin olası adaylarını otomatik doldur (Auto-Fill Candidates)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="hidden sm:inline">Aday Doldur</span>
                </button>

                {/* Hint / Yardım Assist Button (Rule 3: Using hints caps max score) */}
                {onUseHint && (
                  <button
                    type="button"
                    disabled={isFinished}
                    onClick={handleUseHintClick}
                    className={`min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                      hintsUsed > 0
                        ? 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/50'
                        : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300'
                    }`}
                    title="Yardım / İpucu Kullan (DİKKAT: Kullanıldığında maksimum tavan puanı sınırlar!)"
                    aria-label="Yardım Kullan"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline">Yardım</span>
                    {hintsUsed > 0 && (
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {hintsUsed}
                      </span>
                    )}
                  </button>
                )}

                {/* Open Radial Wheel on editable cell */}
                {!givenMask[selRow]?.[selCol] && (
                  <button
                    type="button"
                    onClick={() => openRadialWheelForCell(selRow, selCol)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5"
                    title={
                      board[selRow]?.[selCol] > 0
                        ? `Change cell number (Current: #${board[selRow][selCol]})`
                        : 'Open number wheel'
                    }
                    aria-label="Sayı Tekerleği"
                  >
                    <Disc className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-semibold hidden sm:inline">
                      {board[selRow]?.[selCol] > 0 ? `Change #${board[selRow][selCol]}` : 'Wheel'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* 1-9 Tactical Digits Grid - Touch-optimized targets */}
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                const count = digitCounts[digit] || 0;
                const exhausted = count >= 9;
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={isFinished || (exhausted && !notesMode)}
                    onClick={() => handleDigitInput(digit)}
                    className={`min-h-[46px] h-12 sm:h-14 rounded-lg sm:rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 touch-manipulation select-none ${
                      exhausted && !notesMode
                        ? 'bg-[#0B0F17]/50 border-slate-800/40 text-slate-600 cursor-not-allowed'
                        : activeHighlightDigit === digit
                        ? 'bg-amber-500 border-amber-300 text-slate-950 font-black ring-2 ring-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                        : 'bg-[#0B0F17] hover:bg-slate-800 active:bg-slate-700 border-slate-800 text-slate-100'
                    }`}
                  >
                    <span className="font-mono text-base sm:text-xl font-bold leading-none">
                      {digit}
                    </span>
                    <span
                      className={`font-mono text-[8px] sm:text-[9px] mt-0.5 leading-none ${
                        activeHighlightDigit === digit ? 'text-slate-950 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {Math.max(0, 9 - count)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side Auxiliary Area: Standings and Room Chat (Hidden in Zen Mode to focus solely on puzzle board) */}
        {!zenMode && (
          <div className="lg:col-span-4 space-y-3 sm:space-y-4 w-full">
            {/* Segmented Control to switch between Standings and Room Chat */}
            <div className="flex items-center gap-1 p-1 bg-[#131B2E] border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSideTab('standings')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSideTab === 'standings'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Live Standings</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('chat')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSideTab === 'chat'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Match Chat ({(room.messages || []).length})</span>
              </button>
            </div>

            {/* Tab 1: Live Competitor Race Standings */}
            {activeSideTab === 'standings' && (
              <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200">Competitor Progress</h3>
                  {room.firstFinishTimeMs !== null && (
                    <span className="text-[11px] font-mono text-amber-400">
                      Leader @ {formatDurationMs(room.firstFinishTimeMs)}
                    </span>
                  )}
                </div>

                <div className="space-y-3 max-h-[320px] lg:max-h-[380px] overflow-y-auto pr-1">
                  {sortedPlayers.map((p) => {
                    const pct =
                      p.totalToFill > 0
                        ? Math.min(100, Math.round((p.filledCount / p.totalToFill) * 100))
                        : 0;

                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarBadge avatarId={p.avatarId} size="sm" />
                            <span className="font-medium text-slate-200 truncate">{p.name}</span>
                            {p.id === currentPlayerId && (
                              <span className="text-amber-400 font-semibold">· You</span>
                            )}
                            {!p.connected && (
                              <span className="text-rose-400 text-[10px]">· Off</span>
                            )}
                          </div>

                          <div className="font-mono text-slate-300 shrink-0 text-xs">
                            {p.finished ? (
                              <span className="text-emerald-400 font-semibold">
                                #{p.rank} · {p.score?.toFixed(1)} pts
                              </span>
                            ) : (
                              <span>
                                {p.filledCount}/{p.totalToFill} ({pct}%)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="w-full h-1.5 bg-[#0B0F17] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              p.finished ? 'bg-emerald-400' : 'bg-amber-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: In-Game Real-Time Chat */}
            {activeSideTab === 'chat' && (
              <ChatPanel
                messages={room.messages || []}
                currentUserId={currentPlayerId}
                isHost={isHost}
                onSendMessage={onSendMessage}
                onDeleteMessage={onDeleteMessage}
                compact={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Puanlama Sistemi Bilgi Modalı (New Performance Scoring Rules Modal) */}
      {showScoreInfoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowScoreInfoModal(false)}
        >
          <div
            className="bg-[#131B2E] border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Yeni Puanlama Sistemi</h3>
                  <p className="text-xs text-slate-400">Performans, Hız ve Ustalık Kuralları</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScoreInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              {/* Kural 1 */}
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-orange-400 font-bold">
                  <Flame className="w-4 h-4" />
                  <span>1. Hızlı Ardışık Hücre Serisi (Kombo & Hız Bonusu)</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  5 saniye içinde art arda hızlıca bulunan her doğru hücre, seri katsayınızı (1.25x'ten 3.5x'e kadar) katlar. Ayrıca 1.5s ve 3.0s altında bulunan hücreler anlık ekstra +100 puana kadar hız bonusu kazandırır.
                </p>
              </div>

              {/* Kural 2 */}
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>2. Yüksek Hata Cezası & Tavan Düşüşü</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Yapılan her hata doğrudan yüksek puan cezası (-250 puan) uygular ve seriyi sıfırlar. Ayrıca her hata, bu maçta alınabilecek maksimum puan tavanını kademeli olarak kısıtlar.
                </p>
              </div>

              {/* Kural 3 */}
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Lightbulb className="w-4 h-4" />
                  <span>3. Yardım / İpucu Kullanımı Sınırı</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Yardım (İpucu) kullanıldığında, kazanabileceğiniz maksimum puan seçilen zorluk seviyesinin azami yardım tavanı ile kilitlenir (Kolay: 600, Orta: 900, Zor: 1300, Uzman: 1700, Usta: 2100).
                </p>
              </div>

              {/* Kural 4 */}
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-emerald-500/30 space-y-1">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>4. Hatasız & Yardımsız Oyunlarda Sınırsız Tavan</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  0 hata ve 0 yardım ile tamamlanan oyunlarda hiçbir üst sınır bulunmaz! Hızlı kombolarınız ve yüksek sürenizle sınırsız rekor puanlar elde edebilirsiniz.
                </p>
              </div>

              {/* Kural 5: Zorluk ve İpucu Sayısı Çarpanı */}
              <div className="bg-[#0B0F17] p-3 rounded-xl border border-amber-500/30 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>5. Zorluk Seviyesi ve İpucu Sayısı Çarpanı</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Bitirme süresi çarpanı kaldırılmıştır; yerine doğrudan zorluk seviyesine ve tahtadaki ipucu sayısına dayalı adil bir çarpan uygulanır (Kolay: 1.00x, Orta: 1.35x, Zor: 1.75x, Çok Zor: 2.15x, Uzman: 2.60x, Usta: 3.20x). Özel (Custom) seviyelerde ise adaletsizliği önlemek için sahip olunan ipucu sayısına göre 0.60x ile 3.75x arasında dinamik ve adil puanlama yapılır.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScoreInfoModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer text-center"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Game Confirmation Modal (Oyundan Ayrıl) */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="bg-[#131B2E] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-100 text-base">Oyundan Çıkış</h3>
                <p className="text-xs text-slate-400">Ana sayfaya dönmek üzeresiniz</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Devam eden maçtan ayrılıp ana sayfaya dönmek istediğinize emin misiniz? Maçtan çıkış yaptığınızda bu oda terk edilecektir.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Oyuna Devam Et
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onLeaveRoom();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Oyundan Ayrıl</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grand Victory Celebration Modal with Confetti Fireworks */}
      {showCelebrationModal && me && (
        <VictoryCelebrationModal
          room={room}
          player={me}
          onClose={() => setShowCelebrationModal(false)}
          onOpenLeaderboard={onOpenLeaderboard}
          onOpenScoreDetails={() => {
            setShowCelebrationModal(false);
            setShowScoreInfoModal(true);
          }}
          onLeaveRoom={onLeaveRoom}
        />
      )}
    </div>
  );
};
