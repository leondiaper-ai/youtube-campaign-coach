/* ═══════════════════════════════════════════════════════════════════════
   OPPORTUNITIES — SIGNAL × CATALOGUE × OWNED EVIDENCE

   One opportunity per charted song that has at least an artist-level
   connection to the catalogue, plus the stage it has reached:

     monitor              a signal exists; no credible match, or a match
                          that needs a human check first
     act-editorially      a credible match AND a feasible editorial action
     consider-paid-test   verified recording, the signal held across
                          comparable readings, and we have an owned
                          baseline to measure against

   The third stage is a gate, not a recommendation: it means the
   evidence is good enough to write a test hypothesis down, and it
   still lists what is unknown. Nothing here estimates spend or return.
   ═══════════════════════════════════════════════════════════════════════ */

import type { OwnedSnapshot } from '@/lib/ownedChannels/metrics';
import type { CatalogueLayer } from './catalogue';
import { indexCatalogue, matchEntry, normalise, splitArtists } from './match';
import { MATCH_STRENGTH, type CatalogueMatch, type ChartEntry, type ChartObservation, type Opportunity, type OwnedUploadEvidence, type Stage } from './types';

const DAY = 86400000;

/** A key for "the same song" across readings, in order of reliability. */
export function songKey(e: ChartEntry): string {
  if (e.isrc) return `isrc:${e.isrc.toUpperCase()}`;
  if (e.videoId) return `video:${e.videoId}`;
  const artist = e.artists.length ? splitArtists(e.artists[0])[0] ?? '' : '';
  return `text:${normalise(e.title)}|${artist}`;
}

/** Lifetime views for one upload at the latest reading, and a gain against the earliest comparable reading. */
export function ownedEvidence(videoId: string, history: OwnedSnapshot[]): Pick<OwnedUploadEvidence, 'views' | 'readingAt' | 'gain'> {
  const readings = history.map(s => {
    const item = s.items.find(v => v.id === videoId);
    const views = item?.views ?? s.viewsById?.[videoId] ?? null;
    return views == null ? null : { at: s.collectedAt, views };
  }).filter((r): r is { at: string; views: number } => !!r).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const latest = readings.at(-1);
  if (!latest) return { views: null, readingAt: null, gain: null };
  /* Baseline: the earliest reading at least 20 hours before the latest.
     The span is reported as it is; it is never scaled to a 7-day figure. */
  const baseline = readings.find(r => Date.parse(latest.at) - Date.parse(r.at) >= 20 * 3600000) ?? null;
  return { views: latest.views, readingAt: latest.at,
    gain: baseline ? { views: latest.views - baseline.views, days: Math.round((Date.parse(latest.at) - Date.parse(baseline.at)) / DAY * 10) / 10, baselineAt: baseline.at } : null };
}

function action(best: CatalogueMatch | undefined, matches: CatalogueMatch[], e: ChartEntry, territory: string): { stage: Stage; action: string } {
  if (!best) return { stage: 'monitor', action: 'No credible catalogue match. Keep the signal on the watch list; no action.' };
  const t = best.track;
  const where = t.channelName ? `${t.channelName}` : 'an owned channel';
  switch (best.kind) {
    case 'exact-upload':
      return { stage: 'act-editorially', action: `Our upload is the charted video in ${territory}. Pin it on ${where} (channel home / featured), place it first in the channel's main playlist, and cut a Short from this upload while the chart position holds.` };
    case 'isrc':
      return t.origin === 'owned-upload'
        ? { stage: 'act-editorially', action: `Feature the matching recording on ${where}: playlist placement at the top of the relevant playlist and a Short cut from it. Check the charted version against ours before any paid consideration.` }
        : { stage: 'act-editorially', action: `The recording is in the source catalogue but not on an owned channel. Decide which channel fits (by its actual catalogue, not its name), confirm the rights note, then upload with the chart territory in mind.` };
    case 'title-artist':
      return { stage: 'act-editorially', action: `Confirm "${t.title}" on ${where} is the same recording as the charted "${e.title}"; if so, move it to the front of the channel's playlist and cut a Short from it for ${territory}.` };
    case 'title-only':
      return { stage: 'monitor', action: `Check whether "${t.title}" on ${where} is the same song as "${e.title}" (${e.artists.join(', ') || 'artist not supplied'}). Act only if it is the composition; a shared title is not a connection.` };
    case 'artist':
      return { stage: 'monitor', action: `Artist-level connection only (${e.artists.join(', ') || 'see title'}). If more of their songs chart, consider an artist playlist on ${where}; otherwise no action.` };
  }
  return { stage: 'monitor', action: 'No action.' };
}

