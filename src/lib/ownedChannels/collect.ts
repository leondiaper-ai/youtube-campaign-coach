import { validChannelId } from './channels';
import { buildLibraryStats, KEEP_NEWEST, KEEP_TOP, UPLOAD_SWEEP_CAP } from './metrics';
import type { OwnedSnapshot, OwnedVideo } from './metrics';

type YtItem = {
  id: string; snippet?: { title?: string; publishedAt?: string; liveBroadcastContent?: string;
    thumbnails?: { default?: { url?: string } }; resourceId?: { videoId?: string } };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string; videoCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string }; duration?: string; videoPublishedAt?: string; videoId?: string };
};
const count = (v: string | undefined) => v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
const duration = (s?: string) => {
  const m = s?.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null;
};

/* The sweep walks the whole uploads list — these channels run to 6,500
   uploads, so any cap low enough to keep storage sane was also low enough
   to miss the handful of videos actually bringing the views. Paging is
   cheap (one unit per fifty), so the sweep reads everything, summarises
   it, and keeps only a bounded working set. The ceiling is a stop against
   a runaway channel exhausting the route's 180s budget, not a sample
   size: 10,000 uploads is roughly 400 calls and about 75 seconds. */
const MAX_PAGES = Math.ceil(UPLOAD_SWEEP_CAP / 50);

/** One channel per request. Cheap list calls only: no search.list, no cron changes. */
export async function collectOwnedChannel(id: string): Promise<OwnedSnapshot> {
  if (!validChannelId(id)) throw new Error('Channel ID needs checking (expected 24 characters).');
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube access is not configured for this preview.');
  async function get(resource: string, params: Record<string, string>, emptyOn404 = false): Promise<{ items: YtItem[]; nextPageToken?: string }> {
    const query = new URLSearchParams({ ...params, key: apiKey! });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${resource}?${query}`, {
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    /* A channel that has never published has no uploads playlist, so
       playlistItems answers 404 even though the channel itself resolved.
       That is a real state for a new network, not a collection failure:
       the channel totals are already in hand, and discarding them makes
       an unlaunched channel read as "not collected", which is
       indistinguishable from an outage. */
    if (emptyOn404 && response.status === 404) return { items: [] };
    // Do not echo upstream request URLs or credentials into errors.
    if (!response.ok) throw new Error(`YouTube returned ${response.status}; collection was not saved.`);
    return response.json();
  }
  const { items: channels } = await get('channels', { part: 'snippet,statistics,contentDetails', id });
  const ch = channels[0];
  if (ch?.id !== id) throw new Error('Channel not found. Check the supplied ID.');
  const playlistId = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error('This channel has no public uploads playlist.');
  const collectedAt = new Date().toISOString();
  const cutoff = Date.parse(collectedAt) - 548 * 86400000;
  const ids = new Set<string>();
  let token: string | undefined, reachedEnd = false, reachedWindow = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await get('playlistItems', { part: 'contentDetails,snippet', maxResults: '50', playlistId,
      ...(token ? { pageToken: token } : {}),
    }, true);
    for (const item of result.items) {
      const at = item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt;
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (at && Date.parse(at) < cutoff) reachedWindow = true;
      else if (videoId) ids.add(videoId);
    }
    token = result.nextPageToken;
    reachedEnd = !token;
    if (reachedEnd || reachedWindow) break;
  }
  const items: OwnedVideo[] = [], allIds = Array.from(ids);
  for (let i = 0; i < allIds.length; i += 50) {
    const result = await get('videos', { part: 'snippet,contentDetails,statistics', id: allIds.slice(i, i + 50).join(',') });
    for (const v of result.items) {
      if (!v.snippet?.publishedAt) continue;
      items.push({ id: v.id, title: v.snippet.title ?? v.id, publishedAt: v.snippet.publishedAt,
        durationSec: duration(v.contentDetails?.duration), views: count(v.statistics?.viewCount),
        live: v.snippet.liveBroadcastContent ?? 'none',
        likes: count(v.statistics?.likeCount), comments: count(v.statistics?.commentCount) });
    }
  }
  const library = buildLibraryStats(items, reachedEnd, count(ch.statistics?.videoCount));

  /* Cadence as day tallies rather than as kept uploads. Three hundred
     stored uploads is four days on a channel publishing fifty a day, so
     counting the stored set would under-report a month of output. A few
     hundred integers describes the whole sweep instead. */
  const publishedPerDay: Record<string, number> = {};
  for (const video of items) {
    if (video.live === 'upcoming') continue;
    const day = video.publishedAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) publishedPerDay[day] = (publishedPerDay[day] ?? 0) + 1;
  }

  /* Keep the newest, for cadence and format, and the best, because those
     are what carry these channels. Everything between is already
     summarised above and would only cost storage. */
  const newest = [...items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, KEEP_NEWEST);
  const best = items.filter(v => v.views != null).sort((a, b) => b.views! - a.views!).slice(0, KEEP_TOP);
  const kept = new Map<string, OwnedVideo>();
  for (const video of [...newest, ...best]) kept.set(video.id, video);

  return { channelId: id, title: ch.snippet?.title ?? id,
    thumbnail: ch.snippet?.thumbnails?.default?.url ?? null,
    collectedAt, subs: ch.statistics?.hiddenSubscriberCount ? null : count(ch.statistics?.subscriberCount),
    views: count(ch.statistics?.viewCount), items: Array.from(kept.values()),
    reachedEnd, reachedWindow, library, publishedPerDay };
}
