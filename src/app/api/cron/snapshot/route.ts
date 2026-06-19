import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { writeLiveSnap, writeChannelMapping, writeSyncMeta, readSyncMeta, readLiveSnap, readAllLiveSnaps, type SyncMeta } from '@/lib/kvCache';
import { captureWeeklySnapshots } from '@/lib/weeklySnapshotCapture';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';
import { classifySnapshotPriority, shouldFetchInRun, applyQuotaGuardrails, type SnapshotPriority } from '@/lib/snapshotScheduler';
import { deriveFromLive } from '@/lib/artists';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 120s for all artists

/**
 * Cron endpoint — Vercel calls this via vercel.json crons config.
 *
 * This is the ONLY place that calls the YouTube API.
 * All pages read from KV — zero API calls during browsing.
 *
 * Smart scheduling:
 *   HIGH priority (active campaign / recent uploads): 2x daily (morning + evening)
 *   MEDIUM priority (healthy/building/weak conversion): 1x daily (morning only)
 *   LOW priority (cold/inactive/dormant): 3x weekly (Mon/Wed/Fri morning)
 *
 * Quota guardrails:
 *   - Estimates cost before fetching
 *   - Drops LOW-priority artists first if budget is tight
 *   - Stops on quota exhaustion, doesn't fail entire run
 *   - Logs every skip with reason
 *
 * Estimated quota cost: ~6 units/artist × eligible artists per run
 */
