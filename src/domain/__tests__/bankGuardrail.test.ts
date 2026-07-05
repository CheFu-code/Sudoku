/**
 * Bank guardrails — the invariant that killed the "Last Resort on Extreme" bug:
 * every bundled easy–extreme puzzle must be fully solvable by the in-app
 * technique ladder. A puzzle the ladder stalls on shows the player a
 * trial-and-error hint, which is acceptable only in the diabolical tier.
 *
 * Two layers:
 *  - metadata checks (always on, instant): no `brute_force` hardestTechnique
 *    outside diabolical, unique ids, well-formed givens/solutions;
 *  - full re-grade (BANK_GUARDRAIL=1, minutes): re-solves every easy–extreme
 *    puzzle with the ladder and asserts `solved`. Run via `npm run test:bank`.
 */

import easy from '../../../assets/puzzles/easy.json';
import medium from '../../../assets/puzzles/medium.json';
import hard from '../../../assets/puzzles/hard.json';
import expert from '../../../assets/puzzles/expert.json';
import extreme from '../../../assets/puzzles/extreme.json';
import diabolical from '../../../assets/puzzles/diabolical.json';
import { gradePuzzle } from '../grade';
import type { Puzzle } from '../types';

const SOLVABLE_TIERS: [string, Puzzle[]][] = [
  ['easy', easy as Puzzle[]],
  ['medium', medium as Puzzle[]],
  ['hard', hard as Puzzle[]],
  ['expert', expert as Puzzle[]],
  ['extreme', extreme as Puzzle[]],
];
const ALL_TIERS: [string, Puzzle[]][] = [
  ...SOLVABLE_TIERS,
  ['diabolical', diabolical as Puzzle[]],
];

describe('bank metadata guardrails', () => {
  it.each(SOLVABLE_TIERS)('%s contains no ladder-stalling puzzles', (_tier, puzzles) => {
    const stalls = puzzles.filter((p) => p.hardestTechnique === 'brute_force');
    expect(stalls.map((p) => p.id)).toEqual([]);
  });

  it('ids are unique across all tiers', () => {
    const ids = ALL_TIERS.flatMap(([, puzzles]) => puzzles.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ALL_TIERS)('%s puzzles are well-formed', (tier, puzzles) => {
    expect(puzzles.length).toBeGreaterThan(0);
    for (const p of puzzles) {
      expect(p.givens).toHaveLength(81);
      expect(p.solution).toMatch(/^[1-9]{81}$/);
      expect(p.difficulty).toBe(tier);
    }
  });
});

const full = process.env.BANK_GUARDRAIL ? describe : describe.skip;

full('bank full re-grade (BANK_GUARDRAIL=1)', () => {
  jest.setTimeout(60 * 60 * 1000);

  it.each(SOLVABLE_TIERS)('every %s puzzle solves with the ladder', (_tier, puzzles) => {
    const stalls: string[] = [];
    for (const p of puzzles) {
      if (!gradePuzzle(p.givens).solved) stalls.push(p.id);
    }
    expect(stalls).toEqual([]);
  });

  it('reports the diabolical residual stall count', () => {
    let stalls = 0;
    for (const p of diabolical as Puzzle[]) {
      if (!gradePuzzle(p.givens).solved) stalls++;
    }
    console.log(`diabolical residual ladder stalls: ${stalls}/${(diabolical as Puzzle[]).length}`);
    expect(stalls).toBeLessThan((diabolical as Puzzle[]).length);
  });
});
