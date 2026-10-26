import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/ui/AppHeader';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { ownedChannelsEnabled } from '@/lib/ownedChannels/gate';
import { readOwnedHistory, ownedStore } from '@/lib/ownedChannels/store';
import { analyseOwnedChannel } from '@/lib/ownedChannels/analysis';
import { getMarketFromRequest } from '@/lib/marketServer';
import OwnedChannelAnalysis from './OwnedChannelAnalysis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owned Channel Analysis — Watcher', robots: { index: false, follow: false } };

export default async function OwnedChannelPage({ params, searchParams }: {
  params: { slug: string } | Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!ownedChannelsEnabled()) notFound();
  const { slug } = await params;
  const channel = OWNED_CHANNELS.find(c => c.slug === slug || c.id === slug);
  if (!channel) notFound();
  const market = await getMarketFromRequest(searchParams);
  if (market.id !== 'uk') notFound();
  const mq = '';
  let readFailed = false;
  const history = await readOwnedHistory(channel.id).catch(() => { readFailed = true; return []; });
  const analysis = analyseOwnedChannel(channel, history);
  return <main className="min-h-screen bg-paper text-ink">
    <AppHeader workspace="VMG · Owned network" meta={<span className="text-warn font-semibold">UK · Owned network</span>}
      nav={[
        { href: `/growth${mq}`, label: 'Channel Health', match: '/growth' },
        { href: `/campaigns${mq}`, label: 'Active Campaigns' },
        { href: `/coach${mq}`, label: 'Coach' },
        { href: '/teams', label: 'Workspaces' },
        { href: '/resources', label: 'Resources' },
      ]} />
    <div className="max-w-[1180px] mx-auto px-6 pb-12">
      <OwnedChannelAnalysis key={channel.id} analysis={analysis} readFailed={readFailed} linkSuffix={mq}
        canCollect={validChannelId(channel.id) && !!ownedStore() && !readFailed && !!process.env.YOUTUBE_API_KEY} />
    </div>
  </main>;
}
