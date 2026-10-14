import { authorised, notFound } from '@/lib/marketWatch/gate';
import { readAll, readIndex, readChannel } from '@/lib/marketWatch/collect';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await authorised())) return notFound();
  const url = new URL(req.url);
  const key = url.searchParams.get('channel');
  const indexOnly = url.searchParams.get('index') === '1';

  const body = key ? await readChannel(key)
             : indexOnly ? { index: await readIndex() }
             : { channels: await readAll() };

  return Response.json(body ?? { empty: true }, {
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
