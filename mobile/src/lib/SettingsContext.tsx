import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = '@pullup/settings';

interface SettingsState {
  celebrationsEnabled: boolean;
}

interface SettingsContextValue extends SettingsState {
  setCelebrationsEnabled: (enabled: boolean) => void;
  ready: boolean;
}

const defaultState: SettingsState = {
  celebrationsEnabled: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) {
        setReady(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        setSettings({
          celebrationsEnabled:
            typeof parsed.celebrationsEnabled === 'boolean'
              ? parsed.celebrationsEnabled
              : defaultState.celebrationsEnabled,
        });
      } catch {
        // ignore corrupt storage
      }
      setReady(true);
    });
  }, []);

  const setCelebrationsEnabled = (enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, celebrationsEnabled: enabled };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo(
    () => ({
      ...settings,
      setCelebrationsEnabled,
      ready,
    }),
    [settings, ready],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
