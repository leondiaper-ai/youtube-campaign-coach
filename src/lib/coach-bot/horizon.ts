/**
 * CAMPAIGN HORIZON — what is supposed to happen next
 *
 * Watcher answers "what happened". This answers "what is planned". The Coach
 * reasons about the gap between the two, and the gap is where every useful
 * timing decision lives.
 *
 * ── WHY THIS IS A SEPARATE LAYER ──────────────────────────────────────
 * The live Coach plan lives in the browser's localStorage (COACH_PLAN_KEY,
 * 'pih-campaign-coach-v4'). No server-side caller can read it, which is why
 * horizonKnown was false for all 30 campaigns on first run. This module is
 * the server-side PROJECTION of that plan — deliberately a projection and
 * not a replacement, so the existing Coach UI keeps working untouched and
 * there is exactly one place a human plans a campaign.
 *
 * ── THE RULE THIS LAYER EXISTS TO ENFORCE ─────────────────────────────
 * A stale plan is more dangerous than no plan, because it looks like
 * knowledge. "Single 2 on 14 March" is actively misleading in September.
 * So horizonKnown alone is not enough: every horizon carries a CONFIDENCE
 * and, when that confidence is poor, a plain-English REASON the Coach must
 * repeat rather than quietly working around.
 */

import { Redis } from '@upstash/redis';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* ── Model ──────────────────────────────────────────────────────────── */

export type EventType =
  | 'SINGLE_RELEASE' | 'EP_RELEASE' | 'ALBUM_RELEASE' | 'ANNOUNCEMENT'
  | 'OMV' | 'VISUALISER' | 'LYRIC_VIDEO' | 'LIVE_PERFORMANCE'
  | 'BTS' | 'SHORTS_PUSH' | 'CATALOGUE_ACTIVATION' | 'OTHER';

export const EVENT_TYPES: EventType[] = [
  'SINGLE_RELEASE', 'EP_RELEASE', 'ALBUM_RELEASE', 'ANNOUNCEMENT',
  'OMV', 'VISUALISER', 'LYRIC_VIDEO', 'LIVE_PERFORMANCE',
  'BTS', 'SHORTS_PUSH', 'CATALOGUE_ACTIVATION', 'OTHER',
];

export type EventStatus = 'PLANNED' | 'CONFIRMED' | 'TENTATIVE' | 'COMPLETED' | 'CANCELLED';
export const EVENT_STATUSES: EventStatus[] = ['PLANNED', 'CONFIRMED', 'TENTATIVE', 'COMPLETED', 'CANCELLED'];

export type EventSource = 'coach_plan' | 'manual' | 'artist_record';

export interface CampaignEvent {
  eventId: string;
  artistId: string;          // artist slug
  campaignId: string | null; // campaign name, when known
  eventDate: string | null;  // yyyy-mm-dd. NULL = planned but undated.
  eventType: EventType;
  title: string;
  assetType: string | null;
  status: EventStatus;
  note: string | null;
  source: EventSource;
  createdAt: string;
  updatedAt: string;
}

/**
 * MAJOR moments are the ones that make other content compete for attention.
 * A Shorts push does not; a single release does. This distinction is what
 * lets the Coach say "hold the live asset, Single 2 is in six days" rather
 * than treating every planned item as a blocker.
 */
const MAJOR_TYPES = new Set<EventType>([
  'SINGLE_RELEASE', 'EP_RELEASE', 'ALBUM_RELEASE', 'OMV', 'ANNOUNCEMENT',
]);
export const isMajor = (t: EventType) => MAJOR_TYPES.has(t);

/** Long-form music destinations — what the 7–14 day window is asking for. */
const LONG_FORM_TYPES = new Set<EventType>([
  'OMV', 'VISUALISER', 'LYRIC_VIDEO', 'LIVE_PERFORMANCE',
]);
export const isLongForm = (t: EventType) => LONG_FORM_TYPES.has(t);

/* ── Store ──────────────────────────────────────────────────────────── */

const K_EVENTS = (slug: string) => `horizon:${slug}`;
const K_META = (slug: string) => `horizon:meta:${slug}`;
const MAX_EVENTS = 200;

export interface HorizonMeta {
  lastPlanUpdatedAt: string;   // when the plan content last changed
  lastSyncedAt: string | null; // when a coach_plan sync last ran
  syncedEventCount: number;
}

export async function listEvents(slug: string): Promise<CampaignEvent[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<CampaignEvent[]>(K_EVENTS(slug));
  return Array.isArray(raw) ? raw : [];
}

export async function getMeta(slug: string): Promise<HorizonMeta | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<HorizonMeta>(K_META(slug))) ?? null;
}

async function writeEvents(slug: string, events: CampaignEvent[], meta?: Partial<HorizonMeta>) {
  const store = await kv();
  if (!store) return;
  await store.set(K_EVENTS(slug), events.slice(0, MAX_EVENTS));
  const prev = (await store.get<HorizonMeta>(K_META(slug))) ?? {
    lastPlanUpdatedAt: new Date().toISOString(), lastSyncedAt: null, syncedEventCount: 0,
  };
  await store.set(K_META(slug), {
    ...prev,
    lastPlanUpdatedAt: new Date().toISOString(),
    ...meta,
  });
}

