/**
 * Store-level tests for the progressive hint session: frame paging, the
 * furthest-stage tracker, and the single `hint_used` analytics event emitted
 * on close/apply.
 */

import { createBoard } from '../domain/board';
import { createHistory } from '../domain/history';
import type { Digit } from '../domain/types';
import { getRepositories } from '../data';
import { useGameStore } from './gameStore';

jest.mock('./persist', () => ({
  mmkvStateStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
}));

jest.mock('../data', () => {
  const recordEvent = jest.fn();
  const repositories = {
    puzzles: { getPuzzle: () => null, getById: () => undefined },
    games: {
      saveGame: () => {},
      loadGame: () => undefined,
      clearGame: () => {},
      getPlayedIds: () => [],
      markPlayed: () => {},
    },
    stats: { recordEvent, getStats: () => ({ gamesCompleted: 0, bestTimes: {} }) },
  };
  return { getRepositories: () => repositories };
});

const recordEvent = getRepositories().stats.recordEvent as jest.Mock;
const events = () => recordEvent.mock.calls.map((c) => c[0] as Record<string, unknown>);

/** Row 0 holds 1-8 in columns 1-8; index 0 is a naked single (9). */
const NAKED_SINGLE_GIVENS = '.12345678'.padEnd(81, '.');

function startGame() {
  recordEvent.mockClear();
  useGameStore.setState({
    status: 'playing',
    puzzle: { id: 'test', difficulty: 'easy', givens: NAKED_SINGLE_GIVENS, solution: '' },
    board: createBoard(NAKED_SINGLE_GIVENS),
    history: createHistory(),
    hint: null,
    hintStep: 0,
    hintMaxStep: 0,
    hintsUsed: 0,
  });
}

describe('gameStore hint session', () => {
  it('requestHint builds a staged presentation without emitting analytics yet', () => {
    startGame();
    useGameStore.getState().requestHint();
    const s = useGameStore.getState();
    expect(s.hint).not.toBeNull();
    expect(s.hint!.frames[0].stage).toBe('what');
    expect(s.hint!.frames[1].stage).toBe('where');
    expect(s.hintStep).toBe(0);
    expect(s.hintsUsed).toBe(1);
    expect(events()).toHaveLength(0);
  });

  it('next/prev page through frames, tracking the furthest frame reached', () => {
    startGame();
    const store = useGameStore.getState();
    store.requestHint();
    store.nextHintStep();
    store.nextHintStep();
    store.prevHintStep();
    const s = useGameStore.getState();
    expect(s.hintStep).toBe(1);
    expect(s.hintMaxStep).toBe(2);
    // Clamped at the last frame.
    const total = s.hint!.frames.length;
    for (let i = 0; i < total + 3; i++) useGameStore.getState().nextHintStep();
    expect(useGameStore.getState().hintStep).toBe(total - 1);
  });

  it('closeHint emits one hint_used with the furthest stage and applied=false', () => {
    startGame();
    const store = useGameStore.getState();
    store.requestHint();
    store.nextHintStep(); // reached 'where'
    store.prevHintStep(); // back to 'what' — stageReached must stay 'where'
    store.closeHint();
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      type: 'hint_used',
      technique: 'naked_single',
      stageReached: 'where',
      applied: false,
    });
    expect(useGameStore.getState().hint).toBeNull();
    expect(useGameStore.getState().hintMaxStep).toBe(0);
  });

  it('applyHint applies the move and emits hint_used with applied=true', () => {
    startGame();
    const store = useGameStore.getState();
    store.requestHint();
    const total = useGameStore.getState().hint!.frames.length;
    for (let i = 0; i < total; i++) useGameStore.getState().nextHintStep();
    useGameStore.getState().applyHint();

    const hintEvents = events().filter((e) => e.type === 'hint_used');
    expect(hintEvents).toHaveLength(1);
    expect(hintEvents[0]).toMatchObject({
      type: 'hint_used',
      technique: 'naked_single',
      stageReached: 'explain',
      applied: true,
    });
    const s = useGameStore.getState();
    expect(s.hint).toBeNull();
    expect(s.board[0].value).toBe(9);
  });
});

describe('gameStore board-check hints', () => {
  // A real bank puzzle with its solution, so requestHint validates against the
  // stored solution instead of re-solving the (possibly wrong) board.
  const GIVENS =
    '8..9........524.....5.1.67..2......45.17....3.......164....8..1....6...7......89.';
  const SOLUTION =
    '813976425697524138245813679329681754561749283784235916472398561958162347136457892';

  function startAicGame() {
    recordEvent.mockClear();
    useGameStore.setState({
      status: 'playing',
      puzzle: { id: 'aic', difficulty: 'extreme', givens: GIVENS, solution: SOLUTION },
      board: createBoard(GIVENS),
      history: createHistory(),
      mistakes: 0,
      hint: null,
      hintStep: 0,
      hintMaxStep: 0,
      hintsUsed: 0,
    });
  }

  it('surfaces a wrong value as a mistake hint; Apply erases it', () => {
    startAicGame();
    // Solution at index 1 is 1 — play a wrong 3 (via the store, counts a mistake).
    useGameStore.setState({ selectedIndex: 1 });
    useGameStore.getState().pressDigit(3);
    expect(useGameStore.getState().mistakes).toBe(1);

    useGameStore.getState().requestHint();
    const hint = useGameStore.getState().hint!;
    expect(hint.technique).toBe('mistake');
    expect(hint.applyLabel).toBe('Remove it');

    useGameStore.getState().applyHint();
    const s = useGameStore.getState();
    expect(s.board[1].value).toBeNull();
    // Erasing via the hint never bumps the mistakes counter again.
    expect(s.mistakes).toBe(1);
  });

  it('restores a missing note via an add_note hint', () => {
    startAicGame();
    useGameStore.getState().fastPencil(); // auto-notes
    const board = useGameStore.getState().board;
    const target = board.findIndex((c) => c.value === null);
    const sol = Number(SOLUTION[target]) as Digit;
    // Remove the solution digit from that cell's notes.
    useGameStore.setState({ selectedIndex: target, pencilMode: true });
    useGameStore.getState().pressDigit(sol);
    expect(useGameStore.getState().board[target].notes.has(sol)).toBe(false);

    useGameStore.getState().requestHint();
    const hint = useGameStore.getState().hint!;
    expect(hint.technique).toBe('missing_note');
    expect(hint.applyLabel).toBe('Add note');

    useGameStore.getState().applyHint();
    expect(useGameStore.getState().board[target].notes.has(sol)).toBe(true);
  });
});
