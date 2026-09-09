/**
 * THE INVESTIGATION STAGE
 *
 * Takes one candidate the deterministic scan nominated and asks whether
 * there is anything here a strategist would actually want to know.
 *
 * ── WHY THIS GOES THROUGH askCoach RATHER THAN THE MODEL DIRECTLY ─────
 * The Coach service already owns the provider config, the tool registry,
 * the session cache, evidence provenance, the leak filter and token
 * accounting. A second path to the model would be a second place for all
 * of those to drift. So this file contributes a question and a parser, and
 * nothing else.
 *
 * ── THE FILTER IS THE PRODUCT ─────────────────────────────────────────
 * `NOTHING_MATERIAL` is the expected answer. The instruction below says so
 * in those words, repeatedly, because a model that believes it is being
 * graded on output volume will always find something — and the resulting
 * assistant is a notification machine that gets muted in a fortnight.
 */

import { askCoach, type ServiceCtx } from '../coach-service/service';
import type { EvidenceItem, CoachConfidence } from '../coach-service/types';
import { listPrinciples, principlesForSignal } from './principles';
import { isRepeat, newId, saveFinding, saveCaseStudy } from './store';
import type {
  Candidate, IntelligenceFinding, SuppressedFinding, CaseStudyCandidate, Novelty,
} from './types';

/* ── The instruction ─────────────────────────────────────────────────── */

const OUTPUT_CONTRACT = `
Answer as a JSON object and nothing else. No prose before or after it, no code fence.

If there is nothing a strategist would act on or remember, return exactly:
{"verdict":"NOTHING_MATERIAL","why":"<one sentence saying what you checked and why it was unremarkable>"}

Otherwise return:
{
  "verdict":"MATERIAL_FINDING",
  "headline":"<one sentence, the finding itself, containing the specific figure or asset>",
  "finding":"<two or three sentences: what you found and how you established it>",
  "whyItMatters":"<why this changes what the strategist should think or do>",
  "action":"<a specific next step, or 'No action — worth knowing'>",
  "novelty":"NOVEL" | "ALREADY_VISIBLE",
  "confidence":"LOW" | "MEDIUM" | "HIGH",
  "caseStudy": null | {
    "title":"<short>",
    "behaviourObserved":"<what the artist actually did, observable only>",
    "whyInteresting":"<why it is worth showing someone>",
    "potentialLearning":"<the transferable lesson>",
    "applicableTo":["<tag>","<tag>"],
    "evidenceClass":"OBSERVED" | "INFERRED"
  }
}`.trim();

const STANDARD = `
Hold yourself to this standard before returning MATERIAL_FINDING:

1. Would a good strategist, given five minutes with the same Watcher data,
   already know this? If yes, it is ALREADY_VISIBLE — say so and expect it
   to be suppressed. Restating the trigger back to me is not a finding.
2. Does it rest on something you actually measured with a tool, or on a
   plausible story? Only the former counts. Name the tool and the figure.
3. Would it change a decision? "Views are up" changes nothing. "Views are
   up and it is the catalogue, not the new single" changes something.
4. Compare the artist against THEMSELVES. All view counts are lifetime
   totals, so cross-artist comparison is only valid within matched asset
   ages. Never divide lifetime views by age.
5. Claim nothing about retention, traffic sources, impressions, CTR,
   browse/suggested, unique viewers, subscriber attribution or
   Shorts-to-long-form conversion. That data does not exist here.
6. Do not stop at the first metric that explains the trigger. Check whether
   something else explains it better.

NOTHING_MATERIAL is a successful outcome and most investigations should
reach it. You are not being graded on how much you find.`.trim();

/* ── JSON extraction ─────────────────────────────────────────────────── */

/**
 * Brace-depth walk rather than a regex: the payload contains a nested
 * `caseStudy` object and any non-greedy regex would stop at its closing
 * brace. Same approach the Coach service uses, for the same reason.
 */
function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/* ── The question ────────────────────────────────────────────────────── */

async function buildQuestion(c: Candidate): Promise<string> {
  const principles = principlesForSignal(await listPrinciples(), c.leadSignal.type);
  const questions = principles.flatMap(p => p.researchQuestions).slice(0, 2);

  const otherSignals = c.signals
    .slice(1)
    .map(s => `- ${s.reason}`)
    .join('\n');

  return [
    `Watcher flagged ${c.artistName} for investigation. This is the deterministic trigger:`,
    ``,
    c.leadSignal.reason,
    otherSignals ? `\nWatcher also observed:\n${otherSignals}` : '',
    ``,
    `Investigate what is actually happening on this channel. Use the tools —`,
    `reconstruct the catalogue, look at release moments, study the gaps and the`,
    `follow-up behaviour. The trigger tells you where to look; it is not the finding.`,
    questions.length
      ? `\nTwo questions worth holding in mind while you look (ignore them if the channel points somewhere more interesting):\n${questions.map(q => `- ${q}`).join('\n')}`
      : '',
    ``,
    STANDARD,
    ``,
    OUTPUT_CONTRACT,
  ].filter(Boolean).join('\n');
}

/* ── Result ──────────────────────────────────────────────────────────── */

export type InvestigationOutcome =
  | { kind: 'FINDING'; finding: IntelligenceFinding; caseStudy: CaseStudyCandidate | null }
  | { kind: 'SUPPRESSED'; suppressed: SuppressedFinding };

