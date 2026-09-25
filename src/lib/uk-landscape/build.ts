/* ═══════════════════════════════════════════════════════════════════
   UK LANDSCAPE — THE THREE RANKINGS

   Each view answers one question. They disagree with each other, and
   that disagreement is the product. There is no combined score here and
   there should never be one.

     UK CONSUMPTION     what VMG's own UK reporting says we consume.
                        Ranked exactly as reported. Collaborations
                        stay whole; nothing is merged.

     CROSSOVER          consumption > 0 AND a usable UK audience
                        figure. Both conditions, strictly. An artist
                        carried in the report with zero volume is not
                        a crossover story, which is why the filter
                        tests the value rather than the presence of a
                        row — the approved spreadsheet let Nickelback
                        through on presence alone.

     BIGGEST UK         the cleaned Virgin universe by UK monthly
                        views, whether or not the artist appears in
                        our consumption reporting. CHECK and EXCLUDE
                        never appear here.

   Channel figures are GLOBAL and are labelled as such everywhere they
   are rendered. Chartmetric UK is territory-specific. The two are not
   interchangeable and are never divided by one another.
   ═══════════════════════════════════════════════════════════════════ */

import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnapByHandle, readSyncMeta } from '@/lib/kvCache';
import { readLatestPeriod, readClassification } from './store';
import type { Landscape, LandscapeRow, ConsumptionPeriod } from './types';

