/**
 * Execution Matching Engine
 *
 * Compares planned ContentAction[] against actual RecentUpload[] from
 * cached YouTube data. Uses smart matching: title keywords + timing
 * proximity + duration classification (short vs long-form).
 *
 * This is the backbone of the "live campaign guide" — it tells you
 * what's been done, what's missing, and what's late.
 */

import type { ContentAction, PlanWeek, GeneratedPlan } from '../planEngine';
import type { RecentUpload } from '../artists';

// ── Types ─────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | 'completed'     // matched to an actual upload
  | 'live'          // upload exists and is recent (within 7 days)
  | 'planned'       // upcoming — not yet due
  | 'missing'       // past due, no match found
  | 'late'          // significantly past due (>3 days)
  | 'optional'      // low-priority action, no penalty for skipping
  | 'manually_added'; // user-added action outside original plan

export type MatchConfidence = 'high' | 'medium' | 'low';

export type MatchedAction = ContentAction & {
  status: ExecutionStatus;
  /** The upload that matched this action (if any) */
  matchedUpload?: RecentUpload;
  /** How confident we are in the match */
  matchConfidence?: MatchConfidence;
  /** Absolute date this action was planned for (ISO string) */
  plannedDate?: string;
  /** Days overdue (positive = late, negative = upcoming, 0 = today) */
  daysFromDue?: number;
};

export type MatchedWeek = Omit<PlanWeek, 'actions'> & {
  actions: MatchedAction[];
  /** Unmatched uploads that appeared during this week */
  extraUploads: RecentUpload[];
};

export type MatchResult = {
  weeks: MatchedWeek[];
  /** Summary stats */
  stats: {
    total: number;
    completed: number;
    live: number;
    planned: number;
    missing: number;
    late: number;
    completionRate: number;
    /** Extra uploads not in the plan */
    extraUploads: number;
  };
  /** Uploads that didn't match any planned action */
  unmatchedUploads: RecentUpload[];
};

// ── Constants ─────────────────────────────────────────────────────────────

/** Maximum days between planned date and upload date to consider a match */
const TIMING_WINDOW_DAYS = 10;

/** Shorts are <= 62 seconds (YouTube's actual cutoff is 60, allow slight margin) */
const SHORT_DURATION_MAX = 62;

// ── Keyword extraction ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'be', 'as',
  'do', 'has', 'have', 'will', 'would', 'could', 'should', 'may', 'can',
  'up', 'out', 'no', 'not', 'so', 'if', 'my', 'your', 'we', 'you',
  // Common plan-generated words that shouldn't drive matching
  'video', 'short', 'post', 'content', 'upload', 'release', 'premiere',
  'official', 'music', 'new', 'ft', 'feat', 'featuring',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// ── Format classification ─────────────────────────────────────────────────

function isShortFormat(action: ContentAction): boolean {
  return action.format === 'short';
}

function isShortUpload(upload: RecentUpload): boolean {
  return upload.durationSec <= SHORT_DURATION_MAX;
}

function formatCompatible(action: ContentAction, upload: RecentUpload): boolean {
  if (action.format === 'short') return isShortUpload(upload);
  if (action.format === 'video' || action.format === 'premiere') return !isShortUpload(upload);
  if (action.format === 'live') return upload.live === 'live' || upload.live === 'upcoming' || !isShortUpload(upload);
  // community / post — can't really match to an upload
  return false;
}

// ── Scoring ───────────────────────────────────────────────────────────────

type MatchScore = {
  score: number;
  confidence: MatchConfidence;
  titleOverlap: number;
  timingDays: number;
  formatMatch: boolean;
};

