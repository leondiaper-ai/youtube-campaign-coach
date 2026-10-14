/* ═══════════════════════════════════════════════════════════════════════
   SONGS WORTH CONSIDERING FOR OWNED-CHANNEL SUPPORT

   Three lenses, kept apart on purpose. Combining them into one opportunity
   score would mean choosing a weighting nobody can defend, and would hide
   WHY a song is here — which is the only part a programmer can act on.

     BIGGEST         most consumption on the song's own best full-track
                     asset. Popularity earns consideration, nothing more.
     MOVING NOW      views added over a MEASURED window. Requires real
                     dated observations; a song without them is absent,
                     not estimated.
     WORTH EXTENDING a specific, named asset-level signal — short-form
                     outperforming the record, or comment text we have
                     actually read.

   ── WHAT THIS FILE REFUSES TO DO ──────────────────────────────────────
   Lifetime views ÷ age is NOT recent growth. It is an average over the
   whole life of a video, so a record that did everything in week one and
   nothing since scores identically to one climbing now. Watcher keeps a
   real per-video series (videoSnapshots.ts), so Moving now reads that or
   reports the song as unmeasured.

   Shorts and full-track are never summed. A song with a 2M-view Short and
   a 40K record is a different proposition from one with a 2M record, and
   adding them to 2.04M destroys exactly the distinction a programmer needs.

   Channel totals never appear in a song metric. Subscriber counts and
   lifetime channel views say nothing about whether this song is working.
   ═══════════════════════════════════════════════════════════════════════ */

import { getAllArtists } from '@/lib/marketScope';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import type { Artist, RecentUpload, TopComment } from '@/lib/artists';
import { readVideoSeriesMany, type VideoSeries } from '@/lib/videoSnapshots';
import { recentGain } from '@/lib/videoMomentum';
import { readArtistCatalogue, readAll } from './collect';
import { buildSongs, treatmentsOf, norm, splitCredit, type Song, type RawUpload } from './songs';

export type Lens = 'biggest' | 'moving' | 'extending';
export const LENS_LABEL: Record<Lens, string> = {
  biggest: 'Biggest', moving: 'Moving now', extending: 'Worth extending',
};

export interface AssetRef {
  id: string; title: string; url: string; thumb: string | null;
  publishedAt: string; ageDays: number;
  views: number | null; likes: number | null; comments: number | null;
  treatments: string[];
  isShort: boolean;
}

/** A dated observation pair, for a trend that cannot be faked. */
export interface TrendPoint { ts: string; views: number }

export interface SongCard {
  key: string;
  slug: string; artist: string; song: string;
  lens: Lens;
  /** Always a full-track recording, never a Short. */
  featured: AssetRef;
  /** METRIC SCOPE — printed on the card so a number is never ambiguous. */
  scope: { headline: 'featured video'; set: 'song assets' };

  /** Measured gain on the FEATURED VIDEO. null when unmeasured. */
  measured: { gain: number; spanDays: number; from: string; to: string } | null;
  /** Real observations only. Empty when there is nothing to draw. */
  trend: TrendPoint[];
  trendNote: string;

  /** Full-track assets, deduplicated by video id. Shorts excluded. */
  fullTrack: { count: number; views: number | null; assets: AssetRef[] };
  /** Kept completely separate from fullTrack. Never added to it. */
  shorts: { count: number; views: number | null; best: AssetRef | null };

  /** One factual line. No advice, no prediction. */
  why: string;

  /** Enrichment, only when it exists. */
  comments: { analysed: boolean; sample: TopComment[]; note: string };
  marketAppearances: { channel: string; title: string; url: string; publishedAt: string; views: number | null }[];
  campaign: { phase: string | null; nextMoment: string | null } | null;

  coverage: string;
}

const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const ageDays = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5));

function toRef(u: RawUpload): AssetRef {
  const short = u.durationSec != null && u.durationSec <= 62 && u.live !== 'live';
  return {
    id: u.id, title: u.title, url: `https://www.youtube.com/watch?v=${u.id}`,
    thumb: u.thumb ?? thumbOf(u.id),
    publishedAt: u.publishedAt, ageDays: ageDays(u.publishedAt),
    views: u.views ?? null, likes: u.likes ?? null, comments: u.comments ?? null,
    treatments: treatmentsOf(u.title), isShort: short,
  };
}

