'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { fmtNum, type ChannelState, type ArtistClassification, CLASSIFICATION_STYLE } from '@/lib/artists';
import Sparkline from './Sparkline';
import { TopChannelsModule } from './TopChannelsModule';
import { ChannelScoreBadge } from './ChannelScoreBadge';
import {
  type ChannelScore,
  type ChannelScoreInput,
  calculateChannelScore,
  computeBenchmarkPool,
} from '@/lib/channelScore';

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
  /** Total channel views — used for growth % baseline, not as a score driver */
  totalViews?: number | null;
  /** Data confidence level — LOW/MEDIUM/HIGH */
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable data quality note */
  healthNote?: string;
  /** Clear data status label */
  dataStatus?: 'FRESH' | 'PARTIAL' | 'LIMITED' | 'STALE' | 'UNAVAILABLE';
  /** Short explanation for data status */
  dataStatusNote?: string;
  /** Whether YouTube's view data appears fresh or stale */
  viewDataFreshness?: 'fresh' | 'stale' | 'insufficient_history' | 'unavailable';
  /** Movement confidence — overall confidence in reported 7d movement */
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
  /** Movement freshness tier */
  movementFreshness?: 'live' | 'recent' | 'delayed' | 'stale';
  /** Last known good views 7d delta (retained from history) */
  lastKnownGoodViews7d?: number | null;
  /** Last known good subs 7d delta (retained from history) */
  lastKnownGoodSubs7d?: number | null;
  /** Days since last known good movement was confirmed */
  lastKnownGoodDaysAgo?: number | null;
  /** Best available movement source for this channel */
  bestAvailableSource?: 'live_7d' | 'recent_snapshot' | 'campaign_period' | 'recent_uploads' | 'last_confirmed' | 'none';
  /** Whether best available data should be used in Top Movers rankings */
  bestAvailableShouldUseInTopMovers?: boolean;
};

type ViewMode = 'managed' | 'market';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';
const INK = '#0E0E0E';

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

const DATA_STATUS_BADGE: Record<string, { background: string; color: string }> = {
  PARTIAL:     { background: '#FFF5D6', color: '#7A5A00' },
  LIMITED:     { background: '#F3F0EA', color: 'rgba(14,14,14,0.35)' },
  STALE:       { background: '#FFE2D8', color: '#8A1F0C' },
  UNAVAILABLE: { background: '#FFE2D8', color: '#8A1F0C' },
};

/** User-facing badge labels — operational language, not API-speak */
const DATA_STATUS_LABEL: Record<string, string> = {
  PARTIAL:     'Building',
  LIMITED:     'Building history',
  STALE:       'Totals updating',
  UNAVAILABLE: 'Updating',
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
  avgShortsRatio: number;
  topPerformerCadence: number;
  avgViewsHealthy: number;
  avgViewsAll: number;
  avgSubsGainHealthy: number;
  formatMix: { withShorts: number; noShorts: number; total: number };
};

function computeMarketBenchmarks(rows: RowData[]): MarketBenchmarks {
  const active = rows.filter((r) => r.status !== 'COLD');
  const healthy = rows.filter((r) => r.status === 'HEALTHY');

  // Filter stale artists out of averages — stale data would deflate them
  const freshHealthy = healthy.filter(r => r.movementConfidence !== 'stale');
  const freshActive = active.filter(r => r.movementConfidence !== 'stale');

  const avgUploads30d = active.length > 0
    ? Math.round(active.reduce((s, r) => s + r.uploads30d, 0) / active.length)
    : 0;

  const totalShorts = active.reduce((s, r) => s + r.shorts30d, 0);
  const totalUploads = active.reduce((s, r) => s + r.uploads30d, 0);
  const avgShortsRatio = totalUploads > 0 ? totalShorts / totalUploads : 0;

  const topPerformerCadence = freshHealthy.length > 0
    ? Math.round(freshHealthy.reduce((s, r) => s + r.uploads30d, 0) / freshHealthy.length)
    : 0;

  const avgViewsHealthy = freshHealthy.length > 0
    ? Math.round(freshHealthy.reduce((s, r) => s + (r.views7Delta ?? 0), 0) / freshHealthy.length)
    : 0;

  const avgViewsAll = freshActive.length > 0
    ? Math.round(freshActive.reduce((s, r) => s + (r.views7Delta ?? 0), 0) / freshActive.length)
    : 0;

  const avgSubsGainHealthy = freshHealthy.length > 0
    ? Math.round(freshHealthy.reduce((s, r) => s + (r.subs7Delta ?? 0), 0) / freshHealthy.length)
    : 0;

  const withShorts = active.filter((r) => r.shorts30d > 0).length;

  return {
    avgUploads30d,
    avgShortsRatio,
    topPerformerCadence,
    avgViewsHealthy,
    avgViewsAll,
    avgSubsGainHealthy,
    formatMix: { withShorts, noShorts: active.length - withShorts, total: active.length },
  };
}

