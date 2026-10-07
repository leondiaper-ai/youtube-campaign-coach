import { notFound } from 'next/navigation';
import ChannelSpotlightPage from '@/components/ChannelSpotlightPage';
import { getMarket, MARKET_IDS } from '@/lib/market';

export function generateStaticParams() {
  return MARKET_IDS.map((market) => ({ market }));
}

export async function generateMetadata({
  params,
}: {
  params: { market: string } | Promise<{ market: string }>;
}) {
  const m = getMarket((await params).market);
  return { title: m ? `Channel Spotlight — ${m.orgName}` : 'Channel Spotlight' };
}

export default async function MarketSpotlightPage({
  params,
}: {
  params: { market: string } | Promise<{ market: string }>;
}) {
  const m = getMarket((await params).market);
  if (!m) notFound();
  return <ChannelSpotlightPage market={m.id} />;
}
