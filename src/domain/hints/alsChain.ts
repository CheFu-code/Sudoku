/**
 * ALS chains: ALS-XY-Wing (three almost-locked sets bridged by two restricted
 * common digits) and the general bounded ALS chain (length ≤ 5). Reuses the
 * ALS enumeration and restricted-common test from `alsXz.ts`.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { enumerateAls, isRestrictedCommon, type Als } from './alsXz';
import { formatDigits } from './text';
import type { Hint, CellAnnotation } from './types';

/** Upper bound on the ALS list — keeps the pairwise/DFS work tractable on the
 *  hard tiers where enumeration is large. We keep the smallest sets. */
const MAX_ALS = 400;
/** Node-expansion budget for the chain DFS; returns null once exhausted. */
const DFS_BUDGET = 50_000;

/** True if two ALSes share no cell. */
function disjoint(a: Als, b: Als): boolean {
  return !a.cells.some((c) => b.cells.includes(c));
}

/** Sorted intersection of two digit sets. */
function commonDigits(a: Set<Digit>, b: Set<Digit>): Digit[] {
  return [...a].filter((d) => b.has(d)).sort((p, q) => p - q);
}

/**
 * Enumerate ALSes (sizes 1..4), keep the `MAX_ALS` smallest, then order them by
 * first cell (deterministic scan order). Both detectors read from this list.
 */
function collectAls(candidates: Map<CellIndex, Set<Digit>>): Als[] {
  const all = enumerateAls(candidates, 4);
  all.sort((a, b) => a.cells.length - b.cells.length || a.cells[0] - b.cells[0]);
  const capped = all.slice(0, MAX_ALS);
  capped.sort((a, b) => a.cells[0] - b.cells[0] || a.cells.length - b.cells.length);
  return capped;
}

interface Edge {
  to: number;
  digit: Digit;
}

/**
 * Adjacency between ALSes keyed by restricted-common digit. Precomputed once so
 * the wing pair-scan and the chain DFS both avoid recomputing the RC test.
 * Edges are symmetric; each node's edge list is sorted (to, digit) for a
 * deterministic scan.
 */
function buildEdges(alsList: Als[], candidates: Map<CellIndex, Set<Digit>>): Edge[][] {
  const adj: Edge[][] = alsList.map(() => []);
  for (let i = 0; i < alsList.length; i++) {
    for (let j = i + 1; j < alsList.length; j++) {
      const A = alsList[i];
      const B = alsList[j];
      if (!disjoint(A, B)) continue;
      for (const x of commonDigits(A.digits, B.digits)) {
        if (!isRestrictedCommon(A, B, x, candidates)) continue;
        adj[i].push({ to: j, digit: x });
        adj[j].push({ to: i, digit: x });
      }
    }
  }
  for (const list of adj) list.sort((a, b) => a.to - b.to || a.digit - b.digit);
  return adj;
}

/** z-candidate cells of an ALS. */
function digitCells(als: Als, z: Digit, candidates: Map<CellIndex, Set<Digit>>): CellIndex[] {
  return als.cells.filter((c) => candidates.get(c)!.has(z));
}

/**
 * Cells outside `patternCells` that hold `z` and see every cell in `seers` —
 * these lose `z`.
 */
function findEliminations(
  z: Digit,
  seers: CellIndex[],
  patternCells: Set<CellIndex>,
  candidates: Map<CellIndex, Set<Digit>>,
): { index: CellIndex; digit: Digit }[] {
  const out: { index: CellIndex; digit: Digit }[] = [];
  for (const [t, tc] of candidates) {
    if (patternCells.has(t)) continue;
    if (!tc.has(z)) continue;
    if (seers.every((s) => getPeers(t).has(s))) out.push({ index: t, digit: z });
  }
  return out;
}

function candNotes(c: CellIndex, candidates: Map<CellIndex, Set<Digit>>): Digit[] {
  return [...candidates.get(c)!].sort((a, b) => a - b);
}

