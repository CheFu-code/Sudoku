/**
 * Pointing Pair (or Triple): within a box, a digit's only candidates all lie on
 * a single row or column. That digit must end up in the box on that line, so it
 * can be removed from the rest of that row/column outside the box.
 */

import { boxOf, colOf, rowOf } from '../board';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { getBoxIndices, getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation } from './types';

export function detectPointingPair(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  for (let box = 0; box < 9; box++) {
    const boxCells = getBoxIndices(box);
    for (const digit of DIGITS) {
      if (boxCells.some((i) => board[i].value === digit)) continue;

      const candCells = boxCells.filter((i) => candidates.get(i)?.has(digit));
      if (candCells.length < 2) continue; // a single is a hidden single, handled earlier

      const rows = new Set(candCells.map(rowOf));
      const cols = new Set(candCells.map(colOf));

      let line: { kind: 'row' | 'col'; indices: CellIndex[] } | null = null;
      if (rows.size === 1) line = { kind: 'row', indices: getRowIndices([...rows][0]) };
      else if (cols.size === 1) line = { kind: 'col', indices: getColIndices([...cols][0]) };
      if (!line) continue;

      // Same digit elsewhere on the line but outside this box → can be removed.
      // Only count cells where the player has actually penciled the digit, so
      // applying the hint always removes a real note.
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const i of line.indices) {
        if (boxOf(i) === box) continue;
        if (candidates.get(i)?.has(digit)) {
          eliminations.push({ index: i, digit });
        }
      }
      if (eliminations.length === 0) continue;

      const lineLabel =
        line.kind === 'row' ? `row ${rowOf(candCells[0]) + 1}` : `column ${colOf(candCells[0]) + 1}`;
      const affected = eliminations.map((e) => e.index);

      const intro: Record<CellIndex, CellAnnotation> = {};
      for (const i of boxCells) intro[i] = { tint: 'unit' };
      for (const i of candCells) intro[i] = { tint: 'unit', highlightNotes: [digit] };

      const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
      for (const i of affected) reveal[i] = { tint: 'target', strikeNotes: [digit] };

      return {
        technique: 'pointing_pair',
        title: 'Pointing Pair',
        steps: [
          {
            text: [
              { text: 'In this ' },
              { text: 'box', emphasis: true },
              { text: ', the digit ' },
              { text: String(digit), emphasis: true },
              { text: ' can only go in the ' },
              { text: 'highlighted cells', emphasis: true },
              { text: `, which all sit on ${lineLabel}.` },
            ],
            annotations: intro,
          },
          {
            text: [
              { text: 'Wherever ' },
              { text: String(digit), emphasis: true },
              { text: ` ends up, it is somewhere on ${lineLabel} inside this box. So ` },
              { text: String(digit), emphasis: true },
              { text: ' can be removed from the rest of ' },
              { text: lineLabel, emphasis: true },
              { text: ' (the other highlighted cells).' },
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
