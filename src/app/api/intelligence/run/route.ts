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
import { runMorningIntelligence } from '@/lib/intelligence/run';

export const dynamic = 'force-dynamic';
/* Vercel Hobby ceiling. The run's own budgetMs sits below this so it
   returns a partial brief rather than being killed mid-investigation. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any = {};
  try { body = await req.json(); } catch { /* body is optional */ }

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
