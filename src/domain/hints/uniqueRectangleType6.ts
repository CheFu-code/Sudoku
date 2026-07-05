/**
 * Unique Rectangle Type 6: a rectangle in two boxes whose "floor" diagonal is
 * the bivalue pair {x,y}. If the UR digit x is a conjugate pair in both rows and
 * both columns of the rectangle (an X-Wing on x over the four corners), then
 * placing x on the roof diagonal would force the deadly pattern. So x is removed
 * from both roof corners.
 */

import { indexOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import { getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangleType6(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          if ((band(r1) === band(r2)) === (band(c1) === band(c2))) continue;

          // Corner order: 0=(r1,c1) 1=(r1,c2) 2=(r2,c1) 3=(r2,c2).
          const cells = [indexOf(r1, c1), indexOf(r1, c2), indexOf(r2, c1), indexOf(r2, c2)];
          const cs = cells.map((i) => candidates.get(i));
          if (cs.some((c) => !c)) continue;

          // Two diagonals: {0,3} and {1,2}. Floor is bivalue, roof is the other.
          const diagPairs: [number[], number[]][] = [
            [[0, 3], [1, 2]],
            [[1, 2], [0, 3]],
          ];

          for (const [floor, roof] of diagPairs) {
            const f0 = cs[floor[0]]!;
            const f1 = cs[floor[1]]!;
            if (f0.size !== 2 || !sameSet(f0, f1)) continue;
            const [x, y] = [...f0] as [Digit, Digit];

            const roofA = cells[roof[0]];
            const roofB = cells[roof[1]];
            const ra = cs[roof[0]]!;
            const rb = cs[roof[1]]!;
            if (!(ra.has(x) && ra.has(y) && rb.has(x) && rb.has(y))) continue;

            for (const u of [x, y] as Digit[]) {
              // u must be conjugate (only in the two corners) on all four lines.
              const rowsOk =
                onlyInPair(getRowIndices(r1), indexOf(r1, c1), indexOf(r1, c2), u, candidates) &&
                onlyInPair(getRowIndices(r2), indexOf(r2, c1), indexOf(r2, c2), u, candidates);
              const colsOk =
                onlyInPair(getColIndices(c1), indexOf(r1, c1), indexOf(r2, c1), u, candidates) &&
                onlyInPair(getColIndices(c2), indexOf(r1, c2), indexOf(r2, c2), u, candidates);
              if (!rowsOk || !colsOk) continue;

              const eliminations: { index: CellIndex; digit: Digit }[] = [];
              for (const cell of [roofA, roofB]) {
                if (candidates.get(cell)?.has(u)) eliminations.push({ index: cell, digit: u });
              }
              if (eliminations.length === 0) continue;

              const intro: Record<CellIndex, CellAnnotation> = {};
              for (const k of floor) intro[cells[k]] = { tint: 'unit', highlightNotes: [x, y] };
              intro[roofA] = { tint: 'focus', highlightNotes: [u] };
              intro[roofB] = { tint: 'focus', highlightNotes: [u] };
              const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
              for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [u] };

              return {
                technique: 'unique_rectangle_6',
                title: 'Unique Rectangle',
                steps: [
                  {
                    text: [
                      { text: 'A rectangle in two boxes has the pair ' },
                      { text: `${x} / ${y}`, emphasis: true },
                      { text: ' on its floor diagonal, and ' },
                      { text: String(u), emphasis: true },
                      { text: ' forms an X-Wing across both rectangle rows and columns.' },
                    ],
                    annotations: intro,
                  },
                  {
                    text: [
                      { text: 'Placing ' },
                      { text: String(u), emphasis: true },
                      { text: ' on the roof diagonal would force the deadly pattern, so ' },
                      { text: String(u), emphasis: true },
                      { text: ' can be removed from both roof cells.' },
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

function sameSet(a: Set<Digit>, b: Set<Digit>): boolean {
  if (a.size !== b.size) return false;
  for (const d of a) if (!b.has(d)) return false;
  return true;
}
