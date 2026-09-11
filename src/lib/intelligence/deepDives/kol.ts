/**
 * KINGS OF LEON — Deep Dive context
 *
 * Transcribed from /public/kol/index.html (deck headed "Kings of Leon ×
 * YouTube — September 2026"; catalogue figures retrieved from the YouTube
 * Data API v3 on 24 Aug 2026 via /api/full-catalogue?handle=@kingsofleon,
 * channel UCfJein8E4rcYZSUCc8UqyMA, with the 2024 campaign and the current
 * era re-verified against the uploads playlist on 2 Sep 2026).
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence,
 * including the figures that live only in the deck's code comments and its
 * Analysis Appendix. The deck hedges hard in several places — era medians are
 * "directional" not controlled, the catalogue-to-new-music route is "a routing
 * opportunity, not a measured gap", the Split Screen sequence cannot show what
 * an earlier official video would have done, the 400 retrieved uploads carry
 * only 72.3% of lifetime views — and those hedges are carried here rather than
 * dropped, because dropping them is how a deliberately cautious observation
 * turns into a confident recommendation two systems downstream.
 *
 * Note on provenance fields: src/lib/resources.ts lists this deck as updated
 * "August 2026", which is the month used for `deckUpdated`; the deck's own
 * chrome says September 2026 and carries edits dated 2 Sep 2026.
 */

import type { DeepDiveContext } from '../types';

