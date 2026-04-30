import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { writeLiveSnap, writeChannelMapping, writeSyncMeta, type SyncMeta } from '@/lib/kvCache';
import { captureWeeklySnapshots } from '@/lib/weeklySnapshotCapture';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 120s for all artists

/**
 * Cron endpoint — Vercel calls this via vercel.json crons config.
 *
 * This is the ONLY place that calls the YouTube API.
 * All pages read from KV — zero API calls during browsing.
 *
 * 1. Daily: fetches a fresh channel snapshot for every artist using
 *    fetchChannelSnapLite (skips search.list/comments to save quota).
 *    Writes full LiveSnap to KV cache + time-series data for sparklines.
 *
 * 2. Weekly: captures weekly snapshots from KV data (not fresh API calls).
 *    Deduplicates by ISO week — safe to run daily.
 *
 * Estimated quota cost: ~6 units/artist × 37 artists = ~222 units/day
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sets this header automatically. Block public access.
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  // ── 1. Get all artists ─────────────────────────────────────────────────
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const withHandles = allArtists.filter((a) => a.channelHandle);

  console.log(`[Cron] Starting daily sync for ${withHandles.length} artists`);

  // ── 2. Fetch each artist and write to KV ───────────────────────────────
  // Process sequentially to avoid hammering the API
  const dailyResults: Record<string, string> = {};
  let quotaUnits = 0;

  for (const a of withHandles) {
    const handle = a.channelHandle!;
    try {
      const snap = await fetchChannelSnapLite(handle);
      if (!snap) {
        dailyResults[a.slug] = 'no key';
        failCount++;
        continue;
      }
      if (snap.error) {
        dailyResults[a.slug] = `error: ${snap.error}`;
        failCount++;
        if (errors.length < 10) errors.push(`${a.slug}: ${snap.error}`);
        // If quota exceeded, stop fetching more artists
        if (snap.error === 'quota_exceeded') {
          console.warn('[Cron] Quota exceeded — stopping further fetches');
          // Mark remaining artists as skipped
          const remaining = withHandles.slice(withHandles.indexOf(a) + 1);
          for (const r of remaining) {
            dailyResults[r.slug] = 'skipped (quota)';
            failCount++;
          }
          break;
        }
        continue;
      }

      // Write to KV cache
      if (snap.channelId) {
        await writeLiveSnap(snap.channelId, snap);
        await writeChannelMapping(handle, snap.channelId);
      }

      dailyResults[a.slug] = `ok (${snap.subs} subs, ${snap.uploads30d} uploads/30d)`;
      successCount++;
      // Estimate: 1 resolve + 1 channels + 2 playlistItems + 2 videos = 6 units
      quotaUnits += 6;
    } catch (e: any) {
      dailyResults[a.slug] = `throw: ${e?.message ?? e}`;
      failCount++;
      if (errors.length < 10) errors.push(`${a.slug}: ${e?.message ?? e}`);
    }
  }

  // ── 3. Write sync metadata ─────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const nextSync = new Date();
  nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  nextSync.setUTCHours(8, 0, 0, 0); // Next day at 8am UTC (after YouTube quota resets at midnight Pacific / 7am UTC)

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

  console.log(`[Cron] Daily sync complete: ${successCount}/${withHandles.length} ok, ~${quotaUnits} quota units, ${durationMs}ms`);

  // ── 4. Weekly snapshot capture (reads from KV, not API) ────────────────
  let weeklyResult;
  try {
    weeklyResult = await captureWeeklySnapshots();
  } catch (e: any) {
    weeklyResult = { error: e?.message ?? 'Weekly capture failed' };
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    daily: dailyResults,
    weekly: weeklyResult,
    sync: syncMeta,
  });
}
