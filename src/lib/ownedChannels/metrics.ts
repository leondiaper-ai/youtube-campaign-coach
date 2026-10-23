import type { OwnedChannel } from './channels';

export type OwnedVideo = {
  id: string; title: string; publishedAt: string;
  durationSec: number | null; views: number | null;
  live: string;
};
export type OwnedSnapshot = {
  channelId: string; title: string; thumbnail: string | null;
  collectedAt: string; subs: number | null; views: number | null;
  items: OwnedVideo[]; reachedEnd: boolean; reachedWindow: boolean;
};
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
  const covers30d = !!current && (current.reachedEnd || current.reachedWindow || (oldest != null && oldest <= at - 30 * DAY));
  // New channels: compare early track responses within their own 7–30d cohort.
  const tracks = recent.filter(v => isTrack(v) && v.views != null &&
    Date.parse(v.publishedAt) <= at - 7 * DAY);
  const formats = FORMAT_LABELS.map(label => {
    const videos = recent.filter(v => videoFormat(v) === label);
    return { label, count: videos.length, views: videos.reduce((s, v) => s + (v.views ?? 0), 0) };
  });
  const validViews = items.filter(v => v.views != null).sort((a, b) => b.views! - a.views!);
  const firstUpload = current?.reachedEnd && !current.reachedWindow && oldest != null ? new Date(oldest).toISOString() : null;
  return {
    ...def, current, stale, recent, formats, covers30d,
    medianTrack: median(tracks.map(v => v.views!)), trackSample: tracks.length, firstUpload,
    typicalCoverage: covers30d,
    views7d: baseline?.views != null && current?.views != null ? current.views - baseline.views : null,
    subs7d: baseline?.subs != null && current?.subs != null ? current.subs - baseline.subs : null,
    topVideos: validViews.slice(0, 5),
  };
}
export type OwnedRow = ReturnType<typeof summariseChannel>;
