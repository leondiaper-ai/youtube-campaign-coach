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
  subs: number;
  views: number;
  uploads30d: number;
  shorts30d: number;
  upcomingCount: number;
  lastUploadAt: string | null;
};

const MAX_HISTORY = 180;

async function kv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const mod = await import('@vercel/kv');
    return mod.kv;
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
  if (snap.subs == null) return;

  const entry: ChannelSnapshot = {
    ts: todayKey(),
    subs: snap.subs,
    views: snap.views ?? 0,
    uploads30d: snap.uploads30d ?? 0,
    shorts30d: snap.shorts30d ?? 0,
    upcomingCount: snap.upcomingCount ?? 0,
    lastUploadAt: snap.lastUploadAt ?? null,
  };

  const key = `snap:${channelId}`;
  const history = ((await store.get(key)) as ChannelSnapshot[] | null) ?? [];

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

// --- helpers for consumers ---

export function deltaOver(history: ChannelSnapshot[], days: number, field: 'subs' | 'views') {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const cutoff = Date.now() - days * 86400000;
  // Find the oldest entry within the window
  const baseline =
    [...history].reverse().find((h) => new Date(h.ts).getTime() <= cutoff) ??
    history[0];
  const delta = last[field] - baseline[field];
  const pct = baseline[field] > 0 ? delta / baseline[field] : 0;
  return { delta, pct, baseline, last };
}

export function seriesForField(
  history: ChannelSnapshot[],
  field: 'subs' | 'views',
  days = 30
): { x: number; y: number }[] {
  const cutoff = Date.now() - days * 86400000;
  return history
    .filter((h) => new Date(h.ts).getTime() >= cutoff)
    .map((h) => ({ x: new Date(h.ts).getTime(), y: h[field] }));
}
