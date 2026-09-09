/**
 * ASSET-LEVEL EVIDENCE FOR OUR OWN ARTISTS
 *
 * Scout builds a dated asset profile for external channels. Watcher's
 * campaign reads did not have one, which is why they said things like
 * "campaign in steady state" — the read could see campaign STATE and could
 * not see what had actually been published.
 *
 * This applies the same `buildProfile` to a roster artist. Same classifier,
 * same release-window logic, same vocabulary — which is the point: it makes
 * "how does our campaign compare to what strong channels do" answerable
 * later without reconciling two measurement systems.
 *
 * ── WHAT IS GENUINELY NEW HERE ───────────────────────────────────────
 * `compareToPrevious()` — this release against this artist's own last one.
 * That comparison is valid where a cross-artist one would not be: same
 * channel, same audience, same subscriber base, and the only thing that
 * changed is what they did. It is also the question a strategist actually
 * asks, and the one the old reads could not answer at all.
 *
 * ── WHAT IS STILL NOT AVAILABLE ──────────────────────────────────────
 * View comparisons between the current release and a previous one are
 * NOT made. A hero from March has had six months to accumulate views and
 * one from last week has had a week; comparing their lifetime totals
 * measures elapsed time. Only ARCHITECTURE is compared — what was
 * published, in what order, how many days apart. That is unaffected by age.
 */

import { buildProfile } from '../scout/analyse';
import type { ChannelProfile } from '../scout/types';
import type { DiscoveredVideo } from '../youtube/discovery';
import { getHorizon } from '../coach-bot/horizon';
import type { Artist } from '../artists';

/* ── Fetch ───────────────────────────────────────────────────────────── */

/**
 * Strips unpaired surrogates from a string.
 *
 * Precious Pepala's catalogue contains a title with a lone surrogate — half
 * of an emoji or a truncated character somewhere upstream. It survives
 * everything we do to it and then kills the request at the provider:
 * "unexpected end of hex escape". Every read for that artist failed on it.
 *
 * The pairs are what matter, so a lone half carries no information and can
 * be dropped rather than escaped. Applied at the fetch boundary so nothing
 * downstream has to think about it.
 */
function stripLoneSurrogates(s: string): string {
  return (s ?? '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
                  .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

interface RawVideo {
  id: string; title: string; publishedAt: string | null; durationSec: number;
  views: number; likes: number; comments: number;
  wasLive: boolean; scheduledStart: string | null; actualStart: string | null;
}

/**
 * Reuses `/api/full-catalogue`, which already works for any handle and
 * costs about 1 unit per 25 videos. `slim=1` drops descriptions and tags,
 * which this analysis does not read.
 */
export async function fetchArtistCatalogue(
  baseUrl: string, handle: string, cap = 200,
): Promise<DiscoveredVideo[]> {
  const url = `${baseUrl}/api/full-catalogue?handle=${encodeURIComponent(handle)}&cap=${cap}&slim=1`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`full-catalogue ${r.status}`);
  const j = await r.json();
  return ((j.videos ?? []) as RawVideo[])
    .filter(v => !!v.publishedAt)
    .map(v => ({
      id: v.id,
      title: stripLoneSurrogates(v.title),
      description: '',
      publishedAt: v.publishedAt as string,
      durationSec: v.durationSec,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      wasLive: v.wasLive,
      scheduledStart: v.scheduledStart,
      actualStart: v.actualStart,
    }));
}

/* ── Release-to-release comparison ───────────────────────────────────── */

export interface ReleaseComparison {
  currentHero: { title: string; date: string; daysAgo: number } | null;
  previousHero: { title: string; date: string } | null;
  /** Formats deployed around each, and what differs. */
  currentFormats: string[];
  previousFormats: string[];
  dropped: string[];
  added: string[];
  currentSupportCount: number;
  previousSupportCount: number;
  /** Days between the two heroes — the release interval. */
  heroGapDays: number | null;
  /** Median interval across all observed heroes, for context. */
  medianHeroGapDays: number | null;
  /** One sentence, deterministic. Empty when nothing differs. */
  summary: string;
}

export function compareToPrevious(p: ChannelProfile): ReleaseComparison {
  const windows = p.releaseWindows ?? [];
  const cur = windows[0] ?? null;
  const prev = windows[1] ?? null;

  const heroDates = p.heroes.map(h => new Date(h.publishedAt).getTime()).sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let i = 1; i < heroDates.length; i++) {
    gaps.push((heroDates[i - 1] - heroDates[i]) / 86_400_000);
  }
  const medianHeroGapDays = gaps.length
    ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : null;

  if (!cur) {
    return {
      currentHero: null, previousHero: null,
      currentFormats: [], previousFormats: [], dropped: [], added: [],
      currentSupportCount: 0, previousSupportCount: 0,
      heroGapDays: null, medianHeroGapDays,
      summary: '',
    };
  }

  const curFormats = cur.supportFormats;
  const prevFormats = prev?.supportFormats ?? [];
  const dropped = prevFormats.filter(f => !curFormats.includes(f));
  const added = curFormats.filter(f => !prevFormats.includes(f));
  const heroGapDays = prev
    ? Math.round((new Date(cur.heroDate).getTime() - new Date(prev.heroDate).getTime()) / 86_400_000)
    : null;

  const bits: string[] = [];
  if (dropped.length) {
    bits.push(
      `${dropped.join(', ')} supported "${prev!.heroTitle}" but ${dropped.length === 1 ? 'has' : 'have'} not appeared around "${cur.heroTitle}"`,
    );
  }
  if (added.length) {
    bits.push(`${added.join(', ')} ${added.length === 1 ? 'is' : 'are'} new to this release`);
  }
  if (prev && cur.supportCount < prev.supportCount) {
    bits.push(
      `${cur.supportCount} supporting assets this time against ${prev.supportCount} last time`,
    );
  } else if (prev && cur.supportCount > prev.supportCount) {
    bits.push(
      `${cur.supportCount} supporting assets this time against ${prev.supportCount} last time`,
    );
  }

  return {
    currentHero: {
      title: cur.heroTitle,
      date: cur.heroDate,
      daysAgo: Math.floor((Date.now() - new Date(cur.heroDate).getTime()) / 86_400_000),
    },
    previousHero: prev ? { title: prev.heroTitle, date: prev.heroDate } : null,
    currentFormats: curFormats,
    previousFormats: prevFormats,
    dropped, added,
    currentSupportCount: cur.supportCount,
    previousSupportCount: prev?.supportCount ?? 0,
    heroGapDays, medianHeroGapDays,
    summary: bits.join('; '),
  };
}

