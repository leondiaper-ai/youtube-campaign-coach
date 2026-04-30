'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtNum, type ChannelState, type ArtistClassification, CLASSIFICATION_STYLE, CLASSIFICATION_LABEL } from '@/lib/artists';
// Value model imports removed — Opportunity Layer uses real signals only
import Sparkline from './Sparkline';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RowData = {
  slug: string;
  name: string;
  isVirgin: boolean;
  subs: number | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  subsWoW: number | null;
  viewsWoW: number | null;
  uploads30d: number;
  shorts30d: number;
  status: ChannelState;
  classification: ArtistClassification;
  reason: string;
  subsSeries: { x: number; y: number }[];
};

type ViewMode = 'managed' | 'market';

// ─── Constants ────────────────────────────────────────────────────────────────

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const STATE_LABEL: Record<ChannelState, string> = {
  HEALTHY:           'Healthy',
  'WEAK CONVERSION': 'Weak Conversion',
  BUILDING:          'Building',
  'AT RISK':         'At Risk',
  COLD:              'Cold',
};

const STATUS_STYLE: Record<ChannelState, { bg: string; fg: string; dot: string; rowBg: string }> = {
  HEALTHY:           { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A', rowBg: '#F8FDF9' },
  'WEAK CONVERSION': { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C', rowBg: '#FFFAF5' },
  BUILDING:          { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C', rowBg: PAPER },
  'AT RISK':         { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C', rowBg: '#FFF8F5' },
  COLD:              { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C', rowBg: '#FFF8F5' },
};

const SPARK_COLOR: Record<ChannelState, { stroke: string; fill: string }> = {
  HEALTHY:           { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' },
  'WEAK CONVERSION': { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.06)' },
  BUILDING:          { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' },
  'AT RISK':         { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
  COLD:              { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
};

const STATUS_RANK: Record<ChannelState, number> = {
  COLD: 0, 'AT RISK': 1, 'WEAK CONVERSION': 2, BUILDING: 3, HEALTHY: 4,
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${n}`;
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n)}%`;
}

function wowColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.2)';
  if (v > 10) return '#0C6A3F';
  if (v < -10) return '#8A1F0C';
  return 'rgba(14,14,14,0.35)';
}

// ─── Market benchmark computation ─────────────────────────────────────────────

type MarketBenchmarks = {
  avgUploads30d: number;
  avgShortsRatio: number; // shorts / total uploads
  topPerformerCadence: number; // avg uploads/30d for healthy channels
  avgViewsHealthy: number;
  avgViewsAll: number;
  formatMix: { withShorts: number; noShorts: number };
};

function computeMarketBenchmarks(rows: RowData[]): MarketBenchmarks {
  const active = rows.filter((r) => r.status !== 'COLD');
  const healthy = rows.filter((r) => r.status === 'HEALTHY');

  const avgUploads30d = active.length > 0
    ? Math.round(active.reduce((s, r) => s + r.uploads30d, 0) / active.length)
    : 0;

  const totalShorts = active.reduce((s, r) => s + r.shorts30d, 0);
  const totalUploads = active.reduce((s, r) => s + r.uploads30d, 0);
  const avgShortsRatio = totalUploads > 0 ? totalShorts / totalUploads : 0;

  const topPerformerCadence = healthy.length > 0
    ? Math.round(healthy.reduce((s, r) => s + r.uploads30d, 0) / healthy.length)
    : 0;

  const avgViewsHealthy = healthy.length > 0
    ? Math.round(healthy.reduce((s, r) => s + (r.views7Delta ?? 0), 0) / healthy.length)
    : 0;

  const avgViewsAll = active.length > 0
    ? Math.round(active.reduce((s, r) => s + (r.views7Delta ?? 0), 0) / active.length)
    : 0;

  const withShorts = active.filter((r) => r.shorts30d > 0).length;

  return {
    avgUploads30d,
    avgShortsRatio,
    topPerformerCadence,
    avgViewsHealthy,
    avgViewsAll,
    formatMix: { withShorts, noShorts: active.length - withShorts },
  };
}

// ─── Opportunity Layer (Virgin Managed only) ─────────────────────────────────
//
// Real signals only — no revenue projections. Each row uses observable data
// (views, subs, uploads, recency) to explain what's happening and what to do.
//

type OpportunityRow = {
  name: string;
  slug: string;
  state: 'Weak Conversion' | 'Underfed' | 'Cold';
  /** Primary metric line — real numbers only */
  metrics: string;
  /** Human-readable interpretation of the situation */
  interpretation: string;
  /** Why this matters — plain English, no financial language */
  explanation: string;
  /** Specific action for this week */
  action: string;
  /** Sort weight — higher = more urgent */
  weight: number;
};

function computeOpportunities(
  rows: RowData[],
  benchmarks: MarketBenchmarks | null,
): OpportunityRow[] {
  const results: OpportunityRow[] = [];
  const benchCadence = benchmarks?.topPerformerCadence ?? 8;

  // ── WEAK CONVERSION: high views, low subs growth
  const weakConv = rows.filter((r) => r.classification === 'WEAK_CONVERSION');
  for (const r of weakConv) {
    const weeklyViews = r.views7Delta ?? 0;
    if (weeklyViews <= 0) continue;
    const subs7 = r.subs7Delta ?? 0;

    results.push({
      name: r.name,
      slug: r.slug,
      state: 'Weak Conversion',
      metrics: `${fmtNum(weeklyViews)} weekly views · ${subs7 >= 0 ? '+' : ''}${fmtNum(subs7)} subs`,
      interpretation: 'High attention, low retention — audience isn\'t committing',
      explanation: `This channel is getting strong view counts but subscribers aren't growing. The audience is watching but not choosing to follow. This usually means the content is discoverable but lacks the depth or personality that makes viewers come back.`,
      action: 'Add 2–3 artist-led Shorts this week (BTS, personality, breakdowns). Give viewers a reason to subscribe.',
      weight: weeklyViews, // more views = bigger opportunity
    });
  }

  // ── UNDERFED: low cadence relative to benchmark
  const underfed = rows.filter((r) => r.classification === 'UNDERFED');
  for (const r of underfed) {
    const weeklyViews = r.views7Delta ?? 0;
    if (weeklyViews <= 0) continue;

    results.push({
      name: r.name,
      slug: r.slug,
      state: 'Underfed',
      metrics: `${r.uploads30d} uploads/30d · ${fmtNum(weeklyViews)} weekly views`,
      interpretation: `Upload cadence too low — ${r.uploads30d}/month vs ~${benchCadence} for healthy channels`,
      explanation: `The channel is generating views when it uploads, but uploads are too infrequent for YouTube to keep recommending the content. Healthy channels in the market are averaging ${benchCadence} uploads/month. More consistent posting would keep the channel in the algorithm's rotation.`,
      action: `Add ${Math.min(3, Math.max(2, benchCadence - r.uploads30d))} catalogue Shorts per week. Low effort, builds consistency. Target ${Math.min(benchCadence, 8)}+ uploads/month.`,
      weight: weeklyViews * 0.8, // slightly below weak conversion
    });
  }

  // ── COLD: dormant with existing audience
  const cold = rows.filter((r) => r.classification === 'COLD');
  for (const r of cold) {
    const subs = r.subs ?? 0;
    if (subs <= 0) continue;

    results.push({
      name: r.name,
      slug: r.slug,
      state: 'Cold',
      metrics: `${fmtNum(subs)} subscribers · 0 uploads in 60+ days`,
      interpretation: `Dormant channel — large audience sitting idle with no new content`,
      explanation: `This channel has a significant subscriber base but hasn't uploaded recently. The longer a channel sits dormant, the harder it is to re-engage the audience. Subscribers stop seeing the channel in their feed, and YouTube stops recommending it. A small reactivation test would show whether the audience is still reachable.`,
      action: 'Test with 2–3 catalogue Shorts this week. Low risk, zero production cost. See if the audience responds.',
      weight: subs * 0.001, // large audience = worth testing
    });
  }

  // Sort by weight (most urgent first)
  results.sort((a, b) => b.weight - a.weight);
  return results;
}

// ─── Opportunity Section ─────────────────────────────────────────────────────

const STATE_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  'Underfed':        { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'Cold':            { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  'Weak Conversion': { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
};

function OpportunitySection({ rows }: { rows: OpportunityRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build summary fragments
  const weakCount = rows.filter((r) => r.state === 'Weak Conversion').length;
  const underfedCount = rows.filter((r) => r.state === 'Underfed').length;
  const coldCount = rows.filter((r) => r.state === 'Cold').length;
  const summaryParts: string[] = [];
  if (weakCount > 0) summaryParts.push(`High attention, low conversion across ${weakCount} channel${weakCount !== 1 ? 's' : ''}`);
  if (underfedCount > 0) summaryParts.push(`${underfedCount} channel${underfedCount !== 1 ? 's' : ''} underposting`);
  if (coldCount > 0) summaryParts.push(`${coldCount} dormant channel${coldCount !== 1 ? 's' : ''} ready for reactivation`);

  return (
    <div
      className="rounded-xl px-5 py-5 mb-6"
      style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2">
        Opportunity · This Week
      </div>
      <div className="text-[15px] font-black leading-tight mb-1">
        Opportunity across {rows.length} channel{rows.length !== 1 ? 's' : ''} this month
      </div>
      {summaryParts.length > 0 && (
        <div className="text-[11px] text-ink/45 mb-4 leading-snug">
          {summaryParts.join(' · ')}
        </div>
      )}

      {/* ── PER-ARTIST ROWS ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {rows.map((row) => {
          const isOpen = expanded === row.slug;
          const st = STATE_STYLE[row.state] ?? STATE_STYLE['Cold'];

          return (
            <div
              key={row.slug}
              className="rounded-lg border transition-all"
              style={{ borderColor: isOpen ? st.dot : MUTED, background: PAPER }}
            >
              {/* ── System 1: always visible (2–3 lines) ─────────────── */}
              <div className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Name + state badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/watcher/${row.slug}`}
                        className="font-black text-[14px] hover:underline"
                      >
                        {row.name}
                      </Link>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em]"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {row.state}
                      </span>
                    </div>

                    {/* Real metrics */}
                    <div className="text-[13px] font-bold tabular-nums text-ink/70">
                      {row.metrics}
                    </div>

                    {/* Interpretation */}
                    <div className="text-[11px] text-ink/45 mt-1 leading-snug">
                      → {row.interpretation}
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : row.slug)}
                    className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/35 hover:text-ink/60 shrink-0 mt-1 transition-colors"
                  >
                    {isOpen ? '▲ Less' : '▼ Detail'}
                  </button>
                </div>
              </div>

              {/* ── System 2: expanded ────────────────────────────────── */}
              {isOpen && (
                <div
                  className="px-4 py-3.5 border-t"
                  style={{ borderColor: MUTED, background: SOFT }}
                >
                  {/* Why it matters */}
                  <div className="text-[11px] text-ink/50 leading-relaxed mb-3">
                    {row.explanation}
                  </div>

                  {/* Action */}
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-ink/30 mb-1.5">
                    Action This Week
                  </div>
                  <div className="text-[12px] font-semibold text-ink/70 leading-snug flex gap-2">
                    <span className="text-ink/30 shrink-0">→</span>
                    <span>{row.action}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Board Component ──────────────────────────────────────────────────────────

export default function ChannelHealthBoard({ rows }: { rows: RowData[] }) {
  const [view, setView] = useState<ViewMode>('managed');

  const managedRows = rows.filter((r) => r.isVirgin);
  const marketRows = rows.filter((r) => !r.isVirgin);

  // Compute benchmarks from market channels (used in both views)
  const marketBenchmarks = marketRows.length > 0 ? computeMarketBenchmarks(marketRows) : null;

  const activeRows = view === 'managed' ? managedRows : marketRows;
  const sorted = [...activeRows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  // Classification counts for active view
  const growingCount = activeRows.filter((r) => r.classification === 'GROWING').length;
  const weakConvCount = activeRows.filter((r) => r.classification === 'WEAK_CONVERSION').length;
  const underfedCount = activeRows.filter((r) => r.classification === 'UNDERFED').length;
  const coldCount = activeRows.filter((r) => r.classification === 'COLD').length;

  // Opportunity rows (managed view only)
  const opportunityRows = view === 'managed'
    ? computeOpportunities(managedRows, marketBenchmarks)
    : [];

  // Market patterns
  const marketPatterns: string[] = [];
  if (view === 'market' && marketBenchmarks) {
    const active = marketRows.filter((r) => r.status !== 'COLD');
    const healthy = marketRows.filter((r) => r.status === 'HEALTHY');
    if (healthy.length > 0)
      marketPatterns.push(`Top performers averaging ${marketBenchmarks.topPerformerCadence} uploads/month and ${fmtNum(marketBenchmarks.avgViewsHealthy)} views/week`);
    if (marketBenchmarks.formatMix.withShorts > 0)
      marketPatterns.push(`${marketBenchmarks.formatMix.withShorts} of ${active.length} active channels using Shorts (${Math.round((marketBenchmarks.formatMix.withShorts / Math.max(1, active.length)) * 100)}%)`);
    if (marketBenchmarks.avgShortsRatio > 0)
      marketPatterns.push(`Shorts make up ${Math.round(marketBenchmarks.avgShortsRatio * 100)}% of total uploads across active channels`);
    const weakConvMarket = marketRows.filter((r) => r.classification === 'WEAK_CONVERSION');
    if (weakConvMarket.length > 0)
      marketPatterns.push(`${weakConvMarket.length} channels with strong views but weak subscriber conversion — common pattern`);
    // Cadence distribution
    const highCadence = active.filter((r) => r.uploads30d >= 8);
    const midCadence = active.filter((r) => r.uploads30d >= 3 && r.uploads30d < 8);
    const lowCad = active.filter((r) => r.uploads30d < 3);
    if (active.length > 0)
      marketPatterns.push(`Cadence split: ${highCadence.length} high (8+/mo), ${midCadence.length} mid (3–7/mo), ${lowCad.length} low (<3/mo)`);
  }

  return (
    <>
      {/* ─── VIEW TOGGLE ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg p-1 mb-5" style={{ background: SOFT }}>
        <button
          onClick={() => setView('managed')}
          className="px-4 py-2 rounded-md text-[12px] font-black uppercase tracking-[0.1em] transition-all"
          style={{
            background: view === 'managed' ? '#FFFFFF' : 'transparent',
            color: view === 'managed' ? INK : 'rgba(14,14,14,0.4)',
            boxShadow: view === 'managed' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Virgin Managed ({managedRows.length})
        </button>
        <button
          onClick={() => setView('market')}
          className="px-4 py-2 rounded-md text-[12px] font-black uppercase tracking-[0.1em] transition-all"
          style={{
            background: view === 'market' ? '#FFFFFF' : 'transparent',
            color: view === 'market' ? INK : 'rgba(14,14,14,0.4)',
            boxShadow: view === 'market' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Market Watch ({marketRows.length})
        </button>
      </div>

      {/* ─── SUMMARY BAR ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl px-4 py-3" style={{ background: growingCount > 0 ? CLASSIFICATION_STYLE.GROWING.bg : SOFT }}>
          <div className="text-[24px] font-black" style={{ color: growingCount > 0 ? CLASSIFICATION_STYLE.GROWING.fg : 'rgba(14,14,14,0.25)' }}>{growingCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: growingCount > 0 ? CLASSIFICATION_STYLE.GROWING.fg : 'rgba(14,14,14,0.25)' }}>Growing</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.bg : SOFT }}>
          <div className="text-[24px] font-black" style={{ color: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.fg : 'rgba(14,14,14,0.25)' }}>{weakConvCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.fg : 'rgba(14,14,14,0.25)' }}>Weak Conversion</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.bg : SOFT }}>
          <div className="text-[24px] font-black" style={{ color: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.fg : 'rgba(14,14,14,0.25)' }}>{underfedCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.fg : 'rgba(14,14,14,0.25)' }}>Underfed</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.bg : SOFT }}>
          <div className="text-[24px] font-black" style={{ color: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.fg : 'rgba(14,14,14,0.25)' }}>{coldCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.fg : 'rgba(14,14,14,0.25)' }}>Cold</div>
        </div>
      </div>

      {/* ─── MANAGED VIEW: Opportunity ──────────────────────────────────── */}
      {view === 'managed' && opportunityRows.length > 0 && (
        <OpportunitySection rows={opportunityRows} />
      )}

      {/* ─── MARKET VIEW: Market Patterns ──────────────────────────────── */}
      {view === 'market' && marketPatterns.length > 0 && (
        <div className="rounded-xl px-5 py-3.5 mb-6" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2">Market Patterns</div>
          <div className="space-y-1">
            {marketPatterns.map((pattern, i) => (
              <div key={i} className="text-[12px] text-ink/55 leading-snug">
                <span className="text-ink/20 mr-2">·</span>{pattern}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TABLE ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: MUTED }}>
        <div
          className="grid grid-cols-[1.4fr_0.6fr_0.65fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40 border-b"
          style={{ borderColor: MUTED, background: SOFT }}
        >
          <div>Artist</div>
          <div>30d trend</div>
          <div>Status</div>
          <div className="text-right">Subs</div>
          <div className="text-right">Subs (7d)</div>
          <div className="text-right">WoW</div>
          <div className="text-right">Views (7d)</div>
          <div className="text-right">WoW</div>
        </div>

        {sorted.map((r, i) => {
          const st = STATUS_STYLE[r.status];
          const sp = SPARK_COLOR[r.status];
          const subsTotal = r.subs != null ? fmtNum(r.subs) : '—';
          const fmtSubs7 = r.subs7Delta != null
            ? `${r.subs7Delta >= 0 ? '+' : ''}${r.subs7Delta.toLocaleString()}`
            : '—';
          const fmtViews7 = r.views7Delta != null ? fmtDelta(r.views7Delta) : '—';
          const subsColor = r.subs7Delta != null
            ? r.subs7Delta > 0 ? '#0C6A3F' : r.subs7Delta < 0 ? '#8A1F0C' : undefined
            : undefined;
          const viewsColor = r.views7Delta != null
            ? r.views7Delta > 0 ? '#0C6A3F' : r.views7Delta < 0 ? '#8A1F0C' : undefined
            : undefined;

          return (
            <Link
              key={r.slug}
              href={`/watcher/${r.slug}`}
              className={`grid grid-cols-[1.4fr_0.6fr_0.65fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-5 py-4 items-center hover:brightness-[0.97] transition-all ${
                i === sorted.length - 1 ? '' : 'border-b'
              }`}
              style={{ borderColor: MUTED, background: st.rowBg }}
            >
              <div className="min-w-0">
                <div className="font-black text-[14px] truncate">{r.name}</div>
                <div className="text-[11px] text-ink/40 mt-0.5 leading-snug truncate">{r.reason}</div>
              </div>
              <div className="flex items-center">
                <Sparkline data={r.subsSeries} width={80} height={28} stroke={sp.stroke} fill={sp.fill} />
              </div>
              <div>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap"
                  style={{ background: st.bg, color: st.fg }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                  {STATE_LABEL[r.status]}
                </span>
              </div>
              <div className="text-right text-[13px] font-bold tabular-nums">{subsTotal}</div>
              <div className="text-right text-[13px] tabular-nums font-bold" style={subsColor ? { color: subsColor } : { color: 'rgba(14,14,14,0.35)' }}>
                {fmtSubs7}
              </div>
              <div className="text-right text-[11px] tabular-nums font-bold" style={{ color: wowColor(r.subsWoW) }}>
                {r.subsWoW != null ? fmtPct(r.subsWoW) : '—'}
              </div>
              <div className="text-right text-[13px] tabular-nums font-bold" style={viewsColor ? { color: viewsColor } : { color: 'rgba(14,14,14,0.35)' }}>
                {fmtViews7}
              </div>
              <div className="text-right text-[11px] tabular-nums font-bold" style={{ color: wowColor(r.viewsWoW) }}>
                {r.viewsWoW != null ? fmtPct(r.viewsWoW) : '—'}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
