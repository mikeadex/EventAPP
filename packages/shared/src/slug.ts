/**
 * Conservative URL-slug builder. ASCII-only output, hyphens between words,
 * trimmed to `max` chars. Used for event slugs (per organization, so
 * collisions resolved by appending a short suffix).
 */
export function slugify(input: string, max = 60): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return base || 'event';
}
