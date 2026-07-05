/**
 * Re-grade the bundled puzzle banks with the current in-app technique ladder.
 * Run at dev time after the ladder changes:
 *
 *   npx tsx scripts/regrade-puzzle-bank.ts            # rewrite banks in place
 *   DRY_RUN=1 npx tsx scripts/regrade-puzzle-bank.ts  # report only
 *
 * Parallel mode (grading is CPU-bound; ~1h sequential for 12k puzzles):
 *   TIER=extreme REPORT=/tmp/extreme.json npx tsx scripts/regrade-puzzle-bank.ts
 *     — grade one tier, write {id → {solved, hardestTechnique}} to REPORT.
 *     Optional SLICE=start:end grades a sub-range (for chunked runs; merge the
 *     partial reports by concatenating their JSON objects).
 *   MERGE=/tmp npx tsx scripts/regrade-puzzle-bank.ts
 *     — apply all six <tier>.report.json files and rewrite the banks.
 *
 * What it does:
 *  - refreshes every puzzle's `hardestTechnique` from `gradePuzzle` (the
 *    `rating` — SE ER from the skfr build — stays untouched: SE remains the
 *    tier authority);
 *  - enforces the solvability invariant with a DEMOTE-ONLY policy: an
 *    easy–extreme puzzle the ladder cannot finish (`solved: false`) moves to
 *    diabolical.json. Nothing is ever promoted — reshuffling solvable
 *    diabolicals would churn the bank for no player benefit;
 *  - keeps original id strings when a puzzle moves files. Ids are opaque to
 *    the app (the repository indexes by id across all tiers); regenerating
 *    them would orphan saved games and played-history entries;
 *  - prints a per-tier report, including how many diabolical puzzles still
 *    stall the ladder (the input to the nested-forcing-chains decision).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { gradePuzzle } from '../src/domain/grade';
import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, Puzzle } from '../src/domain/types';

const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'puzzles');
const DRY_RUN = !!process.env.DRY_RUN;

function loadBank(tier: Difficulty): Puzzle[] {
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${tier}.json`), 'utf8'));
}

function saveBank(tier: Difficulty, puzzles: Puzzle[]) {
  fs.writeFileSync(path.join(OUT_DIR, `${tier}.json`), JSON.stringify(puzzles));
}

type Report = Record<string, { solved: boolean; hardestTechnique: string }>;

/** Grade one tier and write a report file — one worker of the parallel mode. */
function gradeTier(tier: Difficulty, reportPath: string) {
  let puzzles = loadBank(tier);
  const slice = process.env.SLICE;
  if (slice) {
    const [start, end] = slice.split(':').map(Number);
    puzzles = puzzles.slice(start, end);
  }
  const report: Report = {};
  let done = 0;
  for (const p of puzzles) {
    const grade = gradePuzzle(p.givens);
    report[p.id] = { solved: grade.solved, hardestTechnique: grade.hardestTechnique };
    done++;
    if (done % 100 === 0) process.stdout.write(`\r${tier}: ${done}/${puzzles.length}`);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report));
  console.log(`\n${tier}: report written to ${reportPath}`);
}

/** Apply per-tier grades (from reports or computed inline) to the banks. */
function applyGrades(gradeOf: (tier: Difficulty, p: Puzzle) => Report[string]) {
  const banks = new Map<Difficulty, Puzzle[]>();
  for (const tier of DIFFICULTIES) banks.set(tier, loadBank(tier));

  const demoted: Puzzle[] = [];
  let diabolicalStalls = 0;
  const techniqueDelta = new Map<string, number>();

  for (const tier of DIFFICULTIES) {
    const puzzles = banks.get(tier)!;
    const keep: Puzzle[] = [];
    let done = 0;

    for (const p of puzzles) {
      const grade = gradeOf(tier, p);
      if (p.hardestTechnique !== grade.hardestTechnique) {
        const key = `${p.hardestTechnique ?? '?'} -> ${grade.hardestTechnique}`;
        techniqueDelta.set(key, (techniqueDelta.get(key) ?? 0) + 1);
      }
      p.hardestTechnique = grade.hardestTechnique as Puzzle['hardestTechnique'];

      if (!grade.solved) {
        if (tier === 'diabolical') {
          diabolicalStalls++;
          keep.push(p);
        } else {
          demoted.push({ ...p, difficulty: 'diabolical' });
        }
      } else {
        keep.push(p);
      }

      done++;
      if (done % 250 === 0) {
        process.stdout.write(`\r${tier}: ${done}/${puzzles.length}`);
      }
    }
    process.stdout.write(`\r${tier}: ${puzzles.length}/${puzzles.length}\n`);
    banks.set(tier, keep);
  }

  banks.get('diabolical')!.push(...demoted);

  console.log('\n=== Re-grade report ===');
  for (const tier of DIFFICULTIES) {
    console.log(`${tier}: ${banks.get(tier)!.length} puzzles`);
  }
  console.log(`\nDemoted to diabolical (ladder stalls): ${demoted.length}`);
  for (const p of demoted) console.log(`  ${p.id} (rating ${p.rating})`);
  console.log(`Diabolical puzzles still stalling the ladder: ${diabolicalStalls}`);
  if (techniqueDelta.size > 0) {
    console.log('\nhardestTechnique changes:');
    for (const [key, n] of [...techniqueDelta].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${key}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN set — banks not written.');
    return;
  }
  for (const tier of DIFFICULTIES) saveBank(tier, banks.get(tier)!);
  console.log('\nBanks rewritten.');
}

function main() {
  const tierEnv = process.env.TIER as Difficulty | undefined;
  const mergeDir = process.env.MERGE;

  if (tierEnv) {
    if (!DIFFICULTIES.includes(tierEnv)) throw new Error(`unknown TIER: ${tierEnv}`);
    const report = process.env.REPORT ?? path.join(os.tmpdir(), `${tierEnv}.report.json`);
    gradeTier(tierEnv, report);
    return;
  }

  if (mergeDir) {
    const reports = new Map<Difficulty, Report>();
    for (const tier of DIFFICULTIES) {
      reports.set(
        tier,
        JSON.parse(fs.readFileSync(path.join(mergeDir, `${tier}.report.json`), 'utf8')),
      );
    }
    applyGrades((tier, p) => {
      const r = reports.get(tier)![p.id];
      if (!r) throw new Error(`no report entry for ${p.id}`);
      return r;
    });
    return;
  }

  applyGrades((_tier, p) => {
    const g = gradePuzzle(p.givens);
    return { solved: g.solved, hardestTechnique: g.hardestTechnique };
  });
}

main();
