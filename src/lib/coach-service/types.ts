/**
 * COACH SERVICE — THE SHARED OUTPUT CONTRACT
 *
 * One intelligence layer, several presentation surfaces. Watcher, artist
 * pages and decks all render THIS shape; none of them talks to a model, and
 * none of them owns any coaching logic of its own.
 *
 * ── WHY A SCHEMA AND NOT PROSE ────────────────────────────────────────
 * Prose cannot be filtered, sorted, counted or diffed. A Watcher home that
 * must answer "what needs my attention?" has to rank thirty campaigns
 * without reading thirty paragraphs, so status and nextCheck have to be
 * fields. Equally, a deck card wants headline + recommendation and nothing
 * else. Both are views over the same record.
 *
 * The fields are deliberately narrow. Every one of them is something a
 * surface actually renders — this is not a place to accumulate metadata.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  turns: number;
}

/* ── Status ─────────────────────────────────────────────────────────── */

/**
 * ON_TRACK is the expected default, not a failure to find something.
 *
 * A coaching system that returns a finding for every campaign every day is
 * indistinguishable from noise, and the team stops reading it within a
 * fortnight. The Watcher home is built to collapse ON_TRACK into a count,
 * which only works if the Coach is genuinely willing to use it.
 */
export type CoachStatus =
  | 'ON_TRACK'
  | 'WATCH'
  | 'ACTION_REQUIRED'
  | 'OPPORTUNITY'
  | 'RISK';

export const COACH_STATUSES: CoachStatus[] = [
  'ON_TRACK', 'WATCH', 'ACTION_REQUIRED', 'OPPORTUNITY', 'RISK',
];

/** Ordering for the attention layer. Higher surfaces first. */
export const STATUS_RANK: Record<CoachStatus, number> = {
  ACTION_REQUIRED: 4,
  RISK: 3,
  OPPORTUNITY: 2,
  WATCH: 1,
  ON_TRACK: 0,
};

export function needsAttention(s: CoachStatus): boolean {
  return STATUS_RANK[s] > 0;
}

export type CoachConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/* ── Provenance ─────────────────────────────────────────────────────── */

/**
 * WATCHER          deterministic, computed by us, reproducible
 * PUBLIC_YOUTUBE   fetched from the public Data API (titles, dates, counts)
 * EXTERNAL         anything from outside those two
 * COACH_INFERENCE  the model's own reasoning — NOT an observation
 *
 * The split exists because the single most damaging failure mode here is a
 * plausible sentence that blends a measured number with an inferred cause.
 * Keeping COACH_INFERENCE as a distinct class means the UI can always show
 * where the reasoning stops being evidence, even before anyone builds a
 * citation system on top.
 */
export type SourceType = 'WATCHER' | 'PUBLIC_YOUTUBE' | 'EXTERNAL' | 'COACH_INFERENCE';

export interface EvidenceItem {
  sourceType: SourceType;
  /** One statement, as specific as the data allows. */
  claim: string;
  /** Tool name, video id, date range — whatever makes it re-checkable. */
  sourceRef?: string | null;
}

/* ── Suggested actions ──────────────────────────────────────────────── */

/**
 * The investigation types the service knows how to run. `label` is written
 * by the Coach for this specific campaign ("Analyse Pressure performance"),
 * while `investigationType` is what the backend dispatches on — so the UI
 * stays dynamic without the routing depending on model-generated strings.
 */
export type InvestigationType =
  | 'WHY'
  | 'ANALYSE_LATEST_VIDEO'
  | 'AUDIENCE_REACTION'
  | 'COMPARE_PREVIOUS_CAMPAIGN'
  | 'COMPARE_RELEVANT_ARTISTS'
  | 'WHAT_NEXT'
  | 'WHAT_TO_TEST'
  | 'CUSTOM';

export const INVESTIGATION_TYPES: InvestigationType[] = [
  'WHY', 'ANALYSE_LATEST_VIDEO', 'AUDIENCE_REACTION', 'COMPARE_PREVIOUS_CAMPAIGN',
  'COMPARE_RELEVANT_ARTISTS', 'WHAT_NEXT', 'WHAT_TO_TEST', 'CUSTOM',
];

export interface SuggestedAction {
  id: string;
  /** Campaign-specific wording shown on the button. */
  label: string;
  investigationType: InvestigationType;
}

/* ── The record ─────────────────────────────────────────────────────── */

export interface CoachOverview {
  artistId: string;
  artistName: string;
  campaignId: string | null;
  campaignName: string | null;
  generatedAt: string;

  status: CoachStatus;
  /** One line. This is what the attention layer shows. */
  headline: string;
  whatHappened: string;
  interpretation: string;
  /** May legitimately be "No intervention required." */
  recommendation: string;
  /** When to act, if at all. Empty when there is nothing to time. */
  timing: string;
  evidenceSummary: string;
  evidence: EvidenceItem[];
  confidence: CoachConfidence;
  /** What the Coach knows it could not see. Required, never blank. */
  missingContext: string;
  nextCheck: string;
  suggestedActions: SuggestedAction[];

  /** Provenance of the run itself, for debugging and for the UI footer. */
  producedBy: string;
  toolsUsed: string[];
  /** Token cost of this run, summed across every model turn. */
  usage?: TokenUsage;
  /** The deterministic forward-plan quality this reading was capped by. */
  horizonConfidence?: string;
  /** True when served from cache rather than freshly reasoned. */
  cached?: boolean;
}

export interface CoachAnswer {
  artistId: string;
  campaignId: string | null;
  generatedAt: string;
  question: string;
  investigationType: InvestigationType;
  /** Markdown. Deeper answers are prose by nature — but see evidence[]. */
  answer: string;
  evidence: EvidenceItem[];
  confidence: CoachConfidence;
  missingContext: string;
  suggestedActions: SuggestedAction[];
  producedBy: string;
  toolsUsed: string[];
  usage?: TokenUsage;
}

/* ── Access scope ───────────────────────────────────────────────────── */

/**
 * Not an auth system — the repo has no user model yet and the brief says not
 * to build one. This is the seam where one goes later.
 *
 * The rule it enforces today is narrow but real: every service call takes a
 * scope, and the roster is filtered through it. That stops artist identity
 * being read straight from a URL parameter, which is the thing that would be
 * expensive to unpick once several surfaces depend on it.
 */
export type ScopeKind = 'ARTIST' | 'LABEL' | 'TERRITORY' | 'GLOBAL';

export interface CoachScope {
  kind: ScopeKind;
  /** Artist slugs for ARTIST/LABEL. Ignored for GLOBAL. */
  artistSlugs?: string[];
  /** Territory code for TERRITORY. Not yet enforced — no territory field exists. */
  territory?: string;
}

/** The only scope available until there is a user model. Named, not implicit. */
export const INTERNAL_GLOBAL_SCOPE: CoachScope = { kind: 'GLOBAL' };

export function scopeAllows(scope: CoachScope, slug: string): boolean {
  if (scope.kind === 'GLOBAL') return true;
  if (scope.kind === 'TERRITORY') return true; // no territory data to filter on yet
  return (scope.artistSlugs ?? []).includes(slug);
}
