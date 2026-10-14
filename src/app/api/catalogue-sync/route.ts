/* Roster-wide catalogue collection.
 *
 *   GET                      what is stored, and which artists are missing
 *   POST { slugs: [...] }    collect those artists
 *   POST { next: 8 }         collect the next N artists with no catalogue
 *
 * Reuses the existing /api/full-catalogue fetch path rather than
 * reimplementing pagination. Writes only under `cat:`; the daily cron,
 * `live:`, `chanmap:` and `sync:` are untouched.
 *
 * QUOTA. One unit per 50-video playlist page plus one per 50-video detail
 * batch, so a 155-video channel costs 8 and a 509-video channel 22. The
 * whole Virgin roster is roughly 1,700 against a 10,000/day budget — but
 * it is batched and manual so one request can never run away with it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAllArtists } from '@/lib/marketScope';
import type { Artist } from '@/lib/artists';
import {
  writeCatalogue, readCatalogueIndex, type ArtistCatalogue, type CatalogueVideo,
} from '@/lib/catalogueStore';
import { fetchFullCatalogue } from '@/lib/fullCatalogue';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Stop a single request from spending more than this, in API units. */
const UNIT_CEILING = 400;
const MAX_PER_REQUEST = 12;

function estimateUnits(videos: number) {
  return Math.ceil(videos / 50) * 2;
}

export async function GET() {
  const artists = (await getAllArtists()).filter((a: Artist) => !!a.channelHandle);
  const index = await readCatalogueIndex();
  const have = new Set(index.map(e => e.slug));
  const missing = artists.filter(a => !have.has(a.slug));
  return NextResponse.json({
    artists: artists.length,
    stored: index.length,
    storedVideos: index.reduce((n, e) => n + e.retrieved, 0),
    capped: index.filter(e => e.capped).map(e => e.slug),
    missing: missing.map(a => ({ slug: a.slug, name: a.name, handle: a.channelHandle })),
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as any;
  const artists = (await getAllArtists()).filter((a: Artist) => !!a.channelHandle);

  let targets: Artist[];
  if (Array.isArray(body?.slugs) && body.slugs.length) {
    targets = artists.filter(a => body.slugs.includes(a.slug));
  } else {
    const have = new Set((await readCatalogueIndex()).map(e => e.slug));
    const n = Math.min(MAX_PER_REQUEST, Math.max(1, Number(body?.next) || 8));
    targets = artists.filter(a => !have.has(a.slug)).slice(0, n);
  }
  targets = targets.slice(0, MAX_PER_REQUEST);

  const results: any[] = [];
  let units = 0;

  for (const a of targets) {
    if (units >= UNIT_CEILING) {
      results.push({ slug: a.slug, skipped: 'unit ceiling reached for this request' });
      continue;
    }
    try {
      /* Called directly rather than over HTTP to this deployment's own
         origin. The first version used fetch and every request came back
         as an HTML login page — Vercel Deployment Protection guards the
         preview, and a deployment calling itself is just another
         unauthenticated client. */
      const j = await fetchFullCatalogue(a.channelHandle!);
      const videos: CatalogueVideo[] = j.videos.map((v: any) => ({
        id: v.id, title: v.title, publishedAt: v.publishedAt ?? '',
        durationSec: v.durationSec ?? 0, isShort: !!v.isShort,
        views: v.views ?? 0, likes: v.likes ?? null, comments: v.comments ?? null,
        wasLive: !!v.wasLive,
      }));
      const dates = videos.map(v => v.publishedAt).filter(Boolean).sort();
      const cat: ArtistCatalogue = {
        slug: a.slug, handle: a.channelHandle!, channelId: j.channel?.id ?? null,
        capped: !!j.capped, retrieved: videos.length, fetchedAt: new Date().toISOString(),
        oldest: dates[0] ?? null, newest: dates[dates.length - 1] ?? null,
        videos,
      };
      const saved = await writeCatalogue(cat);
      units += estimateUnits(videos.length);
      results.push({ slug: a.slug, name: a.name, retrieved: videos.length, capped: cat.capped, saved });
    } catch (e: any) {
      results.push({ slug: a.slug, error: String(e?.message ?? e).slice(0, 160) });
    }
  }

  const index = await readCatalogueIndex();
  return NextResponse.json({
    collected: results.filter(r => r.saved).length,
    estimatedUnits: units,
    results,
    storedTotal: index.length,
    remaining: artists.length - index.length,
  }, { headers: { 'cache-control': 'no-store' } });
}
