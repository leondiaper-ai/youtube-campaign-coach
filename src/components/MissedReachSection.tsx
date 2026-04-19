'use client';

import { useState } from 'react';
import MissedReachCard, { type MissedReachVideo } from './MissedReachCard';

const MUTED = '#E9E2D3';
const SOFT = '#F6F1E7';

type Props = {
  priorityCards: MissedReachVideo[];
  secondaryCards: MissedReachVideo[];
  remainingCards: MissedReachVideo[];
  structuralGaps: { name: string; count: number }[];
  totalScanned: number;
  tierCounts: { high: number; medium: number; low: number };
};

export default function MissedReachSection({
  priorityCards,
  secondaryCards,
  remainingCards,
  structuralGaps,
  totalScanned,
  tierCounts,
}: Props) {
  const [showSecondary, setShowSecondary] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const totalGaps = tierCounts.high + tierCounts.medium + tierCounts.low;

  return (
    <section className="mt-10">
      {/* ── Header ── */}
      <h2 className="font-black text-lg">Missed reach</h2>

      {/* ── Diagnosis line ── */}
      <div className="text-[13px] text-ink/60 mt-1 leading-snug max-w-[60ch]">
        You are leaving reach on the table across your catalogue.
      </div>

      {/* ── Structural diagnosis ── */}
      {structuralGaps.length > 0 && (
        <div
          className="rounded-lg px-4 py-2.5 mt-3 text-[12px] leading-snug"
          style={{ background: SOFT, border: `1px solid ${MUTED}` }}
        >
          <span className="text-ink/55">
            {totalScanned} videos scanned — {structuralGaps.map((g) =>
              `${g.count} missing ${g.name}`
            ).join(', ')}.
            {totalGaps >= 10 ? ' This is a system gap.' : ''}
          </span>
        </div>
      )}

      {/* ── Scan summary (compact) ── */}
      {structuralGaps.length === 0 && (
        <div className="text-[10px] text-ink/35 mt-2 flex items-center gap-3 flex-wrap">
          <span>{totalScanned} scanned</span>
          {tierCounts.high > 0 && <span>{tierCounts.high} high</span>}
          {tierCounts.medium > 0 && <span>{tierCounts.medium} medium</span>}
          {tierCounts.low > 0 && <span>{tierCounts.low} low</span>}
        </div>
      )}

      {/* ── PRIORITY cards (top 2-3, always visible) ── */}
      {priorityCards.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {priorityCards.map((v) => (
            <MissedReachCard key={v.id} video={v} />
          ))}
        </div>
      )}

      {/* ── SECONDARY cards (collapsed by default) ── */}
      {secondaryCards.length > 0 && (
        <div className="mt-3">
          {!showSecondary ? (
            <button
              onClick={() => setShowSecondary(true)}
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 hover:text-ink/55 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>▸</span>
              {secondaryCards.length} more opportunit{secondaryCards.length === 1 ? 'y' : 'ies'}
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowSecondary(false)}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 hover:text-ink/55 transition-colors cursor-pointer flex items-center gap-1 mb-2.5"
              >
                <span>▾</span>
                Hide secondary
              </button>
              <div className="space-y-2.5">
                {secondaryCards.map((v) => (
                  <MissedReachCard key={v.id} video={v} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── REMAINING cards (hidden by default) ── */}
      {remainingCards.length > 0 && (
        <div className="mt-3">
          {!showAll ? (
            <button
              onClick={() => { setShowSecondary(true); setShowAll(true); }}
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/25 hover:text-ink/45 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>▸</span>
              {remainingCards.length} lower priority
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowAll(false)}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/25 hover:text-ink/45 transition-colors cursor-pointer flex items-center gap-1 mb-2.5"
              >
                <span>▾</span>
                Hide lower priority
              </button>
              <div className="space-y-2.5">
                {remainingCards.map((v) => (
                  <MissedReachCard key={v.id} video={v} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
