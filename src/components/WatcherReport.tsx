'use client';

import { useState, useCallback } from 'react';
import type { ConversionResult } from '@/lib/conversion';

const INK = '#0E0E0E';
const SIGNAL = '#FF4A1C';
const ELECTRIC = '#2C25FF';
const MINT = '#1FBE7A';
const MUTED = '#E9E2D3';
const SOFT = '#F6F1E7';

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

// ═══════════════════════════════════════════════════════════════════════════════
// Insight prioritisation engine
// Priority: 1. Major campaign growth → 2. Launch performance → 3. Channel movement
// → 4. Content cadence → 5. Discovery signals → 6. Behaviour observations
// ═══════════════════════════════════════════════════════════════════════════════

type Insight = { priority: number; text: string };

function gatherInsights(p: ReportProps): string[] {
  const pool: Insight[] = [];
  const { stats, recentUploads, conv7, campaign } = p;

  // ── 1. Major campaign growth ───────────────────────────────────────────
  if (p.campaignViewsDelta != null && p.campaignViewsDelta > 100_000) {
    pool.push({
      priority: 10,
      text: `${fmtDelta(p.campaignViewsDelta)} channel views since campaign start${p.campaignDaysSinceStart ? ` (day ${p.campaignDaysSinceStart})` : ''}`,
    });
  }
  if (p.campaignSubsDelta != null && p.campaignSubsDelta > 500) {
    pool.push({
      priority: 9,
      text: `${fmtDelta(p.campaignSubsDelta)} subscribers gained during the campaign period`,
    });
  }

  // ── 2. Launch performance ──────────────────────────────────────────────
  const videos = recentUploads.filter((u) => u.kind === 'Video');
  const sortedVids = [...videos].sort((a, b) => b.views - a.views);
  if (sortedVids.length > 0) {
    const top = sortedVids[0];
    const vpd = top.daysAgo > 0 ? Math.round(top.views / top.daysAgo) : top.views;
    if (top.views >= 10_000) {
      pool.push({
        priority: 8,
        text: `${top.title}: ${fmtNum(top.views)} views in ${top.daysAgo} day${top.daysAgo !== 1 ? 's' : ''} (~${fmtNum(vpd)} views/day)`,
      });
    }
  }

  // Compare latest vs previous video velocity
  if (sortedVids.length >= 2) {
    const latest = [...videos].sort((a, b) => a.daysAgo - b.daysAgo);
    const curr = latest[0];
    const prev = latest[1];
    const currVpd = curr.daysAgo > 0 ? Math.round(curr.views / curr.daysAgo) : curr.views;
    const prevVpd = prev.daysAgo > 0 ? Math.round(prev.views / prev.daysAgo) : prev.views;
    if (currVpd > prevVpd && prevVpd > 0) {
      const pct = Math.round(((currVpd - prevVpd) / prevVpd) * 100);
      if (pct >= 20) {
        pool.push({
          priority: 7,
          text: `7-day channel views increased ${pct}% compared to the previous release`,
        });
      }
    }
  }

  // ── 3. Channel movement ────────────────────────────────────────────────
  if (stats.views7d != null && stats.views7d > 0) {
    pool.push({
      priority: 6,
      text: `${fmtDelta(stats.views7d)} channel views in the last 7 days`,
    });
  }
  if (stats.subs7d != null && stats.subs7d > 0) {
    pool.push({
      priority: 5.5,
      text: `${fmtDelta(stats.subs7d)} subscribers in the last 7 days`,
    });
  }
  if (stats.subs7d != null && stats.subs7d <= 0 && stats.views7d != null && stats.views7d > 5000) {
    pool.push({
      priority: 5,
      text: `Views are climbing but subscribers are flat — audience is watching without committing`,
    });
  }

  // ── 4. Content cadence ─────────────────────────────────────────────────
  if (stats.uploads30d >= 8) {
    const shortsNote = stats.shorts30d > 0 ? `, including ${stats.shorts30d} Shorts` : '';
    pool.push({
      priority: 4,
      text: `Excellent publishing cadence with ${stats.uploads30d} uploads in 30 days${shortsNote}`,
    });
  } else if (stats.uploads30d >= 4) {
    const shortsNote = stats.shorts30d > 0 ? `, including ${stats.shorts30d} Shorts` : '';
    pool.push({
      priority: 4,
      text: `Good publishing cadence with ${stats.uploads30d} uploads in 30 days${shortsNote}`,
    });
  } else if (stats.uploads30d <= 2 && stats.uploads30d > 0) {
    pool.push({
      priority: 4,
      text: `Only ${stats.uploads30d} upload${stats.uploads30d !== 1 ? 's' : ''} in 30 days — below the threshold for consistent algorithmic push`,
    });
  } else if (stats.uploads30d === 0) {
    pool.push({
      priority: 4,
      text: `No uploads in 30 days — the algorithm has no signal to work with`,
    });
  }

  // ── 5. Discovery signals ───────────────────────────────────────────────
  // Conversion quality
  if (conv7 && conv7.band !== 'INSUFFICIENT') {
    if (conv7.band === 'STRONG' || conv7.band === 'HEALTHY') {
      pool.push({
        priority: 3.5,
        text: `Strong subscriber conversion at ${conv7.ratePer1k.toFixed(1)} per 1K views — audience is committing`,
      });
    } else if (conv7.band === 'WEAK' || conv7.band === 'SOFT') {
      pool.push({
        priority: 3.5,
        text: `Subscriber conversion is ${conv7.band.toLowerCase()} at ${conv7.ratePer1k.toFixed(1)} per 1K views — the funnel from viewer to subscriber needs attention`,
      });
    }
  }

  // Browse/recommendation signal
  // We don't have browse % in current props, but we can infer from views + cadence
  if (stats.views7d != null && stats.views7d > 50_000 && stats.uploads30d >= 4) {
    pool.push({
      priority: 3,
      text: 'Strong view volume with consistent uploads — YouTube is likely actively recommending the channel',
    });
  }

  // Shorts activity
  const shorts14d = recentUploads.filter((u) => u.kind === 'Short').length;
  if (shorts14d >= 3) {
    pool.push({
      priority: 2.5,
      text: `${shorts14d} Shorts in the last 14 days — discovery layer is active`,
    });
  } else if (shorts14d === 0 && recentUploads.length > 0) {
    pool.push({
      priority: 2.5,
      text: 'No Shorts in the last 14 days — missing the fastest discovery surface on YouTube',
    });
  }

  // ── 6. Behaviour observations ──────────────────────────────────────────
  if (campaign && p.campaignDaysSinceStart != null) {
    if (p.campaignDaysSinceStart >= 7 && p.campaignDaysSinceStart <= 14) {
      pool.push({
        priority: 2,
        text: 'Channel is within the 7–14 day follow-up window — ideal timing to release another long-form asset while recommendation signals remain elevated',
      });
    }
  }

  // Sort by priority descending, take top 5
  pool.sort((a, b) => b.priority - a.priority);
  return pool.slice(0, 5).map((i) => i.text);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recommendation engine — one clear next action
// ═══════════════════════════════════════════════════════════════════════════════

function generateRecommendation(p: ReportProps): string {
  const { stats, recentUploads, conv7, campaign } = p;
  const viewsUp = stats.views7d != null && stats.views7d > 0;
  const viewsStrong = stats.views7d != null && stats.views7d > 5_000;
  const subsFlat = stats.subs7d != null && stats.subs7d <= 0;
  const subsUp = stats.subs7d != null && stats.subs7d > 0;
  const cadenceStrong = stats.uploads30d >= 5;
  const cadenceWeak = stats.uploads30d <= 2;
  const convWeak = conv7 && conv7.band !== 'INSUFFICIENT' && (conv7.band === 'WEAK' || conv7.band === 'SOFT');
  const shorts14d = recentUploads.filter((u) => u.kind === 'Short').length;

  // Follow-up window — highest priority if in window
  if (campaign && p.campaignDaysSinceStart != null && p.campaignDaysSinceStart >= 5 && p.campaignDaysSinceStart <= 14) {
    return 'Continue momentum by releasing another long-form asset within the 7–14 day follow-up window while recommendation signals remain elevated.';
  }

  // Compounding — don't disrupt
  if (viewsUp && subsUp && cadenceStrong) {
    return 'Momentum is building — maintain the current upload rhythm and release the next asset within 3–4 days to keep algorithmic velocity high.';
  }

  // Weak conversion
  if (viewsStrong && subsFlat) {
    return 'Views are landing but subscribers aren\'t following. Prioritise a behind-the-scenes or artist story piece that gives viewers a reason to subscribe.';
  }
  if (convWeak && viewsUp) {
    return 'Conversion is soft — the audience is watching but not committing. Add an artist-led context piece (BTS, breakdown, or commentary) to build subscriber intent.';
  }

  // Weak cadence
  if (cadenceWeak && viewsUp) {
    return `Upload cadence is too low at ${stats.uploads30d} in 30 days. Ship 2–3 Shorts this week to build consistent signal for the algorithm.`;
  }

  // Weak reach — no Shorts
  if (shorts14d === 0 && recentUploads.length > 0) {
    return 'Start posting Shorts — 2–3 vertical cutdowns this week will activate the fastest discovery surface on YouTube.';
  }

  // Cold
  if (stats.views7d == null || (stats.views7d === 0 && (stats.subs7d == null || stats.subs7d === 0))) {
    return 'Channel is cold — reactivate with 2–3 catalogue Shorts this week to generate signal before any campaign content will distribute.';
  }

  // Generic fallback
  if (cadenceStrong) {
    return 'Cadence is strong — continue the upload rhythm and monitor which formats are generating the most subscriber conversion.';
  }
  return 'Increase upload frequency and prioritise Shorts alongside any long-form releases to build consistent algorithmic signal.';
}


// ═══════════════════════════════════════════════════════════════════════════════
// Communication update builders
// ═══════════════════════════════════════════════════════════════════════════════

function buildSlackUpdate(p: ReportProps): string {
  const bullets = gatherInsights(p);
  const rec = generateRecommendation(p);
  const campaignContext = p.campaign
    ? ` following ${p.campaign}`
    : '';

  const lines: string[] = [];
  lines.push(`Quick ${p.artistName} YouTube update${campaignContext}:`);
  lines.push('');
  for (const b of bullets) {
    lines.push(`• ${b}`);
  }
  lines.push('');
  lines.push('Recommendation');
  lines.push(rec);

  return lines.join('\n');
}

function buildEmailUpdate(p: ReportProps): string {
  const bullets = gatherInsights(p);
  const rec = generateRecommendation(p);
  const campaignContext = p.campaign
    ? ` following ${p.campaign}`
    : '';

  const lines: string[] = [];
  lines.push('Hi all,');
  lines.push('');
  lines.push(`Quick ${p.artistName} YouTube update${campaignContext}:`);
  lines.push('');
  for (const b of bullets) {
    lines.push(`• ${b}`);
  }
  lines.push('');
  lines.push('Recommendation');
  lines.push(rec);

  return lines.join('\n');
}

function buildFullReport(p: ReportProps): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const bullets = gatherInsights(p);
  const rec = generateRecommendation(p);

  const lines: string[] = [];
  lines.push(`CAMPAIGN UPDATE — ${p.artistName.toUpperCase()}`);
  if (p.campaign) lines.push(`Campaign: ${p.campaign}`);
  lines.push(`${date} · ${p.channelState.toUpperCase()}`);
  lines.push('');

  // Performance snapshot
  lines.push('PERFORMANCE');
  const snapParts: string[] = [];
  if (p.stats.subs != null) snapParts.push(`Subs: ${fmtNum(p.stats.subs)}`);
  if (p.stats.views7d != null) snapParts.push(`Views (7d): ${fmtDelta(p.stats.views7d)}`);
  if (p.stats.subs7d != null) snapParts.push(`Subs (7d): ${fmtDelta(p.stats.subs7d)}`);
  snapParts.push(`Uploads (30d): ${p.stats.uploads30d}`);
  if (p.stats.shorts30d > 0) snapParts.push(`Shorts (30d): ${p.stats.shorts30d}`);
  lines.push(snapParts.join(' · '));
  lines.push('');

  // Campaign period
  if (p.campaignDaysSinceStart != null) {
    lines.push(`CAMPAIGN PERIOD (Day ${p.campaignDaysSinceStart})`);
    const campParts: string[] = [];
    campParts.push(`Content: ${p.campaignContentCount} uploads (${p.campaignShortsCount} Shorts, ${p.campaignContentCount - p.campaignShortsCount} long-form)`);
    campParts.push(`Content views: ${fmtNum(p.campaignContentViews)}`);
    if (p.campaignViewsDelta != null) campParts.push(`Channel views: ${fmtDelta(p.campaignViewsDelta)}`);
    if (p.campaignSubsDelta != null) campParts.push(`Subs gained: ${fmtDelta(p.campaignSubsDelta)}`);
    lines.push(campParts.join(' · '));
    lines.push('');
  }

  // Key insights
  lines.push('KEY INSIGHTS');
  for (const b of bullets) {
    lines.push(`• ${b}`);
  }
  lines.push('');

  // Recommendation
  lines.push('RECOMMENDATION');
  lines.push(rec);

  return lines.join('\n');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Shared button components — reusable across pages
// ═══════════════════════════════════════════════════════════════════════════════

type CopyState = 'idle' | 'slack' | 'email' | 'report';

function useCopyUpdate(props: ReportProps) {
  const [copied, setCopied] = useState<CopyState>('idle');

  const copy = useCallback((type: 'slack' | 'email' | 'report') => {
    let text: string;
    if (type === 'slack') text = buildSlackUpdate(props);
    else if (type === 'email') text = buildEmailUpdate(props);
    else text = buildEmailUpdate(props);

    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied('idle'), 2000);
    });
  }, [props]);

  return { copied, copy };
}


