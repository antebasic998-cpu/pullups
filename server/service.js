/**
 * Domain layer: turns raw store rows into the shapes the UI renders.
 * Nothing here is persisted – every score is derived live, so adding a new
 * colleague (which moves the office median) instantly re-rates everybody.
 */
import { db } from './store.js';
import { EXPONENT, massMultiplier, medianMassOf, normalizedScore, round, todayISO } from './scoring.js';
import { BADGES, LEVELS, XP_RULES, buildGame, officeAwards } from './gamify.js';

/** Leaderboards the app can show. */
export const BOARDS = ['best', 'absolute', 'improved', 'active'];

export const FORMULA = {
  exponent: EXPONENT,
  expression: 'score = pullups × (athleteMass / officeMedianMass) ^ 0.67',
};

const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt.localeCompare(b.createdAt));

export function medianMass() {
  return medianMassOf(db.users());
}

/** Weight snapshot captured with an attempt, falling back to the user's current weight. */
function massOf(session, user) {
  const w = Number(session.weightKg);
  return Number.isFinite(w) && w > 0 ? w : Number(user.weightKg);
}

export function decorateSession(session, user, medianKg) {
  const weightKg = massOf(session, user);
  const reps = Number(session.reps);
  return {
    id: session.id,
    userId: session.userId,
    reps,
    weightKg: round(weightKg, 1),
    date: session.date,
    note: session.note ?? '',
    createdAt: session.createdAt,
    normalized: normalizedScore(reps, weightKg, medianKg),
    multiplier: massMultiplier(weightKg, medianKg),
  };
}

/** Replay the whole office: XP, levels, badges, streaks and daily ranks. */
export function game(medianKg = medianMass()) {
  return buildGame({ users: db.users(), sessions: db.sessions(), medianMassKg: medianKg });
}

/** Public user shape + personal bests + form trend + game state. */
export function buildUserView(user, medianKg, existingGame = null) {
  const sessions = db.sessionsOf(user.id).map((s) => decorateSession(s, user, medianKg)).sort(byDateAsc);

  const pbAbsoluteSession = sessions.reduce((best, s) => (!best || s.reps > best.reps ? s : best), null);
  const pbNormalizedSession = sessions.reduce(
    (best, s) => (!best || s.normalized > best.normalized ? s : best),
    null,
  );
  const last = sessions.at(-1) ?? null;
  const previous = sessions.at(-2) ?? null;

  let trend = 'none';
  if (last && previous) {
    trend = last.normalized > previous.normalized ? 'up' : last.normalized < previous.normalized ? 'down' : 'flat';
  }

  const g = existingGame ? existingGame.athletes.get(user.id) : null;
  // Progress is measured from the first result to the personal best, so one bad
  // day cannot make someone look like they got worse.
  const improvement = g ? g.improvementPercent : null;
  const improvementPoints = g ? g.improvementPoints : null;

  return {
    id: user.id,
    name: user.name,
    age: user.age ?? null,
    weightKg: round(Number(user.weightKg), 1),
    note: user.note ?? '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt ?? user.createdAt,
    multiplier: massMultiplier(Number(user.weightKg), medianKg),
    sessionCount: sessions.length,
    pbAbsolute: pbAbsoluteSession ? pbAbsoluteSession.reps : 0,
    pbAbsoluteDate: pbAbsoluteSession ? pbAbsoluteSession.date : null,
    pbNormalized: pbNormalizedSession ? pbNormalizedSession.normalized : 0,
    pbNormalizedReps: pbNormalizedSession ? pbNormalizedSession.reps : 0,
    pbNormalizedWeight: pbNormalizedSession ? pbNormalizedSession.weightKg : null,
    pbNormalizedDate: pbNormalizedSession ? pbNormalizedSession.date : null,
    lastResult: last,
    trend,
    improvement,
    improvementPoints,
    firstNormalized: g ? g.firstNormalized : null,
    totalReps: g ? g.totalReps : sessions.reduce((sum, s) => sum + s.reps, 0),
    xp: g ? g.xp : 0,
    level: g ? g.level : null,
    streaks: g
      ? g.streaks
      : { weeks: 0, bestWeeks: 0, days: 0, bestDays: 0, lastDate: null, activeWeeks: 0 },
    badges: g ? g.badges : [],
    unlockedBadgeCount: g ? g.badges.filter((b) => b.unlocked).length : 0,
    sessions,
  };
}

