import { redirect } from 'next/navigation';
import { getMarketFromRequest } from '@/lib/marketServer';

export const metadata = {
  title: 'YouTube Weekly Pulse',
  description: 'Weekly YouTube intelligence briefing — campaign signals, content opportunities, and channel momentum.',
};

/* Forwards the market. A bare redirect turned /weekly-pulse?market=au into
   the UK briefing silently — the worst kind of leak, because the user asked
   for Australia explicitly and got the UK with no indication why. */
export default async function WeeklyPulsePage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const market = await getMarketFromRequest(searchParams);
  redirect(
    market.id === 'uk'
      ? '/weekly-pulse/campaign-briefing'
      : `/weekly-pulse/${market.id}/campaign-briefing`,
  );
}
