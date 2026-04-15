import type { LiveSnap } from './artists';

const KEY = process.env.YOUTUBE_API_KEY;

async function jget(url: string) {
  const r = await fetch(url, { next: { revalidate: 600 } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function resolveChannelId(input: string): Promise<string | null> {
  if (!KEY) return null;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(input)) return input;
  const handle = input.startsWith('@') ? input : `@${input.replace(/^https?:\/\/.*\/(@?[^/?#]+).*/, '$1')}`;
  try {
    const j = await jget(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${KEY}`
    );
    if (j.items?.[0]?.id) return j.items[0].id;
  } catch {}
  try {
    const q = handle.replace(/^@/, '');
    const j = await jget(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}&key=${KEY}`
    );
    return j.items?.[0]?.snippet?.channelId ?? j.items?.[0]?.id?.channelId ?? null;
  } catch {
    return null;
  }
}

export async function fetchChannelSnap(input: string): Promise<LiveSnap | null> {
  if (!KEY) return null;
  try {
    const channelId = await resolveChannelId(input);
    if (!channelId) return { error: 'not found' };
    const ch = await jget(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${KEY}`
    );
    const item = ch.items?.[0];
    if (!item) return { error: 'empty' };
    const uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
    let uploads30d = 0;
    let lastUploadAt: string | null = null;
    if (uploadsId) {
      const pl = await jget(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${KEY}`
      );
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const it of pl.items ?? []) {
        const t = it.snippet?.publishedAt;
        if (!t) continue;
        if (!lastUploadAt || t > lastUploadAt) lastUploadAt = t;
        if (new Date(t).getTime() >= cutoff) uploads30d++;
      }
    }
    return {
      channelId,
      title: item.snippet?.title,
      handle: item.snippet?.customUrl,
      subs: Number(item.statistics?.subscriberCount ?? 0),
      views: Number(item.statistics?.viewCount ?? 0),
      uploads30d,
      lastUploadAt,
      thumbnail: item.snippet?.thumbnails?.default?.url,
    };
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}
