/**
 * THE KNOWLEDGE INBOX
 *
 * A gate between "the system noticed something" and "the system believes
 * something".
 *
 * ── WHY A GATE AT ALL ────────────────────────────────────────────────
 * A Campaign Read is disposable: it describes this week, it is read once,
 * and next week's replaces it. Nothing is lost if it is slightly wrong.
 *
 * A retained belief is not disposable. It becomes context for future reads,
 * it shapes what Scout looks for, and it will eventually be quoted in a
 * deck. A wrong one does not stay wrong in one place — it propagates, and
 * by the time anyone notices, the original evidence is gone.
 *
 * So ordinary reads bypass this entirely. This gate is only for claims that
 * would influence FUTURE campaigns rather than describe the current one.
 *
 * ── ON SUPERSEDED ────────────────────────────────────────────────────
 * Deleting a belief that turned out to be wrong destroys the most useful
 * record in the system: that we believed it, on what basis, and what
 * changed our mind. SUPERSEDED keeps the chain, which is what makes the
 * knowledge base an argument rather than a list of assertions.
 */

import { Redis } from '@upstash/redis';
import type { EvidenceRecord, EvidenceClass } from './evidence';
import type { CoachConfidence } from '../coach-service/types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K = 'knowledge:inbox';
const MAX = 500;

export type ItemStatus = 'CANDIDATE' | 'RETAINED' | 'WATCHING' | 'REJECTED' | 'SUPERSEDED';

/** What kind of thing the system is claiming to know. */
export type KnowledgeKind =
  | 'ARTIST' | 'CAMPAIGN' | 'CASE_STUDY' | 'BEST_PRACTICE' | 'HYPOTHESIS' | 'LEARNING';

export const KNOWLEDGE_KINDS: KnowledgeKind[] = [
  'ARTIST', 'CAMPAIGN', 'CASE_STUDY', 'BEST_PRACTICE', 'HYPOTHESIS', 'LEARNING',
];

export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  /** One sentence. What the system would claim to know. */
  statement: string;
  /** Roster slug or channelId, when the claim is about someone specific. */
  subjectId: string | null;
  subjectName: string | null;

  /** The strongest class among its evidence — see `basisClass()`. */
  evidenceClass: EvidenceClass;
  evidence: EvidenceRecord[];
  confidence: CoachConfidence;

  status: ItemStatus;
  /** Set when SUPERSEDED — the item that replaced this one. */
  supersededBy: string | null;
  /** Set when this item replaced another. */
  supersedes: string | null;

  origin: 'SCOUT' | 'CAMPAIGN_READ' | 'COACH' | 'HUMAN';
  sourceRef: string;
  createdAt: string;
  lastUpdatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/**
 * The class of a claim is the WEAKEST of its supporting evidence, not the
 * strongest. A conclusion resting on one observation and one guess is a
 * guess with a citation attached.
 */
export function basisClass(evidence: EvidenceRecord[]): EvidenceClass {
  if (!evidence.length) return 'INFERRED';
  if (evidence.some(e => e.evidenceClass === 'INFERRED')) return 'INFERRED';
  if (evidence.some(e => e.evidenceClass === 'DERIVED')) return 'DERIVED';
  if (evidence.some(e => e.evidenceClass === 'HUMAN')) return 'HUMAN';
  return 'OBSERVED';
}

