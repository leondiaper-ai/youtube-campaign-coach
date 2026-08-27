'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Tab strip for the team watcher. Mirrors PulseNav's visual language so the two
 * boards feel like one system rather than two tools that happen to share a host.
 *
 * Deliberately NOT rendered on /system. That page is public and unauthenticated
 * — it is the link pasted to YouTube — and these tabs point at internal analysis.
 */
const INK = '#0E0E0E';
const BONE = '#E8E3DA';

const TABS = [
  { href: '/team-watcher', label: 'Campaign Board' },
  { href: '/team-watcher/resources', label: 'Resources' },
] as const;

export default function WatcherNav() {
  const pathname = usePathname();

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
        width: 'fit-content',
      }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
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