export const KOL_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'kingsofleon',
  artistName: 'Kings of Leon',
  title: 'Kings of Leon × YouTube',
  deckUpdated: '2026-08',
  deckUrl: '/kol',
  dataCapturedAt: '2026-08-24',

  coreThesis:
    'The audience is already here and it is historic: 2.46BN lifetime channel views, with 86.6% of '
    + 'visible viewing coming from uploads made between 2008 and 2013 and Sex on Fire alone holding '
    + '36.6% of everything the channel has accumulated. The new era has already started — 15 uploads '
    + 'since July 2026, 13 of them Shorts, three countdowns all resolving to 10 September — but the '
    + 'hero moment is still to come. The last album campaign, Can We Please Have Fun, shows what to '
    + 'repeat and what to change: Shorts kept it moving at 80% of uploads, long-form carried it at '
    + '88.1% of campaign views, and the whole campaign was 0.44% of the channel\'s lifetime viewing. '
    + 'So the recommendation is not more content — the last campaign had plenty. It is orchestration: '
    + 'give every priority release a journey (Build, Hero, Extend, with Always On underneath), make '
    + 'the new era impossible to miss from the catalogue, and programme the channel rather than '
    + 'asking the band for more.',

  channelStrengths: [
    {
      point: 'The scale is huge and the attention is historic — the audience is not something that needs finding.',
      basis: '2,463,178,724 lifetime channel views, 2,010,000 subscribers. A billion views across two songs: Sex on Fire 651,826,231 and Use Somebody 367,982,531.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Twenty years of catalogue that still defines the channel.',
      basis: '86.6% of visible viewing comes from uploads made between 2008 and 2013 (102 uploads, 1,543,354,513 views, typical music video 31,091,566).',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Rhythm held across the last campaign — the sequencing discipline is already there.',
      basis: 'Deck: "Median eight days between meaningful long-form destinations. Through May and June, eight drops with gaps of two to eight days."',
      needTags: ['release_sequencing'],
    },
    {
      point: 'Hero moments were premiered rather than silently uploaded.',
      basis: 'Seven of the eleven Can We Please Have Fun music videos ran as confirmed YouTube Premieres. Premieres counted only where the API returns both a scheduled and an actual start time.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Formats were varied — this was not a single-format campaign.',
      basis: 'Campaign format mix: OMV 11 uploads / 7.12m views, Lyric 12 / 1.88m, Shorts 106 / 1.31m, Live 3 / 460k, Visualiser 1 / 380k. Behind-the-song also used.',
      needTags: ['album_campaign'],
    },
    {
      point: 'Shorts stayed active between hero moments and engage far harder than long-form does.',
      basis: '106 Shorts across the campaign. Channel-wide: 185 Shorts at a 13,031 median and 36.7 likes per 1k, against official music videos at 4.2 likes per 1k.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'The current era is already building in public.',
      basis: '15 uploads since July 2026 — 13 Shorts and 2 tour posts — carrying lyrics, rehearsal footage and three countdowns (12 Aug "29 days", 17 Aug "24 days", 31 Aug "10 days") all resolving to 10 Sep 2026.',
      needTags: ['channel_reactivation', 'shorts_programme'],
    },
    {
      point: 'This band has serialised an album on YouTube before.',
      basis: 'Deck, Kings of Leon TV slide: "Kings of Leon have serialised an album here before — 24 Home Movies during Only By The Night, 2008."',
      needTags: ['named_series'],
    },
  ],

  channelGaps: [
    {
      point: 'The current era has no music destination yet — a build running ahead of its hero.',
      basis: 'Of the 15 uploads since July 2026 there is no official video, visualiser, lyric video, live performance, premiere or livestream: zero liveStreamingDetails across all 15. The deck is explicit this is NOT "no long-form" — two tour posts (116s and 90s) exist. Last long-form 9 July 2026.',
      needTags: ['channel_reactivation', 'shorts_programme'],
    },
    {
      point: 'Follow-through after a hero was real but not consistent.',
      basis: '6 of 11 heroes had another meaningful long-form destination inside fourteen days. Gaps to the next long-form destination ran 19, 5, 4, 8, 5, 8, 7, 28, 21, 27 and 15 days; median 8.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Hero reach fell across the campaign.',
      basis: 'First three heroes averaged 1.33m, last three averaged 336k — a 75% decline. The deck notes the sequence is not a straight decline: Ballerina Radio reached 855k in June, after two smaller releases.',
      needTags: ['hero_continuity', 'release_sequencing'],
    },
    {
      point: 'Release week had no centre of gravity — the album arrived all at once.',
      basis: 'Ten long-form album assets published on 10 May 2024 (nine track lyric videos plus the Nowhere to Run official video). Release week: 22 uploads, 3.3m views. Album-day music video 1.66m against nine album-day lyric videos totalling 961k at a 105k median.',
      needTags: ['first_week_density', 'album_campaign'],
    },
    {
      point: 'The catalogue dwarfs the campaign.',
      basis: 'The whole Can We Please Have Fun campaign — 132 uploads, 10.86m views — is 0.44% of the channel\'s lifetime viewing.',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Shorts engage but end there — they start journeys without somewhere to send people.',
      basis: 'Deck tools table: "106 Shorts returned 11.7% of campaign views. They start journeys well; they need somewhere to send people." Shorts were 80% of campaign uploads and 11.9% of campaign views.',
      needTags: ['shorts_programme', 'hero_continuity'],
    },
    {
      point: 'The live archive is shallower than it looks — it cannot be programmed like a deep archive.',
      basis: '30 live destinations at a typical 838,462, but only 1.9 hours in total and no full sets. The last campaign used 3. An earlier count of 51 at 409,840 included 13 sub-100-second clips and was dropped. Pre-2013 uploads were not recovered, so 30 is a floor.',
      needTags: ['archive_live', 'low_new_production'],
    },
    {
      point: 'There is no always-on environment where catalogue and new music sit together.',
      basis: 'The deck proposes Kings of Leon TV — "The iconic videos, selected live, the last album era and the new record — programmed together in one place that runs whether or not there\'s a campaign on." The Station wall carries two empty slots drawn as outlines, i.e. it does not exist today.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  campaignRisks: [
    {
      point: 'Reading the era medians as a measurement of decline.',
      basis: 'Deck, known limitations: "Era comparisons are directional. Older videos have had longer to accumulate views. Median-by-era indicates a pattern; it is not a controlled measurement."',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Reading the catalogue-to-new-music point as a measured failure of routing.',
      basis: 'Deck source bar: "A routing opportunity, not a measured gap — public data cannot show whether catalogue viewers currently reach new releases."',
      needTags: ['catalogue_activation'],
    },
    {
      point: 'Reading the Split Screen sequence as proof that the late official video underperformed.',
      basis: 'Lyric video 29 Mar 2024, 762,332 views, 42 days before the album; official video 8 Aug 2024, 488,414 — a 4.2× multiple on the day. The deck: lifetime view windows differ and the lyric video may have absorbed some of the song\'s demand; public data cannot show an earlier official video would have done better.',
      needTags: ['lyric_video', 'release_sequencing'],
    },
    {
      point: 'Treating the campaign reconstruction as confirmed release history.',
      basis: 'Deck: "The 2024 campaign is reconstructed from public upload behaviour. Actual release dates should be confirmed with the campaign team." The window was established from the uploads playlist, not from a release announcement.',
      needTags: ['album_campaign'],
    },
    {
      point: 'Treating 10 September 2026 as a stated deadline.',
      basis: 'Deck comment: the three countdown Shorts resolving to 10 Sep 2026 are stated "as evidence the build is running, never as a deadline — the deck has to still make sense when it is read after that date."',
      needTags: ['channel_reactivation'],
    },
    {
      point: 'Assuming Kings of Leon TV is available to build.',
      basis: 'Deck source bar: "YouTube Stations is an emerging / beta product — eligibility and access need confirming with YouTube."',
      needTags: ['named_series'],
    },
    {
      point: 'Reading the format split as a criticism of Shorts, or as causation.',
      basis: 'Deck source bar on the last-album slide: "Where views accrued, not what caused them — the principle is our recommendation, not a finding."',
      needTags: ['shorts_programme'],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Give every priority release a journey — Build, Hero, Extend — rather than a post.',
      basis: 'Deck slide 5: Build "Tease the story" (currently underway), Hero "Define the moment", Extend "Deepen the world". Supporting formats returned ~2.7m views last campaign across Lyric, Live and Visualiser.',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
    {
      point: 'Put a second meaningful destination inside 7-14 days, while attention is still elevated.',
      basis: 'Deck blueprint Phase 3: "Don\'t waste the attention — a second meaningful destination inside 7-14 days, while attention is still elevated." Last campaign managed this on 6 of 11 heroes.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Make the new era impossible to miss from the catalogue — that is where the audience already is.',
      basis: 'Deck map row: "Catalogue dwarfs the campaign → Connect the eras deliberately → Live · Station". Tools named: playlists ("turn a single catalogue view into a session that reaches the new record"), channel home ("if someone arrives through the catalogue, the current record should be impossible to miss"), end screens.',
      needTags: ['catalogue_activation', 'release_sequencing'],
    },
    {
      point: 'Give every Short a destination.',
      basis: 'Deck map row: "Shorts engage but end there → Give every Short a destination → Shorts → long-form."',
      needTags: ['shorts_programme', 'hero_continuity'],
    },
    {
      point: 'Build Kings of Leon TV as an always-on home for catalogue and new music together.',
      basis: 'Deck: "Where catalogue and new music can sit in the same environment permanently." Station wall alternates eras deliberately — a Station is a schedule, not an archive. Reference: Metallica TV.',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Programme the channel rather than asking the band for more.',
      basis: 'Deck decision 03: "Programme the channel. Don\'t ask the band for more. Always-on shouldn\'t mean always working." Low-lift list: channel homepage, playlists, catalogue pathways, Shorts from footage already captured, Community posts, end screens, Station programming.',
      needTags: ['low_band_time', 'low_new_production', 'catalogue_activation'],
    },
    {
      point: 'Give release week a centre of gravity instead of publishing everything at once.',
      basis: 'Deck map row: "Nine album assets landed in one day → Give release week a centre of gravity → Premiere · Live · Station." Blueprint Phase 4: "Make it one event. Programme it across the week. Do not publish everything at once."',
      needTags: ['first_week_density', 'album_campaign', 'long_form_event'],
    },
    {
      point: 'Keep Premieres, and keep them selective.',
      basis: 'Deck tools table: "Premieres — Hero moments. Already a strength — 7 confirmed. Keep it selective so the moments stay moments."',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Reach the existing subscriber base without another shoot.',
      basis: 'Deck tools table: "Community — Low-lift fan activation. Reach the existing subscriber base without another shoot."',
      needTags: ['community_activation', 'low_band_time'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Shorts, Community, a Premiere page and reminders to tease the story ahead of the hero.',
      basis: 'Deck plan, BUILD stage tools. Note on that stage: "Already happening: lyrics, rehearsal footage + a countdown before the reveal."',
      needTags: ['shorts_programme', 'community_activation', 'premiere_behaviour'],
    },
    {
      point: 'An official video, premiered, with a live or fan moment running into it, as the hero destination.',
      basis: 'Deck plan, HERO stage tools: "Official video · Premiere · Live / fan moment into it."',
      needTags: ['premiere_behaviour', 'hero_continuity'],
    },
    {
      point: 'Live, performance, lyric and Shorts as the Extend layer, each pointing at a next destination.',
      basis: 'Deck plan, EXTEND stage tools, with the proof figure "~2.7m views last campaign · Lyric · Live · Visualiser".',
      needTags: ['archive_live', 'lyric_video', 'follow_up_7_14'],
    },
    {
      point: 'Any live in this cycle should be newly captured, not dug out of the archive.',
      basis: 'Deck blueprint Phase 5: "Any live is newly captured, not dug out." The channel holds ~30 live assets, ~1.9 hours, and no full-length sets, so the archive argument does not hold for this artist.',
      needTags: ['archive_live', 'low_new_production'],
    },
    {
      point: 'Song-level assets and catalogue bridges after release, which keep working for months.',
      basis: 'Deck blueprint Phase 5: "Keep people in the record — song-level assets and catalogue bridges keep working for months."',
      needTags: ['catalogue_activation', 'release_sequencing'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Phase 1 · Now: reconnect the channel — purposeful long-form returns, catalogue pathways, homepage and playlists built, Station conversation opened with YouTube.',
      basis: 'Deck blueprint row 1.',
      needTags: ['channel_reactivation', 'catalogue_activation', 'named_series'],
    },
    {
      point: 'Phase 2 · Hero single: create the front door — a major long-form asset, premiered, with Shorts pointing toward it and Community supporting it.',
      basis: 'Deck blueprint row 2.',
      needTags: ['premiere_behaviour', 'shorts_programme', 'community_activation'],
    },
    {
      point: 'Phase 3 · Follow-through: a second meaningful destination inside 7-14 days.',
      basis: 'Deck blueprint row 3. Deck flow strip marks "+7-14 days · Live performance" as one of the two key steps.',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Phase 4 · Album week: make it one event, programmed across the week rather than published simultaneously.',
      basis: 'Deck blueprint row 4; deck flow strip: "Album week · Programmed, not simultaneous."',
      needTags: ['first_week_density', 'album_campaign', 'long_form_event'],
    },
    {
      point: 'Phase 5 · After: keep people in the record.',
      basis: 'Deck blueprint row 5; deck flow strip: "After · Keep it running."',
      needTags: ['release_sequencing', 'catalogue_activation'],
    },
    {
      point: 'Always on, spanning the three stages: featured video, releases, playlists, Community and Kings of Leon TV to keep the era visible.',
      basis: 'Deck plan, Always On row — "Keep the era visible" — which the deck states spans the three stages rather than following them.',
      needTags: ['named_series', 'catalogue_activation', 'community_activation'],
    },
  ],

  existingSuccesses: [
    {
      point: 'Premiering the hero videos.',
      basis: '7 confirmed Premieres across 11 music videos in the 2024 campaign, counted only where the API returns both a scheduled and an actual start time.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'A held publishing rhythm through the heart of the campaign.',
      basis: 'Median eight days between meaningful long-form destinations; through May and June, eight drops with gaps of two to eight days.',
      needTags: ['release_sequencing'],
    },
    {
      point: 'Follow-through on the majority of heroes.',
      basis: '6 of 11 heroes had another meaningful long-form destination inside fourteen days.',
      needTags: ['follow_up_7_14'],
    },
    {
      point: 'A varied format mix carried by long-form.',
      basis: '21% of campaign uploads were long-form and returned 88.3% of views (campaign-level split stated as 20% of uploads / 88.1% of views). Deck: "This is where the campaign actually lives."',
      needTags: ['album_campaign'],
    },
    {
      point: 'Serialising an album on the channel.',
      basis: '24 Home Movies during Only By The Night, 2008.',
      needTags: ['named_series'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'Metallica TV as the proof that the Station format is real and already running.',
      basis: 'Named in the deck with video id 1fz60gNnSdU: "A YouTube Station already running — this format is real."',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Kings of Leon\'s own EP #2 build in October 2025 as precedent for teasing ahead of a destination.',
      basis: 'Deck comment on the current-era slide: "Teasing ahead of the destination is exactly what this band did for EP #2 in October 2025, so a build running ahead of its hero is deliberate sequencing, not a gap."',
      needTags: ['release_sequencing', 'shorts_programme'],
    },
  ],

  keyEvidence: [
    { claim: '2,463,178,724 lifetime channel views; 2,010,000 subscribers; 400 retrievable public uploads; 1,781,647,638 attributable visible views.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/api/full-catalogue?handle=@kingsofleon (UCfJein8E4rcYZSUCc8UqyMA)', observedAt: '2026-08-24' },
    { claim: 'Catalogue coverage is 72.3% of lifetime views; earliest upload retrieved 24 July 2008, latest 21 August 2026.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck appendix, channel and coverage table', observedAt: '2026-08-24' },
    { claim: '86.6% of visible viewing comes from uploads made between 2008 and 2013 (102 uploads, 1,543,354,513 views).', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck eras table', observedAt: '2026-08-24' },
    { claim: 'Sex on Fire alone holds 36.6% of visible views; top 5 hold 68.4%, top 10 80.2%, top 20 89.8%, top 50 97.3%.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck concentration table', observedAt: '2026-08-24' },
    { claim: 'Format medians: 37 official music videos at 8,632,838; 30 live at 838,462 (1.9 hours total, 0 full sets); 12 lyric at 106,072; 185 Shorts at 13,031.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck formats table, >=100s destination rule; pre-2013 uploads not recovered so live n=30 is a floor', observedAt: '2026-08-24' },
    { claim: 'Can We Please Have Fun ran 22 Feb 2024 to 17 Oct 2024 with the album on 10 May 2024: 132 uploads, 10.86m views, 0.44% of lifetime viewing.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck campaign reconstruction, re-verified 2 Sep 2026 against the complete 404-upload playlist', observedAt: '2026-09-02' },
    { claim: 'Shorts were 80% of campaign uploads and 11.9% of campaign views; long-form 20% of uploads and 88.1% of views.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck last-album slide and appendix campaign table', observedAt: '2026-09-02' },
    { claim: '6 of 11 heroes had a meaningful long-form destination within 14 days; median gap 8 days.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck 2024 campaign sequencing table; meaningful long-form excludes Shorts and interviews', observedAt: '2026-09-02' },
    { claim: '7 of the 11 campaign music videos ran as confirmed Premieres.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: 'videos.list — counted only where both a scheduled and an actual start time are returned', observedAt: '2026-08-24' },
    { claim: 'First three heroes averaged 1.33m views, last three averaged 336k — a 75% fall; top 5 assets held 50% of campaign views.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck appendix; the deck notes the sequence is not a straight decline (Ballerina Radio 855k in June)', observedAt: '2026-09-02' },
    { claim: 'Ten long-form album assets published on 10 May 2024; album-day music video 1.66m against 961k across nine album-day lyric videos (median 105k).', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck appendix campaign table', observedAt: '2026-09-02' },
    { claim: '106 campaign Shorts, of which 22 (21%) were commerce posts — merch, vinyl, tickets, "out now" — at a 5.3K median against 9.5K for the rest.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck shortsJobs data; the deck states views are visible but click-through and sales are not', observedAt: '2026-08-24' },
    { claim: 'September 2024: 21 uploads, 20 of them Shorts, 1 long-form (Cold Desert SFTC in Palm Desert, 51,505); median Short 10.8K.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck sept data, retained for the review pack', observedAt: '2026-08-24' },
    { claim: '15 uploads since July 2026 — 13 Shorts, 2 tour posts, 3 countdowns resolving to 10 Sep 2026 — and zero liveStreamingDetails across all 15.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck nowEra, verified against the uploads playlist 2 Sep 2026', observedAt: '2026-09-02' },
    { claim: 'The channel returned in July 2026 after a seven-month gap; last long-form 9 July 2026; 8 uploads in the last 30 days, all Shorts.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck nowEra comment and monitored channel record', observedAt: '2026-09-02' },
    { claim: 'Split Screen lyric video 29 Mar 2024 at 762,332 (42 days before the album) against the official video 8 Aug 2024 at 488,414 — a 4.2× multiple.', evidenceClass: 'OBSERVED', trust: 'AMBIGUOUS', sourceRef: 'deck splitScreen data, retained in the review pack only', observedAt: '2026-08-24' },
  ],

  knownConstraints: [
    'The deck works entirely from public YouTube Data API v3 data. "No YouTube Studio or private Analytics data has been used" — so nothing on retention, Browse/Suggested/Search split, new versus returning viewers, audience overlap, territories, subscriber attribution, connected TV share or paid versus organic.',
    'Band time is the objection the deck expects: "More programming. Not more obligations." Everything in the low-lift list — channel homepage, playlists, catalogue pathways, Shorts from footage already captured, Community posts, end screens, Station programming — is achievable with little or no extra band time.',
    'The live archive cannot carry an always-on programme on its own: ~30 live assets, ~1.9 hours, no full-length sets. The credible Station argument is twenty years of catalogue, not archive.',
    'YouTube Stations is an emerging / beta product — eligibility and access need confirming with YouTube.',
    'Public subscriber figures round to the nearest 10,000 at this channel size, so short-window subscriber change is not readable from public data and is deliberately absent from the deck.',
  ],

  knownCampaignPlans: [
    'A new era is underway on the channel: since July 2026, lyrics, rehearsal footage, tour moments and countdowns, with the hero release still ahead.',
    'Three countdown Shorts (12 Aug, 17 Aug, 31 Aug 2026) all resolve to 10 September 2026. The deck states this as evidence the build is running, explicitly not as a confirmed date.',
    'The deck states the Station conversation with YouTube is something to open in Phase 1; it is not an agreed plan.',
  ],

  youtubePlatformOpportunities: [
    { point: 'Premieres and the Premiere page as hero moments.', basis: 'Already a strength — 7 confirmed in the last campaign. "Keep it selective so the moments stay moments."', needTags: ['premiere_behaviour'] },
    { point: 'Playlists as audience pathways.', basis: 'Deck: "Turn a single catalogue view into a session that reaches the new record."', needTags: ['catalogue_activation'] },
    { point: 'Channel home as the campaign front door.', basis: 'Deck: "If someone arrives through the catalogue, the current record should be impossible to miss."', needTags: ['catalogue_activation'] },
    { point: 'Community posts for low-lift fan activation.', basis: 'Deck: "Reach the existing subscriber base without another shoot."', needTags: ['community_activation', 'low_band_time'] },
    { point: 'End screens to route between eras.', basis: 'Named in the deck map row on building pathways into each release, and in the low-lift list.', needTags: ['catalogue_activation', 'release_sequencing'] },
    { point: 'A Station — Kings of Leon TV — for always-on programming.', basis: 'Deck: "Where catalogue and new music can sit in the same environment permanently." Reference: Metallica TV.', needTags: ['named_series', 'catalogue_activation'] },
    { point: 'Shorts as the discovery and engagement layer, pointed at a destination.', basis: 'Deck: "106 Shorts returned 11.7% of campaign views. They start journeys well; they need somewhere to send people."', needTags: ['shorts_programme'] },
  ],

  openQuestions: [
    'Do the people watching Sex on Fire also watch the new record? The deck names catalogue overlap as a Studio question it cannot answer.',
    'Are new releases surfacing in Suggested after catalogue videos?',
    'Is the current record reaching existing subscribers through Browse?',
    'Do campaign viewers come back across the campaign — what does returning-viewer behaviour look like?',
    'Do the new long-form destinations hold attention? Retention is not visible from public data.',
    'How much of this audience watches on a television — what is the Living Room / connected TV share?',
    'What are the actual Can We Please Have Fun release dates? The campaign window is reconstructed from upload behaviour and should be confirmed with the campaign team.',
    'Why does the uploads playlist return 400 items while channel statistics report 291 public videos? Unresolved, likely a difference in how Shorts are counted.',
    'Is Kings of Leon TV actually available — what are the Station eligibility and access terms?',
    'What does 10 September 2026 resolve to, and what hero asset exists behind the build?',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what we concluded, not OBSERVED evidence about the channel now — catalogue figures are from 24 Aug 2026, campaign and current-era figures from a 2 Sep 2026 re-verification, and all of them will drift.',
    'Coverage is incomplete: the 400 retrieved uploads carry 72.3% of lifetime channel views. The remaining 27.7% comes from content since removed, made private or delisted. The deck does not claim a complete historic catalogue.',
    'Era comparisons are directional, not controlled. Older videos have had longer to accumulate views; median-by-era indicates a pattern, it is not a measurement.',
    'Lifetime view totals are used throughout. They are not velocity and must not be divided by asset age.',
    'The deck establishes where views accrued, not what caused them. The Build/Hero/Extend plan and the catalogue-routing recommendation are stated by the deck as our recommendation, not as findings.',
    'The catalogue-to-new-music point is a routing opportunity, not a measured gap — public data cannot show whether catalogue viewers currently reach new releases, and the deck explicitly does not claim they do not.',
    'The Split Screen sequence cannot show that an earlier official video would have done better; lifetime view windows differ and the lyric video may have absorbed some of the song\'s demand. It carried no slide for that reason.',
    'The 2024 campaign window is reconstructed from public upload behaviour, not from a release announcement.',
    'Live counts rest on the deck\'s >=100 second destination rule and pre-2013 uploads were not recovered in the pull, so 30 live assets is a floor rather than an exact channel total. The full-set versus song-cut comparison cannot be tested for this artist.',
    'Shorts commerce figures show views only — click-through and sales are not visible.',
    'No YouTube Studio or private Analytics data is used anywhere: nothing here supports a claim about retention, traffic sources, impressions, CTR, unique viewers or subscriber attribution.',
    'Subscriber movement is not readable at this channel size from public data and is deliberately absent.',
    'Kings of Leon do not appear in the ARTISTS roster in src/lib/artists.ts at the time of transcription; `artistSlug` uses the slug the deck itself declares (ARTIST.meta.slug = \'kingsofleon\'), which is also the slug it calls /api/artist-live with.',
  ],
};
