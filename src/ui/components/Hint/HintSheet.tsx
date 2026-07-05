import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import type { HintPresentation } from '../../../domain/hints';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  hint: HintPresentation;
  step: number;
  reduceMotion: boolean;
  onNext: () => void;
  onPrev: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * The Smart Hint walkthrough sheet: a bottom card that discloses one solving
 * technique progressively — first only the technique ('what'), then its cells
 * ('where'), then the full teaching walkthrough ('explain'). Each frame drives
 * the board annotations (passed separately to <Board hintAnnotations>). The
 * last frame ends with "Apply".
 */
export function HintSheet({ hint, step, reduceMotion, onNext, onPrev, onApply, onClose }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  const isLast = step >= hint.frames.length - 1;
  const current = hint.frames[step];

  const primary =
    current.stage === 'what'
      ? { label: 'Show me where', a11y: 'Show where on the board', onPress: onNext }
      : current.stage === 'where'
        ? { label: 'Explain how', a11y: 'Explain the technique', onPress: onNext }
        : isLast
          ? { label: hint.applyLabel, a11y: 'Apply this move', onPress: onApply }
          : { label: 'Next', a11y: 'Next step', onPress: onNext };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : SlideInDown.duration(220)}
      style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.gridLine }]}
      accessibilityViewIsModal
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{hint.title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close hint"
        >
          <Text style={[styles.close, { color: c.textMuted }]}>×</Text>
        </Pressable>
      </View>

      <Text style={[styles.body, { color: c.textMuted }]} accessibilityLiveRegion="polite">
        {current.text.map((seg, i) => (
          <Text
            key={i}
            style={seg.emphasis ? [styles.emphasis, { color: c.primary }] : undefined}
          >
            {seg.text}
          </Text>
        ))}
      </Text>

      {current.stage === 'explain' && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
          {hint.frames.slice(hint.firstExplainIndex).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === step - hint.firstExplainIndex ? c.primary : c.gridLine,
                },
                i === step - hint.firstExplainIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable
            onPress={onPrev}
            style={[styles.back, { backgroundColor: c.highlight }]}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
          >
            <Text style={[styles.backText, { color: c.primary }]}>‹</Text>
          </Pressable>
        )}
        <Pressable
          onPress={primary.onPress}
          style={[styles.primary, { backgroundColor: c.primary }]}
          accessibilityRole="button"
          accessibilityLabel={primary.a11y}
        >
          <Text style={styles.primaryText}>{primary.label}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', flex: 1 },
  close: { fontSize: 28, lineHeight: 28, paddingHorizontal: 4 },
  body: { fontSize: 18, lineHeight: 26 },
  emphasis: { fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 56,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 26, fontWeight: '700', lineHeight: 28 },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
