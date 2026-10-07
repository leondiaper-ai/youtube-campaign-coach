import type { Artist } from './artists';

// ─────────────────────────────────────────────────────────────────────────────
// Custom artists store (KV-backed). Anyone can add a channel from the Cockpit
// via its handle / URL and it gets persisted to Upstash KV (if configured).
// No-ops gracefully when KV env vars are missing.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'artists:custom';

async function kv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function listCustomArtists(): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  return list;
}

/**
 * Add or update an artist.
 *
 * MARKETS: this list stays global on purpose. A channel is a channel — one
 * subscriber count, one snapshot, one place in the daily cron — so splitting
 * the roster per market would fetch the same channel twice and let two
 * markets hold different beliefs about the same facts. Market membership is
 * a field on the record (`markets: ['uk','au']`), and the market-scoped view
 * is `getArtistsForMarket()` in marketScope.ts.
 *
 * MERGE, DON'T REPLACE: the previous version wrote `{...a}` over any existing
 * record with the same slug. That was survivable while one team used the
 * system; with two it is data loss. An Australian team adding an artist the
 * UK already works would have blanked the UK's `phase`, `campaign`,
 * `campaignStartDate`, `collabs` and dropped `ownership` from 'virgin' to
 * 'observed' — silently taking a managed artist out of value modelling.
 *
 * So existing fields survive unless the caller explicitly supplies a new
 * value, and `markets` is unioned rather than overwritten.
 */
export async function addCustomArtist(a: Artist): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [a];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  const existing = list.find((x) => x.slug === a.slug);

  let merged: Artist;
  if (existing) {
    // Drop undefined keys from the incoming record so a partial write cannot
    // erase a field it simply didn't mention.
    const incoming = Object.fromEntries(
      Object.entries(a).filter(([, v]) => v !== undefined),
    ) as Partial<Artist>;
    const unionMarkets = Array.from(
      new Set([...(existing.markets ?? []), ...(a.markets ?? [])]),
    );
    merged = {
      ...existing,
      ...incoming,
      ...(unionMarkets.length > 0 ? { markets: unionMarkets } : {}),
      custom: true,
    };
  } else {
    merged = { ...a, custom: true };
  }

  const next = [...list.filter((x) => x.slug !== a.slug), merged];
  await store.set(KEY, next);
  return next;
}

/**
 * Remove an artist from one market, deleting the record only when no market
 * still works them.
 *
 * Australia dropping a shared artist must not take them off the UK's roster,
 * and must never delete the channel's snapshot history, which is global and
 * irrecoverable.
 */
export async function removeArtistFromMarket(
  slug: string,
  marketId: string,
): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [];
  const { artistMarkets, resolveMarket } = await import('./market');
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  const target = list.find((x) => x.slug === slug);
  if (!target) return list;

  const m = resolveMarket(marketId).id;
  const remaining = artistMarkets(target).filter((x) => x !== m);

  const next =
    remaining.length === 0
      ? list.filter((x) => x.slug !== slug)
      : list.map((x) => (x.slug === slug ? { ...x, markets: remaining } : x));

  await store.set(KEY, next);
  return next;
}

export async function removeCustomArtist(slug: string): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  const next = list.filter((x) => x.slug !== slug);
  await store.set(KEY, next);
  return next;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
