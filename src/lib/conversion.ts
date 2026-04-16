import type { ChannelSnapshot } from './snapshots';

/**
 * View → Subscriber conversion rate.
 *
 * YouTube's channel API exposes cumulative `views` and `subs` counters.
 * The delta between two snapshots over a window tells us how many NEW
 * subscribers the channel earned per new view in that window.
 *
 *   rate = (Δsubs / Δviews) * 1000  → "subs per 1,000 new views"
 *
 * Precision guards:
 *   • Need ≥ 2 snapshots with a real span in days (not same-day double-writes).
 *   • Need Δviews > 0 — otherwise the ratio is meaningless.
 *   • If Δsubs is negative (some channels lose subs), we still surface it —
 *     it is genuine signal ("purge") and should not be hidden.
 *
 * Bands (music / entertainment benchmarks, subs per 1k new views):
 *   STRONG   ≥ 10   (~1.0%)
 *   HEALTHY  5–10   (~0.5%–1.0%)
 *   SOFT     2–5    (~0.2%–0.5%)
 *   WEAK     <  2   (<0.2%)
 *   PURGE    ratePer1k < 0  (more unsubs than subs despite view growth)
 *   INSUFFICIENT — not enough history or no view growth
 */

export type ConversionBand =
  | 'STRONG'
  | 'HEALTHY'
  | 'SOFT'
  | 'WEAK'
  | 'PURGE'
  | 'INSUFFICIENT';

export type ConversionResult = {
  windowDays: number;
  spanDays: number;      // actual span between baseline and latest snapshot
  subsDelta: number;
  viewsDelta: number;
  ratePer1k: number;     // subs per 1,000 new views (can be negative for PURGE)
  ratePct: number;       // Δsubs / Δviews * 100
  band: ConversionBand;
  insufficientReason?: 'no-history' | 'no-span' | 'no-view-growth';
};

export const CONVERSION_BAND_META: Record<
  ConversionBand,
  { label: string; bg: string; fg: string; dot: string }
> = {
  STRONG:       { label: 'Strong',     bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  HEALTHY:      { label: 'Healthy',    bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  SOFT:         { label: 'Soft',       bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  WEAK:         { label: 'Weak',       bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  PURGE:        { label: 'Purge',      bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  INSUFFICIENT: { label: 'Building',   bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
};

function bandFor(ratePer1k: number): ConversionBand {
  if (ratePer1k < 0) return 'PURGE';
  if (ratePer1k < 2) return 'WEAK';
  if (ratePer1k < 5) return 'SOFT';
  if (ratePer1k < 10) return 'HEALTHY';
  return 'STRONG';
}

/**
 * Compute conversion over a fixed window in days.
 * Returns INSUFFICIENT with a reason rather than null so callers can render
 * a precise "needs more data" state instead of blanking.
 */
export function computeConversion(
  history: ChannelSnapshot[],
  windowDays: number
): ConversionResult {
  const empty: ConversionResult = {
    windowDays,
    spanDays: 0,
    subsDelta: 0,
    viewsDelta: 0,
    ratePer1k: 0,
    ratePct: 0,
    band: 'INSUFFICIENT',
    insufficientReason: 'no-history',
  };

  if (history.length < 2) return empty;

  const sorted = [...history].sort((a, b) => a.ts.localeCompare(b.ts));
  const last = sorted[sorted.length - 1];
  const cutoff = Date.now() - windowDays * 86400000;

  // Pick the oldest snapshot that is still inside the window — or the oldest
  // snapshot we have if everything is younger than the window.
  const baseline =
    [...sorted].reverse().find((h) => new Date(h.ts).getTime() <= cutoff) ??
    sorted[0];

  const spanDays = Math.max(
    0,
    Math.round(
      (new Date(last.ts).getTime() - new Date(baseline.ts).getTime()) /
        86400000
    )
  );

  if (spanDays < 1) {
    return { ...empty, insufficientReason: 'no-span' };
  }

  const subsDelta = last.subs - baseline.subs;
  const viewsDelta = last.views - baseline.views;

  if (viewsDelta <= 0) {
    return {
      windowDays,
      spanDays,
      subsDelta,
      viewsDelta,
      ratePer1k: 0,
      ratePct: 0,
      band: 'INSUFFICIENT',
      insufficientReason: 'no-view-growth',
    };
  }

  const ratePer1k = (subsDelta / viewsDelta) * 1000;
  const ratePct = (subsDelta / viewsDelta) * 100;

  return {
    windowDays,
    spanDays,
    subsDelta,
    viewsDelta,
    ratePer1k,
    ratePct,
    band: bandFor(ratePer1k),
  };
}

/**
 * Human-readable rate. Prefers "subs per 1k views" (integer-ish) for most
 * ranges — that's what creators actually think in — and falls back to
 * percentages when the rate is very high.
 */
export function formatRate(r: ConversionResult): string {
  if (r.band === 'INSUFFICIENT') return '—';
  if (Math.abs(r.ratePer1k) >= 100) {
    // Unusually high (e.g. a shout-out video), show as %
    return `${r.ratePct.toFixed(1)}%`;
  }
  return `${r.ratePer1k.toFixed(1)} / 1k`;
}

/**
 * Short explainer shown under the numeric rate.
 */
export function explainRate(r: ConversionResult): string {
  if (r.band === 'INSUFFICIENT') {
    switch (r.insufficientReason) {
      case 'no-history':
        return 'Needs at least 2 days of Watcher snapshots.';
      case 'no-span':
        return 'Only one snapshot in the window so far.';
      case 'no-view-growth':
        return `No new views in the last ${r.windowDays}d — nothing to convert.`;
      default:
        return 'Not enough data yet.';
    }
  }
  const subsTxt =
    r.subsDelta >= 0
      ? `${r.subsDelta.toLocaleString()} new subs`
      : `${r.subsDelta.toLocaleString()} subs (net loss)`;
  return `${subsTxt} per ${r.viewsDelta.toLocaleString()} new views over ${r.spanDays}d.`;
}

/**
 * Trend label comparing 7d vs 30d rate.
 * Returns 'improving' when the recent window is >= 10% higher than the long,
 * 'cooling' when it's >= 10% lower, otherwise 'steady'.
 */
export function rateTrend(
  short: ConversionResult,
  long: ConversionResult
): 'improving' | 'cooling' | 'steady' | 'unknown' {
  if (short.band === 'INSUFFICIENT' || long.band === 'INSUFFICIENT') return 'unknown';
  if (long.ratePer1k === 0) return 'unknown';
  const ratio = short.ratePer1k / long.ratePer1k;
  if (ratio >= 1.1) return 'improving';
  if (ratio <= 0.9) return 'cooling';
  return 'steady';
}
