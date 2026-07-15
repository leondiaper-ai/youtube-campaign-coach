'use client';

/**
 * CampaignBehaviour V4 — Visual Story
 *
 * Design principle: WHAT DID WE POST? → WHAT HAPPENED TO MOMENTUM?
 *
 * Four visual concepts, in strict hierarchy:
 *   1. VIEW MOMENTUM — 7-day rolling average, clean hero line (SIGNAL red)
 *   2. CONTENT MOMENTS — Long-form markers with format labels on timeline
 *   3. SHORTS RHYTHM — Grouped neutral markers showing cadence
 *   4. SUBSCRIBER MOVEMENT — Secondary sparkline strip beneath
 *
 * No dual axes. No large legend. No gap shading.
 * One headline insight above the chart.
 * A marketing team should understand the story in 5–10 seconds.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FORMAT_COLORS, type UploadFormat, type ClassifiedUpload } from '@/lib/formatClassifier';

// ── Design tokens ────────────────────────────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const BONE   = '#E8E3DA';
const SMOKE  = '#8A847A';
const GHOST  = '#D4CFC6';
const SIGNAL = '#FF4A1C';
const MINT   = '#1FBE7A';
const SUN    = '#FFD24C';
const CREAM  = '#F6F1E7';

// ── Types ────────────────────────────────────────────────────────────────

type VelocityPoint = {
  date: string;
  dailyViewGain: number | null;
  rollingAvg7d: number | null;
};

type SubsPoint = {
  date: string;
  dailySubGain: number | null;
  rollingAvg7d: number | null;
};

type ContentGap = {
  startDate: string;
  endDate: string;
  durationDays: number;
  type: 'all_content' | 'longform_only';
};

type Milestone = {
  date: string;
  label: string;
  type: 'campaign_start' | 'single' | 'album' | 'ep' | 'milestone';
};

type FormatBreakdown = {
  format: UploadFormat;
  meta: { label: string; shortLabel: string; isShort: boolean; isLongform: boolean };
  count: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  recentDirection: 'accelerating' | 'stable' | 'declining' | 'insufficient';
};

type UploadObservation = {
  uploadId: string;
  title: string;
  format: UploadFormat;
  publishedAt: string;
  viewsBefore7d: number | null;
  viewsAfter7d: number | null;
  subsBefore7d: number | null;
  subsAfter7d: number | null;
  viewVelocityChange: number | null;
  subsVelocityChange: number | null;
  nextUpload: { title: string; format: UploadFormat; daysAfter: number } | null;
  nextLongform: { title: string; format: UploadFormat; daysAfter: number } | null;
  observation: string;
};

type Learning = {
  text: string;
  evidence: string;
  confidence: 'observation' | 'pattern' | 'strong';
};

type Baseline = {
  period: { start: string; end: string; days: number };
  avgDailyViews: number | null;
  avgDailySubs: number | null;
  weeklyViews: number | null;
  weeklySubs: number | null;
};

type AvailableWindow = {
  days: number;
  label: string;
  available: boolean;
};

type BehaviourData = {
  artist: { slug: string; name: string; channelState?: string };
  observationWindow: { startDate: string; endDate: string; days: number; label: string };
  viewVelocity: VelocityPoint[];
  subscriberGains: SubsPoint[];
  uploads: ClassifiedUpload[];
  gaps: ContentGap[];
  milestones: Milestone[];
  formatBreakdown: FormatBreakdown[];
  learnings: Learning[];
  uploadObservation: UploadObservation | null;
  baseline: Baseline | null;
  availableWindows: AvailableWindow[];
  lastUpdated: string;
};

type Props = {
  slug: string;
  artistName: string;
  onClose?: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dateToX(date: string, startDate: string, endDate: string, width: number): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const current = new Date(date.slice(0, 10)).getTime();
  const range = end - start;
  if (range <= 0) return 0;
  return ((current - start) / range) * width;
}

function getFormatShape(format: UploadFormat, cx: number, cy: number, size: number): string {
  const s = size;
  switch (format) {
    case 'omv':
      return `M${cx},${cy - s} A${s},${s} 0 1,1 ${cx},${cy + s} A${s},${s} 0 1,1 ${cx},${cy - s}`;
    case 'lyric':
      return `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`;
    case 'visualiser':
      return `M${cx - s},${cy - s} L${cx + s},${cy - s} L${cx + s},${cy + s} L${cx - s},${cy + s} Z`;
    case 'live':
      return starPath(cx, cy, s, s * 0.45, 5);
    case 'bts':
      return `M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7} Z`;
    case 'audio':
      return `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`;
    case 'short':
      return `M${cx - s},${cy - s * 0.5} L${cx + s},${cy - s * 0.5} L${cx},${cy + s * 0.7} Z`;
    default:
      return `M${cx},${cy - s} A${s},${s} 0 1,1 ${cx},${cy + s} A${s},${s} 0 1,1 ${cx},${cy - s}`;
  }
}

function starPath(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return parts.join(' ') + ' Z';
}

// ── Headline generator ─────────────────────────────────────────────────

function generateHeadline(data: BehaviourData): string {
  const vel = data.viewVelocity.filter((v) => v.rollingAvg7d != null);
  const uploads = data.uploads;
  const longform = uploads.filter((u) => u.formatMeta.isLongform);
  const shorts = uploads.filter((u) => u.format === 'short');

  if (vel.length < 7) {
    if (uploads.length === 0) return 'No upload activity recorded during this observation window.';
    return `${uploads.length} upload${uploads.length !== 1 ? 's' : ''} recorded across ${data.observationWindow.days} days.`;
  }

  // Split velocity into thirds for trend detection
  const third = Math.max(3, Math.floor(vel.length / 3));
  const recent = vel.slice(-third);
  const earlier = vel.slice(0, third);

  const recentAvg = recent.reduce((s, v) => s + (v.rollingAvg7d ?? 0), 0) / recent.length;
  const earlierAvg = earlier.reduce((s, v) => s + (v.rollingAvg7d ?? 0), 0) / earlier.length;

  const change = earlierAvg > 100 ? (recentAvg - earlierAvg) / earlierAvg : 0;

  const lastUpload = uploads.length > 0 ? uploads[uploads.length - 1] : null;
  const daysSince = lastUpload
    ? Math.round(
        (new Date(data.observationWindow.endDate).getTime() -
          new Date(lastUpload.publishedAt).getTime()) /
          86400000,
      )
    : null;

  const sortedGaps = [...data.gaps]
    .filter((g) => g.type === 'all_content')
    .sort((a, b) => b.durationDays - a.durationDays);
  const longestGap = sortedGaps[0];

  const strongest = data.formatBreakdown
    .filter((f) => f.meta.isLongform && f.count >= 2)
    .sort((a, b) => b.avgViews - a.avgViews)[0];

  // Rising + content
  if (change > 0.15 && longform.length >= 2) {
    if (strongest) {
      return `Channel momentum strengthened during this period, with ${strongest.meta.label} content associated with the strongest view periods.`;
    }
    return 'Channel momentum strengthened as content activity increased.';
  }

  // Declining + gap
  if (change < -0.15 && longestGap && longestGap.durationDays >= 14) {
    if (daysSince != null && daysSince <= 7) {
      return `Views declined during a ${longestGap.durationDays}-day content gap and appear to be recovering as activity resumed.`;
    }
    return `Views declined during a ${longestGap.durationDays}-day content gap.`;
  }

  // Declining + recent inactivity
  if (change < -0.15 && daysSince != null && daysSince > 14) {
    return `Channel momentum has slowed, with the most recent upload ${daysSince} days ago.`;
  }

  // Declining generally
  if (change < -0.15) {
    return 'View momentum has gradually declined across the observation window.';
  }

  // Shorts-heavy, few longform
  if (shorts.length > longform.length * 3 && longform.length <= 2 && shorts.length >= 5) {
    return 'Shorts activity has remained consistent, but long-form uploads have been limited.';
  }

  // Stable + active
  if (Math.abs(change) <= 0.15 && uploads.length >= 5) {
    return 'Channel views have remained stable throughout the observation period.';
  }

  // Very few uploads
  if (uploads.length <= 2) {
    return `Limited upload activity — ${uploads.length} upload${uploads.length !== 1 ? 's' : ''} across ${data.observationWindow.days} days.`;
  }

  return `Channel activity spans ${uploads.length} uploads over ${data.observationWindow.days} days.`;
}

// ── Chart layout constants ──────────────────────────────────────────────

const M = { left: 44, right: 16, top: 4, bottom: 4 };

const VIEWS_H   = 180;   // Hero: view momentum line area
const CONTENT_H = 44;    // Content markers zone (longform + shorts)
const AXIS_H    = 20;    // Date tick labels
const SUBS_GAP  = 6;     // Gap between axis and subs strip
const SUBS_H    = 24;    // Subscriber sparkline strip

const LF_OFFSET = 14;    // Long-form marker Y within content zone
const SH_OFFSET = 34;    // Short marker Y within content zone

const TOTAL_CHART_H = VIEWS_H + CONTENT_H + AXIS_H + SUBS_GAP + SUBS_H;

// ── Story Chart ─────────────────────────────────────────────────────────

function StoryChart({
  data,
  startDate,
  endDate,
  width,
  hoveredDate,
  onHover,
  selectedUpload,
  onSelectUpload,
  baseline,
}: {
  data: BehaviourData;
  startDate: string;
  endDate: string;
  width: number;
  hoveredDate: string | null;
  onHover: (date: string | null) => void;
  selectedUpload: string | null;
  onSelectUpload: (id: string | null) => void;
  baseline: Baseline | null;
}) {
  const chartW = width - M.left - M.right;
  const svgH = TOTAL_CHART_H + M.top + M.bottom;

  function toX(date: string) {
    return dateToX(date, startDate, endDate, chartW);
  }

  // ── View velocity data ──
  const velocityValid = data.viewVelocity.filter((d) => d.rollingAvg7d != null);
  const velMax =
    velocityValid.length > 0
      ? Math.max(...velocityValid.map((d) => d.rollingAvg7d!))
      : 0;
  const velMin =
    velocityValid.length > 0
      ? Math.min(0, Math.min(...velocityValid.map((d) => d.rollingAvg7d!)))
      : 0;
  const velRange = velMax - velMin || 1;
  function velToY(val: number) {
    return VIEWS_H - ((val - velMin) / velRange) * VIEWS_H;
  }

  // View line + subtle area
  const velLineParts = velocityValid.map((p, i) => {
    const x = toX(p.date);
    const y = velToY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const velLine = velLineParts.join(' ');
  const velArea =
    velocityValid.length > 1
      ? velLine +
        ` L${toX(velocityValid[velocityValid.length - 1].date).toFixed(1)},${VIEWS_H}` +
        ` L${toX(velocityValid[0].date).toFixed(1)},${VIEWS_H} Z`
      : '';

  // ── Subscriber sparkline data ──
  const subsValid = data.subscriberGains.filter((d) => d.rollingAvg7d != null);
  const subsMax =
    subsValid.length > 0
      ? Math.max(...subsValid.map((d) => d.rollingAvg7d!))
      : 0;
  const subsMin =
    subsValid.length > 0
      ? Math.min(0, Math.min(...subsValid.map((d) => d.rollingAvg7d!)))
      : 0;
  const subsRange = subsMax - subsMin || 1;
  function subsToStripY(val: number) {
    return SUBS_H - ((val - subsMin) / subsRange) * SUBS_H;
  }

  const subsLineParts = subsValid.map((p, i) => {
    const x = toX(p.date);
    const y = subsToStripY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const subsSparkline = subsLineParts.join(' ');
  const subsSparkArea =
    subsValid.length > 1
      ? subsSparkline +
        ` L${toX(subsValid[subsValid.length - 1].date).toFixed(1)},${SUBS_H}` +
        ` L${toX(subsValid[0].date).toFixed(1)},${SUBS_H} Z`
      : '';

  // ── Content markers ──
  const longform = data.uploads.filter((u) => u.formatMeta.isLongform);
  const shorts = data.uploads.filter((u) => u.format === 'short');

  // Group nearby shorts
  const shortGroups: { x: number; count: number; uploads: ClassifiedUpload[] }[] = [];
  for (const s of shorts) {
    const x = toX(s.publishedAt);
    const existing = shortGroups.find((g) => Math.abs(g.x - x) < 14);
    if (existing) {
      existing.count++;
      existing.uploads.push(s);
    } else {
      shortGroups.push({ x, count: 1, uploads: [s] });
    }
  }

  // ── Significant gaps (max 1–2 annotations) ──
  const significantGaps = useMemo(() => {
    const result: ContentGap[] = [];
    const allContentSorted = [...data.gaps]
      .filter((g) => g.type === 'all_content' && g.durationDays >= 10)
      .sort((a, b) => b.durationDays - a.durationDays);
    if (allContentSorted[0]) result.push(allContentSorted[0]);

    const lfSorted = [...data.gaps]
      .filter((g) => g.type === 'longform_only' && g.durationDays >= 21)
      .sort((a, b) => b.durationDays - a.durationDays);
    if (
      lfSorted[0] &&
      (!result[0] || lfSorted[0].startDate !== result[0].startDate)
    ) {
      result.push(lfSorted[0]);
    }
    return result.slice(0, 2);
  }, [data.gaps]);

  // ── Date axis ticks ──
  const axisTicks = useMemo(() => {
    const tickCount = Math.min(8, Math.floor(chartW / 70));
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    const step = (endTs - startTs) / tickCount;
    return Array.from({ length: tickCount + 1 }).map((_, i) => {
      const ts = startTs + step * i;
      const date = new Date(ts).toISOString().slice(0, 10);
      return { date, x: toX(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, chartW]);

  // ── Hover detection ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const ratio = mouseX / chartW;
      const startTs = new Date(startDate).getTime();
      const endTs = new Date(endDate).getTime();
      const hoverTs = startTs + ratio * (endTs - startTs);
      onHover(new Date(hoverTs).toISOString().slice(0, 10));
    },
    [chartW, startDate, endDate, onHover],
  );

  const hoverX = hoveredDate ? toX(hoveredDate) : null;

  // Computed Y positions
  const subsStripY = VIEWS_H + CONTENT_H + AXIS_H + SUBS_GAP;

  return (
    <svg
      width={width}
      height={svgH}
      style={{ display: 'block', userSelect: 'none' }}
      onMouseLeave={() => onHover(null)}
    >
      <g transform={`translate(${M.left},${M.top})`}>
        {/* ═══ VIEWS AREA BACKGROUND ═══ */}
        {/* Subtle grid lines for scale context */}
        <line x1={0} y1={VIEWS_H} x2={chartW} y2={VIEWS_H} stroke={BONE} strokeWidth={1} />
        <line
          x1={0} y1={VIEWS_H / 2} x2={chartW} y2={VIEWS_H / 2}
          stroke={BONE} strokeWidth={0.5} opacity={0.3}
        />
        {/* Zero label */}
        <text x={-6} y={VIEWS_H + 3} textAnchor="end" fontSize={8} fill={GHOST}>
          0
        </text>

        {/* ═══ CAMPAIGN START — very subtle ═══ */}
        {data.milestones
          .filter((m) => m.type === 'campaign_start')
          .map((m, i) => {
            const x = toX(m.date);
            if (x < 0 || x > chartW) return null;
            return (
              <g key={`cs-${i}`}>
                <line
                  x1={x} y1={0} x2={x} y2={VIEWS_H}
                  stroke={GHOST} strokeWidth={0.5} strokeDasharray="2,6" opacity={0.4}
                />
                <text
                  x={x} y={-2} textAnchor="middle"
                  fontSize={7} fill={GHOST} opacity={0.5}
                >
                  Campaign Start
                </text>
              </g>
            );
          })}

        {/* ═══ NON-CAMPAIGN MILESTONES ═══ */}
        {data.milestones
          .filter((m) => m.type !== 'campaign_start')
          .map((m, i) => {
            const x = toX(m.date);
            if (x < 0 || x > chartW) return null;
            return (
              <g key={`ms-${i}`}>
                <line
                  x1={x} y1={0} x2={x} y2={VIEWS_H}
                  stroke={SMOKE} strokeWidth={1} strokeDasharray="4,4" opacity={0.3}
                />
                <text
                  x={x} y={-2} textAnchor="middle"
                  fontSize={8} fill={SMOKE} opacity={0.7}
                >
                  {m.label.length > 20 ? m.label.slice(0, 20) + '…' : m.label}
                </text>
              </g>
            );
          })}

        {/* ═══ BASELINE REFERENCE ═══ */}
        {baseline?.avgDailyViews != null && baseline.avgDailyViews > 0 && (
          <g>
            <line
              x1={0} y1={velToY(baseline.avgDailyViews)}
              x2={chartW} y2={velToY(baseline.avgDailyViews)}
              stroke={SMOKE} strokeWidth={0.5} strokeDasharray="2,4" opacity={0.3}
            />
            <text
              x={-6} y={velToY(baseline.avgDailyViews) + 3}
              textAnchor="end" fontSize={7} fill={GHOST}
            >
              avg
            </text>
          </g>
        )}

        {/* ═══ VIEW MOMENTUM — subtle area fill ═══ */}
        {velArea && <path d={velArea} fill={SIGNAL} opacity={0.06} />}

        {/* ═══ VIEW MOMENTUM — THE HERO LINE ═══ */}
        {velLine && (
          <path d={velLine} fill="none" stroke={SIGNAL} strokeWidth={2} />
        )}

        {/* ═══ CONTENT MARKER ZONE ═══ */}
        <g transform={`translate(0,${VIEWS_H})`}>
          {/* Separator line */}
          <line x1={0} y1={0} x2={chartW} y2={0} stroke={BONE} strokeWidth={1} />

          {/* ── Gap annotations (max 1–2, text only) ── */}
          {significantGaps.map((gap, i) => {
            const x1 = Math.max(0, toX(gap.startDate));
            const x2 = Math.min(chartW, toX(gap.endDate));
            const midX = (x1 + x2) / 2;
            const gapW = x2 - x1;
            if (gapW < 40) return null; // Too narrow to label
            const label =
              gap.type === 'all_content'
                ? `${gap.durationDays}d no content`
                : `${gap.durationDays}d no long-form`;
            return (
              <g key={`gap-${i}`}>
                <line
                  x1={x1 + 4} y1={6} x2={x2 - 4} y2={6}
                  stroke={SMOKE} strokeWidth={0.5} strokeDasharray="3,2" opacity={0.4}
                />
                <text
                  x={midX} y={4} textAnchor="middle"
                  fontSize={7} fill={SMOKE} fontWeight={600} opacity={0.6}
                  style={{ textTransform: 'uppercase' } as React.CSSProperties}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* ── Long-form markers — LARGE, labelled with format ── */}
          {longform.map((u) => {
            const x = toX(u.publishedAt);
            const isSelected = selectedUpload === u.id;
            const size = isSelected ? 10 : 8;

            return (
              <g
                key={u.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectUpload(isSelected ? null : u.id)}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={x} cy={LF_OFFSET} r={size + 5}
                    fill="none" stroke={FORMAT_COLORS[u.format]} strokeWidth={2}
                    opacity={0.3}
                  />
                )}

                {/* Vertical connector — links marker to views area */}
                <line
                  x1={x} y1={0} x2={x} y2={LF_OFFSET - size - 2}
                  stroke={FORMAT_COLORS[u.format]} strokeWidth={0.5} opacity={0.12}
                />

                {/* The marker — big and obvious */}
                <path
                  d={getFormatShape(u.format, x, LF_OFFSET, size)}
                  fill={u.format === 'audio' ? 'none' : FORMAT_COLORS[u.format]}
                  stroke={FORMAT_COLORS[u.format]}
                  strokeWidth={u.format === 'audio' ? 2.5 : isSelected ? 2 : 0}
                  opacity={isSelected ? 1 : 0.9}
                />

                {/* Format label — ALWAYS visible */}
                <text
                  x={x} y={LF_OFFSET + size + 9} textAnchor="middle"
                  fontSize={7} fill={FORMAT_COLORS[u.format]} fontWeight={700}
                  style={{ textTransform: 'uppercase' } as React.CSSProperties}
                >
                  {u.formatMeta.shortLabel}
                </text>
              </g>
            );
          })}

          {/* ── Short groups — small, neutral, showing cadence ── */}
          {shortGroups.map((group, i) => {
            const isSelected = group.uploads.some((u) => u.id === selectedUpload);
            const dotR = group.count > 1 ? 3 : 2.5;
            return (
              <g
                key={`sg-${i}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectUpload(group.uploads[0].id)}
              >
                <circle
                  cx={group.x} cy={SH_OFFSET} r={dotR}
                  fill={FORMAT_COLORS.short}
                  opacity={isSelected ? 1 : 0.4}
                />
                {group.count > 1 && (
                  <text
                    x={group.x} y={SH_OFFSET + 10} textAnchor="middle"
                    fontSize={7} fill={SMOKE} opacity={0.6}
                  >
                    ×{group.count}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* ═══ DATE AXIS ═══ */}
        <g transform={`translate(0,${VIEWS_H + CONTENT_H})`}>
          <line x1={0} y1={0} x2={chartW} y2={0} stroke={BONE} strokeWidth={0.5} opacity={0.5} />
          {axisTicks.map((tick, i) => (
            <g key={i}>
              <line x1={tick.x} y1={0} x2={tick.x} y2={3} stroke={BONE} strokeWidth={1} />
              <text x={tick.x} y={14} textAnchor="middle" fontSize={9} fill={SMOKE}>
                {formatDate(tick.date)}
              </text>
            </g>
          ))}
        </g>

        {/* ═══ SUBSCRIBER SPARKLINE STRIP ═══ */}
        <g transform={`translate(0,${subsStripY})`}>
          {/* Strip background */}
          <rect
            x={0} y={0} width={chartW} height={SUBS_H}
            fill={BONE} opacity={0.2} rx={3}
          />
          {/* Zero reference line (if range spans negative) */}
          {subsMin < 0 && (
            <line
              x1={0} y1={subsToStripY(0)} x2={chartW} y2={subsToStripY(0)}
              stroke={GHOST} strokeWidth={0.5} opacity={0.3}
            />
          )}
          {/* Sparkline area */}
          {subsSparkArea && (
            <path d={subsSparkArea} fill={MINT} opacity={0.12} />
          )}
          {/* Sparkline line */}
          {subsSparkline && (
            <path
              d={subsSparkline} fill="none"
              stroke={MINT} strokeWidth={1.5} opacity={0.45}
            />
          )}
          {/* SUBS label */}
          <text
            x={-6} y={SUBS_H / 2 + 3} textAnchor="end"
            fontSize={7} fill={MINT} fontWeight={600} opacity={0.5}
          >
            SUBS
          </text>
        </g>

        {/* ═══ CROSSHAIR (views area + content zone only) ═══ */}
        {hoverX != null && hoverX >= 0 && hoverX <= chartW && (
          <line
            x1={hoverX} y1={0} x2={hoverX} y2={VIEWS_H + CONTENT_H}
            stroke={INK} strokeWidth={1} opacity={0.1}
          />
        )}

        {/* ═══ HOVER TOOLTIP — views only ═══ */}
        {hoveredDate && hoverX != null && hoverX >= 0 && hoverX <= chartW && (
          <g>
            {(() => {
              const velPoint = data.viewVelocity.find((d) => d.date === hoveredDate);
              if (!velPoint?.rollingAvg7d) return null;
              const yDot = velToY(velPoint.rollingAvg7d);
              const tooltipW = 80;
              const tooltipX =
                hoverX + tooltipW + 10 > chartW
                  ? hoverX - tooltipW - 8
                  : hoverX + 8;
              return (
                <g>
                  {/* Dot on view line */}
                  <circle cx={hoverX} cy={yDot} r={4} fill={SIGNAL} />

                  {/* Tooltip card */}
                  <rect
                    x={tooltipX} y={Math.max(4, yDot - 12)} width={tooltipW} height={20}
                    rx={4} fill={INK} opacity={0.85}
                  />
                  <text
                    x={tooltipX + 8} y={Math.max(4, yDot - 12) + 14}
                    fontSize={10} fill="white" fontWeight={600}
                  >
                    {formatNum(velPoint.rollingAvg7d)}/d
                  </text>
                </g>
              );
            })()}

            {/* Date label at axis */}
            <g transform={`translate(0,${VIEWS_H + CONTENT_H})`}>
              <rect
                x={hoverX - 24} y={-2} width={48} height={14}
                rx={3} fill={INK} opacity={0.8}
              />
              <text
                x={hoverX} y={9} textAnchor="middle"
                fontSize={8} fill="white" fontWeight={600}
              >
                {formatDate(hoveredDate)}
              </text>
            </g>
          </g>
        )}

        {/* ═══ HOVER DETECTION OVERLAY ═══ */}
        <rect
          x={0} y={0} width={chartW} height={VIEWS_H + CONTENT_H}
          fill="transparent"
          onMouseMove={handleMouseMove}
          style={{ cursor: 'crosshair' }}
        />
      </g>
    </svg>
  );
}

// ── Upload detail panel ──────────────────────────────────────────────────

function UploadDetailPanel({
  upload,
  observation,
  onClose,
}: {
  upload: ClassifiedUpload;
  observation: UploadObservation | null;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${BONE}`,
        borderRadius: 10,
        padding: '16px 20px',
        marginTop: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                background: FORMAT_COLORS[upload.format],
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}
            >
              {upload.formatMeta.label}
            </span>
            <span style={{ fontSize: 12, color: SMOKE }}>
              {formatDate(upload.publishedAt)}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{upload.title}</div>
          <div style={{ fontSize: 12, color: SMOKE, marginTop: 2 }}>
            {formatNum(upload.viewCount)} views
            {upload.daysSincePrevious != null &&
              ` · ${upload.daysSincePrevious}d since previous upload`}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: SMOKE,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Before / After metrics */}
      {observation && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ background: PAPER, borderRadius: 8, padding: '10px 12px' }}>
            <div
              style={{
                fontSize: 9,
                color: SMOKE,
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              7 Days Before
            </div>
            <div style={{ fontSize: 13, color: INK }}>
              {observation.viewsBefore7d != null
                ? `+${formatNum(observation.viewsBefore7d)} views`
                : 'No data'}
            </div>
            {observation.subsBefore7d != null && (
              <div style={{ fontSize: 12, color: SMOKE }}>
                +{formatNum(observation.subsBefore7d)} subs
              </div>
            )}
          </div>
          <div style={{ background: PAPER, borderRadius: 8, padding: '10px 12px' }}>
            <div
              style={{
                fontSize: 9,
                color: SMOKE,
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {upload.formatMeta.isLongform ? '14 Days After' : '7 Days After'}
            </div>
            <div style={{ fontSize: 13, color: INK }}>
              {observation.viewsAfter7d != null
                ? `+${formatNum(observation.viewsAfter7d)} views`
                : 'No data'}
            </div>
            {observation.subsAfter7d != null && (
              <div style={{ fontSize: 12, color: SMOKE }}>
                +{formatNum(observation.subsAfter7d)} subs
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next uploads */}
      {observation?.nextUpload && (
        <div style={{ fontSize: 12, color: SMOKE, marginBottom: 4 }}>
          Next upload:{' '}
          <strong style={{ color: INK }}>{observation.nextUpload.title}</strong> — Day +
          {observation.nextUpload.daysAfter}
        </div>
      )}
      {observation?.nextLongform &&
        observation.nextLongform.daysAfter !== observation.nextUpload?.daysAfter && (
          <div style={{ fontSize: 12, color: SMOKE, marginBottom: 4 }}>
            Next long-form:{' '}
            <strong style={{ color: INK }}>{observation.nextLongform.title}</strong> — Day +
            {observation.nextLongform.daysAfter}
          </div>
        )}

      {/* Observation text */}
      {observation?.observation && (
        <div
          style={{
            fontSize: 12,
            color: INK,
            lineHeight: 1.5,
            borderTop: `1px solid ${BONE}`,
            paddingTop: 8,
            marginTop: 8,
            fontStyle: 'italic',
          }}
        >
          {observation.observation}
        </div>
      )}
    </div>
  );
}

// ── Format breakdown (hidden by default) ────────────────────────────────

function FormatBreakdownPanel({ breakdown }: { breakdown: FormatBreakdown[] }) {
  if (breakdown.length === 0) return null;

  const dirLabel: Record<FormatBreakdown['recentDirection'], string> = {
    accelerating: 'Accelerating',
    stable: 'Stable',
    declining: 'Declining',
    insufficient: '—',
  };
  const dirColor: Record<FormatBreakdown['recentDirection'], string> = {
    accelerating: MINT,
    stable: SMOKE,
    declining: SIGNAL,
    insufficient: GHOST,
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 8,
        marginTop: 8,
      }}
    >
      {breakdown.map((fb) => (
        <div
          key={fb.format}
          style={{
            background: 'white',
            border: `1px solid ${BONE}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <svg width={12} height={12}>
              <path
                d={getFormatShape(fb.format, 6, 6, 4)}
                fill={fb.format === 'audio' ? 'none' : FORMAT_COLORS[fb.format]}
                stroke={FORMAT_COLORS[fb.format]}
                strokeWidth={fb.format === 'audio' ? 1.5 : 0}
              />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>
              {fb.meta.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: SMOKE, lineHeight: 1.6 }}>
            <div>
              {fb.count} upload{fb.count !== 1 ? 's' : ''} · Avg:{' '}
              {formatNum(fb.avgViews)}
            </div>
            {fb.count >= 3 && <div>Median: {formatNum(fb.medianViews)}</div>}
            <div style={{ color: dirColor[fb.recentDirection] }}>
              {dirLabel[fb.recentDirection]}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Period selector ─────────────────────────────────────────────────────

function PeriodSelector({
  windows,
  currentDays,
  onSelect,
}: {
  windows: AvailableWindow[];
  currentDays: number;
  onSelect: (days: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {windows
        .filter((w) => w.available)
        .map((w) => {
          const isActive =
            (w.days >= 9999 && currentDays >= 9999) ||
            (w.days < 9999 && currentDays === w.days);
          return (
            <button
              key={w.label}
              onClick={() => onSelect(w.days)}
              style={{
                background: isActive ? INK : 'transparent',
                color: isActive ? 'white' : SMOKE,
                border: `1px solid ${isActive ? INK : BONE}`,
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {w.label}
            </button>
          );
        })}
    </div>
  );
}

// ── PNG Export ───────────────────────────────────────────────────────────

async function exportToPNG(
  slug: string,
  data: BehaviourData,
  headline: string,
  chartSvgElement: SVGSVGElement | null,
): Promise<void> {
  if (!chartSvgElement) return;

  const W = 1920;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('CHANNEL BEHAVIOUR', 40, 40);
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(data.artist.name, 40, 72);
  ctx.fillStyle = SMOKE;
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${data.observationWindow.startDate} to ${data.observationWindow.endDate} · ${data.observationWindow.days} days`,
    40,
    96,
  );

  // Headline insight
  if (headline) {
    ctx.fillStyle = INK;
    ctx.font = 'italic 15px Inter, system-ui, sans-serif';
    // Word-wrap headline if needed
    const maxW = W - 80;
    const words = headline.split(' ');
    let line = '';
    let lineY = 126;
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, 40, lineY);
        line = word;
        lineY += 20;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, 40, lineY);
  }

  // Chart SVG → Image → Canvas
  try {
    const svgClone = chartSvgElement.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', String(W - 80));
    svgClone.setAttribute('height', '460');
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    ctx.drawImage(img, 40, 160, W - 80, 460);
    URL.revokeObjectURL(url);
  } catch {
    ctx.fillStyle = BONE;
    ctx.fillRect(40, 160, W - 80, 460);
    ctx.fillStyle = SMOKE;
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillText('Chart rendering — see live view', W / 2 - 120, 390);
  }

  // What We're Learning (bottom section)
  const learnY = 660;
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('WHAT WE\'RE LEARNING', 40, learnY);

  // Strongest format
  const strongest = data.formatBreakdown
    .filter((f) => f.meta.isLongform && f.count >= 1)
    .sort((a, b) => b.avgViews - a.avgViews)[0];
  if (strongest) {
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.fillStyle = SMOKE;
    ctx.fillText('STRONGEST', 40, learnY + 22);
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(
      `${strongest.meta.label} — ${strongest.count} uploads, avg ${formatNum(strongest.avgViews)}`,
      40,
      learnY + 38,
    );
  }

  // Shorts
  const shortsData = data.formatBreakdown.find((f) => f.format === 'short');
  if (shortsData) {
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.fillStyle = SMOKE;
    ctx.fillText('SHORTS', 40, learnY + 62);
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(
      `${shortsData.count} uploads · Avg: ${formatNum(shortsData.avgViews)}`,
      40,
      learnY + 78,
    );
  }

  // Summary stats
  const statsY = learnY + 110;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText('SUMMARY', 40, statsY);
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillStyle = SMOKE;
  const totalUploads = data.uploads.length;
  const lfCount = data.uploads.filter((u) => u.formatMeta.isLongform).length;
  const shortCount = data.uploads.filter((u) => u.format === 'short').length;
  ctx.fillText(
    `${totalUploads} uploads (${lfCount} long-form, ${shortCount} Shorts) · ${data.observationWindow.days}-day window`,
    40,
    statsY + 18,
  );

  // Footer
  ctx.fillStyle = GHOST;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText(
    `YouTube Campaign Coach · Last updated: ${new Date(data.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    40,
    H - 24,
  );

  // Download
  const link = document.createElement('a');
  link.download = `${slug}-campaign-behaviour.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Main component ───────────────────────────────────────────────────────

export default function CampaignBehaviour({ slug, artistName, onClose }: Props) {
  const [data, setData] = useState<BehaviourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);
  const [uploadObs, setUploadObs] = useState<UploadObservation | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(9999);
  const [showFormats, setShowFormats] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(700);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedUpload(null);
    setUploadObs(null);
    const daysParam = periodDays >= 9999 ? 'max' : String(periodDays);
    fetch(`/api/campaign-behaviour/${slug}?days=${daysParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, periodDays]);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(Math.max(400, entry.contentRect.width));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch upload observation when selected
  useEffect(() => {
    if (!selectedUpload || !data) {
      setUploadObs(null);
      return;
    }
    if (data.uploadObservation?.uploadId === selectedUpload) {
      setUploadObs(data.uploadObservation);
      return;
    }
    const daysParam = periodDays >= 9999 ? 'max' : String(periodDays);
    fetch(`/api/campaign-behaviour/${slug}?days=${daysParam}&upload=${selectedUpload}`)
      .then((r) => r.json())
      .then((d) => setUploadObs(d.uploadObservation ?? null))
      .catch(() => setUploadObs(null));
  }, [selectedUpload, slug, data, periodDays]);

  const selectedUploadData = useMemo(() => {
    if (!selectedUpload || !data) return null;
    return data.uploads.find((u) => u.id === selectedUpload) ?? null;
  }, [selectedUpload, data]);

  // Headline
  const headline = useMemo(() => (data ? generateHeadline(data) : ''), [data]);

  // What We're Learning computations
  const learningData = useMemo(() => {
    if (!data) return null;

    const strongest = data.formatBreakdown
      .filter((f) => f.meta.isLongform && f.count >= 1)
      .sort((a, b) => b.avgViews - a.avgViews)[0] || null;

    const shorts = data.formatBreakdown.find((f) => f.format === 'short') || null;

    // Notable insight
    let notableText = '';
    let notableDetail = '';

    const lastLF = [...data.uploads]
      .filter((u) => u.formatMeta.isLongform)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    const daysSinceLastLF = lastLF
      ? Math.round(
          (new Date(data.observationWindow.endDate).getTime() -
            new Date(lastLF.publishedAt).getTime()) /
            86400000,
        )
      : null;

    const lfGaps = [...data.gaps]
      .filter((g) => g.type === 'longform_only')
      .sort((a, b) => b.durationDays - a.durationDays);
    const allGaps = [...data.gaps]
      .filter((g) => g.type === 'all_content')
      .sort((a, b) => b.durationDays - a.durationDays);

    if (daysSinceLastLF != null && daysSinceLastLF >= 14) {
      notableText = `${daysSinceLastLF} days since last long-form`;
      notableDetail = lastLF ? `Last: ${formatDate(lastLF.publishedAt)}` : '';
    } else if (lfGaps[0] && lfGaps[0].durationDays >= 21) {
      notableText = `${lfGaps[0].durationDays}-day long-form gap`;
      notableDetail = `${formatDate(lfGaps[0].startDate)} – ${formatDate(lfGaps[0].endDate)}`;
    } else if (allGaps[0] && allGaps[0].durationDays >= 10) {
      notableText = `${allGaps[0].durationDays}-day content gap`;
      notableDetail = `${formatDate(allGaps[0].startDate)} – ${formatDate(allGaps[0].endDate)}`;
    } else if (data.uploads.length >= 3) {
      const daysSinceValues = data.uploads
        .map((u) => u.daysSincePrevious)
        .filter((d): d is number => d != null);
      if (daysSinceValues.length >= 2) {
        const avgCadence =
          daysSinceValues.reduce((s, d) => s + d, 0) / daysSinceValues.length;
        notableText = `Upload every ${avgCadence.toFixed(1)} days`;
        notableDetail = `${data.uploads.length} uploads in window`;
      } else {
        notableText = `${data.uploads.length} uploads`;
        notableDetail = `${data.observationWindow.days}-day window`;
      }
    } else {
      notableText = `${data.uploads.length} total uploads`;
      notableDetail = `${data.observationWindow.days}-day window`;
    }

    return { strongest, shorts, notableText, notableDetail };
  }, [data]);

  const handleExport = useCallback(async () => {
    if (!data) return;
    const svgEl = containerRef.current?.querySelector('svg') as SVGSVGElement | null;
    await exportToPNG(slug, data, headline, svgEl);
  }, [slug, data, headline]);

  const handlePeriodChange = useCallback((days: number) => {
    setPeriodDays(days);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          background: PAPER,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          color: SMOKE,
          fontSize: 13,
        }}
      >
        Loading channel behaviour data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          background: PAPER,
          borderRadius: 12,
          padding: '24px',
          color: SMOKE,
          fontSize: 13,
        }}
      >
        {error === '404'
          ? 'Insufficient historical data for this artist. At least 2 daily snapshots are required.'
          : `Unable to load behaviour data: ${error}`}
      </div>
    );
  }

  const {
    observationWindow,
    uploads,
    formatBreakdown,
    artist,
    lastUpdated,
    baseline,
    availableWindows,
  } = data;

  // Activity state
  const lastUpload = uploads.length > 0 ? uploads[uploads.length - 1] : null;
  const daysSinceLastUpload = lastUpload
    ? Math.round(
        (new Date(observationWindow.endDate).getTime() -
          new Date(lastUpload.publishedAt).getTime()) /
          86400000,
      )
    : null;

  let activityState = 'Unknown';
  if (daysSinceLastUpload != null) {
    if (daysSinceLastUpload <= 7) activityState = 'Active';
    else if (daysSinceLastUpload <= 21) activityState = 'Slowing';
    else activityState = 'Quiet';
  } else if (uploads.length === 0) {
    activityState = 'No uploads';
  }

  const dirLabel: Record<string, string> = {
    accelerating: 'Accelerating',
    stable: 'Stable',
    declining: 'Declining',
    insufficient: '—',
  };
  const dirColor: Record<string, string> = {
    accelerating: MINT,
    stable: SMOKE,
    declining: SIGNAL,
    insufficient: GHOST,
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: PAPER,
        borderRadius: 12,
        padding: '20px 24px',
        border: `1px solid ${BONE}`,
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: SIGNAL,
              }}
            >
              Channel Behaviour
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                color:
                  activityState === 'Active'
                    ? MINT
                    : activityState === 'Slowing'
                      ? SUN
                      : SMOKE,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${activityState === 'Active' ? MINT : activityState === 'Slowing' ? SUN : GHOST}`,
              }}
            >
              {activityState}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{artistName}</div>
          <div style={{ fontSize: 11, color: SMOKE, marginTop: 2 }}>
            {observationWindow.startDate} to {observationWindow.endDate} ·{' '}
            {observationWindow.days} days
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PeriodSelector
            windows={availableWindows || []}
            currentDays={periodDays}
            onSelect={handlePeriodChange}
          />
          <button
            onClick={handleExport}
            style={{
              background: INK,
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            PNG
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: `1px solid ${BONE}`,
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                cursor: 'pointer',
                color: SMOKE,
              }}
            >
              ← Summary
            </button>
          )}
        </div>
      </div>

      {/* ═══ HEADLINE INSIGHT ═══ */}
      {headline && (
        <div
          style={{
            fontSize: 13,
            color: INK,
            lineHeight: 1.5,
            fontStyle: 'italic',
            marginBottom: 12,
            maxWidth: 640,
          }}
        >
          {headline}
        </div>
      )}

      {/* ═══ STORY CHART ═══ */}
      <StoryChart
        data={data}
        startDate={observationWindow.startDate}
        endDate={observationWindow.endDate}
        width={chartWidth}
        hoveredDate={hoveredDate}
        onHover={setHoveredDate}
        selectedUpload={selectedUpload}
        onSelectUpload={setSelectedUpload}
        baseline={baseline}
      />

      {/* ═══ UPLOAD DETAIL PANEL (on marker click) ═══ */}
      {selectedUploadData && (
        <UploadDetailPanel
          upload={selectedUploadData}
          observation={uploadObs}
          onClose={() => setSelectedUpload(null)}
        />
      )}

      {/* ═══ SUMMARY STATS ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
          marginTop: 16,
        }}
      >
        <div
          style={{
            background: 'white',
            border: `1px solid ${BONE}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{uploads.length}</div>
          <div style={{ fontSize: 10, color: SMOKE }}>Uploads</div>
        </div>
        <div
          style={{
            background: 'white',
            border: `1px solid ${BONE}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {uploads.filter((u) => u.formatMeta.isLongform).length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Long-form</div>
        </div>
        <div
          style={{
            background: 'white',
            border: `1px solid ${BONE}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {uploads.filter((u) => u.format === 'short').length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Shorts</div>
        </div>
        <div
          style={{
            background: 'white',
            border: `1px solid ${BONE}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {data.gaps.filter((g) => g.type === 'all_content').length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Gaps (7d+)</div>
        </div>
        {daysSinceLastUpload != null && (
          <div
            style={{
              background: 'white',
              border: `1px solid ${BONE}`,
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: daysSinceLastUpload > 14 ? SIGNAL : INK,
              }}
            >
              {daysSinceLastUpload}d
            </div>
            <div style={{ fontSize: 10, color: SMOKE }}>Since Last Upload</div>
          </div>
        )}
      </div>

      {/* ═══ WHAT WE'RE LEARNING ═══ */}
      {learningData && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: SMOKE,
              marginBottom: 10,
            }}
          >
            What We're Learning
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {/* STRONGEST */}
            {learningData.strongest && (
              <div
                style={{
                  background: 'white',
                  border: `1px solid ${BONE}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: SMOKE,
                    marginBottom: 4,
                  }}
                >
                  Strongest
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 2 }}>
                  {learningData.strongest.meta.label}
                </div>
                <div style={{ fontSize: 11, color: SMOKE }}>
                  {learningData.strongest.count} uploads ·{' '}
                  {formatNum(learningData.strongest.avgViews)} average
                </div>
              </div>
            )}

            {/* SHORTS */}
            {learningData.shorts && learningData.shorts.count > 0 && (
              <div
                style={{
                  background: 'white',
                  border: `1px solid ${BONE}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: SMOKE,
                    marginBottom: 4,
                  }}
                >
                  Shorts
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: dirColor[learningData.shorts.recentDirection] || SMOKE,
                    marginBottom: 2,
                  }}
                >
                  {dirLabel[learningData.shorts.recentDirection] || '—'}
                </div>
                <div style={{ fontSize: 11, color: SMOKE }}>
                  {learningData.shorts.count} uploads · Avg:{' '}
                  {formatNum(learningData.shorts.avgViews)}
                </div>
              </div>
            )}

            {/* NOTABLE */}
            {learningData.notableText && (
              <div
                style={{
                  background: 'white',
                  border: `1px solid ${BONE}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: SMOKE,
                    marginBottom: 4,
                  }}
                >
                  Notable
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 2 }}>
                  {learningData.notableText}
                </div>
                {learningData.notableDetail && (
                  <div style={{ fontSize: 11, color: SMOKE }}>
                    {learningData.notableDetail}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggle format breakdown */}
          <button
            onClick={() => setShowFormats(!showFormats)}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 0',
              fontSize: 11,
              color: SMOKE,
              cursor: 'pointer',
              marginTop: 6,
            }}
          >
            {showFormats ? '← Hide Format Breakdown' : 'View Format Breakdown →'}
          </button>

          {showFormats && <FormatBreakdownPanel breakdown={formatBreakdown} />}
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div style={{ marginTop: 16, fontSize: 10, color: GHOST, textAlign: 'right' }}>
        Last updated:{' '}
        {new Date(lastUpdated).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
