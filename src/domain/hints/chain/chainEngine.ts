/**
 * Generalized alternating-inference chain engine. Nodes are either single
 * candidates (cell, digit) or *group* nodes — the two or three cells of one
 * digit inside a single box-line intersection, acting as one unit. Links
 * alternate strong / weak exactly like a plain AIC; group nodes let strong and
 * weak links pass through slices no single-cell chain could cross.
 *
 * `detectChain(..., {grouped:false})` reproduces the plain AIC (`aic.ts`
 * delegates here); `detectGroupedAic` runs with group nodes enabled and returns
 * only chains that actually use one, so plain AICs stay on the cheaper rung.
 */

import { BOX, SIDE, indexOf } from '../../board';
import { getPeers } from '../../rules';
import { DIGITS } from '../../types';
import type { Board, CellIndex, Digit } from '../../types';
import { ALL_UNITS } from '../units';
import type { Hint, CellAnnotation, ChainLink, TechniqueId } from '../types';

const MAX_DEPTH_PLAIN = 9; // links — matches the original aic.ts
const MAX_DEPTH_GROUPED = 12;

interface Candidate {
  cell: CellIndex;
  digit: Digit;
}

/**
 * A chain node. `single` nodes wrap one candidate; `group` nodes wrap the 2-3
 * candidate cells of one digit within a box-line intersection. `cells` lists
 * the member cells and `digit` is the shared digit (group nodes are always a
 * single digit; for singles it is the candidate's digit).
 */
interface ChainNode {
  id: number;
  kind: 'single' | 'group';
  digit: Digit;
  cells: CellIndex[];
  candidates: Candidate[];
}

/** Two candidates that cannot both be true: same cell (different digits) or the
 *  same digit in mutually-visible cells. */
function conflicts(a: Candidate, b: Candidate): boolean {
  if (a.cell === b.cell) return a.digit !== b.digit;
  return a.digit === b.digit && getPeers(a.cell).has(b.cell);
}

/** The 54 box-line intersections (each a row or column's three cells inside one
 *  box), used to enumerate group nodes. */
function buildIntersections(): CellIndex[][] {
  const out: CellIndex[][] = [];
  for (let r = 0; r < SIDE; r++) {
    for (let bc = 0; bc < BOX; bc++) {
      out.push([indexOf(r, bc * BOX), indexOf(r, bc * BOX + 1), indexOf(r, bc * BOX + 2)]);
    }
  }
  for (let c = 0; c < SIDE; c++) {
    for (let br = 0; br < BOX; br++) {
      out.push([indexOf(br * BOX, c), indexOf(br * BOX + 1, c), indexOf(br * BOX + 2, c)]);
    }
  }
  return out;
}

const INTERSECTIONS = buildIntersections();

interface NodeGraph {
  nodes: ChainNode[];
  strong: Map<number, number[]>;
  weak: Map<number, number[]>;
}

