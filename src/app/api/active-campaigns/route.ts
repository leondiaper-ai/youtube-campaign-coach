import { NextRequest, NextResponse } from 'next/server';
import { listPinned, pinCampaign, unpinCampaign } from '@/lib/campaignStore';

export const dynamic = 'force-dynamic';

/** GET /api/active-campaigns — list all pinned campaigns */
export async function GET() {
  const pinned = await listPinned();
  return NextResponse.json({ pinned });
}

/** POST /api/active-campaigns — pin a campaign { slug, priority? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  const priority = body?.priority === 'high' ? 'high' : 'normal';
  const pinned = await pinCampaign(slug, priority);
  return NextResponse.json({ pinned });
}

/** DELETE /api/active-campaigns?slug=x — unpin a campaign */
export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const pinned = await unpinCampaign(slug);
  return NextResponse.json({ pinned });
}
