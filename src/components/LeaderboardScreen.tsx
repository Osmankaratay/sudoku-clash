import React, { useState, useEffect } from 'react';
import {
  Trophy,
  RotateCcw,
  LogOut,
  ArrowLeft,
  Clock,
  Award,
  Lock,
  Globe,
  Users,
  Hash,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Medal,
  Flame,
  SlidersHorizontal,
} from 'lucide-react';
import {
  RoomPublicState,
  ErrorFilterCategory,
  PuzzleSeedLeaderboardResponse,
  AllTimeLeaderboardResponse,
  DifficultyLevel,
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
} from '../types/game.ts';
import { formatDurationMs } from './GameScreen.tsx';
import { AvatarBadge } from './AvatarBadge.tsx';

export type TierFilter = 'All' | DifficultyLevel;
export const TIER_OPTIONS: TierFilter[] = ['All', ...DIFFICULTY_LEVELS];

interface LeaderboardScreenProps {
  room?: RoomPublicState | null;
  currentPlayerId?: string;
  initialTab?: 'match' | 'seed' | 'all-time';
  onReturnToLobby?: () => void;
  onBackToBoard?: () => void;
  onLeaveRoom?: () => void;
  onClose?: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  room,
  currentPlayerId,
  initialTab = 'match',
  onReturnToLobby,
  onBackToBoard,
  onLeaveRoom,
  onClose,
}) => {
  // If no room is passed, default to all-time leaderboard
  const defaultTab = !room ? 'all-time' : initialTab;
  const [activeTab, setActiveTab] = useState<'match' | 'seed' | 'all-time'>(defaultTab);

  // Difficulty Tier Filter toggle state (allows switching between All, Easy, Medium, Hard, Very Hard, Expert, Pro)
  const [difficultyFilter, setDifficultyFilter] = useState<TierFilter>(
    room?.difficulty ? room.difficulty : 'All'
  );

  // Error filter for Global Puzzle Seed Leaderboard
  const [errorFilter, setErrorFilter] = useState<ErrorFilterCategory>('all');

  // Seed Leaderboard state
  const [seedLeaderboard, setSeedLeaderboard] = useState<PuzzleSeedLeaderboardResponse | null>(null);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // All-time Leaderboard state
  const [allTimeData, setAllTimeData] = useState<AllTimeLeaderboardResponse | null>(null);
  const [loadingAllTime, setLoadingAllTime] = useState(false);
  const [allTimeError, setAllTimeError] = useState<string | null>(null);

  const me = room?.players.find((p) => p.id === currentPlayerId);
  const isHost = room?.hostId === currentPlayerId;
  const puzzleSeed = room?.puzzleSeed;

  // Rule: Global Seed Leaderboard is ONLY unlocked/shown after the player has solved the puzzle
  // (i.e. me.finished === true or the entire room status is FINISHED)
  const hasSolvedPuzzle = Boolean(me?.finished || room?.status === 'FINISHED');

  // Fetch Puzzle Seed Leaderboard when Tab 2 is selected and puzzle is solved
  useEffect(() => {
    if (activeTab !== 'seed' || !puzzleSeed || !hasSolvedPuzzle) return;

    let mounted = true;
    setLoadingSeed(true);
    setSeedError(null);

    const difficulty = difficultyFilter !== 'All' ? difficultyFilter : (room?.difficulty || 'Medium');
    fetch(
      `/api/leaderboard/puzzle/${encodeURIComponent(puzzleSeed)}?errorFilter=${errorFilter}&difficulty=${difficulty}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json.ok && json.data) {
          setSeedLeaderboard(json.data);
        } else {
          setSeedError(json.error || 'Failed to load seed leaderboard.');
        }
      })
      .catch((_err) => {
        if (!mounted) return;
        setSeedError('Network error loading puzzle leaderboard.');
      })
      .finally(() => {
        if (mounted) setLoadingSeed(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, puzzleSeed, errorFilter, hasSolvedPuzzle, difficultyFilter, room?.difficulty]);

  // Fetch All-Time Leaderboard when Tab 3 is selected, responding to difficultyFilter
  useEffect(() => {
    if (activeTab !== 'all-time') return;

    let mounted = true;
    setLoadingAllTime(true);
    setAllTimeError(null);

    const diffParam = difficultyFilter !== 'All' ? `&difficulty=${encodeURIComponent(difficultyFilter)}` : '';
    fetch(`/api/leaderboard/all-time?limit=50${diffParam}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json.ok && json.data) {
          setAllTimeData(json.data);
        } else {
          setAllTimeError(json.error || 'Failed to load all-time leaderboard.');
        }
      })
      .catch((_err) => {
        if (!mounted) return;
        setAllTimeError('Network error loading all-time leaderboard.');
      })
      .finally(() => {
        if (mounted) setLoadingAllTime(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, difficultyFilter]);

  // Sort match participants
  const rankedPlayers = room
    ? [...room.players].sort((a, b) => {
        if (a.finished && b.finished) {
          return (a.rank || 99) - (b.rank || 99);
        }
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.filledCount - a.filledCount;
      })
    : [];

  const winner = rankedPlayers.find((p) => p.rank === 1);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header Summary Card */}
      <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <span>
              {room
                ? room.status === 'FINISHED'
                  ? 'Final Standings'
                  : 'Live Standings'
                : 'Global Leaderboards'}
            </span>
            {room && (
              <>
                <span aria-hidden="true">·</span>
                <span>{room.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">Room {room.code}</span>
              </>
            )}
            {puzzleSeed && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-sky-400">{puzzleSeed}</span>
              </>
            )}
          </div>

          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-50">
            {activeTab === 'match'
              ? winner
                ? `${winner.name} took 1st with 100.0 pts`
                : 'Competitive Scoreboard in Progress'
              : activeTab === 'seed'
              ? `Global Leaderboard · Seed ${puzzleSeed || 'Puzzle'}`
              : 'All-Time Global Standings'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            {activeTab === 'match' ? (
              <>
                Rank 1 claims 100 pts. Ranks <span className="font-mono">k ≥ 2</span> interpolate from{' '}
                <span className="font-mono text-slate-200">100 - 5(k-1)</span> down to{' '}
                <span className="font-mono text-slate-200">100 - 20(k-1)</span> over a{' '}
                <span className="font-mono text-slate-200">120s</span> delay (Δt) window.
              </>
            ) : activeTab === 'seed' ? (
              <>
                Verified worldwide speed benchmarks for this exact puzzle seed. Compare your finish
                time against solvers in the exact error bracket (0, 1, 2, or 3+ mistakes).
              </>
            ) : (
              <>
                Hall of Fame career records across all tournament competitors, total scores, match
                victories, and flawless zero-mistake clears.
              </>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {room && room.status === 'PLAYING' && onBackToBoard && (
            <button
              type="button"
              onClick={onBackToBoard}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#0B0F17] hover:bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Board</span>
            </button>
          )}

          {room && isHost && onReturnToLobby && (
            <button
              type="button"
              onClick={onReturnToLobby}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rematch in Lobby</span>
            </button>
          )}

          {onLeaveRoom && (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#0B0F17] hover:bg-rose-950/40 border border-slate-800 text-xs font-medium text-slate-300 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xs:inline">Exit</span>
            </button>
          )}

          {!room && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Match Standings | Puzzle Seed Leaderboard | All-Time Stats) */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
        {room && (
          <button
            type="button"
            onClick={() => setActiveTab('match')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'match'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-[#131B2E] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Match Standings</span>
            {room.status === 'PLAYING' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        )}

        {puzzleSeed && (
          <button
            type="button"
            onClick={() => setActiveTab('seed')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'seed'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'bg-[#131B2E] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>Puzzle Seed Global ({puzzleSeed})</span>
            {!hasSolvedPuzzle ? (
              <Lock className="w-3.5 h-3.5 text-amber-400 ml-1" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('all-time')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'all-time'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-[#131B2E] text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>All-Time Stats Leaderboard</span>
        </button>
      </div>

      {/* TAB 1: Current Match Standings */}
      {activeTab === 'match' && room && (
        <>
          {/* Rankings Mobile Card List (Visible on < md) */}
          <div className="md:hidden space-y-2.5">
            {rankedPlayers.map((player) => {
              const isMe = player.id === currentPlayerId;
              const progressPct =
                player.totalToFill > 0
                  ? Math.round((player.filledCount / player.totalToFill) * 100)
                  : 0;

              return (
                <div
                  key={player.id}
                  className={`p-3.5 rounded-xl border ${
                    isMe
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-[#131B2E] border-slate-800/90'
                  } space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 font-mono font-bold text-sm">
                        {player.finished && player.rank ? (
                          <span className={player.rank === 1 ? 'text-amber-400' : 'text-slate-300'}>
                            #{player.rank}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                      <AvatarBadge avatarId={player.avatarId} size="sm" />
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {player.name} {isMe && <span className="text-amber-400 font-normal">· You</span>}
                      </span>
                    </div>

                    <div className="font-mono text-sm font-bold">
                      {player.finished && player.score !== null ? (
                        <span className="text-emerald-400">{player.score.toFixed(1)} pts</span>
                      ) : (
                        <span className="text-slate-500 text-xs">{progressPct}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                    <span>
                      Time: {player.finishTimeMs !== null ? formatDurationMs(player.finishTimeMs) : 'Active'}
                    </span>
                    <span>
                      Gap (Δt):{' '}
                      {player.finished && player.deltaTSeconds !== null ? (
                        player.rank === 1 ? (
                          <strong className="text-emerald-400">Anchor</strong>
                        ) : (
                          <strong className="text-amber-300">+{player.deltaTSeconds.toFixed(1)}s</strong>
                        )
                      ) : (
                        '—'
                      )}
                    </span>
                    <span>Errors: {player.mistakes}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rankings Table (Visible on md and larger) */}
          <div className="hidden md:block bg-[#131B2E] border border-slate-800/90 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Participant Rankings & Time Delay (Δt) Breakdown
              </h2>
              {room.firstFinishTimeMs !== null && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Anchor Time (t₁): {formatDurationMs(room.firstFinishTimeMs)}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs text-slate-400 font-medium">
                    <th className="py-3.5 px-6">Rank</th>
                    <th className="py-3.5 px-6">Competitor</th>
                    <th className="py-3.5 px-6">Status / Progress</th>
                    <th className="py-3.5 px-6 text-right">Finish Time</th>
                    <th className="py-3.5 px-6 text-right">Gap (Δt)</th>
                    <th className="py-3.5 px-6 text-right">Tavan Sınırı (Cap)</th>
                    <th className="py-3.5 px-6 text-right">Nihai Puan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {rankedPlayers.map((player) => {
                    const isMe = player.id === currentPlayerId;
                    const progressPct =
                      player.totalToFill > 0
                        ? Math.round((player.filledCount / player.totalToFill) * 100)
                        : 0;

                    return (
                      <tr
                        key={player.id}
                        className={`transition-colors ${
                          isMe ? 'bg-amber-500/5' : 'hover:bg-slate-900/40'
                        }`}
                      >
                        {/* Rank Column */}
                        <td className="py-4 px-6 font-mono font-bold">
                          {player.finished && player.rank ? (
                            <div className="flex items-center gap-2">
                              {player.rank === 1 ? (
                                <Trophy className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Award className="w-4 h-4 text-slate-400" />
                              )}
                              <span
                                className={
                                  player.rank === 1 ? 'text-amber-400 text-base' : 'text-slate-200'
                                }
                              >
                                #{player.rank}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Competitor Profile Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <AvatarBadge avatarId={player.avatarId} size="md" />
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-2">
                                <span>{player.name}</span>
                                {isMe && (
                                  <span className="text-xs text-amber-400 font-medium">· You</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                Mistakes: {player.mistakes}
                                {!player.connected && ' · Disconnected'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Completion Status */}
                        <td className="py-4 px-6">
                          {player.finished ? (
                            <span className="text-xs font-semibold text-emerald-400">
                              COMPLETED (100%)
                            </span>
                          ) : (
                            <div className="space-y-1 max-w-[140px]">
                              <div className="text-xs font-mono text-amber-400">
                                SOLVING ({progressPct}%)
                              </div>
                              <div className="w-full h-1.5 bg-[#0B0F17] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Finish Time */}
                        <td className="py-4 px-6 text-right font-mono text-slate-200 tabular-nums">
                          {player.finishTimeMs !== null
                            ? formatDurationMs(player.finishTimeMs)
                            : 'In Progress'}
                        </td>

                        {/* Delta t Gap */}
                        <td className="py-4 px-6 text-right font-mono tabular-nums">
                          {player.finished && player.deltaTSeconds !== null ? (
                            player.rank === 1 ? (
                              <span className="text-emerald-400 font-semibold">0.00s (Anchor)</span>
                            ) : (
                              <span className="text-amber-300">+{player.deltaTSeconds.toFixed(2)}s</span>
                            )
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Score Cap / Ceiling */}
                        <td className="py-4 px-6 text-right font-mono text-xs tabular-nums">
                          {player.finished ? (
                            player.maxScoreCap === null || (!player.maxScoreCap && player.mistakes === 0) ? (
                              <span className="text-emerald-400 font-bold">Sınırsız (Hatasız)</span>
                            ) : (
                              <span className="text-amber-300">Tavan: {player.maxScoreCap} pts</span>
                            )
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Final Score & Difficulty Multiplier */}
                        <td className="py-4 px-6 text-right font-mono text-base font-bold tabular-nums">
                          {player.finished && player.score !== null ? (
                            <div className="flex flex-col items-end">
                              <span className="text-emerald-400">{Math.round(player.score)} pts</span>
                              {(player.difficultyMultiplier || player.timeMultiplier) && (
                                <span className="text-[10px] text-amber-400 font-normal">
                                  🎯 {(player.difficultyMultiplier || player.timeMultiplier || 1).toFixed(2)}x zorluk çarpanı
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Global Puzzle Seed Leaderboard (Only shown after solving puzzle) */}
      {activeTab === 'seed' && (
        <div className="space-y-4">
          {!hasSolvedPuzzle ? (
            /* Locked State Card */
            <div className="bg-[#131B2E] border border-amber-500/40 rounded-2xl p-6 sm:p-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-xl font-bold text-slate-100">
                  Global Puzzle Seed Leaderboard Locked
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  To preserve tournament competitive integrity, global solver benchmarks for{' '}
                  <strong className="text-sky-300 font-mono">{puzzleSeed}</strong> are only revealed{' '}
                  <strong>after you finish and solve the puzzle</strong>!
                </p>
              </div>

              {me && (
                <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 max-w-sm mx-auto space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300 font-mono">
                    <span>Your Solving Progress:</span>
                    <strong className="text-amber-400">
                      {me.filledCount} / {me.totalToFill} cells
                    </strong>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${
                          me.totalToFill > 0 ? (me.filledCount / me.totalToFill) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 text-left pt-1">
                    Mistakes so far: <span className="text-slate-200 font-semibold">{me.mistakes}</span>
                  </div>
                </div>
              )}

              {onBackToBoard && (
                <button
                  type="button"
                  onClick={onBackToBoard}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Grid & Solve</span>
                </button>
              )}
            </div>
          ) : (
            /* Unlocked Global Puzzle Seed Leaderboard */
            <div className="space-y-4">
              {/* Category Breakdown & Filter Bar: Showing only zero error, 1 error, 2 error and 3 or more error */}
              <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-semibold text-slate-100">
                      Puzzle Verified · Filter by Mistake Bracket:
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Seed: <strong className="text-sky-300">{puzzleSeed}</strong> · Solvers:{' '}
                    <strong className="text-slate-200">{seedLeaderboard?.totalSolvers || '—'}</strong>
                  </div>
                </div>

                {/* Difficulty Tier Selector for Seed Benchmarks */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                    <span>Sudoku Tier:</span>
                    <span className="font-mono text-sky-300 font-semibold">{difficultyFilter === 'All' ? (room?.difficulty || 'Medium') : difficultyFilter}</span>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {TIER_OPTIONS.map((tier) => {
                      const isSelected = difficultyFilter === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setDifficultyFilter(tier)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                              : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {tier}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setErrorFilter('all')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      errorFilter === 'all'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <span>All Solvers</span>
                    <span className="font-mono text-[11px] opacity-80">
                      {seedLeaderboard?.totalSolvers ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setErrorFilter('zero')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      errorFilter === 'zero'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-emerald-400'
                    }`}
                  >
                    <span>0 Errors</span>
                    <span className="font-mono text-[11px] opacity-80">
                      {seedLeaderboard?.breakdown.zeroErrorCount ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setErrorFilter('1')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      errorFilter === '1'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-amber-300'
                    }`}
                  >
                    <span>1 Error</span>
                    <span className="font-mono text-[11px] opacity-80">
                      {seedLeaderboard?.breakdown.oneErrorCount ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setErrorFilter('2')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      errorFilter === '2'
                        ? 'bg-orange-500 text-slate-950 shadow-sm'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-orange-300'
                    }`}
                  >
                    <span>2 Errors</span>
                    <span className="font-mono text-[11px] opacity-80">
                      {seedLeaderboard?.breakdown.twoErrorCount ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setErrorFilter('3plus')}
                    className={`col-span-2 sm:col-span-1 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      errorFilter === '3plus'
                        ? 'bg-rose-500 text-slate-950 shadow-sm'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-rose-300'
                    }`}
                  >
                    <span>3+ Errors</span>
                    <span className="font-mono text-[11px] opacity-80">
                      {seedLeaderboard?.breakdown.threeOrMoreErrorCount ?? 0}
                    </span>
                  </button>
                </div>
              </div>

              {/* Solvers Listing */}
              {loadingSeed ? (
                <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-12 text-center text-slate-400 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400" />
                  <p className="text-xs">Loading global seed records...</p>
                </div>
              ) : seedError ? (
                <div className="bg-[#131B2E] border border-rose-500/40 rounded-2xl p-8 text-center text-rose-300 space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                  <p className="text-sm font-semibold">{seedError}</p>
                </div>
              ) : seedLeaderboard && seedLeaderboard.records.length > 0 ? (
                <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">
                      Ranked Solvers ({seedLeaderboard.records.length})
                    </span>
                    <span className="font-mono">
                      Bracket:{' '}
                      {errorFilter === 'all'
                        ? 'All'
                        : errorFilter === 'zero'
                        ? '0 Mistakes'
                        : errorFilter === '1'
                        ? '1 Mistake'
                        : errorFilter === '2'
                        ? '2 Mistakes'
                        : '3+ Mistakes'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/60">
                    {seedLeaderboard.records.map((rec) => {
                      const isMe =
                        (me?.name && rec.playerName.toLowerCase() === me.name.toLowerCase()) ||
                        (me?.userId && rec.userId === me.userId);

                      return (
                        <div
                          key={rec.id}
                          className={`p-3.5 sm:px-6 sm:py-4 flex items-center justify-between gap-3 transition-colors ${
                            isMe ? 'bg-amber-500/10' : 'hover:bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 font-mono font-bold text-sm text-center shrink-0">
                              {rec.rank === 1 ? (
                                <Trophy className="w-5 h-5 text-amber-400 mx-auto" />
                              ) : rec.rank === 2 ? (
                                <Medal className="w-5 h-5 text-slate-300 mx-auto" />
                              ) : rec.rank === 3 ? (
                                <Medal className="w-5 h-5 text-amber-600 mx-auto" />
                              ) : (
                                <span className="text-slate-400">#{rec.rank}</span>
                              )}
                            </div>

                            <AvatarBadge avatarId={rec.avatarId} size="md" />

                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-slate-100 flex items-center gap-2 truncate">
                                <span>{rec.playerName}</span>
                                {isMe && (
                                  <span className="text-xs text-amber-400 font-medium shrink-0">
                                    · You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    rec.mistakes === 0
                                      ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                                      : rec.mistakes === 1
                                      ? 'bg-amber-950 border border-amber-500/40 text-amber-300'
                                      : rec.mistakes === 2
                                      ? 'bg-orange-950 border border-orange-500/40 text-orange-300'
                                      : 'bg-rose-950 border border-rose-500/40 text-rose-300'
                                  }`}
                                >
                                  {rec.mistakes === 0
                                    ? '0 Errors'
                                    : `${rec.mistakes} Error${rec.mistakes > 1 ? 's' : ''}`}
                                </span>
                                <span>{new Date(rec.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <div className="text-sm sm:text-base font-bold text-emerald-400">
                              {formatDurationMs(rec.finishTimeMs)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {rec.score.toFixed(1)} pts
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  No solvers recorded in this mistake category yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: All-Time Global Leaderboard */}
      {activeTab === 'all-time' && (
        <div className="space-y-4">
          {/* Difficulty Tier Filter Toggle */}
          <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-3.5 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-slate-100">
                  Sudoku Tier Filter:
                </span>
                <span className="text-xs text-amber-300 font-mono font-medium">
                  {difficultyFilter === 'All' ? 'All Tiers' : `${difficultyFilter} Tier`}
                </span>
              </div>

              {difficultyFilter !== 'All' && DIFFICULTY_CONFIG[difficultyFilter as DifficultyLevel] && (
                <div className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-xl shrink-0 self-start sm:self-auto">
                  {DIFFICULTY_CONFIG[difficultyFilter as DifficultyLevel].clues} Clues · {DIFFICULTY_CONFIG[difficultyFilter as DifficultyLevel].emptyCells} Empty Cells
                </div>
              )}
            </div>

            {/* Toggle Button Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {TIER_OPTIONS.map((tier) => {
                const isSelected = difficultyFilter === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setDifficultyFilter(tier)}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-2 ring-amber-400/80'
                        : 'bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {tier === 'All' ? (
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          tier === 'Easy'
                            ? 'bg-emerald-400'
                            : tier === 'Medium'
                            ? 'bg-sky-400'
                            : tier === 'Hard'
                            ? 'bg-amber-400'
                            : tier === 'Very Hard'
                            ? 'bg-orange-400'
                            : tier === 'Expert'
                            ? 'bg-purple-400'
                            : 'bg-rose-400'
                        }`}
                      />
                    )}
                    <span>{tier}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loadingAllTime ? (
            <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">Loading all-time global player records...</p>
            </div>
          ) : allTimeError ? (
            <div className="bg-[#131B2E] border border-rose-500/40 rounded-2xl p-8 text-center text-rose-300 space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
              <p className="text-sm font-semibold">{allTimeError}</p>
            </div>
          ) : allTimeData && allTimeData.entries.length > 0 ? (
            <div className="space-y-4">
              {/* Podium Highlight for Top 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {allTimeData.entries.slice(0, 3).map((entry, idx) => (
                  <div
                    key={entry.playerName}
                    className={`bg-[#131B2E] border rounded-2xl p-4 flex items-center gap-3.5 ${
                      idx === 0
                        ? 'border-amber-500/60 bg-gradient-to-b from-amber-500/10 to-[#131B2E]'
                        : idx === 1
                        ? 'border-slate-600/60'
                        : 'border-amber-700/60'
                    }`}
                  >
                    <div className="w-8 font-mono font-bold text-center">
                      {idx === 0 ? (
                        <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
                      ) : idx === 1 ? (
                        <Medal className="w-6 h-6 text-slate-300 mx-auto" />
                      ) : (
                        <Medal className="w-6 h-6 text-amber-600 mx-auto" />
                      )}
                      <span className="text-xs text-slate-400">#{idx + 1}</span>
                    </div>

                    <AvatarBadge avatarId={entry.avatarId} size="lg" />

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 truncate">
                        <span className="truncate">{entry.playerName}</span>
                        {entry.isDailyMaster && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-400/40 shrink-0"
                            title="Daily Master"
                          >
                            <Award className="w-2.5 h-2.5 text-amber-400" />
                            <span>Daily Master</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-amber-400 font-mono font-bold">
                        {entry.totalScore} pts
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {entry.gamesWon}W / {entry.gamesPlayed}P ({entry.winRate}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Full Standings Table */}
              <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>
                      Global Career Standings{' '}
                      {difficultyFilter !== 'All' ? (
                        <span className="text-amber-300 font-bold">· {difficultyFilter} Tier</span>
                      ) : (
                        <span className="text-slate-400 font-normal">· Overall</span>
                      )}
                    </span>
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    {allTimeData.totalPlayers} Competitors ({difficultyFilter === 'All' ? 'All Tiers' : `${difficultyFilter} Tier`})
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-xs text-slate-400 font-medium">
                        <th className="py-3 px-6">Rank</th>
                        <th className="py-3 px-6">Competitor</th>
                        <th className="py-3 px-6 text-center">Record (W / L)</th>
                        <th className="py-3 px-6 text-center">Win Rate</th>
                        <th className="py-3 px-6 text-center">Flawless (0 Err)</th>
                        <th className="py-3 px-6 text-right">Best Time</th>
                        <th className="py-3 px-6 text-right">Total Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {allTimeData.entries.map((entry) => {
                        const isMe =
                          (me?.name && entry.playerName.toLowerCase() === me.name.toLowerCase()) ||
                          (me?.userId && entry.userId === me.userId);

                        return (
                          <tr
                            key={entry.playerName}
                            className={`transition-colors ${
                              isMe ? 'bg-amber-500/10' : 'hover:bg-slate-900/40'
                            }`}
                          >
                            <td className="py-3.5 px-6 font-mono font-bold text-slate-300">
                              #{entry.rank}
                            </td>

                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <AvatarBadge avatarId={entry.avatarId} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-slate-100 truncate">
                                      {entry.playerName}
                                    </span>
                                    {isMe && <span className="text-amber-400 text-xs font-semibold">· You</span>}
                                    {entry.isDailyMaster && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/50 text-amber-300 font-mono text-[10px] font-bold shadow-xs shrink-0"
                                        title="Daily Master: Top Performer in the 24-hour Daily Challenge"
                                      >
                                        <Award className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                                        <span>Daily Master</span>
                                      </span>
                                    )}
                                    {entry.isCommitted && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 font-mono text-[10px] font-bold shrink-0"
                                        title="Committed: Consecutive Daily Challenge Streak Achieved"
                                      >
                                        <Flame className="w-3 h-3 text-sky-400 fill-sky-400/30" />
                                        <span>Committed</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-6 text-center font-mono text-xs text-slate-300">
                              <strong className="text-emerald-400">{entry.gamesWon}W</strong> /{' '}
                              <span>{entry.gamesPlayed - entry.gamesWon}L</span>
                            </td>

                            <td className="py-3.5 px-6 text-center font-mono text-xs">
                              <span
                                className={
                                  entry.winRate >= 75
                                    ? 'text-emerald-400 font-bold'
                                    : entry.winRate >= 50
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }
                              >
                                {entry.winRate}%
                              </span>
                            </td>

                            <td className="py-3.5 px-6 text-center font-mono text-xs">
                              {entry.flawlessWins > 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                  <Flame className="w-3.5 h-3.5" />
                                  <span>{entry.flawlessWins}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">0</span>
                              )}
                            </td>

                            <td className="py-3.5 px-6 text-right font-mono text-xs text-slate-300">
                              {entry.bestFinishTimeMs !== null
                                ? formatDurationMs(entry.bestFinishTimeMs)
                                : '—'}
                            </td>

                            <td className="py-3.5 px-6 text-right font-mono font-bold text-amber-400">
                              {entry.totalScore}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No all-time player records found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
