/* ═══════════════════════════════════════════════════════════════════════
   WHICH FORMAT ACTUALLY WORKS ON THIS CHANNEL

   Every artist page recommends building more formats around a release.
   None of them say WHICH format earns its cost on this particular
   channel, and the answer is not the same twice: Ezra Collective's
   visualisers out-perform their lyric videos two to one, which is not a
   rule anyone could have guessed from the roster.

   ── MEDIAN, NOT TOTAL, NOT MEAN ───────────────────────────────────────
   One live video at 390k and four at nine thousand is not a channel
   where live works; it is a channel with one hit. The median says what
   the NEXT one of these is likely to do, which is the question a team
   asking "should we make another" is actually asking.

   ── THE AGE PROBLEM, AND WHY IT IS SURVIVABLE HERE ────────────────────
   Views accumulate, so a format whose uploads are older has had longer
   to gather them. That is a real bias and it is NOT corrected — there is
   no per-video history far enough back to correct it with.

   What makes the comparison usable anyway is that the bias runs in a
   known direction: it flatters the OLDER format. So when a newer format
   wins, the margin is a floor rather than an artefact, and when an older
   format wins narrowly, it should be read as "no clear difference". The
   median age is returned per format so the page can show it and a reader
   can apply that themselves rather than being asked to trust the order.

   ── SHORTS ARE NOT IN THE RANKING ─────────────────────────────────────
   YouTube changed how Shorts views are counted in March 2025, so a
   Shorts view and a long-form view are not the same unit. Ranking them
   together would be arithmetic on two different measures. They are
   counted and returned separately, never placed in the order.
   ═══════════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';
import { classifyLaunchType, type LaunchContentType } from '@/components/LaunchModule';

/** The long-form formats worth comparing. Ranked in this order on ties. */
const RANKED_TYPES: LaunchContentType[] = [
  'OFFICIAL_VIDEO', 'LYRIC_VIDEO', 'VISUALIZER', 'LIVE', 'BTS',
];

export const FORMAT_LABEL: Record<string, string> = {
  OFFICIAL_VIDEO: 'Official video',
  LYRIC_VIDEO: 'Lyric video',
  VISUALIZER: 'Visualiser',
  LIVE: 'Live',
  BTS: 'BTS',
};

export interface FormatRow {
  type: LaunchContentType;
  label: string;
  /** Median views — what the next one of these is likely to do. */
  median: number;
  /** How many uploads the median is drawn from. */
  count: number;
  /** Median age in days, so the reader can discount an older format. */
  medianAgeDays: number;
}

export interface FormatPerformance {
  rows: FormatRow[];
  /** Best format, only when it is meaningfully ahead. See `clear`. */
  best: FormatRow | null;
  /**
   * Whether the lead is big enough to call. A 5% gap between two medians
   * of four videos each is noise, and a card that declares a winner on
   * it is worse than one that says the formats look similar.
   */
  clear: boolean;
  shorts: { median: number; count: number } | null;
  windowDays: number;
}

/** Below this, a median is one or two videos and says nothing. */
const MIN_PER_FORMAT = 3;

/** The lead has to beat the runner-up by this much to be called. */
const CLEAR_MARGIN = 1.25;

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function formatPerformance(
  uploads: RecentUpload[],
  windowDays = 365,
): FormatPerformance {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const now = Date.now();

  const groups = new Map<LaunchContentType, { views: number[]; ages: number[] }>();
  let shortViews: number[] = [];

  for (const u of uploads) {
    const ts = new Date(u.publishedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    /* A view count of zero is a video the cache has not filled in yet,
       not a video nobody watched. Including it would drag a median down
       for a reason that has nothing to do with the format. */
    if (!(u.viewCount > 0)) continue;

    const isShort = u.durationSec > 0 && u.durationSec <= 62;
    if (isShort) { shortViews.push(u.viewCount); continue; }

    const type = classifyLaunchType(u.title, 'video');
    if (!RANKED_TYPES.includes(type)) continue;
    const g = groups.get(type) ?? { views: [], ages: [] };
    g.views.push(u.viewCount);
    g.ages.push(Math.round((now - ts) / 86_400_000));
    groups.set(type, g);
  }

  const rows: FormatRow[] = RANKED_TYPES
    .map((type) => {
      const g = groups.get(type);
      if (!g || g.views.length < MIN_PER_FORMAT) return null;
      return {
        type,
        label: FORMAT_LABEL[type] ?? type,
        median: median(g.views),
        count: g.views.length,
        medianAgeDays: median(g.ages),
      };
    })
    .filter((r): r is FormatRow => r !== null)
    .sort((a, b) => b.median - a.median);

  const best = rows[0] ?? null;
  const runnerUp = rows[1] ?? null;
  /* With nothing to compare against, a single format is not a finding —
     it is the only thing we measured. */
  const clear = !!best && !!runnerUp && best.median >= runnerUp.median * CLEAR_MARGIN;

  return {
    rows,
    best,
    clear,
    shorts: shortViews.length >= MIN_PER_FORMAT
      ? { median: median(shortViews), count: shortViews.length }
      : null,
    windowDays,
  };
}
