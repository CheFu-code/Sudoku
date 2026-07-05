/**
 * Stage-"where" locator — pure TypeScript, no framework/storage imports.
 *
 * Derives which cells a hint's pattern lives in, without leaking the digits or
 * the reasoning. Used by the progressive-disclosure presentation: after the
 * player learns *which* technique applies, this tells them *where* to look.
 */

import { colOf, rowOf } from '../board';
import type { CellIndex } from '../types';
import type { Hint, TextSegment } from './types';

export interface HintLocus {
  cells: CellIndex[];
  text: TextSegment[];
}

/** Format one cell as "row 4, column 7" (1-based, matching the on-screen grid). */
function cellLabel(index: CellIndex): string {
  return `row ${rowOf(index) + 1}, column ${colOf(index) + 1}`;
}

/**
 * The cells the technique's pattern lives in:
 *  - placements → the cell(s) being filled;
 *  - eliminations → the intro step's cells with highlighted candidates (every
 *    elimination detector marks exactly its pattern cells that way), falling
 *    back to the elimination cells themselves.
 */
export function locateHint(hint: Hint): HintLocus {
  const cells = locusCells(hint);
  return { cells, text: locusText(cells) };
}

function locusCells(hint: Hint): CellIndex[] {
  if (hint.action.kind === 'place') {
    return (hint.action.placements ?? []).map((p) => p.index);
  }
  if (hint.action.kind === 'erase') {
    return hint.action.cells ?? [];
  }
  if (hint.action.kind === 'add_note') {
    return (hint.action.additions ?? []).map((a) => a.index);
  }
  const intro = hint.steps[0]?.annotations ?? {};
  const pattern = Object.entries(intro)
    .filter(([, a]) => (a.highlightNotes?.length ?? 0) > 0)
    .map(([i]) => Number(i) as CellIndex)
    .sort((a, b) => a - b);
  if (pattern.length > 0) return pattern;
  return (hint.action.eliminations ?? []).map((e) => e.index);
}

function locusText(cells: CellIndex[]): TextSegment[] {
  if (cells.length === 1) {
    return [
      { text: 'Look at the highlighted cell at ' },
      { text: cellLabel(cells[0]), emphasis: true },
      { text: '. That is where this technique applies.' },
    ];
  }
  if (cells.length <= 3) {
    const labels = cells.map(cellLabel);
    const list = `${labels.slice(0, -1).join('; ')} and ${labels[labels.length - 1]}`;
    return [
      { text: `The pattern uses these ${cells.length} cells: ` },
      { text: list, emphasis: true },
      { text: '.' },
    ];
  }
  const rows = [...new Set(cells.map((i) => rowOf(i) + 1))].sort((a, b) => a - b);
  const rowList =
    rows.length === 1
      ? `row ${rows[0]}`
      : `rows ${rows.slice(0, -1).join(', ')} and ${rows[rows.length - 1]}`;
  return [
    { text: `The pattern lives in the ${cells.length} ` },
    { text: 'highlighted cells', emphasis: true },
    { text: ` (${rowList}).` },
  ];
}
