import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData } from '@/lib/youtube/normalizeChannelData';
import type { LiveSnap } from '@/lib/artists';
import {
  FOUNDRY_COHORTS, FOUNDRY_UNRESOLVED, membersOf, type FoundryCohortId,
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
  const cohortId = (req.nextUrl.searchParams.get('cohort') ?? 'foundry-2026-fall') as FoundryCohortId;
  const cohort = FOUNDRY_COHORTS[cohortId];
  if (!cohort) {
    return NextResponse.json({ error: `Unknown cohort: ${cohortId}` }, { status: 404, headers: CORS });
  }

  const rows = await Promise.all(membersOf(cohortId).map(async member => {
    let channel = null;

    try {
      const snap = await readLiveSnapByHandle(member.handle) as LiveSnap | null;
      if (snap && !snap.error) {
        const history = await readHistory(member.channelId);
        const nc = normalizeChannelData(snap, history, null);

        channel = {
          subscribers: n(nc.subs),
          totalViews: n(nc.views),
          lastUploadAt: snap.lastUploadAt ?? null,
          daysSinceUpload: n(nc.cadence?.lastUploadDaysAgo),
          /* How many daily snapshots Watcher holds. Zero or one means
             there is no trend to read yet, and the page can say so
             rather than implying a flat line. */
          historyDays: n(nc.historyDepthDays),
        };
      }
    } catch {
      /* One unreachable channel must not empty the cohort. */
    }

    return { ...member, channel };
  }));

  return NextResponse.json({
    cohort,
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
