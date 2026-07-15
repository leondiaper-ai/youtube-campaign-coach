// ─────────────────────────────────────────────────────────────────────────────
// VALUE MODEL (DIRECTIONAL)
//
// Simple, directional estimates to highlight performance and missed opportunity
// across YouTube campaigns. These are NOT precise revenue forecasts.
//
// Views → Revenue:   £1–£3 per 1,000 views (blended YouTube RPM)
// Subs → LTV:        £1–£5 per subscriber (long-term audience value)
// Optimisation:      +10–30% uplift from improved cadence & content
//
// IMPORTANT: Figures represent total channel value, not label revenue.
// Virgin Music does not capture 100% of monetisation across artist channels.
// ─────────────────────────────────────────────────────────────────────────────

// ── Revenue proxy ──────────────────────────────────────────────────────────

export type ValueRange = {
  low: number;
  high: number;
};

/** Confidence level for value estimates */
export type ValueConfidence = 'low' | 'medium' | 'high';

/** Extended value estimate with midpoint and confidence */
export type ValueEstimate = ValueRange & {
  midpoint: number;
  confidence: ValueConfidence;
  confidenceLabel: string;
};

/** Compute midpoint from a range */
export function midpoint(range: ValueRange): number {
  return Math.round((range.low + range.high) / 2);
}

/** Format a midpoint as the primary display: "~£180K" */
export function fmtMidpoint(range: ValueRange): string {
  return `~£${fmtVal(midpoint(range))}`;
}

/** Format range as secondary display: "Range: £90K–£450K" */
export function fmtRange(range: ValueRange): string {
  return `£${fmtVal(range.low)}–£${fmtVal(range.high)}`;
}

/** Directional disclaimer text for tooltips */
export const VALUE_DISCLAIMER =
  'This is a directional estimate based on YouTube RPM and performance gaps. Used to highlight opportunity, not exact revenue.';

/**
 * Determine confidence level based on data quality.
 *   HIGH   → strong signal + repeatable behaviour (healthy channel, stable views, subs converting)
 *   MEDIUM → consistent data + stable view patterns (active channel, some variability)
 *   LOW    → RPM-based estimate only (sparse data, cold/unstable channel)
 */
export function computeConfidence(input: {
  views7d: number | null;
  subs7d: number | null;
  uploads30d: number;
  channelState: string;
}): ValueConfidence {
  const { views7d, subs7d, uploads30d, channelState } = input;
  if (channelState === 'COLD' || channelState === 'AT RISK') return 'low';
  if (uploads30d < 3 || views7d == null || views7d < 1000) return 'low';
  if (
    channelState === 'HEALTHY' &&
    uploads30d >= 5 &&
    views7d != null && views7d > 10000 &&
    subs7d != null && subs7d > 0
  ) return 'high';
  return 'medium';
}

export const CONFIDENCE_LABEL: Record<ValueConfidence, string> = {
  low: 'directional estimate',
  medium: 'moderate confidence',
  high: 'strong signal',
};

/** Estimated weekly revenue proxy from 7-day views. */
export function viewsToRevenue(views7d: number): ValueRange {
  return {
    low: Math.round((views7d / 1000) * 1),
    high: Math.round((views7d / 1000) * 3),
  };
}

/** Estimated long-term value from 7-day subscriber gains. */
export function subsToValue(subs7d: number): ValueRange {
  return {
    low: Math.round(subs7d * 1),
    high: Math.round(subs7d * 5),
  };
}

/** Estimated uplift from optimised rollout (+10–30%). */
export function upliftRange(baseRange: ValueRange): ValueRange {
  return {
    low: Math.round(baseRange.low * 0.10),
    high: Math.round(baseRange.high * 0.30),
  };
}

// ── Opportunity gap detection ──────────────────────────────────────────────

export type OpportunityGap =
  | 'CONVERSION_GAP'   // Strong views but subs flat → missed LTV
  | 'VELOCITY_GAP'     // Low cadence starving a growing channel
  | 'UPLIFT_POTENTIAL'  // Healthy channel could grow more with optimisation
  | null;               // No clear gap

export type ValueOpportunity = {
  gap: OpportunityGap;
  label: string;           // One-line text for the card (midpoint-first)
  labelRange: string;      // Secondary range text
  missedValueRange: ValueRange; // Estimated missed £ range
  missedMidpoint: number;  // Primary display value
  confidence: ValueConfidence;
  confidenceLabel: string;
};

/**
 * Detect the most relevant value opportunity for a campaign card.
 * Returns null when there's no clear gap worth highlighting.
 */
