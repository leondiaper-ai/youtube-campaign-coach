'use client';

import { useState } from 'react';
import MissedReachCard, { type MissedReachVideo } from './MissedReachCard';

const MUTED = '#E9E2D3';
const SOFT = '#F6F1E7';

type Props = {
  defaultCards: MissedReachVideo[];
  overflowCards: MissedReachVideo[];
  structuralGaps: { name: string; count: number }[];
  totalScanned: number;
  tierCounts: { high: number; medium: number; low: number };
};

export default function MissedReachSection({
  defaultCards,
  overflowCards,
  structuralGaps,
  totalScanned,
  tierCounts,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2C6BFF' }} />
        <h2 className="font-black text-lg">Missed reach</h2>
      </div>

      {/* Scan summary */}
      <div className="text-[11px] text-ink/40 mb-4 flex items-center gap-3 flex-wrap">
        <span>{totalScanned} video{totalScanned === 1 ? '' : 's'} scanned</span>
        {tierCounts.high > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF4A1C' }} />
            {tierCounts.high} high impact
          </span>
        )}
        {tierCounts.medium > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F08A3C' }} />
            {tierCounts.medium} medium
          </span>
        )}
        {tierCounts.low > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FFD24C' }} />
            {tierCounts.low} lower priority
          </span>
        )}
      </div>

      {/* Structural gap pattern */}
      {structuralGaps.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 mb-4 text-[12px] leading-snug"
          style={{ background: SOFT, border: `1px solid ${MUTED}` }}
        >
          <span className="font-bold text-ink/70">Structural pattern: </span>
          <span className="text-ink/55">
            {structuralGaps.map((g) =>
              `${g.count} videos missing ${g.name}`
            ).join(', ')}
            {' — this is a catalogue-wide gap, not a one-off.'}
          </span>
        </div>
      )}

      {/* Default cards (top HIGH + MEDIUM) */}
      <div className="space-y-3">
        {defaultCards.map((v) => (
          <MissedReachCard key={v.id} video={v} />
        ))}
      </div>

      {/* Expandable overflow */}
      {overflowCards.length > 0 && (
        <div className="mt-4">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40 hover:text-ink/60 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>▸</span>
              + {overflowCards.length} more opportunit{overflowCards.length === 1 ? 'y' : 'ies'}
            </button>
          ) : (
            <>
              <button
                onClick={() => setExpanded(false)}
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40 hover:text-ink/60 transition-colors cursor-pointer flex items-center gap-1.5 mb-3"
              >
                <span>▾</span>
                Hide additional opportunities
              </button>
              <div className="space-y-3">
                {overflowCards.map((v) => (
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
