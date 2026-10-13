import React, { useState, useEffect, useRef } from 'react';
import { Flame, Zap, Sparkles, AlertTriangle, Crown, Award } from 'lucide-react';
import { COMBO_WINDOW_SECONDS } from '../sudokuEngine.ts';

interface ComboStreakMultiplierWidgetProps {
  comboStreak: number;
  comboMultiplier: number;
  lastMoveTimestamp: number | null;
  onExpire?: () => void;
  className?: string;
}

export const ComboStreakMultiplierWidget: React.FC<ComboStreakMultiplierWidgetProps> = ({
  comboStreak,
  comboMultiplier,
  lastMoveTimestamp,
  onExpire,
  className = '',
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const [pulseKey, setPulseKey] = useState<number>(0);
  const prevStreakRef = useRef<number>(comboStreak);

  // Trigger pulse animations on streak increase or detect streak break
  useEffect(() => {
    if (comboStreak > prevStreakRef.current && comboStreak > 1) {
      setPulseKey((k) => k + 1);
      setIsBroken(false);
    } else if (comboStreak === 0 && prevStreakRef.current > 1) {
      setIsBroken(true);
      const t = setTimeout(() => setIsBroken(false), 1400);
      return () => clearTimeout(t);
    }
    prevStreakRef.current = comboStreak;
  }, [comboStreak]);

  // Real-time smooth timer countdown (60fps interval loop)
  useEffect(() => {
    if (!lastMoveTimestamp || comboStreak <= 0) {
      setRemainingSeconds(0);
      return;
    }

    let animationFrameId: number;
    let expiredNotified = false;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = (now - lastMoveTimestamp) / 1000;
      const left = Math.max(0, COMBO_WINDOW_SECONDS - elapsed);

      setRemainingSeconds(left);

      if (left > 0) {
        animationFrameId = requestAnimationFrame(updateTimer);
      } else if (!expiredNotified) {
        expiredNotified = true;
        onExpire?.();
      }
    };

    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [lastMoveTimestamp, comboStreak, onExpire]);

  const percentage = Math.max(0, Math.min(100, (remainingSeconds / COMBO_WINDOW_SECONDS) * 100));
  const isWindowActive = lastMoveTimestamp !== null && remainingSeconds > 0;
  const isActive = (comboStreak > 1 || (comboStreak === 1 && isWindowActive)) && remainingSeconds > 0;
  const isUrgent = isWindowActive && remainingSeconds < 1.6;

  // Streak Tier Details & Flavor text
  let tierName = 'Hazır';
  let tierColor = 'text-slate-400';
  let glowBorder = 'border-slate-800/80';
  let bgGradient = 'from-slate-900/40 via-[#131B2E] to-slate-900/40';

  if (comboStreak >= 5) {
    tierName = '👑 MAKS SERİ (5x) • MAKS LÜMİNOSİTE!';
    tierColor = 'text-amber-300';
    glowBorder = 'border-amber-400/80 shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/40';
    bgGradient = 'from-amber-950/70 via-emerald-950/50 to-[#131B2E]';
  } else if (comboStreak === 4) {
    tierName = '💥 MEGA SERİ!';
    tierColor = 'text-orange-300';
    glowBorder = 'border-orange-500/50 shadow-md shadow-orange-500/15';
    bgGradient = 'from-orange-950/50 via-[#131B2E] to-[#131B2E]';
  } else if (comboStreak === 3) {
    tierName = '⚡ SÜPER SERİ!';
    tierColor = 'text-sky-300';
    glowBorder = 'border-sky-500/40 shadow-sm shadow-sky-500/10';
    bgGradient = 'from-sky-950/40 via-[#131B2E] to-[#131B2E]';
  } else if (comboStreak === 2) {
    tierName = '🔥 ÇİFTE SERİ!';
    tierColor = 'text-amber-400';
    glowBorder = 'border-amber-500/40';
    bgGradient = 'from-amber-950/30 via-[#131B2E] to-[#131B2E]';
  } else if (comboStreak === 1 && isWindowActive) {
    tierName = '⚡ İLK HAMLE! (Kombo Fırsatı)';
    tierColor = 'text-emerald-400';
    glowBorder = 'border-emerald-500/40';
    bgGradient = 'from-emerald-950/30 via-[#131B2E] to-[#131B2E]';
  }

  // Next level multiplier target preview (Max combo is 5)
  let nextMultiplierPreview = '1.25x (+%25)';
  if (comboStreak <= 1) nextMultiplierPreview = '1.25x (+%25)';
  else if (comboStreak === 2) nextMultiplierPreview = '1.50x (+%50)';
  else if (comboStreak === 3) nextMultiplierPreview = '1.85x (+%85)';
  else if (comboStreak === 4) nextMultiplierPreview = '2.50x (MAKS)';
  else if (comboStreak >= 5) nextMultiplierPreview = 'MAKS SERİ (5/5)';

  return (
    <div
      className={`w-full max-w-[min(96vw,calc(100dvh-260px),480px)] select-none transition-all duration-200 ${className}`}
      aria-label="Combo Streak Multiplier Gauge"
    >
      <div
        className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${bgGradient} ${
          isBroken
            ? 'border-rose-500/50 bg-rose-950/30 animate-shake'
            : isActive
            ? glowBorder
            : 'border-slate-800/80 bg-[#131B2E]/90'
        } p-2 sm:p-2.5 transition-all duration-150`}
      >
        {/* Background Energy Pulse on Streak Increment */}
        {isActive && (
          <div
            key={pulseKey}
            className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-transparent pointer-events-none animate-in fade-in duration-300"
          />
        )}

        {/* Top Row: Multiplier Banner & Tier Header */}
        <div className="relative flex items-center justify-between gap-2 z-10">
          {/* Left: Flame Icon + Multiplier */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-transform ${
                isActive
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-600/30 scale-105'
                  : isBroken
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isActive ? (
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200 animate-pulse" />
              ) : isBroken ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : (
                <Zap className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  {comboMultiplier.toFixed(2)}x
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Çarpan
                </span>
              </div>
              <div className="text-[10px] font-bold tracking-wide flex items-center gap-1">
                {isBroken ? (
                  <span className="text-rose-400 font-extrabold animate-pulse">SERİ KIRILDI!</span>
                ) : (
                  <span className={tierColor}>{tierName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Streak Counter Badge & Next Preview */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {isActive && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black font-mono text-xs sm:text-sm animate-pulse">
                  {comboStreak >= 5 ? '5x MAKS SERİ' : `${comboStreak}x SERİ`}
                </span>
              )}
              {!isActive && !isBroken && (
                <span className="text-[11px] font-mono text-slate-400">
                  Hızlı Çözüm: Seri Başlat
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {isActive ? (
                <span>
                  Sonraki: <strong className="text-amber-300">{nextMultiplierPreview}</strong>
                </span>
              ) : (
                <span className="text-slate-500">Pencere: 5.0s</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Dynamic Smooth Depletion Progress Bar */}
        <div className="relative mt-2">
          {/* Track Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800/80">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                isBroken
                  ? 'bg-rose-500 w-0 transition-none'
                  : isUrgent
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse'
                  : comboStreak >= 5
                  ? 'bg-gradient-to-r from-purple-500 via-amber-400 to-orange-500'
                  : comboStreak >= 3
                  ? 'bg-gradient-to-r from-sky-400 via-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Sub-label with precise remaining time countdown */}
          <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-400 leading-none">
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              <span>
                {isActive
                  ? isUrgent
                    ? '⚠️ Acele et!'
                    : 'Seriyi koru'
                  : 'Hızlı doğru hamlelerle çarpanı katla'}
              </span>
            </span>

            <span
              className={`font-bold tabular-nums ${
                isUrgent
                  ? 'text-rose-400 animate-pulse text-[11px]'
                  : isActive
                  ? 'text-amber-300'
                  : 'text-slate-500'
              }`}
            >
              {remainingSeconds > 0 ? `${remainingSeconds.toFixed(1)}s` : '0.0s'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