/* ── The bundle handed to a read ─────────────────────────────────────── */

export interface CampaignEvidence {
  slug: string;
  artistName: string;
  campaignName: string | null;
  campaignStartDate: string | null;
  campaignDay: number | null;
  profile: ChannelProfile;
  comparison: ReleaseComparison;
  /** Dated forward moments, or an explicit statement that none are known. */
  horizon: {
    known: boolean;
    confidence: string;
    reason: string | null;
    /* A horizon event may be undated — the plan names a moment without a
       date. That is information, not an error, so the date is nullable. */
    next: { title: string; date: string | null; daysAway: number | null; status: string } | null;
    upcoming: { title: string; date: string | null; daysAway: number | null }[];
  };
  /** Assets published inside the campaign window, if a start date exists. */
  campaignAssets: { date: string; format: string; title: string; views: number }[];
}

export async function buildCampaignEvidence(
  artist: Artist, baseUrl: string,
): Promise<CampaignEvidence | null> {
  if (!artist.channelHandle) return null;

  const videos = await fetchArtistCatalogue(baseUrl, artist.channelHandle, 200);
  if (!videos.length) return null;

  const profile = buildProfile(artist.slug, videos);
  const comparison = compareToPrevious(profile);

  let horizon: CampaignEvidence['horizon'] = {
    known: false, confidence: 'UNKNOWN', reason: null, next: null, upcoming: [],
  };
  try {
    const h = await getHorizon(artist.slug);
    horizon = {
      known: h.horizonKnown,
      confidence: h.horizonConfidence,
      reason: h.horizonReason,
      next: h.nextMajorMoment ? {
        title: h.nextMajorMoment.title,
        date: h.nextMajorMoment.date,
        daysAway: h.nextMajorMoment.daysAway,
        status: h.nextMajorMoment.status,
      } : null,
      upcoming: h.next30Days.map(e => ({ title: e.title, date: e.date, daysAway: e.daysAway })),
    };
  } catch { /* horizon is optional; its absence is itself reportable */ }

  const campaignDay = artist.campaignStartDate
    ? Math.floor((Date.now() - new Date(artist.campaignStartDate).getTime()) / 86_400_000)
    : null;

  const campaignAssets = artist.campaignStartDate
    ? (profile.timeline ?? []).filter(t => t.date >= artist.campaignStartDate!)
    : [];

  return {
    slug: artist.slug,
    artistName: artist.name,
    campaignName: artist.campaign ?? null,
    campaignStartDate: artist.campaignStartDate ?? null,
    campaignDay,
    profile,
    comparison,
    horizon,
    campaignAssets,
  };
}

