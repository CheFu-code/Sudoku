import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
// import { useGameSounds } from '../../../hooks/useGameSounds';
import { DIGITS } from '../../../domain/types';
import type { Cell as CellModel, CellIndex, Digit } from '../../../domain/types';
import type { CellAnnotation } from '../../../domain/hints';
import { colOf, rowOf } from '../../../domain/board';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  cell: CellModel;
  index: CellIndex;
  selected: boolean;
  inPeer: boolean;
  sameValue: boolean;
  /** The currently active digit — its matching note is emphasized. */
  activeValue: Digit | null;
  /** Fast Mode shows the matching note inside an accent square for visibility. */
  fastMode: boolean;
  mistake: boolean;
  /** Bumps to blink this cell's value red twice (conflict feedback). */
  flashNonce: number;
  /** OS "Reduce Motion" is on — skip the blink, lean on the static marker. */
  reduceMotion: boolean;
  /** Smart Hint annotation: tint / "×" mark / ghost answer for this cell. */
  annotation?: CellAnnotation;
  /** Fixed cell pixel size from the measured board (0 before first layout —
   *  falls back to flex so the first frame still renders). */
  cellSize: number;
  onPress: (index: CellIndex) => void;
}

function CellComponent({
  cell,
  index,
  selected,
  inPeer,
  sameValue,
  activeValue,
  fastMode,
  mistake,
  flashNonce,
  reduceMotion,
  annotation,
  cellSize,
  onPress,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  // const { play } = useGameSounds();

  const r = rowOf(index);
  const col = colOf(index);

  let background = c.surface;
  if (sameValue) background = c.sameValue;
  if (inPeer) background = c.highlight;
  if (selected) background = c.selected;
  if (mistake) background = c.errorBg;
  // Smart Hint tints take precedence so the walkthrough reads cleanly.
  if (annotation?.tint === 'unit') background = c.highlight;
  if (annotation?.tint === 'target') background = c.sameValue;
  if (annotation?.tint === 'focus') background = c.selected;

  // Bold separators between 3x3 boxes.
  const borderStyle = {
    borderTopWidth: r % 3 === 0 ? 2 : StyleSheet.hairlineWidth,
    borderLeftWidth: col % 3 === 0 ? 2 : StyleSheet.hairlineWidth,
    borderRightWidth: col === 8 ? 2 : 0,
    borderBottomWidth: r === 8 ? 2 : 0,
    borderTopColor: r % 3 === 0 ? c.gridLineBold : c.gridLine,
    borderLeftColor: col % 3 === 0 ? c.gridLineBold : c.gridLine,
    borderRightColor: c.gridLineBold,
    borderBottomColor: c.gridLineBold,
  };

  const valueColor =
    selected || annotation?.tint === 'focus'
      ? '#FFFFFF'
      : mistake
        ? c.error
        : cell.given
          ? c.text
          : c.userValue;

  // Blink the value red twice (~1s) when flagged as a conflict culprit. Skipped
  // under Reduce Motion — the corner marker carries the error statically.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (flashNonce === 0 || reduceMotion) return;
    flash.value = withSequence(
      withTiming(1, { duration: 250 }),
      withTiming(0, { duration: 250 }),
      withTiming(1, { duration: 250 }),
      withTiming(0, { duration: 250 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashNonce, reduceMotion]);

  const valueAnim = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [0, 1], [valueColor, c.error]),
  }));

  const pressScale = useSharedValue(1);
  useEffect(() => {
    pressScale.value = withTiming(selected ? 0.98 : 1, { duration: 120 });
  }, [pressScale, selected]);

  const pressAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // useEffect(() => {
  //   if (!selected) return;
  //   Haptics.selectionAsync().catch(() => {});
  //   void play('tap');
  // }, [play, selected]);

  const a11yLabel = buildLabel(r, col, cell, mistake);

  // Fixed integer size keeps columns aligned across rows; flex is only the
  // first-frame fallback before the board has been measured.
  const sizeStyle = cellSize > 0 ? { width: cellSize, height: cellSize } : styles.cellFlex;

  // Digit / note glyphs scale with the measured cell so they fill it legibly on
  // any screen width. Before the first layout (cellSize 0) we keep the static
  // fallbacks in the StyleSheet. Only recomputes when cellSize changes.
  const fontSizes = useMemo(
    () =>
      cellSize > 0
        ? {
            value: Math.round(cellSize * 0.72),
            cross: Math.round(cellSize * 0.5),
            // Notes share a 3×3 grid, so each slot is only ~cellSize/3. Keep the
            // note ~+15% over the old fixed 9px, and the boxed (highlighted) note
            // a hair smaller so it sits inside its badge without clipping.
            note: Math.round(cellSize * 0.26),
            noteBadge: Math.round(cellSize * 0.24),
          }
        : null,
    [cellSize],
  );

  return (
    <Pressable
      onPress={() => onPress(index)}
      onPressIn={() => {
        pressScale.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(selected ? 0.98 : 1, { duration: 100 });
      }}
      style={[styles.cell, sizeStyle, { backgroundColor: background }, borderStyle]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, disabled: cell.given }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, pressAnim, { overflow: 'hidden' }]} />
      {mistake && (
        <View
          style={[styles.errorFlag, { borderTopColor: c.error }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
      {annotation?.cross && cell.value === null ? (
        <Text
          style={[styles.cross, fontSizes && { fontSize: fontSizes.cross }, { color: c.textMuted }]}
          accessibilityLabel="cannot place here"
        >
          ×
        </Text>
      ) : annotation?.ghost && cell.value === null ? (
        <Text
          style={[styles.value, styles.ghost, fontSizes && { fontSize: fontSizes.value }, { color: c.primary }]}
          accessibilityLabel={`answer ${annotation.ghost}`}
        >
          {annotation.ghost}
        </Text>
      ) : cell.value !== null ? (
        <Animated.Text style={[styles.value, fontSizes && { fontSize: fontSizes.value }, valueAnim]}>
          {cell.value}
        </Animated.Text>
      ) : cell.notes.size > 0 ||
        (annotation?.strikeNotes?.length ?? 0) > 0 ||
        (annotation?.highlightNotes?.length ?? 0) > 0 ? (
        <View style={styles.notes}>
          {DIGITS.map((d) => {
            const has = cell.notes.has(d);
            const activeNote = has && d === activeValue;
            // Smart Hint candidate-level emphasis (only set during a hint).
            // Annotated candidates render even when unpenciled — as faint
            // ghosts — so a no-notes player can still follow the walkthrough.
            const struck = !!annotation?.strikeNotes?.includes(d);
            const highlit = !!annotation?.highlightNotes?.includes(d);
            // Fast Mode's active note and a hint's highlighted candidate both
            // read as a blue mini-box with a white digit (struck/eliminated notes
            // keep their red strike-through instead).
            const badge = ((fastMode && activeNote) || highlit) && !struck;
            return (
              <View key={d} style={styles.noteSlot}>
                {badge ? (
                  <View style={[styles.noteBadge, { backgroundColor: c.primary }]}>
                    <Text style={[styles.noteBadgeText, fontSizes && { fontSize: fontSizes.noteBadge }]}>
                      {d}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.note,
                      fontSizes && { fontSize: fontSizes.note },
                      activeNote && styles.noteActive,
                      struck && styles.noteStruck,
                      {
                        color: struck
                          ? c.error
                          : selected || annotation?.tint === 'focus'
                            ? 'rgba(255,255,255,0.85)'
                            : c.note,
                        opacity: has ? 1 : struck ? 0.55 : 0,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}

function buildLabel(r: number, col: number, cell: CellModel, mistake: boolean): string {
  const where = `Row ${r + 1}, column ${col + 1}`;
  if (cell.value !== null) {
    const kind = cell.given ? 'given' : mistake ? 'mistake' : 'entered';
    return `${where}, ${cell.value}, ${kind}`;
  }
  if (cell.notes.size > 0) {
    return `${where}, notes ${[...cell.notes].sort().join(' ')}`;
  }
  return `${where}, empty`;
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFlex: {
    flex: 1,
    aspectRatio: 1,
  },
  // Right triangle hugging the top-left corner — a shape/position cue for a
  // mistake that does not depend on color.
  errorFlag: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderRightWidth: 9,
    borderRightColor: 'transparent',
  },
  value: { fontSize: 26, fontWeight: '400' },
  ghost: { opacity: 0.45 },
  cross: { fontSize: 22, fontWeight: '500' },
  notes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
    padding: 1,
  },
  noteSlot: {
    width: '33.33%',
    height: '33.33%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 9, textAlign: 'center' },
  noteActive: { fontWeight: '800' },
  noteStruck: { fontWeight: '800', textDecorationLine: 'line-through' },
  noteBadge: {
    width: '96%',
    aspectRatio: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', includeFontPadding: false },
});

export const Cell = React.memo(CellComponent);
