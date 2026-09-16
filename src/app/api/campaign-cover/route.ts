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
import { buildCampaignTimeline, nextConfirmedRelease } from '@/lib/intelligence/campaignTimeline';
import { readLibrary } from '@/lib/intelligence/research';
import { listResearchRuns } from '@/lib/intelligence/researchRuns';
import { overrideFor } from '@/lib/intelligence/formatOverrides';
import { deepDiveFor, resolveArtist } from '@/lib/intelligence/needs';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import {
  resolveCampaignStart, campaignMetrics, followUpAnchorFor, toCampaignUploads,
} from '@/lib/intelligence/campaignWindow';

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

/**
 * How many assets the cover may show before it becomes a feed.
 *
 * Two tiers, because they do different jobs. The heroes are the campaign's
 * argument and are set large. The rest are the campaign's WORLD — sixteen
 * countdown Shorts are not sixteen things to read, they are the texture of
 * a channel posting every other day, and that only comes across if you can
 * see them. They render as a strip of stills with no captions.
 *
 * Fourteen is where a strip stops reading as a body of work and starts
 * reading as a scroll. Past that the count carries it: "+3 more".
 */
const MAX_HERO_ASSETS = 2;
const MAX_SUPPORTING = 14;

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

/**
 * "Kings Of Leon - My Whole World" -> "My Whole World".
 *
 * YouTube titles carry the artist because YouTube search needs them to. A
 * sentence on a deck about that artist does not, and "What should land
 * after Kings Of Leon - My Whole World?" is a sentence nobody says.
 * Conservative: it only strips a leading artist name it recognises, and
 * leaves anything it does not understand exactly as published.
 */
