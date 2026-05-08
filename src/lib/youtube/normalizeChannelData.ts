// ─────────────────────────────────────────────────────────────────────────────
// Normalized Channel Data — single source of truth for all YouTube metrics.
//
// Every page, component, and API route consumes NormalizedChannel instead of
// doing its own ad-hoc calculations from raw LiveSnap + history arrays.
//
// Design principles:
//  1. One function in, one trusted dataset out. No duplicated calculations.
//  2. Confidence scoring — every metric says how much you can trust it.
//  3. Safe merges — null API responses never overwrite valid stored data.
//  4. Centralized thresholds — one place to tune, every consumer inherits.
// ─────────────────────────────────────────────────────────────────────────────

import type { LiveSnap, Artist } from '../artists';
import { daysSince } from '../artists';
import type { ChannelSnapshot } from '../snapshots';
import { deltaOver, campaignDelta, seriesForField } from '../snapshots';
import type { CachedSnap } from '../kvCache';

// ── Centralized Thresholds ────────────────────────────────────────────────
// Every threshold used across the system lives here. No more duplicated
// magic numbers in deriveFromLive, getYouTubeGrowthState, getCampaignSignal.

export const THRESHOLDS = {
  /** Minimum 7d views to count as "strong" view activity */
  viewsStrong: 5_000,
  /** Minimum 7d views for SCALE state */
  viewsScale: 5_000,

  // Cadence
  coldLastUploadDays: 60,
  coldNoUploadFloor: 30,
  atRiskLastUploadDays: 30,
  atRiskSparseUploads: 2,
  atRiskSparseDays: 14,
  atRiskCampaignMinUploads: 3,
  healthyMinUploads: 5,
  healthyMaxLastUploadDays: 7,
  scaleMinUploads: 5,
  scaleMinShorts: 3,
  weakConversionMinUploads: 3,
  underfedMaxUploads: 2,

  // Data freshness
  freshMaxHours: 36,
  staleMaxHours: 72,

  // Confidence — how much history we need
  highConfidenceMinDays: 14,
  medConfidenceMinDays: 3,
} as const;

// ── Data Health ───────────────────────────────────────────────────────────

export type DataHealth = 'FRESH' | 'STALE' | 'PARTIAL' | 'NO_DATA';

export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// ── Delta Result ──────────────────────────────────────────────────────────
// Wraps a numeric delta with metadata about trustworthiness.

export type DeltaResult = {
  /** Raw numeric change */
  delta: number;
  /** Percentage change (0–1 scale) */
  pct: number;
  /** Whether this delta is meaningful (non-zero, sufficient history) */
  meaningful: boolean;
  /** Days of history this delta actually spans */
  daysCovered: number;
  /** Confidence in this specific delta */
  confidence: DataConfidence;
};

// ── Cadence Metrics ───────────────────────────────────────────────────────

export type CadenceMetrics = {
  uploads30d: number;
  shorts30d: number;
  videos30d: number;
  lastUploadDaysAgo: number | null;
  /** Average days between uploads (null if < 2 uploads) */
  avgUploadGapDays: number | null;
  /** Qualitative cadence label */
  cadenceLabel: 'strong' | 'moderate' | 'light' | 'none';
  /** Human-readable cadence description */
  cadenceLine: string;
};

// ── Campaign Context (optional input) ─────────────────────────────────────

export type CampaignContext = {
  campaignName: string;
  campaignStartDate: string;
  isActive: boolean;
};

// ── Campaign Metrics (output when campaign context provided) ──────────────

export type CampaignMetrics = {
  campaignDay: number;
  viewsDelta: DeltaResult | null;
  subsDelta: DeltaResult | null;
};

// ── NormalizedChannel — the unified output type ───────────────────────────

export type NormalizedChannel = {
  // ── Identity ──
  channelId: string | null;
  handle: string | null;
  title: string | null;
  thumbnail: string | null;

  // ── Absolute metrics ──
  subs: number | null;
  views: number | null;

  // ── Deltas ──
  subs7d: DeltaResult | null;
  views7d: DeltaResult | null;
  subs30d: DeltaResult | null;
  views30d: DeltaResult | null;

  // ── Cadence ──
  cadence: CadenceMetrics;

  // ── Sparkline data ──
  sparklineSubs30d: { x: number; y: number }[];
  sparklineViews30d: { x: number; y: number }[];

  // ── Campaign (only when campaign context provided) ──
  campaign: CampaignMetrics | null;

  // ── Data quality ──
  health: DataHealth;
  confidence: DataConfidence;
  /** ISO timestamp of when the underlying data was fetched */
  dataFetchedAt: string | null;
  /** Number of daily snapshots available */
  historyDepthDays: number;
  /** Human-readable data quality note */
  healthNote: string;
};

