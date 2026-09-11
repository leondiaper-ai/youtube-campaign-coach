/**
 * DEEP DIVE FRESHNESS
 *
 * A Deep Dive is a dated analysis, not a live feed. The CHVRCHES deck says
 * "340 days dormant" and was right on 26 August; the channel uploaded on
 * 9 September. Both statements are true about their own moment, and the
 * system's job is to hold them next to each other rather than pick one.
 *
 * ── THE WORDING MATTERS ───────────────────────────────────────────────
 * The wrong framing is "the Deep Dive is wrong". It is not wrong — it is
 * the record of what we saw and what we recommended at the point of
 * analysis, and that record is the thing the whole progress layer is
 * measured against. Rewriting it would destroy the baseline. So the verdict
 * is CHANGED, and the message says the campaign has since moved.
 *
 * ── WHY THIS IS NARROW ON PURPOSE ─────────────────────────────────────
 * Only TIME-SENSITIVE claims are checked, and only against figures Watcher
 * actually holds: dormancy, subscribers, lifetime views, upload counts. The
 * deck's structural claims — "0 of 4 heroes had a 7-14 day asset", "lyric
 * videos have a 2.04M median" — are about a campaign that has already
 * happened and cannot go out of date. Checking them would produce noise,
 * and noise in a freshness warning trains people to ignore it.
 *
 * A claim we cannot check returns UNKNOWN. That is not a failure, it is the
 * honest answer, and it is very different from CURRENT.
 */

import type { DeepDiveContext, DeepDiveEvidence } from './types';

export type FreshnessVerdict = 'CURRENT' | 'CHANGED' | 'STALE' | 'UNKNOWN';

export interface FreshnessCheck {
  claim: string;
  verdict: FreshnessVerdict;
  /** What the deck said, and when. */
  asAt: string | null;
  /** What Watcher shows now, in the same units. Null when uncheckable. */
  now: string | null;
  /** Plain English, written to be quoted into a page or a warning. */
  message: string;
}

export interface FreshnessReport {
  artistSlug: string;
  deepDiveVersion: string;
  dataCapturedAt: string | null;
  ageDays: number | null;
  /** The loudest verdict across all checks. */
  overall: FreshnessVerdict;
  checks: FreshnessCheck[];
  /** One-line summaries of CHANGED/STALE checks, for a warnings array. */
  warnings: string[];
  /** Always present. Stops a caller treating CHANGED as "discard the deck". */
  guidance: string;
}

/** Anything older than this is STALE even when nothing has visibly moved. */
const STALE_AFTER_DAYS = 120;

export interface WatcherNow {
  lastUploadAt?: string | null;
  subs?: number | null;
  views?: number | null;
  uploads30d?: number | null;
  /** When the snapshot was taken. */
  checkedAt?: string | null;
}

function daysBetween(a: string, b: string): number | null {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return Math.round((t2 - t1) / 86_400_000);
}

/* Patterns that make a claim time-sensitive, with the figure to re-check. */
const DORMANCY = /(\d[\d,]*)\s+days?\s+since the last upload|(\d[\d,]*)\s+days?\s+(?:silent|without an upload|dormant)/i;
const SUBS = /([\d,]+)\s+subscribers?/i;
const VIEWS = /([\d,]+)\s+lifetime views/i;

const num = (s: string) => Number(s.replace(/,/g, ''));
const fmt = (n: number) => n.toLocaleString('en-GB');

/**
 * One claim against one snapshot.
 *
 * Only OBSERVED and DERIVED claims are candidates. A HUMAN claim — the
 * analyst's reading — is a view about a moment and does not become false
 * because a number moved.
 */
