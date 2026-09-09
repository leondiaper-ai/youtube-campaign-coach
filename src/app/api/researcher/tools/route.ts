/**
 * POST /api/researcher/tools   { tool, args }
 * GET  /api/researcher/tools   → the tool catalogue
 *
 * The model-agnostic entry point. Our own adapter calls callTool() in
 * process; anything external — Grok Bot, a GPT function-calling loop, an MCP
 * shim, curl — calls this. Same registry, same results.
 *
 * Deliberately unauthenticated in V1 to match the rest of this app's API
 * surface (see /api/full-catalogue, /api/artist-live). It is read-mostly and
 * the two writes go to the research store, not to Watcher's data. If this
 * app ever gains auth, this route should be behind it — noted rather than
 * bolted on now, because a half-implemented auth scheme is worse than an
 * openly unauthenticated one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callTool, TOOL_SPECS } from '@/lib/researcher/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET() {
  return NextResponse.json(
    {
      tools: TOOL_SPECS,
      usage: 'POST { "tool": "<name>", "args": { ... } }',
      note: 'Every tool returns structured JSON. Warnings and caveats are embedded in the payloads deliberately — they are part of the data, not commentary.',
    },
    { headers: CORS },
  );
}

export async function POST(req: NextRequest) {
  let body: { tool?: string; args?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400, headers: CORS });
  }
  if (!body.tool) {
    return NextResponse.json(
      { error: 'tool required', available: TOOL_SPECS.map(t => t.name) },
      { status: 400, headers: CORS },
    );
  }

  const baseUrl = new URL(req.url).origin;
  const t0 = Date.now();
  try {
    const result = await callTool(body.tool, (body.args ?? {}) as Record<string, any>, { baseUrl });
    return NextResponse.json({ tool: body.tool, ms: Date.now() - t0, result }, { headers: CORS });
  } catch (e) {
    return NextResponse.json(
      { tool: body.tool, ms: Date.now() - t0, error: String((e as Error).message) },
      { status: 500, headers: CORS },
    );
  }
}
