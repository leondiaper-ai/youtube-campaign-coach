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
 * ONLY the two external-facing views live here. Priority Campaigns and
 * Channel Spotlight are what gets shared with YouTube, so the tab bar must
 * not advertise internal tooling next to them — a partner following a
 * "Campaign Board" tab lands in our roster, health classifications and
 * internal notes.
 *
 * The board is still one click away for the team, from the Coach nav, which
 * is internal by definition. Reachability and exposure are different
 * problems and this is the line between them.
 */
export default function PulseNav({ market }: { market?: string } = {}) {
  const pathname = usePathname();
  const m = getMarket(market ?? null);
  const isDefault = !m || m.id === 'uk';
  const suffix = isDefault ? '' : `?market=${m.id}`;

  const tabs = BASE_TABS.map((t) => ({
    href: `${t.href}${suffix}`,
    label: t.label,
    exact: t.href,
  }));

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
