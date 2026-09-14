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

/**
 * A REFERENCE — something a person brought into the room
 *
 * Distinct from `RolloutResearch.examples`, and the distinction matters.
 * An example comes out of the research library: a model found it, a
 * verification run scored it, a named person promoted it. A reference is
 * the other route — somebody went and looked, checked the objects by hand,
 * and put it on the board. Both are held to the same standard of evidence;
 * only the path differs, and merging them would lose the ability to say
 * which is which.
 *
 * `objects` and `caveat` exist so the record can be stronger than the
 * slide. The slide shows one line of proof. The record keeps the ids that
 * were opened and, where something could NOT be verified directly, says so
 * — which is how a reference stays honest after the person who checked it
 * has forgotten the detail.
 */
export interface PlanReference {
  artist: string;
  /**
   * Set when the reference is not about the moment the question is about —
   * "Looking ahead · January". Without it, a good idea for a run in four
   * months sits next to two ideas for a single in eight days and all three
   * read as the same urgency.
   */
  horizon?: string;
  /**
   * THE INSTRUCTION.
   *
   * The test this field has to pass: could somebody walk into the meeting
   * and do this? "One night can last a year" is an observation about
   * another band. "Shoot once. Programme for months." is a thing to do.
   *
   * The failure mode is specific and worth naming, because three cards
   * drifted into it once already: every reference on this board is about
   * a release, so every headline wants to become a variation of "make the
   * release bigger". If two cards can be summarised the same way, neither
   * is specific enough yet, and what the research has found is something
   * interesting rather than a strategy.
   */
  mechanic: string;
  /** WHAT THEY DID. The mechanic as it actually happened, in one sentence. */
  did: string;
  /** The sequence the application implies, where it has one. */
  chain?: string;
  /**
   * One short line of observed proof, where the evidence is not already
   * inside `did`. Never a view count. Often absent, because a dated
   * timestamp in the sentence is better evidence than a line underneath it.
   */
  proof?: string;
  /** What CHVRCHES would do with it. One line. */
  application: string;
  /** A real video on that artist's channel. Never stock, never generated. */
  imageId: string;
  url: string;
  /** The lead reference is the one that answers the current question most directly. */
  weight: 'lead' | 'support';
  verifiedBy: string;
  verifiedAt: string;
  /**
   * Anything the API could NOT confirm. Kept in the record, never rendered,
   * so that a claim which rests partly on a band's own posts rather than on
   * a verifiable object can never quietly become "API-verified".
   */
  caveat?: string;
  /** The objects actually opened. For the record, not for the page. */
  objects: { id: string; note: string }[];
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
  /** Resolved instruction for the cover's read line. Null when unstated. */
  nextAction: string | null;
  /** Resolved formats for the follow-up window row. Null when unstated. */
  windowFormats: string | null;
  needTags: NeedTag[];
  recommendation: string;
  /** Present only on ideas that earn a picture. See PlanItem.pitch. */
  pitch: PlanItem['pitch'] | null;
  /** Present only on platform conversations. See PlanItem.opportunity. */
  opportunity: PlanItem['opportunity'] | null;
  /** Hand-checked references attached to this item's question. */
  references: PlanReference[];
  campaignEvidence: RolloutEvidence;
  grokResearch: RolloutResearch;
  lastUpdated: string;
}

