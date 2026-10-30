/**
 * COACH — agreed actions and target dates
 *
 * Writes to the production decision record that `readDecisions` already
 * reads: `coach:roadmap:decisions:v1:<slug>`.
 *
 * ── WHY A HASH FIELD WRITE, NOT A SET ─────────────────────────────────
 * `hset` with a single field replaces only that field. Two people on the
 * same campaign can agree different actions in the same minute and
 * neither write erases the other's. Writing the whole object back — the
 * obvious implementation — would silently drop every decision made
 * between the page's read and the save, which is the kind of loss nobody
 * notices until a planning meeting.
 *
 * A date can be set without changing status, and a status without
 * changing a date, so the existing value is read first and merged. Only
 * the keys actually supplied move.
 */

import { NextRequest, NextResponse } from 'next/server';
import { decisionStore, decisionsKey } from '@/lib/coach/evidence';
import { loadPlan } from '@/lib/planStore';
import type { Decision } from '@/lib/coach/roadmap';

export const dynamic = 'force-dynamic';

const STATUSES = new Set<Decision['status']>(['suggested', 'planned', 'ready', 'done', 'dismissed']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  /* Same-origin only. This writes to shared campaign planning. */
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) {
    return new NextResponse(null, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    { slug?: string; actionId?: string; status?: string; targetDate?: string | null } | null;

  const slug = (body?.slug ?? '').trim();
  const actionId = (body?.actionId ?? '').trim();
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug) || !actionId || actionId.length > 300) {
    return NextResponse.json({ error: 'slug and actionId are required.' }, { status: 400 });
  }

  const status = body?.status as Decision['status'] | undefined;
  if (status !== undefined && !STATUSES.has(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  }
  if (body?.targetDate != null && body.targetDate !== '' && !DATE.test(body.targetDate)) {
    return NextResponse.json({ error: 'targetDate must be YYYY-MM-DD.' }, { status: 400 });
  }

  if (body?.targetDate && (!Number.isFinite(Date.parse(body.targetDate)) || new Date(body.targetDate).toISOString().slice(0,10) !== body.targetDate)) return NextResponse.json({error:'Invalid target date.'}, {status:400});
  if (!await loadPlan(slug)) return NextResponse.json({error:'Campaign not found.'}, {status:404});
  let store;
  try { store = await decisionStore(); }
  catch { return NextResponse.json({ error: 'Plan tracking storage is unavailable.' }, { status: 503 }); }

  try {
    const existing = (await store.hget<Decision>(decisionsKey(slug), actionId)) ?? null;
    const next: Decision = {
      status: status ?? existing?.status ?? 'suggested',
      ...(body?.targetDate === null || body?.targetDate === ''
        ? {}
        : body?.targetDate
          ? { targetDate: body.targetDate }
          : existing?.targetDate ? { targetDate: existing.targetDate } : {}),
    };
    await store.hset(decisionsKey(slug), { [actionId]: next });
    return NextResponse.json({ ok: true, decision: next });
  } catch {
    return NextResponse.json({ error: 'Could not save this decision.' }, { status: 502 });
  }
}
