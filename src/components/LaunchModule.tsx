'use client';

import { useState, useMemo } from 'react';

// ─── Design system — matches CampaignStatusBoard / Watcher exactly ─────────
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
  /** All recent uploads — module picks the launch video internally */
  recentUploads: LaunchVideo[];
  uploads30d: number;
  shorts14d: number;
  daysSinceLastUpload: number | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  /** Channel-level daily view history for launch window chart */
  viewHistory: { x: number; y: number }[];
};

// ─── State types ───────────────────────────────────────────────────────────
type LaunchState = 'STRONG' | 'BUILDING' | 'WEAK';
type PreLaunchState = 'HOT' | 'WARM' | 'COLD';
type MomentumState = 'ACCELERATING' | 'SUSTAINING' | 'DECAYING' | 'BUILDING';

const LAUNCH_STYLE: Record<LaunchState, { bg: string; fg: string; dot: string }> = {
  STRONG:   { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  BUILDING: { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysSincePublish(publishedAt: string): number {
  return Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000);
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

/** Find the most recent longform video published within 10 days */
function findLaunchVideo(uploads: LaunchVideo[]): LaunchVideo | null {
  const candidates = uploads
    .filter((u) => u.kind === 'video' && daysSincePublish(u.publishedAt) <= 10)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return candidates[0] ?? null;
}

/** Compute median views of non-launch longform videos as baseline */
function computeBaseline(uploads: LaunchVideo[], launchId: string): number {
  const others = uploads
    .filter((u) => u.kind === 'video' && u.videoId !== launchId && u.views > 0);
  if (others.length === 0) return 0;
  const sorted = [...others].sort((a, b) => a.views - b.views);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1].views + sorted[mid].views) / 2)
    : sorted[mid].views;
}

// ─── Pre-Launch scoring ────────────────────────────────────────────────────

function computePreLaunch(
  uploads30d: number,
  shorts14d: number,
  daysSinceLastUpload: number | null,
): { state: PreLaunchState; signals: boolean[]; labels: string[] } {
  const s1 = uploads30d > 5;
  const s2 = shorts14d > 5;
  const s3 = daysSinceLastUpload != null && daysSinceLastUpload < 7;
  const signals = [s1, s2, s3];
  const labels = [
    `${uploads30d} uploads / 30d${s1 ? ' ✓' : ''}`,
    `${shorts14d} shorts / 14d${s2 ? ' ✓' : ''}`,
    daysSinceLastUpload != null
      ? `${daysSinceLastUpload}d since last upload${s3 ? ' ✓' : ''}`
      : 'No upload date',
  ];
  const count = signals.filter(Boolean).length;
  const state: PreLaunchState = count >= 3 ? 'HOT' : count >= 2 ? 'WARM' : 'COLD';
  return { state, signals, labels };
}

// ─── Launch metrics ────────────────────────────────────────────────────────

type LaunchMetrics = {
  velocity: number | null;        // % vs baseline (e.g. 250 = 2.5x)
  velocityMultiple: number | null; // raw multiple (e.g. 2.5)
  engagement: number | null;      // (likes + comments) / views * 100
  conversion: number | null;      // subs7d / views7d * 100
  baselineViews: number;
};

function computeLaunchMetrics(
  launch: LaunchVideo,
  uploads: LaunchVideo[],
  subs7Delta: number | null,
  views7Delta: number | null,
): LaunchMetrics {
  const baselineViews = computeBaseline(uploads, launch.videoId);
  const velocity = baselineViews > 0
    ? (launch.views / baselineViews) * 100
    : null;
  const velocityMultiple = baselineViews > 0
    ? launch.views / baselineViews
    : null;

  const engagement = launch.views > 0
    ? ((launch.likes + launch.comments) / launch.views) * 100
    : null;

  const conversion = views7Delta != null && views7Delta > 0 && subs7Delta != null
    ? (subs7Delta / views7Delta) * 100
    : null;

  return { velocity, velocityMultiple, engagement, conversion, baselineViews };
}

// ─── Launch state derivation ───────────────────────────────────────────────

