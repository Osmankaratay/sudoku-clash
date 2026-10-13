import React from 'react';
import {
  Trophy,
  Award,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  Share2,
  RefreshCw,
  BarChart2,
  ShieldCheck,
} from 'lucide-react';
import { DifficultyLevel, PlayerPublicState, RoomPublicState } from '../types/game.ts';
import { triggerVictoryCelebration } from '../utils/confettiCelebration.ts';

interface VictoryCelebrationModalProps {
  room: RoomPublicState;
  player: PlayerPublicState;
  onClose: () => void;
  onOpenLeaderboard?: () => void;
  onOpenScoreDetails?: () => void;
  onLeaveRoom?: () => void;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const VictoryCelebrationModal: React.FC<VictoryCelebrationModalProps> = ({
  room,
  player,
  onClose,
  onOpenLeaderboard,
  onOpenScoreDetails,
  onLeaveRoom,
}) => {
  const isFlawless = (player.mistakes || 0) === 0;
  const isDelayedMode = room.feedbackMode === 'delayed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#131E36] to-[#0A0E17] border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-500/10 text-center space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Glow backdrop circles */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors cursor-pointer"
          title="Kapat & Tahtayı İncele"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Trophy Icon & Badges */}
        <div className="flex flex-col items-center">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/30 animate-bounce duration-1000">
              <div className="w-full h-full bg-[#0E1626] rounded-2xl flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
            </div>
            <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
          </div>

          <div className="mt-3 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isDelayedMode ? 'Sınav / Kendi Kendine Mod Tamamlandı' : 'Zorluk: ' + room.difficulty}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 tracking-tight">
              Tebrikler, Bulmaca Çözüldü!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
              {isDelayedMode
                ? 'Hamlelerinizi kendiniz yönettiniz ve tahtayı eksiksiz şekilde başarıyla bitirdiniz!'
                : 'Tüm 81 hücre kusursuz stratejiyle doğru olarak yerleştirildi!'}
            </p>
          </div>
        </div>

        {/* Highlight Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
          {/* Rank */}
          <div className="p-3 rounded-2xl bg-[#090D16]/80 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" />
              <span>Derece</span>
            </div>
            <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
              #{player.rank ?? 1}
            </div>
          </div>

          {/* Final Score */}
          <div className="p-3 rounded-2xl bg-[#090D16]/80 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Puan</span>
            </div>
            <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
              {player.score?.toFixed(0) ?? 0}
            </div>
          </div>

          {/* Solve Time */}
          <div className="p-3 rounded-2xl bg-[#090D16]/80 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Süre</span>
            </div>
            <div className="text-lg font-black text-cyan-300 font-mono mt-0.5">
              {formatDuration(player.finishTimeMs || 0)}
            </div>
          </div>

          {/* Accuracy / Mistakes (Replaced in Exam Mode) */}
          {!isDelayedMode ? (
            <div className="p-3 rounded-2xl bg-[#090D16]/80 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>Hata</span>
              </div>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${
                  isFlawless ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {player.mistakes || 0} Hata
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-[#090D16]/80 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                <span>Format</span>
              </div>
              <div className="text-sm font-bold font-mono mt-1 text-indigo-300">
                Sınav Modu
              </div>
            </div>
          )}
        </div>

        {/* Special Achievement Badges */}
        {!isDelayedMode && isFlawless && (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Kusursuz Çözüm Rozeti Kazanıldı! (0 Hata)</span>
          </div>
        )}
        {isDelayedMode && (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Sınav Modu Başarıyla Tamamlandı!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => triggerVictoryCelebration()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kutlamayı Tekrarla</span>
          </button>

          {onOpenScoreDetails && (
            <button
              type="button"
              onClick={onOpenScoreDetails}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Puan Detayı</span>
            </button>
          )}

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="w-full sm:flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Liderlik Tablosu</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Tahtayı İncele
          </button>
        </div>
      </div>
    </div>
  );
};
