/* ═══════════════════════════════════════════════════════════════════════
   SOURCE — YOUTUBE DATA API, chart=mostPopular, category 10 (Music)

   The one chart the public Data API exposes. It is NOT the YouTube
   Music Charts product: it is YouTube's own "most popular" list for a
   region and category, with no published measure, no chart period and
   no previous-rank field. Reading it daily and keeping the readings is
   the only way to see movement, so the period is the collection date.

   Cost: 1 quota unit per call, 50 rows per call. A page of two calls
   per region costs 2 units; five regions a day is 10 units a day.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ChartEntry, ChartObservation } from '../types';
import { DATA_API_REGIONS } from './constants';
export { DATA_API_REGIONS, DEFAULT_REGIONS } from './constants';
const MUSIC_CATEGORY = '10';
const PAGES = 2; // 100 rows

type YtVideo = {
  id: string; snippet?: { title?: string; channelId?: string; channelTitle?: string; publishedAt?: string };
  statistics?: { viewCount?: string };
};

const count = (v?: string) => v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

export function dataApiConfigured() { return !!process.env.YOUTUBE_API_KEY; }

export async function collectMostPopularMusic(regionCode: string): Promise<{ observation: ChartObservation; units: number }> {
  if (!DATA_API_REGIONS.includes(regionCode as typeof DATA_API_REGIONS[number])) throw new Error('Region is not on the allowlist.');
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube access is not configured for this preview.');
  const collectedAt = new Date().toISOString();
  const entries: ChartEntry[] = [];
  let token: string | undefined, units = 0;
  for (let page = 0; page < PAGES; page++) {
    const query = new URLSearchParams({ part: 'snippet,statistics', chart: 'mostPopular', videoCategoryId: MUSIC_CATEGORY,
      regionCode, maxResults: '50', key: apiKey, ...(token ? { pageToken: token } : {}) });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    units++;
    // Never echo the request URL (it carries the key) into an error.
    if (!response.ok) throw new Error(`YouTube returned ${response.status}; nothing was saved.`);
    const body = await response.json() as { items?: YtVideo[]; nextPageToken?: string };
    for (const v of body.items ?? []) {
      if (!v.id) continue;
      entries.push({ rank: entries.length + 1, previousRank: null, isNew: null, periodsOnChart: null,
        title: v.snippet?.title ?? v.id, artists: [], isrc: null, videoId: v.id,
        channelId: v.snippet?.channelId ?? null, channelTitle: v.snippet?.channelTitle ?? null,
        measureValue: count(v.statistics?.viewCount) });
    }
    token = body.nextPageToken;
    if (!token) break;
  }
  const period = collectedAt.slice(0, 10);
  return { units, observation: {
    id: `youtube-data-api|most-popular-music-videos|${regionCode}|${period}`,
    source: 'youtube-data-api', measure: 'most-popular-music-videos', territory: regionCode,
    period, periodLabel: `Reading on ${period}`, collectedAt, note: null,
    sourceUrl: `https://developers.google.com/youtube/v3/docs/videos/list`,
    entries,
  } };
}
