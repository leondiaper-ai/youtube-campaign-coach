'use client';

/**
 * Market switcher — the workspace selector.
 *
 * Deliberately quiet. This is not a feature, it is the answer to "whose
 * desk am I sitting at", and for the UK team — who are the overwhelming
 * majority of use and did not ask for any of this — it should read as
 * furniture they can ignore.
 *
 * HOW THE CHOICE PROPAGATES
 *
 * Two mechanisms, in priority order:
 *   1. `?market=au` in the URL. Explicit, shareable, and what a link sent to
 *      the Australian team carries.
 *   2. A cookie, written on switch. Makes the choice stick across navigation
 *      so a team is not re-selecting on every page.
 *
 * The URL wins, so a pasted link always shows what the sender saw. That
 * matters more than it sounds: the alternative is someone sharing their
 * Priority Campaigns page and the recipient seeing their own market's.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { MARKETS, MARKET_IDS, MARKET_COOKIE, MARKET_PARAM } from '@/lib/market';

const INK = '#0E0E0E';
const BONE = '#E8E3DA';
const SMOKE = '#8A847A';

export default function MarketSwitcher({
  current,
  compact = false,
}: {
  current: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = MARKETS[current] ?? MARKETS.uk;

  const choose = useCallback(
    (id: string) => {
      setOpen(false);
      if (id === active.id) return;

      // One year. This is a workspace preference, not a session thing —
      // nobody wants to re-pick their own market every Monday.
      document.cookie = `${MARKET_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;

      const next = new URLSearchParams(params?.toString() ?? '');
      next.set(MARKET_PARAM, id);
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
        // The server components on these pages read the market, so a plain
        // push is not enough — their cached render has to be discarded.
        router.refresh();
      });
    },
    [active.id, params, pathname, router],
  );

  if (MARKET_IDS.length < 2) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Market: ${active.name}. Change market.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: compact ? '4px 8px' : '6px 10px',
          border: `1px solid ${BONE}`,
          borderRadius: 3,
          background: 'transparent',
          color: INK,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.6 : 1,
          lineHeight: 1.2,
        }}
      >
        <span>{active.short}</span>
        <span style={{ color: SMOKE, fontSize: 8 }}>▼</span>
      </button>

      {open && (
        <>
          {/* Click-away. Covers the viewport beneath the menu. */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
          />
          <ul
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 99,
              margin: 0,
              padding: 4,
              listStyle: 'none',
              minWidth: 180,
              background: '#FFFFFF',
              border: `1px solid ${BONE}`,
              borderRadius: 4,
              boxShadow: '0 8px 28px rgba(0,0,0,0.10)',
            }}
          >
            {MARKET_IDS.map((id) => {
              const m = MARKETS[id];
              const isActive = id === active.id;
              return (
                <li key={id} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => choose(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      width: '100%',
                      padding: '7px 9px',
                      border: 0,
                      borderRadius: 3,
                      background: isActive ? '#F6F1E7' : 'transparent',
                      color: INK,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{m.name}</span>
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.12em',
                        color: SMOKE,
                        fontWeight: 700,
                      }}
                    >
                      {m.short}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
