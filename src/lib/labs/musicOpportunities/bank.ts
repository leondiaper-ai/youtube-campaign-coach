/* ═══════════════════════════════════════════════════════════════════════
   THE RESEARCH BANK

   Built from every stored reading on request (a thousand rows is cheap).
   Four kinds of record are kept apart because they answer different
   questions:

     song        the composition as a chart ranks it (Top Songs, Shorts)
     video       a specific YouTube video, from video charts only
     appearance  one row of one reading
     linked video  the video a SONG chart row points at — kept on the
                   song as a hint about which upload carried it, never
                   treated as evidence that a video format performed

   Persistence is measured inside one series (source, chart, territory)
   as distinct chart periods; breadth is the count of territories and
   measures, reported separately and never added to persistence.
   ═══════════════════════════════════════════════════════════════════════ */

import { classifyChartRow, humanLabelsFor, normArtist, splitCredit } from './classify';
import { normalise } from './match';
import type { Appearance, ChartEntry, ChartMeasure, ChartObservation, ChartSource, HumanLabel, Persistence, SongRecord, VideoRecord } from './types';
import { MEASURE_ENTITY } from './types';

/** The same song across readings. ISRC when the source gave one; otherwise normalised title + lead artist. */
export function songKey(e: ChartEntry): string {
  if (e.isrc) return `isrc:${e.isrc.toUpperCase()}`;
  const lead = e.artists.length ? normArtist(splitCredit(e.artists[0])[0] ?? e.artists[0]) : '';
  return `text:${normalise(e.title)}|${lead}`;
}

const appearance = (o: ChartObservation, e: ChartEntry): Appearance => ({
  observationId: o.id, source: o.source, measure: o.measure, territory: o.territory, period: o.period, periodLabel: o.periodLabel,
  collectedAt: o.collectedAt, rank: e.rank, previousRank: e.previousRank, periodsOnChart: e.periodsOnChart, measureValue: e.measureValue, videoId: e.videoId,
});

export type Bank = {
  songs: Map<string, SongRecord>;
  videos: Map<string, VideoRecord>;
  observations: ChartObservation[];
  /** Latest observation per series. */
  latest: Map<string, ChartObservation>;
  /** All periods per series, sorted. */
  seriesPeriods: Map<string, string[]>;
};

export const seriesKey = (o: { source: ChartSource; measure: ChartMeasure; territory: string }) => `${o.source}|${o.measure}|${o.territory}`;

export function buildBank(observations: ChartObservation[], human: HumanLabel[] = []): Bank {
  const songs = new Map<string, SongRecord>();
  const videos = new Map<string, VideoRecord>();
  const latest = new Map<string, ChartObservation>();
  const seriesPeriods = new Map<string, string[]>();
  for (const o of observations) {
    const k = seriesKey(o);
    const cur = latest.get(k);
    if (!cur || o.period > cur.period) latest.set(k, o);
    const ps = seriesPeriods.get(k) ?? [];
    if (!ps.includes(o.period)) ps.push(o.period);
    seriesPeriods.set(k, ps.sort());
  }
  for (const o of observations) {
    const entity = MEASURE_ENTITY[o.measure];
    for (const e of o.entries) {
      const app = appearance(o, e);
      if (entity === 'video' && e.videoId) {
        const v = videos.get(e.videoId) ?? { videoId: e.videoId, title: e.title, artists: e.artists, releaseDate: e.releaseDate, songKey: null, labels: [], appearances: [] };
        if (o.period >= (v.appearances.at(-1)?.period ?? '')) { v.title = e.title; v.artists = e.artists; v.releaseDate = e.releaseDate ?? v.releaseDate; }
        v.appearances.push(app);
        videos.set(e.videoId, v);
        /* A video chart row is also evidence about the song, but the
           song key from a video title ("Chase & Status - Carnage (ft. …)")
           is unreliable, so video rows do not create song records. */
        continue;
      }
      if (entity !== 'song') continue;
      const key = songKey(e);
      const s = songs.get(key) ?? { key, title: e.title, artists: e.artists, isrc: e.isrc, releaseDate: e.releaseDate, labels: [], appearances: [], linkedVideoIds: [] };
      s.appearances.push(app);
      if (e.releaseDate && !s.releaseDate) s.releaseDate = e.releaseDate;
      if (e.videoId && !s.linkedVideoIds.includes(e.videoId)) s.linkedVideoIds.push(e.videoId);
      songs.set(key, s);
    }
  }
  for (const s of Array.from(songs.values())) {
    s.appearances.sort((a, b) => a.period.localeCompare(b.period) || a.territory.localeCompare(b.territory));
    const latestPeriod = s.appearances.at(-1)!.period;
    const subjects = [s.key, ...s.artists.flatMap(splitCredit).map(a => `artist:${normArtist(a)}`)];
    s.labels = classifyChartRow({ title: s.title, artists: s.artists, releaseDate: s.releaseDate }, 'song', latestPeriod, humanLabelsFor(subjects, human));
    for (const vid of s.linkedVideoIds) { const v = videos.get(vid); if (v && !v.songKey) v.songKey = s.key; }
  }
  for (const v of Array.from(videos.values())) {
    v.appearances.sort((a, b) => a.period.localeCompare(b.period) || a.territory.localeCompare(b.territory));
    const subjects = [`video:${v.videoId}`, ...(v.songKey ? [v.songKey] : []), ...v.artists.flatMap(splitCredit).map(a => `artist:${normArtist(a)}`)];
    v.labels = classifyChartRow({ title: v.title, artists: v.artists, releaseDate: v.releaseDate }, 'video', v.appearances.at(-1)!.period, humanLabelsFor(subjects, human));
  }
  return { songs, videos, observations, latest, seriesPeriods };
}