/**
 * ALS-XY-Wing: three disjoint ALSes A —x— B —y— C, where B (the hinge) holds
 * both restricted-common digits x ≠ y. Any digit z common to the wings A and C
 * (z ∉ {x, y}) must land in one of them, so a cell outside the pattern that sees
 * every z-candidate of both wings can never hold z.
 */
export function detectAlsXyWing(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  void board;
  const alsList = collectAls(candidates);
  const adj = buildEdges(alsList, candidates);

  for (let h = 0; h < alsList.length; h++) {
    const edges = adj[h];
    const B = alsList[h];
    for (const e1 of edges) {
      for (const e2 of edges) {
        if (e1.to === e2.to) continue; // A and C must be distinct sets
        if (e1.digit === e2.digit) continue; // x ≠ y
        const A = alsList[e1.to];
        const C = alsList[e2.to];
        if (!disjoint(A, C)) continue; // A, B, C pairwise disjoint
        const x = e1.digit;
        const y = e2.digit;

        for (const z of commonDigits(A.digits, C.digits)) {
          if (z === x || z === y) continue;
          const aZ = digitCells(A, z, candidates);
          const cZ = digitCells(C, z, candidates);
          if (aZ.length === 0 || cZ.length === 0) continue;
          const seers = [...aZ, ...cZ];
          const pattern = new Set<CellIndex>([...A.cells, ...B.cells, ...C.cells]);
          const eliminations = findEliminations(z, seers, pattern, candidates);
          if (eliminations.length === 0) continue;

          const intro: Record<CellIndex, CellAnnotation> = {};
          for (const c of B.cells) intro[c] = { tint: 'focus', highlightNotes: candNotes(c, candidates) };
          for (const c of A.cells) intro[c] = { tint: 'unit', highlightNotes: candNotes(c, candidates) };
          for (const c of C.cells) intro[c] = { tint: 'unit', highlightNotes: candNotes(c, candidates) };
          const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
          for (const el of eliminations) reveal[el.index] = { tint: 'target', strikeNotes: [z] };

          return {
            technique: 'als_xy_wing',
            title: 'ALS-XY-Wing',
            steps: [
              {
                text: [
                  { text: 'Three ' },
                  { text: 'Almost Locked Sets', emphasis: true },
                  {
                    text: ` — each one candidate digit short of locking. The hinge shares ${formatDigits([...B.digits].sort((a, b) => a - b))}; its two wings share ${formatDigits([...A.digits].sort((a, b) => a - b))} and ${formatDigits([...C.digits].sort((a, b) => a - b))}.`,
                  },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'The hinge links to one wing on ' },
                  { text: String(x), emphasis: true },
                  { text: ' and to the other on ' },
                  { text: String(y), emphasis: true },
                  {
                    text: ` — each a restricted common, so the hinge can keep at most one. Whichever it drops forces that wing to lock.`,
                  },
                ],
                annotations: intro,
              },
              {
                text: [
                  { text: 'Either way one wing locks and keeps its ' },
                  { text: String(z), emphasis: true },
                  {
                    text: `, so ${z} is placed in one wing or the other. Any cell seeing every ${z} of both wings can never hold it.`,
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

/**
 * ALS Chain: a chain of 4–5 pairwise-disjoint ALSes linked consecutively by
 * restricted commons, where the digit entering an interior set differs from the
 * digit leaving it. A digit z shared by both end sets (and distinct from the
 * restricted common touching each end) must land in one end or the other, so a
 * cell seeing every z-candidate of both ends loses z.
 *
 * We only return chains of length ≥ 4: the length-3 case is exactly ALS-XY-Wing,
 * which runs earlier in the ladder, so restricting to ≥ 4 avoids duplicating it.
 */
export function detectAlsChain(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  void board;
  const alsList = collectAls(candidates);
  const adj = buildEdges(alsList, candidates);

  let budget = DFS_BUDGET;

  const tryEliminate = (nodes: number[], edgeDigits: Digit[]): Hint | null => {
    const A = alsList[nodes[0]];
    const C = alsList[nodes[nodes.length - 1]];
    const x1 = edgeDigits[0];
    const xk = edgeDigits[edgeDigits.length - 1];
    const patternCells = new Set<CellIndex>();
    for (const n of nodes) for (const c of alsList[n].cells) patternCells.add(c);

    for (const z of commonDigits(A.digits, C.digits)) {
      if (z === x1 || z === xk) continue;
      const aZ = digitCells(A, z, candidates);
      const cZ = digitCells(C, z, candidates);
      if (aZ.length === 0 || cZ.length === 0) continue;
      const eliminations = findEliminations(z, [...aZ, ...cZ], patternCells, candidates);
      if (eliminations.length === 0) continue;
      return buildChainHint(nodes.map((n) => alsList[n]), edgeDigits, z, eliminations, candidates);
    }
    return null;
  };

  const dfs = (nodes: number[], edgeDigits: Digit[]): Hint | null => {
    if (nodes.length >= 4) {
      const hit = tryEliminate(nodes, edgeDigits);
      if (hit) return hit;
    }
    if (nodes.length >= 5) return null; // depth cap
    const last = nodes[nodes.length - 1];
    const enterDigit = edgeDigits.length > 0 ? edgeDigits[edgeDigits.length - 1] : null;
    for (const edge of adj[last]) {
      if (budget-- <= 0) return null;
      if (nodes.includes(edge.to)) continue;
      if (edge.digit === enterDigit) continue; // entering digit ≠ leaving digit
      const next = alsList[edge.to];
      if (nodes.some((n) => !disjoint(alsList[n], next))) continue; // pairwise disjoint
      const hit = dfs([...nodes, edge.to], [...edgeDigits, edge.digit]);
      if (hit) return hit;
    }
    return null;
  };

  for (let start = 0; start < alsList.length; start++) {
    if (budget <= 0) break;
    const hit = dfs([start], []);
    if (hit) return hit;
  }
  return null;
}

function buildChainHint(
  sets: Als[],
  edgeDigits: Digit[],
  z: Digit,
  eliminations: { index: CellIndex; digit: Digit }[],
  candidates: Map<CellIndex, Set<Digit>>,
): Hint {
  const intro: Record<CellIndex, CellAnnotation> = {};
  sets.forEach((set, i) => {
    const tint = i % 2 === 0 ? 'focus' : 'unit';
    for (const c of set.cells) intro[c] = { tint, highlightNotes: candNotes(c, candidates) };
  });
  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  for (const el of eliminations) reveal[el.index] = { tint: 'target', strikeNotes: [z] };

  const hops = edgeDigits.map(String);
  const hopText =
    hops.length === 1
      ? `the restricted common ${hops[0]}`
      : `the restricted commons ${hops.slice(0, -1).join(', ')} and ${hops[hops.length - 1]}`;

  return {
    technique: 'als_chain',
    title: 'ALS Chain',
    steps: [
      {
        text: [
          { text: `A chain of ${sets.length} ` },
          { text: 'Almost Locked Sets', emphasis: true },
          {
            text: ', each one candidate short of locking. Knock a digit out of any set and its remaining digits lock into place.',
          },
        ],
        annotations: intro,
      },
      {
        text: [
          { text: 'The sets are linked through ' },
          { text: hopText, emphasis: true },
          {
            text: ' — at each link one set must give the digit up, and that choice ripples down the chain, forcing the sets to lock alternately.',
          },
        ],
        annotations: intro,
      },
      {
        text: [
          { text: 'Either way, one of the two end sets keeps its ' },
          { text: String(z), emphasis: true },
          {
            text: `, so ${z} is placed at one end or the other. Any cell seeing every ${z} of both ends can never hold it.`,
          },
        ],
        annotations: reveal,
      },
    ],
    action: { kind: 'eliminate', eliminations },
  };
}
