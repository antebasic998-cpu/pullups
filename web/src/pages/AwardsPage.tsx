import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { formatDate, pluralize } from '../lib/format';
import { Avatar, EmptyState } from '../components/Bits';
import { FlameIcon, InfoIcon, TrophyIcon } from '../components/Icons';
import type { Award } from '../types';

const TIER_COLOR: Record<string, string> = {
  bronze: 'var(--bronze)',
  silver: 'var(--silver)',
  gold: 'var(--gold)',
  legend: 'var(--accent)',
};

export function AwardsPage() {
  const version = useDataVersion();
  const { data, loading, error } = useAsync(() => api.office(), [version]);

  return (
    <div className="shell">
      <header className="mb-5">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Office awards</h1>
        <p className="m-0 mt-1 text-sm muted">
          {data && data.userCount > 0 ? (
            <>
              Week of {formatDate(data.week.start)} to {formatDate(data.week.end)} · {data.participants} of{' '}
              {pluralize(data.userCount, 'athlete')} logged a result
            </>
          ) : data ? (
            'Add athletes to start handing out prizes'
          ) : (
            'Fresh prizes every week'
          )}
        </p>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      ) : data ? (
        <>
          {data.participants === 0 ? (
            <EmptyState
              title="Nothing to award yet this week"
              message="Once anyone logs a result, the prizes below start filling in. They reset every Monday and are worked out from that week's results only."
            />
          ) : null}

          {/* This week's prizes */}
          <section className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.awards.map((award) => (
              <AwardCard key={award.id} award={award} />
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* XP race */}
            <section className="panel">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="m-0 section-title">XP this week</h2>
                <span className="text-xs faint" title={`${data.xpRules.perRep} XP per rep, plus bonuses for PBs and podiums`}>
                  1 XP per rep + bonuses
                </span>
              </div>
              {data.xpThisWeek.length === 0 ? (
                <p className="m-0 border-t px-4 py-4 text-sm muted" style={{ borderColor: 'var(--border)' }}>
                  No XP earned yet this week.
                </p>
              ) : (
                data.xpThisWeek.map((row) => {
                  const top = data.xpThisWeek[0].xp || 1;
                  return (
                    <div
                      key={row.userId}
                      className="row roster-cols"
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) 4rem auto' }}
                    >
                      <Link
                        to={`/users/${row.userId}`}
                        className="flex min-w-0 items-center gap-2.5 no-underline"
                        style={{ color: 'inherit' }}
                      >
                        <Avatar name={row.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{row.name}</span>
                          <span className="block h-1 w-24 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.round((row.xp / top) * 100)}%`, background: 'var(--accent)' }}
                            />
                          </span>
                        </span>
                      </Link>
                      <span className="num text-right font-semibold">{row.xp}</span>
                      <span className="text-right text-xs muted">
                        {row.sessions} {row.sessions === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  );
                })
              )}
            </section>

            {/* All-time XP / levels */}
            <section className="panel">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="m-0 section-title">Levels</h2>
                <span className="text-xs faint">XP never changes your score</span>
              </div>
              {data.leaderboard.length === 0 ? (
                <p className="m-0 border-t px-4 py-4 text-sm muted" style={{ borderColor: 'var(--border)' }}>
                  No athletes yet.
                </p>
              ) : (
                data.leaderboard.map((row) => (
                  <Link
                    key={row.id}
                    to={`/users/${row.id}`}
                    className="row"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={row.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="block truncate text-xs muted">
                          Level {row.level.level} · {row.level.title}
                        </span>
                      </span>
                    </span>
                    <span className="num text-right text-sm">
                      {row.xp}
                      <span className="faint text-xs"> XP</span>
                    </span>
                    <span className="text-right text-xs" style={{ color: 'var(--muted)' }}>
                      {row.level.isMax ? 'maxed' : `${row.level.xpToNext} to next`}
                    </span>
                  </Link>
                ))
              )}
            </section>
          </div>

          {/* Badge wall */}
          <section className="panel mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <h2 className="m-0 section-title">All badges</h2>
              <span className="text-xs faint">Grey ones are still up for grabs</span>
            </div>
            <div
              className="grid gap-2 border-t px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3"
              style={{ borderColor: 'var(--border)' }}
            >
              {data.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-start gap-2.5 rounded-xl border px-2.5 py-2"
                  style={{
                    borderColor: badge.holders > 0 ? 'var(--border)' : 'var(--border)',
                    borderStyle: badge.holders > 0 ? 'solid' : 'dashed',
                    background: badge.holders > 0 ? 'var(--surface-2)' : 'transparent',
                    opacity: badge.holders > 0 ? 1 : 0.6,
                  }}
                  title={badge.how}
                >
                  <span
                    className="flex size-7 flex-none items-center justify-center rounded-lg text-sm"
                    style={{
                      border: `1px solid ${badge.holders > 0 ? TIER_COLOR[badge.tier] : 'var(--border)'}`,
                      background: badge.holders > 0 ? 'var(--surface)' : 'transparent',
                      filter: badge.holders > 0 ? 'none' : 'grayscale(1)',
                    }}
                    aria-hidden="true"
                  >
                    {badge.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{badge.name}</span>
                    <span className="block truncate text-[0.7rem] faint">
                      {badge.holders === 0
                        ? badge.how
                        : `${badge.names.length <= 3 ? badge.names.join(', ') : `${badge.names.slice(0, 2).join(', ')} +${badge.names.length - 2}`}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="card mt-4 px-4 py-3.5">
            <h2 className="m-0 flex items-center gap-2 section-title">
              <InfoIcon size={13} />
              How XP works
            </h2>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs muted">
              <li>
                <span className="num">{data.xpRules.perRep} XP</span> for every pull-up you complete.
              </li>
              <li>
                <span className="num">+{data.xpRules.newAbsolutePb} XP</span> for a new personal best,{' '}
                <span className="num">+{data.xpRules.newNormalizedPb} XP</span> for beating your best score.
              </li>
              <li>
                <span className="num">+{data.xpRules.enterTop3} XP</span> for ending a day on the podium,{' '}
                <span className="num">+{data.xpRules.reachNumberOne} XP</span> for ending a day at number one.
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs faint">
              {data.levels.map((l) => (
                <span key={l.level} title={`${l.xp} XP`}>
                  <span className="num">{l.level}</span> {l.title}
                </span>
              ))}
            </div>
          </section>

          <p className="mt-3 text-xs faint">
            Prizes are recalculated from the week's results every time you open this page — no voting, no
            arguments. <TrophyIcon size={11} className="inline" /> Badges unlock once and stay on your profile.
            <FlameIcon size={11} className="ml-1 inline" /> Streaks survive until a full week passes without a
            result.
          </p>
        </>
      ) : null}
    </div>
  );
}

function AwardCard({ award }: { award: Award }) {
  const won = Boolean(award.winner);
  return (
    <div
      className="card flex flex-col gap-1.5 px-3.5 py-3"
      style={{
        borderStyle: won ? 'solid' : 'dashed',
        background: won ? 'var(--surface-2)' : 'transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true" style={{ filter: won ? 'none' : 'grayscale(1)' }}>
          {award.emoji}
        </span>
        <span className="text-sm font-semibold">{award.title}</span>
      </div>

      {award.winner ? (
        <Link
          to={`/users/${award.winner.userId}`}
          className="flex items-center justify-between gap-2 no-underline"
          style={{ color: 'inherit' }}
        >
          <span className="min-w-0 truncate text-sm">{award.winner.name}</span>
          <span className="num flex-none text-xs muted">{award.winner.detail}</span>
        </Link>
      ) : (
        <span className="text-xs faint">{award.how}</span>
      )}
    </div>
  );
}
