/* ═══════════════════════════════════════════════════════════════════
   DAILY FORMAT-SPLIT HISTORY

   Public view counts are CUMULATIVE per video. Daily viewing is
   therefore a difference between two readings — and the trap is that a
   video entering our inventory for the first time arrives carrying its
   entire lifetime. A video published two years ago that scrolls into
   our 100-upload window today would book two years of views as
   "today", producing a spike that never happened.

   So the delta is computed ONLY over videos seen in BOTH readings.
   A first sighting contributes nothing to that day's delta; it is
   recorded and counts from the next reading onward. The same rule
   protects against the reverse case: a video ageing OUT of the window
   simply stops contributing rather than booking a negative day.

   WHAT IS STORED, AND WHY IT IS CHEAP

     fmt:last:{channelId}   one map of videoId → {views, isShort},
                            OVERWRITTEN each run. This is the baseline
                            the next delta is measured against.

     fmt:day:{channelId}    a rolling array of small daily rows. Each
                            row holds the day's DELTAS plus the
                            inventory totals at that moment.

   Storing a per-video map per day would be correct and also ~75MB
   across the roster over 90 days. One overwritten baseline plus a
   compact daily row is the same arithmetic at ~1% of the storage.

   A day with no prior baseline is recorded with `comparable: false`
   and is never summed into a trend. Trends are shown only when enough
   comparable days exist — a 30-day figure built from four days of
   data is worse than no figure, because it looks like a measurement.
   ═══════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';
import { classifyUploadFormat } from './formatClassifier';

const LAST_KEY = (channelId: string) => `fmt:last:${channelId}`;
const DAY_KEY = (channelId: string) => `fmt:day:${channelId}`;

/** Keep a little over 90 days so a 90-day window is always coverable. */
const MAX_DAYS = 100;

type LastSeen = {
  ts: string;
  videos: Record<string, { v: number; s: 0 | 1 }>;
};

export type FormatDay = {
  /** yyyy-mm-dd */
  ts: string;
  /** Views ADDED since the previous reading, matched videos only. */
  shortsDelta: number;
  longformDelta: number;
  /** Inventory totals at this reading — a level, not a delta. */
  shortsTotal: number;
  longformTotal: number;
  /** Videos counted in the delta (present in both readings). */
  matched: number;
  /** First-sighting videos, excluded from the delta by design. */
  firstSeen: number;
  /** False on the first ever reading — never summed into a trend. */
  comparable: boolean;
};

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Record one reading — AT MOST ONE PER CALENDAR DAY per channel.
 *
 * The once-a-day rule is not a convenience, it is what makes a row mean
 * a day. Our cron is not one nightly job: it is eight runs between 05:00
 * and 07:30 UTC, chunked so 245 artists fit inside the function timeout.
 * An earlier version of this function rewrote the current day's row on
 * every run, so after the last run a "daily" row held the delta since the
 * run 30 minutes before it — and a 7-day trend summed seven half-hours
 * while calling itself a week. The numbers would have looked plausible
 * and been wrong by a factor of about fifty.
 *
 * So the first run of a day that touches a channel records it and moves
 * the baseline; later runs that day return the existing row untouched.
 * Each stored row is then a delta against the previous DAY's reading,
 * which is what a daily figure has to be.
 *
 * A consequence worth knowing: the day boundary is the moment of the
 * first run that sees a channel, not midnight. The window is ~24h either
 * way, so a sum over several days is sound; a single day is "the 24 hours
 * ending at that reading".
 */
