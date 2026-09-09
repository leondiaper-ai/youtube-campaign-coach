/**
 * THE SHARED COACH SERVICE
 *
 * Every surface — Watcher home, artist page, deck, future territory view —
 * calls one of these three functions. None of them contains presentation
 * logic, and no surface contains coaching logic. That split is the whole
 * point of the layer: adding a fourth surface must not mean a fourth
 * integration with a model.
 *
 * ── WHERE THE INTELLIGENCE ACTUALLY LIVES ─────────────────────────────
 * Watcher computes. Grok interprets. The model is never asked for a number
 * it could get wrong — it is handed deterministic tool output and asked what
 * it means. So a model swap changes the quality of the interpretation and
 * nothing about the metrics, which is what makes the provider swappable in
 * any real sense rather than nominally.
 *
 * ── DEGRADING WHEN THERE IS NO MODEL ──────────────────────────────────
 * resolveProvider() returns null until a key is configured. Every entry
 * point here returns a NOT_CONFIGURED result rather than throwing or, worse,
 * emitting a plausible-looking overview assembled from templates. A fake
 * coach is far more dangerous than an absent one.
 */

import { resolveProvider, runResearch, type ToolRegistry } from '../researcher/model';
import { ALL_SPECS, callCoachTool } from '../coach-bot/tools';
import { COACH_SYSTEM_PROMPT } from '../coach-bot/prompt';
import { ARTISTS, mergeArtistLists, type Artist } from '../artists';
import { listCustomArtists } from '../artistStore';
import { readOverview, writeOverview } from './store';
import {
  INTERNAL_GLOBAL_SCOPE, scopeAllows,
  type CoachAnswer, type CoachOverview, type CoachScope,
  type InvestigationType, type SuggestedAction,
} from './types';

/* The Coach registry: the full 20-tool surface Grok already uses over MCP. */
const COACH_REGISTRY: ToolRegistry = {
  specs: ALL_SPECS,
  call: (name, args, ctx) => callCoachTool(name, args, ctx),
};

export interface ServiceCtx { baseUrl: string; scope?: CoachScope }

export type CoachResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'OUT_OF_SCOPE' | 'UNKNOWN_ARTIST' | 'FAILED'; detail: string };

async function roster(): Promise<Artist[]> {
  return mergeArtistLists(ARTISTS, await listCustomArtists());
}

/* Explicit discriminated union: without it TypeScript widens the two
   branches into one optional-property object and `'error' in r` no longer
   narrows `r.error` to a non-undefined literal. */
type Resolved =
  | { error: 'OUT_OF_SCOPE' | 'UNKNOWN_ARTIST'; artist?: undefined }
  | { error?: undefined; artist: Artist };

async function resolveArtist(slug: string, scope: CoachScope): Promise<Resolved> {
  if (!scopeAllows(scope, slug)) return { error: 'OUT_OF_SCOPE' };
  const a = (await roster()).find(x => x.slug === slug);
  if (!a) return { error: 'UNKNOWN_ARTIST' };
  return { artist: a };
}

/* ── JSON extraction ────────────────────────────────────────────────── */

/**
 * Models wrap JSON in prose or fences no matter how firmly you ask them not
 * to, and a single failed parse would blank the whole Watcher home. So we
 * take the outermost brace-balanced object rather than trusting the response
 * to be clean. A regex would break on any nested object.
 */
function extractJson(text: string): any | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

/**
 * Labels that leak how the system is built rather than what the user gets.
 * Validation produced a live button reading "Review localStorage campaign
 * plan for Amyl" — accurate internally, meaningless and slightly alarming to
 * a label marketer. Dropped rather than rewritten: a leaked label is usually
 * a leaked idea, and salvaging the wording would keep the wrong suggestion.
 */
const LEAKY = /localstorage|redis|upstash|api key|endpoint|\bslug\b|json|schema|tool call|mcp|env var|database|cache/i;

/**
 * The four investigations that are always available, because they depend
 * only on data every campaign has. Used when the model returns none — which
 * it did on the K-Trap summary in validation, silently removing the entire
 * follow-up affordance from the page.
 */
