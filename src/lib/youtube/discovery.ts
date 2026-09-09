/**
 * DISCOVERY — finding channels we have never met
 *
 * The existing YouTube client is built for channels we already know: give
 * it a handle, get a snapshot. Nothing in it can answer "which channels
 * are doing X". This module adds that, and adds the two things you must
 * have before you let anything issue 100-unit calls.
 *
 * ── THE QUOTA ARITHMETIC, WHICH DRIVES EVERY DECISION HERE ───────────
 *   search.list        100 units — PER CALL, regardless of maxResults
 *   channels.list        1 unit  — for up to FIFTY ids
 *   playlistItems.list   1 unit  — per 50-item page
 *   videos.list          1 unit  — per 50-video batch
 *
 * The daily allowance is 10,000 and the snapshot cron already commits
 * roughly 280. So there is room for perhaps 90 searches a day if we spend
 * nothing else, and realistically 40–60.
 *
 * Two consequences are non-negotiable:
 *   1. Every search asks for maxResults=50. Asking for 10 costs the same
 *      100 units and throws away 80% of the result.
 *   2. Channel hydration is batched fifty at a time. Hydrating 50 channels
 *      one at a time costs 50 units; batched it costs 1.
 *
 * ── WHY THE LEDGER IS IN REDIS ───────────────────────────────────────
 * The existing quota guard is a module-level boolean in youtube.ts. On
 * serverless that dies with the instance and is not shared between
 * concurrent ones, which is survivable for 1-unit calls and is not
 * survivable for 100-unit ones. So spend is counted in Redis, keyed by the
 * Pacific day boundary Google actually resets on.
 */

import { Redis } from '@upstash/redis';

const KEY = process.env.YOUTUBE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* ── Quota ledger ────────────────────────────────────────────────────── */

export const COST = {
  search: 100,
  channels: 1,
  playlistItems: 1,
  videos: 1,
} as const;

const DAILY_LIMIT = 10_000;
/** What Scout may spend. The rest belongs to the snapshot cron and the app. */
export const SCOUT_DAILY_BUDGET = 5_000;

/** Google resets quota at midnight Pacific, so the ledger day must too. */
function quotaDay(now = new Date()): string {
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pacific.toISOString().slice(0, 10);
}

const K_SPEND = (day: string) => `quota:spend:${day}`;

export async function readSpend(): Promise<number> {
  const store = await kv();
  if (!store) return 0;
  return (await store.get<number>(K_SPEND(quotaDay()))) ?? 0;
}

/** Increment and return the new total. Best-effort — never blocks a call. */
async function recordSpend(units: number): Promise<void> {
  const store = await kv();
  if (!store) return;
  const day = quotaDay();
  try {
    await store.incrby(K_SPEND(day), units);
    /* Two days is enough to debug yesterday without accumulating keys. */
    await store.expire(K_SPEND(day), 60 * 60 * 48);
  } catch { /* the ledger is advisory; losing a write must not fail a run */ }
}

export class QuotaExceeded extends Error {
  constructor(public spent: number, public wanted: number) {
    super(`Scout quota budget reached: ${spent}/${SCOUT_DAILY_BUDGET} used, ${wanted} more requested`);
  }
}

/** A per-run spend counter, so a run can report its own cost honestly. */
export interface QuotaMeter {
  spent: number;
  calls: { endpoint: string; units: number }[];
}

export function newMeter(): QuotaMeter {
  return { spent: 0, calls: [] };
}

async function charge(meter: QuotaMeter, endpoint: string, units: number): Promise<void> {
  const dayTotal = await readSpend();
  if (dayTotal + units > SCOUT_DAILY_BUDGET) throw new QuotaExceeded(dayTotal, units);
  meter.spent += units;
  meter.calls.push({ endpoint, units });
  await recordSpend(units);
}

/* ── Fetch ───────────────────────────────────────────────────────────── */

