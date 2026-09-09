/** GET / PATCH coaching recommendations. Powers the review page. */
import { NextRequest, NextResponse } from 'next/server';
import { listRecommendations, recordCoachFeedback } from '@/lib/coach-bot/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? undefined;
  return NextResponse.json({ recommendations: await listRecommendations(slug) });
}

export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!b.id || !b.decision) return NextResponse.json({ error: 'id and decision required' }, { status: 400 });
  if (b.decision !== 'approve' && !String(b.reason ?? '').trim()) {
    return NextResponse.json({ error: 'reason required for modify/reject' }, { status: 400 });
  }
  const updated = await recordCoachFeedback(b.id, {
    decision: b.decision, reason: b.reason ?? '',
    missingContext: b.missingContext, candidateLearning: b.candidateLearning,
    modifiedRecommendation: b.modifiedRecommendation,
    at: new Date().toISOString(),
  });
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ recommendation: updated });
}
