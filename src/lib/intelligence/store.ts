/**
 * INTELLIGENCE PERSISTENCE
 *
 * Redis, like everything else here. No new database.
 *
 * The important function in this file is `isRepeat()`. Without it the
 * assistant tells you the same thing every morning, and an assistant that
 * repeats itself is worse than no assistant — you stop reading it, and then
 * you miss the one morning it had something.
 */

import { Redis } from '@upstash/redis';
import type {
  IntelligenceFinding, CaseStudyCandidate, MorningRun, FindingStatus, CaseStudyStatus,
} from './types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_FINDINGS = (slug: string) => `intel:findings:${slug}`;
const K_RECENT = 'intel:recent';
const K_CASE = 'intel:casestudies';
const K_RUN = (id: string) => `intel:run:${id}`;
const K_RUNS = 'intel:runs';

const MAX_PER_ARTIST = 60;
const MAX_RECENT = 200;
const MAX_CASE = 300;
const MAX_RUNS = 30;

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Findings ────────────────────────────────────────────────────────── */

export async function listFindings(slug: string): Promise<IntelligenceFinding[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<IntelligenceFinding[]>(K_FINDINGS(slug));
  return Array.isArray(raw) ? raw : [];
}

/** Newest-first across the whole roster. What the Watcher section renders. */
export async function listRecentFindings(limit = 20): Promise<IntelligenceFinding[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<IntelligenceFinding[]>(K_RECENT);
  return (Array.isArray(raw) ? raw : []).slice(0, limit);
}

export async function saveFinding(f: IntelligenceFinding): Promise<IntelligenceFinding> {
  const store = await kv();
  if (!store) return f;

  const mine = await listFindings(f.artistId);
  const next = [f, ...mine.filter(x => x.id !== f.id)].slice(0, MAX_PER_ARTIST);
  await store.set(K_FINDINGS(f.artistId), next);

  const recent = await listRecentFindings(MAX_RECENT);
  await store.set(K_RECENT, [f, ...recent.filter(x => x.id !== f.id)].slice(0, MAX_RECENT));
  return f;
}

export async function setFindingStatus(
  slug: string, id: string, status: FindingStatus,
): Promise<IntelligenceFinding | null> {
  const store = await kv();
  if (!store) return null;
  const mine = await listFindings(slug);
  const hit = mine.find(f => f.id === id);
  if (!hit) return null;
  const updated = { ...hit, status, updatedAt: new Date().toISOString() };
  await store.set(K_FINDINGS(slug), mine.map(f => (f.id === id ? updated : f)));
  const recent = await listRecentFindings(MAX_RECENT);
  await store.set(K_RECENT, recent.map(f => (f.id === id ? updated : f)));
  return updated;
}

/* ── Novelty ─────────────────────────────────────────────────────────── */

/**
 * Two artists' worth of the same signal type inside the window counts as a
 * repeat. We deliberately compare on SIGNAL TYPE rather than on the wording
 * of the finding: the model will phrase the same observation differently
 * every time, so text comparison would let repeats through, and the thing
 * that has genuinely not changed is what triggered the look.
 *
 * A DISMISSED finding suppresses for longer. If a human has said "not
 * interesting", raising it again in a fortnight is not diligence.
 */
export async function isRepeat(
  slug: string, signalType: string, now = Date.now(),
): Promise<{ repeat: boolean; findingId?: string; detail?: string }> {
  const mine = await listFindings(slug);
  for (const f of mine) {
    if (f.signal.type !== signalType) continue;
    const ageDays = (now - new Date(f.createdAt).getTime()) / 86400_000;
    const window = f.status === 'DISMISSED' ? 60 : 14;
    if (ageDays <= window) {
      return {
        repeat: true,
        findingId: f.id,
        detail: `${signalType} already reported ${Math.round(ageDays)} days ago (${f.status}): "${f.headline}"`,
      };
    }
  }
  return { repeat: false };
}

/** 0–1. Feeds the deterministic priority score. */
export async function noveltyScore(slug: string, signalType: string): Promise<number> {
  const r = await isRepeat(slug, signalType);
  if (r.repeat) return 0;
  const mine = await listFindings(slug);
  const recent = mine.filter(
    f => (Date.now() - new Date(f.createdAt).getTime()) / 86400_000 <= 14,
  ).length;
  /* Any recent finding on this artist reduces novelty a little, even a
     different signal — the strategist has looked at them lately. */
  return Math.max(0.3, 1 - recent * 0.2);
}

/* ── Case studies ────────────────────────────────────────────────────── */

export async function listCaseStudies(): Promise<CaseStudyCandidate[]> {
  const store = await kv();
  if (!store) return [];
  const raw = await store.get<CaseStudyCandidate[]>(K_CASE);
  return Array.isArray(raw) ? raw : [];
}

export async function saveCaseStudy(c: CaseStudyCandidate): Promise<CaseStudyCandidate> {
  const store = await kv();
  if (!store) return c;
  const all = await listCaseStudies();
  await store.set(K_CASE, [c, ...all.filter(x => x.id !== c.id)].slice(0, MAX_CASE));
  return c;
}

export async function setCaseStudyStatus(
  id: string, status: CaseStudyStatus,
): Promise<CaseStudyCandidate | null> {
  const store = await kv();
  if (!store) return null;
  const all = await listCaseStudies();
  const hit = all.find(c => c.id === id);
  if (!hit) return null;
  const updated = { ...hit, status, updatedAt: new Date().toISOString() };
  await store.set(K_CASE, all.map(c => (c.id === id ? updated : c)));
  return updated;
}

/**
 * Backs "show me our strongest Shorts case studies" without a search index —
 * substring match over the fields a strategist would actually search.
 */
export async function searchCaseStudies(query: string): Promise<CaseStudyCandidate[]> {
  const q = query.toLowerCase().trim();
  if (!q) return listCaseStudies();
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  const all = await listCaseStudies();
  return all
    .map(c => {
      const hay = [
        c.title, c.behaviourObserved, c.whyInteresting, c.potentialLearning,
        c.principleName ?? '', c.artistName, ...c.applicableTo,
      ].join(' ').toLowerCase();
      return { c, hits: terms.filter(t => hay.includes(t)).length };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(x => x.c);
}

/* ── Runs ────────────────────────────────────────────────────────────── */

export async function saveRun(run: MorningRun): Promise<void> {
  const store = await kv();
  if (!store) return;
  await store.set(K_RUN(run.runId), run);
  const ids = (await store.get<string[]>(K_RUNS)) ?? [];
  await store.set(K_RUNS, [run.runId, ...ids.filter(i => i !== run.runId)].slice(0, MAX_RUNS));
}

export async function readRun(runId: string): Promise<MorningRun | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<MorningRun>(K_RUN(runId))) ?? null;
}

export async function latestRun(): Promise<MorningRun | null> {
  const store = await kv();
  if (!store) return null;
  const ids = (await store.get<string[]>(K_RUNS)) ?? [];
  if (!ids.length) return null;
  return readRun(ids[0]);
}
