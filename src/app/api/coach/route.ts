import { NextRequest, NextResponse } from 'next/server';
import { savePlan, listPlans, generateSlug } from '@/lib/planStore';
import { generatePlan, type ChannelContext } from '@/lib/planEngine';

/**
 * POST /api/coach — Generate + save a campaign plan.
 * Body: { artist, timeline, channelCtx? }
 * Returns the saved plan with its slug for navigation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artist, timeline, channelCtx, customSlug } = body as {
      artist: string;
      timeline: string;
      channelCtx?: ChannelContext | null;
      customSlug?: string;
    };

    if (!artist || !timeline) {
      return NextResponse.json(
        { error: 'artist and timeline are required' },
        { status: 400 },
      );
    }

    const plan = generatePlan(timeline, artist, channelCtx ?? null);
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
 * GET /api/coach — List all saved campaign plans.
 */
export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({ plans });
}
