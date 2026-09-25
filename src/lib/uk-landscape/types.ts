/* ═══════════════════════════════════════════════════════════════════
   UK LANDSCAPE — TYPES

   Three independent inputs, never blended, each with its own clock:

     A · VMG UK CONSUMPTION   first-party repertoire consumption
                              through VMG reporting. Weekly.
     B · WATCHER CHANNEL      the owned channel, GLOBAL. Daily cron.
     C · CHARTMETRIC UK       artist-level UK audience. On demand.

   A row can be missing any of them and still be a legitimate row. The
   whole point of the page is that the three measures disagree, so
   nothing here computes a combined score and nothing substitutes one
   measure for another when a value is absent.
   ═══════════════════════════════════════════════════════════════════ */

/** One track inside a consumption period. */
export type ConsumptionTrack = {
  track: string;
  isrc: string | null;
  consumption: number;
};

/** One reported artist string inside a consumption period. */
export type ConsumptionArtist = {
  /** Exactly as VMG reports it. Collaborations stay whole. */
  artist: string;
  rank: number;
  consumption: number;
  isCollab: boolean;
  /** Watcher artist this string was strictly matched to, if any. */
  watcherSlug: string | null;
  /** Top tracks by consumption. TRACKS, not YouTube videos. */
  tracks: ConsumptionTrack[];
};

/**
 * A reporting period. Periods are never overwritten — a new weekly file
 * creates or replaces one period by id, and the others stay put, so
 * week-on-week comparison stays possible later.
 */
export type ConsumptionPeriod = {
  periodId: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  source: string;
  totalConsumption: number;
  artists: ConsumptionArtist[];
  ingestedAt?: string;
  /** Distinct source reports this period was assembled from. */
  sourceReports?: string[];
};

/** Where an artist sits relative to the public rankings. */
export type Classification = 'INCLUDE' | 'CHECK' | 'EXCLUDE';

export type LandscapeRow = {
  slug: string | null;
  artist: string;
  classification: Classification | null;

  /* Channel identity, from the Watcher mapping only. Never constructed
     from an artist name — a guessed handle is a wrong link. A
     consumption string with no confirmed Watcher match keeps both
     fields null and stays in the ranking. */
  channelId: string | null;
  /** '@handle' where Watcher holds one. Null when it only has a UC id. */
  youtubeHandle: string | null;
  /** Canonical URL: /@handle if we have one, else /channel/UC…. */
  youtubeChannelUrl: string | null;

  // A — consumption
  consumption: number | null;
  consumptionRank: number | null;
  isCollab: boolean;
  tracks: ConsumptionTrack[];

  // B — Watcher channel. GLOBAL, never UK.
  subscribers: number | null;
  lifetimeViews: number | null;

  // C — Chartmetric UK
  ukMonthlyViews: number | null;
  ukTerritoryRank: number | null;
  ukReadingDate: string | null;
};

export type Freshness = {
  /** First date covered by the current consumption period. */
  consumptionFrom: string | null;
  consumptionThrough: string | null;
  watcherUpdated: string | null;
  chartmetricUpdated: string | null;
};

export type Landscape = {
  freshness: Freshness;
  period: { id: string; label: string };
  /** TAB 1 — every reported artist string, as VMG ranks them. */
  consumption: LandscapeRow[];
  /** TAB 2 — consumption > 0 AND usable UK audience data. */
  crossover: LandscapeRow[];
  /** TAB 3 — cleaned Virgin universe by UK monthly views. */
  biggestUk: LandscapeRow[];
};
