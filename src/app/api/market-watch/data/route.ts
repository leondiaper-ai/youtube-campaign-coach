/* Read what was collected. Gated identically to everything else — the
   data route is not a side door around the page. */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { loadCollection } from '@/lib/marketWatch/collect';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await authorised())) return notFound();
  const c = await loadCollection();
  return Response.json(c ?? { empty: true }, {
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
