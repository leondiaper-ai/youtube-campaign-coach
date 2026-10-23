import { countPublishedSince, SHORT_MAX_SEC, type LibraryStats, type OwnedVideo } from './metrics';
import type { VideoGain } from './analysis';

/* Observations, not recommendations.
 *
 * Every entry here states something that was measured, the numbers behind
 * it, and a question it raises. None of them say what to do. The rules are
 * deliberately conservative: each has a minimum sample, and anything that
 * needs a second reading is simply absent until one exists, rather than
 * being softened into a guess. One upload doing well is never a formula,
 * so nothing here turns a single success into advice.
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
  /** A question or a test. Never an instruction. */
  prompt: string;
  /** Uploads that evidence it, for linking. */
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

  /* 0. Concentration. When one upload dominates, name it and stop: asking
        what several uploads "have in common" is nonsense for a sample of
        one. The coverage is stated here once, and nowhere else. */
  if (library.totalViews && library.withViews >= 20 && byViews.length) {
    const coverage = library.videoCount != null && library.videoCount > library.swept
      ? `Across ${exact(library.swept)} uploads read of ${exact(library.videoCount)} on the channel.`
      : `Across all ${exact(library.swept)} uploads on the channel.`;
    if (library.topShare != null && library.topShare >= 0.25) {
      const top = byViews[0];
      found.push({
        id: 'concentration',
        headline: `${top.title} accounts for ${pct(library.topShare)} of recorded upload views.`,
        detail: coverage,
        prompt: `One upload is not a pattern. Whether anything else on the channel moves with it is the question a second reading answers.`,
        videos: [top],
      });
    } else if (library.halfShareCount != null && library.halfShareCount <= Math.max(1, library.withViews * 0.1)) {
      const n = library.halfShareCount;
      const top = byViews.slice(0, Math.min(n, 5));
      found.push({
        id: 'concentration',
        headline: `${n} uploads account for half of recorded upload views.`,
        detail: coverage,
        prompt: `Worth checking what they share — though ${n} is a thin base, and a video can land for reasons that do not repeat.`,
        videos: top,
      });
    }
  }

  /* 1. A name recurring among the leaders. Guarded against the obvious
        false positive: if the name is on most of the catalogue it is the
        channel's naming convention, not a signal about an artist. */
  const sample = byViews.slice(0, 12);
  const name = recurring(sample, items, leadName);
  if (name) {
    found.push({
      id: 'repeated-name',
      headline: `“${name.label}” appears on ${name.videos.length} of the ${sample.length} most-viewed uploads`,
      detail: `It appears on ${name.acrossLibrary} of the ${compact(items.length)} uploads held, so it is not simply the channel's naming pattern.`,
      prompt: `Is the name drawing the views, or do these uploads share something else — length, era, thumbnail? Comparing them against uploads carrying the same name that did not land would separate the two.`,
      videos: name.videos.slice(0, 5),
    });
  }

  /* 2. A recurring format or version among the leaders. Same guard: a
         tag on most of the catalogue says nothing about these uploads. */
  const tag = recurring(sample, items, formatTag);
  if (tag) {
    found.push({
      id: 'repeated-format',
      headline: `${tag.videos.length} of the ${sample.length} most-viewed uploads are tagged “${tag.label}”`,
      detail: `${tag.acrossLibrary} of the ${compact(items.length)} uploads held carry that tag, so it is over-represented among the leaders rather than being the house style.`,
      prompt: `These uploads differ in age and subject as well as format, so this is not evidence the format causes the views. A fair test would be matched pairs — same kind of track, published around the same time, one tagged and one not.`,
      videos: tag.videos.slice(0, 5),
    });
  }

  /* 2b. Short-form, by duration. Three states are worth saying: none at
         all, over-represented among the leaders, or published steadily
         while absent from them. None of them compares the two groups'
         view counts, because a Short's view and a long-form view are not
         the same measurement. */
  if (library.withViews >= 20) {
    const shortShare = library.shortCount / Math.max(1, library.swept);
    const shortLeaders = byViews.slice(0, 12).filter(v => v.durationSec != null && v.durationSec > 0 && v.durationSec <= SHORT_MAX_SEC);
    const leaderSample = Math.min(12, byViews.length);
    if (library.shortCount === 0 && library.swept >= 30) {
      found.push({
        id: 'no-short-form',
        headline: `Nothing under three minutes in ${exact(library.swept)} uploads read`,
        detail: `Every upload collected runs longer than three minutes, so this channel is not publishing short-form at all.`,
        prompt: `Deliberate, or simply untried? If it is untried, a small batch would at least establish whether the audience is there — the catalogue cannot answer it.`,
        videos: [],
      });
    } else if (leaderSample >= 6 && shortLeaders.length >= 3 && shortShare < 0.25) {
      found.push({
        id: 'short-form-over-represented',
        headline: `${shortLeaders.length} of the ${leaderSample} most-viewed uploads are under three minutes`,
        detail: `Short-form is ${pct(shortShare)} of the ${exact(library.swept)} uploads read but ${pct(shortLeaders.length / leaderSample)} of the leaders. Note that YouTube counts a Short's view differently from a long-form view, so these totals are not like for like.`,
        prompt: `The counting difference alone could explain this. Comparing short-form against short-form over time, rather than against long-form, would show whether it is really outperforming.`,
        videos: shortLeaders.slice(0, 5),
      });
    } else if (shortShare >= 0.25 && shortLeaders.length === 0 && leaderSample >= 6) {
      found.push({
        id: 'short-form-absent-from-leaders',
        headline: `Short-form is ${pct(shortShare)} of output but none of the ${leaderSample} most-viewed uploads`,
        detail: `${exact(library.shortCount)} of ${exact(library.swept)} uploads read run under three minutes, and none of them reach the leaders.`,
        prompt: `Worth checking whether these are reaching the Shorts surface at all. Duration is all the public data shows; placement needs channel analytics.`,
        videos: [],
      });
    }
  }

  /* 3. The dormant tail. A property of the catalogue, said plainly. */
  if (library.withViews >= 50 && library.underTen / library.withViews >= 0.5) {
    found.push({
      id: 'dormant-tail',
      headline: `${pct(library.underTen / library.withViews)} of uploads read have fewer than ten views`,
      detail: `${exact(library.underTen)} of the ${exact(library.withViews)} uploads read sit under ten views.`,
      prompt: `Worth asking whether this volume is helping discovery or competing with itself. Publishing rate and view rate over the next few readings would show which.`,
      videos: [],
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
        headline: `Uploads older than a month are gaining again`,
        detail: `Over ${baselineDays.toFixed(1)} recorded days, ${older.length} uploads published more than 30 days ago gained ${compact(total)} views between them.`,
        prompt: `Something is surfacing back-catalogue. Whether it is one video or a cluster is worth checking before reading anything into it.`,
        videos: older.slice(0, 5),
      });
    }
  }

  /* 5. Output up, viewing not. Both halves need real measurement: the
        publishing side from the sweep's tallies, the viewing side from
        two readings. Without either, it is not stated. */
  if (perDay && viewsGain && viewsGain.days >= 5) {
    const last7 = countPublishedSince(perDay, at - 7 * DAY, at);
    const prior7 = countPublishedSince(perDay, at - 14 * DAY, at - 7 * DAY);
    if (prior7 >= 5 && last7 >= prior7 * 1.5 && viewsGain.value <= 0) {
      found.push({
        id: 'output-up-views-flat',
        headline: `Publishing rose while recorded channel views did not`,
        detail: `${last7} uploads in the last seven days against ${prior7} in the seven before, while channel views moved ${viewsGain.value >= 0 ? '+' : ''}${compact(viewsGain.value)} over ${viewsGain.days.toFixed(1)} recorded days.`,
        prompt: `Two readings is a short base for this. If it holds over the next few, it would be worth asking what the extra uploads are competing with.`,
        videos: [],
      });
    }
  }

  return found.slice(0, 3);
}
