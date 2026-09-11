/**
 * RECOMMENDATION PROGRESS
 *
 * The one thing the audit found genuinely missing: a record that a person
 * confirmed a recommendation was acted on.
 *
 * Everything else in this layer already exists. Uploads, snapshots, weekly
 * history, campaign events, reads, coach verdicts and retained learnings
 * are all stored and all keyed on artist slug. What no store held was the
 * join — "we recommended X" → "the team did X" → "here is what moved". The
 * middle link is the one that cannot be derived, and this file is only that
 * link. The read model joins it to the stores that already exist rather
 * than copying them.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE ──────────────────────────────
 * Watcher can see that two Shorts appeared on 9 and 10 September. It cannot
 * see that they appeared BECAUSE of a recommendation. Intent is not visible
 * in the public API and never will be, so IMPLEMENTED, RESULT and LEARNED
 * are human-only states, enforced here rather than asked for in a prompt.
 *
 * An upload is SUPPORTING evidence for an implementation a human has
 * already asserted. It is never the assertion. Get that backwards and the
 * system starts crediting itself for things the team did for their own
 * reasons, which is the most flattering and least useful mistake available.
 *
 * ── WHY SEEDED RECORDS EXIST ──────────────────────────────────────────
 * Same pattern as the Deep Dives and the research library: a record
 * committed to the repo, overridable by Redis. The first CHVRCHES record
 * came from Leon in conversation, and seeding it as code makes it
 * reviewable in a pull request rather than appearing in a database with no
 * history.
 */

import { Redis } from '@upstash/redis';

/* ══ The lifecycle ═══════════════════════════════════════════════════ */

/**
 * NOT_STARTED  the recommendation stands, nothing has happened
 * PLANNED      a human says it is going to happen
 * IMPLEMENTED  a human says it has happened
 * OBSERVING    implemented, and we are waiting for enough evidence
 * RESULT       enough evidence exists to say what happened
 * LEARNED      a human has reviewed the result and retained a conclusion
 *
 * RESULT and LEARNED are separate because a number arriving and somebody
 * deciding what it means are different events, often weeks apart, and
 * collapsing them is how an unreviewed figure becomes organisational
 * knowledge.
 */
export type ProgressState =
  | 'NOT_STARTED' | 'PLANNED' | 'IMPLEMENTED' | 'OBSERVING' | 'RESULT' | 'LEARNED';

export const PROGRESS_STATES: ProgressState[] = [
  'NOT_STARTED', 'PLANNED', 'IMPLEMENTED', 'OBSERVING', 'RESULT', 'LEARNED',
];

/** States a human must assert. No derivation may reach these. */
export const HUMAN_ONLY_STATES: ProgressState[] = ['IMPLEMENTED', 'RESULT', 'LEARNED'];

export function requiresHuman(state: ProgressState): boolean {
  return HUMAN_ONLY_STATES.includes(state);
}

/* ══ Evidence references ═════════════════════════════════════════════ */

/**
 * A pointer, never a copy. `kind` says which existing store holds it, `ref`
 * is the id or key within that store. The read model resolves them at read
 * time so nothing here goes stale, and so this record stays small enough to
 * read in a pull request.
 */
export interface EvidenceRef {
  kind: 'upload' | 'event' | 'read' | 'memory' | 'snapshot' | 'human_context' | 'research';
  ref: string;
  /** One line on why this is attached. */
  note?: string;
  /** Attached by a person, or by the read model's own join. */
  attachedBy: 'HUMAN' | 'DERIVED';
}

export interface ProgressTransition {
  to: ProgressState;
  at: string;
  statedBy: string;
  note: string;
}

export interface RecommendationProgress {
  recommendationId: string;
  artistSlug: string;
  state: ProgressState;
  /** Who asserted the CURRENT state. Never a model for a human-only state. */
  statedBy: string;
  /**
   * When the thing happened, not when it was recorded. May be a month
   * ("2026-09") when the exact date is genuinely unknown — see
   * `statedAtPrecision`. Inventing a day would be worse than saying so.
   */
  statedAt: string;
  statedAtPrecision: 'day' | 'month' | 'approximate';
  note: string;
  evidenceRefs: EvidenceRef[];
  /** When a rewording broke the id link, a human points the old one here. */
  supersedesId?: string | null;
  /** Every transition, oldest first. The record of who said what, when. */
  history: ProgressTransition[];
  createdAt: string;
  updatedAt: string;
}

/* ══ Store ═══════════════════════════════════════════════════════════ */

async function kv(): Promise<Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const K_PROGRESS = (slug: string) => `intel:progress:${slug}`;
const K_INDEX = 'intel:progress:index';

/* ══ Seeds ═══════════════════════════════════════════════════════════ */