/** Uploads for one artist, preferring the deeper mw: catalogue. */
async function uploadsFor(a: Artist): Promise<{ ups: RawUpload[]; raw: RecentUpload[]; coverage: string }> {
  const cat = await readArtistCatalogue(a.slug).catch(() => null);
  if (cat && cat.items.length) {
    return {
      ups: cat.items.map(v => ({
        id: v.id, title: v.title, publishedAt: v.publishedAt,
        durationSec: v.durationSec ?? null, live: (v.live as string) ?? 'none',
        views: v.views ?? null, likes: v.likes ?? null, comments: v.comments ?? null, thumb: v.thumb ?? null,
      })),
      raw: [],
      coverage: `${cat.items.length} uploads from the Market Watch catalogue collection.`,
    };
  }
  const snap = a.channelHandle ? await readLiveSnapByHandle(a.channelHandle).catch(() => null) : null;
  const raw: RecentUpload[] = snap?.recentUploads ?? [];
  return {
    ups: raw.map((v: any) => ({
      id: v.id, title: v.title, publishedAt: v.publishedAt,
      durationSec: v.durationSec ?? null, live: v.live ?? 'none',
      views: v.viewCount ?? null, likes: v.likeCount ?? null, comments: v.commentCount ?? null, thumb: null,
    })),
    raw,
    /* This matters for interpretation: "biggest" means biggest in the
       window Watcher caches, which is not the artist's catalogue. */
    coverage: `${raw.length} most recent uploads from Watcher's cache — a recent window, not the full catalogue.`,
  };
}

/** The asset a card is built around: the best FULL-TRACK recording. */
function pickFeatured(song: Song): RawUpload | null {
  const full = song.recordings.filter(r => !(r.durationSec != null && r.durationSec <= 62));
  const pool = full.length ? full : song.recordings;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
}

const fmt = (n: number) => n.toLocaleString('en-GB');

export interface BuildOptions { windowDays?: number; perLens?: number; slugs?: string[] }