/** Compact inline buttons for embedding in table rows / card headers */
export function ReportActions({ props, showBehaviour, onBehaviour }: {
  props: ReportProps;
  showBehaviour?: boolean;
  onBehaviour?: () => void;
}) {
  const { copied, copy } = useCopyUpdate(props);

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {showBehaviour && onBehaviour && (
        <button
          onClick={onBehaviour}
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
          style={{ background: ELECTRIC, color: '#fff' }}
        >
          Behaviour
        </button>
      )}
      <button
        onClick={() => copy('slack')}
        className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
        style={{
          background: copied === 'slack' ? '#E6F8EE' : SOFT,
          color: copied === 'slack' ? '#0C6A3F' : 'rgba(14,14,14,0.55)',
        }}
      >
        {copied === 'slack' ? 'Copied' : 'Slack'}
      </button>
      <button
        onClick={() => copy('email')}
        className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
        style={{
          background: copied === 'email' ? '#E6F8EE' : SOFT,
          color: copied === 'email' ? '#0C6A3F' : 'rgba(14,14,14,0.55)',
        }}
      >
        {copied === 'email' ? 'Copied' : 'Email'}
      </button>
    </div>
  );
}

/** Full-size buttons for the detail page header */
export function ReportButtonBar({ props }: { props: ReportProps }) {
  const { copied, copy } = useCopyUpdate(props);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => copy('slack')}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 transition-colors cursor-pointer"
        style={{
          background: copied === 'slack' ? '#E6F8EE' : SOFT,
          color: copied === 'slack' ? '#0C6A3F' : INK,
          border: `1px solid ${copied === 'slack' ? MINT : MUTED}`,
        }}
      >
        {copied === 'slack' ? <CheckIcon /> : <SlackIcon />}
        {copied === 'slack' ? 'Copied' : 'Slack Update'}
      </button>
      <button
        onClick={() => copy('email')}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 transition-colors cursor-pointer"
        style={{
          background: copied === 'email' ? '#E6F8EE' : SOFT,
          color: copied === 'email' ? '#0C6A3F' : INK,
          border: `1px solid ${copied === 'email' ? MINT : MUTED}`,
        }}
      >
        {copied === 'email' ? <CheckIcon /> : <EmailIcon />}
        {copied === 'email' ? 'Copied' : 'Email Update'}
      </button>
      <button
        onClick={() => copy('report')}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 transition-colors cursor-pointer"
        style={{
          background: copied === 'report' ? '#E6F8EE' : 'transparent',
          color: copied === 'report' ? '#0C6A3F' : 'rgba(14,14,14,0.45)',
          border: `1px solid ${copied === 'report' ? MINT : MUTED}`,
        }}
      >
        {copied === 'report' ? <CheckIcon /> : <EmailIcon />}
        {copied === 'report' ? 'Copied' : 'Email Report'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default export — backwards compatible with existing watcher detail page
// Now renders the full button bar instead of a single "Generate weekly report"
// ═══════════════════════════════════════════════════════════════════════════════

export default function WatcherReport(props: ReportProps) {
  return (
    <div className="mt-10 flex items-center justify-center">
      <ReportButtonBar props={props} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// Icons
// ═══════════════════════════════════════════════════════════════════════════════

function SlackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
      <path d="M14 20.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" />
      <path d="M10 9.5C10 10.33 9.33 11 8.5 11h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z" />
      <path d="M10 3.5C10 4.33 9.33 5 8.5 5S7 4.33 7 3.5 7.67 2 8.5 2s1.5.67 1.5 1.5z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
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
