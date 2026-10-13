import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Eraser } from 'lucide-react';
import { soundEngine, triggerHaptic } from '../utils/sound.ts';

interface TacticalNumberWheelProps {
  row: number;
  col: number;
  currentValue: number;
  lastChosenDigit?: number;
  digitCounts: Record<number, number>;
  notesMode: boolean;
  cellNotes: Set<number>;
  onSelectDigit: (digit: number) => void;
  onClearCell: () => void;
  onToggleNotesMode: () => void;
  onClose: () => void;
}

const SLOT_WIDTH = 42; // Width of each number slot in pixels

export const TacticalNumberWheel: React.FC<TacticalNumberWheelProps> = ({
  row,
  col,
  currentValue,
  lastChosenDigit,
  onSelectDigit,
  onClearCell,
  onClose,
}) => {
  // Always initialize with the last chosen / selected digit
  const initialDigit =
    lastChosenDigit && lastChosenDigit >= 1 && lastChosenDigit <= 9
      ? lastChosenDigit
      : currentValue >= 1 && currentValue <= 9
      ? currentValue
      : 1;

  const [focalDigit, setFocalDigit] = useState<number>(initialDigit);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const focalDigitRef = useRef<number>(initialDigit);
  focalDigitRef.current = focalDigit;

  // Audio and subtle haptic feedback for wheel interactions
  const triggerStepFeedback = () => {
    soundEngine.playSelect();
    triggerHaptic(10);
  };

  // Programmatically scroll the swipe container to center a specific digit
  const scrollToDigit = useCallback((digit: number, smooth = true) => {
    if (!scrollRef.current) return;
    const clamped = Math.max(1, Math.min(9, digit));
    const targetScroll = (clamped - 1) * SLOT_WIDTH;
    isProgrammaticScrollRef.current = true;
    scrollRef.current.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setFocalDigit(clamped);
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, smooth ? 250 : 20);
  }, []);

  // On mount: instantly center the last selected number in the swipe container and fire subtle haptic
  useEffect(() => {
    triggerHaptic(12);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = (initialDigit - 1) * SLOT_WIDTH;
    }
  }, [initialDigit]);

  // Keep synced if lastChosenDigit changes externally
  useEffect(() => {
    if (lastChosenDigit && lastChosenDigit >= 1 && lastChosenDigit <= 9) {
      if (lastChosenDigit !== focalDigitRef.current) {
        scrollToDigit(lastChosenDigit, true);
      }
    }
  }, [lastChosenDigit, scrollToDigit]);

  // Track user swipe/scroll to identify the centered digit
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScroll = scrollRef.current.scrollLeft;
    const activeIndex = Math.round(currentScroll / SLOT_WIDTH);
    const newDigit = Math.max(1, Math.min(9, activeIndex + 1));

    if (newDigit !== focalDigitRef.current) {
      focalDigitRef.current = newDigit;
      setFocalDigit(newDigit);
      if (!isProgrammaticScrollRef.current) {
        triggerStepFeedback();
      }
    }
  };

  // Step left (-1)
  const handleStepLeft = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = focalDigit === 1 ? 9 : focalDigit - 1;
    scrollToDigit(next, true);
    triggerStepFeedback();
  };

  // Step right (+1)
  const handleStepRight = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = focalDigit === 9 ? 1 : focalDigit + 1;
    scrollToDigit(next, true);
    triggerStepFeedback();
  };

  // Mouse / Pointer drag support for desktop swipe-to-scroll
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current || !scrollRef.current) return;
    const dx = e.clientX - startXRef.current;
    scrollRef.current.scrollLeft = startScrollLeftRef.current - dx;
  };

  const handlePointerUpOrLeave = () => {
    isPointerDownRef.current = false;
  };

  // Mouse wheel scroll to spin through digits
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (!scrollRef.current) return;
    if (e.deltaY > 6 || e.deltaX > 6) {
      handleStepRight();
    } else if (e.deltaY < -6 || e.deltaX < -6) {
      handleStepLeft();
    }
  };

  // Clicking a number in the swipe track
  const handleSlotClick = (digit: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (digit === focalDigit) {
      // If already centered, confirm and place into cell!
      triggerHaptic(20);
      onSelectDigit(digit);
    } else {
      // If not centered, smooth scroll it to center
      scrollToDigit(digit, true);
      triggerStepFeedback();
    }
  };

  // Keyboard navigation
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
        triggerHaptic(20);
        onSelectDigit(focalDigit);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        triggerHaptic([10, 30, 10]);
        onClearCell();
        onClose();
      } else if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const digit = parseInt(e.key, 10);
        scrollToDigit(digit, true);
        triggerStepFeedback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focalDigit, onClose, onClearCell, onSelectDigit, scrollToDigit]);

  // Position: strictly and always centered over the selected cell
  const cellCenterX = ((col + 0.5) / 9) * 100;
  const cellCenterY = ((row + 0.5) / 9) * 100;

  return (
    <div
      className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[0.5px] rounded-lg sm:rounded-xl flex items-center justify-center animate-in fade-in duration-75 touch-manipulation select-none"
      onClick={onClose}
    >
      {/* Target Reticle Indicator highlighting the selected cell */}
      <div
        className="absolute border-2 border-amber-400 bg-amber-400/20 rounded-md pointer-events-none ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.5)] z-20"
        style={{
          left: `${(col / 9) * 100}%`,
          top: `${(row / 9) * 100}%`,
          width: `${(1 / 9) * 100}%`,
          height: `${(1 / 9) * 100}%`,
        }}
      />

      {/* Swipe-to-Scroll Wheel Container: Minimized and centered on the selected cell */}
      <div
        className="absolute z-30 animate-in zoom-in-95 duration-75 flex flex-col items-center"
        style={{
          left: `${cellCenterX}%`,
          top: `${cellCenterY}%`,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimized Swipe-to-Scroll Pill Container */}
        <div className="relative w-[172px] h-[50px] rounded-full bg-[#090D16]/95 border-2 border-amber-400 shadow-[0_8px_30px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.35)] backdrop-blur-md flex items-center overflow-hidden">
          {/* Subtle edge fade overlays */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#090D16] to-transparent z-20" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#090D16] to-transparent z-20" />

          {/* Left Step Arrow indicator (tap to step back) */}
          <button
            type="button"
            onClick={handleStepLeft}
            className="absolute left-1 z-25 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-400/80 hover:text-amber-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
            title="Step Left"
            aria-label="Previous Number"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Right Step Arrow indicator (tap to advance) */}
          <button
            type="button"
            onClick={handleStepRight}
            className="absolute right-1 z-25 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-400/80 hover:text-amber-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
            title="Step Right"
            aria-label="Next Number"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Fixed Center Target Reticle highlight */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[40px] h-[40px] rounded-full ring-2 ring-amber-300/40 bg-amber-400/10 shadow-[0_0_12px_rgba(245,158,11,0.25)] z-10" />

          {/* Horizontal Swipe-to-Scroll Track */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUpOrLeave}
            onPointerLeave={handlePointerUpOrLeave}
            className="w-full h-full flex items-center overflow-x-auto snap-x snap-mandatory touch-pan-x cursor-grab active:cursor-grabbing select-none"
            style={{
              paddingLeft: `calc(50% - ${SLOT_WIDTH / 2}px)`,
              paddingRight: `calc(50% - ${SLOT_WIDTH / 2}px)`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
              const isCentered = digit === focalDigit;
              return (
                <div
                  key={digit}
                  onClick={(e) => handleSlotClick(digit, e)}
                  className="snap-center shrink-0 w-[42px] h-[42px] flex items-center justify-center cursor-pointer transition-all"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-black transition-all ${
                      isCentered
                        ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500 text-slate-950 text-xl shadow-lg ring-2 ring-amber-300 scale-105 active:scale-95'
                        : 'text-slate-400 text-sm hover:text-white hover:bg-slate-800/60 opacity-60 hover:opacity-100 scale-90'
                    }`}
                    title={
                      isCentered
                        ? `Tap to place #${digit}`
                        : `Scroll to #${digit}`
                    }
                  >
                    {digit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimal Clear button if cell already has a filled number */}
        {currentValue > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic([10, 30, 10]);
              onClearCell();
              onClose();
            }}
            className="mt-1 px-2 py-0.5 rounded-full bg-[#090D16]/95 border border-slate-700/90 hover:border-rose-500/80 text-slate-400 hover:text-rose-300 text-[10px] font-mono flex items-center gap-1 shadow-md cursor-pointer transition-colors active:scale-95"
            title="Clear cell"
          >
            <Eraser className="w-2.5 h-2.5" />
            <span>Clear</span>
          </button>
        )}
      </div>
    </div>
  );
};
