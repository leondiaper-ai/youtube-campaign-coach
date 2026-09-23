import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { writeLiveSnap, writeChannelMapping, writeSyncMeta, readSyncMeta, readLiveSnap, readAllLiveSnaps, readSyncProgress, writeSyncProgress, type SyncMeta, type SyncProgress } from '@/lib/kvCache';
import { captureWeeklySnapshots } from '@/lib/weeklySnapshotCapture';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';
import { classifySnapshotPriority, shouldFetchInRun, applyQuotaGuardrails, type SnapshotPriority } from '@/lib/snapshotScheduler';
import { deriveFromLive } from '@/lib/artists';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* ── WHY THIS RUN STOPS EARLY ────────────────────────────────────────
   The platform kills the function at 300s. A run that is killed never
   reaches writeSyncMeta, so the Watcher keeps yesterday's numbers and
   says nothing about it — which is exactly what happened on 14
   September, and the reason nobody noticed for four days.

   So the loop now watches the clock and stops itself with time to
   spare. 225s of fetching leaves 75s for the meta write, the weekly
   capture and the pulse refresh that follow it. Stopping deliberately
   writes a cursor and honest meta; being killed writes nothing.

   The budget is the fix. More cron entries are throughput. */
const FETCH_BUDGET_MS = 225_000;

/** London day, which is how a "pass" is defined. */
const londonDay = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

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

  const _londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date())); /* ── HAS TODAY'S PASS FINISHED? ──────────────────────────────────
     This used to skip if sync meta was stamped today, which was right
     when a run either finished or died. Now that a pass can legitimately
     stop half way and resume, "we wrote meta today" no longer means
     "today is done" — and keeping the old test would have made the
     chunking useless: the first chunk would stamp the day and every
     later chunk would decline to run.

     The question is now whether the CURSOR has reached the end. */
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    if (_londonHour < 6) {
      return NextResponse.json({ skipped: true, reason: 'before 06:00 UK' });
    }
    const prior = await readSyncProgress();
    if (prior && prior.dayKey === londonDay() && prior.cursor >= prior.total && prior.total > 0) {
      return NextResponse.json({
        skipped: true,
        reason: 'today\'s pass already complete (UK)',
        pass: { dayKey: prior.dayKey, done: prior.cursor, total: prior.total },
      });
    }
  }
  const startTime = Date.now();
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

  /* ── RESUME WHERE THE LAST RUN STOPPED ────────────────────────────
     `toFetch` is rebuilt from scratch every run and its order has to be
     stable for a cursor into it to mean anything, so it is sorted before
     the cursor is applied. Priority already decided WHO is in the list;
     this only fixes the order they are walked in. */
  toFetch.sort();

  const prior = await readSyncProgress();
  const today = londonDay();
  const resuming = !!prior && prior.dayKey === today && prior.cursor > 0 && prior.cursor < toFetch.length;
  const startIndex = resuming ? prior!.cursor : 0;

  /* Totals carry across the chunks of one pass, so the meta at the end
     describes the day rather than the last slice of it. */
  if (resuming) {
    successCount = prior!.successCount;
    failCount = prior!.failCount;
    quotaUnits = prior!.quotaUnits;
    errors.push(...prior!.errors);
  }

  let cursor = startIndex;
  let ranOutOfTime = false;

  for (let i = startIndex; i < toFetch.length; i++) {
    const slug = toFetch[i];
    cursor = i;

    /* Checked BEFORE the fetch, not after: a run that starts an artist
       at 224s and is killed at 300s has lost that artist's slot and
       written nothing. */
    if (Date.now() - startTime > FETCH_BUDGET_MS) {
      ranOutOfTime = true;
      break;
    }

    const entry = eligibleMap.get(slug);
    if (!entry) { cursor = i + 1; continue; }
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
        cursor = i + 1;
        continue;
      }
      if (snap.error) {
        dailyResults[slug] = `error: ${snap.error}`;
        failCount++;
        if (errors.length < 10) errors.push(`${slug}: ${snap.error}`);
        // If quota exceeded, stop fetching more artists
        cursor = i + 1;
        if (snap.error === 'quota_exceeded') {
          console.warn('[Cron] Quota exceeded — stopping further fetches');
          const remaining = toFetch.slice(i + 1);
          for (const r of remaining) {
            dailyResults[r] = 'skipped (quota exhausted mid-run)';
            failCount++;
          }
          /* Quota is a day-level wall, not a time-level one. Resuming in
             ten minutes would only spend the next key's units on the same
             refusal, so the pass is marked finished and tomorrow starts
             clean. */
          cursor = toFetch.length;
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
      cursor = i + 1;
    } catch (e: any) {
      dailyResults[slug] = `throw: ${e?.message ?? e}`;
      failCount++;
      if (errors.length < 10) errors.push(`${slug}: ${e?.message ?? e}`);
      /* Never fail the whole run because one artist fails — and never
         let a failing artist trap the cursor either, or every future run
         would break its teeth on the same channel. */
      cursor = i + 1;
    }
  }

  /* ── 6b. RECORD HOW FAR THIS PASS GOT ──────────────────────────────
     Written before the meta, and written on EVERY outcome including the
     one where we stopped early. The pass is complete when the cursor
     reaches the end of the list; until then the next cron invocation
     picks it up from here. */
  const complete = cursor >= toFetch.length;
  const progress: SyncProgress = {
    dayKey: today,
    cursor: complete ? toFetch.length : cursor,
    total: toFetch.length,
    startedAt: resuming && prior ? prior.startedAt : new Date(startTime).toISOString(),
    successCount,
    failCount,
    quotaUnits,
    errors: errors.slice(0, 10),
  };
  await writeSyncProgress(progress);

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

  /* A pass still in progress is 'partial', which is the honest word for
     it and the one the Watcher already knows how to show. The failure
     mode this whole change exists to prevent is the page claiming a
     fresh full sync when half the roster has yesterday's numbers. */
  const syncMeta: SyncMeta = {
    lastSyncAt: new Date().toISOString(),
    status: !complete
      ? 'partial'
      : failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
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
  if (runSlot === 'morning' && complete) {
    try {
      weeklyResult = await captureWeeklySnapshots();
    } catch (e: any) {
      weeklyResult = { error: e?.message ?? 'Weekly capture failed' };
    }
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    pass: {
      dayKey: today,
      complete,
      done: progress.cursor,
      total: toFetch.length,
      resumedFrom: resuming ? startIndex : 0,
      stoppedOnClock: ranOutOfTime,
    },
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
