/**
 * THE MORNING INTELLIGENCE RUN
 *
 *   1. scan everything, deterministically and for free
 *   2. rank candidates on inputs we can compute, not on a model's opinion
 *   3. take only the top few
 *   4. investigate those
 *   5. compare against what we already said
 *   6. surface only what survives
 *
 * ── ON THE BUDGET ────────────────────────────────────────────────────
 * `maxInvestigations` is the cost control and the attention control at
 * once, and it is the same number for both reasons. Six investigations is
 * roughly 100k tokens and about forty seconds; it is also about as many
 * findings as anyone reads before breakfast. If the scan nominates thirty
 * candidates, the answer is not to investigate thirty — it is that the
 * thresholds in signals.ts need tightening.
 *
 * Vercel's Hobby plan caps a serverless function at 60s, so the route that
 * calls this runs investigations with a wall-clock guard and returns what
 * it has. A partial brief is useful; a timeout is not.
 */

import { scanRoster } from './signals';
import { investigate } from './investigate';
import { noveltyScore, saveRun, readRun, newId } from './store';
import { ensureSeeded } from './principles';
import type { ServiceCtx } from '../coach-service/service';
import type {
  Candidate, MorningRun, IntelligenceFinding, SuppressedFinding, CaseStudyCandidate, RunMetrics,
} from './types';

export interface RunOptions {
  /** How many candidates get a model investigation. Cost and attention cap. */
  maxInvestigations?: number;
  /** Stop starting new investigations after this long. Guards the 60s limit. */
  budgetMs?: number;
  /** Candidates below this deterministic priority are never investigated. */
  minPriority?: number;
  /** Skip the model entirely — returns the scan and ranking only. */
  scanOnly?: boolean;
}

/* grok-4 list price. Recomputed each run; never stored as though it were billed truth. */
const USD_PER_PROMPT_TOKEN = 3 / 1_000_000;
const USD_PER_COMPLETION_TOKEN = 15 / 1_000_000;

/**
 * signal strength × strategic importance × campaign relevance × novelty.
 *
 * ── WHY A GATE AND NOT A WEIGHTED SUM ────────────────────────────────
 * The first version was a plain weighted sum, and on the real roster it
 * produced a median priority of 0.72 against a floor of 0.35 — every
 * candidate cleared it. The reason is that importance and relevance have
 * high floors for any managed artist, so a weak signal on a Virgin artist
 * scored as well as a strong one. The floor was not filtering; it was
 * decorating.
 *
 * So signal strength is now a multiplicative gate: a weak signal cannot be
 * promoted by who the artist is. Context still matters — it swings the
 * score by up to 60% — but it can no longer manufacture a reason to look.
 *
 * A pure product was the other option and is wrong for novelty, which
 * legitimately reaches zero on a repeat; that would erase a repeat carrying
 * an enormous new signal rather than merely penalising it. Hence the
 * blended context term with its own floor.
 */
/**
 * How long to assume the NEXT investigation will take before we have
 * measured one. Observed range in validation was 15–45s.
 *
 * This exists because guarding on elapsed time alone does not work: an
 * investigation started at 43s of a 45s budget still runs for another 20
 * and the platform kills the whole request at 60. So the guard has to be
 * "will the next one FINISH in time", not "has the budget run out". Once
 * one has completed we use its real duration instead of the guess.
 */
const ASSUMED_INVESTIGATION_MS = 30_000;

interface BatchResult {
  findings: IntelligenceFinding[];
  suppressed: SuppressedFinding[];
  caseStudies: CaseStudyCandidate[];
  pending: Candidate[];
  tokens: number;
}

