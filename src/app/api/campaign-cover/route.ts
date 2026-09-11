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
import { buildRollout } from '@/lib/intelligence/rollout';
import { buildCampaignTimeline } from '@/lib/intelligence/campaignTimeline';
import { readLibrary } from '@/lib/intelligence/research';
import { listResearchRuns } from '@/lib/intelligence/researchRuns';
import { overrideFor } from '@/lib/intelligence/formatOverrides';
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
  /**
   * How the deck should frame it. Observed from duration, NOT from kind —
   * a vertical campaign trailer is still vertical, and a human relabelling
   * it must not silently reshape it into a 16:9 frame with pillarbox baked
   * back into the pixels.
   */
  aspect: 'portrait' | 'landscape';
  /**
   * The shape of the PIXELS, as opposed to the shape of the frame. When a
   * portrait source is framed landscape the deck cannot simply letterbox it:
   * YouTube bakes grey pillarbox into the 1280x720 thumbnail, so those bars
   * are image content and no aspect-ratio change removes them. The deck
   * needs to know to crop into the strip instead.
   */
  sourceAspect: 'portrait' | 'landscape';
  /** Set when a person overrode the observed format. Provenance, not decoration. */
  labelledBy: string | null;
  views: number | null;
  thumb: string;
  url: string;
  role: AssetRole;
}

/** The real period a delta covers, read off the snapshots it used. */
type MetricWindow = { days: number; from: string; to: string } | null;

