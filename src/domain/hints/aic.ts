/**
 * Alternating Inference Chain (AIC). Nodes are candidates (cell, digit) linked
 * by strong links (in a bivalue cell, or a digit with two places in a unit) and
 * weak links (two candidates that can't both be true). A chain that starts and
 * ends on strong links proves "endpoint A is true OR endpoint B is true", so any
 * candidate that sees (is weakly linked to) both endpoints can be eliminated.
 *
 * This single engine subsumes X-Chains, XY-Chains and Nice Loops. The graph
 * search lives in `chain/chainEngine.ts`; here we run it with group nodes off.
 * The grouped variant (`grouped_aic`) surfaces on a later rung.
 */

import type { Board, CellIndex, Digit } from '../types';
import { detectChain } from './chain/chainEngine';
import type { Hint } from './types';

export function detectAic(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  return detectChain(board, candidates, { grouped: false });
}
