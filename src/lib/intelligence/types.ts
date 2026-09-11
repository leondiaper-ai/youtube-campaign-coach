/**
 * THE INTELLIGENCE LAYER — CONTRACTS
 *
 * Watcher knows what a channel DID. This layer holds what we THINK, and
 * keeps the two apart.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 * The strategic analysis behind the artist Deep Dives lives in hand-built
 * decks under /public. A model cannot use a deck. It can read the HTML, but
 * what it gets back is a slide order and some numbers, not the argument —
 * and the argument is the valuable part, because a person made it after
 * looking at the channel properly.
 *
 * The alternative, which we are deliberately not doing, is to hand a model
 * the raw metrics and ask it to regenerate the thesis on every call. That
 * produces a different thesis each time, none of them the one we actually
 * believe, and it quietly discards months of human judgement.
 *
 * So the analysis is transcribed into this shape once, marked HUMAN, and
 * served structured. Re-transcribing when a deck is revised is a small
 * cost. Losing the analysis is not.
 *
 * ── NEED TAGS ARE THE JOINT ───────────────────────────────────────────
 * Every gap and opportunity carries `needTags`, and every external research
 * example carries `usefulFor`. Those two vocabularies are the same closed
 * set (NEED_TAGS below), and matching is their intersection. That is the
 * whole matcher. It is deliberately not a model and deliberately not genre:
 * "CHVRCHES are a synth band, find synth bands" is the failure this shape
 * exists to make impossible to express.
 */

import type { EvidenceClass, TrustLevel } from '../knowledge/evidence';

/* ══ The need vocabulary ═════════════════════════════════════════════ */

/**
 * A closed set on purpose. Free-text tags drift — `archive-live`,
 * `archive_live`, `live archive` — and a matcher over drifting text finds
 * nothing while looking like it works. Adding a tag is a code change, which
 * is the right amount of friction.
 *
 * Each tag names a STRATEGIC SITUATION, not a genre, a format or a mood.
 * The test for a new one: could two artists who sound nothing alike both
 * legitimately have this need? If not, it is probably a genre in disguise.
 */
export const NEED_TAGS = [
  /* Channel state */
  'channel_reactivation',      // dormant or long-inactive channel being woken up
  'low_band_time',             // artist has little availability for new shoots
  'low_new_production',        // little or no new footage will be made
  'catalogue_activation',      // existing back catalogue is under-worked

  /* Assets on hand */
  'archive_live',              // unused or under-used live/performance footage
  'lyric_video',               // lyric videos are or could be a real format here
  'visualiser',
  'bts_process',               // making-of / process material exists or could
  'shorts_programme',          // Shorts used as a deliberate programme, not offcuts

  /* Campaign architecture */
  'follow_up_7_14',            // the 7-14 day post-hero window is empty
  'hero_continuity',           // heroes do not connect to each other
  'premiere_behaviour',        // Premieres / pre-parties
  'named_series',              // a repeatable, named, returnable format
  'long_form_event',           // a single long piece treated as an event
  'performance_as_hero',       // the live take IS the release, not support for it
  'release_sequencing',        // order and spacing of assets around a release
  'album_campaign',            // a full album cycle rather than a single
  'first_week_density',        // what lands in the days either side of release

  /* Audience-facing */
  'community_activation',      // Community tab, comments, direct address
  'collaboration',             // features, guests, cross-channel
  'live_dates_tie_in',         // touring used as campaign material
] as const;

export type NeedTag = (typeof NEED_TAGS)[number];

export function isNeedTag(s: string): s is NeedTag {
  return (NEED_TAGS as readonly string[]).includes(s);
}

