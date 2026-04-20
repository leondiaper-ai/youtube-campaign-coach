'use client';

import { useState, useCallback } from 'react';

const INK = '#0E0E0E';
const MUTED = '#E9E2D3';

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Types
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Helpers
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
    if (uploads30d >= 4) return 'Momentum building â output is consistent.';
    return 'Momentum building but inconsistent.';
  }
  if (s === 'AT RISK') {
    if (subs7d != null && subs7d <= 0) return 'Output high but not converting.';
    return 'Losing momentum â action needed.';
  }
  if (s === 'COLD') return 'Channel is dormant. Algorithm reach is decaying.';
  return 'Mixed signals â review recommended.';
}

/** Summary lines â concise, create tension */
function buildSummary(state: string, totalMissed: number, uploads30d: number): string[] {
  const s = state.toUpperCase();
  if (s === 'COLD') {
    return ['Channel is silent. Every day without an upload costs you reach.'];
  }
  if (totalMissed === 0) {
    return ['Catalogue is well-covered. Keep going.'];
  }
  if (s === 'HEALTHY') {
    return ['You have momentum. You\'re not building on it.'];
  }
  if (uploads30d >= 4) {
    return ['Strong content. Weak packaging.', 'You\'re creating but not extending.'];
  }
  if (uploads30d >= 1) {
    return ['Present but not consistent.', 'Every upload without support formats is wasted reach.'];
  }
  return ['Output has stalled. Attention is decaying.', 'One upload this week changes the trajectory.'];
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Report builder
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function buildReport(p: ReportProps): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [];
  const isSmall = p.missedReach.length <= 5;

  // ââ 1. HEADER ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  lines.push(`YOUTUBE CHANNEL REPORT â ${p.artistName.toUpperCase()}`);
  lines.push(date);
  lines.push(`STATE: ${p.channelState.toUpperCase()}`);
  lines.push(stateInterpretation(p.channelState, p.stats.uploads30d, p.stats.subs7d));
  lines.push('');

  // ââ 2. SNAPSHOT (single line) ââââââââââââââââââââââââââââââââââââââââââ
  const snapParts: string[] = [];
  if (p.stats.subs != null) snapParts.push(`Subs: ${fmtNum(p.stats.subs)}`);
  if (p.stats.views7d != null) snapParts.push(`Views (7d): ${fmtNum(p.stats.views7d)}`);
  if (p.stats.subs7d != null) snapParts.push(`Subs (7d): ${p.stats.subs7d >= 0 ? '+' : ''}${p.stats.subs7d.toLocaleString()}`);
  snapParts.push(`Uploads (30d): ${p.stats.uploads30d}`);
  if (p.stats.lastUpDays != null) {
    snapParts.push(`Last upload: ${p.stats.lastUpDays === 0 ? 'today' : p.stats.lastUpDays === 1 ? 'yesterday' : `${p.stats.lastUpDays}d ago`}`);
  }
  lines.push(snapParts.join(' | '));
  lines.push('');

  // ââ 3. MISSED REACH ââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (p.missedReach.length > 0) {
    lines.push('MISSED REACH');
    if (isSmall) {
      const gapNames = new Set<string>();
      for (const v of p.missedReach) {
        for (const f of v.formats) gapNames.add(f.name);
      }
      lines.push(`All recent videos are missing basic extension formats (${[...gapNames].join(', ')}).`);
    } else {
      const gapCounts: Record<string, number> = {};
      for (const v of p.missedReach) {
        for (const f of v.formats) {
          gapCounts[f.name] = (gapCounts[f.name] ?? 0) + 1;
        }
      }
      const topGaps = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const gapSummary = topGaps.map(([name, count]) => `${count} missing ${name}`).join(', ');
      lines.push(`Catalogue is under-optimised â most videos are not extended beyond release. ${gapSummary}.`);
    }
    lines.push('');

    // ââ 4. WHAT MATTERS ââââââââââââââââââââââââââââââââââââââââââââââââââ
    lines.push('WHAT MATTERS');
    const sorted = [...p.missedReach].sort((a, b) => b.views - a.views);
    const topCount = isSmall ? 2 : 3;
    for (const v of sorted.slice(0, topCount)) {
      lines.push(`${v.title} (${fmtNum(v.views)} views)`);
    }
    lines.push('');
  }

  // ââ 5. FIX THIS WEEK ââââââââââââââââââââââââââââââââââââââââââââââââââ
  lines.push('FIX THIS WEEK');
  const topMissed = [...p.missedReach].sort((a, b) => b.views - a.views);

  if (topMissed.length === 0) {
    if (p.stats.uploads30d === 0 || (p.stats.lastUpDays != null && p.stats.lastUpDays > 30)) {
      lines.push('\u2192 Post one Short from catalogue this week to break the silence');
    } else {
      lines.push('\u2192 Maintain current upload cadence');
    }
  } else {
    // Deduplicate: if multiple tracks need the same format, say it once
    const formatActions = new Map<string, { format: string; tracks: { title: string; views: number }[] }>();
    for (const v of topMissed.slice(0, 5)) {
      const highFormats = v.formats.filter((f) => f.impact === 'HIGH');
      const target = highFormats.length > 0 ? highFormats[0] : v.formats[0];
      if (target) {
        if (!formatActions.has(target.name)) {
          formatActions.set(target.name, { format: target.name, tracks: [] });
        }
        formatActions.get(target.name)!.tracks.push({ title: v.title, views: v.views });
      }
    }

    let actionCount = 0;
    for (const [, action] of formatActions) {
      if (actionCount >= 2) break;
      const verb = action.format === 'Shorts' ? 'Cut Shorts from' : `Add ${action.format.toLowerCase()} to`;
      if (action.tracks.length > 1) {
        lines.push(`\u2192 ${verb} top-performing videos`);
      } else {
        const t = action.tracks[0];
        lines.push(`\u2192 ${verb} "${t.title}" (${fmtNum(t.views)})`);
      }
      actionCount++;
    }
  }
  lines.push('');

  // ââ 6. NEXT MOVE ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  lines.push('NEXT MOVE');
  lines.push(p.nextMove);
  lines.push('');

  // ââ 7. SUMMARY ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  lines.push('SUMMARY');
  for (const s of buildSummary(p.channelState, p.missedReach.length, p.stats.uploads30d)) {
    lines.push(s);
  }
  lines.push('');
  lines.push('\u2014 Generated by YouTube Campaign Coach');

  return lines.join('\n');
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Component
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
            <CheckIcon /> Copied to clipboard
          </>
        ) : (
          <>
            <ClipboardIcon /> Generate report
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