// ── Core normalize function ───────────────────────────────────────────────

export function normalizeChannelData(
  snap: LiveSnap | CachedSnap | null,
  history: ChannelSnapshot[],
  campaignCtx?: CampaignContext | null,
): NormalizedChannel {
  // Handle null/missing snap gracefully
  if (!snap) {
    return emptyNormalized(history, campaignCtx);
  }

  // ── Data health assessment ──
  const cachedAt = 'cachedAt' in snap ? (snap as CachedSnap).cachedAt : null;
  const health = assessHealth(snap, cachedAt);
  const confidence = assessConfidence(history);

  // ── Deltas ──
  const subs7Raw = deltaOver(history, 7, 'subs');
  const views7Raw = deltaOver(history, 7, 'views');
  const subs30Raw = deltaOver(history, 30, 'subs');
  const views30Raw = deltaOver(history, 30, 'views');

  const subs7d = wrapDelta(subs7Raw, 7, history);
  const views7d = wrapDelta(views7Raw, 7, history);
  const subs30d = wrapDelta(subs30Raw, 30, history);
  const views30d = wrapDelta(views30Raw, 30, history);

  // ── Cadence ──
  const cadence = computeCadence(snap);

  // ── Sparklines ──
  const sparklineSubs30d = seriesForField(history, 'subs', 30);
  const sparklineViews30d = seriesForField(history, 'views', 30);

  // ── Campaign ──
  const campaign = campaignCtx ? computeCampaignMetrics(history, campaignCtx) : null;

  // ── Health note ──
  const healthNote = buildHealthNote(health, confidence, history.length);

  return {
    channelId: snap.channelId ?? null,
    handle: snap.handle ?? null,
    title: snap.title ?? null,
    thumbnail: snap.thumbnail ?? null,
    subs: snap.subs ?? null,
    views: snap.views ?? null,
    subs7d,
    views7d,
    subs30d,
    views30d,
    cadence,
    sparklineSubs30d,
    sparklineViews30d,
    campaign,
    health,
    confidence,
    dataFetchedAt: cachedAt,
    historyDepthDays: computeHistoryDepth(history),
    healthNote,
  };
}

// ── Safe merge: never let null overwrite valid data ───────────────────────
// Use when writing new API data back to cache. If the API returned nulls
// (quota exhaustion, transient error), keep the previous cached values.

export function safeMergeSnap(
  existing: LiveSnap | null,
  incoming: LiveSnap,
): LiveSnap {
  if (!existing) return incoming;

  // If incoming has an error or key metrics are null, preserve existing
  if (incoming.error) {
    return existing;
  }

  return {
    ...existing,
    // Only overwrite fields that have real data in the incoming snap
    channelId: incoming.channelId ?? existing.channelId,
    title: incoming.title ?? existing.title,
    handle: incoming.handle ?? existing.handle,
    subs: incoming.subs ?? existing.subs,
    views: incoming.views ?? existing.views,
    uploads30d: incoming.uploads30d ?? existing.uploads30d,
    lastUploadAt: incoming.lastUploadAt !== undefined ? incoming.lastUploadAt : existing.lastUploadAt,
    thumbnail: incoming.thumbnail ?? existing.thumbnail,
    recentUploads: incoming.recentUploads ?? existing.recentUploads,
    topEverVideos: incoming.topEverVideos ?? existing.topEverVideos,
    shorts30d: incoming.shorts30d ?? existing.shorts30d,
    upcomingCount: incoming.upcomingCount ?? existing.upcomingCount,
    captionsMissing30d: incoming.captionsMissing30d ?? existing.captionsMissing30d,
    missingCaptionsVideos: incoming.missingCaptionsVideos ?? existing.missingCaptionsVideos,
  };
}

// ── Week-on-Week calculation ─────────────────────────────────────────────
// Computes WoW change by comparing current 7d delta vs previous 7d delta.
// Returns null (→ "—" in UI) when data is insufficient for a reliable comparison.

export type WoWResult = {
  value: number;        // percentage change
  reliable: boolean;    // false when data is partial or confidence LOW
  note: string;         // human-readable explanation when unreliable
};

