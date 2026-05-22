/**
 * Unified Campaign Pipeline
 *
 * THE ONE CANONICAL PIPELINE. Every campaign page flows through this.
 * K-Trap and French The Kid are the locked reference architecture.
 *
 * Pipeline stages:
 *   INGEST  → timeline events, uploads, metadata
 *   CLASSIFY → 14+ upload categories via classifyUploadFormat()
 *   GROUP   → attach uploads to release moments (not floating)
 *   SCORE   → importance, recency, support, momentum, persistence
 *   RENDER  → Active Moment → Momentum/Sustaining → Timeline
 *
 * This file consolidates:
 *   - campaignNarrative.ts   → classification, scoring, active moment selection
 *   - releaseClusters.ts     → checklist, coverage, support windows
 *   - CampaignDestination's extractMoments()  → plan-based moment extraction
 *   - CampaignDestination's detectCurrentPhase() → phase detection
 *
 * After this pipeline, CampaignDestination is a PURE RENDERER.
 * It calls buildCampaignPipeline() once and renders the output.
 */

import type { RecentUpload } from '@/lib/artists';
import type {
  PhaseName,
  ParsedEvent,
  GeneratedPlan,
  PlanWeek,
} from '@/lib/planEngine';
import type { MatchResult, MatchedAction } from './matchEngine';
import { classifyUploadFormat, type UploadFormatLabel } from './matchEngine';

// Re-export types that CampaignDestination needs from sub-engines
export type { UploadFormatLabel } from './matchEngine';
export type { NarrativeRole, DecayProfile, ClassifiedAsset } from './campaignNarrative';
export type {
  ReleaseCluster,
  ReleaseMoment,
  SupportCategory,
  SupportLink,
  ChecklistItem,
  PremiereStatus,
} from './releaseClusters';

// Import the sub-engines (kept as implementation detail — NOT called by consumers)
import {
  buildCampaignNarrative,
  classifyAsset,
  coverageLabel as narrativeCoverageLabel,
  coverageTone as narrativeCoverageTone,
  arcLabel,
  momentStateLabel,
  type CampaignNarrative,
  type NarrativeMoment,
  type ClassifiedAsset,
} from './campaignNarrative';

import {
  buildReleaseClusters,
  buildReleaseMoments,
  buildSupportChecklist,
  type ReleaseCluster,
  type ReleaseMoment,
  type ChecklistItem,
} from './releaseClusters';


// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED DATE PARSER — One parser, used everywhere
// ══════════════════════════════════════════════════════════════════════════════

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parse a dateRange string like "May 19 – 25" into a Date.
 * Year logic: if the date is >180 days in the past, assume next year.
 *
 * THIS IS THE SINGLE DATE PARSER. All code paths use this.
 */
export function parseDateRange(dateRange: string): Date | null {
  const match = dateRange.match(/^(\w+)\s+(\d+)/);
  if (!match) return null;
  const month = MONTH_MAP[match[1]];
  if (month == null) return null;
  const day = parseInt(match[2], 10);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate.getTime() < now.getTime() - 180 * 86400000) year += 1;
  return new Date(year, month, day);
}

/**
 * Is the given week "this week" (within -1 to +7 days of now)?
 */
export function isCurrentWeek(week: { dateRange: string }): boolean {
  const weekDate = parseDateRange(week.dateRange);
  if (!weekDate) return false;
  const diff = (Date.now() - weekDate.getTime()) / 86400000;
  return diff >= -1 && diff <= 7;
}

/**
 * Is the given week in the past (more than 7 days ago)?
 */
export function isWeekPast(week: { dateRange: string }): boolean {
  const weekDate = parseDateRange(week.dateRange);
  if (!weekDate) return false;
  const diff = (Date.now() - weekDate.getTime()) / 86400000;
  return diff > 7;
}

/**
 * Detect the current campaign phase from plan weeks.
 * Single source of truth — replaces detectCurrentPhase() in CampaignDestination.
 */
