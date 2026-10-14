/* ═══════════════════════════════════════════════════════════════════════
   CONNECTING WATCHED ARTISTS TO MARKET DESTINATIONS

   Reads Watcher's existing artist list and cached channel snapshots. No new
   fetching, no writes to production records — Market Watch keeps its own
   annotations under mw:.

   THREE STATUSES THAT ARE NOT THE SAME THING, and the reason this file is
   careful about them:

     monitored  — the artist appears in Watcher. Nothing more.
     ownership  — 'virgin' means VMG has a revenue interest recorded here.
                  It does NOT mean VMG controls the recording.
     permission — whether anybody may cut a new version, licence it to a
                  third-party channel, or authorise a placement. NOT RECORDED
                  ANYWHERE in this codebase. Always unknown.

   A test suggestion that quietly assumes the third from the first is how a
   tool like this causes a real problem, so `permission: 'unknown'` is
   attached to every suggestion and rendered, not buried.
   ═══════════════════════════════════════════════════════════════════════ */

import { getAllArtists } from '@/lib/marketScope';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import type { Artist, RecentUpload } from '@/lib/artists';
import { readAll, type MwChannelData } from './collect';

/* ── Containers and treatments are separate axes ──────────────────────
   A remix can be a Short. A lyric video can be long-form. Treatments are
   a LIST, because "Sped Up Lyric Video" is both. */
export type Container = 'short' | 'video' | 'long' | 'live' | 'unknown';
export const container = (durationSec: number | null | undefined, live?: string): Container => {
  if (live === 'live' || live === 'upcoming') return 'live';
  if (durationSec == null) return 'unknown';
  if (durationSec <= 62) return 'short';
  if (durationSec >= 900) return 'long';
  return 'video';
};

const TREATMENTS: [RegExp, string][] = [
  [/\bsped\s*up\b|\bspeed\s*up\b/i, 'sped up'],
  [/\bslowed\b|\breverb\b/i, 'slowed'],
  [/\bremix\b/i, 'remix'],
  [/\b(edit|flip|bootleg|rework|mashup)\b/i, 'edit'],
  [/\blyric|letra|testo\b/i, 'lyric'],
  [/\bvisuali[sz]er\b/i, 'visualiser'],
  [/\bacoustic\b|\bstripped\b|\bunplugged\b/i, 'acoustic'],
  [/\blive\b|\bsession\b|\bperformance\b|\bconcert\b/i, 'performance'],
  [/\binstrumental\b/i, 'instrumental'],
  [/\b(behind the scenes|bts|making of|documentary|interview)\b/i, 'editorial'],
  [/\bofficial\s*(music\s*)?video\b/i, 'official video'],
  [/\baudio\b/i, 'audio'],
];
export const treatments = (title: string): string[] => {
  const out = TREATMENTS.filter(([re]) => re.test(title)).map(([, n]) => n);
  return out.length ? out : ['untagged'];
};

