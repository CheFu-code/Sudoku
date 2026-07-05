/**
 * WXYZ-Wing: a bivalue pivot cell plus a 3-cell almost-locked set, four digits
 * total — a thin specialization of ALS-XZ surfaced earlier (expert tier) so
 * these patterns stop overrating as full ALS-XZ. The two sets share a restricted
 * common x (every x sees every x, so only one set uses it) and a second common z;
 * z can be removed from any cell that sees every z of both sets.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { enumerateAls, isRestrictedCommon, type Als } from './alsXz';
import { formatDigits } from './text';
import type { Hint, CellAnnotation } from './types';

export function detectWxyzWing(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const alsList = enumerateAls(candidates, 3);

  for (let i = 0; i < alsList.length; i++) {
    for (let j = i + 1; j < alsList.length; j++) {
      const A = alsList[i];
      const B = alsList[j];
      if (A.cells.some((c) => B.cells.includes(c))) continue;

      // One set is a bivalue cell, the other a 3-cell ALS; four digits in all.
      let pivot: Als;
      let pincer: Als;
      if (A.cells.length === 1 && A.digits.size === 2 && B.cells.length === 3) {
        pincer = A;
        pivot = B;
      } else if (B.cells.length === 1 && B.digits.size === 2 && A.cells.length === 3) {
        pincer = B;
        pivot = A;
      } else {
        continue;
      }

      const union = new Set([...pivot.digits, ...pincer.digits]);
      if (union.size !== 4) continue;

      const common = [...A.digits].filter((d) => B.digits.has(d));
      if (common.length < 2) continue;

      for (const x of common) {
        if (!isRestrictedCommon(A, B, x, candidates)) continue;

        for (const z of common) {
          if (z === x) continue;
          const aZ = A.cells.filter((c) => candidates.get(c)!.has(z));
          const bZ = B.cells.filter((c) => candidates.get(c)!.has(z));
          const seers = [...aZ, ...bZ];

          const eliminations: { index: CellIndex; digit: Digit }[] = [];
          for (const [t, tc] of candidates) {
            if (A.cells.includes(t) || B.cells.includes(t)) continue;
            if (!tc.has(z)) continue;
            if (seers.every((s) => getPeers(t).has(s))) {
              eliminations.push({ index: t, digit: z });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const c of pivot.cells) intro[c] = { tint: 'focus', highlightNotes: [...candidates.get(c)!].sort((a, b) => a - b) };
          for (const c of pincer.cells) intro[c] = { tint: 'unit', highlightNotes: [...candidates.get(c)!].sort((a, b) => a - b) };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

          const allDigits = formatDigits([...union].sort((a, b) => a - b));
          return {
            technique: 'wxyz_wing',
            title: 'WXYZ-Wing',
            steps: [
              {
                text: [
                  { text: 'The three focus cells and the bivalue pincer span the four digits ' },
                  { text: allDigits, emphasis: true },
                  { text: ' — an almost-locked set with a single spare cell.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'Both groups compete for ' },
                  { text: String(x), emphasis: true },
                  { text: `, but every ${x} in one sees every ${x} in the other, so only one can take it. The other then locks and must keep its ` },
                  { text: String(z), emphasis: true },
                  { text: '.' },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'So ' },
                  { text: String(z), emphasis: true },
                  { text: ' is placed in one group or the other — any cell seeing every ' },
                  { text: String(z), emphasis: true },
                  { text: ' of both can never hold it.' },
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
