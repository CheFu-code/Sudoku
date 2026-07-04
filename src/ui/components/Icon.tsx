import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Lightbulb,
  Pause,
  Pencil,
  PencilSparkles,
  Play,
  Settings,
  Undo2,
  Zap,
  type LucideProps,
} from 'lucide-react-native';

/**
 * Lucide icon wrapper — see the parent `apps/CLAUDE.md` icon convention.
 * Components import `Icon`, never `lucide-react-native` directly.
 */
export const icons = {
  // core vocabulary
  settings: Settings,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  // app-specific extras
  undo: Undo2,
  erase: Eraser,
  pencil: Pencil,
  autoNotes: PencilSparkles,
  zap: Zap,
  lightbulb: Lightbulb,
  play: Play,
  pause: Pause,
} as const;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  ...rest
}: { name: IconName; size?: number } & LucideProps) {
  const Cmp = icons[name];
  return <Cmp size={size} strokeWidth={strokeWidth} {...rest} />;
}
