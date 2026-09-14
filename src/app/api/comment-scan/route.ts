import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/comment-scan?ids=abc,def&max=40&order=relevance
 *
 * Public top-level comments for a list of videos, for audience research.
 *
 * Why this exists: the channel sync already pulls 5 comments per artist via
 * fetchTopComments(), which is enough to show a pull-quote on a card and far
 * too few to read a fanbase. Understanding what people actually say about an
 * artist — which lines they quote, which songs they name, what they ask for —
 * needs tens of comments across a dozen videos, and it needs the raw text
 * rather than a sentiment score.
 *
 * Deliberately NOT part of the cron. commentThreads costs 1 unit per call, so
 * a 15-video scan is 15 units — trivial once, meaningful every day across ~140
 * channels. This route is uncached and called by hand during analysis.
 *
 * Returns the comment text verbatim (HTML stripped) plus like counts, so the
 * analysis can quote people rather than paraphrase them. No sentiment scoring
 * happens here: reading the comments is the point.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const KEY = process.env.YOUTUBE_API_KEY;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type Thread = {
  items?: Array<{
    snippet?: {
      totalReplyCount?: number;
      topLevelComment?: {
        snippet?: {
          textDisplay?: string;
          likeCount?: number;
          authorDisplayName?: string;
          publishedAt?: string;
        };
      };
    };
  }>;
};

export async function GET(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500, headers: CORS });
  }

  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'missing ids' }, { status: 400, headers: CORS });
  }

  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const max = Math.min(Number(req.nextUrl.searchParams.get('max') || 40), 100);
  /**
   * relevance returns YouTube's own ranking, which surfaces the comments a
   * visitor actually sees. `time` returns newest-first, which is the right
   * order for "what are people saying about the upload we posted on Tuesday".
   */
  const order = req.nextUrl.searchParams.get('order') === 'time' ? 'time' : 'relevance';

  const out: Record<string, unknown> = {};
  let disabled = 0;

  for (const id of ids) {
    try {
      const url =
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet` +
        `&order=${order}&maxResults=${max}&videoId=${encodeURIComponent(id)}&key=${KEY}`;
      const r = await fetch(url, { cache: 'no-store' });

      if (!r.ok) {
        /* 403 here is almost always "comments are disabled on this video",
           which is a finding rather than an error — record it and carry on. */
        out[id] = { error: r.status === 403 ? 'comments_disabled_or_forbidden' : `http_${r.status}` };
        if (r.status === 403) disabled++;
        continue;
      }

      const j = (await r.json()) as Thread;
      out[id] = (j.items ?? [])
        .map((it) => {
          const s = it.snippet?.topLevelComment?.snippet;
          if (!s?.textDisplay) return null;
          return {
            text: s.textDisplay.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 500),
            likes: Number(s.likeCount ?? 0),
            replies: Number(it.snippet?.totalReplyCount ?? 0),
            at: (s.publishedAt ?? '').slice(0, 10),
          };
        })
        .filter(Boolean);
    } catch (e) {
      out[id] = { error: String(e).slice(0, 120) };
    }
  }

  return NextResponse.json(
    { fetchedAt: new Date().toISOString(), order, requested: ids.length, commentsDisabled: disabled, comments: out },
    { headers: CORS }
  );
}
