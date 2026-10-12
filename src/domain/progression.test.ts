import { difficultyProgress } from './progression';
import type { ProgressStats } from './progression';
import { DIFFICULTIES } from './types';

const stats = (patch: Partial<ProgressStats> = {}): ProgressStats => ({ completedByDifficulty: {}, ...patch });

describe('difficulty progression challenges', () => {
  it('starts with Easy and unlocks Medium after one Easy completion', () => {
    expect(DIFFICULTIES.filter((level) => difficultyProgress(level, stats()).unlocked)).toEqual(['easy']);
    expect(difficultyProgress('medium', stats({ completedByDifficulty: { easy: 1 } })).unlocked).toBe(true);
  });

  it('requires a flawless Medium and a hint-free Hard, while enforcing the ladder', () => {
    const progress = stats({ completedByDifficulty: { easy: 1, medium: 10, hard: 10 } });
    expect(difficultyProgress('hard', progress).unlocked).toBe(false);
    progress.achievementsByDifficulty = { medium: { flawless: true }, hard: { noHints: true } };
    expect(difficultyProgress('expert', progress).unlocked).toBe(true);
    progress.completedByDifficulty.easy = 0;
    expect(difficultyProgress('expert', progress).unlocked).toBe(false);
    expect(difficultyProgress('expert', progress).requirement).toContain('Unlock Hard first');
  });

  it('offers speed or three completions as alternative paths to Extreme', () => {
    const progress = stats({ completedByDifficulty: { expert: 2 }, unlockedDifficulties: ['expert'] });
    expect(difficultyProgress('extreme', progress)).toMatchObject({ unlocked: false, completed: 2, required: 3 });
    progress.achievementsByDifficulty = { expert: { quick: true } };
    expect(difficultyProgress('extreme', progress).unlocked).toBe(true);
    progress.achievementsByDifficulty = {};
    progress.completedByDifficulty.expert = 3;
    expect(difficultyProgress('extreme', progress).unlocked).toBe(true);
  });

  it('requires a single Extreme win with neither mistakes nor hints for Diabolical', () => {
    const progress = stats({ unlockedDifficulties: ['extreme'], achievementsByDifficulty: { extreme: { flawless: true, noHints: true } } });
    expect(difficultyProgress('diabolical', progress).unlocked).toBe(false);
    progress.achievementsByDifficulty!.extreme!.perfect = true;
    expect(difficultyProgress('diabolical', progress).unlocked).toBe(true);
  });

  it('keeps already-earned unlocks open', () => {
    const progress = stats({ unlockedDifficulties: DIFFICULTIES });
    for (const level of DIFFICULTIES) expect(difficultyProgress(level, progress).unlocked).toBe(true);
  });
});
