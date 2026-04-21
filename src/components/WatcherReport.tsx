'use client';

import { useState, useCallback } from 'react';
import type { ConversionResult } from '@/lib/conversion';

const INK = '#0E0E0E';
const MUTED = '#E9E2D3';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ReportMissedVideo = {
  title: string;
  views: number;
  formats: { name: string; impact: 'HIGH' | 'MEDIUM' | 'LOW' }[];
};

type MoveDirection = {
  label: string;
  action: string;
};

type RecentUploadEntry = {
  title: string;
  views: number;
  kind: 'Short' | 'Video';
  daysAgo: number;
};

export type ReportProps = {
  artistName: string;
  channelState: string;
  stateReason: string;
  riskLine: string | null;
  primaryMove: MoveDirection;
  secondaryMove: MoveDirection | null;
  missedReach: ReportMissedVideo[];
  structuralGaps?: { name: string; count: number }[];
  stats: {
    subs: number | null;
    views7d: number | null;
    subs7d: number | null;
    uploads30d: number;
    lastUpDays: number | null;
    shorts30d: number;
  };
  // Campaign-period data
  campaign: string | null;
  campaignContentViews: number;
  campaignContentCount: number;
  campaignShortsCount: number;
  campaignDaysSinceStart: number | null;
  campaignSubsDelta: number | null;
  campaignViewsDelta: number | null;
  recentUploads: RecentUploadEntry[];
  conv7?: ConversionResult | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function fmtDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${n}`;
}

/** Interpret performance — not just numbers but what they mean */
function interpretPerformance(p: ReportProps): string {
  const { stats, conv7 } = p;
  const subsUp = stats.subs7d != null && stats.subs7d > 0;
  const subsFlat = stats.subs7d != null && stats.subs7d <= 0;
  const viewsUp = stats.views7d != null && stats.views7d > 0;
  const convWeak = conv7 && conv7.band !== 'INSUFFICIENT' && (conv7.band === 'WEAK' || conv7.band === 'SOFT');

  if (subsFlat && viewsUp) {
    return 'Views are climbing but subscribers are flat — people are watching without committing. The conversion funnel is leaking.';
  }
  if (subsUp && viewsUp) {
    return 'Views and subscribers both growing — the algorithm is distributing and the audience is converting.';
  }
  if (convWeak && viewsUp) {
    return `Conversion is ${conv7!.band.toLowerCase()} at ${conv7!.ratePer1k.toFixed(1)}/1k views. Volume is there but the channel isn't converting watchers to subscribers.`;
  }
  if (stats.uploads30d >= 5 && stats.lastUpDays != null && stats.lastUpDays <= 3) {
    return 'Strong upload cadence. The algorithm has consistent signal to work with.';
  }
  if (stats.uploads30d <= 2) {
    return 'Upload volume is low. The algorithm doesn\'t have enough signal to distribute effectively.';
  }
  return 'Mixed signals — output is present but not yet compounding.';
}

/** Discovery signals — auto-detect from data */
function discoverySignals(p: ReportProps): string[] {
  const signals: string[] = [];
  const { stats, recentUploads } = p;

  const shortsCount = recentUploads.filter((u) => u.kind === 'Short').length;
  const videosCount = recentUploads.filter((u) => u.kind === 'Video').length;

  if (shortsCount >= 3) {
    signals.push(`${shortsCount} Shorts in 14d — feeding the algorithm consistently.`);
  } else if (shortsCount === 0 && recentUploads.length > 0) {
    signals.push('Zero Shorts in 14d — missing the fastest discovery surface on YouTube.');
  }

  if (stats.uploads30d >= 6) {
    signals.push(`${stats.uploads30d} uploads in 30d — strong cadence the algorithm rewards.`);
  } else if (stats.uploads30d <= 2 && stats.uploads30d > 0) {
    signals.push(`Only ${stats.uploads30d} uploads in 30d — below the threshold for consistent algorithmic push.`);
  }

  if (videosCount >= 2 && shortsCount >= 2) {
    signals.push('Good content mix — both long-form and Shorts active.');
  }

  const topRecent = recentUploads.length > 0
    ? recentUploads.reduce((best, u) => u.views > best.views ? u : best, recentUploads[0])
    : null;
  if (topRecent && topRecent.views >= 50_000 && topRecent.daysAgo <= 7) {
    signals.push(`"${topRecent.title}" trending at ${fmtNum(topRecent.views)} in ${topRecent.daysAgo}d — velocity signal.`);
  }

  return signals;
}

