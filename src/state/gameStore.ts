/**
 * Active-game state. Orchestrates the pure domain engine, the repositories
 * (puzzles, persistence, analytics), and UI interaction modes.
 *
 * Interaction model:
 *  - Pencil toggle: digit input writes a note instead of a value.
 *  - Fast Mode (number-first): pick a digit, then tap cells to apply it
 *    repeatedly. When off, pick a cell, then tap a digit.
 */
import { create } from 'zustand';
import { boardFromPuzzle } from '../domain/board';
import {
  applyAutoNotes,
  applyEliminations,
  eraseCell,
  isSolved,
  placeValue,
  toggleNote,
} from '../domain/engine';
import { getPeers, isValidPlacement } from '../domain/rules';
import { buildHintPresentation, findHint } from '../domain/hints';
import type { HintAction, HintPresentation } from '../domain/hints';
import type { EngineResult } from '../domain/engine';
import {
  canUndo,
  createHistory,
  pushMove,
  undo as undoHistory,
} from '../domain/history';
import type { Board, CellIndex, Difficulty, Digit, Puzzle } from '../domain/types';
import type { History } from '../domain/history';
import { getRepositories } from '../data';
import { useSettingsStore } from './settingsStore';
import { deserializeGame, serializeGame } from './gameSerialization';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

interface GameState {
  status: GameStatus;
  puzzle: Puzzle | null;
  board: Board;
  history: History;
  difficulty: Difficulty;
  selectedIndex: CellIndex | null;
  /** Active digit in Fast Mode (number-first input). */
  selectedDigit: Digit | null;
  pencilMode: boolean;
  fastMode: boolean;
  mistakes: number;
  elapsed: number;
  /** Active Smart Hint walkthrough; null when the hint sheet is closed. */
  hint: HintPresentation | null;
  /** Current frame index within the active hint walkthrough. */
  hintStep: number;
  /** Furthest frame reached this hint session (Prev can move `hintStep` back);
   *  feeds the `hint_used` analytics event's `stageReached`. */
  hintMaxStep: number;
  /** How many hints the player has opened this game (unlimited; informational). */
  hintsUsed: number;
  /** Transient signal: a rejected (illegal) pencil note. `nonce` bumps each
   *  attempt so the UI re-triggers its flicker even for the same digit. */
  invalidFlash: { digit: Digit; nonce: number } | null;
  /** Transient signal: board cells that should blink red twice — the peers
   *  whose value conflicts with a just-placed wrong digit or an illegal note. */
  flashCells: { indices: CellIndex[]; nonce: number } | null;

  // lifecycle
  newGame: (difficulty: Difficulty) => void;
  /** Replay the current puzzle from its givens (used after a loss). */
  restartGame: () => void;
  resumeSavedGame: () => boolean;
  hasSavedGame: () => boolean;
  /** Lightweight peek at the saved game for the home screen's Continue row,
   *  without resuming it. Null when there is no saved game. */
  savedGameInfo: () => { difficulty: Difficulty; elapsed: number } | null;

  // interaction
  selectCell: (index: CellIndex) => void;
  pressDigit: (digit: Digit) => void;
  erase: () => void;
  undo: () => void;
  fastPencil: () => void;
  togglePencil: () => void;
  toggleFastMode: () => void;

  // smart hint
  requestHint: () => void;
  nextHintStep: () => void;
  prevHintStep: () => void;
  applyHint: () => void;
  closeHint: () => void;

  // timer
  tick: () => void;
  setPaused: (paused: boolean) => void;
}

function emit(event: Parameters<ReturnType<typeof getRepositories>['stats']['recordEvent']>[0]) {
  getRepositories().stats.recordEvent(event);
}

