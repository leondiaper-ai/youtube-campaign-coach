/**
 * SCOUT INVESTIGATION
 *
 * The one stage where a model is used, and it is used narrowly: everything
 * it needs has already been computed. It is not given tools and it is not
 * asked to go and look — Scout has looked, deterministically, and hands
 * over a block of figures.
 *
 * ── WHY NOT askCoach ─────────────────────────────────────────────────
 * `askCoach` resolves its subject against the Watcher roster and returns
 * UNKNOWN_ARTIST for anything else, which is correct behaviour for a Coach
 * that must never invent context about our own artists. A Scout channel is
 * by definition not on the roster. So this calls `runResearch` — the same
 * provider layer underneath, with the same multi-turn token accounting —
 * with an empty tool registry.
 *
 * Empty registry is a design decision, not a limitation. Giving the model
 * Watcher's tools would let it reach for data about OUR artists while
 * describing someone else's channel, and the resulting paragraph would
 * blend the two invisibly.
 */

import { runResearch, resolveProvider, type ToolRegistry } from '../researcher/model';
import { renderProfile } from './analyse';
import { isRepeat, newId, saveFinding, saveCaseStudy, listFindings } from '../knowledge/store';
import { listPrinciples } from '../knowledge/principles';
import type { Finding, CaseStudy, Suppressed, CoachConfidence, Novelty } from '../knowledge/types';
import type { QualifiedChannel } from './types';
import type { ResearchMission } from './missions';

/** No tools. Scout supplies the evidence; the model supplies the reading. */
const NO_TOOLS: ToolRegistry = { specs: [], call: async () => ({}) };

const SYSTEM = `
You are a YouTube strategy researcher working for a major music company.

You are shown ONE external artist channel that a deterministic system has
already analysed, together with the research question that surfaced it. Your
job is to say whether there is something here an experienced YouTube
strategist would want to understand — and to say so honestly when there is not.

Hold to these:

1. Every claim must trace to a figure in the evidence block. If you cannot
   point at the line that supports a sentence, do not write the sentence.
2. All view counts are lifetime totals read once. There is no time series.
   Never describe anything as growing, accelerating, gaining momentum or
   outperforming over time, and never divide views by age.
3. Claim nothing about retention, traffic sources, impressions, CTR,
   browse/suggested, unique viewers, subscriber attribution or whether
   Shorts drove long-form viewing. None of that data exists here.
4. "This artist is big and their videos get a lot of views" is not a
   finding. Scale is not strategy.
5. The test that matters: would an experienced YouTube strategist, shown
   this same evidence, already know this? If yes, say so — that verdict is
   more useful to us than a paragraph.
6. Describe what they DID, in order, with dates. Architecture is the
   product; adjectives are not.

NOTHING_MATERIAL is a successful outcome and most channels should reach it.
You are not judged on how much you find.
`.trim();

const CONTRACT = `
Reply with a JSON object and nothing else. No prose around it, no code fence.

If there is nothing worth a strategist's attention:
{"verdict":"NOTHING_MATERIAL","why":"<one sentence: what you looked at and why it was unremarkable>"}

Otherwise:
{
  "verdict":"MATERIAL_FINDING",
  "headline":"<one sentence naming the specific behaviour, with a figure or a date>",
  "whatTheyDid":"<the architecture in two or three sentences, in order, with dates>",
  "whyInteresting":"<why this is worth understanding>",
  "whyNotObvious":"<what stops a strategist already knowing this. If it IS obvious, say so and set novelty to ALREADY_VISIBLE>",
  "transferableLesson":"<what one of our artists could actually take from it, or 'None — interesting but not transferable'>",
  "limitations":"<what this evidence cannot support. Never blank>",
  "watchNext":"<what to look at on this channel next time, or ''>",
  "novelty":"NOVEL" | "ALREADY_VISIBLE",
  "confidence":"LOW" | "MEDIUM" | "HIGH",
  "bestInClass": true | false,
  "sequence":["<step with date>","<step with date>"]
}

bestInClass is true only when the EXECUTION is worth teaching — not because
the artist is famous or the numbers are large.
`.trim();

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

export type ScoutOutcome =
  | { kind: 'FINDING'; finding: Finding; caseStudy: CaseStudy | null; tokens: number }
  | { kind: 'NOTHING'; channelId: string; title: string; why: string; tokens: number }
  | { kind: 'SUPPRESSED'; suppressed: Suppressed };

