/**
 * INTELLIGENCE — THE READ SURFACE
 *
 * GET is free: it serves the last stored run. Opening Watcher must never
 * trigger a model, or the cost of the feature becomes a function of how
 * often someone refreshes a tab.
 *
 * The run itself is a POST to /api/intelligence/run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { latestRun, listRecentFindings, listCaseStudies, readRun } from '@/lib/intelligence/store';
import { listPrinciples } from '@/lib/intelligence/principles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const runId = p.get('runId');

  if (p.get('view') === 'principles') {
    return NextResponse.json({ principles: await listPrinciples() });
  }
  if (p.get('view') === 'case-studies') {
    return NextResponse.json({ caseStudies: await listCaseStudies() });
  }
  if (p.get('view') === 'findings') {
    return NextResponse.json({ findings: await listRecentFindings(Number(p.get('limit') ?? 20)) });
  }

  const run = runId ? await readRun(runId) : await latestRun();
  if (!run) {
    return NextResponse.json({
      run: null,
      message: 'No intelligence run recorded yet.',
    });
  }
  return NextResponse.json({ run });
}
