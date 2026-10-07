import PartnerBriefing from '@/components/PartnerBriefing';
import { getMarketFromRequest } from '@/lib/marketServer';

export const metadata = {
  title: 'Priority Campaigns — YouTube Weekly Pulse',
  description: 'Active Virgin Music campaigns, upcoming moments, and rollout strategy across YouTube.',
};

/**
 * `?market=au` or the market cookie decides whose campaigns this shows.
 * Neither present means UK, so every existing link keeps working unchanged.
 *
 * There is also a cleaner shareable form at /weekly-pulse/au/campaign-briefing
 * which renders this same component — see ../[market]/campaign-briefing.
 */
export default async function CampaignBriefingPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const market = await getMarketFromRequest(searchParams);
  return <PartnerBriefing showPulseNav market={market.id} />;
}
