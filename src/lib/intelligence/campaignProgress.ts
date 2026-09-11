/**
 * THE CAMPAIGN PROGRESS READ MODEL
 *
 * Deep Dive = fixed strategic baseline.
 * Progress  = the living record of what happened after it.
 *
 * This file owns no data. It joins the small progress record written by a
 * human to the stores Watcher already keeps — snapshots, weekly history,
 * campaign events, reads, campaign memory, retained learnings, research —
 * and returns one readable progression per recommendation.
 *
 * ── THE FIVE CLASSES STAY SEPARATE ────────────────────────────────────
 *   HUMAN     "we advised the team to start posting"
 *   OBSERVED  "two Shorts appeared on 9 and 10 September"
 *   DERIVED   "+3,049,570 views since the Deep Dive was captured"
 *   INFERRED  a model's reading. Absent unless something wrote one.
 *   LEARNED   a conclusion a person reviewed and retained.
 *
 * They are separate fields, not one blended narrative, because the blend is
 * where "the team did what we asked and it worked" gets assembled out of
 * three things none of which said that.
 *
 * ── WHY RESULT IS HARD TO REACH ───────────────────────────────────────
 * `sufficientEvidence` gates it: enough days elapsed, and something actually
 * published. Two Shorts two days old is not a result, however much everyone
 * would like it to be, and a box that fills itself early is worse than an
 * empty one.
 */

import { deepDiveFor, resolveArtist } from './needs';
import { listRecommendations, type DeepDiveRecommendation } from './recommendationId';
import { listProgress, type RecommendationProgress, type ProgressState } from './progressStore';
import { buildFreshnessReport, type FreshnessReport } from './freshness';
import { readHumanContext } from './humanContext';
import { getRelevantResearch } from './match';
import { readLiveSnapByHandle } from '../kvCache';
import { readHistory, deltaOver } from '../snapshots';
import { listEvents } from '../coach-bot/horizon';
import { listMemory } from '../coach-service/memory';
import { readCampaignRead, readHistory as readReadHistory } from '../assistant/readStore';
import { listRecommendations as listCoachRecs } from '../coach-bot/store';
import type { DeepDiveContext } from './types';

/** Days after implementation before a result is even arguable. */
const RESULT_WINDOW_DAYS = 28;

export interface ObservedSince {
  /** Uploads visible on the channel since the implementation date. */
  uploads: { videoId: string; title: string; publishedAt: string; kind: string; views: number }[];
  /** Campaign events recorded as happening in the window. */
  events: { eventId: string; title: string; eventDate: string | null; status: string }[];
  /** Movement in the snapshot series. DERIVED, not observed. */
  channelMovement: { metric: string; delta: number | null; over: string }[];
  /** Plain statements about what could NOT be joined. */
  coverage: string[];
}

export interface RecommendationProgressView {
  recommendation: DeepDiveRecommendation;
  /** The living state, or NOT_STARTED when nobody has said anything. */
  status: ProgressState;
  statusProvenance: 'HUMAN' | 'DEFAULT';

  implementation: {
    statedBy: string;
    statedAt: string;
    precision: string;
    note: string;
    history: RecommendationProgress['history'];
  } | null;

  observedSince: ObservedSince | null;

  /** Only when the window has elapsed AND something published. */
  result: { available: false; because: string } | { available: true; summary: string };

  /** Only when a human retained one. Empty is the normal answer. */
  learning: { statement: string; retainedAt: string; sourceRef: string }[];

  /** What we are waiting for, in plain words. */
  nextWatch: string;
}

export interface CampaignProgressReport {
  artistSlug: string;
  artistName: string;

  deepDive: {
    title: string;
    version: string;
    capturedAt: string | null;
    thesis: string;
    deckUrl: string | null;
    /** Never rewritten. The record of what we saw and recommended then. */
    immutable: true;
  } | null;

  freshness: FreshnessReport | null;

  /** Every actionable recommendation, tracked or not. Nothing disappears. */
  recommendations: RecommendationProgressView[];

  summary: {
    total: number;
    notStarted: number;
    inFlight: number;   // PLANNED | IMPLEMENTED | OBSERVING
    withResult: number;
    learned: number;
  };

