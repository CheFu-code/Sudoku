import type { Difficulty } from '../../domain/types';

/**
 * Serializable snapshot of an in-progress game. Boards are stored as compact
 * strings; notes as an index->digits map. The store layer owns (de)serializing
 * to/from the live domain `Board`.
 */
export interface SavedGame {
  puzzleId: string;
  difficulty: Difficulty;
  /** 81-char givens (immutable clues). */
  givens: string;
  /** 81-char current values ('.' for empty). */
  values: string;
  /** Pencil notes: cell index -> array of digits. */
  notes: Record<number, number[]>;
  /** Elapsed seconds. */
  elapsed: number;
  mistakes: number;
  /** Smart hints opened this game (informational). Absent on older saves. */
  hintsUsed?: number;
  /** Serialized undo history (opaque to the repository). */
  history: unknown;
  updatedAt: number;
}

/** Persistence for the single in-progress game and played-puzzle tracking. */
export interface GameStorageRepository {
  saveGame(game: SavedGame): void;
  loadGame(): SavedGame | undefined;
  clearGame(): void;

  getPlayedIds(): string[];
  markPlayed(id: string): void;
  clearPlayed(): void;
}