function scoreMatch(
  action: ContentAction,
  upload: RecentUpload,
  actionDate: Date | null,
): MatchScore | null {
  // Community posts and generic posts can't be matched to uploads
  if (action.format === 'community' || action.format === 'post') return null;

  const formatMatch = formatCompatible(action, upload);
  if (!formatMatch) return null;

  // Title keyword overlap
  const actionKw = extractKeywords(action.title);
  const uploadKw = extractKeywords(upload.title);
  if (actionKw.length === 0) return null;

  const overlap = actionKw.filter((kw) =>
    uploadKw.some((uk) => uk.includes(kw) || kw.includes(uk))
  ).length;

  const titleOverlap = overlap / actionKw.length;

  // Timing proximity
  let timingDays = Infinity;
  if (actionDate) {
    const uploadDate = new Date(upload.publishedAt);
    timingDays = Math.abs(
      (uploadDate.getTime() - actionDate.getTime()) / 86400000
    );
  }

  // Reject if timing is way off (unless title match is very strong)
  if (timingDays > TIMING_WINDOW_DAYS && titleOverlap < 0.6) return null;

  // Composite score: title overlap dominates, timing is secondary
  let score = 0;

  // Title overlap: 0-60 points
  score += titleOverlap * 60;

  // Timing bonus: 0-30 points (closer = better)
  if (actionDate && timingDays <= TIMING_WINDOW_DAYS) {
    score += (1 - timingDays / TIMING_WINDOW_DAYS) * 30;
  }

  // Format match bonus: 10 points
  if (formatMatch) score += 10;

  // Confidence thresholds
  let confidence: MatchConfidence = 'low';
  if (score >= 60 && titleOverlap >= 0.5) confidence = 'high';
  else if (score >= 35 && titleOverlap >= 0.3) confidence = 'medium';

  // Minimum viable match
  if (score < 20) return null;
  if (titleOverlap < 0.15) return null;

  return { score, confidence, titleOverlap, timingDays, formatMatch };
}

// ── Date resolution ───────────────────────────────────────────────────────

/**
 * Parse a week's dateRange (e.g. "May 5 – May 11") and action day offset
 * to determine the absolute planned date for an action.
 */
function resolveActionDate(week: PlanWeek, action: ContentAction): Date | null {
  const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
  if (!match) return null;

  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const month = monthMap[match[1]];
  if (month == null) return null;

  const day = parseInt(match[2], 10);
  const now = new Date();
  // Determine year — if the month is far in the past, it might be next year
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  // If the date is more than 6 months in the past, try next year
  if (candidate.getTime() < now.getTime() - 180 * 86400000) {
    year += 1;
  }

  const weekStart = new Date(year, month, day);
  // Action day is offset from start of week (or from the moment date)
  const actionDate = new Date(weekStart.getTime() + (action.day || 0) * 86400000);
  return actionDate;
}

// ── Main matching function ────────────────────────────────────────────────

