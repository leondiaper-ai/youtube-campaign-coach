/** Temporary, authenticated comparison approved for the country-data repair.
 * Only the two confirmed artists and two comparison countries are accepted.
 * The random bearer is held outside the repository; only its hash is here.
 * Access expires automatically, even if cleanup is interrupted.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cmFetch } from '@/lib/chartmetric/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const EXPIRES_AT = 1792425442165;
const TOKEN_HASH = '14328805dc0c372c9c5b141c7afd3de5c37189ee18381739e4e6712fa64df7bd';
const ARTISTS: Record<string, number> = { flightfacilities: 3657, rops1official: 1447650 };

export async function GET(req: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  if (Date.now() > EXPIRES_AT) return json({ error: 'expired' }, 410);
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const hash = createHash('sha256').update(token).digest();
  if (!token || !timingSafeEqual(hash, Buffer.from(TOKEN_HASH, 'hex'))) {
    return json({ error: 'unauthorized' }, 401);
  }
  const slug = req.nextUrl.searchParams.get('artist') ?? '';
  const country = req.nextUrl.searchParams.get('country') ?? '';
  const id = Object.prototype.hasOwnProperty.call(ARTISTS, slug) ? ARTISTS[slug] : null;
  if (!id || !['US', 'AU'].includes(country)) return json({ error: 'unsupported comparison' }, 400);
  const result = await cmFetch<{ obj?: Record<string, unknown> }>(
    `/api/artist/${id}/stat/youtube_artist?field=monthly_views&code2=${country}&latest=true`,
  );
  if (!result.ok) return json({ ok: false, reason: result.reason, status: result.status });
  const obj = result.data?.obj ?? {};
  const points = Array.isArray(obj.monthly_views) ? obj.monthly_views : [];
  // Return monthly readings only, never the upstream profile or credentials.
  return json({ ok: true, artistId: id, country, fields: Object.keys(obj), readings: points.map((p) => ({
    value: p?.value ?? null, timestp: p?.timestp ?? null,
    isEstimate: p?.is_estimate ?? null, interpolated: p?.interpolated ?? null,
  })) });
}
