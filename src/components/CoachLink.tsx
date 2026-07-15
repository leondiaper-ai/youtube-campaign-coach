'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const LS_KEY = 'pih-campaign-coach-v4';

/** Clear the stored Coach plan for an artist. */
export function clearCampaign(slug: string) {
  try {
    window.localStorage.removeItem(`${LS_KEY}:${slug}`);
  } catch { /* ignore */ }
}

/**
 * Detects whether a live Coach plan exists for this artist slug in localStorage.
 * If it exists → "Active campaign" with a green dot + "End" control.
 * If not → "Start campaign" with a red dot.
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

  const handleEnd = useCallback(() => {
    clearCampaign(slug);
    setHasPlan(false);
    // Dispatch storage event so other components (CoachLiveDot, etc.) update
    window.dispatchEvent(new Event('storage'));
  }, [slug]);

  const href = hasPlan ? `/?artist=${slug}` : `/?artist=${slug}&openTimeline=1`;
  const label = hasPlan ? 'Open active campaign →' : 'Start campaign →';

  if (size === 'sm') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Link
          href={href}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] text-center inline-flex items-center justify-center gap-1.5"
          style={{ background: INK, color: PAPER }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasPlan ? '#1FBE7A' : '#FF4A1C' }} />
          {hasPlan ? 'Active campaign' : 'Start campaign'}
        </Link>
        {hasPlan && (
          <button
            onClick={handleEnd}
            className="px-2 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors"
            style={{ color: '#8A1F0C', background: '#FFE2D8' }}
            title="End this campaign"
          >
            End
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={href}
        className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2"
        style={{ background: INK, color: PAPER }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: hasPlan ? '#1FBE7A' : '#FF4A1C' }} />
        {label}
      </Link>
      {hasPlan && (
        <button
          onClick={handleEnd}
          className="px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors"
          style={{ color: '#8A1F0C', background: '#FFE2D8', border: '1px solid #FFD0C4' }}
          title="End this campaign"
        >
          End campaign
        </button>
      )}
    </div>
  );
}

/**
 * Detection-only helper: renders just the LIVE / NEW pill for inline use in
 * lists (Cockpit rows, watcher chip row, etc.).
 */
export function CoachLiveDot({ slug }: { slug: string }) {
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const checkPlan = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(`${LS_KEY}:${slug}`);
      setHasPlan(!!raw && raw.length > 10);
    } catch {
      setHasPlan(false);
    }
  }, [slug]);
  useEffect(() => {
    checkPlan();
    // Re-check when storage changes (e.g. campaign ended from another component)
    window.addEventListener('storage', checkPlan);
    return () => window.removeEventListener('storage', checkPlan);
  }, [checkPlan]);
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
