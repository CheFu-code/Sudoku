import { createBoard, indexOf } from '../../board';
import { allCandidates } from '../../candidates';
import { toggleNote } from '../../engine';
import type { Board, Digit } from '../../types';
import { detectNakedSingle } from '../nakedSingle';
import { detectXYWing } from '../xyWing';
import { detectRemotePair } from '../remotePair';
import { buildHintPresentation } from '../presentation';
import { locateHint } from '../locate';
import { TECHNIQUE_CATALOG } from '../techniqueCatalog';
import type { Hint } from '../types';

/** Build an 81-char givens string from an index -> digit-char map. */
function givens(entries: Record<number, string>): string {
  const arr = new Array(81).fill('.');
  for (const [k, v] of Object.entries(entries)) arr[Number(k)] = v;
  return arr.join('');
}

const EMPTY = '.'.repeat(81);

/** Board + candidate map from a cell→digits spec (mirrors hints.test.ts). */
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

describe('buildHintPresentation — placement hint (naked single)', () => {
  // Row 0 holds 1-8 in columns 1-8; index 0 can only be 9.
  const board = createBoard(
    givens({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' }),
  );
  const hint = detectNakedSingle(board, allCandidates(board))!;
  const p = buildHintPresentation(hint);

  it('opens with a clean-board "what" frame naming the technique', () => {
    expect(p.technique).toBe('naked_single');
    expect(p.title).toBe(hint.title);
    expect(p.frames[0].stage).toBe('what');
    expect(p.frames[0].annotations).toEqual({});
    expect(p.frames[0].text.length).toBeGreaterThan(0);
  });

  it('then shows only the placement cell, focus-tinted, with nothing leaked', () => {
    const where = p.frames[1];
    expect(where.stage).toBe('where');
    expect(where.annotations).toEqual({ 0: { tint: 'focus' } });
    expect(where.links).toBeUndefined();
    expect(where.text.some((s) => s.text.includes('row 1, column 1'))).toBe(true);
  });

  it('carries the concrete walkthrough unchanged as trailing explain frames', () => {
    expect(p.firstExplainIndex).toBe(2);
    const explain = p.frames.slice(p.firstExplainIndex);
    expect(explain.every((f) => f.stage === 'explain')).toBe(true);
    const concrete = explain.slice(explain.length - hint.steps.length);
    hint.steps.forEach((step, i) => {
      expect(concrete[i].text).toEqual(step.text);
      expect(concrete[i].annotations).toEqual(step.annotations);
    });
    expect(p.action).toEqual(hint.action);
  });
});

describe('buildHintPresentation — elimination hint (XY-Wing)', () => {
  // pivot {1,2} at (0,0); pincers {1,3} at (0,1) and {2,3} at (1,0); z=3 is
  // removed from (1,1), which sees both pincers.
  const { board, map } = scenario({
    [indexOf(0, 0)]: [1, 2],
    [indexOf(0, 1)]: [1, 3],
    [indexOf(1, 0)]: [2, 3],
    [indexOf(1, 1)]: [3],
  });
  const hint = detectXYWing(board, map)!;
  const p = buildHintPresentation(hint);

  it('locates the pattern cells (pivot + pincers), not the elimination cell', () => {
    const where = p.frames[1];
    const cells = Object.keys(where.annotations).map(Number).sort((a, b) => a - b);
    expect(cells).toEqual([indexOf(0, 0), indexOf(0, 1), indexOf(1, 0)]);
    expect(cells).not.toContain(indexOf(1, 1));
  });

  it('leaks no candidates, strikes or chain arrows at the where stage', () => {
    const where = p.frames[1];
    for (const a of Object.values(where.annotations)) {
      expect(a).toEqual({ tint: 'focus' });
    }
    expect(where.links).toBeUndefined();
  });

  it('injects the technique lesson before the concrete walkthrough', () => {
    const lessonSteps = TECHNIQUE_CATALOG.xy_wing.howItWorks;
    expect(lessonSteps.length).toBeGreaterThan(0);
    const explain = p.frames.slice(p.firstExplainIndex);
    expect(explain.length).toBe(lessonSteps.length + hint.steps.length);
    lessonSteps.forEach((text, i) => {
      expect(explain[i].text).toEqual(text);
      // Teaching frames keep the pattern in focus for context.
      expect(explain[i].annotations).toEqual(p.frames[1].annotations);
    });
  });
});

describe('buildHintPresentation — chain hint (remote pair)', () => {
  const { board, map } = scenario({
    [indexOf(0, 0)]: [1, 2],
    [indexOf(0, 3)]: [1, 2],
    [indexOf(3, 3)]: [1, 2],
    [indexOf(3, 6)]: [1, 2],
    [indexOf(3, 0)]: [1, 7],
  });
  const hint = detectRemotePair(board, map)!;
  const p = buildHintPresentation(hint);

  it('shows no chain arrows before the explain stage', () => {
    expect(p.frames[0].links).toBeUndefined();
    expect(p.frames[1].links).toBeUndefined();
    // The concrete walkthrough still carries its arrows.
    expect(p.frames.at(-1)!.links!.length).toBeGreaterThan(0);
  });
});

describe('TECHNIQUE_CATALOG', () => {
  it('teaches every technique with a non-empty definition', () => {
    const entries = Object.entries(TECHNIQUE_CATALOG);
    expect(entries.length).toBe(28);
    for (const [id, lesson] of entries) {
      expect(lesson.whatItIs.length).toBeGreaterThan(0);
      expect(lesson.whatItIs.map((s) => s.text).join('').length).toBeGreaterThan(20);
      for (const step of lesson.howItWorks) {
        expect(step.length).toBeGreaterThan(0);
      }
      expect(id).toBeTruthy();
    }
  });
});

describe('locateHint fallback', () => {
  it('falls back to the elimination cells when no candidates are highlighted', () => {
    const hint: Hint = {
      technique: 'claiming',
      title: 'Box-Line Reduction',
      steps: [{ text: [{ text: 'x' }], annotations: { 4: { tint: 'unit' } } }],
      action: { kind: 'eliminate', eliminations: [{ index: 40, digit: 5 }] },
    };
    expect(locateHint(hint).cells).toEqual([40]);
  });
});
