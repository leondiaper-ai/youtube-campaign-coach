/**
 * WHEN THE CAMPAIGN STARTED, AND WHAT IT HAS EARNED SINCE
 *
 * ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────
 * Watcher held four different answers to "when did this campaign start",
 * and three surfaces each picked a different one:
 *
 *   artist.campaignStartDate   the day somebody pinned the artist in
 *                              Watcher. Written automatically as `today`.
 *   campaignStore baseline     captured seconds later in the same handler,
 *                              and rendered as "SINCE TAKEOVER (N days)".
 *   deepDive.dataCapturedAt    the day the analysis was run. A constant in
 *                              a module.
 *   progress.statedAt          when a person recorded an implementation.
 *
 * None of those is when the campaign started. Two are when WE arrived and
 * one is when we looked. On Kings of Leon the first gave 13 assets and the
 * third gave 10, for the same campaign, on the same afternoon — and the
 * difference was not a bug in either, it was two dates both being called
 * "campaign start".
 *
 * "Since takeover" and "since the campaign began" are different questions
 * and this module answers only the second. The first belongs to the
 * campaign store and keeps its own name.
 *
 * ── WHAT A CAMPAIGN START IS ──────────────────────────────────────────
 * The moment the channel's behaviour changed. Artists do not drift into a
 * campaign; they go from sporadic to sustained, usually with a countdown.
 * That transition is visible in publishedAt alone, and needs no Studio
 * data, no human record and no API call this app is not already making.
 *
 * Kings of Leon: uploads on 5 Jul, 9 Jul, 24 Jul, 29 Jul — and then a
 * fourteen-day silence, and then 12 Aug "29 days 'til…", 13 Aug, 14 Aug,
 * 17 Aug "24 days 'til…", and near-daily from there to My Whole World on
 * 10 Sep. 12 August + 29 days = 10 September. The channel told us when the
 * campaign started; nobody was reading it.
 *
 * Resolution order, and the rule that fired is always reported:
 *
 *   HUMAN_STATED   somebody said so. Beats every observation.
 *   ERA_ONSET      the first upload of the most recent sustained run.
 *   BASELINE       the Deep Dive capture date. A last resort, and honest
 *                  about being one: it is when we started looking.
 *
 * ── WHAT CAMPAIGN VIEWS MEANS ─────────────────────────────────────────
 * The sum of views on assets the channel published on or after that date.
 *
 * This is exact rather than approximate, which is worth stating because
 * the codebase previously hedged about it. A video published after the
 * campaign started has accumulated every one of its views during the
 * campaign — its lifetime counter IS its campaign total, by definition,
 * and stays so forever. The approximation only appears if you include
 * assets that existed beforehand, which this never does.
 *
 * What it is NOT, and must never quietly become, is a channel-level view
 * delta. Kings of Leon earns roughly 700,000 views a day from a catalogue
 * where one 2008 single holds 36.6% of 2.46 billion lifetime views. Over
 * 27 days that is ~19M, and labelling it CAMPAIGN VIEWS attributes Sex on
 * Fire to a campaign that has not released the album yet.
 */

/**
 * ── THE ONE FUNCTION EVERY SURFACE CALLS ──────────────────────────────
 * `campaignPerformanceFor()` at the bottom of this file. Six surfaces used
 * to compute this themselves — the same four lines copy-pasted, with two
 * different Shorts rules, five different Day-N formulas (two off by one,
 * two able to render "Day 0") and two weekly-bucket implementations that
 * had already drifted apart. They are now one call.
 *
 * If a surface needs campaign performance and is not calling this, that
 * surface is wrong, however reasonable its arithmetic looks.
 */

/** The minimum silence that separates one era of a channel from the next. */
const ERA_GAP_DAYS = 10;

/** A run shorter than this is a stray upload, not the start of a campaign. */
const MIN_ERA_UPLOADS = 3;

/** How far back to look for an onset. Beyond this it is a different year. */
const MAX_LOOKBACK_DAYS = 400;

export type CampaignStartRule = 'HUMAN_STATED' | 'ERA_ONSET' | 'BASELINE';

export interface CampaignStart {
  /** ISO instant. Compared with `>=`, so an asset on the day counts. */
  at: string;
  rule: CampaignStartRule;
  /** One line, for the coverage list. Always populated. */
  because: string;
}

export interface CampaignUpload {
  publishedAt: string;
  /** Lifetime views. For a post-start asset this is its campaign total. */
  views?: number | null;
  kind?: 'short' | 'video' | string | null;
}

export interface CampaignMetrics {
  start: CampaignStart;
  /** Day 1 is the day of the first asset, not the day after it. */
  day: number;
  assets: number;
  shorts: number;
  longForm: number;
  /** Null, never 0, when there are no assets — a campaign that has not
      published is not a campaign that earned nothing. */
  views: number | null;
}

