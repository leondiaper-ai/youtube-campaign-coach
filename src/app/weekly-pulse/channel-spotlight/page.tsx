import ChannelSpotlightPage from '@/components/ChannelSpotlightPage';
import { getMarketFromRequest } from '@/lib/marketServer';

export const metadata = {
  title: 'Channel Spotlight — YouTube Weekly Pulse',
  description: 'Top performing Virgin-managed channels this week — what the data says is working across the roster.',
};

/**
 * This page was the one surface that never read `?market=`, so it always
 * rendered as the UK — and because the tab bar is built from the market it
 * is given, the Priority Campaigns tab next to it pointed back at the UK
 * page. A market that silently resets when you change tab is worse than one
 * that does not exist.
 */
export default async function ChannelSpotlightRoute({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const market = await getMarketFromRequest(searchParams);
  return <ChannelSpotlightPage market={market.id} />;
}
