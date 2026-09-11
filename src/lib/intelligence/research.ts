/**
 * THE RESEARCH LIBRARY — SEEDS AND THE BOARD GATE
 *
 * Two things live here: the examples we already believe in, and the rule
 * that decides which of them a team is allowed to see.
 *
 * ── WHY THE SEEDS ARE NOT "SAVED" RECORDS ─────────────────────────────
 * These five came from a person naming a mechanic he already trusts. That
 * is real information and it belongs in the system. What it is not is
 * verified: nobody has pulled the uploads, checked the sequence, or
 * recorded a URL. Writing them in through `add_research_candidate` would
 * have required inventing source links to satisfy the tool's own guard,
 * which is precisely the behaviour the guard exists to prevent.
 *
 * So they are seeded as code, with `verification: 'UNVERIFIED'`, empty
 * evidence, empty sourceUrls, and an explicit list of what Grok has to go
 * and confirm. They are visible, matchable, and honest about their state.
 *
 * ── THE ONE PLACE I PUSHED BACK ───────────────────────────────────────
 * The brief marks Aimyon, Wet Leg and Magdalena Bay as BOARD_ELIGIBLE.
 * They are not — yet. Board eligibility is what puts an example on a page
 * in front of a team, and an unverified record on that page is a claim
 * about another artist's campaign that nobody has checked. The scores are
 * recorded exactly as intended; the gate additionally requires
 * verification, so the moment Grok confirms the behaviour they promote
 * themselves with no further judgement needed.
 *
 * `intendedStatus` carries the human intent so nothing is lost, and
 * `boardBlockedBy` says plainly that verification is the only thing in the
 * way. This is a delay, not a disagreement.
 */

import { listCaseStudies } from '../knowledge/store';
import type { CaseStudy } from '../knowledge/types';
import { boardEligible, boardBlockers, type ResearchScores } from './types';

/* ══ Verification ════════════════════════════════════════════════════ */

/**
 * UNVERIFIED  a person asserted it; nobody has checked the channel
 * PARTIAL     some evidence recorded, not enough to describe the sequence
 * VERIFIED    uploads, dates and order confirmed against the public API
 * DISPUTED    checked, and it did not hold up
 */
export type ResearchVerification = 'UNVERIFIED' | 'PARTIAL' | 'VERIFIED' | 'DISPUTED';

/** Extra fields the seeds carry that a saved CaseStudy does not need. */
export interface SeededResearch extends CaseStudy {
  verification: ResearchVerification;
  /** Specific, checkable questions. Not "verify this" — what, exactly. */
  needsVerification: string[];
  /** Where the brief wanted this to land once verified. */
  intendedStatus: CaseStudy['status'];
}

/**
 * The board gate, for a whole record rather than a score triple.
 *
 * Three conditions, and all three are about a different risk:
 *   scores        is the mechanic worth knowing and the artist showable
 *   verification  has anyone actually checked it
 *   sourceUrls    can the person looking at the page follow it up
 *
 * A record can be excellent on all three scores and still fail here, which
 * is the intended behaviour.
 */
export function boardStatus(c: CaseStudy): { eligible: boolean; blockers: string[] } {
  const scores: ResearchScores | null = c.scores ?? null;
  const blockers: string[] = [];

  if (!boardEligible(scores)) blockers.push(...boardBlockers(scores));

  const v = (c as Partial<SeededResearch>).verification;
  if (v && v !== 'VERIFIED') {
    blockers.push(
      v === 'DISPUTED'
        ? 'Checked and it did not hold up. This must not go in front of anyone.'
        : `Not verified (${v}). Nobody has confirmed the behaviour against the channel.`,
    );
  }
  if (!(c.sourceUrls ?? []).length) {
    blockers.push('No source link — a reader cannot check it, so it cannot be shown as proof.');
  }
  if (c.status === 'WATCHLIST') blockers.push('Watchlist item, not a case study.');
  if (c.status === 'REJECTED') blockers.push('Rejected.');

  return { eligible: blockers.length === 0, blockers };
}

/* ══ Seeds ═══════════════════════════════════════════════════════════ */

const SEED_DATE = '2026-09-11';

