import React, { useState } from 'react';
import { Smartphone, Download, Check, X, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else {
      // Show Android / Chrome / iOS install instructions guide
      setShowGuideModal(true);
    }
  };

  if (variant === 'card') {
    return (
      <>
        <div className={`p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>Play as an Android / Mobile App</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px]">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Install to home screen for fullscreen gameplay, offline puzzles, and instant launch.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 shrink-0 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isInstallable ? 'Install Android App' : 'Add to Home Screen'}</span>
          </button>
        </div>

        {/* Install Guide Modal */}
        {showGuideModal && (
          <InstallGuideModal onClose={() => setShowGuideModal(false)} isAndroid={isAndroid} isIOS={isIOS} />
        )}
      </>
    );
  }

  // Header compact pill button
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        className={`px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] shadow-sm hover:border-amber-400 active:scale-95 ${className}`}
        title="Install Nueve as an Android / Mobile App"
        aria-label="Install App"
      >
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">
          {isAndroid ? 'Android App' : 'Install App'}
        </span>
      </button>

      {/* Install Guide Modal */}
      {showGuideModal && (
        <InstallGuideModal onClose={() => setShowGuideModal(false)} isAndroid={isAndroid} isIOS={isIOS} />
      )}
    </>
  );
};

interface InstallGuideModalProps {
  onClose: () => void;
  isAndroid: boolean;
  isIOS: boolean;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ onClose, isAndroid, isIOS }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#131B2E] border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Install Nueve Mobile App</h3>
              <p className="text-[11px] text-slate-400">Add to your home screen & app drawer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Android (Chrome / Samsung Internet / Edge)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pl-1">
              <li>Tap the <strong>three dots (⋮)</strong> menu in top-right corner.</li>
              <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Tap <strong>Install</strong> to add Nueve to your phone's app list.</li>
            </ol>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
            <div className="font-semibold text-sky-300 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone / iPad (Safari)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pl-1">
              <li>Tap the <strong>Share</strong> button (box with upward arrow).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right.</li>
            </ol>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-400 pt-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Works 100% offline once installed, zero ads, no app store download required!</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
