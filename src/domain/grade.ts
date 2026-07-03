/**
 * Offline difficulty grader — pure TypeScript, no framework/storage imports.
 *
 * Grades a puzzle the way serious Sudoku apps and the community-standard SE
 * (Sudoku Explainer) rating do: by *the hardest solving technique required*,
 * not by clue count. It drives the exact same technique ladder the in-app Smart
 * Hint uses (`DETECTORS` in `hints/findHint.ts`) in a solve loop, records every
 * technique applied, and maps the hardest one to a difficulty tier.
 *
 * Used only at dev time by `scripts/build-puzzle-bank.ts` to bucket the bundled
 * banks. Never imported by the app runtime, but lives in `domain/` because it is
 * pure and unit-testable.
 */

import { createBoard, isComplete } from './board';
import { allCandidates } from './candidates';
import { applyEliminations, placeValue } from './engine';
import { firstApplicableHint } from './hints/findHint';
import { solveBoard } from './hints/bruteForce';
import type { TechniqueId } from './hints/types';
import type { Board, CellIndex, Difficulty, Digit } from './types';

/**
 * Which tier each technique lands a puzzle in when it is the hardest one needed.
 * Ordered easy → diabolical, roughly following the SE difficulty progression:
 *   singles → locked candidates/pairs → triples+basic fish/wings →
 *   quads/big fish/URs → chains/coloring/ALS → beyond our detectors.
 */
export const TECHNIQUE_TIER: Record<TechniqueId, Difficulty> = {
  naked_single: 'easy',
  hidden_single: 'easy',

  naked_pair: 'medium',
  hidden_pair: 'medium',
  pointing_pair: 'medium',
  claiming: 'medium',

  naked_triple: 'hard',
  hidden_triple: 'hard',
  x_wing: 'hard',
  xy_wing: 'hard',

  naked_quad: 'expert',
  hidden_quad: 'expert',
  skyscraper: 'expert',
  two_string_kite: 'expert',
  empty_rectangle: 'expert',
  xyz_wing: 'expert',
  w_wing: 'expert',
  swordfish: 'expert',
  jellyfish: 'expert',
  unique_rectangle: 'expert',
  unique_rectangle_2: 'expert',
  unique_rectangle_4: 'expert',

  remote_pair: 'extreme',
  bug1: 'extreme',
  simple_coloring: 'extreme',
  aic: 'extreme',

  // ALS-XZ is the hardest technique our ladder reaches, and a puzzle that stalls
  // needs something beyond it (or trial-and-error). Both are the truly brutal
  // grids that define the top tier.
  als_xz: 'diabolical',
  brute_force: 'diabolical',
};

/**
 * Approximate SE (Sudoku Explainer) rating anchor per technique, used as the
 * numeric `rating` and to break ties within a tier. Not authoritative — the
 * `scripts/serate-check.ts` spot-check calibrates these against a real SE rater.
 */
export const TECHNIQUE_RATING: Record<TechniqueId, number> = {
  hidden_single: 1.5,
  naked_single: 2.3,
  pointing_pair: 2.6,
  claiming: 2.8,
  naked_pair: 3.0,
  x_wing: 3.2,
  hidden_pair: 3.4,
  naked_triple: 3.6,
  swordfish: 3.8,
  hidden_triple: 4.0,
  skyscraper: 4.0,
  two_string_kite: 4.0,
  xy_wing: 4.2,
  xyz_wing: 4.4,
  w_wing: 4.4,
  empty_rectangle: 4.5,
  unique_rectangle: 4.5,
  unique_rectangle_2: 4.6,
  unique_rectangle_4: 4.7,
  naked_quad: 5.0,
  remote_pair: 5.0,
  simple_coloring: 5.0,
  jellyfish: 5.2,
  hidden_quad: 5.4,
  bug1: 5.6,
  aic: 7.0,
  als_xz: 7.5,
  brute_force: 9.0,
};

const TIER_SEVERITY: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  expert: 3,
  extreme: 4,
  diabolical: 5,
};

export interface GradeResult {
  /** The puzzle has a (found) solution. When false, the other fields are moot. */
  solvable: boolean;
  /** The technique ladder solved it outright (no stall / brute-force needed). */
  solved: boolean;
  tier: Difficulty;
  /** SE-aligned numeric rating (see `TECHNIQUE_RATING`), one decimal. */
  rating: number;
  hardestTechnique: TechniqueId;
  /** How many times each technique fired during the solve. */
  techniqueCounts: Partial<Record<TechniqueId, number>>;
}

