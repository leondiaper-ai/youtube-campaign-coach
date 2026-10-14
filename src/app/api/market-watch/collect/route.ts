/* Manual collection. Never scheduled: nothing here is added to the cron,
   so it cannot consume shared quota in the background. */
import { authorised, notFound } from '@/lib/marketWatch/gate';
import { collectMarketWatch, saveCollection } from '@/lib/marketWatch/collect';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  if (!(await authorised())) return notFound();
  try {
    const c = await collectMarketWatch();
    const stored = await saveCollection(c);
    return Response.json({
      ok: true, stored,
      collectedAt: c.collectedAt, quotaUnits: c.quotaUnits,
      channels: c.channels.map(x => ({ name: x.name, retrieved: x.retrieved, complete: x.complete, statsMissing: x.statsMissing })),
      errors: c.errors,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() { return notFound(); }
