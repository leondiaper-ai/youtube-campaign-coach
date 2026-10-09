/**
 * Markets — the workspace a team works in.
 *
 * WHY THIS FILE EXISTS
 *
 * Before this, "which team is this for" was answered in three incompatible
 * places: `teams.ts` (share tokens for the read-only boards),
 * `territories/markets.ts` (Chartmetric country codes), and a free-text
 * `regionTag` on team-watcher rows that nothing ever filtered on. None of
 * them reached the artist record, so every roster read was global.
 *
 * This file is the single answer. `teams.ts` and `territories/markets.ts`
 * still exist and still work — they describe share links and Chartmetric
 * territories respectively, which are genuinely different concerns — but
 * the question "whose workspace is this" is answered here and nowhere else.
 *
 * THE KEY DESIGN DECISION: LEGACY KEYS
 *
 * The UK has months of live data under unsuffixed KV keys (`artists:custom`,
 * `campaigns:pinned`, `plans:index`). Renaming those would mean a destructive
 * migration of working data to introduce a feature the UK did not ask for.
 *
 * So UK keeps the bare key and every other market gets a suffix:
 *
 *     marketKey('campaigns:pinned', 'uk') === 'campaigns:pinned'
 *     marketKey('campaigns:pinned', 'au') === 'campaigns:pinned:au'
 *
 * Nothing about UK storage changes. Australia starts empty by construction
 * rather than by filtering, which is the stronger guarantee — there is no
 * query that could accidentally return UK rows to Australia, because the UK
 * rows are not in the keyspace Australia reads.
 *
 * This is the same trick `teamWatcherStore` already plays for Nordics, and
 * it has the same trap: code that enumerates `campaigns:pinned:*` will miss
 * the UK. Enumerate MARKET_IDS and call marketKey(), never the keyspace.
 *
 * ADDING A MARKET
 *
 * Add an entry to MARKETS below. That is the whole job — the accessors in
 * marketScope.ts, the switcher, the Coach, the Priority page and the empty
 * states all read from this record. Do not set `legacyKeys` on a new market;
 * it exists only to grandfather the UK.
 */

import type { Artist } from './artists';

export interface MarketDef {
  id: string;
  /** Full name, as someone would say it out loud. */
  name: string;
  /** Short label for dense UI — nav, chips, table headers. */
  short: string;
  /** How the team refers to itself in page furniture. */
  orgName: string;
  /**
   * Chartmetric / territory codes this market reports on, home market first.
   * Mirrors `territories/markets.ts`, which stays the authority on what
   * Chartmetric will return for each code.
   */
  territories: string[];
  /**
   * IANA timezone. This decides what "this week" and "today" mean for the
   * team, which is not cosmetic: a week boundary computed in London is a day
   * out for Australia for the first ten hours of every local day.
   */
  timeZone: string;
  /** Locale for dates and number grouping. */
  locale: string;
  /**
   * Currency for value modelling. Note the RPM constants in valueModel.ts are
   * themselves UK-derived, so a non-GBP market gets its figures suppressed
   * rather than converted — a wrong number in the right currency is worse
   * than no number.
   */
  currency: { code: string; symbol: string };
  /** True only for the UK. See the legacy-keys note at the top of this file. */
  legacyKeys?: boolean;
  /**
   * The team board in `teams.ts` that belongs to this market, if any.
   *
   * This is the bridge between two things that were built separately: the
   * token-gated team boards (which already hold Australia's 14 artists) and
   * the market roster. Rather than migrating one into the other, an artist on
   * the market's board simply counts as being in that market — so the board a
   * team has already filled in becomes their roster with no data move and no
   * chance of the two drifting apart.
   *
   * The UK has no board: it predates them and its roster is the default.
   */
  teamSlug?: string;
}

