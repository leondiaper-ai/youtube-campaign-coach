import { notFound } from 'next/navigation';
import {
  ARTISTS, mergeArtistLists, deriveFromLive, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnap } from '@/lib/kvCache';
import { readHistory, channelDeltaSince } from '@/lib/snapshots';
import { campaignPerformanceFor } from '@/lib/intelligence/campaignWindow';
import {
  normalizeChannelData, rawDelta, computeWoW,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getCampaignSignal, getChannelHealth,
  type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { toGrowthInput } from '@/lib/youtube/normalizeChannelData';
import { listEntries, type TeamWatcherEntry } from '@/lib/teamWatcherStore';
import { CAMPAIGN_STATE_STYLE, type CampaignState } from '@/lib/teamWatcherStore';
import { checkContentStructure } from '@/lib/contentStructure';
import TeamDetailClient, { type SnapshotData, type CampaignTrackingData, type WeeklyProgressEntry } from '@/app/team-watcher/[slug]/TeamDetailClient';
import TeamArtistActions from '@/components/TeamArtistActions';
import WatcherArtistView from '@/components/WatcherArtistView';

export const dynamic = 'force-dynamic';

export async function buildMetadata(slug: string, teamSlug = 'nordics') {
  const entries = await listEntries(teamSlug);
  const entry = entries.find((e) => e.artistSlug === slug);
  return {
    title: entry
      ? `${entry.displayName} — Team Campaign Board`
      : 'Artist — Team Campaign Board',
  };
}

const STATE_LABEL: Record<ChannelState, string> = {
  HEALTHY:           'Healthy',
  'WEAK CONVERSION': 'Weak Conversion',
  BUILDING:          'Building',
  'AT RISK':         'At Risk',
  COLD:              'Cold',
};

// ── Component ────────────────────────────────────────────────────────────────

/* ── ONE DETAIL VIEW, MANY TEAMS ────────────────────────────────────
   Same reasoning as the board: the team and the way back are arguments,
   so a regional board's rows open a page that belongs to that board
   rather than dropping the reader into ours. */
export default async function TeamArtistDetail({ slug, team = 'nordics', backHref = '/team-watcher' }: {
  slug: string; team?: string; backHref?: string;
}) {

  // Find the team watcher entry
  const entries = await listEntries(team);
  const entry = entries.find((e) => e.artistSlug === slug);
  if (!entry) notFound();

  // Load cached YouTube data
  const snap = await readLiveSnap(entry.channelId);
  const history = snap?.channelId ? await readHistory(snap.channelId) : [];

  const campaignStart = entry.campaignStartDate || null;
  const nc = normalizeChannelData(snap, history, campaignStart ? {
    campaignName: entry.campaignName || 'Tracking',
    campaignStartDate: campaignStart,
    isActive: true,
  } : null);

  const subs7Val = rawDelta(nc.subs7d);
  const views7Val = rawDelta(nc.views7d);

  // Derive channel state
  const derived = snap ? deriveFromLive(snap, {
    subs7Delta: subs7Val,
    views7Delta: views7Val,
  }) : null;
  const channelState: ChannelState = derived?.status ?? 'COLD';

  // Match existing artist for phase/type
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const artist = allArtists.find((a) => a.slug === entry.artistSlug);

  // Growth OS dual state
  const growthInput: GrowthInput = {
    ...toGrowthInput(nc, artist ?? { slug: entry.artistSlug, name: entry.displayName, phase: 'PRE' as const }),
    hasActiveCampaign: !!entry.campaignName,
    campaignName: entry.campaignName || undefined,
    lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? 60,
  };
  const gsResult = getYouTubeGrowthState(growthInput);
  const chHealth = getChannelHealth(gsResult.state, growthInput);
  const campSig = getCampaignSignal(growthInput);

  // Campaign period deltas
  let campaignDay: number | null = null;
  let campaignViewsDelta: number | null = null;
  let campaignSubsDelta: number | null = null;
  /* ── CAMPAIGN PERFORMANCE ───────────────────────────────────────────
     `entry.campaignStartDate` is a Team Watcher field a PERSON fills in on
     the Start Campaign form, which makes it the one genuinely human
     campaign start in the product — and until now it never reached the
     resolver, so the HUMAN_STATED branch was unreachable in production.
     It is passed as `statedAt` and beats the observation, which is right:
     somebody who ran the campaign knows when it started. */
  const perf = campaignPerformanceFor({
    uploads: (snap?.recentUploads ?? []) as { publishedAt: string; viewCount?: number | null; durationSec?: number | null }[],
    statedAt: campaignStart || null,
    statedBy: 'Team Watcher',
  });
  if (campaignStart) {
    campaignDay = perf?.day ?? null;
    /* Whole-channel movement, kept under a channel label. */
    const cv = channelDeltaSince(history, campaignStart, 'views');
    const cs = channelDeltaSince(history, campaignStart, 'subs');
    campaignViewsDelta = cv?.delta ?? null;
    campaignSubsDelta = cs?.delta ?? null;
  }

  // Conversion metric
  const spk = (views7Val != null && views7Val > 0 && subs7Val != null)
    ? (subs7Val / views7Val) * 1000
    : null;

  // WoW deltas
  const { deltaOver } = await import('@/lib/snapshots');
  const subs14Raw = deltaOver(history, 14, 'subs');
  const views14Raw = deltaOver(history, 14, 'views');
  const subsWoW = computeWoW(nc.subs7d, subs14Raw);
  const viewsWoW = computeWoW(nc.views7d, views14Raw);

  const lastUpDays = nc.cadence.lastUploadDaysAgo;

  // Campaign content stats (if campaign is active)
  const campaignUploads = campaignStart
    ? (snap?.recentUploads ?? []).filter(
        (u: { publishedAt: string }) => new Date(u.publishedAt).getTime() >= new Date(campaignStart).getTime()
      )
    : [];
  /* From campaignWindow.ts, not from a fourth copy of the same reduce. */
  const campaignContentViews = perf?.views ?? null;
  const campaignContentCount = perf?.assets ?? 0;
  const campaignShortsCount = perf?.shorts ?? 0;

  // ── Campaign tracking data (weekly progress, trend, structure) ────────
  let campaignTracking: CampaignTrackingData | undefined;
  if (campaignStart && campaignDay) {
    const startTs = new Date(campaignStart).getTime();
    const uploads = campaignUploads as { publishedAt: string; viewCount: number; durationSec: number; id: string; title: string }[];

    // Weekly progress from history
    const weeklyProgress: WeeklyProgressEntry[] = [];
    const relevantHistory = history
      .filter((h: { ts: string; views?: number | null; subs?: number | null }) =>
        new Date(h.ts).getTime() >= startTs && (h.views != null || h.subs != null)
      )
      .sort((a: { ts: string }, b: { ts: string }) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (relevantHistory.length >= 2) {
      let weekNum = 1;
      let windowStart = startTs;
      let baseline = relevantHistory[0];

      while (windowStart < Date.now()) {
        const windowEnd = windowStart + 7 * 86400000;
        const inWindow = relevantHistory.filter((h: { ts: string }) => {
          const t = new Date(h.ts).getTime();
          return t >= windowStart && t < windowEnd;
        });
        const latest = inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;

        if (latest) {
          const vd = (latest.views != null && baseline.views != null)
            ? Math.max(0, latest.views - baseline.views) : null;
          const sd = (latest.subs != null && baseline.subs != null)
            ? latest.subs - baseline.subs : null;
          const status = (vd == null && sd == null) ? 'partial' as const
            : (vd != null || sd != null) ? 'confirmed' as const : 'partial' as const;
          weeklyProgress.push({
            week: weekNum,
            views7d: vd,
            subs7d: sd,
            channelHealth: STATE_LABEL[channelState],
            campaignSignal: campSig.label,
            status,
          });
          baseline = latest;
        } else {
          weeklyProgress.push({
            week: weekNum,
            views7d: null,
            subs7d: null,
            channelHealth: STATE_LABEL[channelState],
            campaignSignal: campSig.label,
            status: 'missing',
          });
        }
        weekNum++;
        windowStart = windowEnd;
      }
    }

    // Current/previous week views for momentum
    const currentWeekViews = weeklyProgress.length > 0 ? weeklyProgress[weeklyProgress.length - 1].views7d : null;
    const previousWeekViews = weeklyProgress.length >= 2 ? weeklyProgress[weeklyProgress.length - 2].views7d : null;

    // Content structure warning — use full recentUploads from snap (includes all required fields)
    const campaignRecentUploads = (snap?.recentUploads ?? []).filter(
      (u: { publishedAt: string }) => new Date(u.publishedAt).getTime() >= startTs,
    );
    const structureWarning = checkContentStructure(campaignRecentUploads);

    campaignTracking = {
      campaignName: entry.campaignName || 'Tracking',
      campaignDay,
      contentViews: campaignContentViews,
      channelViewsDelta: campaignViewsDelta,
      subsGained: campaignSubsDelta,
      contentMix: {
        uploads: campaignContentCount,
        shorts: campaignShortsCount,
        videos: perf?.longForm ?? 0,
      },
      currentWeekViews,
      previousWeekViews,
      weeklyProgress,
      structureWarning: structureWarning ? { headline: structureWarning.headline, detail: structureWarning.detail } : null,
      campaignSignalLabel: campSig.label,
    };
  }

  // Sparkline data
  const sparkColor = (() => {
    if (channelState === 'HEALTHY') return { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' };
    if (channelState === 'WEAK CONVERSION') return { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.06)' };
    if (channelState === 'AT RISK' || channelState === 'COLD') return { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' };
    return { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' };
  })();

  const stateStyle = CAMPAIGN_STATE_STYLE[entry.campaignState as CampaignState] ?? CAMPAIGN_STATE_STYLE.Monitoring;

  /* ── ONE ARTIST PAGE, NOT TWO ──────────────────────────────────────
     This used to be its own layout: a thinner set of tiles built
     separately from the Watcher's. Two pages analysing the same channel
     drift, and the one nobody reads daily drifts furthest — so a team
     now reads exactly what we read. What differs is the chrome around
     it (their pin, their way back, no Coach) and their own notes and
     campaign fields, which hang underneath. */
  return (
    <WatcherArtistView
      slug={slug}
      coachBadge={false}
      signature="Channel activity · public YouTube data · updated daily"
      chrome={
        <TeamArtistActions
          slug={slug}
          artistName={entry.displayName}
          channelId={entry.channelId}
          team={team}
          backHref={backHref}
          backLabel="Team Campaign Board"
          initiallyPinned={!!entry.pinnedAt}
        />
      }
      footer={
        <div className="mt-10">
          <TeamDetailClient
            team={team}
            channelId={entry.channelId}
            initialNotes={entry.teamNotes}
            campaignState={entry.campaignState}
            regionTag={entry.regionTag}
            hasCampaign={!!campaignStart && !!entry.campaignName}
            initialCampaignName={entry.campaignName}
            campaignTracking={campaignTracking}
            snapshotData={{
              artistName: entry.displayName,
              channelState: STATE_LABEL[channelState],
              campaignState: entry.campaignState,
              diagnosis: derived?.reason ?? 'No data yet',
              nextAction: derived?.nextAction ?? null,
              cadenceLine: nc.cadence.cadenceLine,
              subs: nc.subs,
              views7d: views7Val,
              subs7d: subs7Val,
              uploads30d: nc.cadence.uploads30d,
              shorts30d: nc.cadence.shorts30d,
              lastUpDays: lastUpDays ?? null,
              spk,
              viewsWoW: viewsWoW?.value ?? null,
              subsWoW: subsWoW?.value ?? null,
              campaignName: entry.campaignName,
              campaignDay,
              campaignViewsDelta,
              campaignSubsDelta,
              campaignContentViews,
              campaignContentCount,
              campaignShortsCount,
            }}
          />
        </div>
      }
    />
  );
}
