'use client';

import { useId, useState } from 'react';
import { observedMovement, type Reading, type publishingSeries, type lengthBreakdown } from '@/lib/ownedChannels/analysis';

const compact = (n: number) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const exact = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const dayLabel = (at: string | number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function GrowthChart({ readings, metric, from, to }: { readings: Reading[]; metric: 'views' | 'subs'; from: number; to: number }) {
  const gradient = `owned-${useId().replace(/:/g, '')}`;
  const [active, setActive] = useState<number | null>(null);
  const points = readings.filter(r => Date.parse(r.at) >= from && Date.parse(r.at) <= to);
  const values = points.map(r => r[metric]).filter((v): v is number => v != null);
  const movement = observedMovement(points, metric, from);
  const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 1;
  const pad = (max - min) * .15 || Math.max(1, max * .02);
  const low = Math.max(0, min - pad), high = max + pad;
  const x = (at: string) => 60 + (Date.parse(at) - from) / Math.max(1, to - from) * 610;
  const y = (v: number) => 210 - (v - low) / Math.max(1, high - low) * 175;
  const paths: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p[metric] == null || (i > 0 && Date.parse(p.at) - Date.parse(points[i - 1].at) > 36 * 3600000)) {
      if (segment.length) paths.push(segment);
      segment = [];
    }
    if (p[metric] != null) segment.push({ x: x(p.at), y: y(p[metric]!) });
  });
  if (segment.length) paths.push(segment);
  const selected = active == null ? null : points[active];
  return <>
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-4 mb-1">
      <span className="text-h2 font-black tabular-nums">{movement ? `${movement.value > 0 ? '+' : ''}${compact(movement.value)}` : 'Building a baseline'}</span>
      <span className="text-meta text-muted">{movement ? `net ${metric === 'views' ? 'views' : 'subscribers'} · ${dayLabel(movement.from)}–${dayLabel(movement.to)} (${movement.days.toFixed(1)} days)` : `${values.length} recorded ${values.length === 1 ? 'reading' : 'readings'}`}</span>
    </div>
    <div className="relative">
      <svg viewBox="0 0 700 250" role="img" aria-label={`Recorded channel ${metric === 'views' ? 'view' : 'subscriber'} totals. ${values.length} observations; gaps over 36 hours are not connected.`} className="w-full h-auto min-h-[180px]">
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2C6BFF" stopOpacity=".14" /><stop offset="100%" stopColor="#2C6BFF" stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map(t => <g key={t}><line x1="60" x2="670" y1={35 + t * 175} y2={35 + t * 175} stroke="#E8E3DA" strokeDasharray="3 4" />
          {values.length > 0 && <text x="48" y={39 + t * 175} textAnchor="end" fontSize="11" fill="#7D776E">{compact(high - t * (high - low))}</text>}</g>)}
        {paths.filter(p => p.length > 1).map((path, i) => {
          const d = path.map((p, j) => `${j ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          return <g key={i}><path d={`${d} L ${path[path.length - 1].x} 210 L ${path[0].x} 210 Z`} fill={`url(#${gradient})`} />
            <path d={d} fill="none" stroke="#2C6BFF" strokeWidth="2.5" strokeLinejoin="round" /></g>;
        })}
        {points.map((p, i) => p[metric] == null ? null : <g key={p.at}>
          {active === i && <line x1={x(p.at)} x2={x(p.at)} y1="35" y2="210" stroke="#A8A199" strokeDasharray="3 4" />}
          <circle cx={x(p.at)} cy={y(p[metric]!)} r={active === i ? 6 : 4} fill="#2C6BFF" stroke="white" strokeWidth="2"
            tabIndex={0} role="img" aria-label={`${dayLabel(p.at)}: ${exact(p[metric]!)}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
            <title>{`${dayLabel(p.at)} · ${exact(p[metric]!)}`}</title></circle>
        </g>)}
        <text x="60" y="240" fontSize="11" fill="#7D776E">{dayLabel(from)}</text>
        <text x="670" y="240" textAnchor="end" fontSize="11" fill="#7D776E">{dayLabel(to)}</text>
        {!values.length && <text x="365" y="120" textAnchor="middle" fontSize="13" fill="#7D776E">Refresh to record the first reading</text>}
      </svg>
    </div>
    <p aria-live="polite" className="text-micro text-muted mt-1 min-h-[16px]">{selected?.[metric] != null ? `${dayLabel(selected.at)} · ${exact(selected[metric]!)} ${metric === 'views' ? 'channel views' : 'subscribers'}` : values.length < 2 ? 'The first reading establishes a starting point. Refresh on another day to begin a growth curve.' : 'Recorded totals only. Points show real readings; unobserved days are not filled in.'}</p>
  </>;
}

export function PublishingChart({ series }: { series: ReturnType<typeof publishingSeries> }) {
  const max = Math.max(1, ...series.map(p => p.count ?? p.minimum));
  const [active, setActive] = useState<number | null>(null);
  const selected = active == null ? null : series[active];
  return <>
    <div className="mt-6 h-[140px] flex gap-1 items-end border-b border-line" aria-label="Public uploads by UTC publication date">
      {series.map((p, i) => <div key={p.day} className="flex-1 min-w-0 h-full flex items-end group">
        <div tabIndex={0} role="img" title={`${dayLabel(p.day)} · ${p.count == null ? 'Partial coverage' : `${p.count} uploads`}`} aria-label={`${dayLabel(p.day)}: ${p.count == null ? `at least ${p.minimum}; partial coverage` : `${p.count} uploads`}`}
          onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
          className={`w-full rounded-t-sm outline-offset-2 ${p.count == null ? 'bg-line-strong' : (p.count > 0 ? 'bg-electric/80 group-hover:bg-electric' : 'bg-line')}`}
          style={{ height: `${Math.max(2, (p.count ?? p.minimum) / max * 130)}px` }} />
      </div>)}
    </div>
    <div className="flex justify-between text-micro text-muted mt-2"><span>{dayLabel(series[0].day)}</span><span>{dayLabel(series[series.length - 1].day)}</span></div>
    <p aria-live="polite" className="text-micro text-muted mt-3 min-h-[16px]">{selected ? `${dayLabel(selected.day)} · ${selected.count == null ? `at least ${selected.minimum} uploads; incomplete coverage` : `${selected.count} public uploads`}` : 'Publication dates, not historical views. Today is a partial day. Grey bars may indicate incomplete coverage.'}</p>
  </>;
}

export function LengthChart({ breakdown }: { breakdown: ReturnType<typeof lengthBreakdown> }) {
  const max = Math.max(1, ...breakdown.map(g => g.views ?? 0));
  const colors = ['bg-electric', 'bg-longform', 'bg-positive', 'bg-line-strong'];
  return <div className="mt-5 space-y-5">
    {breakdown.map((g, i) => <div key={g.label}>
      <div className="flex justify-between text-meta mb-2 gap-3"><span className="text-secondary font-semibold">{g.label} <span className="text-muted font-normal">· {g.count} uploads</span></span><strong className="tabular-nums">{g.views == null ? '—' : compact(g.views)}</strong></div>
      <div className="h-1.5 rounded-full bg-raised overflow-hidden" role="img" aria-label={`${g.label}: ${g.views == null ? 'views unavailable' : exact(g.views) + ' lifetime views'}`}><div className={`h-full rounded-full ${colors[i]}`} style={{ width: `${g.views == null ? 0 : g.views / max * 100}%` }} /></div>
      <p className="text-micro text-muted mt-1.5">{g.median == null ? 'No view-count sample' : `${compact(g.median)} median views · n=${g.known}`}{g.known < g.count ? ' · some counts unavailable' : ''}</p>
    </div>)}
    <p className="text-micro text-muted pt-2">Views to date on uploads in this publication window. Length groups do not identify YouTube Shorts. Different upload ages affect totals.</p>
  </div>;
}
