/**
 * DEEP DIVE STORE
 *
 * Two sources, one read path.
 *
 *   SEEDED   transcribed from a deck and committed to the repo. Reviewable
 *            in a pull request, which is what you want for the sentence a
 *            model will treat as our considered view of an artist.
 *   STORED   written at runtime to Redis. For updates that should not wait
 *            for a deploy.
 *
 * Redis wins when both exist, because the only reason to write one at
 * runtime is to correct the seed. The seed is never deleted by an override,
 * so a bad runtime write is recoverable by dropping one key.
 *
 * ── WHY NOT PARSE THE DECKS AT RUNTIME ────────────────────────────────
 * Tried it. The decks are hand-built HTML with the analysis in prose and
 * in JS object literals, and a parser over them is a parser over six
 * bespoke documents that will break the next time one is restyled. Worse,
 * anything it could not parse would silently become an absence, and an
 * absence in this layer reads as "the artist has no gaps".
 */

import { Redis } from '@upstash/redis';
import type { DeepDiveContext } from './types';
import { SEEDED_DEEP_DIVES } from './deepDives';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_DIVE = (slug: string) => `intel:deepdive:${slug}`;
const K_INDEX = 'intel:deepdive:index';

export interface DeepDiveSummary {
  artistSlug: string;
  artistName: string;
  title: string;
  deckUpdated: string;
  deckUrl: string | null;
  coreThesis: string;
  source: 'seeded' | 'stored';
  /** Every distinct need tag across gaps and opportunities. */
  needTags: string[];
  gapCount: number;
  opportunityCount: number;
}

function needTagsOf(d: DeepDiveContext): string[] {
  const all = [
    ...d.channelGaps, ...d.strategicOpportunities,
    ...d.recommendedContentDirections, ...d.recommendedCampaignArchitecture,
  ].flatMap(p => p.needTags);
  return Array.from(new Set(all));
}

export function summarise(d: DeepDiveContext, source: 'seeded' | 'stored'): DeepDiveSummary {
  return {
    artistSlug: d.artistSlug, artistName: d.artistName, title: d.title,
    deckUpdated: d.deckUpdated, deckUrl: d.deckUrl, coreThesis: d.coreThesis,
    source,
    needTags: needTagsOf(d),
    gapCount: d.channelGaps.length,
    opportunityCount: d.strategicOpportunities.length,
  };
}

export async function getDeepDive(slug: string): Promise<{ dive: DeepDiveContext | null; source: 'seeded' | 'stored' | null }> {
  const store = await kv();
  if (store) {
    try {
      const stored = await store.get<DeepDiveContext>(K_DIVE(slug));
      if (stored) return { dive: stored, source: 'stored' };
    } catch { /* fall through to the seed rather than failing the read */ }
  }
  const seed = SEEDED_DEEP_DIVES[slug];
  return seed ? { dive: seed, source: 'seeded' } : { dive: null, source: null };
}

export async function listDeepDives(): Promise<DeepDiveSummary[]> {
  const out = new Map<string, DeepDiveSummary>();
  for (const [slug, d] of Object.entries(SEEDED_DEEP_DIVES)) {
    out.set(slug, summarise(d, 'seeded'));
  }
  const store = await kv();
  if (store) {
    try {
      const slugs = await store.smembers<string[]>(K_INDEX);
      for (const slug of slugs ?? []) {
        const d = await store.get<DeepDiveContext>(K_DIVE(slug));
        if (d) out.set(slug, summarise(d, 'stored'));
      }
    } catch { /* seeds alone are a valid answer */ }
  }
  return Array.from(out.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
}

export async function saveDeepDive(d: DeepDiveContext): Promise<DeepDiveContext> {
  const store = await kv();
  if (!store) throw new Error('No Redis configured — cannot persist a Deep Dive.');
  await store.set(K_DIVE(d.artistSlug), d);
  await store.sadd(K_INDEX, d.artistSlug);
  return d;
}

/** Drops the runtime override so the committed seed takes over again. */
export async function clearStoredDeepDive(slug: string): Promise<boolean> {
  const store = await kv();
  if (!store) return false;
  await store.del(K_DIVE(slug));
  await store.srem(K_INDEX, slug);
  return true;
}
