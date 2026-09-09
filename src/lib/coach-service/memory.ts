/**
 * CAMPAIGN MEMORY
 *
 * What the campaign has LEARNED and DECIDED, as opposed to what was said in
 * a conversation. Survives sessions; survives people leaving the team.
 *
 * ── SESSION MEMORY vs CAMPAIGN MEMORY ─────────────────────────────────
 * Session memory is a scratchpad with a four-hour life. This is the record.
 * The boundary between them is the single most important design decision
 * here, because the cheap version of this feature — persist the chat — would
 * fill the campaign record with conversational debris and make it worthless
 * within a fortnight. A question asked and answered is not knowledge.
 *
 * So promotion is EXPLICIT and NARROW. Something enters campaign memory only
 * when it is one of the kinds below, and only when the Coach or a human
 * deliberately promotes it. Nothing is saved automatically.
 *
 * ── WHY NOT A PARALLEL STORE ──────────────────────────────────────────
 * `coach-bot/store.ts` already persists recommendations and the human verdicts
 * on them, and the review UI at /coach-bot reads it. Recommendations recorded
 * here write THROUGH to that store rather than beside it, so approving one in
 * the existing UI still works and there is one place a recommendation lives.
 * This file adds the kinds that store has no shape for — findings, hypotheses
 * and the decisions taken about them.
 */

import { Redis } from '@upstash/redis';
import { saveRecommendation, type CoachRecommendation } from '../coach-bot/store';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* ── Shape ──────────────────────────────────────────────────────────── */

/**
 * FINDING        observed, supported by data. The strongest claim available.
 * INTERPRETATION reasoned from evidence. Defensible, not measured.
 * HYPOTHESIS     plausible and UNTESTED. Must never harden into a finding.
 * RECOMMENDATION a proposed action. Mirrored into the recommendations store.
 * DECISION       what a human actually chose. The only kind a model may not author.
 * OUTCOME        what happened afterwards. Empty until someone measures it.
 * CONTEXT        campaign fact the system could not otherwise know.
 */
export type MemoryKind =
  | 'FINDING' | 'INTERPRETATION' | 'HYPOTHESIS'
  | 'RECOMMENDATION' | 'DECISION' | 'OUTCOME' | 'CONTEXT';

export const MEMORY_KINDS: MemoryKind[] = [
  'FINDING', 'INTERPRETATION', 'HYPOTHESIS', 'RECOMMENDATION', 'DECISION', 'OUTCOME', 'CONTEXT',
];

export type MemoryStatus = 'UNTESTED' | 'TESTING' | 'SUPPORTED' | 'CONTRADICTED' | 'RETIRED';

export type HumanDecision = 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export interface CampaignMemoryItem {
  id: string;
  artistId: string;
  campaignId: string | null;
  kind: MemoryKind;
  /** One sentence. Long entries are a sign something conversational slipped in. */
  text: string;
  /** Tool, video id or date range that supports it. */
  sourceRef?: string | null;
  status: MemoryStatus;
  /** Set only when a human decides. Never written by the model. */
  humanDecision?: HumanDecision | null;
  decisionNote?: string | null;
  /** Filled in later, when there is something to measure. */
  outcome?: string | null;
  /** Which memory item this responds to — links a decision to its recommendation. */
  relatesTo?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 'coach' or a human identifier. Provenance matters for trust. */
  createdBy: string;
  sessionId?: string | null;
}

const K = (slug: string) => `coach:memory:${slug}`;
const MAX_PER_ARTIST = 200;

