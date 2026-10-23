/* ═══════════════════════════════════════════════════════════════════════
   STORAGE — ISOLATED NAMESPACE

   Everything this sandbox writes lives under `labs:mo:v1:`. It reads the
   Owned Channels store (`owned:preview:v1:`) but never writes to it, and
   it never touches `live:`, `cat:`, `sync:` or the cron.

   Observations are keyed by source, measure and territory, and a chart
   period replaces an earlier reading of the same period, so refreshing
   twice never duplicates a record. The Data API "most popular" list has
   no chart period of its own, so its period is the collection date.
   ═══════════════════════════════════════════════════════════════════════ */

import { Redis } from '@upstash/redis';
import type { CatalogueTrack, ChartObservation, Decision } from './types';

export function labsStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const NS = 'labs:mo:v1';
export const KEYS = {
  obs: (source: string, measure: string, territory: string) => `${NS}:obs:${source}:${measure}:${territory}`,
  obsIndex: `${NS}:obs:index`,
  uploadsMeta: (channelId: string) => `${NS}:uploads:${channelId}:meta`,
  uploadsChunk: (channelId: string, n: number) => `${NS}:uploads:${channelId}:${n}`,
  sourceCatalogue: `${NS}:catalogue:source`,
  decisions: `${NS}:decisions`,
  lock: (name: string) => `${NS}:lock:${name}`,
};

/** Readings kept per (source, measure, territory). Twelve weekly readings is a quarter. */
export const KEEP_OBSERVATIONS = 12;
/** 60 days: long enough to compare, short enough that an abandoned experiment expires on its own. */
const TTL = 60 * 86400;

export type ObsIndexEntry = { key: string; source: string; measure: string; territory: string; latestPeriod: string; collectedAt: string; count: number };

export async function readObservationIndex(): Promise<ObsIndexEntry[]> {
  const store = labsStore();
  return store ? await store.get<ObsIndexEntry[]>(KEYS.obsIndex) ?? [] : [];
}

export async function readObservations(source: string, measure: string, territory: string): Promise<ChartObservation[]> {
  const store = labsStore();
  return store ? await store.get<ChartObservation[]>(KEYS.obs(source, measure, territory)) ?? [] : [];
}

export async function readAllObservations(): Promise<ChartObservation[]> {
  const index = await readObservationIndex();
  const lists = await Promise.all(index.map(e => readObservations(e.source, e.measure, e.territory)));
  return lists.flat();
}

/** Replace any reading of the same period; keep the newest periods only. Returns whether it replaced one. */
export async function saveObservation(obs: ChartObservation): Promise<{ replaced: boolean }> {
  const store = labsStore();
  if (!store) throw new Error('Preview storage is not configured.');
  const key = KEYS.obs(obs.source, obs.measure, obs.territory);
  const existing = await store.get<ChartObservation[]>(key) ?? [];
  const replaced = existing.some(o => o.period === obs.period);
  const next = [...existing.filter(o => o.period !== obs.period), obs]
    .sort((a, b) => a.period.localeCompare(b.period)).slice(-KEEP_OBSERVATIONS);
  await store.set(key, next, { ex: TTL });
  const index = (await store.get<ObsIndexEntry[]>(KEYS.obsIndex) ?? []).filter(e => e.key !== key);
  index.push({ key, source: obs.source, measure: obs.measure, territory: obs.territory,
    latestPeriod: next.at(-1)!.period, collectedAt: obs.collectedAt, count: next.length });
  await store.set(KEYS.obsIndex, index, { ex: TTL });
  return { replaced };
}

/* ── Upload inventory ────────────────────────────────────────────────
   A compact title index of every public upload on an owned channel:
   id, title, published date. Chunked at 2,000 rows so a 6,500-upload
   channel never approaches a single-value size limit. Rebuilt
   incrementally: a refresh walks the uploads playlist newest-first and
   stops at the first id it already holds. */
export type UploadRow = { id: string; title: string; publishedAt: string };
export type UploadsMeta = {
  channelId: string; count: number; chunks: number; complete: boolean;
  /** YouTube's own public count at the time of the sweep. */
  videoCount: number | null;
  sweptAt: string; firstSweptAt: string; lastIncrementalAt: string | null;
};
export const UPLOAD_CHUNK = 2000;

export async function readUploadsMeta(channelId: string): Promise<UploadsMeta | null> {
  const store = labsStore();
  return store ? await store.get<UploadsMeta>(KEYS.uploadsMeta(channelId)) : null;
}
export async function readUploads(channelId: string): Promise<{ meta: UploadsMeta | null; rows: UploadRow[] }> {
  const store = labsStore();
  if (!store) return { meta: null, rows: [] };
  const meta = await store.get<UploadsMeta>(KEYS.uploadsMeta(channelId));
  if (!meta) return { meta: null, rows: [] };
  const chunks = await Promise.all(Array.from({ length: meta.chunks }, (_, n) => store.get<UploadRow[]>(KEYS.uploadsChunk(channelId, n))));
  return { meta, rows: chunks.flatMap(c => c ?? []) };
}
export async function writeUploads(channelId: string, rows: UploadRow[], meta: Omit<UploadsMeta, 'count' | 'chunks'>) {
  const store = labsStore();
  if (!store) throw new Error('Preview storage is not configured.');
  const chunks = Math.max(1, Math.ceil(rows.length / UPLOAD_CHUNK));
  for (let n = 0; n < chunks; n++)
    await store.set(KEYS.uploadsChunk(channelId, n), rows.slice(n * UPLOAD_CHUNK, (n + 1) * UPLOAD_CHUNK), { ex: TTL });
  await store.set(KEYS.uploadsMeta(channelId), { ...meta, count: rows.length, chunks } satisfies UploadsMeta, { ex: TTL });
}

/* ── Source catalogue (imported) ─────────────────────────────────── */
export type SourceCatalogue = { importedAt: string; note: string; rows: CatalogueTrack[] };
export const SOURCE_CATALOGUE_CAP = 5000;
export async function readSourceCatalogue(): Promise<SourceCatalogue | null> {
  const store = labsStore();
  return store ? await store.get<SourceCatalogue>(KEYS.sourceCatalogue) : null;
}
export async function writeSourceCatalogue(cat: SourceCatalogue) {
  const store = labsStore();
  if (!store) throw new Error('Preview storage is not configured.');
  await store.set(KEYS.sourceCatalogue, { ...cat, rows: cat.rows.slice(0, SOURCE_CATALOGUE_CAP) }, { ex: TTL });
}

/* ── Decisions (learning history) ─────────────────────────────────── */
export const KEEP_DECISIONS = 200;
export async function readDecisions(): Promise<Decision[]> {
  const store = labsStore();
  return store ? await store.get<Decision[]>(KEYS.decisions) ?? [] : [];
}
export async function writeDecisions(list: Decision[]) {
  const store = labsStore();
  if (!store) throw new Error('Preview storage is not configured.');
  await store.set(KEYS.decisions, list.slice(-KEEP_DECISIONS), { ex: 365 * 86400 });
}

/** One-shot lock so two refreshes of the same thing cannot overlap. */
export async function withLock<T>(name: string, seconds: number, fn: () => Promise<T>): Promise<T> {
  const store = labsStore();
  if (!store) throw new Error('Preview storage is not configured.');
  const key = KEYS.lock(name);
  const acquired = await store.set(key, '1', { nx: true, ex: seconds });
  if (!acquired) throw new Error('Already refreshing. Try again in a minute.');
  try { return await fn(); } finally { await store.del(key); }
}