function deriveLaunchState(metrics: LaunchMetrics): LaunchState {
  const { velocityMultiple, engagement, conversion } = metrics;

  // Count strong supporting signals
  const strongEngagement = engagement != null && engagement > 5;
  const strongConversion = conversion != null && conversion > 1;
  const strongSignals = [strongEngagement, strongConversion].filter(Boolean).length;

  if (velocityMultiple != null && velocityMultiple > 2 && strongSignals >= 1) {
    return 'STRONG';
  }
  if (velocityMultiple != null && velocityMultiple >= 1) {
    return 'BUILDING';
  }
  if (velocityMultiple != null && velocityMultiple < 1) {
    return 'WEAK';
  }
  // Insufficient data — fall back to signals
  if (strongSignals >= 2) return 'BUILDING';
  return 'WEAK';
}

// ─── Momentum ──────────────────────────────────────────────────────────────

type MomentumData = {
  state: MomentumState;
  week1Avg: number | null;
  week2Avg: number | null;
  week3Avg: number | null;
};

function computeMomentum(
  launch: LaunchVideo,
  viewHistory: { x: number; y: number }[],
): MomentumData {
  const publishTs = new Date(launch.publishedAt).getTime();
  const dayMs = 86400000;

  // Split history into week windows relative to publish date
  function avgForWeek(weekNum: number): number | null {
    const start = publishTs + (weekNum - 1) * 7 * dayMs;
    const end = publishTs + weekNum * 7 * dayMs;
    const points = viewHistory.filter((p) => {
      const ts = p.x;
      return ts >= start && ts < end;
    });
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
    else state = 'SUSTAINING'; // 0.5–0.7 range
  }

  return { state, week1Avg, week2Avg, week3Avg };
}

// ─── Launch window chart (inline SVG) ──────────────────────────────────────

