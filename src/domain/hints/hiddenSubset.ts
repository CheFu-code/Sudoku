/**
 * Hidden Subset (pair / triple / quad): N digits in a unit whose only possible
 * cells are the same N cells. Those cells must therefore hold exactly those N
 * digits, so every other candidate can be removed from them.
 *
 * Size 2 is the Hidden Pair, 3 the Hidden Triple, 4 the Hidden Quad.
 */

import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS, combinations, unitLabel } from './units';
import type { Hint, CellAnnotation, TechniqueId } from './types';
import { formatDigits } from './text';

type SubsetSize = 2 | 3 | 4;

const META: Record<SubsetSize, { id: TechniqueId; title: string }> = {
  2: { id: 'hidden_pair', title: 'Hidden Pair' },
  3: { id: 'hidden_triple', title: 'Hidden Triple' },
  4: { id: 'hidden_quad', title: 'Hidden Quad' },
};

export function detectHiddenSubset(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  size: SubsetSize,
): Hint | null {
  for (const unit of ALL_UNITS) {
    // Digits that still have at least one candidate cell in this unit.
    const present: Digit[] = [];
    for (let d = 1 as Digit; d <= 9; d = (d + 1) as Digit) {
      if (unit.indices.some((i) => candidates.get(i)?.has(d))) present.push(d);
    }
    if (present.length <= size) continue; // need extra digits to eliminate

    for (const combo of combinations(present, size)) {
      const comboSet = new Set(combo);
      // Cells in the unit that can hold any of the combo digits.
      const cells = unit.indices.filter((i) => {
        const cands = candidates.get(i);
        return cands && combo.some((d) => cands.has(d));
      });
      if (cells.length !== size) continue;

      // Each combo digit must actually appear (no degenerate combo).
      const allPresent = combo.every((d) => cells.some((i) => candidates.get(i)!.has(d)));
      if (!allPresent) continue;

      const digits = [...combo].sort((a, b) => a - b) as Digit[];

      // Extra candidates (outside the combo) penciled in those cells → removable.
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const i of cells) {
        for (const d of candidates.get(i)!) {
          if (!comboSet.has(d)) {
            eliminations.push({ index: i, digit: d });
          }
        }
      }
      if (eliminations.length === 0) continue;

      const where = unitLabel(unit);
      const { id, title } = META[size];

      const struckByCell = new Map<CellIndex, Digit[]>();
      for (const e of eliminations) {
        (struckByCell.get(e.index) ?? struckByCell.set(e.index, []).get(e.index)!).push(e.digit);
      }

      const intro: Record<CellIndex, CellAnnotation> = {};
      for (const i of unit.indices) intro[i] = { tint: 'unit' };
      for (const i of cells) {
        const kept = digits.filter((d) => candidates.get(i)!.has(d));
        intro[i] = { tint: 'unit', highlightNotes: kept };
      }

      const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
      for (const i of cells) {
        const kept = digits.filter((d) => candidates.get(i)!.has(d));
        reveal[i] = { tint: 'target', highlightNotes: kept, strikeNotes: struckByCell.get(i) ?? [] };
      }

      return {
        technique: id,
        title,
        steps: [
          {
            text: [
              { text: 'In this ' },
              { text: where, emphasis: true },
              { text: ', the digits ' },
              { text: formatDigits(digits), emphasis: true },
              { text: ` can only appear in these ${size} ` },
              { text: 'highlighted cells', emphasis: true },
              { text: '.' },
            ],
            annotations: intro,
          },
          {
            text: [
              { text: 'Those cells must hold ' },
              { text: formatDigits(digits), emphasis: true },
              { text: ', so every other note in them can be removed.' },
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
