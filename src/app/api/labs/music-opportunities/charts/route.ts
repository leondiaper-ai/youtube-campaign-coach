import { labsEnabled, sameOrigin } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, saveObservation, withLock } from '@/lib/labs/musicOpportunities/store';
import { collectMostPopularMusic, DATA_API_REGIONS, dataApiConfigured } from '@/lib/labs/musicOpportunities/sources/dataApi';
import { CM_CHARTS, CM_TERRITORIES, chartmetricConfigured, collectChartmetric, type CmChart } from '@/lib/labs/musicOpportunities/sources/chartmetric';
import { appendFollowUps } from '@/lib/labs/musicOpportunities/decisions';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Same source, measure and territory: no more often than hourly. The Data API list is read once a day in practice. */
const COOLDOWN_MS = 3600000;

/**
 * POST { source: 'youtube-data-api', region } | { source: 'chartmetric', chart, territory }
 * One chart per request, like the Owned Channels collector. Production: 404.
 */
export async function POST(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const store = labsStore();
  if (!store) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { source?: string; region?: string; chart?: string; territory?: string } | null;
  try {
    if (body?.source === 'youtube-data-api') {
      const region = String(body.region ?? '').toUpperCase();
      if (!DATA_API_REGIONS.includes(region as typeof DATA_API_REGIONS[number])) return Response.json({ error: 'Region is not on the allowlist.' }, { status: 400 });
      if (!dataApiConfigured()) return Response.json({ error: 'YouTube access is not configured for this preview.' }, { status: 503 });
      return Response.json(await withLock(`charts:dataapi:${region}`, 90, async () => {
        const last = await store.get<string>(`labs:mo:v1:cooldown:dataapi:${region}`);
        if (last && Date.now() - Date.parse(last) < COOLDOWN_MS) return { ok: true, cached: true, message: `${region} was read less than an hour ago.` };
        const { observation, units } = await collectMostPopularMusic(region);
        const { replaced } = await saveObservation(observation);
        await store.set(`labs:mo:v1:cooldown:dataapi:${region}`, observation.collectedAt, { ex: 86400 });
        const followUps = await appendFollowUps().catch(() => 0);
        return { ok: true, saved: observation.id, rows: observation.entries.length, units, replaced, followUps };
      }));
    }
    if (body?.source === 'chartmetric') {
      const chart = String(body.chart ?? '') as CmChart;
      const territory = String(body.territory ?? '').toUpperCase();
      if (!(chart in CM_CHARTS)) return Response.json({ error: 'Unknown chart.' }, { status: 400 });
      if (!CM_TERRITORIES.includes(territory as typeof CM_TERRITORIES[number])) return Response.json({ error: 'Territory is not on the allowlist.' }, { status: 400 });
      if (!chartmetricConfigured()) return Response.json({ error: 'Chartmetric is not configured in this environment.' }, { status: 503 });
      return Response.json(await withLock(`charts:cm:${chart}:${territory}`, 90, async () => {
        const last = await store.get<string>(`labs:mo:v1:cooldown:cm:${chart}:${territory}`);
        if (last && Date.now() - Date.parse(last) < COOLDOWN_MS) return { ok: true, cached: true, message: `${chart} ${territory} was read less than an hour ago.` };
        const { observation, status } = await collectChartmetric(chart, territory);
        const { replaced } = await saveObservation(observation);
        await store.set(`labs:mo:v1:cooldown:cm:${chart}:${territory}`, observation.collectedAt, { ex: 86400 });
        const followUps = await appendFollowUps().catch(() => 0);
        return { ok: true, saved: observation.id, rows: observation.entries.length, period: observation.period, status, replaced, followUps };
      }));
    }
    return Response.json({ error: 'Unknown source.' }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error && /^(YouTube |Chartmetric |Already |Region |Territory |Preview )/.test(e.message) ? e.message : 'Could not read this chart. Nothing was saved.';
    return Response.json({ error: message }, { status: /^Already/.test(message) ? 429 : 502 });
  }
}