export function buildOpportunities(observations: ChartObservation[], catalogue: CatalogueLayer, now = Date.now()): Opportunity[] {
  const index = indexCatalogue(catalogue.tracks);
  /* Persistence: the same song across stored readings of the SAME
     source and measure (comparable), counting distinct periods and the
     territories it appeared in. A Data API daily list and a weekly
     Chartmetric chart are never pooled. */
  const seen = new Map<string, { periods: Set<string>; territories: Set<string>; first: string; last: string }>();
  for (const obs of observations) for (const e of obs.entries) {
    const k = `${obs.source}|${obs.measure}|${songKey(e)}`;
    const cur = seen.get(k) ?? { periods: new Set(), territories: new Set(), first: obs.period, last: obs.period };
    cur.periods.add(obs.period); cur.territories.add(obs.territory);
    if (obs.period < cur.first) cur.first = obs.period;
    if (obs.period > cur.last) cur.last = obs.period;
    seen.set(k, cur);
  }
  /* Only the latest reading per (source, measure, territory) produces
     opportunities; older readings are evidence for persistence. */
  const latestByKey = new Map<string, ChartObservation>();
  for (const obs of observations) {
    const k = `${obs.source}|${obs.measure}|${obs.territory}`;
    const cur = latestByKey.get(k);
    if (!cur || obs.period > cur.period) latestByKey.set(k, obs);
  }
  const out: Opportunity[] = [];
  for (const obs of Array.from(latestByKey.values())) {
    for (const e of obs.entries) {
      const matches = matchEntry(e, index);
      if (!matches.length) continue;
      const best = matches[0];
      const persistence = seen.get(`${obs.source}|${obs.measure}|${songKey(e)}`)!;
      const owned: OwnedUploadEvidence[] = matches.filter(m => m.track.origin === 'owned-upload' && m.track.videoId).slice(0, 4).map(m => {
        const slugDef = catalogue.coverage.find(c => c.slug === m.track.channelSlug);
        const history = slugDef ? catalogue.ownedHistory[slugDef.channelId] ?? [] : [];
        return { videoId: m.track.videoId!, title: m.track.title, channelSlug: m.track.channelSlug ?? '', channelName: m.track.channelName ?? '',
          publishedAt: m.track.publishedAt ?? '', matchKind: m.kind, ...ownedEvidence(m.track.videoId!, history) };
      });
      let { stage, action: text } = action(best, matches, e, obs.territory);
      const verified = best.kind === 'exact-upload' || best.kind === 'isrc';
      /* The baseline must belong to the upload that IS the verified
         recording. A reading of a different song by the same artist is
         not a baseline for this one. */
      const verifiedBaseline = owned.some(o => o.gain && (o.matchKind === 'exact-upload' || o.matchKind === 'isrc'));
      const hasBaseline = owned.some(o => o.gain);
      if (verified && persistence.periods.size >= 2 && verifiedBaseline && stage === 'act-editorially') stage = 'consider-paid-test';
      const unknowns: string[] = [];
      if (obs.source === 'youtube-data-api') unknowns.push('The Data API "most popular" list publishes no measure, period or previous rank; movement is only visible across our own daily readings.');
      if (!verified) unknowns.push(`${MATCH_STRENGTH[best.kind].caveat}`);
      if (!best.track.rightsNote) unknowns.push('Rights and territory clearance are not recorded for this recording.');
      if (owned.length && !hasBaseline) unknowns.push('No earlier owned reading for the matched upload: lifetime views are a baseline, not growth.');
      if (verified && persistence.periods.size >= 2 && !verifiedBaseline && best.track.origin === 'owned-upload') unknowns.push('The verified upload has no second owned reading yet, so there is no organic baseline for a test.');
      if (verified && best.track.origin === 'source-catalogue' && !owned.some(o => o.matchKind === 'isrc')) unknowns.push('The recording is not on an owned channel, so there is no owned baseline; publish first, then measure.');
      if (persistence.periods.size < 2) unknowns.push('Seen in one reading so far; persistence unknown.');
      unknowns.push('Public statistics say nothing about audience geography, traffic source or retention.');
      out.push({
        id: `${obs.id}#${songKey(e)}`, observationId: obs.id,
        signal: { source: obs.source, measure: obs.measure, territory: obs.territory, period: obs.period, periodLabel: obs.periodLabel,
          sourceUrl: obs.sourceUrl, collectedAt: obs.collectedAt, rank: e.rank, previousRank: e.previousRank, isNew: e.isNew,
          periodsOnChart: e.periodsOnChart, measureValue: e.measureValue, title: e.title, artists: e.artists, videoId: e.videoId,
          channelTitle: e.channelTitle, isrc: e.isrc },
        persistence: { periods: persistence.periods.size, territories: Array.from(persistence.territories).sort(), firstSeen: persistence.first, lastSeen: persistence.last },
        matches, ownedUploads: owned, stage, action: text, unknowns,
      });
    }
  }
  const stageRank: Record<Stage, number> = { 'consider-paid-test': 0, 'act-editorially': 1, 'monitor': 2 };
  return out.sort((a, b) => stageRank[a.stage] - stageRank[b.stage]
    || MATCH_STRENGTH[a.matches[0].kind].rank - MATCH_STRENGTH[b.matches[0].kind].rank
    || a.signal.rank - b.signal.rank);
}

/** Count of entries with no match at all — reported, because "nothing matched" is a result. */
export function unmatchedCount(observations: ChartObservation[], catalogue: CatalogueLayer): { total: number; unmatched: number } {
  const index = indexCatalogue(catalogue.tracks);
  const latestByKey = new Map<string, ChartObservation>();
  for (const obs of observations) {
    const k = `${obs.source}|${obs.measure}|${obs.territory}`;
    const cur = latestByKey.get(k);
    if (!cur || obs.period > cur.period) latestByKey.set(k, obs);
  }
  let total = 0, unmatched = 0;
  for (const obs of Array.from(latestByKey.values())) for (const e of obs.entries) { total++; if (!matchEntry(e, index).length) unmatched++; }
  return { total, unmatched };
}