const FALLBACK_ACTIONS: SuggestedAction[] = [
  { id: 'f_why',     label: 'Why does the Coach think this?',   investigationType: 'WHY' },
  { id: 'f_latest',  label: 'Analyse the latest release',       investigationType: 'ANALYSE_LATEST_VIDEO' },
  { id: 'f_prev',    label: 'Compare with the previous campaign', investigationType: 'COMPARE_PREVIOUS_CAMPAIGN' },
  { id: 'f_next',    label: 'What should we do next?',          investigationType: 'WHAT_NEXT' },
];

function normaliseActions(raw: unknown, opts: { fallback?: boolean } = {}): SuggestedAction[] {
  const list = Array.isArray(raw) ? raw : [];
  const cleaned = list.slice(0, 6).map((a: any, i: number) => ({
    id: str(a?.id, `act_${i}`),
    label: str(a?.label),
    investigationType: (str(a?.investigationType, 'CUSTOM') as InvestigationType),
  })).filter(a => {
    if (!a.label) return false;
    if (LEAKY.test(a.label)) return false;
    /* An unknown investigationType would route to CUSTOM and re-ask the
       label as a question, which is usually fine — but not when the label
       is an instruction to a human rather than a question. */
    return true;
  });

  if (cleaned.length) return cleaned;
  return opts.fallback ? FALLBACK_ACTIONS : [];
}

const RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Forward context caps confidence. In validation the K-Trap summary returned
 * HIGH while its own text said the horizon was UNKNOWN and any timing call
 * would be blind — two claims that cannot both be true. The model is not
 * reliably able to discount itself, so the ceiling is applied here from the
 * deterministic horizon rather than asked for in the prompt.
 */
function clampConfidence(raw: string, horizonConfidence: string): CoachOverview['confidence'] {
  const ceiling = horizonConfidence === 'HIGH' ? 'HIGH'
    : horizonConfidence === 'MEDIUM' ? 'MEDIUM'
    : 'MEDIUM'; // LOW or UNKNOWN forward plan can still support a solid read of the PAST
  const v = RANK[raw] === undefined ? 'LOW' : raw;
  return (RANK[v] > RANK[ceiling] ? ceiling : v) as CoachOverview['confidence'];
}

function normaliseEvidence(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((e: any) => ({
    sourceType: str(e?.sourceType, 'COACH_INFERENCE') as any,
    claim: str(e?.claim),
    sourceRef: str(e?.sourceRef) || null,
  })).filter(e => e.claim);
}

/* ── Output contract appended to the shared operating prompt ─────────── */

const OVERVIEW_FORMAT = `
═══ OUTPUT FORMAT ═══

Return ONE JSON object and nothing else. No prose before or after, no code fence.

{
  "status": "ON_TRACK | WATCH | ACTION_REQUIRED | OPPORTUNITY | RISK",
  "headline": "one sentence, under 120 characters, the single thing that matters",
  "whatHappened": "2-3 sentences of observed fact",
  "interpretation": "2-3 sentences on what it may mean and why",
  "recommendation": "what to do, prepare, investigate or leave alone. 'No intervention required.' is a valid and often correct answer",
  "timing": "when, or empty string if there is nothing to time",
  "evidenceSummary": "one line naming the evidence the reading rests on",
  "evidence": [{ "sourceType": "WATCHER|PUBLIC_YOUTUBE|EXTERNAL|COACH_INFERENCE", "claim": "...", "sourceRef": "tool name or video id" }],
  "confidence": "LOW | MEDIUM | HIGH",
  "missingContext": "what you could not see. Never blank",
  "nextCheck": "when this should be reassessed",
  "suggestedActions": [{ "id": "a1", "label": "campaign-specific wording", "investigationType": "WHY|ANALYSE_LATEST_VIDEO|AUDIENCE_REACTION|COMPARE_PREVIOUS_CAMPAIGN|COMPARE_RELEVANT_ARTISTS|WHAT_NEXT|WHAT_TO_TEST|CUSTOM" }]
}

RULES FOR THIS OBJECT:
· Label anything you reasoned rather than measured as COACH_INFERENCE. Do not
  present inference as observation.
· suggestedActions labels must name THIS campaign's assets — "Analyse Pressure
  performance", not "Analyse latest video". Three or four is right.
· Use ON_TRACK freely. Most campaigns on most days need nothing.
`;

