/* Manual, batched collection. Never scheduled. */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { collectBatch } from '@/lib/marketWatch/collect';
import { MW_REGISTRY } from '@/lib/marketWatch/channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await authorised())) return notFound();
  let keys: string[] = [];
  try { keys = (await req.json())?.keys ?? []; } catch { /* default below */ }
  if (!keys.length) keys = MW_REGISTRY.map(c => c.key);
  try {
    const r = await collectBatch(keys);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
export async function GET() { return notFound(); }
