/* ═══════════════════════════════════════════════════════════════════════
   THE CANDIDATE CATALOGUE

   Three tiers, kept apart because they mean different things:

     1. Published on an owned channel. Sources, in order of preference:
          a. the sandbox's live upload inventory in Redis (incremental
             sweeps started from the page);
          b. a committed inventory snapshot under ./seed/uploads, read
             through the production /api/full-catalogue route on the
             date in its meta (titles, dates, lifetime views, duration);
          c. the Owned Channels working set (newest 300 + top 100).
        Each channel says which it is using and whether it is complete.
     2. In a verified source catalogue but not published — only once a
        catalogue export has been imported. None was found in the
        repository or the connected Drive, Dropbox and Airtable sources
        on 23 Oct 2026, so this tier is empty until one is supplied.
     3. Unverified — anything else. Text matches never become rights.
   ═══════════════════════════════════════════════════════════════════════ */

import { OWNED_CHANNELS } from '@/lib/ownedChannels/channels';
import { readOwnedHistory } from '@/lib/ownedChannels/store';
import type { OwnedSnapshot } from '@/lib/ownedChannels/metrics';
import { readSourceCatalogue, readUploads, type UploadsMeta } from './store';
import { parseUploadTitle } from './match';
import { classifyUpload, humanLabelsFor, normArtist } from './classify';
import type { CatalogueTrack, HumanLabel, Label } from './types';

import folkAndNature from './seed/uploads/folk-and-nature.json';
import elPatio from './seed/uploads/el-patio.json';
import venueFloor from './seed/uploads/venue-floor.json';

type SeedRow = [string, string, string, number | null, number | null];
type SeedInventory = { meta: { slug: string; channelId: string; handle: string; fetchedAt: string; publicVideoCount: number; complete: boolean; lifetimeViews: number; subscribers: number; channelCreated: string; note?: string; rows: number; source: string }; rows: SeedRow[] };
const SEED_INVENTORIES: SeedInventory[] = [folkAndNature, elPatio, venueFloor] as unknown as SeedInventory[];

export type ChannelCoverage = {
  slug: string; name: string; channelId: string; identityVerified: boolean;
  using: 'inventory' | 'seed-snapshot' | 'owned-working-set' | 'none';
  rows: number;
  complete: boolean | null;
  /** YouTube's public count at the time of the reading used. */
  videoCount: number | null;
  readAt: string | null;
  note: string | null;
  /** Lifetime views held by the rows the matcher sees (sum), where known, against the channel's lifetime total. */
  rowViews: number | null;
  channelViews: number | null;
  /** Label distribution of the channel's own catalogue, for channel fit. value → count, per dimension. */
  profile: Record<string, Record<string, number>>;
  topUploads: { videoId: string; title: string; views: number | null; publishedAt: string }[];
};

export type CatalogueLayer = {
  tracks: CatalogueTrack[];
  coverage: ChannelCoverage[];
  source: { present: boolean; rows: number; importedAt: string | null; note: string | null };
  ownedLatest: Record<string, OwnedSnapshot | undefined>;
  ownedHistory: Record<string, OwnedSnapshot[]>;
};

function profileOf(tracks: CatalogueTrack[]) {
  const profile: Record<string, Record<string, number>> = {};
  for (const t of tracks) for (const l of t.labels) {
    profile[l.dimension] ??= {};
    profile[l.dimension][l.value] = (profile[l.dimension][l.value] ?? 0) + 1;
  }
  return profile;
}

