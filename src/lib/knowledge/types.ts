/**
 * THE KNOWLEDGE LAYER
 *
 * What we have learned about how music campaigns behave on YouTube.
 *
 * ── WHY THIS IS A SEPARATE FOLDER ────────────────────────────────────
 * Models are replaceable. Grok is a way of producing findings, not the
 * thing of value. What accumulates — observed behaviours, case studies,
 * principles, counterexamples — has to outlive whichever model wrote it
 * down, and outlive whichever feature happened to trigger the look.
 *
 * So nothing in here knows about Scout, or about the Watcher roster, or
 * about a homepage feed. A finding records what was observed, where it
 * came from and how confident we are. That is all.
 *
 * This replaced an earlier `intelligence/` module that mixed the durable
 * record together with the machinery of a morning briefing feed. When the
 * feed was removed the record nearly went with it, which is exactly the
 * coupling this separation exists to prevent.
 */

import type { CoachConfidence, EvidenceItem } from '../coach-service/types';

export type { CoachConfidence, EvidenceItem };

/* ══ Findings ════════════════════════════════════════════════════════ */

export type FindingStatus =
  | 'NEW' | 'REVIEWED' | 'ACTIONED' | 'SAVED_AS_CASE_STUDY' | 'DISMISSED';

/**
 * NOVEL           worth someone's time; not derivable from what we already show
 * ALREADY_VISIBLE true, but our own tooling says it plainly already
 * KNOWN           we have said this before and nothing has changed
 *
 * The model self-reports this and we do not trust it alone — `store.isRepeat`
 * checks the persisted history too. But asking changes behaviour: a model
 * told that "obvious" is a valid verdict returns fewer restatements.
 */
export type Novelty = 'NOVEL' | 'ALREADY_VISIBLE' | 'KNOWN';

/** Where a finding came from. Extend as new investigators appear. */
export type FindingOrigin = 'SCOUT' | 'WATCHER' | 'HUMAN';

export interface Finding {
  id: string;
  origin: FindingOrigin;
  /** Roster slug for our artists, channelId for external ones. */
  subjectId: string;
  subjectName: string;
  createdAt: string;
  updatedAt: string;

  /** What prompted the look. Deterministic, quoted verbatim from the trigger. */
  trigger: { kind: string; reason: string; sourceRef: string };

  headline: string;
  finding: string;
  whyItMatters: string;
  action: string;
  evidence: EvidenceItem[];
  novelty: Novelty;
  confidence: CoachConfidence;
  status: FindingStatus;

  caseStudyId?: string | null;

  producedBy: string;
  toolsUsed: string[];
  tokens: number;
  latencyMs: number;
  /** The run this came from, for cost attribution. */
  runId: string;
}

/**
 * Investigations that produced nothing. Kept because "what did it correctly
 * decide was boring" is the main evidence that the filter works, and because
 * a silent suppression is indistinguishable from a bug.
 */
export interface Suppressed {
  subjectId: string;
  subjectName: string;
  trigger: string;
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

/* ══ Case studies ════════════════════════════════════════════════════ */

export type CaseStudyStatus =
  | 'CANDIDATE' | 'INVESTIGATING' | 'STRONG_EXAMPLE' | 'VALIDATED_CASE_STUDY' | 'REJECTED'
  /** In the library, deliberately not shown to a team. See ResearchScores. */
  | 'WATCHLIST'
  /** Passed both the mechanic bar and the showable bar. */
  | 'BOARD_ELIGIBLE';

/**
 * `whyNotObvious` and `limitations` are required fields rather than optional
 * ones, and that is the point of the shape. A case study that cannot say why
 * it is not obvious is a description; a case study that cannot state its own
 * limitations is not safe to put in front of YouTube.
 *
 * Nothing reaches VALIDATED_CASE_STUDY without a human. A model may write a
 * persuasive paragraph; it may not promote its own work.
 */
export interface CaseStudy {
  id: string;
  /** Display name of the artist or channel. */
  subject: string;
  channelId: string | null;
  /** Which research question turned this up, if any. */
  missionId: string | null;

  title: string;
  /** What they actually did. Observable, sequenced, no interpretation. */
  behaviourObserved: string;
  /** The architecture in order, where one is discernible. */
  sequence: string[];
  evidence: EvidenceItem[];

  whyInteresting: string;
  /** What stops this being something any strategist would already say. */
  whyNotObvious: string;

