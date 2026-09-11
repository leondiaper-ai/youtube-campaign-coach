/**
 * AMYL AND THE SNIFFERS — Deep Dive context
 *
 * Transcribed from /public/amyl/index.html — a deck built for the signing
 * conversation (it closes "Amyl and The Sniffers × Virgin Music Group" and
 * frames its recommendations as "what VMG would do"). Figures come from the
 * verified 19 Aug 2026 YouTube public API pull, 92/92 videos; the deck's own
 * comments call that the `analysisSnapshot` and are explicit that a live
 * refresh must never alter it. The deck's `updated` month in
 * src/lib/resources.ts is August 2026, which is all the deck dates itself to.
 *
 * Amyl are NOT on the roster in src/lib/artists.ts, so `artistSlug` is 'amyl',
 * matching the deck route rather than a roster entry. The deck's own channel
 * slug is 'amylandthesniffers6771' (@amylandthesniffers6771).
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence.
 * Where the deck hedges — "that won't be true of every show or every song",
 * "an illustrative model", "this isn't a content quota", "we wouldn't present
 * it as guaranteed access" — the hedge is carried, because a pitch deck's
 * confident register is exactly the thing that should not survive being
 * restructured into fields a downstream system reads as fact.
 *
 * Ratios are not copied from the deck's stored `liveVsShort` / `liveVsBts`
 * constants: the deck computes every ratio at render time from the tier table
 * so no slide can hold a stale multiple. The medians are quoted instead.
 */

import type { DeepDiveContext } from '../types';

