import { readFileSync } from 'fs';
import { join } from 'path';

import { createBoard } from '../../board';
import { allCandidates } from '../../candidates';
import { toggleNote } from '../../engine';
import type { Board, Digit } from '../../types';
import { detectAlsXyWing, detectAlsChain } from '../alsChain';

const EMPTY = '.'.repeat(81);

/**
 * Build a board + candidate map directly from a cell→digits spec (copied from
 * hints.test.ts): the ALS detectors read positions from the candidate map and
 * gate on the board's penciled notes, so this isolates one pattern.
 */
function scenario(spec: Record<number, number[]>): {
  board: Board;
  map: Map<number, Set<Digit>>;
} {
  let board = createBoard(EMPTY);
  const map = new Map<number, Set<Digit>>();
  for (const [k, ds] of Object.entries(spec)) {
    const i = Number(k);
    map.set(i, new Set(ds as Digit[]));
    for (const d of ds) board = toggleNote(board, i, d as Digit, false)!.board;
  }
  return { board, map };
}

/** Every cell annotated in step 0 must carry non-empty highlightNotes (the
 *  locate.ts presentation contract for elimination hints). */
function assertStep0HighlightsPattern(hint: {
  steps: { annotations: Record<number, { highlightNotes?: number[] }> }[];
}) {
  const entries = Object.entries(hint.steps[0].annotations);
  expect(entries.length).toBeGreaterThan(0);
  for (const [, a] of entries) {
    expect(a.highlightNotes && a.highlightNotes.length).toBeGreaterThan(0);
  }
}

describe('detectAlsXyWing', () => {
  // Three bivalue cells (single-cell ALSes) forming the classic wing:
  //   hinge (0,0)={1,2}; wing A (0,1)={1,3} links on 1; wing C (1,0)={2,3}
  //   links on 2. Wings share z=3, and (1,1)={3,4} sees both z-cells.
  const spec = { 0: [1, 2], 1: [1, 3], 9: [2, 3], 10: [3, 4] };

  it('finds the wing and strikes the shared digit from the seeing cell', () => {
    const { board, map } = scenario(spec);
    const hint = detectAlsXyWing(board, map);
    expect(hint?.technique).toBe('als_xy_wing');
    expect(hint?.title).toBe('ALS-XY-Wing');
    expect(hint?.action.kind).toBe('eliminate');
    expect(hint?.action.eliminations).toEqual([{ index: 10, digit: 3 }]);
    assertStep0HighlightsPattern(hint!);
  });

  it('is deterministic across calls', () => {
    const { board, map } = scenario(spec);
    const a = detectAlsXyWing(board, map);
    const b = detectAlsXyWing(board, map);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not fire when a wing no longer sees the hinge (RCC broken)', () => {
    // Move wing A off to (4,4): it no longer shares a unit with the hinge, so
    // the restricted common on 1 is gone and no wing can form.
    const { board, map } = scenario({ 0: [1, 2], 40: [1, 3], 9: [2, 3], 10: [3, 4] });
    expect(detectAlsXyWing(board, map)).toBeNull();
  });
});

describe('detectAlsChain', () => {
  // Four bivalue cells linked S1={1,4}-1-S2={1,2}-2-S3={2,3}-3-S4={3,4}, with
  // z=4 shared by the ends S1 (0,0) and S4 (1,0). Target (0,2)={4,5} sees both
  // end 4-cells (box 0), so it loses 4.
  const spec = { 0: [1, 4], 1: [1, 2], 10: [2, 3], 9: [3, 4], 2: [4, 5] };

  it('finds a 4-set chain and strikes the shared end digit', () => {
    const { board, map } = scenario(spec);
    const hint = detectAlsChain(board, map);
    expect(hint?.technique).toBe('als_chain');
    expect(hint?.title).toBe('ALS Chain');
    expect(hint?.action.kind).toBe('eliminate');
    expect(hint?.action.eliminations).toEqual([{ index: 2, digit: 4 }]);
    assertStep0HighlightsPattern(hint!);
  });

  it('is deterministic across calls', () => {
    const { board, map } = scenario(spec);
    const a = detectAlsChain(board, map);
    const b = detectAlsChain(board, map);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not fire on a 3-cell pattern (needs length ≥ 4, all disjoint)', () => {
    // Only three cells exist — four pairwise-disjoint sets are impossible.
    const { board, map } = scenario({ 0: [1, 2], 1: [1, 3], 9: [2, 3] });
    expect(detectAlsChain(board, map)).toBeNull();
  });

  it('does not fire when a middle link is broken (RCC visibility)', () => {
    // Move S3 off to (4,4): S2 no longer sees it, breaking the chain.
    const { board, map } = scenario({ 0: [1, 4], 1: [1, 2], 40: [2, 3], 9: [3, 4], 2: [4, 5] });
    expect(detectAlsChain(board, map)).toBeNull();
  });
});

describe('soundness sweep on real puzzles', () => {
  interface PuzzleRow {
    givens: string;
    solution: string;
  }

  function loadBank(name: string): PuzzleRow[] {
    const path = join(__dirname, '../../../../assets/puzzles', `${name}.json`);
    return JSON.parse(readFileSync(path, 'utf8')) as PuzzleRow[];
  }

  it('never eliminates a true solution digit', () => {
    const puzzles = [...loadBank('extreme').slice(0, 15), ...loadBank('diabolical').slice(0, 15)];
    let wingFires = 0;
    let chainFires = 0;

    for (const { givens, solution } of puzzles) {
      const board = createBoard(givens);
      const map = allCandidates(board);
      const sol = [...solution].map(Number) as Digit[];

      for (const detect of [detectAlsXyWing, detectAlsChain]) {
        const hint = detect(board, map);
        if (!hint) continue;
        if (detect === detectAlsXyWing) wingFires++;
        else chainFires++;
        for (const e of hint.action.eliminations ?? []) {
          expect(sol[e.index]).not.toBe(e.digit);
        }
      }
    }

    console.log(`ALS soundness sweep: XY-wing fired ${wingFires}, chain fired ${chainFires} of 30 puzzles`);
  });
});