  relatedPrincipleId?: string | null;
  possibleLearning: string;
  /** What this evidence cannot support. Never blank. */
  limitations: string;

  status: CaseStudyStatus;
  confidence: CoachConfidence;

  discoveredAt: string;
  lastReviewedAt: string;
  sourceFindingId?: string | null;

  /* ── Research-library fields ────────────────────────────────────────
   * Added rather than forked into a second store. Every one is optional,
   * so records written before this existed stay valid and simply come back
   * unscored — which is the honest answer for them. A parallel
   * ResearchExample table would have meant two places to look for the same
   * thing and two sets of status transitions to keep in step.
   *
   * The vocabulary for these lives in intelligence/types.ts; they are typed
   * loosely here so the knowledge layer keeps its independence from the
   * matching layer, exactly as the header of this file insists.
   */

  /** The mechanic in a few words: "archive live as a Premiere run". */
  mechanic?: string | null;
  /** A reusable shape the mechanic belongs to: "named series", "process as event". */
  archetype?: string | null;
  /** NeedTag values. What campaign situations this is proof for. */
  usefulFor?: string[];
  /** ISO-3166 alpha-2 where known. Unknown stays unknown. */
  country?: string | null;
  /** When the BEHAVIOUR happened, as distinct from when we found it. */
  observedAt?: string | null;
  sourceUrls?: string[];
  /** A video id to pull a thumbnail from. We store the id, never the image. */
  thumbnailVideoId?: string | null;
  /** See ResearchScores. Absent means nobody has judged it yet. */
  scores?: {
    mechanicValue: number;
    culturalRelevance: number;
    visualBoardValue: number;
  } | null;
  /** Who scored it. A model may propose scores; only a human ratifies them. */
  scoredBy?: string | null;

  /**
   * THE HUMAN GATE. A model may find, verify and score an example, and the
   * board gate (scores + VERIFIED + source) says it is READY for a person to
   * look at. It reaches a client-facing surface only once a named person has
   * PROMOTED it here. There is no tool on the model surface that writes this.
   */
  promotion?: {
    status: 'PROMOTED' | 'REJECTED';
    by: string;
    at: string;
    note: string | null;
  } | null;

  /**
   * Proposed applications to one of our artists, as a model recorded them.
   * Structured so a rollout can show them next to — never instead of — the
   * human-authored recommendation. A proposal changes no campaign.
   */
  proposals?: {
    artistSlug: string;
    application: string;
    whatWouldHaveToBeTrue: string;
    proposedBy: string;
    at: string;
  }[];
}

/* ══ Principles ══════════════════════════════════════════════════════ */

export type PrincipleStatus =
  | 'PROPOSED' | 'WATCHING' | 'EMERGING' | 'VALIDATED' | 'CONTRADICTED' | 'RETIRED';

/**
 * Deliberately not a prompt. A principle earns its place by generating a
 * question someone can go and answer against real channels, which is why
 * `researchQuestions` is the field that matters and `description` is not.
 */
export interface BestPracticePrinciple {
  id: string;
  title: string;
  description: string;
  source: string;
  applicability: string;
  researchQuestions: string[];
  status: PrincipleStatus;
  lastReviewed: string;
}

/* ══ Cost ════════════════════════════════════════════════════════════ */

export interface CostMetrics {
  /** Estimated YouTube Data API units spent by this run. */
  quotaUnits: number;
  modelCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  /** grok-4 list price. Recomputed, never stored as billed truth. */
  estimatedCostUsd: number;
}

export const USD_PER_PROMPT_TOKEN = 3 / 1_000_000;
export const USD_PER_COMPLETION_TOKEN = 15 / 1_000_000;

export function costOf(totalTokens: number, modelCalls: number, quotaUnits: number, latencyMs: number): CostMetrics {
  /* The provider returns a total, not a split. Rather than invent a
     breakdown we attribute it where nearly all of it lives in a
     tool-calling run — the prompt — and say so here. */
  const promptTokens = Math.round(totalTokens * 0.93);
  const completionTokens = totalTokens - promptTokens;
  return {
    quotaUnits, modelCalls, promptTokens, completionTokens, totalTokens, latencyMs,
    estimatedCostUsd:
      promptTokens * USD_PER_PROMPT_TOKEN + completionTokens * USD_PER_COMPLETION_TOKEN,
  };
}
