import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import type { LiveSnap, RecentUpload } from '@/lib/artists';
import { classifyUploadFormat } from '@/lib/coach/matchEngine';

/**
 * GET /api/label-watch?label=@sumerianrecords&artist=Palaye%20Royale&since=2026-09-01
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 * Some campaigns run across two YouTube surfaces. Palaye Royale is the
 * case that forced this: the Deep Dive found 114 Palaye uploads on the
 * Sumerian Records channel, including the official videos for Feel
 * Something, Great. and Sad Generation, while the artist channel carries
 * Shorts, Royal Television and the supporting work. A campaign page that
 * reads only the artist channel would miss the hero.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────
 * It never returns the label channel's own performance. Sumerian has
 * 3,664 uploads and 142m observed views across them; almost none of that
 * is Palaye Royale, and pulling a label's channel totals into an artist's
 * campaign would be the single most misleading thing this system could
 * do. Only uploads that can be tied to the named artist come back, and
 * they come back as a separate list — never merged into the artist
 * channel's figures by this route.
 *
 * ── MATCHING, AND THE COST OF BEING WRONG ─────────────────────────────
 * A false positive here credits an artist with somebody else's video. So
 * matching is deliberately narrow and its confidence is returned rather
 * than assumed:
 *
 *   matched  — the artist's full name appears in the video title. On a
 *              label channel the title is the artist's name, near enough
 *              always: "Palaye Royale - Sad Generation".
 *   flagged  — something suggests the artist but does not settle it: a
 *              partial name in the title, or the full name only in the
 *              description. Returned in its own list, for a human to
 *              confirm, and counted in no total.
 *
 * Everything else is ignored silently, which is the correct treatment for
 * 3,550 videos by other artists.
 */

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lowercase, strip punctuation, collapse whitespace. "Palaye Royale -"
    and "PALAYE ROYALE:" both have to reach the same string. */
const norm = (s: string) =>
  /* Deliberately not a unicode-property class: this file compiles under
     the project's existing target, which predates them. Stripping ASCII
     punctuation is enough — accented and non-Latin letters are left alone
     rather than mangled. */
  s.toLowerCase().replace(/[^a-z0-9\u00C0-\uFFFF\s]/gi, ' ').replace(/\s+/g, ' ').trim();

type Matched = {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  durationSec: number | null;
  formatLabel: string;
  thumb: string;
  /** Why we believe this belongs to the artist. */
  matchedOn: 'title' | 'description';
  confidence: 'matched' | 'flagged';
  reason: string;
};

function assess(u: RecentUpload, artist: string): Matched | null {
  if (!u?.id || !u.publishedAt) return null;

  const full = norm(artist);
  const title = norm(u.title ?? '');
  const desc = norm(u.description ?? '');
  /* The distinctive part of the name — "palaye" out of "palaye royale" —
     used only to raise a flag, never to claim a match. */
  const lead = full.split(' ')[0] ?? '';

  let confidence: Matched['confidence'] | null = null;
  let matchedOn: Matched['matchedOn'] = 'title';
  let reason = '';

  if (title.includes(full)) {
    confidence = 'matched';
    reason = `"${artist}" appears in the video title.`;
  } else if (desc.includes(full)) {
    confidence = 'flagged';
    matchedOn = 'description';
    reason = `"${artist}" appears in the description but not the title — confirm before counting it.`;
  } else if (lead.length >= 4 && title.includes(lead)) {
    confidence = 'flagged';
    reason = `Title contains "${lead}" but not the full artist name — confirm before counting it.`;
  }

  if (!confidence) return null;

  return {
    videoId: u.id,
    title: u.title ?? '',
    publishedAt: u.publishedAt,
    views: n(u.viewCount),
    likes: n(u.likeCount),
    comments: n(u.commentCount),
    durationSec: n(u.durationSec),
    formatLabel: classifyUploadFormat(u),
    thumb: `https://i.ytimg.com/vi/${u.id}/hqdefault.jpg`,
    matchedOn,
    confidence,
    reason,
  };
}

