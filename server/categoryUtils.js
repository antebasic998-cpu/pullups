/** URL-safe slug from a display name, e.g. "Assisted Chin-up" → "assisted-chin-up". */
export function slugifyCategoryName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferCategoryIconKey(slug, name) {
  const hint = `${slug} ${name}`.toLowerCase();
  if (hint.includes('assisted') && hint.includes('chin')) return 'assisted-chin-up';
  if (hint.includes('assisted')) return 'assisted-pull-up';
  if (hint.includes('chin')) return 'chin-up';
  if (hint.includes('dip')) return 'dips';
  if (hint.includes('push')) return 'push-ups';
  if (hint.includes('pull')) return 'pull-up';
  return 'bar';
}
