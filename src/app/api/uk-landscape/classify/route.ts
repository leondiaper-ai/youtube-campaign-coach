/**
 * POST /api/uk-landscape/classify   { slug, value }
 *
 * Moves one artist between INCLUDE / CHECK / EXCLUDE. This exists so
 * that when James confirms a relationship the answer is a write, not a
 * deploy. Gated on REVIEW_TOKEN when that is configured; open otherwise,
 * because an unset gate that nobody can open is worse than none.
 */
import { NextRequest, NextResponse } from 'next/server';
import { setClassification } from '@/lib/uk-landscape/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.REVIEW_TOKEN;
  if (expected) {
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (bearer !== expected) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? '').trim();
  const value = String(body?.value ?? '').trim().toUpperCase();
  if (!slug || !['INCLUDE', 'CHECK', 'EXCLUDE'].includes(value)) {
    return NextResponse.json({ error: 'Pass { slug, value: INCLUDE | CHECK | EXCLUDE }' }, { status: 400 });
  }
  const ok = await setClassification(slug, value as 'INCLUDE' | 'CHECK' | 'EXCLUDE');
  return NextResponse.json({ ok, slug, value }, { status: ok ? 200 : 503 });
}
