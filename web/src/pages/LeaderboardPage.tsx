import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { formatKg, formatWeekRange, pluralize, reps } from '../lib/format';
import { useLogSheet } from '../lib/LogSheet';
import { Avatar, EmptyState, PageHeader } from '../components/Bits';
import { CheckIcon, CrownIcon, PlusIcon, TrendDownIcon, TrendUpIcon } from '../components/Icons';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { UserFormModal } from '../components/UserFormModal';
import type { BoardMode, ExerciseCategory, LeaderRow, OfficeResponse } from '../types';

const BOARDS: { id: BoardMode; label: string; blurb: string }[] = [
  { id: 'best', label: 'Best', blurb: 'Bodyweight-normalized score' },
  { id: 'absolute', label: 'Absolute', blurb: 'Raw repetition counts, bodyweight ignored' },
  { id: 'improved', label: 'Most improved', blurb: 'Personal best compared with the first result' },
  { id: 'active', label: 'Most active', blurb: 'Sessions logged' },
];

const RANK_COLOR: Record<number, string> = { 1: 'var(--gold)', 2: 'var(--silver)', 3: 'var(--bronze)' };

export function LeaderboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [mode, setMode] = useState<BoardMode>('best');
  const [addOpen, setAddOpen] = useState(false);
  const version = useDataVersion();
  const log = useLogSheet();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => api.board(mode, selectedCategory?.slug),
    [mode, selectedCategory?.slug, version],
  );
  const { data: office } = useAsync(() => api.office(selectedCategory?.slug), [selectedCategory?.slug, version]);

  const board = BOARDS.find((b) => b.id === mode) ?? BOARDS[0];
  const exerciseName = data?.category?.name ?? selectedCategory?.name ?? 'Pull-ups';

  const rows = data?.rows ?? [];
  const ranked = rows.filter((r) => r.rank !== null);
  const top = ranked.slice(0, 3);
  const rest = rows.filter((r) => !top.includes(r));
  const hasRanked = ranked.length > 0;

  const quickLog = (row: LeaderRow) => log.open({ userId: row.id, category: selectedCategory });
  const profileLink = (row: LeaderRow) =>
    `/users/${row.id}${selectedCategory ? `?category=${selectedCategory.slug}` : ''}`;

  return (
    <div className="shell">
      <PageHeader
        eyebrow={`${exerciseName} leaderboard`}
        title="Board"
        right={
          <ExerciseSelector selected={selectedCategory} onSelect={setSelectedCategory} loading={loading} compact />
        }
      />

      <div className="chips hs" role="tablist" aria-label="Board">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={mode === b.id}
            data-active={mode === b.id}
            className="chip"
            onClick={() => setMode(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="blurb">
        {board.blurb}
        {loading ? (
          <span> · updating...</span>
        ) : data && data.userCount > 0 ? (
          ` · median ${formatKg(data.medianMassKg)} · ${pluralize(data.userCount, 'athlete')}`
        ) : data ? (
          ' · nobody on the board yet'
        ) : (
          ''
        )}
      </p>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !data ? (
        <BoardSkeleton />
      ) : data && rows.length === 0 ? (
        <EmptyState
          title={`No ${exerciseName.toLowerCase()} yet`}
          message={`Nobody has logged ${exerciseName.toLowerCase()} yet. Add an athlete and be the first!`}
          action={
            <button type="button" className="big-btn" style={{ marginTop: 8, width: 'auto', padding: '0 22px' }} onClick={() => setAddOpen(true)}>
              Add athlete
            </button>
          }
        />
      ) : data ? (
        <div className="fade-in" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
          {hasRanked ? (
            <div className={`podium ${top.length === 1 ? 'podium-solo' : ''}`}>
              {top.length >= 2 ? <PodiumColumn row={top[1]} pos={2} mode={mode} to={profileLink(top[1])} onLog={quickLog} /> : null}
              <PodiumColumn row={top[0]} pos={1} mode={mode} to={profileLink(top[0])} onLog={quickLog} />
              {top.length >= 3 ? (
                <PodiumColumn row={top[2]} pos={3} mode={mode} to={profileLink(top[2])} onLog={quickLog} />
              ) : top.length === 2 ? (
                <div className="pc pc-ghost" aria-hidden="true" />
              ) : null}
            </div>
          ) : (
            <div className="notice">
              <span style={{ fontSize: 22 }} aria-hidden="true">
                🤸
              </span>
              <div>
                <b>No results logged for {exerciseName} yet</b>
                <span>Tap + next to an athlete to log the first score.</span>
              </div>
            </div>
          )}

          {rest.length > 0 ? (
            <div className="lb-list" style={hasRanked ? undefined : { marginTop: 14 }}>
              {rest.map((row) => (
                <LeaderboardRow key={row.id} row={row} mode={mode} to={profileLink(row)} onLog={quickLog} />
              ))}
            </div>
          ) : null}

          {office && data.userCount > 0 ? <WeekCard office={office} athletes={rows} /> : null}
        </div>
      ) : null}

      {mode === 'improved' && data ? (
        <p className="foot">
          Improvement is measured from an athlete's first recorded result to their best score, so one bad day
          doesn't erase progress. It appears once someone has logged two results.
        </p>
      ) : null}

      <p className="foot">score = pull-ups × (bodyweight ÷ office median) ^ 0.67</p>

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

function PodiumColumn({
  row,
  pos,
  mode,
  to,
  onLog,
}: {
  row: LeaderRow;
  pos: 1 | 2 | 3;
  mode: BoardMode;
  to: string;
  onLog: (row: LeaderRow) => void;
}) {
  const f = figures(row, mode);
  return (
    <div className={`pc p${pos}`}>
      {/* One link covers the whole column; the quick-log button sits above it. */}
      <Link to={to} className="pc-hit" aria-label={`${row.name}, place ${row.rank ?? pos}`} />
      {pos === 1 ? (
        <span className="crown">
          <CrownIcon size={22} strokeWidth={2} fill="currentColor" />
        </span>
      ) : null}
      <div className="avw-wrap">
        <div className="avw">
          <Avatar name={row.name} size={pos === 1 ? 76 : 60} />
        </div>
        <button
          type="button"
          className="pc-plus"
          onClick={() => onLog(row)}
          title={`Log result for ${row.name}`}
          aria-label={`Log result for ${row.name}`}
        >
          <PlusIcon size={16} strokeWidth={3} />
        </button>
      </div>
      <div className="pn">{row.name.trim().split(/\s+/)[0]}</div>
      <div className="ps">
        {f.value}
        {f.suffix ? <small>{f.suffix}</small> : null}
      </div>
      <div className="ped">
        <b>{row.rank ?? pos}</b>
      </div>
    </div>
  );
}

function LeaderboardRow({
  row,
  mode,
  to,
  onLog,
}: {
  row: LeaderRow;
  mode: BoardMode;
  to: string;
  onLog: (row: LeaderRow) => void;
}) {
  const trend =
    row.trend === 'up' ? (
      <TrendUpIcon size={12} style={{ color: 'var(--up)' }} />
    ) : row.trend === 'down' ? (
      <TrendDownIcon size={12} style={{ color: 'var(--down)' }} />
    ) : null;

  const f = figures(row, mode);
  const isUnranked = row.rank === null;

  return (
    <div className={`lb-row ${isUnranked ? 'unranked' : ''}`}>
      <span className="lb-rk" style={!isUnranked && row.rank ? { color: RANK_COLOR[row.rank] } : undefined}>
        {isUnranked ? '—' : row.rank}
      </span>

      <Link to={to} className="lb-main">
        <Avatar name={row.name} size={40} />
        <div className="lb-who">
          <b>
            <span>{row.name}</span>
            {trend}
          </b>
          <small>
            {[row.age ? `${row.age}y` : null, formatKg(row.weightKg), `×${row.multiplier.toFixed(2)}`]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </div>
        <div className="lb-val">
          <b>
            {isUnranked ? '—' : f.value}
            {!isUnranked && f.suffix ? <small> {f.suffix}</small> : null}
          </b>
          <small>{isUnranked ? 'No attempts yet' : f.detail}</small>
        </div>
      </Link>

      <button
        type="button"
        className="plus-btn"
        onClick={() => onLog(row)}
        title={`Log result for ${row.name}`}
        aria-label={`Log result for ${row.name}`}
      >
        <PlusIcon size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Who has logged this week, and who is leading the XP race. */
function WeekCard({ office, athletes }: { office: OfficeResponse; athletes: LeaderRow[] }) {
  const logged = new Set(office.xpThisWeek.map((x) => x.userId));
  const leader = office.xpThisWeek[0];
  const count = athletes.length;

  return (
    <section className="week" aria-label="This week">
      <div className="week-head">
        <b>This week</b>
        <span>{formatWeekRange(office.week.start, office.week.end)}</span>
      </div>
      <div className="week-row" style={{ justifyContent: count <= 6 ? 'space-between' : 'flex-start', flexWrap: 'wrap', gap: '12px 14px' }}>
        {athletes.map((a) => {
          const done = logged.has(a.id);
          return (
            <div key={a.id} className={`wa ${done ? '' : 'off'}`}>
              <Avatar name={a.name} size={40} />
              {done ? (
                <i>
                  <CheckIcon size={10} strokeWidth={3.5} />
                </i>
              ) : null}
              <span>{a.name.trim().split(/\s+/)[0]}</span>
            </div>
          );
        })}
      </div>
      <p>
        {logged.size} of {count} logged
        {leader ? (
          <>
            {' '}
            · {leader.name.trim().split(/\s+/)[0]} leads with <b>{leader.xp} XP</b>
          </>
        ) : (
          ' · be the first to log this week'
        )}
      </p>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="fade-in" aria-busy="true">
      <div className="podium">
        {[78, 104, 58].map((h, i) => (
          <div key={i} className="pc" style={{ alignSelf: 'end' }}>
            <div className="skeleton" style={{ width: i === 1 ? 76 : 60, height: i === 1 ? 76 : 60, borderRadius: 999 }} />
            <div className="skeleton" style={{ width: '60%', height: 14, marginTop: 12 }} />
            <div className="skeleton" style={{ width: '100%', height: h, marginTop: 14, borderRadius: '14px 14px 4px 4px' }} />
          </div>
        ))}
      </div>
      <div className="lb-list">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="lb-row">
            <div className="skeleton" style={{ width: '100%', height: 40 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
