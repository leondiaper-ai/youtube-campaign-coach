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

export interface RankedVideo extends MomentumCandidate {
  /** Views added across `spanDays`, or null when no usable series. */
  recentGain: number | null;
  /** Days actually spanned by the two observations used. */
  spanDays: number | null;
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
 * Minimum share of candidates that need a usable recent gain before the
 * grid ranks by it. Below this the ordering would be decided by whichever
 * handful happen to have series, which is worse than an honest lifetime
 * ranking because it looks the same.
 */
const COVERAGE_FLOOR = 0.5;

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
    return { ...c, recentGain: g?.gain ?? null, spanDays: g?.spanDays ?? null };
  });

  const withGain = scored.filter(v => v.recentGain != null);
  const covered = withGain.length;
  const basis: RankBasis = covered / total >= COVERAGE_FLOOR ? 'recent' : 'lifetime';

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
    return `Ranked by lifetime views — only ${covered} of ${total} have enough daily history to rank by recent views yet`;
  }
  return 'Ranked by lifetime views — daily per-video history has not accumulated for this channel yet';
}