/* ── Rendering for the model ─────────────────────────────────────────── */

function fmt(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
}

export function renderCampaignEvidence(e: CampaignEvidence): string {
  const p = e.profile;
  const c = e.comparison;
  const lines: string[] = [
    `ARTIST: ${e.artistName}${e.campaignName ? ` — campaign "${e.campaignName}"` : ''}`,
    e.campaignStartDate
      ? `Campaign started ${e.campaignStartDate} — day ${e.campaignDay}.`
      : 'No campaign start date recorded.',
    `Catalogue analysed: ${p.uploadsAnalysed} uploads, ${p.windowStart.slice(0, 10)} to ${p.windowEnd.slice(0, 10)}.`,
    `Uploads in the last 90 days: ${p.uploadsLast90d}. Median gap between uploads: ${p.medianGapDays == null ? 'unknown' : `${p.medianGapDays.toFixed(1)} days`}.`,
    `Format mix: ${Object.entries(p.formatCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ')}.`,
  ];

  if (p.releaseWindows?.length) {
    lines.push('', 'RELEASE ARCHITECTURE — each hero and what surrounded it (−7 to +21 days):');
    for (const w of p.releaseWindows.slice(0, 4)) {
      lines.push(
        `  ${w.heroDate.slice(0, 10)}  "${w.heroTitle}" (${fmt(w.heroViews)} lifetime views)`,
        `      support: ${w.supportFormats.length ? w.supportFormats.join(', ') : 'none'} · ` +
        `${w.supportCount} non-Shorts asset${w.supportCount === 1 ? '' : 's'} · ${w.shortsInWindow} Shorts`,
      );
      for (const a of w.assets.slice(0, 8)) {
        lines.push(`        ${a.daysFromHero >= 0 ? '+' : ''}${a.daysFromHero}d  ${a.format.padEnd(11)} ${a.title.slice(0, 58)}`);
      }
    }
  } else {
    lines.push('', 'No hero release identified in the analysed catalogue.');
  }

  if (c.currentHero) {
    lines.push('', 'THIS RELEASE AGAINST THEIR LAST:');
    lines.push(`  Current hero: "${c.currentHero.title}" (${c.currentHero.date.slice(0, 10)}, ${c.currentHero.daysAgo} days ago)`);
    if (c.previousHero) {
      lines.push(`  Previous hero: "${c.previousHero.title}" (${c.previousHero.date.slice(0, 10)})`);
      lines.push(`  Support formats then: ${c.previousFormats.join(', ') || 'none'}`);
      lines.push(`  Support formats now:  ${c.currentFormats.join(', ') || 'none'}`);
      if (c.dropped.length) lines.push(`  Dropped since last release: ${c.dropped.join(', ')}`);
      if (c.added.length) lines.push(`  New this release: ${c.added.join(', ')}`);
      if (c.heroGapDays != null) lines.push(`  Days between the two heroes: ${c.heroGapDays}`);
    } else {
      lines.push('  No earlier hero in the analysed window — nothing to compare against.');
    }
    if (c.medianHeroGapDays != null) {
      lines.push(`  Median gap between this artist's heroes: ${c.medianHeroGapDays.toFixed(0)} days`);
    }
  }

  lines.push('', 'FORWARD PLAN:');
  if (e.horizon.known && e.horizon.next) {
    lines.push(
      e.horizon.next.date
        ? `  Next major moment: ${e.horizon.next.title} on ${e.horizon.next.date} ` +
          `(${e.horizon.next.daysAway} days away, ${e.horizon.next.status}).`
        : `  Next major moment: ${e.horizon.next.title} — recorded but UNDATED (${e.horizon.next.status}). ` +
          `Do not assume a date for it.`,
    );
    for (const u of e.horizon.upcoming.slice(0, 6)) {
      lines.push(`  ${u.date ?? 'undated'} · ${u.title}${u.daysAway != null ? ` (${u.daysAway}d)` : ''}`);
    }
  } else {
    lines.push(
      `  No reliable forward plan is recorded (${e.horizon.confidence}${e.horizon.reason ? `: ${e.horizon.reason}` : ''}).`,
      '  Do not infer one. If timing advice depends on a release date we do not have, say so.',
    );
  }

  lines.push(
    '',
    'EVIDENCE LIMITS: every view figure is a lifetime total read once, today.',
    'Do NOT compare the view count of a recent asset with an older one — the older',
    'one has simply had longer to accumulate. Architecture, dates and sequence are',
    'unaffected by age and are the safe basis for any comparison.',
    'No retention, traffic source, impression, CTR or Shorts-to-long-form data exists.',
  );

  return lines.join('\n');
}
