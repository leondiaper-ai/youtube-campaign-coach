import { NextRequest, NextResponse } from 'next/server';
import { readLiveSnapByHandle, writeFoundryBaseline, readFoundryBaseline } from '@/lib/kvCache';
import { readHistory, channelDeltaSince } from '@/lib/snapshots';
import {
  FOUNDRY_COHORTS, FOUNDRY_MEMBERS, FOUNDRY_UNRESOLVED, FOUNDRY_SPELLING_NOTES,
  FOUNDRY_SIGNALS, membersOf, activityOf,
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
      const snap = await readLiveSnapByHandle(member.handle ?? member.name) as Record<string, unknown> | null;
      if (snap && !snap.error) {
        const history = member.channelId ? await readHistory(member.channelId) : [];

        /* Deltas come from Watcher's own history, not from our baseline.
           Two different questions: "what has this channel done lately"
           (Watcher) and "what has changed since we started watching"
           (baseline). Conflating them would make a channel we added
           today look like it had no recent activity. */
        const since = (days: number) =>
          new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const v7  = history.length ? channelDeltaSince(history, since(7), 'views') : null;
        const v30 = history.length ? channelDeltaSince(history, since(30), 'views') : null;
        const s30 = history.length ? channelDeltaSince(history, since(30), 'subs') : null;

        const lastUploadAt = (snap.lastUploadDate as string) ?? null;
        const daysSinceUpload = n(snap.daysSinceLastUpload);
        const uploads14 = n(snap.uploadsLast14Days);

        current = {
          subscribers: n(snap.subscriberCount),
          totalViews: n(snap.viewCount),
          videoCount: n(snap.videoCount),
          lastUploadAt,
          daysSinceUpload,
          uploadsLast7Days: n(snap.uploadsLast7Days),
          uploadsLast14Days: uploads14,
          shortsLast14Days: n(snap.shortsLast14Days),
          longformLast14Days: n(snap.videosLast14Days),
          views7: v7 ? n(v7.delta) : null,
          views30: v30 ? n(v30.delta) : null,
          subs30: s30 ? n(s30.delta) : null,
          activity: activityOf(daysSinceUpload, uploads14),
        };

        /* Freeze the baseline the first time we successfully see this
           channel. Only ever on a good read — anchoring a cohort to a
           failed fetch would poison every future comparison. */
        if (!baseline) {
          const fresh: FoundryBaseline = {
            channelId: member.channelId,
            capturedAt: now,
            subscribers: current.subscribers,
            totalViews: current.totalViews,
            videoCount: current.videoCount,
            lastUploadAt: current.lastUploadAt,
            uploadsLast7Days: current.uploadsLast7Days,
            uploadsLast14Days: current.uploadsLast14Days,
            shortsLast14Days: current.shortsLast14Days,
            longformLast14Days: current.longformLast14Days,
            watcherHistoryDays: history.length || null,
          };
          const stored = await writeFoundryBaseline(member.channelId, fresh);
          baseline = stored ? fresh : await readFoundryBaseline<FoundryBaseline>(member.channelId);
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
          uploads: current.videoCount != null && baseline.videoCount != null
            ? current.videoCount - baseline.videoCount : null,
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
    /* Empty until findings are earned. The page renders the empty state
       rather than inventing cohort patterns from one snapshot. */
    signals: FOUNDRY_SIGNALS,
    generatedAt: now,
  }, { headers: CORS });
}