export async function investigate(
  c: Candidate, runId: string, ctx: ServiceCtx,
): Promise<InvestigationOutcome> {
  const t0 = Date.now();

  /* Novelty is checked before spending anything, not after. */
  const rep = await isRepeat(c.artistId, c.leadSignal.type);
  if (rep.repeat) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        artistId: c.artistId, artistName: c.artistName, signal: c.leadSignal.reason,
        reason: 'REPEAT_OF_RECENT_FINDING', detail: rep.detail ?? '', tokens: 0,
      },
    };
  }

  const res = await askCoach({
    artistId: c.artistId,
    campaignId: c.campaignId,
    question: await buildQuestion(c),
    contextScope: 'ARTIST',
  }, ctx);

  if (!res.ok) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        artistId: c.artistId, artistName: c.artistName, signal: c.leadSignal.reason,
        reason: 'INVESTIGATION_FAILED', detail: `${res.reason}: ${res.detail}`, tokens: 0,
      },
    };
  }

  const answer = res.data;
  const tokens = answer.usage?.totalTokens ?? 0;
  const parsed = extractJson(answer.answer);

  const bail = (
    reason: SuppressedFinding['reason'], detail: string,
  ): InvestigationOutcome => ({
    kind: 'SUPPRESSED',
    suppressed: {
      artistId: c.artistId, artistName: c.artistName, signal: c.leadSignal.reason,
      reason, detail, tokens,
    },
  });

  if (!parsed || typeof parsed.verdict !== 'string') {
    /* An unparseable answer is not a finding. We do not salvage prose into
       a structured record — that is how a hedge becomes a headline. */
    return bail('INVESTIGATION_FAILED', 'Response did not contain a parseable verdict object.');
  }

  if (parsed.verdict === 'NOTHING_MATERIAL') {
    return bail('NOTHING_MATERIAL', String(parsed.why ?? 'No reason given.'));
  }

  if (parsed.verdict !== 'MATERIAL_FINDING') {
    return bail('INVESTIGATION_FAILED', `Unrecognised verdict "${parsed.verdict}".`);
  }

  const novelty: Novelty = parsed.novelty === 'NOVEL' ? 'NOVEL' : 'ALREADY_VISIBLE';
  const confidence: CoachConfidence =
    parsed.confidence === 'HIGH' ? 'HIGH' : parsed.confidence === 'MEDIUM' ? 'MEDIUM' : 'LOW';

  /* The model conceding that its own finding was already visible is the
     single most valuable thing it can tell us. Take it at its word. */
  if (novelty === 'ALREADY_VISIBLE') {
    return bail('ALREADY_VISIBLE', String(parsed.headline ?? '').slice(0, 300));
  }

  /* Low confidence plus no action is speculation. One or the other is
     tolerable; both together is not worth a strategist's morning. */
  const action = String(parsed.action ?? '').trim();
  const noAction = !action || /^no action/i.test(action);
  if (confidence === 'LOW' && noAction) {
    return bail('LOW_CONFIDENCE', String(parsed.headline ?? '').slice(0, 300));
  }

  const headline = String(parsed.headline ?? '').trim();
  if (!headline) return bail('NO_ACTIONABLE_CONSEQUENCE', 'Verdict was MATERIAL_FINDING with no headline.');

  const now = new Date().toISOString();
  const findingId = newId('find');

  let caseStudy: CaseStudyCandidate | null = null;
  if (parsed.caseStudy && typeof parsed.caseStudy === 'object') {
    const cs = parsed.caseStudy;
    caseStudy = {
      id: newId('cs'),
      artistId: c.artistId,
      artistName: c.artistName,
      createdAt: now,
      updatedAt: now,
      title: String(cs.title ?? headline).slice(0, 160),
      behaviourObserved: String(cs.behaviourObserved ?? '').trim(),
      evidence: (answer.evidence ?? []) as EvidenceItem[],
      whyInteresting: String(cs.whyInteresting ?? '').trim(),
      principleId: null,
      principleName: null,
      potentialLearning: String(cs.potentialLearning ?? '').trim(),
      applicableTo: Array.isArray(cs.applicableTo) ? cs.applicableTo.map(String).slice(0, 6) : [],
      evidenceClass: cs.evidenceClass === 'OBSERVED' ? 'OBSERVED' : 'INFERRED',
      confidence,
      /* Never born VALIDATED. A human decides that. */
      status: 'CANDIDATE',
      sourceFindingId: findingId,
    };
    /* A case study with no observable behaviour is an opinion. Drop it. */
    if (!caseStudy.behaviourObserved) caseStudy = null;
  }

  const finding: IntelligenceFinding = {
    id: findingId,
    artistId: c.artistId,
    artistName: c.artistName,
    campaignId: c.campaignId,
    createdAt: now,
    updatedAt: now,
    signal: {
      type: c.leadSignal.type,
      reason: c.leadSignal.reason,
      sourceRef: c.leadSignal.sourceRef,
    },
    headline,
    finding: String(parsed.finding ?? '').trim(),
    whyItMatters: String(parsed.whyItMatters ?? '').trim(),
    action: action || 'No action — worth knowing',
    evidence: (answer.evidence ?? []) as EvidenceItem[],
    novelty,
    confidence,
    status: 'NEW',
    caseStudyId: caseStudy?.id ?? null,
    memoryId: null,
    producedBy: answer.producedBy,
    toolsUsed: answer.toolsUsed ?? [],
    tokens,
    latencyMs: Date.now() - t0,
    runId,
  };

  await saveFinding(finding);
  if (caseStudy) await saveCaseStudy(caseStudy);

  return { kind: 'FINDING', finding, caseStudy };
}
