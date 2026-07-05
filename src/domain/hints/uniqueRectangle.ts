/**
 * Unique Rectangle (Type 1): four cells forming a rectangle that spans exactly
 * two boxes, where three of them are the identical bivalue pair {x,y}. If the
 * fourth cell were also just {x,y}, the puzzle would have two solutions (the
 * "deadly pattern"). Since the puzzle is unique, x and y can be removed from the
 * fourth cell.
 */

import { indexOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation } from './types';
import { formatDigits } from './text';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangle(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          // The deadly pattern needs exactly two boxes: one dimension shares a
          // band, the other does not.
          if ((band(r1) === band(r2)) === (band(c1) === band(c2))) continue;

          const cells = [
            indexOf(r1, c1),
            indexOf(r1, c2),
            indexOf(r2, c1),
            indexOf(r2, c2),
          ];
          const cs = cells.map((i) => candidates.get(i));
          if (cs.some((c) => !c)) continue; // every corner must be empty

          for (let k = 0; k < 4; k++) {
            const others = [0, 1, 2, 3].filter((t) => t !== k);
            const o0 = cs[others[0]]!;
            const o1 = cs[others[1]]!;
            const o2 = cs[others[2]]!;
            if (o0.size !== 2 || !sameSet(o0, o1) || !sameSet(o0, o2)) continue;

            const [x, y] = [...o0] as [Digit, Digit];
            const extra = cs[k]!;
            if (!(extra.has(x) && extra.has(y) && extra.size >= 3)) continue;

            const target = cells[k];
            const eliminations = ([x, y] as Digit[])
              .filter((d) => extra.has(d))
              .map((d) => ({ index: target, digit: d }));
            if (eliminations.length === 0) continue;

            const intro: Record<CellIndex, CellAnnotation> = {};
            for (const t of others) intro[cells[t]] = { tint: 'unit', highlightNotes: [x, y] };
            intro[target] = { tint: 'unit', highlightNotes: [x, y] };

            const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
            reveal[target] = { tint: 'target', strikeNotes: [x, y] };

            return {
              technique: 'unique_rectangle',
              title: 'Unique Rectangle',
              steps: [
                {
                  text: [
                    { text: 'These four ' },
                    { text: 'highlighted cells', emphasis: true },
                    { text: ' form a rectangle across two boxes, and three of them hold only ' },
                    { text: formatDigits([x, y]), emphasis: true },
                    { text: '.' },
                  ],
                  annotations: intro,
                },
                {
                  text: [
                    { text: 'If the fourth cell were also just ' },
                    { text: formatDigits([x, y]), emphasis: true },
                    { text: ', the puzzle would have two solutions. Since it has one, ' },
                    { text: formatDigits([x, y]), emphasis: true },
                    { text: ' can be removed from that cell.' },
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
  }
  return null;
}

function sameSet(a: Set<Digit>, b: Set<Digit>): boolean {
  if (a.size !== b.size) return false;
  for (const d of a) if (!b.has(d)) return false;
  return true;
}
