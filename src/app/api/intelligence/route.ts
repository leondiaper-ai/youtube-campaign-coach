/**
 * INTELLIGENCE — HTTP surface
 *
 * The same registry the MCP server exposes, reachable with a plain GET so
 * the layer can be checked from a browser without configuring a connector.
 * That matters more than it sounds: the previous build was verified almost
 * entirely through the live site, and a data layer nobody can look at is a
 * data layer nobody notices is empty.
 *
 * GET is READ-ONLY. Every write tool is refused here regardless of the
 * `tool` parameter, because a GET that mutates is one browser prefetch away
 * from writing a research record nobody asked for. Writes go through the
 * authenticated MCP endpoint, or POST below.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callIntelTool, INTEL_SPECS, INTEL_TOOL_NAMES } from '@/lib/intelligence/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WRITE_TOOLS = new Set([
  'add_research_candidate', 'add_research_observation',
  'update_research_example', 'add_watchlist_item', 'propose_campaign_application',
]);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const tool = p.get('tool');

  if (!tool) {
    return NextResponse.json({
      tools: INTEL_SPECS.map(s => ({
        name: s.name, description: s.description, args: s.args,
        write: WRITE_TOOLS.has(s.name),
      })),
      usage: 'GET /api/intelligence?tool=<name>&artist=<slug>  — read tools only.',
    });
  }

  if (!INTEL_TOOL_NAMES.has(tool)) {
    return NextResponse.json({ error: `unknown tool ${tool}`, available: Array.from(INTEL_TOOL_NAMES) }, { status: 400 });
  }
  if (WRITE_TOOLS.has(tool)) {
    return NextResponse.json({ error: `${tool} is a write tool and is not callable over GET. Use POST, or the MCP endpoint.` }, { status: 405 });
  }

  const args: Record<string, any> = {};
  p.forEach((v, k) => {
    if (k === 'tool') return;
    args[k] = v === 'true' ? true : v === 'false' ? false : /^-?\d+$/.test(v) ? Number(v) : v;
  });

  try {
    const out = await callIntelTool(tool, args, { baseUrl: new URL(req.url).origin });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

/**
 * Writes require the MCP token. This endpoint reaches the same store the
 * public MCP server does, and leaving it open would make the token on that
 * server decorative.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'MCP_TOKEN is not configured, so writes are refused.' }, { status: 401 });
  }
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (bearer !== expected) {
    return NextResponse.json({ error: 'Unauthorised. Send Authorization: Bearer <MCP_TOKEN>.' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const { tool, args } = body ?? {};
  if (!INTEL_TOOL_NAMES.has(tool)) {
    return NextResponse.json({ error: `unknown tool ${tool}` }, { status: 400 });
  }
  try {
    const out = await callIntelTool(tool, args ?? {}, { baseUrl: new URL(req.url).origin });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
