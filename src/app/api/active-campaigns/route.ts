import { NextRequest, NextResponse } from 'next/server';
import { listPinned, pinCampaign, unpinCampaign, saveBaseline, type CampaignBaseline } from '@/lib/campaignStore';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists, addCustomArtist } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { deriveFromLive } from '@/lib/artists';
import { resolveMarket, marketToday } from '@/lib/market';

export const dynamic = 'force-dynamic';

/**
 * Pins decide who appears on a market's Priority Campaigns page, so every
 * verb here is market-scoped. `?market=` or a `market` body field selects it;
 * omitting it means UK, which keeps every existing caller working unchanged.
 */
function marketOf(req: NextRequest, body?: unknown): string {
  const fromBody =
    body && typeof body === 'object' && 'market' in body
      ? (body as { market?: unknown }).market
      : undefined;
  return resolveMarket(
    (typeof fromBody === 'string' ? fromBody : null) ??
      req.nextUrl.searchParams.get('market'),
  ).id;
}

/** GET /api/active-campaigns — list pinned campaigns for a market */
export async function GET(req: NextRequest) {
  const market = marketOf(req);
  const pinned = await listPinned(market);
  return NextResponse.json({ pinned, market });
}

/** POST /api/active-campaigns — pin a campaign { slug, priority?, market? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  const market = marketOf(req, body);
  const priority = body?.priority === 'high' ? 'high' : 'normal';
  const pinned = await pinCampaign(slug, priority, market);

  // Auto-set campaignStartDate if not already set
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const artist = allArtists.find((a) => a.slug === slug);
    if (artist && !artist.campaignStartDate) {
      // The pinner's own calendar day, not the server's. Pinning at 9am in
      // Sydney was previously recorded as yesterday, which shifts every
      // campaign-day calculation that follows by one.
      const today = marketToday(market);
      await addCustomArtist({ ...artist, campaignStartDate: today });
    }
  } catch (e) {
    console.warn('[auto-date] Failed to set campaignStartDate:', e);
  }

  // Capture baseline snapshot at pin time
  try {
    const custom2 = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom2);
    const artist = allArtists.find((a) => a.slug === slug);
    if (artist) {
      const handle = artist.channelHandle ?? artist.name;
      if (handle) {
        const snap = await readLiveSnapByHandle(handle);
        if (snap && !snap.error && snap.subs != null) {
          const derived = deriveFromLive(snap);
          const baseline: CampaignBaseline = {
            capturedAt: new Date().toISOString(),
            subs: snap.subs!,   // guarded by snap.subs != null check above
            views: snap.views ?? 0, // views may be null even when subs exist
            uploads30d: snap.uploads30d ?? 0,
            channelState: derived?.status ?? 'COLD',
          };
          await saveBaseline(slug, baseline);
        }
      }
    }
  } catch (e) {
    // Non-critical — don't block the pin
    console.warn('[baseline] Failed to capture:', e);
  }

  return NextResponse.json({ pinned, market });
}

/** DELETE /api/active-campaigns?slug=x&market=uk — unpin a campaign */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const market = marketOf(req);
  const pinned = await unpinCampaign(slug, market);
  return NextResponse.json({ pinned });
}