/** What's working — pull from cadence + formats */
function whatsWorking(p: ReportProps): string[] {
  const working: string[] = [];
  const { stats, recentUploads } = p;

  if (stats.uploads30d >= 5) working.push('Upload cadence is consistent — algorithm has signal.');
  if (stats.subs7d != null && stats.subs7d > 0) working.push(`+${stats.subs7d.toLocaleString()} subs in 7d — audience is converting.`);
  if (stats.views7d != null && stats.views7d > 50_000) working.push(`+${fmtNum(stats.views7d)} views in 7d — content is reaching.`);

  const shortsCount = recentUploads.filter((u) => u.kind === 'Short').length;
  if (shortsCount >= 2) working.push(`${shortsCount} Shorts in 14d — discovery layer active.`);

  if (p.conv7 && p.conv7.band !== 'INSUFFICIENT' && (p.conv7.band === 'STRONG' || p.conv7.band === 'HEALTHY')) {
    working.push(`Conversion rate ${p.conv7.ratePer1k.toFixed(1)}/1k views (${p.conv7.band.toLowerCase()}).`);
  }

  if (working.length === 0) working.push('Baseline established — tracking signals.');
  return working.slice(0, 3);
}

/** What's limiting growth */
function whatsLimiting(p: ReportProps): string[] {
  const limits: string[] = [];
  const { stats, missedReach, structuralGaps, conv7 } = p;

  // Conversion gap
  if (stats.subs7d != null && stats.subs7d <= 0 && stats.views7d != null && stats.views7d > 0) {
    limits.push('Views up, subs flat — watching but not subscribing.');
  }

  if (conv7 && conv7.band !== 'INSUFFICIENT' && (conv7.band === 'WEAK' || conv7.band === 'SOFT')) {
    limits.push(`Weak conversion (${conv7.ratePer1k.toFixed(1)}/1k views) — funnel from viewer to subscriber is leaking.`);
  }

  // Missing formats
  if (missedReach.length > 0) {
    const gapCounts: Record<string, number> = {};
    for (const v of missedReach) {
      for (const f of v.formats) gapCounts[f.name] = (gapCounts[f.name] ?? 0) + 1;
    }
    const topGap = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0];
    if (topGap) {
      limits.push(`${topGap[1]} videos missing ${topGap[0]} — structural gap limiting reach.`);
    }
  }

  // Structural gaps
  if (structuralGaps && structuralGaps.length > 0) {
    const names = structuralGaps.slice(0, 2).map((g) => g.name).join(' + ');
    limits.push(`Catalogue-wide ${names} gap — every video without support formats caps its lifecycle.`);
  }

  // Shorts gap
  if (stats.shorts30d === 0 && stats.uploads30d > 0) {
    limits.push('Zero Shorts — invisible to non-subscribers on mobile.');
  }

  if (limits.length === 0) limits.push('No critical blockers detected.');
  return limits.slice(0, 3);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Report builder — Weekly Campaign Report
// ═══════════════════════════════════════════════════════════════════════════════

