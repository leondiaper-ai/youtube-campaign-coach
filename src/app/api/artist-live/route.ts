import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory, campaignDelta } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';

/**
 * GET /api/artist-live?slug=k-trap
 *
 * Resolves an artist slug → channelHandle → live YouTube data.
 * Returns a payload the Coach can consume directly for its decision engine,
 * metric cards, and baseline tracking — replacing the dead NEXT_PUBLIC_WATCHER_URL
 * env-var approach.
 */
export const revalidate = 600;

/**
 * Read-only cross-origin access.
 *
 * Standalone artist presentations (e.g. the Amyl signing deck) are plain HTML
 * files opened from disk or served from another host, so they cannot reach this
 * route without CORS. Allowing it here means those decks reuse this single
 * YouTube pipeline instead of shipping an API key inside a file that gets sent
 * to a band or their management.
 *
 * Safe to expose: this endpoint is GET-only and returns public channel figures
 * that anyone can already read off the YouTube page.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400, headers: CORS });

  // 1. Resolve slug → Artist record
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const artist = allArtists.find((a) => a.slug === slug);
  if (!artist) return NextResponse.json({ error: `Unknown artist slug: ${slug}` }, { status: 404, headers: CORS });

  const handle = artist.channelHandle ?? artist.name;
  if (!handle) return NextResponse.json({ error: 'No channel handle for this artist' }, { status: 404, headers: CORS });

  // 2. Read cached YouTube data from KV (zero API calls)
  const snap = await readLiveSnapByHandle(handle);
  if (!snap) return NextResponse.json({ error: 'No cached data yet. Run a sync first.' }, { status: 404, headers: CORS });
  if (snap.error) return NextResponse.json({ error: snap.error }, { status: 502, headers: CORS });

  // 3. Read history and normalize via shared data layer
  const history = snap.channelId ? await readHistory(snap.channelId) : [];
  const campaignStart = artist.campaignStartDate ?? null;
  const nc = normalizeChannelData(snap, history, campaignStart ? {
    campaignName: artist.campaign ?? 'Tracking',
    campaignStartDate: campaignStart,
    isActive: true,
  } : null);

  // Bridge to legacy format for backwards compatibility
  const subs7 = nc.subs7d ? { delta: nc.subs7d.delta, pct: nc.subs7d.pct } : null;
  const subs30 = nc.subs30d ? { delta: nc.subs30d.delta, pct: nc.subs30d.pct } : null;
  const views7 = nc.views7d ? { delta: nc.views7d.delta, pct: nc.views7d.pct } : null;

  // 3b. Campaign-period deltas (if campaignStartDate is set)
  const campaignSubs = campaignStart
    ? campaignDelta(history, campaignStart, 'subs')
    : null;
  const campaignViews = campaignStart
    ? campaignDelta(history, campaignStart, 'views')
    : null;

  // 3c. Campaign content stats — sum views from uploads since campaign start
  const campaignUploads = campaignStart
    ? (snap.recentUploads ?? []).filter(
        (u) => new Date(u.publishedAt).getTime() >= new Date(campaignStart).getTime()
      )
    : [];
  const campaignContentViews = campaignUploads.reduce((sum, u) => sum + u.viewCount, 0);
  const campaignContentCount = campaignUploads.length;
  const campaignShortsCount = campaignUploads.filter((u) => u.durationSec <= 62).length;
  const campaignVideosCount = campaignContentCount - campaignShortsCount;

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
    // "[MUSIC VIDEO]" or "(Music Video)" without "official" — still a primary release
    if (/\bmusic\s*video\b/.test(t)) return 'official';
    return 'unknown';
  }

  // 6. Build a WatcherState-compatible object for the Coach's decision engine
  const state = {
    channelId: snap.channelId ?? '',
    subscriberCount: snap.subs ?? null,
    subscriberDelta: rawDelta(nc.subs7d),
    viewCount: nc.views ?? null,
    viewDelta: rawDelta(nc.views7d),
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
      campaign: artist.campaign ?? null,
      campaignStartDate: campaignStart,
    },
    state,
    subs7,
    subs30,
    views7,
    historyDays: nc.historyDepthDays,
    // Campaign-period tracking
    campaign: campaignStart
      ? {
          startDate: campaignStart,
          name: artist.campaign ?? null,
          subs: campaignSubs,
          views: campaignViews,
          contentViews: campaignContentViews,
          contentCount: campaignContentCount,
          shortsCount: campaignShortsCount,
          videosCount: campaignVideosCount,
          daysSinceStart: Math.floor(
            (Date.now() - new Date(campaignStart).getTime()) / 86400000
          ),
        }
      : null,
  }, { headers: CORS });
}
