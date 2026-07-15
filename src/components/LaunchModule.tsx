'use client';

import { useState, useMemo } from 'react';

// ─── Design system ─────────────────────────────────────────────────────────
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ─── Types ─────────────────────────────────────────────────────────────────
export type LaunchVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  kind: 'short' | 'video';
  views: number;
  likes: number;
  comments: number;
};

export type LaunchModuleProps = {
  recentUploads: LaunchVideo[];
  uploads30d: number;
  shorts14d: number;
  daysSinceLastUpload: number | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  viewHistory: { x: number; y: number }[];
};

// ─── Content type ──────────────────────────────────────────────────────────
export type LaunchContentType =
  | 'OFFICIAL_VIDEO' | 'LYRIC_VIDEO' | 'VISUALIZER'
  | 'BTS' | 'LIVE' | 'SHORT' | 'OTHER';

const CONTENT_TYPE_LABEL: Record<LaunchContentType, string> = {
  OFFICIAL_VIDEO: 'Official Video', LYRIC_VIDEO: 'Lyric Video',
  VISUALIZER: 'Visualizer', BTS: 'BTS', LIVE: 'Live',
  SHORT: 'Short', OTHER: 'Video',
};

export function classifyLaunchType(title: string, kind: 'short' | 'video'): LaunchContentType {
  if (kind === 'short') return 'SHORT';
  const t = title.toLowerCase();
  if (/\b(official\s*(music\s*)?video)\b/.test(t) || /\(official\)/.test(t) || /\bmusic\s*video\b/.test(t)) return 'OFFICIAL_VIDEO';
  if (/\b(lyric\s*(video)?|lyrics?\s*video)\b/.test(t)) return 'LYRIC_VIDEO';
  if (/\b(visuali[sz]er|official\s*visuali[sz]er)\b/.test(t)) return 'VISUALIZER';
  if (/\b(behind\s*the\s*scenes|bts)\b/.test(t)) return 'BTS';
  if (/\b(live\s*(at|from|in|session|performance)|tiny\s*desk|concert)\b/.test(t)) return 'LIVE';
  if (/\bsession\b/.test(t)) return 'LIVE';
  if (/\b(official\s*audio)\b/.test(t)) return 'OFFICIAL_VIDEO';
  return 'OTHER';
}

function isSupportContent(ct: LaunchContentType): boolean {
  return ct === 'BTS' || ct === 'LIVE' || ct === 'VISUALIZER';
}

// ─── Internal state types ──────────────────────────────────────────────────
type LaunchState = 'STRONG' | 'BUILDING' | 'MIXED' | 'WEAK';
type PreLaunchState = 'HOT' | 'WARM' | 'COLD';
type MomentumState = 'ACCELERATING' | 'SUSTAINING' | 'DECAYING' | 'BUILDING';

// ─── Display state (what the user sees) ────────────────────────────────────
type DisplayStatus = 'Strong launch' | 'Building' | 'Mixed signals' | 'Too early' | 'Weak';

function toDisplayStatus(state: LaunchState, tooEarly: boolean): DisplayStatus {
  if (tooEarly) return 'Too early';
  switch (state) {
    case 'STRONG': return 'Strong launch';
    case 'BUILDING': return 'Building';
    case 'MIXED': return 'Mixed signals';
    case 'WEAK': return 'Weak';
  }
}

