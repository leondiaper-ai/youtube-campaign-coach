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

const KEY = (channelId: string) => `cm:artist:${channelId}`;

/* ═══════════════════════════════════════════════════════════════════
   MANUAL MAPPINGS

   Chartmetric's /get-ids resolves a YouTube channel to an artist, and
   for most of the roster that is enough. It is not exhaustive: an
   artist can exist in Chartmetric while that lookup returns nothing
   for their channel, usually because the channel is not linked on
   their Chartmetric profile. The artist is then invisible to us for
   no reason a reader could ever guess.

   These are the ones a human has confirmed by opening the Chartmetric
   profile and reading the id out of the URL
   (app.chartmetric.com/artist/<id>). They take priority over the
   lookup and over any cached miss, so a wrong negative cannot outlive
   the correction — which is the failure mode this file already has a
   long comment about.

   Adding one is deliberate: confirm the profile is the right artist
   first, because a bad id here is worse than no id. It fails loudly in
   one direction only — the artist name comes back from Chartmetric on
   the territories call, so a mismatch is visible rather than silent.
   ═══════════════════════════════════════════════════════════════════ */
const MANUAL_CM_ARTISTS: Record<string, { id: number; name: string }> = {
  /* TEN (@tenoffcl). /get-ids returns nothing for this channel; the
     profile is real and confirmed at app.chartmetric.com/artist/558680. */
  UC1a1QawKLefYNAjpT0ELNrQ: { id: 558680, name: 'TEN' },
};

/**
 * A SUCCESSFUL mapping is cached forever — a channel's Chartmetric
 * artist does not change.
 *
 * A MISS is cached for 24 hours only. This matters more than it looks.
 * A negative cached forever is indistinguishable from a fact, and it
 * silently outlives whatever caused it: a transient 404, a bad
 * response shape, an artist Chartmetric had not indexed yet. K-Trap
 * sat in exactly that state — /get-ids returns his artist id perfectly
 * well, but one early miss had been written as permanent, so every
 * later run read the stored null and never asked again. The artist
 * looked absent from Chartmetric when he was not.
 *
 * Twenty-four hours is a deliberate compromise: long enough that a
 * genuinely unknown channel costs one lookup a day rather than one per
 * request, short enough that a wrong negative heals itself.
 */
const MISS_TTL_SECONDS = 24 * 60 * 60;

export type CmArtistMapping = {
  channelId: string;
  cmArtistId: number | null;
  /** Chartmetric's name for this artist — a human check on the match. */
  cmArtistName: string | null;
  resolvedBy: 'youtube-channel-id' | 'manual';
  resolvedAt: string;
  /** True when Chartmetric simply has no artist for this channel. */
  notFound?: boolean;
  /**
   * Present only when /get-ids returned more than one distinct artist
   * for this channel, ordered by how many rows each owns. The winner is
   * the first entry. Recorded so a contested match is visible rather
   * than silent — the Bleachers mapping was wrong for exactly as long
   * as nobody could see that a choice had been made.
   */
  ambiguous?: { cmArtistId: number; name: string | null; rows: number }[];
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

  /* Checked before the cache as well as before the lookup: the point of
     a manual mapping is to override a stored miss, and a miss is exactly
     what sent us looking for the id by hand. */
  const manual = MANUAL_CM_ARTISTS[channelId];
  if (manual) {
    return {
      channelId,
      cmArtistId: manual.id,
      cmArtistName: manual.name,
      resolvedBy: 'manual',
      resolvedAt: new Date().toISOString(),
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
      // A miss expires. See MISS_TTL_SECONDS.
      if (store) await store.set(KEY(channelId), miss, { ex: MISS_TTL_SECONDS });
      return miss;
    }
    return null;
  }

  const raw = res.data?.obj;
  const rows: GetIdsRow[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  /* ── PICKING THE ARTIST WHEN THE CHANNEL RESOLVES TO SEVERAL ────────
     This used to be `rows.find(r => r.youtube_channel_id === channelId)
     ?? rows[0]`, which looks like a precision filter and is not one.
     Every row returned by /get-ids already carries the channel we asked
     about — that is the query — so the find always matched row zero and
     the code was "take the first result and hoping", the exact thing
     the header comment on this file warns against.

     It bit on Bleachers. The channel returns 84 rows: one for an
     Australian indie-folk act called "BLEACHER" (cm 10799742), and 83
     for the actual band (cm 4835). Row zero was the Australian one, so
     every Chartmetric figure we held for Bleachers belonged to someone
     else — which is why their territory call kept coming back with
     artistTotalViews: 0 and no countries.

     Chartmetric returns one row per release, so the artist who owns
     most of the channel's releases is the artist. Counting is therefore
     not a heuristic, it is the structure of the response. A single
     stray row cannot outvote a discography.

     `ambiguous` is recorded when more than one distinct artist comes
     back, so a human can see that a choice was made rather than
     discovering it the way we discovered this one. */
  const tally = new Map<number, { n: number; name: string | null }>();
  for (const r of rows) {
    const id = toInt(r.cm_artist ?? r.chartmetric_id);
    if (!id) continue;
    const seen = tally.get(id);
    if (seen) seen.n += 1;
    else tally.set(id, { n: 1, name: r.artist_name ?? null });
  }
  /* Array.from rather than spread: this project's tsconfig target does
     not allow iterating a Map without downlevelIteration. */
  const ranked = Array.from(tally.entries()).sort((a, b) => b[1].n - a[1].n);
  const winner = ranked[0] ?? null;
  const cmArtistId = winner ? winner[0] : null;
  const exact = winner ? { artist_name: winner[1].name } : null;
  const ambiguous = ranked.length > 1
    ? ranked.map(([id, v]) => ({ cmArtistId: id, name: v.name, rows: v.n }))
    : undefined;

  const mapping: CmArtistMapping = {
    channelId,
    cmArtistId,
    cmArtistName: exact?.artist_name ?? null,
    resolvedBy: 'youtube-channel-id',
    resolvedAt: new Date().toISOString(),
    ...(ambiguous ? { ambiguous } : {}),
    ...(cmArtistId ? {} : { notFound: true }),
  };

  /* A real id is permanent; a null is a question we should ask again. */
  if (store) {
    if (mapping.cmArtistId) await store.set(KEY(channelId), mapping);
    else await store.set(KEY(channelId), mapping, { ex: MISS_TTL_SECONDS });
  }
  return mapping;
}
