import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  DifficultyLevel,
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  UserAccount,
} from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { getAvatarById } from '../utils/avatars.ts';

interface LandingScreenProps {
  playerName: string;
  avatarId: string;
  currentUser: UserAccount | null;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onCreateRoom: (difficulty: DifficultyLevel) => void;
  onJoinRoom: (code: string) => void;
  onStartOfflineGame?: (difficulty: DifficultyLevel) => void;
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
  onOpenProfile,
  onOpenAuth,
  onCreateRoom,
  onJoinRoom,
  onStartOfflineGame,
  onOpenLeaderboard,
  isSubmitting,
  errorMessage,
  clearError,
  isOnline = true,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'offline'>(() => (isOnline ? 'create' : 'offline'));
  const [joinCode, setJoinCode] = useState('');
  const [initialDifficulty, setInitialDifficulty] = useState<DifficultyLevel>('Medium');

  const avatar = getAvatarById(avatarId);

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
            {/* Difficulty Preset Picker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Difficulty Level</span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {DIFFICULTY_CONFIG[initialDifficulty].clues} Clues ·{' '}
                  {DIFFICULTY_CONFIG[initialDifficulty].emptyCells} Empty
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
                {DIFFICULTY_LEVELS.map((level) => {
                  const active = initialDifficulty === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setInitialDifficulty(level)}
                      className={`min-h-[42px] py-2.5 px-1.5 text-xs font-semibold rounded-lg transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {DIFFICULTY_CONFIG[initialDifficulty].description}
              </p>
            </div>

            {/* Create Room Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onCreateRoom(initialDifficulty)}
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Practice Difficulty</span>
                <span className="font-mono text-amber-400 text-[11px] flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>100% Offline Ready</span>
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-[#0B0F17] rounded-xl border border-slate-800">
                {DIFFICULTY_LEVELS.map((level) => {
                  const active = initialDifficulty === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setInitialDifficulty(level)}
                      className={`min-h-[42px] py-2.5 px-1.5 text-xs font-semibold rounded-lg transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {DIFFICULTY_CONFIG[initialDifficulty].description}
              </p>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onStartOfflineGame && onStartOfflineGame(initialDifficulty)}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/25 active:scale-[0.99]"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Start Offline Match (No Internet Needed)</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Android & Mobile PWA App Card */}
      <PWAInstallButton variant="card" />

      {/* Global Leaderboards Shortcut */}
      {onOpenLeaderboard && (
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="w-full py-3 px-4 rounded-xl bg-[#131B2E] hover:bg-[#18233C] border border-slate-800 text-xs font-semibold text-slate-300 hover:text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>View Global Leaderboards</span>
        </button>
      )}
    </div>
  );
};
