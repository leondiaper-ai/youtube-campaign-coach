import type { LiveSnap, RecentUpload } from './artists';
import {
  writeSnapshot,
  readTopEverCache,
  writeTopEverCache,
} from './snapshots';

const KEY = process.env.YOUTUBE_API_KEY;

async function jget(url: string) {
  const r = await fetch(url, { next: { revalidate: 600 } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function parseDuration(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return (+(m?.[1] ?? 0)) * 3600 + (+(m?.[2] ?? 0)) * 60 + (+(m?.[3] ?? 0));
}

// Pull the core track name from an upload title by stripping common suffixes
// like "(Official Video)", "[Lyric Video]", "- Visualizer", "| Audio", etc.
function normaliseTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(
      /\b(official\s*(music\s*)?video|lyric(s)?\s*video|lyrics?|visualiz(er|ation)|audio(\s*only)?|mv|live|acoustic|performance|session|premiere|short|teaser|trailer|snippet|clip|remix|instrumental|radio\s*edit|extended|sped\s*up|slowed)\b/g,
      ' '
    )
    .replace(/[-–—_:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleHasTag(title: string, tag: RegExp): boolean {
  return tag.test(title.toLowerCase());
}

const LYRIC_RX = /\blyric(s)?\b/;
const VISUALIZER_RX = /\bvisualiz(er|ation)\b/;
const AUDIO_RX = /\baudio\b/;

type CommentRes = { items?: Array<{ snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; likeCount?: number; authorDisplayName?: string } } } }> };

async function fetchTopComments(videoId: string, max = 5) {
  try {
    const j = (await jget(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&order=relevance&maxResults=${max}&videoId=${videoId}&key=${KEY}`
    )) as CommentRes;
    return (j.items ?? [])
      .map((it) => {
        const s = it.snippet?.topLevelComment?.snippet;
        if (!s?.textDisplay) return null;
        return {
          text: s.textDisplay.replace(/<[^>]+>/g, '').slice(0, 300),
          likeCount: Number(s.likeCount ?? 0),
          authorName: s.authorDisplayName ?? '',
        };
      })
      .filter(Boolean) as { text: string; likeCount: number; authorName: string }[];
  } catch {
    return [];
  }
}

const TOP_EVER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function fetchTopEverVideos(
  channelId: string,
  recentUploads: RecentUpload[]
): Promise<RecentUpload[]> {
  if (!KEY) return [];
  try {
    // Try cache first
    const cache = await readTopEverCache(channelId);
    let videoIds: string[] = [];
    const fresh =
      cache && Date.now() - new Date(cache.fetchedAt).getTime() < TOP_EVER_TTL_MS;
    if (fresh && cache?.videoIds?.length) {
      videoIds = cache.videoIds;
    } else {
      // search.list ordered by viewCount — returns the channel's all-time top videos
      const s = await jget(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&order=viewCount&type=video&maxResults=10&key=${KEY}`
      );
      videoIds = (s.items ?? [])
        .map((it: any) => it.id?.videoId)
        .filter(Boolean);
      if (videoIds.length) {
        writeTopEverCache(channelId, videoIds).catch(() => {});
      }
    }
    if (!videoIds.length) return [];

    // Reuse any already-detailed uploads from recent to save quota
    const recentById = new Map(recentUploads.map((u) => [u.id, u]));
    const toFetch = videoIds.filter((id) => !recentById.has(id));

    const fetched: RecentUpload[] = [];
    if (toFetch.length) {
      const vj = await jget(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics,liveStreamingDetails&id=${toFetch.join(',')}&key=${KEY}`
      );
      for (const v of vj.items ?? []) {
        fetched.push({
          id: v.id,
          title: v.snippet?.title ?? '',
          description: v.snippet?.description ?? '',
          publishedAt: v.snippet?.publishedAt ?? '',
          durationSec: parseDuration(v.contentDetails?.duration),
          live: v.snippet?.liveBroadcastContent ?? 'none',
          scheduledStart: v.liveStreamingDetails?.scheduledStartTime ?? null,
          captions: v.contentDetails?.caption === 'true',
          viewCount: Number(v.statistics?.viewCount ?? 0),
          likeCount: Number(v.statistics?.likeCount ?? 0),
          commentCount: Number(v.statistics?.commentCount ?? 0),
        });
      }
    }

    // Assemble in the search-returned order (views desc)
    const assembled: RecentUpload[] = videoIds
      .map((id) => recentById.get(id) ?? fetched.find((f) => f.id === id))
      .filter(Boolean) as RecentUpload[];

    // Sibling detection across the combined set (recent + top-ever)
    const combined = [...recentUploads, ...assembled.filter((a) => !recentById.has(a.id))];
    const normed = combined.map((u) => ({
      u,
      key: normaliseTitle(u.title),
      ts: new Date(u.publishedAt).getTime(),
    }));
    for (const row of normed) {
      if (!videoIds.includes(row.u.id)) continue;
      const siblings = normed.filter(
        (o) => o !== row && o.key && row.key && (o.key.includes(row.key) || row.key.includes(o.key))
      );
      row.u.hasLyricSibling = siblings.some((s) => titleHasTag(s.u.title, LYRIC_RX));
      row.u.hasVisualizerSibling = siblings.some((s) => titleHasTag(s.u.title, VISUALIZER_RX));
      row.u.hasAudioSibling = siblings.some((s) => titleHasTag(s.u.title, AUDIO_RX));
      row.u.hasShortSibling = siblings.some(
        (s) => s.u.durationSec > 0 && s.u.durationSec <= 60 &&
          Math.abs(s.ts - row.ts) <= 14 * 86400000
      );
      row.u.isTopPerformer = true;
    }

    // Top comments for top 3 all-time (cheap: 3 more units when cache is cold)
    const top3 = assembled.slice(0, 3);
    const results = await Promise.all(top3.map((u) => fetchTopComments(u.id, 5)));
    top3.forEach((u, i) => {
      u.topComments = results[i];
    });

    return assembled;
  } catch {
    return [];
  }
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
    const recentUploads: NonNullable<LiveSnap['recentUploads']> = [];
    let shorts30d = 0;
    let upcomingCount = 0;
    let captionsMissing30d = 0;
    const missingCaptionsVideos: NonNullable<LiveSnap['missingCaptionsVideos']> = [];

    if (uploadsId) {
      const pl = await jget(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${KEY}`
      );
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const ids: string[] = [];
      for (const it of pl.items ?? []) {
        const t = it.snippet?.publishedAt;
        const vid = it.snippet?.resourceId?.videoId;
        if (!t || !vid) continue;
        if (!lastUploadAt || t > lastUploadAt) lastUploadAt = t;
        if (new Date(t).getTime() >= cutoff) uploads30d++;
        ids.push(vid);
      }
      const sliceIds = ids.slice(0, 50);
      if (sliceIds.length) {
        const vj = await jget(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics,liveStreamingDetails&id=${sliceIds.join(',')}&key=${KEY}`
        );
        for (const v of vj.items ?? []) {
          const dur = parseDuration(v.contentDetails?.duration);
          const publishedAt = v.snippet?.publishedAt ?? '';
          const live = v.snippet?.liveBroadcastContent ?? 'none';
          const scheduledStart = v.liveStreamingDetails?.scheduledStartTime ?? null;
          const captions = v.contentDetails?.caption === 'true';
          const viewCount = Number(v.statistics?.viewCount ?? 0);
          const likeCount = Number(v.statistics?.likeCount ?? 0);
          const commentCount = Number(v.statistics?.commentCount ?? 0);
          recentUploads.push({
            id: v.id,
            title: v.snippet?.title ?? '',
            description: v.snippet?.description ?? '',
            publishedAt,
            durationSec: dur,
            live,
            scheduledStart,
            captions,
            viewCount,
            likeCount,
            commentCount,
          });
          const ageDays =
            (Date.now() - new Date(publishedAt).getTime()) / 86400000;
          if (ageDays <= 30 && dur > 0 && dur <= 60) shorts30d++;
          if (ageDays <= 30 && !captions && live === 'none') {
            captionsMissing30d++;
            missingCaptionsVideos.push({
              id: v.id,
              title: v.snippet?.title ?? '',
              viewCount,
            });
          }
          if (live === 'upcoming') upcomingCount++;
        }

        // ---- Sibling detection (per upload, across recent window) ----
        const normed = recentUploads.map((u) => ({
          u,
          key: normaliseTitle(u.title),
          ts: new Date(u.publishedAt).getTime(),
        }));
        for (const row of normed) {
          const siblings = normed.filter(
            (o) => o !== row && o.key && row.key && (o.key.includes(row.key) || row.key.includes(o.key))
          );
          row.u.hasLyricSibling = siblings.some((s) => titleHasTag(s.u.title, LYRIC_RX));
          row.u.hasVisualizerSibling = siblings.some((s) => titleHasTag(s.u.title, VISUALIZER_RX));
          row.u.hasAudioSibling = siblings.some((s) => titleHasTag(s.u.title, AUDIO_RX));
          row.u.hasShortSibling = siblings.some(
            (s) => s.u.durationSec > 0 && s.u.durationSec <= 60 &&
              Math.abs(s.ts - row.ts) <= 14 * 86400000
          );
        }

        // ---- Top performer flagging (long-form, non-live) ----
        const longform = recentUploads.filter((u) => u.live === 'none' && u.durationSec > 60);
        if (longform.length >= 3) {
          const sorted = [...longform.map((u) => u.viewCount)].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] || 0;
          for (const u of longform) {
            if (median > 0 && u.viewCount >= median * 2) u.isTopPerformer = true;
          }
        }

        // ---- Top comments for top 3 performers (by views) ----
        const topPerformers = [...recentUploads]
          .filter((u) => u.isTopPerformer)
          .sort((a, b) => b.viewCount - a.viewCount)
          .slice(0, 3);
        if (topPerformers.length) {
          const results = await Promise.all(
            topPerformers.map((u) => fetchTopComments(u.id, 5))
          );
          topPerformers.forEach((u, i) => {
            u.topComments = results[i];
          });
        }
      }
    }

    // ---- All-time top-10 (weekly cache) ----
    const topEverVideos = await fetchTopEverVideos(channelId, recentUploads);

    const snap: LiveSnap = {
      channelId,
      title: item.snippet?.title,
      handle: item.snippet?.customUrl,
      subs: Number(item.statistics?.subscriberCount ?? 0),
      views: Number(item.statistics?.viewCount ?? 0),
      uploads30d,
      lastUploadAt,
      thumbnail: item.snippet?.thumbnails?.default?.url,
      recentUploads,
      topEverVideos,
      shorts30d,
      upcomingCount,
      captionsMissing30d,
      missingCaptionsVideos,
    };

    // Fire-and-forget time-series write (KV-backed, no-op if unconfigured)
    writeSnapshot(channelId, snap).catch(() => {});

    return snap;
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}
