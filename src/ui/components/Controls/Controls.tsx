import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface ToolProps {
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  /** Spoken hint for assistive tech (the icon glyphs are not announced). */
  hint?: string;
  onPress: () => void;
}

function Tool({ label, icon, active, disabled, badge, hint, onPress }: ToolProps) {
  const theme = useTheme();
  const c = theme.colors;
  const color = active ? c.primary : disabled ? c.textMuted : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.tool}
      accessibilityRole={badge !== undefined ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, checked: badge !== undefined ? !!active : undefined }}
    >
      <View>
        <Text style={[styles.icon, { color }]} accessibilityElementsHidden importantForAccessibility="no">
          {icon}
        </Text>
        {badge !== undefined && (
          <View style={[styles.badge, { backgroundColor: active ? c.primary : c.textMuted }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

interface Props {
  pencilMode: boolean;
  fastMode: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onErase: () => void;
  onFastPencil: () => void;
  onTogglePencil: () => void;
  onToggleFastMode: () => void;
}

export function Controls({
  pencilMode,
  fastMode,
  canUndo,
  onUndo,
  onErase,
  onFastPencil,
  onTogglePencil,
  onToggleFastMode,
}: Props) {
  return (
    <View style={styles.row}>
      <Tool label="Undo" icon="↶" disabled={!canUndo} hint="Undo the last move" onPress={onUndo} />
      <Tool label="Erase" icon="⌫" hint="Clear the selected cell" onPress={onErase} />
      <Tool
        label="Auto-notes"
        icon="✏︎⚡"
        hint="Fill every empty cell with its possible notes"
        onPress={onFastPencil}
      />
      <Tool
        label="Notes"
        icon="✏︎"
        active={pencilMode}
        badge={pencilMode ? 'ON' : 'OFF'}
        hint="Toggle pencil notes for digit entry"
        onPress={onTogglePencil}
      />
      <Tool
        label="Fast"
        icon="⚡"
        active={fastMode}
        badge={fastMode ? 'ON' : 'OFF'}
        hint="Toggle number-first input: pick a digit, then tap cells"
        onPress={onToggleFastMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  tool: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 56, minHeight: 56 },
  icon: { fontSize: 26 },
  label: { fontSize: 13 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -16,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});
