import { useState } from 'react';
import { api } from '../api';
import { ExerciseFormModal } from '../components/ExerciseFormModal';
import { MoonIcon, SunIcon } from '../components/Icons';
import { PageHeader } from '../components/Bits';
import { useAsync, useTheme } from '../lib/hooks';
import { exerciseEmoji } from '../lib/categoryUtils';
import { useDataVersion } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';

export function SettingsPage() {
  const version = useDataVersion();
  const { celebrationsEnabled, setCelebrationsEnabled } = useSettings();
  const { theme, toggle } = useTheme();
  const { data, loading } = useAsync(() => api.categories(), [version]);
  const [addOpen, setAddOpen] = useState(false);

  const categories = data?.categories ?? [];

  return (
    <div className="shell">
      <PageHeader eyebrow="Preferences" title="Settings" />
      <p className="blurb">Personal preferences and board configuration shared with everyone.</p>

      <section className="set-card">
        <h2>Appearance</h2>
        <div className="set-row" style={{ marginTop: 14 }}>
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              {theme === 'dark' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
              {theme === 'dark' ? 'Dark theme' : 'Light theme'}
            </span>
            <span className="mt-1 block text-[13px] muted">Switch between the dark Arena look and a light one.</span>
          </span>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="Use light theme"
            onClick={toggle}
          />
        </div>
      </section>

      <section className="set-card">
        <h2>Exercises</h2>
        <p>
          Add new exercise types for the whole office. They appear in the leaderboard and log form for everyone.
        </p>

        <div className="set-list">
          {loading && categories.length === 0 ? (
            <p className="m-0 p-4 text-sm faint">Loading exercises…</p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id}>
                <span className="w-7 text-center text-lg">{exerciseEmoji(cat.iconKey, cat.slug)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{cat.name}</div>
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

      <section className="set-card">
        <h2>Gamification</h2>
        <div className="set-row" style={{ marginTop: 14 }}>
          <span>
            <span className="block text-sm font-semibold">XP & achievement animations</span>
            <span className="mt-1 block text-[13px] muted">
              Full-screen celebration when you log a result, earn XP, level up, or unlock a badge.
            </span>
          </span>
          <button
            type="button"
            className="toggle"
            role="switch"
            aria-checked={celebrationsEnabled}
            aria-label="XP and achievement animations"
            onClick={() => setCelebrationsEnabled(!celebrationsEnabled)}
          />
        </div>
        {!celebrationsEnabled ? (
          <p className="m-0 mt-3 text-xs faint">
            Celebrations are off — you&apos;ll get a short toast after logging instead.
          </p>
        ) : null}
      </section>

      <p className="foot">score = pull-ups × (bodyweight ÷ office median) ^ 0.67</p>

      <ExerciseFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
