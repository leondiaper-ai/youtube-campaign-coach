/* ═══════════════════════════════════════════════════════════════════════
   ONE VOCABULARY FOR TRACKS AND DESTINATIONS

   Fit can only be compared if both sides are described in the same terms.
   This file holds that vocabulary, plus the thing that matters more than
   the vocabulary: WHERE EACH VALUE CAME FROM.

   Four provenances, and they are not interchangeable:

     observed  — counted from upload data. Treatments, containers, cadence,
                 which artists a destination actually publishes.
     parsed    — read out of a title. Honest about being a string match.
     stated    — Leon typed it, or reviewed and kept it. Highest authority;
                 overrides everything.
     inferred  — a rule in this file guessed it. Always labelled, always
                 editable, and never allowed to be the only support for a
                 suggestion.

   WHAT IS DELIBERATELY ABSENT. Genre, subgenre, mood, energy and vocal
   style cannot be derived from the YouTube Data API. There is no audio
   here, no ISRC, no genre field. So these are `stated` or they are empty.
   They are never guessed from an artist's name, from a channel's name, or
   from the company that owns the channel — that would be inventing the
   input and then reasoning from it, which reads exactly like analysis and
   is worth nothing.

   Empty is not a refusal. A track with no stated genre still gets compared
   on treatments, language, container and cadence, all of which are real;
   the suggestion simply says which axes were unavailable.
   ═══════════════════════════════════════════════════════════════════════ */

import { treatmentsOf, norm, isShort, type RawUpload } from './songs';

export type Provenance = 'observed' | 'parsed' | 'stated' | 'inferred';

export interface Attr<T> { value: T; from: Provenance; note?: string }
const at = <T,>(value: T, from: Provenance, note?: string): Attr<T> => ({ value, from, note });

/** The shared axes. Both sides of a comparison use this shape. */
export interface Description {
  genre: Attr<string[]>;
  subgenre: Attr<string[]>;
  mood: Attr<string[]>;
  /** 1 (ambient) to 5 (peak-time). Null when nobody has said. */
  energy: Attr<number | null>;
  language: Attr<string[]>;
  vocal: Attr<string[]>;
  /** Listening context: study, gym, driving, late night, party, focus. */
  context: Attr<string[]>;
  treatments: Attr<string[]>;
  /** Free text Leon supplied. Carried through to suggestions verbatim. */
  summary: Attr<string | null>;
}

export const EMPTY: Description = {
  genre: at([], 'stated'), subgenre: at([], 'stated'), mood: at([], 'stated'),
  energy: at(null, 'stated'), language: at([], 'stated'), vocal: at([], 'stated'),
  context: at([], 'stated'), treatments: at([], 'observed'), summary: at(null, 'stated'),
};

/** Which axes carry no information yet — printed on every suggestion. */
export function missingAxes(d: Description): string[] {
  const out: string[] = [];
  if (!d.genre.value.length) out.push('genre');
  if (!d.mood.value.length) out.push('mood');
  if (d.energy.value == null) out.push('energy');
  if (!d.language.value.length) out.push('language');
  if (!d.vocal.value.length) out.push('vocal style');
  if (!d.context.value.length) out.push('listening context');
  return out;
}

/* ── Language, the one musical-adjacent axis with a real signal ──────
   Script is decidable from characters. Latin script tells us almost
   nothing (English, Spanish, French and Portuguese share it), so a Latin
   title yields NO language claim unless a translation marker names one.
   That is why this returns an empty list far more often than not. */
const SCRIPTS: [RegExp, string][] = [
  [/[Ѐ-ӿ]/, 'cyrillic'], [/[؀-ۿ]/, 'arabic'],
  [/[぀-ヿ]/, 'japanese'], [/[가-힯]/, 'korean'],
  [/[一-鿿]/, 'chinese'], [/[ऀ-ॿ]/, 'hindi'],
  [/[฀-๿]/, 'thai'], [/[א-ת]/, 'hebrew'],
];
const NAMED = [
  [/traducida|espa[nñ]ol|letra\b/i, 'spanish'], [/traduction|fran[cç]ais|paroles/i, 'french'],
  [/tradu[czd][aã]o|portugu[eê]s/i, 'portuguese'], [/[uü]bersetzung|deutsch/i, 'german'],
  [/traduzione|testo\b/i, 'italian'],
] as [RegExp, string][];

export function languagesFromTitles(titles: string[]): Attr<string[]> {
  const found = new Set<string>();
  let anyScript = false;
  for (const t of titles) {
    for (const [re, name] of SCRIPTS) if (re.test(t)) { found.add(name); anyScript = true; }
    for (const [re, name] of NAMED) if (re.test(t)) found.add(name);
  }
  const value = Array.from(found).sort();
  return at(value, 'parsed', value.length
    ? `From title characters${anyScript ? ' (script detection)' : ''} and translation markers. Not a claim about the lyric language of every upload.`
    : 'No non-Latin script and no translation marker in the titles, so language is undetermined — Latin script does not distinguish English from Spanish.');
}

