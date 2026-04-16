'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const LS_KEY = 'pih-campaign-coach-v4';

/**
 * Detects whether a live Coach plan exists for this artist slug in localStorage.
 * If it exists → "Open active campaign" with a green LIVE dot.
 * If not → "Open Coach (new)" — opens the Coach timeline builder fresh.
 */
export default function CoachLink({
  slug,
  size = 'lg',
}: {
  slug: string;
  size?: 'sm' | 'lg';
}) {
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${LS_KEY}:${slug}`);
      setHasPlan(!!raw && raw.length > 10);
    } catch {
      setHasPlan(false);
    }
  }, [slug]);

  const href = hasPlan ? `/?artist=${slug}` : `/?artist=${slug}&openTimeline=1`;
  const label = hasPlan ? 'Open active campaign →' : 'Set up campaign →';

  if (size === 'sm') {
    return (
      <Link
        href={href}
        className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] text-center inline-flex items-center justify-center gap-1.5"
        style={{
          background: hasPlan ? INK : 'transparent',
          color: hasPlan ? PAPER : INK,
          border: `1px solid ${hasPlan ? INK : MUTED}`,
        }}
      >
        {hasPlan && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1FBE7A' }} />}
        {hasPlan ? 'Active campaign' : 'Set up'}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2"
      style={{ background: INK, color: PAPER }}
    >
      {hasPlan && <span className="w-2 h-2 rounded-full" style={{ background: '#1FBE7A' }} />}
      {label}
    </Link>
  );
}

/**
 * Detection-only helper: renders just the LIVE / NEW pill for inline use in
 * lists (Cockpit rows, watcher chip row, etc.).
 */
export function CoachLiveDot({ slug }: { slug: string }) {
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${LS_KEY}:${slug}`);
      setHasPlan(!!raw && raw.length > 10);
    } catch {
      setHasPlan(false);
    }
  }, [slug]);
  if (hasPlan == null) return null;
  if (hasPlan) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ background: '#E6F8EE', color: '#0C6A3F' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1FBE7A' }} />
        Live campaign
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.14em]"
      style={{ background: SOFT, color: '#6A6A6A', border: `1px solid ${MUTED}` }}
    >
      No campaign
    </span>
  );
}