export async function buildShortlistCandidates(
  opts: BuildOptions = {},
): Promise<{ cards: SongCard[]; diagnostics: Record<string, unknown> }> {
  const windowDays = opts.windowDays ?? 7;
  const perLens = opts.perLens ?? 4;

  const artists = (await getAllArtists()).filter((a: Artist) =>
    (a.ownership ?? 'observed') === 'virgin' && !!a.channelHandle &&
    (!opts.slugs?.length || opts.slugs.includes(a.slug)));

  /* One pass to assemble every song, then rank. Scanning is capped because
     each artist costs a catalogue read. */
  type Entry = { a: Artist; song: Song; featured: RawUpload; coverage: string; raw: RecentUpload[] };
  const entries: Entry[] = [];

  for (const a of artists.slice(0, 40)) {
    const { ups, raw, coverage } = await uploadsFor(a);
    if (!ups.length) continue;
    /* Deduplicate by video id before anything counts them. The catalogue
       and the cache can both carry the same upload. */
    const seen = new Set<string>();
    const unique = ups.filter(u => (seen.has(u.id) ? false : (seen.add(u.id), true)));
    for (const song of buildSongs(unique, a.name)) {
      const featured = pickFeatured(song);
      if (!featured) continue;
      entries.push({ a, song, featured, coverage, raw });
    }
  }

  /* Series for every featured asset, in as few round trips as the helper
     allows. This is what decides whether Moving now can exist. */
  const series = await readVideoSeriesMany(entries.map(e => e.featured.id)).catch(() => new Map<string, VideoSeries>());

  const withMeasure = entries.map(e => {
    const s = series.get(e.featured.id) ?? null;
    const g = recentGain(s, windowDays);
    const obs = (s?.observations ?? []).slice().sort((x, y) => x.ts.localeCompare(y.ts));
    return { ...e, s, gain: g, obs };
  });

  const measuredCount = withMeasure.filter(e => e.gain).length;

  /* ── THE THREE LENSES ────────────────────────────────────────────── */
  const biggest = [...withMeasure]
    .filter(e => (e.featured.views ?? 0) > 0)
    .sort((x, y) => (y.featured.views ?? 0) - (x.featured.views ?? 0))
    .slice(0, perLens);

  const moving = [...withMeasure]
    .filter(e => e.gain && e.gain.gain > 0)
    .sort((x, y) => (y.gain!.gain) - (x.gain!.gain))
    .slice(0, perLens);

  /* ── WORTH EXTENDING ─────────────────────────────────────────────────
     The first version asked whether the song's best Short beat the record.
     That is structurally broken: for anything with a real catalogue the
     record is in the millions, so the test can only ever fire on songs with
     a few hundred views — and those are exactly the ones a floor then has to
     throw out. The lens came back empty, which looked like honesty and was
     actually a bad question.

     The right frame is ARTIST-RELATIVE, the same reasoning videoSnapshots
     uses for pace: is short-form working harder for THIS song than it
     normally does for this artist? That holds at 500 views and at 500
     million, and it is the thing that would justify making more.

     Still floored in absolute terms, because a 2x lift on 300 views is a
     ratio, not an opportunity. */
  const EXTEND_FLOOR = 25_000;
  const LIFT = 2;
  type Ext = typeof withMeasure[number] & { signal: string };
  const extending: Ext[] = [];

  /* Median Short per artist, from every Short on the channel. */
  const artistShortMedian = new Map<string, number>();
  for (const e of withMeasure) {
    if (artistShortMedian.has(e.a.slug)) continue;
    const all = withMeasure.filter(x => x.a.slug === e.a.slug)
      .flatMap(x => x.song.shorts.map(sh => sh.views).filter((v): v is number => v != null && v > 0))
      .sort((x, y) => x - y);
    if (all.length >= 3) artistShortMedian.set(e.a.slug, all[Math.floor(all.length / 2)]);
  }

  for (const e of withMeasure) {
    const shorts = e.song.shorts.filter(s => (s.views ?? 0) > 0);
    const bestShort = [...shorts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
    const med = artistShortMedian.get(e.a.slug);
    const fv = e.featured.views ?? 0;

    if (bestShort && med && (bestShort.views ?? 0) >= EXTEND_FLOOR && (bestShort.views ?? 0) >= med * LIFT) {
      extending.push({ ...e, signal:
        `A Short for this song has ${fmt(bestShort.views!)} views — ${((bestShort.views!) / med).toFixed(1)}x this artist's median Short of ${fmt(med)}. Short-form is landing harder here than it usually does for them.` });
      continue;
    }
    const tc = topCommentsFor(e.raw, e.featured.id);
    if (tc.length >= 3 && fv >= EXTEND_FLOOR) {
      extending.push({ ...e, signal:
        `${tc.length} comments have been read on the featured video, so there is actual audience text to work from rather than a count.` });
    }
  }
  const extTop = extending
    .sort((x, y) => (y.featured.views ?? 0) - (x.featured.views ?? 0))
    .slice(0, perLens);

  /* A song appears under ONE lens. Order of precedence is the order the
     brief lists them, so a song that is both big and moving shows as
     moving — the newer information is the more useful one. */
  const taken = new Set<string>();
  const cards: SongCard[] = [];
  const market = await readAll().catch(() => []);

  const push = (e: typeof withMeasure[number], lens: Lens, why: string) => {
    const id = `${e.a.slug}:${e.song.key}`;
    if (taken.has(id)) return;
    taken.add(id);

    const fullAssets = e.song.recordings
      .filter(r => !(r.durationSec != null && r.durationSec <= 62))
      .map(toRef);
    const shortAssets = e.song.shorts.map(toRef);
    const sumOrNull = (xs: AssetRef[]) => {
      const vals = xs.map(x => x.views).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };

    const tc = topCommentsFor(e.raw, e.featured.id);
    const artistN = norm(e.a.name);
    const appearances: SongCard['marketAppearances'] = [];
    for (const ch of market) {
      for (const v of ch.items) {
        if (norm(v.title).indexOf(e.song.key) < 0) continue;
        if (!splitCredit(v.title)?.credits.includes(artistN)) continue;
        appearances.push({ channel: ch.name, title: v.title,
          url: `https://www.youtube.com/watch?v=${v.id}`, publishedAt: v.publishedAt, views: v.views });
      }
    }

    cards.push({
      key: id, slug: e.a.slug, artist: e.a.name.trim(), song: e.song.name, lens,
      featured: toRef(e.featured),
      scope: { headline: 'featured video', set: 'song assets' },
      /* ── THE DATES MUST BE THE WINDOW, NOT THE SERIES ─────────────────
         These were the first and last observation in the whole series, so a
         7-day gain was labelled with a 26-day date range. The reader either
         believes the gain covers 26 days or believes the dates are wrong;
         both are our fault. `to` is the newest reading and `from` is the
         reading recentGain actually measured back to. */
      measured: e.gain ? (() => {
        const to = e.obs[e.obs.length - 1]?.ts ?? '';
        const toMs = Date.parse(to + 'T12:00:00Z');
        const want = toMs - e.gain.spanDays * 864e5;
        const from = [...e.obs].reverse()
          .find(o => Math.abs(Date.parse(o.ts + 'T12:00:00Z') - want) < 432e5)?.ts
          ?? e.obs[Math.max(0, e.obs.length - 1 - e.gain.spanDays)]?.ts ?? '';
        return { gain: e.gain.gain, spanDays: e.gain.spanDays, from, to };
      })() : null,
      trend: e.obs.map(o => ({ ts: o.ts, views: o.views })),
      trendNote: e.obs.length >= 2
        ? `${e.obs.length} dated observations, ${e.obs[0].ts} to ${e.obs[e.obs.length - 1].ts}.`
        : e.obs.length === 1
          ? 'One observation only — a trend needs at least two, so none is drawn.'
          : 'No recorded observations for this video, so no trend can be drawn. Daily recording began when per-video snapshots were added; videos published before that have no history and it cannot be reconstructed.',
      fullTrack: { count: fullAssets.length, views: sumOrNull(fullAssets), assets: fullAssets.slice(0, 4) },
      shorts: { count: shortAssets.length, views: sumOrNull(shortAssets),
        best: shortAssets.sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null },
      why,
      comments: {
        analysed: tc.length > 0, sample: tc.slice(0, 4),
        note: tc.length
          ? `${tc.length} comment(s) read on the featured video. These are the comments themselves, not a sentiment score, and they may respond to the artist or the video rather than the song.`
          : 'No comments have been read for this video. The comment count alone measures how much is being said, never what is said.',
      },
      marketAppearances: appearances.slice(0, 4),
      campaign: (e.a.phase || e.a.nextMomentDate)
        ? { phase: e.a.phase ?? null, nextMoment: e.a.nextMomentDate ?? null } : null,
      coverage: e.coverage,
    });
  };

  for (const e of moving) {
    push(e, 'moving', `Added ${fmt(e.gain!.gain)} views on the featured video over a measured ${e.gain!.spanDays}-day span.`);
  }
  for (const e of extTop) {
    push(e, 'extending', (e as Ext).signal);
  }
  for (const e of biggest) {
    push(e, 'biggest', `${fmt(e.featured.views ?? 0)} lifetime views on the featured video, ${ageDays(e.featured.publishedAt)} days old.`);
  }

  return {
    cards,
    diagnostics: {
      artistsScanned: Math.min(40, artists.length),
      virginArtists: artists.length,
      songsBuilt: entries.length,
      featuredAssetsWithSeries: series.size,
      featuredAssetsWithMeasuredWindow: measuredCount,
      windowDays,
      movingNowAvailable: moving.length,
      note: measuredCount === 0
        ? 'No featured asset has two dated observations inside the window, so Moving now is empty. This is a coverage fact, not an absence of movement — per-video recording only captures videos seen by a sync after it was added.'
        : `${measuredCount} of ${entries.length} featured assets have a usable measured window.`,
    },
  };
}

function topCommentsFor(raw: RecentUpload[], videoId: string): TopComment[] {
  const v = raw.find(x => x.id === videoId);
  return v?.topComments ?? [];
}

/* ── Shortlist storage, mw: namespace only ───────────────────────────── */
export interface ShortlistEntry {
  key: string; slug: string; artist: string; song: string;
  featuredId: string; featuredTitle: string; lens: Lens;
  /** Free text or a market channel key. "undecided" is a valid answer. */
  destination: string;
  destinationKind: 'owned' | 'reference' | 'undecided';
  treatment: string;
  note?: string;
  /** Never inferred from monitoring or ownership. */
  permission: 'unknown' | 'cleared' | 'blocked';
  savedAt: string;
}

const kv = async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { const { Redis } = await import('@upstash/redis'); return new Redis({ url, token }); }
  catch { return null; }
};
const SHORTLIST = 'mw:shortlist';

export async function readShortlist(): Promise<Record<string, ShortlistEntry>> {
  const r = await kv(); if (!r) return {};
  const raw = await r.get(SHORTLIST).catch(() => null);
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as any); } catch { return {}; }
}
export async function saveShortlist(e: ShortlistEntry) {
  const r = await kv(); if (!r) return false;
  const all = await readShortlist();
  all[e.key] = e;
  await r.set(SHORTLIST, JSON.stringify(all));
  return true;
}
export async function removeShortlist(key: string) {
  const r = await kv(); if (!r) return false;
  const all = await readShortlist();
  delete all[key];
  await r.set(SHORTLIST, JSON.stringify(all));
  return true;
}
