/** URL-safe slug from a display name, e.g. "Assisted Chin-up" → "assisted-chin-up". */
export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferCategoryIconKey(slug: string, name: string): string {
  const hint = `${slug} ${name}`.toLowerCase();
  if (hint.includes('assisted') && hint.includes('chin')) return 'assisted-chin-up';
  if (hint.includes('assisted')) return 'assisted-pull-up';
  if (hint.includes('chin')) return 'chin-up';
  if (hint.includes('dip')) return 'dips';
  if (hint.includes('push')) return 'push-ups';
  if (hint.includes('pull')) return 'pull-up';
  return 'bar';
}

/** Icons offered when adding or editing an exercise. */
export const EXERCISE_ICONS = [
  '💪', '🦾', '🏋️', '🤸', '🤲', '🪢', '⚡', '💥',
  '🔥', '🎯', '🏆', '🥇', '🏃', '🚴', '🧗', '🧘',
  '🥊', '🦵', '🤾', '🪜', '⛓️', '🧱', '🏊', '🦍',
] as const;

const KNOWN_ICON_KEYS = new Set(['assisted-chin-up', 'assisted-pull-up', 'chin-up', 'pull-up', 'dips', 'push-ups', 'bar']);

/** An icon the user picked is stored as the emoji itself; older exercises use the legacy keys. */
function isEmojiIcon(value: string): boolean {
  return /^\p{Extended_Pictographic}/u.test(value);
}

/** Valid icon for storage (legacy key or a single emoji), or null so the caller can reject it. */
export function normalizeCategoryIcon(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (KNOWN_ICON_KEYS.has(value)) return value;
  if (value.length <= 16 && isEmojiIcon(value)) return value;
  return null;
}

export function exerciseEmoji(iconKey: string, slug?: string): string {
  if (isEmojiIcon(iconKey)) return iconKey;
  switch (iconKey) {
    case 'assisted-chin-up':
      return '🤲';
    case 'assisted-pull-up':
      return '🪢';
    case 'chin-up':
      return '🤸';
    case 'pull-up':
      return '💪';
    case 'dips':
      return '⚡';
    case 'push-ups':
      return '💥';
    default:
      if (slug?.includes('chin')) return '🤸';
      if (slug?.includes('assisted')) return '🪢';
      return '💪';
  }
}
