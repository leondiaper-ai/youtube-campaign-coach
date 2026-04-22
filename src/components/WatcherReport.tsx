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
// SIGNAL → PRIMARY → SECONDARY decision engine
// ═══════════════════════════════════════════════════════════════════════════════

type SignalType = 'WEAK_CONVERSION' | 'WEAK_REACH' | 'WEAK_CADENCE' | 'COMPOUNDING' | 'COLD';

type Signal = {
  type: SignalType;
  line: string;
};

/** Best-performing recent upload (last 14d) */
function topRecent(p: ReportProps): RecentUploadEntry | null {
  if (p.recentUploads.length === 0) return null;
  return p.recentUploads.reduce((best, u) => u.views > best.views ? u : best, p.recentUploads[0]);
}

/** Derive the core signal from performance data */
function deriveSignal(p: ReportProps): Signal {
  const { stats, conv7 } = p;
  const viewsUp = stats.views7d != null && stats.views7d > 0;
  const viewsStrong = stats.views7d != null && stats.views7d > 5_000;
  const subsFlat = stats.subs7d != null && stats.subs7d <= 0;
  const subsUp = stats.subs7d != null && stats.subs7d > 0;
  const cadenceStrong = stats.uploads30d >= 5;
  const cadenceWeak = stats.uploads30d <= 2;
  const convWeak = conv7 && conv7.band !== 'INSUFFICIENT' && (conv7.band === 'WEAK' || conv7.band === 'SOFT');
  const best = topRecent(p);

  // 1. WEAK CONVERSION — views are there but subs aren't following
  if (viewsStrong && subsFlat) {
    const trackRef = best ? ` — "${best.title}" is pulling views but not subscribers` : '';
    return {
      type: 'WEAK_CONVERSION',
      line: `Views are landing but subs aren't following${trackRef}. Content isn't building connection.`,
    };
  }
  if (convWeak && viewsUp) {
    const rate = conv7!.ratePer1k.toFixed(1);
    return {
      type: 'WEAK_CONVERSION',
      line: `Conversion at ${rate}/1k views (${conv7!.band.toLowerCase()}) — audience watches but doesn't commit.`,
    };
  }

  // 2. WEAK REACH — low views, algorithm isn't distributing
  if (!viewsUp && cadenceWeak) {
    return {
      type: 'WEAK_REACH',
      line: 'Low views and low output — the algorithm has nothing to work with.',
    };
  }
  if (!viewsStrong && !cadenceWeak) {
    return {
      type: 'WEAK_REACH',
      line: 'Content is going out but views are flat — format or hook isn\'t catching.',
    };
  }

  // 3. WEAK CADENCE — output too low for algorithm traction
  if (cadenceWeak && viewsUp) {
    return {
      type: 'WEAK_CADENCE',
      line: `Only ${stats.uploads30d} uploads in 30d — not enough signal for the algorithm to sustain distribution.`,
    };
  }

  // 4. COMPOUNDING — everything growing
  if (viewsUp && subsUp && cadenceStrong) {
    return {
      type: 'COMPOUNDING',
      line: 'Views, subs, and cadence all positive — momentum is compounding. Don\'t disrupt it.',
    };
  }

  // 5. COLD — no signal at all
  if (stats.views7d == null || (stats.views7d === 0 && stats.subs7d === 0)) {
    return {
      type: 'COLD',
      line: 'Channel is cold — zero signal in 7d. Needs reactivation before anything else.',
    };
  }

  // Fallback
  return {
    type: 'WEAK_REACH',
    line: 'Mixed signals — output is present but not yet converting into growth.',
  };
}

