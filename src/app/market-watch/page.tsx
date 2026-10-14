/* ═══════════════════════════════════════════════════════════════════════
   MARKET WATCH — experimental, gated, excluded from navigation.

   Three states, deliberately distinct:

   FEATURE OFF  → notFound(). Not a 403, not a prompt. Without
                  MARKET_WATCH_SECRET configured there is nothing here to
                  find, and the response says exactly that.
   ENABLED, NO SESSION → a bare secret prompt. This is the one state that
                  admits the page exists, which is unavoidable: there has
                  to be somewhere to sign in. Protection is the gate, not
                  the obscurity of the path.
   AUTHORISED   → the feature.

   noindex on the route regardless, and it is linked from nowhere.
   ═══════════════════════════════════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { featureEnabled, authorised } from '@/lib/marketWatch/gate';
import { loadCollection } from '@/lib/marketWatch/collect';
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

  const data = await loadCollection();
  return <MarketWatchClient initial={data} />;
}
