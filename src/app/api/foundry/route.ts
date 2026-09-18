import { NextRequest, NextResponse } from 'next/server';
import {
  readLiveSnapByHandle, writeFoundryBaseline, readFoundryBaseline, repairEmptyFoundryBaseline,
} from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData } from '@/lib/youtube/normalizeChannelData';
import type { LiveSnap } from '@/lib/artists';
import {
  FOUNDRY_COHORTS, FOUNDRY_MEMBERS, FOUNDRY_UNRESOLVED, FOUNDRY_SPELLING_NOTES,
  FOUNDRY_SIGNALS, FOUNDRY_VMG_OVERLAP, membersOf, activityOf,
  type FoundryBaseline, type FoundryCohortId, type FoundryRow,
} from '@/lib/intelligence/foundryCohort';

/**
 * GET /api/foundry?cohort=foundry-2026-fall
 *
 * The Foundry cohort, assembled at request time from Watcher's own cached
 * channel data. This route stores no channel metrics of its own — it reads
 * the same live snaps the Watcher pages read, so a Foundry number and a
 * Watcher number for the same channel cannot drift apart.
 *
 * It has one side effect, and only one: the first time it sees a channel
 * it freezes a baseline (see writeFoundryBaseline, which refuses to
 * overwrite). That is what makes "since tracking" measurable later.
 */

export const revalidate = 600;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

export async function GET(req: NextRequest) {
  const cohortId = (req.nextUrl.searchParams.get('cohort') ?? 'foundry-2026-fall') as FoundryCohortId;
  const cohort = FOUNDRY_COHORTS[cohortId];
  if (!cohort) {
    return NextResponse.json({ error: `Unknown cohort: ${cohortId}` }, { status: 404, headers: CORS });
  }

  const members = membersOf(cohortId);
  const now = new Date().toISOString();

  const rows: FoundryRow[] = await Promise.all(members.map(async member => {
    let current: FoundryRow['current'] = null;
    let baseline = await readFoundryBaseline<FoundryBaseline>(member.channelId);

    try {
      const snap = await readLiveSnapByHandle(member.handle ?? member.name) as LiveSnap | null;
      if (snap && !snap.error) {
        const history = member.channelId ? await readHistory(member.channelId) : [];

        /* Read through normalizeChannelData — the SAME function the Watcher
           and artist-live pages use — rather than reaching into the raw KV
           snap. The first version of this route did reach in, using field
           names lifted from an API response that had already been through
           this normalizer (subscriberCount, videoCount, uploadsLast14Days).
           None of those exist on the raw snap, so every metric silently
           came back null. Going through the normalizer makes a Foundry
           number and a Watcher number the same number by construction,
           which was the stated principle all along. */
        const nc = normalizeChannelData(snap, history, null);
        const cad = nc.cadence;

        const lastUploadAt = snap.lastUploadAt ?? null;
        const daysSinceUpload = n(cad?.lastUploadDaysAgo);
        const uploads30 = n(cad?.uploads30d);

        current = {
          subscribers: n(nc.subs),
          totalViews: n(nc.views),
          lastUploadAt,
          daysSinceUpload,
          uploads30d: uploads30,
          shorts30d: n(cad?.shorts30d),
          longform30d: n(cad?.videos30d),
          views7: nc.views7d ? n(nc.views7d.delta) : null,
          views30: nc.views30d ? n(nc.views30d.delta) : null,
          subs30: nc.subs30d ? n(nc.subs30d.delta) : null,
          historyDepthDays: n(nc.historyDepthDays),
          activity: activityOf(daysSinceUpload, uploads30),
        };

        const snapshotOf = () => ({
          channelId: member.channelId,
          capturedAt: now,
          subscribers: current!.subscribers,
          totalViews: current!.totalViews,
          lastUploadAt: current!.lastUploadAt,
          uploads30d: current!.uploads30d,
          shorts30d: current!.shorts30d,
          longform30d: current!.longform30d,
          watcherHistoryDays: current!.historyDepthDays,
        });

        if (!baseline) {
          const fresh = snapshotOf();
          const stored = await writeFoundryBaseline(member.channelId, fresh);
          baseline = stored ? fresh : await readFoundryBaseline<FoundryBaseline>(member.channelId);
        } else if (baseline.subscribers == null && baseline.totalViews == null) {
          /* An anchor written from the null-metric bug. Not a real
             baseline — replace it once, now that we can read properly. */
          const fresh = snapshotOf();
          const repaired = await repairEmptyFoundryBaseline(member.channelId, fresh);
          if (repaired) baseline = fresh;
        }
      }
    } catch {
      /* One unreachable channel must not empty the cohort. The row comes
         back with current:null and the page omits its metrics. */
    }

    /* "Since tracking" only exists once time has actually passed. On day
       zero every delta is 0, and a column of zeroes reads as "flat"
       rather than "we only just started" — so it stays null and the UI
       shows the tracking-started date instead. */
    let sinceTracking: FoundryRow['sinceTracking'] = null;
    if (baseline && current) {
      const days = daysBetween(baseline.capturedAt, now);
      if (days >= 1) {
        sinceTracking = {
          days,
          subscribers: current.subscribers != null && baseline.subscribers != null
            ? current.subscribers - baseline.subscribers : null,
          totalViews: current.totalViews != null && baseline.totalViews != null
            ? current.totalViews - baseline.totalViews : null,
        };
      }
    }

    return { member, current, baseline, sinceTracking };
  }));

  const withData = rows.filter(r => r.current);
  const baselined = rows.filter(r => r.baseline).length;

  return NextResponse.json({
    cohort,
    /* Counts are stated separately and never merged. "16 artists" would
       be wrong; "13 tracked, 3 not yet in Watcher" is what is true. */
    counts: {
      tracked: members.length,
      withLiveData: withData.length,
      baselineCaptured: baselined,
      unresolved: FOUNDRY_UNRESOLVED.length,
      namedInBrief: members.length + FOUNDRY_UNRESOLVED.length,
    },
    rows,
    unresolved: FOUNDRY_UNRESOLVED,
    spellingNotes: FOUNDRY_SPELLING_NOTES,
    vmgOverlap: FOUNDRY_VMG_OVERLAP,
    /* Empty until findings are earned. The page renders the empty state
       rather than inventing cohort patterns from one snapshot. */
    signals: FOUNDRY_SIGNALS,
    generatedAt: now,
  }, { headers: CORS });
}
