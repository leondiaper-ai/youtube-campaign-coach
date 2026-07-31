import type { LiveSnap } from './artists';

/**
 * Time-series snapshot store. Backed by Vercel KV when the
 * KV_REST_API_URL / KV_REST_API_TOKEN env vars are present. If not,
 * silently no-ops so local dev and unconfigured deploys still work.
 *
 * One entry per channel per day. We keep up to 180 days of history.
 */

export type ChannelSnapshot = {
  ts: string;            // ISO date (yyyy-mm-dd, one per day)
  subs: number | null;
  views: number | null;
  uploads30d: number;
  shorts30d: number;
  upcomingCount: number;
  lastUploadAt: string | null;
};

const MAX_HISTORY = 180;

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function writeSnapshot(channelId: string, snap: LiveSnap) {
  const store = await kv();
  if (!store) return;

  // SAFETY: Never write a snapshot where both core metrics are null.
  // A partial response (subs present, views null) is still worth storing
  // because we preserve the non-null field. But if BOTH are null, the
  // API response was empty and writing it would contaminate history.
  if (snap.subs == null && snap.views == null) return;

  const entry: ChannelSnapshot = {
    ts: todayKey(),
    subs: snap.subs ?? null,   // preserve null — NEVER coerce to 0
    views: snap.views ?? null, // preserve null — NEVER coerce to 0
    uploads30d: snap.uploads30d ?? 0,
    shorts30d: snap.shorts30d ?? 0,
    upcomingCount: snap.upcomingCount ?? 0,
    lastUploadAt: snap.lastUploadAt ?? null,
  };

  // RUNTIME INVARIANT: catch any future regression where null gets coerced to 0.
  // A real channel never has literally 0 total views with non-null subs, or vice versa.
  // If we see subs > 1000 but views === 0, something upstream coerced null → 0.
  if (entry.views === 0 && entry.subs != null && entry.subs > 1000) {
    console.warn(`[writeSnapshot] ZERO-SAFETY: Blocked suspicious views=0 for channel ${channelId} (subs=${entry.subs}). Storing as null.`);
    entry.views = null;
  }
  if (entry.subs === 0 && entry.views != null && entry.views > 10000) {
    console.warn(`[writeSnapshot] ZERO-SAFETY: Blocked suspicious subs=0 for channel ${channelId} (views=${entry.views}). Storing as null.`);
    entry.subs = null;
  }

  const key = `snap:${channelId}`;
  const history = ((await store.get(key)) as ChannelSnapshot[] | null) ?? [];

  // OBSERVABILITY: lifetime view totals should only ever climb. A drop is
  // usually YouTube revising a total (spam purge, or videos removed/privated)
  // and is stored as-is because it is the channel's real current total — but
  // it will read as a negative delta for the next 7 days, so record it. If
  // this fires for many channels at once, suspect a platform-wide recount
  // rather than anything campaign-related.
  const prevWithViews = [...history].reverse().find((h) => h.views != null);
  if (prevWithViews?.views != null && entry.views != null && entry.views < prevWithViews.views) {
    const drop = prevWithViews.views - entry.views;
    const pct = ((drop / prevWithViews.views) * 100).toFixed(2);
    console.warn(
      `[writeSnapshot] VIEWS DROP: ${channelId} ${prevWithViews.views} (${prevWithViews.ts}) -> ${entry.views} (${entry.ts}) = -${drop} (-${pct}%)`,
    );
  }

  // One entry per day — replace today's if it already exists
  const idx = history.findIndex((h) => h.ts === entry.ts);
  if (idx >= 0) history[idx] = entry;
  else history.push(entry);

  // Keep last MAX_HISTORY entries, sorted ascending
  history.sort((a, b) => a.ts.localeCompare(b.ts));
  const trimmed = history.slice(-MAX_HISTORY);

  await store.set(key, trimmed);
}

export async function readHistory(channelId: string): Promise<ChannelSnapshot[]> {
  const store = await kv();
  if (!store) return [];
  const history = (await store.get(`snap:${channelId}`)) as ChannelSnapshot[] | null;
  return history ?? [];
}

