/* ═══════════════════════════════════════════════════════════════════════
   CONNECTIONS — DIRECT AND CONTEXTUAL

   Direct: the charted song or video is, or shares a recording /
   composition / artist credit with, something we hold. Built by the
   matcher in match.ts and staged in opportunities.ts.

   Contextual: a pattern among the chart entries (a label value that
   recurs in one chart and territory) and tracks we hold that carry the
   same label. This is a hypothesis, not evidence that those tracks
   would chart. Channel fit comes from the channel's ACTUAL catalogue
   profile — how much of what it already publishes carries the label —
   never from the channel's name.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CatalogueLayer } from './catalogue';
import type { ContextualMatch, Pattern } from './types';

const FLOOR = { tracks: 3, channelShare: 0.1 };

export function contextualMatches(patterns: Pattern[], catalogue: CatalogueLayer): ContextualMatch[] {
  const out: ContextualMatch[] = [];
  for (const p of patterns) {
    /* Era and presentation do not transfer: an upload's date is not its
       release date, and a chart presentation says nothing about what we
       should upload. Genre, language and version can be compared. */
    if (p.dimension === 'era' || p.dimension === 'presentation' || p.baseline) continue;
    for (const c of catalogue.coverage) {
      if (!c.rows) continue;
      const channelTracks = catalogue.tracks.filter(t => t.channelSlug === c.slug);
      const hits = channelTracks.map(t => ({ track: t, label: t.labels.find(l => l.dimension === p.dimension && l.value === p.value) })).filter((x): x is { track: typeof x.track; label: NonNullable<typeof x.label> } => !!x.label);
      const labelledOnDim = channelTracks.filter(t => t.labels.some(l => l.dimension === p.dimension)).length;
      const share = labelledOnDim ? hits.length / labelledOnDim : 0;
      if (hits.length < FLOOR.tracks || share < FLOOR.channelShare) continue;
      const inferredOnly = hits.every(h => h.label.provenance === 'inferred');
      out.push({
        patternId: p.id, channelSlug: c.slug, channelName: c.name,
        tracks: hits.sort((a, b) => (b.track.views ?? -1) - (a.track.views ?? -1)).slice(0, 8),
        channelShare: share, channelLabelled: labelledOnDim, channelTotal: channelTracks.length,
        hypothesis: `${p.value} ${p.dimension} recurs among ${p.territory} ${measureName(p.measure)} entries (${p.entities} songs/videos, ${p.artists} artists). ${c.name} already carries it on ${hits.length} of its ${labelledOnDim} ${p.dimension}-labelled uploads (${Math.round(share * 100)}%). If the demand pattern holds, those uploads are candidates to feature or programme around — a hypothesis to test, not evidence they will chart.`,
        caveats: [
          'Contextual: no recording, composition or artist connection to the charted entries.',
          inferredOnly ? `All ${p.dimension} labels on these uploads are inferred (title rules or the model-assigned artist map).` : `Some ${p.dimension} labels here are human or verified.`,
          `Channel fit is read from the channel's own catalogue (${labelledOnDim} of ${channelTracks.length} uploads carry a ${p.dimension} label), not from its name.`,
          ...(c.complete === false ? [`${c.name}'s inventory is incomplete: ${c.note ?? 'coverage partial'}`] : []),
        ],
      });
    }
  }
  /* Genre connections first (a programming hypothesis), then by how many entities the pattern has, then channel share. */
  const strength = (c: ContextualMatch) => { const p = patterns.find(x => x.id === c.patternId)!; return (p.dimension === 'genre' ? 1000 : 0) + p.entities; };
  return out.sort((a, b) => strength(b) - strength(a) || b.channelShare - a.channelShare);
}

export function measureName(m: Pattern['measure']) {
  return ({ 'song-views-weekly': 'Top Songs', 'music-video-views-weekly': 'Top Music Videos', 'music-video-views-daily': 'Top Music Videos (daily)', 'shorts-creations-weekly': 'Top Songs on Shorts', 'shorts-creations-daily': 'Top Songs on Shorts (daily)', 'artist-views-weekly': 'Top Artists', 'trending-new-releases': 'Trending' } as Record<string, string>)[m] ?? m;
}
