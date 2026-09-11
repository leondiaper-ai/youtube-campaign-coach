/**
 * MCP SERVER — Streamable HTTP transport
 *
 * This is what Grok connects to. Verified against xAI's own documentation
 * (docs.x.ai/grok/connectors): custom MCP connectors are added at
 * grok.com/connectors → New Connector → Custom, the server must be
 * reachable on the public internet, and Streamable HTTP is the preferred
 * transport (their tunnelling page notes Cloudflare quick tunnels break SSE
 * but "servers using the newer Streamable HTTP transport work fine").
 *
 * Because this app is already deployed on Vercel, no tunnel is needed —
 * the endpoint is public by construction and its URL is stable, which
 * sidesteps the "free tunnel URLs change on restart" problem entirely.
 *
 * ── WHY HAND-ROLLED JSON-RPC RATHER THAN THE MCP SDK ──────────────────
 * The SDK expects a long-lived Node server with its own transport handling.
 * Next.js route handlers on Vercel are request-scoped and stateless. The
 * subset of MCP needed for a tool server — initialize, tools/list,
 * tools/call, ping — is a few dozen lines of JSON-RPC, and implementing it
 * directly avoids a dependency that would fight the runtime. If this ever
 * needs resources, prompts or sampling, revisit that decision.
 *
 * ── AUTH ──────────────────────────────────────────────────────────────
 * Bearer token via MCP_TOKEN. This endpoint reaches real campaign data and
 * is on the public internet, so unlike the older internal routes it is NOT
 * left open. When MCP_TOKEN is unset the server refuses every call rather
 * than defaulting to open — failing closed is the only safe default for a
 * publicly addressable data endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ALL_SPECS, callCoachTool } from '@/lib/coach-bot/tools';
import { COACH_SYSTEM_PROMPT } from '@/lib/coach-bot/prompt';
import { RESEARCH_WORKFLOW } from '@/lib/intelligence/researchWorkflow';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PROTOCOL_VERSION = '2025-06-18';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,authorization,mcp-session-id,mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

/* ── JSON-RPC helpers ───────────────────────────────────────────────── */

type Id = string | number | null;
const ok = (id: Id, result: unknown) =>
  NextResponse.json({ jsonrpc: '2.0', id, result }, { headers: CORS });
const err = (id: Id, code: number, message: string) =>
  NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { headers: CORS });

function authorised(req: NextRequest): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected) return false; // fail closed
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer === expected) return true;
  // Some MCP clients pass the token as a query param during discovery.
  return req.nextUrl.searchParams.get('token') === expected;
}

/** MCP tool schemas from our single registry — one source of truth. */
function mcpTools() {
  return ALL_SPECS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(t.args).map(([k, v]) => [k, { type: jsonType(v), description: v }]),
      ),
      required: Object.entries(t.args)
        .filter(([, v]) => !/optional/i.test(v))
        .map(([k]) => k),
    },
  }));
}

function jsonType(desc: string): string {
  if (/string\[\]/.test(desc)) return 'array';
  if (/boolean/.test(desc)) return 'boolean';
  if (/^number|number,/.test(desc)) return 'number';
  if (/object/.test(desc)) return 'object';
  return 'string';
}

/* ── Handlers ───────────────────────────────────────────────────────── */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET is used by some clients to probe for an SSE stream. We do not offer
 * one — every response here is a complete JSON body — so we answer 405,
 * which the spec permits and which tells the client to use POST only.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('describe') === '1') {
    return NextResponse.json({
      name: 'watcher-campaign-coach',
      protocolVersion: PROTOCOL_VERSION,
      transport: 'streamable-http',
      authenticated: authorised(req),
      tools: ALL_SPECS.map(t => t.name),
      note: 'POST JSON-RPC 2.0 to this URL. Send Authorization: Bearer <MCP_TOKEN>.',
    }, { headers: CORS });
  }
  return new NextResponse('Method Not Allowed — this MCP server is POST-only (Streamable HTTP, no SSE stream).', {
    status: 405, headers: CORS,
  });
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json(
      {
        jsonrpc: '2.0', id: null,
        error: {
          code: -32001,
          message: process.env.MCP_TOKEN
            ? 'Unauthorised. Send Authorization: Bearer <MCP_TOKEN>.'
            : 'MCP_TOKEN is not configured on the server, so all requests are refused. Set it in the deployment environment.',
        },
      },
      { status: 401, headers: CORS },
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch { return err(null, -32700, 'Parse error'); }

  /* Batches are legal JSON-RPC; handle them rather than 400-ing. */
  if (Array.isArray(body)) {
    const results = [];
    for (const m of body) {
      const r = await handle(m, req);
      if (r) results.push(r);
    }
    return NextResponse.json(results, { headers: CORS });
  }

  const result = await handle(body, req);
  /* Notifications get 202 with no body, per spec. */
  if (!result) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(result, { headers: CORS });
}

async function handle(msg: any, req: NextRequest): Promise<object | null> {
  const { method, id, params } = msg ?? {};
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'watcher-campaign-coach', version: '1.0.0' },
          /* Surfaced to clients that display it, so the operating rules
             travel with the connection rather than living only in a bot
             configuration someone has to remember to paste. */
          /* Both operating documents travel with the connection. The
             research loop is not optional context — a model that has the
             write tools but not the loop will save things nobody trusts. */
          instructions: `${COACH_SYSTEM_PROMPT}\n\n${RESEARCH_WORKFLOW}`,
        },
      };

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: mcpTools() } };

    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (!name) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'params.name required' } };
      const baseUrl = new URL(req.url).origin;
      try {
        const out = await callCoachTool(name, args, { baseUrl });
        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(out, null, 2).slice(0, 200_000) }],
            isError: false,
          },
        };
      } catch (e) {
        /* Tool errors are returned as isError content, not JSON-RPC errors:
           the model should see the failure and adapt, not have the call
           blow up the conversation. */
        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: `Tool "${name}" failed: ${String((e as Error).message)}` }],
            isError: true,
          },
        };
      }
    }

    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };

    default:
      if (isNotification) return null;
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}
