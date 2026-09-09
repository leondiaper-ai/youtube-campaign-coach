/**
 * RESEARCHER — CATALOGUE RECONSTRUCTION
 *
 * Turns a channel's full public upload history into the unit of analysis the
 * research questions actually need: RELEASE MOMENTS and what happened around
 * them.
 *
 * This is deterministic. No model touches it. The LLM reasons over the output
 * of this file; it never computes any of it. That separation is what stops
 * the system inventing numbers.
 *
 * ── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────
 * Watcher stores per-CHANNEL daily totals (6 fields, 180 days). It has never
 * stored per-video history — `live:{channelId}` is overwritten on every sync,
 * so yesterday's view count for any given video is gone. That means the
 * follow-up-window and sequencing questions cannot be answered from Watcher's
 * own history at all. They CAN be answered from the public catalogue, because
 * publishedAt is immutable: we can reconstruct exactly what was released, in
 * what order, with what spacing, at any point in the past.
 *
 * ── WHAT WE CAN AND CANNOT CONCLUDE FROM IT ───────────────────────────
 * CAN: sequencing, spacing, gaps, format architecture, cadence, what existed.
 * CANNOT: velocity, or how anything performed in its first N days. Every view
 * count here is a LIFETIME total as at fetch time. An asset from 2019 has had
 * six years to accumulate; one from last month has had a month.
 *
 * Hence `heroVsOwnBaseline`, which compares a hero only against that same
 * artist's other heroes IN THE SAME AGE BUCKET. It is the only performance
 * number in this file that may be compared across artists, and even then it
 * needs a sample-size check — see baselineN.
 */

import type { RecentUpload } from '../artists';
import { classifyUploadFormat } from '../formatClassifier';
import {
  ageBucketOf,
  type AgeBucket,
  type Asset,
  type CatalogueRecon,
  type ReleaseMoment,
} from './types';

/* ── Raw shape returned by /api/full-catalogue ──────────────────────── */

interface RawVideo {
  id: string;
  title: string;
  description?: string;
  publishedAt: string | null;
  durationSec: number;
  isShort: boolean;
  views: number;
  likes?: number;
  comments?: number;
  wasLive?: boolean;
  scheduledStart?: string | null;
  actualStart?: string | null;
}

interface RawCatalogue {
  channel: {
    id: string;
    title: string;
    handle: string;
    subscribers: number;
    lifetimeViews: number;
    publicVideoCount: number;
    publishedAt: string;
  };
  retrieved: number;
  playlistIds: number;
  capped: boolean;
  fetchedAt: string;
  videos: RawVideo[];
  error?: string;
}

/* ── Small statistics helpers ───────────────────────────────────────── */

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Median, not mean, everywhere. View distributions on a music channel are
 * severely right-skewed — one breakout drags a mean far above anything the
 * artist typically does, and a "typical" figure built from a mean would
 * make almost every release look like an underperformance.
 */
export function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

/* ── Fetch ──────────────────────────────────────────────────────────── */

/**
 * `slim` drops description, which formatClassifier uses heavily for
 * long-form sub-classification. So:
 *   - roster-wide scans use slim (payload/quota), and classification is
 *     title-only, which is weaker;
 *   - single-artist deep dives fetch full.
 * The choice is recorded on the recon so a finding's confidence can account
 * for it. Do not silently mix the two in one comparison.
 */
export async function fetchCatalogue(
  baseUrl: string,
  handle: string,
  opts: { slim?: boolean; cap?: number } = {},
): Promise<RawCatalogue> {
  const { slim = false, cap = 20000 } = opts;
  const url = `${baseUrl}/api/full-catalogue?handle=${encodeURIComponent(handle)}&cap=${cap}${slim ? '&slim=1' : ''}`;
  const r = await fetch(url, { cache: 'no-store' });
  const j = (await r.json()) as RawCatalogue;
  if (j.error) throw new Error(`full-catalogue(${handle}): ${j.error}`);
  return j;
}

