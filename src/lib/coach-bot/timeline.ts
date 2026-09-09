/**
 * CAMPAIGN COACH — LIVING TIMELINE
 *
 * The Coach reasons about WHERE a campaign is, not just what its numbers are.
 * This file assembles that timeline from the sources Watcher already has,
 * and — critically — makes what is UNKNOWN explicit.
 *
 * ── WHY THE UNKNOWNS MATTER MORE THAN THE KNOWNS ──────────────────────
 * The single worst failure mode for this product is:
 *   "We are in the 7–14 day window, publish another long-form asset."
 * …said three days before Single 2, which the Coach could not see.
 *
 * A campaign calendar that silently omits planned releases will produce
 * confident, well-formatted, actively harmful advice. So `horizonKnown`
 * is a first-class field: when we do not have forward visibility, the
 * Coach is required to say so and to soften any "publish now" call.
 *
 * ── WHERE FORWARD-LOOKING DATA ACTUALLY LIVES ─────────────────────────
 * Three places, none complete:
 *   1. Artist.nextMomentLabel / nextMomentDate — manual, often stale.
 *   2. SavedPlan (plan:{slug}) — generated from a pasted timeline.
 *   3. Coach plan in BROWSER localStorage — invisible server-side, so the
 *      Coach genuinely cannot see it. Recorded here so nobody assumes it.
 */

import type { Artist } from '../artists';
import type { CatalogueRecon, Asset } from '../researcher/types';

export type Horizon = 'past' | 'now' | 'next_7d' | 'd7_14' | 'next_30d' | 'beyond';

export type EventKind =
  | 'omv' | 'single' | 'album' | 'visualiser' | 'lyric' | 'live'
  | 'bts' | 'short' | 'catalogue' | 'announcement' | 'planned_asset' | 'external';

/**
 * `evidenceClass` is required on every event and is the honesty mechanism
 * the brief asks for. RETROSPECTIVE_ARCHITECTURE means we know it happened
 * and when, from immutable publish dates. CURRENT_OBSERVATION is a lifetime
 * figure read today. LONGITUDINAL_OBSERVATION is the only one that describes
 * change over time, and it is only available at channel level.
 *
 * Nothing may be labelled LONGITUDINAL unless it came from the daily
 * channel snapshot series. Lifetime views are never velocity.
 */
export type EvidenceClass =
  | 'RETROSPECTIVE_ARCHITECTURE'
  | 'CURRENT_OBSERVATION'
  | 'LONGITUDINAL_OBSERVATION'
  | 'PLANNED_UNVERIFIED';

export interface TimelineEvent {
  date: string;             // ISO date
  daysFromNow: number;      // negative = past
  horizon: Horizon;
  kind: EventKind;
  title: string;
  status: 'happened' | 'planned';
  evidenceClass: EvidenceClass;
  videoId?: string;
  /** Lifetime views as at fetch. NEVER a period figure. */
  currentViews?: number;
  /** Ratio to this artist's own same-age hero median, where computable. */
  vsOwnBaseline?: number | null;
  interpretation?: string;
}

export interface CampaignTimeline {
  artistSlug: string;
  artistName: string;
  campaignName: string | null;
  campaignStartDate: string | null;
  campaignDay: number | null;
  phase: string | null;

  events: TimelineEvent[];

  /** The hero currently "in market" — most recent OMV. */
  currentHero: TimelineEvent | null;
  daysSinceCurrentHero: number | null;

  /**
   * Is the campaign inside the 7–14 day secondary-content window relative
   * to the most recent hero? Purely positional; says nothing about whether
   * acting on it is correct.
   */
  inFollowUpWindow: boolean;
  /**
   * The bare boolean above is ambiguous and was misread in testing: a model
   * saw `inFollowUpWindow: false` on day 6 and reported the window as
   * "closed" when it had not yet opened. That is a materially different
   * situation — one says wait, the other says you missed it — so the state
   * is now named rather than inferred.
   */
  followUpWindow: 'NOT_YET_OPEN' | 'OPEN' | 'CLOSED' | 'NO_HERO';
  /** Days until the window opens. Null unless followUpWindow is NOT_YET_OPEN. */
  daysUntilFollowUpWindow: number | null;
  /** Long-form already published since the current hero. */
  longFormSinceHero: number;

