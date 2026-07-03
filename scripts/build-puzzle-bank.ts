/**
 * Offline puzzle-bank builder. Run at dev time, never in the app:
 *
 *   PER_TIER=500 PUZZLE_CSV=./sudoku-3m.csv npx tsx scripts/build-puzzle-bank.ts
 *
 * Difficulty is decided by *how hard the puzzle is to solve*, not clue count.
 * Two graders, chosen automatically:
 *
 *   • skfr (preferred) — the compiled SE rater at scripts/bin/skfr (or $SKFR).
 *     Rates candidates in fast batches and buckets by SE band (see SE_BANDS).
 *     `rating` is the authoritative SE ER. Fast enough to mine the hard tiers
 *     (diabolical is ~0.6% of the Kaggle set, so ~80k rows are scanned for 500).
 *   • Fallback (no skfr) — `gradePuzzle` (src/domain/grade.ts) drives the in-app
 *     technique ladder and buckets by hardest technique; `rating` is approximate.
 *     Run `scripts/apply-se-ratings.ts` afterwards to save real SE scores.
 *
 * Sources, in priority order (each fills only tiers that still need puzzles):
 *   1. Curated hard grids   assets/puzzles/_sources/hardest.txt (extreme/diabolical)
 *   2. Kaggle 3M CSV        PUZZLE_CSV=... (fills easy→expert fast)
 *   3. Generate-and-grade   self-contained backstop for any shortfall
 *
 * Output: assets/puzzles/<difficulty>.json — { id, difficulty, givens, solution,
 * rating, hardestTechnique }, ids `<tier>-<8-hex-hash-of-givens>` (stable across
 * rebuilds even when a puzzle re-grades into another tier).
 */

import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';

import { gradePuzzle } from '../src/domain/grade';
import { solveBoard } from '../src/domain/hints/bruteForce';
import { createBoard } from '../src/domain/board';
import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, Puzzle } from '../src/domain/types';

const PER_TIER = Number(process.env.PER_TIER ?? 30);
/** Max Kaggle rows to scan before giving up on filling a tier from the CSV. */
const SCAN_LIMIT = Number(process.env.SCAN_LIMIT ?? 400_000);
/** Max generate-and-grade attempts for the backstop pass. */
const GEN_LIMIT = Number(process.env.GEN_LIMIT ?? 60_000);
/** How many candidates to hand skfr per invocation. */
const BATCH = Number(process.env.BATCH ?? 5_000);

const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'puzzles');
const HARDEST_FILE = path.join(OUT_DIR, '_sources', 'hardest.txt');
const LOCAL_SKFR = path.resolve(__dirname, 'bin', 'skfr');
const SKFR = process.env.SKFR ?? (fs.existsSync(LOCAL_SKFR) ? LOCAL_SKFR : '');

/** SE ER upper bound (exclusive) per tier — see the validated distribution. */
const SE_BANDS: { tier: Difficulty; below: number }[] = [
  { tier: 'easy', below: 2.4 }, // singles (hidden 1.5, naked 2.3)
  { tier: 'medium', below: 3.5 }, // locked candidates, pairs
  { tier: 'hard', below: 4.6 }, // triples, X-Wing, XY-Wing
  { tier: 'expert', below: 6.7 }, // quads, big fish, URs, wings
  { tier: 'extreme', below: 8.4 }, // chains (AIC etc.)
  { tier: 'diabolical', below: Infinity }, // dynamic chains / beyond
];

function tierForSE(er: number): Difficulty {
  return (SE_BANDS.find((b) => er < b.below) ?? SE_BANDS[SE_BANDS.length - 1]).tier;
}

type Bank = Record<Difficulty, Puzzle[]>;

function emptyBank(): Bank {
  const bank = {} as Bank;
  for (const d of DIFFICULTIES) bank[d] = [];
  return bank;
}

function normalizeGivens(raw: string): string {
  return raw.trim().replace(/0/g, '.');
}

function idFor(tier: Difficulty, givens: string): string {
  const hash = crypto.createHash('sha1').update(givens).digest('hex').slice(0, 8);
  return `${tier}-${hash}`;
}

function solutionString(givens: string): string | null {
  const solved = solveBoard(createBoard(givens));
  return solved ? solved.join('') : null;
}

// --- Uniqueness solver (generation + curated verification) ----------------

function canPlace(g: number[], idx: number, v: number): boolean {
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v) return false;
    if (g[k * 9 + c] === v) return false;
    if (g[(br + Math.floor(k / 3)) * 9 + (bc + (k % 3))] === v) return false;
  }
  return true;
}

/** Count solutions up to `limit` (MRV backtracking). Returns 0, 1, or `limit`. */
function countSolutions(grid: number[], limit = 2): number {
  let count = 0;
  const solve = (g: number[]): void => {
    if (count >= limit) return;
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const cands: number[] = [];
      for (let v = 1; v <= 9; v++) if (canPlace(g, i, v)) cands.push(v);
      if (cands.length === 0) return;
      if (best === -1 || cands.length < bestCands.length) {
        best = i;
        bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return;
    }
    for (const v of bestCands) {
      g[best] = v;
      solve(g);
      g[best] = 0;
      if (count >= limit) return;
    }
  };
  solve(grid.slice());
  return count;
}

