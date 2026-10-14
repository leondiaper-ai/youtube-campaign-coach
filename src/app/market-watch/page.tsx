import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { featureEnabled, authorised } from '@/lib/marketWatch/gate';
import MarketWatchClient from './MarketWatchClient';
import SecretPrompt from './SecretPrompt';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Market Watch',
  robots: { index: false, follow: false, nocache: true },
};

export default async function MarketWatchPage() {
  if (!featureEnabled()) notFound();
  if (!(await authorised())) return <SecretPrompt />;
  /* Deliberately no server-side read. The Upstash client goes through fetch,
     and Next's data cache was serving the page a stale empty result while the
     API route — which opts out — returned seventeen channels. One loader, in
     the client, cannot disagree with itself. */
  return <MarketWatchClient />;
}
