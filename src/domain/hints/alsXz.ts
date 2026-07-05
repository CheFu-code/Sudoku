/**
 * ALS-XZ: two Almost Locked Sets (N cells holding N+1 candidates) that share a
 * "restricted common" digit X — every X-cell of one set sees every X-cell of the
 * other, so only one set can use X. That links them on a second common digit Z:
 * Z can be removed from any cell that sees all Z-cells of both sets.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS, combinations } from './units';
import { formatDigits } from './text';
import type { Hint, CellAnnotation } from './types';

interface Als {
  cells: CellIndex[];
  digits: Set<Digit>;
}

export function detectAlsXz(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const alsList = enumerateAls(candidates);

  for (let i = 0; i < alsList.length; i++) {
    for (let j = i + 1; j < alsList.length; j++) {
      const A = alsList[i];
      const B = alsList[j];
      if (A.cells.some((c) => B.cells.includes(c))) continue; // must be disjoint

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
            if (!tc.has(z) || !board[t].notes.has(z)) continue;
            if (seers.every((s) => getPeers(t).has(s))) {
              eliminations.push({ index: t, digit: z });
            }
          }
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const c of A.cells) intro[c] = { tint: 'focus', highlightNotes: [...candidates.get(c)!].sort((a, b) => a - b) };
          for (const c of B.cells) intro[c] = { tint: 'unit', highlightNotes: [...candidates.get(c)!].sort((a, b) => a - b) };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const e of eliminations) reveal[e.index] = { tint: 'target', strikeNotes: [z] };

          return {
            technique: 'als_xz',
            title: 'ALS-XZ',
            steps: [
              {
                text: [
                  { text: 'Each highlighted group is an ' },
                  { text: 'Almost Locked Set', emphasis: true },
                  {
                    text: `: one more candidate digit than cells. The darker group shares ${formatDigits([...A.digits].sort((a, b) => a - b))}; the lighter one shares ${formatDigits([...B.digits].sort((a, b) => a - b))}. Knock any one digit out of a group and the remaining digits lock into its cells.`,
                  },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'Both groups want ' },
                  { text: String(x), emphasis: true },
                  {
                    text: ` — but every ${x} in one group sees every ${x} in the other, so `,
                  },
                  { text: 'only one group can use it', emphasis: true },
                  { text: `. The other group loses ${x} and locks immediately.` },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'Whichever group locks must keep its ' },
                  { text: String(z), emphasis: true },
                  {
                    text: `. So ${z} is certainly placed in one group or the other — and the struck cells, which see every ${z} of both groups, can never hold it.`,
                  },
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

/** Every X-cell of A sees every X-cell of B (so X is in at most one set). */
function isRestrictedCommon(
  A: Als,
  B: Als,
  x: Digit,
  candidates: Map<CellIndex, Set<Digit>>,
): boolean {
  const aX = A.cells.filter((c) => candidates.get(c)!.has(x));
  const bX = B.cells.filter((c) => candidates.get(c)!.has(x));
  if (aX.length === 0 || bX.length === 0) return false;
  return aX.every((a) => bX.every((b) => a !== b && getPeers(a).has(b)));
}

/** ALSes of size 1-3 within a single unit (N cells, N+1 candidate digits). */
function enumerateAls(candidates: Map<CellIndex, Set<Digit>>): Als[] {
  const out: Als[] = [];
  const seen = new Set<string>();
  for (const unit of ALL_UNITS) {
    const cells = unit.indices.filter((i) => candidates.has(i));
    for (let size = 1; size <= 3; size++) {
      for (const combo of combinations(cells, size)) {
        const digits = new Set<Digit>();
        for (const c of combo) for (const d of candidates.get(c)!) digits.add(d);
        if (digits.size !== size + 1) continue;
        const key = [...combo].sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ cells: combo, digits });
      }
    }
  }
  return out;
}
