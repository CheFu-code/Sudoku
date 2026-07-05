/**
 * 3D Medusa: multi-digit coloring over (cell, digit) nodes. Strong links are
 * bilocation units (a digit with exactly two candidate cells in a unit) and
 * bivalue cells (a cell with exactly two candidates). Each connected component
 * is 2-colored, then the classic Medusa rules eliminate candidates that conflict
 * with both colors (or kill a self-contradicting color outright).
 *
 * Simple coloring runs on an earlier rung, so single-digit webs are already
 * drained; here we require a component to span at least two digits.
 */

import { getPeers } from '../rules';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS } from './units';
import type { Hint, CellAnnotation, ChainLink } from './types';

const nodeKey = (cell: CellIndex, digit: Digit) => cell * 10 + digit;
const cellOf = (k: number) => Math.floor(k / 10);
const digitOf = (k: number) => (k % 10) as Digit;

interface Colored {
  key: number;
  color: 0 | 1;
}

export function detectMedusa3d(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  // Strong-link adjacency over (cell, digit) nodes.
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  // (b) bivalue cell: its two candidates.
  for (const [cell, ds] of candidates) {
    if (ds.size === 2) {
      const [d1, d2] = [...ds];
      link(nodeKey(cell, d1), nodeKey(cell, d2));
    }
  }
  // (a) bilocation: a unit where a digit has exactly two candidate cells.
  for (const unit of ALL_UNITS) {
    for (const d of DIGITS) {
      const cells = unit.indices.filter((i) => candidates.get(i)?.has(d));
      if (cells.length === 2) link(nodeKey(cells[0], d), nodeKey(cells[1], d));
    }
  }

  const seen = new Set<number>();
  for (const start of [...adj.keys()].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;

    // 2-color the connected component.
    const color = new Map<number, 0 | 1>([[start, 0]]);
    const parent = new Map<number, number>();
    seen.add(start);
    const queue = [start];
    const comp: number[] = [start];
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of adj.get(u) ?? []) {
        if (!color.has(v)) {
          color.set(v, (color.get(u)! ^ 1) as 0 | 1);
          parent.set(v, u);
          seen.add(v);
          comp.push(v);
          queue.push(v);
        }
      }
    }

    if (comp.length < 4) continue; // trivial — leave to simple coloring
    const digits = new Set(comp.map(digitOf));
    if (digits.size < 2) continue; // single-digit web is simple-coloring territory

    const nodes: Colored[] = comp.map((key) => ({ key, color: color.get(key)! }));
    const hint = applyRules(candidates, nodes, parent);
    if (hint) return hint;
  }
  return null;
}

function applyRules(
  candidates: Map<CellIndex, Set<Digit>>,
  nodes: Colored[],
  parent: Map<number, number>,
): Hint | null {
  const colorOf = new Map<number, 0 | 1>();
  for (const n of nodes) colorOf.set(n.key, n.color);
  const byColor: [number[], number[]] = [[], []];
  for (const n of nodes) byColor[n.color].push(n.key);

  // Rule 1: a color appearing twice in one cell is false.
  // Rule 2: a color appearing twice for one digit in one unit is false.
  const falseColor = findContradictoryColor(byColor);
  if (falseColor !== null) {
    const elim = byColor[falseColor].map((k) => ({ index: cellOf(k), digit: digitOf(k) }));
    return buildHint(nodes, parent, elim, contradictionText);
  }

  const set0 = new Set(byColor[0]);
  const set1 = new Set(byColor[1]);
  const isColored = (k: number) => colorOf.has(k);
  const eliminations: { index: CellIndex; digit: Digit }[] = [];
  const push = (index: CellIndex, digit: Digit) => {
    if (!eliminations.some((e) => e.index === index && e.digit === digit)) {
      eliminations.push({ index, digit });
    }
  };

  // Iterate uncolored candidates deterministically.
  for (const [cell, ds] of candidates) {
    for (const digit of [...ds].sort((a, b) => a - b)) {
      const k = nodeKey(cell, digit);
      if (isColored(k)) continue;

      // Rule 3: this cell already holds two oppositely-colored candidates → the
      // cell's value is one of them, so every uncolored candidate here dies.
      let has0 = false;
      let has1 = false;
      for (const d2 of ds) {
        const c = colorOf.get(nodeKey(cell, d2));
        if (c === 0) has0 = true;
        else if (c === 1) has1 = true;
      }
      if (has0 && has1) {
        push(cell, digit);
        continue;
      }

      // Rule 4: sees both colors of its own digit.
      let sees0 = false;
      let sees1 = false;
      for (const p of getPeers(cell)) {
        if (set0.has(nodeKey(p, digit))) sees0 = true;
        if (set1.has(nodeKey(p, digit))) sees1 = true;
      }
      if (sees0 && sees1) {
        push(cell, digit);
        continue;
      }

      // Rule 5: its cell holds a colored candidate of color A, and it sees the
      // opposite color B of its own digit → false under either color.
      if ((has0 && sees1) || (has1 && sees0)) push(cell, digit);
    }
  }

  if (eliminations.length === 0) return null;
  eliminations.sort((a, b) => a.index - b.index || a.digit - b.digit);
  return buildHint(nodes, parent, eliminations, conflictText);
}

