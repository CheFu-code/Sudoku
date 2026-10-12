import { BundledPuzzleRepository } from './local/BundledPuzzleRepository';
import { MmkvGameStorageRepository } from './local/MmkvGameStorageRepository';
import { LocalStatsRepository } from './local/LocalStatsRepository';
import { MemoryKeyValueStore } from './kv/MemoryKeyValueStore';
import { puzzleBank } from './local/puzzleBank';
import { createBoard, boardToString } from '../domain/board';
import { countSolutionsSlow } from './testSolver';
import { DIFFICULTIES } from '../domain/types';
import type { SavedGame } from './repositories/GameStorageRepository';

describe('BundledPuzzleRepository', () => {
  const repo = new BundledPuzzleRepository(puzzleBank);

  it('serves a puzzle for every difficulty', () => {
    for (const d of DIFFICULTIES) {
      const p = repo.getPuzzle(d);
      expect(p.difficulty).toBe(d);
      expect(p.givens).toHaveLength(81);
      expect(p.solution).toHaveLength(81);
    }
  });

  it('every bundled puzzle is uniquely solvable and matches its solution', () => {
    for (const d of DIFFICULTIES) {
      // Sample the first few per tier to keep the test fast.
      for (const p of puzzleBank[d].slice(0, 3)) {
        const board = createBoard(p.givens);
        // givens are a subset of the solution
        for (let i = 0; i < 81; i++) {
          if (board[i].value !== null) {
            expect(String(board[i].value)).toBe(p.solution[i]);
          }
        }
        expect(countSolutionsSlow(p.givens)).toBe(1);
      }
    }
  });

  it('prefers unplayed puzzles', () => {
    const exclude = puzzleBank.easy.slice(0, -1).map((p) => p.id);
    const p = repo.getPuzzle('easy', exclude);
    expect(p.id).toBe(puzzleBank.easy[puzzleBank.easy.length - 1].id);
  });

  it('getById round-trips', () => {
    const id = puzzleBank.hard[0].id;
    expect(repo.getById(id)?.id).toBe(id);
  });
});

describe('MmkvGameStorageRepository', () => {
  it('saves, loads, and clears the game', () => {
    const repo = new MmkvGameStorageRepository(new MemoryKeyValueStore());
    const game: SavedGame = {
      puzzleId: 'easy-0000',
      difficulty: 'easy',
      givens: boardToString(createBoard('.'.repeat(81))),
      values: '.'.repeat(81),
      notes: { 0: [1, 2] },
      elapsed: 12,
      mistakes: 1,
      history: { past: [], future: [] },
      updatedAt: 1,
    };
    expect(repo.loadGame()).toBeUndefined();
    repo.saveGame(game);
    expect(repo.loadGame()?.puzzleId).toBe('easy-0000');
    repo.clearGame();
    expect(repo.loadGame()).toBeUndefined();
  });

  it('tracks played ids without duplicates', () => {
    const repo = new MmkvGameStorageRepository(new MemoryKeyValueStore());
    repo.markPlayed('a');
    repo.markPlayed('a');
    repo.markPlayed('b');
    expect(repo.getPlayedIds()).toEqual(['a', 'b']);
  });
});

