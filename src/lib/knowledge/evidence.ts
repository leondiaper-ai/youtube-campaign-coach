/**
 * THE EVIDENCE HIERARCHY
 *
 * The failure mode this exists to prevent is quiet and cumulative: a model
 * writes "Live appears deliberately embedded in the campaign", that sentence
 * is stored, a later run reads it back as context, treats it as something
 * we know, and builds on it. Two months on the system holds a confident
 * belief that nobody ever observed and nobody can trace.
 *
 * So every claim carries a class, and the classes are ordered by how much
 * work it took to be wrong:
 *
 *   OBSERVED   read directly from an API. An upload date is an upload date.
 *   HUMAN      a person typed it. A release date in the plan, a deck thesis.
 *   DERIVED    computed deterministically from OBSERVED. Re-runnable, and
 *              wrong only if the code is wrong — which is a different and
 *              more fixable kind of wrong than a hallucination.
 *   INFERRED   a model's reading. Defensible, not measured.
 *   LEARNED    an INFERRED or DERIVED claim a human has explicitly promoted.
 *
 * ── THE ONE RULE THAT MATTERS ────────────────────────────────────────
 * Promotion is only ever upward through human action. Nothing in this
 * codebase may turn INFERRED into OBSERVED, and `assertNoSilentPromotion`
 * exists to make that a runtime failure rather than a code review habit.
 *
 * ── TRUST IS SEPARATE FROM CLASS ─────────────────────────────────────
 * A class says where a claim came from. Trust says whether it is usable
 * right now. An OBSERVED figure from a snapshot four months stale is
 * OBSERVED and STALE. A DERIVED hero classification on a channel with six
 * uploads is DERIVED and PARTIAL. Collapsing the two loses the distinction
 * between "we made this up" and "we measured it a while ago".
 */

/* ══ Class ═══════════════════════════════════════════════════════════ */

export type EvidenceClass = 'OBSERVED' | 'HUMAN' | 'DERIVED' | 'INFERRED' | 'LEARNED';

export const EVIDENCE_CLASSES: EvidenceClass[] = [
  'OBSERVED', 'HUMAN', 'DERIVED', 'INFERRED', 'LEARNED',
];

/** How much a class may be relied on. Higher is not "better" — see LEARNED. */
export const CLASS_RANK: Record<EvidenceClass, number> = {
  OBSERVED: 4,
  HUMAN: 3,
  DERIVED: 3,
  LEARNED: 2,
  INFERRED: 1,
};

export const CLASS_LABEL: Record<EvidenceClass, string> = {
  OBSERVED: 'Observed',
  HUMAN: 'Entered by a person',
  DERIVED: 'Computed',
  INFERRED: 'Interpretation',
  LEARNED: 'Retained conclusion',
};

/* ══ Trust ═══════════════════════════════════════════════════════════ */

export type TrustLevel = 'TRUSTED' | 'PARTIAL' | 'AMBIGUOUS' | 'STALE' | 'INVALID';

export const TRUST_LABEL: Record<TrustLevel, string> = {
  TRUSTED: 'Trusted',
  PARTIAL: 'Partial — stated limitation',
  AMBIGUOUS: 'Ambiguous — cannot support a confident conclusion',
  STALE: 'Stale — measured too long ago',
  INVALID: 'Invalid — not used',
};

/* ══ The record ══════════════════════════════════════════════════════ */

export interface EvidenceRecord {
  /** One statement. Long entries mean an interpretation slipped in. */
  claim: string;
  evidenceClass: EvidenceClass;
  trust: TrustLevel;
  /** Where it came from — a tool, a video id, a store key, a person. */
  sourceRef: string;
  /** When the underlying data was true, NOT when this record was written. */
  observedAt: string | null;
  /**
   * Required for PARTIAL and AMBIGUOUS. This is passed to the model rather
   * than the evidence being dropped, because "we have three uploads to go
   * on" is itself useful and silently withholding it invites the model to
   * assume the sample was adequate.
   */
  limitation?: string;
}