export const norm = (s: string) =>
  (s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Strip packaging so two uploads of one song share a key. */
export function songKey(title: string): string {
  let t = (title || '').replace(/#[^\s#]+/g, ' ');
  t = t.replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ');          // bracketed packaging
  const parts = t.split(/\s+[-–—]\s+/);
  const core = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return norm(core);
}
export function artistFromTitle(title: string): string | null {
  const t = (title || '').replace(/#[^\s#]+/g, ' ');
  const p = t.split(/\s+[-–—]\s+/);
  return p.length > 1 ? p[0].trim() : null;
}

/* ── Evidence for one song on the artist's own channel ────────────── */
export interface TrackAsset {
  id: string; title: string; publishedAt: string; url: string;
  container: Container; treatments: string[];
  views: number | null; likes: number | null; comments: number | null;
  ageDays: number;
}
export interface TrackEvidence {
  slug: string; artistName: string; ownership: string; monitored: true;
  /** Never inferred from monitoring. Always unknown here. */
  permission: 'unknown';
  songKey: string; title: string;
  firstSeen: string; latestSeen: string;
  assets: TrackAsset[];
  containers: Record<string, number>;
  treatmentsFound: string[];
  treatmentsNotFound: string[];
  /** Shorts whose title contains the song name — connection is textual. */
  shortsLinked: TrackAsset[];
  shortsAmbiguous: number;
  /** Where this appears across the collected market channels. */
  marketAppearances: { channel: string; title: string; url: string; publishedAt: string; views: number | null }[];
}

const ALL_TREATMENTS = ['official video','lyric','visualiser','remix','sped up','slowed','acoustic','performance','instrumental','audio','editorial'];

export interface VirginArtistSummary {
  slug: string; name: string; handle: string | null;
  ownership: string; markets: string[];
  uploads: number; tracks: number; lastUpload: string | null;
}

export async function listWatchedArtists(): Promise<VirginArtistSummary[]> {
  const artists = await getAllArtists();
  const out: VirginArtistSummary[] = [];
  for (const a of artists) {
    if (!a.channelHandle) continue;
    const snap = await readLiveSnapByHandle(a.channelHandle).catch(() => null);
    const ups: RecentUpload[] = snap?.recentUploads ?? [];
    const keys = new Set(ups.map(u => songKey(u.title)).filter(Boolean));
    out.push({
      slug: a.slug, name: a.name, handle: a.channelHandle,
      ownership: a.ownership ?? 'observed',
      markets: a.markets ?? ['uk'],
      uploads: ups.length, tracks: keys.size,
      lastUpload: ups.length ? ups.map(u => u.publishedAt).sort().slice(-1)[0] : null,
    });
  }
  return out.sort((x, y) => y.uploads - x.uploads);
}

/** Every distinct song on a watched artist's channel, with its assets. */
export async function tracksForArtist(slug: string): Promise<TrackEvidence[]> {
  const artists = await getAllArtists();
  const a = artists.find((x: Artist) => x.slug === slug);
  if (!a?.channelHandle) return [];
  const snap = await readLiveSnapByHandle(a.channelHandle).catch(() => null);
  const ups: RecentUpload[] = snap?.recentUploads ?? [];
  if (!ups.length) return [];

  const market = await readAll();

  const groups = new Map<string, RecentUpload[]>();
  for (const u of ups) {
    const k = songKey(u.title);
    if (!k || k.length < 3) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(u);
  }

  const out: TrackEvidence[] = [];
  groups.forEach((list, key) => {
    const sorted = [...list].sort((x, y) => x.publishedAt.localeCompare(y.publishedAt));
    const assets: TrackAsset[] = sorted.map(u => ({
      id: u.id, title: u.title, publishedAt: u.publishedAt,
      url: `https://www.youtube.com/watch?v=${u.id}`,
      container: container(u.durationSec, u.live),
      treatments: treatments(u.title),
      views: u.viewCount ?? null, likes: u.likeCount ?? null,
      comments: (u as any).commentCount ?? null,
      ageDays: Math.max(0, Math.floor((Date.now() - Date.parse(u.publishedAt)) / 864e5)),
    }));

    const containers: Record<string, number> = {};
    assets.forEach(x => { containers[x.container] = (containers[x.container] || 0) + 1; });
    const found = Array.from(new Set(assets.flatMap(x => x.treatments))).filter(t => t !== 'untagged');

    /* A Short counts as linked only when the song's words appear in its
       title. A Short titled "new one out now" may well be this song; the
       title does not say so, and guessing would manufacture evidence. */
    const shortsLinked = assets.filter(x => x.container === 'short' && songKey(x.title) === key);
    const shortsAmbiguous = ups.filter(u =>
      container(u.durationSec, u.live) === 'short' && songKey(u.title) !== key &&
      norm(u.title).includes(key.split(' ')[0] ?? '~~')).length;

    const marketAppearances: TrackEvidence['marketAppearances'] = [];
    for (const ch of market) {
      for (const v of ch.items) {
        if (songKey(v.title) !== key) continue;
        marketAppearances.push({ channel: ch.name, title: v.title,
          url: `https://www.youtube.com/watch?v=${v.id}`, publishedAt: v.publishedAt, views: v.views });
      }
    }

    out.push({
      slug: a.slug, artistName: a.name, ownership: a.ownership ?? 'observed',
      monitored: true, permission: 'unknown',
      songKey: key, title: sorted[0].title,
      firstSeen: sorted[0].publishedAt, latestSeen: sorted[sorted.length - 1].publishedAt,
      assets, containers, treatmentsFound: found,
      treatmentsNotFound: ALL_TREATMENTS.filter(t => !found.includes(t)),
      shortsLinked, shortsAmbiguous, marketAppearances,
    });
  });

  return out.sort((x, y) => y.latestSeen.localeCompare(x.latestSeen));
}

/* ── Test suggestions ─────────────────────────────────────────────────
   Deliberately conservative, and deliberately not scored. Every suggestion
   must name a market channel that has actually published comparable
   repertoire, and must state what would make it wrong.

   Returns an empty list — surfaced as "insufficient evidence" — rather
   than inventing a pairing, which is the honest answer far more often
   than a tool like this likes to admit. */
export interface Suggestion {
  track: string; artistName: string;
  destination: string; destinationRole: string; destinationRelationship: string;
  asset: string;
  why: string;
  watcherEvidence: string[];
  marketExamples: { label: string; url: string; note: string }[];
  comparability: string;
  counterEvidence: string[];
  existingAssets: string[];
  permission: 'unknown';
  test: string;
  review: string;
}

export async function suggestionsFor(slug: string, key: string): Promise<{ suggestions: Suggestion[]; reason?: string }> {
  const tracks = await tracksForArtist(slug);
  const t = tracks.find(x => x.songKey === key);
  if (!t) return { suggestions: [], reason: 'Track not found in the cached inventory for this artist.' };

  const market = await readAll();
  if (!market.length) return { suggestions: [], reason: 'No market channels collected yet.' };

  const artistNorm = norm(t.artistName);
  const out: Suggestion[] = [];

  for (const ch of market) {
    if (!ch.items.length) continue;

    /* Has this destination published this artist before? That is the
       strongest editorial-fit evidence available from public data, and it
       is still only evidence of fit, not of outcome. */
    const sameArtist = ch.items.filter(v => {
      const a = artistFromTitle(v.title);
      return a ? norm(a).includes(artistNorm) || artistNorm.includes(norm(a)) : false;
    });
    if (!sameArtist.length) continue;

    const recent = sameArtist.filter(v => Date.parse(v.publishedAt) >= Date.now() - 540 * 864e5);
    if (!recent.length) continue;

    const vws = sameArtist.map(v => v.views).filter((x): x is number => x != null).sort((p, q) => p - q);
    const med = vws.length ? vws[Math.floor(vws.length / 2)] : null;

    /* Which treatment to propose: one this destination repeatedly uses and
       the track does not yet have. */
    const chTreat: Record<string, number> = {};
    ch.items.slice(0, 200).forEach(v => treatments(v.title).forEach(x => { if (x !== 'untagged') chTreat[x] = (chTreat[x] || 0) + 1; }));
    const gap = Object.entries(chTreat)
      .sort((p, q) => q[1] - p[1])
      .find(([name]) => t.treatmentsNotFound.includes(name));
    if (!gap) continue;

    out.push({
      track: t.title, artistName: t.artistName,
      destination: ch.name, destinationRole: ch.role, destinationRelationship: ch.relationship,
      asset: `${gap[0]} treatment`,
      why: `${ch.name} has published ${sameArtist.length} upload(s) involving ${t.artistName}, ${recent.length} within 18 months, and uses the "${gap[0]}" treatment on ${gap[1]} of its last 200 uploads. This track has no ${gap[0]} asset in our coverage.`,
      watcherEvidence: [
        `${t.assets.length} asset(s) for this song on the artist channel, first ${t.firstSeen.slice(0, 10)}`,
        `Containers: ${Object.entries(t.containers).map(([k, n]) => `${k} ${n}`).join(', ')}`,
        t.shortsLinked.length ? `${t.shortsLinked.length} Short(s) titled with this song` : 'No Shorts titled with this song',
      ],
      marketExamples: sameArtist.slice(0, 3).map(v => ({
        label: v.title.slice(0, 70),
        url: `https://www.youtube.com/watch?v=${v.id}`,
        note: `${ch.name}, ${v.publishedAt.slice(0, 10)}${v.views != null ? `, ${v.views.toLocaleString()} lifetime views` : ''}`,
      })),
      comparability: `Same artist, same destination, so editorial fit is observed rather than assumed. Comparable on repertoire only — not on release moment, promotion, or anything happening off-platform. ${med != null ? `That channel's median across these uploads is ${med.toLocaleString()} lifetime views; lifetime totals favour older uploads and are not first-week performance.` : 'Too few readings for a median.'}`,
      counterEvidence: [
        ch.relationship === 'external_reference'
          ? 'This destination is independently operated — a placement would need a commercial conversation, not just a decision.'
          : 'Network relationship recorded from public reporting, not from a contract we hold.',
        `Nothing here measures whether a ${gap[0]} asset caused anything. Lifetime views of other uploads cannot establish that.`,
        t.assets.length < 2 ? 'Only one asset exists for this song, so there is no within-track comparison to learn from.' : '',
      ].filter(Boolean),
      existingAssets: t.treatmentsFound.length ? t.treatmentsFound : ['none tagged'],
      permission: 'unknown',
      test: `Produce one ${gap[0]} asset for "${t.title}" and place it on ${ch.name}. Hold the artist channel's own publishing steady for the window so the placement is the only change.`,
      review: `Compare the placement's first 28 days against ${ch.name}'s own median for the same treatment over the same period, and against this artist's existing assets. Decide in advance what result would count as nothing happening.`,
    });
  }

  if (!out.length) {
    return { suggestions: [], reason:
      `No collected market channel has published ${t.artistName} within 18 months, so there is no observed editorial fit to build a suggestion on. Expanding channel coverage, or picking a track from an artist with wider market presence, would change this.` };
  }
  return { suggestions: out.slice(0, 3) };
}
