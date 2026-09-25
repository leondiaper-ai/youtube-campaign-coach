/* ═══════════════════════════════════════════════════════════════════
   CHARTMETRIC — YOUTUBE TERRITORIES

   Written against the response Ezra Collective actually returned on
   25 September 2026, not against the OpenAPI document. The two differ
   in ways that matter, and the differences are recorded here because
   they are the reason this file is shaped the way it is.

   WHAT THE DOCS PROMISED AND THE API DID NOT DELIVER

     artistTotalViews      documented as a number. Returned null.
                           So there is no vendor-supplied denominator,
                           and any "share" we show has to be share of
                           the territories actually returned. Stated
                           on the module, not hidden.

     marketInsights        documented as competitor arrays. Returned
                           { marketCities: [], marketCountries: [] }.
                           Empty. No competitive read from this call.

     country .trend        documented as a 28-day series. Returned []
                           on every one of the 26 country rows. There
                           is no 28-day country trend to chart.

     city .trend           present, but 1–4 points, not 28, and spaced
                           irregularly (01, 11, 16, 21 Sep). Useful as
                           corroboration, not as a series.

   WHAT THE DOCS DID NOT MENTION AND WE RELY ON

     prev_value            an earlier reading of the same figure. This
                           is the only thing in the payload that makes
                           momentum computable at all, since the
                           country trend is empty.

     is_estimate           true on 11 of Ezra's 26 countries. Chartmetric
                           is modelling those, not measuring them. A
                           number we did not know was modelled would be
                           a number we would eventually quote wrongly.

     city_affinity         an index — London 3.66, Mexico City 0.47.
                           Undocumented, so its definition is a guess.
                           Carried through, deliberately unused.

     target_id             a Google Knowledge Graph MID, identical on
                           every row. This is entity-level data about
                           the artist across YouTube, which is the
                           evidence for the labelling rule below.

   THE DATE TRAP

   Every row carries timestp = the day you asked, not the day of the
   reading. Ezra's rows said 2026-09-25 while the newest city trend
   point was 2026-09-21, and each city's `value` equalled its 21 Sep
   trend point exactly. So the honest reporting date is derived from
   the trend, and only falls back to timestp when no trend exists.
   Same trick for the previous reading: prev_value is matched back
   against the trend to find the date it came from — 11 Sep for every
   Ezra city checked, a ten-day window, which is not the "previous
   trend point" (16 Sep) anyone would assume.

   THE LABELLING RULE — AND A CORRECTION

   The first version of this comment claimed the territory figures
   describe a wider artist entity than the owned channel, on the
   grounds that 1.42m territory views sat against a channel with
   28.6m views. That comparison was wrong, and wrong in the exact way
   this codebase has been burned before: it put a MONTHLY number next
   to a LIFETIME number and drew a conclusion from the gap.

   Checking Chartmetric's own artist page for 324003 settles it. They
   publish, for Ezra: YouTube subscribers 74.1k, total views 28.4m —
   both matching the Watcher's own snapshot of @ezracollective to the
   rounding — and monthly video views 1.9m. The 26 returned
   territories sum to 1.42m, which is 75% of that 1.9m. A top-26 slice
   of the same population, in other words, not a different population.

   So what can be said honestly: these are Chartmetric's YouTube
   monthly video views split by territory, and they are a DIFFERENT
   MEASUREMENT from the lifetime channel totals shown above them on
   the page — monthly not lifetime, vendor-modelled not YouTube API.
   What cannot be said: that they cover a different set of videos.
   Every row carries the same Google Knowledge Graph MID in
   target_id, which is entity-shaped, but entity-shaped is not proof
   of a wider population when the totals reconcile this cleanly.
   ═══════════════════════════════════════════════════════════════════ */

import { cmFetch } from './client';
import { resolveCmArtist, type CmArtistMapping } from './resolve';

export type TerritoryRow = {
  rank: number;
  name: string;
  /** ISO 3166-1 alpha-2. */
  code2: string | null;
  continent: string | null;
  /** Rolling monthly views at the reporting date. */
  monthlyViews: number;
  /** The earlier reading, when one exists and is non-zero. */
  previousViews: number | null;
  /** monthlyViews − previousViews. Null when there is nothing to compare. */
  changeViews: number | null;
  /** Percentage change. Null when previousViews is 0 or absent. */
  changePct: number | null;
  /** Chartmetric modelled this row rather than measuring it. */
  isEstimate: boolean;
  /** Share of the territories in THIS response — not of world views. */
  shareOfListed: number;
  /** Undocumented index. Carried, not displayed. */
  affinity: number | null;
  /** Biggest artist in this location, where Chartmetric fills it in. */
  marketLeader: string | null;
};

export type Territories = {
  ok: true;
  artist: { slug: string; name: string; channelId: string };
  chartmetric: { artistId: number; artistName: string | null };
  scope: 'chartmetric-youtube-monthly-views';
  /** Median growth across comparable territories — the pack, to beat. */
  medianChangePct: number | null;
  /** Date of the reading, derived from the trend where possible. */
  reportingDate: string | null;
  /** Date of the comparison reading, when it could be pinned down. */
  previousDate: string | null;
  /** How far apart those two readings are, in days. */
  windowDays: number | null;
  countries: TerritoryRow[];
  cities: TerritoryRow[];
  /** Sum of the returned countries. The only denominator available. */
  listedTotal: number;
  estimatedCount: number;
  fetchedAt: string;
};

export type TerritoriesResult =
  | Territories
  | { ok: false; reason: string; detail?: string };

/* Every numeric in this payload is typed number|string|null upstream.
   Ezra returned clean numbers throughout, but one artist is not a
   guarantee, so coerce the way youtube.ts already does. */
