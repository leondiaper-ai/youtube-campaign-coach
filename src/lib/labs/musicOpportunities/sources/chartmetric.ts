/* ═══════════════════════════════════════════════════════════════════════
   SOURCE — CHARTMETRIC'S LICENSED YOUTUBE CHARTS

   Chartmetric republishes the YouTube Charts product through its API:
     /api/charts/youtube/tracks           weekly Top Songs      (has ISRC)
     /api/charts/youtube/videos           weekly Top Music Videos (has video id)
     /api/charts/youtube/shorts/{type}    daily / weekly Top Songs on Shorts
   Updated weekly on Thursdays per their reference pages.

   Whether this project's Chartmetric plan includes chart endpoints is
   NOT known at the time of writing: the client is shared with the
   artist territory work and may be on a trial. A non-2xx answer is
   reported as such and nothing is saved. Field shapes below follow the
   reference pages read on 23 Oct 2026; anything missing is null, never
   guessed.
   ═══════════════════════════════════════════════════════════════════════ */

import { cmFetch } from '@/lib/chartmetric/client';
import { chartmetricConfigured } from '@/lib/chartmetric/auth';
import type { ChartEntry, ChartObservation } from '../types';
import { CM_CHARTS, CM_TERRITORIES, type CmChart } from './constants';
export { CM_CHARTS, CM_TERRITORIES, type CmChart } from './constants';

export { chartmetricConfigured };

type CmRow = Record<string, unknown>;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const names = (v: unknown): string[] => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : str((x as CmRow)?.name) ?? '').filter(Boolean) : typeof v === 'string' ? v.split(/,\s*/).filter(Boolean) : [];

function rowToEntry(row: CmRow, i: number, chart: CmChart): ChartEntry {
  const rank = num(row.position) ?? num(row.rank) ?? i + 1;
  const pre = num(row.pre_rank);
  const diff = num(row.rankDiff);
  const isVideo = chart === 'videos';
  return {
    rank, previousRank: pre ?? (diff != null ? rank + diff : null), isNew: pre == null && diff == null ? null : false,
    periodsOnChart: num(row.time_on_chart),
    title: str(row.name) ?? '(untitled)',
    artists: names(row.artist_names).length ? names(row.artist_names) : names(row.youtube_artist_names).length ? names(row.youtube_artist_names) : names(row.artists).length ? names(row.artists) : str(row.artist_name) ? [str(row.artist_name)!] : [],
    isrc: str(row.isrc)?.toUpperCase() ?? null,
    videoId: isVideo ? (str(row.id) && /^[A-Za-z0-9_-]{11}$/.test(str(row.id)!) ? str(row.id) : str(row.youtube_video_id)) : str(row.youtube_video_id),
    channelId: null, channelTitle: null,
    measureValue: num(row.view_count) ?? num((row.targetExtras as CmRow | undefined)?.youtubeViews) ?? null,
  };
}

export async function collectChartmetric(chart: CmChart, territory: string): Promise<{ observation: ChartObservation; status: string }> {
  if (!CM_TERRITORIES.includes(territory as typeof CM_TERRITORIES[number])) throw new Error('Territory is not on the allowlist.');
  if (!chartmetricConfigured()) throw new Error('Chartmetric is not configured in this environment.');
  const def = CM_CHARTS[chart];
  const result = await cmFetch<{ obj?: unknown }>(def.path(territory));
  if (!result.ok) throw new Error(`Chartmetric answered ${result.status || result.reason}; nothing was saved. Chart endpoints may not be included in the current plan.`);
  const obj = result.data?.obj;
  const rows: CmRow[] = Array.isArray(obj) ? obj : Array.isArray((obj as CmRow | undefined)?.data) ? (obj as { data: CmRow[] }).data : [];
  if (!rows.length) throw new Error('Chartmetric returned no rows for this chart and territory.');
  const collectedAt = new Date().toISOString();
  const first = rows[0];
  const period = str(first.chartedDate)?.slice(0, 10) ?? str(first.timestp)?.slice(0, 10)
    ?? str(((first.rankStats as CmRow[] | undefined)?.at(-1))?.timestp)?.slice(0, 10) ?? collectedAt.slice(0, 10);
  const entries = rows.slice(0, 100).map((r, i) => rowToEntry(r, i, chart)).sort((a, b) => a.rank - b.rank);
  return { status: `${result.status}`, observation: {
    id: `chartmetric|${def.measure}|${territory}|${period}`,
    source: 'chartmetric', measure: def.measure, territory, period,
    periodLabel: `${def.label} · chart dated ${period}`, collectedAt, note: null,
    sourceUrl: `https://app.chartmetric.com/charts`, entries,
  } };
}
