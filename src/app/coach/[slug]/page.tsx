import { notFound } from 'next/navigation';
import { loadPlan, savePlan, type CampaignDataCoverage, type HistoricalSource } from '@/lib/planStore';
import { readLiveSnapByHandle, readChannelMapping } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { matchPlanToUploads } from '@/lib/coach/matchEngine';
import { generateNudges } from '@/lib/coach/nudgeEngine';
import { generatePlan } from '@/lib/planEngine';
import CampaignDestination from '@/components/CampaignDestination';
import type { RecentUpload } from '@/lib/artists';

export const revalidate = 600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const saved = await loadPlan(slug);
  if (!saved) return { title: 'Campaign Not Found' };
  return {
    title: `${saved.artist} — ${saved.campaignName}`,
    description: saved.plan.strategy.priority,
  };
}

export default async function CampaignPage({ params }: PageProps) {
  const { slug } = await params;
  const saved = await loadPlan(slug);
  if (!saved) notFound();

  // Try to fetch live channel data
  let liveChannel: {
    subs?: number;
    views?: number;
    uploads30d?: number;
    shorts30d?: number;
    lastUploadDaysAgo?: number;
    views7Delta?: number | null;
    subs7Delta?: number | null;
  } | null = null;

  let recentUploads: RecentUpload[] = [];

  // Find the artist's channel handle
  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom];
  const artistConfig = allArtists.find(
    (a) => a.slug === saved.artist.toLowerCase().replace(/\s+/g, '-') ||
           a.name.toLowerCase() === saved.artist.toLowerCase()
  );

  // Auto-regenerate plan when:
  // 1. campaignStartDate is earlier than plan's first week, OR
  // 2. Early BUILD weeks exist but have no actions (engine fix deployed after plan was saved)
  if (artistConfig?.campaignStartDate) {
    // Reconstruct timeline from plan events if timelineText is missing
    const timelineText = saved.timelineText ||
      (saved.plan.events?.map((e: { dateISO: string; title: string }) =>
        `${e.dateISO} - ${e.title}`).join('\n') ?? '');

    if (timelineText) {
      let shouldRegen = false;

      // Check 1: plan starts too late vs campaignStartDate
      const firstWeekMatch = saved.plan.weeks[0]?.dateRange.match(/^(\w+)\s+(\d+)/);
      if (firstWeekMatch) {
        const monthMap: Record<string, number> = {
          Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
          Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
        };
        const m = monthMap[firstWeekMatch[1]];
        const d = parseInt(firstWeekMatch[2], 10);
        if (m != null) {
          const firstWeekDate = new Date(new Date().getFullYear(), m, d);
          const campStart = new Date(artistConfig.campaignStartDate + 'T12:00:00');
          const diffDays = (firstWeekDate.getTime() - campStart.getTime()) / 86400000;
          if (diffDays > 3) shouldRegen = true;
        }
      }

      // Check 2: early BUILD weeks have no actions (old engine bug)
      if (!shouldRegen) {
        const buildWeeks = saved.plan.weeks.filter((w: { phase: string }) => w.phase === 'BUILD');
        const emptyEarlyBuild = buildWeeks.slice(0, Math.ceil(buildWeeks.length / 2))
          .some((w: { actions: unknown[] }) => w.actions.length === 0);
        if (emptyEarlyBuild) shouldRegen = true;
      }

      if (shouldRegen) {
        const regen = generatePlan(
          timelineText,
          saved.artist,
          saved.channelCtx,
          artistConfig.campaignStartDate,
        );
        if (regen) {
          saved.plan = regen;
          savePlan(saved.slug, saved.artist, regen, saved.channelCtx, timelineText).catch(() => {});
        }
      }
    }
  }

  if (artistConfig?.channelHandle) {
    try {
      const snap = await readLiveSnapByHandle(artistConfig.channelHandle);
      if (snap) {
        const channelId = await readChannelMapping(artistConfig.channelHandle);
        const history = channelId ? await readHistory(channelId) : [];
        const nc = normalizeChannelData(snap, history);

        liveChannel = {
          subs: nc.subs ?? undefined,
          views: nc.views ?? undefined,
          uploads30d: nc.cadence.uploads30d || undefined,
          shorts30d: nc.cadence.shorts30d || undefined,
          lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? undefined,
          views7Delta: rawDelta(nc.views7d),
          subs7Delta: rawDelta(nc.subs7d),
        };

        // Pass recent uploads for execution matching
        recentUploads = snap.recentUploads ?? [];
      }
    } catch {
      // Live data is optional — page works without it
    }
  }

  // Compute data coverage — how complete is the historical picture?
  const dataCoverage = computeDataCoverage(
    recentUploads,
    artistConfig?.campaignStartDate ?? null,
    saved.historicalActivity ?? [],
  );

  // Run execution matching
  const matchResult = matchPlanToUploads(saved.plan, recentUploads);

  // Detect current phase
  const currentPhase = detectCurrentPhase(saved.plan);

  // Generate nudges
  const nudges = generateNudges({
    matchResult,
    channelCtx: saved.channelCtx,
    currentPhase,
    liveMetrics: liveChannel,
  });

  return (
    <CampaignDestination
      plan={saved.plan}
      channelCtx={saved.channelCtx}
      createdAt={saved.createdAt}
      slug={saved.slug}
      liveChannel={liveChannel}
      matchResult={matchResult}
      nudges={nudges}
      recentUploads={recentUploads}
      dataCoverage={dataCoverage}
      campaignStartDate={artistConfig?.campaignStartDate}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeDataCoverage(
  uploads: RecentUpload[],
  campaignStartDate: string | null,
  historicalActivity: { source: HistoricalSource }[],
): CampaignDataCoverage {
  const sources: HistoricalSource[] = [];
  if (uploads.length > 0) sources.push('kv_cache');
  if (historicalActivity.some(h => h.source === 'manual')) sources.push('manual');
  if (historicalActivity.some(h => h.source === 'coach_archive')) sources.push('coach_archive');

  // Check how far back API data goes
  let apiCoverageFrom: string | undefined;
  if (uploads.length > 0) {
    const oldest = uploads.reduce((o, u) =>
      new Date(u.publishedAt) < new Date(o.publishedAt) ? u : o
    );
    apiCoverageFrom = new Date(oldest.publishedAt).toISOString().split('T')[0];
    sources.push('youtube_api');
  }

  let fullCoverage = true;
  let coverageNote = 'Full campaign history from YouTube API';

  if (campaignStartDate && apiCoverageFrom) {
    const campStart = new Date(campaignStartDate + 'T00:00:00');
    const apiStart = new Date(apiCoverageFrom + 'T00:00:00');
    const gapDays = (apiStart.getTime() - campStart.getTime()) / 86400000;

    if (gapDays > 7) {
      fullCoverage = false;
      coverageNote = `Partial history — API data starts ${apiCoverageFrom}, campaign began ${campaignStartDate}`;
      if (historicalActivity.length > 0) {
        coverageNote += ` (${historicalActivity.length} manual entries fill gaps)`;
      }
    }
  } else if (!uploads.length && historicalActivity.length > 0) {
    fullCoverage = false;
    coverageNote = 'Historical activity loaded from saved data — no live API data';
  } else if (!uploads.length) {
    fullCoverage = false;
    coverageNote = 'No historical upload data available';
  }

  if (sources.includes('manual') && fullCoverage) {
    coverageNote = 'Full campaign history — includes manual entries';
  }

  return { sources, apiCoverageFrom, fullCoverage, coverageNote };
}

function detectCurrentPhase(plan: { weeks: { dateRange: string; phase: string }[] }) {
  const now = new Date();
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  for (const week of plan.weeks) {
    const match = week.dateRange.match(/^(\w+)\s+(\d+)/);
    if (!match) continue;
    const month = monthMap[match[1]];
    if (month == null) continue;
    const day = parseInt(match[2], 10);
    const weekDate = new Date(now.getFullYear(), month, day);
    const diff = (now.getTime() - weekDate.getTime()) / 86400000;
    if (diff >= -1 && diff <= 7) {
      return week.phase as 'BUILD' | 'RELEASE' | 'SCALE' | 'EXTEND';
    }
  }
  return null;
}
