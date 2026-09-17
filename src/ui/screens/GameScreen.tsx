import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { canUndo as historyCanUndo } from '../../domain/history';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import { computeMistakes, remainingCounts } from '../../state/selectors';
import { useGameSounds } from '../../hooks/useGameSounds';
import { useGameTimer } from '../hooks/useGameTimer';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTheme } from '../theme/ThemeProvider';
import { Board } from '../components/Board/Board';
import { Controls } from '../components/Controls/Controls';
import { GameHeader } from '../components/Header/GameHeader';
import { GameStats } from '../components/Header/GameStats';
import { HintSheet } from '../components/Hint/HintSheet';
import { NumberPad } from '../components/NumberPad/NumberPad';

function ConfettiBurst({ visible }: { visible: boolean }) {
  const burst = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      burst.value = 0;
      return;
    }
    burst.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [burst, visible]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        id: index,
        x: (index % 4) * 32 - 48,
        y: Math.floor(index / 4) * 20 - 40,
        rotate: index * 22,
        color: ['#F7D154', '#7AD7FF', '#9AE89A', '#FF8C7A', '#C8A2FF'][index % 5],
      })),
    [],
  );

  return (
    <Animated.View pointerEvents="none" style={[styles.confettiWrap, { opacity: burst }]}> 
      {pieces.map((piece) => (
        <ConfettiPiece key={piece.id} piece={piece} burst={burst} />
      ))}
    </Animated.View>
  );
}

function ConfettiPiece({
  piece,
  burst,
}: {
  piece: { x: number; y: number; rotate: number; color: string };
  burst: ReturnType<typeof useSharedValue<number>>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: burst.value * piece.x },
      { translateY: burst.value * piece.y },
      { rotate: `${piece.rotate + burst.value * 90}deg` },
    ],
    opacity: 1 - burst.value * 0.5,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        { backgroundColor: piece.color, left: '50%', top: '50%' },
        style,
      ]}
    />
  );
}

