/**
 * CHARTMETRIC INSPECTION — temporary, token-gated, delete when done
 *
 * The point of this route is to answer one question honestly: what does
 * Chartmetric ACTUALLY return, as opposed to what its OpenAPI document
 * says it returns. Nothing downstream — no normalizer, no UI — gets
 * written until this has printed a real body.
 *
 *   GET /api/chartmetric/inspect?artist=<slug>
 *   Authorization: Bearer <REVIEW_TOKEN>
 *
 * Gated on REVIEW_TOKEN, the same secret the research review uses, and
 * fails closed when it is unset. It returns raw upstream JSON, which is
 * exactly why it is not public.
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

function authorised(req: NextRequest): boolean {
  const expected = process.env.REVIEW_TOKEN;
  if (!expected) return false;
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return !!bearer && bearer === expected;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json(
      {
        error: process.env.REVIEW_TOKEN
          ? 'Unauthorised. Send Authorization: Bearer <REVIEW_TOKEN>.'
          : 'REVIEW_TOKEN is not configured, so inspection is disabled.',
      },
      { status: 401 },
    );
  }

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
  const channelId = snap?.channelId ?? null;

  const out: Record<string, unknown> = {
    watcher: {
      slug: artist.slug,
      name: artist.name,
      channelHandle: artist.channelHandle ?? null,
      channelId,
      channelTitle: snap?.title ?? null,
      subs: snap?.subs ?? null,
      views: snap?.views ?? null,
    },
    auth: tokenState(),
  };

  if (!channelId) {
    out.error = 'No channelId on this artist snapshot — nothing to resolve.';
    return NextResponse.json(out, { status: 200 });
  }

  // 1. Resolution, uncached, so we see the raw upstream shape too.
  const rawIds = await cmFetch<unknown>(`/api/artist/youtube/${channelId}/get-ids`);
  out.getIdsRaw = rawIds;

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
  return NextResponse.json(out, { status: 200 });
}
