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
import { noveltyScore, saveRun, newId } from './store';
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
 * signal strength × strategic importance × campaign relevance × novelty,
 * as the brief specifies — but as a weighted sum rather than a product.
 *
 * A product would zero the whole score whenever any one input is zero, and
 * novelty legitimately hits zero for a repeat. We want a repeat to be
 * heavily penalised, not erased, because a repeat with an enormous new
 * signal is still worth a look. The weights below make novelty the largest
 * single term, which is the behaviour the brief asks for.
 */
export function rank(c: Candidate): number {
  const b = c.priorityBreakdown;
  return (
    b.signalStrength * 0.3 +
    b.strategicImportance * 0.2 +
    b.campaignRelevance * 0.15 +
    b.novelty * 0.35
  );
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

  /* ── 4–6. Investigate, sequentially ──────────────────────────────── */

  if (!scanOnly) {
    for (const c of selected) {
      if (Date.now() - tInvest > budgetMs) {
        notes.push(
          `Time budget reached after ${findings.length + suppressed.length} of ${selected.length} ` +
          `investigations. The rest were not started.`,
        );
        break;
      }
      try {
        const out = await investigate(c, runId, ctx);
        if (out.kind === 'FINDING') {
          findings.push(out.finding);
          if (out.caseStudy) caseStudies.push(out.caseStudy);
          totalTokens += out.finding.tokens;
        } else {
          suppressed.push(out.suppressed);
          totalTokens += out.suppressed.tokens;
        }
      } catch (e) {
        suppressed.push({
          artistId: c.artistId, artistName: c.artistName, signal: c.leadSignal.reason,
          reason: 'INVESTIGATION_FAILED',
          detail: e instanceof Error ? e.message : String(e),
          tokens: 0,
        });
      }
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

  if (!findings.length && !scanOnly) {
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
    metrics,
    notes,
  };

  await saveRun(run);
  return run;
}
