/**
 * Hint orchestrator: scans the board and returns the easiest applicable
 * technique, or null if none of the supported techniques apply. Detectors are
 * tried in increasing difficulty so the player always learns the simplest next
 * move first.
 *
 * Every returned hint is guaranteed to change the board when applied — it
 * either places a value or removes at least one of the player's penciled notes.
 * A logically-correct hint that wouldn't actually change anything is skipped.
 */

import { allCandidates } from '../candidates';
import type { Board, CellIndex, Digit } from '../types';
import { detectNakedSingle } from './nakedSingle';
import { detectHiddenSingle } from './hiddenSingle';
import { detectNakedSubset } from './nakedSubset';
import { detectHiddenSubset } from './hiddenSubset';
import { detectPointingPair } from './pointingPair';
import { detectClaiming } from './claiming';
import { detectFish } from './fish';
import { detectXYWing } from './xyWing';
import { detectXYZWing } from './xyzWing';
import { detectWWing } from './wWing';
import { detectSkyscraper } from './skyscraper';
import { detectTwoStringKite } from './twoStringKite';
import { detectRemotePair } from './remotePair';
import { detectUniqueRectangle } from './uniqueRectangle';
import { detectUniqueRectangleType2 } from './uniqueRectangleType2';
import { detectUniqueRectangleType4 } from './uniqueRectangleType4';
import { detectEmptyRectangle } from './emptyRectangle';
import { detectBug1 } from './bug1';
import { detectSimpleColoring } from './simpleColoring';
import { detectAlsXz } from './alsXz';
import { detectAic } from './aic';
import { solveBoard, bruteForceHint } from './bruteForce';
import type { Hint, HintAction } from './types';

export type Detector = (board: Board, candidates: Map<CellIndex, Set<Digit>>) => Hint | null;

// Easiest → hardest. The first detector whose move actually changes the board
// wins, so the player always learns the simplest available technique. Exported
// so the offline difficulty grader (`src/domain/grade.ts`) drives the exact same
// ladder — one source of truth for "which techniques, in what order".
export const DETECTORS: Detector[] = [
  detectNakedSingle,
  detectHiddenSingle,
  (b, c) => detectNakedSubset(b, c, 2), // naked pair
  (b, c) => detectHiddenSubset(b, c, 2), // hidden pair
  detectPointingPair,
  detectClaiming,
  (b, c) => detectNakedSubset(b, c, 3), // naked triple
  (b, c) => detectHiddenSubset(b, c, 3), // hidden triple
  (b, c) => detectNakedSubset(b, c, 4), // naked quad
  (b, c) => detectHiddenSubset(b, c, 4), // hidden quad
  (b, c) => detectFish(b, c, 2), // X-Wing
  detectSkyscraper,
  detectTwoStringKite,
  detectEmptyRectangle,
  detectXYWing,
  detectXYZWing,
  detectWWing,
  (b, c) => detectFish(b, c, 3), // Swordfish
  (b, c) => detectFish(b, c, 4), // Jellyfish
  detectUniqueRectangle,
  detectUniqueRectangleType2,
  detectUniqueRectangleType4,
  detectRemotePair,
  detectBug1,
  detectSimpleColoring,
  detectAic, // X-Chain / XY-Chain / Nice Loops
  detectAlsXz,
];

/**
 * Return the easiest detector hint that actually changes `board`, or null if
 * none of the supported techniques apply. When `solution` is provided, unsound
 * hints (a placement that contradicts the solution, or an elimination that drops
 * a solution digit) are skipped — a guard against any detector bug.
 *
 * Shared by `findHint` (app) and the offline grader, which supplies its own
 * `candidates` map so eliminations accumulate across steps.
 */
export function firstApplicableHint(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  solution: Digit[] | null,
): Hint | null {
  for (const detect of DETECTORS) {
    const hint = detect(board, candidates);
    if (!hint || !actionChangesBoard(board, hint.action)) continue;
    if (solution && !isHintSound(hint, solution)) continue;
    return hint;
  }
  return null;
}

export function findHint(board: Board): Hint | null {
  const candidates = allCandidates(board);
  // The unique solution doubles as a soundness check: a placement must match it
  // and an elimination must never remove a solution digit. This guards against
  // any detector bug — an unsound hint is skipped rather than shown.
  const solution = solveBoard(board);

  const hint = firstApplicableHint(board, candidates, solution);
  if (hint) return hint;

  // Nothing learnable applies — fall back to a guaranteed (validated) placement.
  if (solution) return bruteForceHint(board, solution);
  return null;
}

/** True if applying the action would place a value or remove an existing note. */
function actionChangesBoard(board: Board, action: HintAction): boolean {
  if (action.kind === 'place') {
    return (action.placements ?? []).some(
      ({ index, digit }) => !board[index].given && board[index].value !== digit,
    );
  }
  return (action.eliminations ?? []).some(
    ({ index, digit }) => board[index].notes.has(digit),
  );
}

/** A placement must match the solution; an elimination must not drop a solution digit. */
function isHintSound(hint: Hint, solution: Digit[]): boolean {
  if (hint.action.kind === 'place') {
    return (hint.action.placements ?? []).every((p) => solution[p.index] === p.digit);
  }
  return (hint.action.eliminations ?? []).every((e) => solution[e.index] !== e.digit);
}
