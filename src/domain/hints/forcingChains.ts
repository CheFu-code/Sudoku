/**
 * Forcing chains — the completeness rungs of the ladder. A shared implication
 * propagation engine (assume a candidate on/off, follow forced consequences,
 * record an explanation DAG) drives four detectors:
 *  - Nishio: one candidate assumed true reaches a contradiction → eliminate;
 *  - Cell forcing: every candidate of a cell forces the same conclusion;
 *  - Unit forcing: every home of a digit in a unit forces the same conclusion;
 *  - Dynamic forcing: same drivers with subset-aware propagation.
 * All searches are bounded so a hint tap stays responsive on-device.
 *
 * The engine models each of the 729 (cell, digit) candidates as a tri-state
 * (UNKNOWN / ON / OFF). `assume` seeds one candidate, then runs a work queue of
 * the classic single-step inferences — a value fills a cell (peers/siblings
 * lose it), a cell or unit is reduced to one home for a digit (that home is ON),
 * a cell or unit runs out of homes (contradiction). The `dynamic` level adds
 * locked candidates and naked pairs/triples between queue drains. Every forced
 * candidate records the parents that triggered it, so a readable chain can be
 * reconstructed from any conclusion back to the assumption.
 */

import { boxOf, colOf, rowOf } from '../board';
import { PEERS } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS, unitLabel, combinations } from './units';
import type { CellAnnotation, ChainLink, Hint, HintStep, TextSegment } from './types';

type CandState = 0 | 1 | 2;
const UNKNOWN: CandState = 0;
const ON: CandState = 1;
const OFF: CandState = 2;

type Level = 'basic' | 'dynamic';

/** Cap on queue-processing steps across all assumes in one detector call. When
 *  exceeded the detector bails (returns null) — the brute-force fallback still
 *  guarantees a move. Generous: memoized assumes keep real solves far below it. */
const STEP_BUDGET = 500_000;
/** Guard against a pathological dynamic subset/drain oscillation. */
const MAX_DYNAMIC_PASSES = 40;

// --- candidate index helpers (index = cell * 9 + (digit - 1)) ---------------
const ci = (cell: CellIndex, d0: number): number => cell * 9 + d0;
const ciCell = (k: number): CellIndex => Math.floor(k / 9);
const ciDigit = (k: number): Digit => ((k % 9) + 1) as Digit;

/** The row / col / box unit ids (into ALL_UNITS: rows 0-8, cols 9-17, boxes 18-26). */
const CELL_UNIT_IDS: number[][] = (() => {
  const out: number[][] = [];
  for (let cell = 0; cell < 81; cell++) {
    out.push([rowOf(cell), 9 + colOf(cell), 18 + boxOf(cell)]);
  }
  return out;
})();

function cellLabel(cell: CellIndex): string {
  return `R${rowOf(cell) + 1}C${colOf(cell) + 1}`;
}

function popcount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

// --- explanation records ----------------------------------------------------
interface Why {
  parents: number[];
  rule: string;
  depth: number;
}

interface Contradiction {
  triggerCi: number;
  kind: 'cell' | 'unit' | 'conflict';
  cell?: CellIndex;
  unitId?: number;
  digit?: number; // 0-based
}

interface AssumeResult {
  status: 'ok' | 'contradiction' | 'aborted';
  state: Int8Array;
  why: Map<number, Why>;
  contradiction?: Contradiction;
}

