/**
 * Progressive-disclosure presentation — pure TypeScript, no framework imports.
 *
 * Composes a staged frame sequence from a raw `Hint`:
 *   1. 'what'    — the technique name + novice definition, board untouched;
 *   2. 'where'   — the pattern cells focus-tinted, digits not yet revealed;
 *   3. 'explain' — generic teaching steps, then the concrete walkthrough.
 * The store/UI page through `frames` with a single linear index.
 */

import type { CellIndex } from '../types';
import type { CellAnnotation, ChainLink, Hint, HintAction, TechniqueId, TextSegment } from './types';
import { locateHint } from './locate';
import { TECHNIQUE_CATALOG } from './techniqueCatalog';

export type HintStage = 'what' | 'where' | 'explain';

export interface HintFrame {
  stage: HintStage;
  text: TextSegment[];
  annotations: Record<CellIndex, CellAnnotation>;
  links?: ChainLink[];
}

export interface HintPresentation {
  technique: TechniqueId;
  title: string;
  frames: HintFrame[];
  /** Index of the first 'explain' frame — the step-dot indicator spans from here. */
  firstExplainIndex: number;
  action: HintAction;
  /** Label for the final frame's primary button ("Apply" family). */
  applyLabel: string;
}

const APPLY_LABELS: Partial<Record<HintAction['kind'], string>> = {
  erase: 'Remove it',
  add_note: 'Add note',
};

export function buildHintPresentation(hint: Hint): HintPresentation {
  const lesson = TECHNIQUE_CATALOG[hint.technique];
  const locus = locateHint(hint);

  const focusAnnotations: Record<CellIndex, CellAnnotation> = {};
  for (const cell of locus.cells) focusAnnotations[cell] = { tint: 'focus' };

  const frames: HintFrame[] = [
    // An empty (but defined) annotation record keeps the board in hint mode
    // (normal selection tints suppressed) while showing it clean.
    { stage: 'what', text: lesson.whatItIs, annotations: {} },
    { stage: 'where', text: locus.text, annotations: focusAnnotations },
    ...lesson.howItWorks.map(
      (text): HintFrame => ({ stage: 'explain', text, annotations: focusAnnotations }),
    ),
    ...hint.steps.map(
      (step): HintFrame => ({
        stage: 'explain',
        text: step.text,
        annotations: step.annotations,
        links: step.links,
      }),
    ),
  ];

  return {
    technique: hint.technique,
    title: hint.title,
    frames,
    firstExplainIndex: 2,
    action: hint.action,
    applyLabel: APPLY_LABELS[hint.action.kind] ?? 'Apply',
  };
}
