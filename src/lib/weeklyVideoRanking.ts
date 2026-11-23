import type { TopVideo } from '@/components/ChannelHealthBoard';
import { readVideoSeriesMany } from '@/lib/videoSnapshots';

/** Only rank measured weekly changes. Never substitute lifetime averages. */
export async function rankWeeklyVideoGains(candidates: TopVideo[]): Promise<TopVideo[]> {
  const series = await readVideoSeriesMany(Array.from(new Set(candidates.map(v => v.videoId))));
  const now = Date.now();
  const day = 86_400_000;
  const ranked: TopVideo[] = [];
  for (const video of candidates) {
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
    const gain = latest.views - baseline.views;
    if (!Number.isFinite(gain) || gain < 100) continue;
    ranked.push({ ...video, velocity: gain });
  }
  return ranked.sort((a, b) => b.velocity - a.velocity);
}
