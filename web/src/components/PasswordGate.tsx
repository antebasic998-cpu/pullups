import { useState } from 'react';
import { api } from '../api';
import { setAppUnlocked } from '../lib/auth';

interface Props {
  onUnlocked: () => void;
}

export function PasswordGate({ onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyPassword(password.trim());
      if (res.valid) {
        setAppUnlocked();
        onUnlocked();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error verifying password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-6 shadow-xl text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-3xl">
          🔒
        </div>
        <h1 className="text-xl font-bold tracking-tight">BitReport Leaderboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Please enter the office password to access the leaderboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />

          {error && <div className="text-xs text-red-500 font-medium text-left">{error}</div>}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-95 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Unlock Leaderboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
