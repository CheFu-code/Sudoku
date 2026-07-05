/**
 * Naked Subset (pair / triple / quad): N cells in a unit whose candidates,
 * combined, are exactly N digits. Those N digits are "claimed" by the N cells,
 * so they can be removed from every other cell in that unit.
 *
 * Size 2 is the Naked Pair, 3 the Naked Triple, 4 the Naked Quad.
 */

import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS, combinations, unitLabel } from './units';
import type { Hint, CellAnnotation, TechniqueId } from './types';
import { formatDigits } from './text';

type SubsetSize = 2 | 3 | 4;

const META: Record<SubsetSize, { id: TechniqueId; title: string }> = {
  2: { id: 'naked_pair', title: 'Naked Pair' },
  3: { id: 'naked_triple', title: 'Naked Triple' },
  4: { id: 'naked_quad', title: 'Naked Quad' },
};

export function detectNakedSubset(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  size: SubsetSize,
): Hint | null {
  for (const unit of ALL_UNITS) {
    // Candidate cells small enough to take part in a subset of this size.
    const cells = unit.indices.filter((i) => {
      const n = candidates.get(i)?.size ?? 0;
      return n >= 2 && n <= size;
    });
    if (cells.length < size) continue;

    for (const combo of combinations(cells, size)) {
      const union = new Set<Digit>();
      for (const i of combo) for (const d of candidates.get(i)!) union.add(d);
      if (union.size !== size) continue;

      const digits = [...union].sort((a, b) => a - b) as Digit[];

      // Other cells in the unit that still pencil one of those digits.
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const i of unit.indices) {
        if (combo.includes(i)) continue;
        for (const d of digits) {
          if (candidates.get(i)?.has(d)) {
            eliminations.push({ index: i, digit: d });
          }
        }
      }
      if (eliminations.length === 0) continue;

      const where = unitLabel(unit);
      const { id, title } = META[size];

      const intro: Record<CellIndex, CellAnnotation> = {};
      for (const i of unit.indices) intro[i] = { tint: 'unit' };
      for (const i of combo) {
        intro[i] = { tint: 'unit', highlightNotes: [...candidates.get(i)!].sort((a, b) => a - b) };
      }

      const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
      const struckByCell = new Map<CellIndex, Digit[]>();
      for (const e of eliminations) {
        (struckByCell.get(e.index) ?? struckByCell.set(e.index, []).get(e.index)!).push(e.digit);
      }
      for (const [i, ds] of struckByCell) reveal[i] = { tint: 'target', strikeNotes: ds };

      return {
        technique: id,
        title,
        steps: [
          {
            text: [
              { text: `The ${size} ` },
              { text: 'highlighted cells', emphasis: true },
              { text: ` in this ${where} can only contain ` },
              { text: formatDigits(digits), emphasis: true },
              { text: '. Between them they use up all of those digits.' },
            ],
            annotations: intro,
          },
          {
            text: [
              { text: 'So ' },
              { text: formatDigits(digits), emphasis: true },
              { text: ' can be removed from the other ' },
              { text: 'highlighted cells', emphasis: true },
              { text: ` in this ${where}.` },
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
