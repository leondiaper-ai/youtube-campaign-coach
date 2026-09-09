/**
 * WATCHER INTELLIGENCE — THE CONTRACTS
 *
 * The division of labour this file encodes:
 *
 *   WATCHER    watches everything, cheaply and deterministically
 *   GROK       investigates the few things worth investigating
 *   ASSISTANT  decides what the strategist should look at
 *   KNOWLEDGE  remembers, so nothing is rediscovered
 *
 * ── WHY TRIAGE IS A SEPARATE STAGE ────────────────────────────────────
 * 177 channels × one model investigation each is roughly 177 × 16k tokens
 * per morning. That is not a cost problem so much as an attention problem:
 * a system that investigates everything has no opinion about anything.
 *
 * So the scan stage costs nothing — it reads stored snapshots, not the
 * YouTube API and not a model — and its only job is to nominate. A
 * `Candidate` is a claim that something MIGHT be worth a strategist's
 * time. It is not a finding, and it is never shown to anyone.
 *
 * ── WHY NOTHING_MATERIAL IS A SUCCESS ─────────────────────────────────
 * Every object here has a route to "nothing to say". The filter that
 * throws findings away is the feature; the model that generates them is
 * the commodity.
 */

import type { CoachConfidence, EvidenceItem } from '../coach-service/types';

/* ══ 1. SIGNALS — what the deterministic scan can actually detect ══════ */

/**
 * Only signals the stored data genuinely supports. Deliberately absent:
 *
 *   campaign phase transition — `artist.phase` is a static seed value and
 *     `detectCurrentPhase` needs a saved plan, which 166 of 177 lack.
 *   per-video trend — no per-video time series exists anywhere.
 *   audience composition, retention, traffic source — Studio-only.
 */
export type SignalType =
  | 'VIEW_ACCELERATION'
  | 'VIEW_DECELERATION'
  | 'SUBSCRIBER_SURGE'
  | 'SUBSCRIBER_DECLINE'
  | 'CLASSIFICATION_CHANGE'
  | 'CADENCE_CHANGE'
  | 'HERO_RELEASED'
  | 'RELEASE_APPROACHING'
  | 'FOLLOW_UP_WINDOW_OPEN'
  | 'STRONG_ASSET'
  | 'WENT_QUIET'
  | 'CATALOGUE_MOVEMENT';

export const SIGNAL_TYPES: SignalType[] = [
  'VIEW_ACCELERATION', 'VIEW_DECELERATION', 'SUBSCRIBER_SURGE', 'SUBSCRIBER_DECLINE',
  'CLASSIFICATION_CHANGE', 'CADENCE_CHANGE', 'HERO_RELEASED', 'RELEASE_APPROACHING',
  'FOLLOW_UP_WINDOW_OPEN', 'STRONG_ASSET', 'WENT_QUIET', 'CATALOGUE_MOVEMENT',
];

/**
 * A single deterministic observation. `reason` is written by the scanner in
 * plain English and must contain the numbers — it is what appears in the
 * "why was this investigated" column, and it is the thing that has to be
 * true whether or not a model ever runs.
 */
export interface Signal {
  type: SignalType;
  /** Human-readable, with figures. "Views 7d +412% vs prior 7d (2.1k → 10.8k)" */
  reason: string;
  /** 0–1. Deterministic, comparable across signal types. */
  strength: number;
  /** What the number was measured from, so it can be re-checked. */
  sourceRef: string;
  /** Days of stored history behind it. Thin history caps confidence downstream. */
  historyDays: number;
}

/* ══ 2. CANDIDATES — the output of triage ═════════════════════════════ */

/**
 * `priority` is deterministic on purpose. The brief is explicit that the
 * first-stage ranking must not be an opaque model score, and it does not
 * need to be: signal strength, roster importance, campaign relevance and
 * novelty are all computable.
 */
export interface Candidate {
  artistId: string;
  artistName: string;
  campaignId: string | null;
  signals: Signal[];
  /** Highest-strength signal. Drives which investigation type is chosen. */
  leadSignal: Signal;
  priority: number;
  priorityBreakdown: {
    signalStrength: number;
    strategicImportance: number;
    campaignRelevance: number;
    novelty: number;
  };
  /** Set when a recent finding already covers this ground. Blocks the run. */
  suppressedBy?: string | null;
}

/* ══ 3. FINDINGS — what an investigation produced ═════════════════════ */

export type FindingStatus =
  | 'NEW' | 'REVIEWED' | 'ACTIONED' | 'SAVED_AS_CASE_STUDY' | 'DISMISSED';

/**
 * NOVEL           the strategist would not have got this from Watcher or the deck
 * ALREADY_VISIBLE true, but Watcher already says it plainly
 * KNOWN           we have said this before and nothing has changed
 *
 * The model self-reports this and we do not trust it alone — `store.ts`
 * also checks the persisted history. But asking for it changes behaviour:
 * a model told that "obvious" is a valid verdict returns fewer restatements.
 */