function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type RawTrendPoint = { timestp?: string | null; monthlyViews?: number | string | null };
type RawRow = {
  rank?: number | null;
  name?: string | null;
  code2?: string | null;
  continent?: string | null;
  value?: number | string | null;
  prev_value?: number | string | null;
  is_estimate?: boolean | null;
  city_affinity?: number | string | null;
  market_max_artist_name?: string | null;
  timestp?: string | null;
  trend?: RawTrendPoint[] | null;
};
type RawResponse = {
  obj?: {
    insights?: { cities?: RawRow[] | null; countries?: RawRow[] | null } | null;
    artistTotalViews?: number | string | null;
  } | null;
};

/** Newest trend date anywhere in the payload — the real reading date. */
function deriveReportingDate(rows: RawRow[]): string | null {
  let best: string | null = null;
  for (const r of rows) {
    for (const t of r.trend ?? []) {
      const d = t?.timestp ?? null;
      if (d && (!best || d > best)) best = d;
    }
  }
  return best;
}

/** Find the date prev_value came from by matching it in the trend. */
function derivePreviousDate(rows: RawRow[]): string | null {
  const votes = new Map<string, number>();
  for (const r of rows) {
    const prev = num(r.prev_value);
    if (prev == null || prev === 0) continue;
    for (const t of r.trend ?? []) {
      if (num(t?.monthlyViews) === prev && t?.timestp) {
        votes.set(t.timestp, (votes.get(t.timestp) ?? 0) + 1);
      }
    }
  }
  let best: string | null = null;
  let bestVotes = 0;
  votes.forEach((n, date) => {
    if (n > bestVotes) {
      best = date;
      bestVotes = n;
    }
  });
  // One coincidental match proves nothing. Require a real consensus.
  return bestVotes >= 3 ? best : null;
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

function normalizeRows(raw: RawRow[], listedTotal: number): TerritoryRow[] {
  return raw
    .map((r) => {
      const monthlyViews = num(r.value) ?? 0;
      const prev = num(r.prev_value);
      const previousViews = prev != null && prev > 0 ? prev : null;
      return {
        rank: num(r.rank) ?? 0,
        name: (r.name ?? '').trim() || '—',
        code2: r.code2?.trim() || null,
        continent: r.continent?.trim() || null,
        monthlyViews,
        previousViews,
        changeViews: previousViews != null ? monthlyViews - previousViews : null,
        changePct:
          previousViews != null ? ((monthlyViews - previousViews) / previousViews) * 100 : null,
        isEstimate: r.is_estimate === true,
        shareOfListed: listedTotal > 0 ? monthlyViews / listedTotal : 0,
        affinity: num(r.city_affinity),
        marketLeader: (r.market_max_artist_name ?? '').trim() || null,
      };
    })
    .filter((r) => r.monthlyViews > 0)
    .sort((a, b) => b.monthlyViews - a.monthlyViews);
}

/**
 * The whole chain for one artist: channel id → Chartmetric artist →
 * territories, normalized. Two Chartmetric requests cold, one warm
 * (resolution is cached in KV forever), zero when the caller's own
 * cache is fresh. Never throws.
 */
export async function fetchTerritories(
  artist: { slug: string; name: string },
  channelId: string,
): Promise<TerritoriesResult> {
  let mapping: CmArtistMapping | null;
  try {
    mapping = await resolveCmArtist(channelId);
  } catch {
    return { ok: false, reason: 'resolve-failed' };
  }

  if (!mapping) return { ok: false, reason: 'unavailable' };
  if (!mapping.cmArtistId) return { ok: false, reason: 'not-in-chartmetric' };

  const res = await cmFetch<RawResponse>(
    `/api/artist/${mapping.cmArtistId}/market-coverage-views/youtube`,
  );
  if (!res.ok) return { ok: false, reason: 'fetch-failed', detail: res.reason };

  const insights = res.data?.obj?.insights;
  const rawCountries = insights?.countries ?? [];
  const rawCities = insights?.cities ?? [];
  if (rawCountries.length === 0 && rawCities.length === 0) {
    return { ok: false, reason: 'no-territory-data' };
  }

  const listedTotal = rawCountries.reduce((s, r) => s + (num(r.value) ?? 0), 0);

  /* Reporting dates come from the city trends, because the country
     trends are empty — but they describe the same snapshot. */
  const allRows = [...rawCountries, ...rawCities];
  const reportingDate =
    deriveReportingDate(allRows) ?? rawCountries[0]?.timestp ?? rawCities[0]?.timestp ?? null;
  const previousDate = derivePreviousDate(allRows);

  const countries = normalizeRows(rawCountries, listedTotal);

  /* The pack. Ezra's territories nearly all roughly doubled in this
     window, so "+119%" means nothing on its own — the question a
     campaign person actually has is which markets beat the artist's
     own overall lift. That needs a baseline, and the median of the
     comparable territories is it. */
  const growths = countries
    .map((c) => c.changePct)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);
  const medianChangePct =
    growths.length === 0
      ? null
      : growths.length % 2
        ? growths[(growths.length - 1) / 2]
        : (growths[growths.length / 2 - 1] + growths[growths.length / 2]) / 2;

  return {
    ok: true,
    artist: { slug: artist.slug, name: artist.name, channelId },
    chartmetric: { artistId: mapping.cmArtistId, artistName: mapping.cmArtistName },
    scope: 'chartmetric-youtube-monthly-views',
    medianChangePct,
    reportingDate,
    previousDate,
    windowDays: daysBetween(reportingDate, previousDate),
    countries,
    cities: normalizeRows(rawCities, listedTotal),
    listedTotal,
    estimatedCount: countries.filter((c) => c.isEstimate).length,
    fetchedAt: new Date().toISOString(),
  };
}