function windowOf(d: { baseline: { ts: string }; last: { ts: string } } | null | undefined): MetricWindow {
  if (!d) return null;
  const from = new Date(d.baseline.ts).getTime();
  const to = new Date(d.last.ts).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    days: Math.max(1, Math.round((to - from) / 86_400_000)),
    from: d.baseline.ts.slice(0, 10),
    to: d.last.ts.slice(0, 10),
  };
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  /* ICU renders September as "Sept" in en-GB, which is the only four-letter
     month and wrecks the rhythm of a date row. Three letters, always. */
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3).toUpperCase();
  return `${d.getUTCDate()} ${mon}`;
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
  omv: 100, live: 80, trailer: 70, lyric: 60, visualiser: 55, long: 40, short: 20, unknown: 10,
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
      const observed = formatOf(v);
      /* A person who knows what the asset is beats a duration check. The
         shape stays observed; only the name changes. */
      const human = overrideFor(v.id);
      const f = human ? { kind: human.kind, label: human.label } : observed;
      postBaseline.push({
        videoId: v.id,
        title: v.title,
        publishedAt: v.publishedAt,
        dateLabel: dateLabel(v.publishedAt),
        kind: f.kind,
        formatLabel: f.label,
        aspect: human?.frame ?? (observed.kind === 'short' ? 'portrait' : 'landscape'),
        sourceAspect: observed.kind === 'short' ? 'portrait' : 'landscape',
        labelledBy: human ? human.statedBy : null,
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
    let viewsWindow: MetricWindow = null;
    let subsWindow: MetricWindow = null;

    if (channelId && daysSinceBaseline) {
      const hist = await readHistory(channelId).catch(() => []);
      if (hist.length < 7) coverage.push(`Only ${hist.length} snapshot(s) in the series — movement figures are weak.`);

      /* ── The window a figure ACTUALLY covers ────────────────────────
         `deltaOver` asks for a number of days, then picks the newest
         snapshot at or before that cutoff. When the series has a gap —
         and this one does — the snapshot it lands on can be far older
         than the days requested, so the figure covers a longer period
         than the label would suggest.

         Asking for 7 days and asking for 17 both returned +3,049,570
         here, which is the tell: there is no snapshot between those two
         cutoffs. Labelling that "17 days" would be a guess dressed as a
         measurement, so the window is read back off the snapshots the
         delta was actually computed from. */
      const v = deltaOver(hist, daysSinceBaseline, 'views');
      const sub = deltaOver(hist, daysSinceBaseline, 'subs');
      viewsDelta = v ? v.delta : null;
      subsDelta = sub ? sub.delta : null;
      viewsWindow = windowOf(v);
      subsWindow = windowOf(sub);

      if (viewsWindow && daysSinceBaseline && viewsWindow.days > daysSinceBaseline + 2) {
        coverage.push(
          `Channel movement covers ${viewsWindow.days} days, not the ${daysSinceBaseline} since the Deep Dive — `
          + 'the snapshot series has no reading in between.',
        );
      }
    }

    /* When the silence actually broke — the FIRST asset after the Deep
       Dive, not the most recent one. "340 days quiet until two days ago"
       is about the moment it stopped being quiet. */
    const firstNewUploadAt = postBaseline.length
      ? postBaseline.map(a => a.publishedAt).sort()[0] : null;

    /* ── What the campaign itself has earned ──────────────────────────
       The lifetime view total on the assets published since the Deep Dive.
       For assets a day or two old, lifetime IS campaign-period — there is
       no earlier life for the number to include. That stops being true as
       they age, which is why the label says "on the new assets" rather
       than "this period", and why the share below is guarded.

       This is the figure that keeps the page honest. +3.05M channel views
       sitting under THE CAMPAIGN IS LIVE reads as campaign performance,
       and almost none of it is: the channel was dormant for all but two
       days of that window and earns roughly 74,000 a day doing nothing.
       Putting the campaign's own number beside it, at the same size, is
       the difference between a page that informs and a page that flatters. */
    const campaignViews = postBaseline.reduce(
      (n, a) => n + (a.views ?? 0), 0) || null;

    /* Only a fraction if every asset was published inside the window the
       channel figure covers — otherwise it is two different periods
       divided by each other, which is not a percentage of anything. */
    const windowStart = viewsWindow ? new Date(viewsWindow.from).getTime() : null;
    const allInsideWindow = windowStart != null && postBaseline.every(
      a => new Date(a.publishedAt).getTime() >= windowStart);

    const campaignShare = campaignViews && viewsDelta && viewsDelta > 0 && allInsideWindow
      ? campaignViews / viewsDelta : null;

    if (campaignViews && !allInsideWindow) {
      coverage.push('Asset totals and channel movement cover different periods, so no share is shown.');
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

    /* ── The rollout, and the spine that reads off it ──────────────────
       The cover's four stages and the Ideas tab's rollout used to be two
       derivations of the same campaign. They are now one: buildRollout
       joins the Deep Dive architecture to human progress and to verified
       research, and the spine is that plan rendered in four words each.
       A stage is IN MOTION only where a human said so, unchanged — the
       rule now lives in one place instead of two. */
    const library = await readLibrary().catch(() => []);
    /* The run log gives each item its lastResearchedAt; nothing else. */
    const runs = await listResearchRuns(who.slug, 10).catch(() => []);
    const rollout = buildRollout(progress, library, runs);

    if (!rollout.items.length) {
      coverage.push('No rollout plan exists for this artist, so the strategy spine is unavailable rather than empty.');
    }

    const stages = rollout.items
      .filter(it => it.spine && it.spineStatus)
      .slice(0, 4)
      .map(it => ({
        id: it.recommendationId ?? it.id,
        label: it.title,
        /* Long point kept for the tooltip, as before. */
        point: it.objective,
        status: it.spineStatus as string,
      }));

    /* ── The campaign timeline ────────────────────────────────────────
       Where the campaign is, in five moments. The Coach plan is the
       source of dates; the rollout supplies the strategic names; the
       assets above supply the past. Nothing here is a second store —
       every field is read from something that already existed. */
    const timeline = await buildCampaignTimeline(
      who.slug,
      ranked.map(a => ({
        videoId: a.videoId, title: a.title, publishedAt: a.publishedAt,
        dateLabel: a.dateLabel, formatLabel: a.formatLabel, aspect: a.aspect,
        thumb: a.thumb, url: a.url, views: a.views,
      })),
      rollout,
    ).catch(() => null);
    if (timeline) coverage.push(...timeline.coverage);

    /* ── One read ──────────────────────────────────────────────────────
       Assembled from observed facts and an explicitly hedged forward
       clause. No causal claim: the channel woke and the campaign started,
       and those are two statements sitting next to each other. */
    const read = buildRead(state, heroes.length + supporting.length, baselineDormantDays, daysSinceUpload, stages, firstNewUploadAt);

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
        /* What each figure actually covers. The deck prints this rather
           than assuming both share the Deep Dive's window. */
        viewsWindow, subsWindow,
        /* The campaign's own number, and how much of the channel's
           movement it accounts for. */
        campaignViews,
        campaignAssets: postBaseline.length,
        campaignShare,
        newUploads: postBaseline.length,
        baselineDormantDays,
        daysSinceBaseline,
      },
      assets: { heroes, supporting },
      stages,
      timeline,
      /* The same plan the stages were cut from, in full, for the Ideas
         tab. One fetch, one state — the tab cannot show a campaign the
         cover disagrees with because there is only one of them. */
      rollout,
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

function firstSentence(s: string): string {
  const m = /^(.*?[.!?])\s/.exec(s);
  return (m ? m[1] : s).trim();
}

/** "today" / "yesterday" / "two days ago" / "6 days ago" / "on 9 September". */
function agoPhrase(iso: string, now = Date.now()): string {
  const d = Math.max(0, Math.round((now - new Date(iso).getTime()) / 86_400_000));
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d === 2) return 'two days ago';
  if (d <= 13) return `${d} days ago`;
  /* Past a fortnight "N days ago" stops being a thing anyone can picture,
     so it becomes the date and stops ageing. */
  return 'on ' + new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function buildRead(
  state: string, assetCount: number, dormantDays: number | null,
  daysSinceUpload: number | null, stages: { label: string; status: string }[],
  firstNewUploadAt: string | null,
): { kicker: string | null; headline: string; line: string } | null {
  if (state === 'BASELINE') return null;

  /* The dormancy figure was a statistic sitting beside two others, which
     made 340 days of silence look like a metric rather than the thing that
     just changed. As a line of commentary above the read it does the job
     it was always doing: it is the before, and the headline is the after. */
  const kicker = dormantDays != null && firstNewUploadAt
    ? `${dormantDays} days quiet until ${agoPhrase(firstNewUploadAt)}`
    : null;

  const next = stages.find(s => s.status === 'NEXT');
  const woke = dormantDays != null && daysSinceUpload != null && daysSinceUpload < dormantDays;

  if (state === 'NEW_ACTIVITY') {
    return {
      kicker,
      headline: 'New activity on the channel.',
      line: `${assetCount} upload${assetCount === 1 ? '' : 's'} since the analysis. Nobody has confirmed `
        + 'whether this is the campaign starting, so the deck is not claiming that it is.',
    };
  }

  return {
    kicker,
    headline: woke ? 'The channel is awake.' : 'The campaign is live.',
    /* Forward, not hedged into meaninglessness. A confirmed date exists for
       the next moment, so "moving towards" is a statement about the plan
       rather than a claim about cause. */
    line: next
      ? `Now we're moving towards ${next.label.toLowerCase()}.`
      : 'Now we\'re watching what follows it.',
  };
}
