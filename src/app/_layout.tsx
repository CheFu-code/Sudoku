import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://bf56f5fbc4dd81c86c34dd47c7519295@o4512011915296768.ingest.de.sentry.io/4512097158299728',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

SplashScreen.preventAutoHideAsync();

function StatusBarForTheme() {
  const theme = useTheme();
  return <StatusBar style={theme.dark ? 'light' : 'dark'} />;
}

function RootLayout() {
  useEffect(() => {
    let cancelled = false;

    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // The splash screen can remain visible if the app never finished booting.
        // Fallback below ensures the native splash is not left stuck forever.
      }
    };

    void hide();

    const fallback = setTimeout(() => {
      if (!cancelled) {
        void hide();
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBarForTheme />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="game" />
          <Stack.Screen name="settings" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
