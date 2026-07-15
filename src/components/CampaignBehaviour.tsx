'use client';

/**
 * CampaignBehaviour — Live Channel Behaviour View
 *
 * Visualises the relationship between content activity and channel behaviour.
 * Three aligned layers sharing the same date axis:
 *   1. View velocity (7-day rolling average of daily view gains)
 *   2. Subscriber momentum (7-day rolling subscriber gains)
 *   3. Content activity timeline (classified upload markers)
 *
 * Overlays: content gaps, long-form gaps, campaign milestones.
 * Click an upload to see before/after observation window.
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
    case 'audio':     // Hollow diamond (rendered with stroke, no fill)
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

// ── Chart components ─────────────────────────────────────────────────────

const CHART_MARGIN = { left: 56, right: 16, top: 8, bottom: 4 };
const VIEW_CHART_HEIGHT = 160;
const SUBS_CHART_HEIGHT = 80;
const CONTENT_LANE_HEIGHT = 100;
const GAP_BETWEEN = 8;

function ViewVelocityChart({
  data, startDate, endDate, width, gaps, milestones, hoveredDate, onHover,
}: {
  data: VelocityPoint[];
  startDate: string;
  endDate: string;
  width: number;
  gaps: ContentGap[];
  milestones: Milestone[];
  hoveredDate: string | null;
  onHover: (date: string | null) => void;
}) {
  const chartW = width - CHART_MARGIN.left - CHART_MARGIN.right;
  const chartH = VIEW_CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

  // Only use rolling average for the area/line
  const validPoints = data.filter((d) => d.rollingAvg7d != null);
  if (validPoints.length < 3) {
    return (
      <div style={{ height: VIEW_CHART_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SMOKE, fontSize: 13 }}>
        Insufficient view data for velocity chart
      </div>
    );
  }

  const maxVal = Math.max(...validPoints.map((d) => d.rollingAvg7d!));
  const minVal = Math.min(0, Math.min(...validPoints.map((d) => d.rollingAvg7d!)));
  const range = maxVal - minVal || 1;

  function toX(date: string) { return dateToX(date, startDate, endDate, chartW); }
  function toY(val: number) { return chartH - ((val - minVal) / range) * chartH; }

  // Build SVG path for rolling average
  const lineParts = validPoints.map((p, i) => {
    const x = toX(p.date);
    const y = toY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = lineParts.join(' ');

  // Area fill
  const areaPath = linePath +
    ` L${toX(validPoints[validPoints.length - 1].date).toFixed(1)},${chartH}` +
    ` L${toX(validPoints[0].date).toFixed(1)},${chartH} Z`;

  // Y-axis labels
  const yTicks = [0, Math.round(maxVal / 2), Math.round(maxVal)];

  return (
    <svg
      width={width}
      height={VIEW_CHART_HEIGHT}
      style={{ display: 'block' }}
      onMouseLeave={() => onHover(null)}
    >
      <g transform={`translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`}>
        {/* Y-axis grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={0} y1={toY(tick)} x2={chartW} y2={toY(tick)}
              stroke={BONE} strokeWidth={1} strokeDasharray="4,4"
            />
            <text x={-8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill={SMOKE}>
              {formatNum(tick)}
            </text>
          </g>
        ))}

        {/* Gap overlays */}
        {gaps.filter((g) => g.type === 'all_content').map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          return (
            <rect key={`gap-${i}`}
              x={x1} y={0} width={Math.max(0, x2 - x1)} height={chartH}
              fill={SIGNAL} opacity={0.06} rx={2}
            />
          );
        })}

        {/* Long-form gaps */}
        {gaps.filter((g) => g.type === 'longform_only').map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          return (
            <rect key={`lfgap-${i}`}
              x={x1} y={0} width={Math.max(0, x2 - x1)} height={chartH}
              fill={SUN} opacity={0.08} rx={2}
            />
          );
        })}

        {/* Milestone lines */}
        {milestones.map((m, i) => {
          const x = toX(m.date);
          if (x < 0 || x > chartW) return null;
          return (
            <g key={`ms-${i}`}>
              <line x1={x} y1={0} x2={x} y2={chartH}
                stroke={ELECTRIC} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.6}
              />
              <text x={x} y={-2} textAnchor="middle" fontSize={9} fill={ELECTRIC} fontWeight={600}>
                {m.label.length > 20 ? m.label.slice(0, 20) + '...' : m.label}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {minVal < 0 && (
          <line x1={0} y1={toY(0)} x2={chartW} y2={toY(0)}
            stroke={SMOKE} strokeWidth={1} opacity={0.4}
          />
        )}

        {/* Area fill */}
        <path d={areaPath} fill={SIGNAL} opacity={0.1} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={SIGNAL} strokeWidth={2} />

        {/* Hover detection overlay */}
        <rect x={0} y={0} width={chartW} height={chartH} fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const ratio = mouseX / chartW;
            const startTs = new Date(startDate).getTime();
            const endTs = new Date(endDate).getTime();
            const hoverTs = startTs + ratio * (endTs - startTs);
            const hoverDate = new Date(hoverTs).toISOString().slice(0, 10);
            onHover(hoverDate);
          }}
        />

        {/* Hover crosshair */}
        {hoveredDate && (() => {
          const x = toX(hoveredDate);
          const point = data.find((d) => d.date === hoveredDate);
          if (x < 0 || x > chartW) return null;
          return (
            <g>
              <line x1={x} y1={0} x2={x} y2={chartH} stroke={INK} strokeWidth={1} opacity={0.2} />
              {point?.rollingAvg7d != null && (
                <>
                  <circle cx={x} cy={toY(point.rollingAvg7d)} r={4} fill={SIGNAL} />
                  <rect x={x - 36} y={toY(point.rollingAvg7d) - 22} width={72} height={18}
                    rx={4} fill={INK} opacity={0.9}
                  />
                  <text x={x} y={toY(point.rollingAvg7d) - 10} textAnchor="middle"
                    fontSize={10} fill="white" fontWeight={600}>
                    {formatNum(point.rollingAvg7d)} /day
                  </text>
                </>
              )}
            </g>
          );
        })()}
      </g>
    </svg>
  );
}

