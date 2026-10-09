/* ═══════════════════════════════════════════════════════════════════════
   VMG YOUTUBE — UI PRIMITIVES

   The pieces every surface is built from. Before this file, the same
   eyebrow label was hand-rolled in roughly 2,700 places with ten
   different letter-spacings, and each page invented its own KPI block
   and section heading. The point of putting them here is not brevity —
   it is that a regional team opening the US board and the Nordics board
   should not be able to tell they were built on different days.

   WHAT BELONGS HERE
   Presentation only. Nothing in this file fetches, calculates, filters
   or classifies. If a component needs to know what a number means, the
   caller works that out and passes it in.

   THE ONE OPINIONATED RULE
   `Kpi` requires a `period`. A row that puts a lifetime total beside a
   seven-day gain with no qualifier is actively misleading, and the only
   way that guarantee survives future edits is for the type system to
   refuse the component without one. This follows the convention already
   set by artist/primitives.tsx, which got it right first.
   ═══════════════════════════════════════════════════════════════════════ */

import React from 'react';
import { color } from '@/lib/design/tokens';

/* ── Eyebrow ─────────────────────────────────────────────────────────
   The small caps label above a section. Deliberately one size and one
   tracking: the old interface used this treatment for everything from
   page titles to footnotes, which is precisely why nothing stood out. */
export function Eyebrow({
  children, tone = 'muted', className = '',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'ink' | 'signal';
  className?: string;
}) {
  const c = tone === 'signal' ? 'text-signal' : tone === 'ink' ? 'text-ink' : 'text-muted';
  return (
    <div className={`text-[11px] font-bold uppercase tracking-eyebrow ${c} ${className}`}>
      {children}
    </div>
  );
}

/* ── SectionHead ─────────────────────────────────────────────────────
   A titled band with optional right-hand meta. The rule underneath is
   what gives a long scrolling board its rhythm; without it the weekly
   intelligence blocks ran together. */
export function SectionHead({
  title, meta, action, className = '',
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 pb-2.5 mb-4 border-b border-line ${className}`}>
      <h2 className="text-h4 font-extrabold text-ink">{title}</h2>
      <div className="flex items-center gap-3 shrink-0">
        {meta && <span className="text-micro text-muted tabular-nums">{meta}</span>}
        {action}
      </div>
    </div>
  );
}

/* ── Kpi ─────────────────────────────────────────────────────────────
   One figure, its label, and the window it was measured over. `tone`
   paints the figure only where the colour means something — a health
   state or a direction of travel — never for decoration. */
export function Kpi({
  value, label, period, tone, size = 'md',
}: {
  value: string;
  label: string;
  period: string;
  tone?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div>
      <div
        className={`${size === 'lg' ? 'text-kpiLg' : 'text-kpi'} font-black tabular-nums`}
        style={{ color: tone ?? color.ink }}
      >
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-label text-secondary mt-2">
        {label}
      </div>
      <div className="text-[11px] text-faint mt-0.5">{period}</div>
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────────────────
   A white surface on the warm page, separated by a hairline. No shadow:
   the brief asked for premium through precision rather than decoration,
   and on a warm background a shadow reads as grubby rather than raised. */
export function Card({
  children, className = '', pad = true, interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={[
        'bg-surface border border-line rounded-card',
        pad ? 'p-5' : '',
        interactive ? 'transition-colors hover:border-line-strong' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────
   Status. `dot` is on by default because colour alone should not be the
   only carrier of a state — the label always says it too, which also
   keeps it legible to anyone who cannot separate the greens from the
   ambers. */
export function Badge({
  children, fg, bg, dot = true,
}: {
  children: React.ReactNode;
  fg: string;
  bg: string;
  dot?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded text-[11px] font-bold uppercase tracking-label whitespace-nowrap"
      style={{ color: fg, background: bg }}
    >
      {dot && (
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ background: fg }}
        />
      )}
      {children}
    </span>
  );
}

/* ── Delta ───────────────────────────────────────────────────────────
   A signed movement figure. Green up, red down, muted flat — and the
   sign is always printed, so the direction survives a greyscale print
   or a colour-blind reader. */
export function Delta({
  value, format, suffix = '', className = '',
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  suffix?: string;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={`text-faint tabular-nums ${className}`}>—</span>;
  }
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const tone = value > 0 ? color.positive : value < 0 ? color.negative : color.inkMuted;
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`tabular-nums font-semibold ${className}`} style={{ color: tone }}>
      {sign}{fmt(value)}{suffix}
    </span>
  );
}

/* ── Rule ────────────────────────────────────────────────────────────
   A horizontal divider at the standard weight, so pages stop inventing
   their own border colours inline. */
export function Rule({ className = '' }: { className?: string }) {
  return <div className={`border-t border-line ${className}`} />;
}
