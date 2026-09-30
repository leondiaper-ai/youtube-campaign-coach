'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SHORTS vs LONG-FORM — recent viewing, with lifetime kept subordinate.

   The whole design question on this block is what occupies the big type
   when there is no recent figure yet. The lifetime split is always
   computable and looks authoritative, which is exactly why it must not
   take that position: a number describing every view the catalogue
   has ever earned, set in 42px under a heading about the last 7 days,
   would be read as this week's behaviour. It is not.

   So the big type holds one of two things — a real recent split, or the
   collection state. Lifetime lives behind "Lifetime detail", where its
   inventory coverage is stated in the same breath as its percentages.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';

const LF = '#2C6BFF';
const SH = '#C77A16';
const RULE = '#E9E2D3';

export type FormatSplit = {
  basis: 'recent' | 'lifetime';
  windowDays: number | null;
  longformShare: number;
  shortsShare: number;
  longformViews: number;
  shortsViews: number;
  viewsCovered: number | null;
  confidence: 'complete' | 'partial' | 'sample';
  collecting: { comparable: number; required: number; total: number } | null;
};

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
};
const pct = (x: number) => (x <= 0 ? '0%' : x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`);
const cov = (x: number | null) => {
  if (x == null) return '—';
  if (x <= 0) return '0%';
  if (x < 0.01) return '<1%';
  if (x < 0.1) return `${(x * 100).toFixed(1)}%`;
  return `${Math.round(x * 100)}%`;
};

export default function FormatBlock({
  split,
  lifetimeCounts,
}: {
  split: FormatSplit | null;
  lifetimeCounts: { longform: number; shorts: number } | null;
}) {
  const [open, setOpen] = useState(false);

  if (!split) {
    return (
      <div className="text-[13px] text-ink/40">
        No video inventory cached — the split is unavailable, not zero.
      </div>
    );
  }

  const recent = split.basis === 'recent';

  return (
    <div>
      {recent ? (
        <>
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <div className="text-[42px] sm:text-[54px] font-black leading-none tracking-[-0.03em]" style={{ color: LF }}>
                {pct(split.longformShare)}
              </div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink/45 mt-2">
                Long-form · {fmt(split.longformViews)} views
              </div>
            </div>
            <div>
              <div className="text-[42px] sm:text-[54px] font-black leading-none tracking-[-0.03em]" style={{ color: SH }}>
                {pct(split.shortsShare)}
              </div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink/45 mt-2">
                Shorts · {fmt(split.shortsViews)} views
              </div>
            </div>
          </div>
          <div className="flex h-[10px] w-full max-w-[520px] overflow-hidden rounded-sm mt-5" style={{ background: RULE }}>
            <div style={{ width: `${split.longformShare * 100}%`, background: LF }} />
            <div style={{ width: `${split.shortsShare * 100}%`, background: SH }} />
          </div>
          <div className="text-[11px] text-ink/40 mt-2">
            View gains over the last {split.windowDays} days, from daily readings, counted only on videos
            present in consecutive readings.
          </div>
        </>
      ) : (
        <>
          <div className="text-[22px] sm:text-[26px] font-black leading-tight tracking-[-0.01em] max-w-[22ch]">
            {split.collecting && split.collecting.total === 0
              ? 'Daily tracking has not recorded a reading yet.'
              : `Collecting — ${split.collecting?.comparable ?? 0} of ${split.collecting?.required ?? 6} comparable days.`}
          </div>
          <div className="text-[12px] text-ink/45 mt-3 max-w-[54ch]">
            A recent split needs two readings of the same video on different days. Until then this
            reads as unavailable rather than showing the lifetime figure here — lifetime describes
            years of catalogue, not this week.
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-5 text-[11px] uppercase tracking-[0.14em] text-ink/40 hover:text-ink/70 underline underline-offset-4"
      >
        {open ? 'Hide lifetime detail' : 'Lifetime detail'}
      </button>

      {open && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${RULE}` }}>
          <div className="flex h-[5px] w-full max-w-[300px] overflow-hidden rounded-sm" style={{ background: RULE }}>
            <div style={{ width: `${split.longformShare * 100}%`, background: LF, opacity: 0.5 }} />
            <div style={{ width: `${split.shortsShare * 100}%`, background: SH, opacity: 0.5 }} />
          </div>
          <div className="text-[13px] mt-2 tabular-nums text-ink/70">
            Lifetime: {pct(split.longformShare)} long-form ({fmt(split.longformViews)}) ·{' '}
            {pct(split.shortsShare)} Shorts ({fmt(split.shortsViews)})
          </div>
          <div
            className="text-[11px] mt-1"
            style={{ color: split.confidence === 'complete' ? 'rgba(14,14,14,0.4)' : '#9A5B00' }}
          >
            {split.confidence === 'complete'
              ? 'Covers essentially the whole channel.'
              : `Across ${cov(split.viewsCovered)} of channel lifetime views that we hold — not the channel. Totals each video has accumulated since upload, not viewing in any recent period.`}
          </div>
          {lifetimeCounts && (
            <div className="text-[11px] text-ink/40 mt-1">
              {lifetimeCounts.longform} long-form and {lifetimeCounts.shorts} Shorts in our inventory.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
