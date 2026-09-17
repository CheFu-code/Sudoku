/**
 * Zustand `persist` storage adapter backed by MMKV when the native Nitro module
 * is available. Expo Go can fail to provide that module, so we fall back to an
 * in-memory store rather than crashing during app startup.
 */
import type { StateStorage } from 'zustand/middleware';

type NativeMmkvStorage = {
  getString?: (key: string) => string | undefined;
  set?: (key: string, value: string) => void;
  remove?: (key: string) => void;
};

type InMemoryStorage = StateStorage & {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createMemoryStorage(): InMemoryStorage {
  const map = new Map<string, string>();

  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

let storage: NativeMmkvStorage | InMemoryStorage | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  storage = createMMKV({ id: 'sudoku-settings' });
} catch (error) {
  console.warn('react-native-mmkv unavailable; using in-memory fallback for persistence.', error);
  storage = createMemoryStorage();
}

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => {
    if (!storage) return null;

    const mmkvStorage = storage as NativeMmkvStorage;
    if (typeof mmkvStorage.getString === 'function') {
      return mmkvStorage.getString(name) ?? null;
    }

    const memoryStorage = storage as InMemoryStorage;
    if (typeof memoryStorage.getItem === 'function') {
      return memoryStorage.getItem(name);
    }

    return null;
  },
  setItem: (name, value) => {
    if (!storage) return;

    const mmkvStorage = storage as NativeMmkvStorage;
    if (typeof mmkvStorage.set === 'function') {
      mmkvStorage.set(name, value);
      return;
    }

    const memoryStorage = storage as InMemoryStorage;
    if (typeof memoryStorage.setItem === 'function') {
      memoryStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    if (!storage) return;

    const mmkvStorage = storage as NativeMmkvStorage;
    if (typeof mmkvStorage.remove === 'function') {
      mmkvStorage.remove(name);
      return;
    }

    const memoryStorage = storage as InMemoryStorage;
    if (typeof memoryStorage.removeItem === 'function') {
      memoryStorage.removeItem(name);
    }
  },
};