  /**
   * THE GUARD RAIL. False when we have no credible forward-looking data.
   * When false the Coach must not issue an unqualified "publish now".
   */
  horizonKnown: boolean;
  horizonSource: string;
  nextPlannedEvent: TimelineEvent | null;
  daysToNextPlanned: number | null;

  gaps: { fromDate: string; days: number; longForm: number; shorts: number }[];
  dataNotes: string[];
}

const DAY = 86_400_000;

function horizonOf(daysFromNow: number): Horizon {
  if (daysFromNow < 0) return 'past';
  if (daysFromNow === 0) return 'now';
  if (daysFromNow <= 7) return 'next_7d';
  if (daysFromNow <= 14) return 'd7_14';
  if (daysFromNow <= 30) return 'next_30d';
  return 'beyond';
}

function kindOfFormat(format: string, isShort: boolean): EventKind {
  if (isShort) return 'short';
  switch (format) {
    case 'omv': return 'omv';
    case 'lyric': return 'lyric';
    case 'visualiser': return 'visualiser';
    case 'live': case 'acoustic': return 'live';
    case 'bts': case 'documentary': case 'interview': return 'bts';
    case 'tour': return 'external';
    default: return 'catalogue';
  }
}

export function buildTimeline(
  artist: Artist,
  recon: CatalogueRecon,
  opts: { plannedFromPlan?: { date: string; label: string }[] } = {},
  now = Date.now(),
): CampaignTimeline {
  const dataNotes: string[] = [];

  /* Campaign day. */
  const startIso = artist.campaignStartDate ?? null;
  const campaignDay = startIso
    ? Math.max(1, Math.floor((now - new Date(startIso).getTime()) / DAY))
    : null;
  if (!startIso) dataNotes.push('No campaignStartDate on the artist record — campaign day is unknown, so phase reasoning is weaker.');

  /* Past events: everything published, from reconstruction. */
  const allAssets: Asset[] = [];
  const seen = new Set<string>();
  for (const m of recon.moments) {
    for (const a of [m.hero, ...m.longFormInGap, ...m.shortsInGap]) {
      if (!seen.has(a.videoId)) { seen.add(a.videoId); allAssets.push(a); }
    }
  }
  for (const h of recon.heroes) {
    if (!seen.has(h.videoId)) { seen.add(h.videoId); allAssets.push(h); }
  }

  /* Only the campaign window (or last 120 days) is relevant to coaching. */
  const windowStart = startIso ? new Date(startIso).getTime() : now - 120 * DAY;
  const inWindow = allAssets
    .filter(a => new Date(a.publishedAt).getTime() >= windowStart)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const baselineFor = (a: Asset): number | null => {
    const b = recon.heroBaselineByAge[a.ageBucket];
    return b && b.n >= 2 && b.median > 0 ? a.views / b.median : null;
  };

  const events: TimelineEvent[] = inWindow.map(a => {
    const daysFromNow = Math.round((new Date(a.publishedAt).getTime() - now) / DAY);
    return {
      date: a.publishedAt.slice(0, 10),
      daysFromNow,
      horizon: horizonOf(daysFromNow),
      kind: kindOfFormat(a.format, a.isShort),
      title: a.title,
      status: 'happened',
      /* Publish date and ordering are architecture; the view count next to
         it is a current reading. Both labels appear so the Coach cannot
         quietly treat a lifetime figure as a trend. */
      evidenceClass: 'RETROSPECTIVE_ARCHITECTURE',
      videoId: a.videoId,
      currentViews: a.views,
      vsOwnBaseline: a.isHero ? baselineFor(a) : null,
    };
  });

  /* Forward events. */
  let horizonKnown = false;
  const horizonBits: string[] = [];

  if (artist.nextMomentDate) {
    const d = new Date(artist.nextMomentDate).getTime();
    const daysFromNow = Math.round((d - now) / DAY);
    if (daysFromNow >= 0) {
      horizonKnown = true;
      horizonBits.push('artist.nextMomentDate');
      events.push({
        date: artist.nextMomentDate.slice(0, 10),
        daysFromNow, horizon: horizonOf(daysFromNow),
        kind: 'planned_asset',
        title: artist.nextMomentLabel ?? 'Planned moment',
        status: 'planned',
        evidenceClass: 'PLANNED_UNVERIFIED',
      });
    } else {
      dataNotes.push(`artist.nextMomentDate (${artist.nextMomentDate}) is in the past — the forward plan on the artist record is stale.`);
    }
  }

  for (const p of opts.plannedFromPlan ?? []) {
    const daysFromNow = Math.round((new Date(p.date).getTime() - now) / DAY);
    if (daysFromNow < 0) continue;
    horizonKnown = true;
    if (!horizonBits.includes('coach plan')) horizonBits.push('coach plan');
    events.push({
      date: p.date.slice(0, 10),
      daysFromNow, horizon: horizonOf(daysFromNow),
      kind: 'planned_asset', title: p.label,
      status: 'planned', evidenceClass: 'PLANNED_UNVERIFIED',
    });
  }

  if (!horizonKnown) {
    dataNotes.push(
      'NO FORWARD VISIBILITY. Nothing in Watcher shows an upcoming release for this artist. ' +
      'The live Coach plan is held in browser localStorage and is not readable server-side, so a plan may exist that this system cannot see. ' +
      'Do NOT issue an unqualified "publish now" recommendation on this basis — state the assumption and ask the team to confirm the release schedule.',
    );
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  /* Current hero and follow-up position. */
  const pastHeroes = events.filter(e => e.kind === 'omv' && e.status === 'happened');
  const currentHero = pastHeroes.length ? pastHeroes[pastHeroes.length - 1] : null;
  const daysSinceCurrentHero = currentHero ? Math.abs(currentHero.daysFromNow) : null;

  const longFormSinceHero = currentHero
    ? events.filter(e =>
        e.status === 'happened' && e.kind !== 'short' &&
        e.date > currentHero.date).length
    : 0;

  const inFollowUpWindow =
    daysSinceCurrentHero !== null && daysSinceCurrentHero >= 7 && daysSinceCurrentHero <= 14;

  const followUpWindow: CampaignTimeline['followUpWindow'] =
    daysSinceCurrentHero === null ? 'NO_HERO'
    : daysSinceCurrentHero < 7 ? 'NOT_YET_OPEN'
    : daysSinceCurrentHero <= 14 ? 'OPEN'
    : 'CLOSED';
  const daysUntilFollowUpWindow =
    followUpWindow === 'NOT_YET_OPEN' ? 7 - (daysSinceCurrentHero as number) : null;

  const planned = events.filter(e => e.status === 'planned' && e.daysFromNow >= 0)
    .sort((a, b) => a.daysFromNow - b.daysFromNow);
  const nextPlannedEvent = planned[0] ?? null;

  /* Hero-to-hero gaps inside the window. */
  const gaps: CampaignTimeline['gaps'] = [];
  for (let i = 0; i < pastHeroes.length - 1; i++) {
    const from = pastHeroes[i], to = pastHeroes[i + 1];
    const between = events.filter(e =>
      e.status === 'happened' && e.date > from.date && e.date < to.date);
    gaps.push({
      fromDate: from.date,
      days: Math.round((new Date(to.date).getTime() - new Date(from.date).getTime()) / DAY),
      longForm: between.filter(e => e.kind !== 'short').length,
      shorts: between.filter(e => e.kind === 'short').length,
    });
  }

  if (recon.capped) dataNotes.push('Catalogue fetch hit the API cap — earlier campaign history may be missing.');
  if (recon.heroes.length < 3) dataNotes.push(`Only ${recon.heroes.length} official music videos on this channel; baseline comparisons are weak.`);

  return {
    artistSlug: artist.slug,
    artistName: artist.name,
    campaignName: artist.campaign ?? null,
    campaignStartDate: startIso,
    campaignDay,
    phase: artist.phase ?? null,
    events,
    currentHero,
    daysSinceCurrentHero,
    inFollowUpWindow,
    followUpWindow,
    daysUntilFollowUpWindow,
    longFormSinceHero,
    horizonKnown,
    horizonSource: horizonBits.length ? horizonBits.join(' + ') : 'none',
    nextPlannedEvent,
    daysToNextPlanned: nextPlannedEvent?.daysFromNow ?? null,
    gaps,
    dataNotes,
  };
}