function uploadTrack(def: typeof OWNED_CHANNELS[number], row: { id: string; title: string; publishedAt: string; views?: number | null; durationSec?: number | null }, human: HumanLabel[]): CatalogueTrack {
  const parsed = parseUploadTitle(row.title);
  /* These channels title uploads "Title - Artist". parseUploadTitle returns the
     first segment as `artist`, which is therefore the TITLE here; the matcher
     tries both orders, but for labelling we want the credit, so swap. */
  const artist = parsed.artist ? parsed.title : null;
  const subjects = [`upload:${row.id}`, ...(artist ? [`artist:${normArtist(artist)}`] : [])];
  const labels: Label[] = classifyUpload(row.title, artist, humanLabelsFor(subjects, human));
  return { id: `upload:${row.id}`, origin: 'owned-upload', title: row.title, artist, version: parsed.version, isrc: null,
    channelSlug: def.slug, channelName: def.name, videoId: row.id, publishedAt: row.publishedAt,
    views: row.views ?? null, durationSec: row.durationSec ?? null,
    genre: null, language: null, releaseYear: null, territories: null, rightsNote: null, labels };
}

export async function loadCatalogue(human: HumanLabel[] = []): Promise<CatalogueLayer> {
  const tracks: CatalogueTrack[] = [];
  const coverage: ChannelCoverage[] = [];
  const ownedLatest: Record<string, OwnedSnapshot | undefined> = {};
  const ownedHistory: Record<string, OwnedSnapshot[]> = {};
  const channels = OWNED_CHANNELS.filter(c => c.identityVerified);
  const [inventories, histories, source] = await Promise.all([
    Promise.all(channels.map(c => readUploads(c.id).catch(() => ({ meta: null as UploadsMeta | null, rows: [] })))),
    Promise.all(channels.map(c => readOwnedHistory(c.id).catch(() => []))),
    readSourceCatalogue().catch(() => null),
  ]);
  channels.forEach((def, i) => {
    const inv = inventories[i];
    const history = [...histories[i]].sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
    const latest = history.at(-1);
    ownedLatest[def.id] = latest; ownedHistory[def.id] = history;
    const seed = SEED_INVENTORIES.find(s => s.meta.channelId === def.id);
    let rows: { id: string; title: string; publishedAt: string; views?: number | null; durationSec?: number | null }[] = [];
    let using: ChannelCoverage['using'] = 'none', complete: boolean | null = null, videoCount: number | null = null, readAt: string | null = null, note: string | null = null, channelViews: number | null = latest?.views ?? null;
    if (inv.meta && inv.rows.length) {
      rows = inv.rows.map(r => ({ id: r.id, title: r.title, publishedAt: r.publishedAt, views: latest?.items.find(v => v.id === r.id)?.views ?? latest?.viewsById?.[r.id] ?? null }));
      using = 'inventory'; complete = inv.meta.complete; videoCount = inv.meta.videoCount; readAt = inv.meta.sweptAt;
      note = 'Live title index from the sandbox sweep. Views only where the Owned Channels readings hold them.';
    } else if (seed) {
      rows = seed.rows.map(([id, title, publishedAt, views, durationSec]) => ({ id, title, publishedAt, views, durationSec }));
      using = 'seed-snapshot'; complete = seed.meta.complete; videoCount = seed.meta.publicVideoCount; readAt = seed.meta.fetchedAt;
      note = seed.meta.note ?? `Snapshot read via ${seed.meta.source.split(' (')[0]} on ${seed.meta.fetchedAt.slice(0, 10)}; lifetime views as of that reading.`;
      channelViews = seed.meta.lifetimeViews;
    } else if (latest?.items.length) {
      rows = latest.items.map(v => ({ id: v.id, title: v.title, publishedAt: v.publishedAt, views: v.views, durationSec: v.durationSec }));
      using = 'owned-working-set'; complete = false; videoCount = latest.library?.videoCount ?? null; readAt = latest.collectedAt;
      note = 'Owned Channels working set (newest 300 + top 100). Partial by design.';
    }
    const channelTracks = rows.map(r => uploadTrack(def, r, human));
    tracks.push(...channelTracks);
    const withViews = channelTracks.filter(t => t.views != null);
    coverage.push({
      slug: def.slug, name: def.name, channelId: def.id, identityVerified: true, using, rows: rows.length, complete, videoCount, readAt, note,
      rowViews: withViews.length ? withViews.reduce((s, t) => s + t.views!, 0) : null, channelViews,
      profile: profileOf(channelTracks),
      topUploads: withViews.sort((a, b) => b.views! - a.views!).slice(0, 8).map(t => ({ videoId: t.videoId!, title: t.title, views: t.views, publishedAt: t.publishedAt ?? '' })),
    });
  });
  for (const def of OWNED_CHANNELS.filter(c => !c.identityVerified)) {
    coverage.push({ slug: def.slug, name: def.name, channelId: def.id, identityVerified: false, using: 'none', rows: 0, complete: null, videoCount: null, readAt: null, note: `Supplied ID has ${def.id.length} characters; expected 24. Not matched.`, rowViews: null, channelViews: null, profile: {}, topUploads: [] });
  }
  if (source?.rows.length) tracks.push(...source.rows.map(r => ({ ...r, labels: r.labels ?? [] })));
  return { tracks, coverage, ownedLatest, ownedHistory,
    source: { present: !!source?.rows.length, rows: source?.rows.length ?? 0, importedAt: source?.importedAt ?? null, note: source?.note ?? null } };
}