export function checkClaim(
  e: DeepDiveEvidence, now: WatcherNow, nowIso: string,
): FreshnessCheck | null {
  if (e.evidenceClass !== 'OBSERVED' && e.evidenceClass !== 'DERIVED') return null;

  const asAt = e.observedAt ?? null;

  /* ── Dormancy: the one that matters most, and the one that broke ── */
  const dormant = DORMANCY.exec(e.claim);
  if (dormant) {
    const claimed = num(dormant[1] ?? dormant[2] ?? '0');
    if (!now.lastUploadAt) {
      return {
        claim: e.claim, verdict: 'UNKNOWN', asAt, now: null,
        message: 'No current last-upload date in Watcher, so the dormancy claim cannot be re-checked.',
      };
    }
    const sinceNow = daysBetween(now.lastUploadAt, nowIso);
    if (sinceNow == null) {
      return { claim: e.claim, verdict: 'UNKNOWN', asAt, now: null, message: 'Last-upload date is unparseable.' };
    }
    /* Dormancy grows by one per day. If it has grown roughly as expected,
       nothing has happened; if it has RESET, the channel published. */
    const expected = asAt ? (daysBetween(asAt, nowIso) ?? 0) + claimed : null;
    const reset = expected != null && sinceNow < expected - 2;
    return {
      claim: e.claim,
      verdict: reset ? 'CHANGED' : 'CURRENT',
      asAt,
      now: `last upload ${now.lastUploadAt.slice(0, 10)}, ${sinceNow} day(s) ago`,
      message: reset
        ? `The deck recorded ${claimed} days dormant as at ${asAt}. Watcher now shows the last upload `
          + `${sinceNow} day(s) ago — the channel has published since the analysis. This was true at the `
          + 'point of analysis; the campaign has since moved.'
        : `Still dormant: ${sinceNow} days since the last upload, consistent with the deck's ${claimed} as at ${asAt}.`,
    };
  }

  /* ── Subscribers and lifetime views: drift, not contradiction ──────
     These always move. Only a LARGE move is worth a reader's attention,
     because a page that warns about every +1,000 subscribers is a page
     nobody reads the warnings on. */
  const subs = SUBS.exec(e.claim);
  if (subs && now.subs != null) {
    const claimed = num(subs[1]);
    const pct = claimed ? Math.abs(now.subs - claimed) / claimed : 0;
    return {
      claim: e.claim,
      verdict: pct >= 0.05 ? 'CHANGED' : 'CURRENT',
      asAt,
      now: `${fmt(now.subs)} subscribers`,
      message: pct >= 0.05
        ? `Subscribers have moved from ${fmt(claimed)} (as at ${asAt}) to ${fmt(now.subs)}.`
        : `Subscribers ${fmt(now.subs)}, close to the ${fmt(claimed)} recorded as at ${asAt}.`,
    };
  }

  const views = VIEWS.exec(e.claim);
  if (views && now.views != null) {
    const claimed = num(views[1]);
    const delta = now.views - claimed;
    const pct = claimed ? Math.abs(delta) / claimed : 0;
    return {
      claim: e.claim,
      verdict: pct >= 0.05 ? 'CHANGED' : 'CURRENT',
      asAt,
      now: `${fmt(now.views)} lifetime views`,
      message: pct >= 0.05
        ? `Lifetime views have moved from ${fmt(claimed)} (as at ${asAt}) to ${fmt(now.views)}, `
          + `a change of ${delta >= 0 ? '+' : ''}${fmt(delta)}.`
        : `Lifetime views ${fmt(now.views)}, ${delta >= 0 ? '+' : ''}${fmt(delta)} on the figure recorded as at ${asAt}. `
          + 'This is a cumulative total and is not a rate.',
    };
  }

  /* Not time-sensitive, or not checkable against what Watcher holds. */
  return null;
}

export function buildFreshnessReport(
  dive: DeepDiveContext, now: WatcherNow, nowIso = new Date().toISOString(),
): FreshnessReport {
  const checks = dive.keyEvidence
    .map(e => checkClaim(e, now, nowIso))
    .filter((c): c is FreshnessCheck => c !== null);

  const ageDays = dive.dataCapturedAt ? daysBetween(dive.dataCapturedAt, nowIso) : null;

  /* Age alone can make a deck stale even when every figure still matches —
     nothing having moved for four months is itself worth knowing. */
  if (ageDays != null && ageDays > STALE_AFTER_DAYS) {
    checks.push({
      claim: `Deep Dive figures captured ${dive.dataCapturedAt}`,
      verdict: 'STALE',
      asAt: dive.dataCapturedAt,
      now: nowIso.slice(0, 10),
      message: `The analysis is ${ageDays} days old. Its figures should be re-pulled before being quoted.`,
    });
  }

  if (!checks.length) {
    checks.push({
      claim: 'No time-sensitive evidence could be re-checked',
      verdict: 'UNKNOWN', asAt: dive.dataCapturedAt, now: null,
      message: 'Either the deck records no re-checkable figures, or Watcher holds no current snapshot. '
        + 'This is not a statement that the deck is current.',
    });
  }

  const rank: Record<FreshnessVerdict, number> = { STALE: 3, CHANGED: 2, UNKNOWN: 1, CURRENT: 0 };
  const overall = checks.reduce<FreshnessVerdict>(
    (worst, c) => (rank[c.verdict] > rank[worst] ? c.verdict : worst), 'CURRENT');

  return {
    artistSlug: dive.artistSlug,
    deepDiveVersion: `${dive.deckUpdated}/${dive.transcribedAt}`,
    dataCapturedAt: dive.dataCapturedAt,
    ageDays,
    overall,
    checks,
    warnings: checks.filter(c => c.verdict === 'CHANGED' || c.verdict === 'STALE').map(c => c.message),
    guidance:
      'CHANGED does not mean the Deep Dive is wrong. It means the analysis was true at its capture date and '
      + 'the campaign has moved since. The Deep Dive remains the fixed strategic baseline; progress is '
      + 'measured AGAINST it, not merged INTO it. Do not remove a strategic need because implementation '
      + 'has started — a need stays open until evidence shows it was met.',
  };
}
