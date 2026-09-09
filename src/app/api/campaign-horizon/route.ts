/**
 * CAMPAIGN HORIZON API
 *
 * GET    ?slug=          → the computed horizon + raw events (for the editor)
 * POST   {slug, event}   → add/update one event  (source: manual)
 * POST   {slug, sync:[]} → replace all coach_plan events for that artist
 * PATCH  {slug, eventId, ...fields} → edit one event
 * DELETE ?slug=&eventId= → remove one event
 *
 * Internal, same trust level as the rest of the app's API surface. The MCP
 * endpoint is the authenticated one because that is what is exposed to a
 * third party; this is the same-origin editor path.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteEvent, getHorizon, listEvents, getMeta, newEventId,
  syncFromCoachPlan, upsertEvent,
  EVENT_STATUSES, EVENT_TYPES,
  type CampaignEvent, type EventStatus, type EventType,
} from '@/lib/coach-bot/horizon';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  const [horizon, events, meta] = await Promise.all([
    getHorizon(slug), listEvents(slug), getMeta(slug),
  ]);
  return NextResponse.json({
    horizon, events, meta,
    eventTypes: EVENT_TYPES, eventStatuses: EVENT_STATUSES,
  });
}

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const slug = b.slug;
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  /* Bulk sync from the browser-held Coach plan. */
  if (Array.isArray(b.sync)) {
    const now = new Date().toISOString();
    const incoming: CampaignEvent[] = b.sync
      .filter((e: any) => e && e.title)
      .map((e: any) => ({
        eventId: e.eventId ?? newEventId(),
        artistId: slug,
        campaignId: e.campaignId ?? null,
        eventDate: e.eventDate ?? null,
        eventType: (e.eventType ?? 'OTHER') as EventType,
        title: String(e.title),
        assetType: e.assetType ?? null,
        status: (e.status ?? 'PLANNED') as EventStatus,
        note: e.note ?? null,
        source: 'coach_plan' as const,
        createdAt: now, updatedAt: now,
      }));
    const result = await syncFromCoachPlan(slug, incoming);
    return NextResponse.json({ synced: true, ...result, horizon: await getHorizon(slug) });
  }

  /* Single manual event. */
  const e = b.event ?? b;
  if (!e.title) return NextResponse.json({ error: 'event.title required' }, { status: 400 });
  const now = new Date().toISOString();
  const event: CampaignEvent = {
    eventId: e.eventId ?? newEventId(),
    artistId: slug,
    campaignId: e.campaignId ?? null,
    eventDate: e.eventDate || null,
    eventType: (e.eventType ?? 'OTHER') as EventType,
    title: String(e.title),
    assetType: e.assetType ?? null,
    status: (e.status ?? 'PLANNED') as EventStatus,
    note: e.note ?? null,
    source: (e.source ?? 'manual') as CampaignEvent['source'],
    createdAt: e.createdAt ?? now,
    updatedAt: now,
  };
  await upsertEvent(event);
  return NextResponse.json({ event, horizon: await getHorizon(slug) });
}

export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!b.slug || !b.eventId) return NextResponse.json({ error: 'slug and eventId required' }, { status: 400 });
  const all = await listEvents(b.slug);
  const found = all.find(e => e.eventId === b.eventId);
  if (!found) return NextResponse.json({ error: 'event not found' }, { status: 404 });
  const updated: CampaignEvent = {
    ...found,
    eventDate: b.eventDate !== undefined ? (b.eventDate || null) : found.eventDate,
    eventType: b.eventType ?? found.eventType,
    title: b.title ?? found.title,
    status: b.status ?? found.status,
    note: b.note !== undefined ? b.note : found.note,
    assetType: b.assetType !== undefined ? b.assetType : found.assetType,
    updatedAt: new Date().toISOString(),
  };
  await upsertEvent(updated);
  return NextResponse.json({ event: updated, horizon: await getHorizon(b.slug) });
}

export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!slug || !eventId) return NextResponse.json({ error: 'slug and eventId required' }, { status: 400 });
  await deleteEvent(slug, eventId);
  return NextResponse.json({ deleted: true, horizon: await getHorizon(slug) });
}
