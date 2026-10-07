import { notFound } from 'next/navigation';
import PartnerBriefing from '@/components/PartnerBriefing';
import { getMarket, MARKET_IDS } from '@/lib/market';

/**
 * Clean shareable form: /weekly-pulse/australia/campaign-briefing
 *
 * Renders exactly the same component as the query-param route — this is a
 * nicer URL to paste into an email, not a second implementation.
 *
 * Next.js resolves static segments before dynamic ones, so the existing
 * /weekly-pulse/campaign-briefing keeps working untouched and is not
 * captured by [market].
 *
 * Deliberately no auth. The page shows campaign names and public YouTube
 * figures, which is what the team would put in a deck anyway. If that
 * changes, this is the route that needs a gate — it is the one built to be
 * sent outside.
 */
export function generateStaticParams() {
  return MARKET_IDS.map((market) => ({ market }));
}

export async function generateMetadata({
  params,
}: {
  params: { market: string } | Promise<{ market: string }>;
}) {
  const m = getMarket((await params).market);
  return {
    title: m
      ? `Priority Campaigns — ${m.orgName}`
      : 'Priority Campaigns',
    description: 'Active campaigns, upcoming moments and rollout strategy across YouTube.',
  };
}

export default async function MarketCampaignBriefingPage({
  params,
}: {
  params: { market: string } | Promise<{ market: string }>;
}) {
  const m = getMarket((await params).market);
  if (!m) notFound();
  return <PartnerBriefing showPulseNav market={m.id} />;
}
