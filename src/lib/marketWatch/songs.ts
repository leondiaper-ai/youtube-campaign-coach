/* ═══════════════════════════════════════════════════════════════════════
   CANONICAL SONGS

   A song record is built from assets that are plausibly RECORDINGS. Shorts,
   tour posts, store drops and album trailers attach to a song; they never
   name one.

   The failures this exists to stop, all seen in the live data:
     "APHRODITE out now" became the heading instead of APHRODITE
     "50 ballerinas. tonight" became the heading instead of 50 ballerinas
     K-Trap store and tour promos entered the recommendation pool as songs

   The rule: a promotional caption can only ever be evidence ABOUT a song.
   Never its name, and never a song in its own right.
   ═══════════════════════════════════════════════════════════════════════ */

export const norm = (s: string) =>
  (s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* Words that mark an upload as promotion or editorial rather than a
   recording. Deliberately broad: a false negative loses one song, a false
   positive puts "tickets on sale now" in front of someone choosing what to
   release. */
const PROMO = new RegExp([
  'out now','out this','available now','pre-?save','presave','pre-?order','link in bio',
  'tickets','tour','on sale','live at the','playing','announce','announcement',
  'merch','store','drop(s|ping)?\\b','vinyl','signed','bundle','limited edition',
  'album trailer','trailer','teaser','snippet','coming soon','this friday','tonight',
  'interview','q&a','behind the scenes','making of','documentary','vlog','episode',
  'reaction','unboxing','thank you','happy birthday','rip\\b','tribute',
  'subscribe','follow me','link below','new music friday','playlist',
].join('|'), 'i');

/* Markers that an upload IS a recording. */
const MUSIC = /\b(official\s*(music\s*)?video|official\s*audio|lyric|visuali[sz]er|audio|live\s+(at|from|session)|acoustic|remix|\(.*mix\)|performance)\b/i;

export type AssetRole = 'recording' | 'short' | 'promo' | 'editorial' | 'unknown';

export interface RawUpload {
  id: string; title: string; publishedAt: string;
  durationSec: number | null; live?: string;
  views: number | null; likes?: number | null; comments?: number | null;
  thumb?: string | null;
}

export const isShort = (u: RawUpload) =>
  u.live !== 'live' && u.live !== 'upcoming' && u.durationSec != null && u.durationSec <= 62;

/** Does the title read "Artist - Title"? */
export function splitCredit(title: string): { credits: string[]; songPart: string } | null {
  /* ── STRIP BRACKETS BEFORE SPLITTING ON THE DASH ───────────────────
     Real title from the roster:
       "The World At Large (Enough Love to Kill Us All / Jeremy Sherrer
        Remix - Official Audio)"
     The separator sits INSIDE the bracket, so splitting first made the
     credit "The World At Large (Enough Love…Remix" and the song name
     "Official Audio)". Packaging is removed first; what remains is the
     part that can carry a credit. */
  const t = (title || '').replace(/#[^\s#]+/g, ' ').replace(/[\[(][^\])]*[\])]?/g, ' ');
  const p = t.split(/\s+[-–—]\s+/);
  if (p.length < 2) return null;
  const credits = p[0].split(/,|&|\bft\.?\b|\bfeat\.?\b|\bx\b|\bvs\.?\b/i)
    .map(x => norm(x)).filter(x => x.length >= 2);
  return { credits, songPart: p.slice(1).join(' - ') };
}

/** Strip packaging to the bare song name. */
export function songName(title: string): string {
  const split = splitCredit(title);
  let core = split ? split.songPart : title;
  core = core.replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ');
  /* Feature credits belong to the record, not to the song's identity. Live
     data had jigitz carrying both "50 ballerinas" and "50 ballerinas ft.
     okgiorgio, Tabi" as separate songs — one record split in two, which
     then splits its Shorts and its evidence in two as well. */
  core = core.replace(/\s+(ft\.?|feat\.?|featuring|with)\s+.*$/i, ' ');
  return core.replace(/\s+/g, ' ').trim();
}

export function classifyAsset(u: RawUpload): AssetRole {
  if (isShort(u)) return 'short';
  const t = u.title || '';
  const promo = PROMO.test(t);
  const hasCredit = !!splitCredit(t);
  const music = MUSIC.test(t);

  /* A credited title with a music marker is a recording even if the words
     also look promotional — "Artist - Song (Official Video)" wins. */
  if (hasCredit && music) return 'recording';
  if (promo) return /interview|behind the scenes|making of|documentary|vlog|episode|q&a/i.test(t) ? 'editorial' : 'promo';
  if (hasCredit && u.durationSec != null && u.durationSec >= 60 && u.durationSec < 900) return 'recording';
  if (music) return 'recording';
  return 'unknown';
}

export interface Song {
  key: string;
  /** The display name, taken from a recording — never from a caption. */
  name: string;
  artistCredit: string | null;
  recordings: RawUpload[];
  shorts: RawUpload[];
  promos: RawUpload[];
  /** Attached by title containment; the link is textual, not confirmed. */
  uncertain: RawUpload[];
  firstSeen: string; latestSeen: string;
  treatments: string[];
}

const TREATMENTS: [RegExp, string][] = [
  [/\bofficial\s*(music\s*)?video\b/i, 'official video'],
  [/\blyric|letra|testo\b/i, 'lyric'],
  [/\bvisuali[sz]er\b/i, 'visualiser'],
  [/\bremix\b/i, 'remix'],
  [/\b(edit|flip|bootleg|rework)\b/i, 'edit'],
  [/\bsped\s*up\b/i, 'sped up'],
  [/\bslowed\b|\breverb\b/i, 'slowed'],
  [/\bacoustic\b|\bstripped\b|\bunplugged\b/i, 'acoustic'],
  [/\blive\s+(at|from|session)\b|\bsession\b|\bperformance\b/i, 'performance'],
  [/\binstrumental\b/i, 'instrumental'],
  [/\bofficial\s*audio\b|\baudio\b/i, 'audio'],
];
export const treatmentsOf = (title: string) =>
  TREATMENTS.filter(([re]) => re.test(title)).map(([, n]) => n);

/**
 * Build canonical songs from one channel's uploads.
 *
 * Two passes, and the order is the whole point: recordings establish the
 * songs and their names, then everything else attaches to them. A Short can
 * never create a song, so "APHRODITE out now" attaches to APHRODITE instead
 * of becoming a second entry titled after the caption.
 */
export function buildSongs(uploads: RawUpload[], artistName?: string): Song[] {
  const byKey = new Map<string, Song>();
  const artistN = artistName ? norm(artistName) : null;

  for (const u of uploads) {
    if (classifyAsset(u) !== 'recording') continue;
    let name = songName(u.title);
    /* ── SOME CHANNELS TITLE IT THE OTHER WAY ROUND ─────────────────
       Hermanos Espinoza publish "29:11 - Hermanos Espinoza (Lyric
       Video)" — song first, artist second. Read left-to-right that
       makes every one of their songs "Hermanos Espinoza", collapsing a
       whole catalogue into one record. When the name we derived IS the
       artist, the title is reversed and the other side is the song. */
    if (artistN && norm(name) === artistN) {
      const flipped = splitCredit(u.title);
      const lead = flipped ? flipped.credits.join(' ') : '';
      if (lead && norm(lead) !== artistN) name = u.title
        .replace(/#[^\s#]+/g, ' ').replace(/[\[(][^\])]*[\])]?/g, ' ')
        .split(/\s+[-–—]\s+/)[0].replace(/\s+/g, ' ').trim();
    }
    const key = norm(name);
    if (!key || key.length < 2) continue;
    if (!byKey.has(key)) {
      const split = splitCredit(u.title);
      byKey.set(key, {
        key, name, artistCredit: split ? split.credits.join(', ') : null,
        recordings: [], shorts: [], promos: [], uncertain: [],
        firstSeen: u.publishedAt, latestSeen: u.publishedAt, treatments: [],
      });
    }
    const s = byKey.get(key)!;
    s.recordings.push(u);
    /* Prefer the plainest name: an official video title beats a remix title
       for naming the song. */
    if (/official\s*(music\s*)?video/i.test(u.title) && !/remix|edit|sped|slowed/i.test(u.title)) {
      s.name = songName(u.title);
    }
  }

  const keys = Array.from(byKey.keys()).sort((a, b) => b.length - a.length);

  for (const u of uploads) {
    const role = classifyAsset(u);
    if (role === 'recording') continue;
    const hay = norm(u.title);
    /* Longest key first, so "aphrodite remix" does not capture a Short that
       belongs to "aphrodite". Minimum four characters, because short song
       names collide with ordinary words. */
    const hit = keys.find(k => k.length >= 4 && hay.includes(k));
    if (!hit) continue;
    const s = byKey.get(hit)!;
    if (role === 'short') s.shorts.push(u);
    else if (role === 'promo') s.promos.push(u);
    else s.uncertain.push(u);
  }

  const out = Array.from(byKey.values());
  for (const s of out) {
    const all = [...s.recordings, ...s.shorts];
    const dates = all.map(x => x.publishedAt).sort();
    s.firstSeen = dates[0] ?? s.firstSeen;
    s.latestSeen = dates[dates.length - 1] ?? s.latestSeen;
    s.treatments = Array.from(new Set(s.recordings.flatMap(r => treatmentsOf(r.title))));
  }
  return out.sort((a, b) => b.latestSeen.localeCompare(a.latestSeen));
}
