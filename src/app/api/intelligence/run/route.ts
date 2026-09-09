/**
 * THE MORNING RUN — TRIGGER
 *
 * POST only, deliberately. A GET that spends money is a GET that gets
 * spent by a link preview, a crawler, or a browser prefetching the URL.
 *
 * `scanOnly=1` runs the deterministic half and returns the candidate list
 * with its priority breakdown. That is the honest way to tune thresholds:
 * you can see exactly what would have been investigated without paying to
 * investigate it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMorningIntelligence, resumeMorningIntelligence } from '@/lib/intelligence/run';

export const dynamic = 'force-dynamic';
/* Vercel Hobby ceiling. The run's own budgetMs sits below this so it
   returns a partial brief rather than being killed mid-investigation. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  /* A run does not fit in one 60s request. `resume` continues an existing
     one; the caller loops until `run.pending` is empty. */
  const resumeId = body.resume ?? req.nextUrl.searchParams.get('resume');
  if (resumeId) {
    const run = await resumeMorningIntelligence(String(resumeId), { baseUrl }, {
      budgetMs: Number(body.budgetMs ?? 40_000),
    });
    if (!run) return NextResponse.json({ error: 'UNKNOWN_RUN' }, { status: 404 });
    return NextResponse.json({ run });
  }

  const scanOnly = body.scanOnly === true || req.nextUrl.searchParams.get('scanOnly') === '1';

  const run = await runMorningIntelligence(
    { baseUrl },
    {
      scanOnly,
      maxInvestigations: Number(body.maxInvestigations ?? 6),
      budgetMs: Number(body.budgetMs ?? 45_000),
      minPriority: Number(body.minPriority ?? 0.35),
    },
  );

  return NextResponse.json({ run });
}
