import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AttemptFormModal } from '../components/AttemptFormModal';
import type { ExerciseCategory } from '../types';

interface OpenOptions {
  /** Pre-select this athlete. */
  userId?: string | null;
  /** Pre-select this exercise. */
  category?: ExerciseCategory | null;
}

interface LogSheetValue {
  open: (options?: OpenOptions) => void;
}

const LogSheetContext = createContext<LogSheetValue | null>(null);

/**
 * One Log sheet for the whole app. The big "+" in the nav, the quick "+" on every
 * board row and the button on a profile all open this same sheet.
 */
export function LogSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; options: OpenOptions }>({ open: false, options: {} });

  const open = useCallback((options: OpenOptions = {}) => setState({ open: true, options }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <LogSheetContext.Provider value={value}>
      {children}
      <AttemptFormModal
        open={state.open}
        onClose={close}
        userId={state.options.userId}
        category={state.options.category}
      />
    </LogSheetContext.Provider>
  );
}

export function useLogSheet(): LogSheetValue {
  const ctx = useContext(LogSheetContext);
  if (!ctx) throw new Error('useLogSheet must be used inside <LogSheetProvider>');
  return ctx;
}