export function computeWoW(
  current7d: DeltaResult | null,
  raw14d: ReturnType<typeof deltaOver>,
): WoWResult | null {
  // No current 7d delta → can't compute WoW
  if (!current7d) return null;

  // Current delta not meaningful (zero from stale data) → skip WoW
  if (!current7d.meaningful) return null;

  // No 14d data → can't derive previous week
  if (!raw14d) return null;

  // Guard: if the 14d delta doesn't actually cover significantly more time
  // than the 7d delta, the "previous week" is just noise.
  const days14Covered = Math.round(
    (new Date(raw14d.last.ts).getTime() - new Date(raw14d.baseline.ts).getTime()) / 86400000,
  );

  // Need at least 10 days of actual data for a 14d window to be meaningful
  // (otherwise the "previous week" portion is too thin)
  if (days14Covered < 10) {
    return null;
  }

  const prevDelta = raw14d.delta - current7d.delta;

  // Previous period delta is zero → can't compute percentage change
  if (prevDelta === 0) return null;

  const wow = ((current7d.delta - prevDelta) / Math.abs(prevDelta)) * 100;

  // Reliability check: is the current 7d confidence at least MEDIUM?
  const reliable = current7d.confidence !== 'LOW' && days14Covered >= 12;

  return {
    value: wow,
    reliable,
    note: !reliable ? 'Limited history — WoW may be unreliable' : '',
  };
}

// ── Convenience: extract raw deltas for legacy consumers ──────────────────
// During migration, some components still expect plain numbers.

export function rawDelta(d: DeltaResult | null): number | null {
  if (!d) return null;
  return d.meaningful ? d.delta : null;
}

export function rawDeltaOrZero(d: DeltaResult | null): number {
  return d?.delta ?? 0;
}

// ── Convenience: build GrowthInput from NormalizedChannel ─────────────────
// Bridges the new normalized type to the existing GrowthOS functions
// during the gradual migration period.

