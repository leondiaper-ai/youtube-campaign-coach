/**
 * Snapshot Scheduler — smart priority-based YouTube API snapshot scheduling.
 *
 * Assigns each artist a snapshot priority (HIGH / MEDIUM / LOW) based on
 * channel state, campaign activity, and upload recency. The cron job uses
 * this to determine which artists to fetch on each run, optimising quota
 * spend toward the channels where fresh data matters most.
 *
 * YouTube Data API quota: 10,000 units/day (resets at midnight Pacific / 7am UTC).
 * fetchChannelSnapLite costs ~6 units per artist.
 *
 * Schedule:
 *   HIGH   — 2x daily (8am + 8pm UTC crons)     → active campaigns, recent uploads
 *   MEDIUM — 1x daily (8am UTC cron only)        → healthy/building/weak conversion
 *   LOW    — 2–3x weekly (Mon/Wed/Fri 8am only)  → cold/inactive/dormant
 */

import type { Artist, ChannelState } from './artists';
import { daysSince } from './artists';
import type { CachedSnap } from './kvCache';

// ── Types ────────────────────────────────────────────────────────────────

export type SnapshotPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type SnapshotSchedule = {
  /** How often this artist should be fetched */
  priority: SnapshotPriority;
  /** Human-readable reason for this priority */
  reason: string;
  /** Expected fetches per week */
  fetchesPerWeek: number;
  /** Estimated quota cost per fetch (~6 units for lite mode) */
  quotaCostPerFetch: number;
  /** Estimated weekly quota cost */
  weeklyQuotaCost: number;
  /** Whether this artist should be fetched in the current run */
  shouldFetchNow: boolean;
};

export type QuotaBudget = {
  /** YouTube Data API daily quota limit */
  dailyLimit: number;
  /** Estimated cost for a single full cron run (all eligible artists) */
  perRunCost: number;
  /** Estimated daily cost across all scheduled runs */
  dailyCost: number;
  /** Estimated weekly cost */
  weeklyCost: number;
  /** Percentage of daily quota used */
  dailyUsagePct: number;
  /** Whether the budget is safe (< 60% of daily quota) */
  isSafe: boolean;
  /** Whether there's comfortable headroom (< 40% of daily quota) */
  hasHeadroom: boolean;
  /** Breakdown by priority tier */
  breakdown: {
    high: { count: number; fetchesPerWeek: number; weeklyQuota: number };
    medium: { count: number; fetchesPerWeek: number; weeklyQuota: number };
    low: { count: number; fetchesPerWeek: number; weeklyQuota: number };
  };
};

// ── Constants ────────────────────────────────────────────────────────────

const QUOTA_COST_PER_FETCH = 6;
const DAILY_QUOTA_LIMIT = 10_000;

// Fetch frequencies (per week)
const HIGH_FETCHES_PER_WEEK = 14;   // 2x daily
const MEDIUM_FETCHES_PER_WEEK = 7;  // 1x daily
const LOW_FETCHES_PER_WEEK = 3;     // Mon/Wed/Fri

// ── Priority Classification ──────────────────────────────────────────────

/**
 * Determine snapshot priority for an artist based on their state.
 *
 * HIGH: Active campaign OR uploaded in last 14 days
 *   → These channels have the most to gain from fresh data.
 *   → Campaign monitoring needs timely WoW calculations.
 *   → Recent uploads mean views are actively changing.
 *
 * MEDIUM: Healthy/Building/Weak Conversion with some activity
 *   → Still active channels worth daily monitoring.
 *   → Views and subs may be moving, just not urgently.
 *
 * LOW: Cold/Inactive/No uploads in 90+ days
 *   → Minimal view movement expected.
 *   → Stale YouTube data is likely here anyway.
 *   → 2-3x weekly is sufficient to detect reactivation.
 */
export function classifySnapshotPriority(
  artist: Artist,
  snap: CachedSnap | null,
  channelState?: ChannelState,
): SnapshotSchedule {
  const lastUploadDays = snap ? daysSince(snap.lastUploadAt) : null;
  const hasActiveCampaign = !!artist.campaign || !!artist.campaignStartDate;

  // ── HIGH: Active campaign or recent uploads ────────────────────────
  if (hasActiveCampaign) {
    return schedule('HIGH', 'Active campaign — needs timely monitoring');
  }
  if (lastUploadDays != null && lastUploadDays <= 14) {
    return schedule('HIGH', `Uploaded ${lastUploadDays}d ago — views actively changing`);
  }

  // ── LOW: Cold / inactive / dormant ─────────────────────────────────
  if (channelState === 'COLD') {
    return schedule('LOW', 'Channel cold — minimal expected movement');
  }
  if (lastUploadDays != null && lastUploadDays > 90) {
    return schedule('LOW', `No uploads in ${lastUploadDays}d — dormant channel`);
  }
  // No snap data at all — might be new, check less frequently
  if (!snap || snap.error) {
    return schedule('LOW', 'No cached data — check periodically');
  }

  // ── MEDIUM: Everything else (active but not urgent) ────────────────
  const reason = channelState
    ? `${channelState} — standard daily monitoring`
    : 'Active channel — standard daily monitoring';
  return schedule('MEDIUM', reason);
}

function schedule(priority: SnapshotPriority, reason: string): SnapshotSchedule {
  const fetchesPerWeek = priority === 'HIGH' ? HIGH_FETCHES_PER_WEEK
    : priority === 'MEDIUM' ? MEDIUM_FETCHES_PER_WEEK
    : LOW_FETCHES_PER_WEEK;

  return {
    priority,
    reason,
    fetchesPerWeek,
    quotaCostPerFetch: QUOTA_COST_PER_FETCH,
    weeklyQuotaCost: fetchesPerWeek * QUOTA_COST_PER_FETCH,
    shouldFetchNow: true, // will be set by shouldFetchInRun()
  };
}

