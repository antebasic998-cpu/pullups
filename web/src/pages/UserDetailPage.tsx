import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAsync } from '../lib/hooks';
import { invalidate, useDataVersion } from '../lib/store';
import { useLogSheet } from '../lib/LogSheet';
import { daysAgo, formatDate, formatDateShort, formatKg } from '../lib/format';
import { EmptyState } from '../components/Bits';
import { BadgeMedal, LevelRing, XpProgress } from '../components/Game';
import { ScoreChart, type ChartPoint } from '../components/ScoreChart';
import { ConfirmDialog } from '../components/Modal';
import { ImportModal } from '../components/ImportModal';
import { UserFormModal } from '../components/UserFormModal';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { useToast } from '../components/Toast';
import { ChevronLeftIcon, MoreIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import type { Board, ExerciseCategory, UserResponse } from '../types';

type Series = 'normalized' | 'absolute' | 'weight';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const version = useDataVersion();
  const toast = useToast();
  const navigate = useNavigate();
  const log = useLogSheet();

  const handleCategorySelect = (cat: ExerciseCategory) => {
    setSelectedCategory(cat);
    setSearchParams({ category: cat.slug }, { replace: true });
  };

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([
        api.user(id, selectedCategory?.slug),
        api.board('best', selectedCategory?.slug),
      ]).then(([user, board]: [UserResponse, Board]) => ({
        user,
        board,
      })),
    [id, selectedCategory?.slug, version],
  );

  const [series, setSeries] = useState<Series>('normalized');
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const user = data?.user.user;
  const normRank = data?.board.rows.find((r) => r.id === id)?.rank ?? null;
  const total = data?.board.userCount ?? 0;

  const chartPoints: ChartPoint[] = useMemo(() => {
    if (!user) return [];
    return user.sessions.map((s) => ({
      id: s.id,
      date: s.date,
      reps: s.reps,
      weightKg: s.weightKg,
      value: series === 'normalized' ? s.normalized : series === 'absolute' ? s.reps : s.weightKg,
    }));
  }, [user, series]);

  const history = useMemo(() => (user ? [...user.sessions].reverse() : []), [user]);
  const [showAll, setShowAll] = useState(false);
  const visibleHistory = showAll ? history : history.slice(0, 8);

  /** Sessions that were a new best for the athlete at the time (reps above everything before). */
  const pbIds = useMemo(() => {
    const ids = new Set<string>();
    let best = 0;
    let first = true;
    if (!user) return ids;
    for (const s of user.sessions) {
      if (!first && s.reps > best) ids.add(s.id);
      if (s.reps > best) best = s.reps;
      first = false;
    }
    return ids;
  }, [user]);

  const badges = useMemo(
    () => (user ? [...user.badges].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)) : []),
    [user],
  );

  async function removeAttempt(attemptId: string) {
    try {
      await api.deleteAttempt(attemptId);
      invalidate();
      toast.success('Result deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete this result.');
    }
  }

  async function removeUser() {
    if (!user) return;
    setBusy(true);
    try {
      await api.deleteUser(user.id);
      invalidate();
      toast.success(`${user.name} removed.`);
      navigate('/users');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this athlete.');
    } finally {
      setBusy(false);
    }
  }

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  if (loading && !data) {
    return (
      <div className="shell" aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 40, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 230, marginTop: 14, borderRadius: 26 }} />
        <div className="skeleton" style={{ height: 50, marginTop: 14, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 180, marginTop: 14, borderRadius: 22 }} />
      </div>
    );
  }

  if (error || !data || !user) {
    return (
      <div className="shell">
        <EmptyState
          title="Athlete not found"
          message={error ?? 'That person is no longer on the board.'}
          action={
            <Link to="/users" className="btn mt-2 no-underline">
              Back to athletes
            </Link>
          }
        />
      </div>
    );
  }

  const medianKg = data.user.medianMassKg;
  const exerciseName = selectedCategory?.name ?? 'Pull-ups';
  const seriesMeta: Record<Series, { unit: string; decimals: number; color: string }> = {
    normalized: { unit: 'pts', decimals: 2, color: 'var(--accent)' },
    absolute: { unit: 'reps', decimals: 0, color: 'var(--text)' },
    weight: { unit: 'kg', decimals: 1, color: 'var(--muted)' },
  };
  const active = seriesMeta[series];
  const noData = user.sessionCount === 0;

  return (
    <div className="shell">
      {/* Top bar */}
      <div className="p-bar">
        <button type="button" className="ib" onClick={goBack} aria-label="Back">
          <ChevronLeftIcon size={20} strokeWidth={2.2} />
        </button>

        <ExerciseSelector
          selected={selectedCategory}
          onSelect={handleCategorySelect}
          loading={loading}
          initialSlug={categorySlug}
          fallback={<h2>Profile</h2>}
        />

        <div className="more-wrap" ref={moreRef}>
          <button
            type="button"
            className="ib"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreIcon size={20} />
          </button>
          {moreOpen ? (
            <div className="ex-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                style={{ color: 'var(--danger)' }}
                onClick={() => {
                  setMoreOpen(false);
                  setDeleteOpen(true);
                }}
              >
                <TrashIcon size={17} strokeWidth={2} />
                <span>Remove athlete</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s ease', pointerEvents: loading ? 'none' : 'auto' }}>
        {/* Hero */}
        <section className="hero">
          <div className="hero-top">
            <LevelRing name={user.name} level={user.level} />
            <div className="hero-name">
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                {user.name}
              </h1>
              <div className="tags">
                {user.age ? <span className="tag">{user.age} y</span> : null}
                <span className="tag">{formatKg(user.weightKg)}</span>
                <span className="tag">×{user.multiplier.toFixed(2)}</span>
                {normRank ? <span className="tag gold">Rank #{normRank} of {total}</span> : null}
              </div>
            </div>
          </div>
          {user.level ? <XpProgress level={user.level} streaks={user.streaks} /> : null}
        </section>

        {/* Actions */}
        <div className="acts">
          <button type="button" className="big-btn" onClick={() => log.open({ userId: user.id, category: selectedCategory })}>
            <PlusIcon size={20} strokeWidth={2.6} />
            Log {exerciseName}
          </button>
          <button type="button" className="sq-btn" title="Import CSV history" aria-label="Import" onClick={() => setImportOpen(true)}>
            <UploadIcon size={20} strokeWidth={2} />
          </button>
          <button type="button" className="sq-btn" title="Edit" aria-label="Edit" onClick={() => setEditOpen(true)}>
            <PencilIcon size={19} strokeWidth={2} />
          </button>
        </div>

        {/* Career numbers */}
        <section className="stats" aria-label="Career numbers">
          <div className="st hi">
            <b>{noData ? '–' : user.pbNormalized.toFixed(2)}</b>
            <span>Normalized PB</span>
          </div>
          <div className="st">
            <b>{noData ? '–' : user.pbAbsolute}</b>
            <span>PB {exerciseName.toLowerCase()}</span>
          </div>
          <div className="st">
            <b>{user.totalReps}</b>
            <span>Total reps</span>
          </div>
          <div className="st">
            <b>{user.sessionCount}</b>
            <span>Sessions</span>
          </div>
          <div className="st">
            <b>{user.improvement === null ? '–' : `${user.improvement > 0 ? '+' : ''}${user.improvement}%`}</b>
            <span>Since first</span>
          </div>
          <div className="st">
            <b>{user.lastResult?.date ? formatDateShort(user.lastResult.date) : '–'}</b>
            <span>Last logged</span>
          </div>
        </section>

        {/* Progress */}
        <section className="a-card">
          <div className="card-head">
            <h3>Progress</h3>
            <small>{exerciseName}</small>
          </div>
          <div className="seg" role="tablist" aria-label="Chart series" style={{ marginBottom: 8 }}>
            {(
              [
                ['normalized', 'Normalized'],
                ['absolute', exerciseName],
                ['weight', 'Bodyweight'],
              ] as [Series, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={series === key}
                data-active={series === key}
                className="seg-item"
                onClick={() => setSeries(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <ScoreChart
            points={chartPoints}
            unit={active.unit}
            decimals={active.decimals}
            color={active.color}
            height={210}
            emptyMessage="No attempts yet."
          />
        </section>

        {/* Badges */}
        <section className="a-card">
          <div className="card-head">
            <h3>Badges</h3>
            <small>
              {user.unlockedBadgeCount} of {user.badges.length} unlocked
            </small>
          </div>
          <div className="badges-row hs">
            {badges.map((badge) => (
              <BadgeMedal key={badge.id} badge={badge} />
            ))}
          </div>
        </section>

        {/* History */}
        <section className="a-card">
          <div className="card-head">
            <h3>History</h3>
            <small>{user.sessionCount > 0 ? `last logged ${daysAgo(user.lastResult?.date)}` : 'nothing logged yet'}</small>
          </div>

          {history.length === 0 ? (
            <p className="m-0 py-4 text-center text-sm muted">
              No {exerciseName.toLowerCase()} logged yet for {user.name}.
            </p>
          ) : (
            <div>
              <div className="hist-row h">
                <span>Date</span>
                <span>Reps</span>
                <span>Weight</span>
                <span>Score</span>
                <span />
              </div>
              {visibleHistory.map((s) => (
                <div key={s.id} className="hist-row">
                  <span>
                    {formatDateShort(s.date)}
                    {pbIds.has(s.id) ? <i className="pbt">PB</i> : null}
                    {s.note ? <small>{s.note}</small> : null}
                  </span>
                  <span>{s.reps}</span>
                  <span>{formatKg(s.weightKg)}</span>
                  <span className="sc">{s.normalized.toFixed(2)}</span>
                  <button
                    type="button"
                    className="del"
                    title={`Delete the result from ${formatDate(s.date)}`}
                    aria-label={`Delete the result from ${formatDate(s.date)}`}
                    onClick={() => void removeAttempt(s.id)}
                  >
                    <TrashIcon size={15} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {history.length > 8 ? (
            <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : `Show all ${history.length}`}
            </button>
          ) : null}
        </section>

        <p className="foot">
          Normalized uses the bodyweight recorded on the day, against the office median of {formatKg(medianKg)}.
        </p>
      </div>

      <UserFormModal open={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ImportModal
        open={importOpen}
        user={user}
        category={selectedCategory}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Remove ${user.name}?`}
        message={<>This deletes {user.name} and every logged result. Everyone else's normalized score shifts too.</>}
        confirmLabel="Remove"
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void removeUser()}
      />
    </div>
  );
}
