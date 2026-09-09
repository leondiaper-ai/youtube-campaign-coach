/**
 * THE SCOUT RUN
 *
 *   DISCOVER → QUALIFY → OBSERVE → INVESTIGATE → SAVE
 *
 * The funnel is the product. A healthy run looks like several hundred
 * search results collapsing to a handful of investigations and one or two
 * findings, with everything that died on the way recorded and re-checkable.
 *
 * ── COST SHAPE ───────────────────────────────────────────────────────
 * Per mission: 3 searches × 100 = 300 units, then 1 unit per fifty
 * candidates triaged, then ~4 units per channel whose catalogue we pull.
 * Three missions therefore cost roughly 900 units of search plus a couple
 * of hundred of assessment — around a fifth of Scout's daily budget.
 *
 * The model is reached by a single-figure number of channels. That ratio,
 * not the discovery count, is what makes this affordable at ten times the
 * size.
 */

import {
  searchMusicVideos, fetchChannelsBatch, fetchRecentUploads,
  newMeter, QuotaExceeded, type QuotaMeter, type ChannelSummary,
} from '../youtube/discovery';
import { ACTIVE_MISSIONS, getMission, type MissionId } from './missions';
import { triage, testMission, Q } from './qualify';
import { buildProfile } from './analyse';
import { investigateChannel } from './investigate';
import {
  rosterChannelIds, listScoutChannelIds, recordObservation, setScoutStatus,
} from './channelStore';
import { newId } from '../knowledge/store';
import { ensureSeeded } from '../knowledge/principles';
import { costOf, type Finding, type CaseStudy } from '../knowledge/types';
import type { MissionResult, QualifiedChannel, Rejection, ScoutRun } from './types';

export interface ScoutOptions {
  /** Which missions to run. Defaults to the three active ones. */
  missions?: MissionId[];
  /** Channels per mission whose catalogue we pull. The assess-tier cap. */
  discoveryLimit?: number;
  /** Channels per mission that reach the model. The expensive cap. */
  investigationLimit?: number;
  /** Stop starting new investigations once this much wall clock has gone. */
  budgetMs?: number;
  /** Skip the model entirely — funnel only. For tuning without paying. */
  discoverOnly?: boolean;
}

/** One investigation is 15–45s; the platform kills the request at 60. */
const ASSUMED_INVESTIGATION_MS = 25_000;

