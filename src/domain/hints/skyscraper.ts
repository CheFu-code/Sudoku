/**
 * Skyscraper: a single digit with a strong link in two rows (each only two
 * candidate cells) that share one column (the "base"). The two other ends (the
 * "roof") sit in different columns; the digit can be removed from any cell that
 * sees both roof cells. Also checked with rows and columns swapped.
 */

import { colOf, rowOf } from '../board';
import { getPeers } from '../rules';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectSkyscraper(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (const digit of DIGITS) {
    for (const orient of ['row', 'col'] as const) {
      const lineCells = orient === 'row' ? getRowIndices : getColIndices;
      const baseIndexOf = orient === 'row' ? colOf : rowOf; // index of the shared "base"

      const links: { cells: [CellIndex, CellIndex] }[] = [];
      for (let n = 0; n < 9; n++) {
        const cells = lineCells(n).filter((i) => candidates.get(i)?.has(digit));
        if (cells.length === 2) links.push({ cells: [cells[0], cells[1]] });
      }

      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          const [a1, a2] = links[i].cells;
          const [b1, b2] = links[j].cells;
          // Find the shared base and the two roof cells.
          const roof = matchBase(a1, a2, b1, b2, baseIndexOf);
          if (!roof) continue;
          const [r1, r2, base1, base2] = roof;

          const peersR2 = getPeers(r2);
          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const cell of getPeers(r1)) {
            if (cell === r2 || !peersR2.has(cell)) continue;
            if (candidates.get(cell)?.has(digit)) {
              eliminations.push({ index: cell, digit });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {
            [base1]: { tint: 'focus', highlightNotes: [digit] },
            [base2]: { tint: 'focus', highlightNotes: [digit] },
            [r1]: { tint: 'unit', highlightNotes: [digit] },
            [r2]: { tint: 'unit', highlightNotes: [digit] },
          };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [digit] };

          return {
            technique: 'skyscraper',
            title: 'Skyscraper',
            steps: [
              {
                text: [
                  { text: 'The digit ' },
                  { text: String(digit), emphasis: true },
                  { text: ` has a strong link in two ${orient === 'row' ? 'rows' : 'columns'} that share one ${orient === 'row' ? 'column' : 'row'} (the base).` },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'One of the two ' },
                  { text: 'roof cells', emphasis: true },
                  { text: ' must be ' },
                  { text: String(digit), emphasis: true },
                  { text: ', so ' },
                  { text: String(digit), emphasis: true },
                  { text: ' can be removed from any cell seeing both roofs.' },
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

/**
 * If the two links share exactly one base index and the roofs sit in different
 * base indices, return [roof1, roof2, base1, base2]; otherwise null.
 */
function matchBase(
  a1: CellIndex,
  a2: CellIndex,
  b1: CellIndex,
  b2: CellIndex,
  baseIndexOf: (c: CellIndex) => number,
): [CellIndex, CellIndex, CellIndex, CellIndex] | null {
  const candidatesPairs: [CellIndex, CellIndex, CellIndex, CellIndex][] = [
    [a1, a2, b1, b2], // base = a1,b1 ; roofs a2,b2
    [a1, a2, b2, b1],
    [a2, a1, b1, b2],
    [a2, a1, b2, b1],
  ];
  for (const [roofA, baseA, roofB, baseB] of candidatesPairs) {
    if (baseIndexOf(baseA) !== baseIndexOf(baseB)) continue; // bases must align
    if (baseIndexOf(roofA) === baseIndexOf(roofB)) continue; // roofs must differ (else X-Wing)
    return [roofA, roofB, baseA, baseB];
  }
  return null;
}