function seed(
  id: string,
  o: {
    subject: string;
    mechanic: string;
    archetype: string;
    usefulFor: string[];
    whyInteresting: string;
    whyNotObvious: string;
    possibleLearning: string;
    intendedStatus: CaseStudy['status'];
    status: CaseStudy['status'];
    scores: ResearchScores | null;
    needsVerification: string[];
  },
): SeededResearch {
  return {
    id,
    subject: o.subject,
    channelId: null,
    missionId: null,
    title: `${o.subject} — ${o.mechanic}`,
    /* Deliberately written as a claim about what we believe, not as an
       observation. Nobody watched this happen. */
    behaviourObserved:
      `ASSERTED, NOT YET OBSERVED: ${o.mechanic}. No uploads, dates or sequence have been `
      + 'retrieved from the channel. Treat every part of this as unconfirmed until Grok verifies it.',
    sequence: [],
    evidence: [],
    whyInteresting: o.whyInteresting,
    whyNotObvious: o.whyNotObvious,
    possibleLearning: o.possibleLearning,
    limitations:
      'This record was seeded from a human assertion with no evidence attached. It carries no view '
      + 'figures, no dates, no upload sequence and no source links. It can be matched against an '
      + 'artist need, and it cannot be cited as proof of anything until it is verified.',
    status: o.status,
    confidence: 'LOW',
    discoveredAt: SEED_DATE,
    lastReviewedAt: SEED_DATE,
    mechanic: o.mechanic,
    archetype: o.archetype,
    usefulFor: o.usefulFor,
    country: null,
    observedAt: null,
    sourceUrls: [],
    thumbnailVideoId: null,
    scores: o.scores,
    scoredBy: 'Leon (human, proposed at seeding — not derived from evidence)',
    verification: 'UNVERIFIED',
    needsVerification: o.needsVerification,
    intendedStatus: o.intendedStatus,
  };
}

export const SEEDED_RESEARCH: SeededResearch[] = [
  seed('seed_aimyon', {
    subject: 'Aimyon',
    mechanic: 'archive live turned into a Premiere run',
    archetype: 'Archive as event',
    usefulFor: ['archive_live', 'channel_reactivation', 'low_new_production', 'premiere_behaviour'],
    whyInteresting:
      'Existing live footage is programmed as a scheduled run of Premieres rather than uploaded as a '
      + 'back catalogue dump, which turns material that already exists into a series of appointments.',
    whyNotObvious:
      'The obvious move with an archive is to publish it. The move here is to schedule it, which costs '
      + 'nothing extra and produces repeat moments from a fixed stock of footage.',
    possibleLearning:
      'A channel with unused live material and no new production budget may be able to manufacture '
      + 'campaign moments out of scheduling alone.',
    intendedStatus: 'BOARD_ELIGIBLE',
    status: 'CANDIDATE',
    scores: { mechanicValue: 3, culturalRelevance: 3, visualBoardValue: 2 },
    needsVerification: [
      'Which channel — the official artist channel or a label channel?',
      'How many Premieres, over what dates, and were they consecutive nights or spread?',
      'Was the footage genuinely archive, or shot for the run?',
      'Were the Premieres scheduled with a countdown, and did any carry a live chat or pre-party?',
      'What were the uploads either side of the run — was it a reactivation after a quiet period?',
    ],
  }),

  seed('seed_wetleg', {
    subject: 'Wet Leg',
    mechanic: 'a named studio-session series shot in one room',
    archetype: 'Named series',
    usefulFor: ['named_series', 'follow_up_7_14', 'low_new_production', 'archive_live'],
    whyInteresting:
      'A single fixed set-up, given a name, becomes a returnable format — so each new entry inherits '
      + 'the recognition of the last rather than starting from nothing.',
    whyNotObvious:
      'Bands film sessions constantly. Naming the series and holding the room constant is what turns a '
      + 'pile of one-offs into something an audience can come back to.',
    possibleLearning:
      'A repeatable low-cost format may be worth more than a higher-production one-off, because the '
      + 'second entry costs less attention to launch than the first.',
    intendedStatus: 'BOARD_ELIGIBLE',
    status: 'CANDIDATE',
    scores: { mechanicValue: 3, culturalRelevance: 3, visualBoardValue: 3 },
    needsVerification: [
      'What is the series actually called, and is the name used consistently in titles or a playlist?',
      'How many entries, over what period, and on which channel?',
      'Is it genuinely one room across entries, or is that a description of a single shoot?',
      'Did entries land in the 7-14 day window after a release, or independently of the campaign?',
    ],
  }),

  seed('seed_magdalenabay', {
    subject: 'Magdalena Bay',
    mechanic: 'the making of the album published as a long-form YouTube event',
    archetype: 'Process as event',
    usefulFor: ['bts_process', 'named_series', 'long_form_event', 'album_campaign'],
    whyInteresting:
      'Process material is treated as a destination in its own right rather than as promotion for the '
      + 'record, which gives an album cycle something to publish during the long stretch when there is '
      + 'no new music to release.',
    whyNotObvious:
      'Behind-the-scenes content is normally a supporting asset cut to a couple of minutes. Publishing '
      + 'it long and treating it as the event inverts that, and most artists would assume nobody watches.',
    possibleLearning:
      'The gap between album announcement and release may be programmable with process content, if it '
      + 'is built as a thing to watch rather than a thing to trail the record.',
    intendedStatus: 'BOARD_ELIGIBLE',
    status: 'CANDIDATE',
    scores: { mechanicValue: 3, culturalRelevance: 2, visualBoardValue: 3 },
    needsVerification: [
      'Which uploads, what runtimes, and what dates relative to the album release?',
      'Was it a single long piece or a series?',
      'Was it published on the artist channel?',
      'Is there anything observable about how it sat against the hero releases in the same window?',
    ],
  }),

  seed('seed_dijon', {
    subject: 'Dijon',
    mechanic: 'live performance published as the official hero object',
    archetype: 'Performance as hero',
    usefulFor: ['performance_as_hero', 'archive_live', 'follow_up_7_14'],
    whyInteresting:
      'The performance is not support for a music video — it takes the place of one, which changes what '
      + 'the release moment is rather than what surrounds it.',
    whyNotObvious:
      'A live take is normally the follow-up asset. Making it the hero is a different decision with '
      + 'different consequences for cost, schedule and what the song looks like to a new listener.',
    possibleLearning:
      'For some artists the performance may be a stronger primary object than a narrative video, which '
      + 'would change the shape of the whole campaign rather than one asset in it.',
    /* LIBRARY in the brief. The nearest real status is a strong example that
       is explicitly not board-facing — which is what the scores already say. */
    intendedStatus: 'STRONG_EXAMPLE',
    status: 'CANDIDATE',
    scores: { mechanicValue: 2, culturalRelevance: 3, visualBoardValue: 1 },
    needsVerification: [
      'Which releases were performance-first, and were they labelled as official videos?',
      'Was there a separate narrative music video for the same song, and which came first?',
      'What is the visual treatment — is there genuinely nothing distinctive to show, or has it simply not been looked at?',
    ],
  }),

  seed('seed_cameronwinter_geese', {
    subject: 'Cameron Winter / Geese',
    mechanic: 'live performance treated as authored film',
    archetype: 'Performance as authored film',
    usefulFor: ['performance_as_hero', 'archive_live', 'long_form_event'],
    whyInteresting:
      'Interesting as a cultural signal before it is a YouTube mechanic — the question is whether the '
      + 'authorship is visible in what gets published, or only in how it is talked about.',
    whyNotObvious:
      'Not assessed. This is a watchlist item and has not been evaluated as a case study.',
    possibleLearning:
      'Check whether there is a repeatable publishing behaviour here at all, or whether it is a '
      + 'description of taste rather than of a campaign mechanic.',
    intendedStatus: 'WATCHLIST',
    status: 'WATCHLIST',
    scores: null,
    needsVerification: [
      'Is there an actual publishing pattern, or one striking upload?',
      'Which channel — artist, label, or a third-party session brand?',
      'Does "authored film" describe the asset, or the press around it?',
    ],
  }),
];

