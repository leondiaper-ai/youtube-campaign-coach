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
