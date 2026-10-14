/* ═══════════════════════════════════════════════════════════════════════
   MARKET WATCH — ACCESS GATE

   Watcher has no authentication. There is no middleware, no session layer,
   no user model; the only access control anywhere in the codebase is a
   bearer check on the cron routes. So this feature cannot reuse an
   existing auth system, because there isn't one — it brings its own, kept
   as small as possible and deliberately not exported for general use.

   TWO INDEPENDENT CONTROLS

   1. A FEATURE FLAG. Absent MARKET_WATCH_SECRET, the feature does not
      exist: the page and every route return 404, not 403. A 403 confirms
      there is something there to find. Default is off, so a deploy that
      forgets the variable ships nothing.

   2. A SIGNED COOKIE. The secret is posted once to /api/market-watch/session
      and exchanged for an httpOnly cookie carrying an HMAC — never the
      secret itself. So the secret is never in a URL, never in the client
      bundle, never in browser storage, and never in a referrer header.

   WHY NOT A SHARED LINK OR A HIDDEN PATH
   Both were ruled out explicitly, and rightly: an unguessable URL is
   readable in history, referrers and server logs, and removing a nav link
   protects nothing. This gate is checked server-side on every request to
   both the page and the routes.

   TIMING
   Comparison uses timingSafeEqual on fixed-length digests. The practical
   risk over a network is slight, but a string compare that returns early
   on the first wrong character is the kind of thing that is embarrassing
   to have written down.
   ═══════════════════════════════════════════════════════════════════════ */

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export const COOKIE = 'mw_session';
const PAYLOAD = 'market-watch-v1';

const secret = () => process.env.MARKET_WATCH_SECRET || '';

/* Vercel sets this itself: 'preview' | 'production' | 'development'. */
const onProtectedPreview = () => process.env.VERCEL_ENV === 'preview';

/* ── WHY A PREVIEW NEEDS NO SECRET ───────────────────────────────────
   This project has Deployment Protection set to Vercel Authentication,
   Standard Protection: a visitor must be signed in to Vercel AND be a
   member of the team before any preview deployment will serve them a
   byte. That is real authentication — an identity check against an
   account — and it is strictly stronger than a shared string that
   everyone who has ever seen it can replay.

   So on a preview, Vercel's gate IS the gate, and asking for a second
   secret on top would be ceremony rather than security.

   PRODUCTION IS UNCHANGED. VERCEL_ENV is 'production' there, so the
   feature is off unless MARKET_WATCH_SECRET is deliberately configured —
   which it is not. /market-watch stays a 404 on the live site.

   THE DEPENDENCY, STATED PLAINLY: this is only safe while Deployment
   Protection stays on. Turning it off would make previews public, and
   this feature public with them. Anyone changing that setting should
   set MARKET_WATCH_SECRET first. */
export const featureEnabled = () => secret().length >= 16 || onProtectedPreview();

/** What a valid cookie contains: proof of the secret, not the secret. */
function token(): string {
  return createHmac('sha256', secret()).update(PAYLOAD).digest('hex');
}

export function verifySecret(given: string): boolean {
  const a = Buffer.from(createHmac('sha256', 'cmp').update(given || '').digest('hex'));
  const b = Buffer.from(createHmac('sha256', 'cmp').update(secret()).digest('hex'));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie() {
  return {
    name: COOKIE,
    value: token(),
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  };
}

/** True only when the feature is on AND the caller has cleared a gate. */
export async function authorised(): Promise<boolean> {
  if (!featureEnabled()) return false;
  /* On a protected preview the caller has already proved who they are to
     Vercel before this code ran at all. Requiring a second credential
     would add no security and a sign-in screen nobody can complete,
     because no secret is configured there to type. */
  if (onProtectedPreview() && secret().length < 16) return true;
  const got = (await cookies()).get(COOKIE)?.value || '';
  const a = Buffer.from(got.padEnd(64, '0').slice(0, 64));
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

/* One shape of refusal for everything behind the gate. A disabled feature
   and a failed sign-in look identical from outside: 404, no body, no
   header that says "wrong password". */
export function notFound() {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
  });
}