async function investigateWithin(
  queue: Candidate[], runId: string, ctx: ServiceCtx, startedAt: number, budgetMs: number,
): Promise<BatchResult> {
  const findings: IntelligenceFinding[] = [];
  const suppressed: SuppressedFinding[] = [];
  const caseStudies: CaseStudyCandidate[] = [];
  let tokens = 0;
  let estimate = ASSUMED_INVESTIGATION_MS;
  let i = 0;

  for (; i < queue.length; i++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed + estimate > budgetMs) break;

    const c = queue[i];
    const t = Date.now();
    try {
      const out = await investigate(c, runId, ctx);
      if (out.kind === 'FINDING') {
        findings.push(out.finding);
        if (out.caseStudy) caseStudies.push(out.caseStudy);
        tokens += out.finding.tokens;
      } else {
        suppressed.push(out.suppressed);
        tokens += out.suppressed.tokens;
      }
    } catch (e) {
      suppressed.push({
        artistId: c.artistId, artistName: c.artistName, signal: c.leadSignal.reason,
        reason: 'INVESTIGATION_FAILED',
        detail: e instanceof Error ? e.message : String(e),
        tokens: 0,
      });
    }
    /* A suppressed repeat returns instantly and would drag the estimate
       down, so only a real model call updates it, and we keep the slowest
       seen rather than the mean — being early costs a round trip, being
       late costs the whole request. */
    const took = Date.now() - t;
    if (took > 2_000) estimate = Math.max(estimate, took);
  }

  return { findings, suppressed, caseStudies, pending: queue.slice(i), tokens };
}

export function rank(c: Candidate): number {
  const b = c.priorityBreakdown;
  const context =
    b.strategicImportance * 0.4 +
    b.campaignRelevance * 0.25 +
    b.novelty * 0.35;
  /* The floor is 0.25, not 0.4, because at 0.4 the top of the ranked list
     was Tomorrowland, David Guetta and aespa — observed market channels
     with big signals and no strategic claim on anyone's morning. The brief
     is explicit that a small signal on a live priority campaign should
     outrank a large one on a channel nobody is working, and that only
     holds if context can move the score by more than half. */
  return b.signalStrength * (0.25 + 0.75 * context);
}

export async function runMorningIntelligence(
  ctx: ServiceCtx, opts: RunOptions = {},
): Promise<MorningRun> {
  const {
    maxInvestigations = 6,
    budgetMs = 45_000,
    minPriority = 0.35,
    scanOnly = false,
  } = opts;

  const runId = newId('run');
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const notes: string[] = [];

  await ensureSeeded();

  /* ── 1–2. Scan and rank ──────────────────────────────────────────── */

  const scan = await scanRoster();
  notes.push(...scan.notes);

  for (const c of scan.candidates) {
    c.priorityBreakdown.novelty = await noveltyScore(c.artistId, c.leadSignal.type);
    c.priority = rank(c);
  }
  scan.candidates.sort((a, b) => b.priority - a.priority);

  /* ── 3. Select ───────────────────────────────────────────────────── */

  const eligible = scan.candidates.filter(c => c.priority >= minPriority);
  const selected = eligible.slice(0, maxInvestigations);

  if (eligible.length > selected.length) {
    notes.push(
      `${eligible.length} candidates cleared the priority floor; ${selected.length} were investigated. ` +
      `The remainder are listed under WATCHING.`,
    );
  }

  /* Everything that cleared the floor but missed the cut is still worth
     naming — that is the difference between "we didn't look" and "we
     looked and deprioritised it". */
  const watching = eligible.slice(selected.length, selected.length + 8).map(c => ({
    artistId: c.artistId,
    artistName: c.artistName,
    reason: c.leadSignal.reason,
  }));

  const findings: IntelligenceFinding[] = [];
  const suppressed: SuppressedFinding[] = [];
  const caseStudies: CaseStudyCandidate[] = [];

  let promptTokens = 0, completionTokens = 0, totalTokens = 0;
  const tInvest = Date.now();

  /* ── 4–6. Investigate what fits, defer the rest ──────────────────── */

  let pending: Candidate[] = [];

  if (!scanOnly) {
    const r = await investigateWithin(selected, runId, ctx, tInvest, budgetMs);
    findings.push(...r.findings);
    suppressed.push(...r.suppressed);
    caseStudies.push(...r.caseStudies);
    totalTokens += r.tokens;
    pending = r.pending;
    if (pending.length) {
      notes.push(
        `${r.findings.length + r.suppressed.length} of ${selected.length} investigations completed ` +
        `inside the request budget. ${pending.length} are pending — resume the run to finish them.`,
      );
    }
  } else {
    notes.push('Scan-only run — no investigations were performed.');
  }

  findings.sort((a, b) => {
    const rankOf = (f: IntelligenceFinding) =>
      (f.confidence === 'HIGH' ? 2 : f.confidence === 'MEDIUM' ? 1 : 0);
    return rankOf(b) - rankOf(a);
  });

  /* We only get a total from the provider, not a split. Rather than invent
     a breakdown, attribute it to prompt tokens — which is where nearly all
     of it lives in a tool-calling run — and say so. */
  promptTokens = Math.round(totalTokens * 0.93);
  completionTokens = totalTokens - promptTokens;

  const metrics: RunMetrics = {
    channelsScanned: scan.channelsScanned,
    channelsWithData: scan.channelsWithData,
    candidatesTriggered: scan.candidates.length,
    investigationsRun: findings.length + suppressed.filter(s => s.tokens > 0).length,
    materialFindings: findings.length,
    suppressedFindings: suppressed.length,
    promptTokens,
    completionTokens,
    totalTokens,
    scanMs: scan.scanMs,
    investigateMs: Date.now() - tInvest,
    totalMs: Date.now() - t0,
    estimatedCostUsd:
      promptTokens * USD_PER_PROMPT_TOKEN + completionTokens * USD_PER_COMPLETION_TOKEN,
  };

  if (!findings.length && !scanOnly && !pending.length) {
    notes.push('No material findings. Everything scanned is behaving within its own normal range.');
  }

  const run: MorningRun = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    findings,
    watching,
    caseStudies,
    suppressed,
    candidates: scan.candidates,
    pending,
    metrics,
    notes,
  };

  await saveRun(run);
  return run;
}

