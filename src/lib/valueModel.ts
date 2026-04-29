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

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtVal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export { fmtVal };