interface Engine {
  base: Int8Array;
  assumeOn(startCi: number, level: Level): AssumeResult;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function createEngine(board: Board, candidates: Map<CellIndex, Set<Digit>>): Engine {
  const base = new Int8Array(729).fill(OFF);
  for (let cell = 0; cell < 81; cell++) {
    const v = board[cell].value;
    if (v !== null) {
      base[ci(cell, v - 1)] = ON;
    } else {
      const set = candidates.get(cell);
      if (set) for (const d of set) base[ci(cell, d - 1)] = UNKNOWN;
    }
  }

  let budget = STEP_BUDGET;
  const cacheBasic = new Map<number, AssumeResult>();
  const cacheDynamic = new Map<number, AssumeResult>();

  function assume(startCi: number, level: Level): AssumeResult {
    const state = Int8Array.from(base);
    const why = new Map<number, Why>();
    const queue: { k: number; val: CandState; parents: number[]; rule: string }[] = [];
    let head = 0;
    let depth = 0;
    let contradiction: Contradiction | undefined;

    const enqueue = (k: number, val: CandState, parents: number[], rule: string) => {
      queue.push({ k, val, parents, rule });
    };

    const setContra = (c: Contradiction) => {
      if (!contradiction) contradiction = c;
    };

    const onSet = (k: number) => {
      const cell = ciCell(k);
      const d0 = k % 9;
      for (let d = 0; d < 9; d++) {
        if (d === d0) continue;
        const s = ci(cell, d);
        if (state[s] !== OFF) enqueue(s, OFF, [k], 'naked');
      }
      for (const p of PEERS[cell]) {
        const s = ci(p, d0);
        if (state[s] !== OFF) enqueue(s, OFF, [k], 'peer');
      }
    };

    const offSet = (k: number) => {
      const cell = ciCell(k);
      const d0 = k % 9;
      // Cell reduced to a single remaining candidate → it must be ON.
      let remaining = -1;
      let cnt = 0;
      const cellOffs: number[] = [];
      for (let d = 0; d < 9; d++) {
        const s = ci(cell, d);
        if (state[s] === OFF) cellOffs.push(s);
        else {
          remaining = s;
          cnt++;
        }
      }
      if (cnt === 0) {
        setContra({ triggerCi: k, kind: 'cell', cell });
        return;
      }
      if (cnt === 1 && state[remaining] === UNKNOWN) {
        enqueue(remaining, ON, cellOffs, 'cell-single');
      }
      // Each unit reduced to a single home for this digit → that home is ON.
      for (const u of CELL_UNIT_IDS[cell]) {
        const cells = ALL_UNITS[u].indices;
        let rem = -1;
        let c = 0;
        const offs: number[] = [];
        for (const cc of cells) {
          const s = ci(cc, d0);
          if (state[s] === OFF) offs.push(s);
          else {
            rem = s;
            c++;
          }
        }
        if (c === 0) {
          setContra({ triggerCi: k, kind: 'unit', unitId: u, digit: d0 });
          return;
        }
        if (c === 1 && state[rem] === UNKNOWN) enqueue(rem, ON, offs, 'unit-single');
      }
    };

    const drain = (): boolean => {
      while (head < queue.length) {
        if (--budget <= 0) return false;
        const { k, val, parents, rule } = queue[head++];
        const cur = state[k];
        if (cur === val) continue;
        if (cur !== UNKNOWN) {
          setContra({ triggerCi: k, kind: 'conflict', cell: ciCell(k), digit: k % 9 });
          return true;
        }
        state[k] = val;
        why.set(k, { parents, rule, depth: depth++ });
        if (val === ON) onSet(k);
        else offSet(k);
        if (contradiction) return true;
      }
      return true;
    };

    enqueue(startCi, ON, [], 'assumption');
    if (!drain()) return { status: 'aborted', state, why };

    if (level === 'dynamic') {
      for (let pass = 0; pass < MAX_DYNAMIC_PASSES && !contradiction; pass++) {
        const changed = subsetPass(state, enqueue);
        if (budget <= 0) return { status: 'aborted', state, why };
        if (!changed) break;
        if (!drain()) return { status: 'aborted', state, why };
      }
    }

    return {
      status: contradiction ? 'contradiction' : 'ok',
      state,
      why,
      contradiction,
    };
  }

  /** Subset-aware inference: locked candidates + naked pairs/triples. Enqueues
   *  new OFFs; returns whether any were found. Sound standard techniques. */
  function subsetPass(
    state: Int8Array,
    enqueue: (k: number, val: CandState, parents: number[], rule: string) => void,
  ): boolean {
    let found = false;
    for (let u = 0; u < 27; u++) {
      const cells = ALL_UNITS[u].indices;

      // Locked candidates: a digit's homes in this unit all share another unit.
      for (let d0 = 0; d0 < 9; d0++) {
        const pos: CellIndex[] = [];
        for (const c of cells) if (state[ci(c, d0)] !== OFF) pos.push(c);
        if (pos.length < 2 || pos.length > 3) continue;
        const posSet = new Set(pos);
        for (const u2 of crossingUnits(pos)) {
          if (u2 === u) continue;
          const parents = pos.map((c) => ci(c, d0));
          for (const c of ALL_UNITS[u2].indices) {
            if (posSet.has(c)) continue;
            const s = ci(c, d0);
            if (state[s] !== OFF) {
              enqueue(s, OFF, parents, 'locked');
              found = true;
            }
          }
        }
      }

      // Naked pairs/triples: k cells whose combined candidates are exactly k.
      const items: { cell: CellIndex; mask: number }[] = [];
      for (const c of cells) {
        let mask = 0;
        let hasOn = false;
        for (let d = 0; d < 9; d++) {
          const s = ci(c, d);
          if (state[s] === ON) hasOn = true;
          if (state[s] !== OFF) mask |= 1 << d;
        }
        if (!hasOn && popcount(mask) >= 2) items.push({ cell: c, mask });
      }
      for (const k of [2, 3]) {
        if (items.length <= k) continue;
        for (const combo of combinations(items, k)) {
          let union = 0;
          for (const it of combo) union |= it.mask;
          if (popcount(union) !== k) continue;
          const inCombo = new Set(combo.map((it) => it.cell));
          const parents: number[] = [];
          for (const it of combo) {
            for (let d = 0; d < 9; d++) if (union & (1 << d)) parents.push(ci(it.cell, d));
          }
          for (const it of items) {
            if (inCombo.has(it.cell)) continue;
            for (let d = 0; d < 9; d++) {
              if (!(union & (1 << d))) continue;
              const s = ci(it.cell, d);
              if (state[s] !== OFF) {
                enqueue(s, OFF, parents, 'naked-subset');
                found = true;
              }
            }
          }
        }
      }
    }
    return found;
  }

  function assumeOn(startCi: number, level: Level): AssumeResult {
    const cache = level === 'dynamic' ? cacheDynamic : cacheBasic;
    let r = cache.get(startCi);
    if (!r) {
      r = assume(startCi, level);
      cache.set(startCi, r);
    }
    return r;
  }

  return { base, assumeOn };
}

/** Units (row/col/box) that contain every cell in `pos`. */
function crossingUnits(pos: CellIndex[]): number[] {
  const out: number[] = [];
  const r = rowOf(pos[0]);
  if (pos.every((p) => rowOf(p) === r)) out.push(r);
  const c = colOf(pos[0]);
  if (pos.every((p) => colOf(p) === c)) out.push(9 + c);
  const b = boxOf(pos[0]);
  if (pos.every((p) => boxOf(p) === b)) out.push(18 + b);
  return out;
}

// ---------------------------------------------------------------------------
// Explanation reconstruction
// ---------------------------------------------------------------------------

/** Shortest parent walk from `targetCi` back to the assumption. Returns the
 *  ordered candidate path start→target. */
function tracePath(why: Map<number, Why>, targetCi: number): number[] {
  const path: number[] = [];
  const seen = new Set<number>();
  let cur: number | undefined = targetCi;
  let guard = 0;
  while (cur !== undefined && !seen.has(cur) && guard++ < 60) {
    seen.add(cur);
    path.push(cur);
    const w = why.get(cur);
    if (!w || w.rule === 'assumption') break;
    let best: number | undefined;
    let bestDepth = Infinity;
    for (const p of w.parents) {
      const pw = why.get(p);
      if (pw && pw.depth < bestDepth) {
        bestDepth = pw.depth;
        best = p;
      }
    }
    if (best === undefined) break;
    cur = best;
  }
  return path.reverse();
}

function pathLinks(path: number[], why: Map<number, Why>): ChainLink[] {
  const links: ChainLink[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const child = path[i + 1];
    const rule = why.get(child)?.rule;
    const strong = rule === 'cell-single' || rule === 'unit-single';
    links.push({
      from: { index: ciCell(path[i]), digit: ciDigit(path[i]) },
      to: { index: ciCell(child), digit: ciDigit(child) },
      strong,
    });
  }
  return links;
}

function annotatePath(
  path: number[],
  focusEnds: boolean,
): Record<CellIndex, CellAnnotation> {
  const ann: Record<CellIndex, CellAnnotation> = {};
  path.forEach((k, i) => {
    const cell = ciCell(k);
    const digit = ciDigit(k);
    const ex = ann[cell];
    const notes = new Set(ex?.highlightNotes ?? []);
    notes.add(digit);
    const endpoint = focusEnds && (i === 0 || i === path.length - 1);
    ann[cell] = {
      tint: endpoint || ex?.tint === 'focus' ? 'focus' : 'unit',
      highlightNotes: [...notes],
    };
  });
  return ann;
}

function describeContra(c: Contradiction): TextSegment[] {
  if (c.kind === 'cell') {
    return [
      { text: 'cell ' },
      { text: cellLabel(c.cell!), emphasis: true },
      { text: ' is left with no possible digit' },
    ];
  }
  if (c.kind === 'unit') {
    return [
      { text: `digit ${c.digit! + 1}` },
      { text: ` has nowhere left to go in ${unitLabel(ALL_UNITS[c.unitId!])}` },
    ];
  }
  return [
    { text: `${c.digit! + 1} at ` },
    { text: cellLabel(c.cell!), emphasis: true },
    { text: ' is forced both in and out' },
  ];
}

// ---------------------------------------------------------------------------
// Nishio (contradiction chain)
// ---------------------------------------------------------------------------

function runNishio(
  engine: Engine,
  level: Level,
  technique: Hint['technique'],
  title: string,
): Hint | null {
  const base = engine.base;
  for (let k = 0; k < 729; k++) {
    if (base[k] !== UNKNOWN) continue;
    const res = engine.assumeOn(k, level);
    if (res.status === 'aborted') return null;
    if (res.status === 'contradiction') {
      return buildNishioHint(res, k, technique, title);
    }
  }
  return null;
}

function buildNishioHint(
  res: AssumeResult,
  startCi: number,
  technique: Hint['technique'],
  title: string,
): Hint {
  const cell = ciCell(startCi);
  const digit = ciDigit(startCi);
  const contra = res.contradiction!;
  const path = tracePath(res.why, contra.triggerCi);
  if (path.length === 0 || path[0] !== startCi) path.unshift(startCi);

  const chainAnn = annotatePath(path, true);
  const links = pathLinks(path, res.why);
  const reveal: Record<CellIndex, CellAnnotation> = { ...chainAnn };
  reveal[cell] = { ...(reveal[cell] ?? {}), tint: 'target', strikeNotes: [digit] };

  const steps: HintStep[] = [
    {
      text: [
        { text: 'Suppose ' },
        { text: cellLabel(cell), emphasis: true },
        { text: ' were ' },
        { text: String(digit), emphasis: true },
        { text: '. We follow the moves this forces and see where it leads.' },
      ],
      annotations: { [cell]: { tint: 'focus', highlightNotes: [digit] } },
    },
    {
      text: [
        { text: 'Each forced step knocks out or fills in the next, until ' },
        ...describeContra(contra),
        { text: ' — the assumption breaks the puzzle.' },
      ],
      annotations: chainAnn,
      links,
    },
    {
      text: [
        { text: 'Because assuming it leads to a contradiction, ' },
        { text: String(digit), emphasis: true },
        { text: ' can be removed from ' },
        { text: cellLabel(cell), emphasis: true },
        { text: '.' },
      ],
      annotations: reveal,
      links,
    },
  ];

  return {
    technique,
    title,
    steps,
    action: { kind: 'eliminate', eliminations: [{ index: cell, digit }] },
  };
}

// ---------------------------------------------------------------------------
// Cell / unit forcing (common-consequence chains)
// ---------------------------------------------------------------------------

interface Branch {
  start: number;
  res: AssumeResult;
}

function* cellGroups(base: Int8Array): Generator<number[]> {
  for (let cell = 0; cell < 81; cell++) {
    const starts: number[] = [];
    for (let d = 0; d < 9; d++) if (base[ci(cell, d)] === UNKNOWN) starts.push(ci(cell, d));
    if (starts.length >= 2 && starts.length <= 4) yield starts;
  }
}

function* unitGroups(base: Int8Array): Generator<number[]> {
  for (let u = 0; u < 27; u++) {
    const cells = ALL_UNITS[u].indices;
    for (let d = 0; d < 9; d++) {
      const starts: number[] = [];
      for (const c of cells) if (base[ci(c, d)] === UNKNOWN) starts.push(ci(c, d));
      if (starts.length >= 2 && starts.length <= 4) yield starts;
    }
  }
}

function runForcing(
  engine: Engine,
  groups: Generator<number[]>,
  level: Level,
  technique: Hint['technique'],
  title: string,
  kind: 'cell' | 'unit',
): Hint | null {
  const base = engine.base;
  for (const starts of groups) {
    const branches: Branch[] = [];
    let aborted = false;
    for (const s of starts) {
      const res = engine.assumeOn(s, level);
      if (res.status === 'aborted') {
        aborted = true;
        break;
      }
      branches.push({ start: s, res });
    }
    if (aborted) return null;

    const survivors = branches.filter((b) => b.res.status !== 'contradiction');
    if (survivors.length === 0) return null; // all branches broken → position invalid

    const commonOn: number[] = [];
    const commonOff: number[] = [];
    for (let k = 0; k < 729; k++) {
      if (base[k] !== UNKNOWN) continue;
      let allOn = true;
      let allOff = true;
      for (const sv of survivors) {
        const st = sv.res.state[k];
        if (st !== ON) allOn = false;
        if (st !== OFF) allOff = false;
        if (!allOn && !allOff) break;
      }
      if (allOn) commonOn.push(k);
      else if (allOff) commonOff.push(k);
    }

    if (commonOn.length > 0) {
      return buildForcingHint(kind, technique, title, starts, survivors, true, [commonOn[0]]);
    }
    if (commonOff.length > 0) {
      return buildForcingHint(kind, technique, title, starts, survivors, false, commonOff);
    }
  }
  return null;
}

function buildForcingHint(
  kind: 'cell' | 'unit',
  technique: Hint['technique'],
  title: string,
  starts: number[],
  survivors: Branch[],
  isPlacement: boolean,
  targets: number[],
): Hint {
  const repTarget = targets[0];
  const repCell = ciCell(repTarget);
  const repDigit = ciDigit(repTarget);

  const intro: Record<CellIndex, CellAnnotation> = {};
  for (const s of starts) {
    const cell = ciCell(s);
    const ex = intro[cell];
    const notes = new Set(ex?.highlightNotes ?? []);
    notes.add(ciDigit(s));
    intro[cell] = { tint: 'focus', highlightNotes: [...notes] };
  }

  const introText: TextSegment[] =
    kind === 'cell'
      ? [
          { text: 'Cell ' },
          { text: cellLabel(ciCell(starts[0])), emphasis: true },
          { text: ` has ${starts.length} candidates. We test each in turn.` },
        ]
      : [
          { text: `Digit ${ciDigit(starts[0])}` },
          { text: ` fits in ${starts.length} cells of this unit`, emphasis: true },
          { text: ' — exactly one is the answer. We test each.' },
        ];

  const steps: HintStep[] = [{ text: introText, annotations: intro }];

  for (const b of survivors) {
    const path = tracePath(b.res.why, repTarget);
    if (path.length === 0 || path[0] !== b.start) path.unshift(b.start);
    const ann = annotatePath(path, true);
    steps.push({
      text: [
        { text: 'If ' },
        { text: cellLabel(ciCell(b.start)), emphasis: true },
        { text: ' is ' },
        { text: String(ciDigit(b.start)), emphasis: true },
        { text: ', the forced moves make ' },
        { text: cellLabel(repCell), emphasis: true },
        isPlacement
          ? { text: ` become ${repDigit}.` }
          : { text: ` lose ${repDigit}.` },
      ],
      annotations: ann,
      links: pathLinks(path, b.res.why),
    });
  }

  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  if (isPlacement) {
    reveal[repCell] = { ...(reveal[repCell] ?? {}), tint: 'target', ghost: repDigit };
    steps.push({
      text: [
        { text: 'Every case makes ' },
        { text: cellLabel(repCell), emphasis: true },
        { text: ' a ' },
        { text: String(repDigit), emphasis: true },
        { text: ' — so that is its value.' },
      ],
      annotations: reveal,
    });
    return {
      technique,
      title,
      steps,
      action: { kind: 'place', placements: [{ index: repCell, digit: repDigit }] },
    };
  }

  const struck = new Map<CellIndex, Digit[]>();
  for (const t of targets) {
    const cell = ciCell(t);
    (struck.get(cell) ?? struck.set(cell, []).get(cell)!).push(ciDigit(t));
  }
  for (const [cell, ds] of struck) {
    reveal[cell] = { ...(reveal[cell] ?? {}), tint: 'target', strikeNotes: ds };
  }
  steps.push({
    text: [
      { text: 'Every case removes the struck candidate' },
      { text: targets.length > 1 ? 's' : '' },
      { text: ' — whichever branch is true, ' },
      { text: `${repDigit} cannot stay at ${cellLabel(repCell)}`, emphasis: true },
      { text: '.' },
    ],
    annotations: reveal,
  });

  return {
    technique,
    title,
    steps,
    action: {
      kind: 'eliminate',
      eliminations: targets.map((t) => ({ index: ciCell(t), digit: ciDigit(t) })),
    },
  };
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

export function detectNishio(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const engine = createEngine(board, candidates);
  return runNishio(engine, 'basic', 'nishio_forcing_chain', 'Contradiction Chain');
}

export function detectCellForcingChain(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const engine = createEngine(board, candidates);
  return runForcing(
    engine,
    cellGroups(engine.base),
    'basic',
    'cell_forcing_chain',
    'Cell Forcing Chains',
    'cell',
  );
}

export function detectUnitForcingChain(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const engine = createEngine(board, candidates);
  return runForcing(
    engine,
    unitGroups(engine.base),
    'basic',
    'unit_forcing_chain',
    'Unit Forcing Chains',
    'unit',
  );
}

export function detectDynamicForcingChain(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const engine = createEngine(board, candidates);
  const nishio = runNishio(engine, 'dynamic', 'dynamic_forcing_chain', 'Dynamic Forcing Chain');
  if (nishio) return nishio;
  const cell = runForcing(
    engine,
    cellGroups(engine.base),
    'dynamic',
    'dynamic_forcing_chain',
    'Dynamic Forcing Chain',
    'cell',
  );
  if (cell) return cell;
  return runForcing(
    engine,
    unitGroups(engine.base),
    'dynamic',
    'dynamic_forcing_chain',
    'Dynamic Forcing Chain',
    'unit',
  );
}
