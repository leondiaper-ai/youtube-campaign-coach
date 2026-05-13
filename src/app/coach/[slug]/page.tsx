import { notFound } from 'next/navigation';
import { loadPlan, savePlan } from '@/lib/planStore';
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

  // Auto-extend plan backward if campaignStartDate is earlier than plan's first week
  if (artistConfig?.campaignStartDate && saved.timelineText) {
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
        // If the plan starts more than 3 days after the campaign start, regenerate
        const diffDays = (firstWeekDate.getTime() - campStart.getTime()) / 86400000;
        if (diffDays > 3) {
          const regen = generatePlan(
            saved.timelineText,
            saved.artist,
            saved.channelCtx,
            artistConfig.campaignStartDate,
          );
          if (regen) {
            saved.plan = regen;
            // Persist the regenerated plan
            savePlan(saved.slug, saved.artist, regen, saved.channelCtx, saved.timelineText).catch(() => {});
          }
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
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
