import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData } from '@/lib/youtube/normalizeChannelData';
import { computeMultiformat } from '@/lib/contentStructure';
import type { LiveSnap } from '@/lib/artists';
import {
  FOUNDRY_COHORTS, FOUNDRY_COHORT_IDS, FOUNDRY_UNRESOLVED, membersOf,
  type FoundryCohortId,
} from '@/lib/intelligence/foundryCohort';

/**
 * GET /api/foundry?cohort=foundry-2026-fall
 *
 * The Foundry cohort with whatever Watcher currently knows about each
 * channel. Read-only: no writes, no stored metrics, no baselines. Watcher
 * accumulates history from the day a channel was added, and that is the
 * only history this feature needs.
 *
 * Channel figures come through normalizeChannelData — the same function
 * the Watcher and artist pages use — so a Foundry number and a Watcher
 * number for the same channel are the same number by construction.
 */

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function GET(req: NextRequest) {
  /* ?cohort=all returns every tracked Foundry artist across intakes, which
     is what the page asks for — one list, with each row still carrying the
     cohort it belongs to. A named cohort still returns just that cohort, so
     the two intakes remain separable by anything that wants them apart. */
  const requested = req.nextUrl.searchParams.get('cohort') ?? 'all';
  const cohortId = requested as FoundryCohortId | 'all';
  if (cohortId !== 'all' && !FOUNDRY_COHORTS[cohortId]) {
    return NextResponse.json({ error: `Unknown cohort: ${requested}` }, { status: 404, headers: CORS });
  }
  const cohort = cohortId === 'all'
    ? { id: 'all', label: 'YouTube Foundry 2026', short: 'All', year: 2026, drop: 'All intakes' }
    : FOUNDRY_COHORTS[cohortId];

  const rows = await Promise.all(membersOf(cohortId).map(async member => {
    let channel = null;

    try {
      const snap = await readLiveSnapByHandle(member.handle) as LiveSnap | null;
      if (snap && !snap.error) {
        const history = await readHistory(member.channelId);
        const nc = normalizeChannelData(snap, history, null);

        /* The newest upload, for the card image. Sorted here rather than
           trusting the array order — recentUploads is assembled by the sync
           and nothing guarantees it stays newest-first. The thumbnail URL is
           derived from the video id, which is the documented i.ytimg.com
           pattern and needs no extra API call. */
        const newest = (snap.recentUploads ?? [])
          .filter(u => u && u.id && u.publishedAt)
          .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] ?? null;

        /* Format range, from the same function the Watcher and the weekly
           spotlight use. Reads the last 90 days of uploads, so unlike a
           trend it needs no accumulated history — which is the whole reason
           it can appear here on day one. */
        const mf = computeMultiformat(snap.recentUploads ?? []);
        const formatNames = [
          mf.hasOfficialVideo && 'Official Video',
          mf.hasLyricVideo && 'Lyric Video',
          mf.hasVisualizer && 'Visualiser',
          mf.hasBTS && 'BTS',
          mf.hasLiveSession && 'Live session',
          mf.hasShorts && 'Shorts',
        ].filter(Boolean) as string[];

        channel = {
          subscribers: n(nc.subs),
          totalViews: n(nc.views),
          /* Cadence — how much, and of what. Straight from the snap's own
             30-day counts, so it says what the channel did rather than what
             it is trending towards. */
          uploads30d: n(nc.cadence?.uploads30d),
          shorts30d: n(nc.cadence?.shorts30d),
          videos30d: n(nc.cadence?.videos30d),
          formats: { count: mf.formatCount, of: 6, names: formatNames },
          lastUploadAt: snap.lastUploadAt ?? null,
          daysSinceUpload: n(nc.cadence?.lastUploadDaysAgo),
          /* Channel avatar, straight from the snap. */
          avatar: snap.thumbnail ?? null,
          latest: newest ? {
            videoId: newest.id,
            title: newest.title ?? null,
            publishedAt: newest.publishedAt,
            views: n(newest.viewCount),
            /* Engagement on the newest upload. Counts rather than comment
               text: the Fan Voice safety and sentiment layer reads English
               only, and most of this cohort publishes in Portuguese,
               Japanese, Turkish and Spanish. A count says an audience is
               responding without us claiming to know what they said. */
            likes: n(newest.likeCount),
            comments: n(newest.commentCount),
            thumb: `https://i.ytimg.com/vi/${newest.id}/hqdefault.jpg`,
          } : null,
          /* How many daily snapshots Watcher holds. Zero or one means
             there is no trend to read yet, and the page can say so
             rather than implying a flat line. */
          historyDays: n(nc.historyDepthDays),
        };
      }
    } catch {
      /* One unreachable channel must not empty the cohort. */
    }

    /* The cohort travels with the row so the page can mark it without a
       second lookup. */
    return { ...member, cohortLabel: FOUNDRY_COHORTS[member.cohort].label,
             cohortShort: FOUNDRY_COHORTS[member.cohort].short, channel };
  }));

  /* Per-intake counts, so nothing downstream has to count rows itself or
     hard-code a total that goes stale the next time an artist is added. */
  const byCohort = FOUNDRY_COHORT_IDS.map(id => ({
    id,
    label: FOUNDRY_COHORTS[id].label,
    short: FOUNDRY_COHORTS[id].short,
    tracked: rows.filter(r => r.cohort === id).length,
  })).filter(c => c.tracked > 0);

  return NextResponse.json({
    cohort,
    cohorts: byCohort,
    counts: {
      tracked: rows.length,
      withData: rows.filter(r => r.channel).length,
      unresolved: FOUNDRY_UNRESOLVED.length,
    },
    rows,
    unresolved: FOUNDRY_UNRESOLVED,
    generatedAt: new Date().toISOString(),
  }, { headers: CORS });
}
