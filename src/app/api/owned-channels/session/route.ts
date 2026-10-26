import { NextResponse } from 'next/server';
import { ownedChannelsConfigured } from '@/lib/ownedChannels/gate';
import { verifyOwnedSecret, ownedSessionCookie } from '@/lib/ownedChannels/auth';
import { ownedStore } from '@/lib/ownedChannels/store';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!ownedChannelsConfigured()) return new Response(null, { status: 404 });
  if (req.headers.get('origin') !== new URL(req.url).origin) return new Response(null, { status: 403 });
  const store = ownedStore();
  if (!store) return new Response(null, { status: 503 });
  // A global hourly ceiling bounds guessing and fails closed when storage fails.
  const bucket = `owned:access:attempts:${Math.floor(Date.now() / 3600000)}`;
  try {
    const attempts = await store.incr(bucket);
    if (attempts === 1) await store.expire(bucket, 3600);
    if (attempts > 50) return new Response(null, { status: 429 });
  } catch { return new Response(null, { status: 503 }); }
  const body = await req.json().catch(() => null);
  if (!verifyOwnedSecret(body?.secret)) return new Response(null, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ownedSessionCookie());
  return response;
}
