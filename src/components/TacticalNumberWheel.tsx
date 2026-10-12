import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Pencil, Eraser, Sparkles } from 'lucide-react';
import { soundEngine } from '../utils/sound.ts';

interface TacticalNumberWheelProps {
  row: number;
  col: number;
  currentValue: number;
  digitCounts: Record<number, number>;
  notesMode: boolean;
  cellNotes: Set<number>;
  onSelectDigit: (digit: number) => void;
  onClearCell: () => void;
  onToggleNotesMode: () => void;
  onClose: () => void;
}

export const TacticalNumberWheel: React.FC<TacticalNumberWheelProps> = ({
  row,
  col,
  currentValue,
  digitCounts,
  notesMode,
  cellNotes,
  onSelectDigit,
  onClearCell,
  onToggleNotesMode,
  onClose,
}) => {
  // Center focused number (1-9). If current cell already has a value, start with it, else first candidate or 1.
  const [focalDigit, setFocalDigit] = useState<number>(() => {
    if (currentValue >= 1 && currentValue <= 9) return currentValue;
    if (cellNotes.size > 0) {
      return Array.from(cellNotes)[0];
    }
    // Default to the most needed digit or 1
    for (let d = 1; d <= 9; d++) {
      if ((digitCounts[d] || 0) < 9) return d;
    }
    return 1;
  });

  const [isNoteActive, setIsNoteActive] = useState<boolean>(notesMode);

  // Sound and optional vibration when stepping one move
  const triggerStepFeedback = () => {
    soundEngine.playSelect();
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    } catch {}
  };

  // Move numbers ONLY ONE move at a time (-1 move)
  const handleStepLeft = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFocalDigit((prev) => {
      const next = prev === 1 ? 9 : prev - 1;
      triggerStepFeedback();
      return next;
    });
  };

  // Move numbers ONLY ONE move at a time (+1 move)
  const handleStepRight = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFocalDigit((prev) => {
      const next = prev === 9 ? 1 : prev + 1;
      triggerStepFeedback();
      return next;
    });
  };

  // Touch Swipe Gesture for 1-move step
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    touchStartRef.current = null;

    if (dx < -25) {
      handleStepRight(); // Swiped left -> advance +1
    } else if (dx > 25) {
      handleStepLeft(); // Swiped right -> step back -1
    }
  };

  // Mouse wheel listener: single move per tick
  const handleWheelScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY > 10 || e.deltaX > 10) {
      handleStepRight();
    } else if (e.deltaY < -10 || e.deltaX < -10) {
      handleStepLeft();
    }
  };

  // Place current centered number
  const handleConfirmPlacement = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onSelectDigit(focalDigit);
  };

  // Keyboard navigation within the wheel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleStepLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleStepRight();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleConfirmPlacement();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const digit = parseInt(e.key, 10);
        setFocalDigit(digit);
        triggerStepFeedback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focalDigit]);

  // Compute previous and next digits for the single-move visual strip
  const prevDigit = focalDigit === 1 ? 9 : focalDigit - 1;
  const nextDigit = focalDigit === 9 ? 1 : focalDigit + 1;

  const currentCount = digitCounts[focalDigit] || 0;
  const remainingCount = Math.max(0, 9 - currentCount);
  const isExhausted = currentCount >= 9;
  const hasNote = cellNotes.has(focalDigit);

  // Position dial relative to target cell, clamping inside board
  const cellLeftPct = ((col + 0.5) / 9) * 100;
  const cellTopPct = ((row + 0.5) / 9) * 100;

  const hubLeftPct = Math.max(20, Math.min(80, cellLeftPct));
  const hubTopPct = Math.max(22, Math.min(78, cellTopPct));

  return (
    <div
      className="absolute inset-0 z-40 bg-black/65 backdrop-blur-[2px] rounded-lg sm:rounded-xl flex items-center justify-center animate-in fade-in duration-100 touch-manipulation select-none"
      onClick={onClose}
    >
      {/* Target Reticle Indicator directly on the target cell */}
      <div
        className="absolute border-2 border-amber-400 bg-amber-400/30 rounded-md pointer-events-none ring-2 ring-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.7)] z-20 animate-pulse"
        style={{
          left: `${(col / 9) * 100}%`,
          top: `${(row / 9) * 100}%`,
          width: `${(1 / 9) * 100}%`,
          height: `${(1 / 9) * 100}%`,
        }}
      />

      {/* Center Tactical Wheel Hub */}
      <div
        className="absolute w-64 sm:w-72 bg-[#131B2E] border-2 border-amber-500/80 rounded-3xl p-3.5 sm:p-4 shadow-[0_0_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.25)] space-y-3 z-30 animate-in zoom-in-95 duration-150"
        style={{
          left: `${hubLeftPct}%`,
          top: `${hubTopPct}%`,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheelScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Hub Header: Target Coordinate & Close Button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-300 bg-[#0B0F17] px-2 py-0.5 rounded-md border border-slate-800">
              R{row + 1}C{col + 1}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Single-Move Dial</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Kapat (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tactical Dial Wheel Row: [ ◀ Step ]  [ Prev ]  [ CENTER FOCUSED NUMBER ]  [ Next ]  [ Step ▶ ] */}
        <div className="flex items-center justify-between gap-1.5 py-1">
          {/* Step -1 Button */}
          <button
            type="button"
            onClick={handleStepLeft}
            className="w-10 h-10 rounded-2xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-amber-300 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-md shrink-0"
            title="Move numbers -1 move (A / ◀)"
            aria-label="Previous Number"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Adjacent Previous Number Preview (Tap to move 1 step left) */}
          <button
            type="button"
            onClick={handleStepLeft}
            className="w-9 h-9 rounded-xl bg-[#0B0F17]/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
            title={`Step to ${prevDigit}`}
          >
            <span className="font-mono text-xs font-bold leading-none">{prevDigit}</span>
            <span className="font-mono text-[7px] text-slate-500 leading-none mt-0.5">
              {Math.max(0, 9 - (digitCounts[prevDigit] || 0))} left
            </span>
          </button>

          {/* CENTER FOCUSED NUMBER: Large, Prominent, Interactive */}
          <button
            type="button"
            onClick={handleConfirmPlacement}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-xl border-2 shrink-0 ${
              isNoteActive
                ? 'bg-sky-500/25 border-sky-400 text-sky-200 ring-2 ring-sky-400/50 shadow-sky-500/20'
                : isExhausted
                ? 'bg-amber-500/10 border-slate-700 text-slate-500 opacity-60'
                : 'bg-amber-500 border-amber-300 text-slate-950 font-black ring-4 ring-amber-400/30 shadow-amber-500/40 hover:bg-amber-400'
            }`}
            title="Tap to Place Number into Cell (Enter / Space)"
          >
            <span className="font-mono text-2xl sm:text-3xl font-black leading-none tracking-tight">
              {focalDigit}
            </span>
            <span
              className={`font-mono text-[9px] font-bold leading-none mt-1 ${
                isNoteActive ? 'text-sky-300' : isExhausted ? 'text-slate-500' : 'text-slate-900'
              }`}
            >
              {isExhausted ? 'Full (9/9)' : `${remainingCount} left`}
            </span>
          </button>

          {/* Adjacent Next Number Preview (Tap to move 1 step right) */}
          <button
            type="button"
            onClick={handleStepRight}
            className="w-9 h-9 rounded-xl bg-[#0B0F17]/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
            title={`Step to ${nextDigit}`}
          >
            <span className="font-mono text-xs font-bold leading-none">{nextDigit}</span>
            <span className="font-mono text-[7px] text-slate-500 leading-none mt-0.5">
              {Math.max(0, 9 - (digitCounts[nextDigit] || 0))} left
            </span>
          </button>

          {/* Step +1 Button */}
          <button
            type="button"
            onClick={handleStepRight}
            className="w-10 h-10 rounded-2xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-amber-300 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-md shrink-0"
            title="Move numbers +1 move (D / ▶)"
            aria-label="Next Number"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Quick Actions Row: Primary "Place Number", Note Toggle, Clear Cell */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
          {/* Main Action Confirm Button */}
          <button
            type="button"
            onClick={handleConfirmPlacement}
            className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Place {focalDigit}</span>
          </button>

          {/* Toggle Notes Mode */}
          <button
            type="button"
            onClick={() => {
              setIsNoteActive((prev) => !prev);
              onToggleNotesMode();
              triggerStepFeedback();
            }}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 ${
              isNoteActive
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-[#0B0F17] hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Candidate Note Mode"
            aria-label="Candidate Note"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Note</span>
          </button>

          {/* Clear Cell */}
          <button
            type="button"
            onClick={() => {
              onClearCell();
              onClose();
            }}
            className="p-2.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Hücreyi Sil (Backspace / 0)"
            aria-label="Clear Cell"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
