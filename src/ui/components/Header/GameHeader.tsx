import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  onBack: () => void;
}

export function GameHeader({ onBack }: Props) {
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 26 },
});
