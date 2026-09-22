import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAsync } from '../lib/hooks';
import { invalidate, useDataVersion } from '../lib/store';
import { daysAgo, formatDate, formatKg, formatScore } from '../lib/format';
import { Avatar, EmptyState, Metric } from '../components/Bits';
import { BadgeTile, LevelCard } from '../components/Game';
import { ScoreChart, type ChartPoint } from '../components/ScoreChart';
import { ConfirmDialog } from '../components/Modal';
import { AttemptFormModal } from '../components/AttemptFormModal';
import { ImportModal } from '../components/ImportModal';
import { UserFormModal } from '../components/UserFormModal';
import { useToast } from '../components/Toast';
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import type { Board, UserResponse } from '../types';

type Series = 'normalized' | 'absolute' | 'weight';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const version = useDataVersion();
  const toast = useToast();
  const navigate = useNavigate();

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([api.user(id), api.board('best')]).then(([user, board]: [UserResponse, Board]) => ({
        user,
        board,
      })),
    [id, version],
  );

  const [series, setSeries] = useState<Series>('normalized');
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  if (loading && !data) {
    return (
      <div className="shell flex flex-col gap-4">
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 260 }} />
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
  const seriesMeta: Record<Series, { unit: string; decimals: number; color: string }> = {
    normalized: { unit: 'pts', decimals: 2, color: 'var(--accent)' },
    absolute: { unit: 'reps', decimals: 0, color: 'var(--text)' },
    weight: { unit: 'kg', decimals: 1, color: 'var(--muted)' },
  };
  const active = seriesMeta[series];

  return (
    <div className="shell">
      <Link to="/users" className="mb-4 inline-flex items-center gap-1.5 text-sm no-underline muted">
        <ArrowLeftIcon size={14} />
        Athletes
      </Link>

      {/* Who they are */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Avatar name={user.name} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 break-words text-xl font-semibold tracking-tight">{user.name}</h1>
          <p className="m-0 mt-0.5 text-xs muted">
            {[
              user.age ? `${user.age} years` : null,
              formatKg(user.weightKg),
              `×${user.multiplier.toFixed(2)} mass`,
              normRank ? `rank #${normRank} of ${total}` : null,
              user.level ? `${user.xp} XP` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogOpen(true)}>
            <PlusIcon size={14} />
            Log result
          </button>
          <button type="button" className="icon-btn" title="Import CSV history" aria-label="Import" onClick={() => setImportOpen(true)}>
            <UploadIcon size={15} />
          </button>
          <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditOpen(true)}>
            <PencilIcon size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Remove"
            aria-label="Remove"
            onClick={() => setDeleteOpen(true)}
            style={{ color: 'var(--danger)' }}
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </header>

      {/* Level + streak */}
      {user.level ? (
        <section className="mb-3">
          <LevelCard level={user.level} streaks={user.streaks} />
        </section>
      ) : null}

      {/* Career numbers */}
      <section className="card mb-4 grid grid-cols-2 gap-4 px-4 py-3.5 sm:grid-cols-5">
        <Metric
          label="Normalized PB"
          accent={user.sessionCount > 0}
          value={user.sessionCount ? formatScore(user.pbNormalized) : '–'}
        />
        <Metric label="PB pull-ups" value={user.sessionCount ? user.pbAbsolute : '–'} />
        <Metric label="Total reps" value={user.totalReps} />
        <Metric label="Sessions" value={user.sessionCount} />
        <Metric
          label="Since first result"
          value={user.improvement === null ? '–' : `${user.improvement > 0 ? '+' : ''}${user.improvement}%`}
        />
      </section>

      {/* Progress */}
      <section className="card mb-4 px-4 py-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 section-title">Progress</h2>
          <div className="seg" role="tablist" aria-label="Chart series">
            {(
              [
                ['normalized', 'Normalized'],
                ['absolute', 'Pull-ups'],
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
        </div>

        <ScoreChart
          points={chartPoints}
          unit={active.unit}
          decimals={active.decimals}
          color={active.color}
          height={240}
          emptyMessage="No attempts yet."
        />
      </section>

      {/* Badges */}
      <section className="panel mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h2 className="m-0 section-title">Badges</h2>
          <span className="text-xs faint">
            {user.unlockedBadgeCount} of {user.badges.length} unlocked
          </span>
        </div>
        <div
          className="grid gap-2 border-t px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {user.badges.map((badge) => (
            <BadgeTile key={badge.id} badge={badge} />
          ))}
        </div>
      </section>

      {/* History */}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h2 className="m-0 section-title">History</h2>
          <span className="text-xs faint">
            {user.sessionCount > 0 ? `last logged ${daysAgo(user.lastResult?.date)}` : 'nothing logged yet'}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="border-t px-4 py-8 text-center text-sm muted" style={{ borderColor: 'var(--border)' }}>
            One set of pull-ups and {user.name} is on the board.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 440 }}>
              <thead>
                <tr className="text-xs faint">
                  <th className="px-4 py-2 text-left font-medium" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    Date
                  </th>
                  <th className="px-4 py-2 text-right font-medium" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    Pull-ups
                  </th>
                  <th className="px-4 py-2 text-right font-medium" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    Weight
                  </th>
                  <th className="px-4 py-2 text-right font-medium" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    Normalized
                  </th>
                  <th className="w-10" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((s) => (
                  <tr key={s.id} className="group" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 num">
                      {formatDate(s.date)}
                      {s.note ? <div className="text-xs faint">{s.note}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right num">{s.reps}</td>
                    <td className="px-4 py-2.5 text-right num muted">{formatKg(s.weightKg)}</td>
                    <td className="px-4 py-2.5 text-right num font-medium" style={{ color: 'var(--accent)' }}>
                      {formatScore(s.normalized)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        className="icon-btn opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        title="Delete this result"
                        aria-label="Delete this result"
                        onClick={() => void removeAttempt(s.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {history.length > 8 ? (
          <div className="border-t px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : `Show all ${history.length}`}
            </button>
          </div>
        ) : null}
      </section>

      <p className="mt-3 text-xs faint">
        Normalized uses the bodyweight recorded on the day, against the office median of {formatKg(medianKg)}.
      </p>

      <AttemptFormModal open={logOpen} user={user} medianMassKg={medianKg} onClose={() => setLogOpen(false)} />
      <UserFormModal open={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ImportModal open={importOpen} user={user} onClose={() => setImportOpen(false)} />
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
