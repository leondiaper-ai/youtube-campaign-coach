/**
 * YOUTUBE RESEARCHER — TYPES
 *
 * The vocabulary for the research layer. Watcher answers "what happened".
 * This layer answers "is that interesting, is it unusual, and does it change
 * what we recommend".
 *
 * ── THE ONE RULE THAT GOVERNS EVERYTHING HERE ──────────────────────────
 * Public YouTube data gives us LIFETIME view counts. A three-year-old video
 * and a three-month-old video are not comparable, ever. So every comparison
 * in this system is either WITHIN one artist, or between assets bucketed by
 * age. `AgeBucket` exists to make that structural rather than a convention
 * someone can forget. If a finding ever compares raw lifetime views across
 * assets of different ages, it is wrong regardless of how good it sounds.
 *
 * ── WHAT THIS LAYER MUST NOT CLAIM ────────────────────────────────────
 * Same discipline as the artist decks. Public API only. Nothing about
 * retention, traffic sources, Browse/Suggested, unique or returning viewers,
 * subscriber attribution, audience overlap, Shorts→long-form conversion,
 * end screens, playlist routing, or incremental Premiere effect. We cannot
 * see any of it. `Evidence.basis` forces every finding to name what it
 * actually rests on.
 */

/* ── Reconstructed campaign architecture ────────────────────────────── */

/** A single upload as reconstructed from the public catalogue. */
export interface Asset {
  videoId: string;
  title: string;
  publishedAt: string;      // ISO
  durationSec: number;
  isShort: boolean;
  views: number;            // LIFETIME as at fetch time — never a period figure
  likes?: number;
  comments?: number;
  /** From the existing formatClassifier — do not re-derive. */
  format: string;
  /** Long-form music asset that plausibly anchors a release moment. */
  isHero: boolean;
  ageDays: number;
  ageBucket: AgeBucket;
}

/**
 * Age buckets for like-for-like comparison. Deliberately coarse: finer
 * buckets give smaller samples and false precision, and the underlying
 * decay curve is steepest early, which is why the early buckets are narrow.
 */
export type AgeBucket = '0-30d' | '31-90d' | '91-180d' | '181-365d' | '1-2y' | '2y+';

export function ageBucketOf(days: number): AgeBucket {
  if (days <= 30) return '0-30d';
  if (days <= 90) return '31-90d';
  if (days <= 180) return '91-180d';
  if (days <= 365) return '181-365d';
  if (days <= 730) return '1-2y';
  return '2y+';
}

/**
 * A hero release and what happened around it. This is the unit of analysis
 * for most of the seed research questions — the follow-up window study, the
 * gap study, and the sequencing study all operate on these.
 */
export interface ReleaseMoment {
  artistSlug: string;
  hero: Asset;
  /** Days to the NEXT hero. null when this is the most recent. */
  daysToNextHero: number | null;
  /** Long-form uploads strictly between this hero and the next. */
  longFormInGap: Asset[];
  /** Shorts strictly between this hero and the next. */
  shortsInGap: Asset[];
  /**
   * The question in seed #2: did a second long-form asset land 7–14 days
   * after the hero? `null` when the window has not fully elapsed yet, which
   * is different from "no" and must not be collapsed into it.
   */
  followUp7to14: boolean | null;
  /** Days from hero to the first long-form asset after it. */
  daysToFirstFollowUp: number | null;
  /**
   * Hero views as a ratio of the artist's OWN median hero in the SAME age
   * bucket. 1.0 = typical for this artist at this age. This is the only
   * performance measure in the system that is safe to compare across
   * artists, because it is already normalised by artist and by age.
   */
  heroVsOwnBaseline: number | null;
  /** Sample size behind heroVsOwnBaseline. Below ~3 the ratio is noise. */
  baselineN: number;
}

/** Everything the Researcher knows about one artist's catalogue. */
export interface CatalogueRecon {
  artistSlug: string;
  artistName: string;
  channelId: string;
  channelTitle: string;
  subscribers: number | null;
  totalUploads: number;
  /** True when the API cap bit and we do NOT have the full catalogue. */
  capped: boolean;
  firstUploadAt: string | null;
  lastUploadAt: string | null;
  heroes: Asset[];
  moments: ReleaseMoment[];
  /** Median hero views per age bucket, for this artist only. */
  heroBaselineByAge: Partial<Record<AgeBucket, { median: number; n: number }>>;
  shortsTotal: number;
  longFormTotal: number;
  fetchedAt: string;
}

