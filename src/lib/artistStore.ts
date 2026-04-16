import type { Artist } from './artists';

// ─────────────────────────────────────────────────────────────────────────────
// Custom artists store (KV-backed). Anyone can add a channel from the Cockpit
// via its handle / URL and it gets persisted to Upstash KV (if configured).
// No-ops gracefully when KV env vars are missing.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'artists:custom';

async function kv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function listCustomArtists(): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  return list;
}

export async function addCustomArtist(a: Artist): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [a];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  // De-dupe by slug
  const next = [...list.filter((x) => x.slug !== a.slug), { ...a, custom: true }];
  await store.set(KEY, next);
  return next;
}

export async function removeCustomArtist(slug: string): Promise<Artist[]> {
  const store = await kv();
  if (!store) return [];
  const list = ((await store.get(KEY)) as Artist[] | null) ?? [];
  const next = list.filter((x) => x.slug !== slug);
  await store.set(KEY, next);
  return next;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
