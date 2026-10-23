import { summariseChannel, median, type OwnedSnapshot, type OwnedVideo } from './metrics';
import type { OwnedChannel } from './channels';

export const DAY = 86400000;
export const LENGTH_LABELS = ['Up to 3 min', '3–20 min', '20 min+', 'Unknown length'] as const;
export function lengthGroup(video: OwnedVideo): number {
  if (video.durationSec == null || video.durationSec <= 0) return 3;
  if (video.durationSec <= 180) return 0;
  return video.durationSec < 1200 ? 1 : 2;
}
export type Reading = { at: string; views: number | null; subs: number | null };
export type VideoGain = { value: number | null; kind: 'measured' | 'new' | 'missing' };

export function analyseOwnedChannel(def: OwnedChannel, history: OwnedSnapshot[], now = Date.now()) {
  const valid = history.filter(s => s.channelId === def.id && Number.isFinite(Date.parse(s.collectedAt)) && Date.parse(s.collectedAt) <= now)
    .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  const row = summariseChannel(def, valid, now);
  const at = row.current ? Date.parse(row.current.collectedAt) : now;
  const target = at - 7 * DAY;
  const baseline = !row.stale ? valid.filter(s => Math.abs(Date.parse(s.collectedAt) - target) <= DAY / 2)
    .sort((a, b) => Math.abs(Date.parse(a.collectedAt) - target) - Math.abs(Date.parse(b.collectedAt) - target))[0] : undefined;
  /* A baseline reading holds either its full uploads (if it is still the
     newest stored) or the compact id→views map it was reduced to. Both
     answer the only question asked of it: what did this upload read last
     time. Treat them as one lookup so a reduced baseline is not mistaken
     for an absent one, which would silently relabel every gain "new". */
  const before = new Map<string, number>(
    baseline?.items.length
      ? baseline.items.flatMap(v => (v.views != null ? [[v.id, v.views] as [string, number]] : []))
      : Object.entries(baseline?.viewsById ?? {}),
  );
  const videoGains: Record<string, VideoGain> = {};
  for (const video of row.current?.items ?? []) {
    const previous = before.get(video.id);
    videoGains[video.id] = !baseline || video.views == null ? { value: null, kind: 'missing' } :
      previous != null ? { value: video.views - previous, kind: 'measured' } :
      Date.parse(video.publishedAt) >= Date.parse(baseline.collectedAt) ? { value: video.views, kind: 'new' } :
      { value: null, kind: 'missing' };
  }
  return {
    row, readings: valid.map(s => ({ at: s.collectedAt, views: s.views, subs: s.subs })),
    videoGains, baselineAt: baseline?.collectedAt ?? null, asOf: new Date(at).toISOString(),
  };
}
export type OwnedAnalysis = ReturnType<typeof analyseOwnedChannel>;

/** Use the real observation span. Never call a 2-day difference a 7- or 30-day gain. */
export function observedMovement(readings: Reading[], metric: 'views' | 'subs', from: number) {
  const points = readings.filter(r => Date.parse(r.at) >= from && r[metric] != null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  if (Date.parse(last.at) <= Date.parse(first.at)) return null;
  return { value: last[metric]! - first[metric]!, from: first.at, to: last.at,
    days: (Date.parse(last.at) - Date.parse(first.at)) / DAY };
}

export function meanDailyViews(video: OwnedVideo, at: number) {
  const days = (at - Date.parse(video.publishedAt)) / DAY;
  return days >= 1 && video.views != null ? video.views / days : null;
}

/* `perDay` is the sweep's own tally and is authoritative when present:
   counting the stored uploads instead would show a channel publishing
   fifty a day as having stopped a week ago, because that is where the
   bounded working set ends. */
export function publishingSeries(items: OwnedVideo[], at: number, days: number, complete: boolean, perDay?: Record<string, number>) {
  const end = new Date(at).toISOString().slice(0, 10);
  const endDay = Date.parse(`${end}T00:00:00Z`);
  const oldest = items.length ? Math.min(...items.map(v => Date.parse(v.publishedAt)).filter(Number.isFinite)) : null;
  return Array.from({ length: days }, (_, i) => {
    const start = endDay - (days - 1 - i) * DAY;
    const day = new Date(start).toISOString().slice(0, 10);
    const count = perDay ? perDay[day] ?? 0 : items.filter(v => v.live !== 'upcoming' && Date.parse(v.publishedAt) >= start &&
      Date.parse(v.publishedAt) < start + DAY && Date.parse(v.publishedAt) <= at).length;
    const covered = !!perDay || complete || (oldest != null && oldest <= start);
    return { day, count: covered ? count : null, minimum: count };
  });
}

export function lengthBreakdown(items: OwnedVideo[]) {
  return LENGTH_LABELS.map((label, group) => {
    const videos = items.filter(v => lengthGroup(v) === group);
    const known = videos.filter(v => v.views != null);
    return { label, count: videos.length, known: known.length,
      views: known.length ? known.reduce((sum, v) => sum + v.views!, 0) : null,
      median: median(known.map(v => v.views!)) };
  });
}
