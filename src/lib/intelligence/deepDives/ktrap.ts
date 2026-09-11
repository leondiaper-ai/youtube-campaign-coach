/**
 * K-TRAP — Deep Dive context
 *
 * Transcribed from /public/ktrap/index.html (deck authored September 2026,
 * every figure recomputed 2 Sep 2026 from the complete @KTrap1 uploads
 * playlist, 225 of 225 — the deck states nothing is carried forward from an
 * earlier pull).
 *
 * This deck is an END-OF-CAMPAIGN REVIEW, not a plan: TRAPO 2 against SMILE?
 * on matched 159-day album-anchored windows, plus an eleven-artist UK rap
 * cohort read. Its most important content is what it refuses to say. The
 * author removed a "-69%, 12M vs 3.69M" headline, a 72.7% share-of-gap
 * figure, and any cross-year view comparison, on the grounds that the two
 * windows are symmetric in which uploads they SELECT but not in how long
 * those uploads have had to accumulate views. Those refusals are transcribed
 * here as limitations and risks rather than dropped, because dropping them is
 * how a deliberately unstated claim gets restated by the next system along.
 *
 * Every `basis` below is the deck's own figure or the deck's own sentence.
 */

import type { DeepDiveContext } from '../types';

export const KTRAP_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'k-trap',
  artistName: 'K-Trap',
  title: 'K-Trap × YouTube — TRAPO 2 campaign case study',
  deckUpdated: '2026-09',
  deckUrl: '/ktrap',
  dataCapturedAt: '2026-09-02',

  coreThesis:
    'SMILE? had the hits and did not consistently follow them up — 13 of 23 weeks active, a 34-day '
    + 'longest quiet period, and a long-form destination on only 6 of 159 days. TRAPO 2 was the '
    + 'attempt to fix that, and on execution it did: 22 of 23 weeks active, longest gap down to 15 '
    + 'days, destinations on 10 days, median gap between destinations 14 days down to 11, five '
    + 'Premieres plus a YouTube Premium Afterparty. What it has not done is repeat SMILE?\'s '
    + 'breakout. Heaven or Hell sits ~3× above comparable UK rap releases and holds 50% of SMILE?\'s '
    + 'current observed campaign viewing on its own, while K-Trap\'s 2026 median of 942K sits 6th of '
    + '9 qualifying UK rap artists against a peer median of 1.03M — around the middle, not a '
    + 'collapse. The deck\'s conclusion is that consistency creates more chances but does not '
    + 'manufacture a breakout: keep the end-to-end campaign, keep long-form at the centre, and build '
    + 'harder around whatever responds.',

  channelStrengths: [
    {
      point: 'The campaign stopped disappearing between releases — this is the clearest measured improvement.',
      basis: 'Active weeks 13/23 (SMILE?) → 22/23 (TRAPO 2). Longest gap with no upload 34 days → 15 days. Both windows are the same matched 159 days.',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
    {
      point: 'Long-form destinations landed more often and closer together.',
      basis: 'Days with a long-form destination 6/159 → 10; median gap between destinations 14 days → 11 days. Median, not average.',
      needTags: ['follow_up_7_14', 'release_sequencing'],
    },
    {
      point: 'Premieres were used on more priority moments, plus a platform-native fan moment.',
      basis: '3 Premieres (SMILE?) → 5 (TRAPO 2), plus one YouTube Premium Afterparty (b5HcUBZ2TWU, 6 Aug) shown as "—" → "1".',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Long-form is where the viewing actually accrued, so the destinations earned their place.',
      basis: '92.6% of campaign viewing accrued on long-form; Shorts 6.9%. 10 long-form destinations across five months against 53 Shorts.',
      needTags: ['release_sequencing'],
    },
    {
      point: 'The campaign carried more kinds of asset, each with a clearer job.',
      basis: 'Official videos, a vlog (24 Hours In LA), two BTS pieces, a visualiser (Can\'t Relate 270,581), a freestyle (Made It Back 251,493) and a 31-minute documentary (TRAPO — The Documentary, 134,832).',
      needTags: ['bts_process', 'visualiser', 'long_form_event'],
    },
    {
      point: 'Features were central to the two biggest TRAPO 2 moments.',
      basis: 'Mystery Box ft. Headie One 954,353 and Change ft. G Herbo 930,322 are the top two destinations; Can\'t Say No ft. Young Adz 501,141 and Pressure ft. Oxlade 336,932 follow.',
      needTags: ['collaboration'],
    },
    {
      point: 'The top two TRAPO 2 releases beat every between-album single.',
      basis: 'Baseline = the 5 singles released between SMILE? and TRAPO 2, median 567,236 (Attack The Day 798,310 down to One Minute 482,333). Mystery Box and Change both cleared it.',
      needTags: ['collaboration'],
    },
  ],

  channelGaps: [
    {
      point: 'SMILE? left long stretches with nothing between the releases that mattered.',
      basis: '13/23 weeks active, 34-day longest quiet period, a long-form follow-up on 6 of 159 days. The deck: "SMILE? had the hits — we just didn\'t consistently follow them up."',
      needTags: ['follow_up_7_14', 'hero_continuity', 'release_sequencing'],
    },
    {
      point: 'The floor dropped even as the ceiling held — most of the campaign sat below the artist\'s own recent baseline.',
      basis: '"A higher ceiling. A lower floor." Four of the six TRAPO 2 releases landed below the 567,236 between-album single median. Hero median 1,976,779 (SMILE?) vs 419,037 (TRAPO 2).',
      needTags: ['release_sequencing'],
    },
    {
      point: 'The campaign had no way to give a responding song more runway.',
      basis: 'Take-forward decision 03: "When a song starts travelling, the plan has to be able to give that moment more runway."',
      needTags: ['hero_continuity', 'follow_up_7_14', 'release_sequencing'],
    },
    {
      point: 'Non-music long-form sits far below the music destinations in viewing.',
      basis: '24 Hours In LA 19,915; Mystery Box BTS 6,677; Can\'t Say No BTS 8,900 — against Mystery Box 954,353 and Change 930,322.',
      needTags: ['bts_process', 'long_form_event'],
    },
    {
      point: 'The Premium Afterparty is not measurable on the public record.',
      basis: 'Premium-gated content returns zero public views; the deck records 68 likes and confirmed scheduled + actual start times, and counts it separately rather than folding it into "6 Premieres".',
      needTags: ['premiere_behaviour'],
    },
  ],

  campaignRisks: [
    {
      point: 'Comparing SMILE? and TRAPO 2 campaign view totals and calling the difference a decline.',
      basis: 'The deck removed "12M vs 3.69M, -69% on a like-for-like 159-day window": the windows are symmetric in which uploads they SELECT, but the totals are CURRENT lifetime views and SMILE?\'s uploads have had roughly two extra years to accumulate. A.smile.views and A.trapo.views are deliberately not rendered anywhere.',
      needTags: ['album_campaign'],
    },
    {
      point: 'Reading the cohort\'s 2025 dip as a market decline.',
      basis: 'Hero releases by year 49 / 65 / 57 / 40 / 45, with 2025 the low and 2026 year-to-date. The contraction is concentrated, not general: 5 artists reduced, 4 increased, 2 flat; 9/11 active in 2025, 11/11 in 2026.',
      needTags: [],
    },
    {
      point: 'Treating the consistency numbers as proof that posting more produces views.',
      basis: 'Deck claim discipline: public data cannot show that posting more causes views, that formats drive recommendations, that Shorts feed long-form, or that SMILE? was held back by inactivity. "The opportunity wasn\'t simply more content — it was more consistent programming" is a strategic principle, not a causal finding.',
      needTags: ['shorts_programme'],
    },
    {
      point: 'Claiming Shorts moved viewers to long-form.',
      basis: '60% of Shorts landed within seven days of a hero, which the deck calls evidence of sequencing and explicitly not evidence of an effect: "Roles, not measured impact."',
      needTags: ['shorts_programme', 'release_sequencing'],
    },
    {
      point: 'Quoting six Premieres for TRAPO 2.',
      basis: 'The technically-confirmed sixth is a trailer that premiered on 6 Aug and currently returns zero views, so "quoting six externally would not survive a check." Five is the stated figure.',
      needTags: ['premiere_behaviour'],
    },
    {
      point: 'Quoting individual peer videos or a cohort mean.',
      basis: 'The peer ranking is each artist\'s MEDIAN current views on 2026 releases at least 90 days old — "never individual videos, and never a mean, since Dave at 126.8M would wreck any average."',
      needTags: [],
    },
  ],

  strategicOpportunities: [
    {
      point: 'Keep the end-to-end campaign — YouTube had a role before, during and after the hero release.',
      basis: 'Take-forward decision 01: "That is the part worth keeping."',
      needTags: ['album_campaign', 'release_sequencing'],
    },
    {
      point: 'Keep meaningful long-form at the centre of the campaign.',
      basis: 'Take-forward decision 02: "92.6% of campaign viewing accrued on long-form. The destinations are what people actually watch."',
      needTags: ['long_form_event', 'release_sequencing'],
    },
    {
      point: 'Build harder around whatever responds, rather than holding the plan fixed.',
      basis: 'Take-forward decision 03, described in the deck as "the actual learning from slide 7 turned into an action, which is what stops the deck being a post-mortem."',
      needTags: ['hero_continuity', 'follow_up_7_14'],
    },
    {
      point: 'Keep features as the lead mechanic on the priority moments.',
      basis: 'The three highest TRAPO 2 destinations are all features: Mystery Box ft. Headie One 954,353, Change ft. G Herbo 930,322, Can\'t Say No ft. Young Adz 501,141.',
      needTags: ['collaboration'],
    },
    {
      point: 'Keep the Premiere and Premium Afterparty layer around priority releases.',
      basis: '5 Premieres on TRAPO 2 against 3 on SMILE?, plus "YouTube Premium Afterparty — a platform-native fan moment".',
      needTags: ['premiere_behaviour', 'community_activation'],
    },
    {
      point: 'Keep Shorts running as campaign presence and release support around the destinations.',
      basis: '53 Shorts described as "campaign presence and release support"; Shorts returned after 9 months in the Build phase; 60% landed within seven days of a hero.',
      needTags: ['shorts_programme', 'release_sequencing'],
    },
    {
      point: 'Keep a long single piece as an after-release event.',
      basis: 'TRAPO — The Documentary, 31 minutes, 134,832 views, published 28 Aug in the After phase alongside tour on-sale and pre-sale.',
      needTags: ['long_form_event', 'live_dates_tie_in'],
    },
  ],

  recommendedContentDirections: [
    {
      point: 'Official videos on features as the hero destinations.',
      basis: 'Four of the ten TRAPO 2 destinations are official videos, and all four carry a feature; they are the top four music assets of the campaign.',
      needTags: ['collaboration'],
    },
    {
      point: 'Visualiser and freestyle as mid-campaign destinations between the official videos.',
      basis: 'Sustain phase (May–Jul): Can\'t Relate visualiser 270,581 on 16 Jul, Made It Back freestyle 251,493 on 30 Jul.',
      needTags: ['visualiser', 'follow_up_7_14'],
    },
    {
      point: 'BTS attached to the video it belongs to, published days later.',
      basis: 'Mystery Box 17 Apr → Mystery Box BTS 26 Apr; Can\'t Say No 11 Jun → Can\'t Say No BTS 18 Jun.',
      needTags: ['bts_process', 'follow_up_7_14'],
    },
    {
      point: 'A documentary as the closing long-form piece.',
      basis: 'TRAPO — The Documentary, 31 min, 28 Aug, 134,832 views — "the campaign carried more kinds of asset."',
      needTags: ['long_form_event'],
    },
    {
      point: 'Countdown Shorts into release week.',
      basis: 'Release phase (Aug) lists "Countdown Shorts" alongside Pressure ft. Oxlade, On The Radar and the album on 21 Aug.',
      needTags: ['shorts_programme', 'first_week_density'],
    },
  ],

  recommendedCampaignArchitecture: [
    {
      point: 'Build (Mar–Apr): Shorts return after 9 months, then Change and Mystery Box with Premieres, plus the LA vlog and BTS also premiered.',
      basis: 'Deck architecture phase 1, marked hot.',
      needTags: ['shorts_programme', 'premiere_behaviour', 'channel_reactivation'],
    },
    {
      point: 'Sustain (May–Jul): Can\'t Say No and its BTS, album trailer, Can\'t Relate visualiser, Made It Back freestyle.',
      basis: 'Deck architecture phase 2.',
      needTags: ['visualiser', 'bts_process', 'follow_up_7_14'],
    },
    {
      point: 'Release (Aug): Pressure ft. Oxlade with a Premiere, Countdown Shorts, On The Radar, album on 21 Aug, YouTube Premium Afterparty.',
      basis: 'Deck architecture phase 3.',
      needTags: ['first_week_density', 'premiere_behaviour', 'album_campaign'],
    },
    {
      point: 'After (Aug): the 31-minute documentary, tour on-sale and pre-sale.',
      basis: 'Deck architecture phase 4.',
      needTags: ['long_form_event', 'live_dates_tie_in'],
    },
    {
      point: 'Hold the whole thing to a campaign, not a release day.',
      basis: 'Deck headline: "We built a campaign. Not just a release day." And the closing line: "Consistency is the infrastructure. Not the outcome."',
      needTags: ['album_campaign', 'release_sequencing'],
    },
  ],

  existingSuccesses: [
    {
      point: 'Heaven or Hell was a genuine breakout, and it holds up under stress-testing.',
      basis: '6,038,376 current views; 3.22× the ±90-day peer median, stable at 3.04× / 2.86× / 3.04× across ±30 / ±60 / ±120, and strengthening to 3.04–3.42× with Central Cee and Dave removed. 82nd percentile, 7.56× K-Trap\'s own 2022+ median, 2nd of his 29 releases.',
      needTags: ['collaboration'],
    },
    {
      point: 'The TRAPO 2 heroes sat at or above K-Trap\'s normal position — the breakout was the exception, not the campaign collapsing.',
      basis: 'The six TRAPO 2 heroes run 0.68×–1.32× on the same ±90-day basis, against a K-Trap career median of 0.68× across 29 releases.',
      needTags: [],
    },
    {
      point: 'K-Trap sits around the middle of the 2026 UK rap peer set.',
      basis: 'Median current views 942,358 (n=2 qualifying releases) against a cohort median of 1,034,329; 6th of 9 qualifying artists. Deck answer to "Is K-Trap underperforming the market?": "Not dramatically."',
      needTags: [],
    },
    {
      point: 'Execution against the stated objective was met on every consistency measure.',
      basis: 'All six comparison rows moved in the intended direction: 13/23 → 22/23, 34 → 15 days, 6 → 10 destination days, 14 → 11 median gap, 3 → 5 Premieres, — → 1 Afterparty.',
      needTags: ['release_sequencing', 'hero_continuity'],
    },
  ],

  relevantHistoricalExamples: [
    {
      point: 'SMILE? (album 2 Jun 2024) is the deck\'s own comparison campaign, on a matched 159-day window.',
      basis: 'SMILE? window 2 Jan – 9 Jun 2024, 50 uploads (21 long-form, 26 Shorts); TRAPO 2 window 22 Mar – 28 Aug 2026, 67 uploads (10 long-form, 53 Shorts). Both 159 days by construction.',
      needTags: ['album_campaign'],
    },
    {
      point: 'An eleven-artist UK rap cohort is the market frame.',
      basis: 'K-Trap · Headie One · Digga D · Nines · Potter Payper · Fredo · Unknown T · Clavish · Central Cee · Dave · D-Block Europe. 256 heroes, Jan 2022 → 2 Sep 2026. Every channel verified by API channel.title, not by assuming the handle is right.',
      needTags: [],
    },
    {
      point: 'The 2026 peer distribution is shown in full rather than summarised.',
      basis: 'Dave 126.8M · Central Cee 7.28M · Fredo 3.02M · D-Block Europe 1.95M · Headie One 1.03M (median) · K-Trap 942K · Digga D 611K · Clavish 444K · Unknown T 173K.',
      needTags: [],
    },
    {
      point: 'The five between-album singles are the fairest available control.',
      basis: '"It is the same artist, the same channel, and the period immediately before TRAPO 2." Median 567,236 across 5 singles.',
      needTags: [],
    },
  ],

  keyEvidence: [
    { claim: '@KTrap1: 148,000 subscribers, 121,863,041 lifetime views, 225 uploads; every figure recomputed from the complete uploads playlist (225 of 225).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data block A.channel', observedAt: '2026-09-02' },
    { claim: 'SMILE? window 2 Jan – 9 Jun 2024: 50 uploads, 21 long-form, 26 Shorts, 13/23 weeks active, 34-day longest gap, 6 destination days, 14-day median destination gap, 3 Premieres, hero median 1,976,779.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data block A.smile', observedAt: '2026-09-02' },
    { claim: 'TRAPO 2 window 22 Mar – 28 Aug 2026: 67 uploads, 10 long-form, 53 Shorts, 22/23 weeks active, 15-day longest gap, 10 destination days, 11-day median destination gap, 5 Premieres, hero median 419,037.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck data block A.trapo', observedAt: '2026-09-02' },
    { claim: 'Both windows are 159 days: 2 Jan → 9 Jun 2024 and 22 Mar → 28 Aug 2026.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck data block A.smile.windowDays, checked in the deck comment', observedAt: '2026-09-02' },
    { claim: '92.6% of TRAPO 2 campaign viewing accrued on long-form; 6.9% on Shorts.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck slide 05, A.trapo.lfViewPct / shortsViewPct', observedAt: '2026-09-02' },
    { claim: 'Heaven or Hell 6,038,376 current views — 50.3% of SMILE?\'s current observed campaign viewing (SMILE? ex-HoH 5,962,338).', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck A.heavenOrHell / A.smileExHoH, video id BFUSV4j0yGc', observedAt: '2026-09-02' },
    { claim: 'Heaven or Hell is 3.22× the ±90-day UK rap peer median, stable at 3.04× / 2.86× / 3.04× across ±30 / ±60 / ±120; 82nd percentile; 7.56× K-Trap\'s own 2022+ median; 2nd of his 29 releases.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck market block, breakout benchmark comment', observedAt: '2026-09-02' },
    { claim: 'The six TRAPO 2 heroes run 0.68×–1.32× on the ±90-day basis, against a K-Trap career median of 0.68× across 29 releases.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck market block, breakout benchmark comment', observedAt: '2026-09-02' },
    { claim: 'K-Trap median 942,358 on 2 qualifying 2026 releases vs a cohort median of 1,034,329; 6th of 9 qualifying artists out of 11 analysed.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck slide 08, A.market.ktMedian / cohortMedian / ktRank', observedAt: '2026-09-02' },
    { claim: 'UK rap hero releases by year across 11 channels: 2022 49, 2023 65, 2024 57, 2025 40, 2026 45 YTD (256 heroes total, Jan 2022 → 2 Sep 2026).', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: 'deck market block; sensitivity-checked under three rule sets', observedAt: '2026-09-02' },
    { claim: 'Between-album baseline: 5 singles, median 567,236 (Attack The Day 798,310, Strategy 575,695, Strategy (Hill Mix) 567,236, Introvert 562,551, One Minute 482,333).', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: 'deck A.baseline2025', observedAt: '2026-09-02' },
    { claim: 'Ten TRAPO 2 long-form destinations, 2 Apr – 28 Aug 2026, Premiere status confirmed only where the API returns both a scheduled and an actual start time.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: 'deck A.destinations (nLu0bRgDSuQ … 07-02pdHkWo)', observedAt: '2026-09-02' },
    { claim: 'The YouTube Premium Afterparty (b5HcUBZ2TWU, 6 Aug) returns zero public views but carries 68 likes and confirmed scheduled + actual start times.', evidenceClass: 'OBSERVED', trust: 'AMBIGUOUS', sourceRef: 'deck A.trapo afterparty comment; slide 03 source bar', observedAt: '2026-09-02' },
    { claim: '60% of TRAPO 2 Shorts landed within seven days of a hero.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: 'deck slide 05 comment — stated as evidence of sequencing only', observedAt: '2026-09-02' },
  ],

  knownConstraints: [
    'The deck works entirely from the public @KTrap1 uploads playlist and a public cohort pull. No YouTube Studio data is used, so there is nothing on retention, traffic sources, impressions, click-through, new versus returning viewers, territories or subscriber attribution.',
    'No per-video history exists anywhere in the system: ChannelSnapshot is channel-level and capped at 180 days, and TopEverCache holds IDs only. D7/D30/D90 cannot be reconstructed for any video, so nothing in the deck measures early-life performance.',
    'The YouTube Premium Afterparty is Premium-gated and exposes no public view count, so it cannot be measured alongside the other assets. The deck also notes the After Party does not appear anywhere in the 225-upload public record.',
    'Only 2 K-Trap releases qualify for the 2026 peer ranking (2026 music releases at least 90 days old at 2 Sep 2026), so his median rests on n=2.',
    'Nines and Potter Payper have no qualifying 2026 release, which is why 11 artists were analysed but only 9 are ranked.',
  ],

  knownCampaignPlans: [
    'TRAPO 2 released 21 Aug 2026; the reviewed campaign window closes 28 Aug 2026 with the documentary.',
    'Tour on-sale and pre-sale sit in the After phase of the campaign architecture.',
    'Three decisions are carried forward: keep the end-to-end campaign, keep meaningful long-form at the centre, build harder around what responds.',
  ],

  youtubePlatformOpportunities: [
    { point: 'Premieres on priority moments.', basis: '5 confirmed Premieres across TRAPO 2 against 3 on SMILE?; confirmed only where the API returns both a scheduled and an actual start time.', needTags: ['premiere_behaviour'] },
    { point: 'YouTube Premium Afterparty as a platform-native fan moment.', basis: 'Deck slide 05: "Premium — YouTube Afterparty — a platform-native fan moment." Counted separately from Premieres.', needTags: ['premiere_behaviour', 'community_activation'] },
    { point: 'Shorts as campaign presence and release support.', basis: '53 Shorts, returning after 9 months in the Build phase; 6.9% of campaign viewing.', needTags: ['shorts_programme'] },
    { point: 'Long-form as the destination format, including a 31-minute documentary.', basis: '92.6% of campaign viewing accrued on long-form; the documentary took 134,832 views at 31 minutes.', needTags: ['long_form_event'] },
  ],

  openQuestions: [
    'What would a fair TRAPO 2 vs SMILE? audience comparison actually look like? The deck removed the -69% / 12M vs 3.69M pairing because the totals are current lifetime views roughly two years apart in age, and it offers no replacement measure of campaign-level scale.',
    'Did the improved consistency change anything? The deck states that public data cannot show that posting more causes views, and never claims it did.',
    'Did the 53 Shorts move anyone to long-form? 60% landed within seven days of a hero, which is sequencing, not effect — the deck says public data cannot answer this.',
    'Why did four of the six TRAPO 2 releases land below K-Trap\'s own 567,236 between-album single median, when the top two beat all five?',
    'Can a breakout like Heaven or Hell be built for, or only responded to? The deck asserts consistency creates more chances but does not manufacture a breakout, and leaves the mechanism open.',
    'What would the Premium Afterparty have shown if it reported public views, and how should Premium-gated moments be evaluated at all?',
    'Does the 2025 dip in UK rap hero releases (40 against 49/65/57/45) continue, given 11 of 11 artists were active again in 2026?',
  ],

  transcribedBy: 'claude-opus-5 (transcription of the committed deck, not a regeneration)',
  transcribedAt: '2026-09-11',

  limitations: [
    'This record is a transcription of one deck at one date. It is HUMAN evidence about what we concluded, not OBSERVED evidence about the channel now — figures were recomputed 2 Sep 2026 and will drift.',
    'The 159-day windows are symmetric in which uploads they SELECT, not in accumulated time on platform. SMILE?\'s uploads have had roughly two extra years to accumulate views. Any campaign-total or percentage comparison between the two windows is therefore unsupported, and the deck deliberately renders none — the -69%, the 12M vs 3.69M pairing and the 72.7% share-of-gap figure were all removed and must not be reinstated.',
    'All view figures throughout are CURRENT lifetime views as of 2 Sep 2026. They are not velocity and must not be divided by asset age.',
    'Cross-year view comparisons in the market cohort are absent by design: median hero age runs from 1,497 days (2022) to 118 days (2026) and no historical per-video snapshots exist to correct for it. Only release counts, which carry no age bias, are compared across years.',
    'The peer comparison is only fair within its own construction: UK rap releases uploaded within ±90 days, so everything compared has near-identical time on platform. It does not measure early-life performance and cannot be used as a D7/D30/D90 benchmark.',
    'Can\'t Say No swings from 3.20× to 1.08× across narrower peer bands on n=5 and is deliberately not quoted as a multiple.',
    'The deck establishes no causation for any format, cadence or platform feature. It establishes what was published, when, and what those assets have accumulated since.',
    'The market cohort replaced an earlier eight-artist version that mislabelled @unknwnt9 as Potter Payper, excluded Central Cee, Dave and D-Block Europe, and started the series at 2023 (the peak year). That version should not be resurrected.',
    'Hero release is a deck-local definition: a public official-channel upload of 100–900s, not a Short, functioning as a primary music destination, with BTS, vlogs, trailers, interviews, documentaries, tour and promo excluded, and album-style dumps of 4+ music assets on one day collapsed to a single hero.',
  ],
};
