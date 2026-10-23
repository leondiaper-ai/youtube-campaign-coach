/* ═══════════════════════════════════════════════════════════════════════
   CLASSIFICATION — SMALL VOCABULARY, EXPLICIT PROVENANCE

   Three kinds of label, kept apart and shown apart:

     verified   stated by the source (release date → era)
     human      recorded by a person in the sandbox (overrides everything)
     inferred   rule from the title text, or the model-assigned artist map

   Rules only ever read what a title or a source field actually says.
   A plain title yields NO version or presentation label — absence of
   "(Remix)" does not prove a studio original, and a song-chart row
   never gets a presentation label because a song chart does not
   identify a video format. "Unknown" is the default and is counted.
   ═══════════════════════════════════════════════════════════════════════ */

import artistGenres from './seed/labels/artist-genres.json';
import type { Confidence, Dimension, HumanLabel, Label, Provenance } from './types';
import { VOCAB } from './types';

type ArtistMap = Record<string, { genre?: string[]; language?: string }>;
const ARTISTS: ArtistMap = (artistGenres as { artists: ArtistMap }).artists;

/** Band names that contain an ampersand and must not be split into two artists. */
export const AMPERSAND_BANDS = ['chase & status', 'angus & julia stone', 'mumford & sons', 'henrique & juliano', 'chico amado & xodó', 'joan jett & the blackhearts', 'simon & garfunkel', 'earth, wind & fire', 'hall & oates', 'brooks & dunn', 'florida georgia line'];

export const normArtist = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Split an artist credit, keeping known ampersand bands whole. */
export function splitCredit(credit: string): string[] {
  const low = credit.toLowerCase();
  const kept: string[] = [];
  let rest = credit;
  for (const band of AMPERSAND_BANDS) {
    const i = low.indexOf(band);
    if (i >= 0) { kept.push(credit.slice(i, i + band.length)); rest = rest.slice(0, i) + ' , ' + rest.slice(i + band.length); }
  }
  return [...kept, ...rest.split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bx\b|\bvs\.?\b|\by\b|\be\b)\s*/i).map(s => s.trim()).filter(s => s && !/^\s*$/.test(s))];
}

const L = (dimension: Dimension, value: string, provenance: Provenance, confidence: Confidence, basis: string): Label => ({ dimension, value, provenance, confidence, basis });

/* ── Title rules ────────────────────────────────────────────────── */
const VERSION_RULES: [RegExp, string][] = [
  [/\b(slowed|sped[- ]?up|speed[- ]?up|nightcore|super slowed|slowed down|reverb)\b/i, 'slowed/sped-up edit'],
  [/\b(remix|rmx|flip|bootleg|mashup)\b/i, 'remix'],
  [/\b(live|en vivo|ao vivo|live at|live from|unplugged|concert)\b/i, 'live'],
  [/\b(acoustic|acústic[ao]|acustic[ao])\b/i, 'acoustic'],
  [/\b(cover|tribute)\b/i, 'cover'],
  [/\b(radio edit|edit|bass boosted|looped|extended|instrumental|karaoke|8d|version)\b/i, 'other edit'],
];
const PRESENTATION_RULES: [RegExp, string][] = [
  [/\b(official (music )?video|official mv|official 4k|music video|\(video\)|videoclip|video oficial)\b/i, 'official music video'],
  [/\b(lyric|lyrics|letra)\b/i, 'lyric video'],
  [/\bvisuali[sz]er\b/i, 'visualiser'],
  [/\b(live (at|from|in|session|performance)|a colors show|colors show|session|unplugged|en vivo|concert)\b/i, 'live performance video'],
  [/\b(official audio|audio)\b/i, 'audio/static'],
];

/** Version from the title text alone. Nothing stated → nothing inferred. */
export function versionFromTitle(title: string): Label | null {
  for (const [re, value] of VERSION_RULES) if (re.test(title)) return L('version', value, 'inferred', 'medium', `title says "${title.match(re)![0]}"`);
  return null;
}
/** Presentation from a VIDEO title. Never call this on a song-chart row. */
export function presentationFromTitle(title: string): Label | null {
  for (const [re, value] of PRESENTATION_RULES) if (re.test(title)) return L('presentation', value, 'inferred', 'medium', `video title says "${title.match(re)![0]}"`);
  return null;
}