const DISPLAY_STYLE: Record<DisplayStatus, { bg: string; fg: string; dot: string }> = {
  'Strong launch': { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  'Building':      { bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
  'Mixed signals': { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'Too early':     { bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
  'Weak':          { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
};

// ─── Signal tags (simple human labels) ─────────────────────────────────────
type SignalLevel = 'High' | 'Medium' | 'Low' | 'Strong' | 'Average' | 'Weak' | 'Early' | 'Insufficient data';

function reachSignal(metrics: LaunchMetrics, tooEarly: boolean): SignalLevel {
  if (tooEarly) return 'Early';
  if (!metrics.velocityAvailable) return 'Early';
  if (metrics.velocityMultiple != null && metrics.velocityMultiple >= 2) return 'High';
  if (metrics.velocityMultiple != null && metrics.velocityMultiple >= 1) return 'Medium';
  return 'Low';
}

function engagementSignal(metrics: LaunchMetrics): SignalLevel {
  if (metrics.engagement == null) return 'Early';
  if (metrics.engagement >= 5) return 'Strong';
  if (metrics.engagement >= 2) return 'Average';
  return 'Weak';
}

function conversionSignal(metrics: LaunchMetrics): SignalLevel {
  if (metrics.conversionInsufficient) return 'Insufficient data';
  if (metrics.conversion == null) return 'Insufficient data';
  if (metrics.conversion >= 1) return 'Strong';
  return 'Weak';
}

const SIGNAL_COLOR: Record<SignalLevel, string> = {
  High:   '#0C6A3F', Medium: '#7A5A00', Low: '#8A1F0C',
  Strong: '#0C6A3F', Average: '#7A5A00', Weak: '#8A1F0C',
  Early:  '#8A8A8A', 'Insufficient data': '#8A8A8A',
};

// ─── Summary sentence generation ───────────────────────────────────────────

function generateSummary(
  status: DisplayStatus,
  metrics: LaunchMetrics,
  contentType: LaunchContentType,
  launchHours: number,
): string {
  const support = isSupportContent(contentType);
  const strongEng = metrics.engagement != null && metrics.engagement > 5;
  const weakEng = metrics.engagement != null && metrics.engagement < 2;
  const strongVel = metrics.velocityAvailable && metrics.velocityMultiple != null && metrics.velocityMultiple > 2;
  const weakVel = metrics.velocityAvailable && metrics.velocityMultiple != null && metrics.velocityMultiple < 1;

  if (status === 'Too early') {
    if (strongEng) return 'Good early engagement — check back after 72h for a full read.';
    return 'Too early to judge — check back after 72h.';
  }

  if (status === 'Strong launch') {
    return 'Strong start — scaling faster than usual.';
  }

  if (status === 'Mixed signals') {
    if (support && strongEng) return 'Good engagement on support content — reach is still building.';
    if (weakVel && strongEng) return 'High engagement but low reach — packaging or distribution may need attention.';
    if (metrics.conversionInsufficient) return 'People are watching and reacting, but conversion needs more time.';
    return 'Some signals are healthy, others need attention.';
  }

  if (status === 'Building') {
    if (support) return 'Support content gaining traction — too early for a definitive read.';
    if (!metrics.velocityAvailable) return 'No benchmark available for this content type yet — tracking engagement only.';
    return 'Launch is in progress — signals are modest but not concerning.';
  }

  // Weak
  if (weakEng && weakVel) return 'Low reach and weak engagement — review thumbnail, title, and distribution.';
  return 'Underperforming against benchmarks — review packaging and promotion.';
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysSincePublish(publishedAt: string): number {
  return Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000);
}
function hoursSincePublish(publishedAt: string): number {
  return Math.floor((Date.now() - new Date(publishedAt).getTime()) / 3600000);
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}
function fmtPct(n: number): string {
  if (n >= 100) return Math.round(n) + '%';
  if (n >= 10) return n.toFixed(1) + '%';
  return n.toFixed(2) + '%';
}
function findLaunchVideo(uploads: LaunchVideo[]): LaunchVideo | null {
  const candidates = uploads
    .filter((u) => u.kind === 'video' && daysSincePublish(u.publishedAt) <= 10)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return candidates[0] ?? null;
}

function fmtHoursAgo(hours: number): string {
  if (hours < 24) return `${hours}h since upload`;
  return `${Math.floor(hours / 24)}d since upload`;
}

// ─── Baseline (all logic preserved) ────────────────────────────────────────

type BaselineResult = { median: number; count: number; available: boolean; label: string };

function computeTypeAwareBaseline(
  uploads: LaunchVideo[], launchId: string, launchType: LaunchContentType,
): BaselineResult {
  const others = uploads.filter((u) => u.kind === 'video' && u.videoId !== launchId && u.views > 0);
  const typePool = (types: LaunchContentType[]) =>
    others.filter((u) => types.includes(classifyLaunchType(u.title, u.kind)));
  const median = (arr: LaunchVideo[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a.views - b.views);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1].views + sorted[mid].views) / 2) : sorted[mid].views;
  };
  switch (launchType) {
    case 'OFFICIAL_VIDEO': {
      const pool = others;
      return pool.length > 0
        ? { median: median(pool), count: pool.length, available: true, label: 'channel baseline' }
        : { median: 0, count: 0, available: false, label: 'no baseline data' };
    }
    case 'LYRIC_VIDEO': {
      const pool = typePool(['LYRIC_VIDEO']);
      if (pool.length >= 2) return { median: median(pool), count: pool.length, available: true, label: 'lyric video baseline' };
      return others.length > 0
        ? { median: median(others), count: others.length, available: true, label: 'channel baseline' }
        : { median: 0, count: 0, available: false, label: 'no baseline data' };
    }
    case 'VISUALIZER': {
      const pool = typePool(['VISUALIZER']);
      if (pool.length >= 2) return { median: median(pool), count: pool.length, available: true, label: 'visualizer baseline' };
      const supportPool = typePool(['VISUALIZER', 'LYRIC_VIDEO', 'BTS']);
      if (supportPool.length >= 2) return { median: median(supportPool), count: supportPool.length, available: true, label: 'support content baseline' };
      return others.length > 0
        ? { median: median(others), count: others.length, available: true, label: 'channel baseline' }
        : { median: 0, count: 0, available: false, label: 'no baseline data' };
    }
    case 'BTS': {
      const pool = typePool(['BTS']);
      if (pool.length >= 2) return { median: median(pool), count: pool.length, available: true, label: 'BTS baseline' };
      const supportPool = typePool(['BTS', 'VISUALIZER', 'LIVE']);
      if (supportPool.length >= 2) return { median: median(supportPool), count: supportPool.length, available: true, label: 'support content baseline' };
      return { median: 0, count: 0, available: false, label: 'support content benchmark unavailable' };
    }
    case 'LIVE': {
      const pool = typePool(['LIVE']);
      if (pool.length >= 2) return { median: median(pool), count: pool.length, available: true, label: 'live performance baseline' };
      return others.length > 0
        ? { median: median(others), count: others.length, available: true, label: 'channel baseline' }
        : { median: 0, count: 0, available: false, label: 'no baseline data' };
    }
    default: {
      return others.length > 0
        ? { median: median(others), count: others.length, available: true, label: 'channel baseline' }
        : { median: 0, count: 0, available: false, label: 'no baseline data' };
    }
  }
}

// ─── Pre-Launch (preserved) ────────────────────────────────────────────────

function computePreLaunch(
  uploads30d: number, shorts14d: number, daysSinceLastUpload: number | null,
): { state: PreLaunchState; signals: boolean[]; labels: string[] } {
  const s1 = uploads30d > 5;
  const s2 = shorts14d > 5;
  const s3 = daysSinceLastUpload != null && daysSinceLastUpload < 7;
  const signals = [s1, s2, s3];
  const labels = [
    `${uploads30d} uploads / 30d${s1 ? ' ✓' : ''}`,
    `${shorts14d} shorts / 14d${s2 ? ' ✓' : ''}`,
    daysSinceLastUpload != null
      ? `${daysSinceLastUpload}d since last upload${s3 ? ' ✓' : ''}` : 'No upload date',
  ];
  const count = signals.filter(Boolean).length;
  const state: PreLaunchState = count >= 3 ? 'HOT' : count >= 2 ? 'WARM' : 'COLD';
  return { state, signals, labels };
}

// ─── Launch metrics (preserved) ────────────────────────────────────────────

type LaunchMetrics = {
  velocity: number | null;
  velocityMultiple: number | null;
  velocityAvailable: boolean;
  engagement: number | null;
  conversion: number | null;
  conversionInsufficient: boolean;
  baseline: BaselineResult;
};

function computeLaunchMetrics(
  launch: LaunchVideo, uploads: LaunchVideo[],
  subs7Delta: number | null, views7Delta: number | null,
  contentType: LaunchContentType,
): LaunchMetrics {
  const baseline = computeTypeAwareBaseline(uploads, launch.videoId, contentType);
  const velocityAvailable = baseline.available && baseline.median > 0;
  const velocity = velocityAvailable ? (launch.views / baseline.median) * 100 : null;
  const velocityMultiple = velocityAvailable ? launch.views / baseline.median : null;
  const engagement = launch.views > 0
    ? ((launch.likes + launch.comments) / launch.views) * 100 : null;
  const launchHours = hoursSincePublish(launch.publishedAt);
  const conversionInsufficient = launch.views < 10000 || launchHours < 72;
  const conversion = !conversionInsufficient && views7Delta != null && views7Delta > 0 && subs7Delta != null
    ? (subs7Delta / views7Delta) * 100 : null;
  return { velocity, velocityMultiple, velocityAvailable, engagement, conversion, conversionInsufficient, baseline };
}

// ─── Launch state derivation (preserved) ───────────────────────────────────

function deriveLaunchState(
  metrics: LaunchMetrics, contentType: LaunchContentType,
  launchHours: number, preLaunch: { state: PreLaunchState },
): LaunchState {
  const { velocityMultiple, velocityAvailable, engagement, conversion, conversionInsufficient } = metrics;
  const support = isSupportContent(contentType);
  const strongEngagement = engagement != null && engagement > 5;
  const weakEngagement = engagement != null && engagement < 2;
  const strongConversion = conversion != null && conversion > 1;
  const weakConversion = !conversionInsufficient && conversion != null && conversion < 0.2;
  const strongVelocity = velocityAvailable && velocityMultiple != null && velocityMultiple > 2;
  const weakVelocity = velocityAvailable && velocityMultiple != null && velocityMultiple < 1;
  const modestVelocity = velocityAvailable && velocityMultiple != null && velocityMultiple >= 1 && velocityMultiple <= 2;
  const strongSignals = [strongEngagement, strongConversion].filter(Boolean).length;

  if (strongVelocity && strongSignals >= 1) return 'STRONG';
  if (launchHours < 72) {
    if (weakEngagement && weakVelocity) return 'WEAK';
    return 'BUILDING';
  }
  if (weakVelocity && strongEngagement) return 'MIXED';
  if (!velocityAvailable && strongEngagement) return 'MIXED';
  if (weakConversion && (preLaunch.state === 'HOT' || preLaunch.state === 'WARM')) return 'MIXED';
  if (support && !weakEngagement) return 'MIXED';
  if (modestVelocity) return 'BUILDING';
  if (!velocityAvailable && !weakEngagement) return 'BUILDING';
  if (support && !weakEngagement) return 'MIXED';
  if (weakVelocity && weakEngagement) return 'WEAK';
  if (weakVelocity && weakConversion) return 'WEAK';
  return 'BUILDING';
}

// ─── Momentum (preserved) ──────────────────────────────────────────────────

type MomentumData = {
  state: MomentumState;
  week1Avg: number | null;
  week2Avg: number | null;
  week3Avg: number | null;
};

function computeMomentum(
  launch: LaunchVideo, viewHistory: { x: number; y: number }[],
): MomentumData {
  const publishTs = new Date(launch.publishedAt).getTime();
  const dayMs = 86400000;
  function avgForWeek(weekNum: number): number | null {
    const start = publishTs + (weekNum - 1) * 7 * dayMs;
    const end = publishTs + weekNum * 7 * dayMs;
    const points = viewHistory.filter((p) => p.x >= start && p.x < end);
    if (points.length === 0) return null;
    return points.reduce((sum, p) => sum + p.y, 0) / points.length;
  }
  const week1Avg = avgForWeek(1);
  const week2Avg = avgForWeek(2);
  const week3Avg = avgForWeek(3);
  let state: MomentumState = 'BUILDING';
  if (week1Avg != null && week2Avg != null && week1Avg > 0) {
    const ratio = week2Avg / week1Avg;
    if (ratio > 1.0) state = 'ACCELERATING';
    else if (ratio >= 0.7) state = 'SUSTAINING';
    else if (ratio < 0.5) state = 'DECAYING';
    else state = 'SUSTAINING';
  }
  return { state, week1Avg, week2Avg, week3Avg };
}

// ─── Preserved style maps (used in System 2) ──────────────────────────────

const LAUNCH_STYLE: Record<LaunchState, { bg: string; fg: string; dot: string }> = {
  STRONG:   { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  BUILDING: { bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
  MIXED:    { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  WEAK:     { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
};
const PRELAUNCH_STYLE: Record<PreLaunchState, { bg: string; fg: string; dot: string }> = {
  HOT:  { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  WARM: { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  COLD: { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
};
const MOMENTUM_STYLE: Record<MomentumState, { bg: string; fg: string; dot: string }> = {
  ACCELERATING: { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  SUSTAINING:   { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  DECAYING:     { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  BUILDING:     { bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
};

// ─── Launch window chart (System 2 only) ───────────────────────────────────

function LaunchWindowChart({ viewHistory, publishTs }: { viewHistory: { x: number; y: number }[]; publishTs: number }) {
  const dayMs = 86400000;
  const windowEnd = publishTs + 10 * dayMs;
  const windowPoints = viewHistory.filter((p) => p.x >= publishTs && p.x <= windowEnd).sort((a, b) => a.x - b.x);
  if (windowPoints.length < 2) return <div className="text-[10px] uppercase tracking-[0.14em] text-ink/35 py-4">Not enough daily data yet</div>;
  const W = 320; const H = 80; const pad = 4;
  const ys = windowPoints.map((p) => p.y);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const minX = windowPoints[0].x; const maxX = windowPoints[windowPoints.length - 1].x;
  const rangeX = maxX - minX || 1;
  const toX = (x: number) => pad + ((x - minX) / rangeX) * (W - pad * 2);
  const toY = (y: number) => H - pad - ((y - minY) / rangeY) * (H - pad * 2);
  const linePath = windowPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');
  const areaPath = `M${toX(windowPoints[0].x).toFixed(1)},${(H - pad).toFixed(1)} ` + windowPoints.map((p) => `L${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ') + ` L${toX(windowPoints[windowPoints.length - 1].x).toFixed(1)},${(H - pad).toFixed(1)} Z`;
  const markerDays = [1, 3, 7];
  const markers = markerDays.map((d) => {
    const targetTs = publishTs + d * dayMs;
    const closest = windowPoints.reduce((best, p) => Math.abs(p.x - targetTs) < Math.abs(best.x - targetTs) ? p : best);
    if (Math.abs(closest.x - targetTs) > dayMs) return null;
    return { day: d, x: toX(closest.x), y: toY(closest.y), views: closest.y };
  }).filter(Boolean) as { day: number; x: number; y: number; views: number }[];
  return (
    <div>
      <svg width={W} height={H + 18} viewBox={`0 0 ${W} ${H + 18}`}>
        <path d={areaPath} fill="rgba(44, 107, 255, 0.08)" stroke="none" />
        <path d={linePath} fill="none" stroke="#2C6BFF" strokeWidth={1.5} strokeLinejoin="round" />
        {markers.map((m) => (
          <g key={m.day}>
            <circle cx={m.x} cy={m.y} r={3} fill="#2C6BFF" />
            <text x={m.x} y={H + 12} textAnchor="middle" fill="rgba(14,14,14,0.4)" fontSize={9} fontWeight={700}>D{m.day}</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-3 mt-1">
        {markers.map((m) => <span key={m.day} className="text-[10px] tabular-nums text-ink/40">Day {m.day}: {fmtNum(m.views)}</span>)}
      </div>
    </div>
  );
}

// ─── Reusable sub-components ───────────────────────────────────────────────

function StateBadge({ label, style }: { label: string; style: { bg: string; fg: string; dot: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: style.bg, color: style.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {label}
    </span>
  );
}

function SignalTag({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ink/40">{label}:</span>
      <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function DetailMetricCell({ label, value, sub, color, muted }: {
  label: string; value: string; sub?: string | null; color?: string; muted?: boolean;
}) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">{label}</div>
      <div className="font-black text-lg tabular-nums mt-0.5" style={muted ? { color: 'rgba(14,14,14,0.25)' } : color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] tabular-nums mt-0.5" style={muted ? { color: 'rgba(14,14,14,0.25)' } : color ? { color } : { color: 'rgba(14,14,14,0.4)' }}>{sub}</div>}
    </div>
  );
}

function MomentumWeek({ label, value, compareBase }: { label: string; value: number | null; compareBase?: number | null }) {
  const pct = value != null && compareBase != null && compareBase > 0 ? ((value / compareBase) * 100).toFixed(0) + '%' : null;
  const pctColor = value != null && compareBase != null && compareBase > 0 ? (value / compareBase >= 0.7 ? '#0C6A3F' : '#8A1F0C') : undefined;
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: SOFT, border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">{label}</div>
      <div className="font-black text-[15px] tabular-nums mt-0.5">{value != null ? fmtNum(Math.round(value)) : '—'}</div>
      {pct && <div className="text-[10px] tabular-nums mt-0.5" style={{ color: pctColor }}>{pct} of wk1</div>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LaunchModule({
  recentUploads, uploads30d, shorts14d, daysSinceLastUpload,
  subs7Delta, views7Delta, viewHistory,
}: LaunchModuleProps) {
  const [expanded, setExpanded] = useState(false);

  const launch = useMemo(() => findLaunchVideo(recentUploads), [recentUploads]);
  if (!launch) return null;

  const launchHours = hoursSincePublish(launch.publishedAt);
  const contentType = classifyLaunchType(launch.title, launch.kind);
  const typeLabel = CONTENT_TYPE_LABEL[contentType];

  // ── All computation (preserved) ──────────────────────────────────────────
  const metrics = computeLaunchMetrics(launch, recentUploads, subs7Delta, views7Delta, contentType);
  const preLaunch = computePreLaunch(uploads30d, shorts14d, daysSinceLastUpload);
  const launchState = deriveLaunchState(metrics, contentType, launchHours, preLaunch);
  const momentum = computeMomentum(launch, viewHistory);
  const publishTs = new Date(launch.publishedAt).getTime();

  // ── Display layer ────────────────────────────────────────────────────────
  const tooEarly = launchHours < 72 || launch.views < 10000;
  const displayStatus = toDisplayStatus(launchState, tooEarly);
  const dStyle = DISPLAY_STYLE[displayStatus];
  const summary = generateSummary(displayStatus, metrics, contentType, launchHours);

  const reach = reachSignal(metrics, tooEarly);
  const eng = engagementSignal(metrics);
  const conv = conversionSignal(metrics);

  // ── System 2 metric values (only shown when expanded) ────────────────────
  const velocityLabel = metrics.velocityAvailable && metrics.velocityMultiple != null
    ? `${metrics.velocityMultiple.toFixed(1)}x` : '—';
  const velocitySubLabel = metrics.velocityAvailable ? `vs ${metrics.baseline.label}` : metrics.baseline.label;
  const velocityColor = metrics.velocityAvailable && metrics.velocityMultiple != null
    ? (metrics.velocityMultiple >= 2 ? '#0C6A3F' : metrics.velocityMultiple >= 1 ? '#7A5A00' : '#8A1F0C') : undefined;
  const engagementLabel = metrics.engagement != null ? fmtPct(metrics.engagement) : '—';
  const engagementColor = metrics.engagement != null
    ? (metrics.engagement >= 5 ? '#0C6A3F' : metrics.engagement >= 2 ? '#7A5A00' : '#8A1F0C') : undefined;
  const conversionLabel = metrics.conversionInsufficient ? '—' : metrics.conversion != null ? fmtPct(metrics.conversion) : '—';
  const conversionSub = metrics.conversionInsufficient ? 'Insufficient data' : metrics.conversion != null ? 'subs / views (7d)' : 'Insufficient data';
  const conversionColor = !metrics.conversionInsufficient && metrics.conversion != null
    ? (metrics.conversion >= 1 ? '#0C6A3F' : metrics.conversion >= 0.5 ? '#7A5A00' : '#8A1F0C') : undefined;

  return (
    <section className="mt-8">
      {/* ─── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ background: dStyle.dot }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-ink/50">
          Launch Result
        </h2>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: MUTED, background: PAPER }}>

        {/* ─── 1-LINE SUMMARY (most important element) ─────────────────────── */}
        <div className="text-[15px] font-black leading-snug mb-3">
          {summary}
        </div>

        {/* ─── Status tag + content type (subtle) ──────────────────────────── */}
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <StateBadge label={displayStatus} style={dStyle} />
          <span className="text-[10px] text-ink/30">
            {typeLabel} · {fmtHoursAgo(launchHours)}
          </span>
        </div>

        {/* ─── Signal tags (no raw numbers) ─────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <SignalTag label="Reach" value={reach} color={SIGNAL_COLOR[reach]} />
          <SignalTag label="Engagement" value={eng} color={SIGNAL_COLOR[eng]} />
          <SignalTag label="Conversion" value={conv} color={SIGNAL_COLOR[conv]} />
        </div>

        {/* ─── Video context (small) ───────────────────────────────────────── */}
        <div className="mt-3 text-[12px] text-ink/45 truncate" title={launch.title}>
          {launch.title} · {fmtNum(launch.views)} views
        </div>

        {/* ─── Expand toggle ─────────────────────────────────────────────── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 hover:text-ink/70 transition-colors"
        >
          {expanded ? '▾ Hide details' : '▸ Show details'}
        </button>

        {/* ─── SYSTEM 2: Full detail (hidden by default) ───────────────────── */}
        {expanded && (
          <div className="mt-4 pt-4 space-y-6" style={{ borderTop: `1px solid ${MUTED}` }}>

            {/* Detailed metrics */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                Detailed Metrics
              </div>
              <div className="grid grid-cols-4 gap-3">
                <DetailMetricCell label="Velocity" value={velocityLabel} sub={velocitySubLabel} color={velocityColor} muted={!metrics.velocityAvailable} />
                <DetailMetricCell label="Views" value={fmtNum(launch.views)} sub={`${fmtNum(launch.likes)} likes`} />
                <DetailMetricCell label="Engagement" value={engagementLabel} sub={metrics.engagement != null ? `${launch.likes + launch.comments} interactions` : null} color={engagementColor} />
                <DetailMetricCell label="Conversion" value={conversionLabel} sub={conversionSub} color={conversionColor} muted={metrics.conversionInsufficient} />
              </div>
              {metrics.conversionInsufficient && (
                <div className="mt-2 text-[10px] text-ink/30">Conversion becomes more reliable after 10K views or 72h.</div>
              )}
            </div>

            {/* Internal state signals */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                Signal Breakdown
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-ink/40">State:</span>
                <StateBadge label={launchState} style={LAUNCH_STYLE[launchState]} />
                <span className="text-[10px] text-ink/20">·</span>
                <span className="text-[10px] text-ink/40">Pre-launch:</span>
                <StateBadge label={preLaunch.state} style={PRELAUNCH_STYLE[preLaunch.state]} />
                <span className="text-[10px] text-ink/20">·</span>
                <span className="text-[10px] text-ink/40">Momentum:</span>
                <StateBadge label={momentum.state} style={MOMENTUM_STYLE[momentum.state]} />
              </div>
            </div>

            {/* Pre-Launch Breakdown */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                Pre-Launch Breakdown
              </div>
              <div className="space-y-1.5">
                {preLaunch.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: preLaunch.signals[i] ? '#1FBE7A' : '#FF4A1C' }} />
                    <span className="text-[12px] text-ink/60 tabular-nums">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Window chart */}
            {viewHistory.length >= 2 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                  Launch Window · Daily Channel Views
                </div>
                <LaunchWindowChart viewHistory={viewHistory} publishTs={publishTs} />
              </div>
            )}

            {/* Momentum Comparison */}
            {(momentum.week1Avg != null || momentum.week2Avg != null) && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                  Momentum · Weekly Avg Daily Views
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MomentumWeek label="Week 1" value={momentum.week1Avg} />
                  <MomentumWeek label="Week 2" value={momentum.week2Avg} compareBase={momentum.week1Avg} />
                  <MomentumWeek label="Week 3" value={momentum.week3Avg} compareBase={momentum.week1Avg} />
                </div>
              </div>
            )}

            {/* Baseline context */}
            {metrics.baseline.available && metrics.baseline.median > 0 && (
              <div className="text-[10px] text-ink/30">
                Baseline: {fmtNum(metrics.baseline.median)} median views ({metrics.baseline.label} · {metrics.baseline.count} video{metrics.baseline.count !== 1 ? 's' : ''})
              </div>
            )}
            {!metrics.baseline.available && (
              <div className="text-[10px] text-ink/30">{metrics.baseline.label}</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
