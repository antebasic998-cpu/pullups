import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { useDataVersion } from '../lib/store';
import { formatWeekRange, pluralize } from '../lib/format';
import { Avatar, EmptyState, PageHeader } from '../components/Bits';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { FlameIcon, InfoIcon, TrophyIcon } from '../components/Icons';
import type { Award, ExerciseCategory } from '../types';

const TIER_COLOR: Record<string, string> = {
  bronze: 'var(--bronze)',
  silver: 'var(--silver)',
  gold: 'var(--gold)',
  legend: 'var(--accent)',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function AwardsPage() {
  const version = useDataVersion();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const { data, loading, error } = useAsync(
    () => api.office(selectedCategory?.slug),
    [version, selectedCategory?.slug],
  );
  const exerciseLabel = data?.category?.name ?? selectedCategory?.name ?? 'this exercise';
  const topXp = data?.xpThisWeek[0]?.xp || 1;

  return (
    <div className="shell">
      <PageHeader
        eyebrow={data ? formatWeekRange(data.week.start, data.week.end) : 'This week'}
        title="Awards"
        right={
          <ExerciseSelector selected={selectedCategory} onSelect={setSelectedCategory} loading={loading} compact />
        }
      />
      <p className="blurb">
        {data && data.userCount > 0
          ? `${exerciseLabel} · ${data.participants} of ${pluralize(data.userCount, 'athlete')} logged a result · resets Monday`
          : data
            ? 'Add athletes to start handing out prizes'
            : 'Fresh prizes every week'}
      </p>

      {error ? <p className="error-text">{error}</p> : null}

      {loading && !data ? (
        <div className="agrid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 132, borderRadius: 20 }} />
          ))}
        </div>
      ) : data ? (
        <div className="fade-in" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
          {data.participants === 0 ? (
            <EmptyState
              title="Nothing to award yet this week"
              message="Once anyone logs a result, the prizes below start filling in. They reset every Monday and are worked out from that week's results only."
            />
          ) : null}

          {/* This week's prizes */}
          <section className="agrid" aria-label="This week's prizes">
            {data.awards.map((award) => (
              <AwardCard key={award.id} award={award} />
            ))}
          </section>

          {/* XP race */}
          <section className="a-card">
            <div className="card-head">
              <h3>XP this week</h3>
              <small title={`${data.xpRules.perRep} XP per rep, plus bonuses for PBs and podiums`}>
                1 XP per rep + bonuses
              </small>
            </div>
            {data.xpThisWeek.length === 0 ? (
              <p className="m-0 text-sm muted">No XP earned yet this week.</p>
            ) : (
              data.xpThisWeek.map((row) => (
                <Link key={row.userId} to={`/users/${row.userId}`} className="xr">
                  <Avatar name={row.name} userId={row.userId} size={36} />
                  <div className="m">
                    <b>{firstName(row.name)}</b>
                    <div className="tr">
                      <i style={{ width: `${Math.round((row.xp / topXp) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="n">{row.xp}</span>
                </Link>
              ))
            )}
          </section>

          {/* All-time XP / levels */}
          <section className="a-card">
            <div className="card-head">
              <h3>Levels</h3>
              <small>XP never changes your score</small>
            </div>
            {data.leaderboard.length === 0 ? (
              <p className="m-0 text-sm muted">No athletes yet.</p>
            ) : (
              data.leaderboard.map((row) => (
                <Link key={row.id} to={`/users/${row.id}`} className="xr">
                  <Avatar name={row.name} userId={row.id} size={36} />
                  <div className="m">
                    <b>{row.name}</b> <span>· {row.level.title}</span>
                    <div className="tr gold">
                      <i style={{ width: `${row.level.progress}%` }} />
                    </div>
                  </div>
                  <span className="lv">L{row.level.level}</span>
                </Link>
              ))
            )}
          </section>

          {/* Badge wall */}
          <section className="a-card">
            <div className="card-head">
              <h3>All badges</h3>
              <small>Grey ones are still up for grabs</small>
            </div>
            <div className="badge-wall">
              {data.badges.map((badge) => (
                <div
                  key={badge.id}
                  className={badge.holders > 0 ? '' : 'none'}
                  style={{ '--t': TIER_COLOR[badge.tier] } as CSSProperties}
                  title={badge.how}
                >
                  <span className="bi" aria-hidden="true">
                    {badge.emoji}
                  </span>
                  <span>
                    <b>{badge.name}</b>
                    <small>
                      {badge.holders === 0
                        ? badge.how
                        : badge.names.length <= 3
                          ? badge.names.join(', ')
                          : `${badge.names.slice(0, 2).join(', ')} +${badge.names.length - 2}`}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="a-card">
            <h3 className="m-0 flex items-center gap-2 text-[15px] font-bold">
              <InfoIcon size={15} />
              How XP works
            </h3>
            <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[13px] muted">
              <li>
                <span className="num">{data.xpRules.perRep} XP</span> for every {exerciseLabel.toLowerCase()} rep you complete.
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

          <p className="foot">
            Prizes are recalculated from the week's results every time you open this page — no voting, no
            arguments. <TrophyIcon size={11} className="inline" /> Badges unlock once and stay on your profile.
            <FlameIcon size={11} className="ml-1 inline" /> Streaks survive until a full week passes without a
            result.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AwardCard({ award }: { award: Award }) {
  const w = award.winner;
  if (!w) {
    return (
      <div className="aw no">
        <span className="e" aria-hidden="true">
          {award.emoji}
        </span>
        <h4>{award.title}</h4>
        <p>{award.how}</p>
      </div>
    );
  }
  return (
    <div className="aw">
      <span className="e" aria-hidden="true">
        {award.emoji}
      </span>
      <h4>{award.title}</h4>
      <Link to={`/users/${w.userId}`} className="w">
        <Avatar name={w.name} userId={w.userId} size={30} />
        <div>
          <b>{firstName(w.name)}</b>
          <small>{w.detail}</small>
        </div>
      </Link>
    </div>
  );
}