function isUnique(givens: string): boolean {
  const grid = [...normalizeGivens(givens)].map((ch) => (ch === '.' ? 0 : Number(ch)));
  return countSolutions(grid, 2) === 1;
}

// --- Generator ------------------------------------------------------------

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateSolution(): number[] {
  const g = new Array<number>(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(g, i, v)) {
        g[i] = v;
        if (fill(i + 1)) return true;
        g[i] = 0;
      }
    }
    return false;
  };
  fill(0);
  return g;
}

/** Dig holes from a solution, keeping a unique solution, toward a clue target. */
function makePuzzle(solution: number[], targetClues: number): number[] {
  const puzzle = solution.slice();
  let clues = 81;
  for (const idx of shuffled([...Array(81).keys()])) {
    if (clues <= targetClues) break;
    const backup = puzzle[idx];
    if (backup === 0) continue;
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues--;
    } else {
      puzzle[idx] = backup;
    }
  }
  return puzzle;
}

function gridToString(g: number[]): string {
  return g.map((n) => (n === 0 ? '.' : String(n))).join('');
}

// --- skfr batch rating ----------------------------------------------------

/** Rate a batch of givens with skfr; return a map from normalized givens → SE ER. */
function rateWithSkfr(givensList: string[]): Map<string, number> {
  const base = path.join(os.tmpdir(), 'build-skfr-rate');
  fs.writeFileSync(`${base}.txt`, givensList.map(normalizeGivens).join('\n') + '\n');
  execFileSync(SKFR, [`--input=${base}`], { encoding: 'utf8', maxBuffer: 1 << 28 });

  const map = new Map<string, number>();
  for (const line of fs.readFileSync(`${base}_rat.txt`, 'utf8').split('\n')) {
    // "<81-char puzzle> ED=<ER>/<EP>/<ED>" — ER is the SE rating.
    const [puzzle, tail] = line.split(' ED=');
    if (!puzzle || !tail) continue;
    const er = Number(tail.split('/')[0]);
    if (!Number.isNaN(er)) map.set(puzzle.trim(), er);
  }
  return map;
}

// --- Collection -----------------------------------------------------------

interface Candidate {
  givens: string;
  solution?: string;
}

class Collector {
  readonly bank = emptyBank();
  private readonly seen = new Set<string>();

  isFull(tier: Difficulty): boolean {
    return this.bank[tier].length >= PER_TIER;
  }

  allFull(): boolean {
    return DIFFICULTIES.every((d) => this.isFull(d));
  }

  private fresh(givens: string): string | null {
    const g = normalizeGivens(givens);
    if (g.length !== 81 || this.seen.has(g)) return null;
    return g;
  }

  /** File a puzzle under an already-decided tier (used by the skfr path). */
  place(givens: string, tier: Difficulty, rating: number, solution?: string): boolean {
    const g = this.fresh(givens);
    if (!g || this.isFull(tier)) return false;
    const sol = solution?.trim() || solutionString(g);
    if (!sol || sol.length !== 81) return false;
    this.seen.add(g);
    this.bank[tier].push({ id: idFor(tier, g), difficulty: tier, givens: g, solution: sol, rating });
    return true;
  }

  /** Grade with the in-app technique ladder and file under its tier (fallback). */
  gradeAndPlace(givens: string, solution?: string): boolean {
    const g = this.fresh(givens);
    if (!g) return false;
    const grade = gradePuzzle(g);
    if (!grade.solvable || this.isFull(grade.tier)) return false;
    const sol = solution?.trim() || solutionString(g);
    if (!sol || sol.length !== 81) return false;
    this.seen.add(g);
    this.bank[grade.tier].push({
      id: idFor(grade.tier, g),
      difficulty: grade.tier,
      givens: g,
      solution: sol,
      rating: grade.rating,
      hardestTechnique: grade.hardestTechnique,
    });
    return true;
  }
}

const useSkfr = SKFR !== '';

/** Route a batch of candidates into the collector via the active grader. */
function ingest(c: Collector, batch: Candidate[]): number {
  let added = 0;
  if (useSkfr) {
    const ers = rateWithSkfr(batch.map((b) => b.givens));
    for (const b of batch) {
      const er = ers.get(normalizeGivens(b.givens));
      if (er === undefined) continue;
      if (c.place(b.givens, tierForSE(er), er, b.solution)) added++;
    }
  } else {
    for (const b of batch) if (c.gradeAndPlace(b.givens, b.solution)) added++;
  }
  return added;
}

// --- Sources --------------------------------------------------------------

