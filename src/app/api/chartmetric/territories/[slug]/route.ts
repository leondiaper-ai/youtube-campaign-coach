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
 *   - a shared result is refreshed at most weekly when viewed;
 *   - an expiring lock prevents concurrent vendor refreshes;
 *   - failed refreshes back off for a day and preserve existing data.
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
export const maxDuration = 60;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const RETRY_SECONDS = 24 * 60 * 60;

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
  // Vendor calls require the shared cache/lock so page visits cannot
  // silently turn into uncached Chartmetric spending during a KV outage.
  if (!store) return fail('cache-unavailable');
  const hit = (await store.get(key)) as TerritoriesResult | null;
  const cached = () => hit?.ok ? NextResponse.json(hit) : fail('temporarily-unavailable');
  if (hit?.ok && hit.countryLookupVersion === 3 && hit.countryLookupComplete !== false) {
    const age = Date.now() - Date.parse(hit.fetchedAt);
    if (Number.isFinite(age) && age >= 0 && age < WEEK_MS) return NextResponse.json(hit);
  }
  const retryKey = `cm:territories:retry:${channelId}`;
  if (await store.get(retryKey)) return cached();
  const locked = await store.set(`cm:territories:lock:${channelId}`, true, { nx: true, ex: 90 });
  if (!locked) {
    if (hit?.ok) return cached();
    // A cold concurrent visitor waits for the first result, not a second
    // Chartmetric refresh. Existing-data visitors return immediately.
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const ready = (await store.get(key)) as TerritoriesResult | null;
      if (ready?.ok) return NextResponse.json(ready);
      if (await store.get(retryKey)) break;
    }
    return fail('refresh-in-progress');
  }
  // Keep the last successful reading available while the new one is checked.
  if (hit?.ok) await store.set(key, hit, { ex: RETENTION_SECONDS });

  try {
    const result = await fetchTerritories({ slug: artist.slug, name: artist.name }, channelId);
    if (result.ok && result.countryLookupComplete !== false) {
      await store.set(key, result, { ex: RETENTION_SECONDS });
      return NextResponse.json(result);
    }
    await store.set(retryKey, true, { ex: RETRY_SECONDS });
    return hit?.ok ? cached() : NextResponse.json(result);
  } catch {
    await store.set(retryKey, true, { ex: RETRY_SECONDS });
    return cached();
  }
}
