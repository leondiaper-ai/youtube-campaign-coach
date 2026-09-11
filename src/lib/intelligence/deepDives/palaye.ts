/**
 * PALAYE ROYALE — Deep Dive context
 *
 * Transcribed from /public/palaye/index.html (deck updated September 2026 per
 * src/lib/resources.ts; figures from a YouTube Data API v3 pull taken 2 Sep
 * 2026 across @PalayeRoyale — 340 of 340 uploads — @SumerianRecords and the
 * auto-generated Palaye Royale - Topic channel, with several figures
 * re-verified on 4 Sep 2026). No Studio or Analytics data.
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence,
 * taken from the `const A = {...}` data object, the slide templates, and the
 * long code comments where the deck author put the reasoning.
 *
 * This deck is unusually explicit about what it withdrew and why — the
 * 222,160,315 ecosystem total, the 84-episode Royal Television count, the
 * 3.7x-a-Short comparison, the "the videos didn't land on the artist channel"
 * argument, the 81-days-dormant slide. Those corrections are carried here as
 * risks and limitations rather than dropped, because a withdrawn number that
 * is not recorded as withdrawn is a number that comes back.
 *
 * The October-to-January campaign is a PLAN the deck asserts, so it sits in
 * knownCampaignPlans, not in evidence.
 */

import type { DeepDiveContext } from '../types';

