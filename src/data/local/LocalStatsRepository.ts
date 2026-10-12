import type { KeyValueStore } from '../kv/KeyValueStore';
import { DIFFICULTIES, type Difficulty } from '../../domain/types';
import { difficultyProgress, EXPERT_SPEED_SECONDS, type ProgressStats } from '../../domain/progression';
import type {
  AggregateStats,
  GameEvent,
  StatsRepository,
} from '../repositories/StatsRepository';

const STATS_KEY = 'stats:aggregate';

/**
 * Records events locally and maintains a small aggregate. The same call sites
 * will later target a backend StatsRepository — only the wiring changes.
 */
export class LocalStatsRepository implements StatsRepository {
  constructor(private readonly kv: KeyValueStore) {}

  recordEvent(event: GameEvent & { at: number }): void {
    if (event.type !== 'game_completed') return;
    const stats = this.getStats();
    stats.gamesCompleted += 1;
    stats.completedByDifficulty[event.difficulty] =
      (stats.completedByDifficulty[event.difficulty] ?? 0) + 1;
    const achievements = stats.achievementsByDifficulty ??= {};
    const earned = achievements[event.difficulty] ??= {};
    if (event.mistakes === 0) earned.flawless = true;
    if (event.hintsUsed === 0) earned.noHints = true;
    if (event.elapsed >= 0 && event.elapsed <= EXPERT_SPEED_SECONDS) earned.quick = true;
    if (event.mistakes === 0 && event.hintsUsed === 0) earned.perfect = true;
    const unlocked = new Set<Difficulty>(stats.unlockedDifficulties ?? ['easy']);
    for (const difficulty of DIFFICULTIES) {
      if (difficultyProgress(difficulty, stats).unlocked) unlocked.add(difficulty);
    }
    stats.unlockedDifficulties = [...unlocked];
    const best = stats.bestTimes[event.difficulty];
    if (best === undefined || event.elapsed < best) {
      stats.bestTimes[event.difficulty] = event.elapsed;
    }
    this.kv.set(STATS_KEY, JSON.stringify(stats));
  }

  getStats(): AggregateStats {
    const raw = this.kv.getString(STATS_KEY);
    const empty: AggregateStats = {
      gamesCompleted: 0, bestTimes: {}, completedByDifficulty: {},
      achievementsByDifficulty: {}, unlockedDifficulties: ['easy'],
    };
    if (!raw) return empty;
    try {
      const parsed = JSON.parse(raw) as Partial<AggregateStats> | null;
      if (!parsed || typeof parsed !== 'object') return empty;
      const bestTimes: AggregateStats['bestTimes'] = {};
      const completedByDifficulty: AggregateStats['completedByDifficulty'] = {};
      const achievementsByDifficulty: ProgressStats['achievementsByDifficulty'] = {};
      for (const difficulty of DIFFICULTIES) {
        const best = parsed.bestTimes?.[difficulty];
        if (typeof best === 'number' && Number.isFinite(best) && best >= 0) {
          bestTimes[difficulty] = best;
        }
        const completed = parsed.completedByDifficulty?.[difficulty];
        if (typeof completed === 'number' && Number.isSafeInteger(completed) && completed >= 0) {
          completedByDifficulty[difficulty] = completed;
        } else if (!parsed.completedByDifficulty && bestTimes[difficulty] !== undefined) {
          // Older aggregates only prove at least one win at this difficulty.
          completedByDifficulty[difficulty] = 1;
        }
        const earned = parsed.achievementsByDifficulty?.[difficulty];
        if (earned && typeof earned === 'object') {
          achievementsByDifficulty[difficulty] = {
            flawless: earned.flawless === true,
            noHints: earned.noHints === true,
            quick: earned.quick === true,
            perfect: earned.perfect === true,
          };
        }
      }
      const unlockedDifficulties = DIFFICULTIES.filter((difficulty) =>
        difficulty === 'easy' || (Array.isArray(parsed.unlockedDifficulties) && parsed.unlockedDifficulties.includes(difficulty)),
      );
      if (parsed.achievementsByDifficulty === undefined) {
        // Preserve levels earned under the previous two-win progression.
        for (let i = 1; i < DIFFICULTIES.length; i++) {
          if (!DIFFICULTIES.slice(0, i).every((level) => (completedByDifficulty[level] ?? 0) >= 2)) break;
          if (!unlockedDifficulties.includes(DIFFICULTIES[i])) unlockedDifficulties.push(DIFFICULTIES[i]);
        }
      }
      return {
        gamesCompleted: typeof parsed.gamesCompleted === 'number' && Number.isSafeInteger(parsed.gamesCompleted) && parsed.gamesCompleted >= 0
          ? parsed.gamesCompleted : 0,
        bestTimes,
        completedByDifficulty,
        achievementsByDifficulty,
        unlockedDifficulties,
      };
    } catch {
      return empty;
    }
  }
}