/* ── 1. Overview ────────────────────────────────────────────────────── */

export async function getCoachOverview(
  artistId: string,
  ctx: ServiceCtx,
  opts: { refresh?: boolean } = {},
): Promise<CoachResult<CoachOverview>> {
  const scope = ctx.scope ?? INTERNAL_GLOBAL_SCOPE;
  const r = await resolveArtist(artistId, scope);
  if (r.error) return { ok: false, reason: r.error, detail: `${artistId}: ${r.error}` };
  const artist = r.artist;

  if (!opts.refresh) {
    const cached = await readOverview(artistId);
    if (cached) return { ok: true, data: { ...cached, cached: true } };
  }

  const cfg = resolveProvider();
  if (!cfg) {
    return {
      ok: false, reason: 'NOT_CONFIGURED',
      detail: 'No reasoning provider is configured. Set XAI_API_KEY (api.x.ai) on the deployment.',
    };
  }

  const question = [
    `Produce a Campaign Coach overview for ${artist.name} (slug: ${artist.slug}).`,
    '',
    'Gather what you need first. At minimum call get_campaign_timeline and',
    'get_campaign_state. Call get_coach_history so you do not repeat a call that',
    'was already rejected, and get_campaign_horizon before any timing claim.',
    '',
    'Then return the JSON object described in the output format.',
  ].join('\n');

  try {
    const run = await runResearch(
      COACH_SYSTEM_PROMPT + OVERVIEW_FORMAT,
      question,
      { baseUrl: ctx.baseUrl },
      cfg,
      COACH_REGISTRY,
    );
    const j = extractJson(run.text);
    if (!j) {
      return {
        ok: false, reason: 'FAILED',
        detail: `The model did not return a parseable overview. First 300 chars: ${run.text.slice(0, 300)}`,
      };
    }

    /* Read the horizon deterministically rather than trusting the model to
       report what it saw. This is the value that caps confidence. */
    let horizonConfidence = 'UNKNOWN';
    try {
      const h: any = await callCoachTool('get_campaign_horizon', { slug: artist.slug }, { baseUrl: ctx.baseUrl });
      horizonConfidence = h?.horizonConfidence ?? 'UNKNOWN';
    } catch { /* horizon unavailable → stays UNKNOWN, which is the safe read */ }

    const out: CoachOverview = {
      artistId: artist.slug,
      artistName: artist.name,
      campaignId: artist.campaign ?? null,
      campaignName: artist.campaign ?? null,
      generatedAt: new Date().toISOString(),
      status: (str(j.status, 'ON_TRACK') as CoachOverview['status']),
      headline: str(j.headline, 'No headline returned.'),
      whatHappened: str(j.whatHappened),
      interpretation: str(j.interpretation),
      recommendation: str(j.recommendation, 'No intervention required.'),
      timing: str(j.timing),
      evidenceSummary: str(j.evidenceSummary),
      evidence: normaliseEvidence(j.evidence),
      confidence: clampConfidence(str(j.confidence, 'LOW'), horizonConfidence),
      missingContext: str(j.missingContext, 'Not stated by the model — treat this reading as less complete than it appears.'),
      nextCheck: str(j.nextCheck),
      /* fallback: the summary is the one place an empty action list removes
         the entire follow-up affordance from the page. */
      suggestedActions: normaliseActions(j.suggestedActions, { fallback: true }),
      producedBy: `${run.provider}/${run.model}`,
      toolsUsed: Array.from(new Set(run.toolCalls.filter(t => t.ok).map(t => t.tool))),
      usage: run.usage,
      horizonConfidence,
    };

    await writeOverview(out);
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, reason: 'FAILED', detail: String((e as Error).message) };
  }
}

/* ── 2. Free-form question ──────────────────────────────────────────── */

export async function askCoach(args: {
  artistId: string;
  campaignId?: string | null;
  question: string;
  contextScope?: 'CAMPAIGN' | 'ARTIST' | 'ROSTER';
}, ctx: ServiceCtx): Promise<CoachResult<CoachAnswer>> {
  return runInvestigation(
    { artistId: args.artistId, investigationType: 'CUSTOM', question: args.question, contextScope: args.contextScope },
    ctx,
  );
}

