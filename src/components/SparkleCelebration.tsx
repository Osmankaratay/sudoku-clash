import React, { useEffect, useState } from 'react';

export interface SparkleEvent {
  id: string;
  type: 'row' | 'col' | 'box';
  index: number; // 0..8 (row index, col index, or box index 0..8)
  timestamp: number;
}

interface SparkleCelebrationProps {
  events: SparkleEvent[];
  onDismiss: (id: string) => void;
}

interface Particle {
  id: number;
  xPct: number;
  yPct: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  dx: number;
  dy: number;
}

export const SparkleCelebration: React.FC<SparkleCelebrationProps> = ({ events, onDismiss }) => {
  if (events.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-35 overflow-hidden">
      {events.map((evt) => (
        <LineSquareSparkles key={evt.id} event={evt} onDone={() => onDismiss(evt.id)} />
      ))}
    </div>
  );
};

const COLORS = ['#F59E0B', '#FBBF24', '#FDE68A', '#38BDF8', '#34D399', '#FFFFFF'];

const LineSquareSparkles: React.FC<{ event: SparkleEvent; onDone: () => void }> = ({ event, onDone }) => {
  const [particles] = useState<Particle[]>(() => {
    const list: Particle[] = [];
    const count = 28;

    for (let i = 0; i < count; i++) {
      let xPct = 0;
      let yPct = 0;

      if (event.type === 'row') {
        // Horizontal line: spanning row across 0..100% X, centered at row Y
        xPct = (i / count) * 94 + 3 + (Math.random() - 0.5) * 6;
        yPct = ((event.index + 0.5) / 9) * 100 + (Math.random() - 0.5) * 6;
      } else if (event.type === 'col') {
        // Vertical line: spanning col across 0..100% Y, centered at col X
        xPct = ((event.index + 0.5) / 9) * 100 + (Math.random() - 0.5) * 6;
        yPct = (i / count) * 94 + 3 + (Math.random() - 0.5) * 6;
      } else {
        // 3x3 Box / Square
        const boxRow = Math.floor(event.index / 3);
        const boxCol = event.index % 3;
        const minX = (boxCol / 3) * 100 + 2;
        const maxX = ((boxCol + 1) / 3) * 100 - 2;
        const minY = (boxRow / 3) * 100 + 2;
        const maxY = ((boxRow + 1) / 3) * 100 - 2;

        xPct = minX + Math.random() * (maxX - minX);
        yPct = minY + Math.random() * (maxY - minY);
      }

      list.push({
        id: i,
        xPct,
        yPct,
        size: 10 + Math.random() * 14,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.25,
        duration: 0.75 + Math.random() * 0.5,
        dx: (Math.random() - 0.5) * 28,
        dy: -18 - Math.random() * 32,
      });
    }

    return list;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      onDone();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  // Determine bounding box for highlight shimmer banner
  let highlightStyle: React.CSSProperties = {};
  if (event.type === 'row') {
    highlightStyle = {
      left: 0,
      width: '100%',
      top: `${(event.index / 9) * 100}%`,
      height: `${(1 / 9) * 100}%`,
    };
  } else if (event.type === 'col') {
    highlightStyle = {
      top: 0,
      height: '100%',
      left: `${(event.index / 9) * 100}%`,
      width: `${(1 / 9) * 100}%`,
    };
  } else {
    const boxRow = Math.floor(event.index / 3);
    const boxCol = event.index % 3;
    highlightStyle = {
      top: `${(boxRow / 3) * 100}%`,
      left: `${(boxCol / 3) * 100}%`,
      width: `${(1 / 3) * 100}%`,
      height: `${(1 / 3) * 100}%`,
    };
  }

  const labelText =
    event.type === 'row'
      ? `Row ${event.index + 1} Cleared!`
      : event.type === 'col'
      ? `Column ${event.index + 1} Cleared!`
      : `Square ${event.index + 1} Cleared!`;

  return (
    <>
      {/* High-visibility glowing line / square shimmer wave */}
      <div
        className="absolute rounded-lg border-2 border-amber-400 bg-amber-400/25 ring-2 ring-amber-300/40 pointer-events-none animate-pulse transition-all"
        style={highlightStyle}
      >
        {/* Shimmer sweep effect */}
        <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-200/40 to-transparent animate-shimmer" />
      </div>

      {/* Floating Sparkle Stars */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute pointer-events-none select-none animate-float-sparkle"
          style={{
            left: `${p.xPct}%`,
            top: `${p.yPct}%`,
            fontSize: `${p.size}px`,
            color: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `translate(${p.dx}px, ${p.dy}px)`,
          }}
        >
          ✦
        </span>
      ))}

      {/* Ephemeral badge badge indicator */}
      <div
        className="absolute pointer-events-none font-mono text-[11px] font-extrabold text-amber-200 bg-slate-950/90 border border-amber-400/80 px-2 py-0.5 rounded-full shadow-lg z-40 transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
        style={{
          left:
            event.type === 'row'
              ? '50%'
              : event.type === 'col'
              ? `${((event.index + 0.5) / 9) * 100}%`
              : `${((event.index % 3 + 0.5) / 3) * 100}%`,
          top:
            event.type === 'row'
              ? `${((event.index + 0.5) / 9) * 100}%`
              : event.type === 'col'
              ? '50%'
              : `${((Math.floor(event.index / 3) + 0.5) / 3) * 100}%`,
        }}
      >
        ✨ {labelText}
      </div>
    </>
  );
};
