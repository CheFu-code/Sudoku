import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '../../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  difficulty: Difficulty;
  mistakes: number;
  maxMistakes: number;
  elapsed: number;
  paused: boolean;
  /** Hints opened this game (informational badge; hints are unlimited). */
  hintsUsed: number;
  /** False when no supported technique applies — the button is disabled. */
  hintAvailable: boolean;
  onBack: () => void;
  onTogglePause: () => void;
  onHint: () => void;
}

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  extreme: 'Extreme',
  diabolical: 'Diabolical',
};

export function GameHeader({
  difficulty,
  mistakes,
  maxMistakes,
  elapsed,
  paused,
  hintsUsed,
  hintAvailable,
  onBack,
  onTogglePause,
  onHint,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
        >
          <Text style={[styles.back, { color: c.text }]}>←</Text>
        </Pressable>
        <Pressable
          onPress={onHint}
          disabled={!hintAvailable}
          hitSlop={12}
          style={styles.hint}
          accessibilityRole="button"
          accessibilityLabel="Smart hint"
          accessibilityHint="Explain the next move step by step"
          accessibilityState={{ disabled: !hintAvailable }}
        >
          <Text style={[styles.hintIcon, { opacity: hintAvailable ? 1 : 0.35 }]}>💡</Text>
          <Text style={[styles.hintLabel, { color: hintAvailable ? c.primary : c.textMuted }]}>
            Hint
          </Text>
          {hintsUsed > 0 && (
            <View style={[styles.hintBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.hintBadgeText}>{hintsUsed}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.statsRow}>
        <Text
          style={[styles.stat, { color: c.textMuted }]}
          accessibilityLabel={`Mistakes ${mistakes}${maxMistakes > 0 ? ` of ${maxMistakes}` : ''}`}
        >
          Mistakes: {mistakes}
          {maxMistakes > 0 ? `/${maxMistakes}` : ''}
        </Text>
        <Text style={[styles.stat, { color: c.textMuted }]}>{LABELS[difficulty]}</Text>
        <Pressable
          onPress={onTogglePause}
          style={styles.timer}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Time ${formatTime(elapsed)}. ${paused ? 'Paused, tap to resume' : 'Tap to pause'}`}
        >
          <Text style={[styles.stat, { color: c.textMuted }]} accessibilityElementsHidden importantForAccessibility="no">
            {formatTime(elapsed)} {paused ? '▶' : '❚❚'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 26 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { fontSize: 15 },
  timer: { flexDirection: 'row', alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintIcon: { fontSize: 18 },
  hintLabel: { fontSize: 15, fontWeight: '600' },
  hintBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