/* ── 3. Named investigations ────────────────────────────────────────── */

/**
 * The prompts are written per type rather than templated from the label,
 * because each one needs a different instruction about which tools to trust.
 * "Compare with the previous campaign" in particular has to be pushed at
 * Watcher history explicitly — left to itself a model will happily answer
 * from general knowledge of the artist, which is exactly the failure the
 * brief calls out.
 */
const INVESTIGATION_PROMPTS: Record<InvestigationType, (name: string) => string> = {
  WHY: n =>
    `Explain precisely why the current Coach reading for ${n} is what it is. Walk through the evidence that drove it, name the observations that would change it, and be explicit about which parts are measured and which are inference.`,

  ANALYSE_LATEST_VIDEO: n =>
    `Analyse the most recent significant upload for ${n}. Use get_recent_video_performance and get_campaign_timeline. Compare it only against this artist's own same-age baseline — never against another artist's lifetime totals, and never divide views by age.`,

  AUDIENCE_REACTION: n =>
    `Assess the audience response to ${n}'s recent releases using the public engagement signals available: comment and like counts relative to this artist's own recent norm. State plainly that you cannot see comment TEXT, sentiment, retention, or who is watching — those are not in the public Data API. Do not speculate about sentiment as though you had read it.`,

  COMPARE_PREVIOUS_CAMPAIGN: n =>
    `Compare ${n}'s current campaign with their own previous campaign, using Watcher history and the reconstructed catalogue — reconstruct_catalogue, get_release_moments, run_gap_study. Do NOT answer from general knowledge of the artist. Compare release architecture: sequencing, spacing, format spread, follow-up behaviour. Age-confounded view comparisons are not valid; say so if asked for one.`,

  COMPARE_RELEVANT_ARTISTS: n =>
    `Find the most genuinely comparable artists to ${n} using find_similar_artists and compare_artists, and say what the comparison does and does not support. Comparisons must be within age bucket or about architecture, not raw lifetime views.`,

  WHAT_NEXT: n =>
    `What should the team do next on YouTube for ${n}? Check get_campaign_horizon first. If forward visibility is poor, say so and ask for the missing dates rather than giving unqualified timing. "Nothing this week" is a valid answer.`,

  WHAT_TO_TEST: n =>
    `Based on what this campaign has and has not tried, propose what ${n} should test on the NEXT campaign. Ground each suggestion in something observed in their own catalogue, and state what result would tell us the test worked.`,

  CUSTOM: n => `Answer the following about ${n}, using Watcher tools for anything factual.`,
};

const ANSWER_FORMAT = `
═══ OUTPUT FORMAT ═══

Return ONE JSON object and nothing else.

{
  "answer": "your analysis in markdown. Be concise and specific. Do not restate metrics without interpreting them",
  "evidence": [{ "sourceType": "WATCHER|PUBLIC_YOUTUBE|EXTERNAL|COACH_INFERENCE", "claim": "...", "sourceRef": "..." }],
  "confidence": "LOW | MEDIUM | HIGH",
  "missingContext": "what you could not see. Never blank",
  "suggestedActions": [{ "id": "a1", "label": "...", "investigationType": "..." }]
}

Where causality is not established, write "appears", "suggests", "consistent with",
or "one possible explanation" — never "caused", "drove" or "because of".

DO NOT open the answer with a STATUS verdict (ON_TRACK / WATCH / etc). The
campaign status is set once, by the Coach overview. An investigation that
declares its own status produces two different verdicts on the same campaign
minutes apart — which happened in testing and destroys trust in both. Answer
the question asked; if your analysis genuinely contradicts the current status,
say so explicitly in a sentence and explain why, rather than quietly relabelling.
`;

export async function runCoachInvestigation(args: {
  artistId: string;
  campaignId?: string | null;
  investigationType: InvestigationType;
  question?: string;
}, ctx: ServiceCtx): Promise<CoachResult<CoachAnswer>> {
  return runInvestigation(args, ctx);
}

