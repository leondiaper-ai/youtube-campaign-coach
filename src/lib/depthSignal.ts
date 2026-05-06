/**
 * Depth Signal — directional proxy for watch-time quality.
 *
 * Watch time is NOT available via the YouTube Data API v3.
 * This module estimates whether a campaign has enough "depth-building"
 * content (longform videos that drive sustained viewing) based on
 * signals we CAN observe: content mix, video durations, engagement
 * ratios, view longevity, and the presence of specific asset types.
 *
 * Labels:
 *   STRONG_DEPTH    — longform content is active and gaining views
 *   REACH_HEAVY     — Shorts/views are active but depth assets are limited
 *   DEPTH_GAP       — campaign has views but lacks longform/supportive content
 *   SHORTS_SPIKE    — reach is present but likely low watch-time contribution
 *   WATCH_TIME_OPP  — add lyric, visualizer, BTS, live, interview content
 */

import type { RecentUpload } from './artists';

// ── Types ──────────────────────────────────────────────────────────────────

export type DepthLabel =
  | 'STRONG_DEPTH'
  | 'REACH_HEAVY'
  | 'DEPTH_GAP'
  | 'SHORTS_SPIKE'
  | 'WATCH_TIME_OPP';

export type DepthSignalResult = {
  label: DepthLabel;
  title: string;
  reason: string;
  /** 0-100 directional score (not a real watch-time metric) */
  score: number;
  /** Suggested asset types to add, if any */
  suggestions: string[];
  /** Raw breakdown for display */
  breakdown: {
    longformCount: number;
    shortsCount: number;
    longformViews: number;
    shortsViews: number;
    depthAssetCount: number;
    depthAssetTypes: string[];
    avgEngagementRate: number;
    longevityVideos: number;
  };
};

// ── Asset type detection ───────────────────────────────────────────────────

const DEPTH_PATTERNS: [RegExp, string][] = [
  [/\b(official\s*(music\s*)?video|official\s*vid)\b/i, 'Official Video'],
  [/\b(lyric\s*video|lyrics?\b)/i, 'Lyric Video'],
  [/\b(visuali[sz]er)\b/i, 'Visualizer'],
  [/\b(behind\s*the\s*scenes|bts|making\s*of)\b/i, 'BTS'],
  [/\b(live\s*session|live\s*performance|live\s*at|acoustic\s*session)\b/i, 'Live Session'],
  [/\b(interview|conversation\s*with|talks?\s*to)\b/i, 'Interview'],
  [/\b(documentary|doc\b|mini[\s-]?doc)\b/i, 'Documentary'],
  [/\b(reaction|react)\b/i, 'Reaction'],
  [/\b(freestyle|cypher)\b/i, 'Freestyle'],
  [/\b(podcast|ep\.\s*\d|episode\s*\d)/i, 'Long-form Talk'],
];

const ALL_DEPTH_TYPES = [
  'Official Video', 'Lyric Video', 'Visualizer', 'BTS',
  'Live Session', 'Interview', 'Documentary',
];

function detectDepthAssets(uploads: RecentUpload[]): string[] {
  const found = new Set<string>();
  for (const u of uploads) {
    const text = `${u.title} ${u.description}`;
    for (const [re, label] of DEPTH_PATTERNS) {
      if (re.test(text)) found.add(label);
    }
  }
  return Array.from(found);
}

// ── Core computation ───────────────────────────────────────────────────────

