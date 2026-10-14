/* Verdicts on suggestions, §7.
 *
 * Four verdicts, and the two negative ones are deliberately different:
 *
 *   useful      worth acting on.
 *   obvious     true, but we already knew — the tool added nothing.
 *   unsuitable  the editorial judgement is wrong.
 *   unsupported the evidence does not justify the claim being made.
 *
 * "Obvious" and "unsupported" are the two that tell us the tool is failing,
 * and they fail in opposite directions: one is too timid to be worth running,
 * the other overclaims. Collapsing them into a thumbs-down would lose exactly
 * the signal needed to fix it.
 */

export type Verdict = 'useful' | 'obvious' | 'unsuitable' | 'unsupported';
export const VERDICT_LABEL: Record<Verdict, string> = {
  useful: 'Useful', obvious: 'Obvious', unsuitable: 'Unsuitable', unsupported: 'Unsupported',
};
export const VERDICT_MEANING: Record<Verdict, string> = {
  useful: 'Worth acting on.',
  obvious: 'True, but already known — the tool added nothing.',
  unsuitable: 'The editorial judgement is wrong.',
  unsupported: 'The evidence shown does not justify the claim.',
};

export interface FeedbackEntry {
  id: string; verdict: Verdict; note?: string; at: string;
}

const kv = async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try { const { Redis } = await import('@upstash/redis'); return new Redis({ url, token }); }
  catch { return null; }
};
const KEY = 'mw:feedback';

export async function readFeedback(): Promise<Record<string, FeedbackEntry>> {
  const r = await kv(); if (!r) return {};
  const raw = await r.get(KEY).catch(() => null);
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as any); } catch { return {}; }
}

export async function writeFeedback(e: FeedbackEntry) {
  const r = await kv(); if (!r) return false;
  const all = await readFeedback();
  all[e.id] = e;
  await r.set(KEY, JSON.stringify(all));
  return true;
}

/** Counts by verdict, so the pilot can be judged rather than admired. */
export function tally(all: Record<string, FeedbackEntry>) {
  const t: Record<Verdict, number> = { useful: 0, obvious: 0, unsuitable: 0, unsupported: 0 };
  Object.values(all).forEach(e => { if (t[e.verdict] != null) t[e.verdict]++; });
  return t;
}
