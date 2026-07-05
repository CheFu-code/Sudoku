/**
 * Unique Rectangle (Type 4): a rectangle in two boxes whose "floor" cells are
 * the bivalue pair {x,y}. The two "roof" cells share a unit in which one of the
 * pair digits (say x) can only go in those two cells (a conjugate). To avoid the
 * deadly pattern, the other digit y can be removed from both roof cells.
 */

import { boxOf, colOf, indexOf, rowOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import { getBoxIndices, getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangleType4(
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

          const splits: [number[], number[]][] = [
            [[0, 1], [2, 3]],
            [[2, 3], [0, 1]],
            [[0, 2], [1, 3]],
            [[1, 3], [0, 2]],
          ];

          for (const [floor, roof] of splits) {
            const f0 = cs[floor[0]]!;
            const f1 = cs[floor[1]]!;
            if (f0.size !== 2 || !sameSet(f0, f1)) continue;
            const [x, y] = [...f0] as [Digit, Digit];

            const roofA = cells[roof[0]];
            const roofB = cells[roof[1]];
            const ra = cs[roof[0]]!;
            const rb = cs[roof[1]]!;
            if (!(ra.has(x) && ra.has(y) && rb.has(x) && rb.has(y))) continue;

            for (const [lockDigit, elimDigit] of [[x, y], [y, x]] as [Digit, Digit][]) {
              if (!isConjugate(roofA, roofB, lockDigit, candidates)) continue;
              const eliminations: { index: CellIndex; digit: Digit }[] = [];
              for (const roofCell of [roofA, roofB]) {
                if (candidates.get(roofCell)?.has(elimDigit)) {
                  eliminations.push({ index: roofCell, digit: elimDigit });
                }
              }
              if (eliminations.length === 0) continue;

              const intro: Record<CellIndex, CellAnnotation> = {};
              for (const k of floor) intro[cells[k]] = { tint: 'unit', highlightNotes: [x, y] };
              intro[roofA] = { tint: 'focus', highlightNotes: [lockDigit] };
              intro[roofB] = { tint: 'focus', highlightNotes: [lockDigit] };
              const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
              for (const e of eliminations) {
                reveal[e.index] = { tint: 'target', highlightNotes: [lockDigit], strikeNotes: [elimDigit] };
              }

              return {
                technique: 'unique_rectangle_4',
                title: 'Unique Rectangle',
                steps: [
                  {
                    text: [
                      { text: 'A rectangle in two boxes has the pair ' },
                      { text: `${x} / ${y}`, emphasis: true },
                      { text: ' on its floor, and ' },
                      { text: String(lockDigit), emphasis: true },
                      { text: ' is locked to the two roof cells.' },
                    ],
                    annotations: intro,
                  },
                  {
                    text: [
                      { text: 'To avoid two solutions, ' },
                      { text: String(elimDigit), emphasis: true },
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

/** `digit` appears only in cellA and cellB within some unit they share. */
function isConjugate(
  cellA: CellIndex,
  cellB: CellIndex,
  digit: Digit,
  candidates: Map<CellIndex, Set<Digit>>,
): boolean {
  const units: CellIndex[][] = [];
  if (rowOf(cellA) === rowOf(cellB)) units.push(getRowIndices(rowOf(cellA)));
  if (colOf(cellA) === colOf(cellB)) units.push(getColIndices(colOf(cellA)));
  if (boxOf(cellA) === boxOf(cellB)) units.push(getBoxIndices(boxOf(cellA)));
  return units.some((u) => u.filter((i) => candidates.get(i)?.has(digit)).length === 2);
}

function sameSet(a: Set<Digit>, b: Set<Digit>): boolean {
  if (a.size !== b.size) return false;
  for (const d of a) if (!b.has(d)) return false;
  return true;
}
