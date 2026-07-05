/**
 * Board-state checks that run before the technique ladder — pure TypeScript.
 *
 * These aren't solving techniques: they repair the two board states that make
 * note-based reasoning unsound. A wrongly placed value poisons every peer's
 * candidates, and a notes-set missing its cell's solution digit can fake a
 * "single" or stall the ladder. `findHint` fires these first so every
 * technique hint that follows reasons from a trustworthy board.
 */

import type { Board, CellIndex, Digit } from '../types';
import type { Hint } from './types';

/**
 * The first wrongly placed (non-given) value, or null. Lowest index wins so
 * repeated hint requests are deterministic.
 */
export function findMistake(board: Board, solution: Digit[]): CellIndex | null {
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (!cell.given && cell.value !== null && cell.value !== solution[i]) {
      return i;
    }
  }
  return null;
}

/**
 * The first empty cell whose penciled notes omit its own solution digit, or
 * null. Notes being a *subset* of the legal candidates is normal — technique
 * eliminations produce exactly that — but omitting the solution digit is the
 * one omission no elimination can ever justify, and it breaks reasoning built
 * on the notes.
 */
export function findMissingNote(
  board: Board,
  solution: Digit[],
): { index: CellIndex; digit: Digit } | null {
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (cell.value === null && cell.notes.size > 0 && !cell.notes.has(solution[i])) {
      return { index: i, digit: solution[i] };
    }
  }
  return null;
}

/** Point out a wrongly placed value. Apply erases it — it never reveals the answer. */
export function mistakeHint(board: Board, index: CellIndex): Hint {
  const wrong = board[index].value!;
  return {
    technique: 'mistake',
    title: 'Check This Cell',
    steps: [
      {
        text: [
          { text: 'The ' },
          { text: String(wrong), emphasis: true },
          { text: " in this cell can't be right — it blocks the puzzle's single solution." },
        ],
        annotations: { [index]: { tint: 'focus' } },
      },
      {
        text: [
          { text: 'Remove it, then re-check the notes around it — a wrong value hides ' },
          { text: 'legal candidates', emphasis: true },
          { text: ' from every cell it sees.' },
        ],
        annotations: { [index]: { tint: 'target' } },
      },
    ],
    action: { kind: 'erase', cells: [index] },
  };
}

/** Point out a penciled cell whose notes omit a still-possible digit. */
export function missingNoteHint(index: CellIndex, digit: Digit): Hint {
  return {
    technique: 'missing_note',
    title: 'Missing Pencil Mark',
    steps: [
      {
        text: [
          {
            text: 'Your pencil marks in this cell are missing a digit that is still possible — reasoning from incomplete notes can mislead you.',
          },
        ],
        annotations: { [index]: { tint: 'focus' } },
      },
      {
        text: [
          { text: String(digit), emphasis: true },
          { text: ' can still go in this cell. Add it to your notes before continuing.' },
        ],
        annotations: { [index]: { tint: 'target', ghost: digit } },
      },
    ],
    action: { kind: 'add_note', additions: [{ index, digit }] },
  };
}
