import { DifficultyLevel } from '../types/game.ts';
import { BoardThemeId } from './boardThemes.ts';

export interface UserGamePreferences {
  // Default Game Rules & Setup
  defaultDifficulty: DifficultyLevel;
  defaultCustomClues: number;
  defaultMistakeLimit: number; // 0 = unlimited, 1, 3, 5, 10
  defaultFeedbackMode: 'instant' | 'delayed';

  // Board & Visuals
  defaultTheme: BoardThemeId;
  defaultZenMode: boolean;
  radialWheelEnabled: boolean;

  // Assistance & Helpers
  highlightConflicts: boolean;
  highlightMatchingDigits: boolean;
  autoClearNotes: boolean;

  // Audio & Haptics
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  bgmEnabled: boolean;
  bgmVolume: number; // 0.0 to 1.0
}

export const DEFAULT_GAME_PREFERENCES: UserGamePreferences = {
  defaultDifficulty: 'Medium',
  defaultCustomClues: 40,
  defaultMistakeLimit: 3,
  defaultFeedbackMode: 'instant',
  defaultTheme: 'midnight',
  defaultZenMode: false,
  radialWheelEnabled: true,
  highlightConflicts: true,
  highlightMatchingDigits: true,
  autoClearNotes: true,
  soundEnabled: true,
  hapticsEnabled: true,
  bgmEnabled: false,
  bgmVolume: 0.35,
};

const STORAGE_KEY = 'nueve_sudoku_game_preferences';

export function loadGamePreferences(): UserGamePreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_GAME_PREFERENCES };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy standalone keys for backward compatibility
      const legacyTheme = localStorage.getItem('nueve_board_theme') as BoardThemeId | null;
      const legacyZen = localStorage.getItem('sudoku_zen_mode') === 'true';
      const legacyRadial = localStorage.getItem('nueve_radial_wheel_enabled');
      const legacyMistakeLimit = localStorage.getItem('nueve_default_mistake_limit');
      const legacyFeedback = localStorage.getItem('nueve_default_feedback_mode') as 'instant' | 'delayed' | null;

      const merged: UserGamePreferences = {
        ...DEFAULT_GAME_PREFERENCES,
        defaultTheme: legacyTheme || DEFAULT_GAME_PREFERENCES.defaultTheme,
        defaultZenMode: legacyZen,
        radialWheelEnabled: legacyRadial !== null ? legacyRadial === 'true' : DEFAULT_GAME_PREFERENCES.radialWheelEnabled,
        defaultMistakeLimit: legacyMistakeLimit ? Number(legacyMistakeLimit) : DEFAULT_GAME_PREFERENCES.defaultMistakeLimit,
        defaultFeedbackMode: legacyFeedback || DEFAULT_GAME_PREFERENCES.defaultFeedbackMode,
      };
      return merged;
    }

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GAME_PREFERENCES,
      ...parsed,
    };
  } catch (err) {
    console.warn('Failed to load game preferences from localStorage:', err);
    return { ...DEFAULT_GAME_PREFERENCES };
  }
}

export function saveGamePreferences(prefs: UserGamePreferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    // Also sync legacy keys so existing components read seamlessly
    localStorage.setItem('nueve_board_theme', prefs.defaultTheme);
    localStorage.setItem('sudoku_zen_mode', String(prefs.defaultZenMode));
    localStorage.setItem('nueve_radial_wheel_enabled', String(prefs.radialWheelEnabled));
    localStorage.setItem('nueve_default_mistake_limit', String(prefs.defaultMistakeLimit));
    localStorage.setItem('nueve_default_feedback_mode', prefs.defaultFeedbackMode);

    // Dispatch custom event for real-time reactivity across components
    window.dispatchEvent(new CustomEvent('sudoku_preferences_changed', { detail: prefs }));
  } catch (err) {
    console.warn('Failed to save game preferences to localStorage:', err);
  }
}
