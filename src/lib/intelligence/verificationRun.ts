/**
 * THE BOUNDED VERIFICATION RUN
 *
 * Every limit in the brief, enforced in code rather than in the prompt.
 *
 * ── WHY NOT JUST TELL THE MODEL ───────────────────────────────────────
 * Because a prompt is a request and a guard is a refusal. "Only verify
 * these four examples" is advice that holds until the model decides a fifth
 * is relevant, and the failure is silent: the fifth record appears in the
 * library looking exactly like the four that were asked for. Every limit
 * below is therefore a tool-layer refusal with a logged reason, and the
 * prompt merely explains rules the model could not break anyway.
 *
 * The limits:
 *   artist        CHVRCHES only. Any `artist` argument is overwritten, not
 *                 validated — the model cannot address another artist even
 *                 by accident.
 *   task          verification only. No discovery tool is in the registry.
 *   examples      four ids, fixed. Any other id is refused.
 *   writes        verify + update only. Every other write is absent.
 *   logging       every call, refusal included, persisted.
 *   cost          tokens, turns and YouTube quota, all recorded.
 *   fail closed   VERIFIED already requires a URL and an evidence item at
 *                 the tool layer; a run that cannot confirm a source
 *                 therefore cannot record one as confirmed.
 *
 * ── ONE EXAMPLE PER INVOCATION ────────────────────────────────────────
 * Vercel's Hobby plan kills a function at 60s. A tool-calling run over four
 * external channels will not finish in that, and the failure mode is the
 * worst kind — the model does the work, the API calls are paid for, and the
 * response is discarded. So the run is resumable: each call handles the
 * next unverified example and returns where it got to. Four calls, or one
 * call repeated until `done`.
 */

import { Redis } from '@upstash/redis';
import { runResearch, resolveProvider, modelEnabled, type ToolRegistry } from '../researcher/model';
import { callIntelTool, INTEL_SPECS } from './tools';
import { lookupExternalChannel, getExternalChannelUploads, newMeter, type QuotaMeter } from './externalLookup';
import { readLibrary, seedById } from './research';
import { USD_PER_PROMPT_TOKEN, USD_PER_COMPLETION_TOKEN } from '../knowledge/types';

/* ══ The configuration, fixed ════════════════════════════════════════ */

export const VERIFICATION_RUN = {
  runId: 'chvrches-verification-1',
  /** Overwritten into every artist-taking tool call. Not validated — set. */
  artist: 'chvrches',
  taskType: 'VERIFICATION_ONLY' as const,
  exampleIds: ['seed_aimyon', 'seed_wetleg', 'seed_magdalenabay', 'seed_dijon'],
  maxExamples: 4,
  /** Per example. MAX_TURNS in model.ts is 12; this is the quota ceiling. */
  maxQuotaUnitsPerExample: 400,
  /** Refuse to start another example past this, so a bad run cannot drain. */
  maxQuotaUnitsTotal: 1_600,
} as const;

/** Reads the model may make. Nothing here discovers, and nothing writes. */
export const ALLOWED_READS = new Set([
  'get_research_opportunities',
  'get_artist_needs',
  'get_deep_dive_context',
  'search_research_library',
  'get_relevant_research',
  'lookup_external_channel',
  'get_external_channel_uploads',
]);

/** The only two writes. add_research_candidate is deliberately absent. */
export const ALLOWED_WRITES = new Set([
  'verify_research_example',
  'update_research_example',
]);

/* ══ The audit log ═══════════════════════════════════════════════════ */

export interface AuditEntry {
  at: string;
  tool: string;
  /** Arguments, trimmed. Enough to re-run the call, not enough to bloat. */
  args: Record<string, unknown>;
  outcome: 'ok' | 'error' | 'REFUSED';
  /** Present on REFUSED. The rule that fired, in words. */
  refusedBecause?: string;
  ms: number;
  /** YouTube Data API units this call spent. */
  quotaUnits: number;
}

export interface ExampleOutcome {
  exampleId: string;
  subject: string;
  /** What the model recorded, read back from the store rather than trusted. */
  verification: string;
  status: string;
  boardEligible: boolean;
  boardBlockers: string[];
  sourceUrls: string[];
  evidenceCount: number;
}