export function observed(claim: string, sourceRef: string, observedAt: string | null = null): EvidenceRecord {
  return { claim, evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef, observedAt };
}

export function derived(
  claim: string, sourceRef: string, trust: TrustLevel = 'TRUSTED', limitation?: string,
): EvidenceRecord {
  return { claim, evidenceClass: 'DERIVED', trust, sourceRef, observedAt: null, limitation };
}

export function human(claim: string, sourceRef: string, observedAt: string | null = null): EvidenceRecord {
  return { claim, evidenceClass: 'HUMAN', trust: 'TRUSTED', sourceRef, observedAt };
}

export function inferred(claim: string, sourceRef: string): EvidenceRecord {
  /* An interpretation is never TRUSTED. It may be right; it has not been
     checked, and the label is the only thing standing between it and being
     quoted back as a fact next month. */
  return { claim, evidenceClass: 'INFERRED', trust: 'AMBIGUOUS', sourceRef, observedAt: null,
    limitation: 'Model interpretation, not an observation.' };
}

/* ══ Gates ═══════════════════════════════════════════════════════════ */

/** Staleness thresholds by what the data describes. */
export const FRESHNESS_DAYS = {
  /** Channel snapshots move daily; a month old is no longer current. */
  snapshot: 30,
  /** A catalogue pull is a fact about the past and ages slowly. */
  catalogue: 14,
  /** A plan more than two months old has probably been overtaken. */
  plan: 60,
} as const;

export function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Number.isFinite(d) ? d : null;
}

/**
 * Marks a record STALE if its `observedAt` is older than the threshold for
 * its kind. Deliberately does not downgrade the CLASS: a stale observation
 * is still an observation, and pretending otherwise would let a fresh
 * inference outrank an old fact.
 */
export function applyFreshness(
  rec: EvidenceRecord, kind: keyof typeof FRESHNESS_DAYS,
): EvidenceRecord {
  const age = ageDays(rec.observedAt);
  if (age == null || age <= FRESHNESS_DAYS[kind]) return rec;
  return {
    ...rec,
    trust: 'STALE',
    limitation: `Measured ${Math.round(age)} days ago; threshold for ${kind} data is ${FRESHNESS_DAYS[kind]} days.`,
  };
}

export interface GateResult {
  /** Records safe to put in front of a model. */
  usable: EvidenceRecord[];
  /** Dropped entirely, with the reason. */
  rejected: { claim: string; reason: string }[];
  /** Limitations that must be stated alongside the evidence. */
  caveats: string[];
  /** True when nothing AMBIGUOUS or worse survived — a confident basis. */
  highConfidenceBasis: boolean;
}

/**
 * The gate.
 *
 * INVALID is dropped. Everything else passes, because dropping PARTIAL
 * evidence is how a system ends up reasoning from a clean-looking subset
 * and never mentioning that half the picture was missing. What PARTIAL and
 * AMBIGUOUS lose is not their place in the prompt but their right to
 * support a confident conclusion.
 */
export function gate(records: EvidenceRecord[]): GateResult {
  const usable: EvidenceRecord[] = [];
  const rejected: { claim: string; reason: string }[] = [];
  const caveats: string[] = [];

  for (const r of records) {
    if (r.trust === 'INVALID') {
      rejected.push({ claim: r.claim, reason: r.limitation ?? 'Marked invalid.' });
      continue;
    }
    usable.push(r);
    if ((r.trust === 'PARTIAL' || r.trust === 'AMBIGUOUS' || r.trust === 'STALE') && r.limitation) {
      caveats.push(`${r.claim} — ${r.limitation}`);
    }
  }

  const highConfidenceBasis = usable.every(
    r => r.trust === 'TRUSTED' && r.evidenceClass !== 'INFERRED',
  );

  return { usable, rejected, caveats, highConfidenceBasis };
}

/**
 * Caps a stated confidence at what the evidence can carry.
 *
 * Without this the model is free to say HIGH on the back of one ambiguous
 * derivation, and nothing downstream would know. The cap is applied after
 * the model answers, so it can never be argued around.
 */
