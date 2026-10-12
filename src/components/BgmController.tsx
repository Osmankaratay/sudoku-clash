import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Headphones,
  Sliders,
  Disc3,
  Coffee,
  CloudRain,
  Sun,
  Flame,
} from 'lucide-react';
import { soundEngine, LoFiTrack } from '../utils/sound.ts';

interface BgmControllerProps {
  compact?: boolean;
  className?: string;
}

export const BgmController: React.FC<BgmControllerProps> = ({ compact = false, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(soundEngine.bgmPlaying);
  const [volume, setVolume] = useState<number>(soundEngine.bgmVolume);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(soundEngine.currentTrackIndex);
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Sync with soundEngine changes
  useEffect(() => {
    const unsubscribe = soundEngine.subscribe(() => {
      setIsPlaying(soundEngine.bgmPlaying);
      setVolume(soundEngine.bgmVolume);
      setCurrentTrackIndex(soundEngine.currentTrackIndex);
    });
    return unsubscribe;
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const currentTrack: LoFiTrack = soundEngine.tracks[currentTrackIndex] || soundEngine.tracks[0];

  const handleTogglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEngine.toggleBgm();
  };

  const handleNextTrack = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEngine.nextTrack();
  };

  const handlePrevTrack = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEngine.prevTrack();
  };

  const handleSelectTrack = (index: number) => {
    soundEngine.setTrack(index);
    if (!soundEngine.bgmPlaying) {
      soundEngine.startBgm();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundEngine.setBgmVolume(val);
  };

  const getTrackIcon = (id: string) => {
    switch (id) {
      case 'coffee-pencils':
        return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
      case 'midnight-rain':
        return <CloudRain className="w-3.5 h-3.5 text-sky-400" />;
      case 'kyoto-zen':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      case 'sunset-tokyo':
        return <Sun className="w-3.5 h-3.5 text-orange-400" />;
      default:
        return <Music className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* Header Button Toggle */}
      <button
        type="button"
        onClick={() => setShowPopover((prev) => !prev)}
        className={`group px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
          isPlaying
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-[#131B2E] hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
        }`}
        title={isPlaying ? `Playing: ${currentTrack.title} (Click for BGM Controls)` : 'Lo-Fi Focus Radio (Offline)'}
        aria-label="Background Music Controller"
      >
        {isPlaying ? (
          <div className="flex items-center gap-1 text-amber-400">
            {/* Animated Soundwave bars */}
            <div className="flex items-end gap-0.5 h-3.5 w-3.5 shrink-0 px-0.5">
              <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-3" />
              <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-2 delay-75" />
              <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-3.5 delay-150" />
            </div>
            <span className="hidden xl:inline max-w-[110px] truncate text-slate-200 text-[11px] font-medium">
              {currentTrack.title}
            </span>
          </div>
        ) : (
          <Headphones className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
        )}

        <span className="hidden sm:inline text-[11px]">
          {isPlaying ? 'Lo-Fi' : 'Music'}
        </span>
      </button>

      {/* Popover Music Player Card */}
      {showPopover && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 z-50 bg-[#131B2E] border border-slate-700/90 rounded-2xl p-4 shadow-2xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Disc3 className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>Lo-Fi Focus Radio</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                    SYNTH
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Calming generative chillhop beats</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Track Display */}
          <div className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800/90 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[10px]">Track #{currentTrackIndex + 1} of {soundEngine.tracks.length}</span>
              <span className="text-amber-400/90 font-mono text-[10px]">{currentTrack.bpm} BPM</span>
            </div>
            <div className="font-semibold text-sm text-slate-100 truncate flex items-center gap-1.5">
              {getTrackIcon(currentTrack.id)}
              <span className="truncate">{currentTrack.title}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate font-mono">
              {currentTrack.mood}
            </div>
          </div>

          {/* Player Transport Controls */}
          <div className="flex items-center justify-center gap-4 py-1">
            <button
              type="button"
              onClick={handlePrevTrack}
              className="p-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Previous Track"
              aria-label="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
              }`}
              title={isPlaying ? 'Pause BGM' : 'Play BGM'}
              aria-label={isPlaying ? 'Pause Background Music' : 'Play Background Music'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextTrack}
              className="p-2 rounded-xl bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Next Track"
              aria-label="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                {volume <= 0.01 ? (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>BGM Volume</span>
              </span>
              <span className="font-mono text-slate-300">{Math.round(volume * 100)}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-[#0B0F17] rounded-lg appearance-none cursor-pointer accent-amber-500"
              aria-label="Lo-Fi Music Volume"
            />
          </div>

          {/* Playlist Selection */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Curated Lo-Fi Stations
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-0.5">
              {soundEngine.tracks.map((track, idx) => {
                const active = idx === currentTrackIndex;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleSelectTrack(idx)}
                    className={`w-full p-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                        : 'bg-[#0B0F17]/60 hover:bg-[#0B0F17] border border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getTrackIcon(track.id)}
                      <div className="min-w-0">
                        <div className="font-medium truncate leading-tight">{track.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate leading-tight">
                          {track.mood}
                        </div>
                      </div>
                    </div>

                    {active && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
