/* Song shortlist candidates and the shortlist itself.
 *
 *   GET                       three lenses + diagnostics + saved shortlist
 *   POST { save: entry }      add to the owned-channel shortlist
 *   POST { remove: key }      undo
 *
 * Reads Watcher's stored data. Writes only under mw:.
 */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import {
  buildShortlistCandidates, readShortlist, saveShortlist, removeShortlist,
  type ShortlistEntry,
} from '@/lib/marketWatch/shortlist';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store' } });

export async function GET(req: Request) {
  if (!(await authorised())) return notFound();
  const q = new URL(req.url).searchParams;
  const windowDays = Math.min(90, Math.max(2, Number(q.get('window')) || 7));
  const perLens = Math.min(8, Math.max(1, Number(q.get('per')) || 4));

  const { cards, diagnostics } = await buildShortlistCandidates({ windowDays, perLens });
  return json({ cards, diagnostics, shortlist: await readShortlist() });
}

export async function POST(req: Request) {
  if (!(await authorised())) return notFound();
  const body = await req.json().catch(() => null) as any;
  if (!body) return json({ error: 'Body must be JSON.' }, 400);

  if (body.remove) {
    await removeShortlist(String(body.remove));
    return json({ ok: true, shortlist: await readShortlist() });
  }

  const s = body.save;
  if (!s?.key || !s?.slug || !s?.song) return json({ error: 'save needs key, slug and song.' }, 400);

  const kinds = ['owned', 'reference', 'undecided'];
  const entry: ShortlistEntry = {
    key: String(s.key), slug: String(s.slug), artist: String(s.artist ?? ''), song: String(s.song),
    featuredId: String(s.featuredId ?? ''), featuredTitle: String(s.featuredTitle ?? ''),
    lens: s.lens,
    destination: String(s.destination ?? '').trim() || 'Destination to decide',
    /* A market channel is a REFERENCE, never a destination we control, and
       the two must not blur in a list someone later acts on. */
    destinationKind: kinds.includes(s.destinationKind) ? s.destinationKind : 'undecided',
    treatment: String(s.treatment ?? '').trim() || 'Treatment to decide',
    note: s.note ? String(s.note).slice(0, 500) : undefined,
    /* Permission is recorded separately from monitoring, and defaults to
       unknown however the song got here. */
    permission: ['cleared', 'blocked'].includes(s.permission) ? s.permission : 'unknown',
    savedAt: new Date().toISOString(),
  };
  await saveShortlist(entry);
  return json({ ok: true, shortlist: await readShortlist() });
}