function LaunchWindowChart({
  viewHistory,
  publishTs,
}: {
  viewHistory: { x: number; y: number }[];
  publishTs: number;
}) {
  const dayMs = 86400000;
  const windowEnd = publishTs + 10 * dayMs;

  // Filter to launch window only
  const windowPoints = viewHistory
    .filter((p) => p.x >= publishTs && p.x <= windowEnd)
    .sort((a, b) => a.x - b.x);

  if (windowPoints.length < 2) {
    return (
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/35 py-4">
        Not enough daily data yet
      </div>
    );
  }

  const W = 320;
  const H = 80;
  const pad = 4;
  const ys = windowPoints.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const minX = windowPoints[0].x;
  const maxX = windowPoints[windowPoints.length - 1].x;
  const rangeX = maxX - minX || 1;

  const toX = (x: number) => pad + ((x - minX) / rangeX) * (W - pad * 2);
  const toY = (y: number) => H - pad - ((y - minY) / rangeY) * (H - pad * 2);

  const linePath = windowPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `M${toX(windowPoints[0].x).toFixed(1)},${(H - pad).toFixed(1)} ` +
    windowPoints.map((p) => `L${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ') +
    ` L${toX(windowPoints[windowPoints.length - 1].x).toFixed(1)},${(H - pad).toFixed(1)} Z`;

  // Marker days: 1, 3, 7
  const markerDays = [1, 3, 7];
  const markers = markerDays
    .map((d) => {
      const targetTs = publishTs + d * dayMs;
      const closest = windowPoints.reduce((best, p) =>
        Math.abs(p.x - targetTs) < Math.abs(best.x - targetTs) ? p : best
      );
      // Only show if within 1 day of target
      if (Math.abs(closest.x - targetTs) > dayMs) return null;
      return { day: d, x: toX(closest.x), y: toY(closest.y), views: closest.y };
    })
    .filter(Boolean) as { day: number; x: number; y: number; views: number }[];

  return (
    <div>
      <svg width={W} height={H + 18} viewBox={`0 0 ${W} ${H + 18}`}>
        <path d={areaPath} fill="rgba(44, 107, 255, 0.08)" stroke="none" />
        <path d={linePath} fill="none" stroke="#2C6BFF" strokeWidth={1.5} strokeLinejoin="round" />
        {markers.map((m) => (
          <g key={m.day}>
            <circle cx={m.x} cy={m.y} r={3} fill="#2C6BFF" />
            <text
              x={m.x}
              y={H + 12}
              textAnchor="middle"
              fill="rgba(14,14,14,0.4)"
              fontSize={9}
              fontWeight={700}
            >
              D{m.day}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-3 mt-1">
        {markers.map((m) => (
          <span key={m.day} className="text-[10px] tabular-nums text-ink/40">
            Day {m.day}: {fmtNum(m.views)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── State badge (reusable) ────────────────────────────────────────────────

function StateBadge({
  label,
  style,
}: {
  label: string;
  style: { bg: string; fg: string; dot: string };
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {label}
    </span>
  );
}

// ─── Metric cell ───────────────────────────────────────────────────────────

function LaunchMetricCell({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string | null;
  color?: string;
}) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">{label}</div>
      <div className="font-black text-lg tabular-nums mt-0.5" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] tabular-nums mt-0.5" style={color ? { color } : { color: 'rgba(14,14,14,0.4)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LaunchModule({
  recentUploads,
  uploads30d,
  shorts14d,
  daysSinceLastUpload,
  subs7Delta,
  views7Delta,
  viewHistory,
}: LaunchModuleProps) {
  const [expanded, setExpanded] = useState(false);

  // ── Find launch video ────────────────────────────────────────────────────
  const launch = useMemo(() => findLaunchVideo(recentUploads), [recentUploads]);

  // ── Gate: only render if a video was published within 10 days ────────────
  if (!launch) return null;

  const daysSincePublished = daysSincePublish(launch.publishedAt);

  // ── Compute all derived state ────────────────────────────────────────────
  const metrics = computeLaunchMetrics(launch, recentUploads, subs7Delta, views7Delta);
  const launchState = deriveLaunchState(metrics);
  const preLaunch = computePreLaunch(uploads30d, shorts14d, daysSinceLastUpload);
  const momentum = computeMomentum(launch, viewHistory);
  const publishTs = new Date(launch.publishedAt).getTime();

  // ── Velocity display ─────────────────────────────────────────────────────
  const velocityLabel = metrics.velocityMultiple != null
    ? `${metrics.velocityMultiple.toFixed(1)}x`
    : '—';
  const velocityPctLabel = metrics.velocity != null
    ? `${Math.round(metrics.velocity)}% vs baseline`
    : 'No baseline';
  const velocityColor = metrics.velocityMultiple != null
    ? metrics.velocityMultiple >= 2 ? '#0C6A3F'
      : metrics.velocityMultiple >= 1 ? '#7A5A00'
      : '#8A1F0C'
    : undefined;

  // ── Engagement display ───────────────────────────────────────────────────
  const engagementLabel = metrics.engagement != null ? fmtPct(metrics.engagement) : '—';
  const engagementColor = metrics.engagement != null
    ? metrics.engagement >= 5 ? '#0C6A3F'
      : metrics.engagement >= 2 ? '#7A5A00'
      : '#8A1F0C'
    : undefined;

  // ── Conversion display ───────────────────────────────────────────────────
  const conversionLabel = metrics.conversion != null ? fmtPct(metrics.conversion) : '—';
  const conversionColor = metrics.conversion != null
    ? metrics.conversion >= 1 ? '#0C6A3F'
      : metrics.conversion >= 0.5 ? '#7A5A00'
      : '#8A1F0C'
    : undefined;

  return (
    <section className="mt-8">
      {/* ─── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ background: LAUNCH_STYLE[launchState].dot }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-ink/50">
          Launch Read
        </h2>
        <span className="text-[10px] text-ink/30">
          · Day {daysSincePublished}
        </span>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: MUTED, background: PAPER }}
      >
        {/* ─── Video title ─────────────────────────────────────────────────── */}
        <div className="text-[13px] font-bold leading-snug text-ink/70 mb-4 truncate" title={launch.title}>
          {launch.title}
        </div>

        {/* ─── SYSTEM 1: Three state badges ────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <StateBadge label={launchState} style={LAUNCH_STYLE[launchState]} />
          <span className="text-[10px] text-ink/20">·</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/40">Pre-launch</span>
          <StateBadge label={preLaunch.state} style={PRELAUNCH_STYLE[preLaunch.state]} />
          <span className="text-[10px] text-ink/20">·</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/40">Momentum</span>
          <StateBadge label={momentum.state} style={MOMENTUM_STYLE[momentum.state]} />
        </div>

        {/* ─── SYSTEM 1: Four key metrics ──────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <LaunchMetricCell
            label="Velocity"
            value={velocityLabel}
            sub={velocityPctLabel}
            color={velocityColor}
          />
          <LaunchMetricCell
            label="Views"
            value={fmtNum(launch.views)}
            sub={`${fmtNum(launch.likes)} likes`}
          />
          <LaunchMetricCell
            label="Engagement"
            value={engagementLabel}
            sub={metrics.engagement != null ? `${launch.likes + launch.comments} interactions` : null}
            color={engagementColor}
          />
          <LaunchMetricCell
            label="Conversion"
            value={conversionLabel}
            sub={metrics.conversion != null ? 'subs / views (7d)' : 'Insufficient data'}
            color={conversionColor}
          />
        </div>

        {/* ─── Expand toggle ─────────────────────────────────────────────── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 hover:text-ink/70 transition-colors"
        >
          {expanded ? '▾ Hide details' : '▸ Show details'}
        </button>

        {/* ─── SYSTEM 2: Expandable detail section ─────────────────────────── */}
        {expanded && (
          <div className="mt-4 pt-4 space-y-6" style={{ borderTop: `1px solid ${MUTED}` }}>

            {/* A. Pre-Launch Breakdown */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                Pre-Launch Breakdown
              </div>
              <div className="space-y-1.5">
                {preLaunch.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: preLaunch.signals[i] ? '#1FBE7A' : '#FF4A1C' }}
                    />
                    <span className="text-[12px] text-ink/60 tabular-nums">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* B. Launch Window (0–10 days) */}
            {viewHistory.length >= 2 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                  Launch Window · Daily Channel Views
                </div>
                <LaunchWindowChart viewHistory={viewHistory} publishTs={publishTs} />
              </div>
            )}

            {/* C. Momentum Comparison */}
            {(momentum.week1Avg != null || momentum.week2Avg != null) && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-ink/40 mb-2">
                  Momentum · Weekly Avg Daily Views
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MomentumWeek label="Week 1" value={momentum.week1Avg} />
                  <MomentumWeek
                    label="Week 2"
                    value={momentum.week2Avg}
                    compareBase={momentum.week1Avg}
                  />
                  <MomentumWeek
                    label="Week 3"
                    value={momentum.week3Avg}
                    compareBase={momentum.week1Avg}
                  />
                </div>
              </div>
            )}

            {/* Baseline context */}
            {metrics.baselineViews > 0 && (
              <div className="text-[10px] text-ink/30">
                Baseline: {fmtNum(metrics.baselineViews)} median views (from {recentUploads.filter((u) => u.kind === 'video' && u.videoId !== launch.videoId && u.views > 0).length} other videos)
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}


// ─── Momentum week cell ────────────────────────────────────────────────────

function MomentumWeek({
  label,
  value,
  compareBase,
}: {
  label: string;
  value: number | null;
  compareBase?: number | null;
}) {
  const pct = value != null && compareBase != null && compareBase > 0
    ? ((value / compareBase) * 100).toFixed(0) + '%'
    : null;
  const pctColor = value != null && compareBase != null && compareBase > 0
    ? value / compareBase >= 0.7 ? '#0C6A3F' : '#8A1F0C'
    : undefined;

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: SOFT, border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">{label}</div>
      <div className="font-black text-[15px] tabular-nums mt-0.5">
        {value != null ? fmtNum(Math.round(value)) : '—'}
      </div>
      {pct && (
        <div className="text-[10px] tabular-nums mt-0.5" style={{ color: pctColor }}>
          {pct} of wk1
        </div>
      )}
    </div>
  );
}
