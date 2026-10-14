import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { featureEnabled, authorised } from '@/lib/marketWatch/gate';
import { readAll } from '@/lib/marketWatch/collect';
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
  const channels = await readAll();
  return <MarketWatchClient initial={channels} />;
}