export const PALAYE_DEEP_DIVE: DeepDiveContext = {
  /* Palaye Royale is not in the ARTISTS roster in src/lib/artists.ts. The only
     slug the codebase carries for them is the deck href in src/lib/resources.ts
     ('/palaye'), which is the same convention CHVRCHES uses. */
  artistSlug: 'palaye',
  artistName: 'Palaye Royale',
  title: 'Palaye Royale × YouTube — The Album Campaign',
  deckUpdated: '2026-09',
  deckUrl: '/palaye',
  dataCapturedAt: '2026-09-02',

  coreThesis:
    'The audience is not missing, it is distributed. 201,511,732 current observed views sit across '
    + 'three mapped destinations — Sumerian 142,510,177 (71%), the artist channel 37,762,412 (19%), '
    + 'the Topic audio pages 21,239,143 (11%) — and the deck never argues for moving the hero videos '
    + 'off Sumerian, which has 2.98M subscribers and 32 Palaye music videos going back a decade. The '
    + 'diagnosis is not a quiet channel: 136 uploads in 24 months makes the artist channel more active '
    + 'than four of the six peers analysed. It is "busy without a job" — 90% of those uploads are '
    + 'Shorts and only 14 are longer pieces, so there is nowhere for attention to land after a video. '
    + 'The spine of the deck is "Don\'t post more. Give the channel a job." Keep the reach on Sumerian, '
    + 'build the home on the artist channel: Royal Television restarted as four episodes tied to the '
    + 'four hero moments, live and performance as the second music moment, Shorts demoted to support.',

  channelStrengths: [
    {
      point: 'The reach already exists, and most of it sits on a partner channel that is an asset, not a problem.',
      basis: '201,511,732 current observed views across three mapped destinations. Sumerian 142,510,177 (71%) with 2,980,000 subscribers and 32 Palaye Royale music videos; Mr. Doctor Man 19,267,727, Lonely 11,305,166, Broken 7,767,605. Verified zero shared video IDs across the three destinations.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'The channel is genuinely active — the effort is already going in.',
      basis: '136 uploads in the trailing 24 months, active in 17 / 24 months. The deck: "That is a higher upload rate than most bands we looked at." More active than four of the six peers analysed.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'They already own a programmed series — the ask is restart, not invent.',
      basis: 'Royal Television is 69 real episodes across 5 seasons and 3,308,906 views on those episodes. The deck: CHVRCHES and Amyl "would be starting a programmed series from nothing. Palaye Royale already run one."',
      needTags: ['named_series'],
    },
    {
      point: 'Live and acoustic performance is the strongest non-music-video format the channel has ever carried, on their own evidence.',
      basis: 'Four 2020 live/acoustic videos median 133,828 views — Mr. Doctor Man Live Acoustic 283,747, Hang On To Yourself 157,980, Dying In A Hot Tub 109,675, Black Sheep 101,121. Six times Royal Television\'s Season 05 median of 22,318, despite being five years older.',
      needTags: ['archive_live'],
    },
    {
      point: 'The last campaign\'s music videos found an audience at real scale on Sumerian.',
      basis: 'The 2024 Death or Glory campaign: five hero videos, median 1,182,195, topping at 2,364,949. Feel Something, Great. 718,736 and Sad Generation 530,805, both outperforming their Topic audio pages.',
      needTags: ['album_campaign'],
    },
  ],

  channelGaps: [
    {
      point: 'The channel is busy without destinations — activity is almost entirely Shorts.',
      basis: '90% of the last 24 months\' uploads are Shorts: 135 of 136, leaving 14 non-Shorts. Shorts views 1,384,951, median 4,068 — stated in the deck as an observation, never as a verdict.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'There is nowhere for attention to land after a hero video.',
      basis: 'Deck slide 04: "Two singles went out with videos and found an audience. What the channel hasn\'t had is somewhere for that attention to land afterwards." 14 longer pieces to actually watch in 24 months.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'The owned series has stopped, and its last season drifted before it did.',
      basis: 'Last episode July 2025. Season 05 "began weekly on 28 Jan and then slipped to gaps of 14, 21 and 70 days before stopping." Season 05 is 12 episodes, median 22,318 views, median length 27 minutes.',
      needTags: ['named_series'],
    },
    {
      point: 'Nothing live has been posted to the channel in five years, despite live being the best-performing non-MV format they have.',
      basis: '"Nothing live has been posted to the channel since 2021," against the 2020 set\'s 133,828 median.',
      needTags: ['archive_live', 'low_new_production'],
    },
    {
      point: 'YouTube Collaborations is not being used on the releases, so a hero video builds one channel rather than two.',
      basis: 'Deck slide 05: "Collaborations has NOT been used on the Palaye Royale releases, so it is presented as a YouTube tool worth taking advantage of." The deck flags this as Leon\'s direct observation of the channels, not an API-verifiable fact.',
      needTags: ['collaboration'],
    },
  ],

  campaignRisks: [
    {
      point: 'Reading the Shorts figures as proof that Shorts do not work.',
      basis: 'Deck claim discipline, stated twice: "Public data cannot see discovery, subscriber acquisition, or Shorts-to-long-form journeys. The ONLY safe reading is that Shorts dominate the ACTIVITY while destinations are thin." The 4,068 median is an observation, never a verdict.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'Restarting Royal Television as a weekly treadmill.',
      basis: 'Season 05 went weekly from 28 Jan then slipped to gaps of 14, 21 and 70 days before stopping. Deck: "Don\'t restart a weekly series. Make four episodes matter."',
      needTags: ['named_series'],
    },
    {
      point: 'Mixing measurement bases when totalling the ecosystem.',
      basis: 'The withdrawn 222,160,315 used the artist channel\'s lifetime viewCount of 58,617,481 against per-video sums elsewhere, counting ~20.9m views on deleted or private videos. The corrected consistent basis drops the artist channel from 26% to 19%.',
      needTags: [],
    },
    {
      point: 'Restating Royal Television as 84 episodes.',
      basis: '84 uploads match the title, but 15 are 17-45 second promo clips (median duration 40s, median 6,192 views). The series is 69 real episodes and 3,308,906 views. "Do not restate 84." The all-time median of 31,888 and the "3.7x a recent Short" comparison are both withdrawn as not age-matched.',
      needTags: ['named_series'],
    },
    {
      point: 'Planning around YouTube Stations as though access is available.',
      basis: 'Deck slide 06, on-slide not in the source bar: "YouTube Stations is a new product still in beta — access isn\'t open to everyone yet, so this is one we\'d pitch YouTube for... Royal Television works as a programmed run whether or not we get it."',
      needTags: ['named_series'],
    },
    {
      point: 'Treating the YUNGBLUD and Metallica references as benchmarks Palaye could reproduce.',
      basis: 'Deck: "YUNGBLUD has roughly fourteen times Palaye\'s subscribers. Never imply Palaye would reach these numbers." Metallica is "a format example only, with no comparison of scale drawn."',
      needTags: [],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Restart Royal Television as four episodes tied to the four hero moments.',
      basis: 'Deck: "Four episodes tied to the four hero moments is the recommendation." Tier 2 of the format hierarchy: "The narrative around the record. Four episodes, tied to the four moments."',
      needTags: ['named_series', 'album_campaign', 'hero_continuity'],
    },
    {
      point: 'Make live or performance the second music moment between the videos.',
      basis: 'Tier 3 of the format hierarchy: "Live, acoustic or session · Your channel · The second music moment — so there is somewhere to go between the videos." Earned on the channel\'s own 2020 evidence, median 133,828.',
      needTags: ['archive_live', 'follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Make YouTube Collaborations the rule on all four hero videos.',
      basis: 'Deck slide 05: "YouTube Collaborations puts a single upload on both channels at once. It\'s there to be used — make it the rule on all four hero videos, so the release builds Sumerian\'s reach and your channel at the same time."',
      needTags: ['collaboration', 'release_sequencing'],
    },
    {
      point: 'Run the artist channel as one programmed destination rather than a sequence of separate uploads.',
      basis: 'The run in the deck: real episodes across four seasons with campaign slots dropped in — Lost In Translation, Live / tour, Album episode — so "new material joins the run rather than replacing it." Metallica TV named as the format reference.',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Build one recognisable world the record can return to all campaign.',
      basis: 'Deck slide 07: "One recognisable world, returned to all campaign. What\'s the Palaye version?" Ways in listed as: Performances · Royal Television · Behind the scenes · Shorts.',
      needTags: ['named_series', 'bts_process'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Music video stays the hero, and stays on Sumerian.',
      basis: 'Tier 1: "Official music video · Sumerian · The release itself. This is where the reach is, and it stays there."',
      needTags: ['album_campaign'],
    },
    {
      point: 'Royal Television carries the story on the artist channel.',
      basis: 'Tier 2: "Royal Television · Your channel · The narrative around the record."',
      needTags: ['named_series', 'bts_process'],
    },
    {
      point: 'Live, acoustic or session performance as the third format with its own job.',
      basis: 'Tier 3: "Performance · Live, acoustic or session · Your channel · The second music moment."',
      needTags: ['archive_live', 'follow_up_7_14'],
    },
    {
      point: 'Shorts demoted to support — cuts from the three formats above, not commissioned alone.',
      basis: 'Deck: "Cut from the three above, not commissioned on their own. They point at the work — they aren\'t the work."',
      needTags: ['shorts_programme'],
    },
    {
      point: 'Lyric videos and visualisers are response-led only, not default campaign deliverables.',
      basis: 'Deck: "Only when a particular song is already moving. Not automatic campaign deliverables." The code comment is blunter: "the evidence says they are the weakest default commitments here."',
      needTags: ['lyric_video', 'visualiser'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Keep the reach, build the home — one architecture, three roles.',
      basis: 'Sumerian = the music videos ("Nothing about that needs changing"); Palaye Royale = the campaign home ("Royal Television, live, behind the scenes, Shorts, playlists"); the audio pages = passive listening ("Automatic, and working. Leave them alone.").',
      needTags: ['catalogue_activation', 'collaboration'],
    },
    {
      point: 'Four moments, one connected campaign, with an episode and a performance between them.',
      basis: 'Deck slide 08: "The videos go out where the reach is. Between them: an episode, and a performance."',
      needTags: ['hero_continuity', 'release_sequencing', 'album_campaign'],
    },
    {
      point: 'Plan the long run into January specifically — the gaps are uneven.',
      basis: 'Deck: "The gaps are three to nine weeks — and the run into January is the long one. That is the part worth planning."',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
    {
      point: 'The campaign band: Build → Hero → Extend → Connect → Next.',
      basis: 'Deck slide 08 band row.',
      needTags: ['release_sequencing', 'follow_up_7_14'],
    },
  ],

  existingSuccesses: [
    {
      point: 'Royal Television, built and run to five seasons.',
      basis: '69 real episodes across 5 seasons, 3,308,906 views on those episodes, Season 05 median 22,318 at a median length of 27 minutes.',
      needTags: ['named_series'],
    },
    {
      point: 'The 2020 live and acoustic run on the artist channel.',
      basis: '4 videos, median 133,828 — "the best-performing non-music-video assets the artist channel has ever carried."',
      needTags: ['archive_live'],
    },
    {
      point: 'The 2024 Death or Glory campaign at hero scale on Sumerian.',
      basis: 'Five music videos, median 1,182,195, top 2,364,949.',
      needTags: ['album_campaign'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'Metallica TV — what a programmed artist destination looks like.',
      basis: 'Video id 1fz60gNnSdU, verified via oEmbed 2 Sep 2026. "Metallica run their channel as one programmed destination — catalogue, live and video held together in a single place, rather than a sequence of separate uploads." The deck explicitly carries no Metallica composition or cadence statistics: re-pulled figures did not reproduce and 1,763 of 2,482 uploads fell outside the classifier.',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'YUNGBLUD — what world building around the music looks like.',
      basis: 'Three environments verified 4 Sep 2026: Hansa Studios "11 assets" (a count, not views) — "Build a recognisable performance world"; BLUDFEST 9.1M — "Turn an owned world into a music moment"; Villa Park 18.2M — "Let major live moments become campaign assets." A reference for how the space between releases is used, not a performance benchmark.',
      needTags: ['archive_live', 'bts_process', 'named_series'],
    },
  ],

  keyEvidence: [
    { claim: '201,511,732 current observed views across three mapped destinations: Sumerian 142,510,177 (114 videos), artist channel 37,762,412 (340 videos), Topic 21,239,143 (154 videos). Zero shared video IDs across the three.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck data object A.eco; sum of currently visible uploads, pulled 4 Sep 2026', observedAt: '2026-09-04' },
    { claim: 'Sumerian Records has 2,980,000 subscribers and carries 32 Palaye Royale music videos; the artist channel has 272,000 subscribers.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data object A.eco', observedAt: '2026-09-02' },
    { claim: '136 uploads in the trailing 24 months, 135 of them Shorts (90%), 14 non-Shorts, active in 17 of 24 months. Shorts views 1,384,951, median 4,068.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data object A.activity, @PalayeRoyale uploads playlist 340 of 340', observedAt: '2026-09-02' },
    { claim: 'Royal Television is 69 real episodes across 5 seasons with 3,308,906 views; 15 further matching uploads are 17-45 second promo clips. Season 05 is 12 episodes, median 22,318 views, median length 27 minutes. Last episode July 2025.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck data object A.rtv; corrected from an earlier 84-episode count', observedAt: '2026-09-02' },
    { claim: 'Four 2020 live/acoustic videos on the artist channel median 133,828 views; nothing live posted since 2021.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data object A.live, n=4', observedAt: '2026-09-02' },
    { claim: 'The 2024 campaign\'s five music videos on Sumerian median 1,182,195 views, top 2,364,949. Feel Something, Great. 718,736; Sad Generation 530,805.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data object A.mvBase', observedAt: '2026-09-02' },
    { claim: 'The artist channel\'s lifetime channel-level viewCount is 58,617,481, of which ~20.9m sits on videos that have been deleted or made private.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck A.eco correction note; difference between lifetime viewCount and the per-video sum of 37,762,412', observedAt: '2026-09-04' },
    { claim: 'YouTube Collaborations has not been used on the Palaye Royale releases.', evidenceClass: 'HUMAN', trust: 'AMBIGUOUS', sourceRef: 'deck slide 05 comment — Leon inspecting the channels directly; the YouTube Data API exposes no collaborator field', observedAt: '2026-09-04' },
    { claim: 'Metallica TV exists as a programmed channel destination (video id 1fz60gNnSdU, channel Metallica).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'oEmbed verification', observedAt: '2026-09-02' },
  ],

  knownConstraints: [
    'The hero music videos go out on Sumerian. The deck never argues for moving them, and treats Sumerian throughout as a reach partner, not a problem.',
    'YouTube Stations is a beta product. Access is not open, so it is something we would have to pitch YouTube for; every recommendation must stand up without it.',
    'The deck works entirely from public YouTube Data API v3 data. No Studio or Analytics data is used — nothing on retention, traffic sources, discovery, subscriber acquisition or Shorts-to-long-form journeys.',
    'The YouTube Data API exposes no collaborator or co-authored-upload field, so nothing in this system can confirm whether Collaborations has been used on any given video.',
    'Collaborator surfaces beyond the three mapped destinations remain unmapped.',
  ],

  knownCampaignPlans: [
    'The album campaign starts 2 October 2026 and runs to 22 January 2027 — four music videos plus a deluxe.',
    '2 Oct 2026 — Lost In Translation, music video and album announce.',
    '27 Oct 2026 — single two, music video.',
    '19 Nov 2026 — single three, music video.',
    '22 Jan 2027 — the album, focus track and music video.',
    '25 Jan 2027 — deluxe, extended release.',
    'Recommended, not yet agreed: four Royal Television episodes tied to the four hero moments, a live or performance asset between the videos, and Collaborations used on all four heroes.',
  ],

  youtubePlatformOpportunities: [
    { point: 'YouTube Collaborations — one upload on both channels at once.', basis: 'Deck slide 05: "make it the rule on all four hero videos." Presented as a tool worth taking advantage of, with no reach claim attached — "public data cannot show what a collaboration adds."', needTags: ['collaboration'] },
    { point: 'YouTube Stations as a programmed home for Royal Television.', basis: 'On-slide beta caveat: access is not open, so this is one we would pitch YouTube for. "Worth being early on."', needTags: ['named_series', 'catalogue_activation'] },
    { point: 'Playlists and the channel as a programmed run rather than a sequence of uploads.', basis: 'Named in the artist-channel role: "Royal Television, live, behind the scenes, Shorts, playlists. Everything that turns a video into an era."', needTags: ['catalogue_activation', 'named_series'] },
  ],

  openQuestions: [
    'What is the Palaye version of a recognisable world? The deck asks this directly on slide 07 and does not answer it.',
    'Has YouTube Collaborations in fact been used on any Palaye release? The deck says this can only be settled by someone looking at the channels — an earlier version asserted the opposite on the same basis and was wrong.',
    'Can Stations access be secured for this campaign, or does Royal Television run as a programmed playlist instead?',
    'Does the 2020 live median hold for new performance material shot in 2026, or was it era-specific?',
    'What is on the collaborator surfaces that were never mapped, and how much Palaye viewing sits there?',
    'What band availability exists between 2 October and 22 January for new performance and Royal Television shoots?',
    'Where do the ~20.9m views on deleted or private artist-channel videos come from, and does any of that catalogue warrant reinstating?',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what we concluded, not OBSERVED evidence about the channel now — figures were captured 2 September 2026 (some re-verified 4 September) and will drift.',
    'The 201,511,732 total is the sum of currently visible uploads on three mapped destinations. It is always CURRENT OBSERVED VIEWS, never total Palaye YouTube views and never an audience. Views are not people. It is not a complete account of every Palaye Royale video on the platform.',
    'Lifetime view totals are used throughout. They are not velocity and must not be divided by asset age. The live median of 133,828 comes from assets five years old; the deck states this cuts against them rather than for them.',
    'The deck establishes no causation for any format. It must never claim that Shorts do not work or do not drive discovery, that the hybrid model will increase views, that Royal Television converts subscribers, or that live drives discovery. Public data cannot see any of that.',
    'No YouTube Studio or Analytics data is used anywhere in the deck.',
    'The peer research behind the format hierarchy (YUNGBLUD, BMTH, Bad Omens and others) is deliberately kept off the artist-facing surface and lives in PalayeRoyale_Strategy_Research_v1.md. This record states the conclusion the research earned, not the peer table.',
    'Metallica and YUNGBLUD are references, not benchmarks. YUNGBLUD has roughly fourteen times Palaye\'s subscribers; no Metallica composition or cadence statistic survived re-derivation and none is carried here.',
    'The claim that Collaborations has not been used is a direct human observation of the channels, not an API-verifiable fact — there is no API field that can settle it.',
    'Several figures in this deck are corrections of withdrawn earlier numbers (222,160,315 ecosystem total; 84 Royal Television episodes; 12,682 and 31,888 episode medians; the 3.7x-a-Short comparison; a hand-set 28-day countdown). They are recorded as withdrawn so they do not return.',
  ],
};
