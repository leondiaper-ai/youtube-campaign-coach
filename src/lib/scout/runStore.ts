/**
 * SCOUT RUN HISTORY
 *
 * Runs were not persisted until the Assistant home needed to answer "what
 * has Scout actually been doing" — a question you cannot answer from
 * findings alone, because the honest answer is usually "it looked at three
 * hundred channels and kept two".
 *
 * Only a summary is stored. A full ScoutRun carries every rejection with
 * its reason and every qualified channel's profile, which is exactly what
 * you want while tuning and far too much to keep for thirty runs.
 */

import { Redis } from '@upstash/redis';
import type { ScoutRun } from './types';
import type { MissionId } from './missions';
import type { CostMetrics } from '../knowledge/types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K = 'scout:runs';
const MAX_RUNS = 40;

export interface ScoutRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  missions: {
    missionId: MissionId;
    searchResults: number;
    uniqueChannels: number;
    rejected: number;
    qualified: number;
    investigated: number;
    findings: number;
    caseStudies: number;
    nothingMaterial: number;
  }[];
  cost: CostMetrics;
  /** Whether the model stage ran at all. A discovery-only run is not a failure. */
  investigationsAttempted: boolean;
}

export function summariseRun(run: ScoutRun): ScoutRunSummary {
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    missions: run.missions.map(m => ({
      missionId: m.missionId,
      searchResults: m.searchResults,
      uniqueChannels: m.uniqueChannels,
      rejected: m.rejected.length,
      qualified: m.qualified.length,
      investigated: m.investigated,
      findings: m.findings.length,
      caseStudies: m.caseStudies.length,
      nothingMaterial: m.nothingMaterial.length,
    })),
    cost: run.cost,
    investigationsAttempted: run.missions.some(m => m.investigated > 0),
  };
}

export async function saveRunSummary(run: ScoutRun): Promise<void> {
  const store = await kv();
  if (!store) return;
  const all = (await store.get<ScoutRunSummary[]>(K)) ?? [];
  await store.set(K, [summariseRun(run), ...all].slice(0, MAX_RUNS));
}

export async function listRunSummaries(limit = 20): Promise<ScoutRunSummary[]> {
  const store = await kv();
  if (!store) return [];
  const all = await store.get<ScoutRunSummary[]>(K);
  return (Array.isArray(all) ? all : []).slice(0, limit);
}

/**
 * Totals over a rolling window. This is what makes the invisible work
 * visible — "312 channels discovered, 46 qualified, 9 investigated, 2
 * retained" — and it is deliberately reported as a funnel rather than as a
 * headline number, because a large discovery count on its own is not an
 * achievement.
 */
export async function scoutActivity(days = 7): Promise<{
  runs: number;
  discovered: number;
  qualified: number;
  investigated: number;
  retained: number;
  quotaUnits: number;
  tokens: number;
  lastRunAt: string | null;
}> {
  const cutoff = Date.now() - days * 86_400_000;
  const runs = (await listRunSummaries(40)).filter(
    r => new Date(r.startedAt).getTime() >= cutoff,
  );

  const totals = {
    runs: runs.length,
    discovered: 0, qualified: 0, investigated: 0, retained: 0,
    quotaUnits: 0, tokens: 0,
    lastRunAt: runs[0]?.startedAt ?? null,
  };
  for (const r of runs) {
    totals.quotaUnits += r.cost.quotaUnits;
    totals.tokens += r.cost.totalTokens;
    for (const m of r.missions) {
      totals.discovered += m.uniqueChannels;
      totals.qualified += m.qualified;
      totals.investigated += m.investigated;
      totals.retained += m.findings;
    }
  }
  return totals;
}
