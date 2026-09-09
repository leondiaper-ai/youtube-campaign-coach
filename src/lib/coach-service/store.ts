/**
 * COACH SERVICE — OVERVIEW CACHE
 *
 * A Coach overview costs several tool calls plus a multi-turn model run. The
 * Watcher home asks for thirty of them at once, so without a cache the first
 * page load would be both slow and expensive, and would re-bill on every
 * refresh.
 *
 * The TTL is deliberately short. This is a coaching layer over a campaign
 * that moves daily; a day-old reading of "what needs attention" is worse than
 * useless because it is confidently stale. Six hours means a morning and an
 * afternoon view are each fresh, and a forced refresh is always available.
 */

import { Redis } from '@upstash/redis';
import type { CoachOverview } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const TTL_SECONDS = 6 * 60 * 60;
const key = (slug: string) => `coach:overview:${slug}`;

export async function readOverview(slug: string): Promise<CoachOverview | null> {
  const store = await kv();
  if (!store) return null;
  const raw = await store.get<CoachOverview>(key(slug));
  return raw ?? null;
}

export async function writeOverview(o: CoachOverview): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(key(o.artistId), o, { ex: TTL_SECONDS });
}

export async function clearOverview(slug: string): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.del(key(slug));
}