/** Keys per mget round-trip. Snapshot arrays are large, so keep chunks small
 *  to stay under the KV max-request-size limit. */
const HISTORY_MGET_CHUNK = 5;

/**
 * Batch-read snapshot history for many channels at once.
 *
 * Callers that need history for a whole roster should use this instead of
 * awaiting readHistory() per channel in a loop — that pattern costs one
 * sequential KV round-trip per channel and is the difference between a
 * sub-second response and a timeout on a 140-channel roster.
 *
 * Chunks are issued in parallel; duplicate ids are only fetched once.
 */
export async function readHistories(
  channelIds: string[],
): Promise<Map<string, ChannelSnapshot[]>> {
  const result = new Map<string, ChannelSnapshot[]>();
  const store = await kv();
  if (!store) return result;

  const unique = Array.from(new Set(channelIds.filter(Boolean)));
  if (unique.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += HISTORY_MGET_CHUNK) {
    chunks.push(unique.slice(i, i + HISTORY_MGET_CHUNK));
  }

  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const keys = chunk.map((id) => `snap:${id}`);
      try {
        return await store.mget<(ChannelSnapshot[] | null)[]>(...keys);
      } catch {
        // A failed chunk degrades to empty history rather than failing the
        // whole request — the caller already handles channels with no history.
        return chunk.map(() => null);
      }
    }),
  );

  chunks.forEach((chunk, ci) => {
    const batch = batches[ci] ?? [];
    chunk.forEach((id, i) => {
      result.set(id, batch[i] ?? []);
    });
  });

  return result;
}

// --- Stale data detection ---

/**
 * Detect whether a channel's view data is stale (YouTube API returning
 * the same viewCount total across consecutive snapshots).
 *
 * Stale criteria:
 *   1. Channel is "significant" — totalSubs > 50K OR totalViews > 1M
 *   2. The 7d views delta is exactly 0
 *   3. The latest snapshot viewTotal equals the previous snapshot's viewTotal
 *      (i.e. YouTube literally returned the same number twice)
 *
 * Returns a freshness classification.
 */
export type ViewFreshness = 'fresh' | 'stale' | 'insufficient_history' | 'unavailable';

export function detectViewFreshness(
  history: ChannelSnapshot[],
  subs: number | null,
): ViewFreshness {
  // No history at all → unavailable
  if (history.length === 0) return 'unavailable';

  const last = history[history.length - 1];

  // Latest snapshot has null views → unavailable
  if (last.views == null) return 'unavailable';

  // Need at least 2 snapshots to compare
  if (history.length < 2) return 'insufficient_history';

  // Find the second-to-last snapshot that has a non-null view value
  const prev = [...history].slice(0, -1).reverse().find(h => h.views != null);
  if (!prev) return 'insufficient_history';

  // Check if channel is "significant" enough for stale detection to apply.
  // Small channels can genuinely have 0 views growth.
  const isSignificant = (subs != null && subs > 50_000) || last.views > 1_000_000;
  if (!isSignificant) return 'fresh';

  // Core stale check: YouTube returned identical viewCount totals
  if (last.views === prev.views) return 'stale';

  return 'fresh';
}

/**
 * Same logic for subscriber staleness.
 */
export function detectSubsFreshness(
  history: ChannelSnapshot[],
  totalViews: number | null,
): ViewFreshness {
  if (history.length === 0) return 'unavailable';

  const last = history[history.length - 1];
  if (last.subs == null) return 'unavailable';
  if (history.length < 2) return 'insufficient_history';

  const prev = [...history].slice(0, -1).reverse().find(h => h.subs != null);
  if (!prev) return 'insufficient_history';

  // Significant channel check for subs
  const isSignificant = (totalViews != null && totalViews > 1_000_000) || last.subs > 50_000;
  if (!isSignificant) return 'fresh';

  if (last.subs === prev.subs) return 'stale';

  return 'fresh';
}

