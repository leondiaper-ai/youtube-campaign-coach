import CoachPage from '@/components/CoachPage';
import { getArtistsForMarket, getPlansForMarket } from '@/lib/marketScope';
import { getMarketFromRequest } from '@/lib/marketServer';

export const metadata = {
  title: 'YouTube Campaign Coach',
  description: 'Channel-aware campaign planning and live guidance.',
};

/**
 * The Content Planner, scoped to a market.
 *
 * Both lists are market-scoped: the artist dropdown so a team only plans for
 * their own roster, and Saved Campaigns so the archive is theirs. The UK sees
 * exactly what it saw before, because artists and plans with no market
 * default to UK.
 */
export default async function CoachRoute({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const market = await getMarketFromRequest(searchParams);

  const [roster, savedPlans] = await Promise.all([
    getArtistsForMarket(market.id),
    getPlansForMarket(market.id),
  ]);

  const artistOptions = roster.map((a) => ({
    slug: a.slug,
    name: a.name,
    channelHandle: a.channelHandle ?? undefined,
  }));

  return (
    <CoachPage
      artistOptions={artistOptions}
      savedPlans={savedPlans}
      market={market.id}
      marketName={market.name}
    />
  );
}