/* ── Cohorts ────────────────────────────────────────────────────────── */

/**
 * NOTE ON GENRE. The roster has no genre field (checked — Artist has slug,
 * name, channelHandle, phase, artistType, ownership, campaign dates and
 * nothing else). So cohorts here are formed on SIZE and BEHAVIOUR, which we
 * can actually observe, rather than on a genre we would have to invent.
 * If genre is added to the roster later, add it as a cohort dimension —
 * do not fabricate it from artist names.
 */
export type SizeBand = 'developing' | 'mid' | 'established' | 'large';

export function sizeBandOf(subs: number | null): SizeBand {
  if (subs == null) return 'developing';
  if (subs < 50_000) return 'developing';
  if (subs < 250_000) return 'mid';
  if (subs < 1_000_000) return 'established';
  return 'large';
}

export interface Cohort {
  id: string;
  label: string;
  criteria: Record<string, unknown>;
  memberSlugs: string[];
  n: number;
}

/* ── Research knowledge store ───────────────────────────────────────── */

export type Status =
  | 'observation'
  | 'hypothesis'
  | 'emerging'
  | 'validated'
  | 'contextual'
  | 'contradicted'
  | 'retired';

export type Confidence = 'low' | 'medium' | 'high';

/**
 * What a finding actually rests on. Required, not optional — a finding
 * that cannot fill this in does not pass the gate.
 */
export interface Evidence {
  /** Plain description of the data behind the claim. */
  basis: string;
  /** Artist slugs examined. */
  artists: string[];
  /** Number of independent units (releases, campaigns, channels). */
  sampleSize: number;
  /** Named metrics used, so a reviewer can re-derive the claim. */
  metrics: string[];
  /** Anything that limits the claim. Age confounds, small n, capped fetch. */
  caveats: string[];
}

export interface Finding {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** One-sentence claim. */
  claim: string;
  whyItMatters: string;
  evidence: Evidence;
  confidence: Confidence;
  /** Deliberately first-class: the system must look for its own opposite. */
  counterEvidence: string | null;
  nextTest: string;
  potentialAction: string | null;
  status: Status;
  /** Which research question prompted it, when applicable. */
  questionId?: string;
  /** Gate result, stored so we can audit what got through and why. */
  gate: GateResult;
  humanFeedback?: HumanFeedback;
  /** Model + provider that produced it, for later comparison. */
  producedBy: string;
}

export interface Hypothesis {
  id: string;
  createdAt: string;
  updatedAt: string;
  statement: string;
  status: Extract<Status, 'hypothesis' | 'emerging' | 'validated' | 'contextual' | 'contradicted' | 'retired'>;
  supportingFindingIds: string[];
  contradictingFindingIds: string[];
  /** What would have to be true for this to be wrong. */
  falsifier: string;
  origin: 'researcher' | 'human_feedback';
  notes?: string;
}

export type FeedbackDecision = 'approve' | 'modify' | 'reject';

/**
 * Human feedback does NOT become a rule. It becomes a hypothesis, exactly
 * as the brief requires — the reviewer may be right for a reason that does
 * not generalise, and promoting one correction into a universal rule is how
 * a research system starts producing confident nonsense.
 */
export interface HumanFeedback {
  decision: FeedbackDecision;
  reasoning: string;
  /** What the AI did not know. Becomes the seed of a candidate learning. */
  contextGap?: string;
  /** Testable statement derived from the correction. */
  candidateLearning?: string;
  modifiedClaim?: string;
  at: string;
}

/* ── Insight quality gate ───────────────────────────────────────────── */

export interface GateScores {
  nonObvious: number;    // 0-2
  specific: number;      // 0-2
  supported: number;     // 0-2
  actionable: number;    // 0-2
  measurable: number;    // 0-2
  decisionChanging: number; // 0-2
}

export interface GateResult {
  passed: boolean;
  score: number;      // 0-12
  scores: GateScores;
  reasons: string[];  // why it failed, when it failed
}

/* ── Research questions ─────────────────────────────────────────────── */

export interface ResearchQuestion {
  id: string;
  question: string;
  /** Whether the current data can actually address it, and how far. */
  answerable: 'yes' | 'partial' | 'no';
  /** When partial/no: what is missing. Honesty about our own limits. */
  limitation?: string;
}
