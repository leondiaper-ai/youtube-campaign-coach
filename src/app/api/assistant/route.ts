/**
 * ASSISTANT — HTTP SURFACE
 *
 * GET assembles the home from stored data and never spends anything.
 * POST performs the one action the page offers that costs money: refreshing
 * a campaign read, which goes through the existing Coach service rather
 * than a second model path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildAssistantHome } from '@/lib/assistant/home';
import { renderShare, type ShareFormat } from '@/lib/assistant/share';
import { getCoachOverview } from '@/lib/coach-service/service';
import { readOverview } from '@/lib/coach-service/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await buildAssistantHome());
}

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }

  /* Rendering a share format is free — it is string assembly over an
     interpretation that already exists, not a second generation. */
  if (body.action === 'share') {
    const o = await readOverview(String(body.slug ?? ''));
    if (!o) return NextResponse.json({ error: 'NO_READ' }, { status: 404 });
    return NextResponse.json({ text: renderShare(o, body.format as ShareFormat) });
  }

  if (body.action === 'refresh') {
    const slug = String(body.slug ?? '');
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
    const r = await getCoachOverview(slug, { baseUrl }, { refresh: true });
    if (!r.ok) {
      return NextResponse.json(
        { error: r.reason, detail: r.detail },
        { status: r.reason === 'NOT_CONFIGURED' ? 503 : 400 },
      );
    }
    return NextResponse.json({ overview: r.data });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
