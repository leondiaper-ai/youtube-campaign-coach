/* ═══════════════════════════════════════════════════════════════════
   SHORTS vs LONG-FORM VIEW SPLIT

   WHAT THIS CAN AND CANNOT TELL YOU — read before using a figure.

   A channel's lifetime view count is ONE NUMBER from the YouTube Data
   API (channel.statistics.viewCount). There is no public way to
   decompose it by format. So a true "this channel's Shorts views vs
   long-form views" does not exist and this file does not pretend to
   produce one.

   What it produces instead is the split across the videos we have
   actually inventoried, together with the coverage that split is based
   on. Coverage is not a footnote — it is returned as a first-class
   field, because the same split means very different things at 95%
   coverage and at 6%.

   Our inventory is capped: 100 uploads normally, 300 during a campaign
   (see lib/youtube.ts). For a developing artist that is the whole
   catalogue. For League of Legends it is 100 of 1,817 videos. Summing
   inventoried views and calling it the channel total would be wrong by
   an order of magnitude, so `viewsCovered` is always reported against
   `channelLifetimeViews` and callers are expected to surface it.

   WHAT THIS DELIBERATELY DOES NOT DO
     - It does not scale the split up to channel totals. No
       extrapolation, no "estimated Shorts views" derived from a ratio.
     - It does not compute historical format views. Daily history
       (ChannelSnapshot) stores a single total `views`, so a 7/30/90-day
       format split cannot be back-computed from it. Deriving one would
       silently invent numbers. Real period comparison requires storing
       per-format sums going forward — see formatSplitHistory().

   Classification comes from classifyUploadFormat(), which uses
   duration AND title markers, not duration alone: a 55-second trailer
   is a Short by duration but a 3-minute video tagged #shorts is also a
   Short, and only the title reveals it.
   ═══════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';
import { classifyUploadFormat } from './formatClassifier';

/** How much of the channel this split actually saw. */
export type SplitCoverage = {
  /** Videos included in the split. */
  videosCounted: number;
  /** Public videos the channel says it has, when known. */
  channelVideoCount: number | null;
  /** Channel lifetime views, when known. The denominator that matters. */
  channelLifetimeViews: number | null;
  /** Sum of inventoried video views ÷ channel lifetime views (0–1). */
  viewsCovered: number | null;
  /** videosCounted ÷ channelVideoCount (0–1). */
  videosCovered: number | null;
  /**
   * complete  — we hold essentially every video (≥95% of videos).
   * partial   — a real sample but not the channel (≥20% of views).
   * sample    — a small slice; the split describes these videos only.
   *
   * UI must not present `sample` as a channel-level figure.
   */
  confidence: 'complete' | 'partial' | 'sample';
};

export type FormatSplit = {
  totalViews: number;
  longformViews: number;
  shortsViews: number;
  /** Share of the COUNTED views, not of the channel. 0–1. */
  longformShare: number;
  shortsShare: number;
  longformCount: number;
  shortsCount: number;
  coverage: SplitCoverage;
  /** Window described, when the caller filtered by date. */
  windowDays: number | null;
};

const EMPTY = (windowDays: number | null, coverage: SplitCoverage): FormatSplit => ({
  totalViews: 0, longformViews: 0, shortsViews: 0,
  longformShare: 0, shortsShare: 0,
  longformCount: 0, shortsCount: 0,
  coverage, windowDays,
});

/**
 * Split a set of uploads into Shorts and long-form views.
 *
 * `windowDays` filters by publish date. Note what that means: it is
 * "views accumulated by videos PUBLISHED in this window", not "views
 * received during this window". The second is a YouTube Analytics
 * metric we do not have. The distinction matters — a catalogue video
 * can earn millions this week and will not appear in any window here.
 * Callers must label it as published-in-window.
 */
