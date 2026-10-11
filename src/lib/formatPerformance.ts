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
/* From lib/, NOT from LaunchModule. That component is 'use client', and
   importing this function from it returned a client reference that threw
   on the server — every artist page 500'd. See launchContentType.ts. */
import { classifyLaunchType, type LaunchContentType } from './launchContentType';

/** The long-form formats worth comparing. Ranked in this order on ties. */
const RANKED_TYPES: LaunchContentType[] = [
  'OFFICIAL_VIDEO', 'LYRIC_VIDEO', 'VISUALIZER', 'LIVE', 'BTS',
];

/**
 * The plural, because "Live" + "s" is "Lives" and "BTS" + "s" is "BTSs".
 * The card leads with this noun, so it is the first thing read.
 */
export const FORMAT_PLURAL: Record<string, string> = {
  OFFICIAL_VIDEO: 'Official videos',
  LYRIC_VIDEO: 'Lyric videos',
  VISUALIZER: 'Visualisers',
  LIVE: 'Live videos',
  BTS: 'BTS',
};

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
  /**
   * This format's median as a share of the artist's OWN official video
   * median. Null when the channel has no official-video baseline.
   *
   * The ratio, not the raw number, is what travels: it is independent of
   * how big the artist is, so one channel's 0.4 means the same as
   * another's, and it can be read against the roster benchmark below.
   */
  vsHero: number | null;
}

/**
 * WHAT A SUPPORT ASSET TYPICALLY DOES, ACROSS THE ROSTER.
 *
 * Measured 11 Oct 2026 over the first 90 artists with a cached upload
 * history, 12-month window. For each artist, each support format's median
 * views was divided by THAT ARTIST's official-video median — so a stadium
 * act and a developing artist contribute equally — and the medians of
 * those ratios are below.
 *
 *   Visualiser   0.40x   (11 artists)
 *   Live         0.21x   (12 artists)
 *   Lyric video  0.20x   (17 artists)
 *   BTS          0.06x   (4 artists)
 *
 * Read as: a visualiser typically does about 40% of what the official
 * video does on the same channel, a lyric video about a fifth, BTS a
 * twentieth. That is the point of the number — it is a target for an
 * asset that is NOT the music video, which is otherwise guesswork.
 *
 * ── THIS IS A SNAPSHOT, NOT A CONSTANT ────────────────────────────────
 * It is baked rather than computed per request because computing it means
 * reading every channel in the roster, and an artist page cannot pay that.
 * The sample sizes are small, BTS especially at four artists, and the
 * spread is wide — visualisers run from 0.14 at the lower quartile to
 * 2.03 at the upper. Treat it as an order of magnitude, not a precise
 * expectation, and recompute it when the roster has moved.
 */
export const ROSTER_SUPPORT_BENCHMARK: Record<string, { ratio: number; artists: number }> = {
  VISUALIZER: { ratio: 0.40, artists: 11 },
  LIVE: { ratio: 0.21, artists: 12 },
  LYRIC_VIDEO: { ratio: 0.20, artists: 17 },
  BTS: { ratio: 0.06, artists: 4 },
};

/** The hero asset. It wins almost every time, so it is a YARDSTICK here. */
const HERO_TYPE: LaunchContentType = 'OFFICIAL_VIDEO';

/**
 * A format this CHANNEL invented, which our vocabulary does not name.
 *
 * Peter Gabriel is the case. He is one of the most active channels on the
 * roster — 45 long-form uploads in a year — and the support ranking was
 * blank, which read as "we cannot tell". The truth was better: in twelve
 * months he published ZERO lyric videos, ZERO visualisers, ZERO BTS and
 * zero official videos. There was nothing of those kinds to compare.
 *
 * What he does publish is the same song twice, as a Bright-Side Mix and a
 * Dark-Side Mix — ten of each. That is a format strategy, it is repeated,
 * and it has an answer: the Bright-Side mixes do roughly twice what the
 * Dark-Side ones do. The vocabulary was the limitation, not the channel.
 *
 * So when none of the known formats are present, the channel's own
 * parenthetical tags are read instead and compared the same way.
 */
export interface VariantRow {
  /** The tag exactly as the channel writes it, e.g. "Bright-Side Mix". */
  label: string;
  median: number;
  count: number;
}

export interface FormatPerformance {
  /** Every readable format including the official video, ranked. */
  rows: FormatRow[];
  /** The official video, pulled out as the yardstick. */
  hero: FormatRow | null;
  /** Everything that is not the official video, ranked. */
  support: FormatRow[];
  /** The support format to aim for on this channel. */
  bestSupport: FormatRow | null;
  /** Best format overall, only when it is meaningfully ahead. See `clear`. */
  best: FormatRow | null;
  /**
   * Whether the lead is big enough to call. A 5% gap between two medians
   * of four videos each is noise, and a card that declares a winner on
   * it is worse than one that says the formats look similar.
   */
  clear: boolean;
  shorts: { median: number; count: number } | null;
  /**
   * The channel's own repeated variant tags, ranked. Only populated when
   * NO known support format is present — otherwise two vocabularies would
   * compete to describe the same catalogue.
   */
  variants: VariantRow[];
  windowDays: number;
}

