/**
 * BEST-PRACTICE PRINCIPLES
 *
 * Not a prompt. The temptation here is to write two thousand words of
 * YouTube advice, paste it into the system prompt, and let the model
 * recite it. That produces "artists should use multiple formats", which is
 * not intelligence — it is a slide from 2019.
 *
 * The unit of value is the RESEARCH QUESTION. A principle earns its place
 * by generating a question the investigator can go and answer against real
 * channels:
 *
 *   PRINCIPLE → RESEARCH QUESTION → OBSERVED BEHAVIOUR → CASE STUDY
 *
 * ── ON STATUS ─────────────────────────────────────────────────────────
 * Everything below starts at PROPOSED or WATCHING, with one exception.
 * Nothing here is VALIDATED, because validating a principle requires a
 * study we have not run. A principle does not become true because it
 * appeared in a deck we wrote. The seeds are drawn only from work where we
 * have the underlying data, and the source field says which.
 */

import { Redis } from '@upstash/redis';
import type { BestPracticePrinciple, PrincipleStatus } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K = 'knowledge:principles';

/**
 * Seven seeds. Small on purpose — the brief says start conservatively, and
 * an over-stuffed principle library makes the investigator reach for the
 * nearest cliché rather than look at the channel.
 */
export const SEED_PRINCIPLES: BestPracticePrinciple[] = [
  {
    id: 'p_followup_window',
    title: 'The days after a hero release are the cheapest attention a channel gets',
    description:
      'A hero release lifts a channel’s surfacing for a period afterwards. Publishing supporting long-form inside that window costs nothing extra in promotion and reaches an audience already pointed at the artist.',
    source: 'Virgin follow-through analysis across 138 Watcher channels',
    applicability:
      'Channels with an identifiable hero asset. The window is measured in our system as days 7–14 after the hero; that boundary is our own convention, not a YouTube-published figure.',
    researchQuestions: [
      'Which artists published long-form inside 7–14 days of their hero, and how did those assets perform against the artist’s own age-matched baseline?',
      'Are there artists who consistently leave the window empty despite having assets available?',
    ],
    status: 'WATCHING',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_secondary_formats',
    title: 'Secondary formats can extend a hero release rather than compete with it',
    description:
      'Lyric videos, visualisers and live sessions give a song more than one entry point without requiring a second song.',
    source: 'Recurring pattern across Virgin deep dives (IDLES, CHVRCHES, Kings of Leon)',
    applicability:
      'Artists with at least one hero asset and a catalogue deep enough to support variants. Weakest for artists whose audience arrives through Shorts.',
    researchQuestions: [
      'Which artists sequence supporting assets around an OMV most effectively, measured against their own baseline?',
      'Is there an artist whose secondary formats consistently outperform their heroes? What is different about them?',
    ],
    status: 'WATCHING',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_gaps_are_decisions',
    title: 'The gap between releases is a programming decision, not empty time',
    description:
      'What a channel publishes between heroes shapes whether the next hero opens to a warm or a cold audience.',
    source: 'Gap studies in the Coach research tooling',
    applicability:
      'Any channel with two or more heroes in the observed window. Not applicable to catalogue-only channels.',
    researchQuestions: [
      'Which artists fill their inter-release gaps deliberately, and does the asset immediately after a well-filled gap open stronger than one after an empty gap?',
      'Where a gap is empty, was there an available format the artist has previously been strong in?',
    ],
    status: 'PROPOSED',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_strength_not_exploited',
    title: 'Artists frequently under-use the format they are demonstrably best at',
    description:
      'A format that historically outperforms an artist’s baseline is often absent from their most compressed campaign, when attention is highest.',
    source: 'Amyl and The Sniffers catalogue reconstruction, 2024 hero sequence',
    applicability:
      'Requires enough catalogue history to establish a per-format baseline for that artist. Cross-artist format comparison is not valid — see the age confound.',
    researchQuestions: [
      'For this artist, which format has the highest median performance against their own age-matched baseline, and when did they last use it?',
      'Did their most compressed release sequence include or exclude that format?',
    ],
    status: 'WATCHING',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_shorts_are_not_a_funnel_claim',
    title: 'Shorts activity can be described, but Shorts-to-long-form conversion cannot',
    description:
      'We can count Shorts, date them and measure their views. We cannot observe whether a Shorts viewer went on to watch long-form — that requires Studio data we do not have.',
    source: 'Standing evidence discipline in this system',
    applicability:
      'Universal. This principle exists to stop a claim being made, which is as useful as one that licenses a claim.',
    researchQuestions: [
      'Where a finding asserts a Shorts funnel effect, what is the observable statement that could replace it?',
    ],
    status: 'VALIDATED',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_cadence_over_volume',
    title: 'Sustained cadence appears to matter more than upload volume in bursts',
    description:
      'Channels that publish steadily hold attention better than channels that publish the same number of assets in concentrated bursts.',
    source: 'Watcher benchmark analysis across 138 channels',
    applicability:
      'Observed at channel level across the tracked pool. Not established causally, and confounded by the fact that active campaigns produce both cadence and promotion.',
    researchQuestions: [
      'Among artists whose cadence changed materially, what happened to their view trajectory in the following 30 days?',
      'Is there a counter-example — an artist who performs well on burst publishing?',
    ],
    status: 'PROPOSED',
    lastReviewed: '2026-09-09',
  },
  {
    id: 'p_catalogue_is_an_asset',
    title: 'A dormant catalogue can carry a channel between campaigns',
    description:
      'Back-catalogue assets continue to accumulate views long after release, and for some artists represent the majority of channel activity between campaigns.',
    source: 'CHVRCHES dormancy analysis',
    applicability:
      'Artists with a catalogue older than 18 months. All catalogue view figures are lifetime totals — never divide by age.',
    researchQuestions: [
      'Which artists derive most of their between-campaign activity from catalogue rather than new uploads?',
      'Is there a catalogue asset outperforming recent releases that has never been given support?',
    ],
    status: 'PROPOSED',
    lastReviewed: '2026-09-09',
  },
];

export async function listPrinciples(): Promise<BestPracticePrinciple[]> {
  const store = await kv();
  if (!store) return SEED_PRINCIPLES;
  const raw = await store.get<BestPracticePrinciple[]>(K);
  return Array.isArray(raw) && raw.length ? raw : SEED_PRINCIPLES;
}

export async function savePrinciple(p: BestPracticePrinciple): Promise<BestPracticePrinciple> {
  const store = await kv();
  if (!store) return p;
  const all = await listPrinciples();
  await store.set(K, [...all.filter(x => x.id !== p.id), p]);
  return p;
}

export async function setPrincipleStatus(
  id: string, status: PrincipleStatus,
): Promise<BestPracticePrinciple | null> {
  const all = await listPrinciples();
  const hit = all.find(p => p.id === id);
  if (!hit) return null;
  return savePrinciple({ ...hit, status, lastReviewed: new Date().toISOString().slice(0, 10) });
}

/** Seed once. Idempotent — never overwrites edits. */
export async function ensureSeeded(): Promise<number> {
  const store = await kv();
  if (!store) return 0;
  const raw = await store.get<BestPracticePrinciple[]>(K);
  if (Array.isArray(raw) && raw.length) return raw.length;
  await store.set(K, SEED_PRINCIPLES);
  return SEED_PRINCIPLES.length;
}