// ─── Insight strip: "What changed this week?" ────────────────────────────────

type Insight = {
  text: string;
  tone: 'positive' | 'warning' | 'neutral';
};

function computeInsights(rows: RowData[]): Insight[] {
  const insights: Insight[] = [];
  // Filter to artists with reliable movement data for insight generation
  const reliable = rows.filter(r => r.movementConfidence !== 'stale');
  const withViews = reliable.filter((r) => r.views7Delta != null && r.views7Delta > 0);
  const withSubs = reliable.filter((r) => r.subs7Delta != null);

  // Biggest positive mover (subs growth)
  const topSubGainer = [...withSubs].sort((a, b) => (b.subs7Delta ?? 0) - (a.subs7Delta ?? 0))[0];
  if (topSubGainer && (topSubGainer.subs7Delta ?? 0) > 0) {
    const s = topSubGainer.subs7Delta ?? 0;
    const hasViews = (topSubGainer.views7Delta ?? 0) > 10000;
    insights.push({
      text: `${topSubGainer.name}: ${fmtDelta(s)} subs this week${hasViews ? ' — conversion improving' : ''}`,
      tone: 'positive',
    });
  }

  // Conversion leak: high views but flat/zero subs
  // GUARD: skip artists with stale movement — null subs7Delta means data gap, not leak
  const convLeak = withViews
    .filter((r) => (r.views7Delta ?? 0) > 5000 && (r.subs7Delta ?? 0) <= 0 && r.movementConfidence !== 'stale')
    .sort((a, b) => (b.views7Delta ?? 0) - (a.views7Delta ?? 0))[0];
  if (convLeak) {
    insights.push({
      text: `${convLeak.name}: ${fmtNum(convLeak.views7Delta ?? 0)} views but subs flat — conversion leak`,
      tone: 'warning',
    });
  }

  // Latent demand: views but no recent uploads
  const latent = withViews
    .filter((r) => (r.views7Delta ?? 0) > 50000 && r.uploads30d === 0 && r.movementConfidence !== 'stale')
    .sort((a, b) => (b.views7Delta ?? 0) - (a.views7Delta ?? 0))[0];
  if (latent && latent.slug !== convLeak?.slug) {
    insights.push({
      text: `${latent.name}: ${fmtDelta(latent.views7Delta ?? 0)} views but no recent uploads — latent demand`,
      tone: 'neutral',
    });
  }

  // Cadence risk
  const dormant = rows.filter((r) => r.uploads30d === 0 && (r.subs ?? 0) > 0);
  if (dormant.length > 0) {
    insights.push({
      text: `${dormant.length} channel${dormant.length !== 1 ? 's' : ''} inactive 60+ days — cadence risk`,
      tone: 'warning',
    });
  }

  // Biggest WoW decline — exclude LOW confidence / stale / UNAVAILABLE data / stale view data
  if (insights.length < 4) {
    const bigDrop = [...rows]
      .filter((r) => r.viewsWoW != null && r.viewsWoW < -30 && r.confidence !== 'LOW' && r.dataStatus !== 'STALE' && r.dataStatus !== 'UNAVAILABLE' && r.viewDataFreshness !== 'stale')
      .sort((a, b) => (a.viewsWoW ?? 0) - (b.viewsWoW ?? 0))[0];
    if (bigDrop && bigDrop.slug !== convLeak?.slug && bigDrop.slug !== latent?.slug) {
      insights.push({
        text: `${bigDrop.name}: views ${fmtPct(bigDrop.viewsWoW ?? 0)} week-on-week — attention dropping`,
        tone: 'warning',
      });
    }
  }

  return insights.slice(0, 4);
}

const INSIGHT_ICON: Record<Insight['tone'], { dot: string; color: string }> = {
  positive: { dot: '#1FBE7A', color: '#0C6A3F' },
  warning:  { dot: '#F08A3C', color: '#8A4A1A' },
  neutral:  { dot: '#B0A68E', color: 'rgba(14,14,14,0.55)' },
};

// ─── Top Movers ──────────────────────────────────────────────────────────────

type MoverEntry = { name: string; slug: string; value: string };