function buildGraph(candidates: Map<CellIndex, Set<Digit>>, grouped: boolean): NodeGraph {
  const nodes: ChainNode[] = [];
  // Single nodes first, in candidate-map order (cell asc, digit asc) so the
  // plain path reproduces aic.ts's deterministic scan.
  const singleByKey = new Map<number, number>(); // cell*10+digit -> node id
  for (const [cell, ds] of candidates) {
    for (const d of [...ds].sort((x, y) => x - y)) {
      const id = nodes.length;
      nodes.push({ id, kind: 'single', digit: d, cells: [cell], candidates: [{ cell, digit: d }] });
      singleByKey.set(cell * 10 + d, id);
    }
  }

  if (grouped) {
    for (const inter of INTERSECTIONS) {
      for (const d of DIGITS) {
        const members = inter.filter((c) => candidates.get(c)?.has(d));
        if (members.length >= 2) {
          nodes.push({
            id: nodes.length,
            kind: 'group',
            digit: d,
            cells: members,
            candidates: members.map((c) => ({ cell: c, digit: d })),
          });
        }
      }
    }
  }

  const strong = new Map<number, number[]>();
  const weak = new Map<number, number[]>();
  const link = (m: Map<number, number[]>, a: number, b: number) => {
    (m.get(a) ?? m.set(a, []).get(a)!).push(b);
    (m.get(b) ?? m.set(b, []).get(b)!).push(a);
  };
  const addStrong = (a: number, b: number) => {
    link(strong, a, b);
    link(weak, a, b); // strong implies weak
  };

  // --- Weak links --------------------------------------------------------
  // Same-cell (different digit) — singles only.
  for (const [cell, ds] of candidates) {
    const ids = [...ds].map((d) => singleByKey.get(cell * 10 + d)!);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) link(weak, ids[i], ids[j]);
    }
  }
  // Same-digit: any two nodes whose every member sees every member of the other.
  const byDigit = new Map<Digit, ChainNode[]>();
  for (const n of nodes) (byDigit.get(n.digit) ?? byDigit.set(n.digit, []).get(n.digit)!).push(n);
  for (const group of byDigit.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (allSee(group[i], group[j])) link(weak, group[i].id, group[j].id);
      }
    }
  }

  // --- Strong links ------------------------------------------------------
  // Bivalue cell: its two candidates.
  for (const [cell, ds] of candidates) {
    if (ds.size === 2) {
      const [d1, d2] = [...ds];
      addStrong(singleByKey.get(cell * 10 + d1)!, singleByKey.get(cell * 10 + d2)!);
    }
  }
  // A unit's candidate cells for digit d, split exactly between two nodes.
  for (const unit of ALL_UNITS) {
    for (const d of DIGITS) {
      const cells = unit.indices.filter((i) => candidates.get(i)?.has(d));
      if (cells.length < 2) continue;
      const cellSet = new Set(cells);
      // Nodes of digit d fully inside this unit's candidate cells.
      const inUnit = (byDigit.get(d) ?? []).filter((n) => n.cells.every((c) => cellSet.has(c)));
      for (let i = 0; i < inUnit.length; i++) {
        for (let j = i + 1; j < inUnit.length; j++) {
          const a = inUnit[i];
          const b = inUnit[j];
          if (a.cells.length + b.cells.length !== cells.length) continue;
          if (a.cells.some((c) => b.cells.includes(c))) continue; // must be disjoint
          addStrong(a.id, b.id);
        }
      }
    }
  }

  return { nodes, strong, weak };
}

/** Every member candidate of `a` sees every member candidate of `b` (implies the
 *  two node's cells are disjoint). */
function allSee(a: ChainNode, b: ChainNode): boolean {
  for (const ca of a.candidates) {
    for (const cb of b.candidates) {
      if (!conflicts(ca, cb)) return false;
    }
  }
  return true;
}

export interface ChainOptions {
  grouped: boolean;
}

