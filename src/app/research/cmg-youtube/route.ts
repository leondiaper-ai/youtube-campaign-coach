/* ═══════════════════════════════════════════════════════════════════
   CREATE MUSIC GROUP × YOUTUBE — exploratory review (access-controlled)

   The artist deep dives live in /public and are public links by design.
   This one is not: it is shared with colleagues outside the Vercel team,
   so it is served from a route that decides who may read it.

   ── WHO CAN READ IT ──────────────────────────────────────────────────
   • Preview deployments: served directly. Previews sit behind Vercel
     Deployment Protection (Vercel Authentication), so the gate there is
     Vercel's — team members, or anyone given a Vercel shareable link to
     that specific deployment.
   • Production (and anything else): 404 unless CMG_REVIEW_KEY is set AND
     the reader arrives with ?key=<that value> once. The key is exchanged
     for an httpOnly cookie carrying an HMAC (never the key itself) and the
     reader is redirected to the clean URL, so the key does not linger in
     the address bar or in history beyond the first load.
   • Every refusal is a plain 404 — a wrong key, a missing key and an
     unset environment look identical from outside.

   ── REVOKING ACCESS ──────────────────────────────────────────────────
   Change CMG_REVIEW_KEY (or remove it). The cookie is derived from the
   key, so every existing cookie stops working at the same moment.

   ── CONTENT RULES ────────────────────────────────────────────────────
   The page is public YouTube evidence only. No Watcher roster or
   ownership flags, no internal correspondence, no reproduction of the
   confidential presentation it discusses. Generated from the research
   workspace; edit the source, not report.ts.
   ═══════════════════════════════════════════════════════════════════ */
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { REPORT_HTML } from './report';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COOKIE = 'cmg_review';
const MIN_KEY_LENGTH = 24;

const sign = (key: string) =>
  createHmac('sha256', key).update('cmg-youtube-review:v1').digest('hex');

function same(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

const PAGE_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

const page = () => new Response(REPORT_HTML, { headers: PAGE_HEADERS });
const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' },
  });

export async function GET(req: Request) {
  /* Previews are already behind Vercel Deployment Protection. */
  if (process.env.VERCEL_ENV === 'preview') return page();

  const key = process.env.CMG_REVIEW_KEY;
  if (!key || key.length < MIN_KEY_LENGTH) return notFound();

  const url = new URL(req.url);
  const given = url.searchParams.get('key');

  if (given !== null) {
    if (!same(given, key)) return notFound();
    const res = new Response(null, {
      status: 303,
      headers: { location: url.pathname, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
    res.headers.append(
      'set-cookie',
      `${COOKIE}=${sign(key)}; Path=${url.pathname}; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
    );
    return res;
  }

  const cookie = cookies().get(COOKIE)?.value ?? '';
  if (cookie && same(cookie, sign(key))) return page();
  return notFound();
}
