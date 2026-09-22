/**
 * Gamification engine.
 *
 * Everything here is DERIVED from the recorded results – nothing extra is stored
 * in db.json. That means:
 *   • your existing data needs no migration,
 *   • XP, badges and streaks can never drift out of sync with the results,
 *   • tuning the constants below instantly re-scores the whole office.
 *
 * Sessions are replayed in chronological order, so every award and bonus is
 * judged against the board as it stood on that day – not against today's board.
 */
import { normalizedScore, round } from './scoring.js';

/* ------------------------------------------------------------------ *
 * Tuning
 * ------------------------------------------------------------------ */
export const XP_RULES = {
  perRep: 1,
  newAbsolutePb: 10,
  newNormalizedPb: 20,
  enterTop3: 25,
  reachNumberOne: 50,
};

/** Cumulative XP to reach each level. */
export const LEVELS = [
  { level: 1, title: 'Bar Tourist', xp: 0 },
  { level: 2, title: 'Beginner', xp: 25 },
  { level: 3, title: 'Regular', xp: 75 },
  { level: 4, title: 'Pull-up Apprentice', xp: 175 },
  { level: 5, title: 'Bar Rat', xp: 325 },
  { level: 6, title: 'Pull-up Grinder', xp: 550 },
  { level: 7, title: 'Beast', xp: 850 },
  { level: 8, title: 'Veteran', xp: 1250 },
  { level: 9, title: 'Monster', xp: 1750 },
  { level: 10, title: 'Office Legend', xp: 2400 },
];

/** Normalized score that earns the Outlier badge. Tune to your office. */
export const OUTLIER_SCORE = 25;

/** How many athletes must have logged a result before podium/#1 badges count. */
export const MIN_PODIUM_FIELD = 3;

const TIERS = { bronze: 'bronze', silver: 'silver', gold: 'gold', legend: 'legend' };
export { TIERS };

/* ------------------------------------------------------------------ *
 * Date helpers – weeks run Monday → Sunday
 * ------------------------------------------------------------------ */
const dayKey = (iso) => iso.slice(0, 10);

/**
 * Always format in *local* time. `toISOString()` would convert local midnight to
 * UTC and hand back the previous day for anyone east of Greenwich.
 */
const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function mondayOf(iso) {
  const d = new Date(`${dayKey(iso)}T00:00:00`);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return localISO(d);
}

const shiftDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localISO(d);
};

export function todayISO() {
  return localISO(new Date());
}

/* ------------------------------------------------------------------ *
 * Badge catalogue
 * ------------------------------------------------------------------ */
/**
 * `progress(current)` returns { value, target } for badges you can watch creep
 * up, or null for one-off events.
 */
export const BADGES = [
  {
    id: 'first_rep',
    emoji: '🎬',
    name: 'First Rep',
    tier: TIERS.bronze,
    how: 'Log your very first result.',
  },
  { id: 'reps_10', emoji: '🔟', name: '10 Club', tier: TIERS.bronze, how: 'Reach 10 pull-ups in one set.' },
  { id: 'reps_20', emoji: '🏅', name: '20 Club', tier: TIERS.silver, how: 'Reach 20 pull-ups in one set.' },
  { id: 'reps_30', emoji: '🥇', name: '30 Club', tier: TIERS.gold, how: 'Reach 30 pull-ups in one set.' },
  { id: 'reps_50', emoji: '👑', name: '50 Club', tier: TIERS.legend, how: 'Reach 50 pull-ups in one set.' },
  { id: 'century', emoji: '💯', name: 'Century', tier: TIERS.silver, how: 'Record 100 pull-ups in total.' },
  {
    id: 'new_pb',
    emoji: '⚡',
    name: 'New PB',
    tier: TIERS.bronze,
    how: 'Beat your own best set after your first result.',
  },
  {
    id: 'pb_crusher',
    emoji: '🚀',
    name: 'PB Crusher',
    tier: TIERS.silver,
    how: 'Smash a personal best by 3 or more reps in one go.',
  },
  { id: 'top3', emoji: '🥉', name: 'Podium', tier: TIERS.silver, how: 'Climb into the top three of the board.' },
  { id: 'number_one', emoji: '🏆', name: '#1', tier: TIERS.gold, how: 'Take the top spot in the office.' },
  {
    id: 'heavy_hitter',
    emoji: '🦍',
    name: 'Heavy Hitter',
    tier: TIERS.silver,
    how: 'Do 10+ pull-ups while weighing 90 kg or more.',
  },
  {
    id: 'lightweight_beast',
    emoji: '🪶',
    name: 'Lightweight Beast',
    tier: TIERS.silver,
    how: 'Do 15+ pull-ups while weighing under 70 kg.',
  },
  {
    id: 'comeback',
    emoji: '💀',
    name: 'Comeback',
    tier: TIERS.gold,
    how: 'Beat your old best after a session that fell short of it.',
  },
  {
    id: 'consistency',
    emoji: '📅',
    name: 'Consistency',
    tier: TIERS.silver,
    how: 'Record a result four weeks in a row.',
  },
  {
    id: 'unstoppable',
    emoji: '🔥',
    name: 'Unstoppable',
    tier: TIERS.gold,
    how: 'Record a result ten days in a row.',
  },
  {
    id: 'outlier',
    emoji: '🎯',
    name: 'Outlier',
    tier: TIERS.legend,
    how: `Score above ${OUTLIER_SCORE} normalized points.`,
  },
];

