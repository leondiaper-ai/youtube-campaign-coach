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
export async function saveOwnedSnapshot(snap: OwnedSnapshot) {
  const store = ownedStore();
  if (!store) throw new Error('Preview storage is not configured.');
  const history = await readOwnedHistory(snap.channelId);
  const day = snap.collectedAt.slice(0, 10);
  const cutoff = Date.parse(snap.collectedAt) - 29 * 86400000;
  const next = history.filter(s => Date.parse(s.collectedAt) >= cutoff && s.collectedAt.slice(0, 10) !== day);
  next.push(snap);
  // Separate preview namespace; never touches artist rosters, caches or cron.
  await store.set(key(snap.channelId), next, { ex: 30 * 86400 });
}
