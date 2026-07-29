/**
 * KV Cache Layer — source of truth for all YouTube channel data.
 *
 * Architecture:
 *   - The daily cron job is the ONLY writer (fetches from YouTube API → writes here)
 *   - All pages/API routes read from here — zero YouTube API calls during browsing
 *   - Manual refresh endpoint can trigger a write on demand
 *
 * KV key patterns:
 *   live:{channelId}       → full LiveSnap (the main data blob)
 *   chanmap:{handle}       → channelId string (permanent, rarely changes)
 *   sync:meta              → SyncMeta (last sync timestamp, status, errors)
 */

import type { LiveSnap } from './artists';

// ── KV client (same pattern as snapshots.ts) ──────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────

export type SyncMeta = {
  lastSyncAt: string;       // ISO timestamp
  status: 'success' | 'partial' | 'failed';
  artistsTotal: number;
  artistsSuccess: number;
  artistsFailed: number;
  errors: string[];         // first 10 error messages
  quotaUnitsEstimate: number;
  durationMs: number;
  nextScheduledSync: string; // ISO timestamp of next expected cron run
};

export type CachedSnap = LiveSnap & {
  /** When this snap was fetched from the YouTube API */
  cachedAt: string;
};

// ── Channel ID mapping (permanent) ────────────────────────────────────────

function normalizeHandle(handle: string): string {
  return handle.toLowerCase().replace(/^@/, '').trim();
}

export async function writeChannelMapping(handle: string, channelId: string) {
  const store = await kv();
  if (!store) return;
  await store.set(`chanmap:${normalizeHandle(handle)}`, channelId);
}

export async function readChannelMapping(handle: string): Promise<string | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get(`chanmap:${normalizeHandle(handle)}`)) as string | null;
}

// ── Live snap read/write ──────────────────────────────────────────────────

export async function writeLiveSnap(channelId: string, snap: LiveSnap) {
  const store = await kv();
  if (!store) return;
  const cached: CachedSnap = { ...snap, cachedAt: new Date().toISOString() };
  await store.set(`live:${channelId}`, cached);
}

export async function readLiveSnap(channelId: string): Promise<CachedSnap | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get(`live:${channelId}`)) as CachedSnap | null;
}

/**
 * Read a cached LiveSnap by channel handle.
 * Resolves handle → channelId via the permanent mapping, then reads the snap.
 * Returns null if no mapping or no cached data exists.
 */
export async function readLiveSnapByHandle(handle: string): Promise<CachedSnap | null> {
  const channelId = await readChannelMapping(handle);
  if (!channelId) return null;
  return readLiveSnap(channelId);
}

/**
 * Chunked mget — splits keys into batches to stay under Upstash's 10 MB
 * max-request-size limit on the free plan. Each LiveSnap can be large
 * (video descriptions, comments, etc.), so we fetch at most CHUNK_SIZE
 * keys per round-trip.
 */
const MGET_CHUNK = 5;

async function chunkedMget<T>(
  store: Exclude<Awaited<ReturnType<typeof kv>>, null>,
  keys: string[],
): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  if (keys.length <= MGET_CHUNK) {
    return store.mget<(T | null)[]>(...keys);
  }
  // Chunks are issued in parallel. Awaiting them one at a time costs a
  // sequential round-trip per chunk, which on a full roster is the difference
  // between a fast response and a function timeout.
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += MGET_CHUNK) {
    chunks.push(keys.slice(i, i + MGET_CHUNK));
  }
  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await store.mget<(T | null)[]>(...chunk);
      } catch {
        // Degrade a failed chunk to nulls rather than failing every key.
        return chunk.map(() => null) as (T | null)[];
      }
    }),
  );
  const results: (T | null)[] = [];
  batches.forEach((batch, ci) => {
    const expected = chunks[ci].length;
    for (let i = 0; i < expected; i++) results.push(batch?.[i] ?? null);
  });
  return results;
}

/**
 * Read all cached LiveSnaps for a list of handles.
 * Returns a Map of handle → CachedSnap (only entries with data).
 *
 * Uses chunked mget to avoid exceeding Upstash's 10 MB request-size limit.
 */
export async function readAllLiveSnaps(handles: string[]): Promise<Map<string, CachedSnap>> {
  const store = await kv();
  const result = new Map<string, CachedSnap>();
  if (!store) return result;

  // Batch: resolve all handles → channelIds (small strings, safe in one call
  // but chunked anyway for consistency)
  const mappingKeys = handles.map((h) => `chanmap:${normalizeHandle(h)}`);
  const channelIds = await chunkedMget<string>(store, mappingKeys);

  // Batch: fetch live snaps in small chunks (these are the large objects)
  const liveKeys: string[] = [];
  const handleForKey: string[] = [];
  channelIds.forEach((id, i) => {
    if (id) {
      liveKeys.push(`live:${id}`);
      handleForKey.push(handles[i]);
    }
  });

  if (liveKeys.length === 0) return result;
  const snaps = await chunkedMget<CachedSnap>(store, liveKeys);
  snaps.forEach((snap, i) => {
    if (snap) result.set(handleForKey[i], snap);
  });

  return result;
}

// ── Sync metadata ─────────────────────────────────────────────────────────

export async function writeSyncMeta(meta: SyncMeta) {
  const store = await kv();
  if (!store) return;
  await store.set('sync:meta', meta);
}

export async function readSyncMeta(): Promise<SyncMeta | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get('sync:meta')) as SyncMeta | null;
}

// ── Cooldown check for manual refresh ─────────────────────────────────────

const REFRESH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function canRefresh(): Promise<{ allowed: boolean; nextAllowedAt: string | null; lastSyncAt: string | null }> {
  const meta = await readSyncMeta();
  if (!meta) return { allowed: true, nextAllowedAt: null, lastSyncAt: null };
  // If the last sync completely failed (0 artists), don't enforce cooldown —
  // no quota was used, so retrying immediately is safe.
  if (meta.status === 'failed' && meta.artistsSuccess === 0) {
    return { allowed: true, nextAllowedAt: null, lastSyncAt: meta.lastSyncAt };
  }
  const elapsed = Date.now() - new Date(meta.lastSyncAt).getTime();
  if (elapsed >= REFRESH_COOLDOWN_MS) {
    return { allowed: true, nextAllowedAt: null, lastSyncAt: meta.lastSyncAt };
  }
  const nextAllowed = new Date(new Date(meta.lastSyncAt).getTime() + REFRESH_COOLDOWN_MS).toISOString();
  return { allowed: false, nextAllowedAt: nextAllowed, lastSyncAt: meta.lastSyncAt };
}
