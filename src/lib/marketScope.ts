/**
 * Market-scoped accessors.
 *
 * Every read that powers market-specific UI goes through this file. That is
 * the point: the alternative is every component remembering to filter, and
 * the one that forgets leaks another market's campaigns into a partner-facing
 * page. There is no filtering discipline to maintain if there is only one
 * place that filters.
 *
 * WHAT IS SCOPED AND WHAT IS NOT
 *
 * Scoped: artists, pins, plans, briefing caches. These describe a team's
 * work, and two teams working the same channel have different work.
 *
 * NOT scoped, deliberately: `live:{channelId}`, `snap:{channelId}`,
 * `vsnap:{videoId}`, `chanmap:{handle}`, `fmt:*`, `cm:*`, `quota:spend:*`.
 * These are observations of public YouTube objects. A channel has one
 * subscriber count regardless of who is working it, and partitioning them
 * would duplicate rows, double API quota, and let two markets hold different
 * beliefs about the same fact. If you find yourself wanting to scope one of
 * these, the thing you actually want is a market-scoped *view* over it.
 *
 * THE CRON IS THE EXCEPTION
 *
 * Data collection runs over the union of all markets — one pass, one quota
 * pool, one snapshot per channel. It calls the unscoped roster readers on
 * purpose. Do not "fix" that by scoping it, or a channel worked by two
 * markets gets fetched twice.
 */

import { ARTISTS, mergeArtistLists, type Artist } from './artists';
import { listCustomArtists } from './artistStore';
import { isInMarket, resolveMarket, DEFAULT_MARKET } from './market';

/* ── Roster ──────────────────────────────────────────────────────────── */

/**
 * The full roster across every market. Use this for data collection and for
 * anything that must not fetch a channel twice. For UI, use
 * `getArtistsForMarket` instead.
 */
export async function getAllArtists(): Promise<Artist[]> {
  const custom = await listCustomArtists();
  return mergeArtistLists(ARTISTS, custom);
}

/**
 * The roster a market works. Artists with no `markets` field are UK by
 * default (see `artistMarkets` in market.ts) — that default is what keeps
 * the existing UK experience intact without rewriting a single record.
 */
export async function getArtistsForMarket(marketId: string): Promise<Artist[]> {
  const all = await getAllArtists();
  return all.filter((a) => isInMarket(a, marketId));
}

/** Slug set for the market, for cheap membership tests in hot paths. */
export async function getArtistSlugsForMarket(marketId: string): Promise<Set<string>> {
  const roster = await getArtistsForMarket(marketId);
  return new Set(roster.map((a) => a.slug));
}

/* ── Campaigns (pins) ────────────────────────────────────────────────────

   Pins decide who appears on Priority Campaigns. They are the membership
   mechanism for the whole partner-facing view, which is why they must be
   scoped before anything else — an unscoped pin puts an Australian campaign
   on the UK's page and vice versa. */

export interface MarketCampaign {
  slug: string;
  pinnedAt: string;
  priority?: 'high' | 'normal';
}

/**
 * Campaigns pinned in this market, intersected with the market's roster.
 *
 * The intersection is belt and braces: the key is already market-scoped, so
 * a foreign pin should be impossible. But a pin is just a slug string, and
 * an artist can be removed from a market after being pinned, which would
 * otherwise leave a campaign on the page for an artist the team no longer
 * works. Cheap check, removes a whole class of bug.
 */
export async function getCampaignsForMarket(marketId: string): Promise<MarketCampaign[]> {
  const { listPinned } = await import('./campaignStore');
  const [pinned, slugs] = await Promise.all([
    listPinned(marketId),
    getArtistSlugsForMarket(marketId),
  ]);
  return pinned.filter((p) => slugs.has(p.slug));
}

export async function getPinnedSlugsForMarket(marketId: string): Promise<Set<string>> {
  const pins = await getCampaignsForMarket(marketId);
  return new Set(pins.map((p) => p.slug));
}

/* ── Plans ───────────────────────────────────────────────────────────── */

/**
 * Saved Coach plans belonging to a market.
 *
 * Plans carry an explicit `market` written at save time. Plans saved before
 * markets existed have none and default to UK, same rule as artists.
 *
 * Note the plan slug is NOT market-suffixed. That is deliberate: the
 * plan-to-artist matcher in the briefing route scores on slug shape, and
 * appending a market would silently change prefix and substring matches,
 * reassigning existing UK plans to the wrong artists. The market lives in a
 * field, not in the key.
 */
