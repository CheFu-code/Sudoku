/**
 * Finned (and sashimi) fish — X-Wing/Swordfish/Jellyfish whose base lines leak
 * into one extra box (the fin). A plain fish confines a digit's base-line
 * candidates entirely to the cover lines; a finned fish tolerates extra base
 * cells ("fins") as long as they all sit in one box. The normal fish
 * eliminations then survive only where a cell also sees every fin: if no fin
 * holds the digit the plain fish applies, and if one does, its box peers lose
 * the digit anyway.
 *
 * Size 2 is the X-Wing, 3 the Swordfish, 4 the Jellyfish. Plain (finless) fish
 * are handled by `fish.ts`; this detector requires at least one fin.
 */

import { boxOf, colOf, rowOf } from '../board';
import { getPeers } from '../rules';
import { DIGITS } from '../types';
import type { Board, CellIndex, Digit } from '../types';
import { combinations, getColIndices, getRowIndices } from './units';
import type { Hint, CellAnnotation, TechniqueId } from './types';

type FishSize = 2 | 3 | 4;

const META: Record<FishSize, { id: TechniqueId; title: string }> = {
  2: { id: 'finned_x_wing', title: 'Finned X-Wing' },
  3: { id: 'finned_swordfish', title: 'Finned Swordfish' },
  4: { id: 'finned_jellyfish', title: 'Finned Jellyfish' },
};

interface Orientation {
  base: 'row' | 'column';
  cover: 'row' | 'column';
  lineCells: (n: number) => CellIndex[];
  coverCells: (n: number) => CellIndex[];
  coverIndexOf: (cell: CellIndex) => number;
  baseIndexOf: (cell: CellIndex) => number;
}

const ORIENTATIONS: Orientation[] = [
  {
    base: 'row',
    cover: 'column',
    lineCells: getRowIndices,
    coverCells: getColIndices,
    coverIndexOf: colOf,
    baseIndexOf: rowOf,
  },
  {
    base: 'column',
    cover: 'row',
    lineCells: getColIndices,
    coverCells: getRowIndices,
    coverIndexOf: rowOf,
    baseIndexOf: colOf,
  },
];

const plural = (kind: 'row' | 'column') => (kind === 'row' ? 'rows' : 'columns');

/** Format 1-based line numbers as "2, 5 and 8". */
function listNumbers(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b).map(String);
  if (s.length <= 1) return s.join('');
  return `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}`;
}

export function detectFinnedFish(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  size: FishSize,
): Hint | null {
  for (const digit of DIGITS) {
    for (const orient of ORIENTATIONS) {
      const lineCands: CellIndex[][] = [];
      for (let n = 0; n < 9; n++) {
        lineCands[n] = orient.lineCells(n).filter((i) => candidates.get(i)?.has(digit));
      }
      const baseLines: number[] = [];
      for (let n = 0; n < 9; n++) if (lineCands[n].length >= 2) baseLines.push(n);
      if (baseLines.length < size) continue;

      for (const baseCombo of combinations(baseLines, size)) {
        const allCells = baseCombo.flatMap((n) => lineCands[n]);
        const coverIdxs = [...new Set(allCells.map(orient.coverIndexOf))];
        // Need more cover lines than the fish size — the surplus becomes fins.
        if (coverIdxs.length <= size) continue;
        const baseSet = new Set(baseCombo);

        for (const coverCombo of combinations(coverIdxs, size)) {
          const coverSet = new Set(coverCombo);
          const fins = allCells.filter((c) => !coverSet.has(orient.coverIndexOf(c)));
          if (fins.length === 0) continue; // no fin → plain fish, handled elsewhere

          // All fins must lie in one box, else no cell can see every fin.
          const finBox = boxOf(fins[0]);
          if (!fins.every((c) => boxOf(c) === finBox)) continue;

          // Every base line and every cover line needs a real (non-fin) body cell.
          const bodyOk = baseCombo.every((n) =>
            lineCands[n].some((c) => coverSet.has(orient.coverIndexOf(c))),
          );
          if (!bodyOk) continue;

          const finSet = new Set(fins);
          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const cv of coverSet) {
            for (const cell of orient.coverCells(cv)) {
              if (baseSet.has(orient.baseIndexOf(cell))) continue;
              if (finSet.has(cell)) continue;
              if (!candidates.get(cell)?.has(digit)) continue;
              if (fins.every((f) => getPeers(cell).has(f))) {
                eliminations.push({ index: cell, digit });
              }
            }
          }
          if (eliminations.length === 0) continue;

          const { id, title } = META[size];
          const bodyCells = allCells.filter((c) => coverSet.has(orient.coverIndexOf(c)));
          const baseList = listNumbers(baseCombo.map((n) => n + 1));
          const coverList = listNumbers([...coverSet].map((n) => n + 1));
          const sashimi = baseCombo.some(
            (n) => lineCands[n].filter((c) => coverSet.has(orient.coverIndexOf(c))).length < 2,
          );

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const n of baseCombo) for (const cell of orient.lineCells(n)) intro[cell] = { tint: 'unit' };
          for (const cv of coverSet) for (const cell of orient.coverCells(cv)) intro[cell] ??= { tint: 'unit' };
          for (const cell of bodyCells) intro[cell] = { tint: 'unit', highlightNotes: [digit] };
          for (const cell of fins) intro[cell] = { tint: 'focus', highlightNotes: [digit] };

          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [digit] };

          return {
            technique: id,
            title,
            steps: [
              {
                text: [
                  { text: 'Focus on the digit ' },
                  { text: String(digit), emphasis: true },
                  { text: ` in ${plural(orient.base)} ` },
                  { text: baseList, emphasis: true },
                  { text: `. They almost form a${title === 'Finned X-Wing' ? 'n' : ''} ${title.replace('Finned ', '')} in ${plural(orient.cover)} ` },
                  { text: coverList, emphasis: true },
                  { text: '.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: `But one ${plural(orient.base).slice(0, -1)} spills over: the ` },
                  { text: fins.length === 1 ? 'highlighted fin cell' : 'highlighted fin cells', emphasis: true },
                  { text: ` sit outside the ${plural(orient.cover)}, all inside a single box${sashimi ? ' (a sashimi fish)' : ''}.` },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'If the fin holds ' },
                  { text: String(digit), emphasis: true },
                  { text: ' the deduction runs through the box; if it does not, the plain fish applies. Either way the ' },
                  { text: 'struck cells', emphasis: true },
                  { text: ` — which see every fin and lie on the covered ${plural(orient.cover)} — cannot hold ` },
                  { text: String(digit), emphasis: true },
                  { text: '.' },
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
