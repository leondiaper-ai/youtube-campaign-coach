'use client';

/**
 * CampaignBehaviour V2 — Content-First Channel Behaviour View
 *
 * Visual story: CHANNEL BASELINE → CONTENT ACTIVITY → FORMAT/TIMING →
 *               CHANNEL RESPONSE → GAPS/CHANGES → CURRENT DIRECTION
 *
 * Architecture: One unified chart with three aligned layers:
 *   1. View velocity (compact, above)
 *   2. Content activity timeline (main spine, center)
 *   3. Subscriber momentum (compact, below)
 *
 * All layers share the same dateToX() function and horizontal axis.
 * Shared crosshair tracks across all layers simultaneously.
 *
 * Long-form uploads are large labelled markers: ● OMV · ★ LIVE · ◆ LYRIC · ■ VIS
 * Shorts are small understated markers.
 * Format sequence is readable without hovering.
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
const ELECTRIC = '#2C25FF';
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

// Format shape paths for SVG markers
function getFormatShape(format: UploadFormat, cx: number, cy: number, size: number): string {
  const s = size;
  switch (format) {
    case 'omv':       // Large filled circle
      return `M${cx},${cy - s} A${s},${s} 0 1,1 ${cx},${cy + s} A${s},${s} 0 1,1 ${cx},${cy - s}`;
    case 'lyric':     // Diamond
      return `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`;
    case 'visualiser': // Square
      return `M${cx - s},${cy - s} L${cx + s},${cy - s} L${cx + s},${cy + s} L${cx - s},${cy + s} Z`;
    case 'live':      // Star (5-point)
      return starPath(cx, cy, s, s * 0.45, 5);
    case 'bts':       // Upward triangle
      return `M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7} Z`;
    case 'audio':     // Hollow diamond
      return `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`;
    case 'short':     // Small downward triangle
      return `M${cx - s},${cy - s * 0.5} L${cx + s},${cy - s * 0.5} L${cx},${cy + s * 0.7} Z`;
    default:          // Hollow circle
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

// ── Chart layout constants ──────────────────────────────────────────────

const M = { left: 56, right: 24, top: 4, bottom: 4 };

// V2: Content activity is the main spine — tallest section
const VELOCITY_H = 100;      // Compact view velocity
const CONTENT_H  = 180;      // Main content spine — tallest
const SUBS_H     = 64;       // Compact subscriber growth
const AXIS_H     = 24;       // Shared date axis
const LAYER_GAP  = 2;        // Gap between layers

const TOTAL_CHART_H = VELOCITY_H + CONTENT_H + SUBS_H + AXIS_H + LAYER_GAP * 3;

// Layer Y offsets (within the SVG, after M.top)
const VELOCITY_Y = 0;
const CONTENT_Y  = VELOCITY_H + LAYER_GAP;
const SUBS_Y     = CONTENT_Y + CONTENT_H + LAYER_GAP;
const AXIS_Y     = SUBS_Y + SUBS_H + LAYER_GAP;

// ── Unified Chart ───────────────────────────────────────────────────────

function UnifiedChart({
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

  function toX(date: string) { return dateToX(date, startDate, endDate, chartW); }

  // ── Shared date axis ticks ──
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
  }, [startDate, endDate, chartW]);

  // ── Velocity data ──
  const velocityValid = data.viewVelocity.filter((d) => d.rollingAvg7d != null);
  const velMax = velocityValid.length > 0 ? Math.max(...velocityValid.map((d) => d.rollingAvg7d!)) : 0;
  const velMin = velocityValid.length > 0 ? Math.min(0, Math.min(...velocityValid.map((d) => d.rollingAvg7d!))) : 0;
  const velRange = velMax - velMin || 1;
  function velToY(val: number) { return VELOCITY_H - ((val - velMin) / velRange) * VELOCITY_H; }

  // Velocity line and area
  const velLineParts = velocityValid.map((p, i) => {
    const x = toX(p.date);
    const y = velToY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const velLine = velLineParts.join(' ');
  const velArea = velocityValid.length > 1
    ? velLine +
      ` L${toX(velocityValid[velocityValid.length - 1].date).toFixed(1)},${VELOCITY_H}` +
      ` L${toX(velocityValid[0].date).toFixed(1)},${VELOCITY_H} Z`
    : '';

  // ── Subscriber data ──
  const subsValid = data.subscriberGains.filter((d) => d.rollingAvg7d != null);
  const subsMax = subsValid.length > 0 ? Math.max(...subsValid.map((d) => d.rollingAvg7d!)) : 0;
  const subsMin = subsValid.length > 0 ? Math.min(0, Math.min(...subsValid.map((d) => d.rollingAvg7d!))) : 0;
  const subsRange = subsMax - subsMin || 1;
  function subsToY(val: number) { return SUBS_H - ((val - subsMin) / subsRange) * SUBS_H; }

  const subsLineParts = subsValid.map((p, i) => {
    const x = toX(p.date);
    const y = subsToY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const subsLine = subsLineParts.join(' ');
  const subsArea = subsValid.length > 1
    ? subsLine +
      ` L${toX(subsValid[subsValid.length - 1].date).toFixed(1)},${SUBS_H}` +
      ` L${toX(subsValid[0].date).toFixed(1)},${SUBS_H} Z`
    : '';

  // ── Content timeline data ──
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

  // Content lane vertical positions
  const contentMidY = CONTENT_H / 2;
  const lfY = contentMidY - 14;    // Long-form markers above center
  const shortY = contentMidY + 30;  // Shorts below center
  const seqY = contentMidY + 6;     // Sequence text line

  // ── Build format sequence string for the content spine ──
  // e.g. "▼ ▼ ▼ → ● OMV → ▼ ▼ → ★ LIVE"
  const sortedUploads = [...data.uploads].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  // ── Hover detection ──
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = mouseX / chartW;
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    const hoverTs = startTs + ratio * (endTs - startTs);
    onHover(new Date(hoverTs).toISOString().slice(0, 10));
  }, [chartW, startDate, endDate, onHover]);

  // Hovered crosshair X
  const hoverX = hoveredDate ? toX(hoveredDate) : null;

  return (
    <svg
      width={width}
      height={svgH}
      style={{ display: 'block', userSelect: 'none' }}
      onMouseLeave={() => onHover(null)}
    >
      <g transform={`translate(${M.left},${M.top})`}>

        {/* ═══ GAP OVERLAYS (span all layers) ═══ */}
        {data.gaps.filter((g) => g.type === 'all_content').map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          const w = Math.max(0, x2 - x1);
          return (
            <rect key={`gap-${i}`}
              x={x1} y={0} width={w} height={VELOCITY_H + CONTENT_H + SUBS_H + LAYER_GAP * 2}
              fill={SIGNAL} opacity={0.04} rx={2}
            />
          );
        })}
        {data.gaps.filter((g) => g.type === 'longform_only').map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          const w = Math.max(0, x2 - x1);
          return (
            <rect key={`lfgap-${i}`}
              x={x1} y={CONTENT_Y} width={w} height={CONTENT_H}
              fill={SUN} opacity={0.06} rx={2}
            />
          );
        })}

        {/* ═══ MILESTONE LINES (span all layers) ═══ */}
        {data.milestones.map((m, i) => {
          const x = toX(m.date);
          if (x < 0 || x > chartW) return null;
          const isCampaignStart = m.type === 'campaign_start';
          return (
            <g key={`ms-${i}`}>
              <line
                x1={x} y1={0} x2={x} y2={VELOCITY_H + CONTENT_H + SUBS_H + LAYER_GAP * 2}
                stroke={isCampaignStart ? GHOST : ELECTRIC}
                strokeWidth={isCampaignStart ? 1 : 1.5}
                strokeDasharray={isCampaignStart ? '3,6' : '6,4'}
                opacity={isCampaignStart ? 0.5 : 0.6}
              />
              <text
                x={x} y={-2}
                textAnchor="middle" fontSize={isCampaignStart ? 8 : 9}
                fill={isCampaignStart ? SMOKE : ELECTRIC}
                fontWeight={isCampaignStart ? 400 : 600}
                opacity={isCampaignStart ? 0.6 : 1}
              >
                {m.label.length > 24 ? m.label.slice(0, 24) + '...' : m.label}
              </text>
            </g>
          );
        })}

        {/* ═══ LAYER 1: VIEW VELOCITY (compact, top) ═══ */}
        <g transform={`translate(0,${VELOCITY_Y})`}>
          {/* Label */}
          <text x={-8} y={12} textAnchor="end" fontSize={9} fill={SIGNAL} fontWeight={600}
            style={{ textTransform: 'uppercase' } as React.CSSProperties}>
            Views
          </text>

          {/* Y-axis reference */}
          <text x={-8} y={VELOCITY_H - 2} textAnchor="end" fontSize={8} fill={GHOST}>0</text>
          {velMax > 0 && (
            <text x={-8} y={14} textAnchor="end" fontSize={8} fill={GHOST}>
              {formatNum(velMax)}
            </text>
          )}

          {/* Grid */}
          <line x1={0} y1={VELOCITY_H} x2={chartW} y2={VELOCITY_H} stroke={BONE} strokeWidth={1} />

          {/* Baseline reference line */}
          {baseline?.avgDailyViews != null && baseline.avgDailyViews > 0 && (
            <g>
              <line
                x1={0} y1={velToY(baseline.avgDailyViews)}
                x2={chartW} y2={velToY(baseline.avgDailyViews)}
                stroke={SMOKE} strokeWidth={1} strokeDasharray="2,4" opacity={0.5}
              />
              <text
                x={chartW + 4} y={velToY(baseline.avgDailyViews) + 3}
                fontSize={7} fill={SMOKE} opacity={0.7}>
                baseline
              </text>
            </g>
          )}

          {/* Area + Line */}
          {velArea && <path d={velArea} fill={SIGNAL} opacity={0.08} />}
          {velLine && <path d={velLine} fill="none" stroke={SIGNAL} strokeWidth={1.5} />}

          {/* Hover dot */}
          {hoveredDate && (() => {
            const point = data.viewVelocity.find((d) => d.date === hoveredDate);
            if (!point?.rollingAvg7d) return null;
            const x = toX(hoveredDate);
            const y = velToY(point.rollingAvg7d);
            if (x < 0 || x > chartW) return null;
            return (
              <g>
                <circle cx={x} cy={y} r={4} fill={SIGNAL} />
                <rect x={x - 32} y={y - 20} width={64} height={16} rx={3} fill={INK} opacity={0.9} />
                <text x={x} y={y - 9} textAnchor="middle" fontSize={9} fill="white" fontWeight={600}>
                  {formatNum(point.rollingAvg7d)}/d
                </text>
              </g>
            );
          })()}
        </g>

        {/* ═══ LAYER 2: CONTENT ACTIVITY (main spine, center) ═══ */}
        <g transform={`translate(0,${CONTENT_Y})`}>
          {/* Background */}
          <rect x={0} y={0} width={chartW} height={CONTENT_H} fill="white" opacity={0.3} rx={4} />

          {/* Label */}
          <text x={-8} y={14} textAnchor="end" fontSize={9} fill={INK} fontWeight={700}
            style={{ textTransform: 'uppercase' } as React.CSSProperties}>
            Content
          </text>
          <text x={-8} y={lfY + 4} textAnchor="end" fontSize={7} fill={SMOKE}>LF</text>
          <text x={-8} y={shortY + 3} textAnchor="end" fontSize={7} fill={SMOKE}>S</text>

          {/* Center reference line */}
          <line x1={0} y1={contentMidY} x2={chartW} y2={contentMidY}
            stroke={BONE} strokeWidth={1} opacity={0.5} />

          {/* Gap duration labels */}
          {data.gaps.filter((g) => g.type === 'all_content' && g.durationDays >= 7).map((gap, i) => {
            const x1 = Math.max(0, toX(gap.startDate));
            const x2 = Math.min(chartW, toX(gap.endDate));
            const cx = (x1 + x2) / 2;
            return (
              <g key={`gl-${i}`}>
                <text x={cx} y={contentMidY - 2} textAnchor="middle"
                  fontSize={9} fill={SIGNAL} fontWeight={700} opacity={0.6}>
                  {gap.durationDays}d gap
                </text>
              </g>
            );
          })}

          {/* Long-form gap labels */}
          {data.gaps.filter((g) => g.type === 'longform_only' && g.durationDays >= 14).map((gap, i) => {
            const x1 = Math.max(0, toX(gap.startDate));
            const x2 = Math.min(chartW, toX(gap.endDate));
            const cx = (x1 + x2) / 2;
            return (
              <text key={`lfgl-${i}`} x={cx} y={lfY - 18} textAnchor="middle"
                fontSize={8} fill={SUN} fontWeight={600} opacity={0.8}>
                {gap.durationDays}d no long-form
              </text>
            );
          })}

          {/* Short groups — small understated markers */}
          {shortGroups.map((group, i) => {
            const isSelected = group.uploads.some((u) => u.id === selectedUpload);
            return (
              <g key={`sg-${i}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectUpload(group.uploads[0].id)}
              >
                <path
                  d={getFormatShape('short', group.x, shortY, group.count > 1 ? 5 : 4)}
                  fill={FORMAT_COLORS.short}
                  opacity={isSelected ? 1 : 0.5}
                />
                {group.count > 1 && (
                  <text x={group.x} y={shortY + 14} textAnchor="middle"
                    fontSize={7} fill={SMOKE} opacity={0.7}>
                    x{group.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Long-form markers — LARGE, labelled, very obvious */}
          {longform.map((u) => {
            const x = toX(u.publishedAt);
            const isSelected = selectedUpload === u.id;
            const size = isSelected ? 12 : 10;

            return (
              <g key={u.id} style={{ cursor: 'pointer' }}
                onClick={() => onSelectUpload(isSelected ? null : u.id)}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle cx={x} cy={lfY} r={size + 5}
                    fill="none" stroke={FORMAT_COLORS[u.format]} strokeWidth={2}
                    opacity={0.3}
                  />
                )}

                {/* Connector line from marker to sequence row */}
                <line x1={x} y1={lfY + size + 2} x2={x} y2={seqY - 2}
                  stroke={FORMAT_COLORS[u.format]} strokeWidth={1} opacity={0.2}
                />

                {/* The marker — big and obvious */}
                <path
                  d={getFormatShape(u.format, x, lfY, size)}
                  fill={u.format === 'audio' ? 'none' : FORMAT_COLORS[u.format]}
                  stroke={FORMAT_COLORS[u.format]}
                  strokeWidth={u.format === 'audio' ? 2.5 : isSelected ? 2 : 0}
                  opacity={isSelected ? 1 : 0.9}
                />

                {/* Format label — ALWAYS visible, below marker */}
                <text x={x} y={lfY + size + 14} textAnchor="middle"
                  fontSize={9} fill={FORMAT_COLORS[u.format]} fontWeight={700}>
                  {u.formatMeta.shortLabel}
                </text>

                {/* View count below label */}
                <text x={x} y={lfY + size + 24} textAnchor="middle"
                  fontSize={7} fill={SMOKE}>
                  {formatNum(u.viewCount)}
                </text>
              </g>
            );
          })}

          {/* Bottom border */}
          <line x1={0} y1={CONTENT_H} x2={chartW} y2={CONTENT_H} stroke={BONE} strokeWidth={1} />
        </g>

        {/* ═══ LAYER 3: SUBSCRIBER GROWTH (compact, bottom) ═══ */}
        <g transform={`translate(0,${SUBS_Y})`}>
          {/* Label */}
          <text x={-8} y={12} textAnchor="end" fontSize={9} fill={MINT} fontWeight={600}
            style={{ textTransform: 'uppercase' } as React.CSSProperties}>
            Subs
          </text>

          {/* Zero line */}
          {subsMin < 0 && (
            <line x1={0} y1={subsToY(0)} x2={chartW} y2={subsToY(0)}
              stroke={SMOKE} strokeWidth={1} opacity={0.3} />
          )}

          {/* Baseline reference line */}
          {baseline?.avgDailySubs != null && (
            <g>
              <line
                x1={0} y1={subsToY(baseline.avgDailySubs)}
                x2={chartW} y2={subsToY(baseline.avgDailySubs)}
                stroke={SMOKE} strokeWidth={1} strokeDasharray="2,4" opacity={0.5}
              />
            </g>
          )}

          {/* Area + Line */}
          {subsArea && <path d={subsArea} fill={MINT} opacity={0.08} />}
          {subsLine && <path d={subsLine} fill="none" stroke={MINT} strokeWidth={1.5} />}

          {/* Hover dot */}
          {hoveredDate && (() => {
            const point = data.subscriberGains.find((d) => d.date === hoveredDate);
            if (!point?.rollingAvg7d) return null;
            const x = toX(hoveredDate);
            const y = subsToY(point.rollingAvg7d);
            if (x < 0 || x > chartW) return null;
            return <circle cx={x} cy={y} r={3} fill={MINT} />;
          })()}

          {/* Bottom border */}
          <line x1={0} y1={SUBS_H} x2={chartW} y2={SUBS_H} stroke={BONE} strokeWidth={1} />
        </g>

        {/* ═══ SHARED DATE AXIS ═══ */}
        <g transform={`translate(0,${AXIS_Y})`}>
          {axisTicks.map((tick, i) => (
            <g key={i}>
              <line x1={tick.x} y1={0} x2={tick.x} y2={4} stroke={BONE} strokeWidth={1} />
              <text x={tick.x} y={16} textAnchor="middle" fontSize={9} fill={SMOKE}>
                {formatDate(tick.date)}
              </text>
            </g>
          ))}
        </g>

        {/* ═══ SHARED CROSSHAIR (spans all layers) ═══ */}
        {hoverX != null && hoverX >= 0 && hoverX <= chartW && (
          <line
            x1={hoverX} y1={0}
            x2={hoverX} y2={VELOCITY_H + CONTENT_H + SUBS_H + LAYER_GAP * 2}
            stroke={INK} strokeWidth={1} opacity={0.12}
          />
        )}

        {/* Date label at crosshair */}
        {hoveredDate && hoverX != null && hoverX >= 0 && hoverX <= chartW && (
          <g transform={`translate(0,${AXIS_Y})`}>
            <rect x={hoverX - 24} y={-2} width={48} height={14} rx={3} fill={INK} opacity={0.85} />
            <text x={hoverX} y={9} textAnchor="middle" fontSize={8} fill="white" fontWeight={600}>
              {formatDate(hoveredDate)}
            </text>
          </g>
        )}

        {/* ═══ HOVER DETECTION OVERLAY ═══ */}
        <rect
          x={0} y={0}
          width={chartW} height={VELOCITY_H + CONTENT_H + SUBS_H + LAYER_GAP * 2}
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
  upload, observation, onClose,
}: {
  upload: ClassifiedUpload;
  observation: UploadObservation | null;
  onClose: () => void;
}) {
  const afterLabel = upload.formatMeta.isLongform ? '14 Days After' : '7 Days After';

  return (
    <div style={{
      background: 'white', border: `1px solid ${BONE}`, borderRadius: 10,
      padding: '16px 20px', marginTop: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              background: FORMAT_COLORS[upload.format],
              color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px',
              borderRadius: 4, textTransform: 'uppercase',
            }}>
              {upload.formatMeta.label}
            </span>
            <span style={{ fontSize: 12, color: SMOKE }}>{formatDate(upload.publishedAt)}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{upload.title}</div>
          <div style={{ fontSize: 12, color: SMOKE, marginTop: 2 }}>
            {formatNum(upload.viewCount)} views
            {upload.daysSincePrevious != null && ` · ${upload.daysSincePrevious}d since previous upload`}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: SMOKE,
          padding: '0 4px',
        }}>
          ×
        </button>
      </div>

      {observation && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: PAPER, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: SMOKE, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
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
            <div style={{ fontSize: 9, color: SMOKE, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              {afterLabel}
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

      {observation?.nextUpload && (
        <div style={{ fontSize: 12, color: SMOKE, marginBottom: 4 }}>
          Next upload: <strong style={{ color: INK }}>{observation.nextUpload.title}</strong>
          {' '}— Day +{observation.nextUpload.daysAfter}
        </div>
      )}
      {observation?.nextLongform && observation.nextLongform.daysAfter !== observation.nextUpload?.daysAfter && (
        <div style={{ fontSize: 12, color: SMOKE, marginBottom: 4 }}>
          Next long-form: <strong style={{ color: INK }}>{observation.nextLongform.title}</strong>
          {' '}— Day +{observation.nextLongform.daysAfter}
        </div>
      )}

      {observation?.observation && (
        <div style={{
          fontSize: 12, color: INK, lineHeight: 1.5,
          borderTop: `1px solid ${BONE}`, paddingTop: 8, marginTop: 8,
          fontStyle: 'italic',
        }}>
          {observation.observation}
        </div>
      )}
    </div>
  );
}

// ── Format legend ────────────────────────────────────────────────────────

function FormatLegend({ breakdown }: { breakdown: FormatBreakdown[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
      {breakdown.map((fb) => (
        <div key={fb.format} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={14} height={14}>
            <path
              d={getFormatShape(fb.format, 7, 7, 5)}
              fill={fb.format === 'audio' ? 'none' : FORMAT_COLORS[fb.format]}
              stroke={FORMAT_COLORS[fb.format]}
              strokeWidth={fb.format === 'audio' ? 1.5 : 0}
            />
          </svg>
          <span style={{ fontSize: 10, color: SMOKE }}>
            {fb.meta.label} ({fb.count})
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Baseline panel ──────────────────────────────────────────────────────

function BaselinePanel({ baseline }: { baseline: Baseline }) {
  return (
    <div style={{
      background: 'white', border: `1px solid ${BONE}`, borderRadius: 8,
      padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'center',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: SMOKE }}>
        Pre-Activity Baseline
      </div>
      <div style={{ fontSize: 9, color: GHOST }}>
        {baseline.period.days}d average before first upload
      </div>
      {baseline.avgDailyViews != null && (
        <div style={{ fontSize: 12, color: INK }}>
          <span style={{ color: SIGNAL, fontWeight: 600 }}>{formatNum(baseline.avgDailyViews)}</span>
          <span style={{ fontSize: 9, color: SMOKE }}> views/day</span>
        </div>
      )}
      {baseline.avgDailySubs != null && (
        <div style={{ fontSize: 12, color: INK }}>
          <span style={{ color: MINT, fontWeight: 600 }}>{baseline.avgDailySubs >= 0 ? '+' : ''}{formatNum(baseline.avgDailySubs)}</span>
          <span style={{ fontSize: 9, color: SMOKE }}> subs/day</span>
        </div>
      )}
    </div>
  );
}

// ── Learnings panel ──────────────────────────────────────────────────────

function LearningsPanel({ learnings }: { learnings: Learning[] }) {
  if (learnings.length === 0) return null;

  const confColor: Record<Learning['confidence'], string> = {
    observation: SMOKE,
    pattern: ELECTRIC,
    strong: MINT,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SMOKE, marginBottom: 8 }}>
        Observations
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {learnings.map((l, i) => (
          <div key={i} style={{
            background: 'white', border: `1px solid ${BONE}`, borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: 13, color: INK, lineHeight: 1.5, marginBottom: 4 }}>
              {l.text}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: SMOKE }}>{l.evidence}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                color: confColor[l.confidence],
                padding: '1px 6px', borderRadius: 3,
                border: `1px solid ${confColor[l.confidence]}`,
              }}>
                {l.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Format breakdown panel ───────────────────────────────────────────────

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
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SMOKE, marginBottom: 8 }}>
        Format Performance
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
        {breakdown.map((fb) => (
          <div key={fb.format} style={{
            background: 'white', border: `1px solid ${BONE}`, borderRadius: 8,
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <svg width={12} height={12}>
                <path
                  d={getFormatShape(fb.format, 6, 6, 4)}
                  fill={fb.format === 'audio' ? 'none' : FORMAT_COLORS[fb.format]}
                  stroke={FORMAT_COLORS[fb.format]}
                  strokeWidth={fb.format === 'audio' ? 1.5 : 0}
                />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{fb.meta.label}</span>
            </div>
            <div style={{ fontSize: 11, color: SMOKE, lineHeight: 1.6 }}>
              <div>{fb.count} upload{fb.count !== 1 ? 's' : ''} · Avg: {formatNum(fb.avgViews)}</div>
              {fb.count >= 3 && <div>Median: {formatNum(fb.medianViews)}</div>}
              <div style={{ color: dirColor[fb.recentDirection] }}>
                {dirLabel[fb.recentDirection]}
              </div>
            </div>
          </div>
        ))}
      </div>
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
      {windows.filter((w) => w.available).map((w) => {
        const isActive = (w.days >= 9999 && currentDays >= 9999) ||
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

// ── PNG Export (native SVG-to-Canvas) ────────────────────────────────────

async function exportToPNG(
  slug: string,
  data: BehaviourData,
  chartSvgElement: SVGSVGElement | null,
): Promise<void> {
  if (!chartSvgElement) return;

  const W = 1920;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;  // 2x for retina
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Header area
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('CHANNEL BEHAVIOUR', 40, 40);
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(data.artist.name, 40, 72);
  ctx.fillStyle = SMOKE;
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${data.observationWindow.label} · ${data.observationWindow.startDate} to ${data.observationWindow.endDate}`,
    40, 96
  );

  // Current state badge
  if (data.artist.channelState) {
    ctx.fillStyle = SIGNAL;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.fillText(data.artist.channelState.toUpperCase(), W - 200, 40);
  }

  // Chart SVG → Image → Canvas
  try {
    const svgClone = chartSvgElement.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', String(W - 80));
    svgClone.setAttribute('height', '500');
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    ctx.drawImage(img, 40, 120, W - 80, 500);
    URL.revokeObjectURL(url);
  } catch {
    // If SVG rendering fails, draw a placeholder
    ctx.fillStyle = BONE;
    ctx.fillRect(40, 120, W - 80, 500);
    ctx.fillStyle = SMOKE;
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillText('Chart rendering — see live view', W / 2 - 120, 370);
  }

  // Key observations (bottom left)
  const obsY = 660;
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('KEY OBSERVATIONS', 40, obsY);
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillStyle = INK;
  data.learnings.slice(0, 3).forEach((l, i) => {
    const y = obsY + 22 + i * 36;
    ctx.fillStyle = INK;
    ctx.fillText(`${i + 1}. ${l.text}`, 40, y);
    ctx.fillStyle = SMOKE;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(l.evidence, 56, y + 16);
    ctx.font = '13px Inter, system-ui, sans-serif';
  });

  // Format performance (bottom right)
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('FORMAT PERFORMANCE', W / 2 + 40, obsY);
  ctx.font = '12px Inter, system-ui, sans-serif';
  data.formatBreakdown.slice(0, 6).forEach((fb, i) => {
    const y = obsY + 22 + i * 22;
    ctx.fillStyle = FORMAT_COLORS[fb.format];
    ctx.fillText('●', W / 2 + 40, y);
    ctx.fillStyle = INK;
    ctx.fillText(`${fb.meta.label}: ${fb.count} uploads, avg ${formatNum(fb.avgViews)} views`, W / 2 + 56, y);
  });

  // Summary stats
  const statsY = obsY + 22 + Math.max(data.learnings.length * 36, data.formatBreakdown.length * 22) + 20;
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('SUMMARY', 40, statsY);
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillStyle = SMOKE;
  const totalUploads = data.uploads.length;
  const lfCount = data.uploads.filter((u) => u.formatMeta.isLongform).length;
  const shortCount = data.uploads.filter((u) => u.format === 'short').length;
  ctx.fillText(
    `${totalUploads} uploads (${lfCount} long-form, ${shortCount} Shorts) · ${data.gaps.filter((g) => g.type === 'all_content').length} content gaps`,
    40, statsY + 18
  );

  // Footer
  ctx.fillStyle = GHOST;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText(
    `YouTube Campaign Coach · Last updated: ${new Date(data.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    40, H - 24
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
  const [periodDays, setPeriodDays] = useState<number>(9999); // Default to MAX
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement>(null);
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
    if (!selectedUpload || !data) { setUploadObs(null); return; }
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

  const handleExport = useCallback(async () => {
    if (!data) return;
    // Find the SVG element inside our container
    const svgEl = containerRef.current?.querySelector('svg') as SVGSVGElement | null;
    await exportToPNG(slug, data, svgEl);
  }, [slug, data]);

  const handlePeriodChange = useCallback((days: number) => {
    setPeriodDays(days);
  }, []);

  if (loading) {
    return (
      <div style={{
        background: PAPER, borderRadius: 12, padding: '40px 24px',
        textAlign: 'center', color: SMOKE, fontSize: 13,
      }}>
        Loading channel behaviour data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: PAPER, borderRadius: 12, padding: '24px',
        color: SMOKE, fontSize: 13,
      }}>
        {error === '404'
          ? 'Insufficient historical data for this artist. At least 2 daily snapshots are required.'
          : `Unable to load behaviour data: ${error}`
        }
      </div>
    );
  }

  const { observationWindow, uploads, formatBreakdown, learnings, artist, lastUpdated, baseline, availableWindows } = data;

  // Determine activity state for the header
  const lastUpload = uploads.length > 0 ? uploads[uploads.length - 1] : null;
  const daysSinceLastUpload = lastUpload
    ? Math.round((new Date(observationWindow.endDate).getTime() - new Date(lastUpload.publishedAt).getTime()) / 86400000)
    : null;

  let activityState = 'Unknown';
  if (daysSinceLastUpload != null) {
    if (daysSinceLastUpload <= 7) activityState = 'Active';
    else if (daysSinceLastUpload <= 21) activityState = 'Slowing';
    else activityState = 'Quiet';
  } else if (uploads.length === 0) {
    activityState = 'No uploads in window';
  }

  return (
    <div ref={containerRef} style={{
      background: PAPER, borderRadius: 12, padding: '20px 24px',
      border: `1px solid ${BONE}`,
    }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SIGNAL }}>
              Channel Behaviour
            </span>
            <span style={{
              fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
              color: activityState === 'Active' ? MINT : activityState === 'Slowing' ? SUN : SMOKE,
              padding: '1px 6px', borderRadius: 3,
              border: `1px solid ${activityState === 'Active' ? MINT : activityState === 'Slowing' ? SUN : GHOST}`,
            }}>
              {activityState}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{artistName}</div>
          <div style={{ fontSize: 11, color: SMOKE, marginTop: 2 }}>
            {observationWindow.startDate} to {observationWindow.endDate} · {observationWindow.days} days
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Period selector */}
          <PeriodSelector
            windows={availableWindows || []}
            currentDays={periodDays}
            onSelect={handlePeriodChange}
          />
          <button onClick={handleExport} style={{
            background: INK, color: 'white', border: 'none', borderRadius: 6,
            padding: '6px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}>
            PNG
          </button>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: `1px solid ${BONE}`, borderRadius: 6,
              padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: SMOKE,
            }}>
              ← Summary
            </button>
          )}
        </div>
      </div>

      {/* ═══ FORMAT LEGEND ═══ */}
      <div style={{ marginBottom: 8 }}>
        <FormatLegend breakdown={formatBreakdown} />
      </div>

      {/* ═══ BASELINE (if available) ═══ */}
      {baseline && <div style={{ marginBottom: 8 }}><BaselinePanel baseline={baseline} /></div>}

      {/* ═══ UNIFIED CHART ═══ */}
      <UnifiedChart
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

      {/* ═══ UPLOAD DETAIL PANEL ═══ */}
      {selectedUploadData && (
        <UploadDetailPanel
          upload={selectedUploadData}
          observation={uploadObs}
          onClose={() => setSelectedUpload(null)}
        />
      )}

      {/* ═══ SUMMARY STATS ═══ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 8, marginTop: 16,
      }}>
        <div style={{ background: 'white', border: `1px solid ${BONE}`, borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{uploads.length}</div>
          <div style={{ fontSize: 10, color: SMOKE }}>Uploads</div>
        </div>
        <div style={{ background: 'white', border: `1px solid ${BONE}`, borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {uploads.filter((u) => u.formatMeta.isLongform).length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Long-form</div>
        </div>
        <div style={{ background: 'white', border: `1px solid ${BONE}`, borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {uploads.filter((u) => u.format === 'short').length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Shorts</div>
        </div>
        <div style={{ background: 'white', border: `1px solid ${BONE}`, borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            {data.gaps.filter((g) => g.type === 'all_content').length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Gaps (7d+)</div>
        </div>
        {daysSinceLastUpload != null && (
          <div style={{ background: 'white', border: `1px solid ${BONE}`, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: daysSinceLastUpload > 14 ? SIGNAL : INK }}>
              {daysSinceLastUpload}d
            </div>
            <div style={{ fontSize: 10, color: SMOKE }}>Since Last Upload</div>
          </div>
        )}
      </div>

      {/* ═══ LEARNINGS ═══ */}
      <LearningsPanel learnings={learnings} />

      {/* ═══ FORMAT BREAKDOWN ═══ */}
      <FormatBreakdownPanel breakdown={formatBreakdown} />

      {/* ═══ FOOTER ═══ */}
      <div style={{ marginTop: 16, fontSize: 10, color: GHOST, textAlign: 'right' }}>
        Last updated: {new Date(lastUpdated).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </div>
    </div>
  );
}
