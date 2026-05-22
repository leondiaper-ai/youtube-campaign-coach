/**
 * Campaign Narrative Engine
 *
 * Universal campaign grammar that governs how ALL campaign pages work.
 * One system, one set of rules, applied consistently everywhere.
 *
 * Core principle: the planner tells the story of the campaign,
 * not the story of the upload feed. New uploads reinforce campaign
 * narrative rather than constantly resetting the page hierarchy.
 *
 * Architecture:
 *   1. Asset Classification  → what IS this content?
 *   2. Moment Grouping       → what belongs together?
 *   3. Hierarchy Weighting    → what should be visually dominant?
 *   4. Timeline Persistence   → how do moments evolve over time?
 *   5. Ecosystem Attachment   → how does support orbit centrepieces?
 *   6. Active Moment Scoring  → what's happening NOW?
 *   7. Phase Progression      → where are we in the campaign arc?
 *   8. Content Decay          → what fades, what persists?
 */

import type { RecentUpload } from '@/lib/artists';
import type { PhaseName, ParsedEvent, GeneratedPlan } from '@/lib/planEngine';
import { classifyUploadFormat, type UploadFormatLabel } from './matchEngine';


// ══════════════════════════════════════════════════════════════════════════════
// 1. ASSET CLASSIFICATION — What IS this content?
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Narrative role: where this content sits in the campaign hierarchy.
 * This replaces all scattered format-to-role mappings across the codebase.
 */
export type NarrativeRole =
  | 'centrepiece'      // Official Video, major premiere — the event itself
  | 'support'          // Lyric video, visualizer, BTS — extends a centrepiece
  | 'momentum'         // Shorts, clips — keeps the feed alive
  | 'world-building'   // Vlogs, docs, studio sessions — deepens the universe
  | 'ecosystem'        // Interviews, podcasts, collabs — broader narrative
  | 'bridge'           // Tour content, festival — connects campaign phases
  | 'unclassified';    // Catch-all

/**
 * Decay profile: how quickly this content should fade from visual prominence.
 * Different content types have different shelf lives in a campaign narrative.
 */
export type DecayProfile = {
  /** Half-life in days — after this many days, prominence halves */
  halfLifeDays: number;
  /** Minimum prominence floor (0-1) — never decays below this */
  floor: number;
  /** Maximum days before content is treated as "historical" */
  maxActiveDays: number;
};

/**
 * A fully classified asset — the atomic unit of the campaign narrative.
 */
export type ClassifiedAsset = {
  upload: RecentUpload;
  /** Format label from the classifier (Official Video, Short, etc.) */
  format: UploadFormatLabel;
  /** Narrative role — where this sits in the campaign hierarchy */
  role: NarrativeRole;
  /** Narrative weight (0-100) — determines visual dominance */
  weight: number;
  /** How this content decays over time */
  decay: DecayProfile;
  /** Current prominence (0-1) — weight × decay factor at this moment */
  prominence: number;
  /** Days since publication */
  ageDays: number;
};

// ── Format → Role mapping ─────────────────────────────────────────────────

const FORMAT_ROLE: Record<UploadFormatLabel, NarrativeRole> = {
  'Official Video': 'centrepiece',
  'Premiere':       'centrepiece',
  'Documentary':    'centrepiece',
  'Lyric Video':    'support',
  'Visualizer':     'support',
  'BTS':            'support',
  'Live Session':   'support',
  'Freestyle':      'support',
  'Trailer':        'support',
  'Short':          'momentum',
  'Interview':      'ecosystem',
  'Longform':       'world-building',
  'Collab':         'centrepiece',
  'Upload':         'unclassified',
};

// ── Format → Base weight ──────────────────────────────────────────────────
// Higher weight = more visually dominant in the campaign narrative.

