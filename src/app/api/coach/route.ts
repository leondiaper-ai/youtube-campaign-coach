import { NextRequest, NextResponse } from 'next/server';
import { savePlan, listPlans, generateSlug, updateSavedPlan, loadPlan } from '@/lib/planStore';
import { generatePlan, type ChannelContext, type GeneratedPlan } from '@/lib/planEngine';
import { invalidateBriefingCache } from '@/lib/briefingCache';
import { resolveMarket, DEFAULT_MARKET } from '@/lib/market';
import { getPlansForMarket } from '@/lib/marketScope';

/**
 * Put a saved campaign on its market's weekly priority view.
 *
 * WHY THIS EXISTS: membership of Priority Campaigns is decided by pins, and
 * pinning lives on a different page (/campaigns). For the UK that is fine —
 * they know the system. For a new market it is a hidden step with no signpost,
 * so a team would enter a full campaign timeline, see nothing appear, and
 * reasonably conclude the product is broken.
 *
 * Saving a campaign is an unambiguous statement that the team is working it,
 * so it pins itself. Unpinning by hand still works and is not undone here —
 * we only pin on first save, never on edit, so a deliberate unpin sticks.
 *
 * Never throws: a pin failure must not fail the plan save.
 */
async function ensurePinnedForMarket(
  artistSlugHint: string,
  marketId: string,
): Promise<void> {
  try {
    const { getArtistsForMarket } = await import('@/lib/marketScope');
    const { isPinned, pinCampaign } = await import('@/lib/campaignStore');

    const roster = await getArtistsForMarket(marketId);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(artistSlugHint);

    // Same shape of match the briefing route uses, deliberately: if this
    // resolves to a different artist than the briefing would, the campaign
    // gets pinned and then never displayed.
    const match =
      roster.find((a) => norm(a.slug) === target) ??
      roster.find((a) => norm(a.name) === target) ??
      roster.find((a) => target.startsWith(norm(a.slug)) && norm(a.slug).length >= 4);

    if (!match) return;
    if (await isPinned(match.slug, marketId)) return;
    await pinCampaign(match.slug, 'normal', marketId);
  } catch (err) {
    console.warn('[auto-pin] skipped:', err);
  }
}

/**
 * POST /api/coach — Generate + save a campaign plan.
 * Body: { artist, timeline, channelCtx?, market? }
 * Returns the saved plan with its slug for navigation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artist, timeline, channelCtx, customSlug, campaignStartDate, campaignName, market } = body as {
      artist: string;
      timeline: string;
      channelCtx?: ChannelContext | null;
      customSlug?: string;
      campaignStartDate?: string | null;
      campaignName?: string | null;
      market?: string | null;
    };
    const marketId = resolveMarket(market).id;

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
    const isNew = !(await loadPlan(slug));
    const saved = await savePlan(slug, artist, plan, channelCtx ?? null, timeline, marketId);

    // Close the loop: artist → campaign → dates → save → it is on the weekly
    // view. Only on first save, so a deliberate unpin is never undone.
    if (isNew) await ensurePinnedForMarket(artist, marketId);

    // The briefing renders these plan dates, so a timeline edit here must show
    // up there immediately rather than waiting out the cache freshness window.
    // Scoped: busting the UK's cache because Australia saved a plan would
    // throw away a good briefing and make both markets pay for a rebuild.
    await invalidateBriefingCache(marketId);

    return NextResponse.json({
      slug: saved.slug,
      campaignName: saved.campaignName,
      market: marketId,
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
    // here should be reflected on the next briefing load. The market comes
    // from the plan itself, not the request: an edit does not change hands.
    await invalidateBriefingCache(updated.market ?? DEFAULT_MARKET);

    return NextResponse.json({ ok: true, campaignName: updated.campaignName, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('PATCH /api/coach error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/coach — List saved campaign plans.
 *
 * `?market=au` scopes to one market's Content Planner. Omitting it returns
 * every plan, which is what the archive views and cross-market tooling want —
 * but any market-facing UI must pass it, or an Australian planner will list
 * the UK's campaigns.
 */
export async function GET(req: NextRequest) {
  const marketParam = req.nextUrl.searchParams.get('market');
  const plans = marketParam
    ? await getPlansForMarket(marketParam)
    : await listPlans();
  return NextResponse.json({ plans, market: marketParam ?? null });
}
