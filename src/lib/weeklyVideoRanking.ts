import type { TopVideo } from '@/components/ChannelHealthBoard';
import { readVideoSeriesMany } from '@/lib/videoSnapshots';

/** Only rank measured weekly changes. Never substitute lifetime averages. */
export async function rankWeeklyVideoGains(candidates: TopVideo[]): Promise<TopVideo[]> {
  const series = await readVideoSeriesMany(Array.from(new Set(candidates.map(v => v.videoId))));
  const now = Date.now();
  const day = 86_400_000;
  const ranked: TopVideo[] = [];
  const previous: TopVideo[] = [];
  const seen = new Set<string>();
  for (const video of candidates) {
    if (seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    const observations = series.get(video.videoId)?.observations ?? [];
    const readings = observations
      .map(o => ({ ...o, time: Date.parse(o.ts + 'T12:00:00Z') }))
      .filter(o => Number.isFinite(o.time))
      .sort((a, b) => a.time - b.time);
    const latest = readings[readings.length - 1];
    if (!latest || now - latest.time > 2.5 * day) continue;
    const baseline = readings
      .filter(o => latest.time - o.time >= 6 * day && latest.time - o.time <= 8 * day)
      .sort((a, b) => Math.abs(latest.time - a.time - 7 * day) - Math.abs(latest.time - b.time - 7 * day))[0];
    if (!baseline) continue;
    const prior = readings
      .filter(o => baseline.time - o.time >= 6 * day && baseline.time - o.time <= 8 * day)
      .sort((a, b) => Math.abs(baseline.time - a.time - 7 * day) - Math.abs(baseline.time - b.time - 7 * day))[0];
    if (prior && baseline.views - prior.views >= 100) {
      previous.push({ ...video, velocity: baseline.views - prior.views });
    }
    const gain = latest.views - baseline.views;
    if (!Number.isFinite(gain) || gain < 100) continue;
    ranked.push({ ...video, velocity: gain, newEntry: Date.parse(video.publishedAt) > latest.time - 7 * day });
  }
  const order = (a: TopVideo, b: TopVideo) => b.velocity - a.velocity || a.videoId.localeCompare(b.videoId);
  const ranks = new Map<string, number>();
  for (const isShort of [false, true]) {
    previous.filter(v => v.isShort === isShort).sort(order).forEach((v, i) => ranks.set(v.videoId, i + 1));
  }
  return ranked.sort(order).map(v => ({ ...v, previousRank: ranks.get(v.videoId) }));
}