export function capConfidence(
  stated: 'LOW' | 'MEDIUM' | 'HIGH', g: GateResult,
): { confidence: 'LOW' | 'MEDIUM' | 'HIGH'; capped: boolean; reason?: string } {
  if (g.highConfidenceBasis) return { confidence: stated, capped: false };

  const worst = g.usable.some(r => r.trust === 'AMBIGUOUS') ? 'AMBIGUOUS'
    : g.usable.some(r => r.trust === 'STALE') ? 'STALE' : 'PARTIAL';

  if (worst === 'AMBIGUOUS' && stated === 'HIGH') {
    return {
      confidence: 'MEDIUM', capped: true,
      reason: 'Ambiguous evidence in the basis — confidence capped at MEDIUM.',
    };
  }
  if (worst === 'STALE' && stated === 'HIGH') {
    return {
      confidence: 'MEDIUM', capped: true,
      reason: 'Some evidence is stale — confidence capped at MEDIUM.',
    };
  }
  return { confidence: stated, capped: false };
}

/* ══ The boundary rules ══════════════════════════════════════════════ */

/**
 * The eight things we must never quietly assume. Each is a mistake that
 * looks harmless in one sentence and becomes organisational knowledge if
 * repeated, which is why they are written down rather than remembered.
 */
export const BOUNDARY_RULES = [
  {
    id: 'unknown-genre',
    rule: 'Unknown genre is unknown.',
    why: 'Genre exists for 28 of 177 artists, hand-typed into a UI component. Absence is not a category.',
  },
  {
    id: 'unknown-market',
    rule: 'Unknown market is unknown.',
    why: 'No territory field exists on the roster. A channel country from the API is the channel\'s declared country, not the artist\'s market.',
  },
  {
    id: 'unknown-stage',
    rule: 'Unknown career stage is unknown.',
    why: 'Subscriber count is reach, not maturity. There is no career-stage field anywhere.',
  },
  {
    id: 'missing-plan',
    rule: 'A missing forward plan means the plan is unknown, NOT that there is no campaign.',
    why: 'Only 11 of 177 artists have dated plans. Reading absence as inactivity would mark most of the roster dormant.',
  },
  {
    id: 'views-not-velocity',
    rule: 'Lifetime views are lifetime views, not velocity.',
    why: 'Dividing by age produces a number that looks like a rate. An older asset has simply had longer.',
  },
  {
    id: 'upload-not-release',
    rule: 'An upload date is an upload date, not necessarily the song\'s release date.',
    why: 'A 2019 song uploaded today is indistinguishable from a new single without release metadata we do not hold.',
  },
  {
    id: 'size-not-creative-peer',
    rule: 'A size peer is a size peer, not a creative peer.',
    why: 'find_similar_artists matches on subscriber band alone, and says so in its own return value.',
  },
  {
    id: 'inference-not-fact',
    rule: 'A model interpretation is an interpretation, not a fact.',
    why: 'This is the rule the other seven depend on. INFERRED may only become LEARNED by explicit human action.',
  },
] as const;

/**
 * Throws if a record claims to be OBSERVED or HUMAN while carrying a source
 * that marks it as model output. A runtime guard rather than a convention,
 * because the failure it prevents is silent and permanent.
 */
export function assertNoSilentPromotion(rec: EvidenceRecord): void {
  const modelSourced = /^(coach|model|grok|inference|scout:read)/i.test(rec.sourceRef);
  if (modelSourced && (rec.evidenceClass === 'OBSERVED' || rec.evidenceClass === 'HUMAN')) {
    throw new Error(
      `Evidence promotion violation: "${rec.claim.slice(0, 80)}" is sourced from ` +
      `${rec.sourceRef} but classed ${rec.evidenceClass}. Model output may only be ` +
      `INFERRED, or LEARNED after explicit human review.`,
    );
  }
}

export function assertAllClassified(records: EvidenceRecord[]): void {
  for (const r of records) assertNoSilentPromotion(r);
}
