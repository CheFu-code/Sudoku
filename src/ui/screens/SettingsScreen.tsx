import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { GameSettings } from "../components/Settings/GameSettings";
import InfoSection from "../components/Settings/InfoSection";
import { ThemePicker } from "../components/ThemePicker/ThemePicker";
import { useTheme } from "../theme/ThemeProvider";

export function SettingsScreen() {
  const router = useRouter();
  const c = useTheme().colors;
  const insets = useSafeAreaInsets();

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        // Optional: customize the browser UI colors to match your theme
        toolbarColor: c.background,
        controlsColor: c.text,
      });
    } catch (error) {
      console.error("Failed to open link:", error);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      showsVerticalScrollIndicator={false}
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
      <View style={[styles.divider, { backgroundColor: c.gridLine }]} />

      <InfoSection handleOpenLink={handleOpenLink} c={c} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 24 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  back: { width: 32 },
  backSpacer: { width: 32 },
  title: { flex: 1, fontSize: 18, fontWeight: "600", textAlign: "center" },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
});