  /** HUMAN context, separate from progress. Plans, constraints, asks. */
  humanContext: { kind: string; text: string; statedBy: string; statedAt: string; freshness: string }[];

  /**
   * The latest Campaign Read and the open Coach recommendations, reused
   * rather than regenerated. Both already exist per artist; this page links
   * to them so the weekly view is one destination rather than three.
   */
  watcherReads: {
    latest: { headline: string; status: string; generatedAt: string; evidenceAsOf: string; reviewStatus: string } | null;
    priorCount: number;
    coachOpen: { id: string; status: string; recommendation: string; createdAt: string; verdict: string | null }[];
  };

  /** Placeholder until verification runs. Never fabricated. */
  seeingElsewhere: {
    ready: boolean;
    note: string;
    verifiedCount: number;
    candidateCount: number;
  };

  limitations: string[];
  generatedAt: string;
}

/* ══ The join ════════════════════════════════════════════════════════ */

function parseSince(statedAt: string): Date | null {
  /* Month precision resolves to the first of the month. Deliberately
     generous — it widens the observation window rather than narrowing it,
     so an upload near the boundary is included and flagged rather than
     silently dropped. */
  const iso = /^\d{4}-\d{2}$/.test(statedAt) ? `${statedAt}-01` : statedAt;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function observedSince(
  slug: string, handle: string | null, since: Date,
): Promise<ObservedSince> {
  const coverage: string[] = [];
  const uploads: ObservedSince['uploads'] = [];
  const events: ObservedSince['events'] = [];
  const channelMovement: ObservedSince['channelMovement'] = [];

  const snap = handle ? await readLiveSnapByHandle(handle).catch(() => null) : null;
  if (!snap) {
    coverage.push('No cached channel snapshot — no uploads or movement could be joined.');
  } else {
    const latest: any[] = (snap as any).latestVideos ?? [];
    if (!latest.length) {
      coverage.push('Snapshot holds no recent-video list, so uploads since implementation could not be listed.');
    }
    for (const v of latest) {
      const at = new Date(v.publishedAt ?? 0);
      if (Number.isFinite(at.getTime()) && at >= since) {
        uploads.push({
          videoId: v.videoId, title: v.title, publishedAt: v.publishedAt,
          kind: v.kind ?? 'unknown', views: v.views ?? 0,
        });
      }
    }
    uploads.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

    const channelId = (snap as any).channelId;
    if (channelId) {
      const hist = await readHistory(channelId).catch(() => []);
      const days = Math.max(1, Math.round((Date.now() - since.getTime()) / 86_400_000));
      for (const metric of ['views', 'subs'] as const) {
        /* deltaOver returns the baseline and last snapshots alongside the
           delta. Only the delta is surfaced here — the page is a strategy
           page, and the reader does not need two snapshot objects to
           understand that views moved. */
        const d = deltaOver(hist, days, metric);
        channelMovement.push({
          metric,
          delta: d ? d.delta : null,
          over: `${days} day(s) since implementation`,
        });
      }
      if (hist.length < 7) {
        coverage.push(`Only ${hist.length} snapshot(s) in the series — movement figures are weak.`);
      }
    }
  }

  const evs = await listEvents(slug).catch(() => []);
  for (const e of evs) {
    if (!e.eventDate) continue;
    const at = new Date(e.eventDate);
    if (Number.isFinite(at.getTime()) && at >= since) {
      events.push({ eventId: e.eventId, title: e.title, eventDate: e.eventDate, status: e.status });
    }
  }
  if (!evs.length) {
    coverage.push('No campaign events are recorded for this artist, so planned moments cannot be cross-checked.');
  }

  return { uploads, events, channelMovement, coverage };
}

/**
 * Whether a result can honestly be stated.
 *
 * Two conditions, and both are about not flattering ourselves. Time, so a
 * two-day-old upload is not read as an outcome. And publication, so an
 * implementation nobody can see does not acquire one.
 */
function resultGate(
  progress: RecommendationProgress | undefined, obs: ObservedSince | null,
): RecommendationProgressView['result'] {
  if (!progress) return { available: false, because: 'Nothing has been implemented against this recommendation.' };
  if (progress.state === 'RESULT' || progress.state === 'LEARNED') {
    return { available: true, summary: progress.note };
  }
  const since = parseSince(progress.statedAt);
  const days = since ? Math.round((Date.now() - since.getTime()) / 86_400_000) : null;
  if (days == null) {
    return { available: false, because: 'Implementation date could not be parsed.' };
  }
  if (days < RESULT_WINDOW_DAYS) {
    return {
      available: false,
      because: `Implemented ${days} day(s) ago. A result is not arguable inside ${RESULT_WINDOW_DAYS} days — `
        + 'too little has accumulated, and lifetime view totals on new assets say almost nothing yet.',
    };
  }
  if (!obs?.uploads.length) {
    return {
      available: false,
      because: `${days} days since implementation and no uploads are visible in the window. There is nothing to measure.`,
    };
  }
  return {
    available: false,
    because: `${days} days elapsed with ${obs.uploads.length} upload(s) observed. Enough has happened to assess — `
      + 'a human needs to state the result, because deciding what a number means is not a derivation.',
  };
}

function nextWatchFor(
  rec: DeepDiveRecommendation, state: ProgressState, result: RecommendationProgressView['result'],
): string {
  if (state === 'LEARNED') return 'Nothing. A conclusion has been retained.';
  if (state === 'RESULT') return 'Review the result and decide whether it becomes a retained learning.';
  if (state === 'NOT_STARTED') {
    return `Not started. Waiting on the team, or on a decision not to do it — either is a valid answer, but `
      + 'neither is recorded yet.';
  }
  if (!result.available && 'because' in result) return result.because;
  return `Watching for evidence against "${rec.point}".`;
}

/* ══ The report ══════════════════════════════════════════════════════ */

export async function getCampaignProgress(input: string): Promise<CampaignProgressReport> {
  const who = await resolveArtist(input);
  const { dive } = who.deepDiveSlug
    ? await deepDiveFor(who.deepDiveSlug)
    : { dive: null as DeepDiveContext | null };

  const generatedAt = new Date().toISOString();
  const limitations: string[] = [
    'The Deep Dive is a fixed, dated baseline. It is never rewritten by progress — progress is measured against it.',
    'Watcher can observe that uploads appeared. It cannot observe that they appeared because of a recommendation. '
      + 'Only the HUMAN implementation record establishes intent; uploads are supporting evidence.',
    'All view figures are lifetime totals. They are not velocity and must not be divided by asset age.',
    'No YouTube Studio data is available anywhere in this system — no retention, traffic source, impressions, '
      + 'CTR, unique viewers or subscriber attribution.',
  ];

  if (!dive) {
    return {
      artistSlug: who.slug, artistName: who.name,
      deepDive: null, freshness: null, recommendations: [],
      summary: { total: 0, notStarted: 0, inFlight: 0, withResult: 0, learned: 0 },
      watcherReads: { latest: null, priorCount: 0, coachOpen: [] },
      humanContext: [],
      seeingElsewhere: { ready: false, note: 'No Deep Dive, so no campaign progress can be tracked.', verifiedCount: 0, candidateCount: 0 },
      limitations: [...limitations, `No Deep Dive exists for ${who.name}.`],
      generatedAt,
    };
  }

  const snap = who.artist?.channelHandle
    ? await readLiveSnapByHandle(who.artist.channelHandle).catch(() => null)
    : null;

  const freshness = buildFreshnessReport(dive, {
    lastUploadAt: (snap as any)?.lastUploadAt ?? null,
    subs: (snap as any)?.subs ?? null,
    views: (snap as any)?.views ?? null,
    uploads30d: (snap as any)?.uploads30d ?? null,
    checkedAt: (snap as any)?.cachedAt ?? null,
  }, generatedAt);

  const recs = listRecommendations(dive);
  const progress = await listProgress(who.slug).catch(() => []);
  const byId = new Map<string, RecommendationProgress>(
    progress.map(p => [p.recommendationId, p] as const));

  /* Retained learnings that name a recommendation. LEARNED is the only
     class allowed in here, and only a human review puts it there. */
  const memory = await listMemory(who.slug).catch(() => []);
  const learningsById = new Map<string, RecommendationProgressView['learning']>();
  for (const m of memory) {
    const ref = String((m as any).sourceRef ?? '');
    const match = /dd_[a-z0-9-]+_[a-z0-9]+/i.exec(ref);
    if (!match) continue;
    if ((m as any).humanDecision !== 'ACCEPTED') continue;
    const list = learningsById.get(match[0]) ?? [];
    list.push({ statement: m.text, retainedAt: m.createdAt, sourceRef: ref });
    learningsById.set(match[0], list);
  }

  const views: RecommendationProgressView[] = [];
  for (const rec of recs) {
    const p = byId.get(rec.id);
    const since = p ? parseSince(p.statedAt) : null;
    const obs = since ? await observedSince(who.slug, who.artist?.channelHandle ?? null, since) : null;
    const result = resultGate(p, obs);
    const state: ProgressState = p?.state ?? 'NOT_STARTED';

    views.push({
      recommendation: rec,
      status: state,
      statusProvenance: p ? 'HUMAN' : 'DEFAULT',
      implementation: p ? {
        statedBy: p.statedBy, statedAt: p.statedAt, precision: p.statedAtPrecision,
        note: p.note, history: p.history,
      } : null,
      observedSince: obs,
      result,
      learning: learningsById.get(rec.id) ?? [],
      nextWatch: nextWatchFor(rec, state, result),
    });
  }

  const latestRead = await readCampaignRead(who.slug).catch(() => null);
  const priorReads = await readReadHistory(who.slug).catch(() => []);
  const coachRecs = await listCoachRecs(who.slug).catch(() => []);

  const human = await readHumanContext(who.slug).catch(() => []);
  const research = await getRelevantResearch(who.slug, { boardOnly: false }).catch(() => null);
  const verified = research?.libraryStats.verified ?? 0;

  const inFlight = views.filter(v => ['PLANNED', 'IMPLEMENTED', 'OBSERVING'].includes(v.status)).length;

  return {
    artistSlug: who.slug,
    artistName: who.name,
    deepDive: {
      title: dive.title,
      version: `${dive.deckUpdated}/${dive.transcribedAt}`,
      capturedAt: dive.dataCapturedAt,
      thesis: dive.coreThesis,
      deckUrl: dive.deckUrl,
      immutable: true,
    },
    freshness,
    recommendations: views,
    summary: {
      total: views.length,
      notStarted: views.filter(v => v.status === 'NOT_STARTED').length,
      inFlight,
      withResult: views.filter(v => v.result.available).length,
      learned: views.filter(v => v.status === 'LEARNED').length,
    },
    watcherReads: {
      latest: latestRead ? {
        headline: (latestRead as any).read ?? (latestRead as any).headline ?? '',
        status: (latestRead as any).status ?? 'UNKNOWN',
        generatedAt: (latestRead as any).generatedAt ?? '',
        evidenceAsOf: (latestRead as any).evidenceAsOf ?? '',
        reviewStatus: (latestRead as any).humanReviewStatus ?? 'UNREVIEWED',
      } : null,
      priorCount: Array.isArray(priorReads) ? priorReads.length : 0,
      /* Only recommendations a human has not yet ruled on. An approved or
         rejected one is history, and history belongs in the read, not in
         the list of things still open. */
      coachOpen: (coachRecs as any[])
        .filter(r => !r.feedback)
        .slice(0, 5)
        .map(r => ({
          id: r.id, status: r.status, recommendation: r.recommendation,
          createdAt: r.createdAt, verdict: r.feedback?.decision ?? null,
        })),
    },
    humanContext: human.map(h => ({
      kind: h.kind, text: h.text, statedBy: h.statedBy, statedAt: h.statedAt, freshness: h.freshness,
    })),
    seeingElsewhere: {
      ready: verified > 0,
      note: verified > 0
        ? `${verified} verified external example(s) available.`
        : 'No external research has been verified yet, so there is nothing to show here. This section stays '
          + 'empty rather than displaying unverified claims about other artists.',
      verifiedCount: verified,
      candidateCount: research?.libraryStats.total ?? 0,
    },
    limitations,
    generatedAt,
  };
}
