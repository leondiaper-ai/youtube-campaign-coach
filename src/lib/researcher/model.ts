/**
 * RESEARCHER — MODEL ADAPTER
 *
 * Model-agnostic reasoning layer. The Researcher's intelligence lives in our
 * tools and our knowledge store; this file is only the part that can be
 * swapped out.
 *
 * ── ON GROK SPECIFICALLY ──────────────────────────────────────────────
 * Checked at build time: there is no Grok/xAI connector in the MCP registry
 * available to this environment, and no xAI credential in the project. So
 * "Grok Bot drives our app" is not something that can be wired today without
 * assuming an integration that has not been shown to exist.
 *
 * What IS portable, and what this file implements, is the brief's own
 * fallback: a provider-agnostic adapter. xAI is supported first-class and
 * becomes the default the moment XAI_API_KEY is set — no code change. If
 * Grok Bot later gains the ability to call external tools, it can drive
 * POST /api/researcher/tools directly and this adapter is simply bypassed.
 * Either way the data and the accumulated findings stay in our system.
 *
 * xAI and OpenAI share the /v1/chat/completions wire format, so they share
 * one code path. Anthropic's Messages API differs enough to need its own.
 */

import { callTool, TOOL_SPECS, type ToolCtx } from './tools';

export type Provider = 'xai' | 'anthropic' | 'openai';

export interface ProviderConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Resolution order puts xAI first because the brief names Grok as the
 * intended reasoning colleague. It falls through to whatever is configured
 * so the system is never blocked on one vendor.
 */
export function resolveProvider(): ProviderConfig | null {
  const xai = process.env.XAI_API_KEY;
  if (xai) return {
    provider: 'xai', apiKey: xai,
    model: process.env.RESEARCHER_MODEL ?? 'grok-4',
    baseUrl: 'https://api.x.ai/v1',
  };
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return {
    provider: 'anthropic', apiKey: anthropic,
    model: process.env.RESEARCHER_MODEL ?? 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
  };
  const openai = process.env.OPENAI_API_KEY;
  if (openai) return {
    provider: 'openai', apiKey: openai,
    model: process.env.RESEARCHER_MODEL ?? 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
  };
  return null;
}

/* ── Tool schema translation ────────────────────────────────────────── */

function openAiTools() {
  return TOOL_SPECS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.args).map(([k, v]) => [k, { type: guessType(v), description: v }]),
        ),
      },
    },
  }));
}

function anthropicTools() {
  return TOOL_SPECS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(t.args).map(([k, v]) => [k, { type: guessType(v), description: v }]),
      ),
    },
  }));
}

function guessType(desc: string): string {
  if (/string\[\]/.test(desc)) return 'array';
  if (/boolean/.test(desc)) return 'boolean';
  if (/number|0-2/.test(desc)) return 'number';
  if (/object/.test(desc)) return 'object';
  return 'string';
}

/* ── Run loop ───────────────────────────────────────────────────────── */

export interface RunResult {
  text: string;
  toolCalls: { tool: string; ms: number; ok: boolean }[];
  provider: string;
  model: string;
}

const MAX_TURNS = 12;

/**
 * MAX_TURNS is a guard against a model looping on tool calls forever and
 * burning YouTube API quota, which is shared with the nightly cron. If a run
 * hits the ceiling it returns what it has rather than failing — a partial
 * answer with its tool trace is more useful than an error.
 */
export async function runResearch(
  system: string,
  userMessage: string,
  ctx: ToolCtx,
  cfg: ProviderConfig,
): Promise<RunResult> {
  const toolCalls: RunResult['toolCalls'] = [];
  const exec = async (name: string, args: Record<string, any>) => {
    const t0 = Date.now();
    try {
      const out = await callTool(name, args ?? {}, ctx);
      toolCalls.push({ tool: name, ms: Date.now() - t0, ok: true });
      return out;
    } catch (e) {
      toolCalls.push({ tool: name, ms: Date.now() - t0, ok: false });
      return { error: String((e as Error).message) };
    }
  };

  const text = cfg.provider === 'anthropic'
    ? await runAnthropic(system, userMessage, cfg, exec)
    : await runOpenAiCompatible(system, userMessage, cfg, exec);

  return { text, toolCalls, provider: cfg.provider, model: cfg.model };
}

type Exec = (name: string, args: Record<string, any>) => Promise<unknown>;

async function runOpenAiCompatible(
  system: string, user: string, cfg: ProviderConfig, exec: Exec,
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages, tools: openAiTools(), tool_choice: 'auto' }),
    });
    if (!r.ok) throw new Error(`${cfg.provider} ${r.status}: ${(await r.text()).slice(0, 400)}`);
    const j = await r.json();
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new Error(`${cfg.provider} returned no message`);
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (!calls.length) return msg.content ?? '';

    for (const c of calls) {
      let args: Record<string, any> = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* malformed args → empty */ }
      const out = await exec(c.function.name, args);
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out).slice(0, 120_000) });
    }
  }
  return '[Reached the tool-call ceiling before concluding. The trace above shows what was gathered.]';
}

async function runAnthropic(
  system: string, user: string, cfg: ProviderConfig, exec: Exec,
): Promise<string> {
  const messages: any[] = [{ role: 'user', content: user }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await fetch(`${cfg.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: 4096, system, messages, tools: anthropicTools() }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 400)}`);
    const j = await r.json();
    messages.push({ role: 'assistant', content: j.content });

    const uses = (j.content ?? []).filter((b: any) => b.type === 'tool_use');
    if (!uses.length) {
      return (j.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    }
    const results = [];
    for (const u of uses) {
      const out = await exec(u.name, u.input ?? {});
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 120_000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return '[Reached the tool-call ceiling before concluding. The trace above shows what was gathered.]';
}
