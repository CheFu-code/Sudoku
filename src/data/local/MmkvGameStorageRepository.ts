import type { KeyValueStore } from '../kv/KeyValueStore';
import type {
  GameStorageRepository,
  SavedGame,
} from '../repositories/GameStorageRepository';

const GAME_KEY = 'game:current';
const PLAYED_KEY = 'game:playedIds';

/**
 * KV-backed persistence for the in-progress game and played-puzzle ids. Works
 * with any KeyValueStore (MMKV in the app, in-memory in tests).
 */
export class MmkvGameStorageRepository implements GameStorageRepository {
  constructor(private readonly kv: KeyValueStore) {}

  saveGame(game: SavedGame): void {
    this.kv.set(GAME_KEY, JSON.stringify(game));
  }

  loadGame(): SavedGame | undefined {
    const raw = this.kv.getString(GAME_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as SavedGame;
    } catch {
      return undefined;
    }
  }

  clearGame(): void {
    this.kv.delete(GAME_KEY);
  }

  getPlayedIds(): string[] {
    const raw = this.kv.getString(PLAYED_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  markPlayed(id: string): void {
    const ids = this.getPlayedIds();
    if (!ids.includes(id)) {
      ids.push(id);
      this.kv.set(PLAYED_KEY, JSON.stringify(ids));
    }
  }

  clearPlayed(): void {
    this.kv.delete(PLAYED_KEY);
  }
}
