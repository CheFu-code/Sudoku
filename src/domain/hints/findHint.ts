/**
 * Hint orchestrator: scans the board and returns the easiest applicable
 * technique, or null if none of the supported techniques apply. Detectors are
 * tried in increasing difficulty so the player always learns the simplest next
 * move first.
 *
 * Before the ladder runs, two board-state checks fire (see `boardChecks.ts`):
 * a wrongly placed value is pointed out, and a notes-set missing its solution
 * digit gets that digit back. After those, detectors reason from the player's
 * accumulated notes (`hintCandidates`), so eliminations from earlier hints
 * chain into later ones — exactly like the offline grader.
 *
 * Every returned hint is guaranteed to change the board when applied — it
 * either places a value or removes at least one of the player's penciled notes.
 * A logically-correct hint that wouldn't actually change anything is skipped.
 */

import { candidatesFor } from '../candidates';
import type { Board, Cell, CellIndex, Digit } from '../types';
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
import { detectFinnedFish } from './finnedFish';
import { detectUniqueRectangleType3 } from './uniqueRectangleType3';
import { detectUniqueRectangleType5 } from './uniqueRectangleType5';
import { detectUniqueRectangleType6 } from './uniqueRectangleType6';
import { detectHiddenRectangle } from './hiddenRectangle';
import { detectWxyzWing } from './wxyzWing';
import { detectMedusa3d } from './medusa3d';
import { detectGroupedAic } from './chain/chainEngine';
import { detectAlsChain, detectAlsXyWing } from './alsChain';
import {
  detectCellForcingChain,
  detectDynamicForcingChain,
  detectNishio,
  detectUnitForcingChain,
} from './forcingChains';
import { solveBoard, bruteForceHint } from './bruteForce';
import { findMissingNote, findMistake, mistakeHint, missingNoteHint } from './boardChecks';
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
  (b, c) => detectFinnedFish(b, c, 2), // Finned/Sashimi X-Wing
  detectSkyscraper,
  detectTwoStringKite,
  detectEmptyRectangle,
  detectXYWing,
  detectXYZWing,
  detectWWing,
  detectWxyzWing,
  (b, c) => detectFish(b, c, 3), // Swordfish
  (b, c) => detectFinnedFish(b, c, 3), // Finned Swordfish
  (b, c) => detectFish(b, c, 4), // Jellyfish
  (b, c) => detectFinnedFish(b, c, 4), // Finned Jellyfish
  detectUniqueRectangle,
  detectUniqueRectangleType2,
  detectUniqueRectangleType3,
  detectUniqueRectangleType4,
  detectUniqueRectangleType5,
  detectUniqueRectangleType6,
  detectHiddenRectangle,
  detectRemotePair,
  detectBug1,
  detectSimpleColoring,
  detectMedusa3d,
  detectAic, // X-Chain / XY-Chain / Nice Loops
  detectGroupedAic,
  detectAlsXz,
  detectAlsXyWing,
  detectAlsChain,
  // Forcing chains — the completeness rungs; only reached when everything
  // above stalls, and the reason "Last Resort" should essentially never fire.
  detectNishio,
  detectCellForcingChain,
  detectUnitForcingChain,
  detectDynamicForcingChain,
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

/**
 * The candidate map detectors reason from. Cells with penciled notes contribute
 * `notes ∩ legal candidates` — the player's accumulated eliminations, minus any
 * note gone stale (a peer value placed with note-validation off). Note-less
 * cells contribute their full legal candidates, so no-notes play still gets
 * every placement technique. Mirrors the grader's `candidatesFromNotes`, which
 * is what lets elimination hints chain across requests.
 */
export function hintCandidates(board: Board): Map<CellIndex, Set<Digit>> {
  const result = new Map<CellIndex, Set<Digit>>();
  for (let i = 0; i < board.length; i++) {
    if (board[i].value !== null) continue;
    const legal = candidatesFor(board, i);
    const notes = board[i].notes;
    result.set(
      i,
      notes.size > 0 ? new Set(legal.filter((d) => notes.has(d))) : new Set(legal),
    );
  }
  return result;
}

/**
 * Resolve the puzzle's true solution. Prefer the stored solution string; when
 * absent (older saves, tests), solve the *givens-only* board — never the
 * current one, whose wrong values would poison the result.
 */
function resolveSolution(board: Board, solutionStr?: string | null): Digit[] | null {
  if (solutionStr && solutionStr.length === board.length) {
    const parsed = [...solutionStr].map(Number);
    if (parsed.every((d) => d >= 1 && d <= 9)) return parsed as Digit[];
  }
  const givensOnly: Board = board.map(
    (cell): Cell =>
      cell.given ? cell : { value: null, given: false, notes: new Set() },
  );
  return solveBoard(givensOnly);
}

export function findHint(board: Board, solutionStr?: string | null): Hint | null {
  // The unique solution doubles as a soundness check: a placement must match it
  // and an elimination must never remove a solution digit. This guards against
  // any detector bug — an unsound hint is skipped rather than shown.
  const solution = resolveSolution(board, solutionStr);
  if (!solution) return null;

  // A wrong value corrupts every peer's candidates — surface it before anything.
  const mistake = findMistake(board, solution);
  if (mistake !== null) return mistakeHint(board, mistake);

  // Notes omitting their cell's solution digit make note-based reasoning
  // unsound; restore the specific missing digit before running the ladder.
  const missing = findMissingNote(board, solution);
  if (missing) return missingNoteHint(missing.index, missing.digit);

  const hint = firstApplicableHint(board, hintCandidates(board), solution);
  if (hint) return hint;

  // Nothing learnable applies — fall back to a guaranteed (validated) placement.
  return bruteForceHint(board, solution);
}

/** True if applying the action would visibly change the board. */
function actionChangesBoard(board: Board, action: HintAction): boolean {
  switch (action.kind) {
    case 'place':
      return (action.placements ?? []).some(
        ({ index, digit }) => !board[index].given && board[index].value !== digit,
      );
    case 'eliminate':
      // A note-less empty target still counts: Apply first pencils in the
      // cell's candidates, then strikes the eliminated ones (see
      // `applyEliminations`'s `seedEmptyTargets`).
      return (action.eliminations ?? []).some(
        ({ index, digit }) =>
          board[index].notes.has(digit) ||
          (board[index].value === null && board[index].notes.size === 0),
      );
    case 'erase':
      return (action.cells ?? []).some(
        (index) => !board[index].given && board[index].value !== null,
      );
    case 'add_note':
      return (action.additions ?? []).some(
        ({ index, digit }) =>
          board[index].value === null && !board[index].notes.has(digit),
      );
  }
}

/** A placement must match the solution; an elimination must not drop a solution digit. */
function isHintSound(hint: Hint, solution: Digit[]): boolean {
  switch (hint.action.kind) {
    case 'place':
      return (hint.action.placements ?? []).every((p) => solution[p.index] === p.digit);
    case 'eliminate':
      return (hint.action.eliminations ?? []).every((e) => solution[e.index] !== e.digit);
    case 'erase':
      // Removing a value never contradicts the solution.
      return true;
    case 'add_note':
      return (hint.action.additions ?? []).every((a) => solution[a.index] === a.digit);
  }
}
