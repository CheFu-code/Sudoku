import type { KeyValueStore } from './KeyValueStore';

/** MMKV-backed key-value store used in the running app. If the native module is
 * unavailable (for example in Expo Go), we fall back to an in-memory map so the
 * app can still boot safely.
 */
export class MmkvKeyValueStore implements KeyValueStore {
  private readonly mmkv: {
    getString: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
  };

  constructor(id = 'sudoku') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
      this.mmkv = createMMKV({ id });
    } catch (error) {
      console.warn('react-native-mmkv unavailable; using in-memory fallback for key-value storage.', error);
      const map = new Map<string, string>();
      this.mmkv = {
        getString: (key) => map.get(key),
        set: (key, value) => map.set(key, value),
        remove: (key) => map.delete(key),
      };
    }
  }

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }

  set(key: string, value: string): void {
    this.mmkv.set(key, value);
  }

  delete(key: string): void {
    this.mmkv.remove(key);
  }
}