// ── Run eligibility ──────────────────────────────────────────────────────

/**
 * Determine whether a given artist should be fetched in the current cron run.
 *
 * @param priority - The artist's snapshot priority
 * @param runSlot  - Which cron slot is running: 'morning' (8am) or 'evening' (8pm)
 * @param dayOfWeek - 0=Sun, 1=Mon ... 6=Sat (from new Date().getUTCDay())
 */
export function shouldFetchInRun(
  priority: SnapshotPriority,
  runSlot: 'morning' | 'evening',
  dayOfWeek: number,
): boolean {
  switch (priority) {
    case 'HIGH':
      // 2x daily — fetch in every run
      return true;

    case 'MEDIUM':
      // 1x daily — morning run only
      return runSlot === 'morning';

    case 'LOW':
      // Mon/Wed/Fri morning only
      if (runSlot !== 'morning') return false;
      return true;
  }
}

// ── Quota Budget Calculator ──────────────────────────────────────────────

/**
 * Calculate the total quota budget for a set of artist schedules.
 * Used to verify that a proposed schedule is safe before deploying.
 */
export function calculateQuotaBudget(
  schedules: SnapshotSchedule[],
): QuotaBudget {
  const high = schedules.filter(s => s.priority === 'HIGH');
  const medium = schedules.filter(s => s.priority === 'MEDIUM');
  const low = schedules.filter(s => s.priority === 'LOW');

  const weeklyQuota =
    high.reduce((s, a) => s + a.weeklyQuotaCost, 0) +
    medium.reduce((s, a) => s + a.weeklyQuotaCost, 0) +
    low.reduce((s, a) => s + a.weeklyQuotaCost, 0);

  const dailyCost = Math.round(weeklyQuota / 7);

  // Worst-case morning run: all HIGH + all MEDIUM + LOW on Mon/Wed/Fri
  const morningRunCost = (high.length + medium.length + low.length) * QUOTA_COST_PER_FETCH;
  // Typical morning run (non-MWF): HIGH + MEDIUM only
  const typicalMorningCost = (high.length + medium.length) * QUOTA_COST_PER_FETCH;
  // Evening run: HIGH only
  const eveningRunCost = high.length * QUOTA_COST_PER_FETCH;

  // Per-run cost is the worst case (MWF morning + evening)
  const worstDailyCost = morningRunCost + eveningRunCost;
  const typicalDailyCost = typicalMorningCost + eveningRunCost;

  return {
    dailyLimit: DAILY_QUOTA_LIMIT,
    perRunCost: morningRunCost,
    dailyCost: Math.round((worstDailyCost * 3 + typicalDailyCost * 4) / 7), // weighted avg
    weeklyCost: weeklyQuota,
    dailyUsagePct: Math.round((dailyCost / DAILY_QUOTA_LIMIT) * 100),
    isSafe: dailyCost < DAILY_QUOTA_LIMIT * 0.6,
    hasHeadroom: dailyCost < DAILY_QUOTA_LIMIT * 0.4,
    breakdown: {
      high: {
        count: high.length,
        fetchesPerWeek: HIGH_FETCHES_PER_WEEK,
        weeklyQuota: high.length * HIGH_FETCHES_PER_WEEK * QUOTA_COST_PER_FETCH,
      },
      medium: {
        count: medium.length,
        fetchesPerWeek: MEDIUM_FETCHES_PER_WEEK,
        weeklyQuota: medium.length * MEDIUM_FETCHES_PER_WEEK * QUOTA_COST_PER_FETCH,
      },
      low: {
        count: low.length,
        fetchesPerWeek: LOW_FETCHES_PER_WEEK,
        weeklyQuota: low.length * LOW_FETCHES_PER_WEEK * QUOTA_COST_PER_FETCH,
      },
    },
  };
}

// ── Quota guardrail for cron runs ────────────────────────────────────────

/**
 * Apply quota guardrails to a list of artists scheduled for a run.
 * If the estimated cost exceeds the budget threshold, drops LOW-priority
 * artists first, then MEDIUM, logging each skip.
 *
 * @param artists   - Artists with their schedules, pre-filtered by shouldFetchInRun
 * @param maxQuota  - Maximum quota units to spend in this run (default: 40% of daily)
 * @returns         - Which artists to fetch and which were skipped
 */
export function applyQuotaGuardrails(
  artists: { slug: string; schedule: SnapshotSchedule }[],
  maxQuota: number = DAILY_QUOTA_LIMIT * 0.4,
): {
  toFetch: string[];
  skipped: { slug: string; reason: string }[];
  estimatedCost: number;
} {
  // Sort by priority: HIGH first, then MEDIUM, then LOW
  const priorityOrder: Record<SnapshotPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...artists].sort(
    (a, b) => priorityOrder[a.schedule.priority] - priorityOrder[b.schedule.priority]
  );

  const toFetch: string[] = [];
  const skipped: { slug: string; reason: string }[] = [];
  let runningCost = 0;

  for (const a of sorted) {
    const cost = a.schedule.quotaCostPerFetch;
    if (runningCost + cost > maxQuota) {
      skipped.push({
        slug: a.slug,
        reason: `Skipped ${a.schedule.priority} — quota budget exhausted (${runningCost}/${maxQuota} units)`,
      });
    } else {
      toFetch.push(a.slug);
      runningCost += cost;
    }
  }

  return { toFetch, skipped, estimatedCost: runningCost };
}
