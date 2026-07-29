import { NextRequest, NextResponse } from 'next/server';
import { savePlan, listPlans, generateSlug, updateSavedPlan, loadPlan } from '@/lib/planStore';
import { generatePlan, type ChannelContext, type GeneratedPlan } from '@/lib/planEngine';
import { invalidateBriefingCache } from '@/lib/briefingCache';

/**
 * POST /api/coach — Generate + save a campaign plan.
 * Body: { artist, timeline, channelCtx? }
 * Returns the saved plan with its slug for navigation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artist, timeline, channelCtx, customSlug, campaignStartDate, campaignName } = body as {
      artist: string;
      timeline: string;
      channelCtx?: ChannelContext | null;
      customSlug?: string;
      campaignStartDate?: string | null;
      campaignName?: string | null;
    };

    if (!artist || !timeline) {
      return NextResponse.json(
        { error: 'artist and timeline are required' },
        { status: 400 },
      );
    }

    const plan = generatePlan(timeline, artist, channelCtx ?? null, campaignStartDate ?? null, campaignName ?? null);
    if (!plan) {
      return NextResponse.json(
        { error: 'Could not parse any dates from the timeline.' },
        { status: 400 },
      );
    }

    const slug = customSlug || generateSlug(artist, plan.campaignName);
    const saved = await savePlan(slug, artist, plan, channelCtx ?? null, timeline);

    // The briefing renders these plan dates, so a timeline edit here must show
    // up there immediately rather than waiting out the cache freshness window.
    await invalidateBriefingCache();

    return NextResponse.json({
      slug: saved.slug,
      campaignName: saved.campaignName,
      url: `/coach/${saved.slug}`,
    });
  } catch (err) {
    console.error('POST /api/coach error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach — Update a saved campaign plan.
 * Body: { slug, plan? , campaignName? }
 *   - plan: replaces the plan data (marking actions complete, etc.)
 *   - campaignName: renames the campaign (slug/URL stays the same)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, plan, campaignName, timelineText } = body as { slug: string; plan?: GeneratedPlan; campaignName?: string; timelineText?: string };
    if (!slug || (!plan && !campaignName && !timelineText)) {
      return NextResponse.json({ error: 'slug and one of plan, campaignName, or timelineText are required' }, { status: 400 });
    }
    const updates: { plan?: GeneratedPlan; campaignName?: string; timelineText?: string } = {};
    if (plan) updates.plan = plan;
    if (typeof campaignName === 'string') updates.campaignName = campaignName;
    if (typeof timelineText === 'string') updates.timelineText = timelineText;
    const updated = await updateSavedPlan(slug, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Same reasoning as POST — the briefing reads these plans, so any edit
    // here should be reflected on the next briefing load.
    await invalidateBriefingCache();

    return NextResponse.json({ ok: true, campaignName: updated.campaignName, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('PATCH /api/coach error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/coach — List all saved campaign plans.
 */
export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({ plans });
}
