import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<'success' | 'error'>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, type: 'success' | 'error') => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      setKind(type);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
      }, 2800);
    },
    [opacity],
  );

  const value = useMemoToast(show);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: kind === 'error' ? colors.danger : colors.accent,
              opacity,
            },
          ]}
        >
          <Text style={[styles.text, { color: kind === 'error' ? '#fff' : colors.accentInk }]}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

function useMemoToast(show: (text: string, type: 'success' | 'error') => void) {
  return {
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
  };
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 999,
  },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
