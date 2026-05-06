'use client';

import { useState } from 'react';
import {
  type ChannelScore,
  type ChannelScoreInput,
  calculateChannelScore,
  computeBenchmarkPool,
  computeGrowthPct,
  GRADE_COLOR,
  GRADE_BG,
} from '@/lib/channelScore';
import { HowScoringWorks } from './ChannelScoreBadge';

type ScoredChannel = {
  name: string;
  slug: string;
  score: ChannelScore;
  input: ChannelScoreInput;
};

export type TopChannelsData = {
  name: string;
  slug: string;
  views7Delta: number | null;
  subs7Delta: number | null;
  uploads30d: number;
  shorts30d: number;
  lastUploadAt: string | null;
  subs: number | null;
  /** Total views — used as baseline for growth % (optional) */
  totalViews?: number | null;
  /** Previous week views delta — best baseline for growth % (optional) */
  prevViews7Delta?: number | null;
};

export function TopChannelsModule({ channels }: { channels: TopChannelsData[] }) {
  const [tab, setTab] = useState<'growth' | 'score'>('score');

  // Compute benchmark pool and scores
  const inputs: ChannelScoreInput[] = channels.map((c) => ({
    views7Delta: c.views7Delta,
    subs7Delta: c.subs7Delta,
    uploads30d: c.uploads30d,
    shorts30d: c.shorts30d,
    lastUploadAt: c.lastUploadAt,
    subs: c.subs,
    totalViews: c.totalViews ?? null,
    prevViews7Delta: c.prevViews7Delta ?? null,
  }));
  const pool = computeBenchmarkPool(inputs);

  const scored: ScoredChannel[] = channels.map((c, i) => ({
    name: c.name,
    slug: c.slug,
    score: calculateChannelScore(inputs[i], pool),
    input: inputs[i],
  }));

  // Best by score (execution quality)
  const bestByScore = [...scored]
    .filter((s) => s.score.grade !== 'Limited')
    .sort((a, b) => b.score.totalPoints - a.score.totalPoints)
    .slice(0, 5);

  // Strongest Growth — sorted by percentage growth (size-neutral)
  const bestByGrowth = [...scored]
    .map((s) => ({ ...s, growthPct: computeGrowthPct(s.input) }))
    .filter((s) => s.growthPct != null && s.growthPct > 0)
    .sort((a, b) => (b.growthPct ?? 0) - (a.growthPct ?? 0))
    .slice(0, 5);

  // Needs attention: D or C score, or weak conversion/cadence
  const needsAttention = scored
    .filter(
      (s) =>
        s.score.grade === 'D' ||
        s.score.grade === 'C' ||
        s.score.pillars.conversion.status === 'weak' ||
        s.score.pillars.cadence.status === 'weak'
    )
    .sort((a, b) => a.score.totalPoints - b.score.totalPoints)
    .slice(0, 5);

  const active = tab === 'growth' ? bestByGrowth : bestByScore;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        padding: '16px 18px',
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1F2937' }}>
          Best Performing Channels
        </h3>
        <HowScoringWorks />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <TabButton
          active={tab === 'score'}
          onClick={() => setTab('score')}
          label="Overall Score"
        />
        <TabButton
          active={tab === 'growth'}
          onClick={() => setTab('growth')}
          label="Strongest Growth"
        />
      </div>

      {/* Best list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {active.length === 0 && (
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>No data yet</div>
        )}
        {active.map((s, i) => (
          <ChannelRow key={s.slug} rank={i + 1} channel={s} />
        ))}
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <>
          <div
            style={{
              borderTop: '1px solid #F3F4F6',
              paddingTop: 12,
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#DC2626' }}>
              Needs Attention
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {needsAttention.map((s, i) => (
              <ChannelRow key={s.slug} rank={i + 1} channel={s} attention />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 5,
        border: 'none',
        background: active ? '#1F2937' : '#F3F4F6',
        color: active ? '#FFFFFF' : '#6B7280',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ChannelRow({
  rank,
  channel,
  attention = false,
}: {
  rank: number;
  channel: ScoredChannel;
  attention?: boolean;
}) {
  const color = GRADE_COLOR[channel.score.grade];
  const bg = GRADE_BG[channel.score.grade];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
      }}
    >
      <span style={{ width: 16, fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
        {rank}.
      </span>
      <span style={{ flex: 1, fontWeight: 500, color: '#1F2937', fontSize: 12 }}>
        {channel.name}
      </span>
      <span
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: bg,
          color,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {channel.score.grade}
      </span>
      <span style={{ fontSize: 11, color: attention ? '#DC2626' : '#6B7280', maxWidth: 160 }}>
        {channel.score.label}
      </span>
    </div>
  );
}