function collectCurated(c: Collector): void {
  if (!fs.existsSync(HARDEST_FILE)) {
    console.log('No curated list at assets/puzzles/_sources/hardest.txt — skipping.');
    return;
  }
  const batch: Candidate[] = [];
  let rejected = 0;
  for (const line of fs.readFileSync(HARDEST_FILE, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const [givens, solution] = s.split(/[,\s]+/);
    if (!givens || givens.length !== 81) continue;
    // Curated grids are hand-entered — verify a unique solution before trusting.
    if (!isUnique(givens)) {
      rejected++;
      console.warn(`  curated puzzle skipped (not uniquely solvable): ${givens.slice(0, 24)}…`);
      continue;
    }
    batch.push({ givens, solution });
  }
  const added = ingest(c, batch);
  console.log(`Curated: added ${added} puzzle(s)${rejected ? `, rejected ${rejected}` : ''}.`);
}

async function collectFromCsv(c: Collector, csvPath: string): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  let pi = -1;
  let si = -1;
  let scanned = 0;
  let added = 0;
  let batch: Candidate[] = [];

  const flush = (): void => {
    if (batch.length) added += ingest(c, batch);
    batch = [];
    process.stdout.write(`\r  CSV: scanned ${scanned}, added ${added}   `);
  };

  for await (const line of rl) {
    if (!header) {
      header = line.split(',').map((s) => s.trim());
      pi = header.indexOf('puzzle');
      si = header.indexOf('solution');
      continue;
    }
    if (c.allFull() || scanned >= SCAN_LIMIT) break;
    scanned++;
    const cols = line.split(',');
    const puzzle = cols[pi]?.trim();
    if (!puzzle) continue;
    batch.push({ givens: puzzle, solution: si >= 0 ? cols[si] : undefined });
    if (batch.length >= BATCH) {
      flush();
      if (c.allFull()) break;
    }
  }
  flush();
  rl.close();
  process.stdout.write('\n');
  console.log(`CSV: scanned ${scanned} row(s), added ${added} puzzle(s).`);
}

function collectGenerated(c: Collector): void {
  if (c.allFull()) return;
  let attempts = 0;
  let added = 0;
  let batch: Candidate[] = [];
  while (!c.allFull() && attempts < GEN_LIMIT) {
    attempts++;
    const solution = generateSolution();
    const target = 21 + Math.floor(Math.random() * 6); // 21..26
    batch.push({ givens: gridToString(makePuzzle(solution, target)), solution: gridToString(solution) });
    if (batch.length >= BATCH) {
      added += ingest(c, batch);
      batch = [];
      process.stdout.write(`\r  gen: attempts ${attempts}, added ${added}   `);
    }
  }
  if (batch.length) added += ingest(c, batch);
  process.stdout.write('\n');
  console.log(`Generated: ${attempts} attempt(s), added ${added} puzzle(s).`);
}

// --- Post-processing & reporting ------------------------------------------

/** Populate hardestTechnique on the final selection (skfr path leaves it unset). */
function annotateTechniques(bank: Bank): void {
  for (const d of DIFFICULTIES) {
    for (const p of bank[d]) {
      if (p.hardestTechnique) continue;
      p.hardestTechnique = gradePuzzle(p.givens).hardestTechnique;
    }
  }
}

function reportDistribution(bank: Bank): void {
  console.log('\nFinal distribution (rating min / median / max):');
  for (const d of DIFFICULTIES) {
    const puzzles = bank[d];
    const ratings = puzzles.map((p) => p.rating ?? 0).sort((a, b) => a - b);
    const min = ratings[0] ?? 0;
    const max = ratings[ratings.length - 1] ?? 0;
    const median = ratings.length ? ratings[Math.floor(ratings.length / 2)] : 0;
    const short = puzzles.length < PER_TIER ? `  ⚠️  SHORT by ${PER_TIER - puzzles.length}` : '';
    console.log(
      `  ${d.padEnd(11)} ${String(puzzles.length).padStart(4)}/${PER_TIER}` +
        `  ${min.toFixed(1)} / ${median.toFixed(1)} / ${max.toFixed(1)}${short}`,
    );
  }
}

// --- Main -----------------------------------------------------------------

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csv = process.env.PUZZLE_CSV;
  const collector = new Collector();

  console.log(
    `Grader: ${useSkfr ? `skfr (${SKFR})` : 'in-app technique ladder (no skfr found)'}.`,
  );
  console.log(`Target: ${PER_TIER} puzzles per tier (${DIFFICULTIES.length} tiers).\n`);

  collectCurated(collector);
  if (csv && fs.existsSync(csv)) {
    console.log(`Mining Kaggle CSV: ${csv}`);
    await collectFromCsv(collector, csv);
  } else if (csv) {
    console.warn(`PUZZLE_CSV set but not found: ${csv} — skipping CSV mine.`);
  }
  collectGenerated(collector);

  console.log('\nAnnotating hardest technique…');
  annotateTechniques(collector.bank);

  reportDistribution(collector.bank);

  for (const d of DIFFICULTIES) {
    const file = path.join(OUT_DIR, `${d}.json`);
    fs.writeFileSync(file, JSON.stringify(collector.bank[d]));
    console.log(`Wrote ${collector.bank[d].length} puzzles -> ${file}`);
  }
  if (!useSkfr) {
    console.log('\nℹ️  Run `npx tsx scripts/apply-se-ratings.ts` to save authoritative SE ratings.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
