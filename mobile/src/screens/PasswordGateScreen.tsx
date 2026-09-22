import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { api } from '../api';
import { setAppUnlocked } from '../lib/auth';

export function PasswordGateScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { colors, mode, toggle } = useTheme();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleUrl = async (urlStr: string | null) => {
      if (!urlStr) return;
      try {
        // e.g. com.anonymous.mobile://unlock?password=... or .../unlock/...
        let pass = '';
        if (urlStr.includes('password=')) {
          const match = urlStr.match(/[?&]password=([^&#]+)/);
          if (match && match[1]) pass = decodeURIComponent(match[1]);
        } else if (urlStr.includes('unlock/')) {
          const parts = urlStr.split('unlock/');
          if (parts[1]) pass = decodeURIComponent(parts[1].split('?')[0]);
        }
        if (pass) {
          setPassword(pass);
          setLoading(true);
          setError(null);
          const isValid = await api.verifyPassword(pass);
          if (isValid) {
            await setAppUnlocked();
            onUnlocked();
          } else {
            setError('Incorrect password. Please try again.');
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to verify password';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => void handleUrl(e.url));
    return () => sub.remove();
  }, [onUnlocked]);

  const handleUnlock = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Please enter the password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await api.verifyPassword(trimmed);
      if (isValid) {
        await setAppUnlocked();
        onUnlocked();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={toggle} style={styles.themeBtn} accessibilityLabel="Toggle Theme">
            <Text style={{ fontSize: 18 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Pull-Up Leaderboard</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            This leaderboard is private. Enter the access password to unlock.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.muted }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                placeholder="Enter access password"
                placeholderTextColor={colors.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={handleUnlock}
                style={[styles.input, { color: colors.text }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(240, 115, 106, 0.12)', borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleUnlock}
              disabled={loading}
              style={[
                styles.unlockBtn,
                { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.accentInk} />
              ) : (
                <Text style={[styles.unlockBtnText, { color: colors.accentInk }]}>Unlock App</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.footerText, { color: colors.faint }]}>
            Access is securely verified and remembered on this device.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  themeBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  unlockBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  unlockBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
