/**
 * Coach → Watcher/Cockpit bridge.
 *
 * The Coach persists a CampaignPlan per artist in localStorage under
 * `pih-campaign-coach-v4:<slug>`. This lib reads that plan and extracts the
 * summary fields the rest of the app needs (campaign name, next moment),
 * without having to import the 7,000-line Coach component or its private
 * types.
 *
 * Client-only: touches `window.localStorage`. Callers MUST be 'use client'
 * (or gated behind a useEffect).
 */

export const COACH_PLAN_KEY = 'pih-campaign-coach-v4';

export type CoachNextMoment = {
  label: string;
  date: string;      // ISO yyyy-mm-dd
  days: number;      // days from today, negative if in the past
  type?: string;     // e.g. 'single', 'album', 'collab'
  isAnchor?: boolean;
};

export type CoachPlanSummary = {
  slug: string;
  artist: string | null;
  campaignName: string | null;
  isExample: boolean;
  nextMoment: CoachNextMoment | null;
  hasPlan: true;
};

/** Minimal shape we rely on — everything optional, loose types, forward compatible. */
type RawMoment = {
  weekNum?: number;
  date?: string;
  name?: string;
  type?: string;
  isAnchor?: boolean;
};

type RawAction = {
  title?: string;
  date?: string;
  momentRole?: 'hero' | 'support' | 'repackage' | 'push';
  dropType?: string;
};

type RawWeek = {
  week?: number;
  dateRange?: string;
  actions?: RawAction[];
};

type RawPlan = {
  artist?: string;
  campaignName?: string;
  startDate?: string;
  isExample?: boolean;
  moments?: RawMoment[];
  weeks?: RawWeek[];
};

function todayISODay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysFromToday(iso: string): number {
  const t = new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).getTime();
  if (isNaN(t)) return NaN;
  return Math.round((t - todayISODay()) / 86400000);
}

/**
 * Read and parse the Coach plan for a given artist slug.
 * Returns null if no plan stored, or if the blob is corrupt.
 */
export function readCoachPlan(slug: string): CoachPlanSummary | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(`${COACH_PLAN_KEY}:${slug}`);
  } catch {
    return null;
  }
  if (!raw || raw.length < 10) return null;

  let plan: RawPlan;
  try {
    plan = JSON.parse(raw) as RawPlan;
  } catch {
    return null;
  }

  const artist = typeof plan.artist === 'string' && plan.artist.trim() ? plan.artist.trim() : null;
  const campaignName =
    typeof plan.campaignName === 'string' && plan.campaignName.trim()
      ? plan.campaignName.trim()
      : null;
  const isExample = !!plan.isExample;

  return {
    slug,
    artist,
    campaignName,
    isExample,
    hasPlan: true,
    nextMoment: extractNextMoment(plan),
  };
}

/**
 * Find the nearest upcoming moment. Preferred source order:
 *  1. plan.moments[] with a future date (isAnchor first, then any)
 *  2. plan.weeks[*].actions[] where momentRole === 'hero' or dropType is set
 *  3. last resort — the most recent past moment/action so we show *something*
 *     rather than "nothing scheduled" when the campaign is mid-cycle.
 */
function extractNextMoment(plan: RawPlan): CoachNextMoment | null {
  const all: CoachNextMoment[] = [];

  if (Array.isArray(plan.moments)) {
    for (const m of plan.moments) {
      if (!m?.date || !m?.name) continue;
      const days = daysFromToday(m.date);
      if (isNaN(days)) continue;
      all.push({
        label: m.name,
        date: m.date,
        days,
        type: m.type,
        isAnchor: m.isAnchor,
      });
    }
  }

  if (Array.isArray(plan.weeks)) {
    for (const w of plan.weeks) {
      if (!w?.actions) continue;
      for (const a of w.actions) {
        if (!a?.date || !a?.title) continue;
        const isHero = a.momentRole === 'hero' || !!a.dropType;
        if (!isHero) continue;
        const days = daysFromToday(a.date);
        if (isNaN(days)) continue;
        all.push({ label: a.title, date: a.date, days, type: a.dropType });
      }
    }
  }

  if (all.length === 0) return null;

  // Prefer the soonest upcoming anchor; fall back to any upcoming; fall back
  // to the most recent past moment.
  const upcoming = all.filter((m) => m.days >= 0).sort((a, b) => a.days - b.days);
  if (upcoming.length > 0) {
    const anchor = upcoming.find((m) => m.isAnchor);
    return anchor ?? upcoming[0];
  }
  const past = all.slice().sort((a, b) => b.days - a.days); // least negative first
  return past[0] ?? null;
}

/**
 * Format helper matching the rest of the app's short date style (e.g. "Apr 16").
 */
export function fmtCoachDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

/** Human-readable "in 3d / today / 5d ago" */
export function fmtDaysFromNow(days: number): string {
  if (days === 0) return 'today';
  if (days < 0) return `${-days}d ago`;
  return `in ${days}d`;
}
