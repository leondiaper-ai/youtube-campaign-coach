import type { OwnedChannel } from './channels';

export type OwnedVideo = {
  id: string; title: string; publishedAt: string;
  durationSec: number | null; views: number | null;
  live: string;
  likes?: number | null;
  comments?: number | null;
};
export type OwnedSnapshot = {
  channelId: string; title: string; thumbnail: string | null;
  collectedAt: string; subs: number | null; views: number | null;
  /* NOT the library. A bounded working set: the newest uploads, which
     answer cadence and format, plus the best, which are what actually
     carry these channels. Library-wide questions go to `library`. */
  items: OwnedVideo[]; reachedEnd: boolean; reachedWindow: boolean;
  /* Older readings keep only this instead of their full upload list: a
     month of libraries at full fidelity runs to megabytes in one Redis
     value. Per-upload gains need a previous view count and nothing else,
     so that is all a superseded reading carries. */
  viewsById?: Record<string, number>;
  /** Computed over every upload walked, then the sweep is discarded. */
  library?: LibraryStats;
  /** Publication date → count, over the whole sweep. Cadence on a 6,500
   *  upload channel cannot come from a stored subset: two hundred of
   *  those is four days, not thirty. A few hundred integers answers it. */
  publishedPerDay?: Record<string, number>;
};

/** Most uploads one sweep walks before stopping. A sweep reads the lot to
 *  work out what the library holds, then stores only a summary of it. */
export const UPLOAD_SWEEP_CAP = 10000;
/** Uploads kept verbatim: the newest for cadence and format, the best
 *  because those are the ones bringing the views. The rest is summarised. */
export const KEEP_NEWEST = 300;
export const KEEP_TOP = 100;

export type LibraryStats = {
  /** YouTube's own count for the channel. A fact, never a floor. */
  videoCount: number | null;
  /** Uploads actually walked in this sweep. */
  swept: number;
  /** The sweep reached the end of the uploads list. */
  complete: boolean;
  withViews: number;
  totalViews: number | null;
  medianViews: number | null;
  /** Uploads needed, best first, to reach half the swept views. */
  halfShareCount: number | null;
  /** Share of swept views held by the single best upload. */
  topShare: number | null;
  /** Uploads under ten views — the dormant tail. */
  underTen: number;
  oldestPublishedAt: string | null;
  newestPublishedAt: string | null;
};

/* Summarises a whole sweep. Kept here rather than in the collector so the
   same shape can be rebuilt from an older reading that predates sweeps. */
export function buildLibraryStats(items: OwnedVideo[], complete: boolean, videoCount: number | null): LibraryStats {
  const counted = items.filter(v => v.views != null).map(v => v.views!).sort((a, b) => b - a);
  const totalViews = counted.length ? counted.reduce((sum, v) => sum + v, 0) : null;
  let halfShareCount: number | null = null;
  if (totalViews) {
    let running = 0;
    for (let i = 0; i < counted.length; i++) {
      running += counted[i];
      if (running * 2 >= totalViews) { halfShareCount = i + 1; break; }
    }
  }
  /* reduce, not Math.min(...times): a ten-thousand-element spread is an
     argument list, and large ones overflow the stack. */
  let oldest: number | null = null, newest: number | null = null;
  for (const video of items) {
    const t = Date.parse(video.publishedAt);
    if (!Number.isFinite(t)) continue;
    if (oldest == null || t < oldest) oldest = t;
    if (newest == null || t > newest) newest = t;
  }
  return {
    videoCount, swept: items.length, complete,
    withViews: counted.length, totalViews, medianViews: median(counted),
    halfShareCount, topShare: totalViews ? counted[0] / totalViews : null,
    underTen: counted.filter(v => v < 10).length,
    oldestPublishedAt: oldest == null ? null : new Date(oldest).toISOString(),
    newestPublishedAt: newest == null ? null : new Date(newest).toISOString(),
  };
}
export const FORMAT_LABELS = ['Tracks & videos', 'Short-form', 'Mixes & sets', 'Other'] as const;
export type OwnedFormat = typeof FORMAT_LABELS[number];
const DAY = 86400000;

