import type { KeyValueStore } from './KeyValueStore';

/** In-memory key-value store used to keep the app working in Expo Go without a
 * native MMKV dependency.
 */
export class MmkvKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  constructor(_id = 'sudoku') {
    // no-op: intentionally kept simple for Expo Go compatibility
  }

  getString(key: string): string | undefined {
    return this.values.get(key);
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}
