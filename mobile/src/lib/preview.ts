import type { LeaderRow } from '../types';

/** Mirrors server/gamify.js XP_RULES – only used for the Log sheet's live estimate. */
export const XP = { perRep: 1, newAbsolutePb: 10, newNormalizedPb: 20 } as const;

export interface LogPreview {
  score: number;
  isFirst: boolean;
  isPb: boolean;
  /** Points under the athlete's standing best (0 when it is a new best). */
  below: number;
  /** XP from reps + PB bonuses. Podium bonuses depend on who else logs that day, so they are not counted. */
  xp: number;
  rankBefore: number | null;
  rankAfter: number;
  /** The neighbour that decides the rank line: the runner-up when #1, otherwise the athlete just ahead. */
  neighbour: { name: string; gap: number; ahead: boolean } | null;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * What would happen to the board if this result were saved. Pure arithmetic on
 * data the page already has – nothing is written.
 */
export function previewLog(user: LeaderRow, rows: LeaderRow[], reps: number, score: number): LogPreview {
  const isFirst = user.sessionCount === 0;
  const best = isFirst ? 0 : user.pbNormalized;
  const isPb = isFirst || score > best;
  const newBest = Math.max(best, score);

  const others = rows
    .filter((r) => r.id !== user.id && r.rank !== null)
    .sort((a, b) => b.pbNormalized - a.pbNormalized);
  const ahead = others.filter((o) => o.pbNormalized > newBest);
  const rankAfter = ahead.length + 1;

  let neighbour: LogPreview['neighbour'] = null;
  if (rankAfter === 1 && others.length > 0) {
    neighbour = { name: first(others[0].name), gap: newBest - others[0].pbNormalized, ahead: false };
  } else if (rankAfter > 1) {
    const above = ahead[ahead.length - 1];
    neighbour = { name: first(above.name), gap: above.pbNormalized - newBest, ahead: true };
  }

  const xp =
    reps * XP.perRep +
    (!isFirst && reps > user.pbAbsolute ? XP.newAbsolutePb : 0) +
    (!isFirst && score > user.pbNormalized ? XP.newNormalizedPb : 0);

  return {
    score,
    isFirst,
    isPb,
    below: isPb ? 0 : best - score,
    xp,
    rankBefore: user.rank,
    rankAfter,
    neighbour,
  };
}
