/**
 * THE ROLLOUT — one plan, two surfaces
 *
 * The strategy spine on the campaign cover and the Ideas tab were about to
 * become two descriptions of the same campaign, maintained separately, free
 * to disagree. This module is the single plan both of them read.
 *
 * ── WHAT A ROLLOUT ITEM IS ────────────────────────────────────────────
 * A thing this campaign could do next, with four things attached that
 * normally live in four different places:
 *
 *   the Deep Dive recommendation it came from   (why we think it)
 *   what has actually happened against it        (campaign evidence)
 *   verified external behaviour that bears on it (Grok research)
 *   the CHVRCHES-specific application            (the recommendation)
 *
 * The join is the point. An idea with no campaign state is a best-practice
 * listicle; campaign state with no idea is a status report. Neither is worth
 * opening.
 *
 * ── WHERE THE ITEMS COME FROM ─────────────────────────────────────────
 * Two sources, and they are never blurred:
 *
 *   DEEP_DIVE  the four architecture steps the deck already argued for.
 *              These carry a real recommendation id, so human progress
 *              records and observed uploads join straight onto them.
 *   HUMAN      a possibility somebody raised in conversation. It has a
 *              named author and a date, and it is explicitly NOT a
 *              commitment — `commitment: 'POSSIBILITY'` is rendered, not
 *              just stored, because a deck that presents an idea and a plan
 *              identically will eventually have one read as the other.
 *
 * Nothing here was generated. There is no path in this file by which a model
 * adds a rollout item.
 *
 * ── HOW THE RESEARCH QUESTION MOVES ───────────────────────────────────
 * Each item carries its own question. The campaign's current question is the
 * question belonging to the first item that is not yet LIVE or COMPLETE. So
 * when somebody records that first hero is out, the question stops being
 * "how are artists handling first hero" and becomes the next item's, with
 * nobody editing a string. That is the whole mechanism — state advances, the
 * question follows.
 */

import type { CaseStudy } from '../knowledge/types';
import { canonicaliseTag, type NeedTag } from './types';
import { boardStatus, clientFacing, promotionOf, verificationOf, type ResearchVerification } from './research';
import { mintRecommendationId } from './recommendationId';
import type { CampaignProgressReport, RecommendationProgressView } from './campaignProgress';
import { lastResearchedByItem, type ResearchRun } from './researchRuns';

/* ══ The model ═══════════════════════════════════════════════════════ */

/**
 * EXPLORING    raised as a possibility; nobody has argued it through yet
 * RECOMMENDED  the Deep Dive argues for it, or a human has
 * PLANNED      a person has said it is going to happen
 * LIVE         a person has confirmed it is under way
 * COMPLETE     it happened and the window has passed
 *
 * PLANNED, LIVE and COMPLETE are claims about intent and can only be reached
 * through a human progress record — the same rule the progress store already
 * enforces, not a second one invented here.
 */
export type RolloutStatus = 'EXPLORING' | 'RECOMMENDED' | 'PLANNED' | 'LIVE' | 'COMPLETE';

/** Whether anybody has committed to this, or it is a thing we could do. */
export type Commitment = 'POSSIBILITY' | 'COMMITTED';

export interface RolloutExample {
  /** Library id, so a reader can find the record behind the card. */
  id: string;
  artist: string;
  observedBehaviour: string;
  source: string | null;
  relevantRef: string | null;
  date: string | null;
  whyItMattersHere: string;
  verification: ResearchVerification;
  /** Who promoted it and when. Always a person. */
  promotedBy: string;
  promotedAt: string;
}

/** A model's proposed application of an example to THIS campaign. */
export interface RolloutProposal {
  exampleId: string;
  artist: string;
  application: string;
  whatWouldHaveToBeTrue: string;
  proposedBy: string;
  at: string;
  /** Whether the example it rests on has itself been promoted. */
  examplePromoted: boolean;
}

export interface RolloutResearch {
  /** The question this item puts to Grok. Specific to the item, not the artist. */
  question: string;
  /** Verified AND promoted examples only. Empty is a normal and honest answer. */
  examples: RolloutExample[];
  /** Held but not yet verified / scored. Counted so that empty never reads as "none exist". */
  awaitingVerification: number;
  /** Verified and scored, waiting for a person to promote or reject. The review queue. */
  awaitingPromotion: number;
  /**
   * Proposed applications from Grok. Shown NEXT TO the human-authored
   * recommendation, never in its place, and labelled as proposals.
   */
  proposals: RolloutProposal[];
  /** When a research run last addressed this item's question. Null = never. */
  lastResearchedAt: string | null;
  /** Present when there is something to say about why nothing is shown. */
  note: string | null;
}

