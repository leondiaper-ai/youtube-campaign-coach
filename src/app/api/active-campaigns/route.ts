import { NextRequest, NextResponse } from 'next/server';
import { listPinned, pinCampaign, unpinCampaign, saveBaseline, type CampaignBaseline } from '@/lib/campaignStore';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists, addCustomArtist } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { deriveFromLive } from '@/lib/artists';

export const dynamic = 'force-dynamic';

/** GET /api/active-campaigns — list all pinned campaigns */
export async function GET() {
  const pinned = await listPinned();
  return NextResponse.json({ pinned });
}

/** POST /api/active-campaigns — pin a campaign { slug, priority? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  const priority = body?.priority === 'high' ? 'high' : 'normal';
  const pinned = await pinCampaign(slug, priority);

  // Auto-set campaignStartDate if not already set
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const artist = allArtists.find((a) => a.slug === slug);
    if (artist && !artist.campaignStartDate) {
      const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
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

  return NextResponse.json({ pinned });
}

/** DELETE /api/active-campaigns?slug=x — unpin a campaign */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const pinned = await unpinCampaign(slug);
  return NextResponse.json({ pinned });
}
