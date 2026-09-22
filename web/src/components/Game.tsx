import type { Badge, Level, Streaks } from '../types';
import { FlameIcon } from './Icons';

const TIER_COLOR: Record<string, string> = {
  bronze: 'var(--bronze)',
  silver: 'var(--silver)',
  gold: 'var(--gold)',
  legend: 'var(--accent)',
};

/** Level + XP progress. Deliberately says "XP never changes your score". */
export function LevelCard({ level, streaks }: { level: Level; streaks: Streaks }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs faint">Level {level.level}</span>
          <span className="text-sm font-semibold">{level.title}</span>
        </div>
        <span className="num text-xs muted">
          {level.isMax ? `${level.xp} XP · maxed out` : `${level.xp} / ${level.xp + level.xpToNext} XP`}
        </span>
      </div>

      <div
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
        role="progressbar"
        aria-valuenow={Math.round(level.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level.level} progress`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${level.progress}%`, background: 'var(--accent)' }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs faint">
        <span>
          {level.isMax
            ? 'Office Legend — nothing left to prove.'
            : `${level.xpToNext} XP to ${level.nextTitle}`}
        </span>
        <StreakLine streaks={streaks} />
      </div>
    </div>
  );
}

export function StreakLine({ streaks }: { streaks: Streaks }) {
  if (streaks.weeks === 0 && streaks.days === 0) {
    return <span>No streak yet — log a result to start one</span>;
  }
  if (streaks.weeks > 1) {
    return (
      <span className="inline-flex items-center gap-1">
        <FlameIcon size={12} style={{ color: 'var(--down)' }} />
        {streaks.weeks}-week streak
        {streaks.bestWeeks > streaks.weeks ? ` (best ${streaks.bestWeeks})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <FlameIcon size={12} style={{ color: 'var(--down)' }} />
      {streaks.days === 1 ? 'Back today' : `${streaks.days} days in a row`}
    </span>
  );
}

export function BadgeTile({ badge, compact = false }: { badge: Badge; compact?: boolean }) {
  const color = TIER_COLOR[badge.tier] ?? 'var(--muted)';
  const title = badge.unlocked
    ? `${badge.name} — unlocked${badge.unlockedAt ? ` on ${badge.unlockedAt}` : ''}`
    : `${badge.name} — ${badge.how}${badge.progress ? ` (${badge.progress.raw}/${badge.progress.target})` : ''}`;

  return (
    <div
      title={title}
      className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2"
      style={{
        borderColor: badge.unlocked ? 'var(--border)' : 'var(--border)',
        borderStyle: badge.unlocked ? 'solid' : 'dashed',
        background: badge.unlocked ? 'var(--surface-2)' : 'transparent',
        opacity: badge.unlocked ? 1 : 0.55,
      }}
    >
      <span
        className="flex size-7 flex-none items-center justify-center rounded-lg text-sm"
        style={{
          background: badge.unlocked ? 'var(--surface)' : 'transparent',
          border: badge.unlocked ? `1px solid ${color}` : '1px solid var(--border)',
          filter: badge.unlocked ? 'none' : 'grayscale(1)',
        }}
        aria-hidden="true"
      >
        {badge.emoji}
      </span>

      {!compact ? (
        <span className="min-w-0">
          <span
            className="block truncate text-xs font-medium"
            style={{ color: badge.unlocked ? 'var(--text)' : 'var(--muted)' }}
          >
            {badge.name}
          </span>
          <span className="block truncate text-[0.7rem] faint">
            {badge.unlocked
              ? badge.unlockedAt
              : badge.progress
                ? `${badge.progress.raw} / ${badge.progress.target}`
                : 'locked'}
          </span>
        </span>
      ) : null}
    </div>
  );
}
