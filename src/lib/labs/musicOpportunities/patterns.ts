/* ═══════════════════════════════════════════════════════════════════════
   PATTERNS — RECURRING AMONG THE CHART ENTRIES OBSERVED

   The unit is label value × chart type × territory, over the latest
   reading of each series, with persistence from the series' stored
   periods. A pattern is only surfaced when it clears the floor below,
   and every pattern carries the numbers a reader needs to discount it:
   distinct entities and artists, the share of labelled rows (not of all
   rows), the top artist's share, how many of its entities were present
   in every stored period, and how much of the labelling is inferred.

   What a chart cannot tell us is written into the caveats, not left to
   the reader to remember: a chart is selected successes, so a label's
   frequency is not that label's success rate; a charting video does
   not prove its format caused the result; one superstar is not a
   genre; and rank movement is not comparable across chart types.
   ═══════════════════════════════════════════════════════════════════════ */

import { normArtist, splitCredit } from './classify';
import { latestRows, seriesKey, songKey, type Bank } from './bank';
import type { Dimension, Label, Pattern, Provenance } from './types';
import { MEASURE_ENTITY } from './types';

export const PATTERN_FLOOR = { entities: 5, artists: 3 };
/** A label carried by this share or more of a chart's labelled rows is that chart's baseline, not a pattern within it. */
export const BASELINE_SHARE = 0.8;
/** A chart's own main language is its baseline whatever the share. */
export const TERRITORY_LANGUAGE: Record<string, string> = { GB: 'en', US: 'en', AU: 'en', CA: 'en', IE: 'en', MX: 'es', ES: 'es', AR: 'es', CO: 'es', CL: 'es', BR: 'pt', DE: 'de', AT: 'de', FR: 'fr', IT: 'it', KR: 'ko', JP: 'ja', IN: 'hi' };
const DIMENSIONS: Dimension[] = ['genre', 'language', 'era', 'version', 'presentation'];

type Row = ReturnType<typeof latestRows>[number];

function labelsOf(r: Row): Label[] { return r.song?.labels ?? r.video?.labels ?? []; }
function entityKey(r: Row) { return r.song ? r.song.key : r.video ? `video:${r.video.videoId}` : `row:${r.obs.id}#${r.entry.rank}`; }
function leadArtist(r: Row) { const a = r.entry.artists[0]; return a ? normArtist(splitCredit(a)[0] ?? a) : null; }

