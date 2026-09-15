import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/channel-shelf?channelId=UC...
 *
 * How a channel has ORGANISED itself publicly: its playlists, and the
 * sections pinned to its homepage.
 *
 * Why this exists: every other route here answers "what did they publish".
 * None of them answer "what did they do with it afterwards". Playlists and
 * homepage sections are the two parts of channel housekeeping that are
 * publicly observable, and they are a real signal — a campaign that ships
 * forty assets and leaves them in a single reverse-chronological pile is a
 * different campaign from one that groups them so a new viewer can find the
 * album, the live material and the films as three separate things.
 *
 * Deliberately NOT part of the cron. playlists.list is 1 unit per page and
 * this is called by hand during an analysis, the same discipline as
 * /api/comment-scan.
 *
 * LIMITS, because this is easy to over-read. The API exposes playlists and
 * channelSections, and nothing else about presentation. It does NOT expose
 * end screens, cards, the Community tab, or the channel trailer's
 * performance. Absence of a playlist here means the playlist is not public,
 * which is not the same as it not existing.
 */
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const KEY = process.env.YOUTUBE_API_KEY;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type PlaylistItem = {
  id?: string;
  snippet?: { title?: string; publishedAt?: string; description?: string };
  contentDetails?: { itemCount?: number };
};
type SectionItem = {
  snippet?: { type?: string; position?: number };
  contentDetails?: { playlists?: string[]; channels?: string[] };
};

export async function GET(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500, headers: CORS });
  }
  const channelId = req.nextUrl.searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'missing channelId' }, { status: 400, headers: CORS });
  }

  try {
    /* Playlists, paginated — a heritage channel can have more than 50. */
    const playlists: Array<{ id: string; title: string; count: number; published: string }> = [];
    let pageToken = '';
    for (let guard = 0; guard < 10; guard++) {
      const url =
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails` +
        `&channelId=${encodeURIComponent(channelId)}&maxResults=50&key=${KEY}` +
        (pageToken ? `&pageToken=${pageToken}` : '');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) break;
      const j = (await r.json()) as { items?: PlaylistItem[]; nextPageToken?: string };
      (j.items ?? []).forEach((p) => {
        playlists.push({
          id: p.id ?? '',
          title: p.snippet?.title ?? '',
          count: Number(p.contentDetails?.itemCount ?? 0),
          published: (p.snippet?.publishedAt ?? '').slice(0, 10),
        });
      });
      if (!j.nextPageToken) break;
      pageToken = j.nextPageToken;
    }

    /* Homepage sections — how the channel front page is arranged. */
    let sections: Array<{ type: string; position: number; playlists: number }> = [];
    const sr = await fetch(
      `https://www.googleapis.com/youtube/v3/channelSections?part=snippet,contentDetails` +
        `&channelId=${encodeURIComponent(channelId)}&key=${KEY}`,
      { cache: 'no-store' }
    );
    if (sr.ok) {
      const sj = (await sr.json()) as { items?: SectionItem[] };
      sections = (sj.items ?? []).map((s) => ({
        type: s.snippet?.type ?? 'unknown',
        position: Number(s.snippet?.position ?? 0),
        playlists: (s.contentDetails?.playlists ?? []).length,
      }));
    }

    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        channelId,
        playlistCount: playlists.length,
        playlists: playlists.sort((a, b) => (a.published < b.published ? 1 : -1)),
        sectionCount: sections.length,
        sections: sections.sort((a, b) => a.position - b.position),
        note:
          'Public playlists and homepage sections only. End screens, cards, the Community tab ' +
          'and channel trailer data are not exposed by the public API and are not represented here. ' +
          'A playlist absent from this list is not public; that is not the same as not existing.',
      },
      { headers: CORS }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500, headers: CORS });
  }
}