export const MARKETS: Record<string, MarketDef> = {
  uk: {
    id: 'uk',
    name: 'United Kingdom',
    short: 'UK',
    orgName: 'Virgin Music UK',
    territories: ['GB', 'IE'],
    timeZone: 'Europe/London',
    locale: 'en-GB',
    currency: { code: 'GBP', symbol: '£' },
    legacyKeys: true,
  },
  au: {
    id: 'au',
    name: 'Australia',
    short: 'AU',
    orgName: 'Virgin Music Australia',
    territories: ['AU', 'NZ'],
    teamSlug: 'australia',
    timeZone: 'Australia/Sydney',
    locale: 'en-AU',
    currency: { code: 'AUD', symbol: '$' },
  },
  nordics: {
    id: 'nordics',
    name: 'Nordics',
    short: 'Nordics',
    orgName: 'Virgin Music Nordics',
    /* Sweden first — largest Nordic YouTube market, so it anchors the
       default sort. Mirrors the `nordics` group in territories/markets.ts,
       which stays the authority on what Chartmetric returns per code. */
    territories: ['SE', 'NO', 'DK', 'FI', 'IS'],
    teamSlug: 'nordics',
    /* Stockholm. The five countries span two offsets — Iceland sits on UTC
       — but a week boundary has to be decided somewhere, and the largest
       market is the least surprising place to decide it. */
    timeZone: 'Europe/Stockholm',
    /* The board is worked in English and sits beside the UK one, so dates
       match rather than switching format per region. */
    locale: 'en-GB',
    /* No single Nordic currency: SEK, NOK, DKK, EUR and ISK across five
       countries. EUR is the regional reporting unit. This only decides
       formatting and the non-GBP suppression above — the RPM constants are
       UK-derived, so value figures are withheld here rather than converted. */
    currency: { code: 'EUR', symbol: '€' },
  },
  us: {
    id: 'us',
    name: 'United States',
    short: 'US',
    orgName: 'Virgin Music US',
    territories: ['US', 'CA'],
    teamSlug: 'us',
    /* New York. The US spans six offsets, so a week boundary is a choice
       either way; east coast is where the label day starts. */
    timeZone: 'America/New_York',
    locale: 'en-US',
    currency: { code: 'USD', symbol: '$' },
  },
  eu: {
    id: 'eu',
    name: 'Europe',
    short: 'EU',
    orgName: 'Virgin Music EU',
    /* Continental Europe. The UK and Ireland belong to the UK workspace
       and the Nordics to theirs, so this is deliberately the rest —
       Germany first as the largest of them. Which countries count as
       "EU" here is a commercial decision, not a technical one; change
       this list and the mirror in territories/markets.ts together. */
    territories: ['DE', 'FR', 'NL', 'IT', 'ES', 'PL'],
    teamSlug: 'eu',
    timeZone: 'Europe/Berlin',
    /* Worked in English alongside the other boards, so dates match
       rather than switching format per region. */
    locale: 'en-GB',
    currency: { code: 'EUR', symbol: '€' },
  },
  latam: {
    id: 'latam',
    name: 'Latin America',
    short: 'LATAM',
    orgName: 'Virgin Music LATAM',
    /* Brazil first — the largest Latin American music market, and the
       one that moves a regional YouTube number most. */
    territories: ['BR', 'MX', 'AR', 'CO', 'CL'],
    teamSlug: 'latam',
    /* São Paulo, for the same reason. The region spans four offsets, so
       the week has to start somewhere and the biggest market is the
       least surprising place. */
    timeZone: 'America/Sao_Paulo',
    locale: 'en-GB',
    /* No single currency across five countries, and Argentine inflation
       makes any local unit a moving target. USD is the regional
       reporting unit. As elsewhere, the RPM constants are UK-derived so
       value figures are withheld here rather than converted. */
    currency: { code: 'USD', symbol: '$' },
  },
};

export const MARKET_IDS = Object.keys(MARKETS);
export const DEFAULT_MARKET = 'uk';

/**
 * The query param that selects a market. The only mechanism — there was a
 * cookie and a dropdown; both are gone, because the org line on each page
 * already names the workspace and a preference nobody can see or change is
 * worse than none.
 */
export const MARKET_PARAM = 'market';

