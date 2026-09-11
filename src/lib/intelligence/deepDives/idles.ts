/**
 * IDLES — Deep Dive context
 *
 * Transcribed from /public/idles/index.html (deck authored September 2026,
 * every figure recomputed in IDLES_TANGK_Review_v1.md from a 4 Sep 2026 API
 * pull of 367/367 current uploads).
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence.
 * This deck is unusually explicit about what its numbers are NOT allowed to
 * mean — the 16.7x is "a description of what happened, not a forecast", the
 * 24 pandemic-era live broadcasts are "precedent, not a strategy to restore",
 * the 7-14 day window is "ours, not YouTube's", the CRAWLER comparison is
 * architecture only because those assets have had longer to accumulate. Those
 * limits are carried here as risks and limitations rather than dropped,
 * because dropping them is how a hedged observation becomes a confident
 * recommendation two systems downstream.
 */

import type { DeepDiveContext } from '../types';

export const IDLES_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'idles',
  artistName: 'IDLES',
  title: 'IDLES × YouTube — What TANGK taught us. What we’d try next.',
  deckUpdated: '2026-09',
  deckUrl: '/idles',
  dataCapturedAt: '2026-09-04',

  coreThesis:
    'The heroes worked. Four official music videos were 3.1% of TANGK’s uploads and took 64% of '
    + 'observed campaign viewing — 12.5M current views — and all four were Premiered, which IDLES are '
    + 'already exceptional at. The problem is what sat between them. TANGK was more active than '
    + 'CRAWLER and had fewer places to watch: 127 uploads but only 14 long-form destinations, 89% '
    + 'Shorts. 89 days between DANCER and Gift Horse with one long-form follow-up in the gap; 30 days '
    + 'to Grace with none; eight long-form assets in the third gap but all of them on album day, then '
    + '61 days without a new music destination. And across the entire campaign window, zero owned '
    + 'live or performance long-form from a band whose whole identity is live. So the change is '
    + 'architecture, not volume: keep the hero, Premiere it, and give the same song a second music '
    + 'moment roughly 7-14 days later — preferably from one built live world rather than more live '
    + 'uploads. Not more content, better programmed music moments.',

  channelStrengths: [
    {
      point: 'The hero format worked, and worked hard — a small number of videos carried the campaign.',
      basis: 'Four official music videos = 3.1% of campaign uploads and 64.1% of observed viewing; 12.5M current observed views. DANCER 6.21M, Gift Horse 3.18M, Pop Pop Pop 1.98M, Grace 1.11M.',
      needTags: ['album_campaign'],
    },
    {
      point: 'Premiere adoption is total and is a genuine channel strength — nothing to fix here.',
      basis: '13 of 13 official videos Premiered since 2021, including all four TANGK heroes. Deck action 01 is "Keep · Premiere every major video — already exceptional, change nothing."',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Lyric video is not a theoretical recommendation — TANGK already proved observed demand for it.',
      basis: '9 lyric assets, 2,637,503 current views, 270,007 median, 13.5% of campaign viewing. Top asset: Roy at 538K.',
      needTags: ['lyric_video'],
    },
    {
      point: 'They have already turned their own channel into an event space, and they know how.',
      basis: '24 live broadcast events across 4 named series plus 5 Q&As, Apr 2020 → Dec 2021. The deck labels this "2020–21 · pandemic era" and calls it capability and precedent, not a strategy to restore.',
      needTags: ['long_form_event', 'named_series'],
    },
    {
      point: 'Le Bataclan is the clearest positive exception in the owned live catalogue.',
      basis: '5 Bataclan assets at a 167K median against 26 other owned live assets at a 10K median — 16.7× the rest. One night, one name, a full concert film and individual songs off the same shoot.',
      needTags: ['archive_live', 'long_form_event'],
    },
    {
      point: 'The Shorts that broke out looked like the band rather than like promotion.',
      basis: '113 Shorts at a 17K median. FLYNN! at 699,263, and six of the top ten were personality-led: "Who’s the best Dancer?" 221K, "All is love." 202K, "Hello!" 197K, "I kissed a boy…" 122K.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'The live story existed during TANGK and reached a lot of people — just not on their own channel.',
      basis: '1.71M current observed views across four mapped BBC Music performances: DANCER · Glastonbury 724K, Gift Horse · Jools 576K, Gratitude · Glastonbury 225K, A Gospel · Jools 184K. The deck presents this as a strength, never as a problem.',
      needTags: [],
    },
  ],

  channelGaps: [
    {
      point: 'Zero owned live or performance long-form across the entire campaign, from a live band.',
      basis: 'The deck’s central reveal: 0 owned live / performance long-form across the whole TANGK campaign window, 1 Aug 2023 – 30 Dec 2024, 127 uploads. 0 live events during TANGK against 24 in 2020–21.',
      needTags: ['archive_live', 'long_form_event', 'low_new_production'],
    },
    {
      point: 'The music follow-through between heroes was thin or absent.',
      basis: 'DANCER → Gift Horse: 89 days, 18 Shorts, 1 long-form follow-up (the Grace lyric video). Gift Horse → Grace: 30 days, 6 uploads, 0 long-form follow-up. "The calendar was full. The music follow-through wasn’t."',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'The assets that did exist in the third gap all landed on one day rather than being spread.',
      basis: 'Grace / album → Pop Pop Pop: 63 days, 8 long-form assets, all on album day. Then 61 days without a new music destination after album day (16 Feb → 17 Apr 2024).',
      needTags: ['release_sequencing', 'first_week_density'],
    },
    {
      point: 'More activity did not mean more places to watch.',
      basis: 'TANGK: 127 uploads, 14 long-form destinations, 89% Shorts. CRAWLER: 43 uploads, 21 long-form destinations, 51% Shorts. Architecture only — no view totals are compared across the two campaigns.',
      needTags: ['release_sequencing', 'shorts_programme'],
    },
    {
      point: 'The lyric videos were a rollout problem, not a format problem.',
      basis: '9 lyric videos took 2.64M, but 8 of the 9 landed on album day. "The format isn’t new. The timing is."',
      needTags: ['lyric_video', 'release_sequencing'],
    },
    {
      point: 'The channel has no programmed home for its library between hero releases or between campaigns.',
      basis: 'The Stations slide: IDLES "already have the ingredients — music videos, live performances, archive and band-world content", and the opportunity is to bring them "into one programmed destination" — i.e. one does not exist today.',
      needTags: ['named_series', 'catalogue_activation'],
    },
  ],

  campaignRisks: [
    {
      point: 'Reading the 16.7× Bataclan multiple as expected uplift from making live content.',
      basis: 'The deck: "16.7x is a DESCRIPTION OF WHAT HAPPENED, not a forecast" — on n=5 assets six to seven years old. The slide says "worth testing" and must never say "will deliver". No claim that production caused the performance.',
      needTags: ['archive_live'],
    },
    {
      point: 'Hearing the recommendation as "make more live videos" — which IDLES’ own data rejects.',
      basis: '26 owned live assets at a 10,010 median. "Don’t make more live content. Build one live world."',
      needTags: ['archive_live', 'long_form_event'],
    },
    {
      point: 'Framing the 24 live broadcasts as an ongoing strategy that was abandoned.',
      basis: 'Every one of the 24 falls inside Apr 2020 → Dec 2021, when touring was not possible — "almost certainly why they happened". Capability and precedent, not a strategy to restore. The "pandemic era" label is load-bearing.',
      needTags: ['long_form_event'],
    },
    {
      point: 'Treating the December 2021 premiere-plus-Q&A night as a pattern.',
      basis: '13 Dec 2021: When The Lights Come On premiere (982K) and a 47-minute Q&A with Lee Kiernan (17K) the same day. The deck: it is "the only Premiere+live pairing in the channel’s history... ONE historical example, not a pattern". No basis to claim the Q&A did anything for the video’s performance.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Citing the ~7-14 day window as a YouTube rule.',
      basis: 'The deck is explicit: "~7–14 days IS OURS, NOT YOUTUBE’S. We have no verified YouTube source claiming that window as a proven rule." Stated as an operating pattern to test, informed by the gaps measured above.',
      needTags: ['follow_up_7_14'],
    },
    {
      point: 'Comparing TANGK and CRAWLER on view totals.',
      basis: 'CRAWLER assets have had longer to accumulate current views, so cross-campaign view totals are "not like-for-like and are not compared here". CRAWLER is used for architecture only.',
      needTags: [],
    },
    {
      point: 'Concluding that personality Shorts perform better.',
      basis: 'The medians are "strikingly flat across every subtype, 14,058 to 17,726". The claim is only that the Shorts which BROKE OUT were personality-led — a statement about the top of the distribution, not the average.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'Reading the deck as a content quota, or the extend formats as deliverables.',
      basis: 'The extend column is "options, never deliverables. The whole analysis argues against volume." Close: "Not more content — better programmed music moments... not every single needs everything."',
      needTags: ['release_sequencing'],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Give the biggest songs a second music moment inside roughly 7-14 days of the hero.',
      basis: 'Deck bridge: "Hero OMV → ~7–14 days → Another music moment." The single biggest opportunity, on the deck’s own framing: "89 days after DANCER with one long-form destination in the gap."',
      needTags: ['follow_up_7_14', 'hero_continuity'],
    },
    {
      point: 'Build one owned live world for the album era rather than uploading more live content.',
      basis: 'Deck action 02: "One owned live world — one recognisable album-era place. Not random live uploads, not a weekly series." One shoot yields a full performance, individual songs, behind it, Shorts, and an interview or Q&A.',
      needTags: ['archive_live', 'long_form_event', 'bts_process'],
    },
    {
      point: 'Restore the night around the premiere — a live moment the same night as the video.',
      basis: 'Deck action 03: "Premiere, then a live moment the same night. You did exactly this in December 2021." The next version does not need to look like 2020.',
      needTags: ['premiere_behaviour', 'long_form_event'],
    },
    {
      point: 'Test holding some lyric assets back as response-led extensions instead of shipping all on album day.',
      basis: '8 of 9 lyric videos landed on album day. The deck asks it as a question to Partisan — "should every lyric asset land at once, or could some be placed in a campaign gap as another music destination?" — and states it cannot claim holding them back would raise viewing.',
      needTags: ['lyric_video', 'release_sequencing', 'follow_up_7_14'],
    },
    {
      point: 'Programme the channel itself, not just the release — pitch YouTube Stations.',
      basis: 'Deck action 04 and the Stations slide: "Live, archive, performance and band world, given one programmed home." Why IDLES: "24 live events · 4 named series · a full concert film · 30 owned live assets."',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Keep Shorts doing the band-world job, and stop asking them to carry the music.',
      basis: 'Deck column 03, verdict "Keep · clearer job": "Don’t ask Shorts to do the music’s job. Around the music, not instead of it."',
      needTags: ['shorts_programme'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Official music video stays the hero and stays Premiered.',
      basis: 'Deck column 01, verdict "Keep": "4 music videos took 64% of observed campaign viewing. 13 of 13 Premiered since 2021." "The hero worked."',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'A second music moment, chosen per song and per gap: owned performance (the preferred test), lyric, visualiser, acoustic / session, alternate version.',
      basis: 'Deck column 02, verdict "Change": "This is the missing layer. Pick per song, per gap. Not all of them, not every time."',
      needTags: ['follow_up_7_14', 'lyric_video', 'visualiser', 'archive_live'],
    },
    {
      point: 'Band world around the music: personality, tour, rehearsal, behind it, reaction.',
      basis: 'Deck column 03 item list, with the breakout finding: FLYNN! at 699K, six of the top ten personality-led.',
      needTags: ['shorts_programme', 'bts_process'],
    },
    {
      point: 'An event layer on the biggest moments only — a Q&A or a Premium Afterparty, if secured.',
      basis: 'Rollout row "Day 0 / +1 — Event layer — Q&A or Afterparty · biggest moments only, not every single". Marked soft and "if secured" on the slide.',
      needTags: ['premiere_behaviour', 'community_activation'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Before: Premiere scheduled, with Shorts and band world pointing at the hero.',
      basis: 'Deck rollout row 1.',
      needTags: ['shorts_programme', 'premiere_behaviour'],
    },
    {
      point: 'Day 0: official video Premiere.',
      basis: 'Deck rollout row 2 — "Already a strength — 13 of 13 since 2021."',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Day 0 / +1: event layer — Q&A or Afterparty, biggest moments only.',
      basis: 'Deck rollout row 3, marked soft and "if secured".',
      needTags: ['long_form_event', 'community_activation'],
    },
    {
      point: 'Day +7–14: a second music moment, preferably from the album’s own live world.',
      basis: 'Deck rollout row 4. This is the row the whole deck is built to land.',
      needTags: ['follow_up_7_14', 'hero_continuity', 'archive_live'],
    },
    {
      point: 'Response-led: lyric, visualiser or alternate version, placed by what the audience does.',
      basis: 'Deck rollout row 5 — "8 of TANGK’s 9 lyric videos landed on album day." "Response-led" is the difference between programming and a treadmill.',
      needTags: ['lyric_video', 'visualiser', 'release_sequencing'],
    },
    {
      point: 'Throughout: the band — Shorts, behind it, rehearsal, tour.',
      basis: 'Deck rollout row 6.',
      needTags: ['shorts_programme', 'bts_process', 'live_dates_tie_in'],
    },
    {
      point: 'Between heroes: don’t leave the music empty.',
      basis: 'Deck rollout row 7 — "89 days after DANCER · one long-form destination."',
      needTags: ['hero_continuity', 'follow_up_7_14'],
    },
    {
      point: 'The shape change overall: TANGK ran big hero → lots of activity → next big hero. The proposal is big hero → second music moment → band / world → response-led extension → next big hero.',
      basis: 'Deck closing arc. The top row is OBSERVED — what the upload record shows. The bottom row is a PROPOSAL and the slide says so. Neither carries counts or dates and nothing forecasts a result.',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
  ],

  existingSuccesses: [
    {
      point: 'Four hero videos carried the campaign.',
      basis: '12.5M current observed views, 64% of campaign viewing, from 3.1% of uploads.',
      needTags: ['album_campaign'],
    },
    {
      point: 'Total Premiere adoption since 2021.',
      basis: '13 of 13 official videos, including all four TANGK heroes.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Lyric video as a proven owned format.',
      basis: '9 assets, 2,637,503 views, 270,007 median, 13.5% of campaign viewing.',
      needTags: ['lyric_video'],
    },
    {
      point: 'A run of named live series on their own channel.',
      basis: '24 live broadcast events, 4 named series, 5 Q&As, Apr 2020 → Dec 2021. Inventory includes BALLEY TV (7 episodes), Live Q&As (5 broadcasts), Le Bataclan (full concert film), 30 owned live assets.',
      needTags: ['named_series', 'long_form_event'],
    },
    {
      point: 'A premiere and a live moment on the same night.',
      basis: '13 December 2021 — When The Lights Come On premiere (982K) plus a 47-minute Q&A with Lee Kiernan (17K). One historical example, not a pattern.',
      needTags: ['premiere_behaviour', 'long_form_event'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'Metallica TV as a programming reference for turning a video and archive catalogue into a programmed destination.',
      basis: 'Named in the deck as a programming reference only, video id 1fz60gNnSdU: "No view counts, no scale comparison, no suggestion IDLES should copy them."',
      needTags: ['named_series', 'catalogue_activation'],
    },
    {
      point: 'Le Bataclan as IDLES’ own proof that one live world outperforms scattered live uploads.',
      basis: '5 assets, 167K median, 16.7× the 26 other owned live assets at 10K median. "One night, one name, a full concert AND individual songs off the same shoot."',
      needTags: ['archive_live', 'long_form_event'],
    },
  ],

  keyEvidence: [
    { claim: 'Four official music videos = 3.1% of TANGK uploads and 64.1% of observed campaign viewing; 12.5M current observed views.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'IDLES_TANGK_Review_v1.md, recomputed from a 4 Sep 2026 pull of 367/367 uploads', observedAt: '2026-09-04' },
    { claim: 'TANGK: 127 uploads, 14 long-form destinations, 89% Shorts. CRAWLER: 43 uploads, 21 long-form, 51% Shorts.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck slide 03 — architecture only, view totals deliberately not compared', observedAt: '2026-09-04' },
    { claim: 'Hero-to-hero gaps: DANCER → Gift Horse 89 days / 18 Shorts / 1 long-form; Gift Horse → Grace 30 days / 6 uploads / 0 long-form; Grace → Pop Pop Pop 63 days / 8 long-form all on album day.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'IDLES_TANGK_Review_v1.md gap table; date differences from the upload record', observedAt: '2026-09-04' },
    { claim: '61 days without a new music destination after album day (16 Feb → 17 Apr 2024).', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck slide 04 post-album line', observedAt: '2026-09-04' },
    { claim: 'Zero owned live / performance long-form across the TANGK campaign window, 1 Aug 2023 – 30 Dec 2024, 127 uploads.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck slide 05 — the reveal', observedAt: '2026-09-04' },
    { claim: '1.71M current observed views across four mapped BBC Music performances (724K / 576K / 225K / 184K).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'video ids LLCy9Ic9aIQ, OYymMu2WoDM, 3NqFrrj0Pcg, yKdHXNq4rko', observedAt: '2026-09-04' },
    { claim: 'Le Bataclan: 5 assets at a 167K median against 26 other owned live assets at a 10,010 median — 16.7×.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck slide 06 — n=5, assets six to seven years old, descriptive not predictive', observedAt: '2026-09-04' },
    { claim: '24 live broadcast events across 4 named series and 5 Q&As, all inside Apr 2020 → Dec 2021; 0 during TANGK.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'activation audit, verified', observedAt: '2026-09-04' },
    { claim: '13 of 13 official videos Premiered since 2021.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'activation audit, premiere adoption', observedAt: '2026-09-04' },
    { claim: '9 lyric videos, 2,637,503 current views, 270,007 median, 13.5% of campaign viewing; 8 of the 9 published on album day.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck slide 07 lyric block; top asset Roy, id gLY1PkEOJP4, 538K', observedAt: '2026-09-04' },
    { claim: '113 Shorts at a 17K median, with medians flat across every subtype (14,058 to 17,726); FLYNN! at 699,263 and six of the top ten personality-led.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck Shorts analysis — a claim about the top of the distribution, not the average', observedAt: '2026-09-04' },
    { claim: 'No Premium Afterparty found in the mapped public campaign evidence.', evidenceClass: 'OBSERVED', trust: 'AMBIGUOUS', sourceRef: 'deck pitch layer — absence of public evidence, not evidence of absence; Afterparty is Premium gated', observedAt: '2026-09-04' },
  ],

  knownConstraints: [
    'YouTube Stations is a beta partner opportunity and access is not guaranteed; the deck marks it "VMG to pitch".',
    'Rights on the BBC performances are unknown. The deck states there is no basis to assume they can be programmed into an IDLES Station, so the Station line reads "partner performances where rights allow".',
    'The deck works from public YouTube API data only — a 4 Sep 2026 pull of 367/367 current uploads. No YouTube Studio data is used.',
    'Creator features IDLES can switch on themselves are not the same as partner products VMG must broker, and the deck deliberately does not present them with equal certainty.',
    'The whole analysis argues against volume. The extend formats are options to choose per song and per gap, never a production checklist.',
  ],

  knownCampaignPlans: [
    'The deck is addressed to TANGK → next album, Partisan Records. No release date, title or asset list for the next album appears anywhere in it, and all timings in the rollout are stated as illustrative.',
  ],

  youtubePlatformOpportunities: [
    { point: 'Premieres on every major video.', basis: 'Already proven on this channel — 13 of 13 official videos since 2021, all four TANGK heroes. Deck action 01 is "Keep".', needTags: ['premiere_behaviour'] },
    { point: 'YouTube Stations as one programmed destination for the library.', basis: 'Beta · VMG to pitch. Why IDLES: "24 live events · 4 named series · a full concert film · 30 owned live assets."', needTags: ['named_series', 'catalogue_activation'] },
    { point: 'Premium Afterparty as an event layer on the biggest moment only.', basis: 'Rollout row "Day 0 / +1", marked soft and "if secured". The audit found no Premium Afterparty in the mapped public campaign evidence.', needTags: ['premiere_behaviour', 'community_activation'] },
    { point: 'Live Q&A around a premiere night.', basis: 'Precedent on the channel: a 47-minute Q&A with Lee Kiernan on 13 December 2021, the same day as the When The Lights Come On premiere.', needTags: ['long_form_event', 'community_activation'] },
    { point: 'Shorts as the band-world layer around the music.', basis: '113 Shorts in the campaign; the breakouts were personality-led. "Around the music, not instead of it."', needTags: ['shorts_programme'] },
  ],

  openQuestions: [
    'Would holding some lyric assets back from album day raise viewing? The deck states plainly that it cannot claim this — album-day clustering may be exactly what drove the 2.64M.',
    'Can any of the four BBC performances be programmed into an owned Station, or does rights clearance rule it out?',
    'Will IDLES get Stations access at all? It is a beta and the deck says access is not guaranteed.',
    'Has a Premium Afterparty ever run for IDLES? The audit found none in mapped public material, but Afterparty is Premium gated and may not surface publicly.',
    'Would a live world built now perform like Le Bataclan, or is the 16.7× specific to that night, that venue and six to seven years of accumulation?',
    'Is the ~7-14 day window the right operating pattern for this artist? It is the deck’s own recommendation to test, not a measured result.',
    'How much band and production availability exists for one owned live shoot in the next album era?',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what we concluded, not OBSERVED evidence about the channel now — figures are from a 4 Sep 2026 pull and will drift.',
    'The TANGK vs CRAWLER comparison is campaign architecture only. CRAWLER assets have had longer to accumulate views, so cross-campaign view totals are not like-for-like and the deck does not compare them.',
    'The 16.7× Le Bataclan multiple is descriptive, on n=5 assets six to seven years old. It is not a predicted uplift and the deck makes no claim that production quality caused the performance.',
    'The 24 live broadcasts all fall inside Apr 2020 → Dec 2021, when touring was not possible. They evidence capability and precedent, not an ongoing live-programming strategy that was later abandoned.',
    'The 13 December 2021 premiere-plus-Q&A is the only such pairing in the channel’s history — one historical example. Nothing establishes that the Q&A affected the video’s performance.',
    'The ~7-14 day window is the deck’s own recommended operating pattern to test. There is no verified YouTube source claiming it as a proven rule, and citing it as one would be a fabricated citation.',
    'The Shorts finding is about the top of the distribution only. Medians are flat across every subtype (14,058 to 17,726) and nothing establishes that personality causes performance.',
    'Current lifetime view totals are used throughout. They are not velocity and must not be divided by asset age.',
    'The deck establishes what was published, when, and what those assets have accumulated since. It establishes no causation for any format, and it never claims the BBC viewing could have accrued on the owned channel instead.',
    'No YouTube Studio data is used, so there is nothing here on retention, traffic sources, impressions, CTR, unique viewers or subscriber attribution.',
  ],
};