export const AMYL_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'amyl',
  artistName: 'Amyl and The Sniffers',
  title: 'Amyl and The Sniffers × YouTube — Virgin Music Group',
  deckUpdated: '2026-08',
  deckUrl: '/amyl',
  dataCapturedAt: '2026-08-19',

  coreThesis:
    'This is a channel already at scale whose videos already travel — 201,000 subscribers, 80,092,178 '
    + 'lifetime views, 10 official music videos carrying 78% of visible catalogue views. The problem is not '
    + 'reach and it is not footage; it is what happens between the uploads. Across Cartoon Darkness, 0 of 4 '
    + 'music videos were followed by meaningful longform inside 14 days — the next longform after Jerkin\' was '
    + '162 days later. Album week did not go quiet, it went short: eight Shorts, every one under 35 seconds. '
    + 'Shorts are 60.9% of uploads and 7.4% of visible views, so they earn attention and then have nowhere to '
    + 'send it. Meanwhile the catalogue has no lyric videos, no visualisers and no premieres at all, and the '
    + 'live archive — already the second-strongest format — is packaged as full sets when the song-level cuts '
    + 'are what travel. The proposal is to programme the 7-14 day window out of material that already exists, '
    + 'at minimal artist lift, and to build an always-on destination underneath it.',

  channelStrengths: [
    {
      point: 'A channel already at scale, with fans arriving and watching.',
      basis: '201,000 subscribers, 80,092,178 lifetime views, 92 public videos as at 19 Aug 2026. +3,148,897 views in the recent window; +1,000 subscribers over 30 days.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'The music videos already travel — they are the standout format by a wide margin.',
      basis: '10 official music videos, 40,766,006 views, median 3,431,086 — 78% of visible catalogue views from roughly 11% of the uploads. Some Mutts 7,726,261; Guided By Angels 7,255,988; Hertz 5,416,240.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Live is already one of Amyl\'s strongest YouTube formats — a strength, not a gap.',
      basis: '14 live longform uploads, 5,000,341 views, median 210,737 against a Shorts median of 28,077 and a behind-the-scenes median of 38,012. Deck: "This isn\'t a gap — it\'s a strength that hasn\'t been fully packaged yet."',
      needTags: ['archive_live'],
    },
    {
      point: 'Shorts earn the highest engagement on the channel.',
      basis: 'Median likes per 1,000 views: Shorts 38.7, live longform 24.4, all longform 18.3, music videos 14.7.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'The crossover is already happening without changing what the band are.',
      basis: 'BBC1 Live Sessions with Bru-C and Stone Roses 293,256; Guided by Angels live in São Paulo 275,659; RuPaul\'s Drag Race 187,590; ABC TV / RAGE guest programming 185,229; Bob Vylan feature 118,113. Deck: "You don\'t need to change what Amyl are to make the audience bigger."',
      needTags: ['collaboration'],
    },
    {
      point: 'Full public catalogue coverage — the analysis is not a sample.',
      basis: 'Verified 19 Aug 2026 pull across 92/92 videos; 52,270,388 views across the visible catalogue, 65.3% coverage of lifetime channel views.',
      needTags: [],
    },
  ],

  channelGaps: [
    {
      point: 'No music video in the last album campaign was followed by meaningful longform inside 14 days.',
      basis: '0 of 4 Cartoon Darkness music videos. Gaps to the next longform: U Should Not Be Doing That +92 days, Chewing Gum +20, Big Dreams +18, Jerkin\' +162.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Album week went short — the Shorts did their job and had nowhere to send the audience next.',
      basis: 'Eight Shorts across album week, every one under 35 seconds, seven inside the fourteen days after the video. Two cleared 185K (RAGE) and 293K (BBC1). No substantial longform for five months; next longform 1 Apr 2025 at 22,345 views.',
      needTags: ['first_week_density', 'shorts_programme', 'follow_up_7_14'],
    },
    {
      point: 'Upload volume sits in the format that carries least of the viewing.',
      basis: 'Shorts are 56 of 92 uploads (60.9%) and 7.4% of visible views; longform is 36 uploads (39.1%) and 92.6% of views. Deck: "upload volume in that format is a weak lever on channel views compared with one more music video or one well-packaged live asset."',
      needTags: ['shorts_programme', 'hero_continuity'],
    },
    {
      point: 'Three proven formats are entirely untapped across the whole catalogue.',
      basis: 'Across all 92 uploads: no lyric videos, no visualisers and no premieres. The only audio-led assets are 3 official audio uploads, the most recent from 2018. None of the ten biggest songs has a lyric video or a visualiser; 6 of 10 have no live version.',
      needTags: ['lyric_video', 'visualiser', 'premiere_behaviour'],
    },
    {
      point: 'Longform cadence is intermittent, with very long silences between uploads.',
      basis: 'Median longform gap since 2024 is 34 days, maximum 230. Longest listed gaps: 92, 162, 87, 102 and 230 days. 2023 saw a single longform upload across the entire year.',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
    {
      point: 'The live archive exists but is packaged as full sets, which is not what travels furthest here.',
      basis: 'Rock Werchter full set, 55 min: 243,454. I\'m Not A Loser, one song at The Echo, 2 min: 1,365,275. Control 823,344 and Maggot 801,898 as single songs; Ally Pally full set 64,377.',
      needTags: ['archive_live', 'catalogue_activation'],
    },
    {
      point: 'There is no always-on destination — the channel switches on when a campaign does.',
      basis: 'The deck proposes "Amyl and The Sniffers TV", "a programmed YouTube channel built entirely from material that already exists", so that "Amyl doesn\'t only appear when a campaign switches on". It does not exist today.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  campaignRisks: [
    {
      point: 'Reading the song-cut vs full-set comparison as a rule.',
      basis: 'The deck is explicit: song-level live assets "can travel significantly further — though that won\'t be true of every show or every song."',
      needTags: ['archive_live'],
    },
    {
      point: 'Treating the one-capture-becomes-a-programme model as a deliverable list.',
      basis: 'Deck: "An illustrative model"; "The exact asset mix would depend on the footage and the campaign moment — this isn\'t a content quota."',
      needTags: ['long_form_event', 'archive_live'],
    },
    {
      point: 'Presenting a YouTube Station as available.',
      basis: 'Deck: "A platform reference only — not a creative template. YouTube Stations is an emerging / beta opportunity VMG is exploring; availability and eligibility would need to be confirmed with YouTube. We wouldn\'t present it as guaranteed access."',
      needTags: ['named_series'],
    },
    {
      point: 'Setting targets on anything the analysis cannot currently see.',
      basis: 'Deck: "We wouldn\'t set targets on any of it before establishing a baseline." The whole analysis runs on the public API — "No YouTube Studio access has been used in this analysis."',
      needTags: [],
    },
    {
      point: 'Answering the gap with more artist-led filming.',
      basis: 'Deck: "More impact ≠ more obligations." Additional artist-led content is placed in the lowest priority band, "Only when it adds something".',
      needTags: ['low_band_time', 'low_new_production'],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Cut song-level assets out of live footage that has already been filmed — zero artist time.',
      basis: 'Deck live-library flow: existing capture (Werchter, Ally Pally, Sidney Myer, Williamstown, Croxton, Echo LA) → "Potential additional assets… Individual songs · live playlists · Shorts · archive & station programming · campaign follow-ups" → "Artist time required: Zero. The performances already happened."',
      needTags: ['archive_live', 'low_new_production', 'low_band_time'],
    },
    {
      point: 'Make the lyric and visualiser assets that do not exist yet, against songs that already carry an audience.',
      basis: '20 assets available to make across the ten biggest songs, which carry 40,766,006 views between them. Deck: "They are the cheapest formats to produce, need no artist time, and are exactly what the 7-14 day window is built to hold."',
      needTags: ['lyric_video', 'visualiser', 'follow_up_7_14'],
    },
    {
      point: 'Plan the 7-14 day follow-up before the first asset of a hero release goes live.',
      basis: 'Deck: "Hero releases would have their 7-14 day follow-up planned before the first asset goes live." The highlighted step in the architecture is "+7-14 days · Meaningful longform · Lyric · visualiser · live".',
      needTags: ['follow_up_7_14', 'hero_continuity', 'release_sequencing'],
    },
    {
      point: 'Keep the Shorts and build longform for them to lead into.',
      basis: 'Deck: "Keep the Shorts. Build more longform around them." Funnel: Shorts (discovery, personality, cultural moments) → purposeful longform (music video, live song, visualiser, lyric, performance, event) → deeper watching → stronger channel relationship.',
      needTags: ['shorts_programme', 'follow_up_7_14'],
    },
    {
      point: 'Treat album week as the moment with the most new arrivals and give them somewhere further to go.',
      basis: 'Deck: "Album week is when the most new people arrive at a channel, which makes it the single biggest opportunity to give them somewhere further to go."',
      needTags: ['first_week_density', 'album_campaign'],
    },
    {
      point: 'Build an always-on programmed destination from material that already exists.',
      basis: 'Amyl and The Sniffers TV: "Live · Archive · Videos · Festival footage · Tour films · Interviews · Cultural moments", referencing Metallica TV as a live platform example.',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Use a single major live capture as a hero event and then release it song by song.',
      basis: 'Architecture rows: "Album week · Hero live event · One capture" and "Post-album · Song-level releases · Same footage". Deck: "Capture once. Package intelligently. Extend the life of the moment."',
      needTags: ['long_form_event', 'archive_live', 'live_dates_tie_in'],
    },
    {
      point: 'Reserve hero lift for a culturally meaningful broadcast or collaboration.',
      basis: 'Priority 2 in the deck\'s prioritisation: "Selective hero moments — Major live capture · Premiere · A culturally meaningful broadcast or collaboration."',
      needTags: ['collaboration', 'premiere_behaviour'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Live song cutdowns and existing archive first — the highest-impact, lowest-lift work.',
      basis: 'Priority 1 list: "Live song cutdowns · Existing archive · Lyric & visualiser assets · Captions · Catalogue optimisation · Smart sequencing · Shorts from existing moments · Station programming."',
      needTags: ['archive_live', 'low_new_production', 'catalogue_activation'],
    },
    {
      point: 'Lyric videos and visualisers as the deployable follow-up format.',
      basis: 'Named in Priority 1 and in the "+7-14 days · Meaningful longform" step. Zero of each exist across 92 uploads today.',
      needTags: ['lyric_video', 'visualiser', 'follow_up_7_14'],
    },
    {
      point: 'One capture serving two roles — full performance for existing fans, individual songs for discovery.',
      basis: 'Deck: "Full performance — serves existing fans and deeper viewing. Individual song assets — create additional discovery opportunities."',
      needTags: ['archive_live', 'long_form_event'],
    },
    {
      point: 'Shorts from existing moments rather than as a separate production line.',
      basis: 'Priority 1 names "Shorts from existing moments"; the album-week Shorts are cited as having done their job (185K and 293K).',
      needTags: ['shorts_programme', 'low_new_production'],
    },
    {
      point: 'Additional artist-led filming only when there is a clear reason for it.',
      basis: 'Lowest priority band: "Bespoke behind-the-scenes · Additional social filming · Extra promotional content" — "Only when it adds something."',
      needTags: ['low_band_time', 'bts_process'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Hero single: official music video, as the cultural moment.',
      basis: 'Deck architecture row 1.',
      needTags: ['hero_continuity'],
    },
    {
      point: '+1-3 days: Shorts and Community, built from music video offcuts.',
      basis: 'Deck architecture row 2.',
      needTags: ['shorts_programme', 'community_activation'],
    },
    {
      point: '+7-14 days: meaningful longform — lyric, visualiser or live. This is the step the deck says it would add.',
      basis: 'Deck architecture row 3, the highlighted step: "The highlighted step is the one we\'d add."',
      needTags: ['follow_up_7_14', 'lyric_video', 'visualiser'],
    },
    {
      point: '+14-21 days: a live song asset from tour capture.',
      basis: 'Deck architecture row 4.',
      needTags: ['archive_live', 'live_dates_tie_in'],
    },
    {
      point: 'Between releases: archive, cultural and live material that is already happening.',
      basis: 'Deck architecture row 5.',
      needTags: ['catalogue_activation', 'named_series'],
    },
    {
      point: 'Album week: a hero live event from one capture.',
      basis: 'Deck architecture row 6.',
      needTags: ['long_form_event', 'first_week_density', 'album_campaign'],
    },
    {
      point: 'Post-album: song-level releases cut from the same footage.',
      basis: 'Deck architecture row 7.',
      needTags: ['archive_live', 'release_sequencing'],
    },
    {
      point: 'The point is continuity, not volume.',
      basis: 'Deck: "The goal isn\'t more content. It\'s keeping attention moving between major moments as we build towards a bigger UK and European album campaign."',
      needTags: ['hero_continuity'],
    },
  ],

  existingSuccesses: [
    {
      point: 'Official music videos as a repeatedly successful format across seven years.',
      basis: '10 music videos spanning 2019 to 2024, median 3,431,086 views, 40,766,006 in total.',
      needTags: [],
    },
    {
      point: 'Song-level live cuts that outperform the full sets they came from.',
      basis: 'I\'m Not A Loser at The Echo (2 min) 1,365,275; Control at The Croxton 823,344; Maggot from Williamstown 801,898.',
      needTags: ['archive_live'],
    },
    {
      point: 'Album-week Shorts that genuinely reached people.',
      basis: 'RAGE guest programming Short 185,229 on 22 Oct; BBC1 Short 293,256 on 30 Oct, five days after release.',
      needTags: ['shorts_programme', 'first_week_density'],
    },
    {
      point: 'Cartoon Darkness charted while this was the publishing pattern.',
      basis: 'Cartoon Darkness, released 25 Oct 2024, #9 UK.',
      needTags: ['album_campaign'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'Metallica TV as the live platform example for an always-on channel.',
      basis: 'Confirmed via YouTube oEmbed, 19 Aug 2026, video id 1fz60gNnSdU. The deck notes it is "Platform reference only — we do not reproduce Metallica branding."',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  keyEvidence: [
    { claim: '201,000 subscribers; 80,092,178 lifetime views; 92 public videos; 52,270,388 views across the visible catalogue (65.3% coverage).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'verified 19 Aug 2026 public API pull, 92/92 videos', observedAt: '2026-08-19' },
    { claim: '+3,148,897 views in the recent window; +1,000 subscribers over 30 days; 0 over 7 days.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: '/api/artist-live?slug=amylandthesniffers6771 recent-window delta', observedAt: '2026-08-19' },
    { claim: 'Longform 36 uploads / 92.6% of visible views / median 354,910; Shorts 56 uploads / 7.4% of views / median 28,077.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck format table, classified from the 92-video catalogue', observedAt: '2026-08-19' },
    { claim: 'Format tiers: music videos 10 / median 3,431,086; early catalogue 4 / 516,722; live longform 14 / 210,737; fan Q&A 1 / 78,105; official audio 3 / 48,800; behind the scenes 4 / 38,012; Shorts 56 / 28,077. Reconciles to 92 uploads and 52,270,388 views.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck tier table (appendix)', observedAt: '2026-08-19' },
    { claim: '0 of 4 Cartoon Darkness music videos received a longform follow-up inside 14 days; gaps 92, 20, 18 and 162 days.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck OMV follow-through table', observedAt: '2026-08-19' },
    { claim: 'Eight Shorts across album week, all under 35 seconds, seven inside 14 days of the Jerkin\' video; next longform 1 Apr 2025 at 22,345 views.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck album-week timeline', observedAt: '2026-08-19' },
    { claim: 'No lyric videos, no visualisers and no premieres anywhere in the 92-upload catalogue; 3 official audio uploads, latest 2018.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck formatGaps — counted across all 92 uploads; per-song flags are keyword matches against every upload naming that song', observedAt: '2026-08-19' },
    { claim: 'Median longform gap since 2024 is 34 days, maximum 230 days.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck appendix, all longform uploads since 2024', observedAt: '2026-08-19' },
    { claim: 'Engagement by format, median likes per 1,000 views: Shorts 38.7, live longform 24.4, all longform 18.3, music videos 14.7.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck engagement table', observedAt: '2026-08-19' },
    { claim: 'View concentration: top 5 videos 56.1%, top 10 78.0%, top 20 91.2%.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck concentration figures', observedAt: '2026-08-19' },
    { claim: 'Song cut vs full set: I\'m Not A Loser (2 min) 1,365,275 against Rock Werchter full set (55 min) 243,454 and Ally Pally full set (24 min) 64,377.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: 'video ids J9fhUladvAU, vpeTzbBWyno, BI1AZH2aRDM — deck states this is not true of every show or song', observedAt: '2026-08-19' },
    { claim: 'Truth or Consequence, a concert film directed by John Angus Stewart, in cinemas end of August 2026 with the soundtrack on limited vinyl; trailer at 23,389 views.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck concertFilm block, trailer id t6w9HI0oJGI', observedAt: '2026-08-19' },
  ],

  knownConstraints: [
    'The deck works entirely from the public YouTube API. Its own source bar states: "No YouTube Studio access has been used in this analysis." Nothing here covers retention, watch time, traffic sources, returning viewers, subscriber attribution, paid vs organic, Living Room share, or playlist and editorial placement.',
    'Artist lift is treated as the binding constraint. Priority 1 is explicitly "High impact · minimal artist lift", and additional artist-led filming sits in the lowest band, "Only when it adds something".',
    'The stored history behind the recent-window figure is 23 days. The deck deliberately says "recent" rather than naming a number of days, because the window anchors to the latest stored reading and stretches if a daily reading was missed.',
    'A YouTube Station is not available to plan against: "an emerging / beta opportunity VMG is exploring; availability and eligibility would need to be confirmed with YouTube."',
    'No next-album date, title or release plan appears anywhere in the deck. Every timing recommendation is expressed relative to a release, never as a calendar date.',
  ],

  knownCampaignPlans: [
    'Truth or Consequence, a concert film directed by John Angus Stewart, is in cinemas end of August 2026, with the soundtrack on limited vinyl. Its trailer is on the channel at 23,389 views.',
    'The deck builds "towards a bigger UK and European album campaign". No album, date or tracklist is named.',
  ],

  youtubePlatformOpportunities: [
    { point: 'Premieres — never used on this channel.', basis: '0 premieres across all 92 uploads. Premiere appears in the deck\'s Priority 2 "selective hero moments" and in the one-capture asset list.', needTags: ['premiere_behaviour'] },
    { point: 'Shorts as a deliberate discovery layer feeding longform, not as standalone uploads.', basis: 'Deck funnel: Shorts for "Discovery · personality · cultural moments" then "Purposeful longform".', needTags: ['shorts_programme', 'follow_up_7_14'] },
    { point: 'Community posts alongside Shorts in the days straight after a hero.', basis: 'Deck architecture row 2: "+1-3 days · Shorts · Community · From OMV offcuts".', needTags: ['community_activation'] },
    { point: 'Catalogue optimisation, captions, smart sequencing and live playlists as low-lift channel work.', basis: 'All named in the deck\'s Priority 1 list.', needTags: ['catalogue_activation', 'release_sequencing'] },
    { point: 'A programmed always-on station, if access can be confirmed.', basis: 'Amyl and The Sniffers TV, referencing Metallica TV. The deck flags Stations as emerging / beta and not guaranteed.', needTags: ['named_series', 'catalogue_activation'] },
  ],

  openQuestions: [
    'Where do the views actually come from? Browse / Suggested / Search split is on the deck\'s explicit "not available" list.',
    'Does the song-cut advantage hold once show, song and asset age are accounted for? The deck says it will not be true of every show or every song.',
    'What live footage exists beyond the 14 live longform uploads on the channel, and who controls the rights to cut it?',
    'Is a YouTube Station actually available to this channel? The deck says eligibility would need to be confirmed with YouTube.',
    'What is the next album timeline, and how does Truth or Consequence sit relative to it?',
    'How much of the +3,148,897 recent-window figure is catalogue drift versus anything current? Only 23 days of stored history sit behind it.',
    'Would lyric videos and visualisers perform here at all? The channel has never published one, so there is no internal precedent to read.',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what the deck argued, not OBSERVED evidence about the channel now — figures were captured on 19 Aug 2026 and will drift.',
    'The deck was built for a signing conversation. Its register is persuasive throughout ("what VMG would do", "Imagine what we can build with the full picture"), and the framing selects for what a label could add. That is not the same as a neutral audit of the channel, and recommendations should be read with that in mind.',
    'No YouTube Studio or Analytics data is used anywhere. The deck states this on its own slide and lists nine things it cannot see, including territory, retention and subscriber attribution.',
    'The deck establishes what was published, when, and what those assets have accumulated since. It does not establish causation for any format, and the empty 7-14 day window is a description of what was published, not a measured cause of any outcome.',
    'Lifetime view totals are used throughout. They are not velocity and must not be divided by asset age. The deck\'s "recent window" figure is the only non-lifetime view measure in it, and its window length is not exactly fixed.',
    'Format classification is the deck author\'s, applied to the 92-video catalogue. The lyric/visualiser/live flags per song are keyword matches against upload titles, so an asset titled unconventionally would be missed.',
    'The one-capture-becomes-a-programme model and the campaign architecture are illustrative. The deck says so twice — "an illustrative model", "this isn\'t a content quota".',
    'Amyl and The Sniffers are not in src/lib/artists.ts, so this record cannot be joined to a roster entry by slug without adding them.',
  ],
};