/** Snapshot every empty cell's legal candidates into that cell's pencil notes. */
function seedNotes(board: Board): Board {
  const cands = allCandidates(board);
  return board.map((cell, i) =>
    cell.value === null ? { ...cell, notes: new Set(cands.get(i)) } : cell,
  );
}

/** Build the candidate map the detectors expect from the board's current notes. */
function candidatesFromNotes(board: Board): Map<CellIndex, Set<Digit>> {
  const map = new Map<CellIndex, Set<Digit>>();
  for (let i = 0; i < board.length; i++) {
    if (board[i].value === null) map.set(i, new Set(board[i].notes));
  }
  return map;
}

// Safety cap: a correct solve needs < 200 steps; this only guards against a
// detector that reports a "changing" move that doesn't actually converge.
const MAX_STEPS = 400;

/**
 * Grade a puzzle from its 81-char givens string ('.' or '0' for blanks).
 *
 * Solves by repeatedly applying the easiest available human technique, tracking
 * pencil-mark eliminations across steps (so chains/coloring build on prior
 * work), and returns the tier of the hardest technique required. If the ladder
 * can't finish, the puzzle is `diabolical` (needs a technique beyond our set).
 */
export function gradePuzzle(givens: string): GradeResult {
  const unsolvable: GradeResult = {
    solvable: false,
    solved: false,
    tier: 'diabolical',
    rating: 0,
    hardestTechnique: 'brute_force',
    techniqueCounts: {},
  };

  // A valid Sudoku needs ≥17 clues for a unique solution. Reject sparser input
  // up front: `solveBoard` can churn for a very long time trying to prove a
  // near-empty grid unsolvable, and the build reads a hand-editable seed file.
  const clues = givens.replace(/[.0]/g, '').length;
  if (clues < 17) return unsolvable;

  let board = createBoard(givens);
  const solution = solveBoard(board);
  if (!solution) return unsolvable;

  board = seedNotes(board);
  const counts: Partial<Record<TechniqueId, number>> = {};

  let stalled = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (isComplete(board)) break;

    const candidates = candidatesFromNotes(board);
    const hint = firstApplicableHint(board, candidates, solution);
    if (!hint) {
      stalled = true;
      break;
    }
    counts[hint.technique] = (counts[hint.technique] ?? 0) + 1;

    let next: Board | null = null;
    if (hint.action.kind === 'place') {
      let b = board;
      for (const { index, digit } of hint.action.placements ?? []) {
        const res = placeValue(b, index, digit, true);
        if (res) b = res.board;
      }
      next = b === board ? null : b;
    } else {
      const res = applyEliminations(board, hint.action.eliminations ?? []);
      next = res?.board ?? null;
    }
    if (!next) {
      stalled = true; // move reported a change but produced none — bail safely
      break;
    }
    board = next;
  }

  const solved = !stalled && isComplete(board);

  // Diabolical: couldn't finish with the supported ladder.
  if (!solved) {
    return {
      solvable: true,
      solved: false,
      tier: 'diabolical',
      rating: TECHNIQUE_RATING.brute_force,
      hardestTechnique: 'brute_force',
      techniqueCounts: counts,
    };
  }

  // Hardest technique = highest tier used, ties broken by SE rating.
  const used = Object.keys(counts) as TechniqueId[];
  const hardest = used.reduce((best, t) => {
    const bySeverity =
      TIER_SEVERITY[TECHNIQUE_TIER[t]] - TIER_SEVERITY[TECHNIQUE_TIER[best]];
    if (bySeverity > 0) return t;
    if (bySeverity === 0 && TECHNIQUE_RATING[t] > TECHNIQUE_RATING[best]) return t;
    return best;
  }, used[0] ?? 'naked_single');

  const tier = TECHNIQUE_TIER[hardest];
  // Recurrence bump: a puzzle that needs its hardest technique repeatedly is
  // tougher than one that needs it once. Small, capped, never crosses a tier.
  const topTierUses = used
    .filter((t) => TECHNIQUE_TIER[t] === tier)
    .reduce((sum, t) => sum + (counts[t] ?? 0), 0);
  const bump = Math.min(0.6, 0.1 * Math.max(0, topTierUses - 1));
  const rating = Math.round((TECHNIQUE_RATING[hardest] + bump) * 10) / 10;

  return {
    solvable: true,
    solved: true,
    tier,
    rating,
    hardestTechnique: hardest,
    techniqueCounts: counts,
  };
}