const DAY = 86_400_000;
const ts = (iso: string) => new Date(iso).getTime();

/**
 * The first upload of the most recent sustained run.
 *
 * Walks newest to oldest and stops at the FIRST silence long enough to
 * count, not the longest one. The longest gap in a channel's year is
 * usually somewhere in the middle of last winter; the most recent one is
 * the edge of the current era, which is the question being asked.
 */
export function eraOnset(uploads: CampaignUpload[], now = Date.now()): string | null {
  const dates = uploads
    .map(u => u.publishedAt)
    .filter(d => d && Number.isFinite(ts(d)))
    .filter(d => now - ts(d) <= MAX_LOOKBACK_DAYS * DAY)
    .sort()
    .reverse();
  if (dates.length < MIN_ERA_UPLOADS) return null;

  for (let i = 0; i < dates.length - 1; i++) {
    const gap = (ts(dates[i]) - ts(dates[i + 1])) / DAY;
    if (gap < ERA_GAP_DAYS) continue;
    /* dates[i] opens the run. Everything from index 0 to i belongs to it. */
    return i + 1 >= MIN_ERA_UPLOADS ? dates[i] : null;
  }
  /* No qualifying silence: the channel has been publishing continuously,
     so there is no observable onset to point at. Say so rather than
     returning the oldest upload we happen to hold. */
  return null;
}

export function resolveCampaignStart(opts: {
  uploads: CampaignUpload[];
  /** A date a person stated. Beats every observation. */
  statedAt?: string | null;
  statedBy?: string | null;
  /** The Deep Dive capture date. Last resort only. */
  baselineAt?: string | null;
  now?: number;
}): CampaignStart | null {
  const now = opts.now ?? Date.now();

  if (opts.statedAt && Number.isFinite(ts(opts.statedAt))) {
    return {
      at: opts.statedAt,
      rule: 'HUMAN_STATED',
      because: `Campaign start stated by ${opts.statedBy ?? 'a person'}.`,
    };
  }

  const onset = eraOnset(opts.uploads, now);
  if (onset) {
    return {
      at: onset,
      rule: 'ERA_ONSET',
      because:
        `Campaign start observed from the channel: the first upload after ${ERA_GAP_DAYS}+ days of silence, `
        + 'followed by a sustained run. Nobody has stated a date, so this is derived from publishedAt.',
    };
  }

  if (opts.baselineAt && Number.isFinite(ts(opts.baselineAt))) {
    return {
      at: opts.baselineAt,
      rule: 'BASELINE',
      because:
        'No stated campaign start and no observable change in publishing behaviour, so figures run from the '
        + 'Deep Dive capture date — which is when we started looking, not when the campaign began.',
    };
  }

  return null;
}

/**
 * Everything the campaign has published, and what it has earned.
 *
 * Inclusive of the start instant: the upload that opens an era IS the
 * first asset of the campaign, and excluding it by a strict `>` was one
 * half of the 13-versus-10 disagreement.
 */
export function campaignMetrics(
  uploads: CampaignUpload[],
  start: CampaignStart,
  now = Date.now(),
): CampaignMetrics {
  const from = ts(start.at);
  const mine = uploads.filter(u => {
    const at = ts(u.publishedAt);
    return Number.isFinite(at) && at >= from;
  });

  const shorts = mine.filter(u => u.kind === 'short').length;
  const views = mine.reduce((n, u) => n + (u.views ?? 0), 0);

  return {
    start,
    /* Day 1 on the day the first asset landed. A campaign is not on day 0
       the afternoon it starts, and it is not on day 2 either. */
    day: Math.max(1, Math.floor((now - from) / DAY) + 1),
    assets: mine.length,
    shorts,
    longForm: mine.length - shorts,
    views: mine.length ? views : null,
  };
}

/* ══ THE ENTRY POINT ══════════════════════════════════════════════════ */

/** The minimum a caller must hold. `RecentUpload` satisfies it structurally. */
export interface RawUpload {
  publishedAt: string;
  viewCount?: number | null;
  durationSec?: number | null;
}

/**
 * The Shorts rule, written once.
 *
 * It was `durationSec <= 62` in four files and `kind === 'short'` in a
 * fifth, which is the kind of divergence nobody notices until two pages
 * disagree about how many Shorts a campaign has published.
 */
export function toCampaignUploads(raw: RawUpload[]): CampaignUpload[] {
  return (raw ?? []).map(u => ({
    publishedAt: u.publishedAt,
    views: u.viewCount ?? null,
    kind: (u.durationSec ?? 0) > 0 && (u.durationSec ?? 0) <= 62 ? 'short' : 'video',
  }));
}

