/* Fetch every public upload on a channel.
 *
 * Extracted from /api/full-catalogue so a server-side caller can use it
 * WITHOUT an HTTP round trip to its own origin. The roster sync originally
 * called that route over fetch and every request came back as an HTML login
 * page: Vercel Deployment Protection guards preview deployments, and a
 * deployment calling itself is just another unauthenticated client. Calling
 * the function directly removes the hop, the auth problem and the latency
 * together.
 *
 * Quota: 1 unit per 50-video playlist page + 1 unit per 50-video detail
 * batch. A 155-video channel costs 8; a 509-video channel 22.
 */

import { resolveChannelId, resolveChannelIdWithSearch } from '@/lib/youtube';

export interface FullCatalogueVideo {
  id: string; title: string; publishedAt: string | null;
  durationSec: number; isShort: boolean;
  views: number; likes: number; comments: number;
  wasLive: boolean; scheduledStart: string | null; actualStart: string | null;
}

export interface FullCatalogueResult {
  channel: { id: string; title?: string; handle: string; subscribers: number; lifetimeViews: number; publicVideoCount: number };
  retrieved: number; playlistIds: number; capped: boolean; fetchedAt: string;
  videos: FullCatalogueVideo[];
}

const isoToSeconds = (iso: string): number => {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  return m ? (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)) : 0;
};

async function jget(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`YouTube API ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

export async function fetchFullCatalogue(
  handle: string,
  { cap = 2000 }: { cap?: number } = {},
): Promise<FullCatalogueResult> {
  const KEY = process.env.YOUTUBE_API_KEY;
  if (!KEY) throw new Error('YOUTUBE_API_KEY not configured');

  const channelId = (await resolveChannelId(handle)) ?? (await resolveChannelIdWithSearch(handle));
  if (!channelId) throw new Error(`could not resolve ${handle}`);

  const ch = await jget(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails,snippet&id=${channelId}&key=${KEY}`,
  );
  const c = ch.items?.[0];
  if (!c) throw new Error('channel not found');
  const uploadsId = c.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('no uploads playlist');

  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const pl = await jget(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50` +
      `&playlistId=${uploadsId}&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    for (const it of pl.items ?? []) {
      const vid = it.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = pl.nextPageToken;
    pages++;
  } while (pageToken && ids.length < cap && pages < 120);

  const videos: FullCatalogueVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',');
    const vr = await jget(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${batch}&key=${KEY}`,
    );
    for (const v of vr.items ?? []) {
      const dur = isoToSeconds(v.contentDetails?.duration);
      videos.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        publishedAt: v.snippet?.publishedAt ?? null,
        durationSec: dur,
        isShort: dur > 0 && dur <= 62,
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
        wasLive: !!v.liveStreamingDetails,
        scheduledStart: v.liveStreamingDetails?.scheduledStartTime ?? null,
        actualStart: v.liveStreamingDetails?.actualStartTime ?? null,
      });
    }
  }

  return {
    channel: {
      id: channelId, title: c.snippet?.title, handle,
      subscribers: Number(c.statistics?.subscriberCount ?? 0),
      lifetimeViews: Number(c.statistics?.viewCount ?? 0),
      publicVideoCount: Number(c.statistics?.videoCount ?? 0),
    },
    retrieved: videos.length,
    playlistIds: ids.length,
    capped: ids.length >= cap,
    fetchedAt: new Date().toISOString(),
    videos,
  };
}
