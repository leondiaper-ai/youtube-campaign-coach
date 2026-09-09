/**
 * RESEARCHER — PERSISTENCE
 *
 * The knowledge lives here, in our system, not inside a model conversation.
 * That is the whole point of the architecture: the model is replaceable, the
 * accumulated learning is not.
 *
 * Follows the existing Watcher storage convention (private kv() helper,
 * silent no-op when unconfigured) rather than introducing a shared client —
 * the brief says not to rewrite working systems for architectural purity,
 * and every other store in this repo does it this way.
 *
 * KNOWN HAZARD, inherited: every array key is read-modify-write on a whole
 * JSON blob, so concurrent writers can lose data. Acceptable here because
 * findings are written by one human-triggered run at a time and volumes are
 * small. It would NOT be acceptable for the per-video capture described in
 * the V1 notes — that needs per-key writes.
 */

import { Redis } from '@upstash/redis';
import type { CatalogueRecon, Finding, Hypothesis, HumanFeedback } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_FINDINGS = 'research:findings';
const K_HYPOTHESES = 'research:hypotheses';
const K_RUNS = 'research:runs';
const K_RECON = (slug: string) => `research:recon:${slug}`;

const MAX_FINDINGS = 500;
const MAX_HYPOTHESES = 200;
const MAX_RUNS = 100;

/**
 * Reconstruction is expensive (a full-catalogue fetch per artist, and the
 * YouTube API quota is shared with the cron). Cached for 12h — catalogues
 * do not change fast enough for that to matter, and a research session
 * should not burn quota re-fetching the same channel.
 */
const RECON_TTL_SEC = 12 * 60 * 60;

/* ── Findings ───────────────────────────────────────────────────────── */

export async function listFindings(): Promise<Finding[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Finding[]>(K_FINDINGS);
  return Array.isArray(raw) ? raw : [];
}

export async function saveFinding(f: Finding): Promise<void> {
  const store = await kv();
  if (!store) return;
  const all = await listFindings();
  const idx = all.findIndex(x => x.id === f.id);
  if (idx >= 0) all[idx] = f;
  else all.unshift(f);
  await store.set(K_FINDINGS, all.slice(0, MAX_FINDINGS));
}

export async function getFinding(id: string): Promise<Finding | null> {
  const all = await listFindings();
  return all.find(f => f.id === id) ?? null;
}

/**
 * Records a human decision on a finding.
 *
 * Deliberately does NOT mutate the claim into a rule or delete rejected
 * findings. A rejected finding with its reasoning attached is more useful
 * than a deleted one — it is the record of what the system got wrong and
 * why, which is the raw material for improving it.
 */
export async function recordFeedback(
  id: string,
  feedback: HumanFeedback,
): Promise<Finding | null> {
  const f = await getFinding(id);
  if (!f) return null;
  f.humanFeedback = feedback;
  f.updatedAt = new Date().toISOString();
  if (feedback.decision === 'approve') f.status = 'validated';
  if (feedback.decision === 'reject') f.status = 'contradicted';
  if (feedback.decision === 'modify' && feedback.modifiedClaim) {
    f.claim = feedback.modifiedClaim;
    f.status = 'emerging';
  }
  await saveFinding(f);

  /**
   * The correction becomes a HYPOTHESIS, never a rule. See the note on
   * HumanFeedback in types.ts — the reviewer may be right for a reason
   * that does not generalise.
   */
  if (feedback.candidateLearning) {
    await saveHypothesis({
      id: `hyp_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statement: feedback.candidateLearning,
      status: 'hypothesis',
      supportingFindingIds: [],
      contradictingFindingIds: [],
      falsifier: 'Not yet specified — derived from a single human correction, so it needs a test before it is treated as knowledge.',
      origin: 'human_feedback',
      notes: feedback.contextGap ? `Context gap: ${feedback.contextGap}` : undefined,
    });
  }
  return f;
}

/* ── Hypotheses ─────────────────────────────────────────────────────── */

export async function listHypotheses(): Promise<Hypothesis[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Hypothesis[]>(K_HYPOTHESES);
  return Array.isArray(raw) ? raw : [];
}

export async function saveHypothesis(h: Hypothesis): Promise<void> {
  const store = await kv();
  if (!store) return;
  const all = await listHypotheses();
  const idx = all.findIndex(x => x.id === h.id);
  if (idx >= 0) all[idx] = h;
  else all.unshift(h);
  await store.set(K_HYPOTHESES, all.slice(0, MAX_HYPOTHESES));
}

/* ── Reconstruction cache ───────────────────────────────────────────── */

export async function readRecon(slug: string): Promise<CatalogueRecon | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<CatalogueRecon>(K_RECON(slug))) ?? null;
}

export async function writeRecon(recon: CatalogueRecon): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(K_RECON(recon.artistSlug), recon, { ex: RECON_TTL_SEC });
}

/* ── Run log ────────────────────────────────────────────────────────── */

export interface ResearchRun {
  id: string;
  at: string;
  question: string;
  scope: string;
  toolCalls: { tool: string; ms: number; ok: boolean }[];
  findingIds: string[];
  suppressed: number;
  provider: string;
  model: string;
  error?: string;
}

export async function logRun(run: ResearchRun): Promise<void> {
  const store = await kv();
  if (!store) return;
  const raw = await store.get<ResearchRun[]>(K_RUNS);
  const all = Array.isArray(raw) ? raw : [];
  all.unshift(run);
  await store.set(K_RUNS, all.slice(0, MAX_RUNS));
}

export async function listRuns(): Promise<ResearchRun[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<ResearchRun[]>(K_RUNS);
  return Array.isArray(raw) ? raw : [];
}
