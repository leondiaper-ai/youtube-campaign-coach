/**
 * Shared cache contract for the partner briefing.
 *
 * Lives in its own module so the briefing route (which writes the cache) and
 * the coach route (which invalidates it after a plan is saved) can never drift
 * apart on the key name.
 */

export const BRIEFING_CACHE_KEY = 'partner-briefing:current';
/** How long a built copy is retained, in seconds. */
export const BRIEFING_CACHE_TTL = 86400;
/** How long a built copy counts as fresh before a background rebuild. */
export const BRIEFING_FRESH_MS = 10 * 60 * 1000;
/** Lock key ensuring only one background rebuild runs at a time. */
export const BRIEFING_LOCK_KEY = `${BRIEFING_CACHE_KEY}:rebuilding`;

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
export async function invalidateBriefingCache(): Promise<void> {
  try {
    const redis = await kv();
    if (!redis) return;
    await redis.del(BRIEFING_CACHE_KEY, BRIEFING_LOCK_KEY);
  } catch {
    // Non-fatal — the entry still expires on its own TTL.
  }
}
