// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY CHANNEL SNAPSHOTS — persistent history layer for Virgin Managed artists.
// One snapshot per artist per ISO week. Backed by KV (Upstash/Vercel).
// No-ops gracefully when KV env vars are missing.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArtistClassification } from './artists';

// ── Types ──────────────────────────────────────────────────────────────────

export type MissedOpportunityType =
  | 'conversion_gap'
  | 'velocity_gap'
  | 'cadence_gap'
  | 'cold_channel'
  | 'none';

export type WeeklyChannelSnapshot = {
  // Identity
  snapshotDate: string;           // ISO date of capture
  weekId: string;                 // ISO week (e.g. "2026-W18")
  weekStartDate: string;          // Monday of that week (yyyy-mm-dd)
  artistSlug: string;
  artistName: string;
  channelId: string;
  artistType: 'managed';

  // Classification
  currentClassification: ArtistClassification;
  channelState: string;           // ChannelState from artists.ts
  campaignState: string;          // Campaign signal label

  // Metrics — totals
  subscriberTotal: number;
  viewTotal: number;

  // Metrics — period
  uploads30d: number;
  uploads7d: number;              // Approximated from 30d
  shorts7d: number;               // Approximated from 30d
  views7d: number;
  subscribers7d: number;

  // Week-on-week
  viewsWoW: number | null;        // % change vs previous 7d
  subscribersWoW: number | null;

  // Conversion
  subsPer1kViews: number | null;

  // Value model
  estimatedValueLow: number;      // £ from viewsToRevenue + subsToValue
  estimatedValueHigh: number;

  // Opportunity
  missedOpportunityType: MissedOpportunityType;
  recommendedAction: string;

  // Free-text
  notes: string;
};

export type WeeklyRollup = {
  weekId: string;
  weekStartDate: string;
  totalArtists: number;
  growingCount: number;
  weakConversionCount: number;
  underfedCount: number;
  coldCount: number;
  totalViews7d: number;
  totalSubscribers7d: number;
  totalEstimatedValueLow: number;
  totalEstimatedValueHigh: number;
  biggestImprovers: { slug: string; name: string; viewsWoW: number }[];
  biggestDecliners: { slug: string; name: string; viewsWoW: number }[];
  mostCommonOpportunity: MissedOpportunityType;
};

// ── KV helpers ─────────────────────────────────────────────────────────────

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

/** KV key for an artist's snapshot history */
function snapshotKey(slug: string): string {
  return `weekly-snapshots:${slug}`;
}

/** KV key for weekly rollups */
const ROLLUP_KEY = 'weekly-rollups';

/** Get ISO week string for a date (e.g. "2026-W18") */
export function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Get the Monday of the ISO week for a date */
export function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// ── CRUD operations ────────────────────────────────────────────────────────

const MAX_SNAPSHOTS_PER_ARTIST = 52; // ~1 year of weekly history

/** List all weekly snapshots for an artist (newest first) */
export async function listSnapshots(slug: string): Promise<WeeklyChannelSnapshot[]> {
  const store = await kv();
  if (!store) return [];
  const data = await store.get(snapshotKey(slug));
  return ((data as WeeklyChannelSnapshot[] | null) ?? []).sort(
    (a, b) => b.weekId.localeCompare(a.weekId)
  );
}

/** Save a weekly snapshot. Dedupes by weekId — skips if already exists for this week. */
export async function saveSnapshot(
  snapshot: WeeklyChannelSnapshot,
): Promise<{ saved: boolean; reason?: string }> {
  const store = await kv();
  if (!store) return { saved: false, reason: 'KV not configured' };

  const key = snapshotKey(snapshot.artistSlug);
  const existing = ((await store.get(key)) as WeeklyChannelSnapshot[] | null) ?? [];

  // Dedupe: skip if we already have this weekId
  if (existing.some((s) => s.weekId === snapshot.weekId)) {
    return { saved: false, reason: 'already_captured' };
  }

  // Append and trim to max
  const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS_PER_ARTIST);
  await store.set(key, updated);
  return { saved: true };
}

