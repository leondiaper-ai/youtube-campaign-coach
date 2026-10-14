/* Market Watch collection.
 *
 * Reuses Watcher's configured YOUTUBE_API_KEY and Upstash client, and the same
 * call sequence as src/lib/youtube.ts: channels.list → playlistItems paginated
 * → videos.list in batches of fifty. Copied rather than imported, so a change
 * here cannot reach artist monitoring.
 *
 * Storage is one key per channel under `mw:`, never a single blob. Twenty
 * channels at three years of uploads is far too much for one value, and
 * per-channel keys also mean a failed channel does not cost the others.
 *
 * Collection is manual and batched — a request collects a few channels and
 * returns, so no single invocation runs long enough to be killed mid-write.
 */

import { MW_REGISTRY, type MwChannelDef } from './channels';

const API = 'https://www.googleapis.com/youtube/v3';
const KEY = () => process.env.YOUTUBE_API_KEY;

/** Upper bound on one request, in API units. Watcher's daily sync uses ~1,500. */
export const QUOTA_CAP_PER_REQUEST = 400;
/** How far back to collect. */
export const WINDOW_MONTHS = 36;
/** Ceiling per channel, so one prolific channel cannot eat the budget. */
export const MAX_PER_CHANNEL = 1200;

export interface MwVideo {
  id: string; title: string; publishedAt: string; thumb: string | null;
  durationSec: number | null; live: string;
  /** null means YouTube withheld it, which is not the same as zero. */
  views: number | null; likes: number | null; comments: number | null;
}
export interface MwChannelData {
  key: string; name: string; handle: string; channelId: string;
  relationship: string; company: string | null; role: string; purpose: string;
  title: string | null; avatar: string | null;
  subs: number | null; channelViews: number | null; channelVideos: number | null;
  collectedAt: string;
  retrieved: number; pages: number;
  /** True when we reached the window edge rather than a cap. */
  reachedWindow: boolean; cappedAt: number | null;
  oldest: string | null; newest: string | null;
  items: MwVideo[];
}
export interface MwIndexEntry {
  key: string; name: string; collectedAt: string; retrieved: number;
  reachedWindow: boolean; oldest: string | null; newest: string | null;
}

async function jget(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    const reason = j?.error?.errors?.[0]?.reason || '';
    throw new Error(`${msg}${reason ? ` [${reason}]` : ''}`);
  }
  return j;
}
const durationSec = (iso?: string): number | null => {
  if (!iso) return null;
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null;
};

/* ── KV, `mw:` only ──────────────────────────────────────────────────── */
async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { const { Redis } = await import('@upstash/redis'); return new Redis({ url, token }); }
  catch { return null; }
}
const chKey = (k: string) => `mw:ch:${k}`;
const INDEX = 'mw:index';

export async function saveChannel(d: MwChannelData) {
  const r = await kv(); if (!r) return false;
  await r.set(chKey(d.key), JSON.stringify(d));
  const idx = await readIndex();
  const next = idx.filter(e => e.key !== d.key);
  next.push({ key:d.key, name:d.name, collectedAt:d.collectedAt, retrieved:d.retrieved,
              reachedWindow:d.reachedWindow, oldest:d.oldest, newest:d.newest });
  await r.set(INDEX, JSON.stringify(next));
  return true;
}
export async function readIndex(): Promise<MwIndexEntry[]> {
  const r = await kv(); if (!r) return [];
  const raw = await r.get(INDEX);
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as MwIndexEntry[]); } catch { return []; }
}
export async function readChannel(key: string): Promise<MwChannelData | null> {
  const r = await kv(); if (!r) return null;
  const raw = await r.get(chKey(key));
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as MwChannelData); } catch { return null; }
}
export async function readAll(): Promise<MwChannelData[]> {
  const idx = await readIndex();
  const out: MwChannelData[] = [];
  for (const e of idx) { const d = await readChannel(e.key); if (d) out.push(d); }
  return out;
}

/* ── Resolution ──────────────────────────────────────────────────────
   Handles are unique, so one hit is the identity. Anything that misses is
   left unresolved rather than guessed through search. */
export async function resolveByHandle(handle: string, key: string) {
  const j = await jget(`${API}/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(handle)}&key=${key}`);
  const it = j.items?.[0];
  if (!it || j.items.length !== 1) return null;
  return it;
}

