import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 600; // 10 min cache

const KEY = process.env.YOUTUBE_API_KEY;

type Snap = {
  channelId: string;
  title: string;
  handle?: string;
  subs: number;
  views: number;
  uploads30d: number;
  lastUploadAt: string | null;
  thumbnail?: string;
};

async function jget(url: string) {
  const r = await fetch(url, { next: { revalidate: 600 } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function resolveChannelId(input: string): Promise<string | null> {
  // Already a channel ID
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(input)) return input;

  const handle = input.startsWith('@') ? input : `@${input.replace(/^https?:\/\/.*\/(@?[^/?#]+).*/, '$1')}`;

  // 1. Try forHandle (cheap, 1 unit)
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${KEY}`;
    const j = await jget(url);
    if (j.items?.[0]?.id) return j.items[0].id;
  } catch {}

  // 2. Fallback to search.list (100 units)
  try {
    const q = handle.replace(/^@/, '');
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}&key=${KEY}`;
    const j = await jget(url);
    return j.items?.[0]?.snippet?.channelId ?? j.items?.[0]?.id?.channelId ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 503 });
  }
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  try {
    const channelId = await resolveChannelId(q);
    if (!channelId) return NextResponse.json({ error: 'channel not found' }, { status: 404 });

    const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${KEY}`;
    const ch = await jget(chUrl);
    const item = ch.items?.[0];
    if (!item) return NextResponse.json({ error: 'channel empty' }, { status: 404 });

    const uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
    let uploads30d = 0;
    let lastUploadAt: string | null = null;

    if (uploadsId) {
      const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${KEY}`;
      const pl = await jget(plUrl);
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const items: any[] = pl.items ?? [];
      for (const it of items) {
        const t = it.snippet?.publishedAt;
        if (!t) continue;
        if (!lastUploadAt || t > lastUploadAt) lastUploadAt = t;
        if (new Date(t).getTime() >= cutoff) uploads30d++;
      }
    }

    const snap: Snap = {
      channelId,
      title: item.snippet?.title ?? q,
      handle: item.snippet?.customUrl,
      subs: Number(item.statistics?.subscriberCount ?? 0),
      views: Number(item.statistics?.viewCount ?? 0),
      uploads30d,
      lastUploadAt,
      thumbnail: item.snippet?.thumbnails?.default?.url,
    };
    return NextResponse.json(snap);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
