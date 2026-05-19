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

/** Strategic support category — WHY this content exists in the rollout */
export type SupportCategory =
  | 'BTS'                // Behind the scenes, making of
  | 'World Building'     // Vlogs, day-in-the-life, personality content
  | 'Rollout Diary'      // Release journey, studio sessions
  | 'Personality'        // Interviews, podcasts, Q&A
  | 'Release Momentum'   // Lyric video, visualizer, remix, live session
  | 'Community Layer'    // Shorts, teasers, engagement clips
  | 'Follow-through'     // Post-release continuation, reaction content
  | 'Collaborator Bridge'; // Featuring/collab content that links releases

/** How confidently a support upload links to an anchor */
export type RelationshipStrength = 'strong' | 'moderate' | 'contextual';

/** A scored support relationship between an upload and an anchor */
export type SupportLink = {
  upload: RecentUpload;
  /** Relationship strength: strong (title match), moderate (description/format), contextual (timing only) */
  strength: RelationshipStrength;
  /** Numeric score (0-100) — higher = more confident relationship */
  score: number;
  /** Which signals contributed to this link */
  signals: string[];
  /** Strategic category for this support content */
  category: SupportCategory;
  /** The content role (format-based) */
  role: ContentRole;
};

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
  /** All support uploads grouped around this release (flat list for backward compat) */
  support: RecentUpload[];
  /** Scored support links with relationship intelligence */
  supportLinks: SupportLink[];
  /** Support grouped by strategic category */
  supportByCategory: Partial<Record<SupportCategory, SupportLink[]>>;
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
    /** Minimum view count to qualify as anchor (prevents noise from low-view releases) */
    minAnchorViews?: number;
    /** Custom pre-window days */
    preWindowDays?: number;
    /** Custom post-window days */
    postWindowDays?: number;
    /** Maximum number of pillars to return (most-viewed first) */
    maxPillars?: number;
  } = {},
): ReleaseCluster[] {
  const preWindow = options.preWindowDays ?? PRE_WINDOW_DAYS;
  const postWindow = options.postWindowDays ?? POST_WINDOW_DAYS;
  const minViews = options.minAnchorViews ?? 5000;
  const maxPillars = options.maxPillars ?? 6;

  if (uploads.length === 0) return [];

  // Sort by publish date (oldest first for chronological processing)
  const sorted = [...uploads].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  // 1. Identify anchors — ONLY official videos, premieres, documentaries
  //    These are the campaign pillars. Everything else is support infrastructure.
  const anchors: RecentUpload[] = [];
  for (const upload of sorted) {
    const fmt = classifyUploadFormat(upload);
    if (ANCHOR_FORMATS.includes(fmt) && upload.viewCount >= minViews) {
      anchors.push(upload);
    }
  }

  if (anchors.length === 0) return [];

  // 2. For each anchor, score all candidates in the window and build support links.
  //    Allow multi-anchor attachment: a support upload can link to multiple releases,
  //    but gets assigned to the anchor with the highest relationship score.
  //    Uploads with score < MIN_RELATIONSHIP_SCORE are excluded.

  // First pass: score every candidate against every anchor
  const anchorIds = new Set(anchors.map(a => a.id));
  const candidateScores: Map<string, { anchorId: string; score: number; signals: string[]; timingDays: number }[]> = new Map();

  for (const anchor of anchors) {
    const anchorDate = new Date(anchor.publishedAt).getTime();
    const windowStart = anchorDate - preWindow * 86400000;
    const windowEnd = anchorDate + postWindow * 86400000;

    for (const upload of sorted) {
      if (upload.id === anchor.id) continue;
      if (anchorIds.has(upload.id)) continue; // Don't score other anchors

      const t = new Date(upload.publishedAt).getTime();
      if (t < windowStart || t > windowEnd) continue;

      const timingDays = (t - anchorDate) / 86400000;
      const { score, signals } = scoreRelationship(anchor, upload, timingDays);

      if (score >= MIN_RELATIONSHIP_SCORE) {
        const existing = candidateScores.get(upload.id) ?? [];
        existing.push({ anchorId: anchor.id, score, signals, timingDays });
        candidateScores.set(upload.id, existing);
      }
    }
  }

  // Second pass: assign each candidate to its best-scoring anchor
  const assignedToAnchor = new Map<string, { upload: RecentUpload; score: number; signals: string[]; timingDays: number }[]>();
  for (const anchor of anchors) {
    assignedToAnchor.set(anchor.id, []);
  }

  candidateScores.forEach((scores, uploadId) => {
    // Sort by score descending — assign to highest-scoring anchor
    scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const best = scores[0];
    const upload = sorted.find(u => u.id === uploadId)!;
    assignedToAnchor.get(best.anchorId)!.push({
      upload,
      score: best.score,
      signals: best.signals,
      timingDays: best.timingDays,
    });
  });

  // Third pass: build clusters
  const clusters: ReleaseCluster[] = anchors.map((anchor) => {
    const anchorDate = new Date(anchor.publishedAt).getTime();
    const assigned = assignedToAnchor.get(anchor.id) ?? [];

    // Build scored support links
    const supportLinks: SupportLink[] = assigned
      .sort((a, b) => b.score - a.score)
      .map(({ upload, score, signals, timingDays }) => {
        const role = classifyRole(upload);
        const category = classifySupportCategory(upload, role, signals, timingDays);
        return {
          upload,
          strength: classifyStrength(score),
          score,
          signals,
          category,
          role,
        };
      });

    // Flat support list for backward compatibility
    const support = supportLinks.map(sl => sl.upload);

    // Count pre/post
    let preCount = 0;
    let postCount = 0;
    for (const u of support) {
      const t = new Date(u.publishedAt).getTime();
      if (t < anchorDate) preCount++;
      else postCount++;
    }

    // Group by category
    const supportByCategory: Partial<Record<SupportCategory, SupportLink[]>> = {};
    for (const link of supportLinks) {
      if (!supportByCategory[link.category]) supportByCategory[link.category] = [];
      supportByCategory[link.category]!.push(link);
    }

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
      supportLinks,
      supportByCategory,
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

  // Sort by anchor views (highest first), cap to maxPillars
  const ranked = clusters
    .sort((a, b) => b.anchor.viewCount - a.anchor.viewCount)
    .slice(0, maxPillars);

  // Then sort by date (most recent first) for display
  return ranked.sort(
    (a, b) => new Date(b.anchor.publishedAt).getTime() - new Date(a.anchor.publishedAt).getTime()
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Relationship Scoring Engine ────────────────────────────────────────────

/**
 * Extract meaningful keywords from a title for matching.
 * Strips common prefixes, suffixes, format markers, and noise words.
 */
function extractTitleKeywords(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\(official\)/gi, '')
    .replace(/\(lyric\s*video\)/gi, '')
    .replace(/\(visuali[sz]er\)/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\b/gi, '')
    .replace(/[''"""\[\](){}|#]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .trim();

  return cleaned
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !NOISE_WORDS.has(w));
}

/** Common words that don't carry semantic meaning for matching */
const NOISE_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'its',
  'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'are', 'has', 'his', 'how', 'man',
  'new', 'now', 'old', 'see', 'way', 'who', 'boy', 'did',
  'get', 'got', 'him', 'let', 'say', 'she', 'too', 'use',
  'video', 'official', 'music', 'lyrics', 'lyric', 'audio',
  'behind', 'scenes', 'the', 'vlog', 'part', 'episode',
]);

/**
 * Extract featured/collaborator names from a title.
 * Matches patterns like "ft. Artist", "feat. Artist", "x Artist", "& Artist"
 */
function extractCollaborators(title: string): string[] {
  const collabs: string[] = [];
  const patterns = [
    /(?:ft\.?|feat\.?|featuring)\s+([A-Z][A-Za-z\s]+?)(?:\s*[(\[,|]|$)/gi,
    /\bx\s+([A-Z][A-Za-z]+)/g,
    /&\s+([A-Z][A-Za-z]+)/g,
  ];
  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(title)) !== null) {
      collabs.push(match[1].trim().toLowerCase());
    }
  }
  return collabs;
}

/**
 * Score how strongly a candidate upload relates to an anchor release.
 * Returns a score 0-100 and the signals that contributed.
 */
function scoreRelationship(
  anchor: RecentUpload,
  candidate: RecentUpload,
  timingDays: number,
): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  const anchorKw = extractTitleKeywords(anchor.title);
  const candidateKw = extractTitleKeywords(candidate.title);
  const candidateTitle = candidate.title.toLowerCase();
  const candidateDesc = (candidate.description || '').toLowerCase().slice(0, 500);

  // ── HIGH SIGNALS (30-40 pts each) ──

  // Title contains the track name (2+ keyword overlap)
  const kwOverlap = anchorKw.filter(w => candidateKw.includes(w));
  if (kwOverlap.length >= 3) {
    score += 40;
    signals.push(`Title match: "${kwOverlap.slice(0, 3).join(', ')}"`);
  } else if (kwOverlap.length === 2) {
    score += 30;
    signals.push(`Partial title match: "${kwOverlap.join(', ')}"`);
  } else if (kwOverlap.length === 1 && anchorKw.length <= 3) {
    // Single keyword match is significant for short titles
    score += 15;
    signals.push(`Keyword: "${kwOverlap[0]}"`);
  }

  // Title contains "BTS" / "behind the scenes" + anchor keywords
  if (/\b(bts|behind\s*the\s*scenes|making\s*of)\b/.test(candidateTitle) && kwOverlap.length >= 1) {
    score += 35;
    signals.push('BTS for this release');
  }

  // Shared collaborator/featured artist
  const anchorCollabs = extractCollaborators(anchor.title);
  const candidateCollabs = extractCollaborators(candidate.title);
  const sharedCollabs = anchorCollabs.filter(c =>
    candidateCollabs.includes(c) || candidateTitle.includes(c)
  );
  if (sharedCollabs.length > 0) {
    score += 25;
    signals.push(`Shared collab: ${sharedCollabs.join(', ')}`);
  }
  // Also check if anchor collab name appears in candidate title/desc
  for (const collab of anchorCollabs) {
    if (collab.length > 3 && candidateTitle.includes(collab) && !sharedCollabs.includes(collab)) {
      score += 20;
      signals.push(`Collab reference: ${collab}`);
    }
  }

  // ── MEDIUM SIGNALS (10-20 pts each) ──

  // Description references the track name
  if (anchorKw.length >= 2) {
    const descOverlap = anchorKw.filter(w => candidateDesc.includes(w));
    if (descOverlap.length >= 2) {
      score += 15;
      signals.push('Description references release');
    }
  }

  // Format-specific role bonus (BTS, lyric video, visualizer inherently support releases)
  const fmt = classifyUploadFormat(candidate);
  if (['BTS', 'Lyric Video', 'Visualizer', 'Live Session'].includes(fmt)) {
    score += 10;
    signals.push(`${fmt} format`);
  }

  // ── TIMING SIGNAL (5-15 pts) ──
  const absDays = Math.abs(timingDays);
  if (absDays <= 3) {
    score += 15;
    signals.push('Same week as release');
  } else if (absDays <= 7) {
    score += 12;
    signals.push('Within 1 week');
  } else if (absDays <= 14) {
    score += 8;
    signals.push('Within 2 weeks');
  } else {
    score += 5;
    signals.push('Within release window');
  }

  return { score: Math.min(score, 100), signals };
}

/** Minimum score to count as related support content */
const MIN_RELATIONSHIP_SCORE = 10;

/** Score thresholds for relationship strength */
function classifyStrength(score: number): RelationshipStrength {
  if (score >= 40) return 'strong';
  if (score >= 20) return 'moderate';
  return 'contextual';
}

/**
 * Classify a support upload into a strategic category based on format + signals.
 */
function classifySupportCategory(
  upload: RecentUpload,
  role: ContentRole,
  signals: string[],
  timingDays: number,
): SupportCategory {
  const t = upload.title.toLowerCase();
  const fmt = classifyUploadFormat(upload);

  // Format-driven categories
  if (role === 'bts' || /\b(bts|behind\s*the\s*scenes|making\s*of)\b/.test(t)) return 'BTS';
  if (role === 'lyric' || role === 'visualizer' || role === 'live_session') return 'Release Momentum';
  if (role === 'interview') return 'Personality';
  if (role === 'documentary') return 'BTS';
  if (role === 'freestyle') return 'Release Momentum';

  // Content-driven categories
  if (/\b(vlog|day\s*in|life|behind|diary|journey|studio\s*session|recording)\b/.test(t)) return 'World Building';
  if (/\b(rollout|release\s*day|drop\s*day|launch|countdown)\b/.test(t)) return 'Rollout Diary';
  if (/\b(podcast|q\s*&?\s*a|interview|conversation|chat|talk)\b/.test(t)) return 'Personality';
  if (/\b(reaction|reacts?|respond|review)\b/.test(t)) return 'Follow-through';

  // Collaborator bridge
  if (signals.some(s => s.includes('collab') || s.includes('Collab'))) return 'Collaborator Bridge';

  // Shorts are community layer
  if (fmt === 'Short') return 'Community Layer';

  // Timing-based fallback
  if (timingDays < 0) return 'World Building'; // Pre-release longform
  if (timingDays >= 0 && timingDays <= 7) return 'Release Momentum'; // Same week
  return 'Follow-through'; // Post-release
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
    insights.push('Standalone release — adding support content around future drops could extend momentum');
    return insights;
  }

  // Pre-release activity
  if (preCount === 0) {
    insights.push('Warm-up content before the drop could build anticipation for future releases');
  } else if (preCount >= 3) {
    insights.push(`Strong warm-up: ${preCount} uploads before the drop built anticipation`);
  }

  // Post-release follow-through
  if (postCount === 0 && support.length > 0) {
    insights.push('Follow-through content after the drop would keep the algorithm serving this release longer');
  } else if (postCount >= 4) {
    insights.push(`Strong follow-through: ${postCount} uploads after the drop sustained momentum`);
  }

  // Shorts support
  const shorts = coverage.find(c => c.key === 'shorts');
  if (shorts?.present && shorts.count >= 3) {
    insights.push(`${shorts.count} Shorts kept the channel in feeds around this release`);
  } else if (!shorts?.present) {
    insights.push('Shorts would extend discovery — even 2-3 clips could widen the audience window');
  }

  // Missing key formats — opportunity framing
  const missing = coverage.filter(c =>
    ['lyric_video', 'visualizer', 'bts'].includes(c.key) && !c.present
  );
  if (missing.length > 0) {
    const names = missing.map(m => m.label).join(', ');
    insights.push(`${names} could extend long-tail discovery further`);
  }

  // View distribution
  const supportViews = support.reduce((s, u) => s + u.viewCount, 0);
  if (supportViews > anchor.viewCount * 0.5) {
    insights.push('Support content drove significant additional views beyond the main release');
  }

  return insights.slice(0, 4); // Cap at 4 insights
}
