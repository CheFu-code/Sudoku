# Sudoku App — Repository Guide

> Cross-app conventions shared across the sibling apps (incl. the Lucide **icon
> convention** — use the `Icon` wrapper, never an icon font) live in the parent
> `apps/CLAUDE.md`, imported below for use in the `apps/` workspace.

@../CLAUDE.md

Cross-platform (iOS + Android) Sudoku game built with **React Native + Expo
(TypeScript)**. Offline-first, with a clean separation that lets a backend
(analytics, accounts, cloud sync) be plugged in later without rewriting the app.

## Identity
- App name: **Sudoku**
- Bundle id: **dev.alejandrodelacruz.sudoku**
- Min OS: Expo defaults

## Tech stack
- **TypeScript** (strict mode)
- **Expo** (managed) + **Expo Router** (file-based navigation)
- **Zustand** (+ `persist` middleware) for state
- **react-native-mmkv** for persistence — requires an Expo **dev client**
  (`expo prebuild` / `expo run:ios|android`); does **not** run in plain Expo Go
- **Jest** + `@testing-library/react-native` for tests
- **ESLint + Prettier**

## Architecture — layered Clean Architecture

Dependencies point **downward only**. UI → State → Domain + Data interfaces.
The Domain layer depends on nothing.

```
UI layer       (React Native components + screens)   ← Expo, Expo Router
State layer    (Zustand stores + selectors)          ← orchestrates engine + repos
Domain layer   (pure TS: engine, rules, types)       ← NO framework/storage imports
Data layer     (repository interfaces + impls)       ← swappable: local now, API later
```

### Golden rule
**`src/domain/` is pure TypeScript** — zero React, Expo, or storage imports. It
must run unchanged in tests, on a server, or in a future web build. Never import
React or a repository implementation into `domain/`.

Concrete repository implementations are **never imported** by UI/State directly.
They are wired in one **composition root** (`src/data/index.ts`) and injected.
This is the seam that makes the backend pluggable.

## Folder map

```
src/
  domain/                      # PURE — no React, Expo, or storage
    types.ts                   # Cell, Board, Puzzle, Difficulty, Move
    board.ts                   # board construction, immutable updates, coord helpers
    rules.ts                   # isValidPlacement, getPeers, getConflicts
    candidates.ts              # legal candidates for a cell / whole board
    engine.ts                  # placeValue, toggleNote, eraseCell, computeAutoNotes, isSolved
    history.ts                 # undo stack (move log + snapshot restore)
  data/
    repositories/              # INTERFACES only
      PuzzleRepository.ts
      GameStorageRepository.ts
      StatsRepository.ts       # analytics seam (local now, backend later)
    local/                     # local implementations (current)
      BundledPuzzleRepository.ts
      MmkvGameStorageRepository.ts
      LocalStatsRepository.ts
    remote/                    # placeholder for future API-backed impls
    index.ts                   # composition root — wires interfaces -> impls
  state/
    gameStore.ts               # active game: board, selection, mode, timer, mistakes, undo
    settingsStore.ts           # theme, fast-mode default, sound (persisted)
    selectors.ts               # derived state: remaining counts, highlights
  ui/
    screens/                   # Home/difficulty select, Game
    components/
      Board/                   # Grid, Box, Cell, NotesOverlay
      Controls/                # Undo, Erase, FastPencil, Pencil toggle, FastMode toggle
      NumberPad/               # digit buttons + remaining-count badges
      Header/                  # timer, mistakes, difficulty, pause
      ThemePicker/             # palette selector
    theme/                     # theme definitions, tokens, ThemeProvider
assets/
  puzzles/                     # bundled, pre-graded puzzle banks (per difficulty)
app/                           # Expo Router routes (thin — delegate to ui/screens)
scripts/
  build-puzzle-bank.ts         # offline: dataset CSV -> sharded JSON banks
```

## Domain model

- Board is a **flat 81-cell array**: `index = row * 9 + col`.
- `Cell = { value: number | null; given: boolean; notes: Set<number> }`.
- All board updates are **immutable** (new objects each move) — makes undo and
  React re-render detection trivial.
- `Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme'`.
- Undo is snapshot-based: each `Move` stores the affected cell's prior state;
  undo restores it. One mechanism serves place/note/erase/fast-pencil (batched).

### Feature → engine mapping
- **Validated pencil notes** → `toggleNote` checks peers via `rules` first.
- **Fast mode** → `gameStore.selectedDigit`; tapping cells applies that digit.
- **Fast Pencil** → `computeAutoNotes(board)` applied as one undoable batch.
- **Timer/pause, mistakes, remaining counts, highlights** → `gameStore` slices +
  `selectors`.

