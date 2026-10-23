import { Redis } from '@upstash/redis';
import type { OwnedSnapshot } from './metrics';

export function ownedStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}
const key = (id: string) => `owned:preview:v1:${id}`;
export async function readOwnedHistory(id: string): Promise<OwnedSnapshot[]> {
  const store = ownedStore();
  return store ? await store.get<OwnedSnapshot[]>(key(id)) ?? [] : [];
}
/* Only the newest reading keeps its uploads. This key holds a month of
   daily readings in a single value, so carrying a full library in each
   one multiplies the payload by thirty — fine at a 300-upload cap, not
   fine once the cap is lifted and a library runs to thousands. A reading
   that is no longer the newest is only ever read for its channel totals
   (the growth curve) and for a previous per-upload view count (seven-day
   gains), so it keeps the totals and a compact id→views map instead. */
function supersede(snapshot: OwnedSnapshot): OwnedSnapshot {
  if (!snapshot.items.length) return snapshot;
  const viewsById = snapshot.viewsById ?? {};
  for (const video of snapshot.items) if (video.views != null) viewsById[video.id] = video.views;
  return { ...snapshot, items: [], viewsById };
}

export async function saveOwnedSnapshot(snap: OwnedSnapshot) {
  const store = ownedStore();
  if (!store) throw new Error('Preview storage is not configured.');
  const history = await readOwnedHistory(snap.channelId);
  const day = snap.collectedAt.slice(0, 10);
  const cutoff = Date.parse(snap.collectedAt) - 29 * 86400000;
  const next = history.filter(s => Date.parse(s.collectedAt) >= cutoff && s.collectedAt.slice(0, 10) !== day)
    .map(supersede);
  next.push(snap);
  // Separate preview namespace; never touches artist rosters, caches or cron.
  await store.set(key(snap.channelId), next, { ex: 30 * 86400 });
}
