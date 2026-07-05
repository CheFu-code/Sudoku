/**
 * XYZ-Wing: a trivalue pivot {x,y,z} with two bivalue pincers that are peers of
 * the pivot — {x,z} and {y,z}. Any cell that sees the pivot AND both pincers
 * cannot be z (one of the three is forced to z).
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation } from './types';

export function detectXYZWing(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const trivalue = [...candidates.entries()].filter(([, c]) => c.size === 3);

  for (const [pivot, pcands] of trivalue) {
    const peers = [...getPeers(pivot)].filter((p) => {
      const c = candidates.get(p);
      return c?.size === 2 && [...c].every((d) => pcands.has(d));
    });

    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const a = peers[i];
        const b = peers[j];
        const ca = candidates.get(a)!;
        const cb = candidates.get(b)!;

        // Pincers share exactly one digit (z) and together cover the pivot.
        const shared = [...ca].filter((d) => cb.has(d));
        if (shared.length !== 1) continue;
        const z = shared[0];
        const union = new Set([...ca, ...cb]);
        if (union.size !== 3) continue; // must equal the pivot's three digits

        const eliminations: { index: CellIndex; digit: Digit }[] = [];
        const peersP = getPeers(pivot);
        const peersB = getPeers(b);
        for (const cell of getPeers(a)) {
          if (cell === pivot || cell === b) continue;
          if (!peersB.has(cell) || !peersP.has(cell)) continue;
          if (candidates.get(cell)?.has(z)) {
            eliminations.push({ index: cell, digit: z });
          }
        }
        if (eliminations.length === 0) continue;

        const intro: Record<CellIndex, CellAnnotation> = {
          [pivot]: { tint: 'unit', highlightNotes: [...pcands].sort((m, n) => m - n) },
          [a]: { tint: 'unit', highlightNotes: [...ca].sort((m, n) => m - n) },
          [b]: { tint: 'unit', highlightNotes: [...cb].sort((m, n) => m - n) },
        };
        const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
        for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

        return {
          technique: 'xyz_wing',
          title: 'XYZ-Wing',
          steps: [
            {
              text: [
                { text: 'These three ' },
                { text: 'highlighted cells', emphasis: true },
                { text: ' form an XYZ-Wing: the pivot holds three candidates and each pincer shares two of them, all including ' },
                { text: String(z), emphasis: true },
                { text: '.' },
              ],
              annotations: intro,
            },
            {
              text: [
                { text: 'One of the three must be ' },
                { text: String(z), emphasis: true },
                { text: '. So any cell seeing ' },
                { text: 'all three', emphasis: true },
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
