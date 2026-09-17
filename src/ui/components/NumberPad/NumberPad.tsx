import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useGameSounds } from '../../../hooks/useGameSounds';
import { DIGITS } from '../../../domain/types';
import type { Digit } from '../../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  remaining: Record<Digit, number>;
  activeDigit: Digit | null;
  /** Transient signal of a rejected pencil note: the digit flickers red. */
  invalidFlash: { digit: Digit; nonce: number } | null;
  /** OS "Reduce Motion" is on — skip the rejection flicker. */
  reduceMotion: boolean;
  onPress: (digit: Digit) => void;
}

export function NumberPad({ remaining, activeDigit, invalidFlash, reduceMotion, onPress }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const { play } = useGameSounds();

  // Haptic feedback fires once per rejected attempt.
  useEffect(() => {
    if (!invalidFlash) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidFlash?.nonce]);

  return (
    <View style={styles.row}>
      {DIGITS.map((d) => {
        const done = remaining[d] === 0;
        const active = activeDigit === d;
        const normalColor = active ? c.primary : done ? c.textMuted : c.text;
        return (
          <Pressable
            key={d}
            disabled={done}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              void play('tap');
              onPress(d);
            }}
            style={[
              styles.button,
              active && { backgroundColor: c.surface, borderColor: c.primary },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: done }}
            accessibilityLabel={
              done ? `${d}, all placed` : `${d}, ${remaining[d]} remaining`
            }
          >
            <FlickerDigit
              digit={d}
              normalColor={normalColor}
              errorColor={c.error}
              done={done}
              flash={invalidFlash}
              reduceMotion={reduceMotion}
            />
            {!done && (
              <Text style={[styles.count, { color: c.textMuted }]}>{remaining[d]}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

interface FlickerProps {
  digit: Digit;
  normalColor: string;
  errorColor: string;
  done: boolean;
  flash: { digit: Digit; nonce: number } | null;
  reduceMotion: boolean;
}

function FlickerDigit({ digit, normalColor, errorColor, done, flash, reduceMotion }: FlickerProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!flash || flash.digit !== digit || reduceMotion) return;
    progress.value = withSequence(
      withTiming(1, { duration: 110 }),
      withTiming(0, { duration: 110 }),
      withTiming(1, { duration: 110 }),
      withTiming(0, { duration: 110 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.nonce, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [normalColor, errorColor]),
  }));

  return (
    <Animated.Text style={[styles.digit, animStyle, done && styles.faded]}>
      {digit}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 58,
    marginHorizontal: 2,
    borderRadius: 10,
    // Reserve the highlight border on every button so selecting one doesn't
    // shift the row's layout — only its color turns visible when active.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  digit: { fontSize: 40, fontWeight: '400' },
  faded: { opacity: 0.35 },
  count: { fontSize: 14, marginTop: -2 },
});
