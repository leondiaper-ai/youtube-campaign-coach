/* ═══════════════════════════════════════════════════════════════════════
   WHAT IS ACTUALLY BEING WATCHED RIGHT NOW

   Ranking a video grid by lifetime views answers "what has done best ever",
   which on an artist page is almost always the wrong question — it returns
   the same four videos every week and a release that is climbing today
   cannot appear until it has out-earned three years of catalogue.

   The daily cron has been recording per-video observations into
   vsnap:{videoId} for a while (views, likes, comments, one row per day) and
   nothing has ever read them. This module reads them, so the grid can rank
   by views gained in the last week instead.

   ── THE HONESTY PROBLEM ───────────────────────────────────────────────
   Coverage is uneven and always will be. The writer records only the ~60
   newest uploads per channel per run, series start whenever that shipped,
   and a channel that was not synced for a stretch has gaps. So a recent
   ranking is available for some artists and not others, and it will appear
   and disappear over time.

   Two rules follow, and both are enforced here rather than left to callers:

   1. A gain is only reported when the two observations actually span close
      to the window asked for. Differencing a 2-day span and labelling it
      "last 7 days" is a fabrication, and it is the kind that looks fine.
      The real span is returned so the page can say what it measured.

   2. The basis is decided for the whole grid, never per video. A grid that
      silently mixed recent-gain and lifetime ordering would be a ranking of
      nothing at all — so if too few videos have usable series, the whole
      grid falls back to lifetime and says so.
   ═══════════════════════════════════════════════════════════════════════ */

import { readVideoSeriesMany, type VideoSeries } from './videoSnapshots';

export interface MomentumCandidate {
  id: string;
  title: string;
  /** Lifetime views from the cached snap — the fallback ordering. */
  views: number;
  publishedAt: string;
}

/**
 * How a video stands against the ones that came before it.
 *
 * ── WHY THIS IS NOT A VIEWS-PER-DAY COMPARISON ────────────────────────
 * The obvious way to ask "is this outperforming the last album" is to
 * compare each video at the same age. We cannot: per-video daily series
 * only start when the recorder shipped, so a release from last year has
 * no first-fortnight curve to compare against, and `viewsAtAge` returns
 * null for exactly the videos a benchmark would need.
 *
 * The other obvious way — lifetime views divided by age — is worse than
 * useless. View rate decays steeply, so a 9-day-old video always wins on
 * average-per-day and every new upload would be tagged as outperforming.
 *
 * ── WHAT IS ACTUALLY PROVABLE ─────────────────────────────────────────
 * Views only go up. So if a video is YOUNGER than another and already has
 * MORE views, it has beaten that video's entire lifetime total in less
 * time — and no age correction is needed to say so, because the age
 * difference runs against the claim rather than for it.
 *
 * That is the whole measure: of the uploads older than this one, how many
 * has it already passed. It understates rather than overstates, which is
 * the right direction for a badge.
 */
export interface AheadOf {
  /** Older uploads whose lifetime total this video has already passed. */
  passed: number;
  /** How many older uploads it was compared against. */
  of: number;
}

export interface RankedVideo extends MomentumCandidate {
  /** Views added across `spanDays`, or null when no usable series. */
  recentGain: number | null;
  /** Days actually spanned by the two observations used. */
  spanDays: number | null;
  /** Set only when it has passed at least half of the older uploads. */
  aheadOf: AheadOf | null;
}

/**
 * Below this many older uploads there is no comparison worth printing —
 * "ahead of 1 of 1" is noise, and the oldest videos on a channel have
 * nothing behind them at all.
 */
const MIN_REFERENCE = 4;

/**
 * The share of older uploads a video must have passed to earn the badge.
 *
 * Tuned against the Kings of Leon long-form catalogue, because a badge
 * that lands on half a grid says nothing. Beating the median tagged 21 of
 * 39 uploads; 0.8 tagged 10; 0.9 tags 5, which is the level where the
 * badge picks out releases that are genuinely ahead of the catalogue
 * rather than merely above its weaker half.
 *
 * At 0.9 the tagged set is My Whole World (35 of 35 — it has passed every
 * older long-form on the channel) and the previous album's best, To Space
 * at 28 of 30. That is the comparison this was asked for.
 */
const AHEAD_RATIO = 0.9;

function computeAheadOf(v: MomentumCandidate, all: MomentumCandidate[]): AheadOf | null {
  const born = Date.parse(v.publishedAt);
  if (!Number.isFinite(born)) return null;

  const older = all.filter((o) => {
    if (o.id === v.id) return false;
    const t = Date.parse(o.publishedAt);
    return Number.isFinite(t) && t < born;
  });
  if (older.length < MIN_REFERENCE) return null;

  const passed = older.filter(o => v.views > o.views).length;
  if (passed < Math.ceil(older.length * AHEAD_RATIO)) return null;
  return { passed, of: older.length };
}

export type RankBasis = 'recent' | 'lifetime';

export interface RankedGrid {
  items: RankedVideo[];
  basis: RankBasis;
  /** Requested window, e.g. 7. */
  windowDays: number;
  /** How many of the candidates had a usable gain. */
  covered: number;
  total: number;
  /** Ready-to-print explanation of what the order means. */
  note: string;
}

