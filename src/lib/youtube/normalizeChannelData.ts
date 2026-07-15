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
import { deltaOver, campaignDelta, seriesForField, detectViewFreshness, detectSubsFreshness } from '../snapshots';
import type { ViewFreshness } from '../snapshots';
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
  | 'stale_api_data'
  | 'not_applicable';

export type MissingReasonEntry = {
  field: string;
  reason: MissingReason;
  detail: string;
};

// ── Movement Confidence ──────────────────────────────────────────────────
// How much to trust 7d movement (views/subs delta) data.
// Drives UI tone: stale → "Updating" / "—", not "+0" and negative diagnosis.
//
//  high     – fresh totals, enough history, meaningful deltas
//  medium   – some data gaps but deltas are directionally useful
//  limited  – insufficient history or partial data; deltas may be unreliable
//  stale    – YouTube returning unchanged totals; movement is unknown, not zero

export type MovementConfidence = 'high' | 'medium' | 'limited' | 'stale';

// ── Movement Freshness ──────────────────────────────────────────────────
// 4-level freshness tier for UI display. More granular than MovementConfidence.
//
//  live     – fresh API data + fresh snapshots → show current metrics
//  recent   – valid movement within last few days → show with "as of" label
//  delayed  – no recent refresh but prior movement retained → show with freshness note
//  stale    – old/unreliable movement → show last-known-good if available
//
// The tool should never feel empty/broken just because public totals stall.

export type MovementFreshness = 'live' | 'recent' | 'delayed' | 'stale';

// ── Last Known Good Movement ────────────────────────────────────────────
// When current movement confidence is stale/limited, we preserve the last
// confirmed directional movement so the UI can show retained context
// instead of collapsing into "—" or "+0".
//
// IMPORTANT: This is retained historical context only. Never fake new movement.

export type LastKnownGoodMovement = {
  /** Last confirmed 7d views delta (raw number) */
  views7d: number | null;
  /** Last confirmed 7d subscriber delta (raw number) */
  subs7d: number | null;
  /** Last confirmed WoW percentage */
  viewsWoW: number | null;
  /** ISO date when this movement was last confirmed fresh */
  confirmedAt: string | null;
  /** Days since the movement was confirmed */
  daysAgo: number | null;
};

// ── Structural Finding ──────────────────────────────────────────────────
// Semi-persistent operational insights that should not flicker on/off
// based on API variance. Retained for a configurable window (default 7d).
// Only removed when contradicted by fresh evidence.

export type FindingStatus = 'active' | 'pending_refresh' | 'resolved';

export type StructuralFinding = {
  /** Unique finding ID (e.g. "missing-lyric:videoId") */
  id: string;
  /** Category of the finding */
  category: 'format_gap' | 'missing_support' | 'cadence_issue' | 'conversion_issue';
  /** Human-readable summary */
  summary: string;
  /** When this finding was first detected (ISO) */
  detectedAt: string;
  /** When this finding was last confirmed still present (ISO) */
  lastConfirmedAt: string;
  /** How many days to retain without re-confirmation before expiring */
  retentionDays: number;
  /** Whether this finding is still considered active (backward compat) */
  active: boolean;
  /** 3-state status: active (confirmed), pending_refresh (retained within window), resolved (contradicted) */
  status: FindingStatus;
  /** What evidence source detected this finding (e.g. "catalogue_scan", "upload_analysis") */
  evidenceSource: string;
  /** Confidence in this finding */
  findingConfidence: 'high' | 'medium' | 'low';
};

// ── Best Available Movement ─────────────────────────────────────────────
// Replaces the simple "show last-known-good or nothing" fallback with a
// ranked signal selection system. The Watcher actively picks the most
// useful trustworthy signal depending on channel state.
//
// Priority order:
//   1. live_7d         — current 7d delta, high/medium confidence
//   2. recent_snapshot — valid 7d window from history within 7 days
//   3. campaign_period — campaign-period delta (active campaigns only)
//   4. recent_uploads  — upload activity within 14 days (directional only)
//   5. last_confirmed  — retained historical delta (display-only after 14d)
//   6. none            — no movement signal available

export type BestAvailableSource =
  | 'live_7d'
  | 'recent_snapshot'
  | 'campaign_period'
  | 'recent_uploads'
  | 'last_confirmed'
  | 'none';

