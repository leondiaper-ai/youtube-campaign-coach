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
// Report builder
// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

/** Assign priority tier based on views + format type */
function priorityTier(v: ReportMissedVideo): 'HIGH IMPACT' | 'MEDIUM IMPACT' | 'LOWER PRIORITY' {
  const hasHighFormat = v.formats.some((f) => f.impact === 'HIGH');
  if (v.views >= 1_000_000 && hasHighFormat) return 'HIGH IMPACT';
  if (v.views >= 500_000 || hasHighFormat) return 'MEDIUM IMPACT';
  return 'LOWER PRIORITY';
}

function buildReport(p: ReportProps): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [];

  // ── 1. STATE + reason + risk ────────────────────────────────────────────
  lines.push(`YOUTUBE CHANNEL REPORT — ${p.artistName.toUpperCase()}`);
  lines.push(date);
  lines.push('');
  lines.push(`STATE: ${p.channelState}`);
  lines.push(p.stateReason);
  if (p.riskLine) {
    lines.push(`Risk: ${p.riskLine}`);
  }
  lines.push('');

  // ── 2. CHANNEL SNAPSHOT ─────────────────────────────────────────────────
  lines.push('CHANNEL SNAPSHOT');
  if (p.stats.subs != null) lines.push(`  Subscribers: ${fmtNum(p.stats.subs)}`);
  if (p.stats.views7d != null) lines.push(`  Views (7d): ${p.stats.views7d >= 0 ? '+' : ''}${fmtNum(p.stats.views7d)}`);
  if (p.stats.subs7d != null) lines.push(`  Subs (7d): ${p.stats.subs7d >= 0 ? '+' : ''}${p.stats.subs7d.toLocaleString()}`);
  lines.push(`  Uploads (30d): ${p.stats.uploads30d}`);
  if (p.stats.lastUpDays != null) {
    lines.push(`  Last upload: ${p.stats.lastUpDays === 0 ? 'today' : p.stats.lastUpDays === 1 ? 'yesterday' : `${p.stats.lastUpDays}d ago`}`);
  }
  lines.push('');

  // ── 3. MISSED REACH (prioritised) ──────────────────────────────────────
  if (p.missedReach.length > 0) {
    lines.push(`MISSED REACH (${p.missedReach.length} videos scanned)`);

    // Structural patterns first
    if (p.structuralGaps && p.structuralGaps.length > 0) {
      const patternStr = p.structuralGaps.map((g) => `${g.count} videos missing ${g.name}`).join(', ');
      lines.push(`  Pattern: ${patternStr}`);
    }

    // Sort by views descending, then group by tier
    const sorted = [...p.missedReach].sort((a, b) => b.views - a.views);
    const tiers: Record<string, ReportMissedVideo[]> = {
      'HIGH IMPACT': [],
      'MEDIUM IMPACT': [],
      'LOWER PRIORITY': [],
    };
    for (const v of sorted) {
      tiers[priorityTier(v)].push(v);
    }

    // Show top HIGH + MEDIUM in full, summarise LOW
    for (const tier of ['HIGH IMPACT', 'MEDIUM IMPACT'] as const) {
      const items = tiers[tier];
      if (items.length === 0) continue;
      for (const v of items.slice(0, 5)) {
        const formatList = v.formats.map((f) => f.name).join(', ');
        lines.push(`  ${tier} • "${v.title}" (${fmtNum(v.views)} views) — Missing: ${formatList}`);
      }
      if (items.length > 5) {
        lines.push(`  ... + ${items.length - 5} more ${tier.toLowerCase()} opportunities`);
      }
    }
    const lowCount = tiers['LOWER PRIORITY'].length;
    if (lowCount > 0) {
      lines.push(`  + ${lowCount} lower priority opportunit${lowCount === 1 ? 'y' : 'ies'}`);
    }
    lines.push('');
  }

  // ── 4. FIX THIS WEEK (tied to specific assets) ─────────────────────────
  lines.push('FIX THIS WEEK');

  // Derive fix actions from missed reach — highest-view video first
  const topMissed = [...p.missedReach].sort((a, b) => b.views - a.views);
  const fixItems: string[] = [];

  for (const v of topMissed.slice(0, 2)) {
    const highFormats = v.formats.filter((f) => f.impact === 'HIGH');
    const targetFormats = highFormats.length > 0 ? highFormats : v.formats.slice(0, 1);
    for (const f of targetFormats.slice(0, 1)) {
      if (f.name === 'Shorts') {
        fixItems.push(`Cut 2 Shorts from "${v.title}" (${fmtNum(v.views)} views)`);
      } else if (f.name === 'Lyric Video') {
        fixItems.push(`Ship a lyric video for "${v.title}" (${fmtNum(v.views)} views)`);
      } else if (f.name === 'Visualizer') {
        fixItems.push(`Upload a visualizer for "${v.title}" (${fmtNum(v.views)} views)`);
      } else if (f.name === 'Captions') {
        fixItems.push(`Publish captions on "${v.title}" (${fmtNum(v.views)} views)`);
      } else {
        fixItems.push(`Add ${f.name} to "${v.title}" (${fmtNum(v.views)} views)`);
      }
    }
  }

  // If no missed reach videos, fall back to cadence-based actions
  if (fixItems.length === 0) {
    if (p.stats.uploads30d === 0 || (p.stats.lastUpDays != null && p.stats.lastUpDays > 30)) {
      fixItems.push('Post one Short from catalogue this week to break the silence');
    } else {
      fixItems.push('Maintain current upload cadence');
    }
  }

  for (const fix of fixItems) {
    lines.push(`  → ${fix}`);
  }
  lines.push('');

  // ── 5. NEXT MOVE ───────────────────────────────────────────────────────
  lines.push('NEXT MOVE');
  lines.push(`  → ${p.nextMove}`);
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
