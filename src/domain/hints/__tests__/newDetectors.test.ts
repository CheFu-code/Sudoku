/**
 * Coverage for the ladder-extension detectors (finned fish, UR 3/5/6, hidden
 * rectangle, WXYZ-Wing, grouped AIC, 3D Medusa, forcing chains): real-puzzle
 * soundness sweeps, the Last-Resort acceptance replay, and a latency guard.
 *
 * Rather than hand-constructing each intricate pattern, these tests drive the
 * detectors across real bank grids mid-solve and assert every claim against
 * the known solution — the same bar `isHintSound` enforces in production, but
 * checked here directly so a detector bug fails loudly instead of being
 * silently skipped.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createBoard, isComplete } from '../../board';
import { allCandidates } from '../../candidates';
import { applyEliminations, placeValue } from '../../engine';
import { gradePuzzle } from '../../grade';
import type { Board, CellIndex, Digit } from '../../types';
import type { Detector } from '../findHint';
import { detectFinnedFish } from '../finnedFish';
import { detectUniqueRectangleType3 } from '../uniqueRectangleType3';
import { detectUniqueRectangleType5 } from '../uniqueRectangleType5';
import { detectUniqueRectangleType6 } from '../uniqueRectangleType6';
import { detectHiddenRectangle } from '../hiddenRectangle';
import { detectWxyzWing } from '../wxyzWing';
import { detectMedusa3d } from '../medusa3d';
import { detectAic } from '../aic';
import { detectGroupedAic } from '../chain/chainEngine';
import {
  detectCellForcingChain,
  detectDynamicForcingChain,
  detectNishio,
  detectUnitForcingChain,
} from '../forcingChains';
import { firstApplicableHint, hintCandidates } from '../findHint';
import type { Hint } from '../types';

type PuzzleJson = { id: string; givens: string; solution: string; hardestTechnique?: string };

function loadBank(tier: string): PuzzleJson[] {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../../assets/puzzles/${tier}.json`), 'utf8'),
  );
}

const NEW_DETECTORS: [string, Detector][] = [
  ['finned_fish_2', (b, c) => detectFinnedFish(b, c, 2)],
  ['finned_fish_3', (b, c) => detectFinnedFish(b, c, 3)],
  ['finned_fish_4', (b, c) => detectFinnedFish(b, c, 4)],
  ['ur3', detectUniqueRectangleType3],
  ['ur5', detectUniqueRectangleType5],
  ['ur6', detectUniqueRectangleType6],
  ['hidden_rectangle', detectHiddenRectangle],
  ['wxyz_wing', detectWxyzWing],
  ['medusa_3d', detectMedusa3d],
  ['grouped_aic', detectGroupedAic],
  ['nishio', detectNishio],
  ['cell_fc', detectCellForcingChain],
  ['unit_fc', detectUnitForcingChain],
  ['dynamic_fc', detectDynamicForcingChain],
];

/** Assert a hint's claims against the true solution. */
function assertSound(hint: Hint, solution: string, ctx: string) {
  if (hint.action.kind === 'place') {
    for (const p of hint.action.placements ?? []) {
      expect(`${ctx}: place ${p.digit}@${p.index} vs ${solution[p.index]}`).toBe(
        `${ctx}: place ${solution[p.index]}@${p.index} vs ${solution[p.index]}`,
      );
    }
  } else if (hint.action.kind === 'eliminate') {
    for (const e of hint.action.eliminations ?? []) {
      if (String(e.digit) === solution[e.index]) {
        throw new Error(`${ctx}: unsound elimination of ${e.digit}@${e.index}`);
      }
    }
  }
  // Locate contract: elimination hints must expose their pattern via step-0
  // highlightNotes (placements are located by their target instead).
  if (hint.action.kind === 'eliminate') {
    const intro = hint.steps[0]?.annotations ?? {};
    const marked = Object.values(intro).some((a) => (a.highlightNotes?.length ?? 0) > 0);
    if (!marked) throw new Error(`${ctx}: step 0 has no highlighted pattern cells`);
  }
}

describe('new detector soundness sweep (real bank grids)', () => {
  jest.setTimeout(240_000);

  it('never contradicts the solution while replaying hard grids', () => {
    const puzzles = [
      ...loadBank('extreme').slice(0, 12),
      ...loadBank('diabolical').slice(0, 6),
    ];
    const fired = new Map<string, number>();

    for (const p of puzzles) {
      // Replay the grader loop; at every intermediate state run every new
      // detector and validate whatever it claims.
      let board: Board = createBoard(p.givens).map((cell, i) =>
        cell.value === null ? { ...cell, notes: new Set(allCandidates(createBoard(p.givens)).get(i)) } : cell,
      );
      for (let step = 0; step < 200 && !isComplete(board); step++) {
        const candidates = hintCandidates(board);
        for (const [name, detect] of NEW_DETECTORS) {
          const hint = detect(board, candidates);
          if (hint) {
            fired.set(name, (fired.get(name) ?? 0) + 1);
            assertSound(hint, p.solution, `${p.id} ${name} step ${step}`);
          }
        }
        const next = firstApplicableHint(
          board,
          candidates,
          [...p.solution].map(Number) as Digit[],
        );
        if (!next) break;
        if (next.action.kind === 'place') {
          for (const { index, digit } of next.action.placements ?? []) {
            const res = placeValue(board, index, digit, true);
            if (res) board = res.board;
          }
        } else {
          const res = applyEliminations(board, next.action.eliminations ?? [], true);
          if (res) board = res.board;
        }
      }
    }
    console.log('detector firing counts:', Object.fromEntries(fired));
    // The chain/forcing families must actually participate on these grids.
    expect((fired.get('grouped_aic') ?? 0) + (fired.get('nishio') ?? 0)).toBeGreaterThan(0);
  });
});

describe('Last Resort acceptance (formerly stalling extreme puzzles)', () => {
  jest.setTimeout(120_000);

  it('solves a sample of the puzzles that used to fall back to brute force', () => {
    // The bank was re-graded, so re-derive the former stalls from grid content:
    // extreme puzzles whose current hardestTechnique needed the new rungs.
    const sample = loadBank('extreme')
      .filter((p) =>
        ['grouped_aic', 'als_xy_wing', 'als_chain', 'nishio_forcing_chain'].includes(
          p.hardestTechnique ?? '',
        ),
      )
      .slice(0, 6);
    expect(sample.length).toBeGreaterThan(0);
    for (const p of sample) {
      const grade = gradePuzzle(p.givens);
      expect(`${p.id}: ${grade.solved}`).toBe(`${p.id}: true`);
      expect(grade.hardestTechnique).not.toBe('brute_force');
    }
  });
});

describe('hint-tap latency guard', () => {
  jest.setTimeout(120_000);

  it('full-ladder stall stays under budget on the hardest bank grids', () => {
    const hardest = loadBank('diabolical')
      .sort((a: any, b: any) => (b as any).rating - (a as any).rating)
      .slice(0, 3);
    for (const p of hardest) {
      const board = createBoard(p.givens);
      const candidates = hintCandidates(board);
      const t0 = Date.now();
      for (const [, detect] of NEW_DETECTORS) detect(board, candidates);
      const elapsed = Date.now() - t0;
      // Generous Node budget — catches accidental exponential blowups only.
      expect(elapsed).toBeLessThan(5000);
    }
  });
});
