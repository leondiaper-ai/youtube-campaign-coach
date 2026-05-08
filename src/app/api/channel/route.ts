import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle, readSyncMeta, readChannelMapping } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { checkContentStructure } from '@/lib/contentStructure';

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

  // Compute 7-day deltas via normalized data layer
  const channelId = await readChannelMapping(q);
  const history = channelId ? await readHistory(channelId) : [];
  const nc = normalizeChannelData(snap, history);
  const subs7Delta = rawDelta(nc.subs7d);
  const views7Delta = rawDelta(nc.views7d);

  // Include sync metadata for freshness display
  const syncMeta = await readSyncMeta();

  // Check content structure for warnings
  const uploads = snap.recentUploads ?? [];
  const structureWarning = checkContentStructure(uploads);

  return NextResponse.json({
    ...snap,
    subs7Delta,
    views7Delta,
    structureWarning,
    _dataQuality: {
      confidence: nc.confidence,
      health: nc.health,
      historyDepthDays: nc.historyDepthDays,
      note: nc.healthNote,
    },
    _syncMeta: syncMeta ? {
      lastSyncAt: syncMeta.lastSyncAt,
      nextScheduledSync: syncMeta.nextScheduledSync,
    } : null,
  });
}