export async function getPlansForMarket(marketId: string) {
  const { listPlans } = await import('./planStore');
  const all = await listPlans();
  const m = resolveMarket(marketId).id;
  return all.filter((p) => (p.market ?? DEFAULT_MARKET) === m);
}

/* ── Upcoming moments ────────────────────────────────────────────────────

   The campaign calendar for a market: every dated event from every saved
   plan whose artist is pinned in that market. This is what Release Radar
   renders and what decides whether a campaign is in release week. */

export interface MarketMoment {
  /** Plan slug, for linking back into Coach. */
  planSlug: string;
  artist: string;
  campaignName: string;
  title: string;
  dateISO: string;
  kind: string;
  scale?: string;
  /** Days from today in the market's timezone. Negative = already happened. */
  daysFromNow: number;
}

export async function getUpcomingMomentsForMarket(
  marketId: string,
  opts: { withinDays?: number; includePastDays?: number } = {},
): Promise<MarketMoment[]> {
  const { withinDays = 35, includePastDays = 7 } = opts;
  const { marketToday } = await import('./market');

  const plans = await getPlansForMarket(marketId);
  if (plans.length === 0) return [];

  const { loadPlan } = await import('./planStore');
  const full = await Promise.all(plans.map((p) => loadPlan(p.slug)));

  // "Today" in the team's own timezone, not the server's. For Sydney this is
  // a different calendar day from London's for a good part of every day, and
  // a Release Radar that is a day out is worse than no Release Radar.
  const todayISO = marketToday(marketId);
  const todayMs = new Date(`${todayISO}T12:00:00Z`).getTime();

  const out: MarketMoment[] = [];
  for (const sp of full) {
    if (!sp?.plan?.events) continue;
    for (const e of sp.plan.events) {
      if (!e?.dateISO) continue;
      const ms = new Date(`${e.dateISO}T12:00:00Z`).getTime();
      if (Number.isNaN(ms)) continue;
      const days = Math.round((ms - todayMs) / 86400000);
      if (days < -includePastDays || days > withinDays) continue;
      out.push({
        planSlug: sp.slug,
        artist: sp.artist,
        campaignName: sp.campaignName,
        title: String(e.title ?? '').trim(),
        dateISO: e.dateISO,
        kind: String(e.kind ?? ''),
        scale: e.scale,
        daysFromNow: days,
      });
    }
  }
  return out.sort((a, b) => a.daysFromNow - b.daysFromNow);
}

/* ── Readiness ───────────────────────────────────────────────────────────

   A new market has no roster, no campaigns and no YouTube history. Every
   surface needs to tell the difference between "nothing qualified this week"
   and "you have not set this up yet", because they look identical in the
   data and need completely different copy. */

export type MarketStage = 'empty' | 'roster-only' | 'planning' | 'live';

export interface MarketReadiness {
  marketId: string;
  stage: MarketStage;
  artistCount: number;
  campaignCount: number;
  planCount: number;
  /** The single next action, phrased for the team. */
  nextStep: string;
}

export async function getMarketReadiness(marketId: string): Promise<MarketReadiness> {
  const m = resolveMarket(marketId);
  const [artists, campaigns, plans] = await Promise.all([
    getArtistsForMarket(m.id),
    getCampaignsForMarket(m.id),
    getPlansForMarket(m.id),
  ]);

  let stage: MarketStage = 'empty';
  let nextStep = 'Add your first artist to start building a roster.';

  if (artists.length > 0 && plans.length === 0) {
    stage = 'roster-only';
    nextStep = 'Add a campaign timeline in the Content Planner.';
  } else if (plans.length > 0 && campaigns.length === 0) {
    // Should be rare now that saving a plan auto-pins it, but a campaign can
    // be unpinned by hand, and silence here would be confusing.
    stage = 'planning';
    nextStep = 'Pin a campaign to put it on the weekly priority view.';
  } else if (campaigns.length > 0) {
    stage = 'live';
    nextStep = 'Keep campaign dates current — the weekly view builds itself from them.';
  }

  return {
    marketId: m.id,
    stage,
    artistCount: artists.length,
    campaignCount: campaigns.length,
    planCount: plans.length,
    nextStep,
  };
}