const SEED_IDS = new Set(SEEDED_RESEARCH.map(s => s.id));

/**
 * The library as everything sees it: saved records plus seeds.
 *
 * A saved record with the same id WINS, so verifying a seed is just a
 * matter of writing over it — Grok updates `seed_aimyon` through the normal
 * write tools and the hard-coded version stops being used. That is the
 * intended lifecycle: seeds are a starting position, not a permanent
 * fixture, and nothing special has to happen for one to be replaced.
 */
export async function readLibrary(): Promise<CaseStudy[]> {
  const saved = await listCaseStudies().catch(() => [] as CaseStudy[]);
  const savedIds = new Set(saved.map(c => c.id));
  const unreplaced = SEEDED_RESEARCH.filter(s => !savedIds.has(s.id));
  return [...saved, ...unreplaced];
}

export function isSeed(id: string): boolean {
  return SEED_IDS.has(id);
}

/** The seed record, for a tool that needs its verification questions. */
export function seedById(id: string): SeededResearch | null {
  return SEEDED_RESEARCH.find(s => s.id === id) ?? null;
}

export function verificationOf(c: CaseStudy): ResearchVerification {
  const v = (c as Partial<SeededResearch>).verification;
  if (v) return v;
  /* A saved record with evidence and a source has been through the write
     tools, which require both. Absent an explicit marker, evidence is the
     best available signal — and PARTIAL is the honest floor. */
  const hasEvidence = c.evidence.length > 0 && (c.sourceUrls ?? []).length > 0;
  return hasEvidence ? 'PARTIAL' : 'UNVERIFIED';
}

export function needsVerificationOf(c: CaseStudy): string[] {
  return (c as Partial<SeededResearch>).needsVerification ?? [];
}
