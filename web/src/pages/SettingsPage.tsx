import { useState } from 'react';
import { api } from '../api';
import { ExerciseFormModal } from '../components/ExerciseFormModal';
import { useAsync } from '../lib/hooks';
import { exerciseEmoji } from '../lib/categoryUtils';
import { useDataVersion } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';

export function SettingsPage() {
  const version = useDataVersion();
  const { celebrationsEnabled, setCelebrationsEnabled } = useSettings();
  const { data, loading } = useAsync(() => api.categories(), [version]);
  const [addOpen, setAddOpen] = useState(false);

  const categories = data?.categories ?? [];

  return (
    <div className="shell max-w-2xl">
      <header className="mb-5">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Settings</h1>
        <p className="m-0 mt-1 text-sm muted">Board configuration shared with everyone.</p>
      </header>

      <section className="card" style={{ padding: '1.25rem' }}>
        <h2 className="m-0 text-base font-semibold">Exercises</h2>
        <p className="mt-1 mb-4 text-sm muted">
          Add new exercise types for the whole office. They appear in the leaderboard and log form for everyone.
        </p>

        <div
          className="mb-4 overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          {loading && categories.length === 0 ? (
            <p className="m-0 p-4 text-sm faint">Loading exercises…</p>
          ) : (
            categories.map((cat, i) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-4 py-3"
                style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
              >
                <span className="w-7 text-center text-lg">{exerciseEmoji(cat.iconKey, cat.slug)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-xs faint">{cat.slug} · bodyweight-normalized reps</div>
                </div>
              </div>
            ))
          )}
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          Add exercise
        </button>
      </section>

      <section className="card mt-4" style={{ padding: '1.25rem' }}>
        <h2 className="m-0 text-base font-semibold">Gamification</h2>
        <label className="mt-3 flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">XP & achievement animations</span>
            <span className="mt-1 block text-sm muted">
              Full-screen celebration when you log a result, earn XP, level up, or unlock a badge.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
            checked={celebrationsEnabled}
            onChange={(e) => setCelebrationsEnabled(e.target.checked)}
          />
        </label>
        {!celebrationsEnabled ? (
          <p className="m-0 mt-3 text-xs faint">Celebrations are off — you&apos;ll get a short toast after logging instead.</p>
        ) : null}
      </section>

      <ExerciseFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
