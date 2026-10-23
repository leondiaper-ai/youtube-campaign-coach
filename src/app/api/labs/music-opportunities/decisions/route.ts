import { labsEnabled, sameOrigin } from '@/lib/labs/musicOpportunities/gate';
import { labsStore, readAllObservations, readHumanLabels } from '@/lib/labs/musicOpportunities/store';
import { loadCatalogue } from '@/lib/labs/musicOpportunities/catalogue';
import { buildOpportunities } from '@/lib/labs/musicOpportunities/opportunities';
import { mergeObservations, seedObservations } from '@/lib/labs/musicOpportunities/sources/youtubeCharts';
import { recordDecision } from '@/lib/labs/musicOpportunities/decisions';
import type { Decision, Stage } from '@/lib/labs/musicOpportunities/types';

export const dynamic = 'force-dynamic';

const STAGES: Stage[] = ['monitor', 'act-editorially', 'consider-paid-test'];
const clip = (v: unknown, n = 600) => typeof v === 'string' ? v.trim().slice(0, n) : '';

/**
 * POST { opportunityId, stage, actualAction?, notes?, test? }
 * The opportunity is rebuilt server-side from stored evidence so a client
 * cannot submit figures that were never observed. Production: 404.
 */
export async function POST(req: Request) {
  if (!labsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!labsStore()) return Response.json({ error: 'Preview storage is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { opportunityId?: string; stage?: Stage; actualAction?: string; notes?: string; test?: Record<string, unknown> } | null;
  if (!body?.opportunityId || !body.stage || !STAGES.includes(body.stage)) return Response.json({ error: 'Opportunity and stage are required.' }, { status: 400 });
  const human = await readHumanLabels().catch(() => []);
  const [stored, catalogue] = await Promise.all([readAllObservations(), loadCatalogue(human)]);
  const observations = mergeObservations(seedObservations(), stored);
  const opportunity = buildOpportunities(observations, catalogue).find(o => o.id === body.opportunityId);
  if (!opportunity) return Response.json({ error: 'That opportunity is no longer in the stored evidence.' }, { status: 404 });
  let test: Decision['test'] = null;
  if (body.stage === 'consider-paid-test') {
    const t = body.test ?? {};
    test = { territory: clip(t.territory, 20) || opportunity.signal.territory, whyTimely: clip(t.whyTimely), creative: clip(t.creative), destination: clip(t.destination),
      organicBaseline: clip(t.organicBaseline), learningGoal: clip(t.learningGoal), successCriteria: clip(t.successCriteria), stopCriteria: clip(t.stopCriteria) };
    const missing = Object.entries(test).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return Response.json({ error: `A paid-test consideration needs: ${missing.join(', ')}.` }, { status: 400 });
    if (/£|\$|€|\bbudget\b|\broi\b|\brevenue\b/i.test(Object.values(test).join(' '))) return Response.json({ error: 'Leave budgets, returns and revenue out of the record; this sandbox does not estimate spend.' }, { status: 400 });
  }
  const decision = await recordDecision({ opportunity, stage: body.stage, actualAction: clip(body.actualAction), notes: clip(body.notes), test });
  return Response.json({ ok: true, id: decision.id });
}