export function allUsers() {
  const medianKg = medianMass();
  const g = game(medianKg);
  return db
    .users()
    .map((u) => buildUserView(u, medianKg, g))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function userDetail(id) {
  const user = db.user(id);
  if (!user) return null;
  const medianKg = medianMass();
  return buildUserView(user, medianKg, game(medianKg));
}

/**
 * The number a board ranks by. `null` means "not measurable yet" (nobody has
 * two results to compare), and those athletes sink to the bottom.
 */
function scoreOf(row, mode) {
  switch (mode) {
    case 'absolute':
      return row.pbAbsolute;
    case 'improved':
      return row.improvement;
    case 'active':
      return row.sessionCount;
    default:
      return row.pbNormalized;
  }
}

export function leaderboard(mode = 'best') {
  const requested = BOARDS.includes(mode) ? mode : 'best';
  const medianKg = medianMass();
  const g = game(medianKg);
  const rows = db.users().map((u) => buildUserView(u, medianKg, g));

  rows.sort((a, b) => {
    const av = scoreOf(a, requested);
    const bv = scoreOf(b, requested);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    if (av !== null && bv !== null && bv !== av) return bv - av;
    if (b.pbNormalized !== a.pbNormalized) return b.pbNormalized - a.pbNormalized;
    return a.name.localeCompare(b.name);
  });

  let lastScore;
  let lastRank = 0;
  const ranked = rows.map((row, i) => {
    const value = scoreOf(row, requested);
    const rank = lastScore !== undefined && value !== null && value === lastScore ? lastRank : i + 1;
    if (value !== null) {
      lastScore = value;
      lastRank = rank;
    }
    return { ...row, rank, score: value };
  });

  return {
    mode: requested,
    medianMassKg: medianKg,
    userCount: db.users().length,
    attemptCount: db.sessions().length,
    formula: FORMULA,
    rows: ranked,
  };
}

/** Everything the Awards page needs: this week's prizes, XP race, badge wall. */
export function office() {
  const medianKg = medianMass();
  const g = game(medianKg);
  const users = db.users();
  const awards = officeAwards(g, users);
  const athletes = allUsers();

  return {
    medianMassKg: medianKg,
    userCount: users.length,
    attemptCount: db.sessions().length,
    week: awards.week,
    participants: awards.participants,
    awards: awards.awards,
    xpThisWeek: awards.xpThisWeek,
    levels: LEVELS,
    xpRules: XP_RULES,
    badges: BADGES.map((badge) => ({
      id: badge.id,
      emoji: badge.emoji,
      name: badge.name,
      tier: badge.tier,
      how: badge.how,
      holders: g.badgeCounts[badge.id] ?? 0,
      names: athletes.filter((a) => a.badges.some((b) => b.id === badge.id && b.unlocked)).map((a) => a.name),
    })),
    leaderboard: athletes
      .map((a) => ({ id: a.id, name: a.name, xp: a.xp, level: a.level, badges: a.unlockedBadgeCount }))
      .sort((a, b) => b.xp - a.xp),
  };
}

export function meta() {
  const lb = leaderboard('normalized');
  return {
    medianMassKg: lb.medianMassKg,
    userCount: lb.userCount,
    attemptCount: lb.attemptCount,
    formula: FORMULA,
    today: todayISO(),
  };
}

/* ------------------------------------------------------------------ *
 * CSV import – tolerant of headers, delimiters and date formats.
 * ------------------------------------------------------------------ */

const DATE_KEYS = ['date', 'day', 'datum', 'fecha', 'dato', 'when', 'ts', 'timestamp'];
const REPS_KEYS = ['reps', 'rep', 'pullups', 'pull-ups', 'pull ups', 'pullup', 'count', 'result', 'score', 'anzahl'];
const WEIGHT_KEYS = ['weight', 'kg', 'mass', 'bodyweight', 'body weight', 'gewicht', 'peso'];

const DELIMITERS = [',', ';', '\t', '|'];
const splitBy = (line, d) => line.split(d).map((c) => c.trim().replace(/^["']|["']$/g, ''));

/** Pick the delimiter that splits the most lines of the file into several cells. */
function detectDelimiter(lines) {
  let best = ',';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const score = lines.reduce((n, line) => n + (splitBy(line, d).length > 1 ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function parseNumber(raw) {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const norm = (s) => s.trim().toLowerCase().replace(/["']/g, '');

function parseDate(raw) {
  const v = String(raw ?? '').trim().replace(/["']/g, '');
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // Excel serial number
  if (/^\d{5}$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const m = v.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);
  if (m) {
    let [, a, b, c] = m;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    // Day-first unless the "day" is impossible for a day but valid as a month.
    let day = Number(a);
    let month = Number(b);
    if (day > 12 && month > 12) return null;
    if (month > 12) [day, month] = [month, day];
    const year = c.length === 2 ? `20${c}` : c;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/**
 * Parse CSV text into attempts.
 * Accepts an optional header (any column order) or bare `date,reps[,weight]` rows.
 * `reps` is required; `date` falls back to today; `weight` falls back to the user.
 */
export function parseCSV(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) return { rows: [], errors: [] };

  const delimiter = detectDelimiter(lines);

  let map = { date: -1, reps: -1, weight: -1 };
  let width = 0;
  let start = 0;
  const header = splitBy(lines[0], delimiter).map(norm);
  const headerLooksNamed = header.some((h) => [...REPS_KEYS, ...DATE_KEYS, ...WEIGHT_KEYS].includes(h));
  if (headerLooksNamed) {
    header.forEach((h, i) => {
      if (DATE_KEYS.includes(h) && map.date === -1) map.date = i;
      else if (REPS_KEYS.includes(h) && map.reps === -1) map.reps = i;
      else if (WEIGHT_KEYS.includes(h) && map.weight === -1) map.weight = i;
    });
    width = header.length;
    start = 1;
  }

  const rows = [];
  const errors = [];

  for (let i = start; i < lines.length; i += 1) {
    const lineNo = i + 1;
    let parts = splitBy(lines[i], delimiter);

    // A stray line may use a different separator than the rest of the file.
    if (width > 1 && parts.length < width) {
      for (const d of DELIMITERS) {
        const attempt = splitBy(lines[i], d);
        if (attempt.length > parts.length) parts = attempt;
      }
    }

    let date = null;
    let reps = null;
    let weight = null;
    let note = '';

    if (map.reps >= 0 && map.reps < parts.length) {
      reps = parseNumber(parts[map.reps]);
      date = map.date >= 0 && map.date < parts.length ? parseDate(parts[map.date]) : null;
      weight = map.weight >= 0 && map.weight < parts.length ? parseNumber(parts[map.weight]) : null;
      note = parts.filter((_, idx) => ![map.date, map.reps, map.weight].includes(idx)).join(' ').trim();
    } else {
      // Positional: work out which column holds the date and which holds the reps.
      const numeric = parts.map(parseNumber);
      const dateIdx = parts.findIndex((p) => parseDate(p) !== null && !/^\d{1,3}$/.test(p));
      const numericIdx = numeric.map((n, idx) => (Number.isFinite(n) ? idx : -1)).filter((idx) => idx >= 0 && idx !== dateIdx);
      if (numericIdx.length === 0) {
        errors.push(`Line ${lineNo}: no rep count found.`);
        continue;
      }
      reps = numeric[numericIdx[0]];
      date = dateIdx >= 0 ? parseDate(parts[dateIdx]) : null;
      weight = numericIdx.length > 1 ? numeric[numericIdx[1]] : null;
    }

    if (!Number.isFinite(reps) || reps <= 0) {
      errors.push(`Line ${lineNo}: "${lines[i]}" has no valid pull-up count.`);
      continue;
    }
    if (reps > 500) {
      errors.push(`Line ${lineNo}: ${reps} pull-ups looks like a typo – skipped.`);
      continue;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight < 20 || weight > 400)) weight = null;

    rows.push({
      date: date ?? todayISO(),
      reps: Math.round(reps),
      weightKg: weight,
      note: note || 'Imported from CSV',
    });
  }

  return { rows, errors };
}
