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

// ── Data Status ──────────────────────────────────────────────────────────
// Clear, user-facing data quality categories. Every row/card shows one.
//
// FRESH:       API fetched successfully, enough snapshot history for 7d and WoW
// PARTIAL:     API fetched, some fields missing or incomplete
// LIMITED:     API fetched, not enough stored snapshot history for 7d/WoW deltas
// STALE:       No fresh fetch within expected window, using last known good data
// UNAVAILABLE: API failed or channel data could not be retrieved

export type DataStatus = 'FRESH' | 'PARTIAL' | 'LIMITED' | 'STALE' | 'UNAVAILABLE';

// Keep old name as alias for backward compat during migration
export type DataHealth = DataStatus;

export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// ── Missing Reasons ─────────────────────────────────────────────────────
// Every "—" in the UI gets a reason. These are attached to NormalizedChannel
// so consumers can show tooltips explaining why data is missing.

export type MissingReason =
  | 'insufficient_snapshot_history'
  | 'api_field_unavailable'
  | 'no_recent_uploads'
  | 'channel_inactive'
  | 'fetch_failed'
  | 'comparison_period_missing'
  | 'hidden_subscriber_count'
  | 'not_applicable';

export type MissingReasonEntry = {
  field: string;
  reason: MissingReason;
  detail: string;
};

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
  /** Clear user-facing data status label */
  dataStatus: DataStatus;
  confidence: DataConfidence;
  /** ISO timestamp of when the underlying data was fetched */
  dataFetchedAt: string | null;
  /** Number of daily snapshots available */
  historyDepthDays: number;
  /** Human-readable data quality note */
  healthNote: string;
  /** Short user-facing data status explanation */
  dataStatusNote: string;
  /** Reasons why specific fields show "—" */
  missingReasons: MissingReasonEntry[];
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
  const dataStatus = deriveDataStatus(health, confidence, snap);

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
  const dataStatusNote = buildDataStatusNote(dataStatus, history.length, snap);
  const missingReasons = buildMissingReasons(snap, subs7d, views7d, history, confidence);

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
    dataStatus,
    confidence,
    dataFetchedAt: cachedAt,
    historyDepthDays: computeHistoryDepth(history),
    healthNote,
    dataStatusNote,
    missingReasons,
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

  // If incoming has an error, preserve existing entirely
  if (incoming.error) {
    return existing;
  }

  // If incoming is missing both core metrics (subs + views both null),
  // treat it as a failed fetch even without an explicit error flag.
  // This prevents a quota-exhausted or partial API response from
  // clearing valid cached data.
  if (incoming.subs == null && incoming.views == null) {
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

  // Previous period delta is zero or negligible → can't compute meaningful %
  if (prevDelta === 0) return null;

  // Guard: if both current and previous are very small absolute numbers,
  // the percentage swing is noise, not signal. Require at least a minimum
  // magnitude to avoid e.g. +1 vs +2 producing "−50% WoW".
  if (Math.abs(prevDelta) < 3 && Math.abs(current7d.delta) < 3) return null;

  const wow = ((current7d.delta - prevDelta) / Math.abs(prevDelta)) * 100;

  // Cap extreme values — anything beyond ±500% is almost certainly noise
  if (Math.abs(wow) > 500) return null;

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
    health: 'UNAVAILABLE' as DataHealth,
    dataStatus: 'UNAVAILABLE',
    confidence: 'LOW',
    dataFetchedAt: null,
    historyDepthDays: 0,
    healthNote: 'Channel could not be reached — will retry on next refresh',
    dataStatusNote: 'Channel could not be reached — will retry on next scheduled refresh',
    missingReasons: [{ field: 'all', reason: 'fetch_failed', detail: 'Channel could not be reached — will retry on next scheduled refresh' }],
  };
}