export async function GET(req: NextRequest) {
  /* mode=recent returns a channel's newest uploads with no artist filter
     at all — used for the artist's OWN channel, where every upload is
     theirs by definition and filtering would be nonsense. It is the same
     KV read, so it costs nothing extra, and it keeps the page from
     needing a second endpoint to show a band its own work. */
  const mode = req.nextUrl.searchParams.get('mode');
  const label = req.nextUrl.searchParams.get('label') ?? '@sumerianrecords';
  const artist = req.nextUrl.searchParams.get('artist') ?? 'Palaye Royale';
  const since = req.nextUrl.searchParams.get('since');

  const snap = await readLiveSnapByHandle(label) as LiveSnap | null;
  if (!snap || snap.error) {
    return NextResponse.json({
      label, artist,
      available: false,
      /* An unreachable label channel is a gap in what we can see, not a
         finding about the campaign. */
      note: 'The label channel is not readable from Watcher right now.',
      matched: [], flagged: [], totals: { matched: 0, matchedViews: null, flagged: 0 },
    }, { headers: CORS });
  }

  /* recentUploads and topEverVideos overlap, so dedupe on video id —
     otherwise a hero video that is both recent and all-time top would be
     counted twice in a campaign total. */
  const pool = new Map<string, RecentUpload>();
  for (const u of [...(snap.recentUploads ?? []), ...(snap.topEverVideos ?? [])]) {
    if (u?.id && !pool.has(u.id)) pool.set(u.id, u);
  }

  if (mode === 'recent') {
    const recent = Array.from(pool.values())
      .filter(u => u?.id && u.publishedAt)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 12)
      .map(u => ({
        videoId: u.id,
        title: u.title ?? '',
        publishedAt: u.publishedAt,
        views: n(u.viewCount),
        likes: n(u.likeCount),
        durationSec: n(u.durationSec),
        formatLabel: classifyUploadFormat(u),
        isShort: (u.durationSec ?? 0) > 0 && (u.durationSec ?? 0) <= 62,
        thumb: `https://i.ytimg.com/vi/${u.id}/hqdefault.jpg`,
      }));
    return NextResponse.json({
      label, mode: 'recent', available: true,
      channelTitle: snap.title ?? null,
      avatar: snap.thumbnail ?? null,
      recent,
      generatedAt: new Date().toISOString(),
    }, { headers: CORS });
  }

  const assessed = Array.from(pool.values())
    .map(u => assess(u, artist))
    .filter((x): x is Matched => x !== null)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  const sinceMs = since ? Date.parse(since) : NaN;
  const inWindow = (m: Matched) =>
    Number.isNaN(sinceMs) ? true : Date.parse(m.publishedAt) >= sinceMs;

  const matched = assessed.filter(m => m.confidence === 'matched');
  const flagged = assessed.filter(m => m.confidence === 'flagged');
  const campaignMatched = matched.filter(inWindow);

  const sumViews = (rows: Matched[]) =>
    rows.every(r => r.views == null) ? null
      : rows.reduce((t, r) => t + (r.views ?? 0), 0);

  return NextResponse.json({
    label,
    labelTitle: snap.title ?? null,
    artist,
    available: true,
    since: since ?? null,
    /* Scanned, not "all" — the snap holds recent uploads and all-time top
       performers, not the channel's full 3,664. A Palaye upload outside
       both sets would not appear here, and saying "scanned" keeps that
       honest. */
    scanned: pool.size,
    matched: campaignMatched,
    /** Every confident match regardless of window, for context. */
    matchedAllTime: matched,
    flagged,
    totals: {
      matched: campaignMatched.length,
      matchedViews: sumViews(campaignMatched),
      matchedAllTime: matched.length,
      flagged: flagged.length,
    },
    generatedAt: new Date().toISOString(),
  }, { headers: CORS });
}
