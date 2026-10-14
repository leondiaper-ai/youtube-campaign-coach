/* ═══════════════════════════════════════════════════════════════════════
   MARKET WATCH — COLLECTION

   Multi-artist channels: genre discovery, mood curation, label catalogue.
   A different subject from Watcher's artist model, so none of the artist
   logic applies here — no release phases, no hero videos, no inactivity
   scoring. A curation channel publishing forty artists a month is not an
   artist with a quiet patch.

   WHAT THIS SHARES WITH WATCHER, AND WHAT IT DOES NOT

   Shares: the YOUTUBE_API_KEY already configured server-side, the same
   Upstash client, the same call sequence as fetchChannelSnap in
   src/lib/youtube.ts — channels.list for the uploads playlist,
   playlistItems paginated, videos.list in batches of fifty.

   Does not share: storage. Everything written here is prefixed `mw:`.
   Nothing touches live:, chanmap:, sync:, or any artist record. Nothing
   is added to the cron. Collection is manual, by request, so this cannot
   quietly consume the shared quota in the background.

   QUOTA
   Three channels at 100 uploads is about 13 units — 1 for channels.list,
   2 playlistItems pages each, 2 videos.list batches each. Watcher's daily
   sync uses roughly 1,500 against a 10,000 default, so a manual run is
   immaterial. CAP exists so that stays true if the channel list grows.
   ═══════════════════════════════════════════════════════════════════════ */

const API = 'https://www.googleapis.com/youtube/v3';
const KEY = () => process.env.YOUTUBE_API_KEY;

/** Hard ceiling on a single manual run, in API units. */
export const QUOTA_CAP = 200;

export const MW_CHANNELS = [
  { key: 'trap-nation',  name: 'Trap Nation',  id: 'UCa10nxShhzNrCE1o2ZOPztg', role: 'genre_discovery' },
  { key: 'chill-nation', name: 'Chill Nation', id: 'UCM9KEEuzacwVlkt9JfJad7g', role: 'context_curation' },
  { key: '7clouds',      name: '7clouds',      id: 'UCNqFDjYTexJDET3rPDrmJKg', role: 'genre_discovery' },
] as const;

export const UPLOADS_WANTED = 100;

export interface MwVideo {
  id: string; title: string | null; publishedAt: string | null;
  thumb: string | null; url: string;
  durationSec: number | null; live: string;
  /** null means YouTube did not return it — the uploader hides it. Not zero. */
  views: number | null; likes: number | null; comments: number | null;
  statsAvailable: boolean;
}
export interface MwChannel {
  key: string; name: string; channelId: string; role: string;
  title: string | null; handle: string | null; thumb: string | null;
  subs: number | null; channelViews: number | null; channelVideos: number | null;
  requested: number; retrieved: number; pages: number; complete: boolean;
  statsMissing: number; items: MwVideo[];
}
export interface MwCollection {
  collectedAt: string; quotaUnits: number;
  channels: MwChannel[];
  errors: { channel: string; stage: string; error: string }[];
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

function durationSec(iso?: string): number | null {
  if (!iso) return null;
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null;
}

export async function collectMarketWatch(): Promise<MwCollection> {
  const key = KEY();
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured on this runtime');

  const out: MwCollection = { collectedAt: new Date().toISOString(), quotaUnits: 0, channels: [], errors: [] };
  const spend = (n: number) => {
    if (out.quotaUnits + n > QUOTA_CAP) throw new Error(`quota cap of ${QUOTA_CAP} units reached`);
    out.quotaUnits += n;
  };

  spend(1);
  const chJson = await jget(`${API}/channels?part=snippet,statistics,contentDetails&id=${MW_CHANNELS.map(c => c.id).join(',')}&key=${key}`);
  const meta = new Map<string, any>((chJson.items ?? []).map((i: any) => [i.id, i]));

  for (const c of MW_CHANNELS) {
    const m = meta.get(c.id);
    if (!m) { out.errors.push({ channel: c.name, stage: 'channels.list', error: 'channel not returned' }); continue; }

    const uploads: string | undefined = m.contentDetails?.relatedPlaylists?.uploads;
    const rec: MwChannel = {
      key: c.key, name: c.name, channelId: c.id, role: c.role,
      title: m.snippet?.title ?? null, handle: m.snippet?.customUrl ?? null,
      thumb: m.snippet?.thumbnails?.default?.url ?? null,
      subs: m.statistics?.hiddenSubscriberCount ? null : (m.statistics?.subscriberCount != null ? +m.statistics.subscriberCount : null),
      channelViews: m.statistics?.viewCount != null ? +m.statistics.viewCount : null,
      channelVideos: m.statistics?.videoCount != null ? +m.statistics.videoCount : null,
      requested: UPLOADS_WANTED, retrieved: 0, pages: 0, complete: false, statsMissing: 0, items: [],
    };

    if (!uploads) {
      out.errors.push({ channel: c.name, stage: 'uploads playlist', error: 'channel has no uploads playlist' });
      out.channels.push(rec); continue;
    }

    let token: string | undefined;
    try {
      for (let p = 0; p < Math.ceil(UPLOADS_WANTED / 50); p++) {
        spend(1);
        const j = await jget(`${API}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}&key=${key}${token ? `&pageToken=${token}` : ''}`);
        rec.pages++;
        for (const it of j.items ?? []) {
          const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
          if (!id) continue;
          rec.items.push({
            id, title: it.snippet?.title ?? null,
            publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || null,
            thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
            url: `https://www.youtube.com/watch?v=${id}`,
            durationSec: null, live: 'none', views: null, likes: null, comments: null, statsAvailable: false,
          });
        }
        token = j.nextPageToken;
        if (!token) break;
      }
    } catch (e) {
      out.errors.push({ channel: c.name, stage: 'playlistItems', error: (e as Error).message });
    }

    rec.items = rec.items.slice(0, UPLOADS_WANTED);
    rec.retrieved = rec.items.length;
    rec.complete = rec.retrieved >= UPLOADS_WANTED || !token;

    try {
      for (let i = 0; i < rec.items.length; i += 50) {
        const batch = rec.items.slice(i, i + 50);
        spend(1);
        const j = await jget(`${API}/videos?part=snippet,contentDetails,statistics&id=${batch.map(v => v.id).join(',')}&key=${key}`);
        const by = new Map<string, any>((j.items ?? []).map((v: any) => [v.id, v]));
        for (const v of batch) {
          const f = by.get(v.id);
          if (!f) { rec.statsMissing++; continue; }
          v.statsAvailable = true;
          v.durationSec = durationSec(f.contentDetails?.duration);
          v.live = f.snippet?.liveBroadcastContent ?? 'none';
          v.views = f.statistics?.viewCount != null ? +f.statistics.viewCount : null;
          v.likes = f.statistics?.likeCount != null ? +f.statistics.likeCount : null;
          v.comments = f.statistics?.commentCount != null ? +f.statistics.commentCount : null;
        }
      }
    } catch (e) {
      out.errors.push({ channel: c.name, stage: 'videos.list', error: (e as Error).message });
    }

    out.channels.push(rec);
  }

  return out;
}

/* ── Storage: `mw:` only ─────────────────────────────────────────────── */
const MW_KEY = 'mw:collection:v1';

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch { return null; }
}

export async function saveCollection(c: MwCollection) {
  const r = await kv(); if (!r) return false;
  await r.set(MW_KEY, JSON.stringify(c));
  return true;
}
export async function loadCollection(): Promise<MwCollection | null> {
  const r = await kv(); if (!r) return null;
  const raw = await r.get(MW_KEY);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as MwCollection);
}