export async function runScout(opts: ScoutOptions = {}): Promise<ScoutRun> {
  const {
    missions: missionIds = ACTIVE_MISSIONS.map(m => m.id),
    discoveryLimit = 12,
    investigationLimit = 3,
    budgetMs = 40_000,
    discoverOnly = false,
  } = opts;

  const runId = newId('scout');
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const notes: string[] = [];
  const meter: QuotaMeter = newMeter();

  await ensureSeeded();

  const rosterIds = await rosterChannelIds();
  const alreadyScouted = new Set(await listScoutChannelIds());
  notes.push(
    `Excluding ${rosterIds.size} roster channels and ${alreadyScouted.size} previously scouted channels.`,
  );

  const results: MissionResult[] = [];
  let modelCalls = 0;
  let totalTokens = 0;

  for (const missionId of missionIds) {
    const mission = getMission(missionId);
    if (!mission) continue;

    const result: MissionResult = {
      missionId,
      question: mission.question,
      queriesRun: [],
      queriesCached: 0,
      searchResults: 0,
      uniqueChannels: 0,
      rejected: [],
      qualified: [],
      investigated: 0,
      findings: [],
      caseStudies: [],
      nothingMaterial: [],
    };

    /* ── 1. DISCOVER ─────────────────────────────────────────────── */

    const seen = new Map<string, { title: string; source: string; videoId: string | null }>();
    try {
      for (const q of mission.queries) {
        const { hits, cached } = await searchMusicVideos(q, meter, {
          order: 'relevance',
          /* Recent uploads only. A campaign from 2019 is history, not
             practice, and the missions are about what is being done now. */
          publishedAfter: new Date(Date.now() - 270 * 86_400_000).toISOString(),
          videoDuration: 'medium',
        });
        result.queriesRun.push(q);
        if (cached) result.queriesCached++;
        result.searchResults += hits.length;
        for (const h of hits) {
          if (!seen.has(h.channelId)) {
            seen.set(h.channelId, { title: h.channelTitle, source: q, videoId: h.videoId });
          }
        }
      }
    } catch (e) {
      if (e instanceof QuotaExceeded) {
        notes.push(`Quota budget reached during ${missionId} discovery: ${e.message}`);
      } else throw e;
    }
    result.uniqueChannels = seen.size;

    /* ── 2. QUALIFY, tier 1 — batched, ~1 unit per fifty ─────────── */

    const ids = Array.from(seen.keys());
    let summaries: ChannelSummary[] = [];
    try {
      summaries = await fetchChannelsBatch(ids, meter);
    } catch (e) {
      if (e instanceof QuotaExceeded) notes.push(`Quota reached hydrating ${missionId} candidates.`);
      else throw e;
    }

    const survivors: ChannelSummary[] = [];
    for (const s of summaries) {
      const rej = triage(s, { rosterIds, alreadyScouted });
      if (rej) result.rejected.push(rej);
      else survivors.push(s);
    }

    /* Order the expensive tier by subscriber scale as a rough proxy for
       "has enough activity to read". Not a quality judgement — just a way
       of spending the assess budget on channels with something to see. */
    survivors.sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0));
    const toAssess = survivors.slice(0, discoveryLimit);
    if (survivors.length > toAssess.length) {
      notes.push(
        `${missionId}: ${survivors.length} channels passed triage, ${toAssess.length} assessed (discoveryLimit).`,
      );
    }

    /* ── 3. OBSERVE + QUALIFY, tier 2 — ~4 units each ────────────── */

    for (const s of toAssess) {
      if (!s.uploadsPlaylistId) continue;
      let videos;
      try {
        videos = await fetchRecentUploads(s.uploadsPlaylistId, meter, Q.uploadWindow);
      } catch (e) {
        if (e instanceof QuotaExceeded) { notes.push(`Quota reached assessing ${missionId}.`); break; }
        throw e;
      }
      if (!videos.length) continue;

      const profile = buildProfile(s.channelId, videos);
      const verdict = testMission(missionId, profile, s.title);

      if (!verdict.passed) {
        result.rejected.push({
          channelId: s.channelId,
          channelTitle: s.title,
          reason: verdict.reason ?? 'MISSION_TEST_FAILED',
          detail: verdict.detail ?? '',
        });
        continue;
      }

      const qc: QualifiedChannel = {
        channelId: s.channelId,
        title: s.title,
        handle: s.handle,
        country: s.country,
        subs: s.subs,
        totalViews: s.totalViews,
        videoCount: s.videoCount,
        missionId,
        discoverySource: seen.get(s.channelId)?.source ?? '',
        missionEvidence: verdict.evidence,
        score: verdict.score,
        profile,
      };
      result.qualified.push(qc);

      /* Into the Scout universe whether or not it is ever investigated —
         the observation record is what eventually earns "we have been
         watching this for three months". */
      await recordObservation({
        channelId: s.channelId,
        title: s.title,
        handle: s.handle,
        country: s.country,
        missionId,
        discoverySource: qc.discoverySource,
        whyWatching: verdict.evidence,
        profile,
        status: 'WATCHING',
      });
      alreadyScouted.add(s.channelId);
    }

    result.qualified.sort((a, b) => b.score - a.score);

    /* ── 4. INVESTIGATE — the only expensive stage ───────────────── */

    if (!discoverOnly) {
      const queue = result.qualified.slice(0, investigationLimit);
      for (const c of queue) {
        if (Date.now() - t0 + ASSUMED_INVESTIGATION_MS > budgetMs) {
          notes.push(`Time budget reached; ${queue.length - result.investigated} investigations not started.`);
          break;
        }
        const out = await investigateChannel(c, mission, runId);
        result.investigated++;
        if (out.kind === 'FINDING') {
          modelCalls++; totalTokens += out.tokens;
          result.findings.push(out.finding);
          if (out.caseStudy) {
            result.caseStudies.push(out.caseStudy);
            await setScoutStatus(c.channelId, out.caseStudy.status === 'STRONG_EXAMPLE' ? 'BEST_IN_CLASS' : 'INTERESTING');
          } else {
            await setScoutStatus(c.channelId, 'INTERESTING');
          }
        } else if (out.kind === 'NOTHING') {
          modelCalls++; totalTokens += out.tokens;
          result.nothingMaterial.push({ channelId: out.channelId, title: out.title, why: out.why });
        } else {
          if (out.suppressed.tokens > 0) { modelCalls++; totalTokens += out.suppressed.tokens; }
          result.nothingMaterial.push({
            channelId: out.suppressed.subjectId,
            title: out.suppressed.subjectName,
            why: `${out.suppressed.reason}: ${out.suppressed.detail}`,
          });
        }
      }
    }

    results.push(result);
  }

  const totalFindings = results.reduce((n, r) => n + r.findings.length, 0);
  if (!totalFindings && !discoverOnly) {
    notes.push('No material findings. Every channel investigated was doing something a strategist would already recognise.');
  }

  return {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    missions: results,
    cost: costOf(totalTokens, modelCalls, meter.spent, Date.now() - t0),
    notes,
  };
}

/** Flattened view for reporting. */
export function summarise(run: ScoutRun): {
  searchResults: number; uniqueChannels: number; rejected: number;
  qualified: number; investigated: number; findings: number;
  nothingMaterial: number; caseStudies: number;
} {
  const s = { searchResults: 0, uniqueChannels: 0, rejected: 0, qualified: 0, investigated: 0, findings: 0, nothingMaterial: 0, caseStudies: 0 };
  for (const m of run.missions) {
    s.searchResults += m.searchResults;
    s.uniqueChannels += m.uniqueChannels;
    s.rejected += m.rejected.length;
    s.qualified += m.qualified.length;
    s.investigated += m.investigated;
    s.findings += m.findings.length;
    s.nothingMaterial += m.nothingMaterial.length;
    s.caseStudies += m.caseStudies.length;
  }
  return s;
}

export type { Finding, CaseStudy };