async function jget(url: string): Promise<any> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`YouTube ${r.status}: ${body.slice(0, 300)}`);
  }
  return r.json();
}

/* ── Search cache ────────────────────────────────────────────────────── */

/**
 * Search results are cached for a week, far longer than anything else in
 * the system. That is deliberate: a repeated query costs another 100 units
 * and the set of channels answering "artists using live performance well"
 * does not turn over daily. Tuning a mission's queries should not cost a
 * fortune in quota.
 */
const SEARCH_TTL_SEC = 7 * 24 * 60 * 60;

function queryKey(parts: Record<string, string | number | undefined>): string {
  const s = Object.entries(parts)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  /* Short deterministic hash — the key only has to be stable and unique. */
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `discovery:q:${(h >>> 0).toString(36)}`;
}

/* ── search.list ─────────────────────────────────────────────────────── */

export interface SearchHit {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
}

export interface SearchOptions {
  /** Music is category 10. Narrows the field enormously for one unit of nothing. */
  videoCategoryId?: string;
  order?: 'relevance' | 'date' | 'viewCount' | 'rating';
  /** ISO date. Restricting to recent uploads is what makes results current. */
  publishedAfter?: string;
  regionCode?: string;
  relevanceLanguage?: string;
  /** Long-form only, to skip the Shorts flood, or 'any'. */
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
}

/**
 * Video-first search rather than `type=channel`.
 *
 * The same 100 units buys either 50 channels or 50 videos, and the videos
 * are the better instrument: a channel result matches on channel metadata,
 * which for music artists is usually a name and nothing else, whereas a
 * video result matches on titles and descriptions — which is where the
 * behaviour we are looking for actually shows up. "live session", "album
 * trailer", "behind the scenes" are properties of videos.
 *
 * We then take the distinct `channelId`s, which is the discovery set.
 */
export async function searchMusicVideos(
  q: string, meter: QuotaMeter, opts: SearchOptions = {},
): Promise<{ hits: SearchHit[]; cached: boolean }> {
  if (!KEY) return { hits: [], cached: false };

  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    /* Always 50. Anything less pays 100 units for a smaller answer. */
    maxResults: '50',
    q,
    videoCategoryId: opts.videoCategoryId ?? '10',
    order: opts.order ?? 'relevance',
    ...(opts.publishedAfter ? { publishedAfter: opts.publishedAfter } : {}),
    ...(opts.regionCode ? { regionCode: opts.regionCode } : {}),
    ...(opts.relevanceLanguage ? { relevanceLanguage: opts.relevanceLanguage } : {}),
    ...(opts.videoDuration && opts.videoDuration !== 'any' ? { videoDuration: opts.videoDuration } : {}),
  };

  const store = await kv();
  const key = queryKey(params);
  if (store) {
    const cached = await store.get<SearchHit[]>(key);
    if (Array.isArray(cached)) return { hits: cached, cached: true };
  }

  await charge(meter, 'search.list', COST.search);

  const url = `${API}/search?${new URLSearchParams({ ...params, key: KEY }).toString()}`;
  const j = await jget(url);

  const hits: SearchHit[] = (j.items ?? [])
    .map((it: any) => ({
      videoId: it.id?.videoId,
      channelId: it.snippet?.channelId,
      channelTitle: it.snippet?.channelTitle ?? '',
      title: it.snippet?.title ?? '',
      publishedAt: it.snippet?.publishedAt ?? '',
    }))
    .filter((h: SearchHit) => h.videoId && h.channelId);

  if (store) await store.set(key, hits, { ex: SEARCH_TTL_SEC });
  return { hits, cached: false };
}

/* ── channels.list, batched ──────────────────────────────────────────── */

export interface ChannelSummary {
  channelId: string;
  title: string;
  handle: string | null;
  description: string;
  publishedAt: string;
  country: string | null;
  subs: number | null;
  /** Hidden subscriber counts are null, never zero. */
  totalViews: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
  thumbnail: string | null;
}

