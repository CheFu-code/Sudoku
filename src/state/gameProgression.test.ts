import { getRepositories } from '../data';
import { LocalStatsRepository } from '../data/local/LocalStatsRepository';
import { MmkvGameStorageRepository } from '../data/local/MmkvGameStorageRepository';
import { MemoryKeyValueStore } from '../data/kv/MemoryKeyValueStore';
import { useGameStore } from './gameStore';
import { useSettingsStore } from './settingsStore';
import type { Difficulty } from '../domain/types';

jest.mock('../data', () => ({ getRepositories: jest.fn() }));
jest.mock('./persist', () => ({
  mmkvStateStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const GIVENS = '.' + SOLUTION.slice(1);

function setup() {
  const kv = new MemoryKeyValueStore();
  const stats = new LocalStatsRepository(kv);
  const games = new MmkvGameStorageRepository(kv);
  const getPuzzle = jest.fn((difficulty: Difficulty) => ({ id: `test-${difficulty}`, difficulty, givens: GIVENS, solution: SOLUTION }));
  (getRepositories as jest.Mock).mockReturnValue({
    stats, games, puzzles: { getPuzzle, getById: (id: string) => getPuzzle(id.slice(5) as Difficulty) },
  });
  useGameStore.setState(useGameStore.getInitialState(), true);
  useSettingsStore.setState({ fastModeDefault: false, maxMistakes: 3 });
  return { kv, stats, games, getPuzzle };
}

function winPuzzle(difficulty: Difficulty, useHint = false) {
  expect(useGameStore.getState().newGame(difficulty)).toBe(true);
  if (useHint) {
    useGameStore.getState().requestHint();
    useGameStore.getState().applyHint();
  } else {
    useGameStore.getState().selectCell(0);
    useGameStore.getState().pressDigit(5);
  }
  expect(useGameStore.getState().status).toBe('won');
}

const winEasy = (useHint = false) => winPuzzle('easy', useHint);

describe('game progression enforcement', () => {
  it('blocks a locked game without replacing a saved game or selecting a puzzle', () => {
    const { games, getPuzzle } = setup();
    useGameStore.getState().newGame('easy');
    const saved = games.loadGame();
    const active = useGameStore.getState().puzzle;
    expect(useGameStore.getState().newGame('medium')).toBe(false);
    expect(getPuzzle).toHaveBeenCalledTimes(1);
    expect(games.loadGame()).toEqual(saved);
    expect(useGameStore.getState().puzzle).toBe(active);
  });

  it('opens Medium after one win and tracks manual and hint-assisted results', () => {
    const { stats, kv, games } = setup();
    winEasy();
    expect(stats.getStats().completedByDifficulty.easy).toBe(1);
    expect(useGameStore.getState().newGame('medium')).toBe(true);
    winEasy(true);
    expect(stats.getStats().completedByDifficulty.easy).toBe(2);
    expect(games.loadGame()).toBeUndefined();
    expect(new LocalStatsRepository(kv).getStats().completedByDifficulty.easy).toBe(2);
    expect(useGameStore.getState().newGame('medium')).toBe(true);
    expect(useGameStore.getState().newGame('hard')).toBe(false);
  });

  it('opens Hard after a flawless Medium, but Expert needs a hint-free Hard', () => {
    const { stats } = setup();
    winEasy();
    winPuzzle('medium');
    expect(stats.getStats().achievementsByDifficulty?.medium?.flawless).toBe(true);
    winPuzzle('hard', true);
    expect(useGameStore.getState().newGame('expert')).toBe(false);
    winPuzzle('hard');
    expect(useGameStore.getState().newGame('expert')).toBe(true);
  });

  it('preserves hint use across resuming a game, so resuming cannot bypass a challenge', () => {
    setup();
    winEasy();
    winPuzzle('medium');
    useGameStore.getState().newGame('hard');
    useGameStore.getState().requestHint();
    expect(useGameStore.getState().resumeSavedGame()).toBe(true);
    expect(useGameStore.getState().hintsUsed).toBe(1);
    useGameStore.getState().selectCell(0);
    useGameStore.getState().pressDigit(5);
    expect(useGameStore.getState().status).toBe('won');
    expect(useGameStore.getState().newGame('expert')).toBe(false);
  });

  it('does not allow completed games to be edited and counted again', () => {
    const { stats, games } = setup();
    winEasy();
    const store = useGameStore.getState();
    store.undo();
    store.erase();
    store.pressDigit(5);
    store.requestHint();
    store.applyHint();
    expect(useGameStore.getState().status).toBe('won');
    expect(stats.getStats().completedByDifficulty.easy).toBe(1);
    expect(games.loadGame()).toBeUndefined();
  });

  it('does not award progress for losses or restarts', () => {
    const { stats } = setup();
    useSettingsStore.setState({ maxMistakes: 1 });
    useGameStore.getState().newGame('easy');
    useGameStore.getState().selectCell(0);
    useGameStore.getState().pressDigit(1);
    expect(useGameStore.getState().status).toBe('lost');
    useGameStore.getState().restartGame();
    expect(stats.getStats().completedByDifficulty).toEqual({});
  });

  it('keeps a pre-existing higher-difficulty saved game resumable', () => {
    const { stats } = setup();
    stats.recordEvent({ type: 'game_completed', difficulty: 'easy', puzzleId: 'a', elapsed: 1, mistakes: 0, at: 1 });
    stats.recordEvent({ type: 'game_completed', difficulty: 'easy', puzzleId: 'b', elapsed: 1, mistakes: 0, at: 2 });
    useGameStore.getState().newGame('medium');
    (getRepositories as jest.Mock).mockReturnValue({ ...getRepositories(), stats: new LocalStatsRepository(new MemoryKeyValueStore()) });
    expect(useGameStore.getState().resumeSavedGame()).toBe(true);
    expect(useGameStore.getState().difficulty).toBe('medium');
  });
});
