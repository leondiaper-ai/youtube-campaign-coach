/**
 * CAMPAIGN COVER — what the Deep Dive deck needs to open in its live state
 *
 * The deck is the product. This endpoint is what makes it live.
 *
 * ── WHY THE DECK CALLS US RATHER THAN US RENDERING THE DECK ───────────
 * The CHVRCHES deck is a hand-built static document with its own design
 * system, and the feedback it gets is about that document. Rebuilding it as
 * a React route to inject data would mean re-implementing 16kB of bespoke
 * CSS and a slide engine, and the first thing anyone would notice is that
 * it no longer felt like the deck. So the deck stays exactly as it is and
 * fetches this instead — which it was already built to do, via the
 * `liveData` hook and the CORS-enabled artist-live call it has always had.
 *
 * ── WHAT THIS RETURNS AND WHAT IT REFUSES TO ──────────────────────────
 * Editorially selected, not everything Watcher holds. Four metrics, a
 * handful of assets, four stages, one read. The deck is a designed surface
 * and a payload of forty fields would produce a dashboard.
 *
 * It refuses to say the campaign is live on observation alone. Two Shorts
 * appearing is NEW ACTIVITY OBSERVED. A human progress record is what makes
 * it CAMPAIGN LIVE, because intent is not in the public API — the same rule
 * the progress store enforces, applied at the presentation edge so the deck
 * cannot accidentally announce a campaign nobody started.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaignProgress } from '@/lib/intelligence/campaignProgress';
import { deepDiveFor, resolveArtist } from '@/lib/intelligence/needs';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* The deck is served from the same origin today, but it is a standalone
   document and may be opened from a file or another host. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** How many assets the cover may show before it becomes a feed. */
const MAX_HERO_ASSETS = 2;
const MAX_SUPPORTING = 4;

type AssetRole = 'hero' | 'supporting';

interface CoverAsset {
  videoId: string;
  title: string;
  publishedAt: string;
  /** yyyy-mm-dd → "9 SEP" for the deck. Formatting stays here, not there. */
  dateLabel: string;
  kind: string;
  formatLabel: string;
  views: number | null;
  thumb: string;
  url: string;
  role: AssetRole;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

/**
 * Observable format only. The API can see duration and liveStreamingDetails;
 * it cannot see whether something is a visualiser or a lyric video unless
 * the title says so, and guessing would put a wrong label on a campaign
 * asset in front of YouTube.
 */
function formatOf(v: any): { kind: string; label: string } {
  const dur = v.durationSec ?? 0;
  const title = String(v.title ?? '');
  if (v.wasLive || v.actualStart) return { kind: 'live', label: 'PREMIERE / LIVE' };
  if (dur > 0 && dur <= 62) return { kind: 'short', label: 'SHORT' };
  if (/\blyric\b/i.test(title)) return { kind: 'lyric', label: 'LYRIC VIDEO' };
  if (/\bvisuali[sz]er\b/i.test(title)) return { kind: 'visualiser', label: 'VISUALISER' };
  if (/official (music )?video|\bomv\b/i.test(title)) return { kind: 'omv', label: 'OFFICIAL VIDEO' };
  if (dur > 62) return { kind: 'long', label: 'LONG FORM' };
  return { kind: 'unknown', label: 'UPLOAD' };
}

/**
 * Editorial ranking, not chronology.
 *
 * A campaign page that lists uploads newest-first becomes a feed the moment
 * there are more than three. The hero is the most significant asset, and
 * significance here means format weight first and recency second — when the
 * first official video lands it should take the page, and the Shorts that
 * preceded it should move into support without anyone editing anything.
 */
const FORMAT_WEIGHT: Record<string, number> = {
  omv: 100, live: 80, lyric: 60, visualiser: 55, long: 40, short: 20, unknown: 10,
};

function rankAssets(assets: CoverAsset[]): CoverAsset[] {
  return [...assets].sort((a, b) => {
    const w = (FORMAT_WEIGHT[b.kind] ?? 0) - (FORMAT_WEIGHT[a.kind] ?? 0);
    if (w !== 0) return w;
    /* Same format: the one people actually watched leads. Two Shorts a day
       apart are the same moment, and ordering them by recency put a 2,721-
       view teaser ahead of the 25,832-view opener — technically newest,
       editorially wrong. Views are a poor proxy for importance across
       formats, which is why they only break a tie within one. */
    const v = (b.views ?? 0) - (a.views ?? 0);
    if (v !== 0) return v;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400, headers: CORS });
  }

