import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { ExerciseSelector } from './ExerciseSelector';
import { invalidate } from '../lib/store';
import { todayISO } from '../lib/format';
import type { ExerciseCategory, UserSummary } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  user: UserSummary;
  medianMassKg: number;
  category?: ExerciseCategory | null;
  onSaved?: () => void;
}

/** Log one attempt. Bodyweight is snapshotted with the attempt, so a bulking
 *  (or cutting) phase does not retroactively change old scores. */
export function AttemptFormModal({ open, onClose, user, medianMassKg, category, onSaved }: Props) {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | null>(category ?? null);
  const [reps, setReps] = useState('');
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setActiveCategory(category ?? null);
      setReps('');
      setDate(todayISO());
      setWeight(String(user.weightKg));
      setNote('');
      setError(null);
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open, category, user]);

  const repsNum = Number(reps);
  const weightNum = Number(weight.replace(',', '.'));
  const exponent = activeCategory?.normalizationExponent ?? category?.normalizationExponent ?? 0.67;
  const preview =
    Number.isFinite(repsNum) && repsNum > 0 && Number.isFinite(weightNum) && weightNum > 0 && medianMassKg > 0
      ? repsNum * (weightNum / medianMassKg) ** exponent
      : null;

  async function submit() {
    setError(null);
    const exerciseName = activeCategory?.name ?? category?.name ?? 'pull-ups';
    if (!reps.trim()) return setError(`How many ${exerciseName.toLowerCase()}?`);
    setBusy(true);
    try {
      await api.addAttempt(user.id, {
        categoryId: activeCategory?.id ?? category?.id,
        reps,
        date,
        weightKg: weight,
        note: note.trim(),
      });
      invalidate();
      toast.success(`Logged ${Math.round(Number(reps))} ${exerciseName.toLowerCase()} for ${user.name}.`);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this attempt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log a result — ${user.name}`}
      subtitle={`Normalized against today's office median of ${medianMassKg} kg`}
      width={480}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save result'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="field">
          <label className="label">Exercise</label>
          <ExerciseSelector
            selected={activeCategory}
            onSelect={setActiveCategory}
            compact
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label className="label" htmlFor="af-reps">
              {activeCategory?.name ?? category?.name ?? 'Pull-ups'} completed
            </label>
            <input
              id="af-reps"
              className="input num"
              value={reps}
              autoFocus
              inputMode="numeric"
              placeholder="12"
              onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="af-date">
              Date
            </label>
            <input
              id="af-date"
              type="date"
              className="input num"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="af-weight">
            Bodyweight that day (kg)
          </label>
          <input
            id="af-weight"
            className="input num"
            value={weight}
            inputMode="decimal"
            onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span className="text-xs" style={{ color: 'var(--faint)' }}>
            Pre-filled with {user.name}'s current weight — adjust if you know it differed.
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor="af-note">
            Note (optional)
          </label>
          <input
            id="af-note"
            className="input"
            value={note}
            placeholder="Strict, dead hang, no kipping"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div
          className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-xs muted">Normalized score</span>
          <span className="num text-base font-semibold" style={{ color: 'var(--accent)' }} data-testid="normalized-preview">
            {preview === null ? '–' : preview.toFixed(2)}
          </span>
        </div>

        {error ? <p className="error-text m-0">{error}</p> : null}
      </div>
    </Modal>
  );
}