export type BestAvailableMovement = {
  viewsValue: number | null;
  subsValue: number | null;
  source: BestAvailableSource;
  freshness: MovementFreshness | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  /** Primary label for the metric tile (e.g. "Views (7d)", "Campaign period") */
  label: string;
  /** Sublabel shown under the value (e.g. "3d ago", "since 22 Mar") */
  sublabel: string;
  /** Human-readable explanation for tooltips/reports */
  explanation: string;
  /** Whether this data is reliable enough to use in scoring */
  shouldUseInScore: boolean;
  /** Whether this data should appear in Top Movers rankings */
  shouldUseInTopMovers: boolean;
  /** Whether this data should appear in report headline */
  shouldUseInReport: boolean;
  /** Days since the source data was confirmed (null if live) */
  ageDays: number | null;
};

// Age limits for each source tier
const BEST_AVAILABLE_AGE_LIMITS = {
  /** recent_snapshot: valid up to 7 days */
  recentSnapshotMaxDays: 7,
  /** recent_uploads: valid up to 14 days */
  recentUploadsMaxDays: 14,
  /** last_confirmed: show as headline up to 14 days, tooltip-only after */
  lastConfirmedHeadlineMaxDays: 14,
} as const;

export function deriveBestAvailableMovement(
  nc: NormalizedChannel,
  campaignCtx?: CampaignContext | null,
): BestAvailableMovement {
  const none: BestAvailableMovement = {
    viewsValue: null, subsValue: null,
    source: 'none', freshness: 'unknown', confidence: 'low',
    label: 'Movement', sublabel: 'Awaiting data',
    explanation: 'Building snapshot history — movement data will appear as daily tracking accumulates.',
    shouldUseInScore: false, shouldUseInTopMovers: false, shouldUseInReport: false,
    ageDays: null,
  };

  // ── 1. LIVE / CURRENT 7D ─────────────────────────────────────────────
  // Use when movement confidence is high or medium and deltas are meaningful.
  if (
    (nc.movementConfidence === 'high' || nc.movementConfidence === 'medium') &&
    nc.views7d && nc.views7d.meaningful
  ) {
    return {
      viewsValue: nc.views7d.delta,
      subsValue: nc.subs7d?.meaningful ? nc.subs7d.delta : null,
      source: 'live_7d',
      freshness: nc.movementFreshness,
      confidence: nc.movementConfidence === 'high' ? 'high' : 'medium',
      label: 'Views (7d)',
      sublabel: nc.views7d.pct != null ? `${nc.views7d.delta >= 0 ? '+' : ''}${(nc.views7d.pct * 100).toFixed(1)}%` : '',
      explanation: `Channel movement is live: ${nc.views7d.delta >= 0 ? '+' : ''}${nc.views7d.delta.toLocaleString()} views over 7 days.`,
      shouldUseInScore: true,
      shouldUseInTopMovers: true,
      shouldUseInReport: true,
      ageDays: 0,
    };
  }

  // ── 2. RECENT VALID SNAPSHOT WINDOW ───────────────────────────────────
  // Current data is stale but LKG exists within the recent-snapshot age limit.
  const lkg = nc.lastKnownGood;
  if (
    lkg.daysAgo != null &&
    lkg.daysAgo <= BEST_AVAILABLE_AGE_LIMITS.recentSnapshotMaxDays &&
    (lkg.views7d != null || lkg.subs7d != null)
  ) {
    const dateLabel = lkg.confirmedAt
      ? new Date(lkg.confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : `${lkg.daysAgo}d ago`;
    return {
      viewsValue: lkg.views7d,
      subsValue: lkg.subs7d,
      source: 'recent_snapshot',
      freshness: 'recent',
      confidence: 'medium',
      label: 'Views (recent)',
      sublabel: `as of ${dateLabel}`,
      explanation: `Recent movement from ${dateLabel}. Totals updating.`,
      shouldUseInScore: true,
      shouldUseInTopMovers: true,
      shouldUseInReport: true,
      ageDays: lkg.daysAgo,
    };
  }

  // ── 3. CAMPAIGN-PERIOD MOVEMENT ──────────────────────────────────────
  // Active campaign with campaign-period deltas available.
  if (
    campaignCtx?.isActive &&
    nc.campaign &&
    nc.campaign.viewsDelta &&
    nc.campaign.viewsDelta.meaningful
  ) {
    const campDay = nc.campaign.campaignDay;
    const startLabel = new Date(campaignCtx.campaignStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return {
      viewsValue: nc.campaign.viewsDelta.delta,
      subsValue: nc.campaign.subsDelta?.meaningful ? nc.campaign.subsDelta.delta : null,
      source: 'campaign_period',
      freshness: 'delayed',
      confidence: nc.campaign.viewsDelta.confidence === 'HIGH' ? 'high' : 'medium',
      label: 'Campaign period',
      sublabel: `since ${startLabel} · day ${campDay}`,
      explanation: `Campaign active: ${nc.campaign.viewsDelta.delta >= 0 ? '+' : ''}${nc.campaign.viewsDelta.delta.toLocaleString()} views since launch. Weekly totals updating.`,
      shouldUseInScore: false, // campaign totals are cumulative, not weekly
      shouldUseInTopMovers: false,
      shouldUseInReport: true,
      ageDays: null,
    };
  }

  // ── 4. RECENT UPLOAD ACTIVITY ────────────────────────────────────────
  // Channel totals stale but recent uploads show visible activity.
  if (
    nc.cadence.lastUploadDaysAgo != null &&
    nc.cadence.lastUploadDaysAgo <= BEST_AVAILABLE_AGE_LIMITS.recentUploadsMaxDays &&
    nc.cadence.uploads30d > 0
  ) {
    const uploadCount = nc.cadence.uploads30d;
    const shortsCount = nc.cadence.shorts30d;
    return {
      viewsValue: null, // no numeric views claim
      subsValue: null,
      source: 'recent_uploads',
      freshness: 'delayed',
      confidence: 'low',
      label: 'Content activity',
      sublabel: `${uploadCount} upload${uploadCount !== 1 ? 's' : ''} / 30d`,
      explanation: `Uploads active (${uploadCount} in 30 days${shortsCount > 0 ? `, ${shortsCount} Shorts` : ''}). Channel totals updating.`,
      shouldUseInScore: false,
      shouldUseInTopMovers: false,
      shouldUseInReport: true,
      ageDays: nc.cadence.lastUploadDaysAgo,
    };
  }

  // ── 5. LAST CONFIRMED (with age limits) ──────────────────────────────
  // Historical delta exists but is older than the recent-snapshot window.
  if (lkg.views7d != null || lkg.subs7d != null) {
    const age = lkg.daysAgo ?? 999;
    const isHeadlineWorthy = age <= BEST_AVAILABLE_AGE_LIMITS.lastConfirmedHeadlineMaxDays;
    const dateLabel = lkg.confirmedAt
      ? new Date(lkg.confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : `${age}d ago`;
    return {
      viewsValue: lkg.views7d,
      subsValue: lkg.subs7d,
      source: 'last_confirmed',
      freshness: 'stale',
      confidence: 'low',
      label: isHeadlineWorthy ? 'Views (last confirmed)' : 'Views (historical)',
      sublabel: `${age}d ago`,
      explanation: isHeadlineWorthy
        ? `Last confirmed movement from ${dateLabel}. Totals updating.`
        : `Historical movement from ${dateLabel}. Shown for context — fresher data expected soon.`,
      shouldUseInScore: false,
      shouldUseInTopMovers: isHeadlineWorthy, // only rank if recent enough
      shouldUseInReport: true,
      ageDays: age,
    };
  }

  // ── 6. NONE ──────────────────────────────────────────────────────────
  return none;
}

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

  // ── Per-metric data freshness ──
  /** Whether YouTube's view data appears fresh or stale (unchanged totals) */
  viewDataFreshness: ViewFreshness;
  /** Whether YouTube's subscriber data appears fresh or stale */
  subscriberDataFreshness: ViewFreshness;

  // ── Movement confidence ──
  /** How much to trust 7d movement data. Drives UI tone (cautious vs assertive). */
  movementConfidence: MovementConfidence;

  // ── Stale enrichment ──
  /** Why movement data is limited/stale */
  staleReason: string | null;
  /** ISO timestamp of when data first became stale (null if fresh) */
  staleSince: string | null;
  /** Confidence level in the current stale classification */
  staleConfidence: 'confirmed' | 'suspected' | null;

  // ── Movement freshness (4-tier) ──
  /** Granular freshness tier for UI display decisions */
  movementFreshness: MovementFreshness;

  // ── Last known good movement ──
  /** Retained directional movement from the most recent period with reliable data */
  lastKnownGood: LastKnownGoodMovement;

  // ── Structural findings (retained insights) ──
  /** Semi-persistent operational findings that survive API variance */
  structuralFindings: StructuralFinding[];

  // ── Best available movement (ranked signal selection) ──
  /** The most useful trustworthy movement signal available for this channel */
  bestAvailable: BestAvailableMovement;
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

  // ── Per-metric freshness detection ──
  const viewDataFreshness = detectViewFreshness(history, snap.subs ?? null);
  const subscriberDataFreshness = detectSubsFreshness(history, snap.views ?? null);

  // ── Deltas ──
  const subs7Raw = deltaOver(history, 7, 'subs');
  const views7Raw = deltaOver(history, 7, 'views');
  const subs30Raw = deltaOver(history, 30, 'subs');
  const views30Raw = deltaOver(history, 30, 'views');

  let subs7d = wrapDelta(subs7Raw, 7, history);
  let views7d = wrapDelta(views7Raw, 7, history);
  let subs30d = wrapDelta(subs30Raw, 30, history);
  let views30d = wrapDelta(views30Raw, 30, history);

  // STALE DATA SUPPRESSION:
  // When YouTube returns identical viewCount totals across snapshots,
  // the computed delta is 0 — but it's not a real zero, it's stale API data.
  // Mark these deltas as non-meaningful so downstream consumers (WoW,
  // insights, movers) automatically suppress them instead of showing
  // misleading "+0" or "-100% WoW".
  if (viewDataFreshness === 'stale') {
    if (views7d && views7d.delta === 0) views7d = { ...views7d, meaningful: false };
    if (views30d && views30d.delta === 0) views30d = { ...views30d, meaningful: false };
  }
  if (subscriberDataFreshness === 'stale') {
    if (subs7d && subs7d.delta === 0) subs7d = { ...subs7d, meaningful: false };
    if (subs30d && subs30d.delta === 0) subs30d = { ...subs30d, meaningful: false };
  }

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
  const missingReasons = buildMissingReasons(snap, subs7d, views7d, history, confidence, viewDataFreshness, subscriberDataFreshness);

  // ── Movement confidence ──
  const movementConfidence = deriveMovementConfidence(
    viewDataFreshness, subscriberDataFreshness, views7d, subs7d, confidence,
  );

  // ── Stale enrichment ──
  const staleEnrichment = deriveStaleEnrichment(
    viewDataFreshness, subscriberDataFreshness, history, movementConfidence,
  );

  // ── Movement freshness (4-tier) ──
  const movementFreshness = deriveMovementFreshness(
    movementConfidence, dataStatus, views7d, subs7d, cachedAt,
  );

  // ── Last known good movement ──
  const lastKnownGood = deriveLastKnownGoodMovement(
    history, views7d, subs7d, movementConfidence,
  );

  const result: NormalizedChannel = {
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
    viewDataFreshness,
    subscriberDataFreshness,
    movementConfidence,
    staleReason: staleEnrichment.staleReason,
    staleSince: staleEnrichment.staleSince,
    staleConfidence: staleEnrichment.staleConfidence,
    movementFreshness,
    lastKnownGood,
    structuralFindings: [], // populated by caller via deriveStructuralFindings()
    bestAvailable: null as unknown as BestAvailableMovement, // filled below
  };

  // Derive best available movement from the fully-assembled channel data
  result.bestAvailable = deriveBestAvailableMovement(result, campaignCtx);

  return result;
}

// ── Movement confidence derivation ───────────────────────────────────────
// Determines how trustworthy the 7d movement data is. If stale, the UI
// should become more cautious — not more negative.

function deriveMovementConfidence(
  viewFreshness: ViewFreshness,
  subsFreshness: ViewFreshness,
  views7d: DeltaResult | null,
  subs7d: DeltaResult | null,
  confidence: DataConfidence,
): MovementConfidence {
  // If either core metric has stale totals, movement is untrustworthy
  if (viewFreshness === 'stale' || subsFreshness === 'stale') return 'stale';

  // If either freshness is unavailable (null data), movement is unknown
  if (viewFreshness === 'unavailable' && subsFreshness === 'unavailable') return 'stale';

  // If we don't have enough history for reliable deltas
  if (viewFreshness === 'insufficient_history' || subsFreshness === 'insufficient_history') return 'limited';

  // If deltas exist but aren't meaningful (non-meaningful flag set)
  if (views7d && !views7d.meaningful) return 'stale';
  if (subs7d && !subs7d.meaningful) return 'limited';

  // If overall confidence is LOW, deltas exist but may be unreliable
  if (confidence === 'LOW') return 'limited';
  if (confidence === 'MEDIUM') return 'medium';

  return 'high';
}

// ── Stale enrichment derivation ─────────────────────────────────────

function deriveStaleEnrichment(
  viewFreshness: ViewFreshness,
  subsFreshness: ViewFreshness,
  history: ChannelSnapshot[],
  movementConfidence: MovementConfidence,
): { staleReason: string | null; staleSince: string | null; staleConfidence: 'confirmed' | 'suspected' | null } {
  if (movementConfidence !== 'stale') {
    return { staleReason: null, staleSince: null, staleConfidence: null };
  }

  // Determine reason
  let staleReason: string | null = null;
  if (viewFreshness === 'stale' && subsFreshness === 'stale') {
    staleReason = 'YouTube public view and subscriber totals unchanged across recent snapshots';
  } else if (viewFreshness === 'stale') {
    staleReason = 'YouTube public view totals unchanged across recent snapshots';
  } else if (subsFreshness === 'stale') {
    staleReason = 'YouTube public subscriber totals unchanged across recent snapshots';
  } else if (viewFreshness === 'unavailable' && subsFreshness === 'unavailable') {
    staleReason = 'Channel data could not be retrieved';
  } else {
    staleReason = 'Movement data not currently reliable';
  }

  // Find staleSince — earliest snapshot where totals stopped changing
  let staleSince: string | null = null;
  let staleConfidence: 'confirmed' | 'suspected' | null = null;

  if (history.length >= 2) {
    const sorted = [...history].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    let consecutiveIdentical = 0;
    for (let i = sorted.length - 1; i > 0; i--) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      const viewsSame = curr.views != null && prev.views != null && curr.views === prev.views;
      const subsSame = curr.subs != null && prev.subs != null && curr.subs === prev.subs;
      if (viewsSame || subsSame) {
        consecutiveIdentical++;
        staleSince = prev.ts;
      } else {
        break;
      }
    }
    staleConfidence = consecutiveIdentical >= 3 ? 'confirmed' : consecutiveIdentical >= 2 ? 'suspected' : null;
  }

  return { staleReason, staleSince, staleConfidence };
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

/**
 * @deprecated ZERO-SAFETY: This function silently converts missing data to zero.
 * Use rawDelta() instead, which returns null for missing data.
 * Only kept for backward compatibility — migrate callers to rawDelta().
 */
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

// ── Movement Freshness derivation ────────────────────────────────────────
// More granular than MovementConfidence. Determines what the UI should show.

function deriveMovementFreshness(
  movementConfidence: MovementConfidence,
  dataStatus: DataStatus,
  views7d: DeltaResult | null,
  subs7d: DeltaResult | null,
  cachedAt: string | null,
): MovementFreshness {
  // If movement is trustworthy and data is current → live
  if (movementConfidence === 'high' && dataStatus === 'FRESH') return 'live';

  // If movement is OK (high or medium) but data is slightly stale → recent
  if ((movementConfidence === 'high' || movementConfidence === 'medium') &&
      (dataStatus === 'FRESH' || dataStatus === 'PARTIAL')) return 'recent';

  // If we have SOME movement data but confidence is limited → recent (if data is fresh)
  // or delayed (if data is older)
  if (movementConfidence === 'medium' || movementConfidence === 'limited') {
    // Check how old the cached data is
    if (cachedAt) {
      const hoursOld = (Date.now() - new Date(cachedAt).getTime()) / 3600000;
      if (hoursOld <= THRESHOLDS.freshMaxHours) return 'recent';
      if (hoursOld <= THRESHOLDS.staleMaxHours) return 'delayed';
    }
    return 'delayed';
  }

  // Stale movement confidence → stale freshness
  return 'stale';
}

// ── Last Known Good Movement derivation ─────────────────────────────────
// Walks snapshot history backward to find the most recent period where
// a meaningful (non-zero, non-stale) delta existed.
//
// IMPORTANT: We never fabricate data. This retrieves real historical deltas.

function deriveLastKnownGoodMovement(
  history: ChannelSnapshot[],
  currentViews7d: DeltaResult | null,
  currentSubs7d: DeltaResult | null,
  movementConfidence: MovementConfidence,
): LastKnownGoodMovement {
  const empty: LastKnownGoodMovement = {
    views7d: null, subs7d: null, viewsWoW: null,
    confirmedAt: null, daysAgo: null,
  };

  // If current movement is already good, use current data as last-known-good
  if (movementConfidence === 'high' || movementConfidence === 'medium') {
    const v = currentViews7d && currentViews7d.meaningful ? currentViews7d.delta : null;
    const s = currentSubs7d && currentSubs7d.meaningful ? currentSubs7d.delta : null;
    if (v != null || s != null) {
      const latestTs = history.length > 0 ? history[history.length - 1].ts : new Date().toISOString().slice(0, 10);
      return {
        views7d: v,
        subs7d: s,
        confirmedAt: latestTs,
        daysAgo: 0,
        viewsWoW: null, // WoW requires extra computation; will be set by caller if available
      };
    }
  }

  // Movement is stale/limited. Walk backward through history to find the
  // most recent 7-day window where a real, non-zero delta existed.
  if (history.length < 3) return empty;

  const sorted = [...history].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // Walk backward from the end, looking for the latest pair where totals
  // were actually changing (i.e., not stale identical values)
  for (let i = sorted.length - 1; i >= 1; i--) {
    const curr = sorted[i];
    const currTs = new Date(curr.ts).getTime();

    // Find a snapshot ~7 days before this one
    const target7dAgo = currTs - 7 * 86400000;
    let baseline: ChannelSnapshot | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const jTs = new Date(sorted[j].ts).getTime();
      if (jTs <= target7dAgo && sorted[j].views != null) {
        baseline = sorted[j];
        break;
      }
    }

    if (!baseline) continue;
    if (baseline.ts === curr.ts) continue;

    const viewsDelta = (curr.views != null && baseline.views != null)
      ? curr.views - baseline.views : null;
    const subsDelta = (curr.subs != null && baseline.subs != null)
      ? curr.subs - baseline.subs : null;

    // Only accept if at least one metric shows real (non-zero) movement
    const hasRealMovement = (viewsDelta != null && viewsDelta !== 0) ||
                            (subsDelta != null && subsDelta !== 0);

    if (hasRealMovement) {
      const daysAgo = Math.floor((Date.now() - currTs) / 86400000);
      return {
        views7d: viewsDelta,
        subs7d: subsDelta,
        confirmedAt: curr.ts,
        daysAgo,
        viewsWoW: null, // WoW is complex to derive historically; omit for now
      };
    }
  }

  return empty;
}

// ── Structural findings from opportunities ──────────────────────────────
// Converts current opportunity detections into semi-persistent findings.
// Findings from previous runs are retained if not contradicted.

export function deriveStructuralFindings(
  currentOpps: Array<{ id: string; type: string; subtype: string; signal: string }>,
  existingFindings: StructuralFinding[],
  now: string = new Date().toISOString(),
): StructuralFinding[] {
  const results: StructuralFinding[] = [];
  const currentIds = new Set(currentOpps.map(o => o.id));

  // Map opportunity type to finding category
  const typeToCategory = (type: string): StructuralFinding['category'] => {
    if (type === 'Format gap') return 'format_gap';
    if (type === 'Missing support') return 'missing_support';
    if (type === 'Cold channel') return 'cadence_issue';
    return 'conversion_issue';
  };

  // Map opportunity subtype to evidence source
  const evidenceFor = (subtype: string): string => {
    if (subtype.includes('lyric') || subtype.includes('visual')) return 'catalogue_scan';
    if (subtype.includes('short') || subtype.includes('Short')) return 'upload_analysis';
    if (subtype.includes('gap') || subtype.includes('upload')) return 'cadence_check';
    return 'opportunity_detection';
  };

  // 1. Update or create findings from current opportunities
  for (const opp of currentOpps) {
    const existing = existingFindings.find(f => f.id === opp.id);
    if (existing) {
      // Re-confirmed — update lastConfirmedAt, promote to active
      results.push({
        ...existing,
        lastConfirmedAt: now,
        summary: opp.signal,
        active: true,
        status: 'active',
        findingConfidence: 'high', // re-confirmed = high confidence
      });
    } else {
      // New finding
      results.push({
        id: opp.id,
        category: typeToCategory(opp.type),
        summary: opp.signal,
        detectedAt: now,
        lastConfirmedAt: now,
        retentionDays: 7,
        active: true,
        status: 'active',
        evidenceSource: evidenceFor(opp.subtype),
        findingConfidence: 'medium', // new detection = medium until re-confirmed
      });
    }
  }

  // 2. Retain existing findings that aren't in current detections
  //    but haven't expired yet (within retention window)
  for (const existing of existingFindings) {
    if (currentIds.has(existing.id)) continue; // already handled above
    const ageMs = new Date(now).getTime() - new Date(existing.lastConfirmedAt).getTime();
    const ageDays = ageMs / 86400000;
    if (ageDays <= existing.retentionDays) {
      // Still within retention window — keep as pending_refresh
      results.push({
        ...existing,
        active: true,
        status: 'pending_refresh',
        findingConfidence: ageDays <= 3 ? 'medium' : 'low',
      });
    } else {
      // Expired — only mark resolved when contradicted, otherwise just inactive
      results.push({
        ...existing,
        active: false,
        status: 'resolved',
        findingConfidence: 'low',
      });
    }
  }

  return results;
}

// ── Reporting Movement Summary ──────────────────────────────────────────
// Reusable helper for report generation. Outputs human-readable movement
// context based on the Best Available Movement source.

export type ReportingMovementSummary = {
  headline: string;
  viewsLine: string;
  subsLine: string;
  confidenceNote: string;
  recommendedWording: string;
};

export function getReportingMovementSummary(
  nc: NormalizedChannel,
  artistName: string,
): ReportingMovementSummary {
  const ba = nc.bestAvailable;
  const fmtV = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString()}`;

  switch (ba.source) {
    case 'live_7d':
      return {
        headline: `${artistName} — live movement`,
        viewsLine: ba.viewsValue != null ? `${fmtV(ba.viewsValue)} views over 7 days` : 'Views updating',
        subsLine: ba.subsValue != null ? `${fmtV(ba.subsValue)} subscribers over 7 days` : 'Subscriber data updating',
        confidenceNote: `Live data, ${ba.confidence} confidence.`,
        recommendedWording: `${ba.viewsValue != null ? fmtV(ba.viewsValue) + ' views' : ''}${ba.subsValue != null ? ' and ' + fmtV(ba.subsValue) + ' subs' : ''} over 7d.`,
      };

    case 'recent_snapshot':
      return {
        headline: `${artistName} — recent movement (${ba.ageDays}d ago)`,
        viewsLine: ba.viewsValue != null ? `${fmtV(ba.viewsValue)} views (${ba.sublabel})` : 'Views updating',
        subsLine: ba.subsValue != null ? `${fmtV(ba.subsValue)} subscribers (${ba.sublabel})` : 'Subscriber data updating',
        confidenceNote: `Recent snapshot from ${ba.ageDays} days ago. Totals updating.`,
        recommendedWording: `Recent movement (${ba.ageDays}d ago): ${ba.viewsValue != null ? fmtV(ba.viewsValue) + ' views' : ''}. Totals updating.`,
      };

    case 'campaign_period':
      return {
        headline: `${artistName} — campaign active`,
        viewsLine: ba.viewsValue != null ? `${fmtV(ba.viewsValue)} views ${ba.sublabel}` : 'Campaign views tracking',
        subsLine: ba.subsValue != null ? `${fmtV(ba.subsValue)} subscribers ${ba.sublabel}` : 'Campaign subs tracking',
        confidenceNote: 'Campaign active. Weekly totals updating — using campaign-period context.',
        recommendedWording: `Campaign active, ${ba.viewsValue != null ? fmtV(ba.viewsValue) + ' views since launch' : 'tracking views'}. Weekly totals updating.`,
      };

    case 'recent_uploads':
      return {
        headline: `${artistName} — content active`,
        viewsLine: 'Totals updating',
        subsLine: 'Totals updating',
        confidenceNote: `${ba.sublabel}. Uploads active, totals updating.`,
        recommendedWording: `Totals updating. ${ba.explanation}`,
      };

    case 'last_confirmed': {
      const isOld = (ba.ageDays ?? 0) > BEST_AVAILABLE_AGE_LIMITS.lastConfirmedHeadlineMaxDays;
      return {
        headline: `${artistName} — ${isOld ? 'historical' : 'last confirmed'} movement (${ba.ageDays}d ago)`,
        viewsLine: ba.viewsValue != null ? `${fmtV(ba.viewsValue)} views (confirmed ${ba.ageDays}d ago)` : 'Views awaiting refresh',
        subsLine: ba.subsValue != null ? `${fmtV(ba.subsValue)} subscribers (confirmed ${ba.ageDays}d ago)` : 'Subs awaiting refresh',
        confidenceNote: isOld
          ? `Last confirmed movement is ${ba.ageDays} days old. Shown for context.`
          : `Last confirmed movement from ${ba.ageDays} days ago. Totals updating.`,
        recommendedWording: isOld
          ? `Last confirmed movement was ${ba.ageDays} days ago. Fresher data expected soon.`
          : `Last confirmed: ${ba.viewsValue != null ? fmtV(ba.viewsValue) + ' views' : ''} (${ba.ageDays}d ago). Totals updating.`,
      };
    }

    case 'none':
    default:
      return {
        headline: `${artistName} — building movement history`,
        viewsLine: 'Movement data building',
        subsLine: 'Movement data building',
        confidenceNote: 'Building snapshot history. Movement data will appear as tracking accumulates.',
        recommendedWording: 'Building snapshot history — movement data will appear soon.',
      };
  }
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
      cadenceLine: 'Awaiting data',
    },
    sparklineSubs30d: [],
    sparklineViews30d: [],
    campaign: campaignCtx ? { campaignDay: 0, viewsDelta: null, subsDelta: null } : null,
    health: 'UNAVAILABLE' as DataHealth,
    dataStatus: 'UNAVAILABLE',
    confidence: 'LOW',
    dataFetchedAt: null,
    historyDepthDays: 0,
    healthNote: 'Channel updating — will refresh on next sync',
    dataStatusNote: 'Channel updating — will refresh on next scheduled sync',
    missingReasons: [{ field: 'all', reason: 'fetch_failed', detail: 'Channel updating — will refresh on next scheduled sync' }],
    viewDataFreshness: 'unavailable',
    subscriberDataFreshness: 'unavailable',
    movementConfidence: 'stale',
    staleReason: 'Channel updating',
    staleSince: null,
    staleConfidence: null,
    movementFreshness: 'stale',
    lastKnownGood: { views7d: null, subs7d: null, viewsWoW: null, confirmedAt: null, daysAgo: null },
    structuralFindings: [],
    bestAvailable: {
      viewsValue: null, subsValue: null,
      source: 'none', freshness: 'unknown', confidence: 'low',
      label: 'Movement', sublabel: 'Awaiting data',
      explanation: 'Building snapshot history — movement data will appear as daily tracking accumulates.',
      shouldUseInScore: false, shouldUseInTopMovers: false, shouldUseInReport: false,
      ageDays: null,
    },
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
  viewFreshness?: ViewFreshness,
  subsFreshness?: ViewFreshness,
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
    if (subsFreshness === 'stale') {
      reasons.push({
        field: 'subs7d',
        reason: 'stale_api_data',
        detail: 'YouTube is returning the same subscriber total across snapshots — waiting for fresh data from the API',
      });
    } else {
      reasons.push({
        field: 'subs7d',
        reason: 'insufficient_snapshot_history',
        detail: isInactive
          ? 'Channel inactive — subscriber movement is naturally flat'
          : `Only ${subs7d.daysCovered} day${subs7d.daysCovered === 1 ? '' : 's'} of comparison data — need more for a reliable trend`,
      });
    }
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
    if (viewFreshness === 'stale') {
      reasons.push({
        field: 'views7d',
        reason: 'stale_api_data',
        detail: 'YouTube is returning the same view total across snapshots — waiting for fresh data from the API',
      });
    } else {
      reasons.push({
        field: 'views7d',
        reason: 'insufficient_snapshot_history',
        detail: isInactive
          ? 'Channel inactive — view movement is naturally minimal during dormant periods'
          : `Only ${views7d.daysCovered} day${views7d.daysCovered === 1 ? '' : 's'} of comparison data — need more for a reliable trend`,
      });
    }
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