/**
 * CHVRCHES, the first real record.
 *
 * Leon advised the team to begin posting on the channel and has confirmed
 * the campaign has officially started. That is HUMAN evidence and it is the
 * only thing here that establishes implementation.
 *
 * `statedAt` is '2026-09' at MONTH precision. We know the campaign started
 * and we can see the first uploads on 9 September, but nothing in the
 * system records the date the instruction was given. A precise timestamp
 * would be invented, and the whole point of this layer is that the
 * implementation record is the honest part.
 *
 * The two Shorts are attached as OBSERVED support with attachedBy HUMAN,
 * because a person is asserting they are the implementation — not because
 * the system inferred it from their existence.
 */
const CHVRCHES_UPLOADS: EvidenceRef[] = [
  {
    kind: 'upload', ref: 'KCm7pn_lza8', attachedBy: 'HUMAN',
    note: '"Now, we can start." — 61s Short, published 9 Sep 2026. First upload in 340 days.',
  },
  {
    kind: 'upload', ref: 'lGC2hz7NbMo', attachedBy: 'HUMAN',
    note: '"On your marks." — 6s Short, published 10 Sep 2026.',
  },
];

const CHVRCHES_NOTE =
  'Leon advised the CHVRCHES team to begin posting on the YouTube channel, and has confirmed the campaign '
  + 'has officially started. The channel reopened with two Shorts on 9 and 10 September after 340 days '
  + 'without an upload. Implementation has begun. No long-form has been published yet and the uploads are '
  + 'two days old, so there is not enough evidence for a result.';

/**
 * Two records, one action.
 *
 * The deck makes the same point twice — once as the opening step of the
 * campaign architecture and once as a strategic opportunity — and they mint
 * different ids because they are different sentences. Recording progress
 * against only one would leave the other reading NOT_STARTED, which is
 * false. Recording both is the honest answer: one instruction addressed two
 * recommendations, and the notes say so.
 */
export const SEEDED_PROGRESS: Record<string, RecommendationProgress[]> = {
  chvrches: [
    {
      /* Architecture step 1: "Pre-campaign: reopen the channel with
         catalogue, archive live, Community and playlists, before any
         announcement." */
      recommendationId: 'dd_chvrches_1unwsjh',
      artistSlug: 'chvrches',
      state: 'OBSERVING',
      statedBy: 'Leon',
      statedAt: '2026-09',
      statedAtPrecision: 'month',
      note: CHVRCHES_NOTE
        + ' Note that the reopening so far is Shorts only — the catalogue, archive live and playlist parts of '
        + 'this recommendation have not been observed.',
      evidenceRefs: CHVRCHES_UPLOADS,
      supersedesId: null,
      history: [
        {
          to: 'IMPLEMENTED', at: '2026-09', statedBy: 'Leon',
          note: 'Advised the team to begin posting on the channel. Campaign officially started. '
            + 'Exact date of the instruction is not recorded, so this is month precision.',
        },
        {
          to: 'OBSERVING', at: '2026-09-11', statedBy: 'Leon',
          note: 'First uploads visible on the channel. Waiting for enough evidence to say anything about outcome.',
        },
      ],
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    },
    {
      /* Strategic opportunity: "Reopen the channel before any
         announcement." Same action, separate sentence in the deck. */
      recommendationId: 'dd_chvrches_0lmkyfh',
      artistSlug: 'chvrches',
      state: 'OBSERVING',
      statedBy: 'Leon',
      statedAt: '2026-09',
      statedAtPrecision: 'month',
      note: CHVRCHES_NOTE
        + ' This is the same action as the campaign-architecture reopening step (dd_chvrches_1unwsjh); the '
        + 'deck states it twice and both are tracked so neither reads as untouched.',
      evidenceRefs: CHVRCHES_UPLOADS,
      supersedesId: null,
      history: [
        {
          to: 'IMPLEMENTED', at: '2026-09', statedBy: 'Leon',
          note: 'Advised the team to begin posting on the channel. Campaign officially started.',
        },
        {
          to: 'OBSERVING', at: '2026-09-11', statedBy: 'Leon',
          note: 'First uploads visible. No announcement observed yet, so the "before any announcement" '
            + 'condition still holds as at this date.',
        },
      ],
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    },
  ],
};

/* ══ Read ════════════════════════════════════════════════════════════ */

export async function listProgress(slug: string): Promise<RecommendationProgress[]> {
  const seeds = SEEDED_PROGRESS[slug] ?? [];
  const store = await kv();
  if (!store) return seeds;

  let stored: RecommendationProgress[] = [];
  try {
    stored = (await store.get<RecommendationProgress[]>(K_PROGRESS(slug))) ?? [];
  } catch { /* seeds alone are a valid answer */ }

  /* A stored record for the same recommendation wins — that is how a seed
     gets corrected without a deploy. */
  const byId = new Map(seeds.map(s => [s.recommendationId, s]));
  for (const s of stored) byId.set(s.recommendationId, s);
  return Array.from(byId.values());
}

export async function getProgress(
  slug: string, recommendationId: string,
): Promise<RecommendationProgress | null> {
  return (await listProgress(slug)).find(p => p.recommendationId === recommendationId) ?? null;
}

export async function listProgressArtists(): Promise<string[]> {
  const store = await kv();
  const stored = store ? ((await store.smembers<string[]>(K_INDEX)) ?? []) : [];
  return Array.from(new Set([...Object.keys(SEEDED_PROGRESS), ...stored]));
}