/* ------------------------------------------------------------------ *
 * Levels
 * ------------------------------------------------------------------ */
export function levelFor(xp) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (xp >= LEVELS[i].xp) index = i;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  return {
    level: current.level,
    title: current.title,
    xp,
    xpIntoLevel: xp - current.xp,
    xpForLevel: next ? next.xp - current.xp : 0,
    xpToNext: next ? next.xp - xp : 0,
    nextTitle: next ? next.title : null,
    progress: next ? round(((xp - current.xp) / (next.xp - current.xp)) * 100, 1) : 100,
    isMax: !next,
  };
}

/* ------------------------------------------------------------------ *
 * The replay
 * ------------------------------------------------------------------ */
/**
 * @param {{ users: Array, sessions: Array, medianMassKg: number }} input
 */
export function buildGame({ users, sessions, medianMassKg }) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const massOf = (session, user) => {
    const w = Number(session.weightKg);
    return Number.isFinite(w) && w > 0 ? w : Number(user?.weightKg ?? 0);
  };

  const ordered = [...sessions]
    .filter((s) => byId.has(s.userId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.createdAt).localeCompare(String(b.createdAt))));

  // Per-athlete running state
  const state = new Map(
    users.map((u) => [
      u.id,
      {
        user: u,
        xp: 0,
        totalReps: 0,
        sessionCount: 0,
        pbReps: 0,
        pbNormalized: 0,
        bestNormalized: 0,
        firstNormalized: null,
        last: null,
        dates: new Set(),
        weeks: new Set(),
        weeksWithMultiple: new Map(),
        unlocked: new Map(), // badgeId → date
        events: [],
        wasTop3: false,
        wasNumberOne: false,
        dipped: false,
        xpByWeek: new Map(),
        repsByWeek: new Map(),
        sessionsByWeek: new Map(),
        bestByWeek: new Map(),
        firstByWeek: new Map(),
        shortOfPbByWeek: new Map(),
        nearPbByWeek: new Map(),
        bestBeforeWeek: new Map(),
      },
    ]),
  );

  /** Current best normalized per user, used to judge rank at the time. */
  const boardBest = new Map();

  const rankOf = (userId, value) => {
    let ahead = 0;
    for (const [id, best] of boardBest) {
      if (id === userId) continue;
      if (best > value) ahead += 1;
    }
    return ahead + 1;
  };

  /**
   * Award podium recognition to everyone who currently sits in the top three —
   * not only to the athlete who just logged. Otherwise the person who was
   * overtaken into third place would never be recognised.
   */
  const settlePodium = (date) => {
    if (boardBest.size < MIN_PODIUM_FIELD) return;
    for (const [id, best] of boardBest) {
      if (best <= 0) continue;
      const entry = state.get(id);
      if (!entry) continue;
      const rank = rankOf(id, best);
      if (rank <= 3 && !entry.wasTop3) {
        entry.wasTop3 = true;
        addXp(entry, XP_RULES.enterTop3, date);
        unlock(entry, 'top3', date);
      }
      if (rank === 1 && !entry.wasNumberOne) {
        entry.wasNumberOne = true;
        addXp(entry, XP_RULES.reachNumberOne, date);
        unlock(entry, 'number_one', date);
      }
    }
  };

  const unlock = (entry, badgeId, date) => {
    if (entry.unlocked.has(badgeId)) return false;
    entry.unlocked.set(badgeId, date);
    return true;
  };

  const addXp = (entry, amount, date) => {
    if (amount <= 0) return;
    entry.xp += amount;
    if (!entry.xpByWeek.has(mondayOf(date))) entry.xpByWeek.set(mondayOf(date), 0);
    entry.xpByWeek.set(mondayOf(date), entry.xpByWeek.get(mondayOf(date)) + amount);
  };

  let settlingDay = null;

  for (const session of ordered) {
    // Ranks settle at the end of each day, so a thin field at 9am cannot hand
    // out a podium to whoever happened to log third.
    if (settlingDay !== null && dayKey(session.date) !== settlingDay) settlePodium(settlingDay);
    settlingDay = dayKey(session.date);

    const entry = state.get(session.userId);
    const user = entry.user;
    const reps = Number(session.reps);
    const mass = massOf(session, user);
    const normalized = normalizedScore(reps, mass, medianMassKg);
    const date = dayKey(session.date);
    const week = mondayOf(date);
    const pbBefore = entry.pbReps;
    const normalizedBefore = entry.bestNormalized;
    const first = entry.sessionCount === 0;

    entry.sessionCount += 1;
    entry.totalReps += reps;
    entry.dates.add(date);
    entry.weeks.add(week);
    entry.sessionsByWeek.set(week, (entry.sessionsByWeek.get(week) ?? 0) + 1);
    entry.repsByWeek.set(week, (entry.repsByWeek.get(week) ?? 0) + reps);
    entry.last = { date, reps, normalized };

    // ---- XP: the work itself
    addXp(entry, reps * XP_RULES.perRep, date);

    // ---- XP + badges for beating yourself
    if (!first && reps > pbBefore) {
      addXp(entry, XP_RULES.newAbsolutePb, date);
      unlock(entry, 'new_pb', date);
      if (reps - pbBefore >= 3) unlock(entry, 'pb_crusher', date);
      if (entry.dipped) unlock(entry, 'comeback', date);
      entry.events.push({ date, type: 'pb', reps, previous: pbBefore });
    }
    if (!first && normalized > normalizedBefore) addXp(entry, XP_RULES.newNormalizedPb, date);

    // A session that fell short of the standing best opens the comeback window.
    if (!first && reps < pbBefore) entry.dipped = true;

    if (reps > entry.pbReps) entry.pbReps = reps;
    if (normalized > entry.bestNormalized) entry.bestNormalized = normalized;
    if (entry.firstNormalized === null) entry.firstNormalized = normalized;

    // ---- XP for climbing the board
    // Rank badges need a real field to beat: being "top 3" when only one or two
    // colleagues have logged anything yet would hand them out for free.
    boardBest.set(session.userId, Math.max(boardBest.get(session.userId) ?? 0, normalized));

    // ---- badges tied to a single attempt
    if (reps >= 10) unlock(entry, 'reps_10', date);
    if (reps >= 20) unlock(entry, 'reps_20', date);
    if (reps >= 30) unlock(entry, 'reps_30', date);
    if (reps >= 50) unlock(entry, 'reps_50', date);
    if (mass >= 90 && reps >= 10) unlock(entry, 'heavy_hitter', date);
    if (mass < 70 && reps >= 15) unlock(entry, 'lightweight_beast', date);
    if (normalized > OUTLIER_SCORE) unlock(entry, 'outlier', date);
    unlock(entry, 'first_rep', date);
    if (entry.totalReps >= 100) unlock(entry, 'century', date);

    // ---- weekly bookkeeping for the office awards
    const weekBest = entry.bestByWeek.get(week) ?? 0;
    if (normalized > weekBest) entry.bestByWeek.set(week, normalized);
    if (!entry.firstByWeek.has(week)) entry.firstByWeek.set(week, normalized);
    if (!entry.bestBeforeWeek.has(week)) entry.bestBeforeWeek.set(week, normalizedBefore);
    if (!first && reps < pbBefore) entry.shortOfPbByWeek.set(week, (entry.shortOfPbByWeek.get(week) ?? 0) + 1);
    if (!first && reps >= pbBefore - 1 && reps <= pbBefore) {
      entry.nearPbByWeek.set(week, (entry.nearPbByWeek.get(week) ?? 0) + 1);
    }
  }

  if (settlingDay !== null) settlePodium(settlingDay);

  // ---- streaks + badge follow-ups that need the full history
  const result = new Map();
  for (const [id, entry] of state) {
    const weeks = [...entry.weeks].sort();
    const days = [...entry.dates].sort();

    const bestWeekStreak = longestRun(weeks, (iso) => shiftDays(iso, -7));
    const weekStreak = currentRun(weeks, (iso) => shiftDays(iso, -7), mondayOf(todayISO()));
    const bestDayStreak = longestRun(days, (iso) => shiftDays(iso, -1));
    const dayStreak = currentRun(days, (iso) => shiftDays(iso, -1), todayISO());

    if (weekStreak >= 4 || bestWeekStreak >= 4) {
      unlock(entry, 'consistency', entry.last?.date ?? todayISO());
    }
    if (dayStreak >= 10 || bestDayStreak >= 10) {
      unlock(entry, 'unstoppable', entry.last?.date ?? todayISO());
    }

    const xp = entry.xp;
    result.set(id, {
      id,
      userId: id,
      name: entry.user.name,
      xp,
      level: levelFor(xp),
      totalReps: entry.totalReps,
      sessionCount: entry.sessionCount,
      pbReps: entry.pbReps,
      pbNormalized: round(entry.bestNormalized, 2),
      firstNormalized: entry.firstNormalized === null ? null : round(entry.firstNormalized, 2),
      improvementPercent:
        entry.firstNormalized !== null && entry.firstNormalized > 0 && entry.sessionCount > 1
          ? round(((entry.bestNormalized - entry.firstNormalized) / entry.firstNormalized) * 100, 0)
          : null,
      improvementPoints:
        entry.firstNormalized === null ? null : round(entry.bestNormalized - entry.firstNormalized, 2),
      streaks: {
        weeks: weekStreak,
        bestWeeks: bestWeekStreak,
        days: dayStreak,
        bestDays: bestDayStreak,
        lastDate: entry.last?.date ?? null,
        activeWeeks: weeks.length,
      },
      last: entry.last,
      /** badgeId → date it was unlocked */
      unlockedAtBadges: Object.fromEntries(entry.unlocked),
      // per-week numbers used by the office awards
      weeks: {
        xpByWeek: entry.xpByWeek,
        repsByWeek: entry.repsByWeek,
        sessionsByWeek: entry.sessionsByWeek,
        bestByWeek: entry.bestByWeek,
        firstByWeek: entry.firstByWeek,
        bestBeforeWeek: entry.bestBeforeWeek,
        shortOfPbByWeek: entry.shortOfPbByWeek,
        nearPbByWeek: entry.nearPbByWeek,
      },
    });
  }

  for (const athlete of result.values()) athlete.badges = athleteBadges(athlete);

  return { athletes: result, badgeCounts: badgeCounts(result), week: currentWeek() };
}

