'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtNum, type ChannelState, type ArtistClassification, CLASSIFICATION_STYLE, CLASSIFICATION_LABEL } from '@/lib/artists';
import { fmtVal, CONFIDENCE_LABEL, VALUE_DISCLAIMER, type ValueConfidence } from '@/lib/valueModel';
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

// ─── Missed Value computation (Virgin Managed only) ──────────────────────────
//
// RPM:  £1–£3 per 1K views (blended YouTube music RPM)
// Uplift multiplier: based on gap between current and benchmark cadence
// Reactivation: dormant subs × conservative views-per-sub estimate
//

const RPM_LOW = 1;   // £ per 1K views
const RPM_HIGH = 3;

type MissedValueRow = {
  name: string;
  slug: string;
  issueType: 'Underfed' | 'Cold' | 'Weak Conversion';
  missedViewsLow: number;
  missedViewsHigh: number;
  revenueLow: number;
  revenueHigh: number;
  cause: string;
  action: string;
  confidence: ValueConfidence;
  assumptions: {
    benchmarkUploads: number;
    currentUploads: number;
    upliftMultiplier: string;
    rpm: string;
    basis: string;
  };
};

function computeMissedValue(
  rows: RowData[],
  benchmarks: MarketBenchmarks | null,
): MissedValueRow[] {
  const results: MissedValueRow[] = [];
  const benchCadence = benchmarks?.topPerformerCadence ?? 8;

  // ── UNDERFED: cadence gap → missed views → missed revenue
  const underfed = rows.filter((r) => r.classification === 'UNDERFED');
  for (const r of underfed) {
    const weeklyViews = r.views7Delta ?? 0;
    if (weeklyViews <= 0) continue;
    const cadenceRatio = benchCadence > 0 && r.uploads30d > 0
      ? Math.min(benchCadence / r.uploads30d, 4)  // cap at 4× to avoid absurd estimates
      : 2;
    const upliftFactor = (cadenceRatio - 1) * 0.5; // conservative: 50% of the theoretical gap
    const missedLow = Math.round(weeklyViews * upliftFactor * 0.6 * 4); // monthly, low
    const missedHigh = Math.round(weeklyViews * upliftFactor * 1.2 * 4); // monthly, high
    const revLow = Math.round((missedLow / 1000) * RPM_LOW);
    const revHigh = Math.round((missedHigh / 1000) * RPM_HIGH);

    results.push({
      name: r.name,
      slug: r.slug,
      issueType: 'Underfed',
      missedViewsLow: missedLow,
      missedViewsHigh: missedHigh,
      revenueLow: revLow,
      revenueHigh: revHigh,
      cause: `Upload cadence too low (${r.uploads30d}/month vs ~${benchCadence} benchmark)`,
      action: `Increase to ${Math.min(benchCadence, 8)}+ uploads/month. Start with catalogue Shorts — low effort, high cadence.`,
      confidence: weeklyViews > 10000 ? 'medium' : 'low',
      assumptions: {
        benchmarkUploads: benchCadence,
        currentUploads: r.uploads30d,
        upliftMultiplier: `${Math.round(upliftFactor * 100)}% of ${cadenceRatio.toFixed(1)}× cadence gap`,
        rpm: `£${RPM_LOW}–£${RPM_HIGH} per 1K views`,
        basis: `Based on ${fmtNum(weeklyViews)} current weekly views`,
      },
    });
  }

  // ── COLD: dormant subscribers → reactivation potential
  const cold = rows.filter((r) => r.classification === 'COLD');
  for (const r of cold) {
    const subs = r.subs ?? 0;
    if (subs <= 0) continue;
    // Conservative: 1–3% of subs watch a reactivation upload, 4 uploads/month
    const viewsPerUpload = Math.round(subs * 0.015); // 1.5% midpoint
    const missedLow = Math.round(viewsPerUpload * 2 * 0.6); // 2 uploads/month, conservative
    const missedHigh = Math.round(viewsPerUpload * 4 * 1.2); // 4 uploads/month, optimistic
    const revLow = Math.round((missedLow / 1000) * RPM_LOW);
    const revHigh = Math.round((missedHigh / 1000) * RPM_HIGH);

    results.push({
      name: r.name,
      slug: r.slug,
      issueType: 'Cold',
      missedViewsLow: missedLow,
      missedViewsHigh: missedHigh,
      revenueLow: revLow,
      revenueHigh: revHigh,
      cause: `Channel dormant — ${fmtNum(subs)} subscribers with zero algorithm signal`,
      action: 'Reactivate with 2–3 catalogue Shorts per week. Low risk, tests appetite.',
      confidence: 'low',
      assumptions: {
        benchmarkUploads: 4,
        currentUploads: 0,
        upliftMultiplier: '1–3% subscriber reactivation rate per upload',
        rpm: `£${RPM_LOW}–£${RPM_HIGH} per 1K views`,
        basis: `Based on ${fmtNum(subs)} dormant subscribers`,
      },
    });
  }

  // ── WEAK CONVERSION: views exist but subs aren't growing
  const weakConv = rows.filter((r) => r.classification === 'WEAK_CONVERSION');
  for (const r of weakConv) {
    const weeklyViews = r.views7Delta ?? 0;
    if (weeklyViews <= 0) continue;
    // If conversion improved to 1.5 subs per 1K views, missed subs × LTV
    const currentConvRate = (r.subs7Delta ?? 0) > 0 && weeklyViews > 0
      ? ((r.subs7Delta ?? 0) / weeklyViews) * 1000
      : 0;
    const targetConvRate = 1.5; // subs per 1K views
    if (currentConvRate >= targetConvRate) continue;
    const missedSubsPerWeek = Math.round(((targetConvRate - currentConvRate) / 1000) * weeklyViews);
    const missedSubsPerMonth = missedSubsPerWeek * 4;
    // Subscriber LTV: £1–£5 range
    const revLow = missedSubsPerMonth * 1;
    const revHigh = missedSubsPerMonth * 5;
    // Also estimate missed views from better content
    const missedViewsLow = Math.round(weeklyViews * 0.15 * 4); // 15% uplift from better content mix
    const missedViewsHigh = Math.round(weeklyViews * 0.35 * 4);

    results.push({
      name: r.name,
      slug: r.slug,
      issueType: 'Weak Conversion',
      missedViewsLow: missedViewsLow,
      missedViewsHigh: missedViewsHigh,
      revenueLow: revLow,
      revenueHigh: revHigh,
      cause: `${fmtNum(weeklyViews)} weekly views but only ${fmtNum(r.subs7Delta ?? 0)} new subscribers — audience isn't sticking`,
      action: 'Add depth content: artist-led pieces, track breakdowns, BTS. Fix the conversion funnel.',
      confidence: weeklyViews > 50000 ? 'medium' : 'low',
      assumptions: {
        benchmarkUploads: benchCadence,
        currentUploads: r.uploads30d,
        upliftMultiplier: `Target conversion: ${targetConvRate} subs per 1K views (current: ${currentConvRate.toFixed(1)})`,
        rpm: 'Subscriber LTV: £1–£5 per new subscriber',
        basis: `Based on ${fmtNum(weeklyViews)} weekly views × conversion gap`,
      },
    });
  }

  // Sort by revenue impact (high end, descending)
  results.sort((a, b) => b.revenueHigh - a.revenueHigh);
  return results;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtRevenue(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}K`;
  return `£${n}`;
}

// ─── Missed Value Section ────────────────────────────────────────────────────

const ISSUE_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  'Underfed':        { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'Cold':            { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  'Weak Conversion': { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
};

function MissedValueSection({
  rows,
  totalLow,
  totalHigh,
  channelCount,
}: {
  rows: MissedValueRow[];
  totalLow: number;
  totalHigh: number;
  channelCount: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      className="rounded-xl px-5 py-5 mb-6"
      style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}
    >
      {/* ── HEADER: summary line ──────────────────────────────────────── */}
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2">
        Missed Value · This Month
      </div>
      <div
        className="text-[16px] font-black leading-tight mb-1"
        title={VALUE_DISCLAIMER}
      >
        Estimated missed value: {fmtRevenue(totalLow)}–{fmtRevenue(totalHigh)}/month
        <span className="text-[11px] font-bold text-ink/35 ml-2">
          across {channelCount} channel{channelCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="text-[10px] text-ink/30 mb-4">
        Directional estimates based on YouTube RPM and performance gaps. Used to highlight opportunity, not exact revenue.
      </div>

      {/* ── PER-ARTIST ROWS ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {rows.map((row) => {
          const isOpen = expanded === row.slug;
          const st = ISSUE_STYLE[row.issueType] ?? ISSUE_STYLE['Cold'];

          return (
            <div
              key={row.slug}
              className="rounded-lg border transition-all"
              style={{ borderColor: isOpen ? st.dot : MUTED, background: PAPER }}
            >
              {/* ── System 1: always visible ──────────────────────────── */}
              <div className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Name + issue badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
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
                        {row.issueType}
                      </span>
                    </div>

                    {/* Missed views + revenue */}
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: '#8A1F0C' }}>
                        +{fmtViews(row.missedViewsLow)}–{fmtViews(row.missedViewsHigh)} missed views/month
                      </span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: '#7A5A00' }}>
                        {fmtRevenue(row.revenueLow)}–{fmtRevenue(row.revenueHigh)} est. revenue gap
                      </span>
                    </div>

                    {/* Cause */}
                    <div className="text-[11px] text-ink/50 mt-1 leading-snug">
                      Cause: {row.cause}
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

              {/* ── System 2: expanded detail ─────────────────────────── */}
              {isOpen && (
                <div
                  className="px-4 py-3.5 border-t"
                  style={{ borderColor: MUTED, background: SOFT }}
                >
                  {/* Action */}
                  <div className="text-[12px] font-semibold text-ink/70 leading-snug mb-3 flex gap-2">
                    <span className="text-ink/30 shrink-0">→</span>
                    <span>{row.action}</span>
                  </div>

                  {/* Assumptions */}
                  <div className="text-[10px] text-ink/40 space-y-1">
                    <div className="font-bold uppercase tracking-[0.12em] text-ink/30 mb-1">Assumptions</div>
                    <div>Benchmark cadence: {row.assumptions.benchmarkUploads} uploads/month (current: {row.assumptions.currentUploads})</div>
                    <div>Uplift basis: {row.assumptions.upliftMultiplier}</div>
                    <div>RPM range: {row.assumptions.rpm}</div>
                    <div>Data source: {row.assumptions.basis}</div>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-ink/30">
                      Confidence:
                    </span>
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                      style={{
                        color: row.confidence === 'high' ? '#0C6A3F' : row.confidence === 'medium' ? '#7A5A00' : '#8A1F0C',
                        background: row.confidence === 'high' ? '#E6F8EE' : row.confidence === 'medium' ? '#FFF5D6' : '#FFE2D8',
                      }}
                    >
                      {CONFIDENCE_LABEL[row.confidence]}
                    </span>
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

  // Missed Value (managed view only)
  const missedValueRows = view === 'managed'
    ? computeMissedValue(managedRows, marketBenchmarks)
    : [];

  // Totals for the summary line
  const totalMissedRevLow = missedValueRows.reduce((s, r) => s + r.revenueLow, 0);
  const totalMissedRevHigh = missedValueRows.reduce((s, r) => s + r.revenueHigh, 0);
  const channelsWithMissedValue = missedValueRows.length;

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

      {/* ─── MANAGED VIEW: Missed Value ───────────────────────────────── */}
      {view === 'managed' && missedValueRows.length > 0 && (
        <MissedValueSection
          rows={missedValueRows}
          totalLow={totalMissedRevLow}
          totalHigh={totalMissedRevHigh}
          channelCount={channelsWithMissedValue}
        />
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
