import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIFFICULTIES } from '../../domain/types';
import type { Difficulty } from '../../domain/types';
import { useGameStore } from '../../state/gameStore';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { SudokuMark } from '../components/Logo/SudokuMark';

const LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  extreme: 'Extreme',
  diabolical: 'Diabolical',
};

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HomeScreen() {
  const router = useRouter();
  const c = useTheme().colors;
  const reduceMotion = useReduceMotion();
  const newGame = useGameStore((s) => s.newGame);
  const resumeSavedGame = useGameStore((s) => s.resumeSavedGame);
  const savedGameInfo = useGameStore((s) => s.savedGameInfo);
  const insets = useSafeAreaInsets();

  const saved = savedGameInfo();

  const start = (d: Difficulty) => {
    newGame(d);
    router.push('/game');
  };

  const resume = () => {
    if (resumeSavedGame()) router.push('/game');
  };

  // Quiet first-appearance only — a gentle fade-up, staggered down the column.
  // Nothing animates on tap (calm by default, feedback by exception).
  let step = 0;
  const entering = () => (reduceMotion ? undefined : FadeInDown.duration(240).delay(step++ * 50));

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={styles.gear}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Text style={[styles.gearIcon, { color: c.textMuted }]}>⚙</Text>
        </Pressable>
      </View>

      <Animated.View entering={entering()} style={styles.logo}>
        <SudokuMark size={88} />
      </Animated.View>

      <Animated.Text entering={entering()} style={[styles.title, { color: c.text }]}>
        Sudoku
      </Animated.Text>

      {saved && (
        <Animated.View entering={entering()}>
          <Pressable
            onPress={resume}
            style={[styles.resume, { backgroundColor: c.primary }]}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${LABELS[saved.difficulty]} game at ${formatTime(saved.elapsed)}`}
          >
            <Text style={styles.resumeLabel}>Continue</Text>
            <Text style={styles.resumeMeta}>
              {LABELS[saved.difficulty]} · {formatTime(saved.elapsed)}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      <Animated.Text entering={entering()} style={[styles.section, { color: c.textMuted }]}>
        New game
      </Animated.Text>

      <View style={styles.list}>
        {DIFFICULTIES.map((d) => (
          <Animated.View key={d} entering={entering()}>
            <Pressable
              onPress={() => start(d)}
              style={[styles.diffButton, { backgroundColor: c.surface, borderColor: c.gridLine }]}
              accessibilityRole="button"
              accessibilityLabel={`New ${LABELS[d]} game`}
            >
              <Text style={[styles.diffText, { color: c.text }]}>{LABELS[d]}</Text>
              <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 44 },
  gear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  gearIcon: { fontSize: 22 },
  logo: { alignItems: 'center', marginTop: 24 },
  title: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  resume: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  resumeLabel: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  resumeMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 8 },
  list: { gap: 10 },
  diffButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  diffText: { fontSize: 18, fontWeight: '600' },
  chevron: { fontSize: 22 },
});
