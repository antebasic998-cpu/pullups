// @ts-nocheck
/**
 * Domain layer: turns raw store rows into the shapes the UI renders.
 * Nothing here is persisted – every score is derived live, so adding a new
 * colleague (which moves the office median) instantly re-rates everybody.
 */
import { db } from './db';
import { EXPONENT, massMultiplier, medianMassOf, normalizedScore, round, todayISO } from './scoring';
import { BADGES, LEVELS, XP_RULES, buildGame, officeAwards } from './gamify';

/** Leaderboards the app can show. */
export const BOARDS = ['best', 'absolute', 'improved', 'active'];

export function resolveCategory(categorySlugOrId?: string | any | null) {
  if (!categorySlugOrId) return db.defaultCategory();
  if (typeof categorySlugOrId === 'object' && 'id' in categorySlugOrId) {
    return categorySlugOrId;
  }
  return db.category(categorySlugOrId) ?? db.defaultCategory();
}

export function formulaFor(category) {
  const cat = resolveCategory(category);
  const exp = cat.normalizationExponent ?? EXPONENT;
  return {
    exponent: exp,
    expression: `score = reps × (athleteMass / officeMedianMass) ^ ${exp}`,
  };
}

export const FORMULA = {
  exponent: EXPONENT,
  expression: 'score = reps × (athleteMass / officeMedianMass) ^ 0.67',
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

export function decorateSession(session, user, medianKg, category = null) {
  const cat = resolveCategory(category ?? session.exerciseCategoryId);
  const weightKg = massOf(session, user);
  const reps = Number(session.reps);
  const exponent = cat?.normalizationExponent ?? EXPONENT;
  return {
    id: session.id,
    userId: session.userId,
    exerciseCategoryId: session.exerciseCategoryId ?? cat.id,
    reps,
    weightKg: round(weightKg, 1),
    date: session.date,
    note: session.note ?? '',
    createdAt: session.createdAt,
    normalized: normalizedScore(reps, weightKg, medianKg, exponent),
    multiplier: massMultiplier(weightKg, medianKg, exponent),
  };
}

/** Replay the whole office: XP, levels, badges, streaks and daily ranks. */
export function game(medianKg = medianMass()) {
  return buildGame({ users: db.users(), sessions: db.sessions(), medianMassKg: medianKg });
}

/** Public user shape + personal bests + form trend + game state (category-scoped). */
export function buildUserView(user, medianKg, category = null, existingGame = null) {
  const cat = resolveCategory(category);
  // Pull only sessions belonging to this category
  const rawSessions = db.sessionsOfUserAndCategory(user.id, cat.id);
  const sessions = rawSessions.map((s) => decorateSession(s, user, medianKg, cat)).sort(byDateAsc);

  const pbAbsoluteSession = sessions.reduce((best, s) => (!best || s.reps > best.reps ? s : best), null);
  const pbNormalizedSession = sessions.reduce(
    (best, s) => (!best || s.normalized > best.normalized ? s : best),
    null,
  );
  const last = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;

  let trend = 'none';
  if (last && previous) {
    trend = last.normalized > previous.normalized ? 'up' : last.normalized < previous.normalized ? 'down' : 'flat';
  }

  const g = existingGame ? existingGame.athletes.get(user.id) : null;

  // Calculate category-specific improvement
  let improvement = null;
  let improvementPoints = null;
  const firstSession = sessions[0] ?? null;
  if (firstSession && pbNormalizedSession && sessions.length >= 2 && firstSession.normalized > 0) {
    improvement = round(((pbNormalizedSession.normalized - firstSession.normalized) / firstSession.normalized) * 100);
    improvementPoints = round(pbNormalizedSession.normalized - firstSession.normalized);
  }

  const totalReps = sessions.reduce((sum, s) => sum + s.reps, 0);

  return {
    id: user.id,
    name: user.name,
    age: user.age ?? null,
    weightKg: round(Number(user.weightKg), 1),
    note: user.note ?? '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt ?? user.createdAt,
    multiplier: massMultiplier(Number(user.weightKg), medianKg, cat.normalizationExponent),
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
    firstNormalized: firstSession ? firstSession.normalized : null,
    totalReps,
    xp: g ? g.xp : 0,
    level: g ? g.level : null,
    streaks: g
      ? g.streaks
      : { weeks: 0, bestWeeks: 0, days: 0, bestDays: 0, lastDate: null, activeWeeks: 0 },
    badges: g ? g.badges : [],
    unlockedBadgeCount: g ? g.badges.filter((b) => b.unlocked).length : 0,
    sessions,
    category: cat,
  };
}

export function allUsers(categorySlugOrId?: string | null) {
  const cat = resolveCategory(categorySlugOrId);
  const medianKg = medianMass();
  const g = game(medianKg);
  return db
    .users()
    .map((u) => buildUserView(u, medianKg, cat, g))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function userDetail(id: string, categorySlugOrId?: string | null) {
  const user = db.user(id);
  if (!user) return null;
  const cat = resolveCategory(categorySlugOrId);
  const medianKg = medianMass();
  return buildUserView(user, medianKg, cat, game(medianKg));
}

/**
 * Score a row ranks by in a specific mode. Returns null if unranked.
 */
function scoreOf(row, mode) {
  if (row.sessionCount === 0) return null;
  switch (mode) {
    case 'absolute':
      return row.pbAbsolute > 0 ? row.pbAbsolute : null;
    case 'improved':
      return row.improvement;
    case 'active':
      return row.sessionCount > 0 ? row.sessionCount : null;
    default:
      return row.pbNormalized > 0 ? row.pbNormalized : null;
  }
}

export function leaderboard(categorySlugOrId?: string | null, mode = 'best') {
  const cat = resolveCategory(categorySlugOrId);
  const requested = BOARDS.includes(mode) ? mode : 'best';
  const medianKg = medianMass();
  const g = game(medianKg);
  const allRows = db.users().map((u) => buildUserView(u, medianKg, cat, g));

  // Separate athletes with attempts from unranked athletes
  const withResults = allRows.filter((r) => r.sessionCount > 0);
  const withoutResults = allRows.filter((r) => r.sessionCount === 0);

  withResults.sort((a, b) => {
    const av = scoreOf(a, requested);
    const bv = scoreOf(b, requested);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    if (av !== null && bv !== null && bv !== av) return bv - av;
    if (b.pbNormalized !== a.pbNormalized) return b.pbNormalized - a.pbNormalized;
    if (b.pbAbsolute !== a.pbAbsolute) return b.pbAbsolute - a.pbAbsolute;
    return a.name.localeCompare(b.name);
  });

  let lastScore;
  let lastRank = 0;
  const rankedWithResults = withResults.map((row, i) => {
    const value = scoreOf(row, requested);
    const rank = lastScore !== undefined && value !== null && value === lastScore ? lastRank : i + 1;
    if (value !== null) {
      lastScore = value;
      lastRank = rank;
    }
    return { ...row, rank, score: value };
  });

  withoutResults.sort((a, b) => a.name.localeCompare(b.name));
  const unranked = withoutResults.map((row) => ({
    ...row,
    rank: null,
    score: null,
  }));

  const catAttempts = db.sessionsOfCategory(cat.id);

  return {
    mode: requested,
    category: cat,
    medianMassKg: medianKg,
    userCount: db.users().length,
    attemptCount: catAttempts.length,
    formula: formulaFor(cat),
    rows: [...rankedWithResults, ...unranked],
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

export function meta(categorySlugOrId?: string | null) {
  const lb = leaderboard(categorySlugOrId ?? 'pull-ups', 'best');
  return {
    medianMassKg: lb.medianMassKg,
    userCount: lb.userCount,
    attemptCount: lb.attemptCount,
    formula: lb.formula,
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

function parseHeader(cells) {
  const map = { reps: -1, date: -1, weight: -1, note: -1 };
  cells.forEach((c, i) => {
    const clean = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (map.reps === -1 && REPS_KEYS.some((k) => clean.includes(k.replace(/[^a-z0-9]/g, '')))) map.reps = i;
    else if (map.date === -1 && DATE_KEYS.some((k) => clean.includes(k))) map.date = i;
    else if (map.weight === -1 && WEIGHT_KEYS.some((k) => clean.includes(k))) map.weight = i;
    else if (map.note === -1 && (clean.includes('note') || clean.includes('kommentar') || clean.includes('comment'))) {
      map.note = i;
    }
  });
  return map;
}

function parseDateCell(raw) {
  const clean = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dm = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dm) {
    const [, d, m, y] = dm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const iso = new Date(clean).toISOString().slice(0, 10);
  return Number.isNaN(Date.parse(iso)) ? todayISO() : iso;
}

export function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: [] };
  const delim = detectDelimiter(lines);
  const headCells = splitBy(lines[0], delim);
  const map = parseHeader(headCells);
  const hasHeader = map.reps !== -1 || map.date !== -1;
  const start = hasHeader ? 1 : 0;
  const repsIdx = map.reps !== -1 ? map.reps : 0;
  const dateIdx = map.date !== -1 ? map.date : 1;
  const weightIdx = map.weight !== -1 ? map.weight : 2;
  const noteIdx = map.note !== -1 ? map.note : 3;

  const rows = [];
  const errors = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitBy(lines[i], delim);
    if (!cells[repsIdx]) continue;
    const reps = parseInt(cells[repsIdx].replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(reps) || reps <= 0) {
      errors.push(`Line ${i + 1}: Invalid repetition count "${cells[repsIdx]}"`);
      continue;
    }
    const date = cells[dateIdx] ? parseDateCell(cells[dateIdx]) : todayISO();
    const weightRaw = cells[weightIdx] ? parseFloat(cells[weightIdx].replace(',', '.')) : NaN;
    const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : null;
    const note = cells[noteIdx] ?? '';
    rows.push({ reps, date, weight, note });
  }
  return { rows, errors };
}

export function computeGamificationDelta(
  beforeUser: any,
  afterUser: any,
  reps: number,
  categoryName: string,
) {
  const oldXp = beforeUser?.xp ?? 0;
  const newXp = afterUser?.xp ?? 0;
  const xpGained = Math.max(0, newXp - oldXp);

  const oldLevel = beforeUser?.level ?? null;
  const newLevel = afterUser?.level ?? null;
  const leveledUp = Boolean(oldLevel && newLevel && newLevel.level > oldLevel.level);

  const oldProgress = oldLevel ? Number(oldLevel.progress) || 0 : 0;
  const newProgress = newLevel ? Number(newLevel.progress) || 0 : 0;

  const oldUnlockedIds = new Set((beforeUser?.badges ?? []).filter((b: any) => b.unlocked).map((b: any) => b.id));
  const newBadges = (afterUser?.badges ?? []).filter((b: any) => b.unlocked && !oldUnlockedIds.has(b.id));

  return {
    userName: afterUser?.name ?? '',
    categoryName,
    reps,
    xpGained,
    oldXp,
    newXp,
    oldLevel,
    newLevel,
    leveledUp,
    oldProgress,
    newProgress,
    newBadges,
  };
}