export function toGrowthInput(
  nc: NormalizedChannel,
  artist?: Pick<Artist, 'campaign' | 'campaignStartDate'>,
): {
  subscribers?: number;
  views7d: number | null;
  subscribers7d: number | null;
  uploads30d: number;
  shorts30d: number;
  lastUploadDaysAgo: number | null;
  hasActiveCampaign: boolean;
  campaignName?: string;
} {
  return {
    subscribers: nc.subs ?? undefined,
    views7d: rawDelta(nc.views7d),
    subscribers7d: rawDelta(nc.subs7d),
    uploads30d: nc.cadence.uploads30d,
    shorts30d: nc.cadence.shorts30d,
    lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo,
    hasActiveCampaign: nc.campaign != null || !!artist?.campaign,
    campaignName: artist?.campaign,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function emptyNormalized(
  history: ChannelSnapshot[],
  campaignCtx?: CampaignContext | null,
): NormalizedChannel {
  return {
    channelId: null,
    handle: null,
    title: null,
    thumbnail: null,
    subs: null,
    views: null,
    subs7d: null,
    views7d: null,
    subs30d: null,
    views30d: null,
    cadence: {
      uploads30d: 0,
      shorts30d: 0,
      videos30d: 0,
      lastUploadDaysAgo: null,
      avgUploadGapDays: null,
      cadenceLabel: 'none',
      cadenceLine: 'No data',
    },
    sparklineSubs30d: [],
    sparklineViews30d: [],
    campaign: campaignCtx ? { campaignDay: 0, viewsDelta: null, subsDelta: null } : null,
    health: 'NO_DATA',
    confidence: 'LOW',
    dataFetchedAt: null,
    historyDepthDays: 0,
    healthNote: 'No channel data available',
  };
}

function assessHealth(snap: LiveSnap, cachedAt: string | null): DataHealth {
  if (snap.subs == null && snap.views == null) return 'NO_DATA';
  if (!cachedAt) return 'PARTIAL';

  const ageHours = (Date.now() - new Date(cachedAt).getTime()) / 3600000;
  if (ageHours <= THRESHOLDS.freshMaxHours) return 'FRESH';
  if (ageHours <= THRESHOLDS.staleMaxHours) return 'STALE';
  return 'STALE';
}

function assessConfidence(history: ChannelSnapshot[]): DataConfidence {
  const depth = computeHistoryDepth(history);
  if (depth >= THRESHOLDS.highConfidenceMinDays) return 'HIGH';
  if (depth >= THRESHOLDS.medConfidenceMinDays) return 'MEDIUM';
  return 'LOW';
}

function computeHistoryDepth(history: ChannelSnapshot[]): number {
  if (history.length < 2) return history.length;
  const first = new Date(history[0].ts).getTime();
  const last = new Date(history[history.length - 1].ts).getTime();
  return Math.round((last - first) / 86400000);
}

function wrapDelta(
  raw: ReturnType<typeof deltaOver>,
  requestedDays: number,
  history: ChannelSnapshot[],
): DeltaResult | null {
  if (!raw) return null;

  const daysCovered = Math.round(
    (new Date(raw.last.ts).getTime() - new Date(raw.baseline.ts).getTime()) / 86400000,
  );

  // A delta of 0 with stale data is not meaningful — it likely means the
  // cron wrote identical values from a quota-exhausted API response.
  const meaningful = raw.delta !== 0 && daysCovered >= 1;

  // Delta confidence depends on how close the actual window is to the
  // requested window. A "7-day" delta spanning only 2 days is less reliable.
  const windowRatio = daysCovered / requestedDays;
  let confidence: DataConfidence = 'HIGH';
  if (windowRatio < 0.5) confidence = 'LOW';
  else if (windowRatio < 0.8) confidence = 'MEDIUM';

  return {
    delta: raw.delta,
    pct: raw.pct,
    meaningful,
    daysCovered,
    confidence,
  };
}

function computeCadence(snap: LiveSnap): CadenceMetrics {
  const uploads30d = snap.uploads30d ?? 0;
  const shorts30d = snap.shorts30d ?? 0;
  const videos30d = Math.max(0, uploads30d - shorts30d);
  const lastUploadDaysAgo = daysSince(snap.lastUploadAt) ?? null;

  // Estimate avg gap from recent uploads if available
  let avgUploadGapDays: number | null = null;
  if (snap.recentUploads && snap.recentUploads.length >= 2) {
    const sorted = [...snap.recentUploads]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = (new Date(sorted[i].publishedAt).getTime() - new Date(sorted[i + 1].publishedAt).getTime()) / 86400000;
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length > 0) {
      avgUploadGapDays = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
    }
  }

  let cadenceLabel: CadenceMetrics['cadenceLabel'];
  if (uploads30d >= 10) cadenceLabel = 'strong';
  else if (uploads30d >= 3) cadenceLabel = 'moderate';
  else if (uploads30d >= 1) cadenceLabel = 'light';
  else cadenceLabel = 'none';

  let cadenceLine: string;
  if (uploads30d >= 10) cadenceLine = `Strong cadence — ${uploads30d} uploads / 30d`;
  else if (uploads30d >= 3) cadenceLine = `Moderate cadence — ${uploads30d} uploads / 30d`;
  else if (uploads30d >= 1) cadenceLine = `Light cadence — ${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  else cadenceLine = 'No recent cadence';

  return {
    uploads30d,
    shorts30d,
    videos30d,
    lastUploadDaysAgo,
    avgUploadGapDays,
    cadenceLabel,
    cadenceLine,
  };
}

function computeCampaignMetrics(
  history: ChannelSnapshot[],
  ctx: CampaignContext,
): CampaignMetrics {
  const startTs = new Date(ctx.campaignStartDate).getTime();
  const campaignDay = Math.max(1, Math.floor((Date.now() - startTs) / 86400000));

  const viewsRaw = campaignDelta(history, ctx.campaignStartDate, 'views');
  const subsRaw = campaignDelta(history, ctx.campaignStartDate, 'subs');

  return {
    campaignDay,
    viewsDelta: viewsRaw
      ? {
          delta: viewsRaw.delta,
          pct: viewsRaw.pct,
          meaningful: viewsRaw.delta !== 0 && viewsRaw.daysCovered >= 1,
          daysCovered: viewsRaw.daysCovered,
          confidence: viewsRaw.daysCovered >= 7 ? 'HIGH' : viewsRaw.daysCovered >= 3 ? 'MEDIUM' : 'LOW',
        }
      : null,
    subsDelta: subsRaw
      ? {
          delta: subsRaw.delta,
          pct: subsRaw.pct,
          meaningful: subsRaw.delta !== 0 && subsRaw.daysCovered >= 1,
          daysCovered: subsRaw.daysCovered,
          confidence: subsRaw.daysCovered >= 7 ? 'HIGH' : subsRaw.daysCovered >= 3 ? 'MEDIUM' : 'LOW',
        }
      : null,
  };
}

function buildHealthNote(
  health: DataHealth,
  confidence: DataConfidence,
  snapshotCount: number,
): string {
  if (health === 'NO_DATA') return 'No channel data available';

  const parts: string[] = [];

  // Health component
  if (health === 'FRESH') parts.push('Data is current');
  else if (health === 'STALE') parts.push('Data may be outdated');
  else if (health === 'PARTIAL') parts.push('Partial data only');

  // Confidence component
  if (confidence === 'LOW') {
    parts.push(snapshotCount <= 1
      ? 'insufficient history for trends'
      : 'limited history — trends may be unreliable');
  } else if (confidence === 'MEDIUM') {
    parts.push('building history — trends are directional');
  }
  // HIGH confidence: no note needed

  return parts.join(' · ');
}
