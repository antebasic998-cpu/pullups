import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { SettingsProvider } from './src/lib/SettingsContext';
import { ToastProvider } from './src/components/Toast';
import { CelebrationProvider } from './src/components/Celebration';
import { db, initDb, subscribeToRealtime } from './src/core/db';
import { buildSeedData } from './src/core/seed';
import { clearAppUnlocked, isAppUnlocked } from './src/lib/auth';
import { PasswordGateScreen } from './src/screens/PasswordGateScreen';

function Boot({ children }: { children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const accessGranted = await isAppUnlocked();
      setUnlocked(accessGranted);
      await initDb();
      setReady(true);
      unsubscribe = subscribeToRealtime();
    })();

    const urlSub = Linking.addEventListener('url', (e) => {
      if (e.url.includes('//lock') || e.url.includes('/lock')) {
        void clearAppUnlocked().then(() => setUnlocked(false));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      urlSub.remove();
    };
  }, []);

  if (!ready || unlocked === null) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.bg }]}>
        <Image
          source={require('./assets/logo.png')}
          style={{ width: 84, height: 84, marginBottom: 16 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted, marginTop: 12 }}>Loading leaderboard…</Text>
      </View>
    );
  }

  if (!unlocked) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <PasswordGateScreen onUnlocked={() => setUnlocked(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <ToastProvider>
              <CelebrationProvider>
                <Boot>
                  <RootNavigator />
                </Boot>
              </CelebrationProvider>
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
