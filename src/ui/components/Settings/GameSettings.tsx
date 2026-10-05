import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../../../state/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';

const MISTAKE_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 0, label: 'Off' },
];


export function GameSettings() {
  const theme = useTheme();
  const c = theme.colors;
  const fastModeDefault = useSettingsStore((s) => s.fastModeDefault);
  const validateNotes = useSettingsStore((s) => s.validateNotes);
  const maxMistakes = useSettingsStore((s) => s.maxMistakes);
  const setFastModeDefault = useSettingsStore((s) => s.setFastModeDefault);
  const setValidateNotes = useSettingsStore((s) => s.setValidateNotes);
  const setMaxMistakes = useSettingsStore((s) => s.setMaxMistakes);

  const trackColor = { true: c.primary, false: c.gridLine };

  return (
    <View style={styles.container}>
      <Text style={[styles.section, { color: c.textMuted }]}>Game</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.gridLine }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: c.text }]}>Mistake limit</Text>
          <View style={styles.segment}>
            {MISTAKE_OPTIONS.map((opt) => {
              const active = maxMistakes === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setMaxMistakes(opt.value)}
                  style={[
                    styles.segmentItem,
                    { borderColor: active ? c.primary : c.gridLine },
                    active && { backgroundColor: c.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Mistake limit ${opt.label}`}
                >
                  <Text
                    style={[styles.segmentText, { color: active ? '#FFF' : c.textMuted }]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.gridLine }]} />

        <View style={styles.row}>
          <Text style={[styles.label, { color: c.text }]}>Block illegal notes</Text>
          <Switch
            value={validateNotes}
            onValueChange={setValidateNotes}
            trackColor={trackColor}
            thumbColor="#FFFFFF"
            ios_backgroundColor={c.gridLine}
            accessibilityLabel="Block illegal pencil notes"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: c.gridLine }]} />

        <View style={styles.row}>
          <Text style={[styles.label, { color: c.text }]}>Start in Fast mode</Text>
          <Switch
            value={fastModeDefault}
            onValueChange={setFastModeDefault}
            trackColor={trackColor}
            thumbColor="#FFFFFF"
            ios_backgroundColor={c.gridLine}
            accessibilityLabel="Start new games in Fast mode"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  label: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', gap: 6 },
  segmentItem: {
    minWidth: 44,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentText: { fontSize: 15, fontWeight: '600' },
});
