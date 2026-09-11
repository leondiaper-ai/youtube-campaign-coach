/**
 * THE VERIFICATION RUN ENDPOINT
 *
 * POST advances the run by one example. GET reads its state without
 * spending anything, which is the call to make when you want to know what
 * happened rather than make more happen.
 *
 * Both require MCP_TOKEN. The GET is token-gated too, unlike the rest of
 * /api/intelligence, because the audit log records what was searched and
 * the outcomes include unpublished judgements about other artists.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  stepVerificationRun, readRun, resetRun, VERIFICATION_RUN,
} from '@/lib/intelligence/verificationRun';

export const dynamic = 'force-dynamic';
/* The 60s Hobby ceiling is why this does one example per call. Asking for
   more than the plan allows does not get it. */
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected) return false;
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim() === expected;
}

const DENY = NextResponse.json(
  { error: 'Unauthorised. Send Authorization: Bearer <MCP_TOKEN>.' },
  { status: 401 },
);

export async function GET(req: NextRequest) {
  if (!authorised(req)) return DENY;
  const state = await readRun();
  return NextResponse.json({
    config: VERIFICATION_RUN,
    modelEnabled: process.env.MODEL_ENABLED === '1',
    state,
    note: state
      ? `${state.completed.length}/${VERIFICATION_RUN.maxExamples} examples processed, ${state.refusals} tool calls refused.`
      : 'No run started yet. POST to begin.',
  });
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return DENY;

  /* A reset is destructive enough to require saying so explicitly. */
  if (req.nextUrl.searchParams.get('reset') === '1') {
    await resetRun();
    return NextResponse.json({ reset: true, note: 'Run state cleared. POST again to start from the first example.' });
  }

  const result = await stepVerificationRun(new URL(req.url).origin);
  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    next: result.next,
    done: result.state?.done ?? false,
    /* The whole state comes back each time, so a caller driving this from a
       terminal sees the audit log and the running cost without a second
       request. */
    state: result.state,
  }, { status: result.ok ? 200 : 500 });
}
