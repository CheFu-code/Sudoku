import { DIGITS } from './types';
import type { Board, CellIndex, Digit } from './types';
import { PEERS } from './rules';

export function candidatesFor(board: Board, index: CellIndex): Digit[] {
  if (board[index].value !== null) return [];
  const used = new Set<Digit>();
  for (const peer of PEERS[index]) {
    const v = board[peer].value;
    if (v !== null) used.add(v);
  }
  return DIGITS.filter((d) => !used.has(d));
}

/**
 * Candidates for every empty cell, keyed by index. Powers "Fast Pencil".
 */
export function allCandidates(board: Board): Map<CellIndex, Set<Digit>> {
  const result = new Map<CellIndex, Set<Digit>>();
  for (let i = 0; i < board.length; i++) {
    if (board[i].value === null) {
      result.set(i, new Set(candidatesFor(board, i)));
    }
  }
  return result;
}
