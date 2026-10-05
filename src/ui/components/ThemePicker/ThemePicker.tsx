import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSettingsStore } from "../../../state/settingsStore";
import { THEMES } from "../../theme/themes";
import { useTheme } from "../../theme/ThemeProvider";

export function ThemePicker() {
  const router = useRouter();
  const theme = useTheme();
  const themeKey = useSettingsStore((s) => s.themeKey);

  const currentTheme = THEMES.find((t) => t.key === themeKey);

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push("/theme-picker")}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Theme</Text>

      <View style={styles.rightContent}>
        <Text style={[styles.currentValue, { color: theme.colors.textMuted }]}>
          {currentTheme?.name || "Default"}
        </Text>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentValue: {
    fontSize: 16,
  },
});
