/**
 * STABLE IDENTITY FOR A DEEP DIVE RECOMMENDATION
 *
 * The Deep Dives are fixed, dated strategic baselines and this file does not
 * touch them. Ids are MINTED AT READ TIME from the recommendation's own
 * wording, so the six deck files keep exactly the content they were
 * transcribed with and nothing has to be migrated.
 *
 * ── WHY DERIVED RATHER THAN STORED ────────────────────────────────────
 * A stored id has to be assigned by an edit to the deck, and an edit to the
 * deck is the thing we have promised not to make. Deriving it means the id
 * is a pure function of the sentence: the same sentence always produces the
 * same id, on any deploy, with no migration and nothing to keep in sync.
 *
 * ── WHAT "SURVIVES RE-TRANSCRIPTION" ACTUALLY MEANS ───────────────────
 * The hash runs over a normalised form: lowercased, punctuation stripped,
 * whitespace collapsed, and a small set of grammatical words removed. So
 * these all produce the SAME id:
 *
 *   "Give each hero a second destination inside 7-14 days."
 *   "Give each hero a second destination inside 7–14 days"   (en dash)
 *   "Give each hero a second destination inside 7-14 days"   (no full stop)
 *
 * And these produce DIFFERENT ids:
 *
 *   "Give each hero a second destination inside 7-14 days."
 *   "Give each hero a second destination inside 30 days."
 *
 * That second case is correct and deliberate. A recommendation whose
 * substance has changed is a different recommendation, and silently
 * carrying a team's "we implemented this" across a change of meaning would
 * be worse than losing the link. When a genuine rewording does break a
 * link, `supersedesId` on the progress record is how a human repoints it —
 * visibly, rather than by a hash accident.
 *
 * ── WHAT COUNTS AS A RECOMMENDATION ───────────────────────────────────
 * Three arrays, and deliberately not `channelGaps`. A gap is a problem
 * statement — "the 7-14 day window was empty" is not something a team can
 * implement. Tracking implementation against a problem would produce the
 * nonsense state "gap: IMPLEMENTED".
 */

import type { DeepDiveContext, DeepDivePoint, NeedTag } from './types';

/**
 * Removed before hashing. Kept short on purpose: every word here is one a
 * re-transcription might legitimately swap, and nothing here carries
 * strategic meaning. Adding a content word ("live", "series", "hero")
 * would make two different recommendations collide.
 */
const GRAMMATICAL = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'each', 'every', 'any',
  'so', 'than', 'then', 'there', 'their',
]);

/** Lowercase, dashes unified, punctuation dropped, grammar words removed. */
export function normaliseRecommendation(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―]/g, '-')   // en/em dashes → hyphen
    .replace(/[‘’]/g, "'")    // curly → straight
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w && !GRAMMATICAL.has(w))
    .join(' ')
    .trim();
}

/**
 * FNV-1a. Not cryptographic and does not need to be — the job is a short,
 * stable, deterministic label for a sentence, computed identically in every
 * runtime with no dependency.
 */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(0, 7);
}

export function mintRecommendationId(artistSlug: string, point: string): string {
  return `dd_${artistSlug}_${hash(normaliseRecommendation(point))}`;
}

/* ══ The addressable recommendation ══════════════════════════════════ */

export type RecommendationSource =
  | 'campaign_architecture'
  | 'content_direction'
  | 'strategic_opportunity';

export interface DeepDiveRecommendation {
  id: string;
  artistSlug: string;
  /** Which deck revision made this recommendation. */
  deepDiveVersion: string;
  source: RecommendationSource;
  point: string;
  basis: string;
  needTags: NeedTag[];
  /** Position within its array. For display order only — never identity. */
  ordinal: number;
}

const SOURCE_ORDER: RecommendationSource[] = [
  'campaign_architecture', 'content_direction', 'strategic_opportunity',
];

/**
 * Every actionable point in a Deep Dive, with an id.
 *
 * Duplicates are possible in principle — the same sentence could appear as
 * both an opportunity and an architecture step — and are collapsed, because
 * two ids for one recommendation would let a team implement it twice.
 */
export function listRecommendations(dive: DeepDiveContext): DeepDiveRecommendation[] {
  const version = `${dive.deckUpdated}/${dive.transcribedAt}`;
  const groups: [RecommendationSource, DeepDivePoint[]][] = [
    ['campaign_architecture', dive.recommendedCampaignArchitecture],
    ['content_direction', dive.recommendedContentDirections],
    ['strategic_opportunity', dive.strategicOpportunities],
  ];

  const seen = new Set<string>();
  const out: DeepDiveRecommendation[] = [];
  for (const [source, points] of groups) {
    points.forEach((p, i) => {
      const id = mintRecommendationId(dive.artistSlug, p.point);
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        artistSlug: dive.artistSlug,
        deepDiveVersion: version,
        source,
        point: p.point,
        basis: p.basis,
        needTags: p.needTags,
        ordinal: i,
      });
    });
  }
  out.sort((a, b) =>
    SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || a.ordinal - b.ordinal);
  return out;
}

export function findRecommendation(
  dive: DeepDiveContext, id: string,
): DeepDiveRecommendation | null {
  return listRecommendations(dive).find(r => r.id === id) ?? null;
}