  const coverage: string[] = [];

  try {
    const who = await resolveArtist(slug);
    const { dive } = who.deepDiveSlug ? await deepDiveFor(who.deepDiveSlug) : { dive: null };

    if (!dive) {
      return NextResponse.json(
        { state: 'NO_DEEP_DIVE', note: 'No strategic baseline exists for this artist.' },
        { headers: CORS },
      );
    }

    const progress = await getCampaignProgress(who.slug);
    const capturedAt = dive.dataCapturedAt;
    const since = capturedAt ? new Date(capturedAt) : null;

    /* ── Campaign state ────────────────────────────────────────────────
       Human-confirmed progress is the only thing that makes this LIVE.
       Uploads alone are NEW_ACTIVITY: real, worth showing, and not a
       claim that a campaign started. */
    const inMotion = progress.recommendations.filter(
      r => r.statusProvenance === 'HUMAN' && ['IMPLEMENTED', 'OBSERVING', 'RESULT', 'LEARNED'].includes(r.status),
    );

    /* ── Live channel + assets ─────────────────────────────────────── */
    const snap = who.artist?.channelHandle
      ? await readLiveSnapByHandle(who.artist.channelHandle).catch(() => null)
      : null;

    if (!snap) coverage.push('No cached channel snapshot — asset list and movement are unavailable, not empty.');

    const raw: any[] = (snap as any)?.recentUploads ?? [];
    if (snap && !raw.length) {
      coverage.push('Snapshot holds no recent-upload list. Absence of assets here means the read failed, not that nothing was published.');
    }

    const postBaseline: CoverAsset[] = [];
    for (const v of raw) {
      const at = new Date(v.publishedAt ?? 0);
      if (!since || !Number.isFinite(at.getTime()) || at <= since) continue;
      const f = formatOf(v);
      postBaseline.push({
        videoId: v.id,
        title: v.title,
        publishedAt: v.publishedAt,
        dateLabel: dateLabel(v.publishedAt),
        kind: f.kind,
        formatLabel: f.label,
        views: v.viewCount ?? null,
        thumb: `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        role: 'supporting',
      });
    }

    const ranked = rankAssets(postBaseline);
    ranked.forEach((a, i) => { a.role = i < MAX_HERO_ASSETS ? 'hero' : 'supporting'; });
    const heroes = ranked.filter(a => a.role === 'hero');
    const supporting = ranked.filter(a => a.role === 'supporting').slice(0, MAX_SUPPORTING);

    const state = inMotion.length > 0
      ? 'CAMPAIGN_LIVE'
      : postBaseline.length > 0 ? 'NEW_ACTIVITY' : 'BASELINE';

    /* ── Movement since the baseline ───────────────────────────────── */
    const channelId = (snap as any)?.channelId;
    const daysSinceBaseline = since
      ? Math.max(1, Math.round((Date.now() - since.getTime()) / 86_400_000)) : null;

    let viewsDelta: number | null = null;
    let subsDelta: number | null = null;
    if (channelId && daysSinceBaseline) {
      const hist = await readHistory(channelId).catch(() => []);
      if (hist.length < 7) coverage.push(`Only ${hist.length} snapshot(s) in the series — movement figures are weak.`);
      viewsDelta = deltaOver(hist, daysSinceBaseline, 'views')?.delta ?? null;
      subsDelta = deltaOver(hist, daysSinceBaseline, 'subs')?.delta ?? null;
    }

    const lastUploadAt = (snap as any)?.lastUploadAt ?? null;
    const daysSinceUpload = lastUploadAt
      ? Math.round((Date.now() - new Date(lastUploadAt).getTime()) / 86_400_000) : null;

    /* The dormancy the Deep Dive recorded, read back out of its own
       evidence rather than retyped — so the deck quotes the deck. */
    const dormancyClaim = dive.keyEvidence.find(e => /days since the last upload/i.test(e.claim));
    const baselineDormantDays = dormancyClaim
      ? Number((/(\d[\d,]*)\s+days/.exec(dormancyClaim.claim)?.[1] ?? '').replace(/,/g, '')) || null
      : null;

    /* ── The campaign stages ───────────────────────────────────────────
       These ARE the Deep Dive's campaign architecture, in its own order
       and its own words — not a generic funnel. A stage is IN MOTION only
       where a human said so. */
    const architecture = progress.recommendations
      .filter(r => r.recommendation.source === 'campaign_architecture');

    const inMotionIds = new Set(inMotion.map(r => r.recommendation.id));
    let seenNext = false;
    const stages = architecture.slice(0, 4).map(r => {
      let status: 'IN MOTION' | 'NEXT' | 'AHEAD';
      if (inMotionIds.has(r.recommendation.id)) {
        status = 'IN MOTION';
      } else if (!seenNext) {
        status = 'NEXT'; seenNext = true;
      } else {
        status = 'AHEAD';
      }
      return {
        id: r.recommendation.id,
        /* Short label for the deck, long point kept for the tooltip. */
        label: stageLabel(r.recommendation.point),
        point: r.recommendation.point,
        status,
      };
    });

    /* ── One read ──────────────────────────────────────────────────────
       Assembled from observed facts and an explicitly hedged forward
       clause. No causal claim: the channel woke and the campaign started,
       and those are two statements sitting next to each other. */
    const read = buildRead(state, heroes.length + supporting.length, baselineDormantDays, daysSinceUpload, stages);

    return NextResponse.json({
      state,
      artist: { slug: who.slug, name: who.name, handle: who.artist?.channelHandle ?? null },
      deepDive: {
        capturedAt,
        title: dive.title,
        /* One sentence, not the paragraph. The deck has no room and the
           full thesis is two slides further down anyway. */
        line: firstSentence(dive.coreThesis),
        deckUrl: dive.deckUrl,
      },
      channel: {
        avatar: (snap as any)?.thumbnail ?? null,
        subs: (snap as any)?.subs ?? null,
        views: (snap as any)?.views ?? null,
        lastUploadAt,
        daysSinceUpload,
      },
      metrics: {
        viewsDelta, subsDelta,
        newUploads: postBaseline.length,
        baselineDormantDays,
        daysSinceBaseline,
      },
      assets: { heroes, supporting },
      stages,
      read,
      /* UNKNOWN is never NONE. The deck renders these quietly but they
         must exist, because a failed join and a quiet channel look
         identical otherwise. */
      coverage,
      generatedAt: new Date().toISOString(),
    }, { headers: CORS });
  } catch (e) {
    /* The deck must never be taken down by this endpoint. A failure
       returns a shape the deck can ignore, and it keeps its captured
       cover. */
    return NextResponse.json(
      { state: 'UNAVAILABLE', error: String((e as Error).message), coverage },
      { status: 200, headers: CORS },
    );
  }
}

/** "Pre-campaign: reopen the channel with…" → "Wake the channel". */
function stageLabel(point: string): string {
  const p = point.toLowerCase();
  if (/reopen|pre-campaign/.test(p)) return 'Wake the channel';
  if (/official music video|single:/.test(p)) return 'First hero';
  if (/7-14|second destination/.test(p)) return 'Second destination';
  if (/release day/.test(p)) return 'Give every song a home';
  if (/after release|back what moves/.test(p)) return 'Back what moves';
  if (/always on|station/.test(p)) return 'Build the world';
  /* No match: use the deck's own words, truncated at the first clause,
     rather than inventing a label. */
  return point.split(/[:.—]/)[0].trim();
}

function firstSentence(s: string): string {
  const m = /^(.*?[.!?])\s/.exec(s);
  return (m ? m[1] : s).trim();
}

function buildRead(
  state: string, assetCount: number, dormantDays: number | null,
  daysSinceUpload: number | null, stages: { label: string; status: string }[],
): { headline: string; line: string } | null {
  if (state === 'BASELINE') return null;

  const next = stages.find(s => s.status === 'NEXT');
  const woke = dormantDays != null && daysSinceUpload != null && daysSinceUpload < dormantDays;

  if (state === 'NEW_ACTIVITY') {
    return {
      headline: 'New activity on the channel.',
      line: `${assetCount} upload${assetCount === 1 ? '' : 's'} since the analysis. Nobody has confirmed `
        + 'whether this is the campaign starting, so the deck is not claiming that it is.',
    };
  }

  return {
    headline: woke ? 'The channel is awake.' : 'The campaign is live.',
    line: next
      ? `Now we're watching whether that carries into ${next.label.toLowerCase()}.`
      : 'Now we\'re watching what follows it.',
  };
}