function computeTopMovers(rows: RowData[]): {
  topViews: MoverEntry[];
  topSubs: MoverEntry[];
  biggestDecline: MoverEntry[];
  cadenceRisk: MoverEntry[];
} {
  // Use effective movement: current delta if available, else last-known-good
  // But only rank if bestAvailable says the data is trustworthy enough
  const effectiveViews = (r: RowData) => r.views7Delta ?? r.lastKnownGoodViews7d ?? 0;
  const effectiveSubs = (r: RowData) => r.subs7Delta ?? r.lastKnownGoodSubs7d ?? 0;
  const canRank = (r: RowData) => r.bestAvailableShouldUseInTopMovers !== false;

  const topViews = [...rows]
    .filter((r) => effectiveViews(r) > 0 && canRank(r))
    .sort((a, b) => effectiveViews(b) - effectiveViews(a))
    .slice(0, 3)
    .map((r) => ({ name: r.name, slug: r.slug, value: fmtDelta(effectiveViews(r)) }));

  const topSubs = [...rows]
    .filter((r) => effectiveSubs(r) > 0 && canRank(r))
    .sort((a, b) => effectiveSubs(b) - effectiveSubs(a))
    .slice(0, 3)
    .map((r) => ({ name: r.name, slug: r.slug, value: fmtDelta(effectiveSubs(r)) }));

  const biggestDecline = [...rows]
    .filter((r) => r.viewsWoW != null && r.viewsWoW < -10 && r.confidence !== 'LOW' && r.dataStatus !== 'STALE' && r.dataStatus !== 'UNAVAILABLE' && r.viewDataFreshness !== 'stale')
    .sort((a, b) => (a.viewsWoW ?? 0) - (b.viewsWoW ?? 0))
    .slice(0, 3)
    .map((r) => ({ name: r.name, slug: r.slug, value: fmtPct(r.viewsWoW ?? 0) + ' WoW' }));

  const cadenceRisk = [...rows]
    .filter((r) => r.uploads30d === 0 && (r.subs ?? 0) > 1000)
    .sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))
    .slice(0, 3)
    .map((r) => ({ name: r.name, slug: r.slug, value: `${fmtNum(r.subs ?? 0)} subs idle` }));

  return { topViews, topSubs, biggestDecline, cadenceRisk };
}

// ─── Best in Class: Consistency Leaders ──────────────────────────────────

type ConsistencyEntry = {
  name: string;
  slug: string;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  status: ChannelState;
  classification: ArtistClassification;
  /** Format split label */
  formatLabel: string;
  /** Whether channel is healthy/growing */
  isHealthy: boolean;
};

function computeConsistencyLeaders(rows: RowData[], max: number = 5): ConsistencyEntry[] {
  return [...rows]
    .filter((r) => r.uploads30d >= 2) // at least 2 uploads to qualify
    .sort((a, b) => {
      // Primary: uploads30d (highest cadence first)
      const cadenceDiff = b.uploads30d - a.uploads30d;
      if (cadenceDiff !== 0) return cadenceDiff;
      // Tiebreaker: healthy status ranks higher
      return STATUS_RANK[b.status] - STATUS_RANK[a.status];
    })
    .slice(0, max)
    .map((r) => {
      const longform = r.uploads30d - r.shorts30d;
      let formatLabel = '';
      if (r.shorts30d > 0 && longform > 0) {
        formatLabel = `${longform} long-form · ${r.shorts30d} Shorts`;
      } else if (r.shorts30d > 0) {
        formatLabel = `${r.shorts30d} Shorts`;
      } else {
        formatLabel = `${longform} long-form`;
      }
      return {
        name: r.name,
        slug: r.slug,
        uploads30d: r.uploads30d,
        shorts30d: r.shorts30d,
        longform30d: longform,
        status: r.status,
        classification: r.classification,
        formatLabel,
        isHealthy: r.status === 'HEALTHY' || r.classification === 'GROWING',
      };
    });
}

// ─── Strategy Profile per artist ─────────────────────────────────────────────

type StrategyProfile = {
  cadence: 'High' | 'Mid' | 'Low' | 'Dormant';
  formatMix: 'Shorts-heavy' | 'Balanced' | 'Longform-heavy' | 'Underdeveloped';
  conversion: 'Strong' | 'Weak' | 'Unknown';
  momentum: 'Rising' | 'Flat' | 'Falling' | 'Unknown';
};

function computeProfile(r: RowData): StrategyProfile {
  // Cadence
  let cadence: StrategyProfile['cadence'] = 'Mid';
  if (r.uploads30d === 0) cadence = 'Dormant';
  else if (r.uploads30d <= 2) cadence = 'Low';
  else if (r.uploads30d >= 8) cadence = 'High';

  // Format Mix
  let formatMix: StrategyProfile['formatMix'] = 'Underdeveloped';
  if (r.uploads30d > 0) {
    const shortsShare = r.shorts30d / r.uploads30d;
    if (shortsShare > 0.7) formatMix = 'Shorts-heavy';
    else if (shortsShare >= 0.3) formatMix = 'Balanced';
    else formatMix = 'Longform-heavy';
  }

  // Conversion
  let conversion: StrategyProfile['conversion'] = 'Unknown';
  if ((r.views7Delta ?? 0) > 5000) {
    conversion = (r.subs7Delta ?? 0) > 0 ? 'Strong' : 'Weak';
  }

  // Momentum
  let momentum: StrategyProfile['momentum'] = 'Unknown';
  if (r.viewsWoW != null) {
    if (r.viewsWoW > 15) momentum = 'Rising';
    else if (r.viewsWoW < -15) momentum = 'Falling';
    else momentum = 'Flat';
  }

  return { cadence, formatMix, conversion, momentum };
}

