import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { Icon } from "../components/Icon";
import { GameSettings } from "../components/Settings/GameSettings";
import InfoSection from "../components/Settings/InfoSection";
import { ThemePicker } from "../components/ThemePicker/ThemePicker";
import { useTheme } from "../theme/ThemeProvider";
import { AppVersionInfoInteractive } from "../components/Settings/AppVersionInfo";

export function SettingsScreen() {
    const router = useRouter();
    const c = useTheme().colors;
    const insets = useSafeAreaInsets();

    const handleOpenLink = async (url: string) => {
        try {
            await WebBrowser.openBrowserAsync(url, {
                toolbarColor: c.background,
                controlsColor: c.text,
            });
        } catch (error) {
            Sentry.captureException(error);
        }
    };

    return (
        <ScrollView
            style={{ backgroundColor: c.background }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
                styles.container,
                { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
            ]}
        >
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={16}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    style={({ pressed }) => [
                        styles.back,
                        { opacity: pressed ? 0.5 : 1.0 },
                    ]}
                >
                    <Icon name="chevronLeft" size={28} color={c.text} />
                </Pressable>
                <Text style={[styles.title, { color: c.text }]}>Settings</Text>
                <View style={styles.backSpacer} />
            </View>

            {/* Game Settings Section */}
            <GameSettings />

            {/* Appearance Section */}
            <View style={styles.sectionContainer}>
                <Text style={[styles.section, { color: c.textMuted }]}>Appearance</Text>
                <View
                    style={[
                        styles.card,
                        { backgroundColor: c.surface, borderColor: c.gridLine },
                    ]}
                >
                    <ThemePicker />
                </View>
            </View>

            {/* Legal & Info Section */}
            <View style={styles.sectionContainer}>
                <Text style={[styles.section, { color: c.textMuted }]}>
                    Legal & Info
                </Text>
                <View
                    style={[
                        styles.card,
                        { backgroundColor: c.surface, borderColor: c.gridLine },
                    ]}
                >
                    <InfoSection handleOpenLink={handleOpenLink} c={c} />
                </View>
            </View>

            {/* Version Display pinned to the bottom */}
            <View style={styles.versionContainer}>
                <AppVersionInfoInteractive />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        gap: 24,
        flexGrow: 1,
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
    sectionContainer: {
        gap: 8,
    },
    section: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
    },
    versionContainer: {
        flex: 1,
        justifyContent: "flex-end",
    },
});
