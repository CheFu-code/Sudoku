/**
 * W-Wing: two cells with the same bivalue pair {x,y} that are linked by a strong
 * link on one of the digits (a unit where that digit fits in exactly two cells,
 * one seeing each {x,y} cell). The two {x,y} cells can never both be the other
 * digit, so it can be removed from any cell that sees both of them.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectWWing(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const bivalue = [...candidates.entries()].filter(([, c]) => c.size === 2);

  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const [a, ca] = bivalue[i];
      const [b, cb] = bivalue[j];
      if (!sameSet(ca, cb)) continue;
      if (getPeers(a).has(b)) continue; // peers → not a W-Wing
      const [x, y] = [...ca] as [Digit, Digit];

      for (const link of [x, y] as Digit[]) {
        const elimDigit = link === x ? y : x;

        for (const unit of ALL_UNITS) {
          const pos = unit.indices.filter((k) => candidates.get(k)?.has(link));
          if (pos.length !== 2) continue;
          const [p, q] = pos;
          if (p === a || p === b || q === a || q === b) continue;

          const linksAB =
            (getPeers(a).has(p) && getPeers(b).has(q)) ||
            (getPeers(b).has(p) && getPeers(a).has(q));
          if (!linksAB) continue;

          const peersB = getPeers(b);
          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const cell of getPeers(a)) {
            if (cell === b || !peersB.has(cell)) continue;
            if (candidates.get(cell)?.has(elimDigit)) {
              eliminations.push({ index: cell, digit: elimDigit });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {
            [a]: { tint: 'unit', highlightNotes: [x, y] },
            [b]: { tint: 'unit', highlightNotes: [x, y] },
            [p]: { tint: 'focus', highlightNotes: [link] },
            [q]: { tint: 'focus', highlightNotes: [link] },
          };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [elimDigit] };

          return {
            technique: 'w_wing',
            title: 'W-Wing',
            steps: [
              {
                text: [
                  { text: 'Two separate cells hold the exact same pair ' },
                  { text: `${x} / ${y}`, emphasis: true },
                  { text: '. The two darker cells connect them: in their unit, ' },
                  { text: String(link), emphasis: true },
                  { text: ' fits only in those two cells — a ' },
                  { text: 'strong link', emphasis: true },
                  { text: `, so one of them MUST be ${link}.` },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'Each end of the link sees one pair cell. Whichever end is ' },
                  { text: String(link), emphasis: true },
                  { text: `, its neighbouring pair cell can't also be ${link} and is forced to ` },
                  { text: String(elimDigit), emphasis: true },
                  { text: '. So at least one of the two pair cells is certainly ' },
                  { text: String(elimDigit), emphasis: true },
                  { text: '.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'A cell that sees ' },
                  { text: 'both pair cells', emphasis: true },
                  { text: ' can therefore never hold ' },
                  { text: String(elimDigit), emphasis: true },
                  { text: ' — the struck candidates are removed.' },
                ],
                annotations: reveal,
              },
            ],
            action: { kind: 'eliminate', eliminations },
          };
        }
      }
    }
  }
  return null;
}

function sameSet(a: Set<Digit>, b: Set<Digit>): boolean {
  if (a.size !== b.size) return false;
  for (const d of a) if (!b.has(d)) return false;
  return true;
}
