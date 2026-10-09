/* ═══════════════════════════════════════════════════════════════════
   MARKETS AND TEAMS

   One Watcher, many markets. Adding a market or a team is an edit to
   this file and nothing else — no new route, no forked dashboard, no
   copy of the UK implementation.

   THREE DIMENSIONS, KEPT SEPARATE ON PURPOSE

     1. MARKET     a country we report audience for (GB, AU, SE …).
     2. TEAM       a group of people who own a roster (UK, AU, Nordics).
     3. ARTIST     signed somewhere, watched everywhere.

   These are not the same thing and collapsing them produces wrong
   answers. An Australian signing can take most of its viewing from the
   UK and US; a UK artist can break in Sweden. So a team's view is
   "our roster, across whichever markets we ask about" — the roster
   decides the rows and the market decides the column, and neither
   determines the other.

   SOURCE AND ITS LIMITS

   Territory figures come from Chartmetric market-coverage-views, the
   same source the UK dashboard already uses: artist-level YouTube
   MONTHLY VIEWS by country. That means:

     - no watch time          (YouTube Analytics only)
     - no Shorts/long-form split by territory   (needs both APIs)
     - no owned-channel audience demographics   (Analytics only)

   Those require per-channel OAuth we do not hold. `source` is carried
   on every reading so a market can later be served by YouTube
   Analytics for channels that do authorise, without a rewrite and
   without silently mixing two different metrics in one column.
   ═══════════════════════════════════════════════════════════════════ */

export type TerritorySource = 'chartmetric' | 'youtube-analytics';

export type Market = {
  /** ISO 3166-1 alpha-2, matching Chartmetric's code2. */
  code: string;
  /** Name as a person would say it. */
  name: string;
  /** Short label for dense table headers. */
  short: string;
};

/** Markets we can report on. Chartmetric returns all countries, so
 *  adding one here is enough — no pipeline change. */
export const MARKETS: Record<string, Market> = {
  GB: { code: 'GB', name: 'United Kingdom', short: 'UK' },
  AU: { code: 'AU', name: 'Australia', short: 'AU' },
  NZ: { code: 'NZ', name: 'New Zealand', short: 'NZ' },
  SE: { code: 'SE', name: 'Sweden', short: 'SE' },
  NO: { code: 'NO', name: 'Norway', short: 'NO' },
  DK: { code: 'DK', name: 'Denmark', short: 'DK' },
  FI: { code: 'FI', name: 'Finland', short: 'FI' },
  IS: { code: 'IS', name: 'Iceland', short: 'IS' },
  US: { code: 'US', name: 'United States', short: 'US' },
  IE: { code: 'IE', name: 'Ireland', short: 'IE' },
  CA: { code: 'CA', name: 'Canada', short: 'CA' },
  DE: { code: 'DE', name: 'Germany', short: 'DE' },
  FR: { code: 'FR', name: 'France', short: 'FR' },
  NL: { code: 'NL', name: 'Netherlands', short: 'NL' },
  IT: { code: 'IT', name: 'Italy', short: 'IT' },
  ES: { code: 'ES', name: 'Spain', short: 'ES' },
  PL: { code: 'PL', name: 'Poland', short: 'PL' },
  BR: { code: 'BR', name: 'Brazil', short: 'BR' },
  MX: { code: 'MX', name: 'Mexico', short: 'MX' },
  AR: { code: 'AR', name: 'Argentina', short: 'AR' },
  CO: { code: 'CO', name: 'Colombia', short: 'CO' },
  CL: { code: 'CL', name: 'Chile', short: 'CL' },
};

export type Team = {
  id: string;
  name: string;
  /**
   * Markets this team reports on, in display order. The FIRST is the
   * team's home market and drives default sorting.
   */
  markets: string[];
  /**
   * How the team's roster is decided. `ownership` matches the artist
   * record's territory/label field; `slugs` is an explicit list.
   * Explicit lists win where they exist — a team often watches artists
   * it does not own.
   */
  roster: { ownership?: string[]; slugs?: string[] };
  /** Shown on the dashboard so the scope is never ambiguous. */
  description: string;
};

export const TEAMS: Record<string, Team> = {
  uk: {
    id: 'uk',
    name: 'UK',
    markets: ['GB', 'IE'],
    roster: { ownership: ['uk', 'virgin'] },
    description: 'Virgin UK roster and UK YouTube audience.',
  },
  au: {
    id: 'au',
    name: 'Australia',
    markets: ['AU', 'NZ'],
    roster: { ownership: ['au', 'australia'] },
    description: 'Australian roster and Australian YouTube audience.',
  },
  nordics: {
    id: 'nordics',
    name: 'Nordics',
    /* Sweden first: largest Nordic YouTube market, so it anchors the
       default sort. Iceland is included because the cost of carrying
       it is one row and its absence is noticed. */
    markets: ['SE', 'NO', 'DK', 'FI', 'IS'],
    roster: { ownership: ['nordics', 'se', 'no', 'dk', 'fi'] },
    description: 'Nordic roster and Swedish, Norwegian, Danish, Finnish and Icelandic YouTube audience.',
  },
  us: {
    id: 'us',
    name: 'US',
    markets: ['US', 'CA'],
    roster: { ownership: ['us', 'usa'] },
    description: 'US roster and US and Canadian YouTube audience.',
  },
  eu: {
    id: 'eu',
    name: 'EU',
    /* Germany first: largest European market after the UK, so it anchors
       the default sort. This is continental Europe — the UK and Ireland
       are the UK team's, and the Nordics are their own. */
    markets: ['DE', 'FR', 'NL', 'IT', 'ES', 'PL'],
    roster: { ownership: ['eu', 'de', 'fr', 'nl', 'it', 'es', 'pl'] },
    description: 'Continental European roster and German, French, Dutch, Italian, Spanish and Polish YouTube audience.',
  },
  latam: {
    id: 'latam',
    name: 'LATAM',
    /* Brazil first: largest Latin American music market, and the one
       that moves a regional YouTube number most. */
    markets: ['BR', 'MX', 'AR', 'CO', 'CL'],
    roster: { ownership: ['latam', 'br', 'mx', 'ar', 'co', 'cl'] },
    description: 'Latin American roster and Brazilian, Mexican, Argentine, Colombian and Chilean YouTube audience.',
  },
};

export const getTeam = (id: string): Team | null => TEAMS[id.toLowerCase()] ?? null;
export const getMarket = (code: string): Market | null =>
  MARKETS[code.toUpperCase()] ?? null;

/** Markets any team reports on — the set worth fetching per artist. */
export const ALL_TEAM_MARKETS: string[] = Array.from(
  new Set(Object.values(TEAMS).flatMap((t) => t.markets)),
);

/**
 * Metrics a source can actually deliver. The UI reads this rather than
 * assuming, so an unavailable metric renders as "not authorised"
 * instead of zero.
 */
export const SOURCE_CAPABILITIES: Record<TerritorySource, {
  monthlyViews: boolean;
  watchTime: boolean;
  formatSplit: boolean;
  demographics: boolean;
  label: string;
}> = {
  chartmetric: {
    monthlyViews: true,
    watchTime: false,
    formatSplit: false,
    demographics: false,
    label: 'Chartmetric artist-level YouTube audience',
  },
  'youtube-analytics': {
    monthlyViews: true,
    watchTime: true,
    formatSplit: true,
    demographics: true,
    label: 'YouTube Analytics (channel-authorised)',
  },
};
