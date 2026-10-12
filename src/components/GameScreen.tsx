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
} from 'lucide-react';
import { RoomPublicState, MoveValidationResponse } from '../types/game.ts';
import { soundEngine } from '../utils/sound.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { AvatarBadge } from './AvatarBadge.tsx';
import { TacticalNumberWheel } from './TacticalNumberWheel.tsx';
import { SparkleCelebration, SparkleEvent } from './SparkleCelebration.tsx';

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
}

type CellFeedback = 'correct' | 'incorrect' | null;

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
}) => {
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

  // Visual feedback state for each cell ('correct' | 'incorrect' | null)
  const [cellFeedback, setCellFeedback] = useState<Record<string, CellFeedback>>({});
  const [wrongValueOverlay, setWrongValueOverlay] = useState<Record<string, number>>({});
  const [lastActionBanner, setLastActionBanner] = useState<{
    type: 'correct' | 'incorrect' | 'info';
    text: string;
  } | null>(null);

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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.enabled = next;
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
    },
    []
  );

  // Holding press detection for radial number wheel ("Hücreye basılı tutarak tekerleği açma")
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggeredRef = useRef<boolean>(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const openRadialWheelForCell = useCallback(
    (r: number, c: number) => {
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

    // If cell is empty, not a given clue, and match is active, set long-press timer (~320ms)
    if (radialWheelEnabled && !givenMask[r][c] && board[r][c] === 0 && !isFinished) {
      holdTimerRef.current = setTimeout(() => {
        holdTriggeredRef.current = true;
        openRadialWheelForCell(r, c);
      }, 320);
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

      // Cannot overwrite a given initial clue or an already verified cell
      if (givenMask[r][c] || board[r][c] !== 0) {
        // Allow toggling highlight of that digit for inspection
        setManualHighlightDigit((prev) => (prev === num ? null : num));
        soundEngine.playSelect();
        return;
      }

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

      // Submit move to server for authoritative validation
      onSubmitMove(r, c, num, (res) => {
        if (!res.ok || !res.validation) return;

        const { correct, finished, score, rank } = res.validation;

        if (correct) {
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
          setCellFeedback((prev) => ({ ...prev, [key]: 'correct' }));
          setLastActionBanner({
            type: 'correct',
            text: finished
              ? `Board Complete! Ranked #${rank} with ${score?.toFixed(1)} pts.`
              : peerNotesClearedCount > 0
              ? `Verified ${num} at R${r + 1}C${c + 1} · Auto-cleared ${peerNotesClearedCount} pencil candidate${peerNotesClearedCount > 1 ? 's' : ''} in row, col & 3x3 box`
              : `Verified ${num} at R${r + 1}C${c + 1}`,
          });

          if (finished) {
            soundEngine.playVictory();
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
          }, 650);

          // Strictly keep selection on current cell — never change or auto-advance cell
          selectedCellRef.current = [r, c];
          setSelectedCell([r, c]);
        } else {
          // Distinct error buzzer chime
          soundEngine.playError();

          setWrongValueOverlay((prev) => ({ ...prev, [key]: num }));
          setCellFeedback((prev) => ({ ...prev, [key]: 'incorrect' }));
          setLastActionBanner({
            type: 'incorrect',
            text: `Invalid entry ${num} at R${r + 1}C${c + 1} — rejected by server validation`,
          });

          setTimeout(() => {
            setCellFeedback((prev) => ({ ...prev, [key]: null }));
            setWrongValueOverlay((prev) => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }, 850);

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

  const handleClearCell = useCallback(() => {
    if (isFinished) return;
    const [r, c] = selectedCellRef.current;
    if (givenMask[r][c]) return;

    const key = `${r}-${c}`;
    soundEngine.playSelect();

    // If cell has a user-placed number, record in move history so it can be reverted via Undo
    if (board[r][c] !== 0) {
      setMoveHistory((prev) => [
        ...prev,
        {
          row: r,
          col: c,
          prevValue: board[r][c],
          newValue: 0,
          prevNotes: Array.from(notes[r][c]),
          clearedNotesAcrossBoard: [],
        },
      ]);

      setBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = 0;
        return next;
      });

      if (onUndoMove) {
        onUndoMove(r, c);
      }
      const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      completedLinesRef.current.rows.delete(r);
      completedLinesRef.current.cols.delete(c);
      completedLinesRef.current.boxes.delete(boxIdx);
    } else {
      setNotes((prev) => {
        const next = prev.map((row) => row.map((s) => new Set(s)));
        next[r][c].clear();
        notesRef.current = next;
        return next;
      });
    }

    setWrongValueOverlay((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, [board, givenMask, isFinished, notes, onUndoMove]);

  // Undo the last placed number or move
  const handleUndo = useCallback(() => {
    if (isFinished || moveHistory.length === 0) return;

    const lastMove = moveHistory[moveHistory.length - 1];
    const { row: r, col: c, prevValue, prevNotes, clearedNotesAcrossBoard } = lastMove;

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

      // 6. Toggle keyboard shortcuts help drawer: ?
      if (e.key === '?' || (e.key === '/' && !e.shiftKey)) {
        e.preventDefault();
        setShowKeyHints((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [givenMask, board, handleDigitInput, handleClearCell, handleUndo, handleCellSelect, handleJumpEmpty]);

  const [selRow, selCol] = selectedCell;
  const selectedVal = board[selRow]?.[selCol] || 0;
  // Active highlighted digit: automatically uses currently selected cell's value, or manual highlight
  const activeHighlightDigit = selectedVal !== 0 ? selectedVal : manualHighlightDigit;
  const selBoxRow = Math.floor(selRow / 3);
  const selBoxCol = Math.floor(selCol / 3);

  // Sort opponents for live standings
  const sortedPlayers = [...room.players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank || 99) - (b.rank || 99);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.filledCount - a.filledCount;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
      {/* HUD Bar - Clean, Compact, Simplified */}
      <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl px-3 sm:px-4 py-2 mb-3 flex items-center justify-between gap-2">
        {/* Left: Difficulty, Room & Match Stats */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 text-xs">
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px] sm:text-xs">
            {room.difficulty}
          </span>
          <span className="font-mono text-slate-400 hidden sm:inline">#{room.code}</span>
          <span className="text-slate-300 flex items-center gap-1 font-medium">
            <span className="text-slate-500 hidden xs:inline">İlerleme:</span>
            <strong className="font-mono text-slate-100 tabular-nums">
              {me?.filledCount || 0}/{me?.totalToFill || 0}
            </strong>
          </span>
          <span className="text-slate-300 flex items-center gap-1 font-medium">
            <span className="text-slate-500 hidden xs:inline">Hata:</span>
            <strong
              className={`font-mono tabular-nums ${
                (me?.mistakes || 0) > 0 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {me?.mistakes || 0}
            </strong>
          </span>
        </div>

        {/* Center: Live Timer */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0B0F17] border border-slate-800 shrink-0">
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

      {/* Action Notification Banner */}
      {lastActionBanner && (
        <div
          className={`text-xs px-3 py-1.5 rounded-xl border mb-2.5 flex items-center justify-between gap-2 animate-in fade-in duration-100 ${
            lastActionBanner.type === 'correct'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : lastActionBanner.type === 'incorrect'
              ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              : 'bg-[#131B2E] border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {lastActionBanner.type === 'correct' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
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

      {/* Keyboard Shortcuts Helper Drawer (Shown when requested) */}
      {showKeyHints && (
        <div className="bg-[#131B2E] border border-amber-500/40 rounded-2xl p-3.5 mb-3 text-xs text-slate-300 flex items-center justify-between gap-4 animate-in fade-in">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 items-start">
        {/* Core Game Arena: Grid + Tactical Numpad */}
        <div className="lg:col-span-8 flex flex-col items-center space-y-3 sm:space-y-4 w-full">
          {/* Victory Modal Overlay if Finished */}
          {isFinished && (
            <div className="w-full bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-300">
                    Grid Complete! Ranked #{me?.rank}
                  </div>
                  <div className="text-xs text-slate-300">
                    Score: <strong className="font-mono text-emerald-400">{me?.score?.toFixed(1)} pts</strong> · Time: {formatDurationMs(me?.finishTimeMs || 0)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs whitespace-nowrap cursor-pointer text-center"
              >
                Inspect Final Scoreboard
              </button>
            </div>
          )}

          {/* 9x9 Sudoku Board: Fully responsive with touch swipe gestures and touch-manipulation */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative w-full max-w-[min(96vw,calc(100dvh-260px),480px)] aspect-square bg-[#070A10] p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 border-slate-700 shadow-2xl select-none mx-auto touch-manipulation"
            role="grid"
            aria-label="9 by 9 Sudoku Grid"
          >
            <div className="relative w-full h-full grid grid-cols-9 grid-rows-9 bg-slate-800 border border-slate-700 rounded-lg sm:rounded-xl overflow-hidden">
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

                  const feedback = cellFeedback[key];
                  const wrongVal = wrongValueOverlay[key];
                  const cellNotes = notes[r][c];

                  // 3x3 sector borders with high-contrast demarcation
                  const borderRight =
                    c === 2 || c === 5
                      ? 'border-r-2 border-r-slate-400/90'
                      : c < 8
                      ? 'border-r border-r-slate-800/80'
                      : '';
                  const borderBottom =
                    r === 2 || r === 5
                      ? 'border-b-2 border-b-slate-400/90'
                      : r < 8
                      ? 'border-b border-b-slate-800/80'
                      : '';

                  // State coloring: Clear strategic crosshair highlighting for row, column, and 3x3 box
                  let bgClass = 'bg-[#0F172A] active:bg-slate-700/80 hover:bg-slate-800/80';
                  if (feedback === 'correct') {
                    bgClass = 'bg-emerald-500/40 animate-pop z-20';
                  } else if (feedback === 'incorrect') {
                    bgClass = 'bg-rose-500/40 animate-shake z-20';
                  } else if (isSelected) {
                    bgClass = 'bg-amber-400/45 ring-2 sm:ring-[2.5px] ring-inset ring-amber-300 shadow-[inset_0_0_14px_rgba(251,191,36,0.4)] z-20';
                  } else if (isSameNumber) {
                    bgClass = 'bg-amber-500/35 ring-2 ring-inset ring-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.3)] z-10';
                  } else if (isSameBox && isRowOrCol) {
                    // Enhanced intersection of current row/col within the selected 3x3 box
                    bgClass = 'bg-[#24334C] ring-1 ring-inset ring-sky-400/30 z-5';
                  } else if (isSameBox) {
                    // Current 3x3 Box strategic highlight
                    bgClass = 'bg-[#1B273B] ring-1 ring-inset ring-sky-500/20';
                  } else if (isRowOrCol) {
                    // Current Row and Column strategic crosshair beam
                    bgClass = 'bg-[#1E293B] shadow-inner';
                  }

                  let textClass = 'text-slate-100 font-semibold';
                  if (feedback === 'correct') {
                    textClass = 'text-emerald-300 font-bold';
                  } else if (feedback === 'incorrect') {
                    textClass = 'text-rose-300 font-bold';
                  } else if (isSameNumber) {
                    textClass = 'text-amber-200 font-black drop-shadow-[0_1px_4px_rgba(245,158,11,0.6)] scale-105';
                  } else if (!isGiven) {
                    textClass = 'text-amber-200 font-semibold';
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-label={`Row ${r + 1} Column ${c + 1}, ${
                        cellValue ? `value ${cellValue}` : 'empty'
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
                        if (isSelected && board[r][c] === 0 && !isGiven && !isFinished) {
                          openRadialWheelForCell(r, c);
                        } else {
                          handleCellSelect(r, c);
                        }
                      }}
                      className={`relative w-full h-full flex items-center justify-center transition-colors duration-75 focus:outline-none cursor-pointer select-none p-0 ${borderRight} ${borderBottom} ${bgClass}`}
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
                                    ? 'bg-amber-400 text-slate-950 font-black rounded-xs shadow-xs scale-110 ring-1 ring-amber-300'
                                    : 'text-sky-300 font-medium'
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
              {/* Non-blocking Celebration Sparkles on finishing lines or 3x3 squares */}
              <SparkleCelebration events={sparkleEvents} onDismiss={handleDismissSparkle} />

              {/* Tactical Single-Move Dial Wheel with Centered Number */}
              {radialWheel && radialWheel.open && !isFinished && (
                <TacticalNumberWheel
                  row={radialWheel.row}
                  col={radialWheel.col}
                  currentValue={board[radialWheel.row][radialWheel.col]}
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

                <span
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]"
                  title="Doğrulanan rakam satır, sütun ve 3x3 kutudaki adayları otomatik temizler (Auto-clears row, column & 3x3 block)"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Oto-Temizle</span>
                </span>

                {activeHighlightDigit !== null && activeHighlightDigit !== 0 && (
                  <button
                    type="button"
                    onClick={() => setManualHighlightDigit(null)}
                    className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-[10px] sm:text-[11px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer shrink-0"
                    title="Vurgulamayı Temizle / Clear Highlight"
                  >
                    <span>#{activeHighlightDigit}</span>
                    <span className="text-amber-400/80 font-normal">
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
                  disabled={isFinished || moveHistory.length === 0}
                  onClick={handleUndo}
                  className={`min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 border transition-all cursor-pointer shrink-0 ${
                    moveHistory.length > 0 && !isFinished
                      ? 'bg-[#0B0F17] hover:bg-slate-800 border-slate-700 text-slate-200 active:scale-95'
                      : 'bg-[#0B0F17]/50 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                  title="Son hamleyi geri al (Ctrl+Z / U)"
                  aria-label="Geri Al"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xs:inline">Geri</span>
                  {moveHistory.length > 0 && (
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                      {moveHistory.length}
                    </span>
                  )}
                </button>

                {/* Clear Cell Button */}
                <button
                  type="button"
                  disabled={isFinished || givenMask[selRow]?.[selCol] || (board[selRow]?.[selCol] === 0 && notes[selRow]?.[selCol]?.size === 0)}
                  onClick={handleClearCell}
                  className="min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
                  title="Hücreyi temizle (Backspace / Del / 0)"
                >
                  <Eraser className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xs:inline">Sil</span>
                </button>

                {/* Notes Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setNotesMode((prev) => !prev);
                    soundEngine.playSelect();
                  }}
                  className={`min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    notesMode
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-xs ring-1 ring-sky-400/50'
                      : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Aday Notları Modunu Aç/Kapat (Kısayol: N)"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                  <span>{notesMode ? 'Not: AÇIK' : 'Not: KAPALI'}</span>
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

                {/* Open Radial Wheel on empty cell */}
                {!givenMask[selRow]?.[selCol] && board[selRow]?.[selCol] === 0 && (
                  <button
                    type="button"
                    onClick={() => openRadialWheelForCell(selRow, selCol)}
                    className="min-h-[38px] p-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer active:scale-95 shrink-0"
                    title="Bu hücre için Sayı Tekerleğini Aç"
                    aria-label="Sayı Tekerleği"
                  >
                    <Disc className="w-3.5 h-3.5 shrink-0" />
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

        {/* Side Auxiliary Area: Standings and Room Chat (4 Columns on Desktop, Clean Below Grid on Mobile) */}
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
      </div>

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
    </div>
  );
};
