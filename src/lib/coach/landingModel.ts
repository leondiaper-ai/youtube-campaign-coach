/* ═══════════════════════════════════════════════════════════════════════
   COACH LANDING — one view model for the whole page

   The top actions, the campaign card and the rollout are three readings
   of ONE model. That is the point of this file. Previously each section
   computed its own view of what was published, so a newly matched asset
   could clear a rollout row while the action above it still asked for
   the same thing. Here, `published` is resolved once and every section
   derives from it.

   ── WHAT THIS FILE WILL NOT DO ────────────────────────────────────────
   No quotas, no cadence prescriptions, no algorithmic claims. A
   suggestion exists only where an observation supports it, and the
   observation travels with it so the page can show its working.

   Three distinctions are load-bearing and are kept in the types rather
   than in copy, because copy drifts:

     publishedAt vs agreedAt   what YouTube says is live, versus what a
                               person ticked. Never merged.
     campaign window           every figure carries the window it was
                               measured over. A lifetime total next to a
                               seven-day gain with no qualifier is the
                               single easiest way to mislead this reader.
     matched-age comparison    two videos compared at the SAME recorded
                               age, from readings we took ourselves, or
                               not compared at all.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY = 86_400_000;

export type UploadRef = {
  id: string;
  title: string;
  publishedAt: string;
  views: number | null;
  /** 'long' or 'short'. Drives the thumbnail shape, so formats stay recognisable. */
  shape: 'long' | 'short';
  format?: string;
};

/** A per-video daily reading we recorded ourselves. */
export type Reading = { ts: string; views: number };

export type ActionState = 'suggested' | 'agreed' | 'done';

export type LandingAction = {
  id: string;
  /** Imperative and short. The thing to do. */
  label: string;
  /** Release or moment it belongs to. */
  context: string;
  stage?: 'Live now' | 'Next single' | 'Album week' | 'Next album' | 'Review';
  observation?: string;
  window?: string;
  /** Suggested date or window. Always a planning date, never "optimal". */
  due: string;
  /** The same date as YYYY-MM-DD, so it can be edited and saved. */
  dueISO: string | null;
  dueTone: 'soon' | 'normal';
  /** One sentence. */
  reason: string;
  /** Opens in place, closed by default. */
  evidence: { heading: string; body: string; href?: string }[];
  state: ActionState;
};

export type ReleaseAsset = {
  label: string;
  note?: string;
  /** Published is resolved from uploads; agreed is a team decision. */
  status: 'published' | 'agreed' | 'suggested';
  meta?: string;
  videoId?: string;
  format?: string;
};

export type ReleaseBlock = {
  name: string;
  dateLabel: string;
  /** 'shipped' | 'live' | 'upcoming' | 'distant' */
  stage: 'shipped' | 'live' | 'upcoming' | 'distant';
  badge?: { label: string; tone: 'ok' | 'warn' | 'ghost' };
  assets: ReleaseAsset[];
  /** Shown instead of assets when it is too early to plan. */
  holding?: string;
  opportunity?: string;
  supportSummary?: string;
};

export type GuideAssessment = { tone: 'good' | 'behind' | 'neutral'; label: string };

export type LandingModel = {
  artist: string;
  project: string;
  stageLine: string;
  nextMoment?: {name:string; date:string; kind?:'single'|'album'} | null;
  /** One explicit campaign reporting window, used by every campaign figure. */
  windowLabel: string;
  actions: LandingAction[];
  framework?: { singles: number; heroes: number; followUps: number; shorts: number; shortsTarget: number; next28Shorts: number; upcomingMoments: number; assessment: {heroes: GuideAssessment; followUps: GuideAssessment; shorts: GuideAssessment} };
  coverage?: { name: string; date: string; guide?: string; cells: { label: string; count: number; planned: boolean; reported?: boolean }[] }[];
  shortsProgress?: { count: number; weekly: number; average: number | null; target: number | null };
  figures: { value: string; label: string; period: string; tone?: GuideAssessment['tone'] }[];
  latest: (UploadRef & { likes: number | null }) | null;
  /** Matched-age comparison sentence, produced by buildCoachStatus. Null when
   *  there is no comparable prior release or the readings are too stale. */
  paceLine: string | null;
  /** Sampled fan read. Scope always travels with it; never the audience. */
  fan: {
    quote: string; likes: number;
    commentsOnAsset: number; assetLabel: string; at: string;
    tone: string; theme: string | null;
  } | null;
  assets: { long: UploadRef[]; shorts: UploadRef[] };
  rollout: ReleaseBlock[];
  caveats: string[];
};

export const compact = (n: number) =>
  new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const exact = (n: number) => new Intl.NumberFormat('en-GB').format(n);
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/* ── matched-age comparison ──────────────────────────────────────────
   Both figures must come from readings taken at the same recorded age.
   A lifetime counter cannot produce this after the fact, which is why
   the daily series exists. Returns null rather than approximating. */
export function readingAtAge(
  readings: Reading[], publishedAt: string, ageDays: number,
): Reading | null {
  const born = Date.parse(publishedAt);
  if (!Number.isFinite(born)) return null;
  for (const r of readings) {
    const age = Math.round((Date.parse(`${r.ts}T12:00:00Z`) - born) / DAY);
    if (age === ageDays) return r;
  }
  return null;
}

/* ── the follow-up window ────────────────────────────────────────────
   Day 7–14 from the actual upload. A planning window taken from the
   deep dive's campaign flow, not a measured optimum, and the copy that
   renders it has to keep saying so. */
export function followUpWindow(publishedAt: string): { from: string; to: string; label: string } {
  const born = Date.parse(publishedAt);
  const from = new Date(born + 7 * DAY).toISOString();
  const to = new Date(born + 14 * DAY).toISOString();
  return { from, to, label: `${shortDate(from)}–${shortDate(to)}` };
}

/** Cap, and never pad to reach it. Two real actions beat two plus filler. */
export const MAX_ACTIONS = 2;
export function capActions(actions: LandingAction[]): LandingAction[] {
  return actions.filter(a => a.state !== 'done').slice(0, MAX_ACTIONS);
}