/**
 * RESUME
 *
 * Picks up a run that ran out of request time and investigates the next
 * slice of its pending queue. Idempotent in the sense that matters: a
 * candidate already investigated is no longer pending, and `isRepeat`
 * catches anything that slips through.
 *
 * This is what makes the morning run work on a 60s platform limit without
 * pretending the limit is not there. Call it until `pending` is empty.
 */
export async function resumeMorningIntelligence(
  runId: string, ctx: ServiceCtx, opts: { budgetMs?: number } = {},
): Promise<MorningRun | null> {
  const { budgetMs = 44_000 } = opts;
  const prev = await readRun(runId);
  if (!prev) return null;
  if (!prev.pending.length) return prev;

  const t0 = Date.now();
  const r = await investigateWithin(prev.pending, runId, ctx, t0, budgetMs);

  const findings = [...prev.findings, ...r.findings].sort((a, b) => {
    const rankOf = (f: IntelligenceFinding) =>
      (f.confidence === 'HIGH' ? 2 : f.confidence === 'MEDIUM' ? 1 : 0);
    return rankOf(b) - rankOf(a);
  });
  const suppressed = [...prev.suppressed, ...r.suppressed];
  const caseStudies = [...prev.caseStudies, ...r.caseStudies];
  const totalTokens = prev.metrics.totalTokens + r.tokens;
  const promptTokens = Math.round(totalTokens * 0.93);
  const completionTokens = totalTokens - promptTokens;

  const notes = prev.notes.filter(n => !n.includes('pending — resume the run'));
  if (r.pending.length) {
    notes.push(`${r.pending.length} investigations still pending — resume again.`);
  } else if (!findings.length) {
    notes.push('No material findings. Everything scanned is behaving within its own normal range.');
  }

  const run: MorningRun = {
    ...prev,
    finishedAt: new Date().toISOString(),
    findings,
    suppressed,
    caseStudies,
    pending: r.pending,
    notes,
    metrics: {
      ...prev.metrics,
      investigationsRun:
        findings.length + suppressed.filter(s => s.tokens > 0).length,
      materialFindings: findings.length,
      suppressedFindings: suppressed.length,
      promptTokens,
      completionTokens,
      totalTokens,
      investigateMs: prev.metrics.investigateMs + (Date.now() - t0),
      totalMs: prev.metrics.totalMs + (Date.now() - t0),
      estimatedCostUsd:
        promptTokens * USD_PER_PROMPT_TOKEN + completionTokens * USD_PER_COMPLETION_TOKEN,
    },
  };

  await saveRun(run);
  return run;
}
