/* ═══════════════════════════════════════════════════════════════════════
   MATCHING — EXPLAIN THE CONNECTION

   Order of evidence, strongest first:
     exact-upload   the charted video id is one of our uploads
     isrc           identifier match against an imported source catalogue
     title-artist   normalised title AND artist credit agree
     title-only     title agrees, artist does not (cover? shared title?)
     artist         artist credit agrees, title does not

   Titles are ambiguous, so a text match is labelled as a text match.
   Nothing below infers genre, language, era or rights: those arrive
   only from a source catalogue that states them. "No credible match"
   is a normal result and is returned as an empty list.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CatalogueMatch, CatalogueTrack, ChartEntry, MatchKind } from './types';
import { MATCH_STRENGTH } from './types';

const NOISE = /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|hd|hq|4k|mv|music video|full|version|remaster(ed)?|clip)\b/g;

/** Lower-case, strip accents, brackets and format words, collapse punctuation. */
export function normalise(text: string): string {
  return text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[[(][^\])]*[\])]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Split a credit like "Dolly Parton, Alison Krauss feat. X" into normalised names. */
export function splitArtists(credit: string): string[] {
  return credit.split(/\s*(?:,|&|\/|;|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b|\band\b|\bvs\.?\b)\s*/i)
    .map(normalise).filter(Boolean);
}

/** "Artist - Title (Descriptor)" → parts. The convention these channels use; not guaranteed. */
export function parseUploadTitle(raw: string): { artist: string | null; title: string; version: string | null } {
  const version = raw.match(/[[(]([^\])]{2,40})[\])]/)?.[1]?.trim() ?? null;
  const cleaned = raw.replace(/[[(][^\])]*[\])]?/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/\s+[-–—|]\s+/);
  if (parts.length < 2) return { artist: null, title: cleaned, version };
  /* Both "Artist - Title" and "Title - Artist" exist on these channels
     (the Dolly Parton upload is "What a Friend We Have in Jesus – Dolly
     Parton"). Without a verified artist list there is no reliable way to
     tell them apart from text alone, so both readings are kept and the
     matcher tries each. */
  return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), version };
}

type Indexed = { track: CatalogueTrack; titleKeys: string[]; artistKeys: string[] };

/** Builds a lookup once per catalogue; matching a chart of 100 entries is then cheap. */
export function indexCatalogue(tracks: CatalogueTrack[]) {
  const byVideo = new Map<string, CatalogueTrack>();
  const byIsrc = new Map<string, CatalogueTrack[]>();
  const rows: Indexed[] = [];
  for (const track of tracks) {
    if (track.videoId) byVideo.set(track.videoId, track);
    if (track.isrc) byIsrc.set(track.isrc.toUpperCase(), [...(byIsrc.get(track.isrc.toUpperCase()) ?? []), track]);
    const parsed = parseUploadTitle(track.title);
    const titleKeys = new Set<string>();
    const artistKeys = new Set<string>();
    /* Both orderings, see parseUploadTitle. A source-catalogue row has
       its artist in its own field and is indexed on that alone. */
    if (track.origin === 'source-catalogue') {
      titleKeys.add(normalise(track.title));
      if (track.artist) splitArtists(track.artist).forEach(a => artistKeys.add(a));
    } else {
      titleKeys.add(normalise(parsed.title));
      if (parsed.artist) { titleKeys.add(normalise(parsed.artist)); splitArtists(parsed.artist).forEach(a => artistKeys.add(a)); splitArtists(parsed.title).forEach(a => artistKeys.add(a)); }
      else titleKeys.add(normalise(track.title));
    }
    rows.push({ track, titleKeys: Array.from(titleKeys).filter(Boolean), artistKeys: Array.from(artistKeys).filter(Boolean) });
  }
  return { byVideo, byIsrc, rows };
}
export type CatalogueIndex = ReturnType<typeof indexCatalogue>;

function keysFor(entry: ChartEntry) {
  const titleKey = normalise(entry.title);
  const artistKeys = entry.artists.flatMap(splitArtists);
  /* A combined "Artist - Title" string (Data API video titles) carries
     the artist inside the title. Parse it the same way as our uploads. */
  const parsed = parseUploadTitle(entry.title);
  const altTitle = parsed.artist ? normalise(parsed.title) : null;
  const altArtists = parsed.artist ? [...splitArtists(parsed.artist), ...splitArtists(parsed.title)] : [];
  return { titleKey, altTitle, artistKeys: Array.from(new Set(artistKeys.concat(altArtists))) };
}

const MAX_PER_ENTRY = 6;

/** Matches one chart entry against the catalogue. Strongest first; at most a handful. */
export function matchEntry(entry: ChartEntry, index: CatalogueIndex): CatalogueMatch[] {
  const out: CatalogueMatch[] = [];
  const seen = new Set<string>();
  const push = (kind: MatchKind, track: CatalogueTrack, evidence: string) => {
    if (seen.has(track.id)) return;
    seen.add(track.id); out.push({ kind, track, evidence });
  };
  if (entry.videoId) {
    const hit = index.byVideo.get(entry.videoId);
    if (hit) push('exact-upload', hit, `Charted video id ${entry.videoId} is this upload.`);
  }
  if (entry.isrc) {
    for (const hit of index.byIsrc.get(entry.isrc.toUpperCase()) ?? [])
      push('isrc', hit, `ISRC ${entry.isrc.toUpperCase()} matches the source catalogue.`);
  }
  const { titleKey, altTitle, artistKeys } = keysFor(entry);
  const titles = [titleKey, altTitle].filter((t): t is string => !!t && t.length >= 3);
  if (!titles.length && !artistKeys.length) return out;
  const titleArtist: CatalogueMatch[] = [], titleOnly: CatalogueMatch[] = [], artistOnly: CatalogueMatch[] = [];
  for (const row of index.rows) {
    if (seen.has(row.track.id)) continue;
    const titleHit = titles.find(t => row.titleKeys.includes(t));
    const artistHit = artistKeys.find(a => row.artistKeys.includes(a));
    if (titleHit && artistHit) {
      const ours = row.track.version ? ` Our upload is marked "${row.track.version}".` : '';
      const theirs = entry.title.match(/[[(]([^\])]{2,40})[\])]/)?.[1];
      titleArtist.push({ kind: 'title-artist', track: row.track, evidence: `Title "${titleHit}" and artist "${artistHit}" both match after normalisation.${ours}${theirs ? ` The charted entry is marked "${theirs}".` : ''}${ours || theirs ? ' Same composition; the recording differs or is unverified.' : ''}` });
    }
    else if (titleHit) titleOnly.push({ kind: 'title-only', track: row.track, evidence: `Title "${titleHit}" matches; artist credit does not (${entry.artists.join(', ') || 'not supplied by source'}).` });
    else if (artistHit && artistHit.length >= 4) artistOnly.push({ kind: 'artist', track: row.track, evidence: `Artist credit "${artistHit}" matches; a different track.` });
  }
  for (const m of [...titleArtist, ...titleOnly, ...artistOnly]) {
    if (out.length >= MAX_PER_ENTRY) break;
    push(m.kind, m.track, m.evidence);
  }
  return out.sort((a, b) => MATCH_STRENGTH[a.kind].rank - MATCH_STRENGTH[b.kind].rank);
}