async function runInvestigation(args: {
  artistId: string;
  campaignId?: string | null;
  investigationType: InvestigationType;
  question?: string;
  contextScope?: string;
}, ctx: ServiceCtx): Promise<CoachResult<CoachAnswer>> {
  const scope = ctx.scope ?? INTERNAL_GLOBAL_SCOPE;
  const r = await resolveArtist(args.artistId, scope);
  if (r.error) return { ok: false, reason: r.error, detail: `${args.artistId}: ${r.error}` };
  const artist = r.artist;

  const cfg = resolveProvider();
  if (!cfg) {
    return {
      ok: false, reason: 'NOT_CONFIGURED',
      detail: 'No reasoning provider is configured. Set XAI_API_KEY (api.x.ai) on the deployment.',
    };
  }

  const type = args.investigationType;
  const base = (INVESTIGATION_PROMPTS[type] ?? INVESTIGATION_PROMPTS.CUSTOM)(artist.name);

  /* The artist is always injected server-side. A surface never has to make
     the user restate who they are looking at, and a caller cannot silently
     retarget the question at a different artist by wording alone. */
  const question = [
    `ARTIST: ${artist.name} (slug: ${artist.slug})`,
    artist.campaign ? `CAMPAIGN: ${artist.campaign}` : null,
    '',
    base,
    args.question ? `\nThe user asked: ${args.question}` : null,
  ].filter(Boolean).join('\n');

  try {
    const run = await runResearch(
      COACH_SYSTEM_PROMPT + ANSWER_FORMAT,
      question,
      { baseUrl: ctx.baseUrl },
      cfg,
      COACH_REGISTRY,
    );
    const j = extractJson(run.text) ?? {};

    return {
      ok: true,
      data: {
        artistId: artist.slug,
        campaignId: args.campaignId ?? artist.campaign ?? null,
        generatedAt: new Date().toISOString(),
        question: args.question ?? base,
        investigationType: type,
        /* If JSON parsing failed we still have the model's prose, and prose
           is a perfectly good answer here — unlike the overview, nothing
           downstream depends on the fields. */
        answer: str(j.answer, run.text || 'No answer returned.'),
        evidence: normaliseEvidence(j.evidence),
        confidence: (str(j.confidence, 'LOW') as CoachAnswer['confidence']),
        missingContext: str(j.missingContext, 'Not stated by the model.'),
        suggestedActions: normaliseActions(j.suggestedActions),
        producedBy: `${run.provider}/${run.model}`,
        toolsUsed: Array.from(new Set(run.toolCalls.filter(t => t.ok).map(t => t.tool))),
        usage: run.usage,
      },
    };
  } catch (e) {
    return { ok: false, reason: 'FAILED', detail: String((e as Error).message) };
  }
}

/* ── Attention layer ────────────────────────────────────────────────── */

/**
 * The Watcher home reads this. It returns ONLY cached overviews plus the
 * deterministic campaign list — it never triggers thirty model runs on a page
 * load. Campaigns with no cached reading are reported as PENDING so the UI
 * can say "not yet assessed" rather than implying they are fine.
 */
export async function getAttentionBoard(ctx: ServiceCtx): Promise<{
  generatedAt: string;
  assessed: CoachOverview[];
  pending: { slug: string; name: string; campaign: string | null }[];
  providerReady: boolean;
}> {
  const scope = ctx.scope ?? INTERNAL_GLOBAL_SCOPE;
  const campaigns = (await roster())
    .filter(a => a.campaignStartDate || a.campaign)
    .filter(a => scopeAllows(scope, a.slug))
    .slice(0, 40);

  const assessed: CoachOverview[] = [];
  const pending: { slug: string; name: string; campaign: string | null }[] = [];

  const reads = await Promise.all(campaigns.map(async a => ({ a, o: await readOverview(a.slug) })));
  for (const { a, o } of reads) {
    if (o) assessed.push({ ...o, cached: true });
    else pending.push({ slug: a.slug, name: a.name, campaign: a.campaign ?? null });
  }

  return {
    generatedAt: new Date().toISOString(),
    assessed,
    pending,
    providerReady: resolveProvider() !== null,
  };
}