export async function upsertEvent(e: CampaignEvent): Promise<CampaignEvent[]> {
  const all = await listEvents(e.artistId);
  const i = all.findIndex(x => x.eventId === e.eventId);
  if (i >= 0) all[i] = { ...e, updatedAt: new Date().toISOString() };
  else all.push(e);
  all.sort(sortByDate);
  await writeEvents(e.artistId, all);
  return all;
}

export async function deleteEvent(slug: string, eventId: string): Promise<CampaignEvent[]> {
  const all = (await listEvents(slug)).filter(e => e.eventId !== eventId);
  await writeEvents(slug, all);
  return all;
}

/** Undated events sort last — they are real plans without a date yet. */
function sortByDate(a: CampaignEvent, b: CampaignEvent): number {
  if (!a.eventDate && !b.eventDate) return 0;
  if (!a.eventDate) return 1;
  if (!b.eventDate) return -1;
  return a.eventDate.localeCompare(b.eventDate);
}

/**
 * Replaces all coach_plan-sourced events for an artist, leaving manual ones
 * intact.
 *
 * Replace-not-merge is deliberate: if someone DELETES a moment in the Coach
 * plan, a merge would silently keep the stale event forever and the Coach
 * would go on planning around a release that no longer exists. Manual events
 * survive because a human entered them directly and the Coach plan has no
 * opinion about them.
 */
export async function syncFromCoachPlan(
  slug: string,
  incoming: CampaignEvent[],
): Promise<{ kept: number; replaced: number; total: number }> {
  const existing = await listEvents(slug);
  const manual = existing.filter(e => e.source !== 'coach_plan');
  const merged = [...manual, ...incoming].sort(sortByDate);
  await writeEvents(slug, merged, {
    lastSyncedAt: new Date().toISOString(),
    syncedEventCount: incoming.length,
  });
  return { kept: manual.length, replaced: incoming.length, total: merged.length };
}

/* ── Horizon projection ─────────────────────────────────────────────── */

export type HorizonConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface HorizonEvent {
  eventId: string;
  date: string | null;
  daysAway: number | null;
  type: EventType;
  title: string;
  status: EventStatus;
  major: boolean;
  longForm: boolean;
  source: EventSource;
  note?: string | null;
}

export interface CampaignHorizon {
  artistId: string;
  horizonKnown: boolean;
  horizonConfidence: HorizonConfidence;
  horizonReason: string | null;
  lastPlanUpdatedAt: string | null;
  planAgeDays: number | null;

  nextMajorMoment: HorizonEvent | null;
  next7Days: HorizonEvent[];
  days7to14: HorizonEvent[];
  next30Days: HorizonEvent[];
  undated: HorizonEvent[];

  /** Long-form music assets already planned in the next 30 days. */
  plannedLongFormNext30: HorizonEvent[];
  /** Is a long-form asset ALREADY scheduled in the 7–14 day window? */
  longFormPlannedIn7to14: boolean;

  totalUpcoming: number;
  warnings: string[];
}

const DAY = 86_400_000;

/**
 * Confidence rules. Deliberately conservative — the cost of over-claiming
 * (a confident recommendation timed against a plan that is six months old)
 * is far higher than the cost of under-claiming (the Coach asks you to
 * confirm the schedule).
 */
const FRESH_DAYS = 21;   // a plan touched within 3 weeks is current
const STALE_DAYS = 60;   // beyond this, forward dates are not trustworthy

