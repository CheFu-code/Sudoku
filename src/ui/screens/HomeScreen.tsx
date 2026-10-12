import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Difficulty } from "../../domain/types";
import { DIFFICULTIES } from "../../domain/types";
import { difficultyProgress } from "../../domain/progression";
import { getRepositories } from "../../data";
import { useGameStore } from "../../state/gameStore";
import { Icon } from "../components/Icon";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useTheme } from "../theme/ThemeProvider";

const LEVELS: Record<Difficulty, { label: string; description: string }> = {
  easy: { label: "Easy", description: "Ease into your rhythm" },
  medium: { label: "Medium", description: "Build your momentum" },
  hard: { label: "Hard", description: "Look a little deeper" },
  expert: { label: "Expert", description: "Think a step ahead" },
  extreme: { label: "Extreme", description: "Push your limits" },
  diabolical: { label: "Diabolical", description: "The ultimate challenge" },
};

const PREVIEW_DIGITS = [5, 3, null, null, 7, null, 6, null, 9];

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HomeScreen() {
  const router = useRouter();
  const { colors: c, dark } = useTheme();
  const reduceMotion = useReduceMotion();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const newGame = useGameStore((s) => s.newGame);
  const resumeSavedGame = useGameStore((s) => s.resumeSavedGame);
  const savedGameInfo = useGameStore((s) => s.savedGameInfo);
  const [stats, setStats] = useState(() => getRepositories().stats.getStats());
  useFocusEffect(useCallback(() => {
    setStats(getRepositories().stats.getStats());
  }, []));
  const saved = savedGameInfo();
  const singleColumn = width < 360 || fontScale > 1.3;
  const showPreview = width >= 390 && fontScale <= 1.3;
  const actionInk = dark ? c.background : "#FFFFFF";

  const start = (difficulty: Difficulty) => {
    if (newGame(difficulty)) router.push("/game");
  };

  const resume = () => {
    if (resumeSavedGame()) router.push("/game");
  };

  const entering = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.duration(320).delay(delay);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 28,
          paddingLeft: Math.max(insets.left, 24),
          paddingRight: Math.max(insets.right, 24),
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image
              source={require("../../../assets/svgs/sudoku-icon.svg")}
              style={styles.logo}
              contentFit="contain"
              accessible={false}
            />
            <Text style={[styles.brandName, { color: c.text }]}>Sudoku</Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.settings,
              { backgroundColor: pressed ? c.highlight : c.surface, borderColor: c.gridLine },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Icon name="settings" size={20} color={c.text} strokeWidth={1.8} />
          </Pressable>
        </View>

        <Animated.View entering={entering(0)} style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
              Find your{"\n"}focus.
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              A fresh puzzle. A clearer mind.
            </Text>
          </View>
          {showPreview && (
            <View
              style={[styles.previewFrame, { backgroundColor: c.highlight }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              <View style={[styles.previewGrid, { backgroundColor: c.gridLine, borderColor: c.gridLine }]}>
                {PREVIEW_DIGITS.map((digit, index) => (
                  <View
                    key={index}
                    style={[
                      styles.previewCell,
                      { backgroundColor: index === 4 ? c.primary : c.surface },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.previewDigit, { color: index === 4 ? actionInk : c.text }]}
                    >
                      {digit ?? ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {saved && (
          <Animated.View entering={entering(60)}>
            <Pressable
              onPress={resume}
              style={({ pressed }) => [
                styles.resume,
                { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Continue ${LEVELS[saved.difficulty].label} game at ${formatTime(saved.elapsed)}`}
            >
              <View style={styles.resumeCopy}>
                <Text style={[styles.resumeEyebrow, { color: actionInk }]}>YOUR PUZZLE IS WAITING</Text>
                <Text style={[styles.resumeLabel, { color: actionInk }]}>Pick up where you left off</Text>
                <Text style={[styles.resumeMeta, { color: actionInk }]}>
                  {LEVELS[saved.difficulty].label}  ·  {formatTime(saved.elapsed)}
                </Text>
              </View>
              <View style={[styles.resumeIcon, { backgroundColor: dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.18)" }]}>
                <Icon name="play" size={22} color={actionInk} />
              </View>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={entering(120)} style={styles.gameSection}>
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.text }]}>New game</Text>
            <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
              Complete challenges to unlock new levels.
            </Text>
          </View>
          <View style={styles.levelGrid}>
            {DIFFICULTIES.map((difficulty, index) => {
              const progress = difficultyProgress(difficulty, stats);
              const requirement = progress.challengeLabel;
              return (
                <View key={difficulty} style={singleColumn ? styles.fullWidth : styles.halfWidth}>
                  <Pressable
                    onPress={() => start(difficulty)}
                    disabled={!progress.unlocked}
                    style={({ pressed }) => [
                      styles.levelCard,
                      { backgroundColor: progress.unlocked ? (pressed ? c.highlight : c.surface) : c.background, borderColor: pressed ? c.primary : c.gridLine },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={progress.unlocked
                      ? `New ${LEVELS[difficulty].label} game`
                      : `${LEVELS[difficulty].label} locked. ${requirement}. Challenge progress ${progress.completed} of ${progress.required}.`}
                    accessibilityState={{ disabled: !progress.unlocked }}
                    accessibilityHint={progress.unlocked ? LEVELS[difficulty].description : undefined}
                  >
                    <View style={styles.cardTop}>
                      <View
                        style={styles.levelMeter}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        aria-hidden
                      >
                        {DIFFICULTIES.map((level, barIndex) => (
                          <View
                            key={level}
                            style={[
                              styles.meterBar,
                              { height: 6 + barIndex * 2, backgroundColor: barIndex <= index ? (progress.unlocked ? c.primary : c.textMuted) : c.highlight },
                            ]}
                          />
                        ))}
                      </View>
                      <Icon name={progress.unlocked ? "chevronRight" : "lock"} size={17} color={c.textMuted} />
                    </View>
                    <Text style={[styles.levelLabel, { color: progress.unlocked ? c.text : c.textMuted }]}>{LEVELS[difficulty].label}</Text>
                    <Text style={[styles.levelDescription, { color: c.textMuted }]}>
                      {progress.unlocked ? LEVELS[difficulty].description : requirement}
                    </Text>
                    {!progress.unlocked && (
                      <View style={styles.unlockProgress}>
                        <View style={[styles.progressTrack, { backgroundColor: c.highlight }]}>
                          <View style={[styles.progressFill, { backgroundColor: c.primary, width: `${progress.completed / progress.required * 100}%` }]} />
                        </View>
                        <Text style={[styles.progressCount, { color: c.textMuted }]}>{progress.completed}/{progress.required}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
                );
            })}
          </View>
        </Animated.View>

        <Text style={[styles.footer, { color: c.textMuted }]}>One puzzle at a time. At your own pace.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, alignItems: "center" },
  content: { width: "100%", maxWidth: 680, gap: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  logo: { width: 34, height: 34 },
  brandName: { fontSize: 23, fontWeight: "700", letterSpacing: -0.7, flexShrink: 1 },
  settings: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: 18, paddingTop: 12, paddingBottom: 4 },
  heroCopy: { flex: 1, gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 46, lineHeight: 50, fontWeight: "700", letterSpacing: -2 },
  subtitle: { fontSize: 14, lineHeight: 22 },
  previewFrame: { width: 120, height: 140, borderRadius: 28, alignItems: "center", justifyContent: "center", transform: [{ rotate: "8deg" }] },
  previewGrid: { width: 104, height: 104, padding: 1, gap: 1, borderWidth: 1, borderRadius: 12, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", transform: [{ rotate: "-16deg" }] },
  previewCell: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  previewDigit: { fontSize: 18, fontWeight: "500" },
  resume: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 16 },
  resumeCopy: { flex: 1, gap: 6 },
  resumeEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  resumeLabel: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.4 },
  resumeMeta: { fontSize: 13, fontWeight: "500", fontVariant: ["tabular-nums"] },
  resumeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  gameSection: { gap: 18 },
  sectionHeading: { gap: 5 },
  sectionTitle: { fontSize: 23, fontWeight: "700", letterSpacing: -0.6 },
  sectionSubtitle: { fontSize: 14, lineHeight: 21 },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  halfWidth: { width: "50%", flexBasis: "47%", flexGrow: 1 },
  fullWidth: { width: "100%" },
  levelCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 104 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  levelMeter: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 16 },
  meterBar: { width: 4, borderRadius: 2 },
  levelLabel: { fontSize: 16, fontWeight: "600", letterSpacing: -0.3, marginBottom: 3 },
  levelDescription: { fontSize: 12, lineHeight: 16 },
  unlockProgress: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressCount: { fontSize: 11, fontVariant: ["tabular-nums"] },
  footer: { fontSize: 12, lineHeight: 20, textAlign: "center", paddingTop: 2 },
});
