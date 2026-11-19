/** Stable roster identity: preserve letters, remove accents and punctuation. */
export function normalizeArtistIdentity(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Fail closed on empty or ambiguous names rather than borrowing another artist. */
export function resolveArtistIdentity<T extends { name: string; slug: string }>(artists: T[], name: string): T | undefined {
  const key = normalizeArtistIdentity(name);
  if (!key) return undefined;
  const matches = artists.filter(a => normalizeArtistIdentity(a.name) === key || normalizeArtistIdentity(a.slug) === key);
  return matches.length === 1 ? matches[0] : undefined;
}
