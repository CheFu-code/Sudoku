/**
 * Zustand `persist` storage adapter. MMKV was removed to keep the app booting
 * cleanly in Expo Go. This uses a simple in-memory fallback for settings.
 */
import type { StateStorage } from 'zustand/middleware';
import { MmkvKeyValueStore } from '../data/kv/MmkvKeyValueStore';

const storage = new MmkvKeyValueStore('sudoku-settings');

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
};