const FORMAT_WEIGHT: Record<UploadFormatLabel, number> = {
  'Official Video': 100,  // Flagship release — always the centrepiece
  'Premiere':       90,   // Major premiere event
  'Documentary':    85,   // Longform flagship
  'Longform':       75,   // Full longform content (album streams, sessions)
  'BTS':            60,   // Behind-the-scenes — strong support content
  'Live Session':   55,   // Live performance captures
  'Lyric Video':    50,   // Direct support for a release
  'Visualizer':     50,   // Direct support for a release
  'Freestyle':      40,   // Original performance content
  'Trailer':        70,   // Album/release trailer — strong pre-release longform
  'Interview':      30,   // Ecosystem / press
  'Short':          25,   // Momentum content
  'Collab':         90,   // Cross-channel collab — same weight as Premiere (cross-audience moment)
  'Upload':         10,   // Generic / unclassified
};

// ── Format → Decay profile ───────────────────────────────────────────────
// Official videos persist for weeks. Shorts fade in days.

const FORMAT_DECAY: Record<UploadFormatLabel, DecayProfile> = {
  'Official Video': { halfLifeDays: 28, floor: 0.3, maxActiveDays: 90 },
  'Premiere':       { halfLifeDays: 21, floor: 0.25, maxActiveDays: 60 },
  'Documentary':    { halfLifeDays: 30, floor: 0.3, maxActiveDays: 90 },
  'Lyric Video':    { halfLifeDays: 21, floor: 0.15, maxActiveDays: 60 },
  'Visualizer':     { halfLifeDays: 21, floor: 0.15, maxActiveDays: 60 },
  'BTS':            { halfLifeDays: 14, floor: 0.1, maxActiveDays: 45 },
  'Live Session':   { halfLifeDays: 14, floor: 0.1, maxActiveDays: 45 },
  'Freestyle':      { halfLifeDays: 14, floor: 0.1, maxActiveDays: 45 },
  'Trailer':        { halfLifeDays: 21, floor: 0.15, maxActiveDays: 60 },
  'Interview':      { halfLifeDays: 10, floor: 0.05, maxActiveDays: 30 },
  'Longform':       { halfLifeDays: 14, floor: 0.1, maxActiveDays: 45 },
  'Short':          { halfLifeDays: 5,  floor: 0.02, maxActiveDays: 14 },
  'Collab':         { halfLifeDays: 21, floor: 0.25, maxActiveDays: 60 },
  'Upload':         { halfLifeDays: 7,  floor: 0.05, maxActiveDays: 21 },
};

/**
 * Calculate current decay factor for an asset.
 * Uses exponential decay: factor = max(floor, 2^(-age/halfLife))
 */
function calculateDecayFactor(ageDays: number, decay: DecayProfile): number {
  if (ageDays <= 0) return 1;
  if (ageDays > decay.maxActiveDays) return decay.floor;
  const raw = Math.pow(2, -ageDays / decay.halfLifeDays);
  return Math.max(decay.floor, raw);
}

/**
 * Classify a single upload into the campaign narrative system.
 * This is the single entry point — every upload goes through here.
 */
export function classifyAsset(upload: RecentUpload): ClassifiedAsset {
  const format = classifyUploadFormat(upload);
  const role = FORMAT_ROLE[format] ?? 'unclassified';
  const baseWeight = FORMAT_WEIGHT[format] ?? 10;
  const decay = FORMAT_DECAY[format] ?? { halfLifeDays: 7, floor: 0.05, maxActiveDays: 21 };
  const ageDays = (Date.now() - new Date(upload.publishedAt).getTime()) / 86400000;

  // View velocity bonus: high-performing content stays prominent longer
  const viewVelocity = ageDays > 0 ? upload.viewCount / ageDays : upload.viewCount;
  const velocityBonus = viewVelocity > 10000 ? 10 : viewVelocity > 1000 ? 5 : 0;

  const weight = Math.min(100, baseWeight + velocityBonus);
  const decayFactor = calculateDecayFactor(ageDays, decay);
  const prominence = (weight / 100) * decayFactor;

  return { upload, format, role, weight, decay, prominence, ageDays };
}


// ══════════════════════════════════════════════════════════════════════════════
// 2. CAMPAIGN MOMENT — What belongs together?
// ══════════════════════════════════════════════════════════════════════════════

