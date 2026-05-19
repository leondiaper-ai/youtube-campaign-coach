/**
 * Release Cluster Engine
 *
 * Transforms a flat list of uploads into a release-centric architecture:
 * every major longform drop becomes a "campaign pillar" with support content
 * orbiting around it within a time window.
 *
 * This answers: "Did we build a YouTube world around this release?"
 */

import type { RecentUpload } from '@/lib/artists';
import { classifyUploadFormat, type UploadFormatLabel } from './matchEngine';
import { fmtNum } from '@/lib/artists';

// ── Types ──────────────────────────────────────────────────────────────────

/** Content role relative to a major release */
export type ContentRole =
  | 'anchor'        // The main release (official video, premiere)
  | 'teaser'        // Pre-release hype (shorts, teasers before drop)
  | 'bts'           // Behind the scenes
  | 'lyric'         // Lyric video support
  | 'visualizer'    // Visualizer support
  | 'live_session'  // Acoustic, live, stripped-back
  | 'interview'     // Interview / podcast / press
  | 'follow_up'     // Post-release shorts, reactions, etc.
  | 'community'     // Community posts (planned actions, not uploads)
  | 'premiere'      // Premiere event
  | 'documentary'   // Mini-doc / making-of
  | 'freestyle'     // Freestyle variant
  | 'other';        // Unclassified support

/** A support format that could orbit a release */
export type SupportFormat = {
  key: string;             // e.g. 'shorts', 'bts', 'lyric_video'
  label: string;           // e.g. 'Shorts', 'BTS', 'Lyric Video'
  present: boolean;        // Was this format used?
  count: number;           // How many of this format?
  totalViews: number;      // Combined views across this format
  uploads: RecentUpload[]; // Actual uploads of this format
};

/** A major release with its support cluster */
export type ReleaseCluster = {
  /** The anchor upload — the official video / major drop */
  anchor: RecentUpload;
  /** Classified format of the anchor */
  anchorFormat: UploadFormatLabel;
  /** All support uploads grouped around this release */
  support: RecentUpload[];
  /** Support matrix — what formats were present/missing */
  coverage: SupportFormat[];
  /** Coverage score: how many of the key formats were present (0-1) */
  coverageScore: number;
  /** Coverage label */
  coverageLabel: 'Strong' | 'Moderate' | 'Weak' | 'Minimal';
  /** Total views across anchor + all support */
  totalViews: number;
  /** Total uploads in this cluster (anchor + support) */
  totalUploads: number;
  /** Pre-release support count (teasers before the drop) */
  preReleaseCount: number;
  /** Post-release support count */
  postReleaseCount: number;
  /** Days the support window was active */
  activeDays: number;
  /** Strategic notes about what's missing or strong */
  insights: string[];
};

// ── Constants ──────────────────────────────────────────────────────────────

/** How many days before a release to look for teaser content */
const PRE_WINDOW_DAYS = 14;

/** How many days after a release to look for follow-up content */
const POST_WINDOW_DAYS = 21;

/** Formats that count as "major drops" — anchors for clusters */
const ANCHOR_FORMATS: UploadFormatLabel[] = [
  'Official Video',
  'Premiere',
  'Documentary',
];

/** The key support formats we check for coverage */
const SUPPORT_FORMAT_DEFS: { key: string; label: string; match: (f: UploadFormatLabel, role: ContentRole) => boolean }[] = [
  { key: 'shorts',       label: 'Shorts',        match: (f) => f === 'Short' },
  { key: 'bts',          label: 'BTS',            match: (f) => f === 'BTS' },
  { key: 'lyric_video',  label: 'Lyric Video',    match: (f) => f === 'Lyric Video' },
  { key: 'visualizer',   label: 'Visualizer',     match: (f) => f === 'Visualizer' },
  { key: 'live_session', label: 'Live Session',   match: (f) => f === 'Live Session' },
  { key: 'interview',    label: 'Interview',      match: (f) => f === 'Interview' },
  { key: 'premiere',     label: 'Premiere',       match: (f) => f === 'Premiere' },
  { key: 'freestyle',    label: 'Freestyle',      match: (f) => f === 'Freestyle' },
];

// ── Core Engine ────────────────────────────────────────────────────────────

/**
 * Detect major releases and build support clusters around each one.
 *
 * @param uploads All recent uploads from the channel
 * @param options Configuration for cluster detection
 * @returns Array of release clusters, sorted by date (most recent first)
 */
