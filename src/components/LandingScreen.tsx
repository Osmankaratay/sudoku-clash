import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Plus,
  Users,
  Trophy,
  UserCog,
  LogIn,
  Sparkles,
  KeyRound,
  AlertCircle,
  Zap,
  WifiOff,
  Flame,
  Clock,
  Award,
  CheckCircle2,
  Calendar,
  BarChart3,
  Sliders,
  Eye,
  EyeOff,
  Info,
  HelpCircle,
  Settings,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  DifficultyLevel,
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  UserAccount,
  DailyChallengeInfo,
  DailyStreakState,
} from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { getAvatarById } from '../utils/avatars.ts';
import { loadGamePreferences, UserGamePreferences } from '../utils/gamePreferences.ts';

interface LandingScreenProps {
  playerName: string;
  avatarId: string;
  currentUser: UserAccount | null;
  onOpenSettings?: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onCreateRoom: (
    difficulty: DifficultyLevel,
    feedbackMode?: 'instant' | 'delayed',
    customClues?: number
  ) => void;
  onJoinRoom: (code: string) => void;
  onStartOfflineGame?: (
    difficulty: DifficultyLevel,
    customSeed?: string,
    feedbackMode?: 'instant' | 'delayed',
    customClues?: number
  ) => void;
  onStartDailyChallenge?: () => void;
  onOpenLeaderboard?: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  clearError: () => void;
  isOnline?: boolean;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  playerName,
  avatarId,
  currentUser,
  onOpenSettings,
  onOpenProfile,
  onOpenAuth,
  onCreateRoom,
  onJoinRoom,
  onStartOfflineGame,
  onStartDailyChallenge,
  onOpenLeaderboard,
  isSubmitting,
  errorMessage,
  clearError,
  isOnline = true,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'offline'>(() => (isOnline ? 'create' : 'offline'));
  const [joinCode, setJoinCode] = useState('');
  const [initialDifficulty, setInitialDifficulty] = useState<DifficultyLevel>(() => {
    return loadGamePreferences().defaultDifficulty;
  });
  const [customClues, setCustomClues] = useState<number>(() => {
    return loadGamePreferences().defaultCustomClues;
  });
  const [feedbackMode, setFeedbackMode] = useState<'instant' | 'delayed'>(() => {
    return loadGamePreferences().defaultFeedbackMode;
  });
  const [customSeedInput, setCustomSeedInput] = useState('');

  useEffect(() => {
    const handlePrefsChanged = (e: Event) => {
      const detail = (e as CustomEvent<UserGamePreferences>).detail;
      if (detail) {
        setInitialDifficulty(detail.defaultDifficulty);
        setCustomClues(detail.defaultCustomClues);
        setFeedbackMode(detail.defaultFeedbackMode);
      }
    };
    window.addEventListener('sudoku_preferences_changed', handlePrefsChanged);
    return () => window.removeEventListener('sudoku_preferences_changed', handlePrefsChanged);
  }, []);

  // Daily Challenge & Streak State
  const [dailyInfo, setDailyInfo] = useState<DailyChallengeInfo | null>(null);
  const [dailyStreak, setDailyStreak] = useState<DailyStreakState | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('--h --m --s');
  const [isLoadingDaily, setIsLoadingDaily] = useState<boolean>(true);

  const playerKey = currentUser?.id || localStorage.getItem('nueve_player_key') || playerName.trim() || 'guest';

