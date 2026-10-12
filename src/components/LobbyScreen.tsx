import React, { useState } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Play,
  LogOut,
  Bot,
  Trash2,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react';
import {
  DifficultyLevel,
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  RoomPublicState,
} from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';
import { ChatPanel } from './ChatPanel.tsx';

interface LobbyScreenProps {
  room: RoomPublicState;
  currentPlayerId: string;
  onToggleReady: () => void;
  onSetDifficulty: (difficulty: DifficultyLevel) => void;
  onStartGame: () => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onLeaveRoom: () => void;
  onOpenProfile: () => void;
  onSendMessage: (text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  errorMessage: string | null;
  clearError: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  currentPlayerId,
  onToggleReady,
  onSetDifficulty,
  onStartGame,
  onAddBot,
  onRemoveBot,
  onLeaveRoom,
  onOpenProfile,
  onSendMessage,
  onDeleteMessage,
  errorMessage,
  clearError,
}) => {
  const [copied, setCopied] = useState(false);

  const isHost = room.hostId === currentPlayerId;
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);
  const readyCount = room.players.filter((p) => p.isReady).length;
  const totalCount = room.players.length;
  const allReady = totalCount > 0 && readyCount === totalCount;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 sm:p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-center justify-between gap-4"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-xs font-medium text-rose-300 hover:text-white underline whitespace-nowrap cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Room Banner: 6-Character Code & Difficulty Controls */}
      <div className="bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          {/* Room Code Block */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-400">
              <span>Matchmaking Lobby</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">
                {totalCount}/{room.maxPlayers} Players
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-medium">
                {isHost ? 'You are Host' : 'Waiting for Host'}
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
              <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-bold tracking-[0.16em] sm:tracking-[0.22em] text-slate-50 select-all">
                {room.code}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="min-h-[40px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Host Exclusive Difficulty Dropdown OR Non-Host Read-Only Display */}
          <div className="w-full lg:w-80 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Difficulty Level</span>
              </span>
              <span className="font-mono text-slate-400">
                {DIFFICULTY_CONFIG[room.difficulty].emptyCells} Empty Cells
              </span>
            </div>

            {isHost ? (
              <div className="relative">
                <select
                  aria-label="Select match difficulty level"
                  value={room.difficulty}
                  onChange={(e) => onSetDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#0B0F17] border border-amber-500/40 hover:border-amber-400 rounded-xl text-base sm:text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                >
                  {DIFFICULTY_LEVELS.map((level) => (
                    <option key={level} value={level} className="bg-[#0B0F17] text-slate-100">
                      {level} — {DIFFICULTY_CONFIG[level].clues} Clues ({DIFFICULTY_CONFIG[level].emptyCells} Empty)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="px-4 py-2.5 sm:py-3 bg-[#0B0F17] border border-slate-800 rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{room.difficulty}</span>
                <span className="text-xs text-slate-400 font-mono">
                  {DIFFICULTY_CONFIG[room.difficulty].clues} Clues · Host Controlled
                </span>
              </div>
            )}
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              {DIFFICULTY_CONFIG[room.difficulty].description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Roster & Real-time Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left 7 Cols: Connected Competitors List */}
        <div className="lg:col-span-7 bg-[#131B2E] border border-slate-800/90 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 sm:pb-4">
            <div>
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-50">
                Connected Competitors
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All players must mark Ready before start.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProfile}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-900 border border-slate-800 text-xs font-medium text-amber-400 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>My Profile</span>
              </button>

              {isHost && room.players.length < room.maxPlayers && (
                <button
                  type="button"
                  onClick={onAddBot}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  title="Add a simulated AI competitor to test multi-player rank interpolation"
                >
                  <Bot className="w-3.5 h-3.5 text-sky-400" />
                  <span>Add Bot</span>
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-800/70">
            {room.players.map((player) => {
              const isMe = player.id === currentPlayerId;
              return (
                <div
                  key={player.id}
                  className="py-3 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <AvatarBadge avatarId={player.avatarId} size="md" />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-semibold text-sm text-slate-100 truncate">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-xs text-amber-400 font-medium shrink-0">· You</span>
                        )}
                        {player.isHost && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium shrink-0">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            Host
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {player.isBot
                          ? `Simulated Bot`
                          : player.isHost
                          ? 'Room Creator'
                          : 'Connected Challenger'}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Color-coded + Explicit Icon/Text Ready Status */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {player.isReady ? (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>READY</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>NOT READY</span>
                      </div>
                    )}

                    {isHost && player.isBot && (
                      <button
                        type="button"
                        onClick={() => onRemoveBot(player.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        aria-label={`Remove ${player.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="pt-3 sm:pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onToggleReady}
              className={`w-full sm:flex-1 min-h-[46px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer active:scale-95 ${
                currentPlayer?.isReady
                  ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {currentPlayer?.isReady ? 'Ready Locked (Click to Unready)' : 'Mark Ready'}
              </span>
            </button>

            {isHost && (
              <button
                type="button"
                disabled={!allReady}
                onClick={onStartGame}
                className="w-full sm:flex-1 min-h-[46px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed active:scale-95 shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Match ({readyCount}/{totalCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLeaveRoom}
              className="w-full sm:w-auto min-h-[44px] py-2.5 sm:py-3 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Real-Time Room Chat Panel */}
        <div className="lg:col-span-5 w-full">
          <ChatPanel
            messages={room.messages || []}
            currentUserId={currentPlayerId}
            isHost={isHost}
            onSendMessage={onSendMessage}
            onDeleteMessage={onDeleteMessage}
            compact={false}
          />
        </div>
      </div>
    </div>
  );
};
