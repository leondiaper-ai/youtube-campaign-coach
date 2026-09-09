/**
 * KNOWLEDGE PERSISTENCE
 *
 * Redis, like everything else here. No new database.
 *
 * The important function is `isRepeat()`. Without it an investigator
 * rediscovers the same thing every run, and a system that repeats itself
 * is worse than no system — you stop reading it, and then you miss the one
 * run that had something.
 */

import { Redis } from '@upstash/redis';
import type { Finding, CaseStudy, FindingStatus, CaseStudyStatus } from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_FINDINGS = (subject: string) => `knowledge:findings:${subject}`;
const K_RECENT = 'knowledge:recent';
const K_CASE = 'knowledge:casestudies';

const MAX_PER_SUBJECT = 60;
const MAX_RECENT = 300;
const MAX_CASE = 500;

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Findings ────────────────────────────────────────────────────────── */

export async function listFindings(subjectId: string): Promise<Finding[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Finding[]>(K_FINDINGS(subjectId));
  return Array.isArray(raw) ? raw : [];
}

export async function listRecentFindings(limit = 20): Promise<Finding[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<Finding[]>(K_RECENT);
  return (Array.isArray(raw) ? raw : []).slice(0, limit);
}

export async function saveFinding(f: Finding): Promise<Finding> {
  const store = await kv();
  if (!store) return f;

  const mine = await listFindings(f.subjectId);
  await store.set(K_FINDINGS(f.subjectId), [f, ...mine.filter(x => x.id !== f.id)].slice(0, MAX_PER_SUBJECT));

  const recent = await listRecentFindings(MAX_RECENT);
  await store.set(K_RECENT, [f, ...recent.filter(x => x.id !== f.id)].slice(0, MAX_RECENT));
  return f;
}

export async function setFindingStatus(
  subjectId: string, id: string, status: FindingStatus,
): Promise<Finding | null> {
  const store = await kv();
  if (!store) return null;
  const mine = await listFindings(subjectId);
  const hit = mine.find(f => f.id === id);
  if (!hit) return null;
  const updated = { ...hit, status, updatedAt: new Date().toISOString() };
  await store.set(K_FINDINGS(subjectId), mine.map(f => (f.id === id ? updated : f)));
  const recent = await listRecentFindings(MAX_RECENT);
  await store.set(K_RECENT, recent.map(f => (f.id === id ? updated : f)));
  return updated;
}

/* ── Novelty ─────────────────────────────────────────────────────────── */

/**
 * Compares on TRIGGER KIND rather than on the wording of the finding: a
 * model will phrase the same observation differently every time, so text
 * comparison lets repeats through, and what has genuinely not changed is
 * whatever prompted the look.
 *
 * A DISMISSED finding suppresses for longer. If a human has said "not
 * interesting", raising it again in a fortnight is not diligence.
 */
export async function isRepeat(
  subjectId: string, triggerKind: string, now = Date.now(),
): Promise<{ repeat: boolean; findingId?: string; detail?: string }> {
  const mine = await listFindings(subjectId);
  for (const f of mine) {
    if (f.trigger.kind !== triggerKind) continue;
    const ageDays = (now - new Date(f.createdAt).getTime()) / 86400_000;
    const window = f.status === 'DISMISSED' ? 90 : 30;
    if (ageDays <= window) {
      return {
        repeat: true,
        findingId: f.id,
        detail: `${triggerKind} already reported ${Math.round(ageDays)} days ago (${f.status}): "${f.headline}"`,
      };
    }
  }
  return { repeat: false };
}

/* ── Case studies ────────────────────────────────────────────────────── */

export async function listCaseStudies(): Promise<CaseStudy[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<CaseStudy[]>(K_CASE);
  return Array.isArray(raw) ? raw : [];
}

export async function saveCaseStudy(c: CaseStudy): Promise<CaseStudy> {
  const store = await kv();
  if (!store) return c;
  const all = await listCaseStudies();
  await store.set(K_CASE, [c, ...all.filter(x => x.id !== c.id)].slice(0, MAX_CASE));
  return c;
}

export async function setCaseStudyStatus(
  id: string, status: CaseStudyStatus,
): Promise<CaseStudy | null> {
  const store = await kv();
  if (!store) return null;
  const all = await listCaseStudies();
  const hit = all.find(c => c.id === id);
  if (!hit) return null;
  const updated = { ...hit, status, lastReviewedAt: new Date().toISOString() };
  await store.set(K_CASE, all.map(c => (c.id === id ? updated : c)));
  return updated;
}

/** Substring search over the fields a strategist would actually search. */
export async function searchCaseStudies(query: string): Promise<CaseStudy[]> {
  const q = query.toLowerCase().trim();
  const all = await listCaseStudies();
  if (!q) return all;
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  return all
    .map(c => {
      const hay = [
        c.title, c.behaviourObserved, c.whyInteresting, c.possibleLearning,
        c.whyNotObvious, c.subject, ...c.sequence,
      ].join(' ').toLowerCase();
      return { c, hits: terms.filter(t => hay.includes(t)).length };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(x => x.c);
}
