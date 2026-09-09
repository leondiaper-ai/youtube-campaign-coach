/**
 * CAMPAIGN COACH — RECOMMENDATION + FEEDBACK STORE
 *
 * Recommendations and the human verdicts on them live in OUR system, keyed
 * by artist, so the Coach can be asked "what did I previously reject about
 * this campaign and why" and get a real answer rather than relying on a
 * model's conversation memory.
 *
 * That recall is the point. A coaching system that forgets it was overruled
 * last week will make the same call again, and the team will stop reading it.
 */

import { Redis } from '@upstash/redis';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export type CoachStatus = 'ON_TRACK' | 'WATCH' | 'ACTION_REQUIRED' | 'OPPORTUNITY' | 'RISK';
export type CoachConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type Decision = 'approve' | 'modify' | 'reject';

export interface CoachRecommendation {
  id: string;
  createdAt: string;
  artistSlug: string;
  artistName: string;
  campaignName: string | null;
  campaignDay: number | null;
  phase: string | null;

  status: CoachStatus;
  whatHappened: string;
  soWhat: string;
  recommendation: string;
  when: string;
  evidence: string;
  /** Which evidence classes the reasoning rested on. */
  evidenceClasses: string[];
  confidence: CoachConfidence;
  nextCheck: string;
  /** What the Coach knows it could not see. Required. */
  missingEvidence: string;

  producedBy: string;
  feedback?: CoachFeedback;
}

export interface CoachFeedback {
  decision: Decision;
  reason: string;
  /** What the Coach did not know. The most valuable field in the system. */
  missingContext?: string;
  /** Testable statement derived from the correction — NOT yet a rule. */
  candidateLearning?: string;
  modifiedRecommendation?: string;
  at: string;
}

const K_ALL = 'coach:recs';
const K_BY_ARTIST = (slug: string) => `coach:recs:${slug}`;
const MAX_PER_ARTIST = 100;
const MAX_ALL = 500;

export async function listRecommendations(artistSlug?: string): Promise<CoachRecommendation[]> {
  const store = await kv();
  if (!store) return [];
  const key = artistSlug ? K_BY_ARTIST(artistSlug) : K_ALL;
  const raw = await store.get<CoachRecommendation[]>(key);
  return Array.isArray(raw) ? raw : [];
}

export async function saveRecommendation(rec: CoachRecommendation): Promise<void> {
  const store = await kv();
  if (!store) return;
  /* Written to both an all-recs list and a per-artist list. The per-artist
     key is what makes "what did I reject for this campaign" a single read
     rather than a scan of everything. */
  const all = await listRecommendations();
  const mine = await listRecommendations(rec.artistSlug);
  const upsert = (arr: CoachRecommendation[], max: number) => {
    const i = arr.findIndex(x => x.id === rec.id);
    if (i >= 0) arr[i] = rec; else arr.unshift(rec);
    return arr.slice(0, max);
  };
  await store.set(K_ALL, upsert(all, MAX_ALL));
  await store.set(K_BY_ARTIST(rec.artistSlug), upsert(mine, MAX_PER_ARTIST));
}

export async function getRecommendation(id: string): Promise<CoachRecommendation | null> {
  const all = await listRecommendations();
  return all.find(r => r.id === id) ?? null;
}

/**
 * Records a human verdict.
 *
 * A rejection does NOT become a rule. It is stored as context attached to
 * this campaign, and its candidateLearning is explicitly marked untested.
 * The brief is right about this: the reviewer may be correct for a reason
 * that does not generalise ("Single 2 is six days away" is true this week
 * and irrelevant next month), and promoting that into a universal
 * constraint would quietly degrade every future recommendation.
 */
export async function recordCoachFeedback(
  id: string,
  fb: CoachFeedback,
): Promise<CoachRecommendation | null> {
  const rec = await getRecommendation(id);
  if (!rec) return null;
  rec.feedback = fb;
  if (fb.decision === 'modify' && fb.modifiedRecommendation) {
    rec.recommendation = fb.modifiedRecommendation;
  }
  await saveRecommendation(rec);
  return rec;
}
