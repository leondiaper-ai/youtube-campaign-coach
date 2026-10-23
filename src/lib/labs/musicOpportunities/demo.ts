/* ═══════════════════════════════════════════════════════════════════════
   DEMONSTRATION — AN INVENTED SIGNAL AGAINST A REAL UPLOAD

   The chart entry below is NOT a live finding. It exists to show what
   the matcher does with a known owned upload (the Folk and Nature
   upload of "What a Friend We Have in Jesus – Dolly Parton",
   hSkegNLcf8A). The upload, its stored reading and the match are real;
   the chart position is made up and is labelled as such everywhere it
   is shown. It is never saved, never counted and never mixed with
   stored observations.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CatalogueLayer } from './catalogue';
import { buildOpportunities } from './opportunities';
import type { ChartObservation, Opportunity } from './types';

export const DEMO_VIDEO_ID = 'hSkegNLcf8A';

export function demoObservation(): ChartObservation {
  return {
    id: 'demonstration|song-views-weekly|GB|0000-00-00',
    source: 'manual-import', measure: 'song-views-weekly', territory: 'GB', period: '0000-00-00',
    periodLabel: 'DEMONSTRATION · invented chart entry · not a live finding', sourceUrl: 'https://charts.youtube.com/',
    collectedAt: new Date(0).toISOString(), note: 'Invented chart entry for demonstration. Not a real reading.',
    entries: [{ rank: 42, previousRank: null, isNew: true, periodsOnChart: 1, title: 'What a Friend We Have in Jesus', artists: ['Dolly Parton'],
      isrc: null, videoId: null, channelId: null, channelTitle: null, measureValue: null }],
  };
}

export function demoOpportunity(catalogue: CatalogueLayer): Opportunity | null {
  const [o] = buildOpportunities([demoObservation()], catalogue);
  return o ?? null;
}