type UkSnap = {
  slug: string;
  artistName: string;
  channelId: string;
  cmArtistName: string | null;
  subscribers: number | null;
  lifetimeViews: number | null;
  readingDate: string | null;
  uk: { inReturnedTerritories: boolean; monthlyViews: number | null; territoryRank: number | null } | null;
  error?: string;
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

/** Newest persisted Chartmetric UK snapshot per Watcher slug. */
async function readUkSnaps(channelIdBySlug: Map<string, string>): Promise<Map<string, UkSnap>> {
  const store = await kv();
  const out = new Map<string, UkSnap>();
  if (!store) return out;
  const entries = Array.from(channelIdBySlug.entries());
  const keys = entries.map(([, cid]) => `cm:uk:${cid}`);
  if (keys.length === 0) return out;
  // mget keeps this one round trip rather than one per artist.
  const vals = (await store.mget(...keys)) as (UkSnap | null)[];
  vals.forEach((v, i) => {
    if (v) out.set(entries[i][0], v);
  });
  return out;
}

const usable = (s: UkSnap | undefined): boolean =>
  !!s && !s.error && !!s.uk && s.uk.inReturnedTerritories && (s.uk.monthlyViews ?? 0) >= 1000;

export async function buildLandscape(): Promise<Landscape> {
  const [period, classification, custom, syncMeta] = await Promise.all([
    readLatestPeriod(),
    readClassification(),
    listCustomArtists(),
    readSyncMeta().catch(() => null),
  ]);

  const artists = mergeArtistLists(ARTISTS, custom);

  // Channel layer — the existing Watcher data, read, never duplicated.
  const snaps = await Promise.all(
    artists.map(async (a) => ({
      a,
      snap: a.channelHandle ? await readLiveSnapByHandle(a.channelHandle) : null,
    })),
  );
  const channelBySlug = new Map<string, {
    name: string; subs: number | null; views: number | null;
    channelId: string | null; handle: string | null;
  }>();
  const channelIdBySlug = new Map<string, string>();
  for (const { a, snap } of snaps) {
    /* Watcher stores channelHandle as either '@handle' or a raw UC id.
       Only the former is a handle; the latter is an id wearing the
       wrong field. */
    const raw = (a.channelHandle ?? '').trim();
    channelBySlug.set(a.slug, {
      name: a.name,
      subs: snap?.subs ?? null,
      views: snap?.views ?? null,
      channelId: snap?.channelId ?? null,
      handle: raw.startsWith('@') ? raw : null,
    });
    if (snap?.channelId) channelIdBySlug.set(a.slug, snap.channelId);
  }

  const uk = await readUkSnaps(channelIdBySlug);

  const row = (opts: Partial<LandscapeRow> & { artist: string }): LandscapeRow => ({
    slug: null, classification: null, channelId: null, youtubeHandle: null,
    youtubeChannelUrl: null, consumption: null, consumptionRank: null,
    isCollab: false, tracks: [], subscribers: null, lifetimeViews: null,
    ukMonthlyViews: null, ukTerritoryRank: null, ukReadingDate: null, ...opts,
  });

  const enrich = (slug: string | null) => {
    if (!slug) return {};
    const ch = channelBySlug.get(slug);
    const s = uk.get(slug);
    const ok = usable(s);
    const handle = ch?.handle ?? null;
    const cid = ch?.channelId ?? null;
    return {
      classification: classification[slug] ?? 'CHECK',
      channelId: cid,
      youtubeHandle: handle,
      youtubeChannelUrl: handle
        ? `https://www.youtube.com/${handle}`
        : cid
          ? `https://www.youtube.com/channel/${cid}`
          : null,
      subscribers: ch?.subs ?? null,
      lifetimeViews: ch?.views ?? null,
      ukMonthlyViews: ok ? s!.uk!.monthlyViews : null,
      ukTerritoryRank: ok ? s!.uk!.territoryRank : null,
      ukReadingDate: ok ? s!.readingDate : null,
    };
  };

  /* ── TAB 1 · UK CONSUMPTION ───────────────────────────────── */
  const consumption: LandscapeRow[] = period.artists
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((a) =>
      row({
        artist: a.artist, slug: a.watcherSlug, consumption: a.consumption,
        consumptionRank: a.rank, isCollab: a.isCollab, tracks: a.tracks,
        ...enrich(a.watcherSlug),
      }),
    );

  /* ── TAB 2 · CROSSOVER ────────────────────────────────────── */
  // BOTH conditions, and consumption must be a real figure, not a row.
  const crossover = consumption
    .filter((r) => (r.consumption ?? 0) > 0 && r.ukMonthlyViews != null)
    .sort((a, b) => (b.ukMonthlyViews ?? 0) - (a.ukMonthlyViews ?? 0));

  /* ── TAB 3 · BIGGEST UK ARTISTS ───────────────────────────── */
  const consBySlug = new Map<string, { c: number; rank: number }>();
  for (const a of period.artists) {
    if (a.watcherSlug) consBySlug.set(a.watcherSlug, { c: a.consumption, rank: a.rank });
  }
  // Display name: the reported artist string first, then Chartmetric's
  // artist name, then the Watcher record. Watcher stores CHANNEL titles
  // — "Donald Glover", "D Block Europe TV" — which are not what anyone
  // calls these artists, and this list goes in front of James.
  const nameBySlug = new Map<string, string>();
  for (const a of period.artists) {
    if (a.watcherSlug && !nameBySlug.has(a.watcherSlug)) nameBySlug.set(a.watcherSlug, a.artist);
  }

  const biggestUk: LandscapeRow[] = [];
  for (const a of artists) {
    /* Unknown slugs default to CHECK, never to nothing. An artist that
       nobody has classified is a backstage question, not an invisible
       row — which is exactly how Tom Odell, K-Trap and Bad Omens went
       missing from the first build. */
    if ((classification[a.slug] ?? 'CHECK') !== 'INCLUDE') continue;
    const s = uk.get(a.slug);
    if (!usable(s)) continue;
    const c = consBySlug.get(a.slug);
    biggestUk.push(
      row({
        artist: nameBySlug.get(a.slug) ?? s?.cmArtistName ?? a.name, slug: a.slug,
        consumption: c?.c ?? null, consumptionRank: c?.rank ?? null,
        ...enrich(a.slug),
      }),
    );
  }
  biggestUk.sort((x, y) => (y.ukMonthlyViews ?? 0) - (x.ukMonthlyViews ?? 0));

  const readings = Array.from(uk.values()).map((s) => s.readingDate).filter(Boolean) as string[];
  readings.sort();

  return {
    freshness: {
      consumptionThrough: period.dateTo,
      watcherUpdated: syncMeta?.lastSyncAt ? String(syncMeta.lastSyncAt).slice(0, 10) : null,
      chartmetricUpdated: readings.length ? readings[readings.length - 1] : null,
    },
    period: { id: period.periodId, label: period.periodLabel },
    consumption,
    crossover,
    biggestUk,
  };
}

export type { ConsumptionPeriod };