function assessHealth(snap: LiveSnap, cachedAt: string | null): DataHealth {
  if (snap.subs == null && snap.views == null) return 'UNAVAILABLE';
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

  // Delta confidence depends on how close the actual window is to the
  // requested window. A "7-day" delta spanning only 2 days is less reliable.
  const windowRatio = daysCovered / requestedDays;
  let confidence: DataConfidence = 'HIGH';
  if (windowRatio < 0.5) confidence = 'LOW';
  else if (windowRatio < 0.8) confidence = 'MEDIUM';

  // Determine if this delta is meaningful:
  // - Non-zero deltas are always meaningful if they cover at least 1 day.
  // - Zero deltas ARE meaningful if we have good coverage (>= 40% of requested window)
  //   because zero change is a real signal. Zero deltas with very thin coverage
  //   (< 3 days for a 7d window) are likely stale/duplicate cron data.
  let meaningful: boolean;
  if (raw.delta !== 0) {
    meaningful = daysCovered >= 1;
  } else {
    // Zero delta: meaningful only with decent coverage
    const minCoverage = Math.max(3, requestedDays * 0.4);
    meaningful = daysCovered >= minCoverage;
  }

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
  if (health === 'UNAVAILABLE') return 'Channel could not be reached — will retry on next refresh';

  const parts: string[] = [];

  // Health component
  if (health === 'FRESH') parts.push('Data is current');
  else if (health === 'STALE') parts.push('Showing last known values');
  else if (health === 'PARTIAL') parts.push('Some metrics still filling in');
  else if (health === 'LIMITED') parts.push('Sparse activity');

  // Confidence component
  if (confidence === 'LOW') {
    parts.push(snapshotCount <= 1
      ? 'trend history building'
      : 'comparison data still accumulating');
  } else if (confidence === 'MEDIUM') {
    parts.push('trend history building — comparisons are directional');
  }
  // HIGH confidence: no note needed

  return parts.join(' · ');
}

// ── Data Status derivation ──────────────────────────────────────────────
// Maps the old health + confidence assessment into the new 5-tier DataStatus.
// This is the single place where DataStatus is determined.