export function detectCurrentPhase(plan: GeneratedPlan): PhaseName | null {
  for (const week of plan.weeks) {
    if (isCurrentWeek(week)) return week.phase;
  }
  // Fallback: before all weeks → first phase, after all weeks → last phase
  if (plan.weeks.length > 0) {
    const firstDate = parseDateRange(plan.weeks[0].dateRange);
    const lastDate = parseDateRange(plan.weeks[plan.weeks.length - 1].dateRange);
    const now = Date.now();
    if (firstDate && now < firstDate.getTime()) return plan.phases[0]?.name ?? null;
    if (lastDate && now > lastDate.getTime() + 7 * 86400000)
      return plan.phases[plan.phases.length - 1]?.name ?? null;
  }
  return null;
}


// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED PLAN MOMENT — Replaces extractMoments() in CampaignDestination
// ══════════════════════════════════════════════════════════════════════════════

/**
 * A plan-based moment (derived from the generated plan, not from uploads).
 * This is the plan's view of what should happen — used alongside the
 * narrative's view of what actually happened.
 */
export type PlanMoment = {
  weekNum: number;
  momentName: string;
  dateRange: string;
  phase: PhaseName;
  timing: 'past' | 'current' | 'upcoming';
  daysAway: number;
  actions: MatchedAction[];
  extraUploads: RecentUpload[];
  primaryUpload: RecentUpload | null;
  supportDone: string[];
  supportMissing: string[];
  supportPlanned: string[];
  totalViews: number;
};


// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE OUTPUT — The single type CampaignDestination consumes
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The complete pipeline output. CampaignDestination receives this and
 * renders it. No further computation in the component.
 */
export type CampaignPipelineState = {
  // ── Phase & Arc ──
  /** Current campaign phase (BUILD/RELEASE/SCALE/EXTEND) */
  currentPhase: PhaseName | null;
  /** Campaign arc label for display */
  arcLabel: string;

  // ── Narrative Engine Output ──
  /** Full narrative (moments, scoring, active moment) */
  narrative: CampaignNarrative;
  /** The hero upload — the single most prominent piece of content right now */
  heroUpload: RecentUpload | null;
  /** The active narrative moment (if any) */
  activeMoment: NarrativeMoment | null;

  // ── Release Clusters ──
  /** Release clusters with support checklists */
  releaseClusters: ReleaseCluster[];
  /** Release moments grouped by phase */
  releaseMoments: ReleaseMoment[];

  // ── Plan Moments ──
  /** Plan-based moments (from generated plan + match result) */
  planMoments: PlanMoment[];
  /** The active plan moment (current or most recent past) */
  activePlanMoment: PlanMoment | null;

  // ── Classified Uploads ──
  /** All uploads sorted by recency */
  allByRecency: RecentUpload[];
  /** Shorts only */
  shorts: RecentUpload[];
  /** Longform only */
  longform: RecentUpload[];
  /** All classified assets */
  allAssets: ClassifiedAsset[];

  // ── Stats ──
  /** Total views across all campaign uploads */
  totalCampaignViews: number;
  /** Planned actions that produced YouTube content */
  totalPlanned: number;
  /** Actions that landed (completed or live) */
  landed: number;
  /** Open opportunities (missing, late, recommended) */
  openOpportunities: number;

  // ── 30-day window ──
  uploads30d: RecentUpload[];
  shorts30d: RecentUpload[];
  long30d: RecentUpload[];
};


// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE BUILDER — The single entry point
// ══════════════════════════════════════════════════════════════════════════════

export type PipelineInput = {
  plan: GeneratedPlan;
  recentUploads?: RecentUpload[];
  matchResult?: MatchResult;
  campaignStartDate?: string;
};

/**
 * Build the complete campaign pipeline state.
 *
 * This is THE ONE FUNCTION that CampaignDestination calls.
 * Everything flows through here. No parallel systems.
 *
 * Pipeline:
 * 1. INGEST — take plan, uploads, match result
 * 2. CLASSIFY — every upload goes through classifyAsset()
 * 3. GROUP — narrative engine groups into moments; cluster engine builds checklists
 * 4. SCORE — narrative scoring determines hierarchy and active moment
 * 5. OUTPUT — single CampaignPipelineState for the renderer
 */