/**
 * CAMPAIGN PERFORMANCE, FOR ANY SURFACE.
 *
 * Give it the channel's recent uploads and, where one exists, the date a
 * person stated. It returns the start (with the rule that decided it) and
 * the figures, or null when no start can be resolved — which is the honest
 * answer for a channel nobody has pinned and that has published
 * continuously for a year.
 *
 * `statedAt` is how a human date reaches the resolver. Team Watcher stores
 * one against every campaign and it was, until this migration, unreachable
 * from any caller: the HUMAN_STATED branch existed and nothing used it.
 *
 * Deliberately NOT here: any channel-level figure. `channelDeltaSince()` in
 * lib/snapshots.ts is a whole-channel measurement and remains useful for
 * exactly that — it must never be reachable through a function with the
 * word "campaign performance" on it.
 */
export function campaignPerformanceFor(opts: {
  uploads: RawUpload[];
  statedAt?: string | null;
  statedBy?: string | null;
  baselineAt?: string | null;
  now?: number;
}): CampaignMetrics | null {
  const uploads = toCampaignUploads(opts.uploads);
  const start = resolveCampaignStart({
    uploads,
    statedAt: opts.statedAt,
    statedBy: opts.statedBy,
    baselineAt: opts.baselineAt,
    now: opts.now,
  });
  if (!start) return null;
  return campaignMetrics(uploads, start, opts.now ?? Date.now());
}

/* ══ THE FOLLOW-UP ANCHOR ═════════════════════════════════════════════
   ── WHY THIS IS SEPARATE FROM THE CAMPAIGN START ──────────────────────
   A follow-up window belongs to an ASSET, not to a campaign.

   The Deep Dive's recommendation is "put a second destination inside the
   7-14 days after the hero". That sentence has a hero in it. A campaign
   that has published a trailer and two Shorts has no hero, so it has no
   window — there is nothing for a follow-up to follow.

   CHVRCHES proved it: campaign start resolved correctly to 9 Sep, and the
   page then drew "16 SEP - 23 SEP · FOLLOW-UP WINDOW" off the back of a
   61-second teaser. The campaign had started; nothing had landed.

   ── WHY THE TEST IS ON THE OBJECT, NOT THE LABEL ──────────────────────
   The old test was `kind !== 'short'`, and a human format override had
   relabelled that 61-second Short as a trailer — so an editorial note
   promoted a teaser into a hero. A person's label may VETO an anchor
   (somebody who knows it is a trailer knows something the duration does
   not say) but it may never create one. Qualification is observed:
   duration first, and a title that is not announcing something else.
*/

/** Below this, it is a teaser or a Short however it has been labelled. */
const MIN_ANCHOR_SEC = 90;

/** Titles that announce a destination rather than being one. */
const NOT_A_DESTINATION =
  /\b(trailer|teaser|snippet|preview|announce\w*|out\s+now\s+snippet|coming\s+soon|countdown)\b|\d+\s*days?\s*['’]?\s*til|\bpre[- ]?save\b/i;

/** Human kinds that disqualify outright. A label can veto, never promote. */
const VETO_KINDS = new Set(['short', 'trailer', 'teaser', 'announcement', 'clip']);

export interface AnchorCandidate {
  videoId?: string;
  title: string;
  publishedAt: string;
  /** OBSERVED duration. Never the editorial label. */
  durationSec?: number | null;
  /** A human's format label, where one exists. Veto only. */
  statedKind?: string | null;
}

/**
 * Does this asset earn a follow-up window?
 *
 * Deliberately conservative. A campaign with no window says "nothing has
 * landed yet", which is true and useful. A campaign with a window drawn
 * off a teaser tells a label there is a deadline that does not exist.
 */
export function qualifiesAsAnchor(a: AnchorCandidate): boolean {
  const dur = a.durationSec ?? 0;
  /* An unknown duration is not a long-form asset. This is the specific
     hole the CHVRCHES trailer came through: absent or zero must fail. */
  if (!(dur >= MIN_ANCHOR_SEC)) return false;
  if (a.statedKind && VETO_KINDS.has(a.statedKind.toLowerCase())) return false;
  if (NOT_A_DESTINATION.test(a.title ?? '')) return false;
  return true;
}

/**
 * The most recent qualifying long-form asset published since the campaign
 * started, or null. Null is a normal state for a campaign in activation.
 */
export function followUpAnchorFor(
  candidates: AnchorCandidate[],
  start: CampaignStart,
): AnchorCandidate | null {
  const from = ts(start.at);
  return [...(candidates ?? [])]
    .filter(a => {
      const at = ts(a.publishedAt);
      return Number.isFinite(at) && at >= from && qualifiesAsAnchor(a);
    })
    .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt))[0] ?? null;
}
