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

export function exerciseEmoji(iconKey: string, slug?: string): string {
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