export function newItemId(): string {
  return `kn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<KnowledgeItem[]>(K);
  return Array.isArray(raw) ? raw : [];
}

export async function saveKnowledge(item: KnowledgeItem): Promise<KnowledgeItem> {
  const store = await kv();
  if (!store) return item;
  const all = await listKnowledge();
  await store.set(K, [item, ...all.filter(i => i.id !== item.id)].slice(0, MAX));
  return item;
}

/**
 * Proposes a claim. Always enters as CANDIDATE — there is no path that
 * writes RETAINED directly, which is the entire point of the module.
 */
export async function propose(args: {
  kind: KnowledgeKind;
  statement: string;
  subjectId?: string | null;
  subjectName?: string | null;
  evidence: EvidenceRecord[];
  confidence: CoachConfidence;
  origin: KnowledgeItem['origin'];
  sourceRef: string;
}): Promise<KnowledgeItem> {
  const now = new Date().toISOString();
  return saveKnowledge({
    id: newItemId(),
    kind: args.kind,
    statement: args.statement.trim(),
    subjectId: args.subjectId ?? null,
    subjectName: args.subjectName ?? null,
    evidenceClass: basisClass(args.evidence),
    evidence: args.evidence,
    confidence: args.confidence,
    status: 'CANDIDATE',
    supersededBy: null,
    supersedes: null,
    origin: args.origin,
    sourceRef: args.sourceRef,
    createdAt: now,
    lastUpdatedAt: now,
    reviewedAt: null,
    reviewNote: null,
  });
}

/**
 * Human review. The only route to RETAINED.
 *
 * Retaining an INFERRED claim promotes its class to LEARNED — a deliberate,
 * attributable act with a timestamp and a note, which is exactly the
 * distinction between a belief we chose to hold and one that leaked in.
 */
export async function review(
  id: string, status: ItemStatus, note?: string,
): Promise<KnowledgeItem | null> {
  const all = await listKnowledge();
  const item = all.find(i => i.id === id);
  if (!item) return null;

  const promoted: EvidenceClass =
    status === 'RETAINED' && item.evidenceClass === 'INFERRED' ? 'LEARNED' : item.evidenceClass;

  return saveKnowledge({
    ...item,
    status,
    evidenceClass: promoted,
    reviewedAt: new Date().toISOString(),
    reviewNote: note ?? item.reviewNote,
    lastUpdatedAt: new Date().toISOString(),
  });
}

/** Replaces a belief while keeping the chain intact. */
export async function supersede(
  oldId: string, replacement: Omit<Parameters<typeof propose>[0], never>,
): Promise<{ old: KnowledgeItem | null; next: KnowledgeItem }> {
  const next = await propose(replacement);
  const all = await listKnowledge();
  const old = all.find(i => i.id === oldId) ?? null;
  if (old) {
    await saveKnowledge({
      ...old, status: 'SUPERSEDED', supersededBy: next.id,
      lastUpdatedAt: new Date().toISOString(),
    });
  }
  await saveKnowledge({ ...next, supersedes: oldId });
  return { old, next };
}

/* ══ Human correction ════════════════════════════════════════════════ */

/**
 * A factual correction and a preference judgement are stored separately and
 * on purpose.
 *
 * "Not useful" means the output was accurate and I did not want it — a
 * signal about relevance. "Incorrect" means the system asserted something
 * false, and that must survive and be respected, because rediscovering the
 * same error every month is how a system loses trust permanently.
 *
 * Nothing is trained from either. They are recorded so that a later run can
 * check them and so that the error rate is measurable rather than felt.
 */
export type FeedbackKind = 'USEFUL' | 'NOT_USEFUL' | 'INCORRECT' | 'KEEP';

export interface Feedback {
  id: string;
  /** What was judged — a read id, finding id, knowledge item id. */
  targetId: string;
  targetType: 'CAMPAIGN_READ' | 'SCOUT_FINDING' | 'KNOWLEDGE' | 'CASE_STUDY';
  subjectId: string | null;
  kind: FeedbackKind;
  /** Required for INCORRECT: what is actually true. */
  correction: string | null;
  note: string | null;
  createdAt: string;
}

const K_FEEDBACK = 'knowledge:feedback';
const K_CORRECTIONS = 'knowledge:corrections';

export async function recordFeedback(args: {
  targetId: string;
  targetType: Feedback['targetType'];
  subjectId?: string | null;
  kind: FeedbackKind;
  correction?: string;
  note?: string;
}): Promise<Feedback> {
  const store = await kv();
  const fb: Feedback = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    targetId: args.targetId,
    targetType: args.targetType,
    subjectId: args.subjectId ?? null,
    kind: args.kind,
    correction: args.kind === 'INCORRECT' ? (args.correction ?? null) : null,
    note: args.note ?? null,
    createdAt: new Date().toISOString(),
  };
  if (!store) return fb;

  const all = (await store.get<Feedback[]>(K_FEEDBACK)) ?? [];
  await store.set(K_FEEDBACK, [fb, ...all].slice(0, 1000));

  /* Corrections are indexed separately by subject so a future run can ask
     "what have I been told is wrong about this artist" in one read, rather
     than scanning every piece of feedback ever given. */
  if (fb.kind === 'INCORRECT' && fb.subjectId) {
    const key = `${K_CORRECTIONS}:${fb.subjectId}`;
    const prior = (await store.get<Feedback[]>(key)) ?? [];
    await store.set(key, [fb, ...prior].slice(0, 50));
  }
  return fb;
}

/**
 * Corrections for one subject, for injection into a later prompt. This is
 * the mechanism that stops the system rediscovering a known mistake.
 */
export async function correctionsFor(subjectId: string): Promise<Feedback[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Feedback[]>(`${K_CORRECTIONS}:${subjectId}`);
  return Array.isArray(raw) ? raw : [];
}

export async function listFeedback(limit = 100): Promise<Feedback[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Feedback[]>(K_FEEDBACK);
  return (Array.isArray(raw) ? raw : []).slice(0, limit);
}