## Data & backend extensibility
- Every external dependency sits behind an interface in `data/repositories/`.
- Swap local → remote by changing wiring in `data/index.ts` only.
- **Analytics from day one:** the State layer emits events
  (`game_started`, `move_made`, `hint_used`, `game_completed`, `mistake_made`)
  through `StatsRepository`. Today it writes locally; later, swap the repo —
  no app instrumentation changes needed.

## Puzzles
- Difficulty is graded by **how hard the puzzle is to solve**, not clue count
  (clue count barely correlates with difficulty). 6 tiers:
  `easy | medium | hard | expert | extreme | diabolical`. 500 per tier.
- `scripts/build-puzzle-bank.ts` runs **offline at dev time** (not in-app) and
  grades candidates from three sources — curated hard grids
  (`assets/puzzles/_sources/hardest.txt`), the Kaggle 3M CSV (`PUZZLE_CSV=...`,
  gitignored, ratings ignored/re-graded), and a generate-and-grade backstop —
  dedupes, buckets by tier, and emits `assets/puzzles/<difficulty>.json`
  ({ id `<tier>-<hash>`, difficulty, givens, solution, rating, hardestTechnique }).
  Two graders, auto-selected:
  - **skfr (preferred)** — the compiled SE rater at `scripts/bin/skfr` (or `$SKFR`).
    Rates candidates in fast batches (~700/s) and buckets by **SE band** (`SE_BANDS`);
    `rating` is the authoritative SE ER. This is the only tractable way to mine the
    hard tiers (diabolical ≈ 0.6% of the Kaggle set → ~85k rows scanned for 500).
  - **Fallback (no skfr)** — `src/domain/grade.ts` `gradePuzzle` drives the in-app
    technique ladder (`hints/findHint.ts` `DETECTORS`) and buckets by hardest
    technique; `rating` is approximate. Then run `scripts/apply-se-ratings.ts` to
    overwrite with real SE scores.
  - `hardestTechnique` is always populated via `gradePuzzle` on the final set.
- **Solvability invariant:** every easy–extreme puzzle must be fully solvable by
  the in-app `DETECTORS` ladder (`gradePuzzle(...).solved === true`) — a stall
  would show the player a "Last Resort" trial-and-error hint, allowed only in
  diabolical. `build-puzzle-bank.ts` re-files stalls to diabolical; after any
  ladder change run `npm run regrade:puzzles` (supports `TIER=`/`SLICE=`/`MERGE=`
  parallel mode) and the guardrail `npm run test:bank`
  (`src/domain/__tests__/bankGuardrail.test.ts`; its fast metadata layer runs in
  every `npm test`).
- **Build the workflow:** `PER_TIER=500 PUZZLE_CSV=./sudoku-3m.csv npx tsx scripts/build-puzzle-bank.ts`.
- **skfr binary** (gitignored, machine-specific). On Apple Silicon build for
  x86_64 + run under Rosetta:
  `git clone https://github.com/dobrichev/skfr && cd skfr/src && clang++ -arch x86_64 -O3 -std=c++17 -w -msse4.2 -Wno-c++11-narrowing utilities.cpp opsudo.cpp puzzle.cpp fsss.cpp t_128.cpp flog.cpp skfr.cpp ratingengine.cpp bitfields.cpp -o skfr`, then copy to `scripts/bin/skfr`.
- `scripts/serate-check.ts` spot-checks a sample (our tier vs SE) for calibration.
- Verified SE per tier (median): easy 1.5, medium 2.6, hard 4.2, expert 6.6,
  extreme 7.2, diabolical 8.3+ (up to ~12).
- `BundledPuzzleRepository` serves a random unused puzzle per difficulty,
  tracking played ids to avoid repeats.
- **Future:** replace with an on-device generator implementing the same
  `PuzzleRepository` interface — no app changes.

## Persistence
- In-progress game auto-saved to MMKV after each move (board, notes, timer,
  mistakes, undo stack) → resume after app kill.
- Settings (selected theme, default fast mode, sound) via Zustand `persist`.
- Played puzzle ids / basic stats stored locally (also feed `LocalStatsRepository`).

## Commands
- Install: `npm install`
- Dev (dev client, required by MMKV): `npx expo run:ios` / `npx expo run:android`
- Tests: `npm test`
- Lint: `npm run lint`
- Build puzzle banks (offline): `npx tsx scripts/build-puzzle-bank.ts`

## Conventions
- Keep `domain/` free of framework/storage imports — enforce in review.
- UI/State import repository **interfaces**, never `local/` or `remote/` impls.
- Prefer Zustand **selectors** over whole-store subscriptions to limit re-renders.
- New external capability → add an interface in `repositories/`, a local impl,
  and wire it in the composition root.

> Out of scope for now (architecture leaves room): Score, Streak, Smart Hint,
> share. The **theme palette is in scope**.