function deriveDataStatus(
  health: DataHealth,
  confidence: DataConfidence,
  snap: LiveSnap | CachedSnap,
): DataStatus {
  // No data at all or fetch error → UNAVAILABLE
  if (health === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (snap.error) return 'UNAVAILABLE';

  // Cache is stale (beyond freshMaxHours) → STALE
  if (health === 'STALE') return 'STALE';

  // Data present but insufficient snapshot history for deltas → LIMITED
  if (confidence === 'LOW') return 'LIMITED';

  // Data present but some fields missing or confidence not yet HIGH → PARTIAL
  if (health === 'PARTIAL' || confidence === 'MEDIUM') return 'PARTIAL';

  // Everything looks good → FRESH
  return 'FRESH';
}

// ── Data Status note ────────────────────────────────────────────────────
// Short user-facing explanation for the current data status.
// Shown as a tooltip or subtitle in UI cards/rows.

function buildDataStatusNote(
  status: DataStatus,
  snapshotCount: number,
  snap?: LiveSnap | CachedSnap | null,
): string {
  // Use cadence context to write operational notes instead of API-speak
  const lastUploadDays = snap ? daysSince(snap.lastUploadAt) : null;
  const isInactive = lastUploadDays != null && lastUploadDays > 90;
  const isDormant = lastUploadDays != null && lastUploadDays > 180;

  switch (status) {
    case 'FRESH':
      return 'Data is current and trends are reliable';
    case 'PARTIAL':
      return snapshotCount < 7
        ? `Building trend history (${snapshotCount} snapshots so far)`
        : 'Some comparison metrics still filling in';
    case 'LIMITED':
      if (isDormant) return 'Channel dormant — weekly movement metrics unavailable during inactivity';
      if (isInactive) return 'Inactive channel — insufficient recent activity for reliable weekly comparisons';
      return snapshotCount <= 1
        ? 'Waiting for enough daily snapshots to establish trend baselines'
        : `Trend history building (${snapshotCount} snapshots) — comparisons improve over the next few days`;
    case 'STALE':
      return 'Last refresh was longer ago than expected — showing most recent known values';
    case 'UNAVAILABLE':
      return 'Channel could not be reached — will retry on next scheduled refresh';
  }
}

// ── Missing reasons builder ─────────────────────────────────────────────
// Scans each key metric field and explains why it's null / shows "—".
// Consumers use this array to render per-field tooltips in the UI.

function buildMissingReasons(
  snap: LiveSnap | CachedSnap,
  subs7d: DeltaResult | null,
  views7d: DeltaResult | null,
  history: ChannelSnapshot[],
  confidence: DataConfidence,
): MissingReasonEntry[] {
  const reasons: MissingReasonEntry[] = [];
  const depth = computeHistoryDepth(history);
  const lastUploadDays = daysSince(snap.lastUploadAt);
  const isInactive = lastUploadDays != null && lastUploadDays > 90;

  // ── Subscriber count ──
  if (snap.subs == null) {
    reasons.push({
      field: 'subs',
      reason: snap.error ? 'fetch_failed' : 'hidden_subscriber_count',
      detail: snap.error
        ? 'Channel could not be reached — will retry on next refresh'
        : 'Subscriber count is hidden by the channel owner',
    });
  }

  // ── View count ──
  if (snap.views == null) {
    reasons.push({
      field: 'views',
      reason: snap.error ? 'fetch_failed' : 'api_field_unavailable',
      detail: snap.error
        ? 'Channel could not be reached — will retry on next refresh'
        : 'View count not available for this channel',
    });
  }

  // ── 7-day subscriber delta ──
  if (!subs7d) {
    if (snap.subs == null) {
      reasons.push({
        field: 'subs7d',
        reason: 'hidden_subscriber_count',
        detail: 'Subscriber count is hidden — weekly growth cannot be calculated',
      });
    } else if (depth < 2) {
      reasons.push({
        field: 'subs7d',
        reason: 'insufficient_snapshot_history',
        detail: 'Trend history is building — weekly comparison will appear within a few days',
      });
    } else {
      reasons.push({
        field: 'subs7d',
        reason: 'comparison_period_missing',
        detail: isInactive
          ? 'No recent upload activity to drive measurable subscriber movement'
          : 'Not enough stored history yet for a full 7-day comparison',
      });
    }
  } else if (!subs7d.meaningful) {
    reasons.push({
      field: 'subs7d',
      reason: 'insufficient_snapshot_history',
      detail: isInactive
        ? 'Channel inactive — subscriber movement is naturally flat'
        : `Only ${subs7d.daysCovered} day${subs7d.daysCovered === 1 ? '' : 's'} of comparison data — need more for a reliable trend`,
    });
  }

  // ── 7-day views delta ──
  if (!views7d) {
    if (snap.views == null) {
      reasons.push({
        field: 'views7d',
        reason: 'api_field_unavailable',
        detail: 'View count not available — weekly view growth cannot be calculated',
      });
    } else if (depth < 2) {
      reasons.push({
        field: 'views7d',
        reason: 'insufficient_snapshot_history',
        detail: 'Trend history is building — weekly view comparison will appear within a few days',
      });
    } else {
      reasons.push({
        field: 'views7d',
        reason: 'comparison_period_missing',
        detail: isInactive
          ? 'No recent upload activity to drive measurable view movement'
          : 'Not enough stored history yet for a full 7-day comparison',
      });
    }
  } else if (!views7d.meaningful) {
    reasons.push({
      field: 'views7d',
      reason: 'insufficient_snapshot_history',
      detail: isInactive
        ? 'Channel inactive — view movement is naturally minimal during dormant periods'
        : `Only ${views7d.daysCovered} day${views7d.daysCovered === 1 ? '' : 's'} of comparison data — need more for a reliable trend`,
    });
  }

  // ── Last upload ──
  if (snap.lastUploadAt == null && snap.uploads30d === 0) {
    reasons.push({
      field: 'lastUploadAt',
      reason: 'no_recent_uploads',
      detail: 'No uploads found in the last 30 days',
    });
  }

  // ── Upload cadence ──
  if ((snap.uploads30d ?? 0) === 0 && !snap.error) {
    if (lastUploadDays != null && lastUploadDays > THRESHOLDS.coldLastUploadDays) {
      reasons.push({
        field: 'cadence',
        reason: 'channel_inactive',
        detail: `Last upload was ${lastUploadDays} days ago — channel is dormant`,
      });
    }
  }

  return reasons;
}