/* ─────────────────────────────────────────────────────────────────────
   DESTINATION PROFILES, from repertoire rather than from the channel
   blurb. The brief asks for representative examples, so the profile
   carries the actual uploads that produced each number.
   ───────────────────────────────────────────────────────────────────── */

export interface DestExample { id: string; title: string; url: string; publishedAt: string; views: number | null }
export interface Counted { name: string; n: number; share: number; examples: DestExample[] }

export interface DestinationProfile {
  key: string; name: string; role: string; relationship: string; purpose: string;
  suspect: boolean;
  uploads: number; windowDays: number;
  /** Treatments ranked by how often the repertoire actually uses them. */
  treatments: Counted[];
  containerMix: { short: number; video: number; long: number };
  /** Named artists it publishes, most frequent first. Exact credit matches. */
  artists: { name: string; n: number }[];
  uploadsPerWeek: number;
  /** Median LIFETIME views. Favours older uploads; never first-week. */
  medianViews: number | null;
  /** The weak end, kept deliberately — §5 asks for ordinary and weak examples. */
  lowerQuartileViews: number | null;
  description: Description;
}

const ex = (v: RawUpload | { id: string; title: string; publishedAt: string; views: number | null }): DestExample =>
  ({ id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, publishedAt: v.publishedAt, views: v.views ?? null });

const pct = (xs: number[], p: number): number | null => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null;
};

export function profileDestination(
  ch: { key: string; name: string; role: string; relationship: string; purpose: string; suspect?: boolean; items: RawUpload[] },
  stated?: Partial<Description>,
): DestinationProfile {
  const items = ch.items;
  const n = items.length || 1;

  const tCount = new Map<string, RawUpload[]>();
  for (const v of items) for (const t of treatmentsOf(v.title)) {
    if (!tCount.has(t)) tCount.set(t, []);
    tCount.get(t)!.push(v);
  }
  const treatments: Counted[] = Array.from(tCount.entries())
    .map(([name, vs]) => ({
      name, n: vs.length, share: vs.length / n,
      /* Representative, not best: the median upload by views, plus the
         newest. Showing only the biggest hit is the §5 failure. */
      examples: [...vs].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .filter((_, i, arr) => i === Math.floor(arr.length / 2) || i === 0).slice(0, 2).map(ex),
    }))
    .sort((a, b) => b.n - a.n);

  const mix = { short: 0, video: 0, long: 0 };
  for (const v of items) {
    if (isShort(v)) mix.short++;
    else if ((v.durationSec ?? 0) >= 900) mix.long++;
    else mix.video++;
  }

  const aCount = new Map<string, number>();
  for (const v of items) {
    const t = (v.title || '').replace(/#[^\s#]+/g, ' ').split(/\s+[-–—]\s+/);
    if (t.length < 2) continue;
    for (const c of t[0].split(/,|&|\bft\.?\b|\bfeat\.?\b|\bx\b|\bvs\.?\b/i)) {
      const k = norm(c); if (k.length < 3) continue;
      aCount.set(k, (aCount.get(k) ?? 0) + 1);
    }
  }

  const dates = items.map(v => Date.parse(v.publishedAt)).filter(Boolean).sort();
  const windowDays = dates.length > 1 ? Math.max(1, Math.round((dates[dates.length - 1] - dates[0]) / 864e5)) : 0;
  const views = items.map(v => v.views).filter((x): x is number => x != null);

  const base: Description = {
    ...EMPTY,
    treatments: at(treatments.slice(0, 8).map(t => t.name), 'observed',
      `Counted across ${items.length} collected uploads.`),
    language: languagesFromTitles(items.map(v => v.title)),
  };

  return {
    key: ch.key, name: ch.name, role: ch.role, relationship: ch.relationship,
    purpose: ch.purpose, suspect: !!ch.suspect,
    uploads: items.length, windowDays, treatments, containerMix: mix,
    artists: Array.from(aCount.entries()).map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n).slice(0, 40),
    uploadsPerWeek: windowDays ? Math.round((items.length / windowDays) * 7 * 10) / 10 : 0,
    medianViews: pct(views, 0.5),
    lowerQuartileViews: pct(views, 0.25),
    description: mergeStated(base, stated),
  };
}

/** Stated values win, and are marked `stated` so the UI can show who said so. */
export function mergeStated(base: Description, stated?: Partial<Description>): Description {
  if (!stated) return base;
  const out = { ...base };
  for (const k of Object.keys(stated) as (keyof Description)[]) {
    const s = stated[k] as Attr<any> | undefined;
    if (!s) continue;
    const empty = s.value == null || (Array.isArray(s.value) && !s.value.length) || s.value === '';
    if (!empty) (out as any)[k] = { ...s, from: 'stated' as Provenance };
  }
  return out;
}

/* ── Stored overrides ────────────────────────────────────────────────
   Under mw: like everything else here. Nothing in this module writes to
   a Watcher key. */
const kv = async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { const { Redis } = await import('@upstash/redis'); return new Redis({ url, token }); }
  catch { return null; }
};
const DESC = (kind: 'track' | 'dest', id: string) => `mw:desc:${kind}:${id}`;

