/**
 * SCOUT — THE CONTRACTS
 *
 * Watcher watches the artists we know. Scout explores the ones we don't.
 *
 * The loop is seven separate stages and they stay separate:
 *
 *   DISCOVER    search, deterministic, 100 units a time
 *   QUALIFY     reject, deterministic, free
 *   OBSERVE     pull the catalogue, deterministic, ~4 units
 *   INVESTIGATE reason, model, expensive
 *   SAVE        persist to the knowledge layer
 *   LEARN       accumulate across runs
 *   APPLY       connect back to a real campaign, conservatively
 *
 * The model appears at exactly one of those stages. Everything before it
 * exists to make sure it is looking at something worth looking at.
 */

import type { MissionId } from './missions';
import type { CostMetrics, Finding, CaseStudy } from '../knowledge/types';

/* ══ Discovery ═══════════════════════════════════════════════════════ */

/**
 * A discovery is a lead, not evidence. That a channel came back for the
 * query "live session official performance" says something about its video
 * titles and nothing whatever about whether it is any good.
 */
export interface Discovery {
  channelId: string;
  channelTitle: string;
  /** The query that surfaced it — how it was discovered. */
  discoverySource: string;
  missionId: MissionId;
  discoveredAt: string;
  /** The video that matched, when the search was video-first. */
  viaVideoId: string | null;
  viaVideoTitle: string | null;
}

/* ══ Qualification ═══════════════════════════════════════════════════ */

export type RejectionReason =
  | 'ALREADY_IN_ROSTER'
  | 'ALREADY_IN_SCOUT'
  | 'NOT_AN_ARTIST_CHANNEL'
  | 'TOO_FEW_UPLOADS'
  | 'CHANNEL_TOO_SMALL'
  | 'DORMANT'
  | 'NO_RELEVANT_FORMATS'
  | 'MISSION_TEST_FAILED'
  | 'NO_UPLOADS_PLAYLIST';

export interface Rejection {
  channelId: string;
  channelTitle: string;
  reason: RejectionReason;
  /** The figure that caused it. Rejections must be re-checkable too. */
  detail: string;
}

/**
 * A channel that survived triage and whose catalogue was worth pulling.
 * `missionEvidence` is the deterministic case for investigating — the
 * thing that has to be true whether or not a model ever runs.
 */
export interface QualifiedChannel {
  channelId: string;
  title: string;
  handle: string | null;
  country: string | null;
  subs: number | null;
  totalViews: number | null;
  videoCount: number | null;
  missionId: MissionId;
  discoverySource: string;
  /** One line, with figures, saying why this cleared the mission's test. */
  missionEvidence: string;
  /** 0–1, deterministic. Orders the investigation queue. */
  score: number;
  /** The analysed catalogue, carried forward so we pull it once. */
  profile: ChannelProfile;
}

/* ══ Observation ═════════════════════════════════════════════════════ */

/**
 * Everything we can say about an external channel from one catalogue pull,
 * described in Watcher's own vocabulary so our channels and theirs can
 * eventually be compared in the same language.
 *
 * Note what is absent: any rate, velocity or trend. All view counts here
 * are lifetime totals at the moment of the pull. We have no history for a
 * channel we have not been watching, and inventing one by dividing views
 * by age would be the single easiest way to make this whole system lie.
 */
export interface ChannelProfile {
  channelId: string;
  uploadsAnalysed: number;
  /** Range covered by the analysed uploads. */
  windowStart: string;
  windowEnd: string;

  formatCounts: Record<string, number>;
  distinctFormats: number;
  shortsCount: number;
  longformCount: number;
  liveCount: number;

  /** Median days between consecutive uploads. */
  medianGapDays: number | null;
  uploadsLast90d: number;

  /** Hero releases (classified as omv), newest first. */
  heroes: { id: string; title: string; publishedAt: string; views: number }[];
  /** For the most recent hero: what followed it, and how many days later. */
  postHero: {
    heroId: string;
    heroTitle: string;
    heroPublishedAt: string;
    followUps: { id: string; title: string; format: string; daysAfter: number; views: number }[];
    /** Long-form published 1–21 days after the hero. The interesting count. */
    longFormWithin21d: number;
  } | null;

  /** Median views of long-form uploads. The only honest scale reference. */
  medianLongformViews: number | null;
}

/* ══ Scout universe ══════════════════════════════════════════════════ */

export type ScoutStatus =
  | 'CANDIDATE' | 'WATCHING' | 'INTERESTING' | 'BEST_IN_CLASS' | 'CASE_STUDY' | 'REJECTED' | 'STALE';

/**
 * Deliberately minimal, and deliberately without genre, territory, career
 * stage, label or campaign. We do not have those for our own roster; we
 * certainly do not have them for a channel we met this morning. Unknown
 * stays unknown rather than becoming a plausible guess that later gets
 * quoted as a fact.
 *
 * `country` is the exception, and only because the API reports it.
 */
export interface ScoutChannel {
  channelId: string;
  title: string;
  handle: string | null;
  country: string | null;

  discoveredAt: string;
  discoverySource: string;
  missionIds: MissionId[];

  /** Why we are keeping an eye on this one. Written by the qualifier. */
  whyWatching: string;
  /**
   * The qualifier's deterministic score, kept so a later investigation pass
   * can work the queue strongest-first. Without it the queue runs in
   * insertion order, which on the first live run meant the two weakest
   * candidates were investigated and the two strongest never were.
   */
  score: number;

  status: ScoutStatus;
  lastObservedAt: string | null;
  /** How many times Scout has looked. History starts when Scout starts. */
  observationCount: number;
  latestProfile: ChannelProfile | null;
}

/* ══ The run ═════════════════════════════════════════════════════════ */

export interface MissionResult {
  missionId: MissionId;
  question: string;
  queriesRun: string[];
  queriesCached: number;

  searchResults: number;
  uniqueChannels: number;
  rejected: Rejection[];
  qualified: QualifiedChannel[];
  investigated: number;

  findings: Finding[];
  caseStudies: CaseStudy[];
  nothingMaterial: { channelId: string; title: string; why: string }[];
}

export interface ScoutRun {
  runId: string;
  startedAt: string;
  finishedAt: string;
  missions: MissionResult[];
  cost: CostMetrics;
  notes: string[];
}
