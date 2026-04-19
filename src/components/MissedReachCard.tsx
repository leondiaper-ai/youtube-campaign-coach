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
  primaryConsequence: string;
  primaryAction: string;
  secondaryFormats: FormatGap[];
  isHighImpact: boolean;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactBullets: string[];
};

export default function MissedReachCard({ video }: { video: MissedReachVideo }) {
  const [expanded, setExpanded] = useState(false);
  const pill = IMPACT_PILL[video.impactLevel];
  const hasDetail = video.impactBullets.length > 0 || video.secondaryFormats.length > 0;

  return (
    <article
      className="rounded-xl border p-4"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      {/* ── Line 1: Label + Impact + Views ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {video.primaryLabel} · {video.impactLevel}
        </span>
        <span className="font-black text-[12px] tabular-nums text-ink/60">
          {fmtNum(video.views)} views
        </span>
      </div>

      {/* ── Line 2: Title → Consequence ── */}
      <div className="mt-1 leading-tight">
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-[13px] text-ink hover:text-ink/70 transition-colors"
          title={video.title}
        >
          {video.title}
        </a>
        <span className="text-[11px] text-ink/40">
          {' '}— {video.primaryConsequence}
        </span>
      </div>

      {/* ── Line 3: Action ── */}
      <div className="mt-1.5 text-[12px] font-bold text-ink/80">
        → {video.primaryAction}
      </div>

      {/* ── Expandable detail (impact bullets + secondary formats) ── */}
      {hasDetail && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/30 hover:text-ink/50 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span
              className="inline-block transition-transform duration-150"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▸
            </span>
            {expanded ? 'Less' : 'Detail'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {/* Impact bullets */}
              {video.impactBullets.length > 0 && (
                <ul className="space-y-0.5 pl-2">
                  {video.impactBullets.map((b, i) => (
                    <li key={i} className="text-[11px] text-ink/45 leading-snug flex items-start gap-1.5">
                      <span className="text-ink/20 mt-px shrink-0">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Secondary formats */}
              {video.secondaryFormats.length > 0 && (
                <div className="pl-2 border-l-2 space-y-1" style={{ borderColor: MUTED }}>
                  {video.secondaryFormats.map((f) => {
                    const fp = IMPACT_PILL[f.impact];
                    return (
                      <div key={f.name} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-ink/60">{f.name}</span>
                        <span
                          className="text-[8px] font-black uppercase tracking-[0.1em] px-1 py-0.5 rounded"
                          style={{ background: fp.bg, color: fp.fg }}
                        >
                          {f.impact}
                        </span>
                        <span className="text-[10px] text-ink/35">→ {f.action}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