// --- helpers for consumers ---

export function deltaOver(history: ChannelSnapshot[], days: number, field: 'subs' | 'views') {
  if (history.length < 2) return null;
  const last = history[history.length - 1];

  // SAFETY: if the latest snapshot has a null value for this field,
  // we cannot compute a delta. Return null instead of producing a fake zero.
  if (last[field] == null) return null;

  // Anchor cutoff to the latest snapshot, not Date.now().
  // If the cron hasn't run recently, using Date.now() makes the cutoff
  // land AFTER the latest snapshot, causing baseline === last → delta 0.
  const lastTs = new Date(last.ts).getTime();
  const cutoff = lastTs - days * 86400000;

  // Find the newest entry at or before the cutoff that has a real (non-null) value.
  // Skip any snapshots where the field is null — these are failed/partial fetches
  // and using them as a baseline would produce a massive fake delta.
  const baseline =
    [...history].reverse().find((h) =>
      new Date(h.ts).getTime() <= cutoff && h[field] != null
    ) ??
    // Fallback: find the oldest snapshot with a real value
    history.find((h) => h[field] != null);

  // No valid baseline found, or baseline is the same snapshot
  if (!baseline || baseline.ts === last.ts) return null;
  if (baseline[field] == null) return null;

  const delta = last[field]! - baseline[field]!;
  const pct = baseline[field]! > 0 ? delta / baseline[field]! : 0;
  return { delta, pct, baseline, last };
}

// --- Top-ever video cache (weekly refresh) ---

export type TopEverCache = {
  fetchedAt: string;
  videoIds: string[];
};

export async function readTopEverCache(channelId: string): Promise<TopEverCache | null> {
  const store = await kv();
  if (!store) return null;
  return ((await store.get(`topever:${channelId}`)) as TopEverCache | null) ?? null;
}

export async function writeTopEverCache(channelId: string, videoIds: string[]) {
  const store = await kv();
  if (!store) return;
  const entry: TopEverCache = { fetchedAt: new Date().toISOString(), videoIds };
  await store.set(`topever:${channelId}`, entry);
}

/**
 * Campaign-period delta: computes subs/views change since a given start date.
 * Uses the oldest snapshot on or after the start date as the baseline.
 * Falls back to the oldest snapshot we have if none exist before the start date.
 */
export function campaignDelta(
  history: ChannelSnapshot[],
  campaignStartDate: string,
  field: 'subs' | 'views',
) {
  if (history.length < 1) return null;
  const last = history[history.length - 1];

  // SAFETY: if latest snapshot has null for this field, cannot compute delta
  if (last[field] == null) return null;

  // Find the oldest entry on or after campaign start WITH a real value
  const startTs = new Date(campaignStartDate).getTime();
  const baseline =
    history.find((h) => new Date(h.ts).getTime() >= startTs && h[field] != null) ??
    history.find((h) => h[field] != null);

  if (!baseline || baseline[field] == null) return null;

  const delta = last[field]! - baseline[field]!;
  const pct = baseline[field]! > 0 ? delta / baseline[field]! : 0;
  const daysCovered = Math.round(
    (new Date(last.ts).getTime() - new Date(baseline.ts).getTime()) / 86400000
  );
  return { delta, pct, baseline, last, daysCovered, baselineDate: baseline.ts };
}

export function seriesForField(
  history: ChannelSnapshot[],
  field: 'subs' | 'views',
  days = 30
): { x: number; y: number }[] {
  if (history.length === 0) return [];
  // Anchor to the latest snapshot, not Date.now(), for consistency
  // with deltaOver(). If the cron hasn't run recently, Date.now()
  // makes the cutoff too recent and can exclude valid data points.
  const anchor = new Date(history[history.length - 1].ts).getTime();
  const cutoff = anchor - days * 86400000;
  return history
    .filter((h) => new Date(h.ts).getTime() >= cutoff && h[field] != null)
    .map((h) => ({ x: new Date(h.ts).getTime(), y: h[field]! }));
}