export interface Rollout {
  artistSlug: string;
  items: RolloutItem[];
  /**
   * The question the campaign is currently asking, in the first person.
   *
   * Three different kinds of fact meet here and the shape keeps them apart:
   * the question is DERIVED from rollout state, the release name inside it
   * comes from the Coach plan where a person confirmed a date, and the
   * examples that answer it are verified research. `release` is null when
   * no confirmed release could be resolved — in which case the question is
   * the fallback wording, which names no release at all.
   */
  currentQuestion: {
    question: string;
    becauseOf: string;
    release: { title: string; date: string | null; source: 'coach_plan' } | null;
    /** The published asset the question is about, when it is about one. */
    hero: { title: string; publishedAt: string; source: 'observed' } | null;
  } | null;
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
  /**
   * The question with no release in it. This is the FALLBACK, and it must
   * always read as a complete sentence on its own — when the Coach plan
   * holds no confirmed release, this is what a reader sees, and "How do we
   * make UNKNOWN feel like an event?" is worse than saying nothing.
   */
  question: string;
  /**
   * The same question with `{release}` in it, used only when a confirmed
   * release resolves. The placeholder is filled from the Coach plan, never
   * from this file — the release title is a human's commitment and does not
   * belong hardcoded in a rollout, still less in the frontend.
   */
  /**
   * THE NEXT ACTION. What somebody would actually do on Monday.
   *
   * The cover's read line used to print the item's TITLE \u2014 "Next: Don't
   * leave the hero alone." A title is the name of an argument; it tells a
   * reader what the idea is called, not what to do about it. This field is
   * the clause that follows "Next:", and it is deliberately the smallest
   * unit of work the item asks for rather than a summary of the item.
   *
   * `nextActionTemplate` may name {hero} or {release} and is used only when
   * every token resolves, exactly as `questionTemplate` is. Without a
   * template \u2014 or with one that cannot be filled \u2014 `nextAction` is used
   * as written, so it must read as a complete instruction on its own.
   *
   * No terminal full stop: the renderer supplies it.
   */
  nextAction?: string;
  nextActionTemplate?: string;
  /**
   * The formats THIS artist's follow-up window is asking for. Only meaningful
   * on the item tagged `follow_up_7_14`.
   *
   * The timeline printed "Lyric \u00b7 Live \u00b7 Performance" for every artist,
   * because one artist's Deep Dive named those three. Each plan now states
   * its own, so the window row is this artist's recommendation rather than
   * the first artist's recommendation.
   */
  windowFormats?: string;
  questionTemplate?: string;
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
    /* ── WHAT THE CARD SHOWS ───────────────────────────────────────
       Three fields, in this order, and nothing else reaches the page:

         move    the instruction, in the largest type on the slide
         apply   one short sentence saying what to actually do
         proof   one number, set small

       Everything below them — headline, evidence, why, doThis, deepDive —
       stays in the record and renders nowhere. It was all true and all
       useful, and four cards carrying a headline, a WHY paragraph, a DO
       paragraph and an evidence line took longer to read than the strategy
       took to explain out loud. The analysis can stay sophisticated; the
       recommendation has to be obvious. */