export interface RolloutEvidence {
  /** What a human recorded against this, if anything. */
  stated: { by: string; at: string; note: string } | null;
  /** Uploads observed since the Deep Dive that attach to this item. */
  uploads: { videoId: string; title: string; publishedAt: string; views: number }[];
  /** What we are waiting to see. */
  nextWatch: string | null;
  /** Why there is no evidence, when there is none. Never silently blank. */
  absence: string | null;
}

export interface RolloutItem {
  id: string;
  ordinal: number;
  title: string;
  objective: string;
  timing: string;
  rationale: string;
  status: RolloutStatus;
  commitment: Commitment;
  origin: 'DEEP_DIVE' | 'HUMAN';
  /** Who put this on the list, and when. Always populated. */
  attribution: { statedBy: string; statedAt: string; precision: 'day' | 'month' };
  /** The Deep Dive recommendation this joins to, when it has one. */
  recommendationId: string | null;
  /** True for the four items that render as the cover's strategy spine. */
  spine: boolean;
  /** The cover's own vocabulary, derived — never stored twice. */
  spineStatus: 'IN MOTION' | 'NEXT' | 'AHEAD' | 'COMPLETE' | null;
  needTags: NeedTag[];
  recommendation: string;
  /** Present only on ideas that earn a picture. See PlanItem.pitch. */
  pitch: PlanItem['pitch'] | null;
  /** Present only on platform conversations. See PlanItem.opportunity. */
  opportunity: PlanItem['opportunity'] | null;
  campaignEvidence: RolloutEvidence;
  grokResearch: RolloutResearch;
  lastUpdated: string;
}

export interface Rollout {
  artistSlug: string;
  items: RolloutItem[];
  /** The question the campaign is currently asking. Derived from state. */
  currentQuestion: { question: string; becauseOf: string } | null;
  /** Honest notes about what this plan does not cover. Never empty. */
  limitations: string[];
}

/* ══ The plan ════════════════════════════════════════════════════════ */

export interface PlanItem {
  key: string;
  title: string;
  objective: string;
  timing: string;
  rationale: string;
  recommendation: string;
  question: string;
  needTags: NeedTag[];
  spine: boolean;
  commitment: Commitment;
  /** Exact point text from the Deep Dive — mints the recommendation id. */
  deepDivePoint?: string;
  /** For HUMAN-origin items only. */
  human?: { statedBy: string; statedAt: string; precision: 'day' | 'month' };
  /** Seed status for items with no Deep Dive anchor to derive one from. */
  seedStatus?: RolloutStatus;
  /**
   * How this idea presents when it is shown to people rather than read by
   * a model.
   *
   * Selection is intelligence — which ideas are live, which have evidence,
   * which are still possibilities. Phrasing and imagery are editorial, and
   * they belong next to the item rather than inside a renderer, so that the
   * words a team reads and the record a model reads can never drift apart.
   *
   * An item WITHOUT a pitch is not missing anything. It means this is not a
   * creative idea you would put a picture against: either campaign
   * mechanics that belong on the Campaign tab, or a partner conversation
   * that belongs in a line rather than a frame.
   */
  pitch?: {
    /** Six words at most. The thing itself, not a description of it. */
    headline: string;
    /**
     * One figure from the Deep Dive, set as a typographic detail rather
     * than a sentence. This is what makes an idea credible in a room: it
     * is the difference between "give every hero a second destination"
     * and "0 of 4 heroes had one last time".
     *
     * Must be traceable to the Deep Dive. Never a rounded impression.
     */
    evidence: string;
    /** Why this fits THIS artist. One line. */
    why: string;
    /** What we would actually do. One line. */
    doThis: string;
    /**
     * FALLBACK ONLY.
     *
     * The Ideas slides draw their pictures from the assets THIS campaign has
     * actually published — see `campaignFrames()` in the deck. A campaign with
     * two uploads of its own should not be illustrated with a video from the
     * last album, because the page is meant to feel like the era it is
     * describing. This id is used only when the campaign has published
     * nothing yet and the alternative is an empty frame.
     */
    imageId: string;
    /**
     * Where this argument was made, and the figure that makes it.
     *
     * An idea card used to link to a video on the channel. That was wrong
     * twice over: the link answered a question nobody asked ("what does this
     * picture come from?") and it could rot — CHVRCHES: Live at House of Vans
     * still returns a thumbnail and a title, but the video itself is not
     * playable, so the card offered a dead end dressed as a citation.
     *
     * The link now goes where the reasoning is: the Channel Deep Dive slide
     * that argued for this, identified by its `data-t` so it survives slides
     * being reordered. `figure` is the sentence that slide proves.
     */
    deepDive?: { slide: string; figure: string };
    /**
     * Which frame of that asset. YouTube publishes three auto-generated
     * storyboard stills per video at maxres1/2/3.jpg alongside the
     * thumbnail — real frames from roughly 25/50/75% through. Using them
     * lets one campaign asset supply four distinct images instead of the
     * same thumbnail four times. Omit for the thumbnail.
     */
    frame?: 1 | 2 | 3;
  };
  /**
   * A conversation to have with YouTube rather than something we can do on
   * our own. These are named and described, because "Top Fans" on its own
   * means nothing to anyone outside the room — but they are deliberately
   * NOT pitches, because a platform opportunity nobody has agreed to must
   * not read like a campaign plan.
   */
  opportunity?: {
    name: string;
    line: string;
    /**
     * A real, public thing somebody can open to see what is meant. Named by a
     * person and checked by hand, NOT produced by the research pipeline — so
     * it is deliberately a single link with a single observed figure, and it
     * never appears on the Inspiration slide, which stays reserved for
     * examples that have been through verification.
     */
    example?: { label: string; url: string; observed: string; checkedAt: string };
  };
}

