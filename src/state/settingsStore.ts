/**
 * Persisted user settings: selected theme, default fast mode, note validation.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mmkvStateStorage } from './persist';
import { DEFAULT_THEME_KEY } from '../ui/theme/themes';

interface SettingsState {
  themeKey: string;
  /** Whether Fast Mode (number-first) starts enabled. */
  fastModeDefault: boolean;
  /** Block illegal pencil notes. */
  validateNotes: boolean;
  /** Cap on mistakes before the game is lost (0 = unlimited). */
  maxMistakes: number;
  onboardingSeen: boolean;
  diagnosticsEnabled: boolean;
  replayEnabled: boolean;

  setThemeKey: (key: string) => void;
  setFastModeDefault: (v: boolean) => void;
  setValidateNotes: (v: boolean) => void;
  setMaxMistakes: (v: number) => void;
  setOnboardingSeen: (v: boolean) => void;
  setDiagnosticsEnabled: (v: boolean) => void;
  setReplayEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeKey: DEFAULT_THEME_KEY,
      fastModeDefault: false,
      validateNotes: true,
      maxMistakes: 3,
      onboardingSeen: false,
      diagnosticsEnabled: true,
      replayEnabled: true,

      setThemeKey: (themeKey) => set({ themeKey }),
      setFastModeDefault: (fastModeDefault) => set({ fastModeDefault }),
      setValidateNotes: (validateNotes) => set({ validateNotes }),
      setMaxMistakes: (maxMistakes) => set({ maxMistakes }),
      setOnboardingSeen: (onboardingSeen) => set({ onboardingSeen }),
      setDiagnosticsEnabled: (diagnosticsEnabled) => set({ diagnosticsEnabled }),
      setReplayEnabled: (replayEnabled) => set({ replayEnabled }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
