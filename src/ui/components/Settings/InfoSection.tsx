import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const InfoSection = ({
    handleOpenLink,
    c,
}: {
    handleOpenLink: (url: string) => Promise<void>;
    c: {
        background: string;
        surface: string;
        text: string;
        textMuted: string;
        primary: string;
        highlight: string;
        sameValue: string;
        selected: string;
        userValue: string;
        error: string;
        errorBg: string;
        gridLine: string;
        gridLineBold: string;
        note: string;
    };
}) => {
    return (
        <View style={styles.linksSection}>
            <Pressable
                style={styles.linkRow}
                onPress={() => handleOpenLink("https://sudoku.chefu.co.za/about")}
            >
                <Text style={[styles.linkText, { color: c.text }]}>About</Text>
                <Feather name="external-link" size={20} color={c.textMuted} />
            </Pressable>

            <View
                style={[styles.separator, { backgroundColor: c.gridLine || "#ccc" }]}
            />

            <Pressable
                style={styles.linkRow}
                onPress={() => handleOpenLink("https://sudoku.chefu.co.za/privacy")}
            >
                <Text style={[styles.linkText, { color: c.text }]}>Privacy Policy</Text>
                <Feather name="external-link" size={20} color={c.textMuted} />
                
            </Pressable>

            <View
                style={[styles.separator, { backgroundColor: c.gridLine || "#ccc" }]}
            />

            <Pressable
                style={styles.linkRow}
                onPress={() => handleOpenLink("https://sudoku.chefu.co.za/terms")}
            >
                <Text style={[styles.linkText, { color: c.text }]}>
                    Terms of Service
                </Text>
                <Feather name="external-link" size={20} color={c.textMuted} />

            </Pressable>
        </View>
    );
};

export default InfoSection;

const styles = StyleSheet.create({
    linksSection: {
        marginTop: 8,
        borderRadius: 12,
        overflow: "hidden",
    },
    linkRow: {
        paddingVertical: 16,
        paddingHorizontal: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    linkText: {
        fontSize: 16,
        fontWeight: "500",
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        width: "100%",
        opacity: 0.3, 
    },
});