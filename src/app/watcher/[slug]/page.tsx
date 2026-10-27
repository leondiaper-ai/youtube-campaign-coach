import { getLabelWorkspace } from '@/lib/labels';
import { getArtistsForMarket } from '@/lib/marketScope';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/ui/AppHeader';
import WatcherArtistView from '@/components/WatcherArtistView';
import { getMarketFromRequest } from '@/lib/marketServer';

/* ═══════════════════════════════════════════════════════════════════════
   OUR OWN ARTIST PAGE — now genuinely just a mount point.

   This used to assemble a top bar (back link, a Behaviour link that only
   appeared for pinned artists, a pin button) and pass a separate metrics
   strip. All of that has moved into the view itself:

     - the actions are ArtistActionBar, rendered by WatcherArtistView
       whenever no `chrome` is supplied, so every reader of the page gets
       the same controls in the same place;
     - the format split and markets are part of ArtistOverview now, so
       passing FormatSplitPanel here would render them a second time.

   A team board still passes its own chrome, because its pin writes to
   that board's store and its "back" goes somewhere else.
   ═══════════════════════════════════════════════════════════════════════ */

export const revalidate = 600;

export default async function WatcherPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  /* The action bar's default "← Dashboard" and "Channel behaviour" links are
     built from this. Without it an Australian user clicking either one left
     their workspace. */
  const market = await getMarketFromRequest(searchParams);

  const label = getLabelWorkspace(market.id);
  if (label && !(await getArtistsForMarket(market.id)).some(a => a.slug === slug)) notFound();
  const q = market.id === 'uk' ? '' : `?market=${market.id}`;
  return <>
    {label && <AppHeader workspace={label.name} nav={[
      { href: `/growth${q}`, label: 'Channel Health' },
      { href: `/campaigns${q}`, label: 'Active Campaigns' },
      { href: `/coach${q}`, label: 'Coach' },
    ]} />}
    <WatcherArtistView
      slug={slug}
      market={market.id}
      signature="Watcher watches · Coach plans · You decide"
    />
  </>;
}