export function getMarket(id: string | null | undefined): MarketDef | null {
  if (!id) return null;
  return MARKETS[String(id).toLowerCase()] ?? null;
}

/**
 * Always returns a market. An unknown id falls back to the default rather
 * than throwing, because an unrecognised `?market=` in a pasted URL should
 * show the UK page, not a 500.
 */
export function resolveMarket(id?: string | null): MarketDef {
  return getMarket(id) ?? MARKETS[DEFAULT_MARKET];
}

export function isKnownMarket(id: string | null | undefined): boolean {
  return getMarket(id) !== null;
}

/**
 * Scope a KV key to a market. The UK keeps the bare key — see the top of
 * this file for why that matters.
 */
export function marketKey(base: string, marketId: string): string {
  const m = resolveMarket(marketId);
  return m.legacyKeys ? base : `${base}:${m.id}`;
}

/**
 * Which markets an artist belongs to.
 *
 * An artist can be worked by more than one team — a global act signed in the
 * UK may be actively campaigned in Australia, with its own timeline, its own
 * pins and its own moments. So this is a list, not a single value.
 *
 * Records written before markets existed have no `markets` field. They are
 * UK by definition: the UK is the only team that has been using the system.
 * This default is what makes the migration non-destructive — nothing has to
 * be rewritten for the UK to keep working exactly as it did.
 */
export function artistMarkets(a: Pick<Artist, 'markets'>): string[] {
  const raw = a.markets;
  if (!Array.isArray(raw) || raw.length === 0) return [DEFAULT_MARKET];
  const seen = raw
    .map((m) => String(m).toLowerCase())
    .filter((m) => isKnownMarket(m));
  return seen.length > 0 ? Array.from(new Set(seen)) : [DEFAULT_MARKET];
}

export function isInMarket(a: Pick<Artist, 'markets'>, marketId: string): boolean {
  return artistMarkets(a).includes(resolveMarket(marketId).id);
}

/** Add a market to an artist without dropping the ones already there. */
export function withMarket<T extends { markets?: string[] }>(a: T, marketId: string): T {
  const m = resolveMarket(marketId).id;
  const current = artistMarkets(a as Pick<Artist, 'markets'>);
  return current.includes(m) ? { ...a, markets: current } : { ...a, markets: [...current, m] };
}

/* ── Market-aware time ───────────────────────────────────────────────────
   "This week" is a different week in Sydney and London for part of every
   day. These helpers take the market's timezone so a team's weekly view
   starts on their Monday, not ours. */

/** The calendar date in a market's own timezone, as yyyy-mm-dd. */
export function marketToday(marketId: string, now: Date = new Date()): string {
  const m = resolveMarket(marketId);
  // en-CA gives yyyy-mm-dd directly, which is why it is used here rather
  // than the market's own locale — this is a key, not display text.
  return new Intl.DateTimeFormat('en-CA', { timeZone: m.timeZone }).format(now);
}

/** ISO week id (2026-W41) computed in the market's own timezone. */
export function marketWeekId(marketId: string, now: Date = new Date()): string {
  const ymd = marketToday(marketId, now);
  const [y, mo, d] = ymd.split('-').map(Number);
  // Build in UTC from the market's calendar date so the arithmetic below is
  // not re-shifted by the server's own timezone.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // move to the week's Thursday
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday of the current week, in the market's timezone, as yyyy-mm-dd. */
export function marketWeekStart(marketId: string, now: Date = new Date()): string {
  const ymd = marketToday(marketId, now);
  const [y, mo, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt.toISOString().slice(0, 10);
}

/** Format a date for a market's readers. Pass ISO or a Date. */
export function formatMarketDate(
  value: string | Date,
  marketId: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  const m = resolveMarket(marketId);
  const d = typeof value === 'string'
    // 'T12:00:00Z' rather than midnight: a bare date parsed at midnight lands
    // on the previous day for any timezone behind UTC, and on the next day
    // for Sydney. Midday is safe in both directions.
    ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
    : value;
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  return new Intl.DateTimeFormat(m.locale, { ...opts, timeZone: m.timeZone }).format(d);
}
