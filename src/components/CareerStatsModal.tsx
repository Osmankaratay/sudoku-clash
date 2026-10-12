import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Clock,
  Target,
  BarChart3,
  Award,
  TrendingUp,
  X,
  RotateCw,
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Gamepad2,
  Layers,
} from 'lucide-react';
import {
  DetailedCareerStats,
  DifficultyLevel,
  UserAccount,
} from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface CareerStatsModalProps {
  currentUser: UserAccount | null;
  authToken: string | null;
  onClose: () => void;
  onOpenAuth?: () => void;
}

export function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}.${tenths}s`;
}

export function formatShortDate(timestamp: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CareerStatsModal: React.FC<CareerStatsModalProps> = ({
  currentUser,
  authToken,
  onClose,
  onOpenAuth,
}) => {
  const [stats, setStats] = useState<DetailedCareerStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'difficulties' | 'history'>('overview');

  const fetchStats = async () => {
    if (!authToken || !currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/career-stats', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.ok && data.stats) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to load career statistics.');
      }
    } catch {
      setError('Network error while retrieving career statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [authToken, currentUser]);

  const difficultyList: DifficultyLevel[] = [
    'Easy',
    'Medium',
    'Hard',
    'Very Hard',
    'Expert',
    'Pro',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#131B2E] border border-slate-800 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-slate-800 flex items-center justify-between gap-3 sm:gap-4 bg-[#0B0F17]/70">
          <div className="flex items-center gap-3 min-w-0">
            {currentUser ? (
              <AvatarBadge avatarId={currentUser.avatarId} size="md" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-xl font-bold text-slate-100 truncate">
                  {currentUser?.username || 'Guest Player'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden xs:inline">Career Stats</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">
                  {currentUser?.createdAt
                    ? `Member since ${new Date(currentUser.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Sudoku Competitive Record'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {currentUser && (
              <button
                type="button"
                onClick={fetchStats}
                disabled={loading}
                className="p-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Refresh Statistics"
                aria-label="Refresh Statistics"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Close modal"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guest Banner if Unauthenticated */}
        {!currentUser && (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-slate-100">
                Permanent Career Tracking
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Log in or create a free player profile to track your total games played, real win
                rate, average completion time, and difficulty mastery curves.
              </p>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer shadow-lg shadow-amber-950"
              >
                Sign In / Create Account
              </button>
            )}
          </div>
        )}

        {/* Authenticated View */}
        {currentUser && (
          <>
            {/* Tab Navigation Switcher */}
            <div className="px-5 sm:px-6 pt-3 flex items-center gap-2 border-b border-slate-800/80 bg-[#0E1524]">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('difficulties')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'difficulties'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Difficulty Mastery</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Match History</span>
                {stats?.recentMatches && stats.recentMatches.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {stats.recentMatches.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {loading && !stats ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                  <RotateCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Calculating career statistics...</span>
                </div>
              ) : error ? (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : stats ? (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === 'overview' && (
                    <div className="space-y-5">
                      {/* Top 4 Key Performance Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                        {/* 1. Games Played */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                              Matches
                            </span>
                            <Gamepad2 className="w-4 h-4 text-sky-400" />
                          </div>
                          <div className="text-xl sm:text-2xl font-mono font-bold text-slate-100">
                            {stats.gamesPlayed}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Won:{' '}
                            <strong className="text-emerald-400 font-mono font-semibold">
                              {stats.gamesWon}
                            </strong>
                          </div>
                        </div>

                        {/* 2. Win Rate */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                              Win Rate
                            </span>
                            <Award className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400">
                            {stats.winRate.toFixed(1)}%
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, stats.winRate))}%` }}
                            />
                          </div>
                        </div>

                        {/* 3. Average Time-to-Completion */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                              Avg Time
                            </span>
                            <Clock className="w-4 h-4 text-sky-400" />
                          </div>
                          <div className="text-base sm:text-xl font-mono font-bold text-slate-100">
                            {stats.averageTimeMs ? formatDurationMs(stats.averageTimeMs) : '--:--'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            To completion
                          </div>
                        </div>

                        {/* 4. Fastest Completion */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                              Best Time
                            </span>
                            <Zap className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-base sm:text-xl font-mono font-bold text-emerald-400">
                            {stats.bestFinishTimeMs
                              ? formatDurationMs(stats.bestFinishTimeMs)
                              : '--:--'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Fastest solve
                          </div>
                        </div>
                      </div>

                      {/* Secondary Detailed Performance Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Win Streaks */}
                        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                            <Flame className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-400">
                              Winning Streaks
                            </div>
                            <div className="text-base font-bold text-slate-100">
                              Current: <span className="font-mono text-orange-400">{stats.currentStreak}</span> · Best:{' '}
                              <span className="font-mono text-orange-300">{stats.bestStreak}</span>
                            </div>
                          </div>
                        </div>

                        {/* Score Performance */}
                        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-400">
                              Score Performance
                            </div>
                            <div className="text-base font-bold text-slate-100">
                              Best: <span className="font-mono text-amber-400">{stats.bestScore}</span> · Avg:{' '}
                              <span className="font-mono text-slate-300">{stats.averageScore}</span>
                            </div>
                          </div>
                        </div>

                        {/* Precision & Mistakes */}
                        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                            <Target className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-400">
                              Accuracy & Errors
                            </div>
                            <div className="text-base font-bold text-slate-100">
                              Total: <span className="font-mono text-rose-400">{stats.totalMistakes}</span> · Avg:{' '}
                              <span className="font-mono text-slate-300">{stats.averageMistakesPerGame}/game</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Career Highlights Note */}
                      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Your career statistics are verified and calculated after every official match
                          against competitors and AI bots. Win rate and time-to-completion reflect solved
                          grids from start to finish.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DIFFICULTY MASTERY */}
                  {activeTab === 'difficulties' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {difficultyList.map((diff) => {
                          const diffData = stats.difficultyStats[diff];
                          const played = diffData?.played || 0;
                          const won = diffData?.won || 0;
                          const rate = played > 0 ? (won / played) * 100 : 0;
                          const bestTime = diffData?.bestTimeMs;

                          return (
                            <div
                              key={diff}
                              className="p-4 rounded-2xl bg-[#0B0F17] border border-slate-800 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-200">{diff}</span>
                                <span className="font-mono text-xs text-amber-400 font-bold">
                                  {rate.toFixed(0)}% Win Rate
                                </span>
                              </div>

                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-amber-400 h-full rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-800/60">
                                <div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                    Played
                                  </div>
                                  <div className="font-mono font-bold text-slate-200 mt-0.5">
                                    {played}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                    Won
                                  </div>
                                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                                    {won}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                    Best Time
                                  </div>
                                  <div className="font-mono font-bold text-sky-300 mt-0.5">
                                    {bestTime ? formatDurationMs(bestTime) : '--'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: MATCH HISTORY */}
                  {activeTab === 'history' && (
                    <div className="space-y-3">
                      {stats.recentMatches.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs bg-[#0B0F17] rounded-2xl border border-slate-800 space-y-2">
                          <Gamepad2 className="w-6 h-6 text-slate-600 mx-auto" />
                          <div className="font-semibold text-slate-300">No match records yet</div>
                          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                            Complete a multiplayer or bot practice Sudoku match to start logging match
                            timelines and ranks!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stats.recentMatches.map((m) => {
                            const isWin = m.rank === 1;
                            const isPodium = m.rank <= 3;

                            return (
                              <div
                                key={m.id}
                                className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 border ${
                                      isWin
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                                        : isPodium
                                        ? 'bg-slate-700/30 border-slate-600 text-slate-200'
                                        : 'bg-slate-800/20 border-slate-800 text-slate-500'
                                    }`}
                                  >
                                    #{m.rank}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-xs text-slate-200 truncate">
                                        {m.difficulty}
                                      </span>
                                      <span className="text-[10px] text-slate-500">·</span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {formatShortDate(m.timestamp)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                                      <span>Time: {formatDurationMs(m.finishTimeMs)}</span>
                                      <span>·</span>
                                      <span>Err: {m.mistakes}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="font-mono text-sm font-bold text-emerald-400">
                                    +{m.score} pts
                                  </div>
                                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                                    {isWin ? 'Victory' : isPodium ? 'Podium' : 'Finished'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-800 bg-[#0B0F17]/50 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Sudoku Engine v2.4 · Real-time Skill Matrix
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