export function computeDepthSignal(
  uploads: RecentUpload[],
  opts?: {
    /** Days since campaign start — used to gauge longevity */
    campaignDays?: number;
  },
): DepthSignalResult {
  const SHORTS_CUTOFF = 62; // seconds — anything ≤62s is a Short
  const LONGFORM_MIN = 120; // seconds — meaningful longform starts at 2min
  const now = Date.now();

  // Split content
  const shorts = uploads.filter((u) => u.durationSec > 0 && u.durationSec <= SHORTS_CUTOFF);
  const longform = uploads.filter((u) => u.durationSec > LONGFORM_MIN);
  const allLive = uploads.filter((u) => u.live === 'none');

  const longformViews = longform.reduce((s, u) => s + u.viewCount, 0);
  const shortsViews = shorts.reduce((s, u) => s + u.viewCount, 0);

  // Depth asset detection
  const depthAssetTypes = detectDepthAssets(longform);
  const depthAssetCount = depthAssetTypes.length;

  // Engagement rate: (likes + comments) / views across longform
  const totalLfViews = longform.reduce((s, u) => s + u.viewCount, 0);
  const totalLfEngagement = longform.reduce(
    (s, u) => s + u.likeCount + u.commentCount, 0,
  );
  const avgEngagementRate = totalLfViews > 0
    ? (totalLfEngagement / totalLfViews) * 100
    : 0;

  // Longevity: longform videos older than 72h that are still getting views
  // Proxy: if a video is >3 days old and has >1000 views, it has longevity
  const longevityVideos = longform.filter((u) => {
    const ageMs = now - new Date(u.publishedAt).getTime();
    const ageDays = ageMs / 86400000;
    return ageDays > 3 && u.viewCount > 1000;
  }).length;

  // ── Score calculation (0-100) ──────────────────────────────────────────
  let score = 0;

  // Longform presence (0-30)
  const lfRatio = longform.length / Math.max(1, uploads.length);
  score += Math.min(30, Math.round(lfRatio * 60));

  // Depth asset variety (0-25)
  score += Math.min(25, depthAssetCount * 5);

  // Longform views (0-20)
  if (longformViews > 100_000) score += 20;
  else if (longformViews > 50_000) score += 15;
  else if (longformViews > 10_000) score += 10;
  else if (longformViews > 1_000) score += 5;

  // Engagement quality (0-15)
  if (avgEngagementRate > 5) score += 15;
  else if (avgEngagementRate > 3) score += 10;
  else if (avgEngagementRate > 1) score += 5;

  // Longevity bonus (0-10)
  if (longevityVideos >= 3) score += 10;
  else if (longevityVideos >= 1) score += 5;

  score = Math.min(100, score);

  // ── Label assignment ───────────────────────────────────────────────────
  const breakdown = {
    longformCount: longform.length,
    shortsCount: shorts.length,
    longformViews,
    shortsViews,
    depthAssetCount,
    depthAssetTypes,
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    longevityVideos,
  };

  // No content at all
  if (uploads.length === 0) {
    return {
      label: 'DEPTH_GAP',
      title: 'Depth Gap',
      reason: 'No recent uploads to assess',
      score: 0,
      suggestions: ALL_DEPTH_TYPES.slice(0, 3),
      breakdown,
    };
  }

  // Almost all Shorts, minimal longform
  if (shorts.length >= 3 && longform.length <= 1 && lfRatio < 0.15) {
    const suggestions = missingTypes(depthAssetTypes);
    return {
      label: 'SHORTS_SPIKE',
      title: 'Shorts Spike',
      reason: `${shorts.length} Shorts vs ${longform.length} longform — reach is present but likely low watch-time contribution`,
      score,
      suggestions,
      breakdown,
    };
  }

  // Views are happening but no depth assets
  if (longform.length >= 1 && depthAssetCount === 0 && longformViews > 0) {
    return {
      label: 'WATCH_TIME_OPP',
      title: 'Watch-Time Opportunity',
      reason: `${longform.length} longform video${longform.length > 1 ? 's' : ''} gaining views but no depth assets detected — add lyric, visualizer, BTS, or live session content`,
      score,
      suggestions: missingTypes(depthAssetTypes),
      breakdown,
    };
  }

  // Good longform + some views but heavily Shorts-dominated views
  if (shortsViews > longformViews * 3 && shorts.length > longform.length) {
    return {
      label: 'REACH_HEAVY',
      title: 'Reach Heavy',
      reason: `Shorts driving ${formatViews(shortsViews)} views vs ${formatViews(longformViews)} longform — depth assets are limited`,
      score,
      suggestions: missingTypes(depthAssetTypes),
      breakdown,
    };
  }

  // Has views but no longform at all
  if (longform.length === 0 && shorts.length > 0) {
    return {
      label: 'DEPTH_GAP',
      title: 'Depth Gap',
      reason: `Campaign has ${formatViews(shortsViews)} Shorts views but no longform content`,
      score,
      suggestions: ALL_DEPTH_TYPES.slice(0, 3),
      breakdown,
    };
  }

  // Strong: good longform, decent views, some depth assets
  if (score >= 40 && longform.length >= 2 && longformViews > 5000) {
    return {
      label: 'STRONG_DEPTH',
      title: 'Strong Depth Signal',
      reason: `${longform.length} longform assets with ${formatViews(longformViews)} views${depthAssetCount > 0 ? ` — ${depthAssetTypes.join(', ')}` : ''}`,
      score,
      suggestions: missingTypes(depthAssetTypes),
      breakdown,
    };
  }

  // Default: opportunity
  const suggestions = missingTypes(depthAssetTypes);
  return {
    label: 'WATCH_TIME_OPP',
    title: 'Watch-Time Opportunity',
    reason: suggestions.length > 0
      ? `Add ${suggestions.slice(0, 3).join(', ')} to build depth`
      : 'Increase longform output to build watch time',
    score,
    suggestions,
    breakdown,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function missingTypes(existing: string[]): string[] {
  return ALL_DEPTH_TYPES.filter((t) => !existing.includes(t));
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Display helpers ────────────────────────────────────────────────────────

export const DEPTH_COLORS: Record<DepthLabel, { bg: string; text: string; dot: string }> = {
  STRONG_DEPTH:   { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  REACH_HEAVY:    { bg: '#FEF9C3', text: '#854D0E', dot: '#F59E0B' },
  DEPTH_GAP:      { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
  SHORTS_SPIKE:   { bg: '#FFF7ED', text: '#9A3412', dot: '#F97316' },
  WATCH_TIME_OPP: { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
};

export const DEPTH_DISCLAIMER =
  'Watch time is not available via the current API. This is a directional proxy showing whether the campaign has enough depth-building content.';