/* ── One channel ─────────────────────────────────────────────────────── */
async function collectChannel(def: MwChannelDef, key: string, spend: (n: number) => void): Promise<MwChannelData> {
  let item: any = null;

  if (def.channelId) {
    spend(1);
    const j = await jget(`${API}/channels?part=snippet,statistics,contentDetails&id=${def.channelId}&key=${key}`);
    item = j.items?.[0] ?? null;
  } else {
    spend(1);
    item = await resolveByHandle(def.handle, key);
  }
  if (!item) throw new Error(`could not resolve ${def.handle}`);

  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('no uploads playlist');

  const cutoff = Date.now() - WINDOW_MONTHS * 30.44 * 864e5;
  const items: MwVideo[] = [];
  let token: string | undefined, pages = 0, reachedWindow = false, capped: number | null = null;

  for (;;) {
    spend(1);
    const j = await jget(`${API}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}&key=${key}${token ? `&pageToken=${token}` : ''}`);
    pages++;
    let hitEdge = false;
    for (const it of j.items ?? []) {
      const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
      const at = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt;
      if (!id || !at) continue;
      if (Date.parse(at) < cutoff) { hitEdge = true; continue; }
      items.push({ id, title: it.snippet?.title ?? '', publishedAt: at,
        thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
        durationSec: null, live: 'none', views: null, likes: null, comments: null });
    }
    token = j.nextPageToken;
    if (hitEdge) { reachedWindow = true; break; }
    if (!token) { reachedWindow = true; break; }
    if (items.length >= MAX_PER_CHANNEL) { capped = MAX_PER_CHANNEL; break; }
  }

  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    spend(1);
    const j = await jget(`${API}/videos?part=snippet,contentDetails,statistics&id=${batch.map(v => v.id).join(',')}&key=${key}`);
    const by = new Map<string, any>((j.items ?? []).map((v: any) => [v.id, v]));
    for (const v of batch) {
      const f = by.get(v.id); if (!f) continue;
      v.durationSec = durationSec(f.contentDetails?.duration);
      v.live = f.snippet?.liveBroadcastContent ?? 'none';
      v.views = f.statistics?.viewCount != null ? +f.statistics.viewCount : null;
      v.likes = f.statistics?.likeCount != null ? +f.statistics.likeCount : null;
      v.comments = f.statistics?.commentCount != null ? +f.statistics.commentCount : null;
    }
  }

  const dates = items.map(v => v.publishedAt).sort();
  return {
    key: def.key, name: def.name, handle: def.handle, channelId: item.id,
    relationship: def.relationship, company: def.company, role: def.role, purpose: def.purpose,
    title: item.snippet?.title ?? null,
    avatar: item.snippet?.thumbnails?.default?.url ?? null,
    subs: item.statistics?.hiddenSubscriberCount ? null : (item.statistics?.subscriberCount != null ? +item.statistics.subscriberCount : null),
    channelViews: item.statistics?.viewCount != null ? +item.statistics.viewCount : null,
    channelVideos: item.statistics?.videoCount != null ? +item.statistics.videoCount : null,
    collectedAt: new Date().toISOString(),
    retrieved: items.length, pages, reachedWindow, cappedAt: capped,
    oldest: dates[0] ?? null, newest: dates[dates.length - 1] ?? null,
    items,
  };
}

/* ── A batch ─────────────────────────────────────────────────────────── */
export interface BatchResult {
  done: string[];
  failed: { key: string; name: string; error: string }[];
  quotaUnits: number;
  remaining: string[];
}
export async function collectBatch(keys: string[]): Promise<BatchResult> {
  const key = KEY();
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured on this runtime');

  let units = 0;
  const spend = (n: number) => {
    if (units + n > QUOTA_CAP_PER_REQUEST) throw new Error('__QUOTA_CAP__');
    units += n;
  };

  const done: string[] = [];
  const failed: BatchResult['failed'] = [];
  const remaining: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const def = MW_REGISTRY.find(c => c.key === keys[i]);
    if (!def) { failed.push({ key: keys[i], name: keys[i], error: 'not in registry' }); continue; }
    try {
      const data = await collectChannel(def, key, spend);
      await saveChannel(data);
      done.push(def.key);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === '__QUOTA_CAP__') { remaining.push(...keys.slice(i)); break; }
      failed.push({ key: def.key, name: def.name, error: msg });
    }
  }
  return { done, failed, quotaUnits: units, remaining };
}

