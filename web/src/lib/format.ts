/** Display formatting helpers. */

export function formatScore(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '–';
  const rounded = Number(value.toFixed(digits));
  return Number.isInteger(rounded) && digits === 2 ? rounded.toFixed(2) : String(rounded);
}

export function formatReps(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : '–';
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '–';
  const n = Number(value);
  return Number.isInteger(n) ? `${n} kg` : `${n.toFixed(1)} kg`;
}

export function formatMultiplier(value: number): string {
  return `×${value.toFixed(2)}`;
}

/** Short suffix describing a mass multiplier, e.g. "×1.26 mass bonus". */
export function massNote(multiplier: number): string {
  if (multiplier > 1.02) return 'mass bonus';
  if (multiplier < 0.98) return 'mass handicap';
  return 'at the median';
}

export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function daysAgo(iso: string | null | undefined): string {
  if (!iso) return 'no attempts yet';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - parseISO(iso).getTime()) / 86_400_000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return 'last week';
  if (diff < 60) return `${Math.round(diff / 7)} weeks ago`;
  return formatDate(iso);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable pastel-ish colour per person, readable on both themes. */
export function avatarColor(name: string): string {
  const palette = [
    '#c9f750',
    '#7dd3fc',
    '#fda4af',
    '#fcd34d',
    '#a5b4fc',
    '#6ee7b7',
    '#f9a8d4',
    '#93c5fd',
    '#fdba74',
    '#d8b4fe',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "1 rep" / "12 reps" */
export function reps(count: number): string {
  return pluralize(count, 'rep');
}

/** "1 session" / "3 sessions" */
export function sessions(count: number): string {
  return pluralize(count, 'session');
}

/** Local-timezone YYYY-MM-DD for the date inputs. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
