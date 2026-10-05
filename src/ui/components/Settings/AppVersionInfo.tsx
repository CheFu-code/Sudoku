import React from "react";
import {
    Text,
    TouchableOpacity,
    StyleSheet,
    ToastAndroid,
    Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";

export function AppVersionInfoInteractive() {
    const appName = Constants.expoConfig?.name ?? "App";
    const version = Constants.expoConfig?.version ?? "1.0.0";
    const build = Constants.expoConfig?.android?.versionCode ?? "Unknown";

    const fullVersionString = `v${version} (${build})`;

    const handleCopyDebugInfo = async () => {
        const debugDetails = `${appName} ${fullVersionString} | OS: ${Platform.OS} v${Platform.Version}`;
        await Clipboard.setStringAsync(debugDetails);

        if (Platform.OS === "android") {
            ToastAndroid.show("App info copied to clipboard", ToastAndroid.SHORT);
        }
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handleCopyDebugInfo}
            activeOpacity={0.6}
        >
            <Text style={styles.text}>
                {appName} {fullVersionString}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "flex-start",
        paddingVertical: 24,
    },
    text: {
        color: "#6B7280",
        fontSize: 12,
    },
});
