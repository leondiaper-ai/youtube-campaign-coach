/* ═══════════════════════════════════════════════════════════════════════
   THE CANDIDATE CATALOGUE

   Three tiers, kept apart because they mean different things:

     1. Published on an owned channel — from this sandbox's upload
        inventory (every public upload, title-indexed), falling back
        to the Owned Channels working set for channels not yet swept.
     2. In a verified source catalogue but not published — only once a
        catalogue export has been imported. None was found in the
        repository or the connected Drive, Dropbox and Airtable sources
        on 23 Oct 2026, so this tier is empty until one is supplied.
     3. Unverified — anything else. The sandbox never promotes a text
        match into availability or rights.

   Coverage is reported with every list so that "published uploads" is
   never mistaken for "everything we hold".
   ═══════════════════════════════════════════════════════════════════════ */

import { OWNED_CHANNELS } from '@/lib/ownedChannels/channels';
import { readOwnedHistory } from '@/lib/ownedChannels/store';
import type { OwnedSnapshot } from '@/lib/ownedChannels/metrics';
import { readSourceCatalogue, readUploads, type UploadsMeta } from './store';
import { parseUploadTitle } from './match';
import type { CatalogueTrack } from './types';

export type ChannelCoverage = {
  slug: string; name: string; channelId: string; identityVerified: boolean;
  /** Rows in the sandbox inventory; null when never swept. */
  inventory: { count: number; complete: boolean; videoCount: number | null; sweptAt: string; lastIncrementalAt: string | null } | null;
  /** The Owned Channels working set used as a fallback. */
  ownedWorkingSet: { count: number; readingAt: string } | null;
  /** Which of the two the matcher is using for this channel. */
  using: 'inventory' | 'owned-working-set' | 'none';
};

export type CatalogueLayer = {
  tracks: CatalogueTrack[];
  coverage: ChannelCoverage[];
  source: { present: boolean; rows: number; importedAt: string | null; note: string | null };
  /** Latest owned reading per channel, for evidence. */
  ownedLatest: Record<string, OwnedSnapshot | undefined>;
  ownedHistory: Record<string, OwnedSnapshot[]>;
};

export async function loadCatalogue(): Promise<CatalogueLayer> {
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
    const rows = inv.meta && inv.rows.length ? inv.rows.map(r => ({ id: r.id, title: r.title, publishedAt: r.publishedAt }))
      : (latest?.items ?? []).map(v => ({ id: v.id, title: v.title, publishedAt: v.publishedAt }));
    for (const row of rows) {
      const parsed = parseUploadTitle(row.title);
      tracks.push({ id: `upload:${row.id}`, origin: 'owned-upload', title: row.title, artist: parsed.artist, version: parsed.version,
        isrc: null, channelSlug: def.slug, channelName: def.name, videoId: row.id, publishedAt: row.publishedAt,
        genre: null, language: null, releaseYear: null, territories: null, rightsNote: null });
    }
    coverage.push({
      slug: def.slug, name: def.name, channelId: def.id, identityVerified: def.identityVerified,
      inventory: inv.meta ? { count: inv.meta.count, complete: inv.meta.complete, videoCount: inv.meta.videoCount, sweptAt: inv.meta.sweptAt, lastIncrementalAt: inv.meta.lastIncrementalAt } : null,
      ownedWorkingSet: latest ? { count: latest.items.length, readingAt: latest.collectedAt } : null,
      using: inv.meta && inv.rows.length ? 'inventory' : latest?.items.length ? 'owned-working-set' : 'none',
    });
  });
  const unresolved = OWNED_CHANNELS.filter(c => !c.identityVerified);
  for (const def of unresolved) coverage.push({ slug: def.slug, name: def.name, channelId: def.id, identityVerified: false, inventory: null, ownedWorkingSet: null, using: 'none' });
  if (source?.rows.length) tracks.push(...source.rows);
  return { tracks, coverage, ownedLatest, ownedHistory,
    source: { present: !!source?.rows.length, rows: source?.rows.length ?? 0, importedAt: source?.importedAt ?? null, note: source?.note ?? null } };
}

/* ── Source catalogue import ───────────────────────────────────────
   CSV/TSV with a header. Recognised columns: isrc, title, artist,
   version, genre, language, year, territories, rights/cleared. Rows
   without a title are skipped; nothing is inferred for missing cells. */
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
    rows.push({ id: `source:${isrc ?? `${rows.length}-${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      origin: 'source-catalogue', title, artist, version: cell(cells, 'version'), isrc: isrc && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : isrc,
      channelSlug: null, channelName: null, videoId: null, publishedAt: null,
      genre: cell(cells, 'genre'), language: cell(cells, 'language'), releaseYear: Number.isFinite(year) ? year : null,
      territories: cell(cells, 'territories'), rightsNote: cell(cells, 'rights') });
  }
  return { rows, skipped, columns: Object.keys(col) };
}
