import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnapLite } from '@/lib/youtube';
import { writeLiveSnap, writeChannelMapping, writeSyncMeta, canRefresh, readSyncMeta, readLiveSnap, type SyncMeta } from '@/lib/kvCache';
import { safeMergeSnap } from '@/lib/youtube/normalizeChannelData';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  /**
   * TARGETED REFRESH — ?slug=kingsofleon  or  ?slugs=kingsofleon,chvrches
   *
   * Why this exists. The full loop below walks every artist serially and the
   * roster has grown past what fits in one function invocation: the last clean
   * full run took 212s for 184 artists, and at 185 it now exceeds the platform
   * timeout and dies without writing sync meta. Artists early in the list get
   * refreshed, everyone after the cut-off silently keeps yesterday's numbers —
   * which is exactly how a live campaign page ends up a Short behind.
   *
   * A named refresh costs ~6 quota units per artist and finishes in a second or
   * two, so it deliberately skips the global cooldown: the cooldown exists to
   * stop someone burning 1,110 units on a whim, not to stop a campaign manager
   * pulling one channel the morning a Short lands.
   *
   * It also does NOT write sync meta. Meta describes the state of the whole
   * roster; letting a one-artist pull stamp "last synced just now" over it
   * would hide the very staleness this route is here to fix.
   */
  const slugParam =
    req.nextUrl.searchParams.get('slug') ?? req.nextUrl.searchParams.get('slugs');
  const targeted = slugParam
    ? slugParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  // Cooldown applies to full-roster runs only.
  if (!targeted) {
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
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  let withHandles = allArtists.filter((a) => a.channelHandle);

  if (targeted) {
    const wanted = new Set(targeted.map((s) => s.toLowerCase()));
    const matched = withHandles.filter((a) => wanted.has(a.slug.toLowerCase()));
    const missing = targeted.filter(
      (s) => !withHandles.some((a) => a.slug.toLowerCase() === s.toLowerCase())
    );
    if (!matched.length) {
      return NextResponse.json(
        { error: 'No matching artist slugs', requested: targeted, missing },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    withHandles = matched;
    if (missing.length) errors.push(`unknown slugs: ${missing.join(', ')}`);
  }

  console.log(
    `[Refresh] ${targeted ? 'Targeted' : 'Manual full'} sync for ${withHandles.length} artist(s)`
  );

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

  /* Only a full-roster run may stamp sync meta — see the note at the top of
     POST. A targeted pull that wrote "last synced: just now" would mask a
     roster that is genuinely days behind. */
  if (!targeted) await writeSyncMeta(syncMeta);

  return NextResponse.json(
    {
      ok: true,
      scope: targeted ? { targeted: true, slugs: targeted } : { targeted: false },
      sync: targeted ? { ...syncMeta, note: 'targeted run — roster sync meta not updated' } : syncMeta,
      results,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
