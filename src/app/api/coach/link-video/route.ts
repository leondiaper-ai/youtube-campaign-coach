/**
 * POST /api/coach/link-video
 *
 * Link a YouTube video (typically unlisted) to a campaign plan event.
 * Can either attach a videoId to an existing event (by matching title),
 * or add a brand-new event with the video already linked.
 *
 * Body: {
 *   planSlug: string;
 *   videoId: string;
 *   videoTitle: string;
 *   matchEventTitle?: string;   // if provided, attach videoId to matching event
 *   dateISO?: string;           // for new events (yyyy-mm-dd)
 *   kind?: string;              // event kind (default: 'singleRelease')
 *   scale?: string;             // 'anchor' | 'major' | 'standard' | 'minor'
 *   featuredArtist?: string;    // e.g. "Oxlade"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadPlan, updateSavedPlan } from '@/lib/planStore';
import type { ParsedEvent } from '@/lib/planEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      planSlug,
      videoId,
      videoTitle,
      matchEventTitle,
      dateISO,
      kind = 'singleRelease',
      scale = 'major',
      featuredArtist,
    } = body as {
      planSlug: string;
      videoId: string;
      videoTitle: string;
      matchEventTitle?: string;
      dateISO?: string;
      kind?: string;
      scale?: string;
      featuredArtist?: string;
    };

    if (!planSlug || !videoId || !videoTitle) {
      return NextResponse.json(
        { error: 'planSlug, videoId, and videoTitle are required' },
        { status: 400 },
      );
    }

    const saved = await loadPlan(planSlug);
    if (!saved) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const plan = { ...saved.plan };
    const events = [...(plan.events ?? [])];
    let matched = false;

    if (matchEventTitle) {
      // Find existing event by fuzzy title match
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = norm(matchEventTitle);
      const idx = events.findIndex(e => norm(e.title).includes(target) || target.includes(norm(e.title)));

      if (idx >= 0) {
        events[idx] = { ...events[idx], videoId };
        matched = true;
      }
    }

    if (!matched) {
      // Add as a new event
      const newEvent: ParsedEvent = {
        dateISO: dateISO ?? new Date().toISOString().slice(0, 10),
        title: videoTitle,
        kind: kind as ParsedEvent['kind'],
        scale: (scale as ParsedEvent['scale']) ?? 'major',
        videoId,
        ...(featuredArtist ? { featuredArtist } : {}),
      };
      events.push(newEvent);
      // Re-sort by date
      events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    }

    plan.events = events;
    const updated = await updateSavedPlan(planSlug, { plan });

    return NextResponse.json({
      ok: true,
      matched,
      eventCount: events.length,
      updatedAt: updated?.updatedAt,
    });
  } catch (err) {
    console.error('POST /api/coach/link-video error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
