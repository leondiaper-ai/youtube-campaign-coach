/**
 * DURABLE HUMAN CAMPAIGN CONTEXT
 *
 * The things that change advice and that no API will ever tell us: the band
 * cannot shoot until March, there is a documentary already filmed, YouTube
 * have asked for a Stations pilot, the team have decided not to run a
 * Premiere this time.
 *
 * ── WHY THIS IS NOT THE CAMPAIGN HORIZON ──────────────────────────────
 * The horizon (coach-bot/horizon.ts) holds dated events, and most of what
 * matters here has no date. "Not available until March" governs every
 * recommendation until someone changes it, and it is not an event. Filing
 * it as one would either require a fake date or be dropped for lacking one.
 *
 * ── WHY THIS IS NOT CAMPAIGN MEMORY ───────────────────────────────────
 * coach-service/memory holds what the SYSTEM concluded during a
 * conversation, subject to a human verdict. This holds what a PERSON
 * asserted as fact about the world. The provenance is opposite, and merging
 * them would put a model's interpretation and a manager's statement in the
 * same bucket with the same weight.
 *
 * ── EVERY ITEM EXPIRES ────────────────────────────────────────────────
 * A stale plan read as current is the most dangerous object in this system,
 * because it is indistinguishable from knowledge. So `reviewBy` is
 * mandatory and defaulted, and a lapsed item comes back marked STALE rather
 * than being withheld — "we knew this in March and nobody has confirmed it
 * since" is information; silence is not.
 */

import { Redis } from '@upstash/redis';
import type { HumanContextItem, HumanContextKind, NeedTag } from './types';
import { partitionTags, HUMAN_CONTEXT_KINDS } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_ITEMS = (slug: string) => `intel:human:${slug}`;
const K_INDEX = 'intel:human:index';

/** Default shelf life by kind. Availability goes stale faster than a decision. */
const DEFAULT_REVIEW_DAYS: Record<HumanContextKind, number> = {
  LIKELY_ASSET: 60,
  TEAM_INTENTION: 60,
  RELEASE_PLAN: 45,
  ARTIST_AVAILABILITY: 30,
  ALREADY_FILMING: 90,
  PARTNER_ASK: 90,
  CONSTRAINT: 90,
  DECISION_MADE: 180,
};

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function newContextId(): string {
  return `hc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export interface HumanContextView extends HumanContextItem {
  freshness: 'CURRENT' | 'STALE';
  daysUntilReview: number;
}

function view(i: HumanContextItem): HumanContextView {
  const days = Math.round((new Date(i.reviewBy + 'T00:00:00Z').getTime() - Date.now()) / 86_400_000);
  return { ...i, freshness: days < 0 ? 'STALE' : 'CURRENT', daysUntilReview: days };
}

export async function listHumanContext(slug: string): Promise<HumanContextItem[]> {
  const store = await kv();
  if (!store) return [];
  const items = await store.get<HumanContextItem[]>(K_ITEMS(slug));
  return items ?? [];
}

/** Everything, with freshness computed. Superseded items are excluded. */
export async function readHumanContext(slug: string): Promise<HumanContextView[]> {
  const items = await listHumanContext(slug);
  return items.filter(i => !i.supersededBy).map(view);
}

export async function addHumanContext(args: {
  artistSlug: string;
  kind: HumanContextKind;
  text: string;
  statedBy: string;
  needTags?: string[];
  reviewBy?: string;
  /** Set when this replaces an earlier item. The old one is kept, marked. */
  supersedes?: string | null;
}): Promise<{ item: HumanContextItem; unknownTags: string[] }> {
  const store = await kv();
  if (!store) throw new Error('No Redis configured — cannot persist human context.');
  if (!HUMAN_CONTEXT_KINDS.includes(args.kind)) {
    throw new Error(`Unknown kind "${args.kind}". One of: ${HUMAN_CONTEXT_KINDS.join(', ')}`);
  }
  if (!args.text?.trim()) throw new Error('text is required.');
  if (!args.statedBy?.trim()) throw new Error('statedBy is required — an unattributed assertion is not human context.');

  const { valid, unknown } = partitionTags(args.needTags ?? []);
  const now = new Date().toISOString();
  const item: HumanContextItem = {
    id: newContextId(),
    artistSlug: args.artistSlug,
    kind: args.kind,
    text: args.text.trim(),
    needTags: valid as NeedTag[],
    statedBy: args.statedBy.trim(),
    statedAt: now.slice(0, 10),
    reviewBy: args.reviewBy ?? addDays(DEFAULT_REVIEW_DAYS[args.kind]),
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  };

  const existing = await listHumanContext(args.artistSlug);
  if (args.supersedes) {
    const prior = existing.find(i => i.id === args.supersedes);
    if (prior) { prior.supersededBy = item.id; prior.updatedAt = now; }
  }
  await store.set(K_ITEMS(args.artistSlug), [...existing, item]);
  await store.sadd(K_INDEX, args.artistSlug);
  return { item, unknownTags: unknown };
}

/** Pushes the review date out. Used when someone confirms an item still holds. */
export async function reaffirmHumanContext(
  slug: string, id: string, by: string,
): Promise<HumanContextItem | null> {
  const store = await kv();
  if (!store) return null;
  const items = await listHumanContext(slug);
  const found = items.find(i => i.id === id);
  if (!found) return null;
  const now = new Date().toISOString();
  found.reviewBy = addDays(DEFAULT_REVIEW_DAYS[found.kind]);
  found.statedBy = by;
  found.statedAt = now.slice(0, 10);
  found.updatedAt = now;
  await store.set(K_ITEMS(slug), items);
  return found;
}

export async function listHumanContextArtists(): Promise<string[]> {
  const store = await kv();
  if (!store) return [];
  return (await store.smembers<string[]>(K_INDEX)) ?? [];
}