export function buildReleaseClusters(
  uploads: RecentUpload[],
  options: {
    /** Also treat longform uploads (>3min, non-Short) as anchors even without "Official Video" in title */
    treatLongformAsAnchor?: boolean;
    /** Minimum view count to qualify as anchor (prevents noise from low-view longform) */
    minAnchorViews?: number;
    /** Custom pre-window days */
    preWindowDays?: number;
    /** Custom post-window days */
    postWindowDays?: number;
  } = {},
): ReleaseCluster[] {
  const preWindow = options.preWindowDays ?? PRE_WINDOW_DAYS;
  const postWindow = options.postWindowDays ?? POST_WINDOW_DAYS;
  const minViews = options.minAnchorViews ?? 0;

  if (uploads.length === 0) return [];

  // Sort by publish date (oldest first for chronological processing)
  const sorted = [...uploads].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  // 1. Identify anchors — major longform drops
  const anchors: RecentUpload[] = [];
  for (const upload of sorted) {
    const fmt = classifyUploadFormat(upload);
    const isExplicitAnchor = ANCHOR_FORMATS.includes(fmt);
    const isLongform = options.treatLongformAsAnchor &&
      upload.durationSec > 180 &&
      fmt !== 'Short' &&
      !['BTS', 'Interview', 'Live Session'].includes(fmt);

    if ((isExplicitAnchor || isLongform) && upload.viewCount >= minViews) {
      anchors.push(upload);
    }
  }

  // If no explicit anchors, try to find the highest-view longform as anchor
  if (anchors.length === 0) {
    const longform = sorted.filter(u => u.durationSec > 120 && classifyUploadFormat(u) !== 'Short');
    if (longform.length > 0) {
      const best = longform.sort((a, b) => b.viewCount - a.viewCount)[0];
      if (best.viewCount > 1000) anchors.push(best);
    }
  }

  if (anchors.length === 0) return [];

  // 2. For each anchor, find support content within the window
  const usedIds = new Set<string>();

  const clusters: ReleaseCluster[] = anchors.map((anchor) => {
    const anchorDate = new Date(anchor.publishedAt).getTime();
    const windowStart = anchorDate - preWindow * 86400000;
    const windowEnd = anchorDate + postWindow * 86400000;

    // Find support uploads in the window (excluding other anchors)
    const support: RecentUpload[] = [];
    let preCount = 0;
    let postCount = 0;

    for (const upload of sorted) {
      if (upload.id === anchor.id) continue;
      if (usedIds.has(upload.id)) continue;

      const t = new Date(upload.publishedAt).getTime();
      if (t < windowStart || t > windowEnd) continue;

      // Don't steal another anchor's identity
      const fmt = classifyUploadFormat(upload);
      if (ANCHOR_FORMATS.includes(fmt) && anchors.some(a => a.id === upload.id)) continue;

      // Check title relevance — share keywords with the anchor
      if (isRelated(anchor, upload)) {
        support.push(upload);
        if (t < anchorDate) preCount++;
        else postCount++;
      }
    }

    // Mark used
    usedIds.add(anchor.id);
    support.forEach(u => usedIds.add(u.id));

    // 3. Build coverage matrix
    const coverage = buildCoverageMatrix(support);

    // 4. Compute coverage score
    const keyFormats = ['shorts', 'bts', 'lyric_video', 'visualizer'];
    const keyPresent = keyFormats.filter(k => coverage.find(c => c.key === k)?.present).length;
    const coverageScore = keyPresent / keyFormats.length;

    const coverageLabel: ReleaseCluster['coverageLabel'] =
      coverageScore >= 0.75 ? 'Strong' :
      coverageScore >= 0.5 ? 'Moderate' :
      coverageScore >= 0.25 ? 'Weak' : 'Minimal';

    // 5. Calculate active days
    const allDates = [anchor, ...support].map(u => new Date(u.publishedAt).getTime());
    const activeDays = Math.round((Math.max(...allDates) - Math.min(...allDates)) / 86400000);

    // 6. Total views
    const totalViews = anchor.viewCount + support.reduce((s, u) => s + u.viewCount, 0);

    // 7. Generate insights
    const insights = generateInsights(anchor, support, coverage, preCount, postCount, coverageScore);

    return {
      anchor,
      anchorFormat: classifyUploadFormat(anchor),
      support,
      coverage,
      coverageScore,
      coverageLabel,
      totalViews,
      totalUploads: 1 + support.length,
      preReleaseCount: preCount,
      postReleaseCount: postCount,
      activeDays,
      insights,
    };
  });

  // Sort most recent first
  return clusters.sort(
    (a, b) => new Date(b.anchor.publishedAt).getTime() - new Date(a.anchor.publishedAt).getTime()
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Check if a support upload is related to the anchor (shared keywords, artist name match) */
function isRelated(anchor: RecentUpload, candidate: RecentUpload): boolean {
  // Always include Shorts — they're general channel support
  if (candidate.durationSec <= 62) return true;

  const anchorWords = extractKeywords(anchor.title);
  const candWords = extractKeywords(candidate.title);

  // Check for shared meaningful keywords (song name, artist name, project name)
  const shared = anchorWords.filter(w => candWords.includes(w));
  if (shared.length >= 1) return true;

  // Check description overlap
  const anchorDesc = anchor.description.toLowerCase().slice(0, 200);
  const candDesc = candidate.description.toLowerCase().slice(0, 200);
  const descWords = extractKeywords(anchor.title);
  if (descWords.some(w => candDesc.includes(w))) return true;
  const candTitleWords = extractKeywords(candidate.title);
  if (candTitleWords.some(w => anchorDesc.includes(w))) return true;

  return false;
}

/** Extract meaningful keywords from a title (remove noise words) */
function extractKeywords(title: string): string[] {
  const noise = new Set([
    'official', 'video', 'music', 'lyric', 'lyrics', 'visualizer', 'visualiser',
    'bts', 'behind', 'the', 'scenes', 'making', 'of', 'ft', 'feat', 'featuring',
    'prod', 'by', 'directed', 'shot', 'x', 'and', 'with', 'in', 'on', 'at',
    'a', 'an', 'for', 'to', 'from', 'is', 'it', 'my', 'me', 'we', 'us',
    'shorts', 'short', 'clip', 'new', 'out', 'now', 'live', 'session',
    'premiere', 'premier', 'freestyle', 'interview', 'podcast',
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !noise.has(w));
}

/** Build the support format coverage matrix */
function buildCoverageMatrix(support: RecentUpload[]): SupportFormat[] {
  return SUPPORT_FORMAT_DEFS.map(def => {
    const matching = support.filter(u => {
      const fmt = classifyUploadFormat(u);
      return def.match(fmt, classifyRole(u));
    });

    return {
      key: def.key,
      label: def.label,
      present: matching.length > 0,
      count: matching.length,
      totalViews: matching.reduce((s, u) => s + u.viewCount, 0),
      uploads: matching,
    };
  });
}

/** Classify a support upload's role */
function classifyRole(upload: RecentUpload): ContentRole {
  const fmt = classifyUploadFormat(upload);
  switch (fmt) {
    case 'Short': return 'follow_up'; // Refined later by timing
    case 'BTS': return 'bts';
    case 'Lyric Video': return 'lyric';
    case 'Visualizer': return 'visualizer';
    case 'Live Session': return 'live_session';
    case 'Interview': return 'interview';
    case 'Premiere': return 'premiere';
    case 'Documentary': return 'documentary';
    case 'Freestyle': return 'freestyle';
    default: return 'other';
  }
}

/** Generate strategic insights about a release cluster */
function generateInsights(
  anchor: RecentUpload,
  support: RecentUpload[],
  coverage: SupportFormat[],
  preCount: number,
  postCount: number,
  score: number,
): string[] {
  const insights: string[] = [];

  // Single upload release
  if (support.length === 0) {
    insights.push('Single upload release — no support content detected in the ±3 week window');
    return insights;
  }

  // Pre-release activity
  if (preCount === 0) {
    insights.push('No pre-release teasers — the drop had no warm-up content');
  } else if (preCount >= 3) {
    insights.push(`Strong pre-release: ${preCount} uploads before the drop built anticipation`);
  }

  // Post-release follow-through
  if (postCount === 0 && support.length > 0) {
    insights.push('All support was pre-release — no follow-up content kept momentum alive');
  } else if (postCount >= 4) {
    insights.push(`Strong follow-through: ${postCount} uploads after the drop kept the algorithm active`);
  }

  // Shorts support
  const shorts = coverage.find(c => c.key === 'shorts');
  if (shorts?.present && shorts.count >= 3) {
    insights.push(`${shorts.count} Shorts kept the channel in feeds around this release`);
  } else if (!shorts?.present) {
    insights.push('No Shorts support — Shorts drive discovery and would have extended reach');
  }

  // Missing key formats
  const missing = coverage.filter(c =>
    ['lyric_video', 'visualizer', 'bts'].includes(c.key) && !c.present
  );
  if (missing.length > 0) {
    const names = missing.map(m => m.label).join(', ');
    insights.push(`Missing: ${names} — these formats extend how long a release stays in feeds`);
  }

  // View distribution
  const supportViews = support.reduce((s, u) => s + u.viewCount, 0);
  if (supportViews > anchor.viewCount * 0.5) {
    insights.push('Support content drove significant additional views beyond the main release');
  }

  return insights.slice(0, 4); // Cap at 4 insights
}
