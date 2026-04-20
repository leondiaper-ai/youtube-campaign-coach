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

/** Detect when a single format dominates most cards */
function detectDominantFormat(cards: MissedReachVideo[]): { format: string; count: number; total: number } | null {
  if (cards.length < 3) return null;
  const counts: Record<string, number> = {};
  for (const c of cards) {
    const label = c.primaryLabel;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (top && top[1] / cards.length >= 0.6) {
    return { format: top[0], count: top[1], total: cards.length };
  }
  return null;
}

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

  const allCards = [...priorityCards, ...secondaryCards, ...remainingCards];
  const dominant = detectDominantFormat(allCards);
  const isDominant = dominant != null;

  // When one format dominates, show max 2 cards + structural callout instead of repeating
  const displayPriority = isDominant ? priorityCards.slice(0, 2) : priorityCards;

  return (
    <section className="mt-10">
      {/* ── Header ── */}
      <h2 className="font-black text-lg">Missed reach</h2>

      {/* ── Diagnosis line ── */}
      <div className="text-[13px] text-ink/60 mt-1 leading-snug max-w-[60ch]">
        You are leaving reach on the table across your catalogue.
      </div>

      {/* ── Structural diagnosis ── */}
      {(structuralGaps.length > 0 || isDominant) && (
        <div
          className="rounded-lg px-4 py-2.5 mt-3 text-[12px] leading-snug"
          style={{ background: SOFT, border: `1px solid ${MUTED}` }}
        >
          <span className="text-ink/55">
            {totalScanned} videos scanned
            {structuralGaps.length > 0 && (
              <> — {structuralGaps.map((g) =>
                `${g.count} missing ${g.name}`
              ).join(', ')}</>
            )}
            .
            {isDominant && (
              <> <span className="font-bold text-ink/70">Structural gap: {dominant.format}</span> affects {dominant.count} of {dominant.total} videos. Fix this systematically, not per-track.</>
            )}
            {!isDominant && allCards.length >= 10 && ' This is a system gap.'}
          </span>
        </div>
      )}

      {/* ── Scan summary (when no structural gaps) ── */}
      {structuralGaps.length === 0 && !isDominant && (
        <div className="text-[10px] text-ink/35 mt-2 flex items-center gap-3 flex-wrap">
          <span>{totalScanned} scanned</span>
          {tierCounts.high > 0 && <span>{tierCounts.high} high</span>}
          {tierCounts.medium > 0 && <span>{tierCounts.medium} medium</span>}
          {tierCounts.low > 0 && <span>{tierCounts.low} low</span>}
        </div>
      )}

      {/* ── PRIORITY cards (top 2-3, always visible) ── */}
      {displayPriority.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {displayPriority.map((v) => (
            <MissedReachCard key={v.id} video={v} />
          ))}
        </div>
      )}

      {/* ── Collapsed remainder ── */}
      {(secondaryCards.length > 0 || (isDominant && priorityCards.length > 2)) && (() => {
        const hiddenCount = isDominant
          ? (priorityCards.length - 2) + secondaryCards.length
          : secondaryCards.length;
        if (hiddenCount <= 0) return null;
        return (
          <div className="mt-3">
            {!showSecondary ? (
              <button
                onClick={() => setShowSecondary(true)}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 hover:text-ink/55 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>▸</span>
                {hiddenCount} more opportunit{hiddenCount === 1 ? 'y' : 'ies'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowSecondary(false)}
                  className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 hover:text-ink/55 transition-colors cursor-pointer flex items-center gap-1 mb-2.5"
                >
                  <span>▾</span>
                  Hide
                </button>
                <div className="space-y-2.5">
                  {isDominant && priorityCards.slice(2).map((v) => (
                    <MissedReachCard key={v.id} video={v} />
                  ))}
                  {secondaryCards.map((v) => (
                    <MissedReachCard key={v.id} video={v} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

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