export function findPatterns(bank: Bank): Pattern[] {
  const rows = latestRows(bank);
  const bySeries = new Map<string, Row[]>();
  for (const r of rows) { const k = seriesKey(r.obs); bySeries.set(k, [...(bySeries.get(k) ?? []), r]); }
  const out: Pattern[] = [];
  for (const [sk, series] of bySeries) {
    const obs = series[0].obs;
    const periods = bank.seriesPeriods.get(sk) ?? [obs.period];
    const entity = MEASURE_ENTITY[obs.measure];
    for (const dimension of DIMENSIONS) {
      if (dimension === 'presentation' && entity !== 'video') continue;
      const labelled = series.filter(r => labelsOf(r).some(l => l.dimension === dimension));
      if (!labelled.length) continue;
      const values = new Set(labelled.flatMap(r => labelsOf(r).filter(l => l.dimension === dimension).map(l => l.value)));
      for (const value of values) {
        const hits = labelled.filter(r => labelsOf(r).some(l => l.dimension === dimension && l.value === value));
        const entities = new Set(hits.map(entityKey));
        const artists = new Map<string, number>();
        for (const r of hits) { const a = leadArtist(r); if (a) artists.set(a, (artists.get(a) ?? 0) + 1); }
        if (entities.size < PATTERN_FLOOR.entities || artists.size < PATTERN_FLOOR.artists) continue;
        const share = labelled.length ? hits.length / labelled.length : null;
        const baseline = (share != null && share >= BASELINE_SHARE) || (dimension === 'language' && TERRITORY_LANGUAGE[obs.territory] === value);
        const top = Array.from(artists.entries()).sort((a, b) => b[1] - a[1])[0];
        /* Present in every stored period of this series: the song/video record's appearances in THIS series cover all periods. */
        const persistent = hits.filter(r => {
          const apps = (r.song?.appearances ?? r.video?.appearances ?? []).filter(a => seriesKey(a) === sk);
          return periods.every(p => apps.some(a => a.period === p));
        }).length;
        const provenance: Record<Provenance, number> = { human: 0, verified: 0, inferred: 0 };
        for (const r of hits) for (const l of labelsOf(r)) if (l.dimension === dimension && l.value === value) provenance[l.provenance]++;
        const caveats = [
          'Chart entries are selected successes: this frequency is not a success rate for the label.',
          periods.length < 2 ? 'One stored period for this chart: persistence cannot be assessed yet.' : `${persistent} of ${entities.size} were present in all ${periods.length} stored periods.`,
        ];
        if (baseline) caveats.unshift(dimension === 'language' && TERRITORY_LANGUAGE[obs.territory] === value ? `${value} is ${obs.territory}'s main language: the chart's baseline, not a pattern within it.` : `${Math.round(share! * 100)}% of labelled rows: this is the chart's baseline for ${dimension}, not a pattern within it.`);
        if (top && top[1] / hits.length >= 0.4) caveats.push(`${top[0]} accounts for ${Math.round(top[1] / hits.length * 100)}% of these rows; this may be one act, not a wider pattern.`);
        if (provenance.inferred > 0 && provenance.human === 0 && provenance.verified === 0) caveats.push('All labels behind this pattern are inferred (title rules or the model-assigned artist map); none are human-reviewed.');
        if (dimension === 'presentation') caveats.push('Presentation is read from the video title. A charting video does not show that its format caused the result.');
        if (labelled.length / series.length < 0.6) caveats.push(`Only ${labelled.length} of ${series.length} rows carry a ${dimension} label; the rest are unknown.`);
        out.push({
          id: `${sk}|${dimension}|${value}`, dimension, value, measure: obs.measure, territory: obs.territory,
          entities: entities.size, share, baseline, labelledRows: labelled.length, totalRows: series.length,
          artists: artists.size, topArtistShare: top ? top[1] / hits.length : 0, topArtist: top ? top[0] : null,
          periodsObserved: periods.length, persistentEntities: periods.length >= 2 ? persistent : null,
          examples: hits.sort((a, b) => a.entry.rank - b.entry.rank).slice(0, 6).map(r => ({ title: r.entry.title, artists: r.entry.artists, rank: r.entry.rank, videoId: r.entry.videoId, songKey: r.song?.key ?? (r.video ? `video:${r.video.videoId}` : songKey(r.entry)) })),
          provenance, caveats,
        });
      }
    }
  }
  return out.sort((a, b) => b.entities - a.entities || (b.share ?? 0) - (a.share ?? 0));
}

/** Coverage of each dimension across the latest rows: how much is still unknown. */
export function labelCoverage(bank: Bank): { dimension: Dimension; labelled: number; total: number; byProvenance: Record<Provenance, number> }[] {
  const rows = latestRows(bank);
  return DIMENSIONS.map(dimension => {
    const applicable = dimension === 'presentation' ? rows.filter(r => MEASURE_ENTITY[r.obs.measure] === 'video') : rows;
    const byProvenance: Record<Provenance, number> = { human: 0, verified: 0, inferred: 0 };
    let labelled = 0;
    for (const r of applicable) {
      const ls = labelsOf(r).filter(l => l.dimension === dimension);
      if (ls.length) { labelled++; byProvenance[ls[0].provenance]++; }
    }
    return { dimension, labelled, total: applicable.length, byProvenance };
  });
}
