# Sudoku

Cross-platform (iOS + Android) Sudoku game built with React Native + Expo.
Offline-first, with a clean architecture that lets a backend be plugged in later
without rewriting the app. See [`.claude/CLAUDE.md`](.claude/CLAUDE.md) for the
full architecture guide.

## Features

- **Pencil notes** with validation — illegal notes (value already in the same
  row/column/box) are blocked.
- **Fast Mode** (number-first): pick a digit, then tap cells to place it repeatedly.
- **Fast Pencil**: auto-fill every empty cell's legal candidates in one undoable step.
- **Timer** with pause, **mistakes** counter, **undo**, **erase**.
- **5 difficulties** (easy → extreme) served from a bundled, offline puzzle bank.
- **Theme palette** — multiple selectable color themes.

## Stack

- TypeScript (strict), Expo + Expo Router
- Zustand (state) + react-native-mmkv (persistence)
- Jest for the pure-TypeScript game engine and data layer

## Develop

react-native-mmkv requires a dev client, so use the native run commands (not Expo Go):

```bash
npm install
npm run ios       # or: npm run android  (runs expo prebuild + native build)
```

## Tests

```bash
npm test
```

## Releasing (manual, iOS)

Publishing is done manually from the laptop so long EAS builds don't burn GitHub
Actions free-tier minutes. The git tag is still the source of truth for the
marketing version — **tag first, then build**.

```bash
make check                     # optional: typecheck + lint + test
make release VERSION=1.2.0      # tags v1.2.0 and pushes it (git only — no build triggered)
make publish-ios VERSION=1.2.0  # set version, EAS-build on the cloud, then auto-submit
```

`make publish-ios` runs `set-version` (writes the version into `app.json`), then
`eas build --platform ios --profile production --auto-submit`, then restores
`app.json` so the working tree stays clean — the version bump is never committed
(the tag is the source of truth). The build runs on EAS's servers (triggered from
your Mac, so **no GitHub Actions minutes**) and, on success, uploads to App Store
Connect using `submit.production.ios` in `eas.json`. App Store Connect auto-publishes
once the build clears review. EAS auto-increments the build number.

First run: EAS prompts to create/reuse signing credentials — answer interactively.
If it warns about the uncommitted version bump, choose to proceed.

Two-step alternative: `make build-ios` then `make submit-ios`.

CI (`.github/workflows/release.yml`) still exists but now runs **only via manual
dispatch** (GitHub → Actions → Release → Run workflow, enter the tag). It no longer
runs on tag push. It needs the **`EXPO_TOKEN`** repo secret. The Android job is
written but disabled — enable it by adding the `PLAY_SERVICE_ACCOUNT_JSON` secret
and setting the `ANDROID_RELEASE_ENABLED` repo variable to `true` once Play Console
registration is done.

## Puzzles

A starter bank is committed under `assets/puzzles/`. Regenerate or rebuild it:

```bash
npm run build:puzzles                          # generate a fresh starter bank
PER_TIER=200 npm run build:puzzles             # more puzzles per tier
PUZZLE_CSV=path/to/kaggle.csv npm run build:puzzles   # build from the Kaggle dataset
```

The Kaggle source is "3 million Sudoku puzzles with ratings". Swapping to
on-device generation later means implementing `PuzzleRepository` — no app changes.
