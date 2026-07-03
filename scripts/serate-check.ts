/**
 * SE spot-check — offline calibration, run manually at dev time (never in app).
 *
 * Samples puzzles from the built banks (assets/puzzles/*.json) and rates them
 * with an external, community-standard Sudoku Explainer rater, then prints our
 * grader's tier/rating next to the SE rating so the technique→tier thresholds in
 * src/domain/grade.ts can be calibrated.
 *
 *   npx tsx scripts/serate-check.ts                 # skfr on PATH (preferred)
 *   SE_TOOL=serate SERATE_JAR=/path/SukakuExplainer.jar npx tsx scripts/serate-check.ts
 *   SAMPLE=8 npx tsx scripts/serate-check.ts        # puzzles per tier (default 5)
 *
 * Toolchain (macOS):
 *   skfr   — git clone https://github.com/dobrichev/skfr && make  (C++, fast)
 *   serate — brew install openjdk + SukakuExplainer.jar           (Java)
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, Puzzle } from '../src/domain/types';

const SAMPLE = Number(process.env.SAMPLE ?? 5);
const SE_TOOL = (process.env.SE_TOOL ?? 'skfr').toLowerCase();
const BANK_DIR = path.resolve(__dirname, '..', 'assets', 'puzzles');
const LOCAL_SKFR = path.resolve(__dirname, 'bin', 'skfr');

/** Rough SE band each tier should fall in — for flagging gross mismatches. */
const EXPECTED_SE: Record<Difficulty, [number, number]> = {
  easy: [1.0, 2.5],
  medium: [2.5, 3.5],
  hard: [3.4, 4.5],
  expert: [4.4, 6.6],
  extreme: [6.5, 8.2],
  diabolical: [7.4, 20],
};

function sample(): Puzzle[] {
  const out: Puzzle[] = [];
  for (const d of DIFFICULTIES) {
    const file = path.join(BANK_DIR, `${d}.json`);
    if (!fs.existsSync(file)) continue;
    const bank = JSON.parse(fs.readFileSync(file, 'utf8')) as Puzzle[];
    out.push(...bank.slice(0, SAMPLE));
  }
  return out;
}

/** Run the SE rater over the puzzles; return a parallel array of SE ratings. */
function rate(puzzles: Puzzle[]): (number | null)[] {
  const base = path.join(os.tmpdir(), `serate-input-${puzzles.length}`);
  const tmp = `${base}.txt`;
  // Blanks as '.' so skfr echoes them back as '.' (it keeps '0' as a digit),
  // keeping the output puzzle string identical to our givens for matching.
  fs.writeFileSync(tmp, puzzles.map((p) => p.givens.replace(/0/g, '.')).join('\n') + '\n');

  try {
    if (SE_TOOL === 'serate') {
      const jar = process.env.SERATE_JAR;
      if (!jar) throw new Error('Set SERATE_JAR=/path/to/SukakuExplainer.jar');
      // serate prints one rating per line (%r), in input order.
      const out = execFileSync(
        'java',
        ['-Xrs', '-Xmx500m', '-cp', jar, 'diuf.sudoku.test.serate', '--input=' + tmp, '--format=%r'],
        { encoding: 'utf8' },
      );
      const ratings = out
        .split('\n')
        .map((l) => l.match(/(\d+(?:\.\d+)?)/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => Number(m[1]));
      return puzzles.map((_, i) => ratings[i] ?? null);
    }
    // skfr appends ".txt" to the --input base and writes "<base>_rat.txt" as
    // "<puzzle> ED=<ER>/<EP>/<ED>". Match by puzzle string (robust to reorder).
    const bin = process.env.SKFR ?? (fs.existsSync(LOCAL_SKFR) ? LOCAL_SKFR : 'skfr');
    execFileSync(bin, [`--input=${base}`], { encoding: 'utf8' });
    const byGivens = new Map<string, number>();
    for (const line of fs.readFileSync(`${base}_rat.txt`, 'utf8').split('\n')) {
      const [puzzle, tail] = line.split(' ED=');
      if (!puzzle || !tail) continue;
      const er = Number(tail.split('/')[0]);
      if (!Number.isNaN(er)) byGivens.set(puzzle.trim(), er);
    }
    return puzzles.map((p) => byGivens.get(p.givens.replace(/0/g, '.')) ?? null);
  } catch (err) {
    console.error(`\nCould not run '${SE_TOOL}'. Is it installed / on PATH?`);
    console.error(String((err as Error).message).split('\n')[0]);
    return puzzles.map(() => null);
  }
}

function main(): void {
  const puzzles = sample();
  if (puzzles.length === 0) {
    console.error('No banks found — run `npm run build:puzzles` first.');
    process.exit(1);
  }
  console.log(`Rating ${puzzles.length} puzzles with '${SE_TOOL}'…\n`);
  const se = rate(puzzles);

  console.log('tier        our-rating  hardest-technique      SE      flag');
  console.log('─'.repeat(66));
  let flags = 0;
  puzzles.forEach((p, i) => {
    const seR = se[i];
    const [lo, hi] = EXPECTED_SE[p.difficulty];
    const mismatch = seR !== null && (seR < lo || seR > hi);
    if (mismatch) flags++;
    console.log(
      `${p.difficulty.padEnd(11)} ${String(p.rating ?? '?').padStart(9)}  ` +
        `${(p.hardestTechnique ?? '?').padEnd(22)} ` +
        `${(seR === null ? '—' : seR.toFixed(1)).padStart(6)}  ${mismatch ? '⚠️' : ''}`,
    );
  });
  console.log('─'.repeat(66));
  console.log(`${flags} puzzle(s) outside the expected SE band for their tier.`);
}

main();