/**
 * How many candidates need a usable recent gain before the grid ranks by
 * it.
 *
 * This was a 50% share, and it was the wrong rule. On a catalogue channel
 * coverage is never going to reach half: the writer records the ~60
 * newest uploads per run, so a 33-video grid with 10 series sat at 30%
 * and fell back to lifetime — which returns the same four videos from
 * 2018 every week, the exact failure this module was written to fix.
 *
 * The reason the proportional floor felt safe was a worry that ranking on
 * a subset would hide a hot video that has no series. That worry has it
 * backwards. Coverage favours the NEWEST uploads, because those are the
 * ones the cron keeps recording — so the videos missing a series are
 * overwhelmingly old catalogue, which is precisely what should not be
 * leading a "moving now" grid.
 *
 * So the floor is now a small absolute count. Enough that the order is
 * not decided by one or two videos, low enough that a channel with real
 * recent history gets a real recent ranking. Anything without a series
 * still appears, below everything that has one, and the note says how
 * many were ranked on what.
 */
const MIN_RANKED = 3;

/** A 7-day window accepts a 5–9 day span. Outside that it is not a week. */
const SPAN_TOLERANCE = 2;

/**
 * Views gained over roughly `windowDays`, from the newest observation
 * backwards. Returns null unless the span is within tolerance.
 */
export function recentGain(
  series: VideoSeries | null | undefined,
  windowDays: number,
  tolerance = SPAN_TOLERANCE,
): { gain: number; spanDays: number } | null {
  const obs = series?.observations;
  if (!obs || obs.length < 2) return null;

  /* Observations are appended in order, but a store that has been edited
     or partially restored could be out of order. Sorting costs nothing at
     this size and removes a whole class of negative-gain bug. */
  const sorted = [...obs].sort((a, b) => a.ts.localeCompare(b.ts));
  const latest = sorted[sorted.length - 1];
  const latestAt = Date.parse(latest.ts + 'T12:00:00Z');
  if (!Number.isFinite(latestAt)) return null;

  let best: { gain: number; spanDays: number } | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const o = sorted[i];
    const at = Date.parse(o.ts + 'T12:00:00Z');
    if (!Number.isFinite(at)) continue;
    const span = Math.round((latestAt - at) / 86_400_000);
    if (span <= 0) continue;
    if (Math.abs(span - windowDays) > tolerance) {
      /* Past the window and still not close enough — older rows only get
         further away, so stop rather than scanning the whole series. */
      if (span > windowDays + tolerance) break;
      continue;
    }
    const gain = latest.views - o.views;
    /* A negative gain means YouTube revised the count down, or the video
       was re-uploaded. Either way it is not "views added" and ranking on
       it would put corrections at the bottom as though they were failures. */
    if (gain < 0) continue;
    const candidate = { gain, spanDays: span };
    if (!best || Math.abs(span - windowDays) < Math.abs(best.spanDays - windowDays)) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Rank a set of videos by what they have added recently, falling back to
 * lifetime views when too few have usable history.
 *
 * `limit` is applied after ranking, so the top N is the top N on whichever
 * basis was chosen.
 */
export async function rankByMomentum(
  candidates: MomentumCandidate[],
  { windowDays = 7, limit = 4 }: { windowDays?: number; limit?: number } = {},
): Promise<RankedGrid> {
  const total = candidates.length;
  if (total === 0) {
    return {
      items: [], basis: 'lifetime', windowDays, covered: 0, total: 0,
      note: 'No videos in our cached inventory.',
    };
  }

  const series = await readVideoSeriesMany(candidates.map(c => c.id));

  const scored: RankedVideo[] = candidates.map(c => {
    const g = recentGain(series.get(c.id), windowDays);
    /* Compared against the FULL candidate list, not the handful that will
       be displayed — the reference set is everything of this format we
       hold for the channel, so the badge does not change meaning when the
       grid's limit changes. */
    return {
      ...c,
      recentGain: g?.gain ?? null,
      spanDays: g?.spanDays ?? null,
      aheadOf: computeAheadOf(c, candidates),
    };
  });

  const withGain = scored.filter(v => v.recentGain != null);
  const covered = withGain.length;
  const basis: RankBasis = covered >= MIN_RANKED ? 'recent' : 'lifetime';

  const items =
    basis === 'recent'
      ? /* Videos without a series still appear, but below everything that
           has one — they are unranked on this basis, not zero-performing. */
        [...scored].sort((a, b) => {
          if (a.recentGain == null && b.recentGain == null) return b.views - a.views;
          if (a.recentGain == null) return 1;
          if (b.recentGain == null) return -1;
          return b.recentGain - a.recentGain;
        })
      : [...scored].sort((a, b) => b.views - a.views);

  return {
    items: items.slice(0, limit),
    basis,
    windowDays,
    covered,
    total,
    note: describeBasis(basis, windowDays, covered, total),
  };
}

function describeBasis(
  basis: RankBasis, windowDays: number, covered: number, total: number,
): string {
  if (basis === 'recent') {
    const caveat = covered < total ? ` · ${total - covered} without daily history, shown last` : '';
    return `Ranked by views added in the last ${windowDays} days${caveat}`;
  }
  if (covered > 0) {
    return `Ranked by lifetime views — only ${covered} of ${total} have daily history so far, and ${MIN_RANKED} are needed to rank by recent views`;
  }
  return 'Ranked by lifetime views — daily per-video history has not accumulated for this channel yet';
}