/**
 * A campaign moment: a centrepiece with its orbit of supporting content.
 * This is the core narrative unit — the page is a sequence of these.
 */
export type NarrativeMoment = {
  /** Unique ID (centrepiece upload ID, or synthesized for planned moments) */
  id: string;
  /** The centrepiece asset — the reason this moment exists */
  centrepiece: ClassifiedAsset;
  /** Support assets (lyric video, BTS, visualizer) — extends the centrepiece */
  support: ClassifiedAsset[];
  /** Momentum assets (shorts, clips) — keeps the feed alive around this drop */
  momentum: ClassifiedAsset[];
  /** World-building / ecosystem assets loosely connected */
  ecosystem: ClassifiedAsset[];
  /** Human-readable moment label */
  label: string;
  /** Date range this moment spans (earliest support → latest follow-through) */
  dateRange: { start: Date; end: Date };
  /** Campaign phase this moment belongs to */
  phase: PhaseName | null;
  /** Position in the narrative (0 = most important) */
  hierarchyPosition: number;
  /** Current narrative score (composite of centrepiece prominence + support depth) */
  narrativeScore: number;
  /** Whether this is the currently active/dominant moment */
  isActive: boolean;
  /** Moment state in the campaign lifecycle */
  state: 'upcoming' | 'live' | 'sustaining' | 'historical';
  /** How many key support formats are present vs expected */
  supportCoverage: number;
  /** Total ecosystem views (centrepiece + all orbit) */
  ecosystemViews: number;
};


// ══════════════════════════════════════════════════════════════════════════════
// 3. CAMPAIGN NARRATIVE — The full story
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The complete campaign narrative — consumed by CampaignDestination.
 * This replaces all the scattered inline calculations in the component.
 */
export type CampaignNarrative = {
  /** All moments in narrative order (not chronological — by importance) */
  moments: NarrativeMoment[];
  /** The currently active/dominant moment (highest narrative score) */
  activeMoment: NarrativeMoment | null;
  /** Current campaign phase */
  currentPhase: PhaseName | null;
  /** Campaign arc position */
  arc: 'building' | 'releasing' | 'scaling' | 'extending' | 'dormant';
  /** Unattached assets — uploads that don't belong to any moment */
  unattached: ClassifiedAsset[];
  /** All classified assets for reference */
  allAssets: ClassifiedAsset[];
  /** Narrative stats */
  stats: {
    totalMoments: number;
    liveMoments: number;
    historicalMoments: number;
    upcomingMoments: number;
    totalEcosystemViews: number;
    averageSupportCoverage: number;
    /** Planned uploads that produce YouTube content (excludes tours/festivals) */
    plannedUploads: number;
    /** Total uploads landed */
    landedUploads: number;
  };
};


// ══════════════════════════════════════════════════════════════════════════════
// 4. SUPPORT ATTACHMENT — How does content orbit centrepieces?
// ══════════════════════════════════════════════════════════════════════════════

/** Window configuration for support attachment */
const ATTACHMENT_WINDOWS = {
  /** Days before a centrepiece where teaser content can attach */
  preReleaseDays: 14,
  /** Days after a centrepiece where follow-up content can attach */
  postReleaseDays: 21,
  /** Minimum relationship score (0-100) to attach support to a centrepiece */
  minAttachmentScore: 10,
} as const;

/** Key support formats expected around a centrepiece */
const EXPECTED_SUPPORT_FORMATS: UploadFormatLabel[] = [
  'Short', 'BTS', 'Lyric Video', 'Visualizer',
];

/**
 * Score how strongly a candidate relates to a centrepiece.
 * Returns 0-100. Uses title similarity, format signals, and timing.
 */