/**
 * ── ALIASES ───────────────────────────────────────────────────────────
 * The vocabulary stays closed; the door is not.
 *
 * A model reaching for "premiere_programming" or "longform_event" means the
 * same situation as `premiere_behaviour` and `long_form_event`, and
 * rejecting those is pedantry that produces a silently unmatchable record.
 * Accepting them as free text is the drift the closed set exists to stop.
 * So there is exactly one canonical form and a table of known ways of
 * saying it, and everything resolves to canon before it is stored.
 *
 * An alias is a SYNONYM, never a near-miss. `album_world` maps to
 * `album_campaign` because both mean "a full album cycle"; it does not map
 * to `named_series` because those are different situations that happen to
 * co-occur. If a proposed alias would change what is matched rather than
 * just how it is spelled, it belongs in NEED_TAGS as its own entry — which
 * is why `performance_as_hero` was added rather than aliased to
 * `archive_live`. Having unused footage and making the live take the
 * release itself are not the same problem.
 */
export const TAG_ALIASES: Record<string, NeedTag> = {
  premiere_programming: 'premiere_behaviour',
  premieres: 'premiere_behaviour',
  performance_series: 'named_series',
  session_series: 'named_series',
  process_content: 'bts_process',
  behind_the_scenes: 'bts_process',
  longform_event: 'long_form_event',
  album_world: 'album_campaign',
  live_archive: 'archive_live',
  follow_up: 'follow_up_7_14',
  followup_7_14: 'follow_up_7_14',
  reactivation: 'channel_reactivation',
  catalogue: 'catalogue_activation',
  shorts: 'shorts_programme',
  community: 'community_activation',
  touring: 'live_dates_tie_in',
};

