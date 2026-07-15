import { NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists, deriveFromLive } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug?artists=k-trap,tove-lo,thesnuts,jjerome87
 *
 * Dev-only debug route: traces the full data flow for specified artists.
 * Shows raw snap, history depth, normalized values, deltas, WoW, and
 * confidence — everything needed to diagnose "why does X show —?"
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slugs = (url.searchParams.get('artists') ?? 'k-trap,tove-lo,thesnuts,jjerome87')
    .split(',')
    .map((s) => s.trim().toLowerCase());

  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const syncMeta = await readSyncMeta();

  const handles = allArtists
    .map((a) => a.channelHandle)
    .filter(Boolean) as string[];
  const snapMap = await readAllLiveSnaps(handles);

  const debugRows = await Promise.all(
    allArtists
      .filter((a) => slugs.includes(a.slug))
      .map(async (a) => {
        const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
        const history = snap?.channelId && !snap.error
          ? await readHistory(snap.channelId)
          : [];

        const nc = normalizeChannelData(snap, history);

        // Raw deltas (pre-meaningful filter)
        const subs7Raw = deltaOver(history, 7, 'subs');
        const views7Raw = deltaOver(history, 7, 'views');
        const subs14Raw = deltaOver(history, 14, 'subs');
        const views14Raw = deltaOver(history, 14, 'views');

        // WoW
        const subsWoW = computeWoW(nc.subs7d, subs14Raw);
        const viewsWoW = computeWoW(nc.views7d, views14Raw);

        const derived = snap ? deriveFromLive(snap, {
          subs7Delta: rawDelta(nc.subs7d),
          views7Delta: rawDelta(nc.views7d),
        }) : null;

        // Snapshot timestamps
        const firstSnap = history.length > 0 ? history[0].ts : null;
        const lastSnap = history.length > 0 ? history[history.length - 1].ts : null;

        return {
          artistName: a.name,
          slug: a.slug,
          channelId: snap?.channelId ?? null,
          channelHandle: a.channelHandle ?? null,

          // Data availability
          snapAvailable: !!snap,
          snapHasError: !!snap?.error,
          snapshotCount: history.length,
          firstSnapshot: firstSnap,
          lastSnapshot: lastSnap,
          historyDepthDays: nc.historyDepthDays,

          // Raw from snap
          rawSubs: snap?.subs ?? null,
          rawViews: snap?.views ?? null,
          rawUploads30d: snap?.uploads30d ?? null,
          rawShorts30d: snap?.shorts30d ?? null,
          rawLastUploadAt: snap?.lastUploadAt ?? null,

          // Raw deltas (before meaningful filter)
          raw7dSubs: subs7Raw ? {
            delta: subs7Raw.delta,
            pct: subs7Raw.pct,
            baselineTs: subs7Raw.baseline.ts,
            lastTs: subs7Raw.last.ts,
          } : null,
          raw7dViews: views7Raw ? {
            delta: views7Raw.delta,
            pct: views7Raw.pct,
            baselineTs: views7Raw.baseline.ts,
            lastTs: views7Raw.last.ts,
          } : null,
          raw14dSubs: subs14Raw ? { delta: subs14Raw.delta } : null,
          raw14dViews: views14Raw ? { delta: views14Raw.delta } : null,

          // Normalized output
          normalized: {
            subs7d: nc.subs7d,
            views7d: nc.views7d,
            subs7dRendered: rawDelta(nc.subs7d),
            views7dRendered: rawDelta(nc.views7d),
            cadence: nc.cadence,
            health: nc.health,
            confidence: nc.confidence,
            healthNote: nc.healthNote,
          },

          // WoW
          subsWoW,
          viewsWoW,

          // Derived state
          channelState: derived?.status ?? 'NO_DATA',
          reason: derived?.reason ?? 'No snap available',

          // Warnings
          warnings: buildWarnings(nc, snap, history),
        };
      })
  );

  return NextResponse.json({
    syncMeta,
    debugArtists: debugRows,
    generatedAt: new Date().toISOString(),
  });
}

function buildWarnings(
  nc: ReturnType<typeof normalizeChannelData>,
  snap: any,
  history: any[],
): string[] {
  const w: string[] = [];

  if (!snap) w.push('NO_SNAP: No cached snap data available');
  else if (snap.error) w.push(`SNAP_ERROR: ${snap.error}`);

  if (history.length === 0) w.push('NO_HISTORY: No snapshot history');
  else if (history.length < 3) w.push(`THIN_HISTORY: Only ${history.length} snapshots`);

  if (nc.health === 'STALE') w.push('STALE_DATA: Data may be outdated');
  if (nc.health === 'PARTIAL') w.push('PARTIAL_DATA: Incomplete data');

  if (nc.confidence === 'LOW') w.push('LOW_CONFIDENCE: Insufficient history for reliable trends');

  if (nc.subs7d && !nc.subs7d.meaningful) {
    w.push(`SUBS_7D_NOT_MEANINGFUL: delta=${nc.subs7d.delta}, days=${nc.subs7d.daysCovered}`);
  }
  if (nc.views7d && !nc.views7d.meaningful) {
    w.push(`VIEWS_7D_NOT_MEANINGFUL: delta=${nc.views7d.delta}, days=${nc.views7d.daysCovered}`);
  }

  return w;
}
