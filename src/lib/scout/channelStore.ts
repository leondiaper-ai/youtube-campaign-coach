/**
 * THE SCOUT UNIVERSE
 *
 * Kept strictly apart from the Watcher roster and from Market Watch. A
 * discovered channel is not an artist we manage and must never appear as
 * one — not in Channel Health, not in the roster, not in any figure that
 * describes our own performance.
 *
 * ── ON OBSERVATION HISTORY ───────────────────────────────────────────
 * `observationCount` and `lastObservedAt` exist so that Scout can one day
 * say "we have been watching this channel for three months" rather than
 * "Grok searched for it today". That sentence only becomes true by
 * actually observing repeatedly over months.
 *
 * There is deliberately no backfill. The history of a Scout channel begins
 * the first time Scout looks at it, and any attempt to synthesise earlier
 * observations from lifetime totals would be fabrication.
 */

import { Redis } from '@upstash/redis';
import { ARTISTS, mergeArtistLists } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readAllLiveSnaps } from '../kvCache';
import type { ScoutChannel, ScoutStatus, ChannelProfile } from './types';
import type { MissionId } from './missions';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_CHANNEL = (id: string) => `scout:channel:${id}`;
const K_INDEX = 'scout:index';
const K_ROSTER_IDS = 'scout:rosterids';

const MAX_INDEX = 5_000;

/* ── Roster exclusion ────────────────────────────────────────────────── */

/**
 * The roster is keyed by handle and slug; search returns channelIds. There
 * is no reverse index anywhere, so we build one from the cached snapshots
 * — which already hold `channelId` per handle — and keep it for a day.
 *
 * Getting this wrong in the permissive direction is the expensive error:
 * Scout would "discover" one of our own artists and present it as an
 * outside find.
 */
export async function rosterChannelIds(): Promise<Set<string>> {
  const store = await kv();
  if (store) {
    const cached = await store.get<string[]>(K_ROSTER_IDS);
    if (Array.isArray(cached) && cached.length) return new Set(cached);
  }

  const artists = mergeArtistLists(ARTISTS, await listCustomArtists());
  const handles = artists.map(a => a.channelHandle).filter((h): h is string => !!h);
  const snaps = await readAllLiveSnaps(handles);

  const ids = new Set<string>();
  snaps.forEach(s => { if (s?.channelId) ids.add(s.channelId); });

  if (store && ids.size) {
    await store.set(K_ROSTER_IDS, Array.from(ids), { ex: 60 * 60 * 24 });
  }
  return ids;
}

/* ── Read / write ────────────────────────────────────────────────────── */

export async function getScoutChannel(channelId: string): Promise<ScoutChannel | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<ScoutChannel>(K_CHANNEL(channelId))) ?? null;
}

export async function listScoutChannelIds(): Promise<string[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<string[]>(K_INDEX);
  return Array.isArray(raw) ? raw : [];
}

export async function listScoutChannels(limit = 200): Promise<ScoutChannel[]> {
  const store = await kv();
  if (!store) return [];
  const ids = (await listScoutChannelIds()).slice(0, limit);
  const out: ScoutChannel[] = [];
  /* Chunked to stay inside Upstash's request ceiling, as kvCache does. */
  for (let i = 0; i < ids.length; i += 5) {
    const batch = ids.slice(i, i + 5);
    const rows = await Promise.all(batch.map(id => store.get<ScoutChannel>(K_CHANNEL(id))));
    for (const r of rows) if (r) out.push(r);
  }
  return out;
}

export async function saveScoutChannel(c: ScoutChannel): Promise<ScoutChannel> {
  const store = await kv();
  if (!store) return c;
  await store.set(K_CHANNEL(c.channelId), c);
  const ids = await listScoutChannelIds();
  if (!ids.includes(c.channelId)) {
    await store.set(K_INDEX, [c.channelId, ...ids].slice(0, MAX_INDEX));
  }
  return c;
}

/**
 * Records an observation. Merges rather than replaces, because a channel
 * discovered by two missions belongs to both, and because the count is the
 * whole point — it is what eventually earns the phrase "we have been
 * watching this for three months".
 */
export async function recordObservation(args: {
  channelId: string;
  title: string;
  handle: string | null;
  country: string | null;
  missionId: MissionId;
  discoverySource: string;
  whyWatching: string;
  score?: number;
  profile: ChannelProfile | null;
  status?: ScoutStatus;
}): Promise<ScoutChannel> {
  const now = new Date().toISOString();
  const existing = await getScoutChannel(args.channelId);

  const merged: ScoutChannel = {
    channelId: args.channelId,
    title: args.title,
    handle: args.handle,
    country: args.country,
    discoveredAt: existing?.discoveredAt ?? now,
    discoverySource: existing?.discoverySource ?? args.discoverySource,
    missionIds: Array.from(new Set([...(existing?.missionIds ?? []), args.missionId])),
    whyWatching: args.whyWatching || existing?.whyWatching || '',
    score: args.score ?? existing?.score ?? 0,
    /* A status set by a human or by an investigation outranks the
       qualifier's default — never demote an INTERESTING channel back to
       CANDIDATE because a later run happened to re-qualify it. */
    status: args.status ?? existing?.status ?? 'CANDIDATE',
    lastObservedAt: now,
    observationCount: (existing?.observationCount ?? 0) + 1,
    latestProfile: args.profile ?? existing?.latestProfile ?? null,
  };

  return saveScoutChannel(merged);
}

export async function setScoutStatus(
  channelId: string, status: ScoutStatus,
): Promise<ScoutChannel | null> {
  const c = await getScoutChannel(channelId);
  if (!c) return null;
  return saveScoutChannel({ ...c, status });
}

/**
 * Observation cadence, for when broad polling is switched on — which it is
 * not yet.
 *
 * The arithmetic, so the decision is made with numbers rather than
 * enthusiasm: one observation costs about 5 units (1 channels.list
 * amortised across a batch of 50, plus 2 playlist pages and 2 video
 * batches for 100 uploads). Scout's daily budget is 5,000 units and
 * discovery searches eat 100 each.
 *
 * At 5 units per channel per observation:
 *   weekly observation of 200 channels   ≈ 143 units/day
 *   weekly observation of 1,000 channels ≈ 714 units/day
 *   daily observation of 1,000 channels  ≈ 5,000 units/day — the whole budget
 *
 * So weekly is affordable into the low thousands of channels and daily is
 * not. Weekly is also the right cadence on the merits: campaign
 * architecture moves in weeks, and a daily reading of a lifetime view
 * count tells you nothing a weekly one does not.
 */
export const OBSERVATION = {
  unitsPerObservation: 5,
  /** Recommended interval by status. Not yet enforced anywhere. */
  intervalDays: {
    CANDIDATE: 30,
    WATCHING: 7,
    INTERESTING: 7,
    BEST_IN_CLASS: 7,
    CASE_STUDY: 14,
    REJECTED: 0,
    STALE: 90,
  } as Record<ScoutStatus, number>,
} as const;

export function estimateObservationQuota(channels: { status: ScoutStatus }[]): {
  dailyUnits: number; affordable: boolean;
} {
  let daily = 0;
  for (const c of channels) {
    const days = OBSERVATION.intervalDays[c.status];
    if (!days) continue;
    daily += OBSERVATION.unitsPerObservation / days;
  }
  return { dailyUnits: Math.ceil(daily), affordable: daily < 2_000 };
}
