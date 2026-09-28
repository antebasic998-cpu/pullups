import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'pullup/settings';

interface SettingsState {
  celebrationsEnabled: boolean;
}

interface SettingsContextValue extends SettingsState {
  setCelebrationsEnabled: (enabled: boolean) => void;
}

const defaultState: SettingsState = {
  celebrationsEnabled: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return {
        celebrationsEnabled:
          typeof parsed.celebrationsEnabled === 'boolean'
            ? parsed.celebrationsEnabled
            : defaultState.celebrationsEnabled,
      };
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setCelebrationsEnabled = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, celebrationsEnabled: enabled }));
  };

  const value = useMemo(
    () => ({
      ...settings,
      setCelebrationsEnabled,
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