/* ── Classification ─────────────────────────────────────────────────── */

function toRecentUpload(v: RawVideo): RecentUpload {
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? '',
    publishedAt: v.publishedAt ?? '',
    durationSec: v.durationSec,
    live: 'none',
    scheduledStart: v.scheduledStart ?? null,
    actualStart: v.actualStart ?? null,
    captions: false,
    viewCount: v.views,
    likeCount: v.likes ?? 0,
    commentCount: v.comments ?? 0,
  } as RecentUpload;
}

/**
 * HERO = an official music video.
 *
 * Deliberately narrow, and deliberately NOT defined by performance. An
 * earlier shape of this used "long-form in the channel's top decile", which
 * is circular: it defines a hero by how well it did and then measures how
 * well heroes do. Under that definition the follow-up study would have been
 * guaranteed to find that heroes outperform, which is not a finding.
 *
 * The cost is that artists whose release moments are not OMVs (some rap
 * channels lead on visualisers, some rock acts on live) will show few or no
 * heroes. That shows up as a low `heroes.length` and the caller must say so
 * rather than analysing three moments as though they were thirty.
 */
function isHeroFormat(fmt: string): boolean {
  return fmt === 'omv';
}

/* ── Reconstruction ─────────────────────────────────────────────────── */

export function reconstruct(
  slug: string,
  artistName: string,
  raw: RawCatalogue,
  now = Date.now(),
): CatalogueRecon {
  const assets: Asset[] = raw.videos
    .filter(v => v.publishedAt)
    .map(v => {
      const ru = toRecentUpload(v);
      const fmt = classifyUploadFormat(ru);
      const ageDays = Math.max(0, Math.round((now - new Date(v.publishedAt!).getTime()) / DAY));
      return {
        videoId: v.id,
        title: v.title,
        publishedAt: v.publishedAt!,
        durationSec: v.durationSec,
        isShort: v.isShort || fmt === 'short',
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        format: fmt,
        isHero: !v.isShort && isHeroFormat(fmt),
        ageDays,
        ageBucket: ageBucketOf(ageDays),
      } satisfies Asset;
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const heroes = assets.filter(a => a.isHero);
  const longForm = assets.filter(a => !a.isShort);
  const shorts = assets.filter(a => a.isShort);

  /* Per-artist, per-age-bucket hero baseline. */
  const heroBaselineByAge: CatalogueRecon['heroBaselineByAge'] = {};
  const byBucket = new Map<AgeBucket, number[]>();
  for (const h of heroes) {
    if (!byBucket.has(h.ageBucket)) byBucket.set(h.ageBucket, []);
    byBucket.get(h.ageBucket)!.push(h.views);
  }
  /* Array.from rather than for..of over the Map — the project targets a
     pre-ES2015 lib and iterating a Map directly needs downlevelIteration,
     which is not worth turning on repo-wide for two loops. */
  Array.from(byBucket.entries()).forEach(([bucket, vals]) => {
    heroBaselineByAge[bucket as AgeBucket] = { median: median(vals), n: vals.length };
  });

  /* Release moments. */
  const moments: ReleaseMoment[] = heroes.map((hero, i) => {
    const next = heroes[i + 1] ?? null;
    const from = hero.publishedAt;
    const to = next?.publishedAt ?? null;

    const inGap = (a: Asset) =>
      a.publishedAt > from && (to === null || a.publishedAt < to);

    const longFormInGap = longForm.filter(a => a.videoId !== hero.videoId && inGap(a));
    const shortsInGap = shorts.filter(inGap);

    const firstFollowUp = longFormInGap[0] ?? null;
    const daysToFirstFollowUp = firstFollowUp
      ? daysBetween(hero.publishedAt, firstFollowUp.publishedAt)
      : null;

    /**
     * The 7–14 day question. `null` when the window has not fully elapsed —
     * a hero published four days ago genuinely has no answer yet, and
     * recording that as `false` would quietly bias the whole study toward
     * "no follow-up" among recent releases.
     */
    let followUp7to14: boolean | null = null;
    if (hero.ageDays >= 14) {
      followUp7to14 = longFormInGap.some(a => {
        const d = daysBetween(hero.publishedAt, a.publishedAt);
        return d >= 7 && d <= 14;
      });
    }

    const base = heroBaselineByAge[hero.ageBucket];
    /**
     * Exclude the hero itself from its own baseline when it is the only
     * member of the bucket — otherwise the ratio is 1.0 by construction.
     */
    const heroVsOwnBaseline =
      base && base.n >= 2 && base.median > 0 ? hero.views / base.median : null;

    return {
      artistSlug: slug,
      hero,
      daysToNextHero: next ? daysBetween(hero.publishedAt, next.publishedAt) : null,
      longFormInGap,
      shortsInGap,
      followUp7to14,
      daysToFirstFollowUp,
      heroVsOwnBaseline,
      baselineN: base?.n ?? 0,
    } satisfies ReleaseMoment;
  });

  return {
    artistSlug: slug,
    artistName,
    channelId: raw.channel.id,
    channelTitle: raw.channel.title,
    subscribers: raw.channel.subscribers ?? null,
    totalUploads: assets.length,
    capped: raw.capped,
    firstUploadAt: assets[0]?.publishedAt ?? null,
    lastUploadAt: assets[assets.length - 1]?.publishedAt ?? null,
    heroes,
    moments,
    heroBaselineByAge,
    shortsTotal: shorts.length,
    longFormTotal: longForm.length,
    fetchedAt: raw.fetchedAt,
  };
}

/* ── The follow-up window study (seed question 2) ───────────────────── */

export interface FollowUpStudy {
  n: number;
  withFollowUp: number;
  withoutFollowUp: number;
  /** Median heroVsOwnBaseline for each group. */
  medianRatioWith: number | null;
  medianRatioWithout: number | null;
  /** Artists contributing to each side, for the evidence block. */
  artistsWith: string[];
  artistsWithout: string[];
  excludedTooRecent: number;
  excludedNoBaseline: number;
  caveats: string[];
}

/**
 * Compares heroes that had a long-form follow-up 7–14 days later against
 * those that did not, using each hero's ratio to its OWN artist's same-age
 * baseline.
 *
 * ── READ THIS BEFORE QUOTING THE RESULT ───────────────────────────────
 * This is a CORRELATION on observational data, and the causal arrow is
 * genuinely ambiguous in both directions:
 *
 *   1. Reverse causation. Teams add a follow-up when a release is already
 *      doing well. So "heroes with follow-ups performed better" may simply
 *      be "heroes that were already working got more support".
 *   2. Selection. Bigger campaigns have more budget for both the hero and
 *      the follow-up. The follow-up may be a marker of investment, not a
 *      cause of anything.
 *
 * Nothing in public data can separate these. The honest output is the
 * association plus both caveats, and any finding built on it must be stated
 * as association, never as effect. The `caveats` array is populated with
 * these deliberately so they travel with the numbers into the model context
 * and cannot be dropped on the way.
 */
export function followUpStudy(recons: CatalogueRecon[]): FollowUpStudy {
  const withF: { ratio: number; slug: string }[] = [];
  const withoutF: { ratio: number; slug: string }[] = [];
  let excludedTooRecent = 0;
  let excludedNoBaseline = 0;

  for (const r of recons) {
    for (const m of r.moments) {
      if (m.followUp7to14 === null) { excludedTooRecent++; continue; }
      if (m.heroVsOwnBaseline === null || m.baselineN < 2) { excludedNoBaseline++; continue; }
      const rec = { ratio: m.heroVsOwnBaseline, slug: r.artistSlug };
      (m.followUp7to14 ? withF : withoutF).push(rec);
    }
  }

  const uniq = (xs: string[]) => Array.from(new Set(xs));

  return {
    n: withF.length + withoutF.length,
    withFollowUp: withF.length,
    withoutFollowUp: withoutF.length,
    medianRatioWith: withF.length ? median(withF.map(x => x.ratio)) : null,
    medianRatioWithout: withoutF.length ? median(withoutF.map(x => x.ratio)) : null,
    artistsWith: uniq(withF.map(x => x.slug)),
    artistsWithout: uniq(withoutF.map(x => x.slug)),
    excludedTooRecent,
    excludedNoBaseline,
    caveats: [
      'Association only. Public data cannot establish direction — teams often add a follow-up BECAUSE a release is already performing, which would produce this pattern with no effect from the follow-up itself.',
      'A follow-up may be a marker of campaign investment rather than a cause; larger campaigns fund both the hero and the support.',
      'Performance is each hero versus its own artist\'s median hero in the same age bucket, so it is age- and artist-normalised, but lifetime views still favour assets that have had longer to settle within a bucket.',
      'Heroes are official music videos only. Artists whose release moments are visualisers or live assets are under-represented.',
    ],
  };
}

/* ── The gap study (seed question 1) ────────────────────────────────── */

export interface GapStudy {
  n: number;
  medianGapDays: number | null;
  /** Gaps containing zero long-form assets. */
  emptyGaps: number;
  emptyGapRate: number | null;
  medianLongFormPerGap: number | null;
  medianShortsPerGap: number | null;
  longestGap: { artistSlug: string; days: number; longForm: number; shorts: number } | null;
  caveats: string[];
}

export function gapStudy(recons: CatalogueRecon[]): GapStudy {
  const closed = recons.flatMap(r =>
    r.moments
      .filter(m => m.daysToNextHero !== null)
      .map(m => ({
        slug: r.artistSlug,
        days: m.daysToNextHero!,
        lf: m.longFormInGap.length,
        sh: m.shortsInGap.length,
      })),
  );
  if (!closed.length) {
    return {
      n: 0, medianGapDays: null, emptyGaps: 0, emptyGapRate: null,
      medianLongFormPerGap: null, medianShortsPerGap: null, longestGap: null,
      caveats: ['No closed hero-to-hero gaps in the selected artists.'],
    };
  }
  const empty = closed.filter(c => c.lf === 0).length;
  const longest = closed.reduce((a, b) => (b.days > a.days ? b : a));
  return {
    n: closed.length,
    medianGapDays: median(closed.map(c => c.days)),
    emptyGaps: empty,
    emptyGapRate: empty / closed.length,
    medianLongFormPerGap: median(closed.map(c => c.lf)),
    medianShortsPerGap: median(closed.map(c => c.sh)),
    longestGap: { artistSlug: longest.slug, days: longest.days, longForm: longest.lf, shorts: longest.sh },
    caveats: [
      'Gaps are measured between official music videos only, so an artist who programmes around live or visualiser releases will look emptier than they are.',
      'Counts describe what was published, not how any of it performed.',
    ],
  };
}

/* ── Format architecture (seed questions 3, 7) ──────────────────────── */

export interface FormatProfile {
  artistSlug: string;
  totalAssets: number;
  shortsShare: number;
  byFormat: Record<string, number>;
  /** Distinct long-form formats used — a crude breadth measure. */
  formatBreadth: number;
}

export function formatProfile(r: CatalogueRecon): FormatProfile {
  const all = [...r.heroes, ...r.moments.flatMap(m => [...m.longFormInGap, ...m.shortsInGap])];
  const seen = new Map<string, Asset>();
  for (const a of all) seen.set(a.videoId, a);
  const assets = Array.from(seen.values());
  const byFormat: Record<string, number> = {};
  for (const a of assets) byFormat[a.format] = (byFormat[a.format] ?? 0) + 1;
  const total = assets.length || 1;
  const longFormats = Object.keys(byFormat).filter(f => f !== 'short');
  return {
    artistSlug: r.artistSlug,
    totalAssets: assets.length,
    shortsShare: (byFormat['short'] ?? 0) / total,
    byFormat,
    formatBreadth: longFormats.length,
  };
}
