/* ═══════════════════════════════════════════════════════════════════
   CHARTMETRIC — ARTIST RESOLUTION

   The deterministic route, and the reason this integration is worth
   doing at all:

     GET /api/artist/youtube/{UC…channelId}/get-ids

   Chartmetric's own documentation for that endpoint says `youtube`
   expects the CHANNEL id, not their artist id. We already hold a UC…
   for every artist with a cron-written snapshot, so the mapping is
   one call, exact, and true forever. No name search, no taking the
   first result and hoping — which is how "Morad" became a Persian
   channel and "Twin S" became the Minnesota Twins in the UK Top 100
   work, and is not a mistake worth repeating with a second vendor.

   The mapping is cached in KV under cm:artist:{channelId} because a
   channel's Chartmetric artist does not change. The response carries
   artist_name, which we store alongside so a wrong mapping is visible
   to a human rather than silent.
   ═══════════════════════════════════════════════════════════════════ */

import { cmFetch } from './client';
import { cmOverrideFor } from './overrides';

const KEY = (channelId: string) => `cm:artist:${channelId}`;

export type CmArtistMapping = {
  channelId: string;
  cmArtistId: number | null;
  /** Chartmetric's name for this artist — a human check on the match. */
  cmArtistName: string | null;
  resolvedBy: 'youtube-channel-id' | 'manual-override';
  resolvedAt: string;
  /** True when Chartmetric simply has no artist for this channel. */
  notFound?: boolean;
  /** Set only on overrides, so the provenance travels with the row. */
  overrideVerifiedBy?: string;
  overrideVerifiedOn?: string;
};

async function kv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/** The shape /get-ids returns with aggregate=false. Every field nullable. */
type GetIdsRow = {
  cm_artist?: number | string | null;
  chartmetric_id?: number | string | null;
  artist_name?: string | null;
  youtube_channel_id?: string | null;
};
type GetIdsResponse = { obj?: GetIdsRow[] | GetIdsRow | null };

function toInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.trunc(n) : null;
}

/**
 * channelId → Chartmetric artist id. Cached in KV forever.
 * Returns a mapping with cmArtistId === null when Chartmetric has no
 * artist for the channel; that is a normal outcome, not a failure.
 */
export async function resolveCmArtist(
  channelId: string,
  opts: { refresh?: boolean } = {},
): Promise<CmArtistMapping | null> {
  if (!channelId || !/^UC[A-Za-z0-9_-]{10,}$/.test(channelId)) return null;

  /* A human-verified override beats both the cache and the endpoint.
     It sits ahead of the cache deliberately: the cached value is the
     null that the override exists to correct, so consulting the cache
     first would keep serving the miss. cmArtistName is left null so
     the next territory fetch fills it from Chartmetric — the name is
     the check on the id, and inventing it here would destroy that. */
  const override = cmOverrideFor(channelId);
  if (override) {
    return {
      channelId,
      cmArtistId: override.cmArtistId,
      cmArtistName: null,
      resolvedBy: 'manual-override',
      resolvedAt: new Date().toISOString(),
      overrideVerifiedBy: override.verifiedBy,
      overrideVerifiedOn: override.verifiedOn,
    };
  }

  const store = await kv();
  if (store && !opts.refresh) {
    const hit = (await store.get(KEY(channelId))) as CmArtistMapping | null;
    if (hit) return hit;
  }

  const res = await cmFetch<GetIdsResponse>(
    `/api/artist/youtube/${encodeURIComponent(channelId)}/get-ids`,
  );

  // A transport or auth failure is NOT cached — we want to try again.
  if (!res.ok) {
    if (res.status === 404) {
      const miss: CmArtistMapping = {
        channelId,
        cmArtistId: null,
        cmArtistName: null,
        resolvedBy: 'youtube-channel-id',
        resolvedAt: new Date().toISOString(),
        notFound: true,
      };
      if (store) await store.set(KEY(channelId), miss);
      return miss;
    }
    return null;
  }

  const raw = res.data?.obj;
  const rows: GetIdsRow[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  // Prefer the row whose youtube_channel_id is the one we asked about.
  const exact = rows.find((r) => r.youtube_channel_id === channelId) ?? rows[0] ?? null;
  const cmArtistId = exact ? toInt(exact.cm_artist ?? exact.chartmetric_id) : null;

  const mapping: CmArtistMapping = {
    channelId,
    cmArtistId,
    cmArtistName: exact?.artist_name ?? null,
    resolvedBy: 'youtube-channel-id',
    resolvedAt: new Date().toISOString(),
    ...(cmArtistId ? {} : { notFound: true }),
  };

  if (store) await store.set(KEY(channelId), mapping);
  return mapping;
}
