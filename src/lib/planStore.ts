/**
 * Plan Store — persistent campaign plan storage in KV.
 *
 * Every generated plan becomes a saved campaign page at /coach/[slug].
 * Over time this builds a proprietary campaign intelligence archive.
 *
 * KV key patterns:
 *   plan:{slug}              → SavedPlan (the full plan + metadata)
 *   plans:index              → PlanIndexEntry[] (lightweight list for archive)
 */

import type { GeneratedPlan, ChannelContext } from './planEngine';

// ── Types ──────────────────────────────────────────────────────────────────

/** Source of a historical activity entry */
export type HistoricalSource = 'youtube_api' | 'kv_cache' | 'coach_archive' | 'manual';

/** Manual or auto-imported historical activity entry */
export type HistoricalActivity = {
  date: string;             // ISO date (yyyy-mm-dd) or partial (yyyy-mm)
  title: string;
  format: 'short' | 'video' | 'premiere' | 'live' | 'community' | 'bts' | 'lyric_video' | 'visualizer' | 'other';
  phase?: string;           // e.g. 'BUILD', 'RELEASE'
  status: 'completed' | 'live' | 'planned' | 'missing' | 'recommended';
  source: HistoricalSource;
  /** YouTube video ID if available */
  videoId?: string;
  /** View count if known */
  viewCount?: number;
};

/** Where the campaign's historical data came from */
export type CampaignDataCoverage = {
  /** Sources that contributed data */
  sources: HistoricalSource[];
  /** How far back the YouTube API data goes (ISO date) */
  apiCoverageFrom?: string;
  /** Whether the full campaign window is covered */
  fullCoverage: boolean;
  /** Human-readable coverage note */
  coverageNote: string;
};

export type SavedPlan = {
  slug: string;
  artist: string;
  campaignName: string;
  plan: GeneratedPlan;
  channelCtx: ChannelContext | null;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  timelineText: string;   // original input — useful for re-generation
  /** Manually seeded or imported historical activity */
  historicalActivity?: HistoricalActivity[];
  /** Data coverage metadata */
  dataCoverage?: CampaignDataCoverage;
};

export type PlanIndexEntry = {
  slug: string;
  artist: string;
  campaignName: string;
  createdAt: string;
  updatedAt: string;
  totalWeeks: number;
  eventCount: number;
  /** Channel state at time of generation */
  channelState?: string;
};

// ── KV client ─────────────────────────────────────────────────────────────

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

// ── Slug generation ────────────────────────────────────────────────────────

export function generateSlug(artist: string, campaignName: string): string {
  const base = `${artist}-${campaignName}`
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'campaign';
}

// ── CRUD operations ────────────────────────────────────────────────────────

const INDEX_KEY = 'plans:index';
const planKey = (slug: string) => `plan:${slug}`;

export async function savePlan(
  slug: string,
  artist: string,
  plan: GeneratedPlan,
  channelCtx: ChannelContext | null,
  timelineText: string,
): Promise<SavedPlan> {
  const store = await kv();
  const now = new Date().toISOString();

  const saved: SavedPlan = {
    slug,
    artist,
    campaignName: plan.campaignName,
    plan,
    channelCtx,
    createdAt: now,
    updatedAt: now,
    timelineText,
  };

  if (!store) return saved;

  // Check if updating existing
  const existing = await store.get(planKey(slug)) as SavedPlan | null;
  if (existing) {
    saved.createdAt = existing.createdAt;
  }

  await store.set(planKey(slug), saved);

  // Update index
  const index = ((await store.get(INDEX_KEY)) as PlanIndexEntry[] | null) ?? [];
  const entry: PlanIndexEntry = {
    slug,
    artist,
    campaignName: plan.campaignName,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    totalWeeks: plan.totalWeeks,
    eventCount: plan.events.length,
    channelState: channelCtx?.state,
  };

  const next = [
    entry,
    ...index.filter((e) => e.slug !== slug),
  ];
  await store.set(INDEX_KEY, next);

  return saved;
}

export async function loadPlan(slug: string): Promise<SavedPlan | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get(planKey(slug))) as SavedPlan | null;
}

export async function listPlans(): Promise<PlanIndexEntry[]> {
  const store = await kv();
  if (!store) return [];
  const index = ((await store.get(INDEX_KEY)) as PlanIndexEntry[] | null) ?? [];
  // Most recent first
  return index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateSavedPlan(
  slug: string,
  updates: Partial<Pick<SavedPlan, 'plan'>>,
): Promise<SavedPlan | null> {
  const store = await kv();
  if (!store) return null;

  const existing = (await store.get(planKey(slug))) as SavedPlan | null;
  if (!existing) return null;

  const updated: SavedPlan = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await store.set(planKey(slug), updated);

  // Update index timestamp
  const index = ((await store.get(INDEX_KEY)) as PlanIndexEntry[] | null) ?? [];
  const idx = index.findIndex((e) => e.slug === slug);
  if (idx >= 0) {
    index[idx].updatedAt = updated.updatedAt;
    await store.set(INDEX_KEY, index);
  }

  return updated;
}

export async function deletePlan(slug: string): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.del(planKey(slug));
  const index = ((await store.get(INDEX_KEY)) as PlanIndexEntry[] | null) ?? [];
  await store.set(INDEX_KEY, index.filter((e) => e.slug !== slug));
}
