/**
 * RESEARCH RUNS — the record of Grok having looked
 *
 * Until now the end of a research loop ("what I looked at, what I rejected,
 * which needs still have no proof") went into a chat window and nowhere
 * else. So the Ideas tab could say "no research attached" but never
 * "checked on Friday, nothing new" — and those are different answers.
 *
 * A run is a small, append-only record. It changes no example, no progress
 * state and no plan. Its two jobs:
 *
 *   1. Let the next run start cheaply: read the last run, compare the
 *      campaign state it saw with the state now, and stop if nothing moved.
 *   2. Give each rollout item a lastResearchedAt, so an empty research block
 *      can say when somebody last looked.
 *
 * NO_CHANGE runs are kept on purpose. A routine that ran and decided not to
 * dig is doing its job, and the record of that decision is what stops the
 * next run repeating it.
 */

import { Redis } from '@upstash/redis';

export type RunOutcome = 'NO_CHANGE' | 'RESEARCHED';
export type ConsideredDecision = 'SAVED' | 'VERIFIED' | 'WATCHLISTED' | 'REJECTED' | 'DUPLICATE';

export interface ConsideredExample {
  subject: string;
  decision: ConsideredDecision;
  /** Required for REJECTED and DUPLICATE — the reasoning is the useful part. */
  why: string;
  /** The library id when SAVED / VERIFIED / WATCHLISTED / DUPLICATE. */
  exampleId: string | null;
  sourceUrl: string | null;
}

export interface ResearchRun {
  id: string;
  artistSlug: string;
  /** Server clock. The model does not supply this. */
  ranAt: string;
  outcome: RunOutcome;
  /** For NO_CHANGE: why nothing was done. For RESEARCHED: one line on what was done. */
  reason: string;
  /** The question researched (or the question that was current when it stopped). */
  question: string;
  /** The rollout item the question belongs to, when known. */
  rolloutItemId: string | null;
  /** A fingerprint of the campaign state this run saw, for the next run to compare. */
  stateSeen: { campaignState: string | null; currentQuestion: string | null; spine: string[] };
  considered: ConsideredExample[];
  /** Library ids that gained evidence, verification or scores in this run. */
  evidenceAdded: string[];
  /** Need tags or plain-language gaps still without proof afterwards. */
  remainingGaps: string[];
  producedBy: string;
}

/* ══ Store ═══════════════════════════════════════════════════════════ */

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_RUNS = (slug: string) => `intel:research-runs:${slug}`;
const MAX_RUNS = 60;

export async function listResearchRuns(slug: string, limit = 20): Promise<ResearchRun[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<ResearchRun[]>(K_RUNS(slug));
  return (Array.isArray(raw) ? raw : []).slice(0, limit);
}

export async function lastResearchRun(slug: string): Promise<ResearchRun | null> {
  return (await listResearchRuns(slug, 1))[0] ?? null;
}

/* ══ Validation ══════════════════════════════════════════════════════
   Pure, so the boundary suite can exercise it without Redis. Returns the
   record to store or the reason it was refused. */

export type RunInput = {
  artistSlug: string;
  outcome: unknown;
  reason: unknown;
  question: unknown;
  rolloutItemId?: unknown;
  stateSeen?: unknown;
  considered?: unknown;
  evidenceAdded?: unknown;
  remainingGaps?: unknown;
  producedBy: unknown;
};

const DECISIONS: ConsideredDecision[] = ['SAVED', 'VERIFIED', 'WATCHLISTED', 'REJECTED', 'DUPLICATE'];

export function validateRun(input: RunInput, now = new Date().toISOString()):
  { ok: true; run: ResearchRun } | { ok: false; error: string } {
  const outcome = String(input.outcome ?? '');
  if (outcome !== 'NO_CHANGE' && outcome !== 'RESEARCHED') {
    return { ok: false, error: 'outcome must be NO_CHANGE or RESEARCHED' };
  }
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 12) {
    return { ok: false, error: 'reason is required and must say something — "no change" alone is not a reason, say what was compared' };
  }
  const question = String(input.question ?? '').trim();
  if (!question) return { ok: false, error: 'question is required — the question that was current when this run happened' };
  const producedBy = String(input.producedBy ?? '').trim();
  if (!producedBy) return { ok: false, error: 'producedBy is required' };

  const consideredRaw = Array.isArray(input.considered) ? input.considered : [];
  const considered: ConsideredExample[] = [];
  for (const c of consideredRaw) {
    const subject = String(c?.subject ?? '').trim();
    const decision = String(c?.decision ?? '') as ConsideredDecision;
    const why = String(c?.why ?? '').trim();
    if (!subject) return { ok: false, error: 'every considered example needs a subject' };
    if (!DECISIONS.includes(decision)) {
      return { ok: false, error: `considered[].decision must be one of ${DECISIONS.join(', ')} (got "${decision}" for ${subject})` };
    }
    if ((decision === 'REJECTED' || decision === 'DUPLICATE') && why.length < 12) {
      return { ok: false, error: `"${subject}" was ${decision} without a real reason. The reason is the record — say what was weak, irrelevant or already held.` };
    }
    considered.push({
      subject, decision, why,
      exampleId: c?.exampleId ? String(c.exampleId) : null,
      sourceUrl: c?.sourceUrl ? String(c.sourceUrl) : null,
    });
  }

  if (outcome === 'RESEARCHED' && !considered.length) {
    return { ok: false, error: 'a RESEARCHED run with nothing considered is a NO_CHANGE run. Record what was looked at, including what was rejected.' };
  }

  const evidenceAdded = (Array.isArray(input.evidenceAdded) ? input.evidenceAdded : []).map(String).filter(Boolean);
  const remainingGaps = (Array.isArray(input.remainingGaps) ? input.remainingGaps : []).map(String).filter(Boolean);
  const ss: any = input.stateSeen ?? {};

  return {
    ok: true,
    run: {
      id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      artistSlug: input.artistSlug,
      ranAt: now,
      outcome,
      reason,
      question,
      rolloutItemId: input.rolloutItemId ? String(input.rolloutItemId) : null,
      stateSeen: {
        campaignState: ss.campaignState ? String(ss.campaignState) : null,
        currentQuestion: ss.currentQuestion ? String(ss.currentQuestion) : null,
        spine: Array.isArray(ss.spine) ? ss.spine.map(String) : [],
      },
      considered,
      evidenceAdded,
      remainingGaps,
      producedBy,
    },
  };
}

export async function saveResearchRun(run: ResearchRun): Promise<{ stored: boolean }> {
  const store = await kv();
  if (!store) return { stored: false };
  const existing = await listResearchRuns(run.artistSlug, MAX_RUNS);
  await store.set(K_RUNS(run.artistSlug), [run, ...existing].slice(0, MAX_RUNS));
  return { stored: true };
}

/** When each rollout item was last researched, from the run log. Pure. */
export function lastResearchedByItem(runs: ResearchRun[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of runs) {
    /* Newest first in storage, but do not rely on it. */
    const keys = [r.rolloutItemId, `q:${r.question}`].filter(Boolean) as string[];
    for (const k of keys) {
      const cur = out.get(k);
      if (!cur || r.ranAt > cur) out.set(k, r.ranAt);
    }
  }
  return out;
}
