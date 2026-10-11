import type { CSSProperties } from 'react';
import type { Badge, Level, Streaks } from '../types';
import { formatDateShort } from '../lib/format';
import { Avatar } from './Bits';
import { FlameIcon } from './Icons';

const TIER_COLOR: Record<string, string> = {
  bronze: 'var(--bronze)',
  silver: 'var(--silver)',
  gold: 'var(--gold)',
  legend: 'var(--accent)',
};

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

/** Avatar with a level-progress ring around it and a "LVL n" pill underneath. */
export function LevelRing({ name, userId, level }: { name: string; userId?: string; level: Level | null }) {
  const pct = level ? Math.min(100, Math.max(0, level.progress)) : 0;
  return (
    <div className="lvl-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="trk" cx="50" cy="50" r={RING_R} />
        <circle
          className="prg"
          cx="50"
          cy="50"
          r={RING_R}
          strokeDasharray={`${((RING_C * pct) / 100).toFixed(1)} 999`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <Avatar name={name} userId={userId} size={74} />
      {level ? <i className="lvl">LVL {level.level}</i> : null}
    </div>
  );
}

/** "4-week streak", "Back today", … or null when there is nothing to show. */
export function streakLabel(streaks: Streaks): string | null {
  if (streaks.weeks === 0 && streaks.days === 0) return null;
  if (streaks.weeks > 1) {
    return `${streaks.weeks}-week streak${streaks.bestWeeks > streaks.weeks ? ` (best ${streaks.bestWeeks})` : ''}`;
  }
  return streaks.days === 1 ? 'Back today' : `${streaks.days} days in a row`;
}

/** Level title, XP bar and streak. Deliberately says nothing about the score – XP never changes it. */
export function XpProgress({ level, streaks }: { level: Level; streaks: Streaks }) {
  const streak = streakLabel(streaks);
  return (
    <div className="xp">
      <div className="xp-line">
        <b>{level.title}</b>
        <span className="num">
          {level.isMax ? `${level.xp} XP · maxed out` : `${level.xp} / ${level.xp + level.xpToNext} XP`}
        </span>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-valuenow={Math.round(level.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level.level} progress`}
      >
        <i style={{ width: `${level.progress}%` }} />
      </div>
      <div className="xp-line">
        <span>
          {level.isMax ? 'Office Legend — nothing left to prove.' : `${level.xpToNext} XP to ${level.nextTitle}`}
        </span>
        {streak ? (
          <span className="streak">
            <FlameIcon size={13} strokeWidth={2.2} />
            {streak}
          </span>
        ) : (
          <span>No streak yet</span>
        )}
      </div>
    </div>
  );
}

const shortDate = (value: string | null): string | null =>
  value ? (/^\d{4}-\d{2}-\d{2}/.test(value) ? formatDateShort(value.slice(0, 10)) : value) : null;

/** A round, tier-ringed badge for the horizontal swipe row. Locked ones are dashed and grey. */
export function BadgeMedal({ badge }: { badge: Badge }) {
  const title = badge.unlocked
    ? `${badge.name} — unlocked${badge.unlockedAt ? ` on ${shortDate(badge.unlockedAt)}` : ''}`
    : `${badge.name} — ${badge.how}${badge.progress ? ` (${badge.progress.raw}/${badge.progress.target})` : ''}`;

  return (
    <div
      className={`bd ${badge.unlocked ? '' : 'lock'}`}
      style={{ '--t': TIER_COLOR[badge.tier] ?? 'var(--muted)' } as CSSProperties}
      title={title}
    >
      <div className="c">
        <span aria-hidden="true">{badge.emoji}</span>
      </div>
      <b>{badge.name}</b>
      <small>
        {badge.unlocked
          ? (shortDate(badge.unlockedAt) ?? 'unlocked')
          : badge.progress
            ? `${badge.progress.raw} / ${badge.progress.target}`
            : 'locked'}
      </small>
    </div>
  );
}
