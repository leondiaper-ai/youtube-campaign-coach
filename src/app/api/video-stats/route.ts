import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/video-stats?ids=kPnN4IE_a98,x6_mbnsh6VU
 *
 * One live reading for any public video, including videos on channels we
 * do not track.
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 * Everything else in this system is channel-shaped: a roster slug resolves
 * to a handle, the handle to a channel, and the channel to its own uploads.
 * That breaks the moment the interesting asset belongs to somebody else —
 * a festival's upload of a set, a broadcaster's upload of a performance, a
 * label-side lyric video on a partner channel. Those are routinely the
 * assets a campaign actually turned on, and until now they were invisible
 * to us because they are not on the artist's channel.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────
 * One reading, taken now. videos.list returns a lifetime counter and
 * nothing else, so this can say what a video has done in total and can
 * never say what it did yesterday. Where a trajectory is needed, the
 * video has to be in the per-video snapshot series (see videoSnapshots.ts)
 * and read through /api/video-series instead. Callers must not difference
 * two calls to this route and present the result as a daily figure unless
 * they recorded both readings themselves.
 *
 * Cost is 1 unit per call regardless of how many ids, so the cap is about
 * payload sanity rather than quota.
 */
export const dynamic = 'force-dynamic';

const KEY = process.env.YOUTUBE_API_KEY;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type ApiVideo = {
  id?: string;
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

/** ISO-8601 duration → seconds. Only the forms YouTube actually emits. */
function durationSeconds(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

const num = (s: string | undefined) => (s == null ? null : Number(s));

export async function GET(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 500, headers: CORS });
  }

  const raw = req.nextUrl.searchParams.get('ids');
  if (!raw) return NextResponse.json({ error: 'missing ids' }, { status: 400, headers: CORS });

  /* YouTube ids are a fixed alphabet. Filtering here means a malformed id
     cannot reshape the upstream query string. */
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9_-]{11}$/.test(s))
    .slice(0, 50);

  if (!ids.length) {
    return NextResponse.json({ error: 'no valid ids' }, { status: 400, headers: CORS });
  }

  const url =
    'https://www.googleapis.com/youtube/v3/videos'
    + '?part=snippet,statistics,contentDetails'
    + `&id=${ids.join(',')}&key=${KEY}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json(
      { error: 'youtube_error', status: res.status },
      { status: 502, headers: CORS },
    );
  }

  const body = (await res.json()) as { items?: ApiVideo[] };
  const found = new Map((body.items ?? []).map((v) => [v.id, v]));

  const videos = ids.map((id) => {
    const v = found.get(id);
    /* An id that returns nothing is private, deleted, or wrong. Saying so
       is more useful than omitting the row, because the caller asked
       about this specific video for a reason. */
    if (!v) return { videoId: id, found: false };
    const secs = durationSeconds(v.contentDetails?.duration);
    return {
      videoId: id,
      found: true,
      title: v.snippet?.title ?? null,
      channelId: v.snippet?.channelId ?? null,
      channelTitle: v.snippet?.channelTitle ?? null,
      publishedAt: v.snippet?.publishedAt ?? null,
      durationSeconds: secs,
      isShort: secs != null && secs <= 60,
      views: num(v.statistics?.viewCount),
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
    };
  });

  return NextResponse.json(
    {
      readAt: new Date().toISOString(),
      note: 'Lifetime counters at readAt. One reading, not a series.',
      videos,
    },
    { headers: CORS },
  );
}
