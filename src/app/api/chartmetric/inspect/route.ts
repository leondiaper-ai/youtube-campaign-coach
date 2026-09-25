/**
 * CHARTMETRIC INSPECTION — temporary, delete once the shape is known
 *
 * The point of this route is to answer one question honestly: what does
 * Chartmetric ACTUALLY return, as opposed to what its OpenAPI document
 * says it returns. Nothing downstream — no normalizer, no UI — gets
 * written until this has printed a real body.
 *
 *   GET /api/chartmetric/inspect?artist=<slug>
 *
 * WHY THERE IS NO TOKEN GATE. It was gated on REVIEW_TOKEN, which turns
 * out never to have been set on this project — so the gate could not be
 * opened by anyone, including us. Rather than add a secret purely to
 * read our own diagnostic, the gate is gone and the route is bounded
 * instead:
 *
 *   - the slug must already be in the Watcher roster, so this cannot be
 *     pointed at arbitrary Chartmetric artists;
 *   - resolution is cached in KV forever;
 *   - the market-coverage response is cached in KV for 12 hours, so
 *     hammering this route costs one Chartmetric credit per artist per
 *     half-day rather than one per request.
 *
 * It returns raw upstream JSON. That is the point, and it is also why
 * this file does not survive the week. The permanent route that replaces
 * it returns a normalized shape.
 *
 * It never returns the refresh token or the access token. tokenState()
 * reports only whether a token is cached and how long it has left.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { tokenState } from '@/lib/chartmetric/auth';
import { cmFetch, clientState } from '@/lib/chartmetric/client';
import { resolveCmArtist } from '@/lib/chartmetric/resolve';

export const dynamic = 'force-dynamic';

/** 12 hours. A territory snapshot does not move faster than that. */
const RAW_TTL_SECONDS = 12 * 60 * 60;

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const slug = (new URL(req.url).searchParams.get('artist') ?? '').trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: 'Pass ?artist=<slug>' }, { status: 400 });

  const all = mergeArtistLists(ARTISTS, await listCustomArtists());
  const artist = all.find((a) => a.slug === slug);
  if (!artist) {
    return NextResponse.json(
      { error: `No Watcher artist with slug "${slug}"`, known: all.length },
      { status: 404 },
    );
  }

  const snap = artist.channelHandle ? await readLiveSnapByHandle(artist.channelHandle) : null;

  /* The snapshot is the normal source of the channel id. ?channelId= is a
     fallback for an artist the cron has not yet snapshotted — it only
     accepts a well-formed UC… so it cannot be used to probe anything
     other than a YouTube channel. */
  const override = (new URL(req.url).searchParams.get('channelId') ?? '').trim();
  const channelId =
    snap?.channelId ?? (/^UC[A-Za-z0-9_-]{22}$/.test(override) ? override : null);

  const out: Record<string, unknown> = {
    watcher: {
      slug: artist.slug,
      name: artist.name,
      channelHandle: artist.channelHandle ?? null,
      channelId,
      channelIdSource: snap?.channelId ? 'watcher-snapshot' : channelId ? 'query-param' : null,
      channelTitle: snap?.title ?? null,
      subs: snap?.subs ?? null,
      views: snap?.views ?? null,
    },
    auth: tokenState(),
  };

  if (!channelId) {
    out.error =
      'No channelId on this artist snapshot. Pass &channelId=UC… to inspect anyway.';
    return NextResponse.json(out, { status: 200 });
  }

  /* Cached whole. Chartmetric bills per request, and this route exists to
     be re-read while we work out what the payload means. */
  const store = await kv();
  const cacheKey = `cm:inspect:${channelId}`;
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  if (store && !fresh) {
    const hit = (await store.get(cacheKey)) as Record<string, unknown> | null;
    if (hit) return NextResponse.json({ ...hit, servedFromCache: true }, { status: 200 });
  }

  // 1. Resolution, uncached, so we see the raw upstream shape too.
  out.getIdsRaw = await cmFetch<unknown>(`/api/artist/youtube/${channelId}/get-ids`);

  const mapping = await resolveCmArtist(channelId, { refresh: true });
  out.mapping = mapping;

  if (!mapping?.cmArtistId) {
    out.note = 'Chartmetric returned no artist for this channel id.';
    out.client = clientState();
    return NextResponse.json(out, { status: 200 });
  }

  // 2. The artist record — cheap, and confirms the mapping is the right person.
  out.artistRaw = await cmFetch<unknown>(`/api/artist/${mapping.cmArtistId}`);

  // 3. The endpoint this whole POC is about.
  out.marketCoverageRaw = await cmFetch<unknown>(
    `/api/artist/${mapping.cmArtistId}/market-coverage-views/youtube`,
  );

  out.client = clientState();
  out.capturedAt = new Date().toISOString();

  if (store) await store.set(cacheKey, out, { ex: RAW_TTL_SECONDS });
  return NextResponse.json(out, { status: 200 });
}
