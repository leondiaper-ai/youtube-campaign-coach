'use client';

import { useState } from 'react';

const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';

const IMPACT_PILL: Record<string, { bg: string; fg: string }> = {
  HIGH:   { bg: '#FFE2D8', fg: '#8A1F0C' },
  MEDIUM: { bg: '#FFEAD6', fg: '#8A4A1A' },
  LOW:    { bg: '#FFF5D6', fg: '#7A5A00' },
};

export type FormatGap = {
  name: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
};

export type MissedReachVideo = {
  id: string;
  title: string;
  views: number;
  primaryLabel: string;
  primaryInsight: string;
  primaryAction: string;
  secondaryFormats: FormatGap[];
  isHighImpact: boolean;
};

export default function MissedReachCard({ video }: { video: MissedReachVideo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="rounded-xl border p-5"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      {/* Video title */}
      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noreferrer"
        className="font-black text-base text-ink hover:text-ink/80 transition-colors leading-tight block"
        title={video.title}
      >
        {video.title}
      </a>

      {/* Format gap + scale */}
      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
        <span
          className="text-[10px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(44,107,255,0.08)', color: '#2C6BFF' }}
        >
          {video.primaryLabel}
        </span>
        <span className="font-black text-[13px] tabular-nums text-ink/70">
          {fmtNum(video.views)} views
        </span>
        {video.isHighImpact && (
          <span
            className="text-[10px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
            style={{ background: '#FFE2D8', color: '#8A1F0C' }}
          >
            High impact
          </span>
        )}
      </div>

      {/* Insight */}
      <div className="text-[12px] text-ink/55 mt-1.5 leading-snug max-w-[55ch]">
        {video.primaryInsight}
      </div>

      {/* Primary action */}
      <div className="mt-3 text-[13px] font-black text-ink/90 leading-snug">
        → {video.primaryAction}
      </div>

      {/* Expandable secondary formats */}
      {video.secondaryFormats.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40 hover:text-ink/60 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span
              className="inline-block transition-transform duration-150"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▸
            </span>
            {video.secondaryFormats.length} other format{video.secondaryFormats.length === 1 ? '' : 's'} missing
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 pl-3 border-l-2" style={{ borderColor: MUTED }}>
              {video.secondaryFormats.map((f) => {
                const pill = IMPACT_PILL[f.impact];
                return (
                  <div key={f.name} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-ink/70">{f.name}</span>
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                      style={{ background: pill.bg, color: pill.fg }}
                    >
                      {f.impact}
                    </span>
                    <span className="text-[11px] text-ink/40">→ {f.action}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}