export function buildCampaignPipeline(input: PipelineInput): CampaignPipelineState {
  const { plan, recentUploads, matchResult, campaignStartDate } = input;
  const uploads = recentUploads ?? [];

  // ═══ Stage 1: PHASE DETECTION ═══
  const currentPhase = detectCurrentPhase(plan);

  // ═══ Stage 2: NARRATIVE ENGINE (classify + group + score) ═══
  // This is the primary pipeline — it classifies all uploads, groups them
  // into moments around centrepieces, scores them, and selects the active moment.
  const narrative = buildCampaignNarrative(uploads, {
    campaignStartDate,
    campaignWeeks: plan.totalWeeks,
    minCentrepieceViews: 5000,
    maxMoments: 8,
    currentPhase,
    planEvents: plan.events,
  });

  // ═══ Stage 3: RELEASE CLUSTERS (checklists + coverage) ═══
  // Adds the support checklist and coverage matrix that the narrative engine
  // doesn't provide. Uses the same uploads, same campaign window.
  const releaseClusters = buildReleaseClusters(uploads, {
    minAnchorViews: 5000,
    maxPillars: 6,
    campaignStartDate,
    campaignWeeks: plan.totalWeeks,
    campaignEvents: plan.events,
  });

  const releaseMoments = buildReleaseMoments(
    releaseClusters,
    plan.phases,
    campaignStartDate,
  );

  // ═══ Stage 4: PLAN MOMENTS ═══
  // Extract plan-based moments (what the plan says should happen).
  // These complement the narrative moments (what actually happened).
  const planMoments = extractPlanMoments(plan, matchResult);
  const activePlanMoment = planMoments.find(m => m.timing === 'current')
    ?? planMoments.find(m => m.timing === 'past')
    ?? null;

  // ═══ Stage 5: UPLOAD CLASSIFICATION ═══
  const allByRecency = [...uploads].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const shorts = allByRecency.filter(u => u.durationSec <= 62);
  const longform = allByRecency.filter(u => u.durationSec > 62);

  // ═══ Stage 6: HERO SELECTION — single cascade, no parallel ═══
  // Priority: narrative active moment centrepiece > plan moment primary > most recent longform > any
  const heroUpload = selectHeroUpload(narrative, activePlanMoment, longform, allByRecency);

  // ═══ Stage 7: STATS ═══
  const totalCampaignViews = allByRecency.reduce((s, u) => s + u.viewCount, 0);
  const totalPlanned = narrative.stats.plannedUploads;
  const landed = matchResult
    ? matchResult.weeks.flatMap(w => w.actions).filter(a => a.status === 'completed' || a.status === 'live').length
    : 0;
  const openOpportunities = matchResult
    ? matchResult.weeks.flatMap(w => w.actions).filter(a => a.status === 'missing' || a.status === 'late' || a.status === 'recommended').length
    : 0;

  // ═══ Stage 8: 30-DAY WINDOW ═══
  const daysAgoNum = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86400000;
  const uploads30d = allByRecency.filter(u => daysAgoNum(u.publishedAt) <= 30);
  const shorts30d = uploads30d.filter(u => u.durationSec <= 62);
  const long30d = uploads30d.filter(u => u.durationSec > 62);

  return {
    currentPhase,
    arcLabel: arcLabel(narrative.arc),
    narrative,
    heroUpload,
    activeMoment: narrative.activeMoment,
    releaseClusters,
    releaseMoments,
    planMoments,
    activePlanMoment,
    allByRecency,
    shorts,
    longform,
    allAssets: narrative.allAssets,
    totalCampaignViews,
    totalPlanned,
    landed,
    openOpportunities,
    uploads30d,
    shorts30d,
    long30d,
  };
}


// ══════════════════════════════════════════════════════════════════════════════
// INTERNAL: Plan moment extraction
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Extract plan-based moments from the generated plan.
 * Replaces extractMoments() that was inline in CampaignDestination.
 */