function SubsGainsChart({
  data, startDate, endDate, width, hoveredDate, onHover,
}: {
  data: SubsPoint[];
  startDate: string;
  endDate: string;
  width: number;
  hoveredDate: string | null;
  onHover: (date: string | null) => void;
}) {
  const chartW = width - CHART_MARGIN.left - CHART_MARGIN.right;
  const chartH = SUBS_CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

  const validPoints = data.filter((d) => d.rollingAvg7d != null);
  if (validPoints.length < 3) {
    return (
      <div style={{ height: SUBS_CHART_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SMOKE, fontSize: 13 }}>
        Insufficient subscriber data
      </div>
    );
  }

  const maxVal = Math.max(...validPoints.map((d) => d.rollingAvg7d!));
  const minVal = Math.min(0, Math.min(...validPoints.map((d) => d.rollingAvg7d!)));
  const range = maxVal - minVal || 1;

  function toX(date: string) { return dateToX(date, startDate, endDate, chartW); }
  function toY(val: number) { return chartH - ((val - minVal) / range) * chartH; }

  const lineParts = validPoints.map((p, i) => {
    const x = toX(p.date);
    const y = toY(p.rollingAvg7d!);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = lineParts.join(' ');

  const areaPath = linePath +
    ` L${toX(validPoints[validPoints.length - 1].date).toFixed(1)},${chartH}` +
    ` L${toX(validPoints[0].date).toFixed(1)},${chartH} Z`;

  return (
    <svg width={width} height={SUBS_CHART_HEIGHT} style={{ display: 'block' }}
      onMouseLeave={() => onHover(null)}
    >
      <g transform={`translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`}>
        {/* Zero line */}
        {minVal < 0 && (
          <line x1={0} y1={toY(0)} x2={chartW} y2={toY(0)}
            stroke={SMOKE} strokeWidth={1} opacity={0.3}
          />
        )}

        {/* Y labels */}
        <text x={-8} y={toY(maxVal) + 4} textAnchor="end" fontSize={9} fill={SMOKE}>
          +{formatNum(maxVal)}
        </text>
        <text x={-8} y={chartH} textAnchor="end" fontSize={9} fill={SMOKE}>
          {minVal < 0 ? formatNum(minVal) : '0'}
        </text>

        <path d={areaPath} fill={MINT} opacity={0.1} />
        <path d={linePath} fill="none" stroke={MINT} strokeWidth={1.5} />

        {/* Hover */}
        <rect x={0} y={0} width={chartW} height={chartH} fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const ratio = mouseX / chartW;
            const startTs = new Date(startDate).getTime();
            const endTs = new Date(endDate).getTime();
            const hoverDate = new Date(startTs + ratio * (endTs - startTs)).toISOString().slice(0, 10);
            onHover(hoverDate);
          }}
        />

        {hoveredDate && (() => {
          const x = toX(hoveredDate);
          const point = data.find((d) => d.date === hoveredDate);
          if (x < 0 || x > chartW) return null;
          return (
            <g>
              <line x1={x} y1={0} x2={x} y2={chartH} stroke={INK} strokeWidth={1} opacity={0.2} />
              {point?.rollingAvg7d != null && (
                <circle cx={x} cy={toY(point.rollingAvg7d)} r={3} fill={MINT} />
              )}
            </g>
          );
        })()}
      </g>
    </svg>
  );
}

