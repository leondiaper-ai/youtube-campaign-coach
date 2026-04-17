import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver } from '@/lib/snapshots';

/**
 * GET /api/artist-live?slug=k-trap
 *
 * Resolves an artist slug → channelHandle → live YouTube data.
 * Returns a payload the Coach can consume directly for its decision engine,
 * metric cards, and baseline tracking — replacing the dead NEXT_PUBLIC_WATCHER_URL
 * env-var approach.
 */
export const revalidate = 600;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });

  // 1. Resolve slug → Artist record
  const custom = await listCustomArtists();
  const artist = ARTISTS.find((a) => a.slug === slug) ?? custom.find((a) => a.slug === slug);
  if (!artist) return NextResponse.json({ error: `Unknown artist slug: ${slug}` }, { status: 404 });

  const handle = artist.channelHandle ?? artist.name;
  if (!handle) return NextResponse.json({ error: 'No channel handle for this artist' }, { status: 404 });

  // 2. Fetch live YouTube data via existing channel API lib
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 503 });
  }
  const snap = await fetchChannelSnap(handle);
  if (!snap) return NextResponse.json({ error: 'Fetch returned null' }, { status: 502 });
  if (snap.error) return NextResponse.json({ error: snap.error }, { status: 502 });

  // 3. Read history for delta calculations
  const history = snap.channelId ? await readHistory(snap.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const subs30 = deltaOver(history, 30, 'subs');
  const views7 = deltaOver(history, 7, 'views');

  // 4. Derive counts from recentUploads (7d, 14d breakdowns)
  const now = Date.now();
  const uploads = snap.recentUploads ?? [];
  const uploadsLast7Days = uploads.filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 7
  ).length;
  const uploadsLast14Days = uploads.filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 14
  ).length;
  const shortsLast14Days = uploads.filter(
    (u) =>
      (now - new Date(u.publishedAt).getTime()) / 86400000 <= 14 &&
      u.durationSec <= 62
  ).length;
  const videosLast14Days = uploadsLast14Days - shortsLast14Days;

  // 5. Find top video in last 14 days
  const recent14d = uploads.filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 14
  );
  const topVideo = recent14d.length > 0
    ? recent14d.reduce((best, u) => (u.viewCount > best.viewCount ? u : best), recent14d[0])
    : null;

  const daysSinceLastUpload = snap.lastUploadAt
    ? Math.floor((now - new Date(snap.lastUploadAt).getTime()) / 86400000)
    : null;

  // ── Classify video type from title ─────────────────────────────────────
  function classifyVideoType(title: string): 'official' | 'lyric' | 'visualizer' | 'audio' | 'live' | 'unknown' {
    const t = title.toLowerCase();
    if (/\b(official\s*(music\s*)?video)\b/.test(t)) return 'official';
    if (/\b(official\s*audio)\b/.test(t)) return 'audio';
    if (/\b(lyric\s*(video)?|lyrics?\s*video)\b/.test(t)) return 'lyric';
    if (/\b(visuali[sz]er|official\s*visuali[sz]er)\b/.test(t)) return 'visualizer';
    if (/\b(live\s*(at|from|in|session|performance)|tiny\s*desk|concert)\b/.test(t)) return 'live';
    // "Session" alone (e.g. "Magic Box Dundee Session") → live performance
    if (/\bsession\b/.test(t)) return 'live';
    // "(Official)" alone without "video"/"audio" → official music video
    // On YouTube this almost always means the primary official release
    if (/\(official\)/.test(t)) return 'official';
    return 'unknown';
  }

  // 6. Build a WatcherState-compatible object for the Coach's decision engine
  const state = {
    channelId: snap.channelId ?? '',
    subscriberCount: snap.subs ?? 0,
    subscriberDelta: subs7?.delta ?? null,
    viewCount: snap.views ?? 0,
    viewDelta: views7?.delta ?? null,
    videoCount: uploads.length,
    lastUploadDate: snap.lastUploadAt ?? null,
    uploadsLast7Days,
    uploadsLast14Days,
    shortsLast14Days,
    videosLast14Days,
    daysSinceLastUpload,
    checkedAt: new Date().toISOString(),
    topVideoLast14d: topVideo
      ? {
          videoId: topVideo.id,
          title: topVideo.title,
          views: topVideo.viewCount,
          publishedAt: topVideo.publishedAt,
          videoType: classifyVideoType(topVideo.title),
        }
      : null,
    // Include ALL uploads — no cap on shorts. The full campaign window of
    // shorts is needed for warm-up tracking and campaign cadence reporting.
    latestVideos: (() => {
      const combined = uploads;
      return combined.map((u) => ({
        videoId: u.id,
        title: u.title,
        publishedAt: u.publishedAt,
        durationSeconds: u.durationSec,
        thumbnail: null,
        kind: (u.durationSec <= 62 ? 'short' : 'video') as 'short' | 'video',
        videoType: classifyVideoType(u.title),
        views: u.viewCount,
        likes: u.likeCount,
        comments: u.commentCount,
      }));
    })(),
  };

  return NextResponse.json({
    artist: {
      slug: artist.slug,
      name: artist.name,
      channelHandle: artist.channelHandle,
      phase: artist.phase,
    },
    state,
    subs7,
    subs30,
    views7,
    historyDays: history.length,
  });
}
