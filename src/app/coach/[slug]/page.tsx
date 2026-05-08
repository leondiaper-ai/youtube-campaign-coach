import { notFound } from 'next/navigation';
import { loadPlan } from '@/lib/planStore';
import { readLiveSnapByHandle, readChannelMapping } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { daysSince } from '@/lib/artists';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import CampaignDestination from '@/components/CampaignDestination';

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

  // Try to fetch live channel data for the state strip
  let liveChannel: {
    subs?: number;
    views?: number;
    uploads30d?: number;
    shorts30d?: number;
    lastUploadDaysAgo?: number;
    views7Delta?: number | null;
    subs7Delta?: number | null;
  } | null = null;

  // Find the artist's channel handle
  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom];
  const artistConfig = allArtists.find(
    (a) => a.slug === saved.artist.toLowerCase().replace(/\s+/g, '-') ||
           a.name.toLowerCase() === saved.artist.toLowerCase()
  );

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
      }
    } catch {
      // Live data is optional — page works without it
    }
  }

  return (
    <CampaignDestination
      plan={saved.plan}
      channelCtx={saved.channelCtx}
      createdAt={saved.createdAt}
      slug={saved.slug}
      liveChannel={liveChannel}
    />
  );
}