export function detectOpportunity(input: {
  views7d: number | null;
  subs7d: number | null;
  subsPerKViews: number | null;
  uploads30d: number;
  channelState: string;
}): ValueOpportunity | null {
  const { views7d, subs7d, subsPerKViews, uploads30d, channelState } = input;

  // Skip cold/inactive channels — no meaningful opportunity to size
  if (channelState === 'COLD') return null;

  const conf = computeConfidence({ views7d, subs7d, uploads30d, channelState });
  const confLabel = CONFIDENCE_LABEL[conf];

  // ── CONVERSION GAP ────────────────────────────────────────────────────
  // Strong views but subs flat or weak conversion
  if (
    views7d != null && views7d > 5000 &&
    (subs7d == null || subs7d <= 0) &&
    (subsPerKViews == null || subsPerKViews < 1)
  ) {
    const potentialSubs = Math.round((views7d / 1000) * 1.5);
    const missed = subsToValue(potentialSubs);
    const mid = midpoint(missed);
    return {
      gap: 'CONVERSION_GAP',
      label: `~£${fmtVal(mid)} missed long-term value (conversion gap)`,
      labelRange: `Range: ${fmtRange(missed)}`,
      missedValueRange: missed,
      missedMidpoint: mid,
      confidence: conf,
      confidenceLabel: confLabel,
    };
  }

  // ── VELOCITY GAP ──────────────────────────────────────────────────────
  // Active channel but underfed — views exist but cadence is low
  if (
    views7d != null && views7d > 0 &&
    uploads30d <= 2 &&
    channelState !== 'COLD'
  ) {
    const additionalViews = Math.round(views7d * 0.4);
    const missed = viewsToRevenue(additionalViews);
    if (missed.high >= 50) {
      const mid = midpoint(missed);
      return {
        gap: 'VELOCITY_GAP',
        label: `~£${fmtVal(mid)}/week opportunity (velocity gap)`,
        labelRange: `Range: ${fmtRange(missed)}`,
        missedValueRange: missed,
        missedMidpoint: mid,
        confidence: conf,
        confidenceLabel: confLabel,
      };
    }
  }

  // ── UPLIFT POTENTIAL ──────────────────────────────────────────────────
  // Healthy channel that could grow with optimisation
  if (
    views7d != null && views7d > 10000 &&
    subs7d != null && subs7d > 0 &&
    uploads30d >= 3
  ) {
    const currentRevenue = viewsToRevenue(views7d);
    const uplift = upliftRange(currentRevenue);
    if (uplift.high >= 50) {
      const mid = midpoint(uplift);
      return {
        gap: 'UPLIFT_POTENTIAL',
        label: `Optimisation could add ~£${fmtVal(mid)}/week (+10–30%)`,
        labelRange: `Range: ${fmtRange(uplift)}`,
        missedValueRange: uplift,
        missedMidpoint: mid,
        confidence: conf,
        confidenceLabel: confLabel,
      };
    }
  }

  return null;
}

// ── Board-level aggregation ────────────────────────────────────────────────

/**
 * Compute total estimated missed value across all campaigns this week.
 * Used for the WeeklySummary one-liner.
 */
export function aggregateMissedValue(
  opportunities: (ValueOpportunity | null)[],
): ValueRange | null {
  const valid = opportunities.filter((o): o is ValueOpportunity => o !== null);
  if (valid.length === 0) return null;
  return {
    low: valid.reduce((sum, o) => sum + o.missedValueRange.low, 0),
    high: valid.reduce((sum, o) => sum + o.missedValueRange.high, 0),
  };
}

// ── Per-artist value opportunity (shared bridge) ─────────────────────────

export type ArtistValueInput = {
  views7d: number | null;
  subs7d: number | null;
  uploads30d: number;
  channelState: string;
  artistType?: string;
  /** Revenue ownership — only 'virgin' gets value calculations */
  ownership?: string;
};

/**
 * Compute value opportunity for a single artist.
 * Only applies to virgin-owned managed artists — returns null for others.
 * This is the canonical entry point; UI components should call this
 * rather than detectOpportunity directly.
 */
export function getArtistValueOpportunity(input: ArtistValueInput): ValueOpportunity | null {
  // Gate: only virgin-owned artists get value calculations
  if (input.ownership !== 'virgin') return null;
  if (input.artistType && input.artistType !== 'managed') return null;
  // ZERO-SAFETY: pass null through — detectOpportunity handles null correctly.
  // Coercing null to 0 would hide missing data and suppress opportunity detection.
  const v = input.views7d;
  const s = input.subs7d;
  const subsPerKViews = (v != null && v > 0 && s != null) ? (s / v) * 1000 : null;
  return detectOpportunity({
    views7d: v,
    subs7d: s,
    subsPerKViews,
    uploads30d: input.uploads30d,
    channelState: input.channelState,
  });
}

// ── System-level value aggregation (all managed artists) ─────────────────

import type { ArtistClassification } from './artists';

export type ClassificationValueBreakdown = {
  classification: ArtistClassification;
  artistCount: number;
  totalViews7d: number;
  totalSubs7d: number;
  estimatedValueLow: number;
  estimatedValueHigh: number;
  estimatedValueMidpoint: number;
  missedValueLow: number;
  missedValueHigh: number;
  missedValueMidpoint: number;
  confidence: ValueConfidence;
};

