'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fmtNum, trustedViewDelta, type ChannelState, type ArtistClassification, CLASSIFICATION_STYLE, CLASSIFICATION_LABEL } from '@/lib/artists';
import Sparkline from './Sparkline';
import { SectionHead } from './ui';
// WeeklySpotlight has moved to its own page at /weekly-pulse/channel-spotlight

// ─── Types ────────────────────────────────────────────────────────────────────

export type RowData = {
  /** Region tag of the team that added this artist, if a team did. */
  teamTag?: string;
  slug: string;
  name: string;
  isVirgin: boolean;
  /** Channel ID — needed for remove functionality on team watcher */
  channelId?: string;
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
  /** Multiformat strategy — which YouTube formats are active in the last 90d */
  multiformat?: {
    hasShorts: boolean;
    hasOfficialVideo: boolean;
    hasLyricVideo: boolean;
    hasVisualizer: boolean;
    hasBTS: boolean;
    hasLiveSession: boolean;
    formatCount: number;
    score: 'Strong' | 'Good' | 'Partial' | 'Weak' | 'None';
  };
  /**
   * Shorts vs long-form VIEW split, computed server-side in growth/page.tsx
   * from already-cached data. `basis` says which measure it is: 'recent'
   * is viewing gained in the last 7 days from daily readings, 'lifetime'
   * is the totals our inventoried videos have accumulated since upload.
   * The two are not interchangeable and the cell labels them differently.
   */
  formatSplit?: {
    basis: 'recent' | 'lifetime';
    windowDays: number | null;
    longformShare: number;
    shortsShare: number;
    longformViews: number;
    shortsViews: number;
    viewsCovered: number | null;
    confidence: 'complete' | 'partial' | 'sample';
    collecting: { comparable: number; required: number; total: number } | null;
  };
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

const STATUS_HELP: Record<ChannelState, string> = {
  HEALTHY:           'Strong cadence and positive momentum',
  'WEAK CONVERSION': 'Views are growing faster than subscriber conversion',
  BUILDING:          'Upload activity present but momentum not yet compounding',
  'AT RISK':         'Declining momentum or extended gaps between uploads',
  COLD:              'Long periods of inactivity or declining momentum',
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
  /* Appended to every row link. Regional boards live behind a key in the
     query string, and a link that drops it sends the reader to a page
     that tells them they are not allowed in. */
  linkSuffix = '',
  /* Where "channel behaviour" goes. Defaults to the UK campaigns board; a
     market or team passes its own so the link does not leave their space. */
  behaviourBase = '/campaigns',
  topVideos,
  marketFormatStats,
  singleTab = false,
  removable = false,
  /* Which board's entries these rows belong to. Without it, a write from
     the Australia board lands on the Nordics board — the API defaults to
     nordics when no team is given, which is right for the old callers and
     silently wrong for a new one. */
  team,
  /** Channel ids currently pinned, so the toggle can show its state. */
  pinnedChannelIds,
  pinnedSlugs = [],
}: {
  rows: RowData[];
  linkPrefix?: string;
  linkSuffix?: string;
  behaviourBase?: string;
  topVideos?: TopVideo[];
  marketFormatStats?: MarketFormatStats;
  /** Hide the managed/market toggle and show only the managed view */
  singleTab?: boolean;
  /** Show ✕ remove button on each row (team watcher mode) */
  removable?: boolean;
  team?: string;
  pinnedChannelIds?: string[];
  /** Only show Behaviour button for artists with pinned campaigns */
  pinnedSlugs?: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('managed');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [moversOpen, setMoversOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /* Clicking a health figure filters the table to those channels. The
     count was already the answer to "how many" — this makes it the
     answer to "which", which is the next question every time. */
  const [classFilter, setClassFilter] = useState<ArtistClassification | null>(null);

  const handleRemove = useCallback(async (channelId: string, name: string) => {
    if (!confirm(`Remove ${name} from the Team Watcher? This will stop tracking this channel.`)) return;
    setRemovingId(channelId);
    try {
      const res = await fetch(
        `/api/team-watcher?channelId=${encodeURIComponent(channelId)}`
        + (team ? `&team=${encodeURIComponent(team)}` : ''),
        { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      router.refresh();
    } catch {
      alert('Failed to remove artist. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }, [router, team]);

  /* ── PINNING ────────────────────────────────────────────────────────
     A pin is the team saying "this one is a priority" — and that is what
     promotes a channel into Active Campaigns, where the full behaviour
     view lives. The data model has carried `pinnedAt` since the board
     was built and the API has always accepted pin/unpin; what was
     missing was any way to pin in the first place, so the section could
     only ever empty itself. */
  const pinnedSet = new Set(pinnedChannelIds ?? []);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const handlePin = useCallback(async (channelId: string, pinned: boolean) => {
    setPinningId(channelId);
    try {
      const res = await fetch(`/api/team-watcher${team ? `?team=${encodeURIComponent(team)}` : ''}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, action: pinned ? 'unpin' : 'pin' }),
      });
      if (!res.ok) throw new Error('failed');
      router.refresh();
    } catch {
      alert('Could not change the pin. Please try again.');
    } finally {
      setPinningId(null);
    }
  }, [router, team]);

  const managedRows = rows.filter((r) => r.isVirgin);
  const marketRows = rows.filter((r) => !r.isVirgin);

  // Compute benchmarks from all channels (used for Market Watch + managed context)
  const allBenchmarks = rows.length > 0 ? computeMarketBenchmarks(rows) : null;
  const marketBenchmarks = marketRows.length > 0 ? computeMarketBenchmarks(marketRows) : null;


  const activeRows = view === 'managed' ? managedRows : marketRows;
  const sorted = [...activeRows]
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])
    .filter((r) => (classFilter ? r.classification === classFilter : true));
  const filtered = search.trim()
    ? sorted.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  // Classification counts
  const growingCount = activeRows.filter((r) => r.classification === 'GROWING').length;
  const weakConvCount = activeRows.filter((r) => r.classification === 'WEAK_CONVERSION').length;
  const underfedCount = activeRows.filter((r) => r.classification === 'UNDERFED').length;
  const coldCount = activeRows.filter((r) => r.classification === 'COLD').length;

  // Multiformat strategy counts
  const mfRows = activeRows.filter((r) => r.multiformat);
  const mfStrong = mfRows.filter((r) => r.multiformat!.score === 'Strong' || r.multiformat!.score === 'Good').length;
  const mfPartial = mfRows.filter((r) => r.multiformat!.score === 'Partial').length;
  const mfWeak = mfRows.filter((r) => r.multiformat!.score === 'Weak' || r.multiformat!.score === 'None').length;

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
      {!singleTab && (
        <>
          {/* Flat tabs on a rule, not pills in a tray. Two buttons inside a
              filled container with their own fill and a drop shadow is three
              surfaces to say one thing. The underline carries it. */}
          {/* Sentence case on the type scale, with the count demoted to a
              secondary weight. In all-caps black with wide tracking these
              two read louder than the page title above them. */}
          <div className="flex items-center gap-6 border-b border-line">
            {([
              ['managed', 'Virgin Managed', managedRows.length],
              ['market', 'Market Watch', marketRows.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => { setView(key); setExpandedRow(null); setSearch(''); setClassFilter(null); }}
                aria-pressed={view === key}
                className={`relative pb-2.5 -mb-px text-h4 transition-colors ${
                  view === key ? 'font-extrabold text-ink' : 'font-semibold text-muted hover:text-ink'
                }`}
              >
                {label}
                <span className={`ml-1.5 tabular-nums font-semibold ${view === key ? 'text-muted' : 'text-faint'}`}>
                  {count}
                </span>
                {view === key && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink rounded-full" />
                )}
              </button>
            ))}
          </div>
          <div className="text-meta text-muted mt-2.5 mb-7">
            {view === 'managed'
              ? 'Owned and priority channels we can act on.'
              : 'External channels used to spot patterns, benchmarks and rollout signals.'}
          </div>
        </>
      )}

      {/* ─── SUMMARY BAR ──────────────────────────────────────────────────
          The four health states, as one analytical component rather than
          four numbers spaced across a page. They share a surface and are
          separated by dividers because they are one measurement of one
          roster — read across, they always sum to the active count, and
          the old layout gave no hint of that.

          Each state keeps the colour it carries everywhere else in the
          product, and the definition is now visible rather than hidden in
          a title attribute nobody hovers. */}
      <div className="bg-surface border border-line rounded-card mb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-line">
          {([
            ['GROWING', growingCount, 'Growing', CLASSIFICATION_STYLE.GROWING.fg, 'Strong cadence, positive momentum'],
            ['WEAK_CONVERSION', weakConvCount, 'Weak conversion', CLASSIFICATION_STYLE.WEAK_CONVERSION.fg, 'Views outpacing subscriber conversion'],
            ['UNDERFED', underfedCount, 'Underfed', CLASSIFICATION_STYLE.UNDERFED.fg, 'Upload activity limiting discovery'],
            ['COLD', coldCount, 'Cold', CLASSIFICATION_STYLE.COLD.fg, 'Inactive or declining momentum'],
          ] as const).map(([key, count, label, fg, hint]) => {
            const isOn = classFilter === key;
            /* A figure of zero is not a filter worth offering — it would
               select an empty table and look broken. */
            const selectable = count > 0;
            return (
              <button
                key={label}
                type="button"
                disabled={!selectable}
                aria-pressed={isOn}
                onClick={() => {
                  setClassFilter(isOn ? null : key);
                  setExpandedRow(null);
                }}
                className={`text-left px-5 py-4 border-t border-line first:border-t-0 lg:border-t-0 transition-colors ${
                  selectable ? 'cursor-pointer hover:bg-raised/70' : 'cursor-default'
                } ${isOn ? 'bg-raised' : ''}`}
                title={selectable ? (isOn ? 'Show all channels' : `Show only ${label.toLowerCase()} channels`) : undefined}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-kpiLg font-black tabular-nums"
                    style={{ color: count > 0 ? fg : 'rgba(14,14,14,0.18)' }}
                  >
                    {count}
                  </span>
                  <span className="text-micro text-faint tabular-nums">
                    / {activeRows.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-bold uppercase tracking-label text-secondary">{label}</span>
                  {isOn && (
                    <span className="text-[11px] font-bold" style={{ color: fg }} aria-hidden>●</span>
                  )}
                </div>
                <div className="text-[11px] text-muted mt-1 leading-snug">{hint}</div>
              </button>
            );
          })}
        </div>

        {/* Multiformat belonged with the health read, not floating under it
            as an unattached strip. Same component, quieter register. */}
        {mfRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-line bg-raised/50 rounded-b-card">
            <span className="text-[11px] font-bold uppercase tracking-label text-muted">
              Multiformat
            </span>
            <span className="text-micro text-secondary" title="Channels using 3+ YouTube formats (Shorts, Official Video, Lyric Video, Visualizer, BTS, Live Session)">
              <span className="font-black tabular-nums" style={{ color: '#0C6A3F' }}>{mfStrong}</span> strong
            </span>
            <span className="text-micro text-secondary" title="Channels using 2 formats">
              <span className="font-black tabular-nums" style={{ color: '#7A5A00' }}>{mfPartial}</span> partial
            </span>
            <span className="text-micro text-secondary" title="Channels using 0–1 formats — multiformat strategy not active">
              <span className="font-black tabular-nums" style={{ color: '#8A1F0C' }}>{mfWeak}</span> weak
            </span>
          </div>
        )}
      </div>

      {/* ─── EXPLAINER ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <button
          onClick={() => setExplainerOpen(!explainerOpen)}
          className="text-micro font-semibold flex items-center gap-1.5 text-muted hover:text-ink transition-colors"
          aria-expanded={explainerOpen}
        >
          <span style={{ transform: explainerOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
          How to read this page
        </button>
        {explainerOpen && (
          <div className="mt-2 p-4 rounded-lg text-[11px] leading-relaxed space-y-2" style={{ background: SOFT, color: 'rgba(14,14,14,0.6)' }}>
            {singleTab && (
              <p style={{ color: 'rgba(14,14,14,0.5)' }}>
                This board helps teams quickly monitor YouTube channel health, upload activity, and campaign momentum. Use it to spot channels needing attention, monitor active campaigns, identify strong upload cadence, and track momentum week-to-week. For deeper audience analytics and traffic source analysis, use YouTube Studio.
              </p>
            )}
            <p><strong style={{ color: INK }}>Status</strong> — Each channel gets a health status based on upload cadence, subscriber conversion, and recent activity. Healthy channels are sorted first.</p>
            <p><strong style={{ color: INK }}>Deltas &amp; WoW</strong> — 7-day subscriber and view changes, plus week-on-week momentum. A "—" means data is still building or totals are updating; hover for context.</p>
            <p><strong style={{ color: INK }}>Data quality</strong> — Badges like "Building" or "Totals updating" indicate tracking maturity. When totals haven't changed between snapshots, deltas show "—" instead of misleading numbers. Accuracy improves as daily snapshots accumulate.</p>
          </div>
        )}
      </div>

      {/* ─── SEARCH ─────────────────────────────────────────────────────── */}
      {/* A bordered control rather than an underlined one: on a page of
          hairline rules an underlined input is indistinguishable from a
          divider until you click it. */}
      {classFilter && (
        /* The table below is no longer the whole roster, and that has to
           be said in words rather than implied by a highlighted tile
           further up the page. */
        <div className="flex items-center gap-2 mb-3">
          <span className="text-meta text-secondary">
            Showing <strong className="text-ink">{filtered.length}</strong>{' '}
            {CLASSIFICATION_LABEL[classFilter].toLowerCase()} channel{filtered.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => setClassFilter(null)}
            className="text-micro font-semibold px-2.5 py-1 rounded-control border border-line text-secondary hover:text-ink hover:border-line-strong transition-colors"
          >
            Show all
          </button>
        </div>
      )}

      <div className="mb-3 relative max-w-[280px]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search artists…"
          aria-label="Search artists"
          className="w-full py-2 pl-8 pr-8 text-body text-ink bg-surface border border-line rounded-control outline-none transition-colors placeholder:text-faint focus:border-ink/30"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8A199" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[15px] leading-none text-faint hover:text-ink transition-colors"
            title="Clear search"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* ─── TABLE ──────────────────────────────────────────────────────── */}
      {/* The table is the product. It gets its own surface so it reads as
          one object, and the header sticks: on a 140-row roster the column
          a figure belongs to is otherwise a guess by the time you scroll.
          Header labels move off 9px — they were the smallest type on the
          page and they are the key to everything under them. */}
      <div className="bg-surface border border-line rounded-card overflow-hidden">
        <div
          className="grid grid-cols-[1.4fr_0.6fr_0.65fr_0.55fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-label text-muted border-b border-line bg-raised/60 sticky top-0 z-10"
        >
          <div>Artist</div>
          <div title="Subscriber trend over the last 30 days">30d trend</div>
          <div title="Channel health based on cadence, conversion, and activity">Status</div>
          <div title="Multiformat strategy — Shorts, Official Video, Lyric Video, Visualizer, BTS, Live Session">Formats</div>
          <div className="text-right" title="Total subscriber count">Subs</div>
          <div className="text-right" title="Subscribers gained in the last 7 days">Subs (7d)</div>
          <div className="text-right" title="Week-over-week change — compares this week vs last week">WoW</div>
          <div className="text-right" title="Views gained in the last 7 days">Views (7d)</div>
          <div className="text-right" title="Week-over-week change — compares this week vs last week">WoW</div>
        </div>

        {filtered.map((r, i) => {
          const st = STATUS_STYLE[r.status];
          const sp = SPARK_COLOR[r.status];
          const subsTotal = r.subs != null ? fmtNum(r.subs) : '—';
          // fmtSubs7 now uses directional effective value (see fmtSubs7Label above)
          // Directional reporting: use last-known-good for stale artists
          const isStaleRow = r.movementConfidence === 'stale';
          const hasLKGViews = isStaleRow && r.lastKnownGoodViews7d != null;
          const hasLKGSubs = isStaleRow && r.lastKnownGoodSubs7d != null;

          // View totals only climb, so a negative reading is two snapshots
          // disagreeing rather than views lost. Show it as still updating.
          const rawViews7 = r.views7Delta ?? (hasLKGViews ? r.lastKnownGoodViews7d! : null);
          const effectiveViews7 = trustedViewDelta(rawViews7);
          const viewsUnavailable = rawViews7 != null && effectiveViews7 == null;
          const effectiveSubs7 = r.subs7Delta ?? (hasLKGSubs ? r.lastKnownGoodSubs7d! : null);

          const fmtViews7 = effectiveViews7 != null
            ? fmtDelta(effectiveViews7)
            : viewsUnavailable ? 'Updating' : '—';
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
                /* hover:brightness dimmed the text along with the row, which
                   made the thing you were pointing at the hardest to read.
                   A background change leaves the content alone. */
                className={`group/row grid grid-cols-[1.4fr_0.6fr_0.65fr_0.55fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-4 py-3 items-center transition-colors cursor-pointer hover:bg-raised ${
                  i === filtered.length - 1 && !isExpanded ? '' : 'border-b border-line-faint'
                }`}
                style={{ background: st.rowBg }}
                onClick={() => setExpandedRow(isExpanded ? null : r.slug)}
              >
                <div className="min-w-0 relative">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`${linkPrefix}/${r.slug}${linkSuffix}`}
                      className="font-black text-[14px] truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </Link>
                    {/* Added by a regional board rather than by us. Shown so
                        the main Watcher answers "who is watching this?"
                        without anybody opening the other board. */}
                    {r.teamTag && (
                      <span
                        className="text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                        style={{ background: '#EEF2FF', color: '#3730A3' }}
                        title={`Tracked by the ${r.teamTag} team`}
                      >
                        {r.teamTag}
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
                  {pinnedChannelIds && r.channelId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePin(r.channelId!, pinnedSet.has(r.channelId!)); }}
                      disabled={pinningId === r.channelId}
                      className={`absolute ${removable ? '-right-7' : '-right-1'} top-0 w-5 h-5 flex items-center justify-center rounded-full text-[11px] transition-all ${
                        pinnedSet.has(r.channelId) ? '' : 'opacity-0 group-hover/row:opacity-100 hover:!opacity-100 focus:!opacity-100'
                      }`}
                      style={{ background: 'transparent' }}
                      title={pinnedSet.has(r.channelId)
                        ? `Unpin ${r.name} from Active Campaigns`
                        : `Pin ${r.name} to Active Campaigns`}
                    >
                      {pinningId === r.channelId ? '…' : pinnedSet.has(r.channelId) ? '📌' : '📍'}
                    </button>
                  )}
                  {removable && r.channelId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(r.channelId!, r.name); }}
                      disabled={removingId === r.channelId}
                      className="absolute -right-1 top-0 w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold transition-all opacity-0 group-hover/row:opacity-100 hover:!opacity-100 focus:!opacity-100"
                      style={{
                        color: removingId === r.channelId ? 'rgba(14,14,14,0.15)' : 'rgba(14,14,14,0.25)',
                        background: 'transparent',
                      }}
                      title={`Remove ${r.name} from watcher`}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#8A1F0C'; e.currentTarget.style.background = 'rgba(138,31,12,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(14,14,14,0.25)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      {removingId === r.channelId ? '…' : '✕'}
                    </button>
                  )}
                </div>
                <div className="flex items-center">
                  <Sparkline data={r.subsSeries} width={80} height={28} stroke={sp.stroke} fill={sp.fill} />
                </div>
                <div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap"
                    style={{ background: st.bg, color: st.fg }}
                    title={STATUS_HELP[r.status]}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                    {STATE_LABEL[r.status]}
                  </span>
                </div>
                <MultiformatCell multiformat={r.multiformat} formatSplit={r.formatSplit} />
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

              {/* ── Expanded: Actions + Strategy Profile + Fix This Week ───────── */}
              {isExpanded && (
                <div
                  className={`py-3.5 ${i === filtered.length - 1 ? '' : 'border-b'}`}
                  style={{ borderColor: MUTED, background: SOFT }}
                >
                  {/* Action buttons row */}
                  <div className="flex items-center gap-2 mb-3">
                    {pinnedSlugs.includes(r.slug) && (
                      <Link
                        href={`${behaviourBase}${behaviourBase.includes('?') ? '&' : '?'}behaviour=${r.slug}`}
                        className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors no-underline"
                        style={{ background: '#2C25FF', color: '#fff' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Behaviour
                      </Link>
                    )}
                    <QuickCopyButton row={r} type="slack" />
                    <QuickCopyButton row={r} type="email" />
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Strategy tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProfileTag label="Cadence" value={profile.cadence} />
                      {/* "Upload mix", not "Format". computeProfile derives this
                          from shorts30d / uploads30d — it counts what was
                          PUBLISHED. Labelled "Format" next to a viewing split it
                          reads as a statement about where views come from, which
                          is a different metric that can point the other way: a
                          Shorts-heavy publisher can still earn most of its
                          viewing on long-form. */}
                      <ProfileTag label="Upload mix" value={profile.formatMix} />
                      <ProfileTag label="Conversion" value={profile.conversion} />
                      <ProfileTag label="Momentum" value={profile.momentum} />
                    </div>

                    {/* Fix this week */}
                    <div className="flex items-start gap-2 ml-auto text-[11px] leading-snug max-w-[360px]">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-ink/30 shrink-0 mt-px">Fix</span>
                      <span className="text-ink/60">{fix}</span>
                    </div>
                  </div>

                  {/* ── VIEWING MIX — recent only ────────────────────────
                      This strip answers "where is viewing coming from NOW".
                      Lifetime totals and the coverage caveat used to sit
                      here and have been removed: they are a different
                      question, they were the longest thing in the strip,
                      and a lifetime figure this close to the upload-mix
                      badge invited averaging two unrelated measures into
                      one impression. Lifetime now appears only in the
                      expanded format analysis on the artist page and in
                      Channel Behaviour, where there is room to qualify it.

                      So there are exactly two states here: a real recent
                      split, or a short line saying how far off one is. */}
                  {r.formatSplit && (
                    <div className="mt-3 pt-2 text-[10px] leading-relaxed text-ink/45" style={{ borderTop: '1px solid #EFE9DC' }}>
                      {r.formatSplit.basis === 'recent' ? (
                        <>
                          <b className="text-ink/60">Viewing mix, last {r.formatSplit.windowDays} days:</b>{' '}
                          {fmtNum(r.formatSplit.longformViews)} long-form · {fmtNum(r.formatSplit.shortsViews)} Shorts
                          {' '}— view gains on videos we hold, matched across consecutive daily readings.
                        </>
                      ) : (
                        <>
                          <b className="text-ink/60">Viewing mix:</b>{' '}
                          {r.formatSplit.collecting && r.formatSplit.collecting.total === 0
                            ? 'not collecting yet — no daily readings stored for this channel.'
                            : `collecting — ${r.formatSplit.collecting?.comparable ?? 0} of ${r.formatSplit.collecting?.required ?? 6} comparable daily readings.`}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-meta text-muted">
            {search
              ? <>No artists matching &ldquo;{search}&rdquo;</>
              : 'No channels in this group.'}
          </div>
        )}
      </div>

      {/* ─── WEEKLY INTELLIGENCE ───────────────────────────────────────
          The roster is what this page is for, so it leads. These read
          off it — what moved, what is performing, who is most consistent
          — and a reader who wants them has already found what they came
          for. They used to sit between the health figures and the table,
          which put four screens of reading in front of the list. */}
      <div className="mt-12 mb-8 border-t border-line" />

      {/* ─── MANAGED VIEW: What Changed This Week ──────────────────────── */}
      {view === 'managed' && insights.length > 0 && (
        <div className="mb-8">
          <SectionHead title="What changed this week" meta={`${insights.length} signals`} />
          {/* Same surface as the health figures. These sections were sitting
              on the page background with only a rule above them, so a long
              board read as one undifferentiated column — the card is what
              tells you where one answer ends and the next begins. */}
          <div className="bg-surface border border-line rounded-card divide-y divide-line-faint">
            {insights.map((ins, i) => {
              const ic = INSIGHT_ICON[ins.tone];
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-5 py-3 text-body leading-snug"
                  style={{ color: ic.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: ic.dot }} />
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
          <div className="mb-8">
            <SectionHead title="Top performing videos" meta="Last 14 days, by daily velocity" />
            <div className="bg-surface border border-line rounded-card p-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:divide-x divide-line">
              {/* Long-form column */}
              {topLongform.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-eyebrow text-muted mb-2.5">Long-form</div>
                  <div className="space-y-2">
                    {topLongform.map((v, i) => (
                      <VideoRow key={v.videoId} v={v} rank={i + 1} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
                    ))}
                  </div>
                </div>
              )}
              {/* Shorts column */}
              {topShorts.length > 0 && (
                <div className="lg:pl-6">
                  <div className="text-[11px] font-bold uppercase tracking-eyebrow text-muted mb-2.5">Shorts</div>
                  <div className="space-y-2">
                    {topShorts.map((v, i) => (
                      <VideoRow key={v.videoId} v={v} rank={i + 1} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
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
        <div className="mb-8">
          <button
            onClick={() => setMoversOpen(!moversOpen)}
            aria-expanded={moversOpen}
            className="w-full flex items-end justify-between gap-4 text-left pb-2.5 mb-4 border-b border-line group"
          >
            <span className="text-h4 font-extrabold text-ink">Top movers</span>
            <span className="text-micro font-semibold text-muted group-hover:text-ink transition-colors">
              {moversOpen ? 'Hide' : 'Show'}
            </span>
          </button>
          {moversOpen && (
            <div className="bg-surface border border-line rounded-card p-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
              <MoverColumn title="Views Gainers (7d)" items={topMovers.topViews} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
              <MoverColumn title="Sub Gainers (7d)" items={topMovers.topSubs} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
              <MoverColumn title="Biggest Decline" items={topMovers.biggestDecline} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
              <MoverColumn title="Cadence Risk" items={topMovers.cadenceRisk} linkPrefix={linkPrefix} linkSuffix={linkSuffix} />
            </div>
          )}
        </div>
      )}

      {/* ─── MARKET VIEW: Market Benchmark Read ────────────────────────── */}
      {view === 'market' && benchmarkRead && (
        <div className="mb-8">
          <SectionHead title="Market benchmark read" />
          <div className="bg-surface border border-line rounded-card overflow-hidden">

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 lg:grid-cols-4">
            {benchmarkRead.stats.map((stat, i) => (
              <div key={i}>
                <div className="text-h3 font-black tabular-nums">{stat.value}</div>
                <div className="text-micro text-muted leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Content format breakdown */}
          {marketFormatStats && marketFormatStats.totalUploads > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 border-t border-line lg:grid-cols-4">
              <div>
                <div className="text-h3 font-black tabular-nums">{marketFormatStats.longformCount}</div>
                <div className="text-micro text-muted leading-snug">Long-form uploads (30d)</div>
              </div>
              <div>
                <div className="text-h3 font-black tabular-nums">{fmtNum(marketFormatStats.longformViews)}</div>
                <div className="text-micro text-muted leading-snug">Long-form views</div>
              </div>
              <div>
                <div className="text-h3 font-black tabular-nums">
                  {marketFormatStats.totalUploads > 0
                    ? `${Math.round((marketFormatStats.longformCount / marketFormatStats.totalUploads) * 100)}%`
                    : '—'}
                </div>
                <div className="text-micro text-muted leading-snug">Long-form share</div>
              </div>
              <div>
                <div className="text-h3 font-black tabular-nums">{marketFormatStats.activeArtists}</div>
                <div className="text-micro text-muted leading-snug">Artists uploading (30d)</div>
              </div>
            </div>
          )}

          {/* Patterns — the read, in the tinted footer the other cards use */}
          {(benchmarkRead.winning || benchmarkRead.weakness) && (
            <div className="space-y-1.5 px-5 py-3 border-t border-line bg-raised/50">
              {benchmarkRead.winning && (
                <div className="flex items-start gap-2 text-body leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: '#1FBE7A' }} />
                  <span style={{ color: '#0C6A3F' }}>{benchmarkRead.winning}</span>
                </div>
              )}
              {benchmarkRead.weakness && (
                <div className="flex items-start gap-2 text-body leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: '#F08A3C' }} />
                  <span style={{ color: '#8A4A1A' }}>{benchmarkRead.weakness}</span>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ─── BEST IN CLASS: Consistency Leaders ──────────────────────── */}
      {consistencyLeaders.length > 0 && (
        <div className="mb-8">
          <SectionHead title="Best in class" meta="Highest sustained upload cadence, last 30 days" />
          <div className="bg-surface border border-line rounded-card overflow-hidden">
          <div className="divide-y divide-line-faint">
            {consistencyLeaders.map((c, i) => {
              const st = STATUS_STYLE[c.status];
              return (
                <div key={c.slug} className="flex items-center gap-3 px-5 py-2.5 text-body">
                  <span className="text-faint text-micro font-bold tabular-nums w-4 shrink-0">{i + 1}.</span>
                  <Link
                    href={`${linkPrefix}/${c.slug}${linkSuffix}`}
                    className="font-bold hover:underline min-w-0 truncate"
                    style={{ color: INK, textDecoration: 'none' }}
                  >
                    {c.name}
                  </Link>
                  <span
                    className="px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-label shrink-0"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {STATE_LABEL[c.status]}
                  </span>
                  <span className="text-micro shrink-0 ml-auto tabular-nums">
                    <span className="font-black text-ink">{c.uploads30d}</span>
                    <span className="text-muted"> uploads</span>
                  </span>
                  <span className="text-micro text-muted shrink-0 hidden sm:inline tabular-nums">
                    {c.formatLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-line bg-raised/50 text-micro text-muted leading-snug">
            {view === 'managed'
              ? 'Channels with the highest sustained upload cadence over the last 30 days.'
              : 'Market artists leading on content consistency — benchmark for cadence targets.'}
          </div>
          </div>
        </div>
      )}

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

// ── Multiformat Strategy Cell ─────────────────────────────────────────────

const FORMAT_DOTS: { key: string; label: string; color: string }[] = [
  { key: 'hasShorts',        label: 'S',  color: '#7C3AED' }, // Shorts — purple
  { key: 'hasOfficialVideo', label: 'V',  color: '#DC2626' }, // Official Video — red
  { key: 'hasLyricVideo',    label: 'L',  color: '#2563EB' }, // Lyric Video — blue
  { key: 'hasVisualizer',    label: 'Vz', color: '#059669' }, // Visualizer — green
  { key: 'hasBTS',           label: 'B',  color: '#D97706' }, // BTS — amber
  { key: 'hasLiveSession',   label: 'Li', color: '#0891B2' }, // Live Session — cyan
];

const MF_SCORE_STYLE: Record<string, { bg: string; fg: string }> = {
  Strong:  { bg: '#E6F8EE', fg: '#0C6A3F' },
  Good:    { bg: '#EEF2FF', fg: '#4338CA' },
  Partial: { bg: '#FFF5D6', fg: '#7A5A00' },
  Weak:    { bg: '#FFE2D8', fg: '#8A1F0C' },
  None:    { bg: '#F3F0EA', fg: 'rgba(14,14,14,0.35)' },
};

/* ── The view split, inside the Formats column ─────────────────────────
   The column already answers "which formats is this channel making?".
   This adds "and which ones are actually being watched?" beneath it —
   the same question one level deeper, so it belongs in the same cell
   rather than in a column of its own.

   Two things must survive being this small. First, the basis: a 7-day
   figure and a lifetime figure look identical once they are two numbers
   in a row, so the badge naming the basis is not decoration and is
   never omitted. Second, coverage: on a lifetime split that describes a
   fraction of the catalogue, the percentage sits next to the basis,
   amber, where it cannot be read as a channel fact. */
const SPLIT_LF = '#2C6BFF';
const SPLIT_SH = '#C77A16';

function pcTight(x: number): string {
  if (x <= 0) return '0';
  if (x < 0.01) return '<1';
  return String(Math.round(x * 100));
}
function pcCoverage(x: number | null): string {
  if (x == null) return '—';
  if (x <= 0) return '0%';
  if (x < 0.01) return '<1%';
  if (x < 0.1) return `${(x * 100).toFixed(1)}%`;
  return `${Math.round(x * 100)}%`;
}

function ViewSplitLine({ split }: { split: NonNullable<RowData['formatSplit']> }) {
  const recent = split.basis === 'recent';
  const sample = !recent && split.confidence === 'sample';

  const tooltip = recent
    ? `${fmtNum(split.longformViews + split.shortsViews)} views gained in the last ${split.windowDays} days\n` +
      `${fmtNum(split.longformViews)} long-form (${pcTight(split.longformShare)}%) · ` +
      `${fmtNum(split.shortsViews)} Shorts (${pcTight(split.shortsShare)}%)\n` +
      `From daily readings, counted only on videos present in both readings.`
    : `LIFETIME split — not recent viewing.\n` +
      `${pcTight(split.longformShare)}% long-form · ${pcTight(split.shortsShare)}% Shorts\n` +
      `Across ${pcCoverage(split.viewsCovered)} of channel lifetime views that we hold.\n` +
      (split.collecting
        ? `Recent 7-day figure needs ${split.collecting.required} comparable daily readings; ${split.collecting.comparable} so far.`
        : '');

  return (
    <div className="flex items-center gap-1.5 mt-1" title={tooltip}>
      <div
        className="flex h-[3px] w-[34px] overflow-hidden rounded-sm shrink-0"
        style={{ background: '#E9E2D3' }}
      >
        <div style={{ width: `${split.longformShare * 100}%`, background: SPLIT_LF, opacity: recent ? 1 : 0.5 }} />
        <div style={{ width: `${split.shortsShare * 100}%`, background: SPLIT_SH, opacity: recent ? 1 : 0.5 }} />
      </div>
      {/* On a recent basis the views GAINED lead, because that is the
          thing the row is actually reporting — the percentages explain
          where it came from. On a lifetime basis there is no such number
          to show: the totals describe years of catalogue, not a period,
          and putting one here would be read as this week's. */}
      {recent && (
        <span className="text-[8px] font-bold tabular-nums whitespace-nowrap" style={{ color: '#0C6A3F' }}>
          +{fmtNum(split.longformViews + split.shortsViews)}
        </span>
      )}
      {/* Amber carries the low-coverage warning that used to ride on the
          badge's colour. A lifetime split computed from under a fifth of
          a channel's views is the one figure here that can actively
          mislead, so losing the badge must not lose the caveat with it —
          it moves onto the number it is a caveat about. */}
      <span
        className="text-[8px] tabular-nums whitespace-nowrap"
        style={{ color: recent ? 'rgba(14,14,14,0.5)' : sample ? '#9A5B00' : 'rgba(14,14,14,0.38)' }}
      >
        {pcTight(split.longformShare)}/{pcTight(split.shortsShare)}
      </span>
      {/* ── LABEL THE EXCEPTION, NOT THE NORM ─────────────────────────
          The coverage percentage moved to the tooltip a while back; the
          basis word stayed, on the reasoning that without it a lifetime
          split and a 7-day one are indistinguishable at this size.

          True, but it labelled the wrong one. Most channels do not yet
          have two comparable daily readings, so "LIFE" printed on nearly
          every row of a 121-row table — a word repeated that often stops
          being read and becomes texture, while the rows that genuinely
          differ were the ones in the minority.

          So only "7d" is marked. Lifetime is the unlabelled default and
          stays distinguishable three other ways: a half-opacity bar,
          lighter percentages, and no green gained-views figure in front
          of them. The tooltip still opens with "LIFETIME split — not
          recent viewing" for anyone who needs it spelled out. */}
      {recent && (
        <span
          className="text-[7px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
          style={{ color: '#0C6A3F' }}
        >
          7d
        </span>
      )}
    </div>
  );
}

function MultiformatCell({
  multiformat,
  formatSplit,
}: {
  multiformat?: RowData['multiformat'];
  formatSplit?: RowData['formatSplit'];
}) {
  if (!multiformat) {
    return (
      <div>
        <div className="text-[9px] text-ink/20">—</div>
        {formatSplit && <ViewSplitLine split={formatSplit} />}
      </div>
    );
  }

  const st = MF_SCORE_STYLE[multiformat.score] ?? MF_SCORE_STYLE.None;
  const activeFormats = FORMAT_DOTS.filter((f) => (multiformat as Record<string, unknown>)[f.key]);
  const tooltipParts = FORMAT_DOTS.map(
    (f) => `${(multiformat as Record<string, unknown>)[f.key] ? '●' : '○'} ${f.label === 'S' ? 'Shorts' : f.label === 'V' ? 'Official Video' : f.label === 'L' ? 'Lyric Video' : f.label === 'Vz' ? 'Visualizer' : f.label === 'B' ? 'BTS' : 'Live Session'}`
  );
  const tooltip = `${multiformat.score} multiformat (${multiformat.formatCount}/6)\n${tooltipParts.join('\n')}`;

  return (
    <div>
      {/* Publishing mix — unchanged: the score chip and the coloured
          per-format dots stay exactly as they were. */}
      <div className="flex items-center gap-1.5" title={tooltip}>
        <span
          className="text-[8px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{ background: st.bg, color: st.fg }}
        >
          {multiformat.formatCount}/6
        </span>
        <div className="flex gap-0.5">
          {activeFormats.map((f) => (
            <span
              key={f.key}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: f.color }}
            />
          ))}
        </div>
      </div>
      {/* Viewing mix — what those formats actually earn. */}
      {formatSplit && <ViewSplitLine split={formatSplit} />}
    </div>
  );
}

/* linkSuffix matters as much as linkPrefix here. On a team board the prefix
   is /team/australia and the suffix carries the access token — dropping it
   produced /team/australia/<slug> with no key, which the route answers with
   notFound(). Every name in these columns was a 404 for that team. */
function MoverColumn({ title, items, linkPrefix = '/watcher', linkSuffix = '' }:
  { title: string; items: MoverEntry[]; linkPrefix?: string; linkSuffix?: string }) {
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
            <Link href={`${linkPrefix}/${item.slug}${linkSuffix}`} className="truncate text-ink/60 hover:underline">
              {i + 1}. {item.name}
            </Link>
            <span className="tabular-nums font-bold text-ink/50 shrink-0">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoRow({ v, rank, linkPrefix, linkSuffix = '' }:
  { v: TopVideo; rank: number; linkPrefix: string; linkSuffix?: string }) {
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
          <Link href={`${linkPrefix}/${v.artistSlug}${linkSuffix}`} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>
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


// ─── Quick Copy Buttons (Slack/Email from RowData) ──────────────────────────

function buildQuickUpdate(r: RowData, type: 'slack' | 'email'): string {
  const lines: string[] = [];
  if (type === 'email') {
    lines.push('Hi all,');
    lines.push('');
  }
  lines.push(`Quick ${r.name} YouTube update:`);
  lines.push('');

  // Gather insights — prioritised
  type Insight = { p: number; t: string };
  const pool: Insight[] = [];

  if (r.views7Delta != null && r.views7Delta > 0) {
    pool.push({ p: 8, t: `${fmtDelta(r.views7Delta)} channel views in the last 7 days` });
  }
  if (r.subs7Delta != null && r.subs7Delta > 0) {
    pool.push({ p: 7, t: `${fmtDelta(r.subs7Delta)} subscribers in the last 7 days` });
  }
  if (r.subs7Delta != null && r.subs7Delta <= 0 && r.views7Delta != null && r.views7Delta > 5000) {
    pool.push({ p: 6, t: 'Views are climbing but subscribers are flat — audience is watching without committing' });
  }
  if (r.uploads30d >= 8) {
    const sn = r.shorts30d > 0 ? `, including ${r.shorts30d} Shorts` : '';
    pool.push({ p: 5, t: `Excellent publishing cadence with ${r.uploads30d} uploads in 30 days${sn}` });
  } else if (r.uploads30d >= 4) {
    const sn = r.shorts30d > 0 ? `, including ${r.shorts30d} Shorts` : '';
    pool.push({ p: 5, t: `Good publishing cadence with ${r.uploads30d} uploads in 30 days${sn}` });
  } else if (r.uploads30d <= 2 && r.uploads30d > 0) {
    pool.push({ p: 5, t: `Only ${r.uploads30d} upload${r.uploads30d !== 1 ? 's' : ''} in 30 days — below the threshold for consistent algorithmic push` });
  }
  if (r.views7Delta != null && r.views7Delta > 50000 && r.uploads30d >= 4) {
    pool.push({ p: 4, t: 'Strong view volume with consistent uploads — YouTube is likely actively recommending the channel' });
  }
  if (r.viewsWoW != null && r.viewsWoW > 20) {
    pool.push({ p: 3, t: `Views up ${Math.round(r.viewsWoW)}% week-on-week — momentum is accelerating` });
  }
  if (r.viewsWoW != null && r.viewsWoW < -20) {
    pool.push({ p: 3, t: `Views down ${Math.abs(Math.round(r.viewsWoW))}% week-on-week — momentum is fading` });
  }
  if (r.multiformat) {
    if (r.multiformat.score === 'Strong') {
      pool.push({ p: 2, t: `Strong multiformat strategy — ${r.multiformat.formatCount} of 6 format types active` });
    } else if (r.multiformat.score === 'Weak' || r.multiformat.score === 'None') {
      pool.push({ p: 2, t: `Weak multiformat coverage (${r.multiformat.formatCount}/6) — limited discovery surfaces` });
    }
  }

  pool.sort((a, b) => b.p - a.p);
  const bullets = pool.slice(0, 5).map(i => i.t);

  // Ensure at least one bullet
  if (bullets.length === 0) {
    bullets.push('Channel tracking established — monitoring for movement');
  }

  for (const b of bullets) lines.push(`• ${b}`);
  lines.push('');

  // Recommendation
  lines.push('Recommendation');
  if (r.classification === 'GROWING' || r.status === 'HEALTHY') {
    lines.push('Maintain the current upload rhythm and continue stacking content while momentum is positive.');
  } else if (r.classification === 'WEAK_CONVERSION') {
    lines.push('Views are landing but subscribers aren\'t following. Prioritise a behind-the-scenes or artist story piece that gives viewers a reason to subscribe.');
  } else if (r.classification === 'UNDERFED') {
    lines.push('Upload cadence is too low. Ship 2–3 Shorts this week to build consistent signal for the algorithm.');
  } else if (r.classification === 'COLD' || r.status === 'COLD') {
    lines.push('Channel is cold — reactivate with 2–3 catalogue Shorts to generate signal before any campaign content will distribute.');
  } else {
    lines.push('Increase upload frequency and prioritise Shorts alongside any long-form releases to build consistent algorithmic signal.');
  }

  return lines.join('\n');
}

function QuickCopyButton({ row, type }: { row: RowData; type: 'slack' | 'email' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildQuickUpdate(row, type);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [row, type]);

  const label = type === 'slack' ? 'Slack' : 'Email';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopy(); }}
      className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer"
      style={{
        background: copied ? '#E6F8EE' : '#F6F1E7',
        color: copied ? '#0C6A3F' : 'rgba(14,14,14,0.55)',
        border: 'none',
      }}
    >
      {copied ? 'Copied' : `${label} Update`}
    </button>
  );
}