export function detectChain(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
  { grouped }: ChainOptions,
): Hint | null {
  const { nodes, strong, weak } = buildGraph(candidates, grouped);
  const maxDepth = grouped ? MAX_DEPTH_GROUPED : MAX_DEPTH_PLAIN;

  for (const startNode of nodes) {
    const start = startNode.id;
    // BFS: `nextStrong` says whether the next edge must be strong. Assume `start`
    // is false; the first (strong) edge reaches a TRUE node; links alternate.
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: { node: number; nextStrong: boolean; depth: number }[] = [
      { node: start, nextStrong: true, depth: 0 },
    ];
    while (queue.length) {
      const { node, nextStrong, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;
      const edges = (nextStrong ? strong : weak).get(node) ?? [];
      const from = `${node}:${nextStrong}`;
      for (const next of edges) {
        if (next === start) continue;
        const arrivedStrong = nextStrong;
        const state = `${next}:${!nextStrong}`;
        if (visited.has(state)) continue;
        visited.add(state);
        parent.set(state, from);

        // Arrived via a strong edge → a TRUE node → a valid endpoint.
        if (arrivedStrong && depth + 1 >= 3) {
          const path = rebuildPath(parent, start, state);
          if (!grouped || path.some((id) => nodes[id].kind === 'group')) {
            const hint = tryEliminate(candidates, nodes, path, grouped);
            if (hint) return hint;
          }
        }
        queue.push({ node: next, nextStrong: !nextStrong, depth: depth + 1 });
      }
    }
  }
  return null;
}

export function detectGroupedAic(
  board: Board,
  candidates: Map<CellIndex, Set<Digit>>,
): Hint | null {
  return detectChain(board, candidates, { grouped: true });
}

/** Walk the BFS predecessor map back to `start`, returning ordered node ids. */
function rebuildPath(parent: Map<string, string>, start: number, endState: string): number[] {
  const ids: number[] = [];
  let cur: string | undefined = endState;
  const startState = `${start}:true`;
  while (cur) {
    ids.push(Number(cur.slice(0, cur.indexOf(':'))));
    if (cur === startState) break;
    cur = parent.get(cur);
  }
  return ids.reverse();
}

/** A candidate is weakly linked to `node` iff it is not one of the node's own
 *  members and it conflicts with every member candidate. */
function weakToNode(c: Candidate, node: ChainNode): boolean {
  for (const m of node.candidates) {
    if (m.cell === c.cell && m.digit === c.digit) return false;
    if (!conflicts(c, m)) return false;
  }
  return true;
}

/** Candidates weakly linked to BOTH endpoints of the chain can be removed. */
function tryEliminate(
  candidates: Map<CellIndex, Set<Digit>>,
  nodes: ChainNode[],
  path: number[],
  grouped: boolean,
): Hint | null {
  const a = nodes[path[0]];
  const b = nodes[path[path.length - 1]];
  if (a.id === b.id) return null;

  const eliminations: { index: CellIndex; digit: Digit }[] = [];
  for (const [cell, ds] of candidates) {
    for (const digit of ds) {
      const c = { cell, digit };
      if (weakToNode(c, a) && weakToNode(c, b)) eliminations.push({ index: cell, digit });
    }
  }
  if (eliminations.length === 0) return null;

  return buildHint(nodes, path, eliminations, grouped);
}

function buildHint(
  nodes: ChainNode[],
  path: number[],
  eliminations: { index: CellIndex; digit: Digit }[],
  grouped: boolean,
): Hint {
  const endpointA = nodes[path[0]];
  const endpointB = nodes[path[path.length - 1]];
  const sameDigit = endpointA.digit === endpointB.digit;

  const technique: TechniqueId = grouped ? 'grouped_aic' : 'aic';
  const title = grouped ? 'Grouped Chain' : sameDigit ? 'X-Chain' : 'XY-Chain';

  // Highlight every chain candidate — endpoints in focus, the rest as scanned
  // units — merging when the path revisits a cell.
  const intro: Record<CellIndex, CellAnnotation> = {};
  path.forEach((id, i) => {
    const node = nodes[id];
    const endpoint = i === 0 || i === path.length - 1;
    for (const { cell, digit } of node.candidates) {
      const existing = intro[cell];
      const notes = new Set(existing?.highlightNotes ?? []);
      notes.add(digit);
      intro[cell] = {
        tint: endpoint || existing?.tint === 'focus' ? 'focus' : 'unit',
        highlightNotes: [...notes],
      };
    }
  });

  // The first link out of `start` is strong; links then alternate.
  const links: ChainLink[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    links.push({ from: endpointRef(nodes[path[i]]), to: endpointRef(nodes[path[i + 1]]), strong: i % 2 === 0 });
  }

  const reveal: Record<CellIndex, CellAnnotation> = { ...intro };
  const struck = new Map<CellIndex, Digit[]>();
  for (const e of eliminations) {
    (struck.get(e.index) ?? struck.set(e.index, []).get(e.index)!).push(e.digit);
  }
  for (const [i, dd] of struck) reveal[i] = { ...reveal[i], tint: 'target', strikeNotes: dd };

  const da = endpointA.digit;
  const introText = grouped
    ? [
        { text: 'This chain links candidates with alternating arrows, and some links join a ' },
        { text: 'group', emphasis: true },
        {
          text:
            ' — the two or three cells of one digit inside a single box-line slice, which behave as one. A ',
        },
        { text: 'solid arrow', emphasis: true },
        { text: ' is a strong link (if one side is false the other is true); a ' },
        { text: 'dashed arrow', emphasis: true },
        { text: " is a weak link (both sides can't be true)." },
      ]
    : [
        { text: 'This chain connects candidates with two kinds of arrows. A ' },
        { text: 'solid arrow', emphasis: true },
        {
          text:
            ' is a strong link: its two candidates are the only two options left in their cell or unit, so if one is false the other must be true. A ',
        },
        { text: 'dashed arrow', emphasis: true },
        { text: " is a weak link: its two candidates can't both be true." },
      ];

  return {
    technique,
    title,
    steps: [
      { text: introText, annotations: intro, links },
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

/** A chain-link endpoint: a representative member cell plus, for group nodes, all
 *  member cells so the UI can bracket them. */
function endpointRef(node: ChainNode): ChainLink['from'] {
  const rep = Math.min(...node.cells);
  if (node.kind === 'group') return { index: rep, digit: node.digit, cells: [...node.cells] };
  return { index: rep, digit: node.digit };
}