/** Duration is a proxy, not proof that a video is on YouTube's Shorts surface. */
export function videoFormat(v: OwnedVideo): OwnedFormat {
  if (v.durationSec == null || v.durationSec <= 0) return 'Other';
  if (v.durationSec <= 180) return 'Short-form';
  if (/\b(mix|dj set|full set|radio|compilation)\b/i.test(v.title) || v.durationSec >= 1200) return 'Mixes & sets';
  if (/\b(interview|podcast|behind the scenes)\b/i.test(v.title) || v.live === 'live') return 'Other';
  return 'Tracks & videos';
}

/** Track medians intentionally include short songs: duration alone cannot identify Shorts. */
export function isTrack(v: OwnedVideo) {
  return v.durationSec != null && v.durationSec > 60 && v.durationSec < 600 &&
    v.live === 'none' && !/\b(mix|set|session|compilation|interview|podcast|shorts?)\b/i.test(v.title);
}

/** Uploads published in [from, to], from the sweep's per-day tallies. */
export function countPublishedSince(perDay: Record<string, number>, from: number, to: number) {
  let total = 0;
  for (const [day, n] of Object.entries(perDay)) {
    const t = Date.parse(`${day}T00:00:00Z`);
    if (Number.isFinite(t) && t >= from - DAY && t <= to) total += n;
  }
  return total;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const xs = [...values].sort((a, b) => a - b), mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function summariseChannel(def: OwnedChannel, history: OwnedSnapshot[], now = Date.now()) {
  const samples = [...history].filter(s => s.channelId === def.id && Number.isFinite(Date.parse(s.collectedAt)))
    .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  const current = samples.at(-1) ?? null;
  const at = current ? Date.parse(current.collectedAt) : now;
  const stale = current ? now - at > 2 * DAY : false;
  const target = at - 7 * DAY;
  // Never turn a two-day observation into a "7-day" gain. Tolerance is 12 hours.
  const baseline = current && !stale ? samples.filter(s =>
    Math.abs(Date.parse(s.collectedAt) - target) <= DAY / 2,
  ).sort((a, b) => Math.abs(Date.parse(a.collectedAt) - target) - Math.abs(Date.parse(b.collectedAt) - target))[0] ?? null : null;
  const items = current?.items.filter(v => {
    const t = Date.parse(v.publishedAt);
    return Number.isFinite(t) && t <= at && v.live !== 'upcoming';
  }) ?? [];
  const recent = items.filter(v => Date.parse(v.publishedAt) >= at - 30 * DAY);
  const oldest = items.length ? Math.min(...items.map(v => Date.parse(v.publishedAt))) : null;
  /* Count uploads from the sweep's day tallies, not from `items`. On a
     channel publishing fifty a day the stored newest few hundred cover
     under a week, so counting them would report a third of the real
     thirty-day output as if it were all of it. */
  const uploads30d = current?.publishedPerDay
    ? countPublishedSince(current.publishedPerDay, at - 30 * DAY, at)
    : recent.length;
  const covers30d = !!current && (!!current.publishedPerDay || current.reachedEnd || current.reachedWindow || (oldest != null && oldest <= at - 30 * DAY));
  // New channels: compare early track responses within their own 7–30d cohort.
  const tracks = recent.filter(v => isTrack(v) && v.views != null &&
    Date.parse(v.publishedAt) <= at - 7 * DAY);
  const formats = FORMAT_LABELS.map(label => {
    const videos = recent.filter(v => videoFormat(v) === label);
    return { label, count: videos.length, views: videos.reduce((s, v) => s + (v.views ?? 0), 0) };
  });
  const validViews = items.filter(v => v.views != null).sort((a, b) => b.views! - a.views!);
  /* The first upload is the oldest the SWEEP saw. `items` is a bounded
     working set, so its oldest member is an artefact of what was kept. */
  const sweptOldest = current?.library?.oldestPublishedAt ?? null;
  const firstUpload = current?.reachedEnd && !current.reachedWindow
    ? sweptOldest ?? (oldest != null ? new Date(oldest).toISOString() : null)
    : null;
  return {
    ...def, current, stale, recent, uploads30d, formats, covers30d,
    medianTrack: median(tracks.map(v => v.views!)), trackSample: tracks.length, firstUpload,
    typicalCoverage: covers30d,
    views7d: baseline?.views != null && current?.views != null ? current.views - baseline.views : null,
    subs7d: baseline?.subs != null && current?.subs != null ? current.subs - baseline.subs : null,
    topVideos: validViews.slice(0, 5),
  };
}
export type OwnedRow = ReturnType<typeof summariseChannel>;
