/* Watched-artist evidence. Reads Watcher's stored data; writes nothing. */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { listWatchedArtists, tracksForArtist, suggestionsFor } from '@/lib/marketWatch/virgin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!(await authorised())) return notFound();
  const u = new URL(req.url);
  const slug = u.searchParams.get('artist');
  const key = u.searchParams.get('track');

  if (slug && key) return Response.json(await suggestionsFor(slug, key), { headers:{'cache-control':'no-store'} });
  if (slug)        return Response.json({ tracks: await tracksForArtist(slug) }, { headers:{'cache-control':'no-store'} });
  return Response.json({ artists: await listWatchedArtists() }, { headers:{'cache-control':'no-store'} });
}