function scoreAttachment(
  centrepiece: ClassifiedAsset,
  candidate: ClassifiedAsset,
): number {
  let score = 0;

  const anchorKw = extractKeywords(centrepiece.upload.title);
  const candidateKw = extractKeywords(candidate.upload.title);
  const candidateTitle = candidate.upload.title.toLowerCase();
  const candidateDesc = (candidate.upload.description || '').toLowerCase().slice(0, 500);

  // ── Title keyword overlap (strongest signal) ──
  const overlap = anchorKw.filter(w => candidateKw.includes(w));
  if (overlap.length >= 3) score += 40;
  else if (overlap.length === 2) score += 30;
  else if (overlap.length === 1 && anchorKw.length <= 3) score += 15;

  // ── BTS / making-of detection ──
  if (/\b(bts|behind\s*the\s*scenes|making\s*of)\b/.test(candidateTitle) && overlap.length >= 1) {
    score += 35;
  }

  // ── Shared collaborator ──
  const anchorCollabs = extractCollaborators(centrepiece.upload.title);
  const candidateCollabs = extractCollaborators(candidate.upload.title);
  if (anchorCollabs.length > 0 && candidateCollabs.some(c => anchorCollabs.includes(c))) {
    score += 25;
  } else if (anchorCollabs.some(c => candidateTitle.includes(c))) {
    score += 20;
  }

  // ── Description references anchor keywords ──
  const descOverlap = anchorKw.filter(w => candidateDesc.includes(w));
  if (descOverlap.length >= 2) score += 15;

  // ── Format bonus (support formats get a boost) ──
  if (['BTS', 'Lyric Video', 'Visualizer', 'Live Session'].includes(candidate.format)) {
    score += 10;
  }

  // ── Timing signal ──
  const timingDays = Math.abs(candidate.ageDays - centrepiece.ageDays);
  if (timingDays <= 3) score += 15;
  else if (timingDays <= 7) score += 12;
  else if (timingDays <= 14) score += 8;
  else if (timingDays <= 21) score += 5;

  return Math.min(100, score);
}

