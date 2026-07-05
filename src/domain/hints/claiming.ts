/**
 * Box-Line Reduction (Claiming): within a row or column, a digit's only
 * candidates all fall inside a single box. That digit must therefore land in
 * the box on this line, so it can be removed from the rest of that box.
 *
 * This is the line→box mirror of the box→line Pointing Pair.
 */

import { boxOf } from '../board';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { getBoxIndices, getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectClaiming(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const lines: { kind: 'row' | 'col'; n: number; indices: CellIndex[] }[] = [];
  for (let n = 0; n < 9; n++) lines.push({ kind: 'row', n, indices: getRowIndices(n) });
  for (let n = 0; n < 9; n++) lines.push({ kind: 'col', n, indices: getColIndices(n) });

  for (const line of lines) {
    for (const digit of DIGITS) {
      if (line.indices.some((i) => board[i].value === digit)) continue;

      const candCells = line.indices.filter((i) => candidates.get(i)?.has(digit));
      if (candCells.length < 2) continue; // a single is a hidden single, handled earlier

      const boxes = new Set(candCells.map(boxOf));
      if (boxes.size !== 1) continue;
      const box = [...boxes][0];

      // Same digit elsewhere in the box but off this line → removable (real notes only).
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const i of getBoxIndices(box)) {
        if (line.indices.includes(i)) continue;
        if (candidates.get(i)?.has(digit)) {
          eliminations.push({ index: i, digit });
        }
      }
      if (eliminations.length === 0) continue;

      const lineLabel = line.kind === 'row' ? `row ${line.n + 1}` : `column ${line.n + 1}`;

      const intro: Record<CellIndex, CellAnnotation> = {};
      for (const i of line.indices) intro[i] = { tint: 'unit' };
      for (const i of candCells) intro[i] = { tint: 'unit', highlightNotes: [digit] };

      const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
      for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [digit] };

      return {
        technique: 'claiming',
        title: 'Box-Line Reduction',
        steps: [
          {
            text: [
              { text: `In ${lineLabel}, the digit ` },
              { text: String(digit), emphasis: true },
              { text: ' can only go in the ' },
              { text: 'highlighted cells', emphasis: true },
              { text: ', which all sit inside one ' },
              { text: 'box', emphasis: true },
              { text: '.' },
            ],
            annotations: intro,
          },
          {
            text: [
              { text: 'Wherever ' },
              { text: String(digit), emphasis: true },
              { text: ` lands on ${lineLabel}, it is inside that box. So ` },
              { text: String(digit), emphasis: true },
              { text: ' can be removed from the rest of the ' },
              { text: 'box', emphasis: true },
              { text: '.' },
            ],
            annotations: reveal,
          },
        ],
        action: { kind: 'eliminate', eliminations },
      };
    }
  }
  return null;
}
