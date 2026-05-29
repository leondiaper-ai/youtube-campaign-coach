/**
 * Content Structure — lightweight structural warnings for campaigns.
 *
 * Only surfaces when a campaign has a notable structural gap.
 * If everything looks fine, returns null — nothing renders.
 *
 * Uses only data available from YouTube Data API v3:
 * content mix, durations, title patterns, upload counts.
 * No watch-time estimation, no retention scores, no fake KPIs.
 */

import type { RecentUpload } from './artists';

// ── Types ──────────────────────────────────────────────────────────────────

export type StructureWarningKind =
  | 'SHORTS_HEAVY'
  | 'NO_LONGFORM'
  | 'UNSUPPORTED_VIDEO'
  | 'SINGLE_ASSET'
  | 'NO_FOLLOWUP'
  | 'LOW_VARIETY';

export type StructureWarning = {
  kind: StructureWarningKind;
  headline: string;
  detail: string;
};

// ── Asset detection (reused from old module, slimmed) ──────────────────────

const SUPPORT_PATTERNS: [RegExp, string][] = [
  [/\b(lyric\s*video|lyrics?\b)/i, 'Lyric Video'],
  [/\b(visuali[sz]er)\b/i, 'Visualizer'],
  [/\b(behind\s*the\s*scenes|bts|making\s*of)\b/i, 'BTS'],
  [/\b(live\s*session|live\s*performance|live\s*at|acoustic\s*session)\b/i, 'Live Session'],
  [/\b(interview|conversation\s*with|talks?\s*to)\b/i, 'Interview'],
  [/\b(documentary|doc\b|mini[\s-]?doc)\b/i, 'Documentary'],
  [/\b(reaction|react)\b/i, 'Reaction'],
];

const OFFICIAL_VIDEO_RE = /\b(official\s*(music\s*)?video|official\s*vid)\b/i;

function detectSupportAssets(uploads: RecentUpload[]): string[] {
  const found = new Set<string>();
  for (const u of uploads) {
    const text = `${u.title} ${u.description}`;
    for (const [re, label] of SUPPORT_PATTERNS) {
      if (re.test(text)) found.add(label);
    }
  }
  return Array.from(found);
}

function hasOfficialVideo(uploads: RecentUpload[]): boolean {
  return uploads.some((u) => OFFICIAL_VIDEO_RE.test(u.title));
}

// ── Core check ─────────────────────────────────────────────────────────────

const SHORTS_CUTOFF = 62;
const LONGFORM_MIN = 120;

export function checkContentStructure(
  uploads: RecentUpload[],
): StructureWarning | null {
  if (uploads.length === 0) return null;

  const shorts = uploads.filter((u) => u.durationSec > 0 && u.durationSec <= SHORTS_CUTOFF);
  const longform = uploads.filter((u) => u.durationSec > LONGFORM_MIN);
  const supportAssets = detectSupportAssets(longform);
  const hasOfficial = hasOfficialVideo(uploads);

  // ── SINGLE-ASSET CAMPAIGN ───────────────────────────────────────────
  // Campaign has only 1 upload total
  if (uploads.length === 1) {
    return {
      kind: 'SINGLE_ASSET',
      headline: 'Single-asset campaign',
      detail: 'Only one upload detected. Add supporting content to extend the release window.',
    };
  }

  // ── NO LONGFORM ─────────────────────────────────────────────────────
  // All content is Shorts, zero longform
  if (longform.length === 0 && shorts.length > 0) {
    return {
      kind: 'NO_LONGFORM',
      headline: 'No longform support',
      detail: `${shorts.length} Shorts active but no longform content. Discovery is happening without deeper viewing to support it.`,
    };
  }

  // ── SHORTS-HEAVY ────────────────────────────────────────────────────
  // Shorts outnumber longform 4:1 or more, with at least 4 Shorts
  if (shorts.length >= 4 && longform.length > 0 && shorts.length >= longform.length * 4) {
    return {
      kind: 'SHORTS_HEAVY',
      headline: 'Shorts-heavy campaign',
      detail: `${shorts.length} Shorts vs ${longform.length} longform. Discovery content is active but limited deeper viewing support.`,
    };
  }

  // ── OFFICIAL VIDEO UNSUPPORTED ──────────────────────────────────────
  // Has an official video but no supporting depth assets around it
  if (hasOfficial && supportAssets.length === 0 && longform.length <= 2) {
    return {
      kind: 'UNSUPPORTED_VIDEO',
      headline: 'Official video running unsupported',
      detail: 'No supporting longform content (BTS, lyric video, visualizer, live session) detected around the release.',
    };
  }

  // ── NO FOLLOW-UP ────────────────────────────────────────────────────
  // Has longform but nothing posted in the last 14 days
  if (longform.length >= 2) {
    const now = Date.now();
    const mostRecent = Math.max(...uploads.map((u) => new Date(u.publishedAt).getTime()));
    const daysSinceLatest = (now - mostRecent) / 86400000;
    if (daysSinceLatest > 14) {
      return {
        kind: 'NO_FOLLOWUP',
        headline: 'No follow-up content',
        detail: `Last upload was ${Math.round(daysSinceLatest)} days ago. Campaign may be losing momentum without fresh content.`,
      };
    }
  }

  // ── LOW VARIETY ─────────────────────────────────────────────────────
  // Has multiple longform but only 1 format type (all the same kind of thing)
  if (longform.length >= 3 && supportAssets.length === 0) {
    return {
      kind: 'LOW_VARIETY',
      headline: 'Low format variety',
      detail: `${longform.length} longform uploads but no format variety detected. Lyric videos, visualizers, or BTS would broaden reach.`,
    };
  }

  // ── No structural issue — return nothing ────────────────────────────
  return null;
}

