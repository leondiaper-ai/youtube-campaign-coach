/**
 * PER-VIDEO SNAPSHOTS — the thing we should have been keeping all along
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 * "854K views" tells a label almost nothing. Is that good? For this artist,
 * at this stage, compared with what? The useful sentence is comparative and
 * artist-relative —
 *
 *     1.4× the previous hero's pace at day 7
 *
 * — because it works identically for a 50,000-subscriber artist and for a
 * channel with 2.46 billion lifetime views, without pretending they are
 * playing the same game.
 *
 * Producing that sentence honestly requires knowing what the PREVIOUS hero
 * had done at the same age. Not its lifetime total. Its total at day 7.
 * That number cannot be recovered later: the YouTube API returns a lifetime
 * counter and nothing else, so a view count at day 7 is only knowable if
 * somebody wrote it down on day 7.
 *
 * Watcher has channel-level daily history going back 180 days and has never
 * kept a per-video series. Every refresh fetched viewCount and likeCount for
 * recent uploads and then overwrote them. So the measurement was being
 * taken and thrown away, which is the most annoying kind of missing data.
 *
 * ── WHAT THIS DOES, AND DELIBERATELY DOES NOT DO ──────────────────────
 * Appends one observation per video per day from data the channel refresh
 * has already paid for. No extra API quota: `RecentUpload` carries the view
 * and like counts, and this writes them down instead of discarding them.
 *
 * It does NOT and must never reconstruct history. There is an obvious,
 * tempting, wrong move available here — take a video's lifetime total,
 * assume a decay curve, and derive what it "would have had" at day 7. That
 * produces a confident number with no observation underneath it, and it
 * would be indistinguishable on the page from a real one. A campaign page
 * that says "1.4× previous hero pace" has to mean somebody counted.
 *
 * So the honest position for every video published before this file existed
 * is: no history, no comparison, show nothing. That resolves itself with
 * time, and every campaign from here makes the next one more useful.
 */

import { Redis } from '@upstash/redis';

/** One observation of one video at one moment. Nothing derived. */
export interface VideoObservation {
  /** ISO date, one per day. A second reading the same day replaces it. */
  ts: string;
  views: number;
  likes: number | null;
  comments: number | null;
}

export interface VideoSeries {
  videoId: string;
  /** From the API, so age can be computed without a second lookup. */
  publishedAt: string | null;
  observations: VideoObservation[];
}

/** Six months. Long enough for a 30-day curve plus the next campaign. */
const MAX_OBSERVATIONS = 180;

const K = (videoId: string) => `vsnap:${videoId}`;

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { return new Redis({ url, token }); } catch { return null; }
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record today's reading for a set of videos.
 *
 * Idempotent by day: called five times on a Tuesday it keeps the last
 * reading, not five rows. Failures are swallowed — this is a side effect of
 * a refresh whose job is something else, and a snapshot write must never be
 * able to fail the read that triggered it.
 */
export async function recordVideoObservations(
  videos: { id: string; publishedAt?: string | null; viewCount?: number | null;
            likeCount?: number | null; commentCount?: number | null }[],
): Promise<{ recorded: number }> {
  const store = await kv();
  if (!store) return { recorded: 0 };

  const ts = today();
  let recorded = 0;

  for (const v of videos) {
    if (!v?.id || typeof v.viewCount !== 'number') continue;
    try {
      const existing = (await store.get<VideoSeries>(K(v.id))) ?? {
        videoId: v.id, publishedAt: v.publishedAt ?? null, observations: [],
      };
      /* publishedAt can arrive late; fill it in but never overwrite. */
      if (!existing.publishedAt && v.publishedAt) existing.publishedAt = v.publishedAt;

      const obs: VideoObservation = {
        ts,
        views: v.viewCount,
        likes: typeof v.likeCount === 'number' ? v.likeCount : null,
        comments: typeof v.commentCount === 'number' ? v.commentCount : null,
      };
      const rest = existing.observations.filter(o => o.ts !== ts);
      existing.observations = [...rest, obs]
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .slice(-MAX_OBSERVATIONS);

      await store.set(K(v.id), existing);
      recorded++;
    } catch { /* a lost observation is not worth a failed request */ }
  }
  return { recorded };
}

export async function readVideoSeries(videoId: string): Promise<VideoSeries | null> {
  const store = await kv();
  if (!store) return null;
  try { return (await store.get<VideoSeries>(K(videoId))) ?? null; } catch { return null; }
}

/**
 * What this video had done at N days old, if anybody was watching then.
 *
 * `tolerance` exists because observations are daily and a campaign does not
 * start at midnight: asking for day 7 and accepting a day-6 or day-8 reading
 * is a defensible approximation, and the caller is told which day it
 * actually got so it can decide whether to say so.
 *
 * Returns null rather than an estimate. Every caller of this function is
 * about to put a number in front of a label.
 */
export function viewsAtAge(
  series: VideoSeries | null,
  ageDays: number,
  tolerance = 1,
): { views: number; actualAgeDays: number; exact: boolean } | null {
  if (!series?.publishedAt || !series.observations.length) return null;
  const born = new Date(series.publishedAt).getTime();
  if (!Number.isFinite(born)) return null;

  let best: { views: number; actualAgeDays: number; exact: boolean } | null = null;
  for (const o of series.observations) {
    const at = new Date(o.ts + 'T12:00:00Z').getTime();
    const age = Math.round((at - born) / 86_400_000);
    if (age < 0) continue;
    const drift = Math.abs(age - ageDays);
    if (drift > tolerance) continue;
    if (!best || drift < Math.abs(best.actualAgeDays - ageDays)) {
      best = { views: o.views, actualAgeDays: age, exact: age === ageDays };
    }
  }
  return best;
}

/** How much of a curve we hold, for reporting coverage honestly. */
export async function seriesCoverage(videoId: string): Promise<{
  has: boolean; observations: number; firstAgeDays: number | null; lastAgeDays: number | null;
}> {
  const s = await readVideoSeries(videoId);
  if (!s?.observations.length || !s.publishedAt) {
    return { has: false, observations: 0, firstAgeDays: null, lastAgeDays: null };
  }
  const born = new Date(s.publishedAt).getTime();
  const age = (ts: string) => Math.round((new Date(ts + 'T12:00:00Z').getTime() - born) / 86_400_000);
  return {
    has: true,
    observations: s.observations.length,
    firstAgeDays: age(s.observations[0].ts),
    lastAgeDays: age(s.observations[s.observations.length - 1].ts),
  };
}
