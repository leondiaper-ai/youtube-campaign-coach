/* The connection layer, both directions.
 *
 *   GET ?artist=slug                 canonical songs for one watched artist
 *   GET ?artist=slug&song=key        track-first shortlist
 *   GET ?destination=key             destination-first shortlist
 *   GET ?destinations=1              all collected destination profiles
 *   POST { kind, id, description }   store reviewed tags
 *   POST { feedback: {...} }         record a verdict
 *
 * Reads Watcher's stored data. Writes only under mw:.
 */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import {
  candidatesForSong, candidatesForDestination, allDestinationProfiles,
  songsForArtist, describeSong,
} from '@/lib/marketWatch/connect';
import { writeStated, readStated, type Description } from '@/lib/marketWatch/descriptors';
import { writeFeedback, readFeedback, tally, type Verdict } from '@/lib/marketWatch/feedback';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store' } });

export async function GET(req: Request) {
  if (!(await authorised())) return notFound();
  const q = new URL(req.url).searchParams;

  if (q.get('destinations')) {
    return json({ destinations: await allDestinationProfiles(), feedback: await readFeedback() });
  }

  const dest = q.get('destination');
  if (dest) return json({ ...(await candidatesForDestination(dest, { limit: 12 })), feedback: await readFeedback() });

  const slug = q.get('artist');
  if (!slug) return json({ error: 'Pass artist, destination, or destinations=1.' }, 400);

  const song = q.get('song');
  if (song) return json({ ...(await candidatesForSong(slug, song)), feedback: await readFeedback() });

  /* Canonical songs with their descriptions, so the UI can show what is
     known and what Leon still needs to supply. */
  const songs = await songsForArtist(slug);
  const out = [];
  for (const s of songs.slice(0, 40)) {
    const stated = await readStated('track', `${slug}:${s.key}`);
    out.push({
      key: s.key, name: s.name, artistCredit: s.artistCredit,
      firstSeen: s.firstSeen, latestSeen: s.latestSeen, treatments: s.treatments,
      counts: {
        recordings: s.recordings.length, shorts: s.shorts.length,
        promos: s.promos.length, uncertain: s.uncertain.length,
      },
      recordings: s.recordings.slice(0, 3).map(r => ({
        id: r.id, title: r.title, url: `https://www.youtube.com/watch?v=${r.id}`,
        publishedAt: r.publishedAt, views: r.views,
      })),
      /* Shown separately and never folded into the song's own evidence. */
      uncertainLinks: s.uncertain.slice(0, 5).map(r => ({ id: r.id, title: r.title })),
      promoAttachments: s.promos.slice(0, 5).map(r => ({ id: r.id, title: r.title })),
      description: describeSong(s, stated),
      hasStatedTags: !!stated,
    });
  }
  return json({ songs: out });
}

export async function POST(req: Request) {
  if (!(await authorised())) return notFound();
  const body = await req.json().catch(() => null) as any;
  if (!body) return json({ error: 'Body must be JSON.' }, 400);

  if (body.feedback) {
    const f = body.feedback as { id?: string; verdict?: Verdict; note?: string };
    const ok: Verdict[] = ['useful', 'obvious', 'unsuitable', 'unsupported'];
    if (!f.id || !f.verdict || !ok.includes(f.verdict)) {
      return json({ error: `feedback needs id and verdict one of ${ok.join(', ')}.` }, 400);
    }
    await writeFeedback({ id: f.id, verdict: f.verdict, note: f.note, at: new Date().toISOString() });
    const all = await readFeedback();
    return json({ saved: true, tally: tally(all) });
  }

  const kind = body.kind as 'track' | 'dest';
  if (kind !== 'track' && kind !== 'dest') return json({ error: 'kind must be track or dest.' }, 400);
  if (!body.id || typeof body.id !== 'string') return json({ error: 'id required.' }, 400);

  /* Anything arriving here is something Leon typed or reviewed, so it is
     stored as `stated` regardless of what the client claimed. */
  const d = body.description ?? {};
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean)
    : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
  const stated: Partial<Description> = {};
  for (const axis of ['genre', 'subgenre', 'mood', 'language', 'vocal', 'context', 'treatments'] as const) {
    if (d[axis] != null) stated[axis] = { value: asList(d[axis]), from: 'stated' } as any;
  }
  if (d.energy != null && d.energy !== '') {
    const n = Number(d.energy);
    if (Number.isFinite(n) && n >= 1 && n <= 5) stated.energy = { value: n, from: 'stated' };
  }
  if (typeof d.summary === 'string' && d.summary.trim()) {
    stated.summary = { value: d.summary.trim(), from: 'stated' };
  }

  const saved = await writeStated(kind, body.id, stated);
  return json({ saved, stored: stated });
}
