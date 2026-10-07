import { notFound } from 'next/navigation';
import TeamBoard from '@/components/TeamBoard';
import PulseNav from '@/components/PulseNav';
import MarketSwitcher from '@/components/MarketSwitcher';
import { getMarket, MARKET_IDS } from '@/lib/market';
import { getTeam } from '@/lib/teams';

/**
 * The market's campaign board, inside the market dashboard.
 *
 * This is the same TeamBoard that /team/australia renders — artist health
 * counts, what changed this week, top movers, best-in-class consistency, the
 * All Artists / Priority / Channel Behaviour tabs. It is not a copy: the
 * component is imported, so the two surfaces cannot drift.
 *
 * The difference is who it is for. /team/australia is the token link sent to
 * the team; this is the same board sitting alongside Priority Campaigns and
 * Channel Spotlight, so someone working in the market dashboard does not have
 * to go and find a separate URL to see their own roster.
 *
 * Markets with no team board (the UK) do not get this tab — see PulseNav.
 */
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return MARKET_IDS.map((market) => ({ market }));
}

export default async function MarketBoardPage({
  params,
}: {
  params: { market: string } | Promise<{ market: string }>;
}) {
  const m = getMarket((await params).market);
  if (!m?.teamSlug) notFound();
  const team = getTeam(m.teamSlug);
  if (!team) notFound();

  return (
    <main style={{ background: '#FAF7F2', minHeight: '100vh' }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '24px 40px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, fontWeight: 800,
          letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C8C2B8',
        }}>
          {m.orgName} · YouTube
        </div>
        <MarketSwitcher current={m.id} compact />
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 40px 0' }}>
        <PulseNav market={m.id} />
      </div>
      {/* Links stay inside the market dashboard rather than bouncing the
          reader out to the token-gated /team space. */}
      <TeamBoard
        team={team}
        linkPrefix="/watcher"
        linkSuffix={m.id === 'uk' ? '' : `?market=${m.id}`}
      />
    </main>
  );
}