/* ── Language from script and stop-words (title only; low confidence) ─ */
const ES = /\b(el|la|los|las|de|del|que|tu|mi|te|me|no|por|con|sin|para|amor|coraz[oó]n|noche|vida|nunca|siempre|quiero|est[aá]s?|d[ií]a|mujer|hombre|dios|cielo|fue|eres|soy|contigo|conmigo|olvidar|borracho|boda|mentiras|hoja|verdes|hijo|loco|cuando|donde|d[oó]nde|porque|nada|todo|bonita|bonitas|m[aá]s|ni|un|una|y|al|se|lo|ya)\b/i;
const PT = /\b(voc[eê]|n[aã]o|cora[cç][aã]o|saudade|meu|minha|com|pra|voc[eê]s|amor|noite|eu|t[aã]o|j[aá]|est[aá]|peida|sem|demora)\b/i;
const RO = /\b(cu|[sș]i|nu|[iî]n|f[aă]r[aă]|inim[aă]|noroc|cerneal[aă]|neagr[aă]|condeiul|sa[- ]?[tț]i|pacale[sș]ti|bine|fie|om|intrebat|un)\b/i;
const DE = /\b(sonne|und|ich|nicht|liebe|dich|mich|herz|nacht)\b/i;
const FR = /\b(je|tu|nous|vous|avec|sans|amour|c[oœ]ur|nuit|toujours|jamais|mon|ma|mes|les|des|une|est)\b/i;
export function languageFromTitle(title: string): Label | null {
  if (/[ऀ-ॿ]/.test(title)) return L('language', 'hi', 'inferred', 'medium', 'Devanagari script in title');
  if (/[਀-੿]/.test(title)) return L('language', 'pa', 'inferred', 'medium', 'Gurmukhi script in title');
  if (/[가-힯]/.test(title)) return L('language', 'ko', 'inferred', 'medium', 'Hangul in title');
  if (/[஀-௿]/.test(title)) return L('language', 'ta', 'inferred', 'medium', 'Tamil script in title');
  const words = title.replace(/[[(][^\])]*[\])]/g, ' ').split(/[^A-Za-z\u00C0-\u024F\u1E00-\u1EFF'’]+/).filter(Boolean);
  const count = (re: RegExp) => words.filter(w => re.test(w)).length;
  const es = count(ES), pt = count(PT), ro = count(RO), de = count(DE), fr = count(FR);
  const best = Math.max(es, pt, ro, de, fr);
  if (best >= 2 || (best === 1 && words.length <= 3 && (es || pt || ro))) {
    const lang = best === es ? 'es' : best === pt ? 'pt' : best === ro ? 'ro' : best === de ? 'de' : 'fr';
    return L('language', lang, 'inferred', best >= 2 ? 'medium' : 'low', `${best} ${lang} word${best === 1 ? '' : 's'} in title`);
  }
  return null;
}

/* ── Era from a stated release date, relative to the chart period ── */
export function eraFromRelease(releaseDate: string | null, asOf: string): Label | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return null;
  const full = /^\d{4}-\d{2}-\d{2}$/.test(releaseDate);
  const months = full ? (Date.parse(asOf) - Date.parse(releaseDate)) / (30.44 * 86400000) : (Number(asOf.slice(0, 4)) - year) * 12 + 6;
  const value = months <= 12 ? VOCAB.era[0] : months <= 36 ? VOCAB.era[1] : months <= 180 ? VOCAB.era[2] : VOCAB.era[3];
  return L('era', value, 'verified', full ? 'high' : 'medium', `source release date ${releaseDate}${full ? '' : ' (year only)'} against chart period ${asOf.slice(0, 10)}`);
}

/* ── Artist map (model-inferred) ───────────────────────────────── */
export function labelsFromArtists(artists: string[]): Label[] {
  const out: Label[] = [];
  const seen = new Set<string>();
  for (const credit of artists) for (const name of splitCredit(credit)) {
    const hit = ARTISTS[normArtist(name)];
    if (!hit) continue;
    for (const g of hit.genre ?? []) if (!seen.has(`genre:${g}`)) { seen.add(`genre:${g}`); out.push(L('genre', g, 'inferred', 'medium', `artist map: ${name} → ${g} (model-assigned)`)); }
    if (hit.language && !seen.has(`language:${hit.language}`)) { seen.add(`language:${hit.language}`); out.push(L('language', hit.language, 'inferred', 'medium', `artist map: ${name} records in ${hit.language} (model-assigned)`)); }
  }
  return out;
}
export function artistKnown(name: string) { return !!ARTISTS[normArtist(name)]; }

/* ── Merge: human > verified > inferred; one value set per dimension ─
   Multiple labels are allowed on a dimension, but a stronger provenance
   replaces a weaker one on that dimension rather than mixing with it. */
const RANK: Record<Provenance, number> = { human: 0, verified: 1, inferred: 2 };
export function mergeLabels(...groups: (Label | null | Label[])[]): Label[] {
  const flat = groups.flat().filter((l): l is Label => !!l);
  const best = new Map<Dimension, number>();
  for (const l of flat) best.set(l.dimension, Math.min(best.get(l.dimension) ?? 9, RANK[l.provenance]));
  const out: Label[] = [];
  const seen = new Set<string>();
  for (const l of flat) {
    if (RANK[l.provenance] !== best.get(l.dimension)) continue;
    const k = `${l.dimension}:${l.value}`;
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out;
}

/** Human labels stored for a subject key, as labels. */
export function humanLabelsFor(subjects: string[], stored: HumanLabel[]): Label[] {
  return stored.filter(h => subjects.includes(h.subject)).map(h => L(h.dimension, h.value, 'human', 'high', `labelled by ${h.by} on ${h.at.slice(0, 10)}${h.note ? `: ${h.note}` : ''}`));
}

/** Labels for a chart row. `entity` decides whether presentation may be inferred at all. */
export function classifyChartRow(row: { title: string; artists: string[]; releaseDate: string | null }, entity: 'song' | 'video' | 'artist', periodEnd: string, human: Label[] = []): Label[] {
  return mergeLabels(
    human,
    eraFromRelease(row.releaseDate, periodEnd),
    versionFromTitle(row.title),
    entity === 'video' ? presentationFromTitle(row.title) : null,
    languageFromTitle(row.title),
    labelsFromArtists(row.artists),
  );
}

/** Labels for an owned upload (a video): title rules + artist map. Era is unknown: upload date is not release date. */
export function classifyUpload(title: string, artist: string | null, human: Label[] = []): Label[] {
  return mergeLabels(human, versionFromTitle(title), presentationFromTitle(title), languageFromTitle(title), artist ? labelsFromArtists([artist]) : []);
}

/** Which dimensions a label set covers. */
export function covered(labels: Label[]): Set<Dimension> { return new Set(labels.map(l => l.dimension)); }
