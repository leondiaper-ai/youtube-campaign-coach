/* ═══════════════════════════════════════════════════════════════════════
   AUDIENCE RESPONSE FOR ONE ARTIST

   The artist page wants a line about how people are reacting to the latest
   uploads. That reaction has to be read from comments, which costs YouTube
   quota — so it cannot happen during the server render of a page whose
   stated property is that it makes no API calls on load. This endpoint
   exists so the page can ask for it afterwards, and render fine without it.

   Scoped the same way the campaign page scopes it: newest four uploads,
   12-hour cache, rules-version aware. About 4 units per artist per half
   day, and only for artists somebody actually opens.

   What comes back is the fanResponse object unchanged. In particular this
   route does NOT invent a summary sentence: the module's whole argument is
   that a real comment with its like count is better evidence than us
   asserting a conclusion, and that if nothing qualifies the honest output
   is nothing. See the FanResponse type for that reasoning.
   ═══════════════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle, readFanResponse, writeFanResponse } from '@/lib/kvCache';
import {
  RULES_VERSION, assetsToScan, fetchCommentsForAssets, buildFanResponse,
} from '@/lib/intelligence/fanResponse';

export const dynamic = 'force-dynamic';

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const cached = await readFanResponse<{ computedAt?: string; rulesVersion?: number }>(slug);
    const ageMs = cached?.computedAt ? Date.now() - Date.parse(cached.computedAt) : Infinity;
    /* A read computed under older rules is stale however fresh it looks —
       serving it would show a classification the current code would not
       produce, and a stale object is indistinguishable from a new one. */
    if (cached && cached.rulesVersion === RULES_VERSION && ageMs < TWELVE_HOURS) {
      return NextResponse.json({ ok: true, cached: true, fanResponse: cached });
    }

    const all = mergeArtistLists(ARTISTS, await listCustomArtists());
    const artist = all.find(a => a.slug === slug);
    if (!artist?.channelHandle) {
      return NextResponse.json({ ok: false, reason: 'unknown-artist' }, { status: 404 });
    }

    const snap = await readLiveSnapByHandle(artist.channelHandle);
    const uploads = snap?.recentUploads ?? [];
    if (!uploads.length) {
      return NextResponse.json({ ok: true, cached: false, fanResponse: null });
    }

    const assets = uploads.map(u => ({
      videoId: u.id,
      title: u.title,
      publishedAt: u.publishedAt,
      comments: typeof (u as { commentCount?: number }).commentCount === 'number'
        ? (u as { commentCount?: number }).commentCount!
        : null,
    }));

    /* assetsToScan applies the module's own freshness and eligibility
       rules — it is what keeps this from scanning a three-year-old video
       and calling the result a reaction to the latest uploads. */
    const scan = assetsToScan(assets, 4);
    if (!scan.length) {
      return NextResponse.json({ ok: true, cached: false, fanResponse: null });
    }

    const { comments } = await fetchCommentsForAssets(scan.map(a => a.videoId));
    const fr = buildFanResponse(comments, scan);
    await writeFanResponse(slug, fr);

    return NextResponse.json({ ok: true, cached: false, fanResponse: fr });
  } catch {
    /* The artist page must not fail over audience colour. */
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 200 });
  }
}
