/**
 * Scoring engine.
 *
 * A heavier athlete performing the same number of pull-ups does more work, so we
 * scale the raw rep count by the athlete's mass relative to the office median:
 *
 *      score = reps × (athleteMass / medianMass) ^ 0.67
 *
 * 0.67 (≈ 2/3) is the classic allometric scaling exponent for body-mass-dependent
 * strength feats – it grows slightly slower than mass, so the extra weight is
 * rewarded, but not linearly.
 */

export const EXPONENT = 0.67;

/** Median of a numeric list (average of the two middle values for even counts). */
export function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/** Round to `digits` decimals without float noise. */
export function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Normalized score for one attempt.
 * Falls back to the raw rep count when the median is unknown (empty office).
 */
export function normalizedScore(reps, athleteMassKg, medianMassKg, exponent = EXPONENT) {
  if (!Number.isFinite(reps)) return 0;
  if (!Number.isFinite(athleteMassKg) || !Number.isFinite(medianMassKg) || medianMassKg <= 0) {
    return round(reps);
  }
  const exp = Number.isFinite(exponent) && exponent > 0 ? exponent : EXPONENT;
  return round(reps * (athleteMassKg / medianMassKg) ** exp);
}

/** The mass multiplier applied to the reps, e.g. 1.18 for a 100 kg athlete at 82 kg median. */
export function massMultiplier(athleteMassKg, medianMassKg, exponent = EXPONENT) {
  if (!Number.isFinite(athleteMassKg) || !Number.isFinite(medianMassKg) || medianMassKg <= 0) return 1;
  const exp = Number.isFinite(exponent) && exponent > 0 ? exponent : EXPONENT;
  return round((athleteMassKg / medianMassKg) ** exp, 3);
}

export function medianMassOf(users) {
  return round(median(users.map((u) => Number(u.weightKg))), 2);
}

/** Hours-free ISO date (YYYY-MM-DD) for a stored timestamp. */
export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