export function newMemoryId(): string {
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Read / write ───────────────────────────────────────────────────── */

export async function listMemory(artistId: string): Promise<CampaignMemoryItem[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<CampaignMemoryItem[]>(K(artistId));
  return Array.isArray(raw) ? raw : [];
}

export async function saveMemory(item: CampaignMemoryItem): Promise<CampaignMemoryItem> {
  const store = await kv();
  if (!store) return item;
  const all = await listMemory(item.artistId);
  const i = all.findIndex(x => x.id === item.id);
  if (i >= 0) all[i] = item; else all.unshift(item);
  await store.set(K(item.artistId), all.slice(0, MAX_PER_ARTIST));

  /* Recommendations also land in the existing store so the review queue and
     the approve/modify/reject flow keep working unchanged. */
  if (item.kind === 'RECOMMENDATION') {
    const rec: CoachRecommendation = {
      id: item.id,
      createdAt: item.createdAt,
      artistSlug: item.artistId,
      artistName: item.artistId,
      campaignName: item.campaignId,
      campaignDay: null,
      phase: null,
      status: 'OPPORTUNITY',
      whatHappened: '(promoted from a Coach conversation)',
      soWhat: '',
      recommendation: item.text,
      when: '',
      evidence: item.sourceRef ?? '',
      evidenceClasses: ['RETROSPECTIVE_ARCHITECTURE'],
      confidence: 'MEDIUM',
      nextCheck: '',
      missingEvidence: 'Promoted from conversation; see the session for full evidence.',
      producedBy: item.createdBy,
    };
    await saveRecommendation(rec).catch(() => { /* memory write already succeeded */ });
  }
  return item;
}

export async function recordMemory(args: {
  artistId: string;
  campaignId?: string | null;
  kind: MemoryKind;
  text: string;
  sourceRef?: string | null;
  status?: MemoryStatus;
  relatesTo?: string | null;
  createdBy?: string;
  sessionId?: string | null;
}): Promise<CampaignMemoryItem> {
  const now = new Date().toISOString();
  const item: CampaignMemoryItem = {
    id: newMemoryId(),
    artistId: args.artistId,
    campaignId: args.campaignId ?? null,
    kind: args.kind,
    text: args.text.trim(),
    sourceRef: args.sourceRef ?? null,
    /* A hypothesis is born untested and stays that way until someone says
       otherwise. Defaulting anything else would be the quiet path to a guess
       being treated as knowledge. */
    status: args.status ?? (args.kind === 'HYPOTHESIS' ? 'UNTESTED' : 'SUPPORTED'),
    humanDecision: null,
    decisionNote: null,
    outcome: null,
    relatesTo: args.relatesTo ?? null,
    createdAt: now,
    updatedAt: now,
    createdBy: args.createdBy ?? 'coach',
    sessionId: args.sessionId ?? null,
  };
  return saveMemory(item);
}

/** A human accepting, modifying or rejecting. Not available to the model. */
export async function recordDecision(args: {
  artistId: string;
  memoryId: string;
  decision: HumanDecision;
  note?: string;
}): Promise<CampaignMemoryItem | null> {
  const all = await listMemory(args.artistId);
  const item = all.find(x => x.id === args.memoryId);
  if (!item) return null;
  item.humanDecision = args.decision;
  item.decisionNote = args.note ?? null;
  item.status = args.decision === 'REJECTED' ? 'RETIRED' : item.status;
  item.updatedAt = new Date().toISOString();
  return saveMemory(item);
}

/* ── Recall ─────────────────────────────────────────────────────────── */

/**
 * Rendered into the prompt at the START of a session, so a new conversation
 * opens already knowing what the campaign has learned and decided. This is
 * the difference between "ask an analyst again" and "the workspace knows".
 *
 * Ordered by usefulness rather than recency: decisions first, because "what
 * did we agree" is the question this exists to answer.
 */
export function buildMemoryContext(items: CampaignMemoryItem[]): string {
  const live = items.filter(i => i.status !== 'RETIRED');
  if (!live.length) return '';

  const pick = (k: MemoryKind) => live.filter(i => i.kind === k);
  const lines: string[] = ['═══ WHAT THIS CAMPAIGN HAS ALREADY ESTABLISHED ═══', ''];

  const decided = live.filter(i => i.humanDecision);
  if (decided.length) {
    lines.push('DECIDED BY THE TEAM:');
    for (const d of decided.slice(0, 8)) {
      lines.push(`· [${d.humanDecision}] ${d.text}${d.decisionNote ? ` — ${d.decisionNote}` : ''}`);
    }
    lines.push('');
  }

  const recs = pick('RECOMMENDATION').filter(i => !i.humanDecision);
  if (recs.length) {
    lines.push('PROPOSED, AWAITING A HUMAN DECISION:');
    for (const r of recs.slice(0, 6)) lines.push(`· ${r.text}`);
    lines.push('');
  }

  const findings = [...pick('FINDING'), ...pick('INTERPRETATION'), ...pick('CONTEXT')];
  if (findings.length) {
    lines.push('KNOWN ABOUT THIS CAMPAIGN:');
    for (const f of findings.slice(0, 10)) {
      lines.push(`· [${f.kind}] ${f.text}${f.sourceRef ? ` (${f.sourceRef})` : ''}`);
    }
    lines.push('');
  }

  const hyps = pick('HYPOTHESIS');
  if (hyps.length) {
    lines.push('OPEN HYPOTHESES — untested. Do not present these as established:');
    for (const h of hyps.slice(0, 8)) lines.push(`· [${h.status}] ${h.text}`);
    lines.push('');
  }

  const outcomes = pick('OUTCOME');
  if (outcomes.length) {
    lines.push('OUTCOMES RECORDED:');
    for (const o of outcomes.slice(0, 6)) lines.push(`· ${o.text}`);
    lines.push('');
  }

  return lines.join('\n');
}