function persist(get: () => GameState) {
  const s = get();
  if (!s.puzzle) return;
  getRepositories().games.saveGame(
    serializeGame({
      puzzleId: s.puzzle.id,
      difficulty: s.difficulty,
      givens: s.puzzle.givens,
      board: s.board,
      history: s.history,
      elapsed: s.elapsed,
      mistakes: s.mistakes,
      hintsUsed: s.hintsUsed,
    }),
  );
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  puzzle: null,
  board: [],
  history: createHistory(),
  difficulty: 'easy',
  selectedIndex: null,
  selectedDigit: null,
  pencilMode: false,
  fastMode: false,
  mistakes: 0,
  elapsed: 0,
  hint: null,
  hintStep: 0,
  hintMaxStep: 0,
  hintsUsed: 0,
  invalidFlash: null,
  flashCells: null,

  newGame: (difficulty) => {
    const repos = getRepositories();
    const played = repos.games.getPlayedIds();
    const puzzle = repos.puzzles.getPuzzle(difficulty, played);
    repos.games.markPlayed(puzzle.id);
    set({
      status: 'playing',
      puzzle,
      board: boardFromPuzzle(puzzle),
      history: createHistory(),
      difficulty,
      selectedIndex: null,
      selectedDigit: null,
      pencilMode: false,
      fastMode: useSettingsStore.getState().fastModeDefault,
      mistakes: 0,
      elapsed: 0,
      hint: null,
      hintStep: 0,
      hintMaxStep: 0,
      hintsUsed: 0,
    });
    emit({ type: 'game_started', difficulty, puzzleId: puzzle.id, at: Date.now() });
    persist(get);
  },

  restartGame: () => {
    const { puzzle, difficulty } = get();
    if (!puzzle) return;
    set({
      status: 'playing',
      board: boardFromPuzzle(puzzle),
      history: createHistory(),
      selectedIndex: null,
      selectedDigit: null,
      pencilMode: false,
      fastMode: useSettingsStore.getState().fastModeDefault,
      mistakes: 0,
      elapsed: 0,
      hint: null,
      hintStep: 0,
      hintMaxStep: 0,
      hintsUsed: 0,
      invalidFlash: null,
      flashCells: null,
    });
    emit({ type: 'game_started', difficulty, puzzleId: puzzle.id, at: Date.now() });
    persist(get);
  },

  hasSavedGame: () => getRepositories().games.loadGame() !== undefined,

  savedGameInfo: () => {
    const saved = getRepositories().games.loadGame();
    if (!saved) return null;
    return { difficulty: saved.difficulty, elapsed: saved.elapsed };
  },

  resumeSavedGame: () => {
    const saved = getRepositories().games.loadGame();
    if (!saved) return false;
    const repos = getRepositories();
    const puzzle =
      repos.puzzles.getById(saved.puzzleId) ?? {
        id: saved.puzzleId,
        difficulty: saved.difficulty,
        givens: saved.givens,
        solution: '', // unknown; solved-check disabled if missing
      };
    const snap = deserializeGame(saved);
    set({
      status: 'playing',
      puzzle: { ...puzzle, solution: puzzle.solution || '' },
      board: snap.board,
      history: snap.history,
      difficulty: snap.difficulty,
      selectedIndex: null,
      selectedDigit: null,
      pencilMode: false,
      fastMode: useSettingsStore.getState().fastModeDefault,
      mistakes: snap.mistakes,
      elapsed: snap.elapsed,
      hint: null,
      hintStep: 0,
      hintMaxStep: 0,
      hintsUsed: snap.hintsUsed,
    });
    return true;
  },

  selectCell: (index) => {
    const { fastMode, selectedDigit } = get();
    if (fastMode && selectedDigit !== null) {
      applyDigit(set, get, index, selectedDigit);
      set({ selectedIndex: index });
    } else {
      set({ selectedIndex: index });
    }
  },

  pressDigit: (digit) => {
    const { fastMode, selectedIndex } = get();
    if (fastMode) {
      set((s) => ({ selectedDigit: s.selectedDigit === digit ? null : digit }));
    } else if (selectedIndex !== null) {
      applyDigit(set, get, selectedIndex, digit);
    }
  },

  erase: () => {
    const { board, selectedIndex, history } = get();
    if (selectedIndex === null) return;
    const res = eraseCell(board, selectedIndex);
    if (!res) return;
    set({ board: res.board, history: pushMove(history, res.move) });
    emit({ type: 'move_made', moveType: 'erase', at: Date.now() });
    persist(get);
  },

  undo: () => {
    const { board, history } = get();
    if (!canUndo(history)) return;
    const res = undoHistory(board, history);
    if (!res) return;
    set({ board: res.board, history: res.history });
    persist(get);
  },

  fastPencil: () => {
    const { board, history } = get();
    const res = applyAutoNotes(board);
    if (!res) return;
    set({ board: res.board, history: pushMove(history, res.move) });
    emit({ type: 'move_made', moveType: 'autoNotes', at: Date.now() });
    persist(get);
  },

  togglePencil: () => set((s) => ({ pencilMode: !s.pencilMode })),

  toggleFastMode: () =>
    set((s) => ({ fastMode: !s.fastMode, selectedDigit: null })),

  requestHint: () => {
    const raw = findHint(get().board, get().puzzle?.solution || null);
    if (!raw) return; // button is disabled when no hint exists; guard anyway
    const hint = buildHintPresentation(raw);
    set((s) => ({ hint, hintStep: 0, hintMaxStep: 0, hintsUsed: s.hintsUsed + 1 }));
    persist(get);
  },

  nextHintStep: () =>
    set((s) => {
      if (!s.hint) return s;
      const hintStep = Math.min(s.hintStep + 1, s.hint.frames.length - 1);
      return { hintStep, hintMaxStep: Math.max(s.hintMaxStep, hintStep) };
    }),

  prevHintStep: () => set((s) => ({ hintStep: Math.max(s.hintStep - 1, 0) })),

  closeHint: () => {
    const { hint, hintMaxStep } = get();
    if (hint) {
      emit({
        type: 'hint_used',
        technique: hint.technique,
        stageReached: hint.frames[hintMaxStep].stage,
        applied: false,
        at: Date.now(),
      });
    }
    set({ hint: null, hintStep: 0, hintMaxStep: 0 });
  },

  applyHint: () => {
    const { hint, board, hintMaxStep } = get();
    if (!hint) return;
    const res: EngineResult | null = applyHintAction(board, hint.action);

    emit({
      type: 'hint_used',
      technique: hint.technique,
      stageReached: hint.frames[hintMaxStep].stage,
      applied: true,
      at: Date.now(),
    });
    if (res) commitMove(set, get, res);
    set({ hint: null, hintStep: 0, hintMaxStep: 0 });
  },

  tick: () =>
    set((s) => (s.status === 'playing' ? { elapsed: s.elapsed + 1 } : s)),

  setPaused: (paused) =>
    set((s) => {
      if (s.status !== 'playing' && s.status !== 'paused') return s;
      return { status: paused ? 'paused' : 'playing' };
    }),
}));

