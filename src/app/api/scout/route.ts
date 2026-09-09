/**
 * SCOUT — MANUAL RUN
 *
 * POST only. A GET that spends 100-unit search calls is a GET that gets
 * spent by a link preview or a browser prefetch.
 *
 * No schedule, no UI. The brief is explicit: prove Scout finds something
 * before deciding how to deliver it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runScout, investigateStored, summarise } from '@/lib/scout/run';
import { listScoutChannels, estimateObservationQuota } from '@/lib/scout/channelStore';
import { listCaseStudies, listRecentFindings } from '@/lib/knowledge/store';
import { readSpend, SCOUT_DAILY_BUDGET } from '@/lib/youtube/discovery';
import { MISSIONS } from '@/lib/scout/missions';
import type { MissionId } from '@/lib/scout/missions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Reads only. Never triggers a run. */
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');

  if (view === 'missions') {
    return NextResponse.json({
      missions: MISSIONS.map(m => ({
        id: m.id, question: m.question, active: m.active,
        rationale: m.rationale, queries: m.queries, cannotConclude: m.cannotConclude,
      })),
    });
  }
  if (view === 'case-studies') {
    return NextResponse.json({ caseStudies: await listCaseStudies() });
  }
  if (view === 'findings') {
    return NextResponse.json({ findings: await listRecentFindings(50) });
  }

  const channels = await listScoutChannels();
  return NextResponse.json({
    universe: channels.length,
    channels: channels.slice(0, 100),
    observationQuota: estimateObservationQuota(channels),
    quota: { spentToday: await readSpend(), budget: SCOUT_DAILY_BUDGET },
  });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }

  /* Discovery and investigation do not fit in one 60s request, so they are
     separate calls over the persisted Scout universe. */
  if (body.action === 'investigate') {
    const out = await investigateStored(body.mission as MissionId, {
      limit: Number(body.limit ?? 2),
      budgetMs: Number(body.budgetMs ?? 50_000),
    });
    return NextResponse.json(out);
  }

  const run = await runScout({
    missions: Array.isArray(body.missions) ? (body.missions as MissionId[]) : undefined,
    discoveryLimit: Number(body.discoveryLimit ?? 12),
    investigationLimit: Number(body.investigationLimit ?? 3),
    budgetMs: Number(body.budgetMs ?? 40_000),
    discoverOnly: body.discoverOnly === true,
  });

  return NextResponse.json({ run, summary: summarise(run) });
}
