import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { formatKg, pluralize, reps } from '../lib/format';
import { Avatar, EmptyState } from '../components/Bits';
import { TrendDownIcon, TrendUpIcon } from '../components/Icons';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { UserFormModal } from '../components/UserFormModal';
import type { BoardMode, ExerciseCategory, LeaderRow } from '../types';

const BOARDS: { id: BoardMode; label: string; blurb: string }[] = [
  { id: 'best', label: 'Best', blurb: 'Bodyweight-normalized score' },
  { id: 'absolute', label: 'Absolute', blurb: 'Raw repetition counts, bodyweight ignored' },
  { id: 'improved', label: 'Most improved', blurb: 'Personal best compared with the first result' },
  { id: 'active', label: 'Most active', blurb: 'Sessions logged' },
];

export function LeaderboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [mode, setMode] = useState<BoardMode>('best');
  const [addOpen, setAddOpen] = useState(false);
  const version = useDataVersion();
  const { data, loading, error } = useAsync(
    () => api.board(mode, selectedCategory?.slug),
    [mode, selectedCategory?.slug, version],
  );
  const navigate = useNavigate();

  const board = BOARDS.find((b) => b.id === mode) ?? BOARDS[0];

  return (
    <div className="shell">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-xl font-semibold tracking-tight">Leaderboard</h1>
            <ExerciseSelector
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              loading={loading}
              compact
            />
          </div>
          <p className="m-0 mt-1 text-sm muted">
            {board.blurb}
            {loading ? (
              <span className="faint"> · updating...</span>
            ) : data && data.userCount > 0 ? (
              ` · office median ${formatKg(data.medianMassKg)} · ${pluralize(data.userCount, 'athlete')}`
            ) : data ? (
              ' · nobody on the board yet'
            ) : (
              ''
            )}
          </p>
        </div>

        <div className="seg" role="tablist" aria-label="Board">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={mode === b.id}
              data-active={mode === b.id}
              className="seg-item"
              onClick={() => setMode(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <SkeletonList categoryName={selectedCategory?.name} />
      ) : data && data.rows.length === 0 ? (
        <EmptyState
          title={`No ${selectedCategory?.name ?? 'results'} yet`}
          message={`Nobody has logged ${selectedCategory?.name?.toLowerCase() ?? 'results'} yet. Be the first!`}
          action={
            <button type="button" className="btn btn-primary mt-2" onClick={() => setAddOpen(true)}>
              Add athlete
            </button>
          }
        />
      ) : data ? (
        <div className="panel fade-in">
          {data.rows.map((row) => (
            <LeaderboardRow key={row.id} row={row} mode={mode} />
          ))}
        </div>
      ) : null}

      {mode === 'improved' && data ? (
        <p className="mt-3 text-xs faint">
          Improvement is measured from an athlete's first recorded result to their best score, so one bad day
          doesn't erase progress. It appears once someone has logged two results.
        </p>
      ) : null}

      <UserFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={(u) => navigate(`/users/${u.id}`)} />
    </div>
  );
}

/** Headline number and the quiet line next to it, per board. */
function figures(row: LeaderRow, mode: BoardMode): { value: string; suffix?: string; detail: string } {
  switch (mode) {
    case 'absolute':
      return {
        value: String(row.pbAbsolute),
        suffix: row.pbAbsolute === 1 ? 'rep' : 'reps',
        detail: `${row.pbNormalized.toFixed(2)} normalized`,
      };
    case 'improved':
      if (row.improvement === null) {
        return { value: '–', detail: 'needs two results' };
      }
      return {
        value: `${row.improvement > 0 ? '+' : ''}${row.improvement}%`,
        detail: `from ${row.firstNormalized?.toFixed(2)} to ${row.pbNormalized.toFixed(2)}`,
      };
    case 'active':
      return {
        value: String(row.sessionCount),
        suffix: row.sessionCount === 1 ? 'session' : 'sessions',
        detail: `${reps(row.totalReps)} total`,
      };
    default:
      return { value: row.pbNormalized.toFixed(2), suffix: 'pts', detail: reps(row.pbAbsolute) };
  }
}

function LeaderboardRow({ row, mode }: { row: LeaderRow; mode: BoardMode }) {
  const trend =
    row.trend === 'up' ? (
      <TrendUpIcon size={12} style={{ color: 'var(--up)' }} />
    ) : row.trend === 'down' ? (
      <TrendDownIcon size={12} style={{ color: 'var(--down)' }} />
    ) : null;

  const f = figures(row, mode);
  const isUnranked = row.rank === null;

  return (
    <Link to={`/users/${row.id}`} className="row row-cols">
      <span className={`rank ${isUnranked ? 'rank-unranked' : `rank-${row.rank}`}`}>
        {isUnranked ? '—' : row.rank}
      </span>

      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={row.name} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{row.name}</span>
            {trend}
          </span>
          <span className="block truncate text-xs muted">
            {[row.age ? `${row.age}y` : null, formatKg(row.weightKg), `×${row.multiplier.toFixed(2)}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </span>

      <span className="num text-right font-semibold">
        {isUnranked ? '—' : f.value}
        {!isUnranked && f.suffix ? <span className="faint text-xs font-normal"> {f.suffix}</span> : null}
      </span>

      <span className="row-extra truncate text-right text-xs muted">
        {isUnranked ? 'No attempts yet' : f.detail}
      </span>
    </Link>
  );
}

function SkeletonList({ categoryName }: { categoryName?: string }) {
  return (
    <div className="panel p-3 fade-in">
      <div className="flex items-center justify-between pb-3 px-1 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs font-medium muted">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
            aria-hidden="true"
          />
          <span>Loading {categoryName ? `${categoryName} leaderboard...` : 'leaderboard...'}</span>
        </div>
        <div className="skeleton h-3 w-16" />
      </div>
      <div className="pt-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton my-2" style={{ height: 46 }} />
        ))}
      </div>
    </div>
  );
}