function cleanAssetTitle(title: string, artistName: string): string {
  const t = (title ?? '').trim();
  const a = (artistName ?? '').trim();
  if (!a) return t;
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^${esc}\\s*[-\u2013\u2014:]\\s*(.+)$`, 'i').exec(t);
  const out = m ? m[1].trim() : t;
  /* "(Official Video)" and friends are packaging, not the name. */
  return out.replace(/\s*\((official|lyric|visuali[sz]er)[^)]*\)\s*$/i, '').trim() || t;
}

/**
 * The Deep Dive's 7-14 day follow-up window, as dates rather than as a
 * phrase. Anchored to the hero's publication so it does not drift with the
 * reader's clock, and it reports whether it is still open — a window that
 * has closed is a different conversation from one that has not opened.
 */
function windowAfter(publishedAt: string) {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return null;
  const from = new Date(t + 7 * 86_400_000);
  const to = new Date(t + 14 * 86_400_000);
  const now = Date.now();
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    fromLabel: dateLabel(from.toISOString()),
    toLabel: dateLabel(to.toISOString()),
    state: now < from.getTime() ? 'AHEAD' : now <= to.getTime() ? 'OPEN' : 'CLOSED',
    daysUntilOpens: Math.ceil((from.getTime() - now) / 86_400_000),
    daysUntilCloses: Math.ceil((to.getTime() - now) / 86_400_000),
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

    /* ── When this campaign started ────────────────────────────────
       Not when we pinned the artist, and not when the Deep Dive was
       captured. See campaignWindow.ts: a stated date if one exists,
       otherwise the first upload of the most recent sustained run, and
       the Deep Dive capture only as a last resort that says so.

       For Kings of Leon this moves the boundary from 24 Aug (the day the
       analysis ran) to 12 Aug — the first "29 days 'til…" Short, counting
       to My Whole World on 10 Sep. The channel stated the date; nothing
       was reading it. */
    /* `toCampaignUploads` is the one place asset type is decided, and it
       reads the human format override itself. Mapping to `kind` here with
       formatOf() bypassed that, which is how a 61-second vertical trailer
       a person had already labelled "not a Short" was counted as one. */
    const campaignUploads = toCampaignUploads(raw);
    const campaignStart = resolveCampaignStart({
      uploads: campaignUploads,
      baselineAt: capturedAt ?? null,
    });
    if (campaignStart) coverage.push(campaignStart.because);
    else coverage.push('No campaign start could be resolved, so campaign figures are unavailable rather than zero.');

    const startAt = campaignStart ? new Date(campaignStart.at) : null;

    const postBaseline: CoverAsset[] = [];
    for (const v of raw) {
      const at = new Date(v.publishedAt ?? 0);
      /* Inclusive. The upload that opens an era IS the campaign's first
         asset, and excluding it by a strict `>` was half of the reason
         one surface counted 13 assets and this one counted 10. */
      if (!startAt || !Number.isFinite(at.getTime()) || at < startAt) continue;
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

    /* ── TWO ORDERS, BECAUSE THE TIERS ANSWER DIFFERENT QUESTIONS ─────
       The heroes are SELECTED — format weight first, then views inside a
       format — because the question they answer is "what is this campaign
       about", and the answer is not whichever Short went up this morning.

       The strip is SEQUENCED. It is the campaign as it actually happened,
       and a run of Shorts ordered by view count is not a run of anything:
       it loses the countdown, the build, the gap before the hero. Newest
       first, matching the Latest tab on the channel itself — which is the
       order anybody checking this against YouTube will be looking at. */
    /* ── THE TWO HEROES ANSWER TWO QUESTIONS ──────────────────────────
       WHAT IS THIS CAMPAIGN ABOUT, and WHAT JUST HAPPENED. The block is
       headed NOW, so the second card has to be the newest thing — and it
       was the highest-viewed thing instead, which put a 26 Aug Short on
       the Kings of Leon page while sixteen more recent ones sat in the
       strip, and CHVRCHES' 10 Sep Short ahead of its 13 Sep one.

       Views are a reasonable tiebreak for "which of these matters most".
       They are the wrong answer entirely to "what is the latest". */
    const ranked = rankAssets(postBaseline);
    const lead = ranked[0] ?? null;
    const latest = [...postBaseline]
      .filter(a => a.videoId !== lead?.videoId)
      .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt))[0] ?? null;

    const heroIds = new Set([lead?.videoId, latest?.videoId].filter(Boolean));
    const heroes = [lead, latest].filter(Boolean) as CoverAsset[];
    heroes.forEach(a => { a.role = 'hero'; });

    /* The strip is everything else, in campaign order. */
    const supporting = postBaseline
      .filter(a => !heroIds.has(a.videoId))
      .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt))
      .slice(0, MAX_SUPPORTING);
    supporting.forEach(a => { a.role = 'supporting'; });

    const state = inMotion.length > 0
      ? 'CAMPAIGN_LIVE'
      : postBaseline.length > 0 ? 'NEW_ACTIVITY' : 'BASELINE';

    /* ── Movement since the baseline ───────────────────────────────── */
    const channelId = (snap as any)?.channelId;
    const daysSinceBaseline = startAt
      ? Math.max(1, Math.round((Date.now() - startAt.getTime()) / 86_400_000)) : null;

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
          `Channel movement covers ${viewsWindow.days} days, not the ${daysSinceBaseline} since the campaign started — `
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
       The sum of views on every asset published since the campaign
       started. Exact, not approximate: a video published after the start
       has accumulated all of its views during the campaign, so its
       lifetime counter IS its campaign total, and stays so.

       This is the figure that keeps the page honest, and the reason the
       channel delta below no longer appears on the cover. Kings of Leon
       earns roughly 700,000 views a day from a catalogue in which one
       2008 single holds 36.6% of 2.46 billion lifetime views. Over 27
       days that is ~19M, and a page that prints it under CAMPAIGN VIEWS
       is attributing Sex on Fire to a campaign that has not released the
       album yet. The campaign's own number is ~1.08M, and it is the one
       a label can defend in a room. */
    const campaignPerf = campaignStart
      ? campaignMetrics(campaignUploads, campaignStart)
      : null;

    const campaignViews = campaignPerf?.views ?? null;

    /* Kept in the payload because the Ideas tab and the analysis surfaces
       still want channel context, and removed from the cover's stats. Two
       large view figures side by side meant the bigger one won, and the
       bigger one was the catalogue. */
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
    /* The release the campaign is walking into, from the Coach plan, so the
       strategy question can be phrased as the campaign's own problem rather
       than as a third-person research query. Confirmed and major only, and
       null rather than a guess — the rollout falls back to wording that
       names no release at all. */
    const release = await nextConfirmedRelease(who.slug).catch(() => null);

    /* ── The hero that already landed, and the window it opened ────────
       A campaign walking towards its first hero and a campaign four days
       past one are at opposite ends of the same model, and the difference
       is entirely in the tense. This resolves the most recent MAJOR
       published asset — long-form, not a Short, because a Short is not a
       destination — so the strategy question can be about the thing that
       happened rather than the thing that is coming.

       Nothing here is a claim about intent. It is the newest long-form the
       channel has published since the Deep Dive, which is a fact. */
    /* The FOLLOW-UP ANCHOR, not "the newest thing that is not a Short".

       That old test asked the editorial label, and a human override had
       relabelled a 61-second CHVRCHES teaser as a trailer — so `kind !==
       'short'` passed, a teaser became the hero, and the page drew a
       dated follow-up window for a campaign in which nothing had landed.

       Qualification is now observed duration plus a title that is not
       announcing something else, and a human label can only veto. See
       campaignWindow.ts. Null is a normal state: a campaign in trailer
       and Shorts activation has no hero to follow. */
    const anchorRaw = campaignStart
      ? followUpAnchorFor(
          raw.map(v => ({
            videoId: v.id,
            title: v.title,
            publishedAt: v.publishedAt,
            durationSec: v.durationSec ?? null,
            statedKind: overrideFor(v.id)?.kind ?? null,
          })),
          campaignStart,
        )
      : null;
    const publishedHero = anchorRaw
      ? postBaseline.find(a => a.videoId === anchorRaw.videoId) ?? null
      : null;

    if (campaignStart && !publishedHero) {
      coverage.push(
        'No qualifying long-form asset has been published since the campaign started, so no follow-up '
        + 'window is shown. A follow-up belongs to a hero, and nothing has landed for it to follow.',
      );
    }

    const heroCtx = publishedHero
      ? { title: cleanAssetTitle(publishedHero.title, who.name), publishedAt: publishedHero.publishedAt }
      : null;

    /* The Deep Dive's follow-up window, dated from the hero rather than
       from today, so it is the same seven days whenever the page is read.
       Null when no hero has landed — for that campaign the window is a
       recommendation against a future date and the timeline already
       carries it. */
    const followUpWindow = publishedHero ? windowAfter(publishedHero.publishedAt) : null;

    const rollout = buildRollout(progress, library, runs, { release, hero: heroCtx });

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
        /* What to do, as opposed to what it is called. The read line prints
           this; the label stays the name of the stage. */
        action: it.nextAction,
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
      Date.now(),
      followUpWindow,
    ).catch(() => null);
    if (timeline) coverage.push(...timeline.coverage);

    /* ── The campaign's name ──────────────────────────────────────────
       A page called "CHVRCHES × YouTube" is an analytics view of an
       artist. A page called "All The King's Men" is the home of a
       campaign, and that is what someone from the label is opening.

       The name is read from the album release in the Coach plan rather
       than typed here, so it is the campaign the team is actually
       running and it arrives for every artist without a code change.
       No album in the plan means no campaign name, and the deck falls
       back to the artist identifier alone rather than inventing one. */
    const albumMoment = timeline?.moments.find(m => m.kind === 'ANCHOR') ?? null;
    const campaign = albumMoment
      ? { name: albumMoment.title, releaseDate: albumMoment.date, source: 'coach_plan' as const }
      : null;

    if (!campaign) {
      coverage.push('No album is named in the campaign plan, so this page carries the artist name rather than the campaign name.');
    }

    /* ── One read ──────────────────────────────────────────────────────
       Assembled from observed facts and an explicitly hedged forward
       clause. No causal claim: the channel woke and the campaign started,
       and those are two statements sitting next to each other. */
    const read = buildRead(state, heroes.length + supporting.length, baselineDormantDays, daysSinceUpload, stages, firstNewUploadAt);

    /* ── Fan response ──────────────────────────────────────────────────
       What the audience is positively responding to, in about eight words,
       or nothing at all. Rides this refresh rather than becoming its own
       system: the campaign asset list assembled above is exactly the input
       it needs.

       Scoped hard for quota: live campaigns only, newest four assets, and
       a 12-hour cache. That is ~4 units per live campaign per half-day
       against the ~1,110 the roster sync already spends.

       Never allowed to throw. A fan-response failure must not take down a
       campaign page whose real job is the campaign. */
    let fanResponse: unknown = null;
    if (state === 'CAMPAIGN_LIVE' || state === 'NEW_ACTIVITY') {
      try {
        const { readFanResponse, writeFanResponse } = await import('@/lib/kvCache');
        const cached = await readFanResponse<{ computedAt?: string }>(who.slug);
        const ageMs = cached?.computedAt ? Date.now() - new Date(cached.computedAt).getTime() : Infinity;

        if (cached && ageMs < 12 * 60 * 60 * 1000) {
          fanResponse = cached;
        } else {
          const { assetsToScan, fetchCommentsForAssets, buildFanResponse } =
            await import('@/lib/intelligence/fanResponse');
          const campaignAssets = [...heroes, ...supporting]
            .map(a => ({ videoId: a.videoId, title: a.title, publishedAt: a.publishedAt, comments: null as number | null }));
          const scan = assetsToScan(campaignAssets, 4);
          if (scan.length) {
            /* Public comment totals for the scanned assets, so the page can
               print an exact, checkable number rather than our sample size. */
            for (const a of scan) {
              const v = (snap as any)?.recentUploads?.find((u: any) => u.id === a.videoId);
              a.comments = typeof v?.commentCount === 'number' ? v.commentCount : null;
            }
            const { comments } = await fetchCommentsForAssets(scan.map(a => a.videoId));
            const fr = buildFanResponse(comments, scan);
            await writeFanResponse(who.slug, fr);
            fanResponse = fr;
          }
        }
      } catch { /* the campaign page does not fail over audience colour */ }
    }

    return NextResponse.json({
      state,
      fanResponse,
      artist: { slug: who.slug, name: who.name, handle: who.artist?.channelHandle ?? null },
      campaign,
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
        campaignAssets: campaignPerf?.assets ?? null,
        campaignShorts: campaignPerf?.shorts ?? null,
        campaignLongForm: campaignPerf?.longForm ?? null,
        /* Day 1 is the day the first asset landed. Set small on the page:
           it is the thing that makes the other two figures mean something,
           not a figure in its own right. */
        campaignDay: campaignPerf?.day ?? null,
        /* Which rule decided the boundary, so a reader can tell an
           observed campaign start from a fallback to the analysis date. */
        campaignStart: campaignStart
          ? { at: campaignStart.at, rule: campaignStart.rule } : null,
        campaignShare,
        newUploads: postBaseline.length,
        baselineDormantDays,
        daysSinceBaseline,
      },
      assets: {
        heroes, supporting,
        /* Everything published since the campaign started, so the strip can
           say what it is not showing rather than silently truncating. */
        total: postBaseline.length,
      },
      /* Derived, not stored: the 7-14 days after the published hero. */
      followUpWindow,
      stages,
      timeline,
      /* The same plan the stages were cut from, in full, for the Ideas
         tab. One fetch, one state — the tab cannot show a campaign the
         cover disagrees with because there is only one of them.

         References are trimmed on the way out. `objects` and `caveat` are
         the record — the ids somebody opened, and the things the API could
         not confirm — and the record is stronger than the page. Sending it
         to the browser would put methodology one devtools panel away from
         a slide that is deliberately about three ideas, and would tempt a
         future change into rendering it. The record stays here. */
      rollout: {
        ...rollout,
        items: rollout.items.map(it => ({
          ...it,
          references: it.references.map(({ objects, caveat, ...visible }) => visible),
        })),
      },
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
  daysSinceUpload: number | null,
  stages: { label: string; status: string; action?: string | null }[],
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
    /* Forward, and concrete.

       This line used to print the stage's TITLE — "Next: Don't leave the hero
       alone." That is the name of an argument, and a reader who has not read
       the argument learns nothing from it except that somebody is worried.
       The plan now carries an instruction alongside the title, resolved
       against the hero or release where it names one, and that instruction is
       what belongs after the word "Next".

       The title remains the fallback, lowercased as before so it reads as a
       clause rather than a heading. An item with no stated action is a gap in
       the plan, not a reason to print nothing. */
    line: next
      ? `Next: ${next.action ?? next.label.charAt(0).toLowerCase() + next.label.slice(1)}.`
      : 'Now we\'re watching what follows it.',
  };
}