/* ═══════════════════════════════════════════════════════════════════════
   ARTIST CATALOGUE — the missing half of the connection

   Watcher caches a recent upload window per artist, about a hundred. That
   is right for campaign monitoring and wrong for this: the destinations in
   this market earn most of their views from catalogue. 7clouds' biggest
   Nickelback uploads are Rockstar and Photograph, from 2005, and Watcher
   has never heard of them — so the market side knew about songs the artist
   side could not see, and every catalogue-led idea returned "insufficient
   evidence" for the wrong reason.

   This fetches an artist's own uploads the same way Market Watch fetches a
   channel's, into the mw: namespace. Watcher's records are untouched; this
   is a parallel, deeper copy for a deliberately short list, not a change
   to how monitoring works.
   ═══════════════════════════════════════════════════════════════════════ */

export interface MwArtistCatalogue {
  slug: string; name: string; channelId: string; handle: string | null;
  collectedAt: string; retrieved: number; pages: number;
  reachedEnd: boolean; cappedAt: number | null;
  oldest: string | null; newest: string | null;
  items: MwVideo[];
}

const artKey = (slug: string) => `mw:artist:${slug}`;
const ART_INDEX = 'mw:artist:index';

export async function saveArtistCatalogue(c: MwArtistCatalogue) {
  const r = await kv(); if (!r) return false;
  await r.set(artKey(c.slug), JSON.stringify(c));
  const idx = await readArtistIndex();
  const next = idx.filter(e => e.slug !== c.slug);
  next.push({ slug: c.slug, name: c.name, retrieved: c.retrieved, collectedAt: c.collectedAt });
  await r.set(ART_INDEX, JSON.stringify(next));
  return true;
}
export async function readArtistIndex(): Promise<{slug:string;name:string;retrieved:number;collectedAt:string}[]> {
  const r = await kv(); if (!r) return [];
  const raw = await r.get(ART_INDEX);
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as any); } catch { return []; }
}
export async function readArtistCatalogue(slug: string): Promise<MwArtistCatalogue | null> {
  const r = await kv(); if (!r) return null;
  const raw = await r.get(artKey(slug));
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as MwArtistCatalogue); } catch { return null; }
}

/** Walks an artist channel's whole uploads playlist, newest first. */
export async function collectArtistCatalogue(
  slug: string, name: string, handle: string, cap = 600,
): Promise<MwArtistCatalogue> {
  const key = KEY();
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured on this runtime');

  const h = '@' + handle.replace(/^@/, '');
  const ch = await jget(`${API}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(h)}&key=${key}`);
  const item = ch.items?.[0];
  if (!item || ch.items.length !== 1) throw new Error(`could not resolve ${h}`);
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('no uploads playlist');

  const items: MwVideo[] = [];
  let token: string | undefined, pages = 0, reachedEnd = false, capped: number | null = null;
  for (;;) {
    const j = await jget(`${API}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}&key=${key}${token ? `&pageToken=${token}` : ''}`);
    pages++;
    for (const it of j.items ?? []) {
      const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
      const at = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt;
      if (!id || !at) continue;
      items.push({ id, title: it.snippet?.title ?? '', publishedAt: at,
        thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
        durationSec: null, live: 'none', views: null, likes: null, comments: null });
    }
    token = j.nextPageToken;
    if (!token) { reachedEnd = true; break; }
    if (items.length >= cap) { capped = cap; break; }
  }

  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const j = await jget(`${API}/videos?part=snippet,contentDetails,statistics&id=${batch.map(v => v.id).join(',')}&key=${key}`);
    const by = new Map<string, any>((j.items ?? []).map((v: any) => [v.id, v]));
    for (const v of batch) {
      const f = by.get(v.id); if (!f) continue;
      v.durationSec = durationSec(f.contentDetails?.duration);
      v.live = f.snippet?.liveBroadcastContent ?? 'none';
      v.views = f.statistics?.viewCount != null ? +f.statistics.viewCount : null;
      v.likes = f.statistics?.likeCount != null ? +f.statistics.likeCount : null;
      v.comments = f.statistics?.commentCount != null ? +f.statistics.commentCount : null;
    }
  }

  const dates = items.map(v => v.publishedAt).sort();
  const out: MwArtistCatalogue = {
    slug, name, channelId: item.id, handle: item.snippet?.customUrl ?? h,
    collectedAt: new Date().toISOString(), retrieved: items.length, pages,
    reachedEnd, cappedAt: capped,
    oldest: dates[0] ?? null, newest: dates[dates.length - 1] ?? null, items,
  };
  await saveArtistCatalogue(out);
  return out;
}
