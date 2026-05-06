import { NextRequest, NextResponse } from 'next/server';
import { readChannelMapping } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';

/**
 * GET /api/debug/snapshots?handle=@KTrap1
 * Dumps the raw snapshot history for a channel handle.
 * Shows the full time-series so we can diagnose delta issues.
 */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');
  if (!handle) return NextResponse.json({ error: 'missing handle param' }, { status: 400 });

  const channelId = await readChannelMapping(handle);
  if (!channelId) {
    return NextResponse.json({ error: 'no_channel_mapping', handle }, { status: 404 });
  }

  const history = await readHistory(channelId);

  // Compute what deltaOver would return for 7d views
  const now = Date.now();
  const cutoff7 = now - 7 * 86400000;
  const cutoff14 = now - 14 * 86400000;

  const last = history.length > 0 ? history[history.length - 1] : null;
  const baseline7 = history.length >= 2
    ? ([...history].reverse().find((h) => new Date(h.ts).getTime() <= cutoff7) ?? history[0])
    : null;
  const baseline14 = history.length >= 2
    ? ([...history].reverse().find((h) => new Date(h.ts).getTime() <= cutoff14) ?? history[0])
    : null;

  return NextResponse.json({
    handle,
    channelId,
    totalSnapshots: history.length,
    dateRange: history.length > 0
      ? { first: history[0].ts, last: history[history.length - 1].ts }
      : null,
    deltaDebug: {
      now: new Date(now).toISOString(),
      cutoff7d: new Date(cutoff7).toISOString(),
      cutoff14d: new Date(cutoff14).toISOString(),
      latestSnapshot: last ? { ts: last.ts, views: last.views, subs: last.subs } : null,
      baseline7d: baseline7 ? { ts: baseline7.ts, views: baseline7.views, subs: baseline7.subs } : null,
      baseline14d: baseline14 ? { ts: baseline14.ts, views: baseline14.views, subs: baseline14.subs } : null,
      views7dDelta: last && baseline7 ? last.views - baseline7.views : null,
      subs7dDelta: last && baseline7 ? last.subs - baseline7.subs : null,
    },
    // Last 14 snapshots for quick inspection
    recentSnapshots: history.slice(-14).map((h) => ({
      ts: h.ts,
      subs: h.subs,
      views: h.views,
      uploads30d: h.uploads30d,
      shorts30d: h.shorts30d,
    })),
    // All snapshots (views only) for full picture
    allViewsTimeline: history.map((h) => ({ ts: h.ts, views: h.views })),
  });
}