/** Derive PRIMARY action — must directly respond to the signal */
function derivePrimary(p: ReportProps, signal: Signal): string {
  const { stats, recentUploads, missedReach } = p;
  const best = topRecent(p);
  const cadenceStrong = stats.uploads30d >= 5;

  switch (signal.type) {
    case 'WEAK_CONVERSION': {
      // Cadence is already strong — do NOT suggest posting more
      // Need deeper content that builds connection
      if (best) {
        return `"${best.title}" has reach but isn't converting. Post a track breakdown, studio session, or artist story piece that gives viewers a reason to subscribe — not another cutdown.`;
      }
      return 'Post a BTS, breakdown, or artist-led context piece. The audience is watching but needs a reason to commit — give them the story behind the music.';
    }

    case 'WEAK_REACH': {
      // Need discovery formats — Shorts, hooks, frequency
      const shortsCount = recentUploads.filter((u) => u.kind === 'Short').length;
      if (shortsCount === 0) {
        return 'Zero Shorts in rotation — start with 2-3 vertical cutdowns this week. Shorts are the fastest discovery surface on YouTube and the channel isn\'t using them.';
      }
      if (best && best.views < 5000) {
        return `"${best.title}" topped out at ${fmtNum(best.views)} — test a stronger hook format. Lead with the most visual or emotional 3 seconds, not a cold open.`;
      }
      // Check for missed format opportunities
      if (missedReach.length > 0) {
        const top = missedReach[0];
        const topFormat = top.formats[0]?.name ?? 'Short';
        return `"${top.title}" (${fmtNum(top.views)} views) has no ${topFormat}. Cut one — it extends the video's discovery window and compounds existing views.`;
      }
      return 'Increase Shorts frequency and test stronger hooks. The algorithm needs consistent signal and the first 3 seconds need to stop the scroll.';
    }

    case 'WEAK_CADENCE': {
      if (best && best.views > 10_000) {
        return `"${best.title}" is performing (${fmtNum(best.views)} views) but it's carrying the channel alone. Cut 2-3 support Shorts from it this week and stack a new upload to build cadence.`;
      }
      return `${stats.uploads30d} uploads in 30d is below the threshold for algorithmic momentum. Ship 2-3 Shorts this week to establish rhythm — the algorithm rewards consistency over quality.`;
    }

    case 'COMPOUNDING': {
      // Don't break what's working — extend it
      if (best) {
        return `"${best.title}" is the momentum carrier at ${fmtNum(best.views)} views. Double down — cut additional formats from it and make sure the next upload lands within 3-4 days to maintain algorithm velocity.`;
      }
      return 'Momentum is building — maintain the upload rhythm and don\'t let more than 4 days pass without posting. The algorithm is rewarding the channel right now.';
    }

    case 'COLD': {
      return 'Reactivate the channel with 2-3 catalogue Shorts this week — anything on the channel\'s best-performing tracks. The algorithm needs signal before any campaign content will distribute.';
    }

    default:
      return p.primaryMove.action;
  }
}

/** Derive SECONDARY action — amplify or extend */
function deriveSecondary(p: ReportProps, signal: Signal): string | null {
  const { stats, recentUploads, missedReach, structuralGaps } = p;
  const best = topRecent(p);

  switch (signal.type) {
    case 'WEAK_CONVERSION': {
      // Suggest Community Post engagement or cross-platform
      if (stats.shorts30d > 0 && best) {
        return `Use a Community Post to ask the audience a question about "${best.title}" — engagement signals help the algorithm and build subscriber intent.`;
      }
      return 'Pin a Community Post linking to the best-performing video with a direct subscribe CTA. Make the value proposition explicit.';
    }

    case 'WEAK_REACH': {
      // Suggest collaboration or timing
      if (structuralGaps && structuralGaps.length > 0) {
        const gapName = structuralGaps[0].name;
        return `${structuralGaps[0].count} videos missing ${gapName} — batch-create these to unlock reach on existing content that's already proven.`;
      }
      return 'Cross-post the strongest Short to TikTok and Instagram Reels — widen the discovery funnel beyond YouTube while cadence builds.';
    }

    case 'WEAK_CADENCE': {
      if (missedReach.length > 0) {
        const names = missedReach.slice(0, 2).map((v) => `"${v.title}"`).join(' and ');
        return `${names} already have views — cut Shorts from these first. It's faster than creating from scratch and the algorithm already has signal on them.`;
      }
      return null;
    }

    case 'COMPOUNDING': {
      if (recentUploads.length >= 3) {
        const sorted = [...recentUploads].sort((a, b) => b.views - a.views);
        const second = sorted[1];
        if (second) {
          return `"${second.title}" is the second-strongest performer — give it a Short cutdown to build a second discovery path alongside the lead.`;
        }
      }
      return 'This is a hold-and-extend phase — don\'t introduce new formats or experiments. Stack what\'s working.';
    }

    case 'COLD': {
      return 'Once the first 2-3 uploads are live, post a Community Post reintroducing the channel. Don\'t wait for results — the goal is signal volume, not single-upload performance.';
    }

    default:
      return p.secondaryMove?.action ?? null;
  }
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
  lines.push('');

  // SIGNAL — sharp one-line diagnosis from data
  const signal = deriveSignal(p);
  lines.push(`SIGNAL → ${signal.line}`);
  lines.push('');

  // PRIMARY — must directly respond to the signal, never repeat what works
  const primary = derivePrimary(p, signal);
  lines.push(`PRIMARY → ${primary}`);
  lines.push('');

  // SECONDARY — amplify or extend
  const secondary = deriveSecondary(p, signal);
  if (secondary) {
    lines.push(`SECONDARY → ${secondary}`);
    lines.push('');
  }

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
