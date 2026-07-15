/**
 * Drive Store — persistent storage for scanned Drive asset libraries.
 *
 * Mirrors the KV pattern in planStore.ts. One library per campaign slug.
 *
 * KV key pattern:
 *   drive:{slug}  → AssetLibrary
 */

import type { AssetLibrary } from './driveAssets';
import { getSeedLibrary } from './campaignConfig';

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

const driveKey = (slug: string) => `drive:${slug}`;

export async function saveDriveLibrary(lib: AssetLibrary): Promise<AssetLibrary> {
  const store = await kv();
  if (!store) return lib;
  await store.set(driveKey(lib.slug), lib);
  return lib;
}

export async function loadDriveLibrary(slug: string): Promise<AssetLibrary | null> {
  const store = await kv();
  const fromKv = store ? ((await store.get(driveKey(slug))) as AssetLibrary | null) : null;
  // Fall back to a baked-in seed when KV has nothing for this campaign yet.
  return fromKv ?? getSeedLibrary(slug);
}

export async function deleteDriveLibrary(slug: string): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.del(driveKey(slug));
}
