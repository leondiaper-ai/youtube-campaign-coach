/* Manual, batched collection. Never scheduled. */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { collectBatch, collectArtistCatalogue } from '@/lib/marketWatch/collect';
import { MW_REGISTRY } from '@/lib/marketWatch/channels';
import { getAllArtists } from '@/lib/marketScope';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await authorised())) return notFound();
  let keys: string[] = [], artists: string[] = [];
  try { const b = await req.json(); keys = b?.keys ?? []; artists = b?.artists ?? []; } catch { /* default below */ }

  /* Artist catalogues: a deliberately short list, fetched on request. Never
     the whole roster — 252 artists at a full uploads walk is not a thing
     anyone should be able to trigger with one click. */
  if (artists.length) {
    if (artists.length > 12) return Response.json({ ok:false, error:'at most 12 artists per request' }, { status:400 });
    const all = await getAllArtists();
    const done: any[] = [], failed: any[] = [];
    for (const slug of artists) {
      const a = all.find(x => x.slug === slug);
      if (!a?.channelHandle) { failed.push({ slug, error:'no channel handle' }); continue; }
      try {
        const c = await collectArtistCatalogue(slug, a.name, a.channelHandle);
        done.push({ slug, retrieved:c.retrieved, oldest:c.oldest, reachedEnd:c.reachedEnd, cappedAt:c.cappedAt });
      } catch (e) { failed.push({ slug, error:(e as Error).message }); }
    }
    return Response.json({ ok:true, artists:done, failed });
  }
  if (!keys.length) keys = MW_REGISTRY.map(c => c.key);
  try {
    const r = await collectBatch(keys);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
export async function GET() { return notFound(); }
