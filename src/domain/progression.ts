import { DIFFICULTIES, type Difficulty } from './types';

export type DifficultyWins = Partial<Record<Difficulty, number>>;
export const EXPERT_SPEED_SECONDS = 20 * 60;
export interface DifficultyAchievements {
  flawless?: boolean;
  noHints?: boolean;
  quick?: boolean;
  perfect?: boolean;
}
export interface ProgressStats {
  completedByDifficulty: DifficultyWins;
  achievementsByDifficulty?: Partial<Record<Difficulty, DifficultyAchievements>>;
  unlockedDifficulties?: Difficulty[];
}

function challenge(difficulty: Difficulty, stats: ProgressStats) {
  const wins = stats.completedByDifficulty;
  const achievements = stats.achievementsByDifficulty ?? {};
  switch (difficulty) {
    case 'easy': return { label: '', completed: 1, required: 1 };
    case 'medium': return { label: 'Solve one Easy puzzle', completed: Math.min(wins.easy ?? 0, 1), required: 1 };
    case 'hard': return { label: 'Solve Medium with no mistakes', completed: Number(!!achievements.medium?.flawless), required: 1 };
    case 'expert': return { label: 'Solve Hard without hints', completed: Number(!!achievements.hard?.noHints), required: 1 };
    case 'extreme': return {
      label: 'Expert in 20 min or 3 Expert wins',
      completed: achievements.expert?.quick ? 3 : Math.min(wins.expert ?? 0, 3),
      required: 3,
    };
    case 'diabolical': return { label: 'Extreme with no mistakes or hints', completed: Number(!!achievements.extreme?.perfect), required: 1 };
  }
}

export function difficultyProgress(difficulty: Difficulty, stats: ProgressStats) {
  const index = DIFFICULTIES.indexOf(difficulty);
  const prerequisite = index > 0 ? DIFFICULTIES[index - 1] : null;
  let unlocked = true;
  let prerequisiteUnlocked = true;
  for (let i = 1; i <= index; i++) {
    prerequisiteUnlocked = unlocked;
    const goal = challenge(DIFFICULTIES[i], stats);
    unlocked = !!stats.unlockedDifficulties?.includes(DIFFICULTIES[i]) ||
      (unlocked && goal.completed >= goal.required);
  }
  const goal = challenge(difficulty, stats);
  return {
    unlocked,
    prerequisite,
    completed: goal.completed,
    required: goal.required,
    challengeLabel: goal.label,
    requirement: !prerequisiteUnlocked && prerequisite
      ? `Unlock ${prerequisite.charAt(0).toUpperCase() + prerequisite.slice(1)} first. ${goal.label}`
      : goal.label,
  };
}