export type SystemValueSummary = {
  totalArtists: number;
  totalViews7d: number;
  totalSubs7d: number;
  totalEstimatedValueLow: number;
  totalEstimatedValueHigh: number;
  totalEstimatedValueMidpoint: number;
  totalMissedValueLow: number;
  totalMissedValueHigh: number;
  totalMissedValueMidpoint: number;
  overallConfidence: ValueConfidence;
  byClassification: ClassificationValueBreakdown[];
};

export type ArtistValueData = {
  views7d: number;
  subs7d: number;
  uploads30d: number;
  channelState: string;
  classification: ArtistClassification;
};

/**
 * Compute system-wide value summary across all managed artists.
 * Groups totals by classification for reporting and rollups.
 */
export function computeSystemValue(artists: ArtistValueData[]): SystemValueSummary {
  const groups: Record<ArtistClassification, ArtistValueData[]> = {
    GROWING: [],
    WEAK_CONVERSION: [],
    UNDERFED: [],
    COLD: [],
  };

  for (const a of artists) {
    groups[a.classification].push(a);
  }

  const breakdowns: ClassificationValueBreakdown[] = (
    ['GROWING', 'WEAK_CONVERSION', 'UNDERFED', 'COLD'] as ArtistClassification[]
  ).map((cls) => {
    const group = groups[cls];
    let totalViews7d = 0;
    let totalSubs7d = 0;
    let estLow = 0;
    let estHigh = 0;
    let missedLow = 0;
    let missedHigh = 0;

    for (const a of group) {
      totalViews7d += a.views7d;
      totalSubs7d += a.subs7d;

      const rev = viewsToRevenue(a.views7d);
      const sub = subsToValue(Math.max(0, a.subs7d));
      estLow += rev.low + sub.low;
      estHigh += rev.high + sub.high;

      const subsPerK = a.views7d > 0 ? (a.subs7d / a.views7d) * 1000 : null;
      const opp = detectOpportunity({
        views7d: a.views7d,
        subs7d: a.subs7d,
        subsPerKViews: subsPerK,
        uploads30d: a.uploads30d,
        channelState: a.channelState,
      });
      if (opp) {
        missedLow += opp.missedValueRange.low;
        missedHigh += opp.missedValueRange.high;
      }
    }

    // Derive group-level confidence from the worst individual confidence
    let worstConf: ValueConfidence = 'high';
    for (const a of group) {
      const c = computeConfidence({
        views7d: a.views7d,
        subs7d: a.subs7d,
        uploads30d: a.uploads30d,
        channelState: a.channelState,
      });
      if (c === 'low') { worstConf = 'low'; break; }
      if (c === 'medium') worstConf = 'medium';
    }

    return {
      classification: cls,
      artistCount: group.length,
      totalViews7d,
      totalSubs7d,
      estimatedValueLow: estLow,
      estimatedValueHigh: estHigh,
      estimatedValueMidpoint: midpoint({ low: estLow, high: estHigh }),
      missedValueLow: missedLow,
      missedValueHigh: missedHigh,
      missedValueMidpoint: midpoint({ low: missedLow, high: missedHigh }),
      confidence: worstConf,
    };
  });

  const totalEstLow = breakdowns.reduce((s, b) => s + b.estimatedValueLow, 0);
  const totalEstHigh = breakdowns.reduce((s, b) => s + b.estimatedValueHigh, 0);
  const totalMissedLow = breakdowns.reduce((s, b) => s + b.missedValueLow, 0);
  const totalMissedHigh = breakdowns.reduce((s, b) => s + b.missedValueHigh, 0);

  // Overall confidence: worst across all groups that have artists
  const activeBreakdowns = breakdowns.filter((b) => b.artistCount > 0);
  let overallConfidence: ValueConfidence = 'high';
  for (const b of activeBreakdowns) {
    if (b.confidence === 'low') { overallConfidence = 'low'; break; }
    if (b.confidence === 'medium') overallConfidence = 'medium';
  }

  return {
    totalArtists: artists.length,
    totalViews7d: breakdowns.reduce((s, b) => s + b.totalViews7d, 0),
    totalSubs7d: breakdowns.reduce((s, b) => s + b.totalSubs7d, 0),
    totalEstimatedValueLow: totalEstLow,
    totalEstimatedValueHigh: totalEstHigh,
    totalEstimatedValueMidpoint: midpoint({ low: totalEstLow, high: totalEstHigh }),
    totalMissedValueLow: totalMissedLow,
    totalMissedValueHigh: totalMissedHigh,
    totalMissedValueMidpoint: midpoint({ low: totalMissedLow, high: totalMissedHigh }),
    overallConfidence,
    byClassification: activeBreakdowns,
  };
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtVal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export { fmtVal };
