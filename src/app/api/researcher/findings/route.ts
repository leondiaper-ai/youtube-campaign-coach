/**
 * GET   /api/researcher/findings           → findings, hypotheses, runs
 * PATCH /api/researcher/findings           → record human feedback
 *
 * The human feedback loop. A decision here does NOT become a rule: when the
 * reviewer supplies a candidateLearning, the store turns it into a
 * HYPOTHESIS with an unset falsifier, which then has to earn its place like
 * anything else. See the note in store.recordFeedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listFindings, listHypotheses, listRuns, recordFeedback } from '@/lib/researcher/store';
import type { FeedbackDecision } from '@/lib/researcher/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const includeSuppressed = req.nextUrl.searchParams.get('all') === '1';
  const all = await listFindings();
  return NextResponse.json({
    findings: includeSuppressed ? all : all.filter(f => f.gate.passed),
    suppressedCount: all.filter(f => !f.gate.passed).length,
    hypotheses: await listHypotheses(),
    runs: (await listRuns()).slice(0, 20),
  });
}

export async function PATCH(req: NextRequest) {
  let body: {
    id?: string; decision?: FeedbackDecision; reasoning?: string;
    contextGap?: string; candidateLearning?: string; modifiedClaim?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }); }

  if (!body.id || !body.decision) {
    return NextResponse.json({ error: 'id and decision required' }, { status: 400 });
  }
  if (!['approve', 'modify', 'reject'].includes(body.decision)) {
    return NextResponse.json({ error: 'decision must be approve, modify or reject' }, { status: 400 });
  }
  if (body.decision !== 'approve' && !body.reasoning?.trim()) {
    return NextResponse.json(
      { error: 'reasoning is required when modifying or rejecting — the reasoning is the useful part, not the verdict' },
      { status: 400 },
    );
  }

  const updated = await recordFeedback(body.id, {
    decision: body.decision,
    reasoning: body.reasoning ?? '',
    contextGap: body.contextGap,
    candidateLearning: body.candidateLearning,
    modifiedClaim: body.modifiedClaim,
    at: new Date().toISOString(),
  });
  if (!updated) return NextResponse.json({ error: 'finding not found' }, { status: 404 });
  return NextResponse.json({ finding: updated });
}