/** First Monday of the current week, plus its Sunday. */
export function currentWeek() {
  const monday = mondayOf(todayISO());
  return { start: monday, end: shiftDays(monday, 6) };
}

/* ------------------------------------------------------------------ *
 * Badge state per athlete + office-wide badge counts
 * ------------------------------------------------------------------ */

/** Badges you can watch creep up, with the number that drives them. */
function badgeProgress(id, athlete) {
  switch (id) {
    case 'reps_10':
      return { value: athlete.pbReps, target: 10 };
    case 'reps_20':
      return { value: athlete.pbReps, target: 20 };
    case 'reps_30':
      return { value: athlete.pbReps, target: 30 };
    case 'reps_50':
      return { value: athlete.pbReps, target: 50 };
    case 'century':
      return { value: athlete.totalReps, target: 100 };
    case 'consistency':
      return { value: athlete.streaks.bestWeeks, target: 4 };
    case 'unstoppable':
      return { value: athlete.streaks.bestDays, target: 10 };
    case 'outlier':
      return { value: athlete.pbNormalized, target: OUTLIER_SCORE };
    default:
      return null;
  }
}

export function athleteBadges(athlete) {
  return BADGES.map((badge) => {
    const unlockedAt = athlete.unlockedAtBadges?.[badge.id] ?? null;
    const progress = badgeProgress(badge.id, athlete);
    return {
      id: badge.id,
      emoji: badge.emoji,
      name: badge.name,
      tier: badge.tier,
      how: badge.how,
      unlocked: Boolean(unlockedAt),
      unlockedAt,
      progress: progress
        ? {
            value: round(Math.min(progress.value, progress.target), 2),
            raw: round(progress.value, 2),
            target: progress.target,
            percent: round(Math.min(100, (progress.value / progress.target) * 100), 0),
          }
        : null,
    };
  });
}

