/**
 * CHVRCHES — Deep Dive context
 *
 * Transcribed from /public/chvrches/index.html (deck authored August 2026,
 * figures captured from the YouTube Data API v3 on 26 Aug 2026).
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence.
 * Where the deck states a limitation — the lyric-video comparison is not
 * controlled, album five is inferred from two Shorts — that limitation is
 * carried here rather than dropped, because dropping it is how a hedged
 * observation becomes a confident recommendation two systems downstream.
 */

import type { DeepDiveContext } from '../types';

export const CHVRCHES_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'chvrches',
  artistName: 'CHVRCHES',
  title: 'CHVRCHES × YouTube — the next album',
  deckUpdated: '2026-08-27',
  deckUrl: '/chvrches',
  dataCapturedAt: '2026-08-26',

  coreThesis:
    'This channel is dormant and still earning, which is the opposite of a channel publishing into '
    + 'silence. 340 days without an upload and roughly 74,000 views a day still arriving, across a '
    + 'broad catalogue where the biggest single video is only 14.1% of viewing. The last album '
    + 'campaign, Screen Violence, built strong individual moments — every single premiered, every '
    + 'one with a pre-party — but left six weeks of quiet between them: 0 of 4 heroes had anything '
    + 'meaningful land in the 7-14 day window. The opportunity for album five is not better heroes. '
    + 'It is the weeks between them, and an always-on home for the catalogue underneath.',

  channelStrengths: [
    {
      point: 'The audience keeps arriving with no new uploads at all.',
      basis: '340 days since the last upload (20 Sep 2025); 5,866,985 views across a 79-day window, about 74,266 a day, annualising to roughly 27.1M. Subscribers moved 548,000 to 549,000 over the same period.',
      needTags: ['channel_reactivation', 'catalogue_activation'],
    },
    {
      point: 'Several real ways into the catalogue rather than one video holding the door open.',
      basis: 'Top video is 14.1% of visible viewing, top 10 is 60.6%. Leave A Trace 32.3M, The Mother We Share 31.1M, Clearest Blue 15.3M — four separate eras still working.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Lyric videos are an established part of the channel language, not an experiment.',
      basis: '11 lyric videos with a 2.04M median against 44 music videos with a 937K median. Warning Call 6.86M, Forever 6.45M, Never Ending Circles 5.38M.',
      needTags: ['lyric_video', 'follow_up_7_14'],
    },
    {
      point: 'A Premiere and pre-party ritual already exists and was run consistently.',
      basis: 'All 4 Screen Violence singles had a live stream opening 12-20 minutes before the video premiered on the hour. 13 Premieres confirmed on the channel overall.',
      needTags: ['premiere_behaviour', 'community_activation'],
    },
    {
      point: 'Real live material on the channel, including full-length sets — an asset many heritage channels do not have.',
      basis: '15 live uploads, 104K median, 5 full sets. Live at House of Vans 104,365 views at 101 minutes; Ancienne Belgique Brussels 29,351 at 27 minutes.',
      needTags: ['archive_live'],
    },
    {
      point: 'Release day has previously been treated as a moment in its own right.',
      basis: 'Screen Violence: 7 album assets published on 27 Aug 2021, 6.94M views on the day, plus a ONE WEEK CELEBRATION stream six days later.',
      needTags: ['first_week_density', 'album_campaign'],
    },
  ],

  channelGaps: [
    {
      point: 'The 7-14 day window after each hero was empty across the whole last campaign.',
      basis: '0 of 4 heroes had anything meaningful land in the 7-14 day window; 1 of 4 had anything within 14 days at all. Gaps to the next destination were 41, 39, 22 and 6 days.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Heroes do not connect to each other — assets cluster on release and then stop.',
      basis: 'Median hero-to-hero gap 21 days, longest 44. The deck: "Assets clustered around each single, then six weeks of quiet until the next."',
      needTags: ['hero_continuity', 'release_sequencing'],
    },
    {
      point: 'Live and archive material is present but under-programmed.',
      basis: '15 live uploads at a 104K median against a 937K music-video median. The most recent live asset is Brussels 2023. Archive live is listed as low-lift and unused.',
      needTags: ['archive_live', 'low_new_production'],
    },
    {
      point: 'There is no always-on destination between campaigns.',
      basis: 'The deck proposes a CHVRCHES Station referencing Metallica TV, described as running underneath catalogue, live and the new record "between campaigns as well as during" — i.e. it does not exist today.',
      needTags: ['catalogue_activation', 'named_series'],
    },
  ],

  campaignRisks: [
    {
      point: 'Reading the lyric-video median as proof lyric videos outperform music videos.',
      basis: 'The deck is explicit: different songs got different treatments, assets are different ages, song popularity is not controlled for. "This is not a like-for-like test."',
      needTags: ['lyric_video'],
    },
    {
      point: 'Repeating the 2021 pre-party format unchanged.',
      basis: 'The deck: the ritual was "born from a very different 2021 campaign environment, when everyone was leaning on livestreaming". Keep the lean-in, not necessarily the same format.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Treating album five as a known, dated plan.',
      basis: 'Album five is inferred from two Shorts on the channel: "Jvmpscare. CHV 5 in progress." (1 Jul 2025) and a Bones anniversary post tagged #chv5 (20 Sep 2025). No confirmed title, date or tracklist.',
      needTags: ['album_campaign'],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Programme the archive live rather than shooting more of it.',
      basis: 'Archive live is named in the deck\'s low-lift list alongside channel homepage, playlists, Community posts, catalogue clips and existing footage — things achievable without new production.',
      needTags: ['archive_live', 'low_new_production', 'low_band_time'],
    },
    {
      point: 'Give each hero a second destination inside 7-14 days.',
      basis: 'Stage 03 of the deck\'s campaign flow: "Lyric video + Live. Inside 7-14 days. Proven support that does not need another hero-scale shoot to earn its place."',
      needTags: ['follow_up_7_14', 'lyric_video', 'archive_live'],
    },
    {
      point: 'Reopen the channel before any announcement.',
      basis: 'Pre-campaign stage in the deck arc: "Catalogue, archive live, Community, playlists — before any announcement."',
      needTags: ['channel_reactivation', 'catalogue_activation', 'community_activation'],
    },
    {
      point: 'Build an always-on home so the catalogue and the new record sit in one place.',
      basis: 'The proposed CHVRCHES Station: catalogue as backbone with new material dropped into the run rather than replacing it. Reference: Metallica TV.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Lyric videos prepared across the campaign, ready to deploy in the follow-up window.',
      basis: 'Deck: "worth having ready across the campaign". Music videos remain 73.6% of visible viewing and stay the hero.',
      needTags: ['lyric_video', 'follow_up_7_14'],
    },
    {
      point: 'Live or performance material as the second destination after a hero.',
      basis: 'Deck flow stage 03 names lyric video and live together as the extend-the-moment formats.',
      needTags: ['archive_live', 'follow_up_7_14'],
    },
    {
      point: 'Selective direct access around the biggest moments — a short Q&A, a first look, fan questions gathered beforehand.',
      basis: 'Deck: "Live, Premieres and Community used selectively to give core fans direct access around the biggest moments."',
      needTags: ['community_activation', 'premiere_behaviour'],
    },
    {
      point: 'Shorts and Community before the release, to reactivate and to open a way in.',
      basis: 'Deck flow stage 01: "Reactivate the people already there and open a way in for people who are not. A start, not the destination."',
      needTags: ['shorts_programme', 'community_activation', 'channel_reactivation'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Pre-campaign: reopen the channel with catalogue, archive live, Community and playlists, before any announcement.',
      basis: 'Deck arc row 1.',
      needTags: ['channel_reactivation', 'catalogue_activation'],
    },
    {
      point: 'Single: official music video with the pre-party Premiere they already run.',
      basis: 'Deck arc row 2.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: '+7-14 days: a second destination — lyric video, live, or a performance while attention is still up.',
      basis: 'Deck arc row 3. This is the single clearest change available for the next album.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Release day: give every song a home, as Screen Violence did with seven assets on the day.',
      basis: 'Deck arc row 5.',
      needTags: ['first_week_density', 'album_campaign'],
    },
    {
      point: 'After release: back what moves — let the audience response decide what gets more support.',
      basis: 'Deck arc row 6.',
      needTags: ['release_sequencing'],
    },
    {
      point: 'Always on: a CHVRCHES Station holding catalogue, live and the new record, between campaigns as well as during.',
      basis: 'Deck arc row 7.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  existingSuccesses: [
    {
      point: 'The pre-party into Premiere ritual, run on every single.',
      basis: '4 of 4 singles; stream opened 12-20 minutes ahead; every video premiered on the hour. Verified from liveStreamingDetails.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Release day as a single large moment.',
      basis: '7 assets on 27 Aug 2021, 6.94M views that day.',
      needTags: ['first_week_density'],
    },
    {
      point: 'Lyric videos as a repeatedly used format across multiple eras.',
      basis: '11 lyric videos, top four between 5.06M and 6.86M views, spanning 2015 to 2020.',
      needTags: ['lyric_video'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'Metallica TV as the reference for an always-on channel destination.',
      basis: 'Named in the deck as the Station reference, video id 1fz60gNnSdU.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  keyEvidence: [
    { claim: '340 days since the last upload as at 26 Aug 2026 (last upload 20 Sep 2025).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/api/full-catalogue?handle=@chvrches', observedAt: '2026-08-26' },
    { claim: '5,866,985 views over a 79-day window, about 74,266 per day.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/api/artist-live?slug=chvrches', observedAt: '2026-08-26' },
    { claim: '549,000 subscribers; 316,658,266 lifetime views; 90 public videos, 132 uploads retrieved.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/api/artist-live?slug=chvrches', observedAt: '2026-08-26' },
    { claim: 'Format mix: 44 music videos (73.6% of visible viewing), 11 lyric, 15 audio, 15 live, 38 Shorts.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck format table, classified from catalogue', observedAt: '2026-08-26' },
    { claim: '0 of 4 Screen Violence heroes had a meaningful asset in the 7-14 day window.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck follow-through table; gaps 41/39/22/6 days', observedAt: '2026-08-26' },
    { claim: 'A live broadcast ran 12-20 minutes ahead of each of the 4 single premieres.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: 'videos.list liveStreamingDetails', observedAt: '2026-08-26' },
    { claim: 'Album five exists as a public signal only in two Shorts, dated 1 Jul 2025 and 20 Sep 2025.', evidenceClass: 'OBSERVED', trust: 'AMBIGUOUS', sourceRef: 'video ids RntlEwS6os8, SLfeY3TSDkg', observedAt: '2026-08-26' },
  ],

  knownConstraints: [
    'Album five has no confirmed title, date or tracklist. Every timing recommendation in the deck is expressed relative to release, never as a calendar date.',
    'The deck works entirely from public API data. No YouTube Studio data is used, so there is nothing on retention, traffic sources, new versus returning viewers, territories or subscriber attribution.',
  ],

  knownCampaignPlans: [
    'Album five is in progress, per two Shorts on the channel. Nothing further is public.',
  ],

  youtubePlatformOpportunities: [
    { point: 'Premieres with a pre-party stream ahead of the hero.', basis: 'Already proven on this channel — 4 of 4 singles.', needTags: ['premiere_behaviour'] },
    { point: 'Channel homepage and playlists as programming surfaces.', basis: 'Both named in the deck low-lift list.', needTags: ['catalogue_activation'] },
    { point: 'Community posts for direct address between uploads.', basis: 'Named in the deck low-lift list.', needTags: ['community_activation'] },
    { point: 'End screens and catalogue sequencing to route viewing between eras.', basis: 'Named in the deck low-lift list.', needTags: ['catalogue_activation', 'release_sequencing'] },
  ],

  openQuestions: [
    'Where do the ~27M annual views actually come from? The deck names Browse / Suggested / Search split as something it cannot see.',
    'Does the lyric-video advantage survive a controlled comparison — same song era, matched asset age?',
    'Would a 2026 audience engage with a pre-party livestream the way a 2021 audience did, or does the lean-in need a different format?',
    'Is there unreleased archive live footage beyond the 15 uploads already on the channel?',
    'What is the actual album five timeline, and how much band availability exists for new shoots?',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what we concluded, not OBSERVED evidence about the channel now — figures are from 26 Aug 2026 and will drift.',
    'The deck does not establish causation for any format. It establishes what was published, when, and what those assets have accumulated since.',
    'Lifetime view totals are used throughout. They are not velocity and must not be divided by asset age.',
    'Nothing here establishes whether the 7-14 day gap caused any outcome. It establishes that the window was empty.',
  ],
};