function buildWeeklyReport(p: ReportProps): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [];
  const state = p.channelState.toUpperCase();

  // ── HEADER ──────────────────────────────────────────────────────────────
  lines.push(`WEEKLY CAMPAIGN REPORT — ${p.artistName.toUpperCase()}`);
  if (p.campaign) lines.push(`Campaign: ${p.campaign}`);
  lines.push(`${date} · STATE: ${state}`);
  lines.push('');

  // ── 1. PERFORMANCE SNAPSHOT ──────────────────────────────────────────────
  lines.push('1. PERFORMANCE SNAPSHOT');
  const snapParts: string[] = [];
  if (p.stats.subs != null) snapParts.push(`Subs: ${fmtNum(p.stats.subs)}`);
  if (p.stats.views7d != null) snapParts.push(`Views (7d): ${fmtDelta(p.stats.views7d)}`);
  if (p.stats.subs7d != null) snapParts.push(`Subs (7d): ${fmtDelta(p.stats.subs7d)}`);
  snapParts.push(`Uploads (30d): ${p.stats.uploads30d}`);
  snapParts.push(`Shorts (30d): ${p.stats.shorts30d}`);
  if (p.stats.lastUpDays != null) {
    snapParts.push(`Last upload: ${p.stats.lastUpDays === 0 ? 'today' : `${p.stats.lastUpDays}d ago`}`);
  }
  lines.push(snapParts.join(' · '));
  lines.push('');
  lines.push(interpretPerformance(p));
  lines.push('');

  // ── Campaign period (if active) ──────────────────────────────────────────
  if (p.campaignDaysSinceStart != null) {
    lines.push(`CAMPAIGN PERIOD (Day ${p.campaignDaysSinceStart})`);
    const campParts: string[] = [];
    campParts.push(`Content: ${p.campaignContentCount} uploads (${p.campaignShortsCount} Shorts, ${p.campaignContentCount - p.campaignShortsCount} videos)`);
    campParts.push(`Content views: ${fmtNum(p.campaignContentViews)}`);
    if (p.campaignViewsDelta != null) campParts.push(`Channel views: ${fmtDelta(p.campaignViewsDelta)}`);
    if (p.campaignSubsDelta != null) campParts.push(`Subs gained: ${fmtDelta(p.campaignSubsDelta)}`);
    lines.push(campParts.join(' · '));
    lines.push('');
  }

  // ── 2. DROP COMPARISON ──────────────────────────────────────────────────
  const recentVideos = p.recentUploads.filter((u) => u.kind === 'Video');
  if (recentVideos.length >= 2) {
    lines.push('2. DROP COMPARISON');
    const sorted = [...recentVideos].sort((a, b) => a.daysAgo - b.daysAgo);
    const latest = sorted[0];
    const previous = sorted[1];
    const latestVpd = latest.daysAgo > 0 ? Math.round(latest.views / latest.daysAgo) : latest.views;
    const prevVpd = previous.daysAgo > 0 ? Math.round(previous.views / previous.daysAgo) : previous.views;
    lines.push(`Latest: "${latest.title}" — ${fmtNum(latest.views)} views in ${latest.daysAgo}d (~${fmtNum(latestVpd)}/day)`);
    lines.push(`Previous: "${previous.title}" — ${fmtNum(previous.views)} views in ${previous.daysAgo}d (~${fmtNum(prevVpd)}/day)`);
    if (latestVpd > prevVpd) {
      const pct = prevVpd > 0 ? Math.round(((latestVpd - prevVpd) / prevVpd) * 100) : 0;
      lines.push(`→ Latest is ${pct > 0 ? pct + '% ' : ''}faster velocity. Momentum is building.`);
    } else if (prevVpd > latestVpd) {
      const pct = latestVpd > 0 ? Math.round(((prevVpd - latestVpd) / prevVpd) * 100) : 0;
      lines.push(`→ Previous had ${pct > 0 ? pct + '% ' : ''}stronger velocity. Latest needs support formats to catch up.`);
    } else {
      lines.push('→ Similar velocity. Consistent performance.');
    }
    lines.push('');
  }

  // ── 3. DISCOVERY SIGNALS ────────────────────────────────────────────────
  const disco = discoverySignals(p);
  if (disco.length > 0) {
    lines.push('3. DISCOVERY SIGNALS');
    for (const s of disco) lines.push(`→ ${s}`);
    lines.push('');
  }

  // ── 4. WHAT'S WORKING ──────────────────────────────────────────────────
  const working = whatsWorking(p);
  lines.push('4. WHAT\'S WORKING');
  for (const w of working) lines.push(`→ ${w}`);
  lines.push('');

  // ── 5. WHAT'S LIMITING GROWTH ──────────────────────────────────────────
  const limiting = whatsLimiting(p);
  lines.push('5. WHAT\'S LIMITING GROWTH');
  for (const l of limiting) lines.push(`→ ${l}`);
  lines.push('');

  // ── 6. WHAT TO DO NEXT ─────────────────────────────────────────────────
  lines.push('6. WHAT TO DO NEXT');
  lines.push(`PRIMARY → ${p.primaryMove.label}`);
  lines.push(p.primaryMove.action);
  if (p.secondaryMove) {
    lines.push('');
    lines.push(`SECONDARY → ${p.secondaryMove.label}`);
    lines.push(p.secondaryMove.action);
  }
  lines.push('');

  // ── FOOTER ─────────────────────────────────────────────────────────────
  lines.push('— Generated by YouTube Campaign Coach');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function WatcherReport(props: ReportProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    const text = buildWeeklyReport(props);
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
            <ClipboardIcon /> Generate weekly report
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
