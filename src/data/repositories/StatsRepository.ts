import type { Difficulty } from '../../domain/types';
import type { HintStage, TechniqueId } from '../../domain/hints';

/**
 * Analytics seam — present from day one. Events are recorded locally now; a
 * future backend implementation forwards them to an API with no changes to the
 * call sites in the state layer.
 */
export type GameEvent =
  | { type: 'game_started'; difficulty: Difficulty; puzzleId: string }
  | { type: 'move_made'; moveType: string }
  | { type: 'mistake_made'; difficulty: Difficulty }
  | {
      type: 'hint_used';
      technique: TechniqueId;
      /** Furthest disclosure stage the player reached before closing/applying. */
      stageReached: HintStage;
      applied: boolean;
    }
  | {
      type: 'game_completed';
      difficulty: Difficulty;
      puzzleId: string;
      elapsed: number;
      mistakes: number;
    };

export interface AggregateStats {
  gamesCompleted: number;
  bestTimes: Partial<Record<Difficulty, number>>;
}

export interface StatsRepository {
  recordEvent(event: GameEvent & { at: number }): void;
  getStats(): AggregateStats;
}
