import { countPublishedSince, SHORT_MAX_SEC, type LibraryStats, type OwnedVideo } from './metrics';
import type { VideoGain } from './analysis';

/* Observations, not recommendations.
 *
 * Each entry makes one specific point and shows the figures behind it.
 * None of them ends with a question, and none proposes an action simply
 * because a rule fired — a rule firing means something is measurable, not
 * that it is actionable. `note` exists only for a qualification that
 * changes how the figure should be read; general methodology belongs in
 * the page's definitions section, not on every card.
 */

const DAY = 86400000;
const compact = (n: number) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
/* Counts are stated exactly: "6.6k of 6.6k" reads as a rounding bug. */
const exact = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const pct = (n: number) => `${n < 0.01 ? '<1' : Math.round(n * 100)}%`;

export type Observation = {
  id: string;
  /** What was observed. */
  headline: string;
  /** The numbers behind it, with the denominator always stated. */
  detail: string;
  /** Only where it materially changes interpretation. Usually absent. */
  note?: string;
  /** Examples, rendered as short text links rather than repeated artwork. */
  videos: OwnedVideo[];
};

export type ObservationInput = {
  /** The stored working set. Never described as the whole channel. */
  items: OwnedVideo[];
  library: LibraryStats;
  gains: Record<string, VideoGain>;
  /** Recorded days between the baseline and now. Null when none matched. */
  baselineDays: number | null;
  at: number;
  perDay?: Record<string, number>;
  /** Channel-level view movement over the observed span. */
  viewsGain: { value: number; days: number } | null;
};

/** Leading credit in the "Artist - Title" convention these channels use. */
function leadName(title: string): string | null {
  const cleaned = title.replace(/[[(][^\])]*[\])]?/g, ' ').trim();
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return null;
  const name = parts[0].replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}

/** Bracketed descriptor: "(Lyrics Video)", "[Remix]", "(Official Audio)". */
function formatTag(title: string): string | null {
  const match = title.match(/[[(]([^\])]{2,40})[\])]/);
  if (!match) return null;
  const tag = match[1].replace(/\s+/g, ' ').trim();
  return /\d{4}/.test(tag) ? null : tag;
}

/* Finds a value recurring among the leaders, and refuses it when the same
   value is on much of the catalogue — at which point it is the channel's
   naming convention rather than anything about these uploads. */