const PROFILE_TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  // Cadence
  High: { bg: '#E6F8EE', fg: '#0C6A3F' },
  Mid: { bg: '#FFF5D6', fg: '#7A5A00' },
  Low: { bg: '#FFEAD6', fg: '#8A4A1A' },
  Dormant: { bg: '#FFE2D8', fg: '#8A1F0C' },
  // Format
  'Shorts-heavy': { bg: '#E8F0FE', fg: '#1A56B8' },
  Balanced: { bg: '#E6F8EE', fg: '#0C6A3F' },
  'Longform-heavy': { bg: '#FFF5D6', fg: '#7A5A00' },
  Underdeveloped: { bg: '#F3F0EA', fg: 'rgba(14,14,14,0.4)' },
  // Conversion
  Strong: { bg: '#E6F8EE', fg: '#0C6A3F' },
  Weak: { bg: '#FFEAD6', fg: '#8A4A1A' },
  Unknown: { bg: '#F3F0EA', fg: 'rgba(14,14,14,0.4)' },
  // Momentum
  Rising: { bg: '#E6F8EE', fg: '#0C6A3F' },
  Flat: { bg: '#FFF5D6', fg: '#7A5A00' },
  Falling: { bg: '#FFE2D8', fg: '#8A1F0C' },
};

// ─── Fix This Week recommendation ────────────────────────────────────────────

function computeFixThisWeek(r: RowData): string {
  // Stale movement — don't diagnose from unreliable data
  if (r.movementConfidence === 'stale') {
    if (r.uploads30d === 0) return 'Totals updating — consider posting a reactivation clip';
    return 'Totals updating — maintain cadence';
  }
  // Dormant with audience
  if (r.uploads30d === 0 && (r.subs ?? 0) > 0) {
    return 'Post one Shorts-led reactivation clip this week';
  }
  // High views + flat subs
  if ((r.views7Delta ?? 0) > 5000 && (r.subs7Delta ?? 0) <= 0) {
    return 'Add artist-led context and pinned CTA to convert viewers';
  }
  // Strong Shorts but weak longform
  if (r.shorts30d > 0 && r.uploads30d > 0 && r.shorts30d / r.uploads30d > 0.8 && (r.views7Delta ?? 0) > 0) {
    return 'Bridge Shorts audience into an official video or longform piece';
  }
  // High cadence but low views
  if (r.uploads30d >= 6 && (r.views7Delta ?? 0) < 5000 && (r.views7Delta ?? 0) >= 0) {
    return 'Improve hook and format, not volume — quality over quantity';
  }
  // Low cadence, some traction
  if (r.uploads30d > 0 && r.uploads30d <= 2 && (r.views7Delta ?? 0) > 0) {
    return 'Increase upload cadence — add 2–3 catalogue Shorts per week';
  }
  // No Shorts
  if (r.shorts30d === 0 && r.uploads30d > 0) {
    return 'Add 2–3 Shorts from strongest campaign asset';
  }
  // Growing well
  if (r.classification === 'GROWING') {
    return 'Maintain cadence — channel is healthy';
  }
  return 'Review channel strategy and set a content target';
}

// ─── Top Videos type ─────────────────────────────────────────────────────────

export type TopVideo = {
  videoId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  views: number;
  velocity: number;       // views per day since publish
  publishedAt: string;
  daysAgo: number;
  isShort: boolean;
};

// ─── Market Format Stats type ────────────────────────────────────────────────

export type MarketFormatStats = {
  longformCount: number;
  longformViews: number;
  shortsCount: number;
  shortsViews: number;
  totalUploads: number;
  activeArtists: number;  // artists who uploaded in the period
};

// ─── Board Component ──────────────────────────────────────────────────────────

