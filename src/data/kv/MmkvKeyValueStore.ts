import type { KeyValueStore } from './KeyValueStore';
import Storage from 'expo-sqlite/kv-store';

/** Durable native storage backed by Expo SQLite, including in Expo Go. */
export class MmkvKeyValueStore implements KeyValueStore {
  private readonly prefix: string;

  constructor(id = 'sudoku') {
    this.prefix = `${id}:`;
  }

  getString(key: string): string | undefined {
    return Storage.getItemSync(this.prefix + key) ?? undefined;
  }

  set(key: string, value: string): void {
    Storage.setItemSync(this.prefix + key, value);
  }

  delete(key: string): void {
    Storage.removeItemSync(this.prefix + key);
  }
}