export async function GET(req: NextRequest) {
  // Vercel Cron sets this header automatically. Block public access.
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const _londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date())); if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) { if (_londonHour !== 6) { return NextResponse.json({ skipped: true, reason: 'before 06:00 UK' }); } const _prevMeta = await readSyncMeta(); const _todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()); const _prevLondonDay = _prevMeta && _prevMeta.lastSyncAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(_prevMeta.lastSyncAt)) : null; if (_prevLondonDay === _todayLondon) { return NextResponse.json({ skipped: true, reason: 'already synced today (UK)' }); } } const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  // ── 1. Get all artists ─────────────────────────────────────────────────
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const withHandles = allArtists.filter((a) => a.channelHandle);

  // ── 2. Determine run slot ──────────────────────────────────────────────
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  // Morning run: 6-14 UTC, Evening run: 14-23 UTC
  const runSlot: 'morning' | 'evening' = utcHour < 14 ? 'morning' : 'evening';

  console.log(`[Cron] Run slot: ${runSlot} (UTC ${utcHour}:00, day=${dayOfWeek})`);

  // ── 3. Read cached snaps for priority classification ───────────────────
  const handles = withHandles.map(a => a.channelHandle!);
  const snapMap = await readAllLiveSnaps(handles);

  // ── 4. Classify each artist and filter by run eligibility ──────────────
  const artistSchedules: { slug: string; handle: string; schedule: ReturnType<typeof classifySnapshotPriority> }[] = [];
  const allSchedules: { slug: string; schedule: ReturnType<typeof classifySnapshotPriority> }[] = [];

  for (const a of withHandles) {
    const handle = a.channelHandle!;
    const snap = snapMap.get(handle) ?? null;

    // Derive channel state from cached data (no API call)
    let channelState: ChannelState | undefined;
    if (snap && !snap.error) {
      const derived = deriveFromLive(snap, {
        subs7Delta: null, // not needed for priority classification
        views7Delta: null,
      });
      channelState = derived?.status;
    }

    const schedule = classifySnapshotPriority(a, snap, channelState);
    allSchedules.push({ slug: a.slug, schedule });

    // Check if this artist should be fetched in this specific run
    if (shouldFetchInRun(schedule.priority, runSlot, dayOfWeek)) {
      schedule.shouldFetchNow = true;
      artistSchedules.push({ slug: a.slug, handle, schedule });
    }
  }

  // ── 5. Apply quota guardrails ──────────────────────────────────────────
  const { toFetch, skipped, estimatedCost } = applyQuotaGuardrails(
    artistSchedules.map(a => ({ slug: a.slug, schedule: a.schedule }))
  );

  const eligibleMap = new Map(artistSchedules.map(a => [a.slug, a]));

  console.log(`[Cron] ${runSlot} run: ${toFetch.length} to fetch, ${skipped.length} skipped, ~${estimatedCost} quota units`);

  // Log skipped artists
  for (const s of skipped) {
    console.log(`[Cron] SKIP: ${s.slug} — ${s.reason}`);
  }

  // ── 6. Fetch each eligible artist and write to KV ──────────────────────
  const dailyResults: Record<string, string> = {};
  let quotaUnits = 0;

  // Mark skipped artists in results
  for (const s of skipped) {
    dailyResults[s.slug] = `skipped: ${s.reason}`;
  }

  // Mark non-eligible artists (wrong run slot)
  for (const a of withHandles) {
    if (!toFetch.includes(a.slug) && !skipped.some(s => s.slug === a.slug)) {
      const sched = allSchedules.find(s => s.slug === a.slug);
      dailyResults[a.slug] = `not scheduled (${sched?.schedule.priority ?? '?'} — ${runSlot} run)`;
    }
  }

  for (const slug of toFetch) {
    const entry = eligibleMap.get(slug);
    if (!entry) continue;
    const { handle } = entry;

    try {
      // For campaign artists, fetch deeper upload history to cover the full campaign window
      const artistCfg = allArtists.find(a => a.slug === slug);
      const snap = await fetchChannelSnapLite(handle, {
        campaignStartDate: artistCfg?.campaignStartDate ?? undefined,
        collabs: artistCfg?.collabs,
      });
      if (!snap) {
        dailyResults[slug] = 'no key';
        failCount++;
        continue;
      }
      if (snap.error) {
        dailyResults[slug] = `error: ${snap.error}`;
        failCount++;
        if (errors.length < 10) errors.push(`${slug}: ${snap.error}`);
        // If quota exceeded, stop fetching more artists
        if (snap.error === 'quota_exceeded') {
          console.warn('[Cron] Quota exceeded — stopping further fetches');
          const remaining = toFetch.slice(toFetch.indexOf(slug) + 1);
          for (const r of remaining) {
            dailyResults[r] = 'skipped (quota exhausted mid-run)';
            failCount++;
          }
          break;
        }
        continue;
      }

      // Write to KV cache — safe merge so null API responses don't overwrite good data
      if (snap.channelId) {
        const existing = await readLiveSnap(snap.channelId);
        const merged = safeMergeSnap(existing, snap);
        await writeLiveSnap(snap.channelId, merged);
        await writeChannelMapping(handle, snap.channelId);
      }

      dailyResults[slug] = `ok [${entry.schedule.priority}] (${snap.subs} subs, ${snap.uploads30d} uploads/30d)`;
      successCount++;
      quotaUnits += 6;
    } catch (e: any) {
      dailyResults[slug] = `throw: ${e?.message ?? e}`;
      failCount++;
      if (errors.length < 10) errors.push(`${slug}: ${e?.message ?? e}`);
      // Never fail the whole run because one artist fails
    }
  }

  // ── 7. Write sync metadata ─────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const nextMorning = new Date();
  nextMorning.setUTCDate(nextMorning.getUTCDate() + (runSlot === 'evening' ? 1 : 0));
  nextMorning.setUTCHours(8, 0, 0, 0);
  if (runSlot === 'morning') {
    // Next run is this evening
    const nextEvening = new Date();
    nextEvening.setUTCHours(20, 0, 0, 0);
  }

  // Priority breakdown for sync metadata
  const priorityBreakdown: Record<SnapshotPriority, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of allSchedules) priorityBreakdown[s.schedule.priority]++;

  const syncMeta: SyncMeta = {
    lastSyncAt: new Date().toISOString(),
    status: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
    artistsTotal: withHandles.length,
    artistsSuccess: successCount,
    artistsFailed: failCount,
    errors,
    quotaUnitsEstimate: quotaUnits,
    durationMs,
    nextScheduledSync: nextMorning.toISOString(),
  };
  await writeSyncMeta(syncMeta); try { await fetch(new URL('/api/weekly-pulse?refresh=1', req.url).toString(), { cache: 'no-store' }); } catch {}

  console.log(`[Cron] ${runSlot} sync complete: ${successCount}/${toFetch.length} ok (${withHandles.length} total), ~${quotaUnits} quota units, ${durationMs}ms`);
  console.log(`[Cron] Priority breakdown: HIGH=${priorityBreakdown.HIGH}, MEDIUM=${priorityBreakdown.MEDIUM}, LOW=${priorityBreakdown.LOW}`);

  // ── 8. Weekly snapshot capture (reads from KV, not API) ────────────────
  let weeklyResult;
  if (runSlot === 'morning') {
    try {
      weeklyResult = await captureWeeklySnapshots();
    } catch (e: any) {
      weeklyResult = { error: e?.message ?? 'Weekly capture failed' };
    }
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    runSlot,
    dayOfWeek,
    priorityBreakdown,
    fetched: toFetch.length,
    skipped: skipped.length,
    estimatedQuota: quotaUnits,
    daily: dailyResults,
    weekly: weeklyResult ?? 'evening run — skipped',
    sync: syncMeta,
  });
}