/** Extract meaningful keywords from a title (strips format markers and noise) */
function extractKeywords(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\(official\)/gi, '')
    .replace(/\(lyric\s*video\)/gi, '')
    .replace(/\(visuali[sz]er\)/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\[\s*(music\s*video|official\s*video|official\s*music\s*video)\s*\]/i, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\b/gi, '')
    .replace(/[''"""\[\](){}|#]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .trim();

  return cleaned
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !NOISE_WORDS.has(w));
}

/** Extract collaborator names from a title */
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

const NOISE_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'its',
  'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'are', 'has', 'his', 'how', 'man',
  'new', 'now', 'old', 'see', 'way', 'who', 'boy', 'did',
  'get', 'got', 'him', 'let', 'say', 'she', 'too', 'use',
  'video', 'official', 'music', 'lyrics', 'lyric', 'audio',
  'behind', 'scenes', 'vlog', 'part', 'episode',
]);


// ══════════════════════════════════════════════════════════════════════════════
// 5. MOMENT STATE — Where is each moment in its lifecycle?
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Determine a moment's lifecycle state based on centrepiece age and activity.
 *
 * upcoming  → centrepiece not yet published (planned moments)
 * live      → centrepiece published within the last 7 days
 * sustaining → still accumulating support (duration depends on format weight)
 *              Official Videos (weight 100) sustain for 90 days
 *              Premieres (weight 90-95) sustain for 60 days
 *              Others sustain for 30 days
 * historical → past sustaining window, narrative value preserved but not dominant
 */
function determineMomentState(centrepiece: ClassifiedAsset): NarrativeMoment['state'] {
  if (centrepiece.ageDays < 0) return 'upcoming';
  if (centrepiece.ageDays <= 7) return 'live';

  // Flagship releases sustain much longer — they're the campaign's gravitational centre
  const sustainingWindow = centrepiece.weight >= 100 ? 90
    : centrepiece.weight >= 90 ? 60
    : 30;
  if (centrepiece.ageDays <= sustainingWindow) return 'sustaining';
  return 'historical';
}


// ══════════════════════════════════════════════════════════════════════════════
// 6. NARRATIVE SCORE — What should be visually dominant NOW?
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the narrative score for a moment. This determines visual hierarchy.
 *
 * CRITICAL DESIGN PRINCIPLE:
 * The score must ensure that a high-weight release (Official Video = 100)
 * ALWAYS dominates over planning density, community posts, or action count.
 * A flagship release persists as the hero for its entire active window,
 * even when many smaller uploads or planning items arrive afterwards.
 *
 * Factors (in priority order):
 * 1. Base release weight (Official Video 100 > Community Post 35 > Tour reminder 20)
 * 2. State multiplier (live moments get massive boost)
 * 3. Support ecosystem depth
 * 4. View velocity
 * 5. Recency decay (gentle — centrepieces persist for weeks)
 */
function computeNarrativeScore(
  centrepiece: ClassifiedAsset,
  support: ClassifiedAsset[],
  momentum: ClassifiedAsset[],
  ecosystem: ClassifiedAsset[],
): number {
  // ── Base: raw release weight (0-100), NOT prominence (which decays) ──
  // This ensures an Official Video (100) always outscores a Community Post (35)
  // regardless of recency or planning density.
  const baseWeight = centrepiece.weight;

  // ── State multiplier — the biggest lever ──
  // A live Official Video scores 100 × 3.0 = 300 base
  // A historical Official Video scores 100 × 0.8 = 80 base
  // A live Community Post would score 35 × 3.0 = 105 base — still below a sustaining OV
  const state = determineMomentState(centrepiece);
  let stateMultiplier: number;
  if (state === 'live') stateMultiplier = 3.0;
  else if (state === 'sustaining') stateMultiplier = 2.0;
  else if (state === 'historical') stateMultiplier = 0.8;
  else stateMultiplier = 0.3; // upcoming

  let score = baseWeight * stateMultiplier;

  // ── Support depth bonus (up to +40) ──
  // Rich ecosystems (BTS + Lyric Video + Shorts) reinforce the centrepiece
  const uniqueFormats = new Set(support.map(a => a.format));
  const supportCoverage = uniqueFormats.size / EXPECTED_SUPPORT_FORMATS.length;
  score += supportCoverage * 40;

  // ── Momentum bonus (up to +20) ──
  const momentumCount = momentum.length;
  score += Math.min(20, momentumCount * 4);

  // ── Ecosystem bonus (up to +10) ──
  if (ecosystem.length > 0) score += Math.min(10, ecosystem.length * 3);

  // ── View velocity bonus (up to +30) ──
  const totalViews = centrepiece.upload.viewCount +
    support.reduce((s, a) => s + a.upload.viewCount, 0) +
    momentum.reduce((s, a) => s + a.upload.viewCount, 0);
  const avgAge = centrepiece.ageDays || 1;
  const viewVelocity = totalViews / avgAge;
  if (viewVelocity > 50000) score += 30;
  else if (viewVelocity > 10000) score += 15;
  else if (viewVelocity > 1000) score += 5;

  // ── Gentle recency decay for centrepiece persistence ──
  // An Official Video should remain dominant for its full active window.
  // Only apply mild decay after the "sustaining" period ends.
  const decayFactor = calculateDecayFactor(centrepiece.ageDays, centrepiece.decay);
  // Blend: 70% raw weight-based score + 30% decay-adjusted
  // This means a 2-week-old Official Video retains ~85-90% of its score
  score = score * (0.7 + 0.3 * decayFactor);

  return score;
}


// ══════════════════════════════════════════════════════════════════════════════
// 7. PHASE PROGRESSION — Where are we in the campaign arc?
// ══════════════════════════════════════════════════════════════════════════════

/** Non-upload event kinds that shouldn't count as "planned uploads" */
const NON_UPLOAD_KINDS = new Set(['tourDate', 'festival', 'liveShow']);

/**
 * Determine the campaign arc position from moments and phase.
 */
function determineArc(
  currentPhase: PhaseName | null,
  moments: NarrativeMoment[],
): CampaignNarrative['arc'] {
  if (!currentPhase && moments.length === 0) return 'dormant';

  switch (currentPhase) {
    case 'BUILD': return 'building';
    case 'RELEASE': return 'releasing';
    case 'SCALE': return 'scaling';
    case 'EXTEND': return 'extending';
    default:
      // Infer from moment states
      if (moments.some(m => m.state === 'live')) return 'releasing';
      if (moments.some(m => m.state === 'sustaining')) return 'scaling';
      if (moments.every(m => m.state === 'historical')) return 'extending';
      return 'building';
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// 8. THE ENGINE — buildCampaignNarrative()
// ══════════════════════════════════════════════════════════════════════════════

export type NarrativeOptions = {
  /** Campaign start date (ISO string) — scopes the narrative window */
  campaignStartDate?: string;
  /** Campaign duration in weeks */
  campaignWeeks?: number;
  /** Minimum views for an upload to qualify as a centrepiece */
  minCentrepieceViews?: number;
  /** Maximum centrepiece moments to surface (prevents noise) */
  maxMoments?: number;
  /** Current campaign phase (from plan detection) */
  currentPhase?: PhaseName | null;
  /** Plan events for counting planned uploads */
  planEvents?: ParsedEvent[];
};

/**
 * Build the complete campaign narrative from a flat list of uploads.
 *
 * This is the single entry point for the entire narrative system.
 * Call this once, pass the result to CampaignDestination.
 *
 * Algorithm:
 * 1. Classify every upload (role, weight, decay, prominence)
 * 2. Identify centrepieces (official videos, premieres, docs)
 * 3. Build boundary-aware attachment windows between centrepieces
 * 4. Score and attach support/momentum/ecosystem to centrepieces
 * 5. Compute narrative score for each moment
 * 6. Determine moment states and active moment
 * 7. Sort by narrative importance (not chronology)
 * 8. Compute campaign-level stats
 */
export function buildCampaignNarrative(
  uploads: RecentUpload[],
  options: NarrativeOptions = {},
): CampaignNarrative {
  const {
    campaignStartDate,
    campaignWeeks,
    minCentrepieceViews = 5000,
    maxMoments = 8,
    currentPhase = null,
    planEvents = [],
  } = options;

  // ── Step 1: Classify every upload ──
  const allAssets = uploads.map(classifyAsset);

  // ── Step 2: Identify centrepieces within campaign window ──
  const campaignStart = campaignStartDate
    ? new Date(campaignStartDate).getTime() - 14 * 86400000 // 2-week buffer before
    : null;
  const campaignEnd = campaignStart && campaignWeeks
    ? new Date(campaignStartDate!).getTime() + campaignWeeks * 7 * 86400000
    : campaignStart
      ? new Date(campaignStartDate!).getTime() + 52 * 7 * 86400000
      : null;

  const centrepieces = allAssets.filter(a => {
    if (a.role !== 'centrepiece') return false;

    // Official Videos and Premieres are ALWAYS centrepieces regardless of views.
    // Only apply the view threshold to lower-weight centrepieces (Documentaries etc).
    const isTopTier = a.format === 'Official Video' || a.format === 'Premiere';
    if (!isTopTier && a.upload.viewCount < minCentrepieceViews) return false;

    // Campaign window gate
    if (campaignStart && campaignEnd) {
      const pubDate = new Date(a.upload.publishedAt).getTime();
      if (pubDate < campaignStart || pubDate > campaignEnd) return false;
    }

    return true;
  }).sort((a, b) =>
    new Date(a.upload.publishedAt).getTime() - new Date(b.upload.publishedAt).getTime()
  );

  // ── Step 3: Build boundary-aware attachment windows ──
  const windows = centrepieces.map((cp, i) => {
    const cpDate = new Date(cp.upload.publishedAt).getTime();
    let preStart = cpDate - ATTACHMENT_WINDOWS.preReleaseDays * 86400000;
    let postEnd = cpDate + ATTACHMENT_WINDOWS.postReleaseDays * 86400000;

    // Clip to midpoint with neighbors
    if (i > 0) {
      const prevDate = new Date(centrepieces[i - 1].upload.publishedAt).getTime();
      const midpoint = (prevDate + cpDate) / 2;
      preStart = Math.max(preStart, midpoint);
    }
    if (i < centrepieces.length - 1) {
      const nextDate = new Date(centrepieces[i + 1].upload.publishedAt).getTime();
      const midpoint = (cpDate + nextDate) / 2;
      postEnd = Math.min(postEnd, midpoint);
    }

    return { centrepiece: cp, preStart, postEnd };
  });

  // ── Step 4: Score and attach non-centrepiece assets ──
  const nonCentrepieces = allAssets.filter(a => a.role !== 'centrepiece');
  const assigned = new Set<string>(); // upload IDs already assigned

  // For each non-centrepiece, find its best centrepiece match
  const attachments = new Map<string, { asset: ClassifiedAsset; score: number }[]>();
  for (const cp of centrepieces) {
    attachments.set(cp.upload.id, []);
  }

  for (const candidate of nonCentrepieces) {
    const pubDate = new Date(candidate.upload.publishedAt).getTime();
    let bestCpId: string | null = null;
    let bestScore = 0;

    for (const win of windows) {
      // Is the candidate within this centrepiece's window?
      if (pubDate < win.preStart || pubDate > win.postEnd) continue;

      const score = scoreAttachment(win.centrepiece, candidate);
      if (score >= ATTACHMENT_WINDOWS.minAttachmentScore && score > bestScore) {
        bestScore = score;
        bestCpId = win.centrepiece.upload.id;
      }
    }

    if (bestCpId) {
      attachments.get(bestCpId)!.push({ asset: candidate, score: bestScore });
      assigned.add(candidate.upload.id);
    }
  }

  // ── Step 5: Build narrative moments ──
  const moments: NarrativeMoment[] = centrepieces
    .slice(0, maxMoments)
    .map((cp, position) => {
      const orbit = attachments.get(cp.upload.id) ?? [];

      // Split orbit by narrative role
      const support = orbit
        .filter(o => o.asset.role === 'support')
        .sort((a, b) => b.score - a.score)
        .map(o => o.asset);

      const momentumAssets = orbit
        .filter(o => o.asset.role === 'momentum')
        .sort((a, b) => b.score - a.score)
        .map(o => o.asset);

      const ecosystemAssets = orbit
        .filter(o => o.asset.role === 'ecosystem' || o.asset.role === 'world-building' || o.asset.role === 'bridge')
        .sort((a, b) => b.score - a.score)
        .map(o => o.asset);

      // Date range
      const allDates = [cp, ...support, ...momentumAssets, ...ecosystemAssets]
        .map(a => new Date(a.upload.publishedAt).getTime());
      const start = new Date(Math.min(...allDates));
      const end = new Date(Math.max(...allDates));

      // Support coverage: what fraction of expected formats are present?
      const presentFormats = new Set(support.map(a => a.format));
      const supportCoverage = EXPECTED_SUPPORT_FORMATS.filter(f =>
        presentFormats.has(f) || momentumAssets.some(a => a.format === f)
      ).length / EXPECTED_SUPPORT_FORMATS.length;

      // Ecosystem views
      const ecosystemViews = cp.upload.viewCount +
        support.reduce((s, a) => s + a.upload.viewCount, 0) +
        momentumAssets.reduce((s, a) => s + a.upload.viewCount, 0) +
        ecosystemAssets.reduce((s, a) => s + a.upload.viewCount, 0);

      // Narrative score
      const narrativeScore = computeNarrativeScore(cp, support, momentumAssets, ecosystemAssets);

      // Moment state
      const state = determineMomentState(cp);

      // Label: clean centrepiece title
      const label = cp.upload.title
        .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
        .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
        .replace(/\s*\[MUSIC\s*VIDEO\]/gi, '')
        .replace(/\s*\(Official\)/gi, '')
        .trim();

      // Phase assignment (from plan if available)
      const phase = currentPhase; // simplified — will be enriched by plan data

      return {
        id: cp.upload.id,
        centrepiece: cp,
        support,
        momentum: momentumAssets,
        ecosystem: ecosystemAssets,
        label,
        dateRange: { start, end },
        phase,
        hierarchyPosition: position,
        narrativeScore,
        isActive: false, // set below
        state,
        supportCoverage,
        ecosystemViews,
      };
    });

  // ── Step 6: Sort by narrative score and mark active ──
  moments.sort((a, b) => b.narrativeScore - a.narrativeScore);

  // The active moment: highest narrative score among live/sustaining moments.
  // If none are live/sustaining, use the best historical moment rather than
  // falling back to the broken extractMoments system. A campaign always has
  // a gravitational centre — even if the flagship is past its sustaining window.
  const activeCandidates = moments.filter(m => m.state === 'live' || m.state === 'sustaining');
  const activeMoment = activeCandidates.length > 0
    ? activeCandidates[0]
    : moments.length > 0 ? moments[0] : null; // fallback to highest-scored moment
  if (activeMoment) activeMoment.isActive = true;

  // Re-sort for display: active first, then by score
  moments.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.narrativeScore - a.narrativeScore;
  });

  // Update hierarchy positions after sort
  moments.forEach((m, i) => { m.hierarchyPosition = i; });

  // ── Step 7: Collect unattached assets ──
  const unattached = nonCentrepieces
    .filter(a => !assigned.has(a.upload.id))
    .sort((a, b) => b.prominence - a.prominence);

  // ── Step 8: Campaign stats ──
  const plannedUploads = planEvents.filter(e => !NON_UPLOAD_KINDS.has(e.kind)).length;
  const arc = determineArc(currentPhase, moments);

  const stats: CampaignNarrative['stats'] = {
    totalMoments: moments.length,
    liveMoments: moments.filter(m => m.state === 'live').length,
    historicalMoments: moments.filter(m => m.state === 'historical').length,
    upcomingMoments: moments.filter(m => m.state === 'upcoming').length,
    totalEcosystemViews: moments.reduce((s, m) => s + m.ecosystemViews, 0),
    averageSupportCoverage: moments.length > 0
      ? moments.reduce((s, m) => s + m.supportCoverage, 0) / moments.length
      : 0,
    plannedUploads,
    landedUploads: allAssets.length,
  };

  return {
    moments,
    activeMoment,
    currentPhase,
    arc,
    unattached,
    allAssets,
    stats,
  };
}


// ══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE: Narrative-aware helpers for UI consumption
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get a human-readable coverage label for a moment's support depth.
 * Uses positive language — no "Weak" or "Poor".
 */
export function coverageLabel(coverage: number): string {
  if (coverage >= 0.75) return 'Strong rollout';
  if (coverage >= 0.5) return 'Expandable rollout';
  if (coverage >= 0.25) return 'Long-tail opportunity';
  return 'Could extend further';
}

/**
 * Get the coverage tone for styling.
 */
export function coverageTone(coverage: number): { bg: string; border: string; color: string } {
  if (coverage >= 0.75) return { bg: '#F0FDF4', border: '#BBF7D0', color: '#059669' };
  if (coverage >= 0.5) return { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' };
  if (coverage >= 0.25) return { bg: '#F5F3FF', border: '#E9D5FF', color: '#7C3AED' };
  return { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' };
}

/**
 * Get the moment state label for display.
 */
export function momentStateLabel(state: NarrativeMoment['state']): string {
  switch (state) {
    case 'live': return 'Live';
    case 'sustaining': return 'Sustaining';
    case 'historical': return 'Campaign History';
    case 'upcoming': return 'Upcoming';
  }
}

/**
 * Get a narrative arc label for the campaign header.
 */
export function arcLabel(arc: CampaignNarrative['arc']): string {
  switch (arc) {
    case 'building': return 'Building the world';
    case 'releasing': return 'In release';
    case 'scaling': return 'Scaling the story';
    case 'extending': return 'Extending the world';
    case 'dormant': return 'Campaign quiet';
  }
}