export default function ChannelHealthBoard({
  rows,
  linkPrefix = '/watcher',
  topVideos,
  marketFormatStats,
}: {
  rows: RowData[];
  linkPrefix?: string;
  topVideos?: TopVideo[];
  marketFormatStats?: MarketFormatStats;
}) {
  const [view, setView] = useState<ViewMode>('managed');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [moversOpen, setMoversOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);

  const managedRows = rows.filter((r) => r.isVirgin);
  const marketRows = rows.filter((r) => !r.isVirgin);

  // Compute benchmarks from all channels (used for Market Watch + managed context)
  const allBenchmarks = rows.length > 0 ? computeMarketBenchmarks(rows) : null;
  const marketBenchmarks = marketRows.length > 0 ? computeMarketBenchmarks(marketRows) : null;

  // Channel scores for all rows — measures execution quality, not artist size
  const scoreMap = useMemo(() => {
    const inputs: ChannelScoreInput[] = rows.map((r) => ({
      views7Delta: r.views7Delta,
      subs7Delta: r.subs7Delta,
      uploads30d: r.uploads30d,
      shorts30d: r.shorts30d,
      lastUploadAt: null,
      subs: r.subs,
      totalViews: r.totalViews ?? null,
      movementConfidence: r.movementConfidence,
    }));
    const pool = computeBenchmarkPool(inputs);
    const map = new Map<string, ChannelScore>();
    rows.forEach((r, i) => map.set(r.slug, calculateChannelScore(inputs[i], pool)));
    return map;
  }, [rows]);

  const activeRows = view === 'managed' ? managedRows : marketRows;
  const sorted = [...activeRows].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);

  // Classification counts
  const growingCount = activeRows.filter((r) => r.classification === 'GROWING').length;
  const weakConvCount = activeRows.filter((r) => r.classification === 'WEAK_CONVERSION').length;
  const underfedCount = activeRows.filter((r) => r.classification === 'UNDERFED').length;
  const coldCount = activeRows.filter((r) => r.classification === 'COLD').length;

  // Insights & movers (managed view only)
  const insights = view === 'managed' ? computeInsights(managedRows) : [];
  const topMovers = view === 'managed' ? computeTopMovers(managedRows) : null;

  // Market benchmark read (market view)
  const benchmarkRead = view === 'market' && marketBenchmarks ? buildBenchmarkRead(marketBenchmarks, marketRows) : null;

  // Consistency leaders (both views)
  const consistencyLeaders = computeConsistencyLeaders(activeRows);

  return (
    <>
      {/* ─── VIEW TOGGLE + HELPER LINE ──────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg p-1 mb-2" style={{ background: SOFT }}>
        <button
          onClick={() => { setView('managed'); setExpandedRow(null); }}
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
          onClick={() => { setView('market'); setExpandedRow(null); }}
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
      <div className="text-[10px] text-ink/35 mb-5 pl-1">
        {view === 'managed'
          ? 'Owned / priority channels we can act on'
          : 'External channels used to spot patterns, benchmarks and rollout signals'}
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

      {/* ─── MANAGED VIEW: What Changed This Week ──────────────────────── */}
      {view === 'managed' && insights.length > 0 && (
        <div className="rounded-xl px-5 py-3.5 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2.5">
            What Changed This Week
          </div>
          <div className="space-y-1.5">
            {insights.map((ins, i) => {
              const ic = INSIGHT_ICON[ins.tone];
              return (
                <div key={i} className="flex items-start gap-2 text-[12px] leading-snug" style={{ color: ic.color }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: ic.dot }} />
                  <span>{ins.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MANAGED VIEW: Top Performing Videos (split) ──────────────── */}
      {view === 'managed' && topVideos && topVideos.length > 0 && (() => {
        const topShorts = topVideos.filter((v) => v.isShort).slice(0, 5);
        const topLongform = topVideos.filter((v) => !v.isShort).slice(0, 5);
        if (topShorts.length === 0 && topLongform.length === 0) return null;
        return (
          <div className="rounded-xl px-5 py-4 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-3">
              Top Performing Videos This Week
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Long-form column */}
              {topLongform.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/30 mb-2">Long-form</div>
                  <div className="space-y-2">
                    {topLongform.map((v, i) => (
                      <VideoRow key={v.videoId} v={v} rank={i + 1} linkPrefix={linkPrefix} />
                    ))}
                  </div>
                </div>
              )}
              {/* Shorts column */}
              {topShorts.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/30 mb-2">Shorts</div>
                  <div className="space-y-2">
                    {topShorts.map((v, i) => (
                      <VideoRow key={v.videoId} v={v} rank={i + 1} linkPrefix={linkPrefix} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── MANAGED VIEW: Top Movers (expandable) ─────────────────────── */}
      {view === 'managed' && topMovers && (
        topMovers.topViews.length > 0 || topMovers.topSubs.length > 0 ||
        topMovers.biggestDecline.length > 0 || topMovers.cadenceRisk.length > 0
      ) && (
        <div className="rounded-xl mb-4" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
          <button
            onClick={() => setMoversOpen(!moversOpen)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35">
              Top Movers
            </span>
            <span className="text-[10px] font-bold text-ink/30">
              {moversOpen ? '▲ Less' : '▼ Show'}
            </span>
          </button>
          {moversOpen && (
            <div className="grid grid-cols-2 gap-4 px-5 pb-4 lg:grid-cols-4">
              <MoverColumn title="Views Gainers (7d)" items={topMovers.topViews} linkPrefix={linkPrefix} />
              <MoverColumn title="Sub Gainers (7d)" items={topMovers.topSubs} linkPrefix={linkPrefix} />
              <MoverColumn title="Biggest Decline" items={topMovers.biggestDecline} linkPrefix={linkPrefix} />
              <MoverColumn title="Cadence Risk" items={topMovers.cadenceRisk} linkPrefix={linkPrefix} />
            </div>
          )}
        </div>
      )}

      {/* ─── MARKET VIEW: Market Benchmark Read ────────────────────────── */}
      {view === 'market' && benchmarkRead && (
        <div className="rounded-xl px-5 py-4 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-3">
            Market Benchmark Read
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3 lg:grid-cols-4">
            {benchmarkRead.stats.map((stat, i) => (
              <div key={i}>
                <div className="text-[18px] font-black tabular-nums">{stat.value}</div>
                <div className="text-[10px] text-ink/40 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Content format breakdown */}
          {marketFormatStats && marketFormatStats.totalUploads > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3 pt-2 border-t lg:grid-cols-4" style={{ borderColor: MUTED }}>
              <div>
                <div className="text-[18px] font-black tabular-nums">{marketFormatStats.longformCount}</div>
                <div className="text-[10px] text-ink/40 leading-snug">Long-form uploads (30d)</div>
              </div>
              <div>
                <div className="text-[18px] font-black tabular-nums">{fmtNum(marketFormatStats.longformViews)}</div>
                <div className="text-[10px] text-ink/40 leading-snug">Long-form views</div>
              </div>
              <div>
                <div className="text-[18px] font-black tabular-nums">
                  {marketFormatStats.totalUploads > 0
                    ? `${Math.round((marketFormatStats.longformCount / marketFormatStats.totalUploads) * 100)}%`
                    : '—'}
                </div>
                <div className="text-[10px] text-ink/40 leading-snug">Long-form share</div>
              </div>
              <div>
                <div className="text-[18px] font-black tabular-nums">{marketFormatStats.activeArtists}</div>
                <div className="text-[10px] text-ink/40 leading-snug">Artists uploading (30d)</div>
              </div>
            </div>
          )}

          {/* Patterns */}
          <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: MUTED }}>
            {benchmarkRead.winning && (
              <div className="flex items-start gap-2 text-[12px] leading-snug">
                <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: '#1FBE7A' }} />
                <span style={{ color: '#0C6A3F' }}>{benchmarkRead.winning}</span>
              </div>
            )}
            {benchmarkRead.weakness && (
              <div className="flex items-start gap-2 text-[12px] leading-snug">
                <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: '#F08A3C' }} />
                <span style={{ color: '#8A4A1A' }}>{benchmarkRead.weakness}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BEST PERFORMING / NEEDS ATTENTION ─────────────────────────── */}
      {view === 'managed' && managedRows.length > 2 && (
        <div className="mb-4">
          <TopChannelsModule
            channels={managedRows.map((r) => ({
              name: r.name,
              slug: r.slug,
              views7Delta: r.views7Delta,
              subs7Delta: r.subs7Delta,
              uploads30d: r.uploads30d,
              shorts30d: r.shorts30d,
              lastUploadAt: null,
              subs: r.subs,
              totalViews: r.totalViews ?? null,
            }))}
            linkPrefix={linkPrefix}
          />
        </div>
      )}

      {/* ─── BEST IN CLASS: Consistency Leaders ──────────────────────── */}
      {consistencyLeaders.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-4" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-3">
            Best in Class — Consistency
          </div>
          <div className="space-y-2">
            {consistencyLeaders.map((c, i) => {
              const st = STATUS_STYLE[c.status];
              return (
                <div key={c.slug} className="flex items-center gap-3 text-[12px]">
                  <span className="text-ink/25 text-[11px] font-bold tabular-nums w-4 shrink-0">{i + 1}.</span>
                  <Link
                    href={`${linkPrefix}/${c.slug}`}
                    className="font-bold hover:underline min-w-0 truncate"
                    style={{ color: INK, textDecoration: 'none' }}
                  >
                    {c.name}
                  </Link>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {STATE_LABEL[c.status]}
                  </span>
                  <span className="text-ink/35 text-[11px] shrink-0 ml-auto tabular-nums">
                    <span className="font-black" style={{ color: INK }}>{c.uploads30d}</span>
                    <span className="text-ink/30"> uploads</span>
                  </span>
                  <span className="text-[10px] text-ink/30 shrink-0 hidden sm:inline">
                    {c.formatLabel}
                  </span>
                </div>
              );
            })}
          </div>
          {view === 'managed' && (
            <div className="mt-3 text-[10px] text-ink/30 leading-snug">
              Channels with the highest sustained upload cadence over the last 30 days.
            </div>
          )}
          {view === 'market' && (
            <div className="mt-3 text-[10px] text-ink/30 leading-snug">
              Market artists leading on content consistency — benchmark for cadence targets.
            </div>
          )}
        </div>
      )}

      {/* ─── EXPLAINER ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <button
          onClick={() => setExplainerOpen(!explainerOpen)}
          className="text-[11px] font-medium flex items-center gap-1 hover:underline"
          style={{ color: 'rgba(14,14,14,0.4)' }}
        >
          <span style={{ transform: explainerOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
          How to read this page
        </button>
        {explainerOpen && (
          <div className="mt-2 p-4 rounded-lg text-[11px] leading-relaxed space-y-2" style={{ background: SOFT, color: 'rgba(14,14,14,0.6)' }}>
            <p><strong style={{ color: INK }}>Status</strong> — Each channel gets a health status based on upload cadence, subscriber conversion, and recent activity. Healthy channels are sorted first.</p>
            <p><strong style={{ color: INK }}>Score (A–D)</strong> — Grades how well the channel is being run across three pillars: reach growth, subscriber conversion efficiency, and posting cadence. Scores measure execution quality, not artist popularity.</p>
            <p><strong style={{ color: INK }}>Deltas &amp; WoW</strong> — 7-day subscriber and view changes, plus week-on-week momentum. A "—" means data is still building or totals are updating; hover for context.</p>
            <p><strong style={{ color: INK }}>Data quality</strong> — Badges like "Building" or "Totals updating" indicate tracking maturity. When totals haven't changed between snapshots, deltas show "—" instead of misleading numbers. Accuracy improves as daily snapshots accumulate.</p>
          </div>
        )}
      </div>

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
          // fmtSubs7 now uses directional effective value (see fmtSubs7Label above)
          // Directional reporting: use last-known-good for stale artists
          const isStaleRow = r.movementConfidence === 'stale';
          const hasLKGViews = isStaleRow && r.lastKnownGoodViews7d != null;
          const hasLKGSubs = isStaleRow && r.lastKnownGoodSubs7d != null;

          const effectiveViews7 = r.views7Delta ?? (hasLKGViews ? r.lastKnownGoodViews7d! : null);
          const effectiveSubs7 = r.subs7Delta ?? (hasLKGSubs ? r.lastKnownGoodSubs7d! : null);

          const fmtViews7 = effectiveViews7 != null ? fmtDelta(effectiveViews7) : '—';
          const fmtSubs7Label = effectiveSubs7 != null
            ? `${effectiveSubs7 >= 0 ? '+' : ''}${effectiveSubs7.toLocaleString()}`
            : '—';
          const subsColor = effectiveSubs7 != null
            ? effectiveSubs7 > 0
              ? (hasLKGSubs ? 'rgba(12,106,63,0.45)' : '#0C6A3F')
              : effectiveSubs7 < 0
                ? (hasLKGSubs ? 'rgba(138,31,12,0.45)' : '#8A1F0C')
                : undefined
            : undefined;
          const viewsColor = effectiveViews7 != null
            ? effectiveViews7 > 0
              ? (hasLKGViews ? 'rgba(12,106,63,0.45)' : '#0C6A3F')
              : effectiveViews7 < 0
                ? (hasLKGViews ? 'rgba(138,31,12,0.45)' : '#8A1F0C')
                : undefined
            : undefined;
          const isExpanded = expandedRow === r.slug;
          const profile = computeProfile(r);
          const fix = computeFixThisWeek(r);

          return (
            <div key={r.slug}>
              <div
                className={`grid grid-cols-[1.4fr_0.6fr_0.65fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-5 py-4 items-center hover:brightness-[0.97] transition-all cursor-pointer ${
                  i === sorted.length - 1 && !isExpanded ? '' : 'border-b'
                }`}
                style={{ borderColor: MUTED, background: st.rowBg }}
                onClick={() => setExpandedRow(isExpanded ? null : r.slug)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`${linkPrefix}/${r.slug}`}
                      className="font-black text-[14px] truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </Link>
                    {scoreMap.get(r.slug) && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <ChannelScoreBadge score={scoreMap.get(r.slug)!} compact />
                      </span>
                    )}
                    {r.dataStatus && r.dataStatus !== 'FRESH' && (
                      <span
                        className="text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                        style={DATA_STATUS_BADGE[r.dataStatus] ?? DATA_STATUS_BADGE.LIMITED}
                        title={r.dataStatusNote ?? r.healthNote ?? ''}
                      >
                        {DATA_STATUS_LABEL[r.dataStatus] ?? r.dataStatus}
                      </span>
                    )}
                    {!r.dataStatus && r.confidence === 'LOW' && (
                      <span className="text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ background: '#F3F0EA', color: 'rgba(14,14,14,0.35)' }} title={r.healthNote ?? 'Sparse activity — comparison metrics less reliable'}>
                        Sparse
                      </span>
                    )}
                    <span className="text-[9px] text-ink/25 shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </div>
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
                  {fmtSubs7Label}
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
              </div>

              {/* ── Expanded: Strategy Profile + Fix This Week ───────── */}
              {isExpanded && (
                <div
                  className={`px-5 py-3.5 ${i === sorted.length - 1 ? '' : 'border-b'}`}
                  style={{ borderColor: MUTED, background: SOFT }}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Strategy tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProfileTag label="Cadence" value={profile.cadence} />
                      <ProfileTag label="Format" value={profile.formatMix} />
                      <ProfileTag label="Conversion" value={profile.conversion} />
                      <ProfileTag label="Momentum" value={profile.momentum} />
                    </div>

                    {/* Fix this week */}
                    <div className="flex items-start gap-2 ml-auto text-[11px] leading-snug max-w-[360px]">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-ink/30 shrink-0 mt-px">Fix</span>
                      <span className="text-ink/60">{fix}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProfileTag({ label, value }: { label: string; value: string }) {
  const style = PROFILE_TAG_STYLE[value] ?? PROFILE_TAG_STYLE.Unknown;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="text-[8px] uppercase tracking-[0.08em] opacity-60">{label}</span>
      {value}
    </span>
  );
}

function MoverColumn({ title, items, linkPrefix = '/watcher' }: { title: string; items: MoverEntry[]; linkPrefix?: string }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30 mb-1.5">{title}</div>
        <div className="text-[11px] text-ink/25">—</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30 mb-1.5">{title}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.slug} className="flex items-center justify-between gap-2 text-[11px]">
            <Link href={`${linkPrefix}/${item.slug}`} className="truncate text-ink/60 hover:underline">
              {i + 1}. {item.name}
            </Link>
            <span className="tabular-nums font-bold text-ink/50 shrink-0">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoRow({ v, rank, linkPrefix }: { v: TopVideo; rank: number; linkPrefix: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="text-ink/25 text-[11px] font-bold tabular-nums w-4 shrink-0">{rank}.</span>
      <div className="flex-1 min-w-0">
        <a
          href={`https://youtube.com/watch?v=${v.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold truncate block hover:underline"
          style={{ color: INK, textDecoration: 'none' }}
        >
          {v.title}
        </a>
        <div className="text-[10px] text-ink/35 mt-0.5">
          <Link href={`${linkPrefix}/${v.artistSlug}`} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>
            {v.artistName}
          </Link>
          {' · '}{v.daysAgo === 0 ? 'today' : v.daysAgo === 1 ? '1d ago' : `${v.daysAgo}d ago`}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[14px] font-black tabular-nums" style={{ color: '#0C6A3F' }}>
          {fmtNum(v.velocity)}<span className="text-[9px] font-bold text-ink/30">/day</span>
        </div>
        <div className="text-[9px] text-ink/30 tabular-nums">
          {fmtNum(v.views)} total
        </div>
      </div>
    </div>
  );
}

// ─── Market Benchmark Read builder ───────────────────────────────────────────

type BenchmarkStat = { value: string; label: string };
type BenchmarkRead = {
  stats: BenchmarkStat[];
  winning: string | null;
  weakness: string | null;
};

function buildBenchmarkRead(bench: MarketBenchmarks, rows: RowData[]): BenchmarkRead {
  const active = rows.filter((r) => r.status !== 'COLD');
  const hasEnoughData = active.length >= 2;

  if (!hasEnoughData) {
    return {
      stats: [],
      winning: null,
      weakness: 'Not enough clean data yet.',
    };
  }

  const stats: BenchmarkStat[] = [
    {
      value: bench.avgUploads30d > 0 ? `${bench.avgUploads30d}/mo` : '—',
      label: 'Avg uploads (active)',
    },
    {
      value: bench.formatMix.total > 0
        ? `${Math.round((bench.formatMix.withShorts / bench.formatMix.total) * 100)}%`
        : '—',
      label: 'Channels using Shorts',
    },
    {
      value: bench.avgShortsRatio > 0 ? `${Math.round(bench.avgShortsRatio * 100)}%` : '—',
      label: 'Shorts share of uploads',
    },
    {
      value: bench.avgViewsAll > 0 ? fmtNum(bench.avgViewsAll) : '—',
      label: 'Avg views/week (active)',
    },
  ];

  // Winning pattern
  let winning: string | null = null;
  if (bench.topPerformerCadence > 0 && bench.avgViewsHealthy > 0) {
    const parts: string[] = [];
    parts.push(`posting ${bench.topPerformerCadence}+ times/month`);
    if (bench.formatMix.withShorts > 0) parts.push('using Shorts as a discovery layer');
    if (bench.avgSubsGainHealthy > 0) parts.push('converting when artist-led content is present');
    winning = `Winning channels are ${parts.join(', ')}.`;
  }

  // Weakness
  let weakness: string | null = null;
  const weakConv = rows.filter((r) => r.classification === 'WEAK_CONVERSION');
  const dormant = rows.filter((r) => r.uploads30d === 0);
  if (weakConv.length > 0 && dormant.length > 0) {
    weakness = `${weakConv.length} channel${weakConv.length !== 1 ? 's' : ''} leaking conversion, ${dormant.length} dormant — common pattern across the market.`;
  } else if (weakConv.length > 0) {
    weakness = `${weakConv.length} channel${weakConv.length !== 1 ? 's' : ''} with strong views but weak subscriber conversion.`;
  } else if (dormant.length > 0) {
    weakness = `${dormant.length} channel${dormant.length !== 1 ? 's' : ''} inactive with no recent uploads.`;
  }

  return { stats, winning, weakness };
}
