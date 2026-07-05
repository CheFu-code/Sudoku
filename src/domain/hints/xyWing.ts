/**
 * XY-Wing: a bivalue pivot {x,y} with two bivalue pincers that are peers of the
 * pivot — one {x,z}, one {y,z}. Whichever value the pivot takes, one pincer is
 * forced to z, so any cell that sees BOTH pincers cannot be z.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation } from './types';

export function detectXYWing(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const bivalue = [...candidates.entries()].filter(([, c]) => c.size === 2);

  for (const [pivot, pcands] of bivalue) {
    const [x, y] = [...pcands] as [Digit, Digit];
    const peers = [...getPeers(pivot)].filter((p) => candidates.get(p)?.size === 2);

    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const a = peers[i];
        const b = peers[j];
        const ca = candidates.get(a)!;
        const cb = candidates.get(b)!;

        // One pincer carries x (+z), the other y (+z), with the same extra z.
        const za = extra(ca, x, y);
        const zb = extra(cb, x, y);
        if (za === null || zb === null || za !== zb) continue;
        const z = za;
        // The pincers must share different pivot digits (one x, one y).
        if (!(ca.has(x) && cb.has(y)) && !(ca.has(y) && cb.has(x))) continue;
        if (ca.has(x) === cb.has(x)) continue;

        const eliminations: { index: CellIndex; digit: Digit }[] = [];
        const peersB = getPeers(b);
        for (const cell of getPeers(a)) {
          if (cell === pivot || cell === b) continue;
          if (!peersB.has(cell)) continue;
          if (candidates.get(cell)?.has(z)) {
            eliminations.push({ index: cell, digit: z });
          }
        }
        if (eliminations.length === 0) continue;

        const intro: Record<CellIndex, CellAnnotation> = {
          [pivot]: { tint: 'unit', highlightNotes: [x, y] },
          [a]: { tint: 'unit', highlightNotes: [...ca].sort((m, n) => m - n) },
          [b]: { tint: 'unit', highlightNotes: [...cb].sort((m, n) => m - n) },
        };
        const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
        for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

        return {
          technique: 'xy_wing',
          title: 'XY-Wing',
          steps: [
            {
              text: [
                { text: 'These three ' },
                { text: 'highlighted cells', emphasis: true },
                { text: ' form an XY-Wing: the pivot is ' },
                { text: `${x} / ${y}`, emphasis: true },
                { text: ', and its two pincers each share one of those with ' },
                { text: String(z), emphasis: true },
                { text: '.' },
              ],
              annotations: intro,
            },
            {
              text: [
                { text: 'Whichever way the pivot resolves, one pincer becomes ' },
                { text: String(z), emphasis: true },
                { text: '. So any cell seeing ' },
                { text: 'both pincers', emphasis: true },
                { text: ' can not be ' },
                { text: String(z), emphasis: true },
                { text: '.' },
              ],
              annotations: reveal,
            },
          ],
          action: { kind: 'eliminate', eliminations },
        };
      }
    }
  }
  return null;
}

/** If `c` is {one of a,b} plus exactly one other digit, return that other digit. */
function extra(c: Set<Digit>, a: Digit, b: Digit): Digit | null {
  const shared = [...c].filter((d) => d === a || d === b);
  const others = [...c].filter((d) => d !== a && d !== b);
  if (shared.length !== 1 || others.length !== 1) return null;
  return others[0];
}
