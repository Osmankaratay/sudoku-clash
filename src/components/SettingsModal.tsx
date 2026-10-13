import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Palette,
  Volume2,
  VolumeX,
  Eye,
  SlidersHorizontal,
  Flame,
  Brain,
  ShieldAlert,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { DifficultyLevel, DIFFICULTY_CONFIG } from '../types/game.ts';
import { BOARD_THEME_LIST, BoardThemeId } from '../utils/boardThemes.ts';
import {
  UserGamePreferences,
  DEFAULT_GAME_PREFERENCES,
  loadGamePreferences,
  saveGamePreferences,
} from '../utils/gamePreferences.ts';
import { triggerHaptic, soundEngine } from '../utils/sound.ts';
import { calculateDifficultyMultiplier } from '../sudokuEngine.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePreferences?: (prefs: UserGamePreferences) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSavePreferences,
}) => {
  const [prefs, setPrefs] = useState<UserGamePreferences>(() => loadGamePreferences());
  const [activeTab, setActiveTab] = useState<'rules' | 'appearance' | 'assist' | 'audio'>('rules');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPrefs(loadGamePreferences());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof UserGamePreferences>(
    key: K,
    value: UserGamePreferences[K]
  ) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: value };
      saveGamePreferences(updated);
      onSavePreferences?.(updated);
      return updated;
    });
    setSavedSuccess(true);
    triggerHaptic(15);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleResetDefaults = () => {
    const defaultCopy = { ...DEFAULT_GAME_PREFERENCES };
    setPrefs(defaultCopy);
    saveGamePreferences(defaultCopy);
    onSavePreferences?.(defaultCopy);
    soundEngine.playSelect();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveAndClose = () => {
    saveGamePreferences(prefs);
    onSavePreferences?.(prefs);
    soundEngine.playCorrect();
    onClose();
  };

  const calculatedMultiplier = calculateDifficultyMultiplier(
    prefs.defaultDifficulty,
    prefs.defaultDifficulty === 'Custom' ? prefs.defaultCustomClues : undefined
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#131B2E] border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#0B0F17]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Oyun Ayarları & Varsayılanlar</span>
                {savedSuccess && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 animate-pulse">
                    <Check className="w-3 h-3" /> Kaydedildi
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Yeni oluşturulan oyunların genel kurallarını ve varsayılan davranışlarını özelleştirin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="p-2 sm:px-5 bg-[#0e1627] border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rules'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Kural & Zorluk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Görünüm & Tema</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assist')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'assist'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Akıllı Asistan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'audio'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Ses & Titreşim</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-slate-200 text-sm">
          {/* TAB 1: Kural & Zorluk */}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Default Difficulty */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Varsayılan Zorluk Seviyesi</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Yeni oluşturacağınız odaların ve çevrimdışı maçların başlangıç zorluğu.
                    </p>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Çarpan: {calculatedMultiplier.toFixed(2)}x
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {(['Easy', 'Medium', 'Hard', 'Expert', 'Custom'] as DifficultyLevel[]).map((level) => {
                    const active = prefs.defaultDifficulty === level;
                    const cfg = DIFFICULTY_CONFIG[level];
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleUpdate('defaultDifficulty', level)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                            : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <span className="capitalize">
                          {level === 'Easy'
                            ? 'Kolay'
                            : level === 'Medium'
                            ? 'Orta'
                            : level === 'Hard'
                            ? 'Zor'
                            : level === 'Expert'
                            ? 'Uzman'
                            : 'Özel'}
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            active ? 'text-slate-900 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {level === 'Custom' ? `${prefs.defaultCustomClues} İpucu` : `${cfg.clues} İpucu`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Clues Slider if Custom is chosen */}
                {prefs.defaultDifficulty === 'Custom' && (
                  <div className="mt-3 p-3 rounded-xl bg-[#131B2E] border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-300 flex items-center gap-1">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Özel İpucu Sayısı: {prefs.defaultCustomClues}</span>
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        {81 - prefs.defaultCustomClues} Boş Hücre
                      </span>
                    </div>
                    <input
                      type="range"
                      min={17}
                      max={65}
                      step={1}
                      value={prefs.defaultCustomClues}
                      onChange={(e) => handleUpdate('defaultCustomClues', Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>17 (Ekstrem)</span>
                      <span>36 (Standart)</span>
                      <span>65 (Başlangıç)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Default Mistake Limit */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <label className="font-semibold text-slate-100 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Varsayılan Hata Limiti</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Oyuncunun elenmeden önce yapabileceği maksimum hatalı sayı limiti.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '3 Hata (Standart)', val: 3 },
                    { label: '1 Hata (Ani Ölüm)', val: 1 },
                    { label: '5 Hata (Esnek)', val: 5 },
                    { label: 'Sınırsız (Pratik)', val: 0 },
                  ].map((opt) => {
                    const active = prefs.defaultMistakeLimit === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleUpdate('defaultMistakeLimit', opt.val)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                          active
                            ? 'bg-rose-500 text-white border-rose-400 font-bold shadow-md'
                            : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Feedback Mode */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <label className="font-semibold text-slate-100 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-sky-400" />
                    <span>Varsayılan Doğrulama Modu</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hatalı hamlelerin ne zaman denetleneceğini ve gösterileceğini seçin.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleUpdate('defaultFeedbackMode', 'instant')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      prefs.defaultFeedbackMode === 'instant'
                        ? 'bg-sky-500/15 border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                        : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-100 flex items-center justify-between">
                      <span>Anında Doğrulama (Standart)</span>
                      {prefs.defaultFeedbackMode === 'instant' && <Check className="w-4 h-4 text-sky-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Her hamle sunucu tarafından anında kontrol edilir ve hata anında sayılır.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('defaultFeedbackMode', 'delayed')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      prefs.defaultFeedbackMode === 'delayed'
                        ? 'bg-sky-500/15 border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                        : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-100 flex items-center justify-between">
                      <span>Gecikmeli / Rekabetçi Mod</span>
                      {prefs.defaultFeedbackMode === 'delayed' && <Check className="w-4 h-4 text-sky-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Hatalar yalnızca tahta tamamen doldurulduğunda kontrol edilir.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Görünüm & Tema */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Board Theme */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <label className="font-semibold text-slate-100 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-violet-400" />
                    <span>Varsayılan Tahta Teması</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sudoku ızgarasının ve aksan renklerinin genel görsel paletini seçin.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BOARD_THEME_LIST.map((theme) => {
                    const active = prefs.defaultTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleUpdate('defaultTheme', theme.id as BoardThemeId)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1A253F] border-amber-400 ring-1 ring-amber-400 shadow-sm'
                            : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Color preview swatch */}
                          <div
                            className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center font-bold text-xs text-white"
                            style={{
                              backgroundColor:
                                theme.id === 'midnight'
                                  ? '#1E293B'
                                  : theme.id === 'sunset'
                                  ? '#881337'
                                  : theme.id === 'emerald'
                                  ? '#064E3B'
                                  : theme.id === 'cyberpunk'
                                  ? '#581C87'
                                  : '#3E2723',
                            }}
                          >
                            9
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100">{theme.name}</div>
                            <div className="text-[10px] text-slate-400">{theme.tagline}</div>
                          </div>
                        </div>
                        {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zen Mode Default */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Varsayılan Zen Modu</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Oyun başladığında yan panelleri, sohbeti ve sıralama tablosunu otomatik gizleyerek tamamen tahtaya odaklanmanızı sağlar (Oyun sırasında 'Z' ile değiştirilebilir).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('defaultZenMode', !prefs.defaultZenMode)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.defaultZenMode ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  aria-label="Zen modu varsayılanı"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.defaultZenMode ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Radial Number Wheel */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Taktiksel Sayı Çarkı (Radial Wheel)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Hücreye tıklandığında veya dokunulduğunda parmak hizasında dairesel hızlı sayı seçim çarkını gösterir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('radialWheelEnabled', !prefs.radialWheelEnabled)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.radialWheelEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                  aria-label="Radyal çark aç/kapat"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.radialWheelEnabled ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Akıllı Asistan */}
          {activeTab === 'assist' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Highlight Conflicts */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 text-xs sm:text-sm">
                    Çakışan Sayıları Vurgula
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Aynı satır, sütun veya 3x3 kutuda yinelenen sayılar bulunduğunda uyarı aydınlatması yap.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('highlightConflicts', !prefs.highlightConflicts)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.highlightConflicts ? 'bg-sky-500' : 'bg-slate-700'
                  }`}
                  aria-label="Çakışmaları vurgula"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.highlightConflicts ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Highlight Matching Digits */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 text-xs sm:text-sm">
                    Eşleşen Rakamları Vurgula
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Seçilen hücredeki sayıyla aynı olan tüm tahta hücrelerini parlak renk ile aydınlat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('highlightMatchingDigits', !prefs.highlightMatchingDigits)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.highlightMatchingDigits ? 'bg-sky-500' : 'bg-slate-700'
                  }`}
                  aria-label="Eşleşen rakamları vurgula"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.highlightMatchingDigits ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Clear Notes */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 text-xs sm:text-sm">
                    Aday Notlarını Otomatik Temizle
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Bir hücreye doğru rakam yerleştirildiğinde, ilgili satır, sütun ve bloktaki kurşunkalem notlarını otomatik siler.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('autoClearNotes', !prefs.autoClearNotes)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.autoClearNotes ? 'bg-sky-500' : 'bg-slate-700'
                  }`}
                  aria-label="Notları otomatik temizle"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.autoClearNotes ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Ses & Titreşim */}
          {activeTab === 'audio' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Sound Effects */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                    {prefs.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>Ses Efektleri (SFX)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Hamle yerleştirme, silme, hata uyarısı ve galibiyet seslerini etkinleştirir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('soundEnabled', !prefs.soundEnabled)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.soundEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                  aria-label="Ses efektleri aç/kapat"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.soundEnabled ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Haptics */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Dokunsal Titreşim (Haptics)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    Desteklenen mobil cihazlarda rakam seçimi ve hatalarda hafif titreşim geri bildirimi verir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate('hapticsEnabled', !prefs.hapticsEnabled)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    prefs.hapticsEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                  aria-label="Dokunsal titreşim aç/kapat"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      prefs.hapticsEnabled ? 'translate-x-6 left-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Lo-Fi Background Music */}
              <div className="bg-[#0B0F17] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Arka Plan Lo-Fi Müziği (BGM)</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">
                      Odaklanmayı artıran hafif ambient piyano & lo-fi fon müziği çalar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdate('bgmEnabled', !prefs.bgmEnabled)}
                    className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      prefs.bgmEnabled ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                    aria-label="Arka plan müziği aç/kapat"
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                        prefs.bgmEnabled ? 'translate-x-6 left-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* BGM Volume Slider */}
                {prefs.bgmEnabled && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Müzik Ses Düzeyi</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {Math.round(prefs.bgmVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={prefs.bgmVolume}
                      onChange={(e) => handleUpdate('bgmVolume', parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0B0F17]/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Tüm ayarları orijinal fabrika varsayılanlarına döndür"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Varsayılanlara Sıfırla</span>
            <span className="sm:hidden">Sıfırla</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Ayarları Uygula & Kapat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
