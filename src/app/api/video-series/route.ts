import { NextRequest, NextResponse } from 'next/server';
import { readVideoSeriesMany } from '@/lib/videoSnapshots';

/**
 * GET /api/video-series?ids=x6_mbnsh6VU,kPnN4IE_a98
 *
 * Raw per-video daily observations, exactly as recorded. Nothing derived.
 *
 * ── WHY RAW ───────────────────────────────────────────────────────────
 * The one thing this data is uniquely good for is reading a trajectory
 * BREAK — a day where a video's daily gain steps to a different level
 * because something happened in the world. Every existing consumer of
 * vsnap (rankByMomentum, viewsAtAge) collapses the series to one summary
 * figure, which is the wrong shape for that question. An analysis of an
 * intervention needs the whole series and needs to see its own gaps.
 *
 * So this returns the observations untouched and additionally returns
 * `gaps`: the intervals longer than one day. The refresh does not run
 * every day, and when it skips, the next reading carries the whole
 * interval's views. A caller that plots raw day-to-day differences
 * without accounting for that gets a sawtooth of zeroes and spikes and
 * will mistake a missed reading for a quiet day — or, worse, mistake the
 * catch-up reading for a surge. Making the gaps explicit in the payload
 * means the caller has to deal with them.
 *
 * Read-only, public figures, CORS-open for the same reason artist-live is:
 * standalone decks are served as static HTML and cannot reach same-origin.
 */
export const revalidate = 300;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Whole days between two ISO dates. */
function dayGap(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime();
  return Math.round(ms / 86_400_000);
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids');
  if (!raw) {
    return NextResponse.json({ error: 'missing ids' }, { status: 400, headers: CORS });
  }

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const series = await readVideoSeriesMany(ids);

  const out = ids.map((id) => {
    const s = series.get(id);
    if (!s?.observations?.length) {
      return { videoId: id, has: false, publishedAt: null, observations: [], gaps: [] };
    }

    const obs = [...s.observations].sort((a, b) => a.ts.localeCompare(b.ts));

    /* Intervals where no reading was taken. The views credited to the day
       after a gap actually accrued across the whole interval. */
    const gaps: { from: string; to: string; days: number; views: number }[] = [];
    for (let i = 1; i < obs.length; i++) {
      const d = dayGap(obs[i - 1].ts, obs[i].ts);
      if (d > 1) {
        gaps.push({
          from: obs[i - 1].ts,
          to: obs[i].ts,
          days: d,
          views: obs[i].views - obs[i - 1].views,
        });
      }
    }

    return {
      videoId: id,
      has: true,
      publishedAt: s.publishedAt,
      first: obs[0].ts,
      last: obs[obs.length - 1].ts,
      count: obs.length,
      /* Calendar days spanned, which is NOT the same as the number of
         observations whenever the refresh has skipped a day. */
      spanDays: dayGap(obs[0].ts, obs[obs.length - 1].ts) + 1,
      observations: obs,
      gaps,
    };
  });

  return NextResponse.json(
    { readAt: new Date().toISOString(), series: out },
    { headers: CORS },
  );
}