/**
 * The single biggest quota win available: 50 ids for 1 unit. This is the
 * triage tier — enough to reject most candidates without ever touching
 * their catalogue.
 */
export async function fetchChannelsBatch(
  channelIds: string[], meter: QuotaMeter,
): Promise<ChannelSummary[]> {
  if (!KEY || !channelIds.length) return [];
  const out: ChannelSummary[] = [];

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    await charge(meter, 'channels.list', COST.channels);

    const url = `${API}/channels?part=snippet,statistics,contentDetails&id=${batch.join(',')}&maxResults=50&key=${KEY}`;
    const j = await jget(url);

    for (const c of j.items ?? []) {
      const stats = c.statistics ?? {};
      /* `statCount` semantics from youtube.ts: absent means unknown, not
         zero. A hidden subscriber count must not read as a dead channel. */
      const num = (v: unknown) => {
        if (v === undefined || v === null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      out.push({
        channelId: c.id,
        title: c.snippet?.title ?? '',
        handle: c.snippet?.customUrl ?? null,
        description: c.snippet?.description ?? '',
        publishedAt: c.snippet?.publishedAt ?? '',
        country: c.snippet?.country ?? null,
        subs: stats.hiddenSubscriberCount ? null : num(stats.subscriberCount),
        totalViews: num(stats.viewCount),
        videoCount: num(stats.videoCount),
        uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
        thumbnail: c.snippet?.thumbnails?.default?.url ?? null,
      });
    }
  }
  return out;
}

/* ── Recent uploads for one channel ──────────────────────────────────── */

export interface DiscoveredVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  wasLive: boolean;
  scheduledStart: string | null;
  actualStart: string | null;
}

function parseDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mi ?? 0)) * 60 + (+(s ?? 0));
}

/**
 * The assess tier: the last N uploads with full details. Two units per 50
 * videos (one playlist page, one details batch), so a 100-upload window
 * costs 4 — cheap enough to run on every channel that survives triage.
 *
 * Deliberately does NOT go through fetchChannelSnap. That function writes a
 * `snap:{channelId}` row as a side effect, which would mix discovered
 * channels into the roster's own time series, and its 200-entry memory
 * cache would evict roster entries during a sweep.
 */
export async function fetchRecentUploads(
  uploadsPlaylistId: string, meter: QuotaMeter, limit = 100,
): Promise<DiscoveredVideo[]> {
  if (!KEY) return [];

  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  while (ids.length < limit && pages < 4) {
    await charge(meter, 'playlistItems.list', COST.playlistItems);
    const url = `${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploadsPlaylistId}` +
      `&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const pl = await jget(url);
    for (const it of pl.items ?? []) {
      const v = it.contentDetails?.videoId;
      if (v) ids.push(v);
    }
    pageToken = pl.nextPageToken;
    pages++;
    if (!pageToken) break;
  }

  const wanted = ids.slice(0, limit);
  const out: DiscoveredVideo[] = [];

  for (let i = 0; i < wanted.length; i += 50) {
    const batch = wanted.slice(i, i + 50);
    await charge(meter, 'videos.list', COST.videos);
    const url = `${API}/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${batch.join(',')}&key=${KEY}`;
    const j = await jget(url);
    for (const v of j.items ?? []) {
      out.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        description: (v.snippet?.description ?? '').slice(0, 400),
        publishedAt: v.snippet?.publishedAt ?? '',
        durationSec: parseDuration(v.contentDetails?.duration ?? ''),
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
        wasLive: !!v.liveStreamingDetails,
        scheduledStart: v.liveStreamingDetails?.scheduledStartTime ?? null,
        actualStart: v.liveStreamingDetails?.actualStartTime ?? null,
      });
    }
  }

  /* Oldest first, so sequencing analysis reads in campaign order. */
  return out.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}
