/* Exchange the shared secret for a signed, httpOnly cookie.
   POST only: a GET would put the secret in the URL, and therefore in
   browser history, referrers and the access log. */
import { NextRequest, NextResponse } from 'next/server';
import { featureEnabled, verifySecret, sessionCookie, notFound } from '@/lib/marketWatch/gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!featureEnabled()) return notFound();
  let secret = '';
  try { secret = (await req.json())?.secret ?? ''; } catch { /* empty body → fail below */ }
  /* Wrong secret returns 404, not 401. A 401 tells an unauthenticated
     caller that this endpoint exists and that guessing is worthwhile. */
  if (!verifySecret(secret)) return notFound();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie());
  return res;
}

export async function GET() { return notFound(); }
