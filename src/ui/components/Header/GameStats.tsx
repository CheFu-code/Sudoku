import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '../../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';

interface Props {
  difficulty: Difficulty;
  mistakes: number;
  maxMistakes: number;
  elapsed: number;
  paused: boolean;
  onTogglePause: () => void;
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

/** The Mistakes / Difficulty / Timer strip that sits directly above the grid. */
export function GameStats({
  difficulty,
  mistakes,
  maxMistakes,
  elapsed,
  paused,
  onTogglePause,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  return (
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
        <Text
          style={[styles.stat, { color: c.textMuted }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {formatTime(elapsed)}
        </Text>
        <Icon
          name={paused ? 'play' : 'pause'}
          size={15}
          color={c.textMuted}
          fill={c.textMuted}
          style={styles.timerIcon}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  stat: { fontSize: 15 },
  timer: { flexDirection: 'row', alignItems: 'center' },
  timerIcon: { marginLeft: 6 },
});
