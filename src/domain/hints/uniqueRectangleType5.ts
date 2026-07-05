/**
 * Unique Rectangle Type 5: like Type 2, but the corners carrying the single
 * extra digit z sit diagonally (two diagonal corners with {x,y,z}, or three
 * corners with {x,y,z} and one bivalue {x,y}). To avoid the deadly pattern z
 * must fill one of those extra corners, so z is eliminated from every cell that
 * sees all of them.
 */

import { colOf, indexOf, rowOf } from '../board';
import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangleType5(
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

          const bivalue = [0, 1, 2, 3].filter((k) => cs[k]!.size === 2);
          const extraCorners = [0, 1, 2, 3].filter((k) => cs[k]!.size === 3);
          // Every corner must be bivalue {x,y} or {x,y}+z; need 2 or 3 extras.
          if (bivalue.length + extraCorners.length !== 4) continue;
          if (bivalue.length === 0) continue;
          if (extraCorners.length !== 2 && extraCorners.length !== 3) continue;

          const base = cs[bivalue[0]]!;
          const [x, y] = [...base] as [Digit, Digit];
          if (!bivalue.every((k) => sameSet(cs[k]!, base))) continue;

          // Each extra corner is exactly {x,y,z} with the same z.
          let z: Digit | undefined;
          let ok = true;
          for (const k of extraCorners) {
            const c = cs[k]!;
            if (!(c.has(x) && c.has(y))) { ok = false; break; }
            const extra = [...c].find((d) => d !== x && d !== y)!;
            if (z === undefined) z = extra;
            else if (z !== extra) { ok = false; break; }
          }
          if (!ok || z === undefined) continue;

          // Type 2 covers extra corners sharing a line; Type 5 needs them diagonal.
          if (extraCorners.length === 2) {
            const a = cells[extraCorners[0]];
            const b = cells[extraCorners[1]];
            if (rowOf(a) === rowOf(b) || colOf(a) === colOf(b)) continue;
          }

          const extraCells = extraCorners.map((k) => cells[k]);
          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const [t, tc] of candidates) {
            if (cells.includes(t)) continue;
            if (!tc.has(z)) continue;
            if (extraCells.every((e) => getPeers(t).has(e))) {
              eliminations.push({ index: t, digit: z });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const k of bivalue) intro[cells[k]] = { tint: 'unit', highlightNotes: [x, y] };
          for (const k of extraCorners) intro[cells[k]] = { tint: 'focus', highlightNotes: [x, y, z] };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

          return {
            technique: 'unique_rectangle_5',
            title: 'Unique Rectangle',
            steps: [
              {
                text: [
                  { text: 'These four cells form a rectangle in two boxes holding ' },
                  { text: `${x} / ${y}`, emphasis: true },
                  { text: `, with the same extra ` },
                  { text: String(z), emphasis: true },
                  { text: ' on the diagonally placed corners.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'To avoid two solutions, ' },
                  { text: String(z), emphasis: true },
                  { text: ' must fill one of those corners — so ' },
                  { text: String(z), emphasis: true },
                  { text: ' can be removed from any cell seeing all of them.' },
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
