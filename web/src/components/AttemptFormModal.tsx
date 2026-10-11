import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { Sheet } from './Modal';
import { Avatar } from './Bits';
import { useToast } from './Toast';
import { useCelebration } from './Celebration';
import { useSettings } from '../lib/SettingsContext';
import { useAsync } from '../lib/hooks';
import { ExerciseSelector } from './ExerciseSelector';
import { CalendarIcon, ChevronDownIcon, MinusIcon, PlusIcon, ScaleIcon, XIcon } from './Icons';
import { invalidate, useDataVersion } from '../lib/store';
import { formatDate, formatKg, todayISO } from '../lib/format';
import { getLastAthlete, setLastAthlete } from '../lib/lastAthlete';
import { previewLog } from '../lib/preview';
import type { ExerciseCategory } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Athlete to pre-select. Falls back to the last athlete logged for, then the first on the board. */
  userId?: string | null;
  category?: ExerciseCategory | null;
  onSaved?: () => void;
}

/**
 * The Log sheet. Bodyweight is snapshotted with the attempt, so a bulking (or
 * cutting) phase does not retroactively change old scores. The athlete is
 * switchable inside the sheet, which lets the big "+" in the nav log for anyone.
 */
export function AttemptFormModal({ open, onClose, userId, category, onSaved }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const { celebrate } = useCelebration();
  const { celebrationsEnabled } = useSettings();
  const version = useDataVersion();

  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | null>(category ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(userId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reps, setReps] = useState('');
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);

  // Reset every time the sheet opens.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setActiveCategory(category ?? null);
      setSelectedId(userId ?? null);
      setPickerOpen(false);
      setReps('');
      setDate(todayISO());
      setNote('');
      setError(null);
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open, category, userId]);

  // The board doubles as the athlete list, the office median and the "where does this land" data.
  const { data: board, loading: boardLoading } = useAsync(
    () => (open && activeCategory ? api.board('best', activeCategory.slug) : Promise.resolve(null)),
    [open, activeCategory?.slug, version],
  );
  const rows = board?.rows ?? [];
  const medianMassKg = board?.medianMassKg ?? 0;

  // Settle on an athlete once the roster is known.
  useEffect(() => {
    if (!open || rows.length === 0) return;
    if (selectedId && rows.some((r) => r.id === selectedId)) return;
    const last = getLastAthlete();
    const pick = rows.find((r) => r.id === userId) ?? rows.find((r) => r.id === last) ?? rows[0];
    setSelectedId(pick.id);
  }, [open, rows, selectedId, userId]);

  const user = rows.find((r) => r.id === selectedId) ?? null;

  // Pre-fill bodyweight with the chosen athlete's current weight.
  useEffect(() => {
    if (user) setWeight(String(user.weightKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const repsNum = Number(reps) || 0;
  const weightNum = Number(weight.replace(',', '.'));
  const exponent = activeCategory?.normalizationExponent ?? category?.normalizationExponent ?? 0.67;
  const score =
    repsNum > 0 && Number.isFinite(weightNum) && weightNum > 0 && medianMassKg > 0
      ? repsNum * (weightNum / medianMassKg) ** exponent
      : null;
  const preview = user && score !== null ? previewLog(user, rows, repsNum, score) : null;
  const exerciseName = (activeCategory?.name ?? category?.name ?? 'Pull-ups').toLowerCase();

  const setRepsClamped = (n: number) => setReps(n <= 0 ? '' : String(Math.min(500, n)));

  async function submit() {
    if (!user) return;
    setError(null);
    if (repsNum < 1) return setError(`How many ${exerciseName}?`);
    setBusy(true);
    try {
      const res = await api.addAttempt(user.id, {
        categoryId: activeCategory?.id ?? category?.id,
        reps,
        date,
        weightKg: weight,
        note: note.trim(),
      });
      setLastAthlete(user.id);
      invalidate();
      onSaved?.();
      onClose();
      if (res.celebration && res.celebration.xpGained > 0 && celebrationsEnabled) {
        window.setTimeout(() => {
          celebrate(res.celebration!);
        }, 280);
      } else {
        toast.success(`Logged ${Math.round(repsNum)} ${exerciseName} for ${user.name}.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this attempt.');
    } finally {
      setBusy(false);
    }
  }

  const noAthletes = !!board && rows.length === 0;
  const today = todayISO();

  const headline = !preview
    ? null
    : preview.isFirst
      ? 'First result'
      : preview.isPb
        ? 'New personal best'
        : `${preview.below.toFixed(2)} pts below your best`;

  let rankLine = '';
  if (preview) {
    const verb =
      preview.rankBefore === null ? 'Enters at' : preview.rankAfter < preview.rankBefore ? 'Climbs to' : 'Stays';
    rankLine = `${verb} #${preview.rankAfter}`;
    if (preview.neighbour) {
      rankLine += `, ${preview.neighbour.gap.toFixed(2)} pts ${preview.neighbour.ahead ? 'behind' : 'clear of'} ${preview.neighbour.name}`;
    }
  }

  return (
    <Sheet open={open} onClose={onClose} width={480} label="Log result">
      <div className="sheet-head">
        <h2>Log result</h2>
        <button type="button" className="ib" onClick={onClose} aria-label="Close">
          <XIcon size={20} strokeWidth={2.2} />
        </button>
      </div>

      {noAthletes ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <h2>No athletes yet</h2>
          <p>Add someone with their name, age and bodyweight, then come back to log their first result.</p>
          <button
            type="button"
            className="big-btn"
            style={{ marginTop: 8 }}
            onClick={() => {
              onClose();
              navigate('/users?new=1');
            }}
          >
            Add athlete
          </button>
        </div>
      ) : (
        <>
          {/* Who */}
          {user ? (
            <>
              <button
                type="button"
                className="who2"
                onClick={() => rows.length > 1 && setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                aria-label={`Athlete: ${user.name}`}
                style={{ cursor: rows.length > 1 ? 'pointer' : 'default' }}
              >
                <Avatar name={user.name} size={40} />
                <div>
                  <b>{user.name}</b>
                  <small>
                    {user.sessionCount > 0
                      ? `PB ${user.pbAbsolute} · ${user.pbNormalized.toFixed(2)} pts · ×${user.multiplier.toFixed(2)}`
                      : `No results yet · ×${user.multiplier.toFixed(2)}`}
                  </small>
                </div>
                {rows.length > 1 ? <ChevronDownIcon size={18} strokeWidth={2.2} /> : null}
              </button>

              {pickerOpen ? (
                <div className="who-menu" role="listbox" aria-label="Athletes">
                  {rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="option"
                      aria-selected={r.id === user.id}
                      data-active={r.id === user.id}
                      onClick={() => {
                        setSelectedId(r.id);
                        setPickerOpen(false);
                      }}
                    >
                      <Avatar name={r.name} size={30} />
                      <span>{r.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="who2" aria-busy="true">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 999, flex: 'none' }} />
              <div>
                <div className="skeleton" style={{ height: 14, width: '55%' }} />
                <div className="skeleton" style={{ height: 11, width: '75%', marginTop: 6 }} />
              </div>
            </div>
          )}

          <ExerciseSelector selected={activeCategory} onSelect={setActiveCategory} variant="seg" />

          {/* Reps */}
          <div className="step">
            <button
              type="button"
              className="rb"
              aria-label="One less"
              onClick={() => setRepsClamped(repsNum - 1)}
            >
              <MinusIcon size={26} strokeWidth={2.4} />
            </button>
            <div className="n">
              <input
                id="af-reps"
                aria-label={`${exerciseName} completed`}
                value={reps}
                autoFocus
                inputMode="numeric"
                placeholder="0"
                onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
              <span>{exerciseName}</span>
            </div>
            <button type="button" className="rb p" aria-label="One more" onClick={() => setRepsClamped(repsNum + 1)}>
              <PlusIcon size={26} strokeWidth={2.6} />
            </button>
          </div>

          <div className="two">
            <label className="fld" htmlFor="af-weight">
              <div>
                <small>Bodyweight</small>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <input
                    id="af-weight"
                    value={weight}
                    inputMode="decimal"
                    style={{ width: `${Math.max(2, weight.length)}ch`, flex: 'none' }}
                    onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
                  />
                  <b style={{ fontSize: 17 }}>kg</b>
                </span>
              </div>
              <ScaleIcon size={18} strokeWidth={2} />
            </label>

            <label className="fld" htmlFor="af-date" style={{ cursor: 'pointer' }}>
              <div>
                <small>Date</small>
                <b>{date === today ? 'Today' : formatDate(date)}</b>
              </div>
              <CalendarIcon size={18} strokeWidth={2} />
              <input
                id="af-date"
                type="date"
                className="date-native"
                value={date}
                max={today}
                aria-label="Date"
                onChange={(e) => e.target.value && setDate(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
              />
            </label>
          </div>

          <div className="note-fld">
            <input
              aria-label="Note (optional)"
              value={note}
              placeholder="Add a note (strict, dead hang, no kipping)"
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Live preview */}
          <div className="prev" aria-live="polite">
            <div className="big" data-testid="normalized-preview">
              {score === null ? '–' : score.toFixed(2)}
              <small>pts</small>
            </div>
            <p>
              {preview && headline ? (
                <>
                  <b>{headline}</b> · +{preview.xp} XP
                  <br />
                  {rankLine}
                </>
              ) : (
                <>
                  Enter your reps to see where this lands on the board
                  {medianMassKg > 0 ? ` (office median ${formatKg(medianMassKg)}).` : '.'}
                </>
              )}
            </p>
          </div>

          {error ? <p className="sheet-error">{error}</p> : null}

          <button
            type="button"
            className="big-btn save"
            onClick={() => void submit()}
            disabled={busy || !user || (boardLoading && !user)}
          >
            {busy ? 'Saving…' : 'Save result'}
          </button>
        </>
      )}
    </Sheet>
  );
}
