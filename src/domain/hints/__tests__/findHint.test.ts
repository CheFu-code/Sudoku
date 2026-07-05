/**
 * `findHint` pipeline tests: the mistake / missing-note pre-checks, the
 * notes-aware candidate map, and the chaining regression — a chain-tier puzzle
 * must play through hint-by-hint without ever falling back to Last Resort.
 */

import { createBoard, isComplete } from '../../board';
import { applyEliminations, applyAutoNotes, placeValue, toggleNote } from '../../engine';
import type { Board, Digit } from '../../types';
import { findHint, hintCandidates } from '../findHint';
import type { Hint } from '../types';

// A real bank puzzle whose grader solve needs chained eliminations (AIC, SE 7.1)
// — the exact shape that used to dead-end into "Last Resort" in-app.
const AIC_GIVENS =
  '8..9........524.....5.1.67..2......45.17....3.......164....8..1....6...7......89.';
const AIC_SOLUTION =
  '813976425697524138245813679329681754561749283784235916472398561958162347136457892';

/** Apply a hint's action the way gameStore.applyHint does. */
function apply(board: Board, hint: Hint): Board {
  const a = hint.action;
  switch (a.kind) {
    case 'place':
      return placeValue(board, a.placements![0].index, a.placements![0].digit, true)!.board;
    case 'eliminate':
      return applyEliminations(board, a.eliminations ?? [], true)!.board;
    case 'erase':
      return createBoardWithErased(board, a.cells![0]);
    case 'add_note':
      return toggleNote(board, a.additions![0].index, a.additions![0].digit, false)!.board;
  }
}

function createBoardWithErased(board: Board, index: number): Board {
  const next = board.slice();
  next[index] = { value: null, given: false, notes: new Set() };
  return next;
}

/** Loop findHint→apply to completion; return the techniques used. */
function playThrough(board: Board, solution: string, maxSteps = 400): string[] {
  const used: string[] = [];
  for (let step = 0; step < maxSteps; step++) {
    if (isComplete(board)) return used;
    const hint = findHint(board, solution);
    expect(hint).not.toBeNull();
    used.push(hint!.technique);
    board = apply(board, hint!);
  }
  throw new Error(`did not complete within ${maxSteps} steps`);
}

describe('mistake pre-check', () => {
  it('points at a wrong placed value before anything else', () => {
    let board = createBoard(AIC_GIVENS);
    // Solution at index 1 is 1 — place a wrong 3 there.
    board = placeValue(board, 1, 3)!.board;
    const hint = findHint(board, AIC_SOLUTION);
    expect(hint?.technique).toBe('mistake');
    expect(hint?.action).toEqual({ kind: 'erase', cells: [1] });
  });

  it('detects the mistake from the givens alone when no solution is passed', () => {
    let board = createBoard(AIC_GIVENS);
    board = placeValue(board, 1, 3)!.board;
    const hint = findHint(board);
    expect(hint?.technique).toBe('mistake');
    expect(hint?.action.cells).toEqual([1]);
  });

  it('never validates hints against the poisoned board solve', () => {
    // With a wrong value placed, the old behavior re-solved the altered board;
    // now the mistake surfaces instead of a technique reasoned from it.
    let board = createBoard(AIC_GIVENS);
    board = placeValue(board, 2, Number(AIC_SOLUTION[1]) as Digit)!.board; // wrong cell
    expect(findHint(board, AIC_SOLUTION)?.technique).toBe('mistake');
  });
});

describe('missing-note pre-check', () => {
  it('flags a notes-set missing its solution digit, with exactly that digit', () => {
    let board = createBoard(AIC_GIVENS);
    board = applyAutoNotes(board)!.board;
    const target = board.findIndex((c) => c.value === null);
    const sol = Number(AIC_SOLUTION[target]) as Digit;
    board = toggleNote(board, target, sol, false)!.board; // remove the true digit
    const hint = findHint(board, AIC_SOLUTION);
    expect(hint?.technique).toBe('missing_note');
    expect(hint?.action).toEqual({
      kind: 'add_note',
      additions: [{ index: target, digit: sol }],
    });
  });

  it('does not flag omission of a non-solution digit (a legitimate elimination)', () => {
    let board = createBoard(AIC_GIVENS);
    board = applyAutoNotes(board)!.board;
    const target = board.findIndex(
      (c, i) => c.value === null && c.notes.size > 1 && AIC_SOLUTION[i] !== '0',
    );
    const wrong = [...board[target].notes].find(
      (d) => d !== Number(AIC_SOLUTION[target]),
    )!;
    board = toggleNote(board, target, wrong, false)!.board;
    expect(findHint(board, AIC_SOLUTION)?.technique).not.toBe('missing_note');
  });

  it('runs only after the mistake check', () => {
    let board = createBoard(AIC_GIVENS);
    board = applyAutoNotes(board)!.board;
    const noteCell = board.findIndex((c) => c.value === null);
    board = toggleNote(board, noteCell, Number(AIC_SOLUTION[noteCell]) as Digit, false)!.board;
    const empty = board.findIndex((c, i) => c.value === null && i !== noteCell);
    board = placeValue(board, empty, ((Number(AIC_SOLUTION[empty]) % 9) + 1) as Digit)!.board;
    expect(findHint(board, AIC_SOLUTION)?.technique).toBe('mistake');
  });
});

describe('hintCandidates', () => {
  it('intersects notes with legal candidates, full candidates when note-less', () => {
    let board = createBoard(AIC_GIVENS);
    const target = board.findIndex((c) => c.value === null);
    const full = hintCandidates(board).get(target)!;
    expect(full.size).toBeGreaterThan(0);

    // Pencil a strict subset → the map reflects the player's claim.
    const subset = [...full].slice(0, 1);
    board = toggleNote(board, target, subset[0], false)!.board;
    expect([...hintCandidates(board).get(target)!]).toEqual(subset);
  });
});

describe('chaining regression — no Last Resort on ladder-solvable puzzles', () => {
  it('plays an AIC-tier extreme puzzle to completion with auto-notes', () => {
    let board = createBoard(AIC_GIVENS);
    board = applyAutoNotes(board)!.board;
    const used = playThrough(board, AIC_SOLUTION);
    expect(used).not.toContain('brute_force');
    expect(used).not.toContain('mistake');
    expect(used).not.toContain('missing_note');
  });

  it('plays the same puzzle to completion with no notes at all', () => {
    const board = createBoard(AIC_GIVENS);
    const used = playThrough(board, AIC_SOLUTION);
    expect(used).not.toContain('brute_force');
  });
});
