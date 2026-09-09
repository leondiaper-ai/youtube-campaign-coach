/**
 * RESEARCH MISSIONS
 *
 * Scout searches with a question, not for popular artists. A mission is
 * that question, plus the queries that might answer it and the
 * deterministic test that decides whether a channel is worth a model call.
 *
 * ══ THE V1 SELECTION, AND WHY ════════════════════════════════════════
 *
 * The brief lists eight candidate missions. Three are active. The test
 * applied was not "which is most interesting" but "which can be answered
 * from public data without a claim we cannot support".
 *
 * Everything we can see reduces to one thing: a list of uploads with a
 * title, a publish date, a duration, a live flag and a lifetime view
 * count. That supports questions about SEQUENCE and COMPOSITION. It does
 * not support questions about AUDIENCE or CAUSATION.
 *
 * ACTIVE
 *
 *   POST_HERO      Pure sequencing. What was published, in what order,
 *                  how many days after the hero. Every input is a publish
 *                  date and a format, both of which we hold exactly.
 *                  Nothing about it requires knowing how anything
 *                  performed over time.
 *
 *   MULTI_FORMAT   Pure composition. Which formats appear, in what
 *                  proportion, and whether they cluster around releases
 *                  or are scattered. `classifyUploadFormat` already does
 *                  the classification and is used on our own roster, so
 *                  external channels get described in the same vocabulary.
 *
 *   LIVE           `liveStreamingDetails` and duration give us live and
 *                  performance content directly from the API rather than
 *                  by inference. It is also the mission with a live
 *                  internal question attached to it — the Amyl finding —
 *                  which makes it the one most likely to be useful the
 *                  day it returns something.
 *
 * NOT ACTIVE, AND THE REASON
 *
 *   BEST_IN_CLASS_CAMPAIGNS  Not a question, a category. In practice it is
 *                  the union of the other three, and running it alongside
 *                  them would return the same channels through a vaguer
 *                  filter.
 *
 *   CATALOGUE_AND_FRONTLINE  Needs to separate catalogue from frontline,
 *                  which needs each song's release date, not its upload
 *                  date. A channel uploading a 2019 song today looks
 *                  identical to one uploading a new single. We would be
 *                  guessing, and the guess would be invisible in the output.
 *
 *   SHORTS_AND_LONGFORM  The interesting version of this question is
 *                  whether Shorts feed long-form viewing, and that is a
 *                  Studio metric we do not have and will not have. We can
 *                  count Shorts and date them; we cannot connect them to
 *                  anything. A mission that can only produce a description
 *                  is a mission that will produce a plausible causal
 *                  sentence sooner or later.
 *
 *   UNUSUAL_STRATEGY and EMERGING_PRACTICE  Both are comparative: unusual
 *                  against what, emerging across whom. They need a corpus
 *                  of observed external channels, which is precisely what
 *                  the first three missions build. They become possible
 *                  after Scout has been running, not on day one. Attempting
 *                  them now would mean asking a model what it finds
 *                  surprising, which is a measure of the model rather than
 *                  of music YouTube.
 *
 * The three active missions share one evidence base — a single catalogue
 * pull per channel gives dates, durations, formats and live flags — so
 * running all three costs barely more quota than running one.
 */

export type MissionId =
  | 'POST_HERO'
  | 'MULTI_FORMAT'
  | 'LIVE'
  | 'BEST_IN_CLASS_CAMPAIGNS'
  | 'CATALOGUE_AND_FRONTLINE'
  | 'SHORTS_AND_LONGFORM'
  | 'UNUSUAL_STRATEGY'
  | 'EMERGING_PRACTICE';

export interface ResearchMission {
  id: MissionId;
  /** The question, as a strategist would ask it. */
  question: string;
  /** What Scout is looking for, in behaviour terms. */
  lookingFor: string;
  /** Search phrasings. Each costs 100 units, so these are few and specific. */
  queries: string[];
  /** Which best-practice principle this is testing, where one applies. */
  principleId: string | null;
  /** What this mission may not conclude, however tempting. */
  cannotConclude: string;
  active: boolean;
  /** Why active, or why not. Shown in the run report. */
  rationale: string;
}

