/**
 * CAMPAIGN READS AS OBJECTS
 *
 * A read used to be a `CoachOverview` in a cache key — a transient model
 * response that the next run overwrote. That is fine for a status line and
 * useless for anything else: you cannot ask what the read was based on, you
 * cannot tell an observation from an interpretation inside it, and you
 * cannot tell whether a human has already looked at it and disagreed.
 *
 * So a read is now a record with provenance, and the old shape is derived
 * from it for the surfaces that already consume it.
 *
 * ── evidenceAsOf VS generatedAt ──────────────────────────────────────
 * Two different times, and conflating them is how a system claims to be
 * current while reasoning about last month. `generatedAt` is when the model
 * wrote the sentence. `evidenceAsOf` is when the underlying catalogue was
 * actually read. A read regenerated from a cached catalogue is new prose
 * about old facts, and only the second field exposes that.
 */

import { Redis } from '@upstash/redis';
import type { EvidenceRecord } from '../knowledge/evidence';
import type { CoachOverview, CoachStatus, CoachConfidence } from '../coach-service/types';

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_READ = (slug: string) => `read:${slug}`;
const K_HISTORY = (slug: string) => `read:history:${slug}`;
const MAX_HISTORY = 12;

/** The four states the read may emit. RISK is gone — see read.ts. */
export type ReadStatus = 'ON_TRACK' | 'WATCH' | 'OPPORTUNITY' | 'ACTION_REQUIRED';

export type HumanReviewStatus = 'UNREVIEWED' | 'USEFUL' | 'NOT_USEFUL' | 'INCORRECT';

export interface CampaignRead {
  id: string;
  artistId: string;
  artistName: string;
  campaignName: string | null;

  generatedAt: string;
  /** When the underlying catalogue was actually read. Not the same thing. */
  evidenceAsOf: string;

  /** Directly observed: upload dates, ids, titles, lifetime views. */
  observedEvidence: EvidenceRecord[];
  /** Deterministically computed: formats, heroes, windows, gaps. */
  derivedEvidence: EvidenceRecord[];

  read: string;
  /** What differs from this artist's own previous release. */
  whatChanged: string;
  status: ReadStatus;
  nextAction: string | null;
  watchFor: string | null;

  /** Video ids, store keys, tool names — anything re-checkable. */
  sourceReferences: string[];
  /** What this read could not see. Never empty. */
  limitations: string[];

  confidence: CoachConfidence;
  /** Set when the gate capped a stated confidence, with the reason. */
  confidenceCappedBecause: string | null;

  model: string;
  promptVersion: string;

  humanReviewStatus: HumanReviewStatus;
  humanNote: string | null;
  reviewedAt: string | null;
}

/* ── Persistence ─────────────────────────────────────────────────────── */

export async function readCampaignRead(slug: string): Promise<CampaignRead | null> {
  const store = await kv();
  if (!store) return null;
  return (await store.get<CampaignRead>(K_READ(slug))) ?? null;
}

export async function saveCampaignRead(r: CampaignRead): Promise<CampaignRead> {
  const store = await kv();
  if (!store) return r;

  /* Keep the previous read before overwriting. A read that contradicts
     last week's is the most interesting thing the system can produce, and
     it is invisible if each one destroys its predecessor. */
  const prev = await readCampaignRead(r.artistId);
  if (prev) {
    const hist = (await store.get<CampaignRead[]>(K_HISTORY(r.artistId))) ?? [];
    await store.set(K_HISTORY(r.artistId), [prev, ...hist].slice(0, MAX_HISTORY));
  }

  await store.set(K_READ(r.artistId), r);
  return r;
}

export async function readHistory(slug: string): Promise<CampaignRead[]> {
  const store = await kv();
  if (!store) return [];
  const h = await store.get<CampaignRead[]>(K_HISTORY(slug));
  return Array.isArray(h) ? h : [];
}

export async function reviewCampaignRead(
  slug: string, status: HumanReviewStatus, note?: string,
): Promise<CampaignRead | null> {
  const r = await readCampaignRead(slug);
  if (!r) return null;
  return saveCampaignRead({
    ...r,
    humanReviewStatus: status,
    humanNote: note ?? r.humanNote,
    reviewedAt: new Date().toISOString(),
  });
}

/* ── Projection ──────────────────────────────────────────────────────── */

/**
 * The old shape, derived from the new one.
 *
 * The MCP endpoint, the share formats and the Assistant UI all consume
 * `CoachOverview`. Changing that contract to gain provenance would have
 * meant touching every surface at once, so the richer record projects down
 * instead — the detail is available to anything that wants it and invisible
 * to anything that does not.
 */
export function toOverview(r: CampaignRead): CoachOverview {
  return {
    artistId: r.artistId,
    artistName: r.artistName,
    campaignId: r.campaignName,
    campaignName: r.campaignName,
    generatedAt: r.generatedAt,
    status: r.status as CoachStatus,
    headline: r.read,
    whatHappened: r.observedEvidence.map(e => e.claim).join(' '),
    interpretation: r.whatChanged,
    recommendation: r.nextAction ?? 'No action — nothing material.',
    timing: r.watchFor ?? '',
    evidenceSummary: r.whatChanged,
    evidence: [...r.observedEvidence, ...r.derivedEvidence].slice(0, 8).map(e => ({
      sourceType: e.evidenceClass === 'OBSERVED' ? 'PUBLIC_YOUTUBE' as const
        : e.evidenceClass === 'INFERRED' ? 'COACH_INFERENCE' as const
        : 'WATCHER' as const,
      claim: e.claim,
      sourceRef: e.sourceRef,
    })),
    confidence: r.confidence,
    missingContext: r.limitations.join(' ') || 'Not stated.',
    nextCheck: r.watchFor ?? '',
    suggestedActions: [],
    producedBy: `${r.model} · ${r.promptVersion}`,
    toolsUsed: ['full-catalogue', 'buildProfile', 'horizon'],
  };
}