function extractPlanMoments(
  plan: GeneratedPlan,
  matchResult?: MatchResult,
): PlanMoment[] {
  const now = new Date();

  return plan.weeks
    .filter(w => w.momentName)
    .map(week => {
      const weekStart = parseDateRange(week.dateRange);
      const daysAway = weekStart
        ? Math.round((now.getTime() - weekStart.getTime()) / 86400000)
        : 0;

      let timing: PlanMoment['timing'] = 'upcoming';
      if (daysAway >= 0 && daysAway <= 7) timing = 'current';
      else if (daysAway > 7) timing = 'past';

      const matchedWeek = matchResult?.weeks.find(w => w.weekNum === week.weekNum);
      const actions: MatchedAction[] = matchedWeek
        ? matchedWeek.actions
        : week.actions.map(a => ({ ...a, status: 'planned' as const }));
      const extraUploads = matchedWeek?.extraUploads ?? [];

      let primaryUpload: RecentUpload | null = null;
      const matchedUploads = actions
        .filter(a => a.matchedUpload)
        .map(a => a.matchedUpload!);
      if (matchedUploads.length > 0) {
        primaryUpload = matchedUploads.sort((a, b) => b.viewCount - a.viewCount)[0];
      }

      const totalViews = [
        ...matchedUploads.map(u => u.viewCount),
        ...extraUploads.map(u => u.viewCount),
      ].reduce((s, v) => s + v, 0);

      const supportDone = actions
        .filter(a => a.status === 'completed' || a.status === 'live')
        .map(a => cleanTitle(a.title));
      const supportMissing = actions
        .filter(a => a.status === 'missing' || a.status === 'late')
        .map(a => cleanTitle(a.title));
      const supportPlanned = actions
        .filter(a => a.status === 'planned')
        .map(a => cleanTitle(a.title));

      return {
        weekNum: week.weekNum,
        momentName: week.momentName!,
        dateRange: week.dateRange,
        phase: week.phase,
        timing,
        daysAway,
        actions,
        extraUploads,
        primaryUpload,
        supportDone,
        supportMissing,
        supportPlanned,
        totalViews,
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway);
}

function cleanTitle(title: string): string {
  return title
    .replace(/^(Upload|Post|Create|Film|Record|Publish|Release)\s+/i, '')
    .replace(/\s*(short|video|post|clip)$/i, '')
    .trim() || title;
}


// ══════════════════════════════════════════════════════════════════════════════
// INTERNAL: Hero upload selection — single cascade
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Select the hero upload using a single, deterministic cascade.
 *
 * Priority:
 * 1. Narrative active moment's centrepiece (from scoring engine)
 * 2. Active plan moment's primary upload (from plan matching)
 * 3. Most recent longform upload
 * 4. Most recent upload of any format
 *
 * This replaces the scattered hero selection in CampaignDestination.
 */
function selectHeroUpload(
  narrative: CampaignNarrative,
  activePlanMoment: PlanMoment | null,
  longform: RecentUpload[],
  allByRecency: RecentUpload[],
): RecentUpload | null {
  // 1. Narrative engine's active moment — the scored, weighted choice
  if (narrative.activeMoment?.centrepiece.upload) {
    return narrative.activeMoment.centrepiece.upload;
  }

  // 2. Plan moment's primary upload — matched from execution engine
  if (activePlanMoment?.primaryUpload) {
    return activePlanMoment.primaryUpload;
  }

  // 3. Most recent longform
  if (longform.length > 0) return longform[0];

  // 4. Any upload
  return allByRecency[0] ?? null;
}


// ══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS — Convenience functions for the renderer
// ══════════════════════════════════════════════════════════════════════════════

// Re-export narrative helpers so CampaignDestination imports from ONE place
export {
  narrativeCoverageLabel as coverageLabel,
  narrativeCoverageTone as coverageTone,
  arcLabel,
  momentStateLabel,
  classifyUploadFormat,
  classifyAsset,
};

// Re-export date helpers
export { parseDateRange as parseWeekDate, parseDateRange as resolveWeekDate };