function ContentTimeline({
  uploads, startDate, endDate, width, gaps,
  selectedUpload, onSelectUpload, hoveredDate,
}: {
  uploads: ClassifiedUpload[];
  startDate: string;
  endDate: string;
  width: number;
  gaps: ContentGap[];
  selectedUpload: string | null;
  onSelectUpload: (id: string | null) => void;
  hoveredDate: string | null;
}) {
  const chartW = width - CHART_MARGIN.left - CHART_MARGIN.right;
  const longform = uploads.filter((u) => u.formatMeta.isLongform);
  const shorts = uploads.filter((u) => u.format === 'short');

  function toX(date: string) { return dateToX(date, startDate, endDate, chartW); }

  // Group nearby shorts (within 2 days)
  const shortGroups: { x: number; count: number; uploads: ClassifiedUpload[] }[] = [];
  for (const s of shorts) {
    const x = toX(s.publishedAt);
    const existing = shortGroups.find((g) => Math.abs(g.x - x) < 12);
    if (existing) {
      existing.count++;
      existing.uploads.push(s);
    } else {
      shortGroups.push({ x, count: 1, uploads: [s] });
    }
  }

  const longformY = 24;
  const shortsY = 68;
  const timelineY = 90;

  return (
    <svg width={width} height={CONTENT_LANE_HEIGHT} style={{ display: 'block' }}>
      <g transform={`translate(${CHART_MARGIN.left},0)`}>
        {/* Date axis labels */}
        {(() => {
          const tickCount = Math.min(6, Math.floor(chartW / 80));
          const startTs = new Date(startDate).getTime();
          const endTs = new Date(endDate).getTime();
          const step = (endTs - startTs) / tickCount;
          return Array.from({ length: tickCount + 1 }).map((_, i) => {
            const ts = startTs + step * i;
            const date = new Date(ts).toISOString().slice(0, 10);
            const x = toX(date);
            return (
              <text key={i} x={x} y={timelineY + 6} textAnchor="middle" fontSize={9} fill={SMOKE}>
                {formatDate(date)}
              </text>
            );
          });
        })()}

        {/* Timeline axis line */}
        <line x1={0} y1={timelineY - 4} x2={chartW} y2={timelineY - 4}
          stroke={BONE} strokeWidth={1}
        />

        {/* Gap labels on timeline */}
        {gaps.filter((g) => g.type === 'all_content' && g.durationDays >= 10).map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          const cx = (x1 + x2) / 2;
          return (
            <text key={`gl-${i}`} x={cx} y={shortsY + 4} textAnchor="middle"
              fontSize={8} fill={SIGNAL} fontWeight={600} opacity={0.7}>
              {gap.durationDays}d gap
            </text>
          );
        })}

        {/* Long-form gap labels */}
        {gaps.filter((g) => g.type === 'longform_only' && g.durationDays >= 14).map((gap, i) => {
          const x1 = Math.max(0, toX(gap.startDate));
          const x2 = Math.min(chartW, toX(gap.endDate));
          const cx = (x1 + x2) / 2;
          return (
            <text key={`lfgl-${i}`} x={cx} y={longformY - 10} textAnchor="middle"
              fontSize={8} fill={SUN} fontWeight={600} opacity={0.8}>
              {gap.durationDays}d no long-form
            </text>
          );
        })}

        {/* Row labels */}
        <text x={-8} y={longformY + 4} textAnchor="end" fontSize={9} fill={SMOKE} fontWeight={600}>
          LF
        </text>
        <text x={-8} y={shortsY + 4} textAnchor="end" fontSize={9} fill={SMOKE} fontWeight={600}>
          S
        </text>

        {/* Short groups */}
        {shortGroups.map((group, i) => (
          <g key={`sg-${i}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectUpload(group.uploads[0].id)}
          >
            <path
              d={getFormatShape('short', group.x, shortsY, group.count > 1 ? 6 : 5)}
              fill={FORMAT_COLORS.short}
              opacity={selectedUpload && group.uploads.some((u) => u.id === selectedUpload) ? 1 : 0.7}
            />
            {group.count > 1 && (
              <text x={group.x} y={shortsY - 10} textAnchor="middle"
                fontSize={8} fill={SMOKE} fontWeight={600}>
                x{group.count}
              </text>
            )}
          </g>
        ))}

        {/* Long-form markers */}
        {longform.map((u) => {
          const x = toX(u.publishedAt);
          const isSelected = selectedUpload === u.id;
          const size = isSelected ? 9 : 7;
          return (
            <g key={u.id} style={{ cursor: 'pointer' }}
              onClick={() => onSelectUpload(isSelected ? null : u.id)}
            >
              <path
                d={getFormatShape(u.format, x, longformY, size)}
                fill={u.format === 'audio' ? 'none' : FORMAT_COLORS[u.format]}
                stroke={FORMAT_COLORS[u.format]}
                strokeWidth={u.format === 'audio' ? 2 : isSelected ? 2 : 0}
                opacity={isSelected ? 1 : 0.85}
              />
              {/* Format label */}
              <text x={x} y={longformY + 18} textAnchor="middle"
                fontSize={7} fill={FORMAT_COLORS[u.format]} fontWeight={600}>
                {u.formatMeta.shortLabel}
              </text>
              {isSelected && (
                <circle cx={x} cy={longformY} r={size + 4}
                  fill="none" stroke={FORMAT_COLORS[u.format]} strokeWidth={1.5}
                  opacity={0.4}
                />
              )}
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hoveredDate && (() => {
          const x = toX(hoveredDate);
          if (x < 0 || x > chartW) return null;
          return (
            <line x1={x} y1={0} x2={x} y2={timelineY - 4}
              stroke={INK} strokeWidth={1} opacity={0.15}
            />
          );
        })()}
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
          x
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
              7 Days After
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 4 }}>
      {breakdown.map((fb) => (
        <div key={fb.format} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={14} height={14}>
            <path
              d={getFormatShape(fb.format, 7, 7, 5)}
              fill={fb.format === 'audio' ? 'none' : FORMAT_COLORS[fb.format]}
              stroke={FORMAT_COLORS[fb.format]}
              strokeWidth={fb.format === 'audio' ? 1.5 : 0}
            />
          </svg>
          <span style={{ fontSize: 11, color: SMOKE }}>
            {fb.meta.label} ({fb.count})
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Learnings panel ──────────────────────────────────────────────────────

function LearningsPanel({ learnings }: { learnings: Learning[] }) {
  if (learnings.length === 0) return null;

  const confidenceColor: Record<Learning['confidence'], string> = {
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
                color: confidenceColor[l.confidence],
                padding: '1px 6px', borderRadius: 3,
                border: `1px solid ${confidenceColor[l.confidence]}`,
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

  const directionLabel: Record<FormatBreakdown['recentDirection'], string> = {
    accelerating: 'Accelerating',
    stable: 'Stable',
    declining: 'Declining',
    insufficient: '—',
  };
  const directionColor: Record<FormatBreakdown['recentDirection'], string> = {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
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
              <div>{fb.count} upload{fb.count !== 1 ? 's' : ''}</div>
              <div>Avg: {formatNum(fb.avgViews)} views</div>
              {fb.count >= 3 && <div>Median: {formatNum(fb.medianViews)} views</div>}
              <div style={{ color: directionColor[fb.recentDirection] }}>
                Direction: {directionLabel[fb.recentDirection]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function CampaignBehaviour({ slug, artistName, onClose }: Props) {
  const [data, setData] = useState<BehaviourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);
  const [uploadObs, setUploadObs] = useState<UploadObservation | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(700);
  const exportRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/campaign-behaviour/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

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
    // Check if it's in the initial data
    if (data.uploadObservation?.uploadId === selectedUpload) {
      setUploadObs(data.uploadObservation);
      return;
    }
    fetch(`/api/campaign-behaviour/${slug}?upload=${selectedUpload}`)
      .then((r) => r.json())
      .then((d) => setUploadObs(d.uploadObservation ?? null))
      .catch(() => setUploadObs(null));
  }, [selectedUpload, slug, data]);

  const selectedUploadData = useMemo(() => {
    if (!selectedUpload || !data) return null;
    return data.uploads.find((u) => u.id === selectedUpload) ?? null;
  }, [selectedUpload, data]);

  // Export handler — html2canvas loaded at runtime to avoid build-time resolution
  const handleExport = useCallback(async () => {
    if (!exportRef.current) return;
    try {
      // Use Function constructor to prevent webpack from resolving the module at build time
      const mod = 'html2canvas';
      const { default: html2canvas } = await import(/* webpackIgnore: true */ mod);
      const canvas = await html2canvas(exportRef.current, {
        width: 1920, height: 1080, scale: 2,
        backgroundColor: PAPER,
      });
      const link = document.createElement('a');
      link.download = `${slug}-campaign-behaviour.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // html2canvas not available — stub for future implementation
      alert('PNG export coming soon. This feature requires a library that will be added in a future update.');
    }
  }, [slug]);

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

  const { observationWindow, viewVelocity, subscriberGains, uploads, gaps,
          milestones, formatBreakdown, learnings, artist, lastUpdated } = data;

  return (
    <div ref={containerRef} style={{
      background: PAPER, borderRadius: 12, padding: '20px 24px',
      border: `1px solid ${BONE}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SIGNAL, marginBottom: 4 }}>
            Channel Behaviour
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{artistName}</div>
          <div style={{ fontSize: 12, color: SMOKE, marginTop: 2 }}>
            {observationWindow.label} · {observationWindow.startDate} to {observationWindow.endDate}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleExport} style={{
            background: INK, color: 'white', border: 'none', borderRadius: 6,
            padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            Download Snapshot
          </button>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: `1px solid ${BONE}`, borderRadius: 6,
              padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: SMOKE,
            }}>
              Summary
            </button>
          )}
        </div>
      </div>

      {/* Format legend */}
      <FormatLegend breakdown={formatBreakdown} />

      {/* View velocity chart */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: SIGNAL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
          View Velocity (7-day rolling avg)
        </div>
        <ViewVelocityChart
          data={viewVelocity} startDate={observationWindow.startDate}
          endDate={observationWindow.endDate} width={chartWidth}
          gaps={gaps} milestones={milestones}
          hoveredDate={hoveredDate} onHover={setHoveredDate}
        />
      </div>

      {/* Subscriber gains */}
      <div style={{ marginTop: GAP_BETWEEN }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: MINT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
          Subscriber Growth (7-day rolling avg)
        </div>
        <SubsGainsChart
          data={subscriberGains} startDate={observationWindow.startDate}
          endDate={observationWindow.endDate} width={chartWidth}
          hoveredDate={hoveredDate} onHover={setHoveredDate}
        />
      </div>

      {/* Content timeline */}
      <div style={{ marginTop: GAP_BETWEEN }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: INK, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
          Content Activity
        </div>
        <ContentTimeline
          uploads={uploads} startDate={observationWindow.startDate}
          endDate={observationWindow.endDate} width={chartWidth}
          gaps={gaps} selectedUpload={selectedUpload}
          onSelectUpload={setSelectedUpload} hoveredDate={hoveredDate}
        />
      </div>

      {/* Upload detail panel */}
      {selectedUploadData && (
        <UploadDetailPanel
          upload={selectedUploadData}
          observation={uploadObs}
          onClose={() => setSelectedUpload(null)}
        />
      )}

      {/* Summary stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
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
            {gaps.filter((g) => g.type === 'all_content').length}
          </div>
          <div style={{ fontSize: 10, color: SMOKE }}>Content Gaps (7d+)</div>
        </div>
      </div>

      {/* Learnings */}
      <LearningsPanel learnings={learnings} />

      {/* Format breakdown */}
      <FormatBreakdownPanel breakdown={formatBreakdown} />

      {/* Footer */}
      <div style={{ marginTop: 16, fontSize: 10, color: GHOST, textAlign: 'right' }}>
        Last updated: {new Date(lastUpdated).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </div>

      {/* Hidden export container (for future html2canvas) */}
      <div ref={exportRef} style={{ position: 'absolute', left: -9999, top: -9999, width: 1920, height: 1080 }} />
    </div>
  );
}