function badgeCounts(athletes) {
  const counts = {};
  for (const badge of BADGES) counts[badge.id] = 0;
  for (const athlete of athletes.values()) {
    for (const badge of athlete.badges) if (badge.unlocked) counts[badge.id] += 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 * Runs of consecutive entries
 * ------------------------------------------------------------------ */
function longestRun(sorted, previous) {
  let best = 0;
  let run = 0;
  let last = null;
  for (const value of sorted) {
    run = last !== null && previous(value) === last ? run + 1 : 1;
    if (run > best) best = run;
    last = value;
  }
  return best;
}

/**
 * Length of the run ending at (or just before) `anchor`. A week that has not
 * been logged *yet* does not break the streak – looking at the board on Monday
 * morning should not show a streak broken by yesterday.
 */
function currentRun(sorted, previous, anchor) {
  if (sorted.length === 0) return 0;
  const set = new Set(sorted);
  let cursor = anchor;
  if (!set.has(cursor)) {
    const previousSlot = previous(anchor);
    if (!set.has(previousSlot)) return 0;
    cursor = previousSlot;
  }
  let run = 0;
  while (set.has(cursor)) {
    run += 1;
    cursor = previous(cursor);
  }
  return run;
}

/* ------------------------------------------------------------------ *
 * Office awards for the current week
 * ------------------------------------------------------------------ */
const AWARDS = [
  {
    id: 'beast',
    emoji: '🦁',
    title: 'The Beast',
    how: 'Highest normalized score this week.',
    pick: (rows) => maxBy(rows, (r) => r.bestThisWeek),
    format: (r) => `${r.bestThisWeek.toFixed(2)} pts`,
    min: (r) => r.bestThisWeek > 0,
  },
  {
    id: 'grinder',
    emoji: '📈',
    title: 'The Grinder',
    how: 'Biggest improvement on their own best this week.',
    pick: (rows) =>
      maxBy(
        rows.filter((r) => r.bestBefore > 0 && r.bestThisWeek > r.bestBefore),
        (r) => r.bestThisWeek - r.bestBefore,
      ),
    format: (r) => `+${(r.bestThisWeek - r.bestBefore).toFixed(2)} pts`,
    min: (r) => r.bestThisWeek > r.bestBefore && r.bestBefore > 0,
  },
  {
    id: 'heavyweight',
    emoji: '🦍',
    title: 'The Heavyweight',
    how: 'Best score this week from an athlete weighing 90 kg or more.',
    pick: (rows) => maxBy(rows.filter((r) => r.weightKg >= 90), (r) => r.bestThisWeek),
    format: (r) => `${r.bestThisWeek.toFixed(2)} pts at ${r.weightKg} kg`,
    min: (r) => r.bestThisWeek > 0,
  },
  {
    id: 'comeback',
    emoji: '💀',
    title: 'The Comeback',
    how: 'Started the week below their own best, then beat it anyway.',
    pick: (rows) =>
      maxBy(
        rows.filter((r) => r.bestBefore > 0 && r.firstThisWeek < r.bestBefore && r.bestThisWeek > r.bestBefore),
        (r) => r.bestThisWeek - r.bestBefore,
      ),
    format: (r) => `+${(r.bestThisWeek - r.bestBefore).toFixed(2)} pts after a dip`,
    min: (r) => r.bestBefore > 0 && r.firstThisWeek < r.bestBefore && r.bestThisWeek > r.bestBefore,
  },
  {
    id: 'consistent',
    emoji: '🐢',
    title: 'The Consistent One',
    how: 'Most sessions logged this week.',
    pick: (rows) => maxBy(rows, (r) => r.sessionsThisWeek),
    format: (r) => `${r.sessionsThisWeek} ${r.sessionsThisWeek === 1 ? 'session' : 'sessions'}`,
    min: (r) => r.sessionsThisWeek > 1,
  },
  {
    id: 'sniper',
    emoji: '🎯',
    title: 'The Sniper',
    how: 'Most attempts this week that landed within one rep of a personal best.',
    pick: (rows) => maxBy(rows, (r) => r.nearPb),
    format: (r) => `${r.nearPb} near-${r.nearPb === 1 ? 'miss' : 'misses'}`,
    min: (r) => r.nearPb > 0,
  },
  {
    id: 'destroyer',
    emoji: '💥',
    title: 'The Destroyer',
    how: 'Most pull-ups this week — 100 or more in total.',
    pick: (rows) => maxBy(rows, (r) => r.repsThisWeek),
    format: (r) => `${r.repsThisWeek} ${r.repsThisWeek === 1 ? 'rep' : 'reps'}`,
    min: (r) => r.repsThisWeek >= 100,
  },
  {
    id: 'ego',
    emoji: '😤',
    title: 'The Ego',
    how: 'Kept swinging for a personal best this week without getting there.',
    pick: (rows) => maxBy(rows.filter((r) => r.sessionsThisWeek >= 3), (r) => r.shortOfPb),
    format: (r) => `${r.shortOfPb} ${r.shortOfPb === 1 ? 'session' : 'sessions'} short of a PB`,
    min: (r) => r.sessionsThisWeek >= 3 && r.shortOfPb >= 2,
  },
  {
    id: 'one_rep',
    emoji: '🐌',
    title: 'The One-Rep Wonder',
    how: 'Smallest XP gain this week, for turning up.',
    pick: (rows) => minBy(rows, (r) => r.xpThisWeek),
    format: (r) => `${r.xpThisWeek} XP`,
    min: () => true,
    atLeast: 3,
  },
];

function maxBy(rows, value) {
  let best = null;
  for (const row of rows) {
    if (best === null || value(row) > value(best)) best = row;
  }
  return best;
}
function minBy(rows, value) {
  let best = null;
  for (const row of rows) {
    if (best === null || value(row) < value(best)) best = row;
  }
  return best;
}

/**
 * Awards for the week starting `week.start`. Only ever awarded to athletes who
 * actually logged something that week; unawarded categories come back with
 * `winner: null` so the UI can show a locked slot.
 */
export function officeAwards(game, users) {
  const { week } = game;
  const rows = [];

  for (const athlete of game.athletes.values()) {
    const sessionsThisWeek = athlete.weeks.sessionsByWeek.get(week.start) ?? 0;
    if (sessionsThisWeek === 0) continue;
    const user = users.find((u) => u.id === athlete.userId);
    rows.push({
      athlete,
      userId: athlete.userId,
      name: athlete.name,
      weightKg: Number(user?.weightKg ?? 0),
      sessionsThisWeek,
      repsThisWeek: athlete.weeks.repsByWeek.get(week.start) ?? 0,
      xpThisWeek: athlete.weeks.xpByWeek.get(week.start) ?? 0,
      bestThisWeek: round(athlete.weeks.bestByWeek.get(week.start) ?? 0, 2),
      bestBefore: round(athlete.weeks.bestBeforeWeek.get(week.start) ?? 0, 2),
      firstThisWeek: round(athlete.weeks.firstByWeek.get(week.start) ?? 0, 2),
      shortOfPb: athlete.weeks.shortOfPbByWeek.get(week.start) ?? 0,
      nearPb: athlete.weeks.nearPbByWeek.get(week.start) ?? 0,
    });
  }

  return {
    week,
    participants: rows.length,
    awards: AWARDS.map((award) => {
      const eligible = rows.filter((r) => award.min(r));
      if (eligible.length < (award.atLeast ?? 1)) {
        return { id: award.id, emoji: award.emoji, title: award.title, how: award.how, winner: null };
      }
      const winner = award.pick(eligible);
      return {
        id: award.id,
        emoji: award.emoji,
        title: award.title,
        how: award.how,
        winner: winner
          ? { userId: winner.userId, name: winner.name, detail: award.format(winner), xpThisWeek: winner.xpThisWeek }
          : null,
      };
    }),
    xpThisWeek: rows
      .slice()
      .sort((a, b) => b.xpThisWeek - a.xpThisWeek)
      .map((r) => ({ userId: r.userId, name: r.name, xp: r.xpThisWeek, sessions: r.sessionsThisWeek, reps: r.repsThisWeek })),
  };
}