export async function recordFormatReading(
  channelId: string,
  uploads: RecentUpload[],
): Promise<FormatDay | null> {
  const store = await kv();
  if (!store || !channelId || uploads.length === 0) return null;

  const ts = todayKey();

  const existingDays =
    ((await store.get(DAY_KEY(channelId))) as FormatDay[] | null) ?? [];
  const alreadyToday = existingDays.find((d) => d.ts === ts);
  if (alreadyToday) return alreadyToday;
  const current: LastSeen['videos'] = {};
  let shortsTotal = 0, longformTotal = 0;

  for (const u of uploads) {
    const views = Number.isFinite(u.viewCount) ? u.viewCount : 0;
    const isShort = classifyUploadFormat(u) === 'short';
    current[u.id] = { v: views, s: isShort ? 1 : 0 };
    if (isShort) shortsTotal += views;
    else longformTotal += views;
  }

  const prev = (await store.get(LAST_KEY(channelId))) as LastSeen | null;

  let shortsDelta = 0, longformDelta = 0, matched = 0, firstSeen = 0;

  if (prev?.videos) {
    for (const [id, now] of Object.entries(current)) {
      const before = prev.videos[id];
      if (!before) {
        /* First sighting. Its views accumulated before we were
           watching, so none of them belong to today. */
        firstSeen++;
        continue;
      }
      matched++;
      const d = now.v - before.v;
      /* A negative delta means YouTube revised the count down (it does
         this when filtering invalid views). Clamp to zero rather than
         booking negative viewing. */
      if (d <= 0) continue;
      if (now.s === 1) shortsDelta += d;
      else longformDelta += d;
    }
  } else {
    firstSeen = Object.keys(current).length;
  }

  const row: FormatDay = {
    ts,
    shortsDelta,
    longformDelta,
    shortsTotal,
    longformTotal,
    matched,
    firstSeen,
    comparable: !!prev?.videos,
  };

  const next = [...existingDays.filter((d) => d.ts !== ts), row]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(-MAX_DAYS);

  await store.set(DAY_KEY(channelId), next);
  await store.set(LAST_KEY(channelId), { ts, videos: current } satisfies LastSeen);

  return row;
}

export async function readFormatDays(channelId: string): Promise<FormatDay[]> {
  const store = await kv();
  if (!store || !channelId) return [];
  return ((await store.get(DAY_KEY(channelId))) as FormatDay[] | null) ?? [];
}

/**
 * Daily history for many channels in one round trip.
 *
 * The dashboard needs this for every row. Looping readFormatDays over a
 * 245-artist roster is 245 sequential Redis calls on a page that already
 * reads a snapshot and a history per artist, which is how a board stops
 * rendering inside the function timeout. mget fetches them together.
 *
 * Channels with no stored history come back as an empty array, so a
 * caller can treat "absent" and "empty" identically.
 */
export async function readFormatDaysBatch(
  channelIds: string[],
): Promise<Map<string, FormatDay[]>> {
  const out = new Map<string, FormatDay[]>();
  const ids = Array.from(new Set(channelIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const store = await kv();
  if (!store) {
    for (const id of ids) out.set(id, []);
    return out;
  }

  try {
    const vals = (await store.mget(...ids.map(DAY_KEY))) as (FormatDay[] | null)[];
    ids.forEach((id, i) => out.set(id, vals?.[i] ?? []));
  } catch {
    /* A failed history read must not take the board down with it — the
       lifetime split still renders without any of this. */
    for (const id of ids) out.set(id, []);
  }
  return out;
}

export type FormatTrend = {
  windowDays: number;
  /** Null until enough comparable days exist. */
  shortsViews: number | null;
  longformViews: number | null;
  shortsShare: number | null;
  /** Comparable days actually found inside the window. */
  daysAvailable: number;
  daysRequired: number;
  ready: boolean;
};

/**
 * Trend over a window. Requires at least 80% of the window in
 * comparable days — a 30-day trend built from six days is not a
 * 30-day trend, and presenting it as one is the failure mode this
 * guard exists to prevent.
 */
export function computeTrend(days: FormatDay[], windowDays: number): FormatTrend {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const inWindow = days.filter(
    (d) => d.comparable && new Date(d.ts + 'T00:00:00Z').getTime() >= cutoff,
  );
  const daysRequired = Math.max(2, Math.ceil(windowDays * 0.8));
  const ready = inWindow.length >= daysRequired;

  if (!ready) {
    return {
      windowDays,
      shortsViews: null,
      longformViews: null,
      shortsShare: null,
      daysAvailable: inWindow.length,
      daysRequired,
      ready: false,
    };
  }

  const shortsViews = inWindow.reduce((t, d) => t + d.shortsDelta, 0);
  const longformViews = inWindow.reduce((t, d) => t + d.longformDelta, 0);
  const total = shortsViews + longformViews;

  return {
    windowDays,
    shortsViews,
    longformViews,
    shortsShare: total > 0 ? shortsViews / total : null,
    daysAvailable: inWindow.length,
    daysRequired,
    ready: true,
  };
}

export const computeTrends = (days: FormatDay[]) => ({
  d7: computeTrend(days, 7),
  d30: computeTrend(days, 30),
  d90: computeTrend(days, 90),
});