    /** THE MOVE. Plain-English instruction. "Follow the hero", not
        "maintain momentum" — a reader should know what to do from the
        headline alone, without the sentence underneath it. */
    move: string;
    /** One short sentence. What we would actually do. */
    apply: string;
    /** One number, set small. Never a paragraph, never a view count as
        an argument for itself. */
    proof: string;
    /** A date or window, when the move has one. Only where it is real —
        a badge on every card makes none of them urgent. */
    when?: string;

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
  /** Hand-checked references that answer THIS item's question. */
  references?: PlanReference[];
  opportunity?: {
    name: string;
    /** The ask in four words, where it reads better than the name alone. */
    move?: string;
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
    nextAction: 'reopen the channel with catalogue, archive live and playlists',
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
    nextAction: 'give the next single a stated time and a Premiere',
    nextActionTemplate: 'give {release} a stated time and a Premiere',
    title: 'First hero',
    objective: 'The first major single moment of album five.',
    timing: 'Release day of the first single',
    rationale:
      'The pre-party into Premiere ritual already exists on this channel and ran on 4 of 4 Screen '
      + 'Violence singles. This is the one part of the last campaign that does not need changing.',
    recommendation:
      'Run the hero exactly as before — a live pre-party stream opening 12-20 minutes ahead of a video '
      + 'premiering on the hour. The change worth making is not the hero, it is what follows it.',
    question: 'How do we make the first hero feel like an event?',
    questionTemplate: 'How do we make {release} feel like an event?',
    needTags: ['premiere_behaviour', 'community_activation'],
    /* ── THE BOARD ───────────────────────────────────────────────────
       Three references, checked against the YouTube Data API on 13 Sep
       2026 — publishedAt for ordering, and scheduledStart / actualStart
       for the Premiere and live claims. Those two fields are the reason
       these are evidence rather than press: when both are present, a
       broadcast demonstrably aired at that timestamp. No view count was
       used to infer that anything worked.

       They are in this order on purpose. Anticipation, then the event,
       then what the event leaves behind — which is the same shape as
       this campaign's own assets: a trailer already out, a premiere
       ritual that already works, and a January run nobody has decided
       whether to film. */
    references: [
      {
        artist: 'Fontaines D.C.',
        mechanic: 'Turn release time into content',
        did: 'Trailer → announce the exact time → Premiere → keep resurfacing the single in Shorts.',
        proof: 'Premiere timestamps verified',
        application: 'Announce when Roses lands, not just that it\u2019s coming. Create the appointment '
          + 'on-channel, then keep resurfacing Roses after release.',
        imageId: 'KHocVRUlvkk',
        url: 'https://www.youtube.com/watch?v=KHocVRUlvkk',
        weight: 'lead',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-13',
        objects: [
          { id: '_zJ0J08drtQ', note: '12 Apr 2024 — "Pig." 30s Short, no song named' },
          { id: 'qCPCE0sjUTU', note: '15 Apr 2024 — "Romance" 91s album trailer' },
          { id: 'KHocVRUlvkk', note: '17 Apr 2024 — Starburster, scheduledStart 17:30:00, actualStart 17:30:06' },
          { id: 'Q3FkinT9yC8', note: '18 Apr 2024 — Short pointing back at the video the next morning' },
          { id: 'xIPVzwkrvTo', note: '22 Apr 2024 — one of four later Shorts all titled "Starburster."' },
          { id: '6KIDl6wVWFQ', note: '17 Aug 2026 — "Tomorrow. Our new single Marianne is out at 9AM."' },
          { id: 'lWNxWy012Ro', note: '18 Aug 2026 — Marianne, scheduledStart 16:00:00, actualStart 16:00:06' },
        ],
      },
      {
        artist: 'Magdalena Bay',
        mechanic: 'Premiere → band live',
        /* The proof line is gone because the evidence IS the sentence. Two
           timestamps ninety seconds apart say more than a label claiming
           they were checked. */
        did: 'Image ended 16:03:49. Their post-Premiere livestream was scheduled for 16:05.',
        application: 'We already bring fans together before a Premiere. What if the band is waiting '
          + 'for them when Roses ends?',
        imageId: 'DfcWOPpmw14',
        url: 'https://www.youtube.com/watch?v=DfcWOPpmw14',
        weight: 'support',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-13',
        objects: [
          { id: 'DfcWOPpmw14', note: '10 Jul 2024 — Image, actualStart 16:00:08, 221s, so it ended 16:03:49' },
          { id: 'CwJJIamlrdE', note: '10 Jul 2024 — "Image (Post-premiere Livestream)", scheduledStart 16:05:00, live 10m' },
          { id: 'tuwBXXm1wfk', note: '26 Aug 2024 — "That\u2019s My Floor (YouTube Afterparty)", live' },
        ],
      },
      {
        artist: 'The Cure',
        /* Marked, because this one is not about Roses. It is the right idea
           for a run four months away, and putting it on the same footing as
           two ideas for a single in eight days would misprice all three. */
        horizon: 'Looking ahead · January',
        mechanic: 'Shoot once. Programme for months.',
        did: 'One release-night performance generated observable YouTube programming across 14 months.',
        chain: 'Full performance → song cuts → Shorts → future campaign / catalogue',
        application: 'Capture CHVRCHES in Churches as a content bank, not one upload.',
        imageId: 'QA1lIQWU-EI',
        url: 'https://www.youtube.com/watch?v=QA1lIQWU-EI',
        weight: 'support',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-13',
        caveat:
          'The free global stream itself is not a public upload on the band\u2019s channel. The appointment is '
          + 'evidenced by their own Shorts announcing the time and then linking to the show, NOT by an archived '
          + 'stream object. What is directly API-verified is the fourteen months of programming that came out of '
          + 'that night. Do not describe the stream as API-verified.',
        objects: [
          { id: 'mC138bDHh2k', note: '1 Nov 2024 13:48 — Short announcing a free global live stream at 8pm GMT, same day as release' },
          { id: 'JltWsbj3uO8', note: '6 Nov 2024 — Short linking to the full show' },
          { id: 'pLAR6zVoAPc', note: '18 Dec 2024 — first Troxy song published as its own video' },
          { id: 'dqG3EqAz4OA', note: '27 Nov 2025 — Troxy songs still being published, a year on' },
          { id: 'CLg3qdD0Hew', note: '20 Nov 2025 — cinema trailer for the same night' },
          { id: '5k69qXrK7X8', note: '8 Jan 2026 — Troxy song, fourteen months after the show' },
        ],
      },
    ],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Single: official music video with the pre-party Premiere they already run.',
    pitch: {
      move: 'Make Roses an event',
      apply: 'Bring back the Premiere ritual.',
      proof: '4 / 4 singles had a pre-party',
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
    nextAction: 'put a second destination inside the 7-14 days after the hero',
    nextActionTemplate: 'give {hero} a second destination',
    windowFormats: 'Lyric \u00b7 Live \u00b7 Performance',
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
    question: 'How do we keep the moment moving?',
    needTags: ['follow_up_7_14', 'hero_continuity', 'lyric_video'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint:
      '+7-14 days: a second destination — lyric video, live, or a performance while attention is still up.',
    pitch: {
      move: 'Give every hero a second stop',
      apply: 'Lyric, live or performance within 7-14 days.',
      proof: '0 / 4 heroes had a follow-up',
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
    /* No template: `ctx.release` is the NEXT confirmed release, which for a
       campaign mid-rollout is a single, not the album. Substituting it here
       produced "give every song on Roses a home on release day" — a
       resolved token that reads as knowledge and is simply wrong. */
    nextAction: 'give every song on the album a home on release day',
    title: 'Give every song a home',
    objective: 'Release day as a single large moment rather than one upload.',
    timing: 'Album release day',
    rationale:
      'Screen Violence put seven assets out on 27 Aug 2021 and took 6.94M views that day. The pattern '
      + 'is this channel’s own, not a borrowed one.',
    recommendation:
      'Every track on the record should have somewhere to be watched on release day, even where that is '
      + 'a lyric video or a static visualiser rather than a shoot.',
    question: 'How do we give every song a home on release day?',
    needTags: ['first_week_density', 'album_campaign'],
    /* Held, not shown. This answers album-day architecture, not "how do we
       make the first hero an event", and surfacing it against the current
       question would be the research system flattering itself with the
       best thing it found rather than the right thing. It waits here until
       the rollout reaches the question it answers. */
    references: [
      {
        artist: 'Turnstile',
        mechanic: 'Give every track its own object on the day',
        did: '25 versions of the album by 25 other artists, all published inside 34 seconds.',
        application: 'Every track on the record has somewhere to be watched on release day.',
        imageId: '_gT_7kYdwhA',
        url: 'https://www.youtube.com/watch?v=_gT_7kYdwhA',
        weight: 'lead',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-13',
        objects: [
          { id: '_gT_7kYdwhA', note: '28 Aug 2026 04:00:05 — "SEEIN\u2019 STARS: ELTON JOHN VERSION"' },
          { id: 'wrFUhB5ygCY', note: '28 Aug 2026 04:00:29 — "LOOK OUT FOR ME: FOUR TET VERSION"' },
          { id: 'anDRVcLb9P4', note: '28 Aug 2026 04:00:22 — "LIGHT DESIGN: BLOOD ORANGE VERSION"' },
          { id: 'cI0Ysc-HdoM', note: '28 Aug 2026 04:00:23 — "CEILING: HAYLEY WILLIAMS VERSION"' },
          { id: 'F84YtZ7jPos', note: '28 Aug 2026 04:00:26 — "BIRDS: DYING FETUS VERSION"' },
          { id: 'cvIMI5Qrhbk', note: '28 Aug 2026 04:00:17 — "DULL: A. G. COOK VERSION"' },
          { id: '2QVSU-hDGGQ', note: '28 Aug 2026 04:00:21 — "LIGHT DESIGN: OKLOU VERSION"' },
          { id: 'RM-Eu-VNgfU', note: 'Earlier in the same campaign — official film trailer' },
        ],
      },
    ],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Release day: give every song a home, as Screen Violence did with seven assets on the day.',
    /* This one has always been in the spine and never had a card, so the
       playbook showed three moves and called itself four. */
    pitch: {
      move: 'Give every song a home',
      apply: 'Build a coherent album-wide lyric and visual system.',
      proof: '7 assets on album day · 6.94M views',
      headline: 'Give every song a home',
      evidence: '7 assets on album day',
      why: 'Screen Violence put seven assets out on one day and took 6.94M views.',
      doThis: 'Every track has somewhere to be watched, even if that is a lyric video.',
      imageId: 'e1YqueG2gtQ',
      deepDive: { slide: 'Screen Violence', figure: '6.94M views on 27 Aug 2021, across seven assets' },
    },
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
      move: 'Make CHVRCHES in Churches a format',
      apply: "Turn January's capture into a repeatable live idea.",
      proof: '15 live uploads · 5 full sets',
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
      line: 'Activate the core audience.',
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
      line: 'Big artist · intimate room.',
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
      line: 'New era · catalogue · live.',
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

/**
 * KINGS OF LEON, and a campaign at a different point in the same model.
 *
 * CHVRCHES is dormant, awake, walking towards a first hero. Kings of Leon
 * ran a 29-day public build, landed the hero on 10 September, and has
 * published nothing since. Same four-stage architecture, opposite problem:
 * one campaign is trying to create a moment, the other is trying not to
 * waste one.
 *
 * The order below is the order the campaign meets these, and the first one
 * has a deadline rather than a preference. That matters for the spine —
 * whichever item is first and open owns the strategy question, and for this
 * artist the honest question is not "how do we make this big" but "what
 * lands next, and it needs to be soon".
 *
 * ── ON THE ONE NUMBER THAT ISN'T HERE ─────────────────────────────────
 * The Deep Dive's largest observation is that the catalogue dwarfs the
 * campaign — 92.8% of the channel's movement in the last three weeks was
 * not this record. That is the biggest thing about this artist and it is
 * deliberately NOT one of the four cards, because public data cannot show
 * whether catalogue viewers currently reach new releases. The deck's own
 * words: "a routing opportunity, not a measured gap." It belongs in the
 * Station conversation with YouTube, where it is an ask rather than a
 * finding, and that is where it is.
 */
const KOL_PLAN: PlanItem[] = [
  {
    key: 'follow_up',
    nextAction: 'put one long-form destination inside the follow-up window',
    nextActionTemplate: 'give {hero} a second destination',
    windowFormats: 'Lyric \u00b7 Visualiser \u00b7 Live/performance',
    title: "Don't leave the hero alone",
    objective: 'A second meaningful destination while attention from the hero is still elevated.',
    timing: '7-14 days after the hero',
    rationale:
      'My Whole World is carrying almost all of the campaign\u2019s viewing on its own, and the plan holds '
      + 'nothing in the window that follows it. The last campaign managed a follow-up on 6 of 11 heroes, so '
      + 'this is a thing this team already does — when it is decided in time.',
    recommendation:
      'Put one meaningful long-form destination inside the 7-14 day window. It does not need to be new '
      + 'music: a performance, a film, or the same song presented another way all qualify, and all of them '
      + 'are cheaper than the hero was.',
    question: 'What should land after the hero?',
    questionTemplate: 'What should land after {hero}?',
    needTags: ['follow_up_7_14', 'hero_continuity'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Put a second meaningful destination inside 7-14 days, while attention is still elevated.',
    pitch: {
      move: 'Follow the hero',
      when: '17-24 Sep',
      apply: 'Put one meaningful long-form destination after My Whole World.',
      proof: '6 / 11 heroes had a follow-up last campaign',
      headline: "Don't leave the hero alone",
      evidence: '6 / 11 heroes had a follow-up last time',
      why: 'My Whole World is carrying the campaign almost by itself, and the window after it is empty.',
      doThis: 'Put one meaningful long-form destination inside the 7-14 days after the hero.',
      imageId: 'Bb7YN5wQztk',
      deepDive: { slide: 'Follow-through', figure: 'Gaps to the next long-form ran 19, 5, 4, 8, 5, 8, 7, 28, 21, 27 and 15 days' },
    },
    /* ── THE BOARD ─────────────────────────────────────────────────────
       Two references, both checked against the YouTube Data API on 14 Sep
       2026 using publishedAt, durationSec and the premiere fields. They
       answer the same question two different ways: extend the song, or
       change the object. Neither is a view-count argument. */
    references: [
      {
        artist: 'Lola Young',
        mechanic: 'One song. Five settings.',
        did:
          'From Down Here was filmed five times in five places and released a week apart \u2014 From The Water '
          + '(22 May), a Living Room (29 May), The Pool (5 Jun), Mirror (12 Jun), The Wooden Room (23 Jun).',
        proof: 'Five long-form objects, one song, roughly weekly',
        application: 'My Whole World can carry the window on its own. A second version is not a repost.',
        imageId: 'uF5HUfho2NU',
        url: 'https://www.youtube.com/watch?v=uF5HUfho2NU',
        weight: 'lead',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-14',
        objects: [
          { id: '-u9TRlZADmg', note: '22 May 2026 14:00:01 \u2014 "From The Water", 241s' },
          { id: 'uF5HUfho2NU', note: '29 May 2026 14:00:04 \u2014 "From a Living Room", 242s. Seven days after the first.' },
          { id: 'YFhpMpONGUY', note: '5 Jun 2026 15:00:20 \u2014 "From The Pool", 240s' },
          { id: 'N46TwoQjvAw', note: '12 Jun 2026 15:00:14 \u2014 "Mirror", 242s' },
          { id: 'bL_cOefk_J0', note: '23 Jun 2026 16:00:37 \u2014 "From The Wooden Room", 246s' },
        ],
      },
      {
        artist: 'Odeal',
        mechanic: 'The record, then the film about it',
        did:
          'Nine days after the record landed, a 15-minute tour documentary was premiered on the same channel '
          + '\u2014 a different kind of object entirely, not another song.',
        proof: 'Premiere timestamps verified on both',
        application:
          'Kings of Leon are on tour now. A film about the shows is a destination the band does not have to '
          + 'stop and make.',
        imageId: '9OzdjyBHVAo',
        url: 'https://www.youtube.com/watch?v=9OzdjyBHVAo',
        weight: 'support',
        verifiedBy: 'Claude',
        verifiedAt: '2026-09-14',
        caveat:
          'Scout logged this as a repeated 4-10 day pattern with HIGH confidence. Checking the objects, it is '
          + 'ONE sequence, not a pattern, and the card says so. Also worth holding against it: the 31 Jul drop '
          + 'was seven visualisers premiered at the same instant, which is the shape this playbook argues '
          + 'against for album day. The follow-up is the reference here; the drop is not.',
        objects: [
          { id: '-yMOMqgwTbQ', note: '31 Jul 2026 04:00:06 \u2014 one of seven visualisers, all premiered at the same second' },
          { id: '9OzdjyBHVAo', note: '9 Aug 2026 \u2014 "Summer Walker Tour Documentary", 936s, scheduled 18:05:06, live 18:07:51' },
        ],
      },
    ],
  },
  {
    key: 'premiere_next',
    nextAction: 'give the next priority single a stated time and a Premiere',
    /* Plain English, and specific to the opportunity that exists. "Make
       single two an appointment" is marketing-speak for a thing nobody can
       act on; the ACL headline show is a real date in the Coach plan and
       naming it is the difference between a slogan and a brief. */
    title: 'Use the ACL headline show to amplify Single 2',
    objective: 'Give the next priority single a stated time, a Premiere, and the ACL show behind it.',
    timing: 'The next priority single',
    rationale:
      'Seven of eleven music videos in the last campaign ran as confirmed Premieres. My Whole World did not '
      + '\u2014 it carries no scheduled or actual start time. The habit exists; it was not used this time.',
    recommendation:
      'Premiere the next priority single, with the Shorts pointing at a stated time rather than at a date. '
      + 'Keep it selective \u2014 premiering everything is how a Premiere stops meaning anything.',
    question: 'How do we turn the next single into an appointment?',
    needTags: ['premiere_behaviour', 'shorts_programme'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Keep Premieres, and keep them selective.',
    pitch: {
      move: 'Use the ACL show to amplify Single 2',
      apply: 'Give the next priority single a stated time and a Premiere.',
      proof: '7 / 11 videos premiered last campaign',
      headline: 'Make single two an appointment',
      evidence: '7 / 11 videos premiered last campaign',
      why: 'My Whole World was published, not premiered, though Premieres are established behaviour here.',
      doThis: 'Give the next priority single a stated time, and point the Shorts at the time.',
      imageId: 'Bb7YN5wQztk',
      frame: 2,
      deepDive: { slide: 'Premieres', figure: 'Counted only where the API returns both a scheduled and an actual start' },
    },
  },
  {
    key: 'album_day',
    /* No template: `ctx.release` is the NEXT confirmed release, which for a
       campaign mid-rollout is a single, not the album. Substituting it here
       produced "give every song on Roses a home on release day" — a
       resolved token that reads as knowledge and is simply wrong. */
    nextAction: 'choose one unmistakable destination for album day',
    title: 'Give album day one centre of gravity',
    objective: 'One unmistakable destination on release day, with everything else orbiting it.',
    timing: 'Album release day',
    rationale:
      'Last time ten long-form assets went out on one day. The album-day music video took 1.66m; the nine '
      + 'lyric videos beside it took 961k between them, at a 105k median.',
    recommendation:
      'Decide now which single object is the album-day destination, and programme the rest of the week '
      + 'around it rather than publishing everything at once.',
    question: 'What is the one thing album day is built around?',
    needTags: ['first_week_density', 'album_campaign', 'long_form_event'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Give release week a centre of gravity instead of publishing everything at once.',
    pitch: {
      move: 'Give album day one hero',
      apply: 'Choose one unmistakable destination for 6 November.',
      proof: '1.66M hero · 961K across nine lyric videos',
      headline: 'Give album day one centre of gravity',
      evidence: '1.66m for the video · 961k for nine lyric videos',
      why: 'Ten long-form assets landed on one day last time and the day had no centre.',
      doThis: 'Pick the one album-day destination now, and let the rest of the week orbit it.',
      imageId: 'Bb7YN5wQztk',
      frame: 3,
      deepDive: { slide: 'Release week', figure: '22 uploads and 3.3m views in release week, nine lyric videos on the day itself' },
    },
  },
  {
    key: 'shorts_route',
    nextAction: 'point every Short at the hero, the follow-up or the next release',
    title: 'Every Short needs somewhere to go',
    objective: 'Shorts that start a journey and then finish it somewhere.',
    timing: 'Continuous',
    rationale:
      'Sixteen Shorts ran in the 29 days before the hero, including a countdown ladder. The build worked. '
      + 'Last campaign 106 Shorts returned 11.7% of campaign views and ended there.',
    recommendation:
      'Point Shorts at the hero, the follow-up and the next destination deliberately, rather than letting '
      + 'them end on themselves. Public data cannot show whether viewers travel; that is the reason to make '
      + 'the route explicit rather than to assume it.',
    question: 'Where is each Short sending people?',
    needTags: ['shorts_programme', 'hero_continuity'],
    spine: true,
    commitment: 'COMMITTED',
    deepDivePoint: 'Give every Short a destination.',
    pitch: {
      move: 'Give every Short somewhere to go',
      apply: 'Point each Short at the hero, the follow-up or the next release.',
      proof: '16 Shorts built to My Whole World',
      headline: 'Every Short needs somewhere to go',
      evidence: '16 Shorts built to My Whole World',
      why: 'Shorts are already doing the campaign\u2019s build work, and they already end on themselves.',
      doThis: 'Route Shorts at the hero, the follow-up and the next destination, deliberately.',
      imageId: 'Pem_5ooqU2E',
      deepDive: { slide: 'Shorts', figure: '106 Shorts were 80% of campaign uploads and 11.7% of campaign views' },
    },
  },

  /* ── Platform conversations. Named, and not plans. ────────────────── */
  {
    key: 'station',
    title: 'Kings of Leon Station',
    objective: 'One persistent place where the catalogue, the live material and the new record sit together.',
    timing: 'Across and between campaigns',
    rationale:
      'The channel moved 13.5m views in three weeks and the campaign accounted for 7.2% of it. The scale of '
      + 'the catalogue relative to the campaign is the condition a Station is for.',
    recommendation:
      'Open the conversation with YouTube. Stations are an emerging product and eligibility needs confirming '
      + '\u2014 nothing here assumes access.',
    question: 'How are heritage artists programming a catalogue alongside a new record?',
    needTags: ['named_series', 'catalogue_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'RECOMMENDED',
    deepDivePoint: 'Build Kings of Leon TV as an always-on home for catalogue and new music together.',
    opportunity: {
      name: 'KOL Station',
      move: '20 years, programmed',
      line: 'Catalogue · new record · live · archive.',
      example: {
        label: 'Metallica TV',
        url: 'https://www.youtube.com/watch?v=1fz60gNnSdU',
        observed: 'catalogue, live cuts and full concerts, streaming without a break since March',
        checkedAt: '2026-09-11',
      },
    },
  },
  {
    key: 'youtube_nights',
    title: 'YouTube Nights',
    objective: 'Explore the band for the intimate-room, major-artist live proposition.',
    timing: 'Unscheduled',
    rationale:
      'A band with twenty years of catalogue and a tour already running is the shape of artist the format is '
      + 'built around. Whether that is a fit is a judgement for the people who programme it.',
    recommendation: 'Raise it as a partner ask. Nothing here has been checked against what the programme offers.',
    question: 'How are heritage artists using platform-programmed live moments?',
    needTags: ['performance_as_hero', 'community_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'EXPLORING',
    human: { statedBy: 'Leon', statedAt: '2026-09-14', precision: 'day' },
    opportunity: {
      name: 'YouTube Nights',
      move: 'Big band. Small room.',
      line: 'Explore KOL for an intimate live moment.',
    },
  },
  {
    key: 'premiere_afterparty',
    title: 'Premiere / Afterparty',
    objective: 'A larger platform-native appointment around a future priority single.',
    timing: 'A future priority single',
    rationale:
      'Premieres are established behaviour on this channel and the last one was not used. A bigger version of '
      + 'a habit the team already has is a cheaper ask than a new one.',
    recommendation: 'Explore what YouTube can put behind a Premiere, and what happens on the other side of it.',
    question: 'What does YouTube put behind a Premiere for an artist at this scale?',
    needTags: ['premiere_behaviour', 'community_activation'],
    spine: false,
    commitment: 'POSSIBILITY',
    seedStatus: 'EXPLORING',
    human: { statedBy: 'Leon', statedAt: '2026-09-14', precision: 'day' },
    opportunity: {
      name: 'Premiere + Afterparty',
      move: 'Premiere the next single, then keep the room',
      line: 'Premiere, then somewhere to go when it ends.',
    },
  },
];

export const ROLLOUT_PLANS: Record<string, PlanItem[]> = {
  chvrches: CHVRCHES_PLAN,
  kingsofleon: KOL_PLAN,
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
  question: string,
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
    question, examples, awaitingVerification: awaiting, awaitingPromotion,
    proposals, lastResearchedAt, note,
  };
}

/* ══ Build ═══════════════════════════════════════════════════════════ */

/**
 * What the rollout knows about the world outside itself.
 *
 * One field, deliberately. The release is the only thing the plan needs
 * from the Coach in order to speak in the campaign's own words, and taking
 * it as an argument rather than reading it here keeps this module free of
 * the plan store — which is what lets the tests build a rollout from a
 * report and nothing else.
 */
export interface RolloutContext {
  /** The next confirmed release from the Coach plan. Null is normal. */
  release?: { title: string; date: string | null } | null;
  /**
   * The most recent major asset this campaign has actually PUBLISHED.
   *
   * Two artists at different points in the same model need different nouns.
   * A campaign walking towards its first hero asks about the thing coming
   * ("How do we make Roses feel like an event?") and takes {release} from
   * the plan. A campaign whose hero has already landed asks about the thing
   * that landed ("What should land after My Whole World?") and takes {hero}
   * from the channel. One is a commitment, the other is an observation, and
   * collapsing them would put a confirmed future date inside a sentence
   * about the past.
   */
  hero?: { title: string; publishedAt: string } | null;
}

/**
 * The question, in the campaign's own words.
 *
 * An item carries two forms: `question`, which names no release and is
 * always a complete sentence, and `questionTemplate`, which has {release}
 * in it. The template is used ONLY when a confirmed release resolved. This
 * is the whole safeguard — there is no substitution of a placeholder for a
 * missing value, so "How do we make UNKNOWN feel like an event?" cannot be
 * produced by any path through this function.
 */
function questionFor(p: PlanItem, ctx: RolloutContext): string {
  return fillOrFallback(p.questionTemplate, p.question, ctx);
}

/**
 * Substitute {release} / {hero} into a template, or return the fallback.
 *
 * Every token the template asks for must resolve. A half-filled sentence is
 * worse than the fallback, because it reads as a system that knows something
 * it does not \u2014 "Next: give UNKNOWN a second destination." is precisely
 * the failure this exists to make unreachable.
 *
 * The same rule now governs the current question and the next action, so it
 * lives in one function rather than being written twice and drifting once.
 */
function fillOrFallback(
  template: string | undefined,
  fallback: string,
  ctx: RolloutContext,
): string {
  if (!template) return fallback;
  const values: Record<string, string | undefined> = {
    release: ctx.release?.title,
    hero: ctx.hero?.title,
  };
  const wanted = Array.from(template.matchAll(/\{(\w+)\}/g)).map(m => m[1]);
  if (!wanted.length || wanted.some(k => !values[k])) return fallback;
  return wanted.reduce((q, k) => q.replace(`{${k}}`, values[k]!), template);
}

export function buildRollout(
  report: CampaignProgressReport,
  library: CaseStudy[],
  runs: ResearchRun[] = [],
  ctx: RolloutContext = {},
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
        /* The artist's own Deep Dive, named from the report rather than typed.
           It said CHVRCHES on a Kings of Leon page until a second artist
           existed to notice \u2014 which is the whole argument for building the
           second one. */
        : { statedBy: `${report.artistName} Deep Dive`, statedAt: report.deepDive?.capturedAt ?? '', precision: 'day' },
      recommendationId: recId,
      spine: p.spine,
      spineStatus: null,     // assigned below, across the whole spine
      needTags: p.needTags,
      nextAction: p.nextAction ? fillOrFallback(p.nextActionTemplate, p.nextAction, ctx) : null,
      windowFormats: p.windowFormats ?? null,
      pitch: p.pitch ?? null,
      opportunity: p.opportunity ?? null,
      recommendation: p.recommendation,
      campaignEvidence: evidence,
      references: p.references ?? [],
      grokResearch: attachResearch(
        p, library, report.artistSlug, `ro_${report.artistSlug}_${p.key}`, researched,
        questionFor(p, ctx),
      ),
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
    ? {
      question: open.grokResearch.question,
      becauseOf: open.title,
      /* Named here rather than inside the question string, so a reader of
         the data can always tell where the noun came from. */
      release: ctx.release?.title
        ? { title: ctx.release.title, date: ctx.release.date ?? null, source: 'coach_plan' as const }
        : null,
      hero: ctx.hero?.title
        ? { title: ctx.hero.title, publishedAt: ctx.hero.publishedAt, source: 'observed' as const }
        : null,
    }
    : null;

  if (!ctx.release?.title) {
    limitations.push(
      'No confirmed release could be resolved from the campaign plan, so the strategic question is phrased '
      + 'without naming one. The release is not unknown to the label; it is unknown to this system.',
    );
  }
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