/** Get the latest N snapshots for an artist */
export async function getRecentSnapshots(
  slug: string,
  count: number = 4,
): Promise<WeeklyChannelSnapshot[]> {
  const all = await listSnapshots(slug);
  return all.slice(0, count);
}

// ── Rollup operations ──────────────────────────────────────────────────────

/** Save a weekly rollup */
export async function saveRollup(rollup: WeeklyRollup): Promise<void> {
  const store = await kv();
  if (!store) return;
  const existing = ((await store.get(ROLLUP_KEY)) as WeeklyRollup[] | null) ?? [];
  // Replace if same weekId, otherwise prepend
  const filtered = existing.filter((r) => r.weekId !== rollup.weekId);
  const updated = [rollup, ...filtered].slice(0, 52);
  await store.set(ROLLUP_KEY, updated);
}

/** List recent weekly rollups (newest first) */
export async function listRollups(count: number = 12): Promise<WeeklyRollup[]> {
  const store = await kv();
  if (!store) return [];
  const data = await store.get(ROLLUP_KEY);
  return ((data as WeeklyRollup[] | null) ?? [])
    .sort((a, b) => b.weekId.localeCompare(a.weekId))
    .slice(0, count);
}

// ── Rollup computation ─────────────────────────────────────────────────────

/** Compute a weekly rollup from a set of snapshots for the same week */
export function computeRollup(
  snapshots: WeeklyChannelSnapshot[],
  weekId: string,
  weekStartDate: string,
): WeeklyRollup {
  const growingCount = snapshots.filter((s) => s.currentClassification === 'GROWING').length;
  const weakConversionCount = snapshots.filter((s) => s.currentClassification === 'WEAK_CONVERSION').length;
  const underfedCount = snapshots.filter((s) => s.currentClassification === 'UNDERFED').length;
  const coldCount = snapshots.filter((s) => s.currentClassification === 'COLD').length;

  const totalViews7d = snapshots.reduce((sum, s) => sum + s.views7d, 0);
  const totalSubscribers7d = snapshots.reduce((sum, s) => sum + s.subscribers7d, 0);
  const totalEstimatedValueLow = snapshots.reduce((sum, s) => sum + s.estimatedValueLow, 0);
  const totalEstimatedValueHigh = snapshots.reduce((sum, s) => sum + s.estimatedValueHigh, 0);

  // Biggest improvers/decliners by views WoW
  const withWoW = snapshots
    .filter((s) => s.viewsWoW != null)
    .sort((a, b) => (b.viewsWoW ?? 0) - (a.viewsWoW ?? 0));
  const biggestImprovers = withWoW
    .filter((s) => (s.viewsWoW ?? 0) > 0)
    .slice(0, 3)
    .map((s) => ({ slug: s.artistSlug, name: s.artistName, viewsWoW: s.viewsWoW ?? 0 }));
  const biggestDecliners = withWoW
    .filter((s) => (s.viewsWoW ?? 0) < 0)
    .slice(-3)
    .reverse()
    .map((s) => ({ slug: s.artistSlug, name: s.artistName, viewsWoW: s.viewsWoW ?? 0 }));

  // Most common opportunity type
  const oppCounts: Record<MissedOpportunityType, number> = {
    conversion_gap: 0, velocity_gap: 0, cadence_gap: 0, cold_channel: 0, none: 0,
  };
  for (const s of snapshots) oppCounts[s.missedOpportunityType]++;
  const mostCommon = (Object.entries(oppCounts) as [MissedOpportunityType, number][])
    .filter(([k]) => k !== 'none')
    .sort((a, b) => b[1] - a[1])[0];

  return {
    weekId,
    weekStartDate,
    totalArtists: snapshots.length,
    growingCount,
    weakConversionCount,
    underfedCount,
    coldCount,
    totalViews7d,
    totalSubscribers7d,
    totalEstimatedValueLow,
    totalEstimatedValueHigh,
    biggestImprovers,
    biggestDecliners,
    mostCommonOpportunity: mostCommon ? mostCommon[0] : 'none',
  };
}