/** Translate a hint's action into the matching engine transformation. */
function applyHintAction(board: Board, action: HintAction): EngineResult | null {
  switch (action.kind) {
    case 'place':
      return placeValue(board, action.placements![0].index, action.placements![0].digit, true);
    case 'eliminate':
      // Seed note-less target cells so a no-notes player can still apply.
      return applyEliminations(board, action.eliminations ?? [], true);
    case 'erase':
      return eraseCell(board, action.cells![0]);
    case 'add_note':
      // The added note is the cell's solution digit; skip validation so a
      // transient peer conflict can't block it (mistake hints fire first).
      return toggleNote(board, action.additions![0].index, action.additions![0].digit, false);
  }
}

/**
 * Push an engine result onto the board + history, run the solved-check, emit
 * analytics and persist. Shared by Smart Hint's Apply (placements never count
 * as mistakes, since the hint always plays a correct move).
 */
function commitMove(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  res: EngineResult,
) {
  const { history, puzzle } = get();
  let status: GameStatus = get().status;

  if (puzzle?.solution && isSolved(res.board, puzzle.solution)) {
    status = 'won';
    emit({
      type: 'game_completed',
      difficulty: get().difficulty,
      puzzleId: puzzle.id,
      elapsed: get().elapsed,
      mistakes: get().mistakes,
      at: Date.now(),
    });
    getRepositories().games.clearGame();
  }

  set({ board: res.board, history: pushMove(history, res.move), status });
  emit({ type: 'move_made', moveType: res.move.type, at: Date.now() });
  if (status !== 'won') persist(get);
}

/** Shared logic for placing a value or note into a cell. */
function applyDigit(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  index: CellIndex,
  digit: Digit,
) {
  const { board, history, pencilMode, puzzle, mistakes } = get();
  if (!puzzle) return;
  const validate = useSettingsStore.getState().validateNotes;

  // A correct placement lets us auto-strip the now-impossible peer notes.
  const correct = !!puzzle.solution && puzzle.solution[index] === String(digit);

  const res = pencilMode
    ? toggleNote(board, index, digit, validate)
    : placeValue(board, index, digit, correct);
  if (!res) {
    // A rejected pencil note on an editable cell means the digit is illegal
    // here (a peer already holds it) — flicker the pad digit and blink the
    // peers that hold that digit (the reason it's illegal).
    if (pencilMode) {
      const cell = board[index];
      if (!cell.given && cell.value === null && !isValidPlacement(board, index, digit)) {
        const culprits = [...getPeers(index)].filter((p) => board[p].value === digit);
        set({
          invalidFlash: { digit, nonce: (get().invalidFlash?.nonce ?? 0) + 1 },
          flashCells: { indices: culprits, nonce: (get().flashCells?.nonce ?? 0) + 1 },
        });
      }
    }
    return;
  }

  let nextMistakes = mistakes;
  let status: GameStatus = get().status;
  let flashCells = get().flashCells;

  if (!pencilMode && res.board[index].value !== null) {
    // Blink the peers that already hold this digit (a same-row/col/box clash).
    const clashes = [...getPeers(index)].filter((p) => res.board[p].value === digit);
    if (clashes.length) {
      flashCells = { indices: clashes, nonce: (get().flashCells?.nonce ?? 0) + 1 };
    }

    if (puzzle.solution && !correct) {
      nextMistakes = mistakes + 1;
      emit({ type: 'mistake_made', difficulty: get().difficulty, at: Date.now() });
      const max = useSettingsStore.getState().maxMistakes;
      if (max > 0 && nextMistakes >= max) status = 'lost';
    }
  }

  if (puzzle.solution && isSolved(res.board, puzzle.solution)) {
    status = 'won';
    emit({
      type: 'game_completed',
      difficulty: get().difficulty,
      puzzleId: puzzle.id,
      elapsed: get().elapsed,
      mistakes: nextMistakes,
      at: Date.now(),
    });
    getRepositories().games.clearGame();
  }

  set({
    board: res.board,
    history: pushMove(history, res.move),
    mistakes: nextMistakes,
    status,
    flashCells,
  });
  emit({ type: 'move_made', moveType: res.move.type, at: Date.now() });
  if (status !== 'won') persist(get);
}