// ── Multiformat Strategy Score ──────────────────────────────────────────────
//
// YouTube recommends a multiformat approach: Shorts for discovery,
// Official Videos as anchors, Lyric Videos + Visualizers for catalogue
// depth, BTS for connection, Live Sessions for authenticity.
// This function scores how well a channel follows that strategy.

export type MultiformatScore = {
  hasShorts: boolean;
  hasOfficialVideo: boolean;
  hasLyricVideo: boolean;
  hasVisualizer: boolean;
  hasBTS: boolean;
  hasLiveSession: boolean;
  formatCount: number;
  score: 'Strong' | 'Good' | 'Partial' | 'Weak' | 'None';
};

/**
 * Compute multiformat strategy score.
 *
 * DESIGN PRINCIPLE: Real multi-format means multiple content types
 * supporting an anchor release — NOT just Shorts + one random longform.
 *
 * An "anchor" is an Official Video, Visualiser, or Lyric Video.
 * These are the primary pieces of music content that sit at the centre
 * of a campaign. Supporting formats (BTS, Live Sessions, Shorts) are
 * only meaningful when they orbit around an anchor.
 *
 * Scoring:
 *   Strong — Anchor + Shorts + 2+ supporting formats (BTS/Live/etc)
 *   Good   — Anchor + Shorts + 1 supporting format
 *   Partial — Anchor only, or Shorts + 1 supporting (no anchor)
 *   Weak   — Only 1 format type active (e.g. just Shorts)
 *   None   — No content in the last 90 days
 */
export function computeMultiformat(uploads: RecentUpload[]): MultiformatScore {
  // Only consider uploads from the last 90 days
  const cutoff = Date.now() - 90 * 86400000;
  const recent = uploads.filter(
    (u) => new Date(u.publishedAt).getTime() >= cutoff
  );

  const hasShorts = recent.some((u) => u.durationSec > 0 && u.durationSec <= 62);
  const hasOfficialVideo = recent.some((u) =>
    /\b(official\s*(music\s*)?video|official\s*vid)\b/i.test(u.title) ||
    /\[\s*(music\s*video|official\s*video|official\s*music\s*video)\s*\]/i.test(u.title)
  );
  const hasLyricVideo = recent.some((u) => /\blyric\s*(video|vid)?\b/i.test(u.title));
  const hasVisualizer = recent.some((u) => /\bvisualise?r\b/i.test(u.title));
  const hasBTS = recent.some((u) => /\b(bts|behind\s*the\s*scenes|making\s*of)\b/i.test(u.title));
  const hasLiveSession = recent.some((u) =>
    /\b(live\s*session|acoustic|stripped\s*back|live\s*at|live\s*from)\b/i.test(u.title)
  );

  const formatCount = [hasShorts, hasOfficialVideo, hasLyricVideo, hasVisualizer, hasBTS, hasLiveSession]
    .filter(Boolean).length;

  // ── Anchor-aware scoring ───────────────────────────────────────────
  // An anchor is a primary release piece: Official Video, Visualiser, or Lyric Video
  const hasAnchor = hasOfficialVideo || hasVisualizer || hasLyricVideo;
  const anchorCount = [hasOfficialVideo, hasVisualizer, hasLyricVideo].filter(Boolean).length;
  // Supporting formats that orbit the anchor
  const supportCount = [hasBTS, hasLiveSession].filter(Boolean).length;

  let score: MultiformatScore['score'];

  if (hasAnchor && hasShorts && (supportCount >= 2 || (supportCount >= 1 && anchorCount >= 2))) {
    // Anchor + Shorts + 2+ supporting, OR anchor types covering 2+ formats + Shorts + 1 supporting
    // e.g. Official Video + Visualiser + Shorts + BTS = Strong
    // e.g. Official Video + Shorts + BTS + Live Session = Strong
    score = 'Strong';
  } else if (hasAnchor && hasShorts && (supportCount >= 1 || anchorCount >= 2)) {
    // Anchor + Shorts + 1 supporting format
    // e.g. Official Video + Shorts + BTS = Good
    // e.g. Official Video + Lyric Video + Shorts = Good
    score = 'Good';
  } else if (hasAnchor && hasShorts) {
    // Anchor + Shorts but no supporting variety
    // e.g. Official Video + Shorts only = Partial (strategy exists but thin)
    score = 'Partial';
  } else if (hasAnchor || (hasShorts && supportCount >= 1)) {
    // Has anchor but no Shorts, or has Shorts + BTS/Live but no anchor
    // e.g. Official Video alone, or Shorts + BTS without a release to support
    score = 'Partial';
  } else if (formatCount >= 1) {
    // Only Shorts, or only one random longform type
    score = 'Weak';
  } else {
    score = 'None';
  }

  return { hasShorts, hasOfficialVideo, hasLyricVideo, hasVisualizer, hasBTS, hasLiveSession, formatCount, score };
}