export interface VerificationRunState {
  runId: string;
  startedAt: string;
  updatedAt: string;
  done: boolean;
  completed: string[];
  remaining: string[];
  audit: AuditEntry[];
  outcomes: ExampleOutcome[];
  cost: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    modelTurns: number;
    quotaUnits: number;
    estimatedCostUsd: number;
  };
  /** Model prose, one entry per example. Not evidence — a report. */
  reports: { exampleId: string; text: string }[];
  refusals: number;
}

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_RUN = (id: string) => `intel:vrun:${id}`;

export async function readRun(runId = VERIFICATION_RUN.runId): Promise<VerificationRunState | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<VerificationRunState>(K_RUN(runId))) ?? null;
}

async function writeRun(s: VerificationRunState): Promise<void> {
  const store = await kv();
  if (store) await store.set(K_RUN(s.runId), s);
}

function freshRun(): VerificationRunState {
  const now = new Date().toISOString();
  return {
    runId: VERIFICATION_RUN.runId,
    startedAt: now, updatedAt: now,
    done: false,
    completed: [],
    remaining: [...VERIFICATION_RUN.exampleIds],
    audit: [],
    outcomes: [],
    cost: { promptTokens: 0, completionTokens: 0, totalTokens: 0, modelTurns: 0, quotaUnits: 0, estimatedCostUsd: 0 },
    reports: [],
    refusals: 0,
  };
}

export async function resetRun(runId = VERIFICATION_RUN.runId): Promise<void> {
  const store = await kv();
  if (store) await store.del(K_RUN(runId));
}

/* ══ The guarded registry ════════════════════════════════════════════ */

/**
 * Argument trimming for the log. A full uploads response is 100 videos and
 * would make the audit log unreadable and expensive to store; the point of
 * the log is to answer "what did it ask for", which the arguments carry and
 * the response does not.
 */
