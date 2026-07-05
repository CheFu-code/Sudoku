/**
 * Simple Coloring (single-digit chain): follow a digit's strong links (units
 * where it has exactly two candidate cells) and 2-color each chain. Two rules
 * then eliminate the digit:
 *  - Trap: an uncolored candidate cell that sees both colors can't be the digit.
 *  - Wrap: two same-colored cells sharing a unit make that color impossible, so
 *    the digit leaves every cell of that color.
 */

import { getPeers } from '../rules';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS } from './units';
import type { Hint, CellAnnotation, ChainLink } from './types';

export function detectSimpleColoring(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (const digit of DIGITS) {
    const candCells = [...candidates.keys()].filter((i) => candidates.get(i)!.has(digit));
    if (candCells.length < 4) continue;
    const candSet = new Set(candCells);

    // Strong links: a unit where the digit fits in exactly two cells.
    const adj = new Map<CellIndex, CellIndex[]>();
    for (const i of candCells) adj.set(i, []);
    for (const unit of ALL_UNITS) {
      const pos = unit.indices.filter((i) => candSet.has(i));
      if (pos.length === 2) {
        adj.get(pos[0])!.push(pos[1]);
        adj.get(pos[1])!.push(pos[0]);
      }
    }

    const visited = new Set<CellIndex>();
    for (const start of candCells) {
      if (visited.has(start) || adj.get(start)!.length === 0) continue;

      // 2-color the connected component.
      const color = new Map<CellIndex, 0 | 1>([[start, 0]]);
      const parent = new Map<CellIndex, CellIndex>();
      visited.add(start);
      const queue = [start];
      const comp = [start];
      while (queue.length) {
        const u = queue.shift()!;
        for (const v of adj.get(u)!) {
          if (!color.has(v)) {
            color.set(v, (color.get(u)! ^ 1) as 0 | 1);
            parent.set(v, u);
            visited.add(v);
            comp.push(v);
            queue.push(v);
          }
        }
      }
      if (comp.length < 2) continue;

      // Arrows trace the strong-link chain along its spanning tree.
      const links: ChainLink[] = [...parent].map(([child, par]) => ({
        from: { index: par, digit },
        to: { index: child, digit },
        strong: true,
      }));

      const group0 = comp.filter((c) => color.get(c) === 0);
      const group1 = comp.filter((c) => color.get(c) === 1);

      // Wrap: a color that has two cells sharing a unit is impossible.
      for (const grp of [group0, group1]) {
        if (hasPeerPair(grp)) {
          const elim = grp
            .filter((c) => board[c].notes.has(digit))
            .map((c) => ({ index: c, digit }));
          if (elim.length) {
            return buildHint('wrap', digit, group0, group1, elim, links);
          }
        }
      }

      // Trap: an uncolored candidate cell seeing both colors.
      const set0 = new Set(group0);
      const set1 = new Set(group1);
      const elim: { index: CellIndex; digit: Digit }[] = [];
      for (const t of candCells) {
        if (color.has(t)) continue;
        let sees0 = false;
        let sees1 = false;
        for (const p of getPeers(t)) {
          if (set0.has(p)) sees0 = true;
          if (set1.has(p)) sees1 = true;
        }
        if (sees0 && sees1 && board[t].notes.has(digit)) elim.push({ index: t, digit });
      }
      if (elim.length) {
        return buildHint('trap', digit, group0, group1, elim, links);
      }
    }
  }
  return null;
}

function hasPeerPair(cells: CellIndex[]): boolean {
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      if (getPeers(cells[a]).has(cells[b])) return true;
    }
  }
  return false;
}

function buildHint(
  mode: 'trap' | 'wrap',
  digit: Digit,
  group0: CellIndex[],
  group1: CellIndex[],
  eliminations: { index: CellIndex; digit: Digit }[],
  links: ChainLink[],
): Hint {
  const intro: Record<CellIndex, CellAnnotation> = {};
  for (const c of group0) intro[c] = { tint: 'unit', highlightNotes: [digit] };
  for (const c of group1) intro[c] = { tint: 'target', highlightNotes: [digit] };

  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  for (const e of eliminations) {
    reveal[e.index] = { ...(reveal[e.index] ?? {}), strikeNotes: [digit] };
  }

  const revealText =
    mode === 'wrap'
      ? [
          { text: 'But two cells of the ' },
          { text: 'same shade', emphasis: true },
          { text: " share a row, column or box — they can't both be " },
          { text: String(digit), emphasis: true },
          { text: '. That whole shade is impossible, so ' },
          { text: String(digit), emphasis: true },
          { text: ' is removed from every struck cell.' },
        ]
      : [
          { text: 'The struck cell sees ' },
          { text: 'both shades', emphasis: true },
          { text: '. Whichever shade turns out true, one of its neighbours is ' },
          { text: String(digit), emphasis: true },
          { text: ' — so the cell itself can never be, and loses the candidate.' },
        ];

  return {
    technique: 'simple_coloring',
    title: 'Coloring',
    steps: [
      {
        text: [
          { text: 'Focus on the digit ' },
          { text: String(digit), emphasis: true },
          { text: '. In several units it fits in ' },
          { text: 'only two cells', emphasis: true },
          { text: ' — a strong link: exactly one of the two must be ' },
          { text: String(digit), emphasis: true },
          { text: '. Following every link paints these cells in two alternating shades.' },
        ],
        annotations: intro,
        links,
      },
      {
        text: [
          { text: 'Each link joins opposite shades, so all cells of one shade are ' },
          { text: String(digit), emphasis: true },
          { text: ' together — or none of them are. ' },
          { text: 'Exactly one whole shade is the true one', emphasis: true },
          { text: "; we just don't know which yet." },
        ],
        annotations: intro,
        links,
      },
      { text: revealText, annotations: reveal, links },
    ],
    action: { kind: 'eliminate', eliminations },
  };
}
