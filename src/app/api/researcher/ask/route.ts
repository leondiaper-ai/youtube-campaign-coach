/**
 * POST /api/researcher/ask   { question, artistSlug?, questionId? }
 *
 * Runs one research session: the model reasons over the tool layer and
 * writes any findings that survive the quality gate into the knowledge
 * store. Returns its prose plus the tool trace, so a run can be audited
 * rather than taken on trust.
 *
 * Returns 501 with an explicit setup message when no model key is present.
 * That is deliberate — the tool layer works standalone and is worth
 * exercising via /api/researcher/tools before any model is wired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, SEED_QUESTIONS } from '@/lib/researcher/prompt';
import { resolveProvider, runResearch } from '@/lib/researcher/model';
import { listFindings, logRun } from '@/lib/researcher/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const cfg = resolveProvider();
  return NextResponse.json({
    ready: !!cfg,
    provider: cfg?.provider ?? null,
    model: cfg?.model ?? null,
    seedQuestions: SEED_QUESTIONS,
    setup: cfg ? null
      : 'Set XAI_API_KEY (preferred), ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment. Optionally RESEARCHER_MODEL to pin a model. The tool layer at /api/researcher/tools works without any of these.',
  });
}

export async function POST(req: NextRequest) {
  const cfg = resolveProvider();
  if (!cfg) {
    return NextResponse.json({
      error: 'No model provider configured.',
      setup: 'Add XAI_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY to the environment.',
      toolLayerStillWorks: '/api/researcher/tools',
    }, { status: 501 });
  }

  let body: { question?: string; artistSlug?: string; questionId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }); }

  const question = (body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

  const baseUrl = new URL(req.url).origin;
  const scope = body.artistSlug ? `artist:${body.artistSlug}` : 'roster';

  /* Scope and provenance are given to the model as context, not buried. */
  const userMessage = [
    body.artistSlug ? `Artist in scope: ${body.artistSlug}` : 'Scope: the whole roster.',
    body.questionId ? `Seed question: ${body.questionId}` : '',
    '',
    question,
    '',
    `When you record a finding, pass producedBy: "${cfg.provider}:${cfg.model}".`,
  ].filter(Boolean).join('\n');

  const before = new Set((await listFindings()).map(f => f.id));
  const t0 = Date.now();

  try {
    const out = await runResearch(buildSystemPrompt(), userMessage, { baseUrl }, cfg);
    const after = await listFindings();
    const created = after.filter(f => !before.has(f.id));

    await logRun({
      id: `run_${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      question, scope,
      toolCalls: out.toolCalls,
      findingIds: created.map(f => f.id),
      suppressed: created.filter(f => !f.gate.passed).length,
      provider: out.provider, model: out.model,
    });

    return NextResponse.json({
      answer: out.text,
      toolCalls: out.toolCalls,
      ms: Date.now() - t0,
      provider: out.provider,
      model: out.model,
      findings: created.filter(f => f.gate.passed),
      /* Suppressed findings are returned too, so the gate's behaviour is
         visible rather than silently swallowing the model's output. */
      suppressed: created.filter(f => !f.gate.passed)
        .map(f => ({ claim: f.claim, reasons: f.gate.reasons, score: f.gate.score })),
    });
  } catch (e) {
    const msg = String((e as Error).message);
    await logRun({
      id: `run_${Date.now().toString(36)}`, at: new Date().toISOString(),
      question, scope, toolCalls: [], findingIds: [], suppressed: 0,
      provider: cfg.provider, model: cfg.model, error: msg,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
