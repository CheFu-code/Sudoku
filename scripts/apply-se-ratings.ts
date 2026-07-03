/**
 * Compute authoritative SE (Sudoku Explainer) ratings for every bundled puzzle
 * and save them into the bank JSONs. Offline/dev only.
 *
 *   npx tsx scripts/apply-se-ratings.ts
 *   SKFR=/path/to/skfr npx tsx scripts/apply-se-ratings.ts
 *
 * Uses `skfr` (Sudoku Fast Rating, SE-compatible). By default looks for the
 * binary at scripts/bin/skfr (built locally, gitignored), else `skfr` on PATH.
 * Writes each puzzle's `rating` to its SE ER (the primary difficulty number) and
 * prints the per-tier SE distribution so the grader tiers can be sanity-checked.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { DIFFICULTIES } from '../src/domain/types';
import type { Puzzle } from '../src/domain/types';

const BANK_DIR = path.resolve(__dirname, '..', 'assets', 'puzzles');
const LOCAL_SKFR = path.resolve(__dirname, 'bin', 'skfr');
const SKFR = process.env.SKFR ?? (fs.existsSync(LOCAL_SKFR) ? LOCAL_SKFR : 'skfr');

/** Rate all givens with skfr; return a map from givens string → SE ER rating. */
function rateAll(allGivens: string[]): Map<string, number> {
  const base = path.join(os.tmpdir(), `skfr-rate-${allGivens.length}`);
  const input = `${base}.txt`;
  const rated = `${base}_rat.txt`;
  fs.writeFileSync(input, allGivens.join('\n') + '\n');

  // skfr appends ".txt" to the --input base name and writes "<base>_rat.txt".
  execFileSync(SKFR, [`--input=${base}`], { encoding: 'utf8' });

  const map = new Map<string, number>();
  for (const line of fs.readFileSync(rated, 'utf8').split('\n')) {
    // Format: "<81-char puzzle> ED=<ER>/<EP>/<ED>" — ER is the SE rating.
    const [puzzle, tail] = line.split(' ED=');
    if (!puzzle || !tail) continue;
    const er = Number(tail.split('/')[0]);
    if (!Number.isNaN(er)) map.set(puzzle.trim(), er);
  }
  return map;
}

function main(): void {
  // skfr emits blanks as '.', so normalize our givens the same way for matching.
  const banks = DIFFICULTIES.map((d) => ({
    d,
    file: path.join(BANK_DIR, `${d}.json`),
  })).filter((b) => fs.existsSync(b.file));

  const loaded = banks.map((b) => ({
    ...b,
    puzzles: JSON.parse(fs.readFileSync(b.file, 'utf8')) as Puzzle[],
  }));

  const allGivens = loaded.flatMap((b) =>
    b.puzzles.map((p) => p.givens.replace(/0/g, '.')),
  );
  console.log(`Rating ${allGivens.length} puzzles with ${SKFR}…`);
  const ratings = rateAll(allGivens);

  let missing = 0;
  console.log('\nPer-tier SE rating (min / median / max):');
  for (const b of loaded) {
    const seVals: number[] = [];
    for (const p of b.puzzles) {
      const key = p.givens.replace(/0/g, '.');
      const er = ratings.get(key);
      if (er === undefined) {
        missing++;
        continue;
      }
      p.rating = er; // save authoritative SE rating
      seVals.push(er);
    }
    seVals.sort((a, z) => a - z);
    const min = seVals[0] ?? 0;
    const max = seVals[seVals.length - 1] ?? 0;
    const median = seVals.length ? seVals[Math.floor(seVals.length / 2)] : 0;
    console.log(
      `  ${b.d.padEnd(11)} ${String(b.puzzles.length).padStart(3)}` +
        `   ${min.toFixed(1)} / ${median.toFixed(1)} / ${max.toFixed(1)}`,
    );
    fs.writeFileSync(b.file, JSON.stringify(b.puzzles));
  }
  if (missing) console.warn(`\n⚠️  ${missing} puzzle(s) had no SE rating (left unchanged).`);
  console.log('\nSaved SE ratings into assets/puzzles/*.json.');
}

main();
