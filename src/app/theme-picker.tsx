import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/ui/theme/ThemeProvider";
import { THEMES } from "@/ui/theme/themes";
import { useSettingsStore } from "../state/settingsStore";

const ThemePickerScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const c = theme.colors;

    const themeKey = useSettingsStore((s) => s.themeKey);
    const setThemeKey = useSettingsStore((s) => s.setThemeKey);

    return (
        <ScrollView
            style={{ backgroundColor: c.background }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
                styles.container,
                { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={16}
                    accessibilityRole="button"
                    style={styles.back}
                >
                    <Feather name="chevron-left" size={28} color={c.text} />
                </Pressable>
                <Text style={[styles.title, { color: c.text }]}>Appearance</Text>
                <View style={styles.backSpacer} />
            </View>

            {/* Theme Grid */}
            <View style={styles.grid}>
                {THEMES.map((t) => {
                    const selected = t.key === themeKey;
                    return (
                        <Pressable
                            key={t.key}
                            onPress={() => setThemeKey(t.key)}
                            style={[
                                styles.swatch,
                                {
                                    backgroundColor: t.colors.background,
                                    borderColor: selected ? t.colors.primary : t.colors.gridLine,
                                    borderWidth: selected ? 2 : 1,
                                },
                            ]}
                        >
                            <View style={styles.swatchHeader}>
                                <View
                                    style={[styles.dot, { backgroundColor: t.colors.primary }]}
                                />
                                {selected && (
                                    <Feather
                                        name="check-circle"
                                        size={16}
                                        color={t.colors.primary}
                                    />
                                )}
                            </View>

                            {/* Added numberOfLines={1} to prevent long names from wrapping weirdly */}
                            <Text
                                style={[styles.name, { color: t.colors.text }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {t.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </ScrollView>
    );
};

export default ThemePickerScreen;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        gap: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    back: { width: 32 },
    backSpacer: { width: 32 },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        // gap handles the spacing between the 3 columns naturally
        gap: 12,
    },
    swatch: {
        width: "31%", // Exactly fits 3 items across with gap spacing
        aspectRatio: 1, // Changed to 1 (perfect square) which looks better for 3-up grids
        borderRadius: 14,
        padding: 12, // Reduced padding to fit smaller box
        justifyContent: "space-between",
    },
    swatchHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    dot: {
        width: 20, // Reduced dot size
        height: 20,
        borderRadius: 10,
    },
    name: {
        fontSize: 14, // Reduced font size
        fontWeight: "600",
    },
});
