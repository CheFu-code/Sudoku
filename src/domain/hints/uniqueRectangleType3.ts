/**
 * Unique Rectangle Type 3: a rectangle in two boxes whose "floor" cells are the
 * bivalue pair {x,y}. The two "roof" cells carry extra candidates; treat their
 * combined extras as a single virtual cell that must hold one of them (else the
 * roof would collapse to the deadly {x,y} pattern). If that virtual cell plus k
 * other cells in a shared unit hold exactly k+1 distinct digits, those digits
 * form a naked subset and can be removed from the rest of the unit.
 */

import { boxOf, colOf, indexOf, rowOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import { combinations, getBoxIndices, getColIndices, getRowIndices } from './units';
import { formatDigits } from './text';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangleType3(
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

          // Floor and roof are parallel edges of the rectangle.
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

            // Extras carried by the roof (beyond {x,y}) become the virtual cell.
            const extras = new Set<Digit>();
            for (const d of ra) if (d !== x && d !== y) extras.add(d);
            for (const d of rb) if (d !== x && d !== y) extras.add(d);
            if (extras.size === 0) continue;

            const hint = tryUnits(candidates, roofA, roofB, extras, x, y);
            if (hint) return hint;
          }
        }
      }
    }
  }
  return null;
}

/** Search each unit shared by the two roof cells for a naked subset with the virtual cell. */
function tryUnits(
  candidates: Map<CellIndex, Set<Digit>>,
  roofA: CellIndex,
  roofB: CellIndex,
  extras: Set<Digit>,
  x: Digit,
  y: Digit,
): Hint | null {
  const units: CellIndex[][] = [];
  if (rowOf(roofA) === rowOf(roofB)) units.push(getRowIndices(rowOf(roofA)));
  if (colOf(roofA) === colOf(roofB)) units.push(getColIndices(colOf(roofA)));
  if (boxOf(roofA) === boxOf(roofB)) units.push(getBoxIndices(boxOf(roofA)));

  for (const unit of units) {
    const pool = unit.filter(
      (i) => i !== roofA && i !== roofB && candidates.has(i),
    );
    for (let k = 1; k <= 3 && k <= pool.length; k++) {
      for (const combo of combinations(pool, k)) {
        const subsetDigits = new Set<Digit>(extras);
        for (const c of combo) for (const d of candidates.get(c)!) subsetDigits.add(d);
        if (subsetDigits.size !== k + 1) continue;

        const subsetCells = new Set(combo);
        const eliminations: { index: CellIndex; digit: Digit }[] = [];
        for (const cell of unit) {
          if (cell === roofA || cell === roofB || subsetCells.has(cell)) continue;
          const cc = candidates.get(cell);
          if (!cc) continue;
          for (const d of subsetDigits) if (cc.has(d)) eliminations.push({ index: cell, digit: d });
        }
        if (eliminations.length === 0) continue;

        const digitList = [...subsetDigits].sort((a, b) => a - b);
        const intro: Record<CellIndex, CellAnnotation> = {};
        intro[roofA] = { tint: 'focus', highlightNotes: [...candidates.get(roofA)!].sort((a, b) => a - b) };
        intro[roofB] = { tint: 'focus', highlightNotes: [...candidates.get(roofB)!].sort((a, b) => a - b) };
        for (const c of combo) intro[c] = { tint: 'unit', highlightNotes: [...candidates.get(c)!].sort((a, b) => a - b) };
        const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
        for (const e of eliminations) {
          const prev = reveal[e.index];
          reveal[e.index] = {
            tint: 'target',
            strikeNotes: [...new Set([...(prev?.strikeNotes ?? []), e.digit])].sort((a, b) => a - b),
          };
        }

        return {
          technique: 'unique_rectangle_3',
          title: 'Unique Rectangle',
          steps: [
            {
              text: [
                { text: 'A rectangle in two boxes has the pair ' },
                { text: `${x} / ${y}`, emphasis: true },
                { text: ' on its floor. To avoid two solutions, the two roof cells cannot both be just ' },
                { text: `${x} / ${y}`, emphasis: true },
                { text: ' — together they must use one of the extras ' },
                { text: formatDigits([...extras].sort((a, b) => a - b)), emphasis: true },
                { text: '.' },
              ],
              annotations: intro,
            },
            {
              text: [
                { text: 'Treating the roof as one virtual cell of those extras, it plus the other highlighted cells hold exactly ' },
                { text: formatDigits(digitList), emphasis: true },
                { text: ' — a locked set. Those digits can be removed from the rest of the unit.' },
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

function sameSet(a: Set<Digit>, b: Set<Digit>): boolean {
  if (a.size !== b.size) return false;
  for (const d of a) if (!b.has(d)) return false;
  return true;
}
