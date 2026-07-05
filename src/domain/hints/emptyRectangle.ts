/**
 * Empty Rectangle: inside a box, a digit's candidates all lie on one row and one
 * column of the box (an "L", meeting at a hinge). Combined with a conjugate pair
 * for the digit in a line crossing one arm, this forces an elimination at the
 * far end.
 */

import { boxOf, colOf, indexOf, rowOf } from '../board';
import type { Board, CellIndex, Digit } from '../types';
import { DIGITS } from '../types';
import { getBoxIndices, getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectEmptyRectangle(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (const digit of DIGITS) {
    for (let box = 0; box < 9; box++) {
      const boxCells = getBoxIndices(box).filter((i) => candidates.get(i)?.has(digit));
      if (boxCells.length < 2) continue;

      const baseRow = Math.floor(box / 3) * 3;
      const baseCol = (box % 3) * 3;

      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const hr = baseRow + dr;
          const hc = baseCol + dc;
          // All box candidates must sit on the hinge row or hinge column.
          if (!boxCells.every((i) => rowOf(i) === hr || colOf(i) === hc)) continue;
          const armRow = boxCells.filter((i) => rowOf(i) === hr && colOf(i) !== hc);
          const armCol = boxCells.filter((i) => colOf(i) === hc && rowOf(i) !== hr);
          if (armRow.length === 0 || armCol.length === 0) continue; // need a real L

          // Conjugate pair in a column crossing the hinge row → eliminate in hinge column.
          const r1 = tryConjugate(board, candidates, digit, box, hr, hc, 'col');
          if (r1) return r1;
          // Conjugate pair in a row crossing the hinge column → eliminate in hinge row.
          const r2 = tryConjugate(board, candidates, digit, box, hr, hc, 'row');
          if (r2) return r2;
        }
      }
    }
  }
  return null;
}

function tryConjugate(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  digit: Digit,
  box: number,
  hr: number,
  hc: number,
  kind: 'row' | 'col',
): Hint | null {
  // kind 'col': scan each column cc for a conjugate pair with one cell on the
  // hinge row; eliminate at (otherRow, hc). 'row' is the mirror.
  for (let n = 0; n < 9; n++) {
    const line = kind === 'col' ? getColIndices(n) : getRowIndices(n);
    const pos = line.filter((i) => candidates.get(i)?.has(digit));
    if (pos.length !== 2) continue;

    const onArm = kind === 'col' ? pos.find((i) => rowOf(i) === hr) : pos.find((i) => colOf(i) === hc);
    if (onArm === undefined) continue;
    const other = pos.find((i) => i !== onArm)!;
    if (boxOf(onArm) === box) continue; // the conjugate must reach outside the box

    const target =
      kind === 'col' ? indexOf(rowOf(other), hc) : indexOf(hr, colOf(other));
    if (boxOf(target) === box) continue;
    if (!candidates.get(target)?.has(digit)) continue;

    const boxCells = getBoxIndices(box).filter((i) => candidates.get(i)?.has(digit));
    const intro: Record<CellIndex, CellAnnotation> = {};
    for (const i of boxCells) intro[i] = { tint: 'unit', highlightNotes: [digit] };
    intro[onArm] = { tint: 'focus', highlightNotes: [digit] };
    intro[other] = { tint: 'focus', highlightNotes: [digit] };
    const reveal: Record<CellIndex, CellAnnotation> = {
      ...intro,
      [target]: { tint: 'target', strikeNotes: [digit] },
    };

    return {
      technique: 'empty_rectangle',
      title: 'Empty Rectangle',
      steps: [
        {
          text: [
            { text: 'In this box, ' },
            { text: String(digit), emphasis: true },
            { text: ' is confined to one row and one column (the ' },
            { text: 'highlighted L', emphasis: true },
            { text: '), and there is a strong link on ' },
            { text: String(digit), emphasis: true },
            { text: ' crossing one arm.' },
          ],
          annotations: intro,
        },
        {
          text: [
            { text: 'Following that link, ' },
            { text: String(digit), emphasis: true },
            { text: ' can be removed from the ' },
            { text: 'marked cell', emphasis: true },
            { text: '.' },
          ],
          annotations: reveal,
        },
      ],
      action: { kind: 'eliminate', eliminations: [{ index: target, digit }] },
    };
  }
  return null;
}