/* ── Source catalogue import ─────────────────────────────────────── */
const COLS: Record<string, RegExp> = {
  isrc: /^isrc$/i, title: /^(title|track|track title|song|recording)$/i, artist: /^(artist|artists|artist name|main artist)$/i,
  version: /^(version|mix|subtitle)$/i, genre: /^(genre|genres)$/i, language: /^(language|lang)$/i,
  year: /^(year|release year|release date|released)$/i, territories: /^(territor(y|ies)|markets|regions)$/i, rights: /^(rights|cleared|clearance|rights note|status)$/i,
};
function split(line: string, sep: string) {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === sep && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out.map(s => s.trim());
}
export function parseSourceCatalogue(text: string): { rows: CatalogueTrack[]; skipped: number; columns: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Paste a header row and at least one catalogue row.');
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = split(lines[0], sep);
  const col: Record<string, number> = {};
  header.forEach((h, i) => { for (const [k, re] of Object.entries(COLS)) if (col[k] == null && re.test(h)) col[k] = i; });
  if (col.title == null || col.artist == null) throw new Error(`Need at least title and artist columns. Headers seen: ${header.join(' | ')}`);
  const rows: CatalogueTrack[] = []; let skipped = 0;
  const cell = (cells: string[], k: string) => col[k] != null && cells[col[k]] ? cells[col[k]] : null;
  for (const line of lines.slice(1)) {
    const cells = split(line, sep);
    const title = cell(cells, 'title'), artist = cell(cells, 'artist');
    if (!title || !artist) { skipped++; continue; }
    const isrc = cell(cells, 'isrc')?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? null;
    const yearRaw = cell(cells, 'year');
    const year = yearRaw ? Number(yearRaw.match(/\d{4}/)?.[0]) : NaN;
    const genre = cell(cells, 'genre'), language = cell(cells, 'language');
    /* Catalogue-stated fields are verified metadata; they outrank anything inferred. */
    const labels: Label[] = [];
    if (genre) labels.push({ dimension: 'genre', value: genre, provenance: 'verified', confidence: 'high', basis: 'source catalogue field' });
    if (language) labels.push({ dimension: 'language', value: language, provenance: 'verified', confidence: 'high', basis: 'source catalogue field' });
    rows.push({ id: `source:${isrc ?? `${rows.length}-${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      origin: 'source-catalogue', title, artist, version: cell(cells, 'version'), isrc,
      channelSlug: null, channelName: null, videoId: null, publishedAt: null, views: null, durationSec: null,
      genre, language, releaseYear: Number.isFinite(year) ? year : null,
      territories: cell(cells, 'territories'), rightsNote: cell(cells, 'rights'), labels });
  }
  return { rows, skipped, columns: Object.keys(col) };
}