/* ══ Write ═══════════════════════════════════════════════════════════ */

export class ProvenanceError extends Error {}

export interface SetProgressArgs {
  artistSlug: string;
  recommendationId: string;
  state: ProgressState;
  /** A person's name. "grok", "model", "system" are refused for human states. */
  statedBy: string;
  /** yyyy-mm-dd or yyyy-mm. Required — a state change with no date is a rumour. */
  statedAt: string;
  statedAtPrecision?: RecommendationProgress['statedAtPrecision'];
  note: string;
  evidenceRefs?: EvidenceRef[];
  supersedesId?: string | null;
  /**
   * What is making this call. Only 'HUMAN' may set IMPLEMENTED, RESULT or
   * LEARNED, and that is checked here rather than trusted.
   */
  provenance: 'HUMAN' | 'DERIVED' | 'INFERRED';
}

/** Names a model might supply for itself. None of them is a person. */
const NOT_A_PERSON = /^(grok|claude|gpt|model|system|watcher|coach|scout|assistant|ai|bot)\b/i;

export async function setProgress(args: SetProgressArgs): Promise<RecommendationProgress> {
  if (!PROGRESS_STATES.includes(args.state)) {
    throw new ProvenanceError(`Unknown state "${args.state}". One of: ${PROGRESS_STATES.join(', ')}`);
  }
  if (!args.statedBy?.trim()) {
    throw new ProvenanceError('statedBy is required. An unattributed state change cannot be questioned later.');
  }
  if (!args.statedAt?.trim()) {
    throw new ProvenanceError('statedAt is required. Use month precision if the exact day is unknown.');
  }
  if (!args.note?.trim()) {
    throw new ProvenanceError('note is required — what was actually done, in a sentence.');
  }

  /* The guard the whole file exists for. */
  if (requiresHuman(args.state)) {
    if (args.provenance !== 'HUMAN') {
      throw new ProvenanceError(
        `${args.state} may only be set by a human. Watcher can observe that uploads appeared; it cannot `
        + 'observe that they appeared because of this recommendation. Intent is not in the public API. '
        + 'Attach the uploads as supporting evidence and leave the state where it is.',
      );
    }
    if (NOT_A_PERSON.test(args.statedBy.trim())) {
      throw new ProvenanceError(
        `statedBy "${args.statedBy}" is not a person. ${args.state} requires a named human.`,
      );
    }
  }

  const store = await kv();
  if (!store) throw new Error('No Redis configured — cannot persist progress.');

  const existing = await listProgress(args.artistSlug);
  const prior = existing.find(p => p.recommendationId === args.recommendationId);
  const now = new Date().toISOString();

  const record: RecommendationProgress = {
    recommendationId: args.recommendationId,
    artistSlug: args.artistSlug,
    state: args.state,
    statedBy: args.statedBy.trim(),
    statedAt: args.statedAt.trim(),
    statedAtPrecision: args.statedAtPrecision
      ?? (/^\d{4}-\d{2}$/.test(args.statedAt.trim()) ? 'month' : 'day'),
    note: args.note.trim(),
    /* Evidence accumulates. Losing what was attached at IMPLEMENTED when a
       record moves to OBSERVING would discard the reason for the move. */
    evidenceRefs: [...(prior?.evidenceRefs ?? []), ...(args.evidenceRefs ?? [])],
    supersedesId: args.supersedesId ?? prior?.supersedesId ?? null,
    history: [
      ...(prior?.history ?? []),
      { to: args.state, at: args.statedAt.trim(), statedBy: args.statedBy.trim(), note: args.note.trim() },
    ],
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing.filter(p => p.recommendationId !== args.recommendationId).concat(record);
  await store.set(K_PROGRESS(args.artistSlug), next);
  await store.sadd(K_INDEX, args.artistSlug);
  return record;
}

/**
 * Attaches supporting evidence WITHOUT changing state.
 *
 * This is the path a derivation is allowed to take. Watcher noticing a
 * relevant upload is real information and should be recorded; what it must
 * not do is advance the lifecycle, so there is no state parameter here at
 * all rather than a flag somebody could pass wrongly.
 */
export async function attachEvidence(
  slug: string, recommendationId: string, refs: EvidenceRef[],
): Promise<RecommendationProgress | null> {
  const store = await kv();
  if (!store) return null;
  const existing = await listProgress(slug);
  const rec = existing.find(p => p.recommendationId === recommendationId);
  if (!rec) return null;

  const seen = new Set(rec.evidenceRefs.map(r => `${r.kind}:${r.ref}`));
  const added = refs.filter(r => !seen.has(`${r.kind}:${r.ref}`));
  if (!added.length) return rec;

  rec.evidenceRefs = [...rec.evidenceRefs, ...added];
  rec.updatedAt = new Date().toISOString();
  await store.set(K_PROGRESS(slug), existing.filter(p => p.recommendationId !== recommendationId).concat(rec));
  return rec;
}
