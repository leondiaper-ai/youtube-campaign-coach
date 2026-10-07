'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMarket } from '@/lib/market';

const INK = '#0E0E0E';
const BONE = '#E8E3DA';

const BASE_TABS = [
  { href: '/weekly-pulse/campaign-briefing', label: 'Priority Campaigns' },
  { href: '/weekly-pulse/channel-spotlight', label: 'Channel Spotlight' },
] as const;

/**
 * `market` is carried through every tab href. Without it, switching from
 * Priority Campaigns to Channel Spotlight silently drops an Australian user
 * back into the UK workspace — the kind of bug that is invisible until
 * someone shares the wrong page.
 *
 * Markets with a team board get a third tab, so the roster, health counts and
 * channel behaviour live in the same place as the weekly views rather than
 * behind a separate token link the team has to keep track of. The UK has no
 * board, so it keeps the two tabs it has always had and looks unchanged.
 */
export default function PulseNav({ market }: { market?: string } = {}) {
  const pathname = usePathname();
  const m = getMarket(market ?? null);
  const isDefault = !m || m.id === 'uk';
  const suffix = isDefault ? '' : `?market=${m.id}`;

  const tabs = [
    ...BASE_TABS.map((t) => ({ href: `${t.href}${suffix}`, label: t.label, exact: t.href })),
    ...(m?.teamSlug
      ? [{ href: `/weekly-pulse/${m.id}/board`, label: 'Campaign Board', exact: `/weekly-pulse/${m.id}/board` }]
      : []),
  ];

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        borderRadius: 8,
        background: BONE,
        marginBottom: 20,
      }}
    >
      {tabs.map((tab) => {
        // Match on the path only — the market lives in the query string, and
        // comparing the whole href would never match the per-market routes.
        const isActive =
          pathname === tab.exact ||
          (tab.exact.includes('/campaign-briefing') && pathname?.endsWith('/campaign-briefing')) ||
          (tab.exact.includes('/channel-spotlight') && pathname?.endsWith('/channel-spotlight'));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: isActive ? 800 : 600,
              color: isActive ? INK : 'rgba(14,14,14,0.45)',
              background: isActive ? '#FFFFFF' : 'transparent',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              letterSpacing: '0.01em',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
