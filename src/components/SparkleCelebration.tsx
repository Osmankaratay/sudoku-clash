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

interface GlitterParticle {
  id: number;
  symbol: string;
  xPct: number;
  yPct: number;
  size: number;
  color: string;
  delay: number;
}

/**
 * Pure short-time glitter:
 * Replaces celebration effects, banners, badges, and boxes with subtle,
 * elegant twinkling micro-glitter (strictly under 0.4s) that keeps the
 * Sudoku grid completely clean and easy to read.
 */
export const SparkleCelebration: React.FC<SparkleCelebrationProps> = ({ events, onDismiss }) => {
  if (events.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {events.map((evt) => (
        <ShortGlitterLine key={evt.id} event={evt} onDone={() => onDismiss(evt.id)} />
      ))}
    </div>
  );
};

const GLITTER_COLORS = ['#FBBF24', '#FDE68A', '#FEF08A', '#FFFFFF', '#BAE6FD'];
const GLITTER_SYMBOLS = ['✦', '✧', '•'];

const ShortGlitterLine: React.FC<{ event: SparkleEvent; onDone: () => void }> = ({ event, onDone }) => {
  const [particles] = useState<GlitterParticle[]>(() => {
    const list: GlitterParticle[] = [];
    const count = 18; // Clean, non-cluttering particle count

    for (let i = 0; i < count; i++) {
      let xPct = 0;
      let yPct = 0;

      if (event.type === 'row') {
        xPct = (i / count) * 94 + 3 + (Math.random() - 0.5) * 4;
        yPct = ((event.index + 0.5) / 9) * 100 + (Math.random() - 0.5) * 4;
      } else if (event.type === 'col') {
        xPct = ((event.index + 0.5) / 9) * 100 + (Math.random() - 0.5) * 4;
        yPct = (i / count) * 94 + 3 + (Math.random() - 0.5) * 4;
      } else {
        const boxRow = Math.floor(event.index / 3);
        const boxCol = event.index % 3;
        const minX = (boxCol / 3) * 100 + 3;
        const maxX = ((boxCol + 1) / 3) * 100 - 3;
        const minY = (boxRow / 3) * 100 + 3;
        const maxY = ((boxRow + 1) / 3) * 100 - 3;

        xPct = minX + Math.random() * (maxX - minX);
        yPct = minY + Math.random() * (maxY - minY);
      }

      list.push({
        id: i,
        symbol: GLITTER_SYMBOLS[i % GLITTER_SYMBOLS.length],
        xPct,
        yPct,
        size: 3 + Math.random() * 3.5, // Tiny 3px-6.5px subtle glitter
        color: GLITTER_COLORS[Math.floor(Math.random() * GLITTER_COLORS.length)],
        delay: Math.random() * 0.05,
      });
    }

    return list;
  });

  useEffect(() => {
    // Short time glitter: clears in 380ms so the game board remains clean and legible
    const timer = setTimeout(() => {
      onDone();
    }, 380);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute pointer-events-none select-none animate-glitter leading-none"
          style={{
            left: `${p.xPct}%`,
            top: `${p.yPct}%`,
            fontSize: `${p.size}px`,
            color: p.color,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.symbol}
        </span>
      ))}
    </>
  );
};