export function matchPlanToUploads(
  plan: GeneratedPlan,
  uploads: RecentUpload[],
): MatchResult {
  const now = new Date();
  const usedUploadIds = new Set<string>();

  const matchedWeeks: MatchedWeek[] = plan.weeks.map((week) => {
    const weekStart = resolveWeekStart(week);
    const weekEnd = weekStart
      ? new Date(weekStart.getTime() + 7 * 86400000)
      : null;

    const matchedActions: MatchedAction[] = week.actions.map((action) => {
      const plannedDate = resolveActionDate(week, action);

      // If this is a user-added custom action
      if (action.custom) {
        return {
          ...action,
          status: action.completed ? 'completed' : 'manually_added' as ExecutionStatus,
          plannedDate: plannedDate?.toISOString(),
          daysFromDue: plannedDate
            ? Math.round((now.getTime() - plannedDate.getTime()) / 86400000)
            : undefined,
        };
      }

      // Community / post actions can't be matched to uploads
      if (action.format === 'community' || action.format === 'post') {
        const daysFromDue = plannedDate
          ? Math.round((now.getTime() - plannedDate.getTime()) / 86400000)
          : undefined;
        return {
          ...action,
          status: action.completed
            ? 'completed'
            : (daysFromDue != null && daysFromDue > 0 ? 'optional' : 'planned') as ExecutionStatus,
          plannedDate: plannedDate?.toISOString(),
          daysFromDue,
        };
      }

      // Try to match against uploads
      let bestMatch: { upload: RecentUpload; result: MatchScore } | null = null;

      for (const upload of uploads) {
        if (usedUploadIds.has(upload.id)) continue;
        const result = scoreMatch(action, upload, plannedDate);
        if (result && (!bestMatch || result.score > bestMatch.result.score)) {
          bestMatch = { upload, result };
        }
      }

      // If user manually marked complete, trust that
      if (action.completed && !bestMatch) {
        return {
          ...action,
          status: 'completed' as ExecutionStatus,
          plannedDate: plannedDate?.toISOString(),
          daysFromDue: plannedDate
            ? Math.round((now.getTime() - plannedDate.getTime()) / 86400000)
            : undefined,
        };
      }

      if (bestMatch) {
        usedUploadIds.add(bestMatch.upload.id);
        const uploadDate = new Date(bestMatch.upload.publishedAt);
        const daysSinceUpload = (now.getTime() - uploadDate.getTime()) / 86400000;

        return {
          ...action,
          status: (daysSinceUpload <= 7 ? 'live' : 'completed') as ExecutionStatus,
          matchedUpload: bestMatch.upload,
          matchConfidence: bestMatch.result.confidence,
          plannedDate: plannedDate?.toISOString(),
          daysFromDue: plannedDate
            ? Math.round((now.getTime() - plannedDate.getTime()) / 86400000)
            : undefined,
        };
      }

      // No match found — determine if missing or upcoming
      const daysFromDue = plannedDate
        ? Math.round((now.getTime() - plannedDate.getTime()) / 86400000)
        : null;

      let status: ExecutionStatus = 'planned';
      if (daysFromDue != null) {
        if (daysFromDue > 5) status = 'late';
        else if (daysFromDue > 1) status = 'missing';
        // else it's upcoming or today → 'planned'
      }

      return {
        ...action,
        status,
        plannedDate: plannedDate?.toISOString(),
        daysFromDue: daysFromDue ?? undefined,
      };
    });

    // Find uploads that landed during this week but weren't matched to actions
    const extraUploads: RecentUpload[] = [];
    if (weekStart && weekEnd) {
      for (const upload of uploads) {
        if (usedUploadIds.has(upload.id)) continue;
        const uploadDate = new Date(upload.publishedAt);
        if (uploadDate >= weekStart && uploadDate < weekEnd) {
          extraUploads.push(upload);
          usedUploadIds.add(upload.id);
        }
      }
    }

    return {
      ...week,
      actions: matchedActions,
      extraUploads,
    };
  });

  // Remaining unmatched uploads
  const unmatchedUploads = uploads.filter((u) => !usedUploadIds.has(u.id));

  // Compute stats
  const allActions = matchedWeeks.flatMap((w) => w.actions);
  const total = allActions.length;
  const completed = allActions.filter((a) => a.status === 'completed').length;
  const live = allActions.filter((a) => a.status === 'live').length;
  const planned = allActions.filter((a) => a.status === 'planned').length;
  const missing = allActions.filter((a) => a.status === 'missing').length;
  const late = allActions.filter((a) => a.status === 'late').length;
  const extraUploadsCount = matchedWeeks.reduce((s, w) => s + w.extraUploads.length, 0);

  const doneCount = completed + live;
  const pastDueCount = doneCount + missing + late;
  const completionRate = pastDueCount > 0 ? (doneCount / pastDueCount) * 100 : 0;

  return {
    weeks: matchedWeeks,
    stats: {
      total,
      completed,
      live,
      planned,
      missing,
      late,
      completionRate,
      extraUploads: extraUploadsCount + unmatchedUploads.length,
    },
    unmatchedUploads,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveWeekStart(week: PlanWeek): Date | null {
  const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
  if (!match) return null;
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = monthMap[match[1]];
  if (month == null) return null;
  const day = parseInt(match[2], 10);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate.getTime() < now.getTime() - 180 * 86400000) year += 1;
  return new Date(year, month, day);
}

/**
 * Get a human-friendly execution summary for the campaign.
 */
export function executionSummary(result: MatchResult): string {
  const { stats } = result;
  if (stats.total === 0) return 'No actions planned yet.';

  const parts: string[] = [];

  if (stats.completed + stats.live > 0) {
    parts.push(`${stats.completed + stats.live} done`);
  }
  if (stats.planned > 0) parts.push(`${stats.planned} upcoming`);
  if (stats.missing > 0) parts.push(`${stats.missing} missing`);
  if (stats.late > 0) parts.push(`${stats.late} late`);

  const rate = Math.round(stats.completionRate);
  return `${parts.join(', ')} — ${rate}% execution rate`;
}
