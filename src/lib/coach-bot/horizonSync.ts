/**
 * COACH PLAN → HORIZON PROJECTION  (client-side)
 *
 * Reads the existing browser-held Coach plan and projects it into the
 * server-side Campaign Horizon. Runs in the browser because that is the only
 * place the plan exists.
 *
 * ── PROJECTION, NOT MIGRATION ─────────────────────────────────────────
 * The Coach plan stays exactly where it is and keeps working. This reads it,
 * normalises it and pushes a clean copy server-side. Nothing here writes back
 * to localStorage, so there is no risk of corrupting the planner, and the
 * human keeps one place to plan a campaign.
 *
 * ── WHAT IS DELIBERATELY DROPPED ──────────────────────────────────────
 * Past events, and anything without a usable title. The horizon is about
 * what is COMING; Watcher already knows what happened, and far more
 * reliably than a hand-typed plan does.
 */

import { COACH_PLAN_KEY } from '../coachPlan';
import { normaliseEventType, type EventStatus, type EventType } from './horizon';

export interface SyncEvent {
  eventDate: string | null;
  eventType: EventType;
  title: string;
  assetType: string | null;
  status: EventStatus;
  note: string | null;
  campaignId: string | null;
}

interface RawMoment { weekNum?: number; date?: string; name?: string; type?: string; isAnchor?: boolean }
interface RawAction { title?: string; date?: string; momentRole?: string; dropType?: string }
interface RawWeek { week?: number; dateRange?: string; actions?: RawAction[] }
interface RawPlan {
  artist?: string; campaignName?: string; slug?: string;
  startDate?: string; isExample?: boolean;
  moments?: RawMoment[]; weeks?: RawWeek[];
}

function isoDay(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Extracts the forward events from a stored Coach plan. */
export function projectCoachPlan(slug: string, now = Date.now()): SyncEvent[] | null {
  if (typeof window === 'undefined') return null;
  let plan: RawPlan | null = null;
  try {
    const raw = window.localStorage.getItem(`${COACH_PLAN_KEY}:${slug}`);
    if (!raw) return null;
    plan = JSON.parse(raw) as RawPlan;
  } catch { return null; }
  if (!plan) return null;

  /* Example/demo plans must never reach the Coach — they would produce
     confident advice timed against fictional releases. */
  if (plan.isExample) return [];

  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const out: SyncEvent[] = [];
  const campaignId = plan.campaignName ?? null;

  for (const m of plan.moments ?? []) {
    const date = isoDay(m.date);
    if (!m.name) continue;
    if (date && new Date(date + 'T00:00:00') < today) continue;
    out.push({
      eventDate: date,
      /* isAnchor is the planner's own marker for a major beat, so it wins
         over a vague type string. */
      eventType: m.isAnchor && normaliseEventType(m.type) === 'OTHER'
        ? 'SINGLE_RELEASE' : normaliseEventType(m.type),
      title: m.name,
      assetType: m.type ?? null,
      status: 'PLANNED',
      note: m.isAnchor ? 'Anchor moment in the Coach plan' : null,
      campaignId,
    });
  }

  for (const w of plan.weeks ?? []) {
    for (const a of w.actions ?? []) {
      if (!a.title) continue;
      const date = isoDay(a.date);
      if (date && new Date(date + 'T00:00:00') < today) continue;
      /* Undated week actions are kept only when they name an asset type —
         otherwise they are task-list noise ("brief the team"), not campaign
         moments, and would inflate the horizon with nothing schedulable. */
      if (!date && !a.dropType && !a.momentRole) continue;
      out.push({
        eventDate: date,
        eventType: normaliseEventType(a.dropType ?? a.momentRole ?? a.title),
        title: a.title,
        assetType: a.dropType ?? a.momentRole ?? null,
        status: 'PLANNED',
        note: date ? null : `Undated action from plan week ${w.week ?? '?'}`,
        campaignId,
      });
    }
  }

  /* De-duplicate: planner moments frequently reappear as week actions. */
  const seen = new Set<string>();
  return out.filter(e => {
    const k = `${e.eventDate ?? 'undated'}|${e.title.toLowerCase().trim()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Projects and pushes to the server. Returns null when there is no plan. */
export async function syncHorizon(slug: string): Promise<{ total: number; replaced: number } | null> {
  const events = projectCoachPlan(slug);
  if (events === null) return null;
  const r = await fetch('/api/campaign-horizon', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, sync: events }),
  }).then(x => x.json());
  return { total: r.total ?? 0, replaced: r.replaced ?? 0 };
}
