import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, type IconName } from '../Icon';

interface ToolProps {
  label: string;
  /** Lucide icon (preferred). */
  iconName?: IconName;
  /** Fallback text glyph for tools without a clean Lucide equivalent (e.g. auto-notes). */
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  /** ON/OFF switch badge — presence also gives the button `switch` semantics. */
  badge?: string;
  /** Informational count badge (e.g. hints used) — keeps plain `button` role. */
  countBadge?: string;
  /** Spoken hint for assistive tech (the icon glyphs are not announced). */
  hint?: string;
  onPress: () => void;
}

function Tool({ label, iconName, icon, active, disabled, badge, countBadge, hint, onPress }: ToolProps) {
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
        {iconName ? (
          <Icon name={iconName} size={26} color={color} />
        ) : (
          <Text style={[styles.icon, { color }]} accessibilityElementsHidden importantForAccessibility="no">
            {icon}
          </Text>
        )}
        {badge !== undefined && (
          <View style={[styles.badge, { backgroundColor: active ? c.primary : c.textMuted }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {countBadge !== undefined && (
          <View style={[styles.badge, { backgroundColor: c.primary }]}>
            <Text style={styles.badgeText}>{countBadge}</Text>
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
  /** False when no supported technique applies — the button is disabled. */
  hintAvailable: boolean;
  /** Hints opened this game (informational badge; hints are unlimited). */
  hintsUsed: number;
  onUndo: () => void;
  onErase: () => void;
  onFastPencil: () => void;
  onTogglePencil: () => void;
  onToggleFastMode: () => void;
  onHint: () => void;
}

export function Controls({
  pencilMode,
  fastMode,
  canUndo,
  hintAvailable,
  hintsUsed,
  onUndo,
  onErase,
  onFastPencil,
  onTogglePencil,
  onToggleFastMode,
  onHint,
}: Props) {
  return (
    <View style={styles.row}>
      <Tool label="Undo" iconName="undo" disabled={!canUndo} hint="Undo the last move" onPress={onUndo} />
      <Tool label="Erase" iconName="erase" hint="Clear the selected cell" onPress={onErase} />
      <Tool
        label="Auto-notes"
        iconName="autoNotes"
        hint="Fill every empty cell with its possible notes"
        onPress={onFastPencil}
      />
      <Tool
        label="Notes"
        iconName="pencil"
        active={pencilMode}
        badge={pencilMode ? 'ON' : 'OFF'}
        hint="Toggle pencil notes for digit entry"
        onPress={onTogglePencil}
      />
      <Tool
        label="Fast"
        iconName="zap"
        active={fastMode}
        badge={fastMode ? 'ON' : 'OFF'}
        hint="Toggle number-first input: pick a digit, then tap cells"
        onPress={onToggleFastMode}
      />
      <Tool
        label="Hint"
        iconName="lightbulb"
        disabled={!hintAvailable}
        countBadge={hintsUsed > 0 ? String(hintsUsed) : undefined}
        hint="Explain the next move step by step"
        onPress={onHint}
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
