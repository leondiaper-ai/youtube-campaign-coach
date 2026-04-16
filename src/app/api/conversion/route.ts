import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory } from '@/lib/snapshots';
import { computeConversion, rateTrend } from '@/lib/conversion';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversion?slug=<slug>     — artist slug (seed or custom)
 *   or
 * GET /api/conversion?channelId=<id>  — direct channel id (bypasses slug lookup)
 *
 * Returns conversion rate for the last 7 and 30 days, plus the trend between
 * them, so the Coach header chip can render a tight summary without the full
 * Watcher context.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const directChannelId = req.nextUrl.searchParams.get('channelId');

  let channelId = directChannelId;

  if (!channelId && slug) {
    const custom = await listCustomArtists();
    const artist = ARTISTS.find((a) => a.slug === slug) ?? custom.find((a) => a.slug === slug);
    if (!artist) {
      return NextResponse.json({ error: `No artist for slug "${slug}"` }, { status: 404 });
    }
    if (!artist.channelHandle) {
      return NextResponse.json({ error: 'Artist has no channel handle' }, { status: 400 });
    }
    // Resolve handle → channelId via fetchChannelSnap (same path the Watcher uses)
    const snap = await fetchChannelSnap(artist.channelHandle);
    channelId = snap?.channelId ?? null;
    if (!channelId) {
      return NextResponse.json({ error: 'Could not resolve channel id' }, { status: 502 });
    }
  }

  if (!channelId) {
    return NextResponse.json({ error: 'Missing slug or channelId' }, { status: 400 });
  }

  const history = await readHistory(channelId);
  const d7 = computeConversion(history, 7);
  const d30 = computeConversion(history, 30);
  const trend = rateTrend(d7, d30);

  return NextResponse.json({
    channelId,
    slug: slug ?? null,
    historyDays: history.length,
    d7,
    d30,
    trend,
  });
}
