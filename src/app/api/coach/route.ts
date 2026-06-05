import { NextRequest, NextResponse } from 'next/server';
import { savePlan, listPlans, generateSlug, updateSavedPlan, loadPlan } from '@/lib/planStore';
import { generatePlan, type ChannelContext, type GeneratedPlan } from '@/lib/planEngine';

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
 * Body: { slug, plan } — replaces the plan data.
 * Used for marking actions complete, adding/removing actions.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, plan } = body as { slug: string; plan: GeneratedPlan };
    if (!slug || !plan) {
      return NextResponse.json({ error: 'slug and plan are required' }, { status: 400 });
    }
    const updated = await updateSavedPlan(slug, { plan });
    if (!updated) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
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
