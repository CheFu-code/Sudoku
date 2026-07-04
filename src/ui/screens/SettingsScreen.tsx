import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { GameSettings } from '../components/Settings/GameSettings';
import { ThemePicker } from '../components/ThemePicker/ThemePicker';
import { Icon } from '../components/Icon';

export function SettingsScreen() {
  const router = useRouter();
  const c = useTheme().colors;
  const insets = useSafeAreaInsets();

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
          onPress={() => router.back()}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
        >
          <Icon name="chevronLeft" size={28} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
        {/* Spacer balances the back glyph so the title stays optically centered. */}
        <View style={styles.backSpacer} />
      </View>

      <GameSettings />
      <ThemePicker />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  back: { width: 32 },
  backSpacer: { width: 32 },
  title: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
});