export function computeFormatSplit(
  uploads: RecentUpload[],
  opts: {
    channelVideoCount?: number | null;
    channelLifetimeViews?: number | null;
    windowDays?: number | null;
    now?: number;
  } = {},
): FormatSplit {
  const now = opts.now ?? Date.now();
  const windowDays = opts.windowDays ?? null;
  const channelVideoCount = opts.channelVideoCount ?? null;
  const channelLifetimeViews = opts.channelLifetimeViews ?? null;

  const inWindow = windowDays == null
    ? uploads
    : uploads.filter((u) => {
        const age = now - new Date(u.publishedAt).getTime();
        return age >= 0 && age <= windowDays * 86_400_000;
      });

  let longformViews = 0, shortsViews = 0, longformCount = 0, shortsCount = 0;
  for (const u of inWindow) {
    const views = Number.isFinite(u.viewCount) ? u.viewCount : 0;
    if (classifyUploadFormat(u) === 'short') {
      shortsViews += views;
      shortsCount++;
    } else {
      longformViews += views;
      longformCount++;
    }
  }

  const totalViews = longformViews + shortsViews;

  /* Coverage is measured against the FULL inventory, not the window.
     A 7-day window legitimately holds two videos; that is not 1%
     coverage of a channel, it is a complete view of that week. So the
     denominator for coverage is always the whole inventory we hold. */
  const inventoryViews = uploads.reduce(
    (t, u) => t + (Number.isFinite(u.viewCount) ? u.viewCount : 0), 0,
  );
  const viewsCovered =
    channelLifetimeViews && channelLifetimeViews > 0
      ? Math.min(1, inventoryViews / channelLifetimeViews)
      : null;
  const videosCovered =
    channelVideoCount && channelVideoCount > 0
      ? Math.min(1, uploads.length / channelVideoCount)
      : null;

  /* Confidence is driven by VIEW coverage first. The cached channel
     snapshot carries lifetime views but not videoCount, so video-count
     coverage is usually unknown — and view coverage is the better
     measure anyway: holding 98% of a channel's views matters more than
     holding 98% of its videos, because view distribution is extremely
     skewed. A channel can be missing half its uploads and still have
     99% of its views accounted for. */
  let confidence: SplitCoverage['confidence'] = 'sample';
  if ((viewsCovered != null && viewsCovered >= 0.95) ||
      (videosCovered != null && videosCovered >= 0.95)) confidence = 'complete';
  else if (viewsCovered != null && viewsCovered >= 0.2) confidence = 'partial';

  const coverage: SplitCoverage = {
    videosCounted: inWindow.length,
    channelVideoCount,
    channelLifetimeViews,
    viewsCovered,
    videosCovered,
    confidence,
  };

  if (totalViews === 0) return EMPTY(windowDays, coverage);

  return {
    totalViews,
    longformViews,
    shortsViews,
    longformShare: longformViews / totalViews,
    shortsShare: shortsViews / totalViews,
    longformCount,
    shortsCount,
    coverage,
    windowDays,
  };
}

/** The three windows the brief asks for, plus the full inventory. */
export type FormatSplitSet = {
  d7: FormatSplit;
  d30: FormatSplit;
  d90: FormatSplit;
  all: FormatSplit;
};

export function computeFormatSplitSet(
  uploads: RecentUpload[],
  opts: { channelVideoCount?: number | null; channelLifetimeViews?: number | null; now?: number } = {},
): FormatSplitSet {
  return {
    d7: computeFormatSplit(uploads, { ...opts, windowDays: 7 }),
    d30: computeFormatSplit(uploads, { ...opts, windowDays: 30 }),
    d90: computeFormatSplit(uploads, { ...opts, windowDays: 90 }),
    all: computeFormatSplit(uploads, { ...opts, windowDays: null }),
  };
}

/**
 * One line a human can read without being misled. Every surface that
 * shows a split should show this next to it.
 */
export function coverageLabel(c: SplitCoverage): string {
  if (c.channelVideoCount == null && c.channelLifetimeViews == null) {
    return `Based on ${c.videosCounted} videos we hold`;
  }
  const bits: string[] = [];
  if (c.channelVideoCount != null) {
    bits.push(`${c.videosCounted} of ${c.channelVideoCount.toLocaleString()} videos`);
  } else {
    bits.push(`${c.videosCounted} videos`);
  }
  if (c.viewsCovered != null) {
    bits.push(`${Math.round(c.viewsCovered * 100)}% of lifetime views`);
  }
  return `Based on ${bits.join(' · ')}`;
}

/**
 * Whether a split may be described as a channel-level figure.
 * `sample` coverage never may — it describes the videos counted.
 */
export const isChannelRepresentative = (c: SplitCoverage): boolean =>
  c.confidence === 'complete' || c.confidence === 'partial';
