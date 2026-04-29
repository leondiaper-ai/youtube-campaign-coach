import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle, readSyncMeta } from '@/lib/kvCache';

export const revalidate = 600;

/**
 * GET /api/channel?q=@handle
 * Serves cached YouTube data from KV — zero API calls.
 * Data is populated by the daily cron job.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  const snap = await readLiveSnapByHandle(q);
  if (!snap) {
    // No cached data — don't fall back to live API
    return NextResponse.json(
      { error: 'no_cached_data', message: 'No cached data yet. Data will be available after the next scheduled sync.' },
      { status: 404 }
    );
  }

  // Include sync metadata for freshness display
  const syncMeta = await readSyncMeta();

  return NextResponse.json({
    ...snap,
    _syncMeta: syncMeta ? {
      lastSyncAt: syncMeta.lastSyncAt,
      nextScheduledSync: syncMeta.nextScheduledSync,
    } : null,
  });
}