/** Case and separator differences are spelling, not meaning. */
function canonicaliseKey(s: string): string {
  return s.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Returns the canonical tag for any accepted spelling, or null. */
export function canonicaliseTag(raw: string): NeedTag | null {
  const k = canonicaliseKey(raw);
  if (isNeedTag(k)) return k;
  return TAG_ALIASES[k] ?? null;
}

/**
 * Silently dropping an unknown tag hides a typo, so unknowns are returned
 * rather than swallowed. `aliased` is reported separately so a caller can
 * see that it wrote one thing and we stored another — an invisible rewrite
 * is its own kind of drift.
 */
export function partitionTags(raw: string[]): {
  valid: NeedTag[];
  unknown: string[];
  aliased: { from: string; to: NeedTag }[];
} {
  const valid: NeedTag[] = [];
  const unknown: string[] = [];
  const aliased: { from: string; to: NeedTag }[] = [];
  for (const t of raw) {
    const canon = canonicaliseTag(t);
    if (!canon) { unknown.push(t); continue; }
    if (canon !== t) aliased.push({ from: t, to: canon });
    if (!valid.includes(canon)) valid.push(canon);
  }
  return { valid, unknown, aliased };
}

/* ══ Deep Dive ═══════════════════════════════════════════════════════ */

/**
 * A point of analysis. `basis` is what it rests on, in the deck's own terms,
 * so a reader can tell "this is a counted figure" from "this is a view".
 */
export interface DeepDivePoint {
  /** One statement, as the deck makes it. */
  point: string;
  /** The figure or observation behind it, verbatim where possible. */
  basis: string;
  needTags: NeedTag[];
}

export interface DeepDiveEvidence {
  claim: string;
  /** Nearly always OBSERVED (an API figure) or HUMAN (the analyst's read). */
  evidenceClass: EvidenceClass;
  trust: TrustLevel;
  /** Video id, endpoint, or the deck section. */
  sourceRef: string;
  /** When the figure was true. Decks state a capture date; use it. */
  observedAt: string | null;
}

/**
 * `openQuestions` is required and must not be empty. A Deep Dive with no
 * open questions is either finished — which no campaign analysis ever is —
 * or has stopped distinguishing what it knows from what it assumes.
 */
export interface DeepDiveContext {
  artistSlug: string;
  artistName: string;
  title: string;
  /** When the DECK was authored, not when this record was written. */
  deckUpdated: string;
  deckUrl: string | null;
  /** Date the deck states its figures were captured. */
  dataCapturedAt: string | null;

  /** The argument in one paragraph. The single most valuable field here. */
  coreThesis: string;

  channelStrengths: DeepDivePoint[];
  channelGaps: DeepDivePoint[];
  campaignRisks: DeepDivePoint[];
  strategicOpportunities: DeepDivePoint[];

  recommendedContentDirections: DeepDivePoint[];
  recommendedCampaignArchitecture: DeepDivePoint[];

  /** Things this artist has already done that worked, per the deck. */
  existingSuccesses: DeepDivePoint[];
  /** Comparisons the deck itself drew. Not peers a model picked later. */
  relevantHistoricalExamples: DeepDivePoint[];

  keyEvidence: DeepDiveEvidence[];

  /** Stated constraints — band time, budget, no new footage, label timing. */
  knownConstraints: string[];
  /** Plans the deck asserts. NOT a substitute for the campaign horizon. */
  knownCampaignPlans: string[];

  youtubePlatformOpportunities: DeepDivePoint[];

  openQuestions: string[];

  /** Who transcribed this and from what. Provenance, not decoration. */
  transcribedBy: string;
  transcribedAt: string;
  /** What the deck does NOT establish. Never blank. */
  limitations: string[];
}

/** Every need this artist has, deduplicated, with where each came from. */
export interface ArtistNeeds {
  artistSlug: string;
  needs: { tag: NeedTag; from: string; basis: string; source: 'deep_dive' | 'watcher' }[];
  /** True when no Deep Dive exists — the caller must not treat this as "no needs". */
  deepDiveMissing: boolean;
}

/* ══ Resources ═══════════════════════════════════════════════════════ */

export type ResourceContextType =
  | 'MARKET_ANALYSIS' | 'CAMPAIGN_INTELLIGENCE' | 'BENCHMARK_LIBRARY'
  | 'CHANNEL_BEHAVIOUR' | 'METHODOLOGY' | 'API_REFERENCE' | 'OBSERVATORY';

export interface Benchmark {
  metric: string;
  value: string;
  /** The population it was computed over. A benchmark without an n is a claim. */
  basis: string;
  caveat: string | null;
}

export interface ResourceContext {
  resourceId: string;
  title: string;
  type: ResourceContextType;
  lastUpdated: string;
  sourceUrl: string | null;

  purpose: string;
  keyFindings: { finding: string; basis: string; confidence: 'LOW' | 'MEDIUM' | 'HIGH' }[];
  usefulBenchmarks: Benchmark[];
  strategicPrinciples: string[];
  caveats: string[];
  methodologyNotes: string[];
  relevantArtistExamples: string[];

  transcribedBy: string;
  transcribedAt: string;
}

/* ══ Human campaign context ══════════════════════════════════════════ */

/**
 * The things that change advice and that no API will ever tell us. This is
 * separate from the campaign horizon (dated events) because most of it is
 * not an event: "the band are not available to shoot until March" has no
 * date and still governs every recommendation until it changes.
 */
export type HumanContextKind =
  | 'LIKELY_ASSET'        // something probably coming, not confirmed
  | 'TEAM_INTENTION'      // what the team means to do
  | 'RELEASE_PLAN'        // a plan, dated or not
  | 'ARTIST_AVAILABILITY'
  | 'ALREADY_FILMING'     // content that exists or is being made
  | 'PARTNER_ASK'         // something YouTube has asked for
  | 'CONSTRAINT'
  | 'DECISION_MADE';

export const HUMAN_CONTEXT_KINDS: HumanContextKind[] = [
  'LIKELY_ASSET', 'TEAM_INTENTION', 'RELEASE_PLAN', 'ARTIST_AVAILABILITY',
  'ALREADY_FILMING', 'PARTNER_ASK', 'CONSTRAINT', 'DECISION_MADE',
];

/**
 * `expiresAt` is not optional housekeeping. A stale plan read as current is
 * the single most dangerous thing in this system — it looks exactly like
 * knowledge. Anything without a review date gets one automatically, and a
 * lapsed item is returned marked STALE rather than quietly withheld, so the
 * reader can see that something WAS known and has gone out of date.
 */
export interface HumanContextItem {
  id: string;
  artistSlug: string;
  kind: HumanContextKind;
  text: string;
  needTags: NeedTag[];
  /** Who said so. "Leon", "YouTube partner call", "label plan doc". */
  statedBy: string;
  statedAt: string;
  /** yyyy-mm-dd. After this the item is returned as STALE. */
  reviewBy: string;
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ══ Research examples (external) ════════════════════════════════════ */

/**
 * Deliberately NOT a new store. This is the shape of the extra fields that
 * the existing `CaseStudy` record now carries, written down in one place so
 * the research vocabulary is readable without chasing through knowledge/types.
 *
 * ── THE TWO-SCORE RULE ────────────────────────────────────────────────
 * A mechanic can be excellent and the artist proving it still wrong to put
 * on a page in front of a team. Those are different judgements and they get
 * different numbers. Collapsing them into one "quality" score is how a
 * library of clever-but-unshowable examples ends up on an inspiration board.
 */
export interface ResearchScores {
  /** Is the mechanic itself worth knowing? 0-3. */
  mechanicValue: number;
  /** Would this artist land with a team as credible? 0-3. Culture, not size. */
  culturalRelevance: number;
  /** Is there something to LOOK at? 0-3. Thumbnails, staging, identity. */
  visualBoardValue: number;
}

export const SCORE_FIELDS: (keyof ResearchScores)[] = [
  'mechanicValue', 'culturalRelevance', 'visualBoardValue',
];

/**
 * Board eligibility is a rule, not a score, so it can be argued with.
 * A high mechanic score alone keeps an example in the library; the board
 * additionally requires that it be showable and worth looking at.
 */
export const BOARD_THRESHOLD = { mechanicValue: 2, culturalRelevance: 2, visualBoardValue: 2 };

export function boardEligible(s: ResearchScores | null | undefined): boolean {
  if (!s) return false;
  return s.mechanicValue >= BOARD_THRESHOLD.mechanicValue
    && s.culturalRelevance >= BOARD_THRESHOLD.culturalRelevance
    && s.visualBoardValue >= BOARD_THRESHOLD.visualBoardValue;
}

/** Why an example did not make the board. Shown, not hidden. */
export function boardBlockers(s: ResearchScores | null | undefined): string[] {
  if (!s) return ['Not scored.'];
  const out: string[] = [];
  if (s.mechanicValue < BOARD_THRESHOLD.mechanicValue) out.push('Mechanic is not distinctive enough.');
  if (s.culturalRelevance < BOARD_THRESHOLD.culturalRelevance) out.push('Proof artist is not credible enough to show a team.');
  if (s.visualBoardValue < BOARD_THRESHOLD.visualBoardValue) out.push('Nothing visually distinctive to put on a page.');
  return out;
}

/* ══ Matching ════════════════════════════════════════════════════════ */

export interface MatchExplanation {
  caseStudyId: string;
  subject: string;
  mechanic: string | null;
  /** The tags both sides share. Empty means no match, and we say so. */
  sharedTags: NeedTag[];
  /** One line per shared tag: the artist's need, then the example's proof. */
  why: string[];
  scores: ResearchScores | null;
  /** Who judged it. "model (proposed…)" is a materially weaker basis. */
  scoredBy: string | null;
  boardEligible: boolean;
  boardBlockers: string[];
  freshnessDays: number | null;
  sourceUrls: string[];
  limitations: string;
  /** UNVERIFIED / PARTIAL / VERIFIED / DISPUTED. See research.ts. */
  verification: string;
  /** Specific questions still outstanding. Empty once verified. */
  needsVerification: string[];
  thumbnailVideoId: string | null;
  archetype: string | null;
}