export function GameScreen() {
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { play } = useGameSounds();
  useGameTimer();

  const s = useGameStore();
  const maxMistakes = useSettingsStore((st) => st.maxMistakes);

  const mistakes = useMemo(
    () => computeMistakes(s.board, s.puzzle?.solution ?? ''),
    [s.board, s.puzzle],
  );

  // The Hint button is enabled whenever the game is in progress and has empty
  // cells: the engine always finds a next step (down to a validated last-resort
  // placement), so there's no need to run the full solver on every move.
  const hintAvailable = useMemo(
    () => s.status === 'playing' && s.board.some((c) => c.value === null),
    [s.board, s.status],
  );

  // Vibrate when the mistake count climbs (a wrong value was just placed).
  const prevMistakes = useRef(s.mistakes);
  useEffect(() => {
    if (s.mistakes > prevMistakes.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      void play('error');
    }
    prevMistakes.current = s.mistakes;
  }, [play, s.mistakes]);

  // The one earned celebration: a success tap when the puzzle is solved.
  const prevStatus = useRef(s.status);
  useEffect(() => {
    if (s.status === 'won' && prevStatus.current !== 'won') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void play('success');
    }
    prevStatus.current = s.status;
  }, [play, s.status]);

  if (!s.puzzle) {
    // No active game (e.g. deep link) — bounce home.
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: c.background }]}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button">
          <Text style={{ color: c.primary, fontSize: 16 }}>Back to menu</Text>
        </Pressable>
      </View>
    );
  }

  const paused = s.status === 'paused';
  const gameOver = s.status === 'won' || s.status === 'lost';
  const remaining = remainingCounts(s.board);
  const activeValue =
    s.selectedDigit ?? (s.selectedIndex !== null ? s.board[s.selectedIndex].value : null);

  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <GameHeader onBack={() => router.replace('/')} />

      <View style={styles.spacer} />

      <View style={styles.boardWrap}>
        <GameStats
          difficulty={s.difficulty}
          mistakes={s.mistakes}
          maxMistakes={maxMistakes}
          elapsed={s.elapsed}
          paused={paused}
          onTogglePause={() => s.setPaused(!paused)}
        />
        {paused ? (
          <Pressable
            onPress={() => s.setPaused(false)}
            style={[styles.pausedBox, { backgroundColor: c.surface, borderColor: c.gridLine }]}
            accessibilityRole="button"
            accessibilityLabel="Paused. Tap to resume."
          >
            <Text style={{ color: c.textMuted, fontSize: 18 }}>Paused — tap to resume</Text>
          </Pressable>
        ) : (
          // The completed board stays fully visible — the result sits below it.
          <Board
            board={s.board}
            selectedIndex={s.selectedIndex}
            activeValue={activeValue}
            mistakes={mistakes}
            fastMode={s.fastMode}
            flashCells={s.flashCells}
            reduceMotion={reduceMotion}
            hintAnnotations={s.hint ? s.hint.frames[s.hintStep].annotations : undefined}
            chainLinks={s.hint ? s.hint.frames[s.hintStep].links : undefined}
            onCellPress={s.selectCell}
          />
        )}
      </View>

      <View style={styles.bottom}>
        {gameOver ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(220)}
            style={[styles.result, { backgroundColor: c.surface, borderColor: c.gridLine }]}
            accessibilityLiveRegion="polite"
          >
            {s.status === 'won' && <ConfettiBurst visible={s.status === 'won'} />}
            <Text style={[styles.resultText, { color: c.text }]}>
              {s.status === 'won' ? 'Solved! 🎉' : 'Out of mistakes'}
            </Text>
            <View style={styles.resultActions}>
              {s.status === 'lost' && (
                <Pressable
                  onPress={s.restartGame}
                  style={[styles.btnPrimary, { backgroundColor: c.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Try this puzzle again"
                >
                  <Text style={styles.btnPrimaryText}>Try again</Text>
                </Pressable>
              )}
              {s.status === 'won' && (
                <Pressable
                  onPress={() => s.newGame(s.difficulty)}
                  style={[styles.btnPrimary, { backgroundColor: c.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Start a new puzzle"
                >
                  <Text style={styles.btnPrimaryText}>New game</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.replace('/')}
                style={[styles.btnSecondary, { borderColor: c.gridLine }]}
                accessibilityRole="button"
                accessibilityLabel="Back to menu"
              >
                <Text style={[styles.btnSecondaryText, { color: c.text }]}>Menu</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <>
            <Controls
              pencilMode={s.pencilMode}
              fastMode={s.fastMode}
              canUndo={historyCanUndo(s.history)}
              hintAvailable={hintAvailable && !s.hint}
              hintsUsed={s.hintsUsed}
              onUndo={s.undo}
              onErase={s.erase}
              onFastPencil={s.fastPencil}
              onTogglePencil={s.togglePencil}
              onToggleFastMode={s.toggleFastMode}
              onHint={s.requestHint}
            />
            <NumberPad
              remaining={remaining}
              activeDigit={s.selectedDigit}
              invalidFlash={s.invalidFlash}
              reduceMotion={reduceMotion}
              onPress={s.pressDigit}
            />
          </>
        )}
      </View>

      <View style={styles.spacer} />

      {s.hint && (
        <>
          <Pressable
            style={styles.scrim}
            onPress={s.closeHint}
            accessibilityRole="button"
            accessibilityLabel="Dismiss hint"
          />
          <HintSheet
            hint={s.hint}
            step={s.hintStep}
            reduceMotion={reduceMotion}
            onNext={s.nextHintStep}
            onPrev={s.prevHintStep}
            onApply={s.applyHint}
            onClose={s.closeHint}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  boardWrap: { paddingHorizontal: 4, marginTop: 12 },
  pausedBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 10 },
  result: {
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 16,
  },
  confettiWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 16,
    borderRadius: 4,
    transformOrigin: 'center',
  },
  resultText: { fontSize: 28, fontWeight: '800' },
  resultActions: { flexDirection: 'row', gap: 12 },
  btnPrimary: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  btnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '600' },
  spacer: { flex: 1 },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
