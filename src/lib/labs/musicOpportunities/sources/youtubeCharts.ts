/* ═══════════════════════════════════════════════════════════════════════
   SOURCE — YOUTUBE CHARTS (charts.youtube.com)

   What was established on 23 Oct 2026:

   - charts.youtube.com is a browser application. There is no documented
     public API for it, and the Data API's `chart=mostPopular` is a
     different product (YouTube's most-popular list, no stated measure),
     so it is not used here as a substitute.
   - Each chart page offers a Download (CSV) control for a person, and
     dated pages exist at /charts/<Chart>/<region>/weekly/<YYYYMMDD>.
   - The rendered page carries, per row: rank, previous position, the
     chart's own count (views for song and video charts; nothing for the
     Shorts chart, which ranks Shorts created), periods on chart, release
     date and the video the row links to. Reading those rows from the
     page in a browser yields the same fields as the CSV export.

   The readings committed under ./seed/charts were read that way, in the
   Claude browser pane, with a per-reading checksum verified after the
   copy. They are labelled with that provenance. Automated server-side
   collection is NOT set up: the preview has no browser, and fetching the
   site's internal endpoints would be an undocumented dependency. New
   readings arrive by the same route or by pasting a chart export.

   Chart definitions (support.google.com/youtubemusic/answer/9014376):
     Top Songs            views across a song's official versions, weekly
     Top Music Videos     views of the video itself, weekly (daily exists)
     Top Songs on Shorts  number of Shorts created with the song, weekly (daily exists)
   ═══════════════════════════════════════════════════════════════════════ */

import type { ChartEntry, ChartMeasure, ChartObservation } from '../types';
import { splitCredit } from '../classify';

import gbSongs1015 from '../seed/charts/TopSongs-gb-20261015.json';
import gbSongs1008 from '../seed/charts/TopSongs-gb-20261008.json';
import gbSongs1001 from '../seed/charts/TopSongs-gb-20261001.json';
import gbVideos1015 from '../seed/charts/TopVideos-gb-20261015.json';
import gbVideos1008 from '../seed/charts/TopVideos-gb-20261008.json';
import gbShorts1015 from '../seed/charts/TopShortsSongs-gb-20261015.json';
import gbShorts1008 from '../seed/charts/TopShortsSongs-gb-20261008.json';
import usSongs1015 from '../seed/charts/TopSongs-us-20261015.json';
import usSongs1008 from '../seed/charts/TopSongs-us-20261008.json';
import mxSongs1015 from '../seed/charts/TopSongs-mx-20261015.json';

type SeedRow = [number, number, number, number, string, string, string, string];
type Seed = { meta: { chart: string; region: string; chartEndDate: string; range: string | null; regionName: string; collectedAt: string; href: string; n: number }; rows: SeedRow[] };

const SEEDS: Seed[] = [gbSongs1015, gbSongs1008, gbSongs1001, gbVideos1015, gbVideos1008, gbShorts1015, gbShorts1008, usSongs1015, usSongs1008, mxSongs1015] as unknown as Seed[];

export const CHART_TYPES: Record<string, { measure: ChartMeasure; label: string; measureName: string; rows: number }> = {
  TopSongs: { measure: 'song-views-weekly', label: 'Top Songs (weekly)', measureName: 'views across the song’s official versions', rows: 100 },
  TopVideos: { measure: 'music-video-views-weekly', label: 'Top Music Videos (weekly)', measureName: 'views of the video', rows: 100 },
  TopShortsSongs: { measure: 'shorts-creations-weekly', label: 'Top Songs on Shorts (weekly)', measureName: 'Shorts created with the song (count not published)', rows: 50 },
};

/** The dated page a person can open for any chart, region and chart-end date. */
export function chartPageUrl(chart: keyof typeof CHART_TYPES, region: string, chartEndDate?: string) {
  return `https://charts.youtube.com/charts/${chart}/${region.toLowerCase()}/weekly${chartEndDate ? `/${chartEndDate.replace(/-/g, '')}` : ''}`;
}

const isoDate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

function toObservation(seed: Seed): ChartObservation {
  const def = CHART_TYPES[seed.meta.chart];
  if (!def) throw new Error(`Unknown chart type in seed: ${seed.meta.chart}`);
  const territory = seed.meta.region.toUpperCase();
  const period = isoDate(seed.meta.chartEndDate);
  const isShorts = def.measure.startsWith('shorts');
  const entries: ChartEntry[] = seed.rows.map(([rank, prev, value, periods, title, artists, release, videoId]) => ({
    rank, previousRank: prev > 0 ? prev : null,
    /* The page shows "New" for periodsOnChart === 1 with no previous position. A
       previous position of 0 with periodsOnChart > 1 is a re-entry (off the
       chart last period), which is NOT new; both are previousRank null. */
    isNew: prev === 0 ? periods === 1 : false,
    periodsOnChart: periods > 0 ? periods : null,
    title: title.trim(), artists: splitCredit(artists),
    isrc: null, videoId: videoId || null, channelId: null, channelTitle: null,
    /* The Shorts chart publishes no count; a 0 there means "not published", never zero. */
    measureValue: isShorts ? null : value > 0 ? value : null,
    releaseDate: release && /^\d{4}-\d{2}-\d{2}$/.test(release) && !release.endsWith('-00') ? release : (release && /^\d{4}/.test(release) && !release.startsWith('0') ? release.slice(0, 4) : null),
  }));
  return {
    id: `youtube-charts-page|${def.measure}|${territory}|${period}`,
    source: 'youtube-charts-page', measure: def.measure, territory, period,
    periodLabel: seed.meta.range ?? period,
    sourceUrl: seed.meta.href, collectedAt: seed.meta.collectedAt,
    note: `${def.label} · ${seed.meta.regionName} · read from the chart page in the Claude browser pane; row checksum verified after copy.`,
    entries,
  };
}

let cache: ChartObservation[] | null = null;
/** Every committed reading, as observations. Pure; computed once per process. */
export function seedObservations(): ChartObservation[] {
  if (!cache) cache = SEEDS.map(toObservation);
  return cache;
}

/** Charts and territories for which the sandbox currently has readings, plus the ones it suggests opening next. */
export function coverageSummary(observations: ChartObservation[]) {
  const series = new Map<string, { measure: ChartMeasure; territory: string; periods: string[] }>();
  for (const o of observations) {
    const k = `${o.measure}|${o.territory}`;
    const s = series.get(k) ?? { measure: o.measure, territory: o.territory, periods: [] };
    if (!s.periods.includes(o.period)) s.periods.push(o.period);
    series.set(k, s);
  }
  return Array.from(series.values()).map(s => ({ ...s, periods: s.periods.sort() }));
}

/** Stored readings win over committed seeds for the same series and period (a person may have re-imported a corrected chart). */
export function mergeObservations(seeds: ChartObservation[], stored: ChartObservation[]): ChartObservation[] {
  const byId = new Map<string, ChartObservation>();
  for (const o of seeds) byId.set(o.id, o);
  for (const o of stored) byId.set(o.id, o);
  return Array.from(byId.values()).sort((a, b) => a.period.localeCompare(b.period));
}
