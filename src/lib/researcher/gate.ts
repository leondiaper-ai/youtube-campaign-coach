/**
 * RESEARCHER — INSIGHT QUALITY GATE
 *
 * The brief's hardest requirement: do not surface generic AI observations.
 *
 * ── WHY THIS IS CODE AND NOT A PROMPT INSTRUCTION ─────────────────────
 * "Only produce non-obvious findings" in a system prompt is a suggestion.
 * Models comply with it right up until they have nothing to say, at which
 * point they produce something anyway, because producing output is what they
 * do. A quota with no floor becomes filler. So the structural half of the
 * gate is enforced here, deterministically, and a finding that fails it is
 * suppressed no matter how confident the model was.
 *
 * The gate is deliberately HYBRID:
 *   - Structural checks (numbers present, sample size, named artists, a real
 *     next test, no hollow phrasing) are computed from the finding object.
 *   - Judgement checks (is this genuinely non-obvious, would it change a
 *     decision) are self-scored by the model, then CAPPED by the structural
 *     result — a model cannot award itself points for evidence it did not
 *     supply.
 *
 * Failing is the normal case. A research run that suppresses most of what it
 * generated is working correctly, not malfunctioning.
 */

import type { Evidence, Finding, GateResult, GateScores } from './types';

/**
 * Phrases that mark a claim as advice-shaped rather than finding-shaped.
 * These are the exact register of the brief's rejected example ("Shorts are
 * performing well. Continue posting Shorts.") — imperatives with no subject
 * matter, and intensifiers doing the work that evidence should do.
 */
const HOLLOW_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\b(?:keep|continue|maintain)\s+(?:posting|uploading|doing|going)\b/i, why: 'generic "keep doing it" advice' },
  { re: /\bpost(?:ing)?\s+(?:more|consistently|regularly)\b/i, why: 'generic cadence advice' },
  { re: /\bengage\s+(?:with\s+)?(?:your|the)\s+audience\b/i, why: 'generic engagement advice' },
  { re: /\bis\s+performing\s+well\b/i, why: 'restates a metric as an insight' },
  { re: /\b(?:leverage|optimi[sz]e|maximi[sz]e|double down)\b/i, why: 'marketing filler verb' },
  { re: /\bbest\s+practice[s]?\b/i, why: 'appeals to best practice instead of evidence' },
  { re: /\bshould\s+(?:consider|focus\s+on|prioriti[sz]e)\b/i, why: 'vague recommendation' },
];

/** Sample-size floors. Below MIN_N a claim is an anecdote, not a finding. */
const MIN_N = 5;
const SOLID_N = 20;

export interface GateInput {
  claim: string;
  whyItMatters: string;
  evidence: Evidence;
  counterEvidence: string | null;
  nextTest: string;
  potentialAction: string | null;
  /** Model's own 0-2 scores for the two judgement dimensions. */
  selfNonObvious?: number;
  selfDecisionChanging?: number;
}

export function runGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  const { claim, evidence, counterEvidence, nextTest, potentialAction } = input;

  /* ── Structural: does the claim contain any quantity at all? ───────── */
  const hasNumber = /\d/.test(claim);
  if (!hasNumber) reasons.push('Claim contains no figure — a finding with no quantity is an opinion.');

  /* ── Structural: hollow phrasing ───────────────────────────────────── */
  const hollow = HOLLOW_PATTERNS.filter(p => p.re.test(claim) || p.re.test(input.whyItMatters));
  for (const h of hollow) reasons.push(`Rejected phrasing: ${h.why}.`);

  /* ── Structural: evidence completeness ─────────────────────────────── */
  const n = evidence.sampleSize ?? 0;
  if (n < MIN_N) reasons.push(`Sample size ${n} is below the floor of ${MIN_N}.`);
  if (!evidence.artists?.length) reasons.push('No artists named in evidence — the claim cannot be traced back.');
  if (!evidence.metrics?.length) reasons.push('No metrics named — the claim cannot be re-derived.');
  if (!evidence.basis?.trim()) reasons.push('Evidence basis is empty.');

  /* ── Structural: is it testable? ───────────────────────────────────── */
  if (!nextTest?.trim() || nextTest.trim().length < 15) {
    reasons.push('No usable next test — an untestable finding cannot be strengthened or killed.');
  }

  /* ── Scoring ───────────────────────────────────────────────────────── */

  // Supported: sample size and caveat honesty.
  let supported = 0;
  if (n >= MIN_N) supported = 1;
  if (n >= SOLID_N && evidence.caveats?.length) supported = 2;

  // Specific: names artists, and reads as artist/cohort-particular.
  let specific = 0;
  if (evidence.artists?.length) specific = 1;
  if (evidence.artists?.length >= 3 && hasNumber) specific = 2;

  // Measurable: a real next test.
  const measurable = !nextTest?.trim() ? 0 : nextTest.trim().length >= 40 ? 2 : 1;

  // Actionable: a concrete potential action.
  const actionable = !potentialAction?.trim() ? 0 : potentialAction.trim().length >= 40 ? 2 : 1;

  /**
   * Judgement dimensions come from the model but are CAPPED by structure.
   * A finding with no figures and no named artists cannot be "non-obvious"
   * or "decision-changing" however the model scored itself — those are the
   * two dimensions most vulnerable to a model talking itself up.
   */
  const cap = hasNumber && evidence.artists?.length ? 2 : 0;
  const nonObvious = Math.min(cap, clamp02(input.selfNonObvious));
  const decisionChanging = Math.min(cap, clamp02(input.selfDecisionChanging));

  // Hollow phrasing zeroes the judgement dimensions outright.
  const hollowPenalty = hollow.length > 0;
  const scores: GateScores = {
    nonObvious: hollowPenalty ? 0 : nonObvious,
    specific,
    supported,
    actionable,
    measurable,
    decisionChanging: hollowPenalty ? 0 : decisionChanging,
  };

  const score =
    scores.nonObvious + scores.specific + scores.supported +
    scores.actionable + scores.measurable + scores.decisionChanging;

  /**
   * Counter-evidence is not required to pass — sometimes there genuinely
   * isn't any — but a finding that never looked for it is flagged, because
   * the brief explicitly asks the system not to reward confirmation bias.
   */
  if (!counterEvidence?.trim()) {
    reasons.push('NOTE: no counter-evidence recorded. Confirm the opposite case was searched for.');
  }

  /**
   * Pass condition. Hard structural failures block regardless of score;
   * the score threshold then filters the merely mediocre. `reasons` that
   * are NOTE-prefixed are advisory and do not block.
   */
  const blocking = reasons.filter(r => !r.startsWith('NOTE:'));
  const passed = blocking.length === 0 && score >= 7;

  if (!passed && blocking.length === 0) {
    reasons.push(`Score ${score}/12 is below the threshold of 7.`);
  }

  return { passed, score, scores, reasons };
}

function clamp02(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(2, Math.round(v)));
}

/** Convenience for filtering a batch and reporting how many were dropped. */
export function applyGate(findings: Finding[]): { kept: Finding[]; suppressed: Finding[] } {
  const kept: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const f of findings) (f.gate.passed ? kept : suppressed).push(f);
  return { kept, suppressed };
}
