/**
 * GET /api/chartmetric/territories/[slug]
 *
 * The only Chartmetric surface the UI ever touches. Returns our own
 * normalized shape, never Chartmetric's.
 *
 * It is unauthenticated because the module that calls it is a client
 * component, so a secret here would be a secret in the browser. It is
 * bounded instead:
 *
 *   - the slug must already be in the Watcher roster;
 *   - the channel id comes from the Watcher's own snapshot, never from
 *     the caller;
 *   - results are cached in KV for 12 hours, so the cost of being hit
 *     repeatedly is one Chartmetric request per artist per half-day.
 *
 * Every failure is a 200 with { ok: false, reason }. The module renders
 * nothing on a falsy result, which is what keeps a Chartmetric outage
 * from ever being visible on an artist page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { chartmetricConfigured } from '@/lib/chartmetric/auth';
import { fetchTerritories, type TerritoriesResult } from '@/lib/chartmetric/territories';

export const dynamic = 'force-dynamic';

const TTL_SECONDS = 12 * 60 * 60;

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

const fail = (reason: string) => NextResponse.json({ ok: false, reason }, { status: 200 });

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // Absence of the integration is a no-op, not an error.
  if (!chartmetricConfigured()) return fail('not-configured');

  const { slug: rawSlug } = await ctx.params;
  const slug = (rawSlug ?? '').trim().toLowerCase();
  if (!slug) return fail('no-slug');

  const artist = mergeArtistLists(ARTISTS, await listCustomArtists()).find((a) => a.slug === slug);
  if (!artist) return fail('unknown-artist');

  const snap = artist.channelHandle ? await readLiveSnapByHandle(artist.channelHandle) : null;
  const channelId = snap?.channelId;
  if (!channelId) return fail('no-channel-id');

  const store = await kv();
  const key = `cm:territories:${channelId}`;

  if (store) {
    const hit = (await store.get(key)) as TerritoriesResult | null;
    if (hit) return NextResponse.json(hit, { status: 200 });
  }

  const result = await fetchTerritories({ slug: artist.slug, name: artist.name }, channelId);

  // Only cache success. A transient failure should be retried, not pinned.
  if (store && result.ok) await store.set(key, result, { ex: TTL_SECONDS });

  return NextResponse.json(result, { status: 200 });
}
