/**
 * Shared cache contract for the partner briefing.
 *
 * Lives in its own module so the briefing route (which writes the cache) and
 * the coach route (which invalidates it after a plan is saved) can never drift
 * apart on the key name.
 */

import { DEFAULT_MARKET, marketKey } from './market';

export const BRIEFING_CACHE_KEY = 'partner-briefing:current';
/** How long a built copy is retained, in seconds. */
export const BRIEFING_CACHE_TTL = 86400;
/** How long a built copy counts as fresh before a background rebuild. */
export const BRIEFING_FRESH_MS = 10 * 60 * 1000;
/** Lock key ensuring only one background rebuild runs at a time. */
export const BRIEFING_LOCK_KEY = `${BRIEFING_CACHE_KEY}:rebuilding`;

/**
 * Per-market cache keys. Without this, two markets share one cached briefing
 * and whichever rebuilt last wins — the UK would periodically be served
 * Australia's Priority Campaigns page, which is the worst possible version of
 * a data-isolation bug because it is intermittent and looks like a glitch.
 *
 * UK keeps the bare key, so the existing cached briefing stays valid through
 * the deploy rather than everyone paying for a cold rebuild.
 */
export const briefingCacheKey = (marketId: string = DEFAULT_MARKET) =>
  marketKey(BRIEFING_CACHE_KEY, marketId);
export const briefingLockKey = (marketId: string = DEFAULT_MARKET) =>
  `${briefingCacheKey(marketId)}:rebuilding`;

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
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

/**
 * Drop the cached briefing so the next request rebuilds from current data.
 *
 * Called whenever a coach plan is saved — editing a campaign timeline should
 * show up on the briefing straight away rather than waiting out the ten-minute
 * freshness window. The rebuild lock is cleared too, otherwise a lock left
 * behind by an earlier refresh could suppress the next one.
 *
 * Never throws: failing to bust the cache is not a reason to fail a plan save.
 */
export async function invalidateBriefingCache(
  marketId: string = DEFAULT_MARKET,
): Promise<void> {
  try {
    const redis = await kv();
    if (!redis) return;
    await redis.del(briefingCacheKey(marketId), briefingLockKey(marketId));
  } catch {
    // Non-fatal — the entry still expires on its own TTL.
  }
}
