import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelId, resolveChannelIdWithSearch } from '@/lib/youtube';

/**
 * GET /api/full-catalogue?handle=@kingsofleon
 *
 * Returns EVERY public upload on a channel, not the recent window.
 *
 * The main sync path deliberately caps uploads at 100 (300 during a campaign)
 * to keep the daily cron cheap across ~140 channels. That is the whole
 * catalogue for a developing artist, but for a heritage act it is a rounding
 * error — Kings of Leon have 2.46bn lifetime views and the recent window
 * accounts for 0.2% of them. Catalogue concentration, legacy-vs-new and
 * archive questions are unanswerable without the full list.
 *
 * This route is for one-off analysis, not the cron. It is uncached and
 * paginates until the playlist is exhausted.
 *
 * Quota: 1 unit per 50-item playlistItems page + 1 unit per 50-video details
 * batch. A 600-video catalogue costs ~24 units against a 10,000/day budget.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const KEY = process.env.YOUTUBE_API_KEY;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function jget(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`YouTube API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function isoToSeconds(iso: string): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500, headers: CORS });

  const handle = req.nextUrl.searchParams.get('handle');
  const cap = Math.min(Number(req.nextUrl.searchParams.get('cap') || 2000), 5000);
  if (!handle) return NextResponse.json({ error: 'missing handle' }, { status: 400, headers: CORS });

  try {
    const channelId = (await resolveChannelId(handle)) ?? (await resolveChannelIdWithSearch(handle));
    if (!channelId) return NextResponse.json({ error: `could not resolve ${handle}` }, { status: 404, headers: CORS });

    // Channel totals + the uploads playlist that contains every public video.
    const ch = await jget(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails,snippet&id=${channelId}&key=${KEY}`
    );
    const c = ch.items?.[0];
    if (!c) return NextResponse.json({ error: 'channel not found' }, { status: 404, headers: CORS });
    const uploadsId = c.contentDetails?.relatedPlaylists?.uploads;

    // 1. Page the uploads playlist to exhaustion.
    const ids: string[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const pl = await jget(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50` +
          `&playlistId=${uploadsId}&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`
      );
      for (const it of pl.items ?? []) {
        const vid = it.contentDetails?.videoId;
        if (vid) ids.push(vid);
      }
      pageToken = pl.nextPageToken;
      pages++;
    } while (pageToken && ids.length < cap && pages < 120);

    // 2. Hydrate in batches of 50 — stats, duration, title, publish date.
    const videos: unknown[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50).join(',');
      const vr = await jget(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${batch}&key=${KEY}`
      );
      for (const v of vr.items ?? []) {
        const dur = isoToSeconds(v.contentDetails?.duration);
        videos.push({
          id: v.id,
          title: v.snippet?.title ?? '',
          description: (v.snippet?.description ?? '').slice(0, 400),
          publishedAt: v.snippet?.publishedAt ?? null,
          durationSec: dur,
          isShort: dur > 0 && dur <= 62,
          views: Number(v.statistics?.viewCount ?? 0),
          likes: Number(v.statistics?.likeCount ?? 0),
          comments: Number(v.statistics?.commentCount ?? 0),
          wasLive: !!v.liveStreamingDetails,
          tags: v.snippet?.tags?.slice(0, 12) ?? [],
        });
      }
    }

    return NextResponse.json(
      {
        channel: {
          id: channelId,
          title: c.snippet?.title,
          handle,
          subscribers: Number(c.statistics?.subscriberCount ?? 0),
          lifetimeViews: Number(c.statistics?.viewCount ?? 0),
          publicVideoCount: Number(c.statistics?.videoCount ?? 0),
          publishedAt: c.snippet?.publishedAt,
        },
        retrieved: videos.length,
        playlistIds: ids.length,
        capped: ids.length >= cap,
        fetchedAt: new Date().toISOString(),
        videos,
      },
      { headers: CORS }
    );
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502, headers: CORS });
  }
}
