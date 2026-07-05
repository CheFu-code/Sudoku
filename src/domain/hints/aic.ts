/**
 * Alternating Inference Chain (AIC). Nodes are candidates (cell, digit) linked
 * by strong links (in a bivalue cell, or a digit with two places in a unit) and
 * weak links (two candidates that can't both be true). A chain that starts and
 * ends on strong links proves "endpoint A is true OR endpoint B is true", so any
 * candidate that sees (is weakly linked to) both endpoints can be eliminated.
 *
 * This single engine subsumes X-Chains, XY-Chains and Nice Loops.
 */

import { getPeers } from '../rules';
import type { Board, CellIndex, Digit } from '../types';
import { ALL_UNITS } from './units';
import type { Hint, CellAnnotation, ChainLink } from './types';

const MAX_DEPTH = 9; // links

const key = (cell: CellIndex, digit: Digit) => cell * 10 + digit;
const cellOf = (k: number) => Math.floor(k / 10);
const digitOf = (k: number) => (k % 10) as Digit;

export function detectAic(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  const strong = new Map<number, number[]>();
  const weak = new Map<number, number[]>(); // includes strong links (a strong link can act as weak)
  const add = (m: Map<number, number[]>, a: number, b: number) => {
    (m.get(a) ?? m.set(a, []).get(a)!).push(b);
    (m.get(b) ?? m.set(b, []).get(b)!).push(a);
  };

  // Same-cell links.
  for (const [cell, ds] of candidates) {
    const arr = [...ds];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        add(weak, key(cell, arr[i]), key(cell, arr[j]));
        if (arr.length === 2) add(strong, key(cell, arr[i]), key(cell, arr[j]));
      }
    }
  }

  // Same-unit, same-digit links.
  for (const unit of ALL_UNITS) {
    for (let d = 1 as Digit; d <= 9; d = (d + 1) as Digit) {
      const cells = unit.indices.filter((i) => candidates.get(i)?.has(d));
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          add(weak, key(cells[i], d), key(cells[j], d));
        }
      }
      if (cells.length === 2) add(strong, key(cells[0], d), key(cells[1], d));
    }
  }

  const nodes = [...candidates.entries()].flatMap(([c, ds]) => [...ds].map((d) => key(c, d)));

  for (const start of nodes) {
    // BFS: state encodes whether the NEXT edge must be strong.
    // We assume `start` is false; first edge is strong → reaches a TRUE node.
    const visited = new Set<string>();
    // Predecessor links keyed by BFS state, so we can rebuild the chain path.
    const parent = new Map<string, string>();
    const queue: { node: number; nextStrong: boolean; depth: number }[] = [
      { node: start, nextStrong: true, depth: 0 },
    ];
    while (queue.length) {
      const { node, nextStrong, depth } = queue.shift()!;
      if (depth >= MAX_DEPTH) continue;
      const edges = (nextStrong ? strong : weak).get(node) ?? [];
      const from = `${node}:${nextStrong}`;
      for (const next of edges) {
        if (next === start) continue;
        const arrivedStrong = nextStrong; // edge type used to reach `next`
        const state = `${next}:${!nextStrong}`;
        if (visited.has(state)) continue;
        visited.add(state);
        parent.set(state, from);

        // A node arrived-at via a strong edge is TRUE → a valid endpoint.
        if (arrivedStrong && depth + 1 >= 3) {
          const path = rebuildPath(parent, start, state);
          const hint = tryEliminate(board, candidates, path);
          if (hint) return hint;
        }
        queue.push({ node: next, nextStrong: !nextStrong, depth: depth + 1 });
      }
    }
  }
  return null;
}

/** Walk the BFS predecessor map back to the start, returning the ordered list
 *  of node keys from `start` to the endpoint. */
function rebuildPath(parent: Map<string, string>, start: number, endState: string): number[] {
  const keys: number[] = [];
  let cur: string | undefined = endState;
  const startState = `${start}:true`;
  while (cur) {
    keys.push(Number(cur.slice(0, cur.indexOf(':'))));
    if (cur === startState) break;
    cur = parent.get(cur);
  }
  return keys.reverse();
}

