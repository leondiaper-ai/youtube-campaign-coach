import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { OWNED_CHANNELS } from '@/lib/ownedChannels/channels';
import { ownedChannelsEnabled } from '@/lib/ownedChannels/gate';
import { readOwnedHistory, ownedStore } from '@/lib/ownedChannels/store';
import { summariseChannel } from '@/lib/ownedChannels/metrics';
import { getMarketFromRequest } from '@/lib/marketServer';
import OwnedChannelsBoard from './OwnedChannelsBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owned Channels — draft', robots: { index: false, follow: false } };

export default async function OwnedChannelsPage({ searchParams }: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!ownedChannelsEnabled()) notFound();
  const market = await getMarketFromRequest(searchParams);
  const mq = market.id === 'uk' ? '' : `?market=${market.id}`;
  // An explicit global roster, separate from any regional artist list.
  // Read-only browsing. API collection only happens after a button click.
  const results = await Promise.allSettled(OWNED_CHANNELS.map(async def =>
    summariseChannel(def, await readOwnedHistory(def.id)),
  ));
  const rows = results.map((r, i) => r.status === 'fulfilled' ? r.value : summariseChannel(OWNED_CHANNELS[i], []));
  const readFailed = results.some(r => r.status === 'rejected');
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader workspace="VMG · Owned network" meta={<span className="text-warn font-semibold">Draft · not in production</span>}
        nav={[
          { href: `/growth${mq}`, label: 'Channel Health', match: '/growth/owned' },
          { href: `/campaigns${mq}`, label: 'Active Campaigns' },
          { href: `/coach${mq}`, label: 'Coach' },
          { href: '/teams', label: 'Workspaces' },
          { href: '/resources', label: 'Resources' },
        ]} />
      <div className="max-w-[1180px] mx-auto px-6 pb-12">
        <PageTitle title="Owned Channels" lede="New listening destinations: track early traction, build a publishing rhythm, and see which uploads start finding an audience." />
        <Link href={`/growth${mq}`} className="inline-block text-meta font-semibold text-secondary mb-3">← Back to Watcher</Link>
        <p className="text-meta text-muted mb-7">VMG owned network · all markets · early-stage channels, measured against their own progress.</p>
        <OwnedChannelsBoard rows={rows} canCollect={!!ownedStore() && !readFailed && !!process.env.YOUTUBE_API_KEY} readFailed={readFailed} linkSuffix={mq} />
        <footer className="mt-10 pt-5 border-t border-line text-meta text-muted flex flex-wrap justify-between gap-3">
          <span>Build a baseline first. Compare each channel with its own progress.</span>
          <Link href="/cmg-youtube" className="text-secondary font-semibold">Research background ↗</Link>
        </footer>
      </div>
    </main>
  );
}