function recurring(sample: OwnedVideo[], items: OwnedVideo[], extract: (title: string) => string | null) {
  const tally = new Map<string, OwnedVideo[]>();
  for (const video of sample) {
    const value = extract(video.title);
    if (!value) continue;
    const key = value.toLowerCase();
    tally.set(key, [...(tally.get(key) ?? []), video]);
  }
  const best = Array.from(tally.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  if (!best || best[1].length < 3 || sample.length < 6) return null;
  const acrossLibrary = items.filter(v => extract(v.title)?.toLowerCase() === best[0]).length;
  if (acrossLibrary >= items.length * 0.4) return null;
  return { label: extract(best[1][0].title) ?? best[0], videos: best[1], acrossLibrary };
}

export function observeChannel(input: ObservationInput): Observation[] {
  const { items, library, gains, baselineDays, at, perDay, viewsGain } = input;
  const found: Observation[] = [];
  const byViews = items.filter(v => v.views != null).sort((a, b) => b.views! - a.views!);
  const coverage = library.videoCount != null && library.videoCount > library.swept
    ? `Across ${exact(library.swept)} uploads read of ${exact(library.videoCount)} on the channel.`
    : `Across all ${exact(library.swept)} uploads on the channel.`;

  /* 1. Concentration. The most consequential fact about every one of these
        channels so far, so it leads. */
  if (library.totalViews && library.withViews >= 20 && byViews.length) {
    if (library.topShare != null && library.topShare >= 0.25) {
      found.push({
        id: 'concentration',
        headline: `${byViews[0].title} accounts for ${pct(library.topShare)} of recorded upload views.`,
        detail: coverage,
        videos: [byViews[0]],
      });
    } else if (library.halfShareCount != null && library.halfShareCount <= Math.max(1, library.withViews * 0.1)) {
      const n = library.halfShareCount;
      found.push({
        id: 'concentration',
        headline: `${n} upload${n === 1 ? '' : 's'} account${n === 1 ? 's' : ''} for half of recorded upload views.`,
        detail: `${coverage} The next ${exact(Math.max(0, library.withViews - n))} together account for the other half.`,
        videos: byViews.slice(0, Math.min(n, 5)),
      });
    }
  }

  const sample = byViews.slice(0, 12);

  /* 2. A label recurring among the leaders. This is a fact about how those
        uploads are TITLED. Whether they are actually lyric videos, or why
        they did well, is not in this data, and the note says so rather
        than the copy quietly implying a format worked. */
  const tag = recurring(sample, items, formatTag);
  if (tag) {
    found.push({
      id: 'repeated-format',
      headline: `${tag.videos.length} of the ${sample.length} most-viewed uploads are titled “${tag.label}”.`,
      detail: `${exact(tag.acrossLibrary)} of ${exact(items.length)} uploads held carry that label, so it is more common among the leaders than across the channel.`,
      note: `A title label, not a verified format: it describes how these uploads are named, not how they look or where they were shown.`,
      videos: tag.videos.slice(0, 5),
    });
  }

  /* 3. A name recurring among the leaders. */
  const name = recurring(sample, items, leadName);
  if (name) {
    found.push({
      id: 'repeated-name',
      headline: `“${name.label}” leads ${name.videos.length} of the ${sample.length} most-viewed uploads.`,
      detail: `It appears on ${exact(name.acrossLibrary)} of ${exact(items.length)} uploads held.`,
      videos: name.videos.slice(0, 5),
    });
  }

  /* 4. Back-catalogue moving. Needs a baseline, so absent on a first
        reading rather than estimated. */
  if (baselineDays != null) {
    const older = byViews
      .filter(v => {
        const gain = gains[v.id];
        return gain?.kind === 'measured' && (gain.value ?? 0) > 0 && at - Date.parse(v.publishedAt) > 30 * DAY;
      })
      .sort((a, b) => (gains[b.id].value ?? 0) - (gains[a.id].value ?? 0));
    const total = older.reduce((sum, v) => sum + (gains[v.id].value ?? 0), 0);
    if (older.length >= 2 && total >= 50) {
      found.push({
        id: 'older-gaining',
        headline: `${exact(older.length)} uploads older than a month gained ${compact(total)} views between readings.`,
        detail: `Measured over ${baselineDays.toFixed(1)} recorded days.`,
        videos: older.slice(0, 5),
      });
    }
  }

  /* 5. Output up, viewing not. */
  if (perDay && viewsGain && viewsGain.days >= 5) {
    const last7 = countPublishedSince(perDay, at - 7 * DAY, at);
    const prior7 = countPublishedSince(perDay, at - 14 * DAY, at - 7 * DAY);
    if (prior7 >= 5 && last7 >= prior7 * 1.5 && viewsGain.value <= 0) {
      found.push({
        id: 'output-up-views-flat',
        headline: `Publishing rose to ${exact(last7)} uploads from ${exact(prior7)} the week before, while channel views did not.`,
        detail: `Channel views moved ${viewsGain.value >= 0 ? '+' : ''}${compact(viewsGain.value)} over ${viewsGain.days.toFixed(1)} recorded days.`,
        note: `Two readings is a short base for this.`,
        videos: [],
      });
    }
  }

  /* 6. The dormant tail. */
  if (library.withViews >= 50 && library.underTen / library.withViews >= 0.5) {
    found.push({
      id: 'dormant-tail',
      headline: `${pct(library.underTen / library.withViews)} of uploads read have fewer than ten views.`,
      detail: `${exact(library.underTen)} of ${exact(library.withViews)} uploads read sit under ten views.`,
      videos: [],
    });
  }

  /* 7. Short-form, by duration. Counts only — the two groups' view totals
        are not a like-for-like comparison and are not put side by side. */
  if (library.withViews >= 20) {
    const shortShare = library.shortCount / Math.max(1, library.swept);
    const shortLeaders = sample.filter(v => v.durationSec != null && v.durationSec > 0 && v.durationSec <= SHORT_MAX_SEC);
    if (library.shortCount === 0 && library.swept >= 30) {
      found.push({
        id: 'no-short-form',
        headline: `No uploads run under three minutes.`,
        detail: `${coverage} This channel publishes no short-form.`,
        videos: [],
      });
    } else if (sample.length >= 6 && shortLeaders.length >= 3 && shortShare < 0.25) {
      found.push({
        id: 'short-form-over-represented',
        headline: `${shortLeaders.length} of the ${sample.length} most-viewed uploads run under three minutes.`,
        detail: `Short-form is ${pct(shortShare)} of ${exact(library.swept)} uploads read.`,
        note: `YouTube counts a Short's view differently from a long-form view, so these are not like-for-like totals.`,
        videos: shortLeaders.slice(0, 5),
      });
    } else if (shortShare >= 0.25 && shortLeaders.length === 0 && sample.length >= 6) {
      found.push({
        id: 'short-form-absent-from-leaders',
        headline: `Short-form is ${pct(shortShare)} of output but none of the ${sample.length} most-viewed uploads.`,
        detail: `${exact(library.shortCount)} of ${exact(library.swept)} uploads read run under three minutes.`,
        videos: [],
      });
    }
  }

  /* Two. A third is almost always the weakest of the three. */
  return found.slice(0, 2);
}
