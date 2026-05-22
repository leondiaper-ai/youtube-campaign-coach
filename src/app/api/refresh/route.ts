import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { writeLiveSnap, writeChannelMapping, writeSyncMeta, canRefresh, readSyncMeta, readLiveSnap, type SyncMeta } from '@/lib/kvCache';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/refresh — check refresh status (cooldown, last sync, quota estimate)
 */
export async function GET() {
  const refreshStatus = await canRefresh();
  const meta = await readSyncMeta();

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const withHandles = allArtists.filter((a) => a.channelHandle);

  return NextResponse.json({
    ...refreshStatus,
    estimatedQuotaCost: withHandles.length * 6,
    artistCount: withHandles.length,
    lastSync: meta,
  });
}

/**
 * POST /api/refresh — manually trigger a YouTube data refresh
 * Same logic as the cron, but with cooldown protection.
 */
export async function POST(req: NextRequest) {
  // Cooldown check
  const { allowed, nextAllowedAt, lastSyncAt } = await canRefresh();
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Refresh on cooldown',
        lastSyncAt,
        nextAllowedAt,
        message: `Please wait until ${nextAllowedAt} before refreshing again.`,
      },
      { status: 429 }
    );
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const withHandles = allArtists.filter((a) => a.channelHandle);

  console.log(`[Refresh] Manual sync for ${withHandles.length} artists`);

  const results: Record<string, string> = {};
  let quotaUnits = 0;

  for (const a of withHandles) {
    const handle = a.channelHandle!;
    try {
      const snap = await fetchChannelSnapLite(handle, {
        campaignStartDate: a.campaignStartDate ?? undefined,
        collabs: a.collabs,
      });
      if (!snap) {
        results[a.slug] = 'no key';
        failCount++;
        continue;
      }
      if (snap.error) {
        results[a.slug] = `error: ${snap.error}`;
        failCount++;
        if (errors.length < 10) errors.push(`${a.slug}: ${snap.error}`);
        if (snap.error === 'quota_exceeded') {
          const remaining = withHandles.slice(withHandles.indexOf(a) + 1);
          for (const r of remaining) {
            results[r.slug] = 'skipped (quota)';
            failCount++;
          }
          break;
        }
        continue;
      }

      // Safe merge: don't let null API responses overwrite valid cached data
      if (snap.channelId) {
        const existing = await readLiveSnap(snap.channelId);
        const merged = safeMergeSnap(existing, snap);
        await writeLiveSnap(snap.channelId, merged);
        await writeChannelMapping(handle, snap.channelId);
      }

      results[a.slug] = `ok (${snap.subs} subs)`;
      successCount++;
      quotaUnits += 6;
    } catch (e: any) {
      results[a.slug] = `throw: ${e?.message ?? e}`;
      failCount++;
      if (errors.length < 10) errors.push(`${a.slug}: ${e?.message ?? e}`);
    }
  }

  const durationMs = Date.now() - startTime;
  const nextSync = new Date();
  nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  nextSync.setUTCHours(8, 0, 0, 0);

  const syncMeta: SyncMeta = {
    lastSyncAt: new Date().toISOString(),
    status: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
    artistsTotal: withHandles.length,
    artistsSuccess: successCount,
    artistsFailed: failCount,
    errors,
    quotaUnitsEstimate: quotaUnits,
    durationMs,
    nextScheduledSync: nextSync.toISOString(),
  };
  await writeSyncMeta(syncMeta);

  return NextResponse.json({
    ok: true,
    sync: syncMeta,
    results,
  });
}
