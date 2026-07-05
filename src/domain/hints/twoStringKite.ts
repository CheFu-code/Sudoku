/**
 * 2-String Kite: a single digit with a strong link in one row and one column
 * that meet in the same box. Whichever way they resolve, the digit lands at one
 * of the two free ends, so the cell that sees both ends (their row/column
 * intersection) can't hold the digit.
 */

import { boxOf, colOf, indexOf, rowOf } from '../board';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectTwoStringKite(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (const digit of DIGITS) {
    const rowLinks: [CellIndex, CellIndex][] = [];
    const colLinks: [CellIndex, CellIndex][] = [];
    for (let n = 0; n < 9; n++) {
      const rc = getRowIndices(n).filter((i) => candidates.get(i)?.has(digit));
      if (rc.length === 2) rowLinks.push([rc[0], rc[1]]);
      const cc = getColIndices(n).filter((i) => candidates.get(i)?.has(digit));
      if (cc.length === 2) colLinks.push([cc[0], cc[1]]);
    }

    for (const rl of rowLinks) {
      for (const cl of colLinks) {
        // Pick one end of each link that share a box (the "connection").
        for (const ra of rl) {
          for (const cb of cl) {
            if (ra === cb || boxOf(ra) !== boxOf(cb)) continue;
            const rowEnd = rl[0] === ra ? rl[1] : rl[0];
            const colEnd = cl[0] === cb ? cl[1] : cl[0];
            // The cell seeing both free ends sits in the column-end's row and the
            // row-end's column (so it sees rowEnd down its column and colEnd
            // along its row), keeping it off both conjugate lines.
            const target = indexOf(rowOf(colEnd), colOf(rowEnd));
            if (target === rowEnd || target === colEnd || target === ra || target === cb) continue;
            if (!candidates.get(target)?.has(digit)) continue;

            const intro: Record<CellIndex, CellAnnotation> = {
              [ra]: { tint: 'focus', highlightNotes: [digit] },
              [cb]: { tint: 'focus', highlightNotes: [digit] },
              [rowEnd]: { tint: 'unit', highlightNotes: [digit] },
              [colEnd]: { tint: 'unit', highlightNotes: [digit] },
            };
            const reveal: Record<CellIndex, CellAnnotation> = {
              ...intro,
              [target]: { tint: 'target', strikeNotes: [digit] },
            };

            return {
              technique: 'two_string_kite',
              title: '2-String Kite',
              steps: [
                {
                  text: [
                    { text: 'The digit ' },
                    { text: String(digit), emphasis: true },
                    { text: ' has a strong link in a row and a column that meet in the same ' },
                    { text: 'box', emphasis: true },
                    { text: '.' },
                  ],
                  annotations: intro,
                },
                {
                  text: [
                    { text: String(digit), emphasis: true },
                    { text: ' must land at one of the two ' },
                    { text: 'free ends', emphasis: true },
                    { text: ', so the cell seeing both ends can not be ' },
                    { text: String(digit), emphasis: true },
                    { text: '.' },
                  ],
                  annotations: reveal,
                },
              ],
              action: { kind: 'eliminate', eliminations: [{ index: target, digit }] },
            };
          }
        }
      }
    }
  }
  return null;
}
