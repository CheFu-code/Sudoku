/**
 * Zustand `persist` storage adapter. MMKV was removed to keep the app booting
 * cleanly in Expo Go. This uses a simple in-memory fallback for settings.
 */
import type { StateStorage } from 'zustand/middleware';

const storage = new Map<string, string>();

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.get(name) ?? null,
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.delete(name);
  },
};