export type Novelty = 'NOVEL' | 'ALREADY_VISIBLE' | 'KNOWN';

export interface IntelligenceFinding {
  id: string;
  artistId: string;
  artistName: string;
  campaignId: string | null;
  createdAt: string;
  updatedAt: string;

  /** What triggered the investigation. Copied from the candidate, verbatim. */
  signal: { type: SignalType; reason: string; sourceRef: string };

  /** One line. This is the whole finding as far as the brief is concerned. */
  headline: string;
  /** What was discovered. Two or three sentences, not an essay. */
  finding: string;
  /** Why the strategist should care. Must survive the five-minute test. */
  whyItMatters: string;
  /** May legitimately be "No action — worth knowing." */
  action: string;
  evidence: EvidenceItem[];
  novelty: Novelty;
  confidence: CoachConfidence;
  status: FindingStatus;

  /** Set when this finding produced a case study. */
  caseStudyId?: string | null;
  /** Set when it was filed into campaign memory. */
  memoryId?: string | null;

  producedBy: string;
  toolsUsed: string[];
  tokens: number;
  latencyMs: number;
  /** The run this came from, for cost attribution. */
  runId: string;
}

/**
 * Findings that did NOT survive the filter. Kept because "what did it
 * correctly decide was boring" is the main evidence that the filter works,
 * and because a silent suppression is indistinguishable from a bug.
 */
export interface SuppressedFinding {
  artistId: string;
  artistName: string;
  signal: string;
  /** Why it was thrown away. */
  reason:
    | 'NOTHING_MATERIAL'
    | 'ALREADY_VISIBLE'
    | 'REPEAT_OF_RECENT_FINDING'
    | 'LOW_CONFIDENCE'
    | 'NO_ACTIONABLE_CONSEQUENCE'
    | 'INVESTIGATION_FAILED';
  detail: string;
  tokens: number;
}

/* ══ 4. CASE STUDIES — first-class, because YouTube asked for them ════ */

export type CaseStudyStatus = 'CANDIDATE' | 'INVESTIGATING' | 'VALIDATED' | 'REJECTED';

/**
 * `evidenceClass` reuses the Coach service's provenance vocabulary rather
 * than inventing a parallel one. A case study built on COACH_INFERENCE is
 * a story, not a case study, and the field is what stops one being shown
 * to YouTube as though it were measured.
 */
export interface CaseStudyCandidate {
  id: string;
  artistId: string;
  artistName: string;
  createdAt: string;
  updatedAt: string;

  title: string;
  /** What the artist actually did. Observable, not interpreted. */
  behaviourObserved: string;
  evidence: EvidenceItem[];
  whyInteresting: string;

  principleId?: string | null;
  principleName?: string | null;

  /** The transferable lesson, if there is one. */
  potentialLearning: string;
  /** Free-text tags: 'shorts', 'album week', 'live', 'catalogue'. */
  applicableTo: string[];

  evidenceClass: 'OBSERVED' | 'INFERRED';
  confidence: CoachConfidence;
  status: CaseStudyStatus;

  sourceFindingId?: string | null;
}

/* ══ 5. BEST PRACTICE — principle → question → behaviour → case study ═ */

export type PrincipleStatus =
  | 'PROPOSED' | 'WATCHING' | 'EMERGING' | 'VALIDATED' | 'CONTRADICTED' | 'RETIRED';

/**
 * Deliberately small and deliberately NOT a prompt. The point of this
 * object is the `researchQuestions` field: a principle earns its place by
 * generating a question the investigator can go and answer against real
 * channels, not by being pasted into a system prompt as advice.
 */
export interface BestPracticePrinciple {
  id: string;
  title: string;
  description: string;
  /** Where it came from. 'Virgin deep dive: IDLES TANGK' beats 'general'. */
  source: string;
  /** When it applies. Kept honest — most principles are not universal. */
  applicability: string;
  researchQuestions: string[];
  status: PrincipleStatus;
  lastReviewed: string;
}

/* ══ 6. THE RUN ══════════════════════════════════════════════════════ */

export interface RunMetrics {
  channelsScanned: number;
  channelsWithData: number;
  candidatesTriggered: number;
  investigationsRun: number;
  materialFindings: number;
  suppressedFindings: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  scanMs: number;
  investigateMs: number;
  totalMs: number;
  /** grok-4 list price at time of writing. Recomputed, never stored as truth. */
  estimatedCostUsd: number;
}

export interface MorningRun {
  runId: string;
  startedAt: string;
  finishedAt: string;
  /** Ordered by priority. What the strategist actually reads. */
  findings: IntelligenceFinding[];
  /** Signals worth knowing about but not worth investigating. */
  watching: { artistId: string; artistName: string; reason: string }[];
  caseStudies: CaseStudyCandidate[];
  suppressed: SuppressedFinding[];
  /** Every candidate the scan produced, investigated or not. For the audit. */
  candidates: Candidate[];
  metrics: RunMetrics;
  notes: string[];
}