export async function investigateChannel(
  c: QualifiedChannel, mission: ResearchMission, runId: string,
): Promise<ScoutOutcome> {
  const t0 = Date.now();

  const rep = await isRepeat(c.channelId, mission.id);
  if (rep.repeat) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'REPEAT_OF_RECENT_FINDING', detail: rep.detail ?? '', tokens: 0,
      },
    };
  }

  const cfg = resolveProvider();
  if (!cfg) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'INVESTIGATION_FAILED', detail: 'No model provider configured.', tokens: 0,
      },
    };
  }

  /* What we already know about this channel, so a second look builds on
     the first rather than starting again. */
  const prior = await listFindings(c.channelId);
  const principle = mission.principleId
    ? (await listPrinciples()).find(p => p.id === mission.principleId)
    : undefined;

  const user = [
    `RESEARCH QUESTION: ${mission.question}`,
    `What we are looking for: ${mission.lookingFor}`,
    `What this question may NOT conclude: ${mission.cannotConclude}`,
    principle
      ? `\nRELATED WORKING PRINCIPLE (status ${principle.status}, not settled): ${principle.title}\n${principle.description}`
      : '',
    `\nWHY THIS CHANNEL WAS SURFACED`,
    `Discovered via the search: "${c.discoverySource}"`,
    `It cleared the deterministic test because: ${c.missionEvidence}`,
    c.subs != null ? `Subscribers: ${c.subs.toLocaleString()}` : 'Subscriber count hidden.',
    c.country ? `Channel country as reported by YouTube: ${c.country}` : 'Country not reported.',
    prior.length
      ? `\nWHAT WE HAVE ALREADY RECORDED ABOUT THIS CHANNEL:\n${prior.slice(0, 5).map(f => `- ${f.headline}`).join('\n')}`
      : '',
    '',
    '─── EVIDENCE ───',
    renderProfile(c.profile, c.title),
    '',
    CONTRACT,
  ].filter(Boolean).join('\n');

  let res;
  try {
    res = await runResearch(SYSTEM, user, { baseUrl: '' } as any, cfg, NO_TOOLS);
  } catch (e) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'INVESTIGATION_FAILED',
        detail: e instanceof Error ? e.message : String(e), tokens: 0,
      },
    };
  }

  const tokens = res.usage.totalTokens;
  const parsed = extractJson(res.text);

  if (!parsed || typeof parsed.verdict !== 'string') {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'INVESTIGATION_FAILED',
        detail: 'Response contained no parseable verdict object.', tokens,
      },
    };
  }

  if (parsed.verdict === 'NOTHING_MATERIAL') {
    return {
      kind: 'NOTHING',
      channelId: c.channelId, title: c.title,
      why: String(parsed.why ?? 'No reason given.'), tokens,
    };
  }

  const novelty: Novelty = parsed.novelty === 'NOVEL' ? 'NOVEL' : 'ALREADY_VISIBLE';
  /* The model conceding its own finding is obvious is the most valuable
     thing it can tell us. Take it at its word rather than overriding it. */
  if (novelty === 'ALREADY_VISIBLE') {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'ALREADY_VISIBLE',
        detail: String(parsed.headline ?? '').slice(0, 300), tokens,
      },
    };
  }

  const headline = String(parsed.headline ?? '').trim();
  if (!headline) {
    return {
      kind: 'SUPPRESSED',
      suppressed: {
        subjectId: c.channelId, subjectName: c.title, trigger: c.missionEvidence,
        reason: 'NO_ACTIONABLE_CONSEQUENCE',
        detail: 'MATERIAL_FINDING with no headline.', tokens,
      },
    };
  }

  const confidence: CoachConfidence =
    parsed.confidence === 'HIGH' ? 'HIGH' : parsed.confidence === 'MEDIUM' ? 'MEDIUM' : 'LOW';

  const now = new Date().toISOString();
  const findingId = newId('find');
  const lesson = String(parsed.transferableLesson ?? '').trim();
  const limitations = String(parsed.limitations ?? '').trim();

  /* A case study needs a transferable lesson AND stated limits. Without
     the first it is trivia; without the second it is not safe to show
     anyone outside the building. */
  let caseStudy: CaseStudy | null = null;
  const hasLesson = lesson && !/^none\b/i.test(lesson);
  if (hasLesson && limitations) {
    caseStudy = {
      id: newId('cs'),
      subject: c.title,
      channelId: c.channelId,
      missionId: mission.id,
      title: headline.slice(0, 160),
      behaviourObserved: String(parsed.whatTheyDid ?? '').trim(),
      sequence: Array.isArray(parsed.sequence) ? parsed.sequence.map(String).slice(0, 12) : [],
      evidence: [
        {
          sourceType: 'WATCHER',
          claim: c.missionEvidence,
          sourceRef: `scout:profile:${c.channelId}`,
        },
        {
          sourceType: 'PUBLIC_YOUTUBE',
          claim: `${c.profile.uploadsAnalysed} uploads analysed, ${c.profile.windowStart.slice(0, 10)} to ${c.profile.windowEnd.slice(0, 10)}`,
          sourceRef: `channel:${c.channelId}`,
        },
      ],
      whyInteresting: String(parsed.whyInteresting ?? '').trim(),
      whyNotObvious: String(parsed.whyNotObvious ?? '').trim(),
      relatedPrincipleId: mission.principleId,
      possibleLearning: lesson,
      limitations,
      /* Never born validated, however confident the model was. A human
         promotes it or it stays a candidate. */
      status: parsed.bestInClass === true ? 'STRONG_EXAMPLE' : 'CANDIDATE',
      confidence,
      discoveredAt: now,
      lastReviewedAt: now,
      sourceFindingId: findingId,
    };
  }

  const finding: Finding = {
    id: findingId,
    origin: 'SCOUT',
    subjectId: c.channelId,
    subjectName: c.title,
    createdAt: now,
    updatedAt: now,
    trigger: {
      kind: mission.id,
      reason: c.missionEvidence,
      sourceRef: `search:"${c.discoverySource}"`,
    },
    headline,
    finding: String(parsed.whatTheyDid ?? '').trim(),
    whyItMatters: String(parsed.whyInteresting ?? '').trim(),
    action: hasLesson ? lesson : (String(parsed.watchNext ?? '').trim() || 'No action — worth knowing'),
    evidence: caseStudy?.evidence ?? [{
      sourceType: 'WATCHER',
      claim: c.missionEvidence,
      sourceRef: `scout:profile:${c.channelId}`,
    }],
    novelty,
    confidence,
    status: 'NEW',
    caseStudyId: caseStudy?.id ?? null,
    producedBy: `${res.provider}/${res.model}`,
    toolsUsed: [],
    tokens,
    latencyMs: Date.now() - t0,
    runId,
  };

  await saveFinding(finding);
  if (caseStudy) await saveCaseStudy(caseStudy);

  return { kind: 'FINDING', finding, caseStudy, tokens };
}