/** Persistence inside each series, breadth across them. */
export function persistence(appearances: Appearance[], seriesPeriods: Map<string, string[]>): Persistence {
  const by = new Map<string, Persistence['bySeries'][number]>();
  for (const a of appearances) {
    const k = seriesKey(a);
    const s = by.get(k) ?? { source: a.source, measure: a.measure, territory: a.territory, periods: [], bestRank: a.rank, latestRank: null, latestPeriod: '' };
    if (!s.periods.includes(a.period)) s.periods.push(a.period);
    s.bestRank = Math.min(s.bestRank, a.rank);
    if (a.period >= s.latestPeriod) { s.latestPeriod = a.period; s.latestRank = a.rank; }
    by.set(k, s);
  }
  const bySeries = Array.from(by.values()).map(s => {
    s.periods.sort();
    /* If the series has a later stored period the song is absent from, it has dropped: latestRank null. */
    const all = seriesPeriods.get(seriesKey(s)) ?? s.periods;
    if (all.length && all[all.length - 1] !== s.latestPeriod) s.latestRank = null;
    return s;
  });
  return {
    bySeries,
    territories: Array.from(new Set(appearances.map(a => a.territory))).sort(),
    measures: Array.from(new Set(appearances.map(a => a.measure))),
  };
}

/** Rows of the latest reading per series, with the record behind each row. */
export function latestRows(bank: Bank): { obs: ChartObservation; entry: ChartEntry; song: SongRecord | null; video: VideoRecord | null }[] {
  const out: ReturnType<typeof latestRows> = [];
  for (const obs of Array.from(bank.latest.values())) {
    const entity = MEASURE_ENTITY[obs.measure];
    for (const entry of obs.entries) {
      out.push({ obs, entry, song: entity === 'song' ? bank.songs.get(songKey(entry)) ?? null : null, video: entity === 'video' && entry.videoId ? bank.videos.get(entry.videoId) ?? null : null });
    }
  }
  return out;
}

/** Songs that appear in more than one chart type (song + Shorts, say) — demand in several places. */
export function crossMeasureSongs(bank: Bank): { song: SongRecord; measures: ChartMeasure[]; territories: string[] }[] {
  return Array.from(bank.songs.values())
    .map(song => ({ song, measures: Array.from(new Set(song.appearances.map(a => a.measure))), territories: Array.from(new Set(song.appearances.map(a => a.territory))).sort() }))
    .filter(x => x.measures.length > 1)
    .sort((a, b) => b.measures.length - a.measures.length || b.territories.length - a.territories.length);
}
