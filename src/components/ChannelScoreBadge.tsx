'use client';

import { useState, useRef, useEffect } from 'react';
import {
  type ChannelScore,
  GRADE_COLOR,
  GRADE_BG,
} from '@/lib/channelScore';

// ── Score Badge ───────────────────────────────────────────────────────────

export function ChannelScoreBadge({
  score,
  compact = false,
}: {
  score: ChannelScore;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close tooltip on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const color = GRADE_COLOR[score.grade];
  const bg = GRADE_BG[score.grade];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: compact ? '2px 6px' : '3px 8px',
          borderRadius: 6,
          border: `1px solid ${color}33`,
          background: bg,
          cursor: 'pointer',
          fontSize: compact ? 11 : 12,
          fontWeight: 600,
          color,
          lineHeight: 1,
        }}
        title="Click for score breakdown"
      >
        <span style={{ fontSize: compact ? 12 : 14 }}>{score.grade}</span>
        {!compact && (
          <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>
            vs pool
          </span>
        )}
      </button>

      {open && <ChannelScoreTooltip score={score} />}
    </div>
  );
}

// ── Score Tooltip ─────────────────────────────────────────────────────────

function ChannelScoreTooltip({ score }: { score: ChannelScore }) {
  const color = GRADE_COLOR[score.grade];

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        zIndex: 1000,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        padding: '12px 14px',
        minWidth: 240,
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color,
          }}
        >
          {score.grade}
        </span>
        <span style={{ fontSize: 11, color: '#6B7280' }}>
          {score.benchmarkLabel}
        </span>
      </div>

      {/* Pillars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PillarRow label="Reach" pillar={score.pillars.reach} />
        <PillarRow label="Conversion" pillar={score.pillars.conversion} />
        <PillarRow label="Cadence" pillar={score.pillars.cadence} />
      </div>

      {/* Summary read */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid #F3F4F6',
          fontSize: 11,
          color: '#374151',
          lineHeight: 1.4,
        }}
      >
        {score.label}
      </div>
    </div>
  );
}

function PillarRow({
  label,
  pillar,
}: {
  label: string;
  pillar: { status: string; icon: string; reason: string };
}) {
  const statusLabel =
    pillar.status === 'strong'
      ? 'Strong'
      : pillar.status === 'average'
      ? 'Average'
      : pillar.status === 'weak'
      ? 'Weak'
      : 'Insufficient data';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 18, textAlign: 'center' }}>{pillar.icon}</span>
      <span style={{ fontWeight: 500, minWidth: 70 }}>{label}:</span>
      <span style={{ color: '#6B7280', fontSize: 11 }}>
        {statusLabel} — {pillar.reason}
      </span>
    </div>
  );
}

// ── How Scoring Works (info panel) ────────────────────────────────────────

export function HowScoringWorks() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11,
          color: '#9CA3AF',
          textDecoration: 'underline',
          padding: 0,
        }}
      >
        How scoring works
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 400,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#1F2937',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
              How scoring works
            </h3>
            <p style={{ margin: '0 0 10px', color: '#4B5563' }}>
              Channel scores are directional benchmarks based on our tracked artist channel pool.
            </p>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>We score each channel across:</p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: '#4B5563' }}>
              <li><strong>Reach</strong> — views and growth</li>
              <li><strong>Conversion</strong> — subscribers gained from views</li>
              <li><strong>Cadence</strong> — posting consistency</li>
            </ul>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Each area is rated:</p>
            <div style={{ margin: '0 0 12px', color: '#4B5563' }}>
              ✅ Strong &nbsp; ⚖️ Average &nbsp; ❌ Weak &nbsp; ◻️ Insufficient data
            </div>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Final score:</p>
            <div style={{ color: '#4B5563' }}>
              <strong>A</strong> = leading &nbsp; <strong>B</strong> = strong &nbsp;{' '}
              <strong>C</strong> = needs improvement &nbsp; <strong>D</strong> = at risk
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}>
              Benchmarks update as more artist channels are added to the watcher.
            </p>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 16,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                background: '#F9FAFB',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