export async function readStated(kind: 'track' | 'dest', id: string): Promise<Partial<Description> | null> {
  const r = await kv(); if (!r) return null;
  const raw = await r.get(DESC(kind, id)).catch(() => null);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as Partial<Description>); } catch { return null; }
}
export async function writeStated(kind: 'track' | 'dest', id: string, d: Partial<Description>) {
  const r = await kv(); if (!r) return false;
  await r.set(DESC(kind, id), JSON.stringify(d));
  return true;
}
export async function readStatedMany(kind: 'track' | 'dest', ids: string[]): Promise<Map<string, Partial<Description>>> {
  const out = new Map<string, Partial<Description>>();
  const r = await kv(); if (!r || !ids.length) return out;
  const vals = await r.mget<any[]>(...ids.map(i => DESC(kind, i))).catch(() => null);
  if (!vals) return out;
  ids.forEach((id, i) => {
    const raw = vals[i]; if (!raw) return;
    try { out.set(id, typeof raw === 'string' ? JSON.parse(raw) : raw); } catch { /* skip */ }
  });
  return out;
}

/* ── Overlap between two descriptions ────────────────────────────────
   Returns the axes that actually agreed, the axes that could not be
   compared, and NO SCORE. A number here would be read as a probability
   of success, which nothing in this data supports. */
/* ── GENRE HIERARCHY, NOT STRING EQUALITY ────────────────────────────
   Found in the first real pilot run: "uk rap" never matched "rap", so the
   one axis that actually carries musical fit was silent on every pairing,
   while `language=english` and an energy value one apart carried the whole
   result. Every suggestion came back "strong fit". The grading was wrong,
   but so was this: exact token equality cannot see that "uk rap" is rap and
   "bass house" is house.

   So two tags agree when one's WORD SET contains the other's. Whole words
   within a short controlled field — not the substring matching that once
   made "Y$" match every artist containing the letter y, because that
   compared arbitrary names character by character. "uk rap" ⊇ "rap" is a
   genre narrowing; "rap" vs "trap" stays a non-match, as it must. */
/* Genre words too broad to carry fit by themselves. Found by inspecting the
   pilot output: Tom Odell's "alternative pop" agreed with 7clouds' "pop" and
   Precious Pepala's "dark pop" did the same, so a ballad and a Latin-pop
   lyric channel came back as a genre match. "Pop" describes most commercial
   music released; agreeing on it is agreeing on almost nothing. These still
   match when BOTH sides say only the broad word, which is honest — it is
   just never enough on its own. */
const BROAD = new Set(['pop', 'music', 'electronic', 'alternative', 'indie', 'urban', 'contemporary']);

export function tagsAgree(x: string, y: string): boolean {
  const a = x.toLowerCase().trim(), b = y.toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const wa = new Set(a.split(/\s+/)), wb = new Set(b.split(/\s+/));
  const sup = (big: Set<string>, small: Set<string>) =>
    small.size > 0 && Array.from(small).every(w => big.has(w));
  if (!(sup(wa, wb) || sup(wb, wa))) return false;
  /* A narrowing match ("dark pop" ⊇ "pop") only counts when the shared part
     is specific. "dark pop" vs "pop" shares only "pop", so it does not. */
  const shared = Array.from(wa).filter(w => wb.has(w));
  return shared.some(w => !BROAD.has(w));
}

export interface Overlap {
  shared: { axis: string; values: string[]; from: Provenance }[];
  uncomparable: string[];
  /** True when at least one axis matched on `stated` or `observed` values. */
  anyHardEvidence: boolean;
}

export function overlap(a: Description, b: Description): Overlap {
  const axes: (keyof Description)[] = ['genre', 'subgenre', 'mood', 'language', 'vocal', 'context', 'treatments'];
  const shared: Overlap['shared'] = [];
  const uncomparable: string[] = [];
  let hard = false;

  for (const axis of axes) {
    const av = (a[axis] as Attr<string[]>).value ?? [];
    const bv = (b[axis] as Attr<string[]>).value ?? [];
    if (!av.length || !bv.length) { uncomparable.push(String(axis)); continue; }
    const hit = av.filter(x => bv.some(y => tagsAgree(x, y)));
    if (!hit.length) continue;
    const from: Provenance =
      (a[axis] as Attr<any>).from === 'stated' && (b[axis] as Attr<any>).from === 'stated' ? 'stated'
      : (a[axis] as Attr<any>).from === 'inferred' || (b[axis] as Attr<any>).from === 'inferred' ? 'inferred'
      : (a[axis] as Attr<any>).from === 'parsed' || (b[axis] as Attr<any>).from === 'parsed' ? 'parsed'
      : 'observed';
    if (from === 'stated' || from === 'observed') hard = true;
    shared.push({ axis: String(axis), values: hit, from });
  }

  const ae = a.energy.value, be = b.energy.value;
  if (ae == null || be == null) uncomparable.push('energy');
  else if (Math.abs(ae - be) <= 1) {
    shared.push({ axis: 'energy', values: [`${ae} vs ${be}`], from: 'stated' });
    hard = true;
  }

  return { shared, uncomparable, anyHardEvidence: hard };
}