/** Candidates weakly linked to both endpoints can be removed. */
function tryEliminate(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  path: number[],
): Hint | null {
  const a = path[0];
  const b = path[path.length - 1];
  if (a === b) return null;
  const ca = cellOf(a);
  const da = digitOf(a);
  const cb = cellOf(b);
  const db = digitOf(b);

  const weakTo = (cell: CellIndex, digit: Digit, endCell: CellIndex, endDigit: Digit) =>
    (cell === endCell && digit !== endDigit) ||
    (digit === endDigit && cell !== endCell && getPeers(cell).has(endCell));

  const eliminations: { index: CellIndex; digit: Digit }[] = [];
  for (const [cell, ds] of candidates) {
    for (const digit of ds) {
      if ((cell === ca && digit === da) || (cell === cb && digit === db)) continue;
      if (!board[cell].notes.has(digit)) continue;
      if (weakTo(cell, digit, ca, da) && weakTo(cell, digit, cb, db)) {
        eliminations.push({ index: cell, digit });
      }
    }
  }
  if (eliminations.length === 0) return null;

  const sameDigit = da === db;
  const title = sameDigit ? 'X-Chain' : 'XY-Chain';

  // Highlight every candidate along the chain — endpoints in focus, the rest as
  // the scanned unit — and merge digits when the path revisits a cell (XY-chains
  // pass through a bivalue cell on both of its candidates).
  const intro: Record<CellIndex, CellAnnotation> = {};
  path.forEach((node, i) => {
    const cell = cellOf(node);
    const digit = digitOf(node);
    const endpoint = i === 0 || i === path.length - 1;
    const existing = intro[cell];
    const notes = new Set(existing?.highlightNotes ?? []);
    notes.add(digit);
    intro[cell] = {
      tint: endpoint || existing?.tint === 'focus' ? 'focus' : 'unit',
      highlightNotes: [...notes],
    };
  });

  // The first link out of `start` is strong; links then alternate.
  const links: ChainLink[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    links.push({
      from: { index: cellOf(path[i]), digit: digitOf(path[i]) },
      to: { index: cellOf(path[i + 1]), digit: digitOf(path[i + 1]) },
      strong: i % 2 === 0,
    });
  }

  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  const struck = new Map<CellIndex, Digit[]>();
  for (const e of eliminations) {
    (struck.get(e.index) ?? struck.set(e.index, []).get(e.index)!).push(e.digit);
  }
  for (const [i, dd] of struck) reveal[i] = { ...reveal[i], tint: 'target', strikeNotes: dd };

  return {
    technique: 'aic',
    title,
    steps: [
      {
        text: [
          { text: 'This chain connects candidates with two kinds of arrows. A ' },
          { text: 'solid arrow', emphasis: true },
          {
            text:
              ' is a strong link: its two candidates are the only two options left in their cell or unit, so if one is false the other must be true. A ',
          },
          { text: 'dashed arrow', emphasis: true },
          { text: " is a weak link: its two candidates can't both be true." },
        ],
        annotations: intro,
        links,
      },
      {
        text: [
          { text: 'Suppose the first end is ' },
          { text: 'not', emphasis: true },
          {
            text: ` ${da}. Follow the arrows: each solid link switches the next candidate on, each dashed link switches the one after off — and the chain finishes by switching the far end on. The same works from the other direction, so `,
          },
          { text: 'at least one end of the chain is always true', emphasis: true },
          { text: '.' },
        ],
        annotations: intro,
        links,
      },
      {
        text: [
          { text: 'The cells with struck candidates see ' },
          { text: 'both ends', emphasis: true },
          {
            text:
              ' of the chain. Whichever end turns out to be true, those cells conflict with it — so the struck candidates can be removed.',
          },
        ],
        annotations: reveal,
        links,
      },
    ],
    action: { kind: 'eliminate', eliminations },
  };
}
