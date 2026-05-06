import { notFound } from 'next/navigation';
import { loadPlan } from '@/lib/planStore';
import { readLiveSnapByHandle, readChannelMapping } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { daysSince } from '@/lib/artists';
import { ARTISTS } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
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
        let views7Delta: number | null = null;
        let subs7Delta: number | null = null;
        const channelId = await readChannelMapping(artistConfig.channelHandle);
        if (channelId) {
          const history = await readHistory(channelId);
          const v7 = deltaOver(history, 7, 'views');
          const s7 = deltaOver(history, 7, 'subs');
          if (v7) views7Delta = v7.delta;
          if (s7) subs7Delta = s7.delta;
        }

        liveChannel = {
          subs: snap.subs ?? undefined,
          uploads30d: snap.uploads30d ?? undefined,
          shorts30d: snap.shorts30d ?? undefined,
          lastUploadDaysAgo: daysSince(snap.lastUploadAt) ?? undefined,
          views7Delta,
          subs7Delta,
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