  useEffect(() => {
    let isMounted = true;
    setIsLoadingDaily(true);

    Promise.all([
      fetch('/api/daily-challenge').then((r) => r.json()),
      fetch(`/api/daily-challenge/streak/${encodeURIComponent(playerKey)}`).then((r) => r.json()),
    ])
      .then(([dailyRes, streakRes]) => {
        if (!isMounted) return;
        if (dailyRes.ok && dailyRes.challenge) {
          setDailyInfo(dailyRes.challenge);
        }
        if (streakRes.ok && streakRes.streak) {
          setDailyStreak(streakRes.streak);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingDaily(false);
      });

    return () => {
      isMounted = false;
    };
  }, [playerKey]);

  useEffect(() => {
    function formatCountdown(ms: number): string {
      if (ms <= 0) return '00h 00m 00s';
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }

    const updateCountdown = () => {
      const expiresAt = dailyInfo?.expiresAt || new Date().setUTCHours(24, 0, 0, 0);
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeftStr(formatCountdown(remaining));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [dailyInfo?.expiresAt]);

  const isTodayCompleted = Boolean(
    dailyInfo && dailyStreak?.lastCompletedDateKey === dailyInfo.dateKey
  );
  const currentStreakCount = dailyStreak?.currentStreak || 0;
  const bestStreakCount = dailyStreak?.bestStreak || 0;
  const hasCommittedBadge = Boolean(dailyStreak?.badges?.includes('committed') || currentStreakCount >= 1);
  const hasDailyMasterBadge = Boolean(dailyStreak?.badges?.includes('daily-master'));

  // 7-day Daily Challenge completion tracker for Recharts bar chart
  const last7DaysData = useMemo(() => {
    const list = [];
    const historyList = dailyStreak?.history || [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;
      const isToday = i === 0;

      const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const fullDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

      const entry = historyList.find((h) => h.dateKey === dateKey);

      let isCompleted = false;
      let scoreVal = 0;
      let finishTime = entry?.finishTimeMs || null;
      let rank = entry?.rank || null;

      if (entry) {
        isCompleted = true;
        scoreVal = typeof entry.score === 'number' ? Math.round(entry.score) : 100;
      } else if (isToday && isTodayCompleted) {
        isCompleted = true;
        scoreVal = 100;
      } else if (currentStreakCount > 0) {
        // If within consecutive active streak sequence
        const streakOffset = isTodayCompleted ? i : i - 1;
        if (streakOffset >= 0 && streakOffset < currentStreakCount) {
          isCompleted = true;
          scoreVal = 95;
        }
      }

      list.push({
        dateKey,
        dayLabel,
        fullDate,
        isToday,
        isCompleted,
        // Chart value: display height for completed days (at least 35% height for visual clarity)
        score: isCompleted ? Math.max(scoreVal, 35) : 0,
        actualScore: isCompleted ? scoreVal : 0,
        finishTime,
        rank,
      });
    }
    return list;
  }, [dailyStreak, isTodayCompleted, currentStreakCount]);

  const completedDaysCount = useMemo(
    () => last7DaysData.filter((d) => d.isCompleted).length,
    [last7DaysData]
  );

  const avatar = getAvatarById(avatarId);

  const renderDifficultyPicker = (isOffline = false) => {
    const activeCfg = DIFFICULTY_CONFIG[initialDifficulty];
    const currentClues = initialDifficulty === 'Custom' ? customClues : activeCfg.clues;
    const currentEmpty = initialDifficulty === 'Custom' ? 81 - customClues : activeCfg.emptyCells;

    return (
      <div className="space-y-4">
        {/* Difficulty Level Header & Clue summary */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span>{isOffline ? 'Alıştırma Zorluğu' : 'Zorluk Seviyesi'}</span>
            <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">
              (Ayrıntılar için üzerine gelin)
            </span>
          </span>
          <span className="font-mono text-amber-400 text-[11px] font-semibold">
            {currentClues} İpucu · {currentEmpty} Boş
          </span>
        </div>

        {/* Difficulty Buttons Grid with Rich Tooltips */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
          {DIFFICULTY_LEVELS.map((level, idx) => {
            const active = initialDifficulty === level;
            const cfg = DIFFICULTY_CONFIG[level];
            const cluesDisplay = level === 'Custom' ? customClues : cfg.clues;
            const emptyDisplay = level === 'Custom' ? 81 - customClues : cfg.emptyCells;

            const tooltipAlign =
              idx === 0
                ? 'left-0 translate-x-0'
                : idx >= DIFFICULTY_LEVELS.length - 2
                ? 'right-0 left-auto translate-x-0'
                : 'left-1/2 -translate-x-1/2';
            const arrowAlign =
              idx === 0
                ? 'left-6'
                : idx >= DIFFICULTY_LEVELS.length - 2
                ? 'right-6 left-auto'
                : 'left-1/2 -translate-x-1/2';

            return (
              <div key={level} className="relative group">
                <button
                  type="button"
                  onClick={() => setInitialDifficulty(level)}
                  className={`w-full min-h-[46px] py-1.5 px-1 text-xs font-semibold rounded-lg transition-all truncate cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-2 ring-amber-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                  title={`${level}: ${cluesDisplay} ipucu, ${cfg.expectedTime} ortalama süre`}
                  aria-label={`${level} zorluk seviyesi: ${cluesDisplay} ipucu, ortalama ${cfg.expectedTime}`}
                >
                  <span className="truncate leading-tight">{level}</span>
                  <span
                    className={`text-[10px] font-mono leading-none ${
                      active ? 'text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {cluesDisplay} ipucu
                  </span>
                </button>

                {/* Floating Interactive Tooltip */}
                <div
                  className={`absolute bottom-full mb-2 hidden group-hover:flex flex-col w-60 p-2.5 bg-[#0e1626] border border-amber-500/50 rounded-xl shadow-2xl shadow-black/90 text-left z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${tooltipAlign}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1 border-b border-slate-800 pb-1">
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-1">
                      {level === 'Custom' && <Sliders className="w-3 h-3 text-amber-400" />}
                      <span>{level} Seviyesi</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      {cfg.expectedTime}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-mono mb-1.5 text-slate-300">
                    <div>
                      <span className="text-slate-500">İpucu:</span>{' '}
                      <strong className="text-amber-300">{cluesDisplay}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Boş Hücre:</span>{' '}
                      <strong className="text-slate-200">{emptyDisplay}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">{cfg.description}</p>
                  <div
                    className={`absolute -bottom-1 w-2 h-2 bg-[#0e1626] border-r border-b border-amber-500/50 rotate-45 ${arrowAlign}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Difficulty Details Card */}
        <div className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{initialDifficulty} Seviyesi Detayları</span>
            </span>
            <span className="font-mono text-emerald-400 text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Ortalama Süre: <strong>{activeCfg.expectedTime}</strong></span>
            </span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">{activeCfg.description}</p>

          {/* Custom Difficulty Slider & Controls */}
          {initialDifficulty === 'Custom' && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor={isOffline ? 'offline-custom-clues-slider' : 'online-custom-clues-slider'}
                  className="font-semibold text-amber-300 flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Özel İpucu Sayısı (Verilen Rakamlar):</span>
                </label>
                <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  {customClues} İpucu
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-rose-400 shrink-0 font-semibold">17 (En Zor)</span>
                <input
                  id={isOffline ? 'offline-custom-clues-slider' : 'online-custom-clues-slider'}
                  type="range"
                  min={17}
                  max={65}
                  value={customClues}
                  onChange={(e) => setCustomClues(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <span className="text-[11px] font-mono text-emerald-400 shrink-0 font-semibold">65 (Kolay)</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Boş Hücre: <strong className="text-slate-200 font-mono">{81 - customClues}</strong>
                </span>
                <span>
                  Tahmini Zorluk:{' '}
                  <strong className="text-amber-300 font-semibold">
                    {customClues <= 24
                      ? '👑 Pro / Grandmaster'
                      : customClues <= 32
                      ? '⚡ Expert'
                      : customClues <= 40
                      ? '🎯 Hard'
                      : customClues <= 48
                      ? '⚖️ Medium'
                      : '🟢 Easy'}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Validation Mode Selector: Instant Feedback vs Delayed / Self-Check Mode */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Doğrulama & Bildirim Modu</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {feedbackMode === 'instant' ? '⚡ Anında Kontrol' : '📝 Sınav / Kendi Kendine'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Mode 1: Instant Feedback */}
            <button
              type="button"
              onClick={() => setFeedbackMode('instant')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                feedbackMode === 'instant'
                  ? 'bg-amber-500/15 border-amber-400/80 ring-1 ring-amber-400/40 text-slate-100 shadow-sm'
                  : 'bg-[#0B0F17] border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  feedbackMode === 'instant'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-200 flex items-center gap-1">
                  <span>Anında Doğrulama</span>
                  {feedbackMode === 'instant' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Her hamlede sayının doğruluğu anında onaylanır veya hata bildirilir.
                </div>
              </div>
            </button>

            {/* Mode 2: Delayed / Self-Checking Mode */}
            <button
              type="button"
              onClick={() => setFeedbackMode('delayed')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                feedbackMode === 'delayed'
                  ? 'bg-purple-500/15 border-purple-400/80 ring-1 ring-purple-400/40 text-slate-100 shadow-sm'
                  : 'bg-[#0B0F17] border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  feedbackMode === 'delayed'
                    ? 'bg-purple-500 text-white font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-200 flex items-center gap-1">
                  <span>Sınav / Kendi Kendine Mod</span>
                  {feedbackMode === 'delayed' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Hamlelere anında onay veya hata verilmez. Sonucu tahtayı bitirdiğinizde kendiniz görürsünüz!
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || isSubmitting) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(cleaned);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-10 space-y-4 sm:space-y-6">
      {/* Player Identity Card */}
      <div className="bg-[#131B2E] border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 shadow-lg">
        <div
          onClick={currentUser ? onOpenProfile : onOpenAuth}
          className="flex items-center gap-3 sm:gap-3.5 min-w-0 cursor-pointer group"
          title="Manage player profile"
        >
          <AvatarBadge avatarId={avatarId} size="md" />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-100 flex items-center gap-2 truncate group-hover:text-amber-300 transition-colors">
              <span className="truncate">{playerName}</span>
              {currentUser && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40 shrink-0">
                  ACCOUNT
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono truncate">
              {avatar.name}
              {currentUser && ` · ${currentUser.stats.gamesWon}W / ${currentUser.stats.gamesPlayed}P`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserCog className="w-3.5 h-3.5 text-amber-400" />
              <span>Profile</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* DAILY CHALLENGE & STREAK SECTION (Minimized with Recharts 7-Day Completion Tracker) */}
      <div className="bg-[#131B2E] border-2 border-amber-500/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_24px_rgba(245,158,11,0.12)] space-y-3 relative overflow-hidden">
        {/* Minimized Glow Accent Header */}
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/30 shrink-0">
              <Flame className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-slate-100 tracking-tight uppercase">
                  Daily Challenge
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/40 shrink-0">
                  24H
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800/90 text-slate-300 font-mono text-[9px] border border-slate-700 shrink-0">
                  {dailyInfo?.difficulty || 'Expert'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Global Master Board · {dailyInfo?.totalEmptyCells || 54} empty cells
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-400/40 text-orange-300 font-mono text-[11px] font-black">
              <Flame className="w-3 h-3 fill-current" />
              <span>{currentStreakCount}d Streak</span>
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400/90 bg-[#0B0F17] px-1.5 py-0.5 rounded-md border border-slate-800"
              title="Next Board Refresh Countdown"
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>{timeLeftStr}</span>
            </span>
          </div>
        </div>

        {/* 7-Day Completion Recharts Bar Chart Tracker */}
        <div className="bg-[#0B0F17] rounded-xl p-3 border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Last 7 Days Challenge History</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Record: <strong className="text-amber-300">{completedDaysCount}/7 Completed</strong> (Best: <strong className="text-amber-300">{bestStreakCount}d</strong>)
            </span>
          </div>

          {/* Recharts Bar Chart */}
          <div className="w-full h-28 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="dayLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#475569"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickCount={3}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#0B0F17] border border-amber-500/40 p-2 rounded-lg shadow-2xl text-[11px] space-y-1">
                        <div className="font-semibold text-slate-200 flex items-center justify-between gap-3">
                          <span>{d.fullDate} ({d.dayLabel})</span>
                          {d.isCompleted ? (
                            <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/40">
                              ✓ Done
                            </span>
                          ) : d.isToday ? (
                            <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40">
                              Today (Pending)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Missed</span>
                          )}
                        </div>
                        {d.isCompleted && (
                          <div className="text-[10px] text-slate-300 font-mono">
                            Score: <strong className="text-amber-300">{d.actualScore} pts</strong>
                            {d.rank ? ` · Rank #${d.rank}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {last7DaysData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.isCompleted
                          ? entry.isToday
                            ? '#f59e0b'
                            : '#d97706'
                          : entry.isToday
                          ? '#334155'
                          : '#1e293b'
                      }
                      stroke={
                        entry.isCompleted
                          ? '#fbbf24'
                          : entry.isToday
                          ? '#f59e0b'
                          : '#334155'
                      }
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {isTodayCompleted && (
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Today's Daily Challenge completed! Streak is locked in.</span>
            </div>
          )}
        </div>

        {/* Minimized Rewarded Badges: 'Committed' & 'Daily Master' */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div
            className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
              hasCommittedBadge
                ? 'bg-sky-500/10 border-sky-400/50 text-sky-200'
                : 'bg-[#0B0F17] border-slate-800 text-slate-400'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                hasCommittedBadge ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[11px] flex items-center gap-1 truncate">
                <span className={hasCommittedBadge ? 'text-sky-300' : 'text-slate-300'}>
                  'Committed'
                </span>
                {hasCommittedBadge && (
                  <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 shrink-0">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 truncate">Daily streak badge</p>
            </div>
          </div>

          <div
            className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
              hasDailyMasterBadge
                ? 'bg-amber-500/10 border-amber-400/50 text-amber-200'
                : 'bg-[#0B0F17] border-slate-800 text-slate-400'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                hasDailyMasterBadge ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Award className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[11px] flex items-center gap-1 truncate">
                <span className={hasDailyMasterBadge ? 'text-amber-300' : 'text-slate-300'}>
                  'Daily Master'
                </span>
                {hasDailyMasterBadge && (
                  <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0">
                    TOP 3
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 truncate">Top 3 daily rank</p>
            </div>
          </div>
        </div>

        {/* Play Daily Challenge Action Button */}
        <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onStartDailyChallenge}
            className={`flex-1 min-h-[42px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] ${
              isTodayCompleted
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/30 ring-2 ring-amber-400/40'
            }`}
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>
              {isTodayCompleted
                ? "Replay Today's Daily Challenge"
                : `Play Daily Challenge (${dailyInfo?.difficulty || 'Expert'})`}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-2.5 px-3 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="View Daily Challenge Leaderboard & Badges"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Leaderboard</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Clean Matchmaking Container: Generating Room vs Joining Group Tabs */}
      <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-7 shadow-xl space-y-5 sm:space-y-6">
        {/* Tab Toggle */}
        <div className="flex items-center p-1 bg-[#0B0F17] rounded-xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              clearError();
            }}
            className={`flex-1 min-h-[42px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="truncate">Create Room</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('join');
              clearError();
            }}
            className={`flex-1 min-h-[42px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'join'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">Join Group</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('offline');
              clearError();
            }}
            className={`flex-1 min-h-[42px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'offline'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="truncate">Offline Mode</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="text-xs font-medium text-rose-300 hover:text-white underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: GENERATE ROOM */}
        {activeTab === 'create' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {renderDifficultyPicker(false)}

            {/* Create Room Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                onCreateRoom(
                  initialDifficulty,
                  feedbackMode,
                  initialDifficulty === 'Custom' ? customClues : undefined
                )
              }
              className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-[0.99]"
            >
              <span>{isSubmitting ? 'Creating Room...' : 'Create Room & Generate Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 2: JOIN GROUP / ROOM */}
        {activeTab === 'join' && (
          <form
            onSubmit={handleJoinSubmit}
            className="space-y-4 animate-in fade-in duration-150"
          >
            <div>
              <label
                htmlFor="join-room-code-input"
                className="block text-xs font-semibold text-slate-300 mb-2"
              >
                Enter 6-Character Room Code
              </label>
              <div className="relative">
                <input
                  id="join-room-code-input"
                  type="text"
                  value={joinCode}
                  onChange={handleCodeChange}
                  placeholder="E.G. K7X9M2"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full px-4 py-3 sm:py-3.5 bg-[#0B0F17] border border-slate-800 focus:border-amber-400 rounded-xl font-mono text-lg sm:text-xl tracking-[0.22em] sm:tracking-[0.3em] uppercase text-slate-100 placeholder-slate-600 focus:outline-none transition-colors text-center"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                  {joinCode.length}/6
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={joinCode.length !== 6 || isSubmitting}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-[0.99]"
            >
              <span>{isSubmitting ? 'Joining Room...' : 'Join Group'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* TAB 3: OFFLINE SOLO MODE */}
        {activeTab === 'offline' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {renderDifficultyPicker(true)}

            {/* Reversible Deterministic Seed Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="offline-custom-seed-input" className="font-semibold text-slate-300">
                  Tohum / Puzzle Seed (İsteğe Bağlı)
                </label>
                <span className="font-mono text-[10px] text-amber-400">
                  Tersinir & Deterministik
                </span>
              </div>
              <div className="relative">
                <input
                  id="offline-custom-seed-input"
                  type="text"
                  value={customSeedInput}
                  onChange={(e) => setCustomSeedInput(e.target.value.toUpperCase())}
                  placeholder="Örn: SDK-21A3964DBA veya rastgele için boş bırakın"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-3.5 py-2.5 bg-[#0B0F17] border border-slate-800 focus:border-amber-400 rounded-xl font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />
                {customSeedInput && (
                  <button
                    type="button"
                    onClick={() => setCustomSeedInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer px-1 py-0.5 rounded bg-slate-800/80"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Verilen bir seed değerinden (örn. <code className="text-amber-300 font-mono">SDK-21A3964DBA</code>) her zaman birebir aynı tahta kurulur.
              </p>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                onStartOfflineGame &&
                onStartOfflineGame(
                  initialDifficulty,
                  customSeedInput.trim() || undefined,
                  feedbackMode,
                  initialDifficulty === 'Custom' ? customClues : undefined
                )
              }
              className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/25 active:scale-[0.99]"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {customSeedInput.trim()
                  ? `Start Match with Seed (${customSeedInput.trim().slice(0, 14)})`
                  : 'Start Offline Match (No Internet Needed)'}
              </span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Android & Mobile PWA App Card */}
      <PWAInstallButton variant="card" />

      {/* Action Row: Leaderboard & Game Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {onOpenLeaderboard && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="w-full py-2.5 px-4 rounded-xl bg-[#131B2E] hover:bg-[#18233C] border border-slate-800 text-xs font-semibold text-slate-300 hover:text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Küresel Sıralamalar</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 px-4 rounded-xl bg-[#131B2E] hover:bg-[#18233C] border border-slate-800 text-xs font-semibold text-slate-300 hover:text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Oyun Ayarları & Kurallar</span>
          </button>
        )}
      </div>
    </div>
  );
};