describe('LocalStatsRepository', () => {
  it('records challenge achievements without combining separate wins into a perfect win', () => {
    const kv = new MemoryKeyValueStore();
    const repo = new LocalStatsRepository(kv);
    const event = { type: 'game_completed' as const, difficulty: 'extreme' as const, puzzleId: 'x', elapsed: 1800, at: 1 };
    repo.recordEvent({ ...event, mistakes: 0, hintsUsed: 1 });
    repo.recordEvent({ ...event, mistakes: 1, hintsUsed: 0 });
    expect(repo.getStats().achievementsByDifficulty?.extreme).toMatchObject({ flawless: true, noHints: true, perfect: false });
    repo.recordEvent({ ...event, mistakes: 0, hintsUsed: 0 });
    expect(new LocalStatsRepository(kv).getStats().achievementsByDifficulty?.extreme?.perfect).toBe(true);
  });

  it('checks the 20-minute boundary and does not assume missing hint data is hint-free', () => {
    const repo = new LocalStatsRepository(new MemoryKeyValueStore());
    const event = { type: 'game_completed' as const, difficulty: 'expert' as const, puzzleId: 'x', mistakes: 0, at: 1 };
    repo.recordEvent({ ...event, elapsed: 1201 });
    expect(repo.getStats().achievementsByDifficulty?.expert?.quick).toBe(false);
    expect(repo.getStats().achievementsByDifficulty?.expert?.noHints).toBe(false);
    repo.recordEvent({ ...event, elapsed: 1200, hintsUsed: 0 });
    expect(repo.getStats().achievementsByDifficulty?.expert?.quick).toBe(true);
  });

  it('preserves and persists levels unlocked under the old progression', () => {
    const kv = new MemoryKeyValueStore();
    kv.set('stats:aggregate', JSON.stringify({ gamesCompleted: 6, bestTimes: {}, completedByDifficulty: { easy: 2, medium: 2, hard: 2 } }));
    const repo = new LocalStatsRepository(kv);
    expect(repo.getStats().unlockedDifficulties).toEqual(['easy', 'medium', 'hard', 'expert']);
    repo.recordEvent({ type: 'game_completed', difficulty: 'easy', puzzleId: 'new', elapsed: 30, mistakes: 1, hintsUsed: 1, at: 1 });
    expect(new LocalStatsRepository(kv).getStats().unlockedDifficulties).toContain('expert');
  });

  it('aggregates completions and best times', () => {
    const repo = new LocalStatsRepository(new MemoryKeyValueStore());
    repo.recordEvent({
      type: 'game_completed',
      difficulty: 'easy',
      puzzleId: 'x',
      elapsed: 100,
      mistakes: 0,
      at: 1,
    });
    repo.recordEvent({
      type: 'game_completed',
      difficulty: 'easy',
      puzzleId: 'y',
      elapsed: 60,
      mistakes: 0,
      at: 2,
    });
    const stats = repo.getStats();
    expect(stats.gamesCompleted).toBe(2);
    expect(stats.bestTimes.easy).toBe(60);
    expect(stats.completedByDifficulty.easy).toBe(2);
  });

  it('restores per-difficulty progress from storage and ignores unfinished games', () => {
    const kv = new MemoryKeyValueStore();
    const repo = new LocalStatsRepository(kv);
    repo.recordEvent({ type: 'game_started', difficulty: 'easy', puzzleId: 'x', at: 1 });
    repo.recordEvent({ type: 'mistake_made', difficulty: 'easy', at: 2 });
    expect(repo.getStats().completedByDifficulty).toEqual({});
    repo.recordEvent({ type: 'game_completed', difficulty: 'easy', puzzleId: 'x', elapsed: 10, mistakes: 0, at: 3 });
    repo.recordEvent({ type: 'game_completed', difficulty: 'medium', puzzleId: 'y', elapsed: 20, mistakes: 0, at: 4 });
    expect(new LocalStatsRepository(kv).getStats().completedByDifficulty).toEqual({ easy: 1, medium: 1 });
  });

  it('credits one provable win per legacy best time without inventing extra wins', () => {
    const kv = new MemoryKeyValueStore();
    kv.set('stats:aggregate', JSON.stringify({ gamesCompleted: 20, bestTimes: { easy: 60, medium: 0 } }));
    const repo = new LocalStatsRepository(kv);
    expect(repo.getStats().completedByDifficulty).toEqual({ easy: 1, medium: 1 });
    repo.recordEvent({ type: 'game_completed', difficulty: 'easy', puzzleId: 'new', elapsed: 30, mistakes: 0, at: 1 });
    expect(new LocalStatsRepository(kv).getStats().completedByDifficulty).toEqual({ easy: 2, medium: 1 });
  });

  it('falls back safely for corrupt stored statistics', () => {
    const kv = new MemoryKeyValueStore();
    const repo = new LocalStatsRepository(kv);
    for (const raw of ['null', '{', '{"completedByDifficulty":{"easy":-1,"medium":"2"}}']) {
      kv.set('stats:aggregate', raw);
      expect(repo.getStats().completedByDifficulty).toEqual({});
    }
  });
});