export function buildHorizon(
  slug: string,
  events: CampaignEvent[],
  meta: HorizonMeta | null,
  now = Date.now(),
): CampaignHorizon {
  const warnings: string[] = [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const live = events.filter(e => e.status !== 'CANCELLED' && e.status !== 'COMPLETED');

  const toHorizonEvent = (e: CampaignEvent): HorizonEvent => {
    const daysAway = e.eventDate
      ? Math.round((new Date(e.eventDate + 'T00:00:00').getTime() - today.getTime()) / DAY)
      : null;
    return {
      eventId: e.eventId, date: e.eventDate, daysAway,
      type: e.eventType, title: e.title, status: e.status,
      major: isMajor(e.eventType), longForm: isLongForm(e.eventType),
      source: e.source, note: e.note,
    };
  };

  const mapped = live.map(toHorizonEvent);
  const dated = mapped.filter(e => e.daysAway !== null) as (HorizonEvent & { daysAway: number })[];
  const upcoming = dated.filter(e => e.daysAway >= 0).sort((a, b) => a.daysAway - b.daysAway);
  const undated = mapped.filter(e => e.daysAway === null);
  const past = dated.filter(e => e.daysAway < 0);

  const planAgeDays = meta?.lastPlanUpdatedAt
    ? Math.round((now - new Date(meta.lastPlanUpdatedAt).getTime()) / DAY)
    : null;

  /* ── Confidence ─────────────────────────────────────────────────── */
  let horizonConfidence: HorizonConfidence;
  let horizonReason: string | null = null;

  if (!live.length) {
    horizonConfidence = 'UNKNOWN';
    horizonReason = 'No campaign events have been recorded for this artist. The forward plan is entirely unknown to this system.';
  } else if (!upcoming.length && !undated.length) {
    horizonConfidence = 'UNKNOWN';
    horizonReason = `All ${past.length} recorded campaign event(s) are in the past. There is no forward plan — the most recent was ${Math.abs(past[past.length - 1]?.daysAway ?? 0)} days ago.`;
  } else if (planAgeDays !== null && planAgeDays > STALE_DAYS) {
    horizonConfidence = 'LOW';
    horizonReason = `The campaign plan has not been updated in ${planAgeDays} days. Forward dates may no longer reflect the real schedule.`;
  } else if (!upcoming.length) {
    horizonConfidence = 'LOW';
    horizonReason = `${undated.length} planned item(s) exist but none has a date, so nothing can be timed against them.`;
  } else {
    const confirmed = upcoming.filter(e => e.status === 'CONFIRMED');
    const fresh = planAgeDays === null || planAgeDays <= FRESH_DAYS;
    if (confirmed.length > 0 && fresh) {
      horizonConfidence = 'HIGH';
    } else {
      horizonConfidence = 'MEDIUM';
      horizonReason = !confirmed.length
        ? `A forward plan exists but no upcoming event is CONFIRMED (${upcoming.map(e => e.status).join(', ')}). Treat dates as provisional.`
        : `The plan was last updated ${planAgeDays} days ago. Usable, but confirm before acting on precise timing.`;
    }
  }

  const horizonKnown = horizonConfidence === 'HIGH' || horizonConfidence === 'MEDIUM';

  /* ── Warnings the Coach must carry into its reasoning ────────────── */
  if (past.length && upcoming.length === 0) {
    warnings.push('Every recorded event is in the past. The plan has not been rolled forward.');
  }
  if (undated.length) {
    warnings.push(`${undated.length} planned asset(s) have no date — they cannot be used for timing, only for knowing the asset exists.`);
  }
  const tentative = upcoming.filter(e => e.status === 'TENTATIVE');
  if (tentative.length) {
    warnings.push(`${tentative.length} upcoming event(s) are TENTATIVE and may move.`);
  }
  if (meta?.lastSyncedAt == null && live.some(e => e.source === 'coach_plan')) {
    warnings.push('Coach-plan events exist but no sync timestamp is recorded.');
  }

  const inWindow = (lo: number, hi: number) => upcoming.filter(e => e.daysAway >= lo && e.daysAway <= hi);
  const next7 = inWindow(0, 7);
  const d7to14 = inWindow(7, 14);
  const next30 = inWindow(0, 30);
  const plannedLongFormNext30 = next30.filter(e => e.longForm);

  return {
    artistId: slug,
    horizonKnown,
    horizonConfidence,
    horizonReason,
    lastPlanUpdatedAt: meta?.lastPlanUpdatedAt ?? null,
    planAgeDays,
    nextMajorMoment: upcoming.find(e => e.major) ?? null,
    next7Days: next7,
    days7to14: d7to14,
    next30Days: next30,
    undated,
    plannedLongFormNext30,
    longFormPlannedIn7to14: d7to14.some(e => e.longForm),
    totalUpcoming: upcoming.length,
    warnings,
  };
}

export async function getHorizon(slug: string, now = Date.now()): Promise<CampaignHorizon> {
  const [events, meta] = await Promise.all([listEvents(slug), getMeta(slug)]);
  return buildHorizon(slug, events, meta, now);
}

/* ── Helpers ────────────────────────────────────────────────────────── */

export function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Maps the loose free-text type strings the Coach plan uses onto our enum.
 * Anything unrecognised becomes OTHER rather than being guessed at — an
 * event mistyped as SINGLE_RELEASE would wrongly block other content.
 */
export function normaliseEventType(raw?: string | null): EventType {
  const s = (raw ?? '').toLowerCase();
  if (/album/.test(s)) return 'ALBUM_RELEASE';
  if (/\bep\b/.test(s)) return 'EP_RELEASE';
  if (/single|track|song|focus/.test(s)) return 'SINGLE_RELEASE';
  if (/announce|reveal/.test(s)) return 'ANNOUNCEMENT';
  if (/music video|\bomv\b|official video/.test(s)) return 'OMV';
  if (/visuali[sz]er/.test(s)) return 'VISUALISER';
  if (/lyric/.test(s)) return 'LYRIC_VIDEO';
  if (/live|performance|session|acoustic/.test(s)) return 'LIVE_PERFORMANCE';
  if (/bts|behind/.test(s)) return 'BTS';
  if (/short/.test(s)) return 'SHORTS_PUSH';
  if (/catalogue|catalog/.test(s)) return 'CATALOGUE_ACTIVATION';
  return 'OTHER';
}
