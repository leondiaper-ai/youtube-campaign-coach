'use client';

import { useState, useCallback } from 'react';

const INK = '#0E0E0E';
const MUTED = '#E9E2D3';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportMissedVideo = {
  title: string;
  views: number;
  formats: { name: string; impact: 'HIGH' | 'MEDIUM' | 'LOW' }[];
};

export type ReportProps = {
  artistName: string;
  channelState: string;
  stateReason: string;
  riskLine: string | null;
  nextMove: string;
  missedReach: ReportMissedVideo[];
  structuralGaps?: { name: string; count: number }[];
  stats: {
    subs: number | null;
    views7d: number | null;
    subs7d: number | null;
    uploads30d: number;
    lastUpDays: number | null;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

/** One-line state interpretation */
function stateInterpretation(state: string, uploads30d: number, subs7d: number | null): string {
  const s = state.toUpperCase();
  if (s === 'HEALTHY') return 'Growth is compounding.';
  if (s === 'BUILDING') {
    if (uploads30d >= 4) return 'Momentum building — output is consistent.';
    return 'Momentum building but inconsistent.';
  }
  if (s === 'AT RISK') {
    if (subs7d != null && subs7d <= 0) return 'Output high but not converting.';
    return 'Losing momentum — action needed.';
  }
  if (s === 'COLD') return 'Channel is dormant. Algorithm reach is decaying.';
  return 'Mixed signals — review recommended.';
}

/** Consequence line for a missing format */
function formatConsequence(name: string): string {
  if (name === 'Shorts') return 'missing discovery layer';
  if (name === 'Lyric Video') return 'no long-tail search capture';
  if (name === 'Visualizer') return 'no passive-listen capture';
  if (name === 'Captions') return 'no international / search reach';
  if (name === 'Fan Demand') return 'verified demand unmet';
  return 'missing support format';
}

/** Fix action for a format + track */
function fixAction(format: string, title: string, views: number): string {
  const v = fmtNum(views);
  if (format === 'Shorts') return `Cut Shorts from "${title}" (${v} views)`;
  if (format === 'Lyric Video') return `Ship lyric video for "${title}" (${v} views)`;
  if (format === 'Visualizer') return `Ship visualizer for "${title}" (${v} views)`;
  if (format === 'Captions') return `Publish captions on "${title}" (${v} views)`;
  return `Add ${format} to "${title}" (${v} views)`;
}

/** Summary based on channel state + missed reach */
function buildSummary(state: string, totalMissed: number, uploads30d: number): string[] {
  const s = state.toUpperCase();
  if (s === 'COLD') {
    return [
      'Channel is silent. Algorithm reach is decaying daily.',
      'One upload this week breaks the spiral.',
    ];
  }
  if (totalMissed === 0) {
    return ['Catalogue is well-covered. Maintain cadence.'];
  }
  const outputLine = uploads30d >= 4
    ? 'Strong output.'
    : uploads30d >= 1
      ? 'Output is present but inconsistent.'
      : 'Output has stalled.';
  return [
    `${outputLine} Weak lifecycle strategy.`,
    'You are generating attention but not extending it.',
    totalMissed > 10
      ? 'Fixing companion formats will compound performance across the entire catalogue.'
      : 'Fixing the top gaps will unlock incremental reach on proven tracks.',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Report builder
// ─────────────────────────────────────────────────────────────────────────────

function buildReport(p: ReportProps): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [];

  // ── 1. HEADER ──────────────────────────────────────────────────────────
  lines.push(`YOUTUBE CHANNEL REPORT — ${p.artistName.toUpperCase()}`);
  lines.push(date);
  lines.push('');
  lines.push(`STATE: ${p.channelState.toUpperCase()}`);
  lines.push(stateInterpretation(p.channelState, p.stats.uploads30d, p.stats.subs7d));
  lines.push('');

  // ── 2. SNAPSHOT (minimal) ──────────────────────────────────────────────
  lines.push('SNAPSHOT');
  const snapParts: string[] = [];
  if (p.stats.subs != null) snapParts.push(`Subs: ${fmtNum(p.stats.subs)}`);
  if (p.stats.views7d != null) snapParts.push(`Views (7d): ${p.stats.views7d >= 0 ? '+' : ''}${fmtNum(p.stats.views7d)}`);
  if (p.stats.subs7d != null) snapParts.push(`Subs (7d): ${p.stats.subs7d >= 0 ? '+' : ''}${p.stats.subs7d.toLocaleString()}`);
  snapParts.push(`Uploads (30d): ${p.stats.uploads30d}`);
  if (p.stats.lastUpDays != null) {
    snapParts.push(`Last upload: ${p.stats.lastUpDays === 0 ? 'today' : p.stats.lastUpDays === 1 ? 'yesterday' : `${p.stats.lastUpDays}d ago`}`);
  }
  lines.push(snapParts.join('  '));
  lines.push('');

  // ── 3. MISSED REACH (structural diagnosis) ─────────────────────────────
  if (p.missedReach.length > 0) {
    lines.push('MISSED REACH (STRUCTURAL)');

    // Count gap types across all videos
    const gapCounts: Record<string, number> = {};
    for (const v of p.missedReach) {
      for (const f of v.formats) {
        gapCounts[f.name] = (gapCounts[f.name] ?? 0) + 1;
      }
    }

    lines.push('Your catalogue is under-optimised. Most videos are not being extended beyond initial release.');
    const countParts = [`${p.missedReach.length} videos scanned`];
    for (const [name, count] of Object.entries(gapCounts).sort((a, b) => b[1] - a[1])) {
      countParts.push(`${count} missing ${name}`);
    }
    lines.push(countParts.join(' \u2022 '));
    if (p.missedReach.length >= 10) {
      lines.push('This is a system gap — not a one-off issue.');
    }
    lines.push('');

    // ── 4. TOP OPPORTUNITIES (max 5) ───────────────────────────────────────
    lines.push('TOP OPPORTUNITIES');
    const sorted = [...p.missedReach].sort((a, b) => b.views - a.views);
    const topOpps = sorted.slice(0, 5);

    for (const v of topOpps) {
      const tier = v.views >= 1_000_000 ? 'HIGH' : v.views >= 500_000 ? 'MEDIUM' : 'LOW';
      lines.push(`${tier}  ${v.title} — ${fmtNum(v.views)} views`);
      for (const f of v.formats.slice(0, 2)) {
        lines.push(`  \u2192 No ${f.name.toLowerCase()} \u2192 ${formatConsequence(f.name)}`);
      }
    }

    const remaining = sorted.length - topOpps.length;
    if (remaining > 0) {
      lines.push(`+ ${remaining} more similar opportunities (catalogue-wide)`);
    }
    lines.push('');
  }

  // ── 5. FIX THIS WEEK ──────────────────────────────────────────────────
  lines.push('FIX THIS WEEK');

  const topMissed = [...p.missedReach].sort((a, b) => b.views - a.views);
  const fixItems: string[] = [];

  for (const v of topMissed.slice(0, 3)) {
    const highFormats = v.formats.filter((f) => f.impact === 'HIGH');
    const target = highFormats.length > 0 ? highFormats[0] : v.formats[0];
    if (target && fixItems.length < 3) {
      fixItems.push(fixAction(target.name, v.title, v.views));
    }
  }

  if (fixItems.length === 0) {
    if (p.stats.uploads30d === 0 || (p.stats.lastUpDays != null && p.stats.lastUpDays > 30)) {
      fixItems.push('Post one Short from catalogue this week to break the silence');
    } else {
      fixItems.push('Maintain current upload cadence');
    }
  }

  fixItems.forEach((fix, i) => {
    lines.push(`${i + 1}. ${fix}`);
  });
  lines.push('');

  // ── 6. NEXT MOVE ──────────────────────────────────────────────────────
  lines.push('NEXT MOVE');
  lines.push(p.nextMove);
  lines.push('');

  // ── 7. SUMMARY ────────────────────────────────────────────────────────
  lines.push('SUMMARY');
  const summary = buildSummary(p.channelState, p.missedReach.length, p.stats.uploads30d);
  for (const s of summary) {
    lines.push(s);
  }
  lines.push('');

  lines.push('— Generated by YouTube Campaign Coach');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WatcherReport(props: ReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildReport(props);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [props]);

  return (
    <div className="mt-10 flex items-center justify-center">
      <button
        onClick={handleCopy}
        className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-colors cursor-pointer"
        style={{
          background: copied ? '#E6F8EE' : 'transparent',
          color: copied ? '#0C6A3F' : INK,
          border: `1px solid ${copied ? '#1FBE7A' : MUTED}`,
        }}
      >
        {copied ? (
          <>
            <CheckIcon />
            Copied to clipboard
          </>
        ) : (
          <>
            <ClipboardIcon />
            Generate report
          </>
        )}
      </button>
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
