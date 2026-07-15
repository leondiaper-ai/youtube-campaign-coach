import { NextResponse } from 'next/server';
import { captureWeeklySnapshots } from '@/lib/weeklySnapshotCapture';
import { getRecentSnapshots, listRollups } from '@/lib/weeklySnapshotStore';

/**
 * POST /api/weekly-snapshots
 * Trigger manual weekly snapshot capture for all Virgin Managed artists.
 * Returns summary of captured/skipped/errors.
 */
export async function POST() {
  try {
    const result = await captureWeeklySnapshots();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Snapshot capture failed' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/weekly-snapshots?slug=artist-slug&count=4
 * Retrieve recent weekly snapshots for a specific artist.
 * Or: GET /api/weekly-snapshots?rollups=true&count=12
 * Retrieve recent weekly rollups.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const rollups = searchParams.get('rollups');
  const count = parseInt(searchParams.get('count') ?? '4', 10);

  if (rollups === 'true') {
    const data = await listRollups(count);
    return NextResponse.json({ rollups: data });
  }

  if (!slug) {
    return NextResponse.json(
      { error: 'slug parameter required' },
      { status: 400 },
    );
  }

  const snapshots = await getRecentSnapshots(slug, count);
  return NextResponse.json({ snapshots });
}