/**
 * CHVRCHES only, deliberately.
 *
 * The first four are the deck's own campaign arc, anchored by the exact
 * sentence the deck uses so the recommendation id matches the one the
 * progress store already holds. The rest are possibilities Leon raised on
 * 11 Sep 2026 and are marked as such.
 */
const CHVRCHES_PLAN: PlanItem[] = [
  {
    key: 'wake',
    title: 'Wake the channel',
    objective: 'Bring a dormant channel back into publishing before anything is announced.',
    timing: 'Before announcement — under way now',
    rationale:
      '340 days without an upload while roughly 74,000 views a day kept arriving. A channel that '
      + 'earns in silence does not need to be rebuilt, it needs to be reopened.',
    recommendation:
      'Keep publishing into the catalogue and the archive while there is nothing to announce. Playlists, '
      + 'end screens and Community cost nothing and make the channel look alive before the first hero lands.',
    question: 'How are interesting artists waking a dormant channel before an announcement?',
    needTags: ['channel_reactivation', 'catalogue_activation'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint:
      'Pre-campaign: reopen the channel with catalogue, archive live, Community and playlists, before any announcement.',
  },
  {
    key: 'first_hero',
    title: 'First hero',
    objective: 'The first major single moment of album five.',
    timing: 'Release day of the first single',
    rationale:
      'The pre-party into Premiere ritual already exists on this channel and ran on 4 of 4 Screen '
      + 'Violence singles. This is the one part of the last campaign that does not need changing.',
    recommendation:
      'Run the hero exactly as before — a live pre-party stream opening 12-20 minutes ahead of a video '
      + 'premiering on the hour. The change worth making is not the hero, it is what follows it.',
    question: 'How are interesting artists handling first hero?',
    needTags: ['premiere_behaviour', 'community_activation'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Single: official music video with the pre-party Premiere they already run.',
    pitch: {
      headline: 'Make the first hero an event',
      evidence: '4 / 4 singles had a pre-party',
      why: 'The pre-party into Premiere ritual already worked here, on every Screen Violence single.',
      doThis: 'Bring it back for Roses, and give people somewhere to go the moment it ends.',
      imageId: '0XoMu7Bz7YE',
      deepDive: { slide: 'The ritual', figure: 'A live stream 12-20 minutes ahead of every premiere' },
    },
  },
  {
    key: 'second_destination',
    title: 'Second destination',
    objective: 'A meaningful follow-up asset while attention from the hero is still up.',
    timing: '+7-14 days after the hero',
    rationale:
      'The single clearest gap in the last campaign: 0 of 4 Screen Violence heroes had anything '
      + 'meaningful land in the 7-14 day window, leaving six weeks of quiet between moments.',
    recommendation:
      'A lyric video, live take or performance in the second week. Lyric videos are already part of '
      + 'this channel’s language — 11 of them, 2.04M median against a 937K median for music videos — '
      + 'so the format needs no introduction.',
    question: 'How are strong campaigns extending attention after first hero?',
    needTags: ['follow_up_7_14', 'hero_continuity', 'lyric_video'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint:
      '+7-14 days: a second destination — lyric video, live, or a performance while attention is still up.',
    pitch: {
      headline: 'Give every hero a second destination',
      evidence: '0 / 4 heroes had a follow-up',
      why: 'Nothing meaningful landed in the 7-14 day window after any Screen Violence single.',
      doThis: 'Lyric, live or performance while the attention from the hero is still up.',
      imageId: 'du4kNAyjVCg',
      deepDive: {
        slide: 'Lyric videos',
        figure: '11 lyric videos take 2.04M typical views against 937K for music videos',
      },
    },
  },
  {
    key: 'every_song_home',
    title: 'Give every song a home',
    objective: 'Release day as a single large moment rather than one upload.',
    timing: 'Album release day',
    rationale:
      'Screen Violence put seven assets out on 27 Aug 2021 and took 6.94M views that day. The pattern '
      + 'is this channel’s own, not a borrowed one.',
    recommendation:
      'Every track on the record should have somewhere to be watched on release day, even where that is '
      + 'a lyric video or a static visualiser rather than a shoot.',
    question: 'How are artists giving every song on an album a home on release day?',
    needTags: ['first_week_density', 'album_campaign'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Release day: give every song a home, as Screen Violence did with seven assets on the day.',
  },

  /* ── Possibilities. Raised in conversation, not committed to. ────── */
  {
    key: 'churches_in_churches',
    title: 'CHVRCHES in Churches',
    objective: 'Treat the January UK outstore run as a capture opportunity, not only a live one.',
    timing: 'January, UK — dates and venues not held by this system',
    rationale:
      'The channel already carries 15 live uploads including 5 full sets, with a 104K median. Live is '
      + 'an established format here, and a run that is happening anyway is the cheapest way to produce '
      + 'more of it.',
    recommendation:
      'If the run happens, decide before it whether it is being captured. A performance shot in January '
      + 'can be a second destination in the spring; footage nobody planned to film cannot.',
    question: 'How are artists turning a one-off live run into YouTube content?',
    needTags: ['archive_live', 'performance_as_hero'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'EXPLORING',
    human: { statedBy: 'Leon', statedAt: '2026-09', precision: 'month' },
    pitch: {
      headline: 'CHVRCHES in Churches',
      evidence: '15 live uploads · 5 full sets',
      why: 'Live is already part of this channel\'s language, with a 104K median.',
      doThis: 'Decide before January that the run is being captured. Could it become a named series?',
      imageId: 'fGiqCmZvkJ8',
      deepDive: { slide: 'Hero moment', figure: '15 live uploads, 5 full sets, 101 minutes at House of Vans' },
    },
  },
  {
    key: 'top_fans',
    title: 'Top Fans',
    objective: 'Explore YouTube’s top-1% fan activation mechanism for the album campaign.',
    timing: 'Around the campaign — no window set',
    rationale:
      'A pre-party ritual that already runs on every single means there is an audience that turns up '
      + 'live and on time. Whether that maps onto the Top Fans mechanism is not something this system '
      + 'can see.',
    recommendation:
      'A conversation to have with YouTube rather than a tactic to schedule. Nothing here has been '
      + 'checked against what the programme actually offers.',
    question: 'How are artists using YouTube’s top-fan mechanisms during an album campaign?',
    needTags: ['community_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'EXPLORING',
    human: { statedBy: 'Leon', statedAt: '2026-09', precision: 'month' },
    opportunity: {
      name: 'Top Fans 1%',
      line: 'Activating and rewarding the campaign\'s most engaged fans.',
    },
  },
  {
    key: 'youtube_nights',
    title: 'YouTube Nights',
    objective: 'Explore the band for the small-venue, big-artist YouTube Nights opportunity.',
    timing: 'Unscheduled',
    rationale:
      'A heritage act with a live archive and a January run already in the calendar is the shape of '
      + 'artist this format is built around.',
    recommendation:
      'Raise it as a partner ask. Whether CHVRCHES are a fit is a judgement for the people who programme it.',
    question: 'How are artists using platform-programmed live moments inside an album campaign?',
    needTags: ['performance_as_hero', 'community_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'EXPLORING',
    human: { statedBy: 'Leon', statedAt: '2026-09', precision: 'month' },
    opportunity: {
      name: 'YouTube Nights',
      line: 'CHVRCHES for the intimate-room, big-artist live format.',
    },
  },
  {
    key: 'station',
    title: 'A CHVRCHES destination',
    objective: 'An always-on home for the catalogue, the live material and the new record.',
    timing: 'Across the campaign and between campaigns',
    rationale:
      'The catalogue is broad rather than propped up by one video — the top video is 14.1% of visible '
      + 'viewing, the top 10 is 60.6%, and four separate eras are still working. That is the condition '
      + 'under which a destination is worth building.',
    recommendation:
      'Programme the channel as somewhere to arrive rather than somewhere a video happens to be. '
      + 'Playlists, end screens and homepage sequencing are the low-lift version of this.',
    question: 'How are artists building a permanent YouTube destination around a back catalogue?',
    needTags: ['named_series', 'catalogue_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    deepDivePoint:
      'Always on: a CHVRCHES Station holding catalogue, live and the new record, between campaigns as well as during.',
    human: { statedBy: 'Leon', statedAt: '2026-09', precision: 'month' },
    /* Not a pitch. A Station is something YouTube builds with an artist,
       not something a label ships on its own, so it belongs with the other
       platform conversations rather than beside four things we can go and
       do. It was appearing in both places, which is one idea twice. */
    opportunity: {
      name: 'CHVRCHES Station',
      line: 'An always-on destination connecting the new album, catalogue and live world.',
      /* Metallica TV: a continuous live stream on the band's own channel
         playing videos, live cuts and full concerts across every era. It
         has been running without a break since 6 Mar 2026 — which is the
         figure worth carrying, because it is the one that describes the
         format. Named by Leon, opened and read on 11 Sep 2026. */
      example: {
        label: 'Metallica TV',
        url: 'https://www.youtube.com/watch?v=1fz60gNnSdU',
        observed: 'catalogue, live cuts and full concerts, streaming without a break since March',
        checkedAt: '2026-09-11',
      },
    },
  },
];

export const ROLLOUT_PLANS: Record<string, PlanItem[]> = {
  chvrches: CHVRCHES_PLAN,
};

/* ══ Deriving status from what is actually recorded ══════════════════ */

/**
 * Progress state → rollout status.
 *
 * The mapping is narrow on purpose. PLANNED, IMPLEMENTED, OBSERVING, RESULT
 * and LEARNED all come from a human transition in the progress store; nothing
 * observed can produce them. So a rollout item cannot reach LIVE because
 * Watcher noticed an upload, which is the failure this whole layer exists to
 * prevent.
 */
function statusFromProgress(v: RecommendationProgressView | null, seed: RolloutStatus): RolloutStatus {
  if (!v || v.statusProvenance !== 'HUMAN') return seed;
  switch (v.status) {
    case 'PLANNED': return 'PLANNED';
    case 'IMPLEMENTED':
    case 'OBSERVING': return 'LIVE';
    case 'RESULT':
    case 'LEARNED': return 'COMPLETE';
    default: return seed;
  }
}

const OPEN_STATUSES: RolloutStatus[] = ['EXPLORING', 'RECOMMENDED', 'PLANNED'];

/* ══ Research attachment ═════════════════════════════════════════════ */

function tagSet(tags: (string | null | undefined)[]): Set<string> {
  const s = new Set<string>();
  for (const t of tags) {
    const c = t ? canonicaliseTag(t) : null;
    if (c) s.add(c);
  }
  return s;
}

/**
 * Library → the examples an item may show.
 *
 * The gate is `boardStatus`, unchanged and not re-implemented here: scores,
 * verification, and a source link a reader can follow. Everything that
 * matches the item's tags but fails the gate is COUNTED rather than dropped,
 * because "no verified examples yet" and "we have not looked" are different
 * answers and the tab has to be able to tell them apart.
 */
function attachResearch(
  item: PlanItem, library: CaseStudy[], artistSlug: string, itemId: string, researched: Map<string, string>,
): RolloutResearch {
  const want = tagSet(item.needTags);
  const matched = library.filter(c => {
    const has = tagSet(c.usefulFor ?? []);
    for (const t of Array.from(want)) if (has.has(t)) return true;
    return false;
  });

  const examples: RolloutExample[] = [];
  const proposals: RolloutProposal[] = [];
  let awaiting = 0;
  let awaitingPromotion = 0;

  for (const c of matched) {
    /* Proposals travel with the example whatever its state, labelled with
       whether the example itself has been promoted. They are proposals to
       Leon, not to the client. */
    for (const p of c.proposals ?? []) {
      if (p.artistSlug !== artistSlug) continue;
      proposals.push({
        exampleId: c.id, artist: c.subject, application: p.application,
        whatWouldHaveToBeTrue: p.whatWouldHaveToBeTrue, proposedBy: p.proposedBy, at: p.at,
        examplePromoted: promotionOf(c) === 'PROMOTED',
      });
    }

    /* Two gates, counted separately, because "nobody has checked this" and
       "Leon has not looked at this yet" call for different next actions. */
    if (!boardStatus(c).eligible) { awaiting++; continue; }
    if (!clientFacing(c).eligible) { if (promotionOf(c) === 'AWAITING') awaitingPromotion++; continue; }
    const overlap = Array.from(tagSet(c.usefulFor ?? [])).filter(t => want.has(t));
    examples.push({
      id: c.id,
      artist: c.subject,
      observedBehaviour: c.behaviourObserved,
      source: (c.sourceUrls ?? [])[0] ?? null,
      relevantRef: c.thumbnailVideoId ?? c.channelId ?? null,
      date: c.observedAt ?? null,
      /* The reason is the join, not a sentence about the example. It says
         which of THIS item's needs the example speaks to. */
      whyItMattersHere: `${c.possibleLearning} Relevant here because it addresses ${overlap.join(', ')}.`,
      verification: verificationOf(c),
      promotedBy: c.promotion!.by,
      promotedAt: c.promotion!.at,
    });
  }

  const lastResearchedAt = researched.get(itemId) ?? researched.get(`q:${item.question}`) ?? null;

  let note: string | null = null;
  if (!examples.length) {
    if (awaitingPromotion) {
      note = `${awaitingPromotion} verified example${awaitingPromotion === 1 ? '' : 's'} awaiting review. `
        + 'Nothing is shown here until a person has promoted it.';
    } else if (awaiting) {
      note = `${awaiting} candidate${awaiting === 1 ? '' : 's'} in the library address this, and none has been `
        + 'verified against the channel yet. An unverified claim about another artist is not evidence.';
    } else {
      note = 'Nothing in the research library addresses this yet. That is an absence of research, not a '
        + 'finding that nobody does it.';
    }
    if (lastResearchedAt) note += ` Last researched ${lastResearchedAt.slice(0, 10)}.`;
  }

  return {
    question: item.question, examples, awaitingVerification: awaiting, awaitingPromotion,
    proposals, lastResearchedAt, note,
  };
}

/* ══ Build ═══════════════════════════════════════════════════════════ */

export function buildRollout(
  report: CampaignProgressReport,
  library: CaseStudy[],
  runs: ResearchRun[] = [],
): Rollout {
  const plan = ROLLOUT_PLANS[report.artistSlug] ?? [];
  const limitations: string[] = [];
  const researched = lastResearchedByItem(runs);

  if (!plan.length) {
    return {
      artistSlug: report.artistSlug,
      items: [],
      currentQuestion: null,
      limitations: [
        `No rollout plan has been written for ${report.artistName}. The Deep Dive strategy still exists; `
        + 'nobody has turned it into a rollout.',
      ],
    };
  }

  const byId = new Map(report.recommendations.map(r => [r.recommendation.id, r]));

  const items: RolloutItem[] = plan.map((p, i) => {
    const recId = p.deepDivePoint
      ? mintRecommendationId(report.artistSlug, p.deepDivePoint) : null;
    const view = recId ? byId.get(recId) ?? null : null;

    if (recId && !view) {
      /* The join broke. Say so loudly rather than rendering an item that
         quietly shows no evidence because it is pointing at nothing. */
      limitations.push(
        `"${p.title}" is anchored to a Deep Dive recommendation that no longer resolves (${recId}). `
        + 'Its campaign evidence is missing because the join failed, not because nothing happened.',
      );
    }

    const seed: RolloutStatus = p.seedStatus ?? (p.deepDivePoint ? 'RECOMMENDED' : 'EXPLORING');
    const status = statusFromProgress(view, seed);

    const uploads = (view?.observedSince?.uploads ?? []).map(u => ({
      videoId: u.videoId, title: u.title, publishedAt: u.publishedAt, views: u.views,
    }));

    const evidence: RolloutEvidence = {
      stated: view?.implementation
        ? { by: view.implementation.statedBy, at: view.implementation.statedAt, note: view.implementation.note }
        : null,
      uploads,
      nextWatch: view?.nextWatch ?? null,
      absence: null,
    };
    if (!evidence.stated && !uploads.length) {
      evidence.absence = recId
        ? (view
          ? 'Nobody has recorded anything against this yet, and nothing has been published that attaches to it.'
          : 'Not joined to campaign evidence — see the limitation above.')
        : 'This is a possibility rather than a tracked recommendation, so there is nothing to record against it yet.';
    }

    return {
      id: `ro_${report.artistSlug}_${p.key}`,
      ordinal: i + 1,
      title: p.title,
      objective: p.objective,
      timing: p.timing,
      rationale: p.rationale,
      status,
      commitment: p.commitment,
      origin: p.deepDivePoint ? 'DEEP_DIVE' : 'HUMAN',
      attribution: p.human
        ? { statedBy: p.human.statedBy, statedAt: p.human.statedAt, precision: p.human.precision }
        : { statedBy: 'CHVRCHES Deep Dive', statedAt: report.deepDive?.capturedAt ?? '', precision: 'day' },
      recommendationId: recId,
      spine: p.spine,
      spineStatus: null,     // assigned below, across the whole spine
      needTags: p.needTags,
      pitch: p.pitch ?? null,
      opportunity: p.opportunity ?? null,
      recommendation: p.recommendation,
      campaignEvidence: evidence,
      grokResearch: attachResearch(p, library, report.artistSlug, `ro_${report.artistSlug}_${p.key}`, researched),
      lastUpdated: view?.implementation?.statedAt ?? report.deepDive?.capturedAt ?? '',
    };
  });

  /* ── The cover's spine, derived from the same items ────────────────
     The cover speaks IN MOTION / NEXT / AHEAD and keeps doing so. Those
     words are a rendering of rollout status, computed once here, so the
     two surfaces cannot drift. NEXT belongs to the first open spine item
     and to exactly one of them. */
  let seenNext = false;
  for (const it of items) {
    if (!it.spine) continue;
    if (it.status === 'LIVE') it.spineStatus = 'IN MOTION';
    else if (it.status === 'COMPLETE') it.spineStatus = 'COMPLETE';
    else if (!seenNext) { it.spineStatus = 'NEXT'; seenNext = true; }
    else it.spineStatus = 'AHEAD';
  }

  /* ── The current question ──────────────────────────────────────────
     The first open item in plan order, spine first. Nothing is hardcoded
     to CHVRCHES or to "first hero": when somebody records that first hero
     is live, this returns the next item's question on the following load. */
  const open = items.find(it => it.spine && OPEN_STATUSES.includes(it.status))
    ?? items.find(it => OPEN_STATUSES.includes(it.status))
    ?? null;

  const currentQuestion = open
    ? { question: open.grokResearch.question, becauseOf: open.title }
    : null;

  limitations.push(
    'This rollout is a plan, not a schedule. Only items marked as stated by a person have been '
    + 'confirmed by anyone; everything else is a recommendation or a possibility.',
  );
  limitations.push(
    'External examples shown as evidence have been verified and then promoted by a named person. '
    + 'Model-verified research that nobody has reviewed is counted, not shown. Proposed applications '
    + 'are a model\'s suggestions and change nothing until a person acts on them.',
  );
  if (items.some(it => it.commitment === 'POSSIBILITY')) {
    limitations.push(
      'Items marked POSSIBILITY were raised in conversation. No dates, venues, partner commitments or '
      + 'programme eligibility have been confirmed by this system for any of them.',
    );
  }

  return { artistSlug: report.artistSlug, items, currentQuestion, limitations };
}
