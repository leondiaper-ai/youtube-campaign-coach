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
import { checkArtistChannel } from './artistCheck';
import { buildProfile } from './analyse';
import { investigateChannel } from './investigate';
import {
  rosterChannelIds, listScoutChannelIds, listScoutChannels, recordObservation, setScoutStatus,
} from './channelStore';
import { newId } from '../knowledge/store';
import { saveRunSummary } from './runStore';
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
  /** Re-assess channels already in the Scout universe, refreshing profiles. */
  reobserve?: boolean;
}

/** Bounded parallelism — Promise.all over 50 channels would hammer the API. */
async function mapWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
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
    reobserve = false,
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
      const rej = triage(s, { rosterIds, alreadyScouted, reobserve });
      if (rej) {
        result.rejected.push(rej);
        /* Triage rejects on upload volume before any catalogue pull, which
           is where T-Series and Sony Music India are caught. The assess
           loop never sees them, so the demotion has to happen here too —
           otherwise a channel is rejected on every run and stays WATCHING
           on every run. */
        if (alreadyScouted.has(s.channelId) && rej.reason !== 'ALREADY_IN_SCOUT') {
          await setScoutStatus(s.channelId, 'REJECTED');
        }
      } else survivors.push(s);
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

    /* Catalogue pulls are independent, so they run three at a time. Done
       sequentially this stage alone took most of a 60s request; the limit
       is deliberately low because each pull is several round trips to
       YouTube and the quota ledger is a Redis read-modify-write. */
    const assessed = await mapWithConcurrency(toAssess, 3, async s => {
      if (!s.uploadsPlaylistId) return null;
      try {
        const videos = await fetchRecentUploads(s.uploadsPlaylistId, meter, Q.uploadWindow);
        return videos.length ? { s, videos } : null;
      } catch (e) {
        if (e instanceof QuotaExceeded) return null;
        throw e;
      }
    });

    for (const row of assessed) {
      if (!row) continue;
      const { s, videos } = row;

      /* Now that we hold real titles, settle whether this is an artist at
         all. Triage could only reject the obvious cases; this is where the
         label aggregators that reached the Watching list get caught. */
      const artist = checkArtistChannel(s, videos.map(v => v.title));
      if (artist.verdict === 'NON_ARTIST') {
        result.rejected.push({
          channelId: s.channelId, channelTitle: s.title,
          reason: 'NOT_AN_ARTIST_CHANNEL', detail: artist.reason,
        });
        /* Rejecting a channel we have already saved is not enough — the
           record stays WATCHING and keeps appearing on the Assistant page.
           This is how the five label channels survived their own rejection
           in the first re-observation pass. */
        if (alreadyScouted.has(s.channelId)) {
          await setScoutStatus(s.channelId, 'REJECTED');
        }
        continue;
      }

      const profile = buildProfile(s.channelId, videos);
      const verdict = testMission(missionId, profile, s.title);

      if (!verdict.passed) {
        result.rejected.push({
          channelId: s.channelId,
          channelTitle: s.title,
          reason: verdict.reason ?? 'MISSION_TEST_FAILED',
          detail: verdict.detail ?? '',
        });
        /* A channel that qualified under an older, looser test and fails
           the current one should stop being presented as worth watching.
           It drops to CANDIDATE rather than REJECTED — the channel may be
           fine, it is this mission's test it no longer meets. */
        if (alreadyScouted.has(s.channelId)) {
          await setScoutStatus(s.channelId, 'CANDIDATE');
        }
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
        score: verdict.score,
        profile,
        /* AMBIGUOUS stays a CANDIDATE. It remains in the universe and keeps
           accumulating observations, but it is not presented as something
           worth watching until a human or better evidence resolves it —
           which is precisely the step whose absence put five label channels
           on the Assistant page. */
        status: artist.verdict === 'ARTIST' ? 'WATCHING' : 'CANDIDATE',
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

  const run: ScoutRun = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    missions: results,
    cost: costOf(totalTokens, modelCalls, meter.spent, Date.now() - t0),
    notes,
  };

  /* A summary only — the full run carries every rejection and every
     qualified channel's profile, which is what you want while tuning and
     far too much to keep for forty runs. */
  await saveRunSummary(run);
  return run;
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

/**
 * INVESTIGATE WHAT WAS ALREADY FOUND
 *
 * Discovery and investigation do not fit in one 60s request: a single
 * mission's discovery takes about 20s and one investigation takes 15–45.
 * They do not need to. A qualified channel is persisted to the Scout
 * universe with its profile at the moment it qualifies, so investigation
 * can be a separate call over stored candidates — which is also what makes
 * it possible to re-investigate a channel months later against fresh
 * observations.
 */
export async function investigateStored(
  missionId: MissionId, opts: { limit?: number; budgetMs?: number } = {},
): Promise<{ findings: Finding[]; caseStudies: CaseStudy[]; nothing: { channelId: string; title: string; why: string }[]; modelCalls: number; tokens: number; latencyMs: number }> {
  const { limit = 2, budgetMs = 50_000 } = opts;
  const t0 = Date.now();
  const mission = getMission(missionId);
  const findings: Finding[] = [];
  const caseStudies: CaseStudy[] = [];
  const nothing: { channelId: string; title: string; why: string }[] = [];
  let modelCalls = 0, tokens = 0;
  if (!mission) return { findings, caseStudies, nothing, modelCalls, tokens, latencyMs: 0 };

  const universe = await listScoutChannels(500);
  /* Strongest first. Statuses INTERESTING and above have already been
     investigated; CANDIDATE is included because a transport failure must
     not bury a channel permanently — `isRepeat` stops genuine duplicates. */
  const candidates = universe
    .filter(c => c.missionIds.includes(missionId) && c.latestProfile
      && (c.status === 'WATCHING' || c.status === 'CANDIDATE'))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  for (const c of candidates) {
    if (Date.now() - t0 + ASSUMED_INVESTIGATION_MS > budgetMs) break;
    const qc: QualifiedChannel = {
      channelId: c.channelId, title: c.title, handle: c.handle, country: c.country,
      subs: null, totalViews: null, videoCount: null,
      missionId, discoverySource: c.discoverySource,
      missionEvidence: c.whyWatching, score: c.score ?? 0,
      profile: c.latestProfile!,
    };
    const out = await investigateChannel(qc, mission, `stored_${Date.now().toString(36)}`);
    if (out.kind === 'FINDING') {
      modelCalls++; tokens += out.tokens;
      findings.push(out.finding);
      if (out.caseStudy) caseStudies.push(out.caseStudy);
      await setScoutStatus(c.channelId, out.caseStudy?.status === 'STRONG_EXAMPLE' ? 'BEST_IN_CLASS' : 'INTERESTING');
    } else if (out.kind === 'NOTHING') {
      modelCalls++; tokens += out.tokens;
      nothing.push({ channelId: out.channelId, title: out.title, why: out.why });
      /* A considered "nothing here" is an answer — the channel stays in the
         universe and keeps accumulating observations, but drops out of the
         investigation queue. */
      await setScoutStatus(c.channelId, 'CANDIDATE');
    } else {
      if (out.suppressed.tokens > 0) { modelCalls++; tokens += out.suppressed.tokens; }
      nothing.push({ channelId: out.suppressed.subjectId, title: out.suppressed.subjectName, why: `${out.suppressed.reason}: ${out.suppressed.detail}` });
      /* Deliberately no status change. A suppression may be a transport
         failure, and demoting on those is how the first live run lost its
         two strongest candidates. */
    }
  }

  return { findings, caseStudies, nothing, modelCalls, tokens, latencyMs: Date.now() - t0 };
}
