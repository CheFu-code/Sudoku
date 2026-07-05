/**
 * Hidden Rectangle: a Unique Rectangle buried under extra candidates. One corner
 * is a clean bivalue {x,y}. Look at the diagonally opposite corner D: if the
 * digit y has exactly two positions in D's row (D and the corner sharing that
 * row) and exactly two in D's column (D and the corner sharing that column) —
 * strong links on y through D — then x can be removed from D. Were D = x, both
 * strong links would force y into the adjacent corners, and the clean corner
 * would collapse to y, completing the deadly rectangle.
 */

import { colOf, indexOf, rowOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import { getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectHiddenRectangle(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          if ((band(r1) === band(r2)) === (band(c1) === band(c2))) continue;

          const cells = [indexOf(r1, c1), indexOf(r1, c2), indexOf(r2, c1), indexOf(r2, c2)];
          const cs = cells.map((i) => candidates.get(i));
          if (cs.some((c) => !c)) continue;

          for (let k = 0; k < 4; k++) {
            const clean = cs[k]!;
            if (clean.size !== 2) continue;
            const [p, q] = [...clean] as [Digit, Digit];
            // Every corner must carry both UR digits.
            if (!cells.every((_, idx) => cs[idx]!.has(p) && cs[idx]!.has(q))) continue;

            const opp = 3 - k; // diagonally opposite corner
            const D = cells[opp];
            const others = [0, 1, 2, 3].filter((t) => t !== k && t !== opp);
            const rowMate = cells[others.find((o) => rowOf(cells[o]) === rowOf(D))!];
            const colMate = cells[others.find((o) => colOf(cells[o]) === colOf(D))!];

            for (const [x, y] of [[p, q], [q, p]] as [Digit, Digit][]) {
              // Strong links on y along D's row and D's column, pinned to the corners.
              const rowOk = onlyInPair(getRowIndices(rowOf(D)), D, rowMate, y, candidates);
              const colOk = onlyInPair(getColIndices(colOf(D)), D, colMate, y, candidates);
              if (!rowOk || !colOk) continue;
              if (!candidates.get(D)?.has(x)) continue;

              const eliminations = [{ index: D, digit: x }];

              const intro: Record<CellIndex, CellAnnotation> = {};
              intro[cells[k]] = { tint: 'unit', highlightNotes: [p, q] };
              intro[rowMate] = { tint: 'focus', highlightNotes: [x, y] };
              intro[colMate] = { tint: 'focus', highlightNotes: [x, y] };
              intro[D] = { tint: 'focus', highlightNotes: [x, y] };
              const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
              reveal[D] = { tint: 'target', strikeNotes: [x] };

              return {
                technique: 'hidden_rectangle',
                title: 'Hidden Rectangle',
                steps: [
                  {
                    text: [
                      { text: 'These four cells form a rectangle in two boxes, all sharing ' },
                      { text: `${x} / ${y}`, emphasis: true },
                      { text: '. One corner holds only that pair.' },
                    ],
                    annotations: intro,
                  },
                  {
                    text: [
                      { text: 'Through the opposite corner, ' },
                      { text: String(y), emphasis: true },
                      { text: ' has just two spots in its row and two in its column. If that corner were ' },
                      { text: String(x), emphasis: true },
                      { text: ', those links would force the deadly rectangle — so ' },
                      { text: String(x), emphasis: true },
                      { text: ' is removed from it.' },
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
  }
  return null;
}

/** `digit` appears only in cells `a` and `b` within `line`. */
function onlyInPair(
  line: CellIndex[],
  a: CellIndex,
  b: CellIndex,
  digit: Digit,
  candidates: Map<CellIndex, Set<Digit>>,
): boolean {
  const withDigit = line.filter((i) => candidates.get(i)?.has(digit));
  return withDigit.length === 2 && withDigit.includes(a) && withDigit.includes(b);
}
