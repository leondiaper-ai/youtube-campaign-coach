/* ═══════════════════════════════════════════════════════════════════════
   THE FULL CATALOGUE, STORED

   ── WHY ───────────────────────────────────────────────────────────────
   "Best asset after the video" reads the cached upload window, which is
   ~100 recent uploads, inside a 365-day window, needing two uploads per
   format. For a heritage channel that is nothing.

   CHVRCHES is the case that forced this. 324M lifetime views, and the
   panel said "not enough support assets here yet to read this channel's
   own" — then fell back to roster norms ranking VISUALISER first and
   lyric video third. Their actual catalogue:

       lyric video   median 1,681,203   across 12
       visualiser    median   100,119   across  3
       live          median    88,145   across 12

   The fallback was not merely silent, it was backwards. And the answer
   had been sitting in the catalogue the whole time: CHVRCHES have not
   published a long-form support asset in three years, so no recent
   window could ever have found it.

   This is systemic rather than one channel. Across a sample the 365-day
   view returns nothing, one format, or n=2–3, while the catalogue holds
   n=5–45.

   ── WHAT THIS IS NOT ──────────────────────────────────────────────────
   NOT a replacement for the daily sync. Written under `cat:` only; the
   cron, `live:`, `chanmap:` and `sync:` are untouched. Collection is
   manual and batched.

   NOT an age correction. Views accumulate, so a format whose uploads are
   older has had longer to gather them — CHVRCHES' lyric videos have a
   median age of 6.5 years against 3.1 for the visualisers, so the 17x
   gap overstates the real difference. That bias is NOT corrected here
   because there is no per-video history reaching back far enough to
   correct it with. `medianAgeDays` travels with every row so the page
   can show it and a reader can discount accordingly.
   ═══════════════════════════════════════════════════════════════════════ */

import type { RecentUpload } from './artists';

export interface CatalogueVideo {
  id: string; title: string; publishedAt: string;
  durationSec: number; isShort: boolean;
  views: number; likes: number | null; comments: number | null;
  wasLive: boolean;
}

export interface ArtistCatalogue {
  slug: string;
  handle: string;
  channelId: string | null;
  /** True when the channel had more uploads than the fetch ceiling. */
  capped: boolean;
  retrieved: number;
  fetchedAt: string;
  oldest: string | null;
  newest: string | null;
  videos: CatalogueVideo[];
}

export interface CatalogueIndexEntry {
  slug: string; handle: string; retrieved: number; fetchedAt: string; capped: boolean;
}

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { const { Redis } = await import('@upstash/redis'); return new Redis({ url, token }); }
  catch { return null; }
}

const K = (slug: string) => `cat:${slug}`;
const INDEX = 'cat:index';

export async function writeCatalogue(c: ArtistCatalogue): Promise<boolean> {
  const store = await kv(); if (!store) return false;
  /* Never overwrite a good catalogue with an empty one. A failed fetch
     that returns zero videos would otherwise erase a channel's history
     and the page would silently fall back to roster norms again. */
  if (!c.videos.length) return false;
  await store.set(K(c.slug), JSON.stringify(c));
  const idx = await readCatalogueIndex();
  const next = idx.filter(e => e.slug !== c.slug);
  next.push({ slug: c.slug, handle: c.handle, retrieved: c.retrieved, fetchedAt: c.fetchedAt, capped: c.capped });
  await store.set(INDEX, JSON.stringify(next));
  return true;
}

export async function readCatalogue(slug: string): Promise<ArtistCatalogue | null> {
  const store = await kv(); if (!store) return null;
  const raw = await store.get(K(slug)).catch(() => null);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as ArtistCatalogue); }
  catch { return null; }
}

export async function readCatalogueIndex(): Promise<CatalogueIndexEntry[]> {
  const store = await kv(); if (!store) return [];
  const raw = await store.get(INDEX).catch(() => null);
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as CatalogueIndexEntry[]); }
  catch { return []; }
}

/**
 * Catalogue videos in the shape the rest of the app reads.
 *
 * `formatPerformance` and `commentDemand` both take `RecentUpload[]`, so
 * the catalogue is adapted rather than those being rewritten — one
 * conversion here instead of a new code path through every consumer.
 */
export function catalogueAsUploads(c: ArtistCatalogue): RecentUpload[] {
  return c.videos.map(v => ({
    id: v.id,
    title: v.title,
    description: '',
    publishedAt: v.publishedAt,
    durationSec: v.durationSec,
    live: v.wasLive ? 'none' : 'none',
    scheduledStart: null,
    actualStart: null,
    captions: false,
    viewCount: v.views,
    likeCount: v.likes ?? 0,
    commentCount: v.comments ?? 0,
  })) as unknown as RecentUpload[];
}