/** A color that contradicts itself (twice in one cell, or twice for one digit in
 *  one unit) must be false. Returns that color, or null. Rule 1 precedes rule 2. */
function findContradictoryColor(byColor: [number[], number[]]): 0 | 1 | null {
  for (const c of [0, 1] as const) {
    const cellSeen = new Set<CellIndex>();
    for (const k of byColor[c]) {
      const cell = cellOf(k);
      if (cellSeen.has(cell)) return c; // rule 1
      cellSeen.add(cell);
    }
  }
  for (const c of [0, 1] as const) {
    for (const d of DIGITS) {
      const cells = byColor[c].filter((k) => digitOf(k) === d).map(cellOf);
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          if (getPeers(cells[i]).has(cells[j])) return c; // rule 2
        }
      }
    }
  }
  return null;
}

const contradictionText = [
  { text: 'One color ' },
  { text: 'contradicts itself', emphasis: true },
  {
    text:
      ' — it repeats in a single cell, or twice for one digit in a unit. That whole color is impossible, so every candidate painted that color is removed.',
  },
];

const conflictText = [
  { text: 'Each struck candidate ' },
  { text: 'conflicts with both colors', emphasis: true },
  {
    text:
      ' — it sees both colors of its digit, or its own cell is already colored and it sees the opposite color. Whichever color is the true one, it cannot survive.',
  },
];

function buildHint(
  nodes: Colored[],
  parent: Map<number, number>,
  eliminations: { index: CellIndex; digit: Digit }[],
  revealText: { text: string; emphasis?: boolean }[],
): Hint {
  const intro: Record<CellIndex, CellAnnotation> = {};
  for (const n of nodes) {
    const cell = cellOf(n.key);
    const digit = digitOf(n.key);
    const existing = intro[cell];
    const notes = new Set(existing?.highlightNotes ?? []);
    notes.add(digit);
    // color 0 → 'unit', color 1 → 'focus'; a cell holding both leans to 'focus'.
    const tint: CellAnnotation['tint'] =
      n.color === 1 || existing?.tint === 'focus' ? 'focus' : 'unit';
    intro[cell] = { tint, highlightNotes: [...notes] };
  }

  const links: ChainLink[] = [...parent].map(([child, par]) => ({
    from: { index: cellOf(par), digit: digitOf(par) },
    to: { index: cellOf(child), digit: digitOf(child) },
    strong: true,
  }));

  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  const struck = new Map<CellIndex, Digit[]>();
  for (const e of eliminations) {
    (struck.get(e.index) ?? struck.set(e.index, []).get(e.index)!).push(e.digit);
  }
  for (const [i, dd] of struck) {
    reveal[i] = { ...reveal[i], tint: 'target', strikeNotes: dd };
  }

  return {
    technique: 'medusa_3d',
    title: 'Medusa',
    steps: [
      {
        text: [
          { text: 'Every strong link — a digit with ' },
          { text: 'two places in a unit', emphasis: true },
          { text: ', or a cell with ' },
          { text: 'two candidates', emphasis: true },
          {
            text:
              ' — joins two candidates in one connected web, painted in two alternating colors across cells and digits alike.',
          },
        ],
        annotations: intro,
        links,
      },
      {
        text: [
          { text: 'Exactly ' },
          { text: 'one color is the true one', emphasis: true },
          { text: '; every candidate of the other color is false. We just need to find which color breaks.' },
        ],
        annotations: intro,
        links,
      },
      { text: revealText, annotations: reveal, links },
    ],
    action: { kind: 'eliminate', eliminations },
  };
}
