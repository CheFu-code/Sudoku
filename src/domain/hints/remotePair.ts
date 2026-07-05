/**
 * Remote Pair: a chain of four or more cells that all share the same bivalue
 * pair {x,y}, each linked to the next by being peers. The chain alternates
 * x/y, so any cell that sees two opposite-parity members can be neither x nor y.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation, ChainLink } from './types';

export function detectRemotePair(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  // Group bivalue cells by their exact pair.
  const groups = new Map<string, CellIndex[]>();
  for (const [i, c] of candidates) {
    if (c.size !== 2) continue;
    const key = [...c].sort((a, b) => a - b).join(',');
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(i);
  }

  for (const [key, cells] of groups) {
    if (cells.length < 4) continue;
    const [x, y] = key.split(',').map(Number) as [Digit, Digit];
    const cellSet = new Set(cells);

    const adj = new Map<CellIndex, CellIndex[]>();
    for (const i of cells) adj.set(i, cells.filter((j) => j !== i && getPeers(i).has(j)));

    const visited = new Set<CellIndex>();
    for (const start of cells) {
      if (visited.has(start) || adj.get(start)!.length === 0) continue;

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
      if (comp.length < 4) continue;

      const set0 = new Set(comp.filter((c) => color.get(c) === 0));
      const set1 = new Set(comp.filter((c) => color.get(c) === 1));

      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const [t, tc] of candidates) {
        if (cellSet.has(t)) continue;
        let sees0 = false;
        let sees1 = false;
        for (const p of getPeers(t)) {
          if (set0.has(p)) sees0 = true;
          if (set1.has(p)) sees1 = true;
        }
        if (!(sees0 && sees1)) continue;
        for (const d of [x, y] as Digit[]) {
          if (tc.has(d)) eliminations.push({ index: t, digit: d });
        }
      }
      if (eliminations.length === 0) continue;

      const intro: Record<CellIndex, CellAnnotation> = {};
      for (const c of set0) intro[c] = { tint: 'unit', highlightNotes: [x, y] };
      for (const c of set1) intro[c] = { tint: 'target', highlightNotes: [x, y] };

      // Arrows trace the chain along its spanning tree. Each cell is labelled
      // with the digit its colour implies (colour 0 → x, colour 1 → y), so the
      // arrows read x → y → x …; the alternation is a strong (conjugate) link.
      const digitFor = (c: CellIndex): Digit => (color.get(c) === 0 ? x : y);
      const links: ChainLink[] = [...parent].map(([child, par]) => ({
        from: { index: par, digit: digitFor(par) },
        to: { index: child, digit: digitFor(child) },
        strong: true,
      }));
      const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
      const struck = new Map<CellIndex, Digit[]>();
      for (const e of eliminations) {
        (struck.get(e.index) ?? struck.set(e.index, []).get(e.index)!).push(e.digit);
      }
      for (const [i, ds] of struck) reveal[i] = { strikeNotes: ds };

      return {
        technique: 'remote_pair',
        title: 'Remote Pair',
        steps: [
          {
            text: [
              { text: 'These cells all hold the same pair ' },
              { text: `${x} / ${y}`, emphasis: true },
              { text: ' and chain together, alternating between the two ' },
              { text: 'shades', emphasis: true },
              { text: '.' },
            ],
            annotations: intro,
            links,
          },
          {
            text: [
              { text: 'Any cell seeing ' },
              { text: 'both shades', emphasis: true },
              { text: ' can be neither ' },
              { text: `${x} nor ${y}`, emphasis: true },
              { text: ', so both are removed there.' },
            ],
            annotations: reveal,
            links,
          },
        ],
        action: { kind: 'eliminate', eliminations },
      };
    }
  }
  return null;
}