/**
 * Minimum uploads before a format's median is shown.
 *
 * Was 3, which kept the section off most pages. Nickelback is the case:
 * two visualisers and two BTS clips, both just under the bar, so a
 * channel that plainly HAS a support strategy showed nothing at all. And
 * the binding constraint is not the 12-month window, it is the cache —
 * only 50 uploads are held per channel, four months for a channel that
 * posts often.
 *
 * At 2 a "median" is the mean of two, which is fragile, so the count
 * travels with every row and a two-upload row is marked provisional. A
 * thin number the reader can see is thin beats no number at all, when
 * the question is "what should we make next".
 */
const MIN_PER_FORMAT = 2;

/** At or below this, say so: the figure is indicative, not settled. */
export const PROVISIONAL_AT = 2;

/** The lead has to beat the runner-up by this much to be called. */
const CLEAR_MARGIN = 1.25;

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * Words that mean "this is a known format", so a parenthetical carrying
 * one is not a channel-invented variant — it is already in the ranking.
 */
const KNOWN_TAG = /official|music video|lyric|visuali[sz]er|live|audio|behind the scenes|bts|trailer|teaser|short/i;

/** Pull the channel's own tag out of "Song (Bright-Side Mix)". */
function variantTag(title: string): string | null {
  const m = /[([]\s*([^)\]]{2,40})\s*[)\]]\s*$/.exec((title ?? '').trim());
  if (!m) return null;
  const tag = m[1].trim();
  if (KNOWN_TAG.test(tag)) return null;
  /* A year, a number or a date in brackets is metadata, not a format. */
  if (/^\d[\d\s/.-]*$/.test(tag)) return null;
  return tag;
}

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

  const built = RANKED_TYPES
    .map((type) => {
      const g = groups.get(type);
      if (!g || g.views.length < MIN_PER_FORMAT) return null;
      return {
        type,
        label: FORMAT_LABEL[type] ?? type,
        median: median(g.views),
        count: g.views.length,
        medianAgeDays: median(g.ages),
        vsHero: null as number | null,
      };
    })
    .filter((r): r is FormatRow => r !== null)
    .sort((a, b) => b.median - a.median);

  /* The official video is the yardstick, not a competitor. It wins almost
     every time — of 70 artists sampled, it took 19 of the 23 clear calls —
     so ranking support formats against it answers a question nobody is
     asking. What a team wants to know is which asset to make NEXT, after
     the video, and how close it should get. */
  const hero = built.find((r) => r.type === HERO_TYPE) ?? null;
  const rows: FormatRow[] = built.map((r) => ({
    ...r,
    vsHero: hero && hero.median > 0 && r.type !== HERO_TYPE ? r.median / hero.median : null,
  }));
  const support = rows.filter((r) => r.type !== HERO_TYPE);

  const bestSupport = support[0] ?? null;
  const best = rows[0] ?? null;
  const runnerUp = support[1] ?? null;
  /* "Clear" is now about the SUPPORT ranking, because that is the one the
     card leads on. One support format with nothing beside it is not a
     comparison — it is the only thing we could measure. */
  const clear = !!bestSupport && !!runnerUp && bestSupport.median >= runnerUp.median * CLEAR_MARGIN;

  /* ── THE CHANNEL'S OWN FORMATS ────────────────────────────────────
     Only when nothing known was found. A channel that publishes lyric
     videos AND calls something a "(Radio Edit)" should be read through
     the shared vocabulary, not have two competing ones on the same card. */
  let variants: VariantRow[] = [];
  if (support.length === 0) {
    const byTag = new Map<string, { label: string; views: number[] }>();
    for (const u of uploads) {
      const ts = new Date(u.publishedAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      if (!(u.viewCount > 0)) continue;
      if (u.durationSec > 0 && u.durationSec <= 62) continue;
      const tag = variantTag(u.title);
      if (!tag) continue;
      const key = tag.toLowerCase();
      const g = byTag.get(key) ?? { label: tag, views: [] };
      g.views.push(u.viewCount);
      byTag.set(key, g);
    }
    const built = Array.from(byTag.values())
      .filter((g) => g.views.length >= MIN_PER_FORMAT)
      .map((g) => ({ label: g.label, median: median(g.views), count: g.views.length }))
      .sort((a, b) => b.median - a.median);
    /* One variant is not a comparison — it is just what they call things. */
    variants = built.length >= 2 ? built : [];
  }

  return {
    rows,
    hero,
    support,
    bestSupport,
    variants,
    best,
    clear,
    shorts: shortViews.length >= MIN_PER_FORMAT
      ? { median: median(shortViews), count: shortViews.length }
      : null,
    windowDays,
  };
}
