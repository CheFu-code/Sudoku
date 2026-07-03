/**
 * Domain types — pure TypeScript, no framework/storage imports.
 *
 * The board is a flat 81-cell array indexed by `row * 9 + col`.
 */

import type { TechniqueId } from './hints/types';

export type Difficulty =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'extreme'
  | 'diabolical';

export const DIFFICULTIES: Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'extreme',
  'diabolical',
];

/** A digit that can be placed in a cell (1-9). */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Flat board index, 0-80. */
export type CellIndex = number;

export interface Cell {
  /** The placed value, or null if empty. Givens also use `value`. */
  value: Digit | null;
  /** True for clues that ship with the puzzle and cannot be edited. */
  given: boolean;
  /** Pencil-mark candidates. Empty when a value is placed. */
  notes: Set<Digit>;
}

/** A full board is exactly 81 cells. */
export type Board = Cell[];

/** A raw puzzle as loaded from the bundled bank. */
export interface Puzzle {
  id: string;
  difficulty: Difficulty;
  /** 81-char string; digits 1-9 are givens, '.' or '0' are blanks. */
  givens: string;
  /** 81-char string of the unique solution. */
  solution: string;
  /**
   * Difficulty rating from the offline grader (SE-aligned; see
   * `src/domain/grade.ts`). Optional so pre-grading banks still load. Not shown
   * in the UI — used for grading/analysis.
   */
  rating?: number;
  /** The hardest solving technique the grader needed. Optional (see `rating`). */
  hardestTechnique?: TechniqueId;
}

/**
 * A reversible action. We store the *previous* state of the affected cell so
 * undo is a simple snapshot restore. Fast Pencil is one move touching many
 * cells, hence the array.
 */
export interface Move {
  type: 'place' | 'note' | 'erase' | 'autoNotes';
  /** Snapshots of cells *before* the move, keyed by index. */
  before: { index: CellIndex; cell: Cell }[];
  /** Snapshots of cells *after* the move (for redo). */
  after: { index: CellIndex; cell: Cell }[];
}