export const MISSIONS: ResearchMission[] = [
  {
    id: 'POST_HERO',
    question:
      'Which artists keep a campaign alive after the main music video, rather than letting attention collapse?',
    lookingFor:
      'A hero release followed, within days rather than months, by further long-form on the same song or era — live takes, sessions, behind-the-scenes, alternate versions — in a deliberate-looking order.',
    queries: [
      'official music video behind the scenes making of',
      'live session after official video new single',
      'album trailer official video documentary',
    ],
    principleId: 'p_followup_window',
    cannotConclude:
      'That publishing after the hero caused anything. We can observe what was published and when; we cannot observe whether anyone who watched the hero came back.',
    active: true,
    rationale:
      'Pure sequencing. Every input is a publish date and a format, both held exactly.',
  },
  {
    id: 'MULTI_FORMAT',
    question:
      'Which artists use several YouTube formats as one coherent system, rather than simply uploading a lot?',
    lookingFor:
      'Three or more distinct formats deployed around the same release, clustered in time rather than scattered — not merely a high upload count.',
    queries: [
      'official visualizer lyric video official audio same album',
      'artist channel official video vertical performance visualiser',
      'new album official videos series episode',
    ],
    principleId: 'p_secondary_formats',
    cannotConclude:
      'That format variety produced the channel\'s results. Active campaigns produce both variety and promotion, and we cannot separate them.',
    active: true,
    rationale:
      'Pure composition, using the same format classifier we run on our own roster, so external channels are described in our vocabulary.',
  },
  {
    id: 'LIVE',
    question:
      'Which artists treat live and performance content as a deliberate part of their channel strategy rather than an occasional upload?',
    lookingFor:
      'Live or performance content appearing repeatedly and in a pattern — around releases, or at a sustained cadence — rather than one festival set uploaded in isolation.',
    queries: [
      'live session official performance artist',
      'live from full performance official artist channel',
      'stripped acoustic live version official',
    ],
    principleId: 'p_strength_not_exploited',
    cannotConclude:
      'That live content grew the channel. Lifetime view counts are not a time series, and a live video published two years ago has had two years to accumulate views.',
    active: true,
    rationale:
      'The API reports live and performance content directly via liveStreamingDetails and duration. It also has a live internal question attached to it, so a result is immediately useful.',
  },
  {
    id: 'BEST_IN_CLASS_CAMPAIGNS',
    question: 'Which artists are running unusually strong, coherent YouTube release campaigns?',
    lookingFor: 'Coherent campaign architecture across hero, support, cadence and depth.',
    queries: [],
    principleId: null,
    cannotConclude: '',
    active: false,
    rationale:
      'A category rather than a question — in practice the union of the three active missions, reached through a vaguer filter.',
  },
  {
    id: 'CATALOGUE_AND_FRONTLINE',
    question: 'Which established artists programme catalogue and current releases together well?',
    lookingFor: 'Deliberate interleaving of back-catalogue and new material.',
    queries: [],
    principleId: 'p_catalogue_is_an_asset',
    cannotConclude: '',
    active: false,
    rationale:
      'Needs each song\'s release date, not its upload date. A 2019 song uploaded today is indistinguishable from a new single, so the separation would be a guess.',
  },
  {
    id: 'SHORTS_AND_LONGFORM',
    question: 'Which artists connect Shorts structurally to a wider channel strategy?',
    lookingFor: 'Shorts timed and themed around long-form releases.',
    queries: [],
    principleId: 'p_shorts_are_not_a_funnel_claim',
    cannotConclude: '',
    active: false,
    rationale:
      'The interesting version asks whether Shorts feed long-form viewing, which is a Studio metric we do not have. Left inactive rather than allowed to produce a causal sentence we cannot support.',
  },
  {
    id: 'UNUSUAL_STRATEGY',
    question: 'Which channels are doing something meaningfully different from the patterns Watcher encodes?',
    lookingFor: 'Behaviour that does not fit our existing model.',
    queries: [],
    principleId: null,
    cannotConclude: '',
    active: false,
    rationale:
      'Comparative — unusual against what? Needs the corpus of observed external channels that the active missions build. Asking a model what surprises it measures the model, not music YouTube.',
  },
  {
    id: 'EMERGING_PRACTICE',
    question: 'What behaviours are appearing across several interesting channels at once?',
    lookingFor: 'A pattern repeated across independent channels.',
    queries: [],
    principleId: null,
    cannotConclude: '',
    active: false,
    rationale:
      'Requires repeated observations over time. Becomes possible once Scout has been running; impossible on the first run by definition.',
  },
];

export const ACTIVE_MISSIONS = MISSIONS.filter(m => m.active);

export function getMission(id: MissionId): ResearchMission | undefined {
  return MISSIONS.find(m => m.id === id);
}
