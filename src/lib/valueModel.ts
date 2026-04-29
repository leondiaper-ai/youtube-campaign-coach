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
  label: string;           // One-line text for the card
  missedValueRange: ValueRange; // Estimated missed £ range
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

  // ── CONVERSION GAP ────────────────────────────────────────────────────
  // Strong views but subs flat or weak conversion
  if (
    views7d != null && views7d > 5000 &&
    (subs7d == null || subs7d <= 0) &&
    (subsPerKViews == null || subsPerKViews < 1)
  ) {
    // Estimate: if conversion improved to healthy (1.5 subs/1K views),
    // how many subs could they gain?
    const potentialSubs = Math.round((views7d / 1000) * 1.5);
    const missed = subsToValue(potentialSubs);
    return {
      gap: 'CONVERSION_GAP',
      label: `~£${fmtVal(missed.low)}–£${fmtVal(missed.high)} missed long-term value (conversion gap)`,
      missedValueRange: missed,
    };
  }

  // ── VELOCITY GAP ──────────────────────────────────────────────────────
  // Active channel but underfed — views exist but cadence is low
  if (
    views7d != null && views7d > 0 &&
    uploads30d <= 2 &&
    channelState !== 'COLD'
  ) {
    // Estimate: doubling cadence could yield ~30-50% more views
    const additionalViews = Math.round(views7d * 0.4);
    const missed = viewsToRevenue(additionalViews);
    if (missed.high >= 50) {
      return {
        gap: 'VELOCITY_GAP',
        label: `~£${fmtVal(missed.low)}–£${fmtVal(missed.high)}/week opportunity (velocity gap)`,
        missedValueRange: missed,
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
      return {
        gap: 'UPLIFT_POTENTIAL',
        label: `Optimised rollout could add ~£${fmtVal(uplift.low)}–£${fmtVal(uplift.high)}/week (+10–30%)`,
        missedValueRange: uplift,
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
};

/**
 * Compute value opportunity for a single artist.
 * Only applies to managed artists — returns null for others.
 * This is the canonical entry point; UI components should call this
 * rather than detectOpportunity directly.
 */
export function getArtistValueOpportunity(input: ArtistValueInput): ValueOpportunity | null {
  if (input.artistType && input.artistType !== 'managed') return null;
  const v = input.views7d ?? 0;
  const s = input.subs7d ?? 0;
  const subsPerKViews = v > 0 ? (s / v) * 1000 : null;
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
  missedValueLow: number;
  missedValueHigh: number;
};

export type SystemValueSummary = {
  totalArtists: number;
  totalViews7d: number;
  totalSubs7d: number;
  totalEstimatedValueLow: number;
  totalEstimatedValueHigh: number;
  totalMissedValueLow: number;
  totalMissedValueHigh: number;
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

    return {
      classification: cls,
      artistCount: group.length,
      totalViews7d,
      totalSubs7d,
      estimatedValueLow: estLow,
      estimatedValueHigh: estHigh,
      missedValueLow: missedLow,
      missedValueHigh: missedHigh,
    };
  });

  return {
    totalArtists: artists.length,
    totalViews7d: breakdowns.reduce((s, b) => s + b.totalViews7d, 0),
    totalSubs7d: breakdowns.reduce((s, b) => s + b.totalSubs7d, 0),
    totalEstimatedValueLow: breakdowns.reduce((s, b) => s + b.estimatedValueLow, 0),
    totalEstimatedValueHigh: breakdowns.reduce((s, b) => s + b.estimatedValueHigh, 0),
    totalMissedValueLow: breakdowns.reduce((s, b) => s + b.missedValueLow, 0),
    totalMissedValueHigh: breakdowns.reduce((s, b) => s + b.missedValueHigh, 0),
    byClassification: breakdowns.filter((b) => b.artistCount > 0),
  };
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtVal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export { fmtVal };
