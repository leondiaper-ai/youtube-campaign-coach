import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle, readSyncMeta, readChannelMapping } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { computeDepthSignal } from '@/lib/depthSignal';

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

  // Compute 7-day deltas from snapshot history for consistent state derivation
  let subs7Delta: number | null = null;
  let views7Delta: number | null = null;
  const channelId = await readChannelMapping(q);
  if (channelId) {
    const history = await readHistory(channelId);
    const s7 = deltaOver(history, 7, 'subs');
    const v7 = deltaOver(history, 7, 'views');
    if (s7) subs7Delta = s7.delta;
    if (v7) views7Delta = v7.delta;
  }

  // Include sync metadata for freshness display
  const syncMeta = await readSyncMeta();

  // Compute depth signal from recent uploads
  const uploads = snap.recentUploads ?? [];
  const depthSignal = uploads.length > 0 ? computeDepthSignal(uploads) : null;

  return NextResponse.json({
    ...snap,
    subs7Delta,
    views7Delta,
    depthSignal: depthSignal ? {
      label: depthSignal.label,
      title: depthSignal.title,
      reason: depthSignal.reason,
      score: depthSignal.score,
      suggestions: depthSignal.suggestions,
      longformCount: depthSignal.breakdown.longformCount,
      shortsCount: depthSignal.breakdown.shortsCount,
      depthAssetTypes: depthSignal.breakdown.depthAssetTypes,
    } : null,
    _syncMeta: syncMeta ? {
      lastSyncAt: syncMeta.lastSyncAt,
      nextScheduledSync: syncMeta.nextScheduledSync,
    } : null,
  });
}