function trimArgs(a: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a ?? {})) {
    out[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return out;
}

function buildRegistry(
  state: VerificationRunState,
  exampleId: string,
  meter: QuotaMeter,
  baseUrl: string,
): ToolRegistry {
  const specs: { name: string; description: string; args: Record<string, string> }[] = [
    ...INTEL_SPECS
      .filter(s => ALLOWED_READS.has(s.name) || ALLOWED_WRITES.has(s.name))
      .map(s => ({ name: s.name, description: s.description, args: s.args as Record<string, string> })),
    {
      name: 'lookup_external_channel',
      description:
        'Find a channel OUTSIDE our roster by name. Returns candidates with subscriber counts and the video that surfaced each one — the top result is often a label, topic or fan channel, so confirm you have the artist channel before treating anything on it as evidence. Costs 100 YouTube quota units per distinct query; results are cached for a week.',
      args: { query: 'string — artist or channel name' },
    },
    {
      name: 'get_external_channel_uploads',
      description:
        'Recent uploads for an external channel, with publish dates, durations, current lifetime views, and the liveStreamingDetails fields (wasLive, scheduledStart, actualStart) that are the only public evidence a video was a Premiere or a stream. Needs the uploadsPlaylistId from lookup_external_channel. About 4 quota units per 100 uploads.',
      args: { uploadsPlaylistId: 'string', limit: 'number, optional — default 100, max 200' },
    },
  ];

  const call = async (name: string, args: Record<string, any>): Promise<unknown> => {
    const t0 = Date.now();
    const before = meter.spent;

    const refuse = (why: string) => {
      state.refusals += 1;
      state.audit.push({
        at: new Date().toISOString(), tool: name, args: trimArgs(args),
        outcome: 'REFUSED', refusedBecause: why, ms: Date.now() - t0, quotaUnits: 0,
      });
      return { error: `REFUSED: ${why}`, runLimits: VERIFICATION_RUN };
    };

    /* ── The guards, in order of how badly they would fail ──────────── */

    if (!ALLOWED_READS.has(name) && !ALLOWED_WRITES.has(name)) {
      return refuse(
        `"${name}" is not available in a verification run. This run may only read context and `
        + 'verify or update the four named examples. Discovery and new-candidate writes are not enabled.',
      );
    }

    if (ALLOWED_WRITES.has(name)) {
      const id = String(args.id ?? '');
      if (!VERIFICATION_RUN.exampleIds.includes(id as any)) {
        return refuse(
          `This run may only write to ${VERIFICATION_RUN.exampleIds.join(', ')}. "${id}" is not one of them.`,
        );
      }
      if (id !== exampleId) {
        return refuse(
          `This invocation is verifying ${exampleId}. Write to ${id} in its own invocation — one example per run `
          + 'keeps the audit trail attributable and the function inside its time limit.',
        );
      }
    }

    /* The artist is set, not checked. A run scoped to CHVRCHES that quietly
       answers about another artist is worse than one that refuses. */
    if ('artist' in (args ?? {})) args.artist = VERIFICATION_RUN.artist;

    if (meter.spent >= VERIFICATION_RUN.maxQuotaUnitsPerExample
        && (name === 'lookup_external_channel' || name === 'get_external_channel_uploads')) {
      return refuse(
        `YouTube quota ceiling for this example reached (${VERIFICATION_RUN.maxQuotaUnitsPerExample} units). `
        + 'Record what you have as PARTIAL with the outstanding questions. Do not guess the rest.',
      );
    }

    try {
      let out: unknown;
      if (name === 'lookup_external_channel') {
        out = await lookupExternalChannel(String(args.query ?? ''), meter);
      } else if (name === 'get_external_channel_uploads') {
        out = await getExternalChannelUploads(
          String(args.uploadsPlaylistId ?? ''), meter, Number(args.limit ?? 100),
        );
      } else {
        out = await callIntelTool(name, args, { baseUrl });
      }
      state.audit.push({
        at: new Date().toISOString(), tool: name, args: trimArgs(args),
        outcome: 'ok', ms: Date.now() - t0, quotaUnits: meter.spent - before,
      });
      return out;
    } catch (e) {
      state.audit.push({
        at: new Date().toISOString(), tool: name, args: trimArgs(args),
        outcome: 'error', refusedBecause: String((e as Error).message),
        ms: Date.now() - t0, quotaUnits: meter.spent - before,
      });
      /* Errors go back to the model rather than killing the run — a failed
         lookup should produce a PARTIAL verification, not an exception. */
      return { error: String((e as Error).message) };
    }
  };

  return { specs, call };
}

/* ══ The prompt ══════════════════════════════════════════════════════ */

const SYSTEM = `
You are verifying ONE research example against the public YouTube record. You are
not researching, not discovering, and not looking for anything else.

FAIL CLOSED. If you cannot find the channel, cannot find the uploads, or cannot
confirm the dates, the answer is PARTIAL or DISPUTED. It is never VERIFIED. A
verification you could not complete is a useful result; a VERIFIED label on
something you inferred is a lie the system will repeat for months.

DO NOT PROTECT THE ORIGINAL CLAIM. The seeded description was written from a
human recollection with no evidence attached. If what the channel actually shows
is smaller, different, or older than claimed, say so and correct the mechanic
description. Downgrading an example is a successful outcome.

WHAT YOU MUST ESTABLISH
  1. the channel exists and is the ARTIST channel, not a label, topic or fan one
  2. the claimed behaviour is visible in the uploads
  3. the dates, and the ORDER of the uploads
  4. at least one source URL per claim you record
  5. whether the Premiere/live claim is supported by wasLive/scheduledStart

THEN JUDGE, SEPARATELY
  mechanicValue      0-3  is the tactic worth knowing?
  culturalRelevance  0-3  would a team find this artist credible? taste, not size
  visualBoardValue   0-3  is there anything distinctive to LOOK at?
  freshness               when the behaviour happened, via observedAt

A high mechanic score with a low cultural or visual score is a correct and
common outcome. Do not inflate a score to get something onto a board.

FORBIDDEN
  - inferring any YouTube Studio metric: retention, traffic sources, impressions,
    CTR, unique or returning viewers, subscriber attribution. You cannot see them
    and neither can we.
  - describing a lifetime view total as growth or velocity, or dividing it by age
  - recording a source URL you did not retrieve from a tool
  - treating an upload date as a song release date

FINISH by calling verify_research_example with your outcome, then reply with a
SHORT report: what you confirmed, what you corrected, your four judgements, and
anything still outstanding.
`.trim();

/* ══ The run ═════════════════════════════════════════════════════════ */

export interface StepResult {
  ok: boolean;
  message: string;
  state: VerificationRunState | null;
  /** The next example, so a caller knows whether to call again. */
  next: string | null;
}

export async function stepVerificationRun(baseUrl: string): Promise<StepResult> {
  if (!modelEnabled()) {
    return {
      ok: false, state: await readRun(), next: null,
      message: 'MODEL_ENABLED is not set to 1, so no model call will be made. Set it in Vercel and redeploy.',
    };
  }
  const cfg = resolveProvider();
  if (!cfg) {
    return { ok: false, state: await readRun(), next: null, message: 'No model provider resolved. Check XAI_API_KEY.' };
  }

  const state = (await readRun()) ?? freshRun();
  if (state.done || !state.remaining.length) {
    state.done = true;
    await writeRun(state);
    return { ok: true, state, next: null, message: 'Run already complete.' };
  }

  if (state.cost.quotaUnits >= VERIFICATION_RUN.maxQuotaUnitsTotal) {
    state.done = true;
    await writeRun(state);
    return {
      ok: false, state, next: null,
      message: `Total YouTube quota ceiling (${VERIFICATION_RUN.maxQuotaUnitsTotal}) reached. Run halted with `
        + `${state.remaining.length} example(s) unverified rather than spending further.`,
    };
  }

  const exampleId = state.remaining[0];
  const seed = seedById(exampleId);
  const library = await readLibrary();
  const record = library.find(c => c.id === exampleId);
  if (!record) {
    state.remaining = state.remaining.slice(1);
    await writeRun(state);
    return { ok: false, state, next: state.remaining[0] ?? null, message: `Example ${exampleId} not found; skipped.` };
  }

  const meter = newMeter();
  const registry = buildRegistry(state, exampleId, meter, baseUrl);

  const user = [
    `Verify exactly one research example: ${exampleId} — ${record.subject}.`,
    '',
    `CLAIMED MECHANIC: ${record.mechanic ?? '(none recorded)'}`,
    `CLAIMED BEHAVIOUR: ${record.behaviourObserved}`,
    `TAGGED AS PROOF FOR: ${(record.usefulFor ?? []).join(', ') || '(untagged)'}`,
    '',
    'OUTSTANDING QUESTIONS recorded when this was seeded:',
    ...(seed?.needsVerification ?? ['(none recorded)']).map(q => `  - ${q}`),
    '',
    'Context you may read first, if useful: get_research_opportunities and',
    'get_deep_dive_context for CHVRCHES, to understand which need this is proof for.',
    '',
    `Finish by calling verify_research_example with id "${exampleId}".`,
  ].join('\n');

  let text = '';
  let failure: string | null = null;
  try {
    const r = await runResearch(SYSTEM, user, { baseUrl }, cfg, registry);
    text = r.text;
    state.cost.promptTokens += r.usage.promptTokens;
    state.cost.completionTokens += r.usage.completionTokens;
    state.cost.totalTokens += r.usage.totalTokens;
    state.cost.modelTurns += r.usage.turns;
  } catch (e) {
    failure = String((e as Error).message);
  }

  state.cost.quotaUnits += meter.spent;
  state.cost.estimatedCostUsd =
    state.cost.promptTokens * USD_PER_PROMPT_TOKEN
    + state.cost.completionTokens * USD_PER_COMPLETION_TOKEN;

  /* The outcome is read back from the store, never taken from the model's
     prose. What it says it did and what it did are different facts. */
  const after = (await readLibrary()).find(c => c.id === exampleId);
  if (after) {
    const { boardStatus, verificationOf } = await import('./research');
    const board = boardStatus(after);
    state.outcomes.push({
      exampleId,
      subject: after.subject,
      verification: verificationOf(after),
      status: after.status,
      boardEligible: board.eligible,
      boardBlockers: board.blockers,
      sourceUrls: after.sourceUrls ?? [],
      evidenceCount: after.evidence.length,
    });
  }

  state.reports.push({ exampleId, text: failure ? `RUN FAILED: ${failure}` : text });
  state.completed.push(exampleId);
  state.remaining = state.remaining.slice(1);
  state.done = state.remaining.length === 0;
  state.updatedAt = new Date().toISOString();
  await writeRun(state);

  return {
    ok: !failure,
    state,
    next: state.remaining[0] ?? null,
    message: failure
      ? `${exampleId} failed: ${failure}`
      : `${exampleId} done. ${state.remaining.length} remaining.`,
  };
}
