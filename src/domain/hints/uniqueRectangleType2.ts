/**
 * Unique Rectangle (Type 2): a rectangle in two boxes where two corners (the
 * "floor") are the bivalue pair {x,y} and the other two (the "roof") are
 * {x,y,z} — the same extra z. To avoid the deadly two-solution pattern, z must
 * go in one of the roof cells, so z can be removed from any cell seeing both.
 */

import { indexOf } from '../board';
import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import type { Hint, CellAnnotation } from './types';

const band = (n: number) => Math.floor(n / 3);

export function detectUniqueRectangleType2(
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

          const floorIdx = [0, 1, 2, 3].filter((k) => cs[k]!.size === 2);
          const roofIdx = [0, 1, 2, 3].filter((k) => cs[k]!.size === 3);
          if (floorIdx.length !== 2 || roofIdx.length !== 2) continue;

          const f0 = cs[floorIdx[0]]!;
          if (!sameSet(f0, cs[floorIdx[1]]!)) continue;
          const [x, y] = [...f0] as [Digit, Digit];

          const r0 = cs[roofIdx[0]]!;
          const r1c = cs[roofIdx[1]]!;
          if (!sameSet(r0, r1c)) continue;
          if (!(r0.has(x) && r0.has(y))) continue;
          const z = [...r0].find((d) => d !== x && d !== y);
          if (z === undefined) continue;

          const roofA = cells[roofIdx[0]];
          const roofB = cells[roofIdx[1]];
          const peersB = getPeers(roofB);
          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const cell of getPeers(roofA)) {
            if (cell === roofB || !peersB.has(cell)) continue;
            if (candidates.get(cell)?.has(z)) {
              eliminations.push({ index: cell, digit: z });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const k of floorIdx) intro[cells[k]] = { tint: 'unit', highlightNotes: [x, y] };
          for (const k of roofIdx) intro[cells[k]] = { tint: 'focus', highlightNotes: [x, y, z] };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

          return {
            technique: 'unique_rectangle_2',
            title: 'Unique Rectangle',
            steps: [
              {
                text: [
                  { text: 'These four cells form a rectangle in two boxes; two hold ' },
                  { text: `${x} / ${y}`, emphasis: true },
                  { text: ' and the other two add the same extra ' },
                  { text: String(z), emphasis: true },
                  { text: '.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'To avoid two solutions, ' },
                  { text: String(z), emphasis: true },
                  { text: ' must fill one of those two cells — so ' },
                  { text: String(z), emphasis: true },
                  { text: ' can be removed from any cell seeing both.' },
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
