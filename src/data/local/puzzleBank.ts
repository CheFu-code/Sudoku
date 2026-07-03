/**
 * Loads the bundled puzzle JSON assets into a typed bank. These imports are
 * resolved by Metro at build time, so the puzzles ship inside the app.
 */
import type { Puzzle } from '../../domain/types';
import type { PuzzleBank } from './BundledPuzzleRepository';

import easy from '../../../assets/puzzles/easy.json';
import medium from '../../../assets/puzzles/medium.json';
import hard from '../../../assets/puzzles/hard.json';
import expert from '../../../assets/puzzles/expert.json';
import extreme from '../../../assets/puzzles/extreme.json';
import diabolical from '../../../assets/puzzles/diabolical.json';

export const puzzleBank: PuzzleBank = {
  easy: easy as Puzzle[],
  medium: medium as Puzzle[],
  hard: hard as Puzzle[],
  expert: expert as Puzzle[],
  extreme: extreme as Puzzle[],
  diabolical: diabolical as Puzzle[],
};
