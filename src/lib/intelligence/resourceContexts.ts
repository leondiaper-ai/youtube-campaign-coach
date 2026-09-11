/**
 * THE RESOURCE LIBRARY — TRANSCRIBED
 *
 * The market analysis behind every benchmark this system quotes lives in
 * Word documents and one hosted HTML page under /public/resources. A model
 * cannot use a .docx. It can be handed the extracted text, but what comes
 * back is a wall of tables and a plausible-sounding summary, not the
 * argument — and in this library the argument is almost entirely about what
 * the numbers are NOT allowed to prove.
 *
 * That is the specific reason these are transcribed rather than regenerated
 * on demand. Every one of these documents spends its first or last section
 * on its own limitations: the 30-video cap, the 83.1% of campaigns with LOW
 * date confidence, the single-week W25 snapshot, the fact that the
 * classification system uses cadence as an input and therefore partly
 * measures itself. A model asked to "summarise the benchmark library" drops
 * those sections, because they are the boring part. Dropping them is how
 * "hero dependency median is 32.1%, likely deflated by the cap" becomes
 * "the benchmark is 32%" in a slide two systems downstream.
 *
 * So the rules here are narrow on purpose:
 *   · Every finding carries the population it rests on, in the document's
 *     own numbers. No population, no finding.
 *   · Every benchmark carries an n. A benchmark without an n is a claim.
 *   · `caveats` and `methodologyNotes` are never empty. They carry the
 *     documents' own stated limits, in substance, not softened.
 *   · Nothing here is a YouTube Studio metric. Retention, traffic sources,
 *     impressions, CTR, unique/returning viewers and subscriber attribution
 *     are things these documents explicitly say we cannot see. That belongs
 *     in caveats, never in a finding.
 *   · Lifetime view totals are lifetime view totals. They are not velocity
 *     and are never divided by asset age.
 *
 * Where two documents disagree — and they do; the Observatory says 17.2% of
 * channels use Shorts and the Benchmark Library says 55.1% — both are
 * recorded and the disagreement is named. Re-transcribing when a document is
 * revised is a small cost. Quietly resolving a contradiction in favour of the
 * nicer number is not.
 */

import type { ResourceContext } from './types';

const TRANSCRIBED_BY = 'claude-opus-5 (transcription of existing analysis documents)';
const TRANSCRIBED_AT = '2026-09-11';

export const RESOURCE_CONTEXTS: ResourceContext[] = [
  /* ══════════════════════════════════════════════════════════════════════
   * 1. YouTube Campaign Observatory
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'youtube-campaign-observatory',
    title: 'YouTube Campaign Observatory',
    type: 'OBSERVATORY',
    lastUpdated: 'July 2026',
    sourceUrl: 'https://youtube-insights-pi.vercel.app/preview.html',

    purpose:
      'The live page version of the Virgin campaign intelligence work: headline benchmarks, a '
      + 'Virgin-vs-market format comparison, a five-stage campaign blueprint, nine campaign case '
      + 'studies tiered as "our campaigns" / "wider Virgin" / "wider market", and a six-principle '
      + 'playbook. It is the artefact that gets sent as a link, so its numbers are the ones most '
      + 'likely to be quoted back at us in a meeting.',

    keyFindings: [
      {
        finding:
          'Most campaigns stop after the hero upload; only a minority build multi-format campaigns '
          + 'with structured follow-up.',
        basis:
          'Page headline card: "85% — Most campaigns stop after the hero upload. Only 15% of '
          + 'channels build multi-format campaigns with structured follow-up." Stated over the '
          + '138-channel dataset (82 Virgin, 56 market). The page does not show the derivation of '
          + 'the 85/15 split.',
        confidence: 'LOW',
      },
      {
        finding:
          'Channels using four or more content types sit in the top of the dataset by format '
          + 'diversity.',
        basis:
          'Page headline card: "Channels with 4+ content types appear in the top 8% of the '
          + 'dataset." Population: the 138 channels / 87 active campaigns the page is built on.',
        confidence: 'LOW',
      },
      {
        finding:
          'The strongest campaigns on the page distribute the majority of their views across '
          + 'non-hero content.',
        basis:
          'Page headline card: "37% — Multi-format campaigns reduce hero dependency. The strongest '
          + 'campaigns distribute over 60% of views across non-hero content." Population: 87 active '
          + 'campaigns.',
        confidence: 'LOW',
      },
      {
        finding:
          'Virgin and market channels differ by format adoption, not by whether they publish music '
          + 'videos: music video adoption is identical at 76.8% on both sides.',
        basis:
          '82 Virgin channels vs 56 market channels, 8 formats compared. Music Video 76.8% / 76.8%.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Live sessions and lyric videos are the two formats where market channels are ahead of '
          + 'Virgin; acoustic and trailer/teaser are where Virgin is ahead.',
        basis:
          '82 Virgin vs 56 market channels. Live Session 63.4% vs 78.6% (-15.2pts); Lyric Video '
          + '43.9% vs 53.6% (-9.7pts); Acoustic 22.0% vs 5.4% (+16.6pts); Trailer/Teaser 12.2% vs '
          + '3.6% (+8.6pts).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Nine campaigns were selected as worth studying, deliberately split across three tiers so '
          + 'the framework is not only demonstrated on campaigns we ran ourselves.',
        basis:
          'Six "our campaign" case studies (Tove Lo, GENER8ION, French The Kid, K-Trap, Mary in the '
          + 'Junkyard, Angus & Julia Stone), one "wider Virgin" (Ezra Collective), two "wider '
          + 'market" (Olivia Rodrigo, The Rolling Stones). The page states the rationale directly: '
          + '"If the framework only works for us, it\'s not a framework — it\'s a coincidence."',
        confidence: 'HIGH',
      },
      {
        finding:
          'Angus & Julia Stone released the official music video last, after five other formats, '
          + 'and it still took the highest single-asset view count of the campaign.',
        basis:
          'Karaoke Bar campaign, 6 uploads over a 29-day span: Lyric Video 92K, Acoustic Byron Bay '
          + '36K, Acoustic Tokyo 28K, Piano Version 23K, Live Session 20K, Official MV 540K last. '
          + 'Lifetime view totals at the date the page was built, not velocity.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'French The Kid ran the same Short-then-single sequence three times in a row, which the '
          + 'page describes as unique in its dataset.',
        basis:
          'Three cycles within the campaign: Ghosts Trailer 3K → Ghosts MV 470K; Therapy Trailer '
          + '6.5K → Therapy MV 390K; Cocaine Clouds Teaser 2.6K → Cocaine Clouds MV 2.7K. Page '
          + 'claim: "no other channel repeats this pattern" across the 87 active campaigns.',
        confidence: 'LOW',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Acoustic format adoption — Virgin vs market',
        value: 'Virgin 22.0%, market 5.4% (+16.6pts)',
        basis: '82 Virgin channels and 56 market channels in the 138-channel dataset.',
        caveat:
          'Adoption is binary (channel published at least one). It says nothing about how many, how '
          + 'recently, or how they performed.',
      },
      {
        metric: 'Live session adoption — Virgin vs market',
        value: 'Virgin 63.4%, market 78.6% (-15.2pts)',
        basis: '82 Virgin channels and 56 market channels in the 138-channel dataset.',
        caveat:
          'The largest market-side gap on the page. Format classification is title-keyword based, '
          + 'so "live" in a title drives the count.',
      },
      {
        metric: 'Music video adoption — Virgin vs market',
        value: '76.8% on both sides (0pt gap)',
        basis: '82 Virgin channels and 56 market channels in the 138-channel dataset.',
        caveat:
          'Exact parity is the useful part: it removes "Virgin does not make music videos" as an '
          + 'explanation for any other gap.',
      },
      {
        metric: 'Format diversity threshold for the top of the dataset',
        value: '4 or more distinct content types',
        basis: 'Stated over the 138-channel / 87-active-campaign dataset behind the page.',
        caveat:
          'The page reports this as "top 8%" but does not publish the distribution behind it. The '
          + 'Final Benchmark Library, working from the 136-campaign registry, puts the median at 5 '
          + 'formats — which would make 4 types below median, not top-decile. Prefer the registry '
          + 'figure.',
      },
    ],

    strategicPrinciples: [
      'Build campaign worlds — every format should expand the story, not repeat it.',
      'Create audience return — plan reasons to come back, not just reasons to arrive.',
      'Treat Shorts as infrastructure: pre-release teasers, campaign trailers, announcement moments.',
      'Give every format a purpose. If you cannot explain why an asset exists, do not publish it.',
      'Plan campaigns, not uploads. The strongest campaigns were planned before day one.',
      'The framework scales down — multi-format campaign architecture works at any audience size.',
      'Campaign blueprint, in order: Shorts (discovery and anticipation) → Hero (campaign anchor) → '
        + 'Support (world building) → Audience Return (re-engagement) → Campaign Outcome (sustained '
        + 'attention).',
      'Case studies are chosen for campaign design, not for fame, and are deliberately drawn from '
        + 'beyond our own roster so the framework can be falsified.',
    ],

    caveats: [
      'This record was transcribed from the local preview.html in the workspace, not fetched from '
        + 'the hosted URL. The hosted page may have moved on; treat any figure here as "as at the '
        + 'local build" and re-check before quoting externally.',
      'The page states "Only 17.2% of channels use any Shorts" and "only 11.5% deploy a '
        + 'Shorts-before-longform pattern". The Final Benchmark Library directly contradicts the '
        + 'first of these: 55.1% of 136 campaigns include at least one Short, rising to 95.7% of the '
        + '23 curated backfill campaigns, and it names the 17.2% figure as a claim the registry does '
        + 'not support. Do not use 17.2%.',
      'The page carries per-campaign percentile claims ("top 5.7%", "top 2.3%", "top 1.1%") whose '
        + 'derivation is not published on the page. The Insights Methodology audit separately finds '
        + 'that different artists are ranked on different metrics, which makes these percentiles '
        + 'non-comparable with each other.',
      'The Insights Methodology audit found that the report this page descends from has no '
        + 'analytical pipeline in its codebase: every number is a hardcoded constant entered by hand '
        + 'from prior sessions. The page cannot be reproduced from its own source.',
      'Asset view counts are lifetime totals captured when the page was built. They are not '
        + 'velocity and must not be divided by asset age.',
      'Nothing on the page uses YouTube Studio data. There is no retention, traffic source, '
        + 'impression, CTR, unique-viewer or subscriber-attribution figure anywhere in it, and none '
        + 'should be inferred from it.',
    ],

    methodologyNotes: [
      'Stated dataset: 138 channels analysed (82 Virgin-managed, 56 market benchmark), 87 active '
        + 'campaigns, 9 benchmark case studies, 3 tiers of evidence, 8 formats compared, 6 playbook '
        + 'principles.',
      'Stated pipeline on the page: Campaign Registry → YouTube API → Validated Campaign Objects → '
        + 'Benchmarks → Campaign Intelligence.',
      'Case studies are tiered by provenance — "Our Campaign", "Wider Virgin", "Wider Market" — and '
        + 'the tier is displayed, so a reader can see which evidence is self-selected.',
      'Each campaign is presented as one behaviour, one question, an asset list with role labels '
        + '(Hero / Short / Support / Discovery / Return) and a single benchmark comparison.',
      'Format comparison is channel-level adoption (did this channel publish this format at all), '
        + 'not asset counts or performance.',
    ],

    relevantArtistExamples: [
      'Tove Lo — campaign world building: 5 content types around one single across 23 days, hero MV 1.5M.',
      'GENER8ION — creative efficiency: 4 assets, 14M on the STORM hero, 3.99M views per asset.',
      'French The Kid — Shorts as campaign architecture: Short-then-single repeated across 3 releases.',
      'K-Trap — sustained momentum: 96-day arc bridged by three feature collaborations, 5 assets.',
      'Mary in the Junkyard — developing-scale proof: 4 content types across a 3-month rollout.',
      'Angus & Julia Stone — inverted sequencing: MV released last after 5 other formats, 29-day span.',
      'Ezra Collective (wider Virgin) — live sessions as the campaign spine across 4 venues.',
      'Olivia Rodrigo (wider market) — album playbook at scale: 3 MV tentpoles plus acoustic and broadcast support.',
      'The Rolling Stones (wider market) — legacy act running 6 content types in 29 days.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 2. Campaign Intelligence report
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'campaign-intelligence-report',
    title: 'Campaign Intelligence report',
    type: 'CAMPAIGN_INTELLIGENCE',
    lastUpdated: 'June 2026',
    sourceUrl: '/resources/YouTube_Campaign_Intelligence.docx',

    purpose:
      'The written version of the Observatory: the same benchmark headlines, the same Virgin-vs-'
      + 'market format table, the five-phase campaign blueprint, nine case studies with their full '
      + 'asset lists and YouTube links, and the six-principle playbook. This is the document to '
      + 'hand someone who wants the evidence and the links rather than the page.',

    keyFindings: [
      {
        finding:
          'Most campaigns stop after the hero upload. Structured multi-format follow-up is the '
          + 'minority behaviour.',
        basis:
          '138 channels (82 Virgin, 56 market) across a 12-month window. Document headline: "85% — '
          + 'Most campaigns stop after the hero upload. Only 15% of channels build multi-format '
          + 'campaigns with structured follow-up."',
        confidence: 'LOW',
      },
      {
        finding:
          'Virgin leads the market on acoustic content by the widest margin of any format measured.',
        basis: '82 Virgin channels vs 56 market channels: acoustic adoption 22.0% vs 5.4%, +16.6pts.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Virgin channels are roughly three times as likely as market channels to publish a '
          + 'pre-release trailer or teaser.',
        basis: '82 Virgin vs 56 market channels: trailer/teaser adoption 12.2% vs 3.6%, +8.6pts.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Market channels lean harder on live sessions and lyric videos as default support formats.',
        basis:
          '82 Virgin vs 56 market channels: live session 63.4% vs 78.6% (-15.2pts); lyric video '
          + '43.9% vs 53.6% (-9.7pts).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Behind-the-scenes content is underused on both sides — it is not a Virgin-specific gap.',
        basis: '82 Virgin vs 56 market channels: BTS adoption 17.1% vs 21.4%. Document: "Both sides underuse behind-the-scenes content."',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'The same hero-plus-support-plus-return structure appears at 163K total views and at 73M '
          + 'total views, which is the document\'s central argument that campaign structure is '
          + 'scale-independent.',
        basis:
          'Two of the nine case studies: Mary in the Junkyard, 5 assets across 4 formats, 163K+ '
          + 'total views, developing artist; Olivia Rodrigo GUTS-era, 5 assets, 73M+ total views. '
          + 'Document: "The framework is the same at every level. Scale changes the numbers, not the '
          + 'structure."',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'A legacy catalogue act ran one of the most format-diverse campaigns in the market set, '
          + 'which removes artist age as an explanation for low format diversity.',
        basis:
          'The Rolling Stones case study: 6 assets across 5 formats (trailer, MV, two lyric videos, '
          + 'BTS, visualiser) across two singles, 7.1M+ total views.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Format count alone does not create campaign depth — the case studies that work pair each '
          + 'format with a stated role.',
        basis:
          'Every case-study asset table in the document assigns one of five roles — Hero, Support, '
          + 'Discovery, Return, Short — across 9 campaigns and 47 listed assets.',
        confidence: 'MEDIUM',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Format adoption gap, acoustic',
        value: 'Virgin 22.0% vs market 5.4%',
        basis: '82 Virgin channels, 56 market channels, 12-month window.',
        caveat: 'Channel-level binary adoption. Does not measure volume or performance.',
      },
      {
        metric: 'Format adoption gap, visualiser',
        value: 'Virgin 51.2% vs market 42.9% (+8.4pts)',
        basis: '82 Virgin channels, 56 market channels, 12-month window.',
        caveat: 'Over half of Virgin channels already use visualisers — this is not an untapped format.',
      },
      {
        metric: 'Format adoption gap, Shorts',
        value: 'Virgin 48.8% vs market 46.4% (+2.4pts)',
        basis: '82 Virgin channels, 56 market channels, 12-month window.',
        caveat:
          'Near parity. The Final Benchmark Library, on the 136-campaign registry, puts Shorts '
          + 'adoption higher again (55.1% full dataset, 95.7% curated) and concludes Shorts are '
          + 'baseline rather than a differentiator.',
      },
      {
        metric: 'Format adoption gap, live session',
        value: 'Virgin 63.4% vs market 78.6% (-15.2pts)',
        basis: '82 Virgin channels, 56 market channels, 12-month window.',
        caveat: 'The largest measured gap in the table, and the one the document names as room to grow.',
      },
      {
        metric: 'Views per asset, most efficient case study',
        value: '3.99M views per asset (GENER8ION, 4 assets, 16M+ total)',
        basis:
          'One campaign of the nine case studies; compared in the document against the wider set of '
          + '138 channels rather than a stated per-asset median.',
        caveat:
          'A single campaign is an existence proof, not a benchmark. Lifetime view totals, not '
          + 'velocity. The Observatory quotes a dataset median of 97K views per asset for context, '
          + 'but that median is not reproduced in this document.',
      },
    ],

    strategicPrinciples: [
      'Build campaign worlds — do not just upload a music video; give the audience reasons to return and explore.',
      'Create audience return — most campaigns spike once and fade; plan multiple moments of attention across weeks or months.',
      'Treat Shorts as infrastructure — trailers, teasers and Shorts are the signalling layer, not throwaway.',
      'Give every format a purpose — if you cannot explain why an upload exists, it probably should not.',
      'Plan campaigns, not uploads — map the sequence before releasing; each upload should connect to the next.',
      'The framework scales down — the same structural principles work for developing artists.',
      'Campaign blueprint: Shorts (discovery/anticipation) → Hero (anchor) → Support (world building) → Audience Return (re-engagement) → Campaign Outcome (sustained attention).',
      'The hero can be the destination rather than the departure point — Angus & Julia Stone released the MV last.',
    ],

    caveats: [
      'The 85% / 15% headline is stated without a published derivation. The Insights Methodology '
        + 'audit found an unexplained gap between an "85% go silent after Day 7" claim and a '
        + 'follow-up segmentation totalling 76%, and concluded the two use different definitions.',
      'Case study assets are manually selected. The Insights Methodology audit is explicit that '
        + 'asset inclusion and exclusion criteria are undocumented, and that claimed campaign moment '
        + 'counts exceed the assets actually listed (K-Trap 17 moments claimed vs 4 listed; The '
        + 'Snuts 22 vs 4).',
      'Format classification is keyword-based against video titles and is approximate; videos with '
        + 'ambiguous titles may be misclassified.',
      'All view figures are lifetime totals at capture. They are not velocity and must not be '
        + 'divided by asset age, and campaigns of different ages are not directly comparable on '
        + 'total views.',
      'No YouTube Studio data is used anywhere in this document. Retention, traffic sources, '
        + 'impressions, CTR, unique versus returning viewers and subscriber attribution are all '
        + 'unavailable, so no claim here can be about why a view happened.',
      'The document establishes what was published, in what order, and what those assets have '
        + 'accumulated. It does not establish that any format caused any outcome.',
    ],

    methodologyNotes: [
      'Dataset: 138 channels — 82 Virgin-managed, 56 market benchmark — over a 12-month window.',
      'Nine case studies: seven Virgin artists and two market benchmarks, labelled in the document '
        + 'as [OUR ARTIST], [VIRGIN BENCHMARK] or [MARKET BENCHMARK] so the provenance of each is '
        + 'visible.',
      'Each case study is structured identically: Evidence, Structure, Outcome, Benchmark Position, '
        + 'Why This Matters, Key Learning, vs. Benchmark, then a full asset table with views, '
        + 'format, role and YouTube link.',
      'Assets are role-labelled with a five-value vocabulary: Hero, Support, Discovery, Return, Short.',
      'The Virgin-vs-market table measures channel-level format adoption (percentage of channels '
        + 'publishing at least one asset of that format), not asset volume or performance.',
    ],

    relevantArtistExamples: [
      'Tove Lo — 5 assets across 4 formats around one lead single, 1.6M+ total views.',
      'GENER8ION — 4 assets, 16M+ total views, 3.99M average per asset.',
      'French The Kid — 6 assets, consistent trailer-then-hero pattern, 870K+ combined views.',
      'K-Trap — 5 assets over 96 days, collaborations creating multiple peaks, 2M+ total views.',
      'Mary in the Junkyard — 5 assets across 4 formats at developing scale, 163K+ total views.',
      'Angus & Julia Stone — 6 assets, official MV released last, 739K+ total views.',
      'Ezra Collective — 5 assets centred on live sessions (Abbey Road, Royal Albert Hall, Alexandra Palace, We Love Green), 321K+ total views.',
      'Olivia Rodrigo — 5 GUTS-era assets, 73M+ total views, same hero/support/return pattern at scale.',
      'The Rolling Stones — 6 assets across 5 formats for a legacy act, 7.1M+ total views.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 3. Final Benchmark Library
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'final-benchmark-library',
    title: 'Final Benchmark Library',
    type: 'BENCHMARK_LIBRARY',
    lastUpdated: 'June 2026',
    sourceUrl: '/resources/Final_Benchmark_Library.docx',

    purpose:
      'Dated 27 June 2026. The single most defensible document in the library: ten benchmarks '
      + 'computed from the Campaign Metrics Registry (136 campaigns, 138 channels, 23 curated '
      + 'backfills), each with its business question, verified data, the registry columns used, '
      + 'supporting campaigns and an explicit confidence level. It opens with a data integrity '
      + 'disclosure and closes with the five benchmarks it refuses to publish and the six metrics '
      + 'the engine is missing. Read this before quoting any number externally.',

    keyFindings: [
      {
        finding:
          'The median campaign in the registry uses 5 distinct content types, but the curated '
          + 'subset — which has no video cap — sits at 4, and 4 is the figure to plan against.',
        basis:
          '136 campaigns: median 5 distinct types, IQR 3 to 6 (P25=3, P75=6); 7 campaigns (5.1%) '
          + 'use one type, 21 (15.4%) use seven or more. In the 23 curated backfill campaigns with '
          + 'no cap, the median is 4.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Median hero dependency is 32.1% in the full registry and 43.5% in the uncapped curated '
          + 'subset; the conservative planning figure is 40-45%.',
        basis:
          '136 campaigns: median hero dependency 32.1%, P25 22.9%, P75 47.0%, range 7.1% to 100%; '
          + '58 campaigns (42.6%) below 30%, 13 (9.6%) above 70%. 23 uncapped backfill campaigns: '
          + 'median 43.5%.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Format diversity is necessary but not sufficient for distributed views. Campaigns exist '
          + 'with many formats and very high hero concentration.',
        basis:
          'The Snuts: 6 formats, 85.5% hero dependency (backfill). Tove Lo: 7 formats, 66.9% hero '
          + 'dependency (backfill). Against a 23-campaign backfill median of 43.5%.',
        confidence: 'HIGH',
      },
      {
        finding:
          'The association between more formats and lower hero dependency holds in the full dataset '
          + 'but reverses in the curated subset, so it must not be stated as causal.',
        basis:
          'Full dataset: 1-2 types (n=20) median hero dep 52.3%; 3-4 types (n=35) 31.7%; 5+ types '
          + '(n=81) 31.3%. In the 23 backfill campaigns the pattern reverses — 5+ format campaigns '
          + 'have HIGHER median hero dep (45.6%) than 1-3 format campaigns (32.6%). The document '
          + 'states the backfill sample is too small for either direction to be conclusive.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Shorts are baseline, not an untapped opportunity. The previously circulated "only 17.2% '
          + 'of channels use any Shorts" figure is wrong.',
        basis:
          '55.1% of 136 campaigns include at least one Short; 22 of 23 curated backfill campaigns '
          + '(95.7%) do. By tier: Mid 72.4%, Large 57.9%, Developing 32.3%. Virgin 54.3% vs market '
          + '56.4% — no meaningful difference.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Virgin-managed and market campaigns are not meaningfully different on content diversity, '
          + 'hero dependency or overall quality. The finding of no difference is itself robust.',
        basis:
          '81 Virgin campaigns vs 55 market campaigns. Distinct formats: median 5 both sides. '
          + 'Content diversity score: median 75 both sides. Quality score: 52.6 vs 52.8. Date-safe '
          + 'quality top quartile splits 7 Virgin / 7 market. Hero dependency 35.6% vs 30.1%.',
        confidence: 'HIGH',
      },
      {
        finding:
          'A top-quartile campaign meets two conditions at once — at least five content types AND '
          + 'hero dependency under 30%. Meeting only the first is not enough.',
        basis:
          'Top quartile (34 campaigns, composite score >= 66.9): median 6 formats, minimum 5; '
          + 'median hero dependency 21.7%; 82.4% include a Short. Bottom quartile (35 campaigns, '
          + 'score <= 25.7): median 3 formats, maximum 5; median hero dependency 58.9%; 34.3% '
          + 'include a Short. The Snuts sits in the bottom quartile with 6 formats.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Developing-tier campaigns are only one format below larger tiers; the real developing-tier '
          + 'gap is Shorts adoption.',
        basis:
          '31 developing-tier campaigns (subscribers < 50K or total views < 10M). Median formats 4 '
          + 'vs 5 for Mid and Large. Median hero dependency 31.7% — comparable to other tiers. '
          + 'Shorts adoption 32.3% vs 72.4% Mid and 57.9% Large. Diversity score median 60 vs 75.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Three-quarters of K-Trap\'s campaign views came from non-hero content — the strongest '
          + 'single case of genuinely distributed engagement in the curated data.',
        basis:
          'K-Trap, backfill, 19 curated assets, no video cap: 5 distinct types, 10 Shorts (53% of '
          + 'output), hero dependency 24.7%, 6 return moments, hero views 902,000 against total '
          + 'campaign views 3,647,300. Backfill median hero dependency is 43.5%, so K-Trap is 19 '
          + 'points below it.',
        confidence: 'HIGH',
      },
      {
        finding:
          'The observed ceiling on format diversity is 9 distinct types, reached by two campaigns, '
          + 'and it is a ceiling reference rather than a target.',
        basis:
          'The Rolling Stones (watcher, 30 assets, at the 30-video cap): 9 types, 26.1% hero '
          + 'dependency, date-safe quality 83.5, rank 7 of 136. CHVRCHES: 9 types, 25.8% hero '
          + 'dependency. Among 76 large-tier campaigns the median is 5 formats; only 4 campaigns '
          + '(5.3%) use 9.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Return moments cannot be benchmarked at all from this registry — almost every campaign '
          + 'records zero.',
        basis: '131 of 136 campaigns (96.3%) have zero return moments in the registry. Only 5 have any.',
        confidence: 'HIGH',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Distinct content types per campaign (median)',
        value: '5 full dataset / 4 curated. Plan for at least 4.',
        basis: '136 campaigns in the Campaign Metrics Registry; 23 of them curated backfills with no video cap.',
        caveat:
          'The full-dataset median of 5 is inflated by the 30-video cap — more videos captured means '
          + 'more types encountered. Use 4.',
      },
      {
        metric: 'Hero dependency (hero views / total campaign views)',
        value: 'Median 32.1% full dataset / 43.5% curated. Conservative benchmark 40-45%.',
        basis: '136 campaigns; 23 uncapped curated backfill campaigns.',
        caveat:
          'The full-dataset median is deflated by the 30-video cap, which spreads views across more '
          + 'videos. Below 40% suggests genuine distribution; above 70% is a single peak. Neither is '
          + 'inherently wrong.',
      },
      {
        metric: 'Hero dependency by format count',
        value: '1-2 types: 52.3% · 3-4 types: 31.7% · 5+ types: 31.3%',
        basis: 'Full dataset split: n=20 (1-2 types), n=35 (3-4 types), n=81 (5+ types).',
        caveat:
          'Reverses in the 23-campaign backfill (5+ types 45.6% vs 1-3 types 32.6%). Associative '
          + 'only; the document explicitly forbids claiming causation.',
      },
      {
        metric: 'Content type adoption — full dataset',
        value:
          'Official MV 72.8% · Live session 64.0% · Shorts 55.1% · Lyric video 44.1% · Visualiser '
          + '39.7% · Audio-only 32.4% · BTS 23.5% · Remix 21.3% · Acoustic 13.2% · Teaser/trailer '
          + '11.8% · Interview 4.4% · Vlog 4.4%',
        basis: '136 campaigns in the registry.',
        caveat:
          'Binary "has at least one", so the 30-video cap cannot overstate these, but it could '
          + 'understate them if a format appears only in older videos beyond the cap. Keyword '
          + 'classification adds noise. MEDIUM confidence per the document.',
      },
      {
        metric: 'Content type adoption — curated backfill',
        value: 'Shorts 95.7% · OMV 65.2% · Live session 52.2% · BTS 34.8% · Acoustic 17.4% · Teaser 13.0%',
        basis: '23 curated backfill campaigns with no video cap.',
        caveat:
          'Small n. The Shorts figure is the one that matters: near-universal in curated campaigns, '
          + 'which is why Shorts are positioned as baseline rather than opportunity.',
      },
      {
        metric: 'Top-quartile campaign profile',
        value: '6 formats median (minimum 5), 21.7% median hero dependency, 82.4% include a Short',
        basis: 'Top 34 of 136 campaigns by a composite date-safe quality score (>= 66.9).',
        caveat:
          'The quality score is a composite defined in this document (average of diversity '
          + 'percentile and hero-dependency percentile). Reproducible, but another analyst could '
          + 'weight it differently.',
      },
      {
        metric: 'Bottom-quartile campaign profile',
        value: '3 formats median (maximum 5), 58.9% median hero dependency, 34.3% include a Short',
        basis: 'Bottom 35 of 136 campaigns by the same composite score (<= 25.7).',
        caveat: 'Same composite-score caveat. Format count alone does not keep a campaign out of this group.',
      },
      {
        metric: 'Developing-tier profile',
        value: '4 formats median, 31.7% median hero dependency, 32.3% Shorts adoption, diversity score 60',
        basis: '31 developing-tier campaigns (subscribers < 50K or total views < 10M) within the 136.',
        caveat: 'Individual exemplars in this tier are drawn from mixed data sources (capped and uncapped).',
      },
      {
        metric: 'Shorts adoption by size tier',
        value: 'Mid 72.4% · Large 57.9% · Developing 32.3%',
        basis: '136 campaigns split by size tier (Large: subs >= 500K or views >= 100M; Mid: subs >= 50K or views >= 10M; Developing: else).',
        caveat: 'Binary adoption. Tier boundaries are defined in this document, not by YouTube.',
      },
      {
        metric: 'Virgin vs market — composite quality',
        value: 'Virgin median 52.6, market median 52.8. No meaningful difference.',
        basis: '81 Virgin campaigns and 55 market campaigns within the 136.',
        caveat:
          'This is the benchmark that says not to build a Virgin-vs-market performance narrative. '
          + 'Restrict Virgin/market comparison to format adoption patterns.',
      },
      {
        metric: 'Maximum observed format diversity',
        value: '9 distinct content types',
        basis: '136 campaigns; only 4 (5.3% of the 76 large-tier campaigns) reach 9. Rolling Stones and CHVRCHES are the two exemplars.',
        caveat:
          'Rolling Stones is watcher data at the 30-video cap, so the count may include non-campaign '
          + 'content. Present the number as approximate, and as a ceiling rather than a target.',
      },
    ],

    strategicPrinciples: [
      'Plan for at least 4 distinct content types per campaign. Fewer than 3 places a campaign in the bottom quartile.',
      'Aim for both top-quartile conditions together: 5+ content types AND hero dependency below 40%. Format count alone is not sufficient.',
      'Track hero dependency during a campaign, not after, to see whether support content is generating engagement or being ignored.',
      'Every campaign should plan an official music video plus 2-3 support formats from the common tier (live session, Shorts, lyric video, visualiser); differentiate with the rare tier (acoustic, BTS, teasers).',
      'Do not position Shorts as an untapped opportunity. They are baseline. The strategic question is how they integrate into the sequence.',
      'Do not frame findings as "Virgin does X better than market". Frame Virgin/market data as format adoption patterns, not performance comparison.',
      'Use K-Trap as the primary distributed-engagement case study, and always pair it with the Tove Lo counter-example so format count is not read as the cause.',
      'Present maximum format diversity (9 types) as a ceiling reference point, not a target. The practical recommendation stays 4-5.',
      'For developing artists, target 4 content types; the genuine improvement opportunity at that tier is Shorts adoption, not format count.',
      'Use associative language where the evidence is associative: "campaigns with 3 or more content types are associated with lower hero dependency in the full dataset, though this is not confirmed in the curated subset and individual outcomes vary."',
    ],

    caveats: [
      'The 30-video cap. 113 of 136 campaigns come from watcher_backfill, which captures only the 30 '
        + 'most recent videos per channel, and 84 of those 113 (74.3%) are at the cap. This means '
        + 'recent channel output is being observed, not curated campaign content. The cap '
        + 'mechanically inflates format diversity and mechanically deflates hero dependency.',
      'Date confidence. 113 campaigns (83.1%) have LOW date confidence — their dates were converted '
        + 'from relative text strings. Every date-dependent metric (campaign span, sequencing '
        + 'pattern, gap analysis, upload cadence) is unreliable for them. Only 23 backfill campaigns '
        + 'plus 1 other have MEDIUM or HIGH date confidence, and the document therefore avoids all '
        + 'date-dependent benchmarks.',
      'Content type classification is keyword matching against video titles. It is approximate; '
        + 'videos with ambiguous or non-standard titles may be misclassified. Adoption rates are '
        + 'MEDIUM-confidence estimates, not exact counts.',
      'Sequencing cannot be benchmarked. The sequencing_pattern field is populated for all 136 '
        + 'campaigns but the underlying dates are unreliable for 113 of them. The apparent advantage '
        + 'of hero_middle campaigns could be a date-conversion artefact.',
      'Campaign duration cannot be benchmarked. The registry median span of 458.5 days is measuring '
        + 'the time range of the 30 most recent uploads, not a campaign.',
      'Return moments cannot be benchmarked: 96.3% of campaigns record zero, leaving n=5.',
      'Shorts-before-longform sequencing cannot be verified. Teaser presence is detectable (11.8%) '
        + 'but whether the teaser preceded the MV is not, without per-video dates.',
      'Collaboration impact cannot be benchmarked: 62.5% of campaigns include collaboration assets '
        + 'but the definition is too loose to compare against.',
      'The registry has no YouTube Studio data. The document names audience retention and average '
        + 'view duration, subscriber growth attribution, and views-over-time as metrics MISSING from '
        + 'the engine, available only via the YouTube Analytics API for owned channels. Nothing in '
        + 'this library can answer whether live sessions hold attention longer, or which formats '
        + 'drive subscriptions.',
      'All view figures are cumulative lifetime totals, not velocity. The document names '
        + '"true engagement distribution over time rather than cumulative totals" as something the '
        + 'engine cannot currently do.',
      'There is no production cost data, so a 9-format campaign looks better on these metrics while '
        + 'potentially costing several times more to produce.',
    ],

    methodologyNotes: [
      'Source of truth: campaign_metrics.csv — 136 campaigns, 66 columns. Every benchmark names the '
        + 'registry columns it uses, so another analyst can reproduce it.',
      'Two data sources with different quality: master_backfill (23 campaigns, curated, no video '
        + 'cap, MEDIUM date confidence) and watcher_backfill (113 campaigns, 30-video cap, LOW date '
        + 'confidence). Benchmarks report both where they diverge.',
      'hero_dependency_pct = hero_views / total_campaign_views * 100.',
      'content_diversity_score is a step function: 1 type = 0, 2 = 20, 3 = 40, 4 = 60, 5 = 75, 6 = '
        + '85, 7+ = min(100, 85 + (n-6) * 5).',
      'size_tier — Large: subs >= 500K or views >= 100M. Mid: subs >= 50K or views >= 10M. '
        + 'Developing: otherwise.',
      'virgin_market — Virgin (managed) or Market (licensed/distributed).',
      'The date-safe quality score is the average of the diversity percentile and the hero-dependency '
        + 'percentile, deliberately constructed to avoid any date-dependent input.',
      'Supporting files: benchmark_formats.csv, benchmark_hero_dependency.csv, benchmark_shorts.csv, '
        + 'benchmark_diversity.csv (percentile tables); benchmark_verification_pack.csv (30 '
        + 'benchmark claims verified with YES/NO/PARTIAL verdicts); build_registry.py (regenerates '
        + 'the whole registry from raw CSVs).',
      'The document is structured in three sections by design: benchmarks ready to present, '
        + 'benchmarks that need more work, and metrics missing from the engine. Benchmarks that '
        + 'cannot survive the three stated limitations are excluded rather than hedged.',
    ],

    relevantArtistExamples: [
      'K-Trap — 5 formats, 19 curated assets, 24.7% hero dependency, 10 Shorts, 6 return moments. The distributed-engagement exemplar.',
      'Tove Lo — 7 formats but 66.9% hero dependency. The standing counter-example to format count as a cause.',
      'The Snuts — 6 formats and 85.5% hero dependency; bottom quartile despite format diversity.',
      'PlaqueBoyMax — 1 format, 6 assets, 90.9% hero dependency. The minimum viable campaign.',
      'Original Koffee — 6 formats, 18 curated assets, 26.9% hero dependency.',
      'The Rolling Stones — 9 formats, 26.1% hero dependency, rank 7 of 136 on date-safe quality (at the 30-video cap).',
      'CHVRCHES — 9 formats, 25.8% hero dependency. The other maximum-diversity campaign.',
      'Angus & Julia Stone — 7 formats across 24 assets, 26.4% hero dependency (watcher, below the cap).',
      'Zara Larsson — 8 formats, 16.3% hero dependency. GUNSHIP — 7 formats, 15.6%.',
      'Mary in the Junkyard — 5 formats, 17 assets, 45.6% hero dependency; developing tier.',
      'METTE — 8 formats, 25.7% hero dependency; highest-quality developing-tier campaign.',
      'David Kushner — 3 formats, 32.6% hero dependency; three types were enough to distribute views.',
      'French The Kid — 12 Shorts across 21 assets (57% of output).',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 4. Channel Behaviour Analysis
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'channel-behaviour-analysis',
    title: 'Channel Behaviour Analysis',
    type: 'CHANNEL_BEHAVIOUR',
    lastUpdated: 'June 2026',
    sourceUrl: '/resources/YouTube_Channel_Behaviour_Analysis.docx',

    purpose:
      'What the Watcher roster looked like in one week (W25, 15 June 2026): 142 tracked channels, '
      + '86 managed plus 56 market, classified GROWING / WEAK_CONVERSION / UNDERFED / COLD. Five '
      + 'ranked findings, the evidence tables behind each, five case studies, an explicit "what we '
      + 'still don\'t know" section, and five recommendations ranked by evidence strength. The '
      + 'document states up front that it does not estimate revenue, assume causation, or claim a '
      + 'strategy "works" without direct evidence.',

    keyFindings: [
      {
        finding:
          'Moderate upload cadence is associated with a higher rate of GROWING classification than '
          + 'heavy cadence. Heavy uploaders skew towards weak subscriber conversion.',
        basis:
          '86 managed channels, W25. Moderate cadence (3-9 uploads/month): 19 of 22 GROWING (86%). '
          + 'Strong cadence (10+/month): 9 of 16 GROWING (56%), 7 WEAK_CONVERSION (44%).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Upload activity predicts classification almost perfectly, and subscriber count provides '
          + 'no protection against inactivity.',
        basis:
          '86 managed channels, W25. Light cadence (1-2/month): 12 of 12 UNDERFED (100%). No '
          + 'cadence: 29 of 29 COLD (100%). COLD channels include Plan B (6.44M subs), XXXTENTACION '
          + '(43.2M subs) and Tom Odell (2.68M subs).',
        confidence: 'HIGH',
      },
      {
        finding:
          'Shorts-only, longform-only and multiformat strategies all produce GROWING channels, and '
          + 'all three also fail. Format mix is not the differentiator.',
        basis:
          '86 managed channels, W25. Precious Pepala: 18 Shorts, zero longform, GROWING, 3.7 '
          + 'subs/1kViews. RUEL: 11 longform, zero Shorts, GROWING. Lukas Graham: 4:7 mix, GROWING, '
          + '2.0 subs/1kViews. Counterexample: Nickelback, 13 Shorts, zero longform, '
          + 'WEAK_CONVERSION, views -48% WoW.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Several COLD channels still generate substantial weekly viewing from catalogue, so the '
          + 'COLD label describes the channel\'s publishing, not its audience.',
        basis:
          '86 managed channels, W25. Bad Omens: 3.54M views/week with 0 uploads and 118 days '
          + 'dormant, still gaining ~2,000 subs/week. Declan McKenna: 1.45M views/week, 36 days '
          + 'dormant. The Itch: views +125% WoW with 0 uploads.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Subscriber conversion efficiency appears to diminish as channels grow, concentrating the '
          + 'highest rates among channels under about 10,000 subscribers.',
        basis:
          '86 managed channels, W25. jo from school (513 subs) 30.3 subs/1kViews; Aifric (40 subs) '
          + '11.6; Man Woman Chainsaw (2,230 subs) 4.2; Catch (5,130 subs) 2.8; BANGTANTV (84.8M '
          + 'subs) 3.5. Market side: Date of Birth (39.7K subs) 194.3, bed (3,930 subs) 31.8.',
        confidence: 'LOW',
      },
      {
        finding:
          'Seven strong-cadence channels are uploading heavily while converting poorly or losing '
          + 'views — a named list worth auditing individually rather than a pattern to generalise.',
        basis:
          '16 strong-cadence managed channels, of which 7 are WEAK_CONVERSION: Nickelback (13 '
          + 'uploads, all Shorts, views -48%), PlaqueBoyMax (100 uploads), Tove Lo (19 uploads, 0 '
          + 'subs gained), larissa lambert (11 uploads, views -76%), The Snuts (19 uploads), Joji '
          + '(10 uploads, views -74%), Peter Gabriel (17 uploads, views -56%).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'A single high-performing upload can outperform months of high-volume uploading — but not '
          + 'reproducibly.',
        basis:
          'Temper City (market benchmark, W25): 50.4K subs, 1 upload in 30 days, 4.54M views/week, '
          + '6,800 subs gained, classified UNDERFED. The document explicitly labels this evidence of '
          + 'what is possible, not what is predictable.',
        confidence: 'LOW',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Cadence to classification map (managed roster)',
        value: 'None → 0% GROWING · Light → 0% · Moderate → 86% · Strong → 56%',
        basis: '86 managed channels, W25: none n=29, light n=12, moderate n=22, strong n=16.',
        caveat:
          'The classification system uses cadence as an input, so some circularity is present. Useful '
          + 'as a prompt to investigate strong-cadence underperformance, not as proof that reducing '
          + 'uploads helps.',
      },
      {
        metric: 'Cadence label thresholds',
        value: 'None: 0 uploads/30d · Light: 1-2 · Moderate: 3-9 · Strong: 10+',
        basis: 'Definitions applied across the 86-channel managed roster in W25 (counts 29 / 12 / 22 / 16).',
        caveat: 'These are our thresholds, not YouTube\'s. They are approximate and defined in this document.',
      },
      {
        metric: 'Classification mix of the tracked roster',
        value: 'GROWING 26 (29%) · WEAK_CONVERSION 16 (18%) · UNDERFED 14 (16%) · COLD 34 (38%)',
        basis: 'W25 snapshot across the tracked roster of 142 channels (86 managed, 56 market).',
        caveat:
          'One week only. Counts differ from the Behaviour Change Analysis figures for the same '
          + 'period, which are drawn from the managed roster alone.',
      },
      {
        metric: 'Median dormancy of COLD channels',
        value: '~118 days since last upload, range 36 to 1,008 days',
        basis: '29 COLD channels in the 86-channel managed roster, W25.',
        caveat:
          'Days-since-upload is a direct measurement; the classification threshold (30+ days) is our '
          + 'definition.',
      },
      {
        metric: 'Subscriber conversion by channel size (subs gained per 1,000 views)',
        value: 'Under 10K subs: 4.2 to 30.3 · Large established: around 2.0 to 3.5',
        basis:
          '12 managed channels tabulated in W25 spanning 40 subs to 84.8M subs, plus 2 market '
          + 'channels.',
        caveat:
          'High rates at small scale are mathematically expected — jo from school\'s 30.3 comes from '
          + '87 new subscribers on 2,875 views. These indicate opportunity, not a sustainable '
          + 'benchmark, and the document says so.',
      },
    ],

    strategicPrinciples: [
      'Do not prescribe a single format strategy across the roster. Format strategy should be set per artist from content fit and audience behaviour.',
      'Consistency of output is a stronger predictor of classification than format mix.',
      'Audit strong-cadence WEAK_CONVERSION channels individually. Do not assume the answer is more uploads.',
      'Treat channels under 10,000 subscribers with conversion above 2.0 subs/1kViews as the highest-leverage place to support cadence — and track whether the rate sustains.',
      'Rank COLD channels by current catalogue views, not by subscriber count, when looking for reactivation candidates. The audience signal is the catalogue viewing.',
      'A sudden view or subscriber spike on a channel with no uploads is an external trigger and a time-limited window. Treat it as a prompt to respond with content, not as a channel achievement.',
      'Store the weekly rollup historically. Without 8-12 weeks of data, no finding in this document can be separated from noise.',
    ],

    caveats: [
      'Single-week snapshot. Only W25 has full roster coverage; earlier weeks tracked 1-9 artists '
        + 'and cannot be used for comparison. Every finding is cross-sectional.',
      'Classification circularity: cadence labels and signal classifications may use overlapping '
        + 'inputs, so the cadence-to-classification relationship partly measures our own scoring.',
      'Cause and correlation cannot be separated. Upload cadence may drive growth, growing channels '
        + 'may invest more in cadence, or both may follow from active campaign investment.',
      'No content quality data. Production value, promotional spend, playlist placements, social '
        + 'campaigns and sync deals are not tracked, so two channels with identical upload patterns '
        + 'can diverge for reasons invisible here.',
      'No observed reactivations. The reactivation opportunity is a hypothesis supported by demand '
        + 'signals, not by any observed COLD-channel recovery in this dataset.',
      'The classification system may have blind spots: high-engagement/low-view channels, channels '
        + 'growing via external platforms, channels whose views are largely YouTube Music streams, '
        + 'and revenue performance, which may diverge from view and subscriber signals.',
      'No revenue data. Views and subscribers are tracked; monetisation is not.',
      'No YouTube Studio data. There is nothing here on retention, traffic sources, impressions, '
        + 'CTR, unique versus returning viewers, or which content a subscriber came from. Market '
        + 'channels in particular are observed only, and their strategies cannot be attributed to '
        + 'any intervention.',
      'Week-over-week percentages on small bases are misleading — the document flags +257% on 2,875 '
        + 'views as its own example.',
      'Catalogue view figures are a single week\'s snapshot. We cannot tell whether Bad Omens\' '
        + '3.54M weekly views are stable, growing or decaying.',
    ],

    methodologyNotes: [
      'Data sources: YouTube Watcher (142 channels — 86 managed, 56 market benchmark — via the '
        + 'YouTube Data API), Campaign Coach (classification, cadence labels, multiformat scoring), '
        + 'the Weekly Pulse API rollup and the Channel Spotlight API.',
      'Reporting period: week of 15 June 2026 (W25).',
      'Four-state classification from upload activity, view trends and subscriber movement: GROWING '
        + '(active uploads plus positive sub/view signals), WEAK_CONVERSION (active uploads and '
        + 'views but low subscriber growth), UNDERFED (some activity below cadence thresholds), COLD '
        + '(no meaningful recent upload activity).',
      'Findings in Section 1 are ranked by how surprising or actionable they are, and each is backed '
        + 'by an evidence table in Section 2 with the underlying counts.',
      'Case studies are selected to illustrate a specific observed dynamic, explicitly not to tell a '
        + 'convenient story.',
      'Recommendations carry an explicit evidence-strength label (Strong / Moderate / Structural) '
        + 'rather than being presented as equally supported.',
    ],

    relevantArtistExamples: [
      'Lukas Graham — steady multiformat grower: 5.78M subs, 11 uploads/30d (4 Shorts + 7 longform), views +6% WoW, 2.0 subs/1kViews, GROWING.',
      'Bad Omens — catalogue power: 487K subs, 0 uploads in 118 days, 3.54M views/week, ~2,000 subs/week, COLD.',
      'jo from school — early-stage conversion: 513 subs, 3 uploads/30d, 87 subs gained, 30.3 subs/1kViews, views +257% WoW.',
      'RUEL — longform contrarian: 1.57M subs, 11 longform uploads and zero Shorts, strong cadence, GROWING.',
      'Temper City (market) — efficiency outlier: 50.4K subs, 1 upload, 4.54M views/week, 6,800 subs gained, UNDERFED.',
      'Precious Pepala — Shorts-only and GROWING: 18 Shorts, 3.7 subs/1kViews, views -42% WoW.',
      'Nickelback — Shorts-only and WEAK_CONVERSION: 13 Shorts, 0 subs/1kViews, views -48% WoW.',
      'The Itch — COLD with views +125% WoW and zero uploads; an external trigger.',
      'CHVRCHES — COLD at 548K subs, 271 days dormant in this snapshot.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 5. Behaviour Change Analysis
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'behaviour-change-analysis',
    title: 'Behaviour Change Analysis',
    type: 'CHANNEL_BEHAVIOUR',
    lastUpdated: 'June 2026',
    sourceUrl: '/resources/Behaviour_Change_Analysis.docx',

    purpose:
      'The follow-up-window companion to the Channel Behaviour Analysis, on the same W25 data (86 '
      + 'managed channels, 56 market benchmarks). It asks what observable behaviour sits around a '
      + 'state change: which channels are recovering, what precedes improvement, what precedes '
      + 'decline, what signals each classification generates, and whether the 7-14 day post-release '
      + 'window shows up in the data. It opens with a data integrity notice stating that state '
      + 'transitions are inferred from current-week boundary signals rather than observed over time.',

    keyFindings: [
      {
        finding:
          'Follow-through behaves as a floor condition, not a growth lever: campaigns without it '
          + 'were all classified UNDERFED or lower, but campaigns with it still failed when '
          + 'subscriber conversion was absent.',
        basis:
          '8 post-release campaigns compared in W25. With follow-through: aespa (100 uploads/30d, '
          + 'GROWING), Angus & Julia Stone (14, GROWING), Lukas Graham (11, GROWING), Tove Lo (19, '
          + 'WEAK_CONVERSION), Joji (10, WEAK_CONVERSION). Without: Grupo Firme (2, UNDERFED), '
          + 'Modest Mouse (1, UNDERFED), Morgan Wallen (2, UNDERFED).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'The 8-14 day post-upload window is where channels still classified GROWING start showing '
          + 'stress, because the classification runs on 30-day totals and has not caught up.',
        basis:
          '86 managed channels, W25. Channels with last upload 8-14 days ago and still GROWING: '
          + 'Catch (12 days, views -83%, subs -69%), IDLES (9 days, 5 uploads/30d), Jamie Webster '
          + '(11 days, 4 uploads/30d), GUNSHIPMUSIC (10 days, 6 uploads/30d).',
        confidence: 'LOW',
      },
      {
        finding:
          'Upload volume does not separate GROWING from WEAK_CONVERSION. Weak-conversion channels '
          + 'upload roughly twice as much.',
        basis:
          'W25 signal density across 86 managed channels: GROWING (n=30) averages 11.4 uploads/30d '
          + '(7.8 Shorts, 3.6 longform); WEAK_CONVERSION (n=10) averages 21.0 (16.7 Shorts, 4.3 '
          + 'longform). The distinguishing factor is subscriber conversion — 17 of 30 GROWING '
          + 'channels show measurable conversion against 0 of 10 WEAK_CONVERSION.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Multi-format uploading is common to all active channels, healthy or not, so it cannot be '
          + 'the differentiator.',
        basis:
          'W25: 80% of GROWING channels (n=30) and 80% of WEAK_CONVERSION channels (n=10) use both '
          + 'Shorts and longform; 29% of UNDERFED (n=17); 0% of COLD (n=29, who have zero uploads). '
          + 'GROWING channels average roughly a 2:1 Shorts-to-longform ratio (7.8 to 3.6).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Some positive trajectories start outside the channel entirely — the signal appears before '
          + 'any change in upload behaviour.',
        basis:
          'Three channels in W25: Tom A Smith (UNDERFED, +350% subs WoW, 2 uploads/30d, last upload '
          + '11 days ago), The Itch (COLD, +125% views WoW, 0 uploads, last upload 114 days ago), '
          + 'Summers Sons (COLD, +400% subs WoW but from a base of roughly 1 sub/week, i.e. about 5 '
          + 'subscribers).',
        confidence: 'LOW',
      },
      {
        finding:
          'View decline happens while cadence is maintained, so falling views are not a cadence '
          + 'problem.',
        basis:
          'Seven GROWING channels in W25 with views down more than 25% WoW, all on moderate or '
          + 'strong cadence: Catch -83% (8 uploads), BANGTANTV -74% (27), Ezra Collective -60% (8), '
          + 'Precious Pepala -42% (18), Jutes -38% (13), Man Woman Chainsaw -35% (3), Aifric -27% '
          + '(6).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Two distinct decline shapes exist and only one is alarming: full decline (views and subs '
          + 'both falling) versus view decline with subscriber resilience.',
        basis:
          'W25. Pattern A: Catch (-83% views, -69% subs), Ezra Collective (-60%, -25%), Man Woman '
          + 'Chainsaw (-35%, -40%). Pattern B: Precious Pepala (-42% views, +50% subs), Aifric '
          + '(-27%, +67%), BANGTANTV (-74%, flat subs).',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'The COLD classification contains two very different populations — dormant channels with '
          + 'no audience, and dormant channels with large active catalogue viewing.',
        basis:
          '29 COLD channels in W25. Bad Omens 3.54M views/week, Cigarettes After Sex 20.3M, Digga D '
          + '7.8M — alongside channels with null or minimal views. COLD averages 935K views/week '
          + 'overall.',
        confidence: 'HIGH',
      },
      {
        finding:
          'High view counts do not indicate a healthy channel. UNDERFED channels average more '
          + 'weekly views than GROWING ones.',
        basis:
          'W25: UNDERFED (n=17) averages 3.2M views/week against GROWING (n=30) at 2.9M. The average '
          + 'is pulled up by large under-supplied catalogues — Morgan Wallen 58.4M views/week on 2 '
          + 'uploads in 30 days, Hermanos Espinoza 19.3M.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Very few channels in any state are improving in a given week, which sets expectations for '
          + 'how to read a single weekly report.',
        basis:
          'W25: only 7 of 30 GROWING channels show positive views WoW and only 4 of 30 positive '
          + 'subs WoW. Across the 86-channel roster more channels are declining than growing.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Conversion efficiency is latent rather than earned — it shows up in dormant channels too, '
          + 'activating whenever views arrive.',
        basis:
          'W25: 17 of 30 GROWING, 4 of 17 UNDERFED and 5 of 29 COLD channels show measurable '
          + 'subscriber conversion. Examples: Lip Critic (COLD) 3.0 subs/1kViews on 0 uploads; Tom A '
          + 'Smith (UNDERFED) 7.4 on 2 uploads.',
        confidence: 'MEDIUM',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Signal density by classification — average uploads per 30 days',
        value: 'GROWING 11.4 · WEAK_CONVERSION 21.0 · UNDERFED 1.5 · COLD 0.0',
        basis: 'W25, 86 managed channels: GROWING n=30, WEAK_CONVERSION n=10, UNDERFED n=17, COLD n=29.',
        caveat:
          'The classification uses cadence as an input, so this is partly tautological. The useful '
          + 'part is the inversion: more uploads sits with the worse state.',
      },
      {
        metric: 'Shorts-to-longform ratio of GROWING channels',
        value: 'About 2:1 (7.8 Shorts, 3.6 longform per 30 days)',
        basis: '30 GROWING channels in the 86-channel managed roster, W25.',
        caveat:
          'An observation, not a prescription — the document says so explicitly. WEAK_CONVERSION '
          + 'channels run a steeper ratio (16.7 to 4.3) and convert at zero.',
      },
      {
        metric: 'Multi-format participation by classification',
        value: 'GROWING 80% · WEAK_CONVERSION 80% · UNDERFED 29% · COLD 0%',
        basis: 'W25, 86 managed channels (n=30 / 10 / 17 / 29).',
        caveat:
          'Identical for the two healthy-cadence states, which is precisely why multi-format cannot '
          + 'be the differentiator.',
      },
      {
        metric: 'Average weekly views by classification',
        value: 'GROWING 2.9M · WEAK_CONVERSION 2.2M · UNDERFED 3.2M · COLD 935K',
        basis: 'W25, 86 managed channels (n=30 / 10 / 17 / 29).',
        caveat:
          'Skewed by a handful of very large catalogues in the UNDERFED and COLD groups. Means, not '
          + 'medians.',
      },
      {
        metric: 'Upload recency to classification gradient',
        value:
          '0-1 days → GROWING or WEAK_CONV · 2-7 days → mostly GROWING · 8-14 days → GROWING but at '
          + 'risk · 15-35 days → UNDERFED · 36+ days → COLD',
        basis: 'W25, 86 managed channels, using lastUploadDaysAgo against assigned classification.',
        caveat:
          'May be an artefact of the 30-day upload window the classification itself uses, rather '
          + 'than a YouTube algorithm sensitivity period. The document says the 7-14 day window '
          + 'cannot be proved from this data.',
      },
      {
        metric: 'Share of channels improving week-over-week',
        value: 'Views: 7 of 30 GROWING · Subscribers: 4 of 30 GROWING',
        basis: '30 GROWING channels in the 86-channel managed roster, W25.',
        caveat: 'One week. Cannot distinguish a post-release dip from a trajectory change.',
      },
    ],

    strategicPrinciples: [
      'Follow-through is a floor, not a lever: without it channels trend toward UNDERFED; with it they have a chance at GROWING, but only if the content also converts. Follow-through without conversion produces WEAK_CONVERSION.',
      'Treat the 8-14 day post-upload gap as a transitional zone to watch, because the 30-day classification lags the real-time signal.',
      'Do not read more uploads as better health. The state with the highest upload average is the one with zero conversion.',
      'An external spike with no upload behind it is a time-limited attention window; a single Short or direct post inside about 7 days is the response the document suggests, and without follow-through the spike likely decays.',
      'Read view decline and subscriber movement as two separate signals. Both falling together is the concerning shape; views falling while subscribers hold may self-correct.',
      'Rank COLD channels by catalogue viewing before treating them as equivalent — the classification correctly measures publishing and says nothing about demand.',
      'Do not present a single week as a trend. Confirming any transition needs at minimum four consecutive weeks of the same channels.',
    ],

    caveats: [
      'Only W25 has full roster coverage (86 managed channels). W22-W24 tracked 1-9 channels. No '
        + 'historical classification data exists before W25.',
      'State transitions are inferred from current-week boundary signals, not observed over time. '
        + 'No channel in this report has been watched moving from one state to another.',
      'We cannot prove that uploading more causes better classification — the classification uses '
        + 'cadence as an input, so the relationship is partly a tautology.',
      'We cannot prove multi-format content causes better outcomes: 80% of GROWING and 80% of '
        + 'WEAK_CONVERSION channels both use Shorts and longform.',
      'We cannot explain subscriber conversion. Why some channels convert at 11.6 or 30.3 while '
        + 'others with more uploads and more views convert at zero is the biggest open question in '
        + 'the dataset, and the data does not answer it.',
      'We cannot tell whether view declines are cyclical or structural. Only 7 of 30 GROWING '
        + 'channels have positive views WoW, which could be post-release dips, seasonality, roster '
        + 'composition, or the genuine rarity of sustained growth.',
      'We cannot quantify external triggers. The Itch, Tom A Smith and Summers Sons all moved '
        + 'without uploading, and the cause — playlist, algorithmic surfacing, social, sync — is '
        + 'unknown and therefore not repeatable.',
      'The 7-14 day follow-through window cannot be proved specifically. The 8-14 day stress zone '
        + 'may be an artefact of the 30-day classification window. Testing it would need controlled '
        + 'comparison, which was not done.',
      'No A/B tests and no controlled experiments were run. Every comparison is observational.',
      'Week-over-week percentages on small bases mislead — Summers Sons\' +400% is about 5 '
        + 'subscribers.',
      'Subscriber counts are rounded by YouTube (to the nearest 1K or 10K), which limits precision '
        + 'on small movements.',
      'WoW metrics are null for channels with no prior-week comparison.',
      'Campaign and Drive data reflect scan timestamps, not actual content creation dates.',
      'No YouTube Studio data anywhere in this analysis. Nothing on retention, traffic sources, '
        + 'impressions, CTR, unique versus returning viewers, or which video a subscriber came from. '
        + 'The document works only from public view, subscriber and upload counts.',
    ],

    methodologyNotes: [
      'All data from the YouTube Campaign Coach /api/weekly-pulse endpoint, pulled 19 June, covering '
        + 'the W25 reporting period. 86 managed channels plus 56 market benchmarks.',
      'Classification definitions as used here — GROWING: active cadence plus measurable subscriber '
        + 'conversion. WEAK_CONVERSION: active cadence plus zero subscriber conversion. UNDERFED: '
        + 'minimal upload activity (1-2 uploads in 30 days). COLD: no upload activity in 30+ days.',
      'Key metrics: viewsWoW (week-over-week change in 7-day view count), subsWoW (same for 7-day '
        + 'subscriber gain), subsPer1kViews, uploads30d (shorts30d + longform30d), '
        + 'lastUploadDaysAgo.',
      'Analytical approach is boundary analysis: find channels whose real-time metrics conflict with '
        + 'their assigned classification, on the basis that boundary cases reveal transition '
        + 'behaviour even when historical state data is unavailable.',
      'Where base numbers are small, the document notes it inline rather than presenting the '
        + 'percentage alone.',
      'The report deliberately does not rank channels and does not estimate revenue.',
    ],

    relevantArtistExamples: [
      'Tom A Smith — UNDERFED with +350% subs WoW on 2 uploads, 7.4 subs/1kViews. Conversion of a GROWING channel, cadence of an UNDERFED one.',
      'The Itch — COLD, 0 uploads for 114 days, views +125% WoW. The clearest external-trigger wake-up signal in the data.',
      'Summers Sons — COLD, +400% subs WoW from a near-zero base (about 5 subscribers). A micro-signal.',
      'Bad Omens — COLD but 3.54M views/week, more than 78 of the 86 managed channels, gaining 2,000 subs while doing nothing.',
      'Aifric — GROWING, views -27% but subs +67%, 11.6 subs/1kViews on 6 Shorts. Audience shrinking in breadth, deepening in commitment.',
      'Catch — GROWING with views -83% and subs -69%, last upload 12 days ago. The clearest Pattern A decline.',
      'Morgan Wallen — UNDERFED with 58.4M views/week on 2 uploads in 30 days. Audience exists; pipeline does not match it.',
      'Original Koffee — WEAK_CONVERSION, views -81% on moderate cadence. The most extreme conversion-plus-decline case.',
      'aespa / Angus & Julia Stone / Lukas Graham — post-release campaigns with follow-through that sustained activity.',
      'Modest Mouse and Grupo Firme — post-release campaigns without follow-through, both UNDERFED.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 6. Insights Methodology
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'insights-methodology',
    title: 'Insights Methodology',
    type: 'METHODOLOGY',
    lastUpdated: 'June 2026',
    sourceUrl: '/resources/YouTube_Insights_Methodology.docx',

    purpose:
      'An audit of the YouTube Insights report rather than a description of it. It documents the '
      + 'system architecture, what the report claims versus what exists in the codebase, the '
      + 'classification and format rules (or their absence), the benchmark methodology, seven named '
      + 'internal inconsistencies, and what would be needed to make the report independently '
      + 'reproducible. Its headline conclusion is that the report has no analytical pipeline: every '
      + 'number is a hardcoded constant.',

    keyFindings: [
      {
        finding:
          'The Insights report cannot be reproduced from its own codebase. Every number shown to a '
          + 'reader was manually entered as a constant.',
        basis:
          'Audit of 4 source files totalling 2,472 lines: src/data/insights.ts (491 lines, all data '
          + 'as hardcoded constants), page.tsx (1,869), layout.tsx (23), globals.css (89). Zero API '
          + 'routes, zero database connections, zero external data fetching. The documented "Future: '
          + 'connect to Watcher API / Supabase for live data" comment is not implemented.',
        confidence: 'HIGH',
      },
      {
        finding:
          'The report claims a dataset far larger than anything present in the code it ships.',
        basis:
          'Claimed: 138 channels analysed, 3,554 videos reviewed, 82 Virgin-managed, 56 market '
          + 'benchmark, 7 campaigns manually reviewed. Present in the codebase: 21 video assets '
          + 'across 6 case studies, 6 campaign groupings, 6 benchmark comparison rows, 4 follow-up '
          + 'percentages, 4 diversity statistics.',
        confidence: 'HIGH',
      },
      {
        finding:
          'The per-artist percentile claims are not comparable with each other, because each artist '
          + 'is ranked on a different metric.',
        basis:
          'Percentile formula is rank / total (example given: 13/138 = 9.4% = "Top 9%"). But Tove Lo '
          + 'is ranked on "multi-format campaign", K-Trap on "format diversity", The Snuts on '
          + '"follow-up support" and GENER8ION on "efficiency".',
        confidence: 'HIGH',
      },
      {
        finding:
          'The widely quoted 85% silence figure does not reconcile with the report\'s own follow-up '
          + 'segmentation.',
        basis:
          'benchmarkContext states "85% go silent after Day 7", while followUpSegments totals 41% '
          + 'silent plus 35% shorts = 76%. The audit concludes the 85% likely uses a different '
          + 'definition ("no longform after Day 7") but that the gap is unexplained.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Seven internal inconsistencies were identified between claimed and visible figures.',
        basis:
          'Enumerated in the audit: GENER8ION 23.6M views claimed vs 15.96M visible (7.64M gap); '
          + 'K-Trap 8 format types claimed vs 2 visible; K-Trap 17 moments claimed vs 4 listed; The '
          + 'Snuts 22 moments claimed vs 4 listed; 85% vs 76%; 7 campaigns referenced vs 6 '
          + 'identified; evidence data duplicated between insights.ts and the VisualProof components.',
        confidence: 'HIGH',
      },
      {
        finding:
          'There is no classification algorithm and no format detection algorithm in the report — '
          + 'both are hand-assigned strings.',
        basis:
          'Channel health labels (Growing, Weak Conversion, Underfed, Cold) are hardcoded per case '
          + 'study with a badge component mapping strings to colours; no scoring function or '
          + 'thresholds exist. Video formats are manually set via a content_type field across 8 '
          + 'values and 6 artists. Shorts are referenced in aggregate but no individual Short appears '
          + 'in any asset list and no duration threshold or title pattern exists.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Campaign boundaries in the report are implicit and asset selection is undocumented.',
        basis:
          'Campaign start is the asset with days_from_hero 0; end is the highest days_from_hero '
          + 'value. No explicit dates are stored. Each case study has 3-5 manually selected assets '
          + 'with no stated inclusion or exclusion criteria.',
        confidence: 'HIGH',
      },
      {
        finding:
          'The case study timelines themselves are probably sound; it is the editorial layer that '
          + 'cannot be verified.',
        basis:
          'The audit states the case study timelines were validated against YouTube in a Critical '
          + 'Validation Pass and are likely accurate, while editorial observations are subjective '
          + 'interpretations that cannot be independently verified.',
        confidence: 'MEDIUM',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Virgin vs market format adoption, as published in the Insights report',
        value:
          'Live sessions 48% vs 63% (-15pts) · Lyric videos 44% vs 54% (-10pts) · Multi-format '
          + 'campaign 13% vs 18% (-5pts) · Format variety 4.8 vs 4.6 avg (+0.2) · Visualisers 65% vs '
          + '61% (+4pts) · BTS 26% vs 30% (-4pts)',
        basis:
          'Six comparison rows over the report\'s claimed population of 138 channels (82 Virgin, 56 '
          + 'market).',
        caveat:
          'These figures differ from the Campaign Intelligence report\'s table over the same claimed '
          + 'population (live session 63.4% vs 78.6%, visualiser 51.2% vs 42.9%, BTS 17.1% vs '
          + '21.4%). The audit found no pipeline behind either set, so neither is reproducible and '
          + 'the discrepancy is unresolved. Only three of the six rows are marked actionable in the '
          + 'report itself.',
      },
      {
        metric: 'Percentile formula used across the report',
        value: 'rank / total — e.g. 13/138 = 9.4% = "Top 9%"',
        basis: 'The report\'s claimed population of 138 channels.',
        caveat:
          'Different artists are ranked on different metrics, so two "Top 9%" claims in the report '
          + 'do not mean the same thing and cannot be compared.',
      },
      {
        metric: 'Actual data volume behind the report',
        value: '21 video assets, 6 case studies, 6 campaign groupings, 6 benchmark rows',
        basis: 'Full inventory of src/data/insights.ts (491 lines), against claimed coverage of 138 channels and 3,554 videos.',
        caveat:
          'This is the honest n for anything the report shows. Use it when deciding how hard a '
          + 'figure from that report can be pushed.',
      },
    ],

    strategicPrinciples: [
      'A report that cannot be regenerated from its own source is a presentation, not an analysis. Treat its numbers as citations of work done elsewhere.',
      'Do not compare percentile claims that were computed on different metrics, however similarly they are phrased.',
      'Every headline percentage needs its definition attached. The 85% versus 76% gap exists entirely because two definitions travelled under one number.',
      'Store the external datasets and the methodology alongside the presentation code, or the presentation becomes unauditable the moment the session that produced it ends.',
      'Validated timelines and editorial interpretation are different classes of claim and should not be presented with the same confidence.',
    ],

    caveats: [
      'The report has no analytical pipeline. Raw data, scripts and intermediate computations do not '
        + 'exist in the codebase — they were produced in prior sessions using the YouTube Data API, '
        + 'the Watcher API and Python backfill scripts, and the final numbers were typed in by hand.',
      'The claimed datasets (138 channels, 3,554 videos) do not exist in the shipped code. The '
        + 'numbers are hardcoded string literals in a headlineStats block.',
      '"Healthy" and "Dormant" classifications are referenced but exist nowhere in the codebase.',
      'No Shorts detection exists — Shorts are referenced in aggregate percentages but no individual '
        + 'Short appears in any asset list, and there is no duration threshold or title pattern.',
      'Asset inclusion and exclusion criteria for each case study are undocumented.',
      'Video IDs and URLs are stored as null, so no displayed asset can be traced to a specific '
        + 'video from the code alone.',
      'Day offsets are stored without actual dates, so no timeline can be independently rebuilt.',
      'Evidence data is duplicated between insights.ts and the VisualProof components, so the two '
        + 'can silently diverge.',
      'View count capture dates and methodology are among the things the audit lists as missing. '
        + 'Undated cumulative totals cannot be treated as velocity or compared across ages.',
      'Editorial observations in the report are subjective interpretations that cannot be '
        + 'independently verified.',
      'Nothing in the report is based on YouTube Studio data, and nothing in it can be used to make '
        + 'a retention, traffic source, impression, CTR or subscriber-attribution claim.',
    ],

    methodologyNotes: [
      'Subject of the audit: a Next.js 14.2.5 static site deployed to Vercel with 4 source files, '
        + 'zero API routes, zero database connections and zero external data fetching.',
      'Data flow: static constants in insights.ts are imported by page.tsx and rendered directly. No '
        + 'computation, aggregation, filtering or sorting occurs — components display exactly what '
        + 'is written.',
      'Format taxonomy as used in the report: official_video, acoustic, visualiser, bts, '
        + 'performance, trailer, live, lyric_video — each manually assigned.',
      'Campaign boundaries: start implied by days_from_hero 0, end by the maximum days_from_hero. No '
        + 'explicit dates.',
      'Percentile rankings use rank / total against the claimed 138-channel population.',
      'The audit specifies what independent reproduction would require: the full 138-channel CSV '
        + 'with classification and ranking fields; the full 3,554-video CSV with format types, '
        + 'campaigns and view counts; the classification algorithm with thresholds and scoring; full '
        + 'ranked lists per criterion; definitions for the follow-up segments (silent, shorts-only, '
        + 'limited longform, multi-format); format detection rules; campaign grouping rules '
        + '(maximum gap, inclusion/exclusion); and view count capture dates.',
    ],

    relevantArtistExamples: [
      'GENER8ION — 23.6M views claimed against 15.96M visible in the data; a 7.64M gap.',
      'K-Trap — 8 format types claimed, 2 visible; 17 campaign moments claimed, 4 listed.',
      'The Snuts — 22 campaign moments claimed, 4 listed.',
      'Tove Lo — ranked on "multi-format campaign", a different metric from the other artists\' percentiles.',
      'mary in the junkyard — the only case study using the acoustic and visualiser content types.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * 7. API Tools Reference
   * ════════════════════════════════════════════════════════════════════ */
  {
    resourceId: 'api-tools-reference',
    title: 'API Tools Reference',
    type: 'API_REFERENCE',
    lastUpdated: 'July 2026',
    sourceUrl: '/resources/YouTube_API_Tools_Reference.docx',

    purpose:
      'The reference for what this system can and cannot see. Section 1 reports what a YouTube tools '
      + 'adoption scan across 138 monitored channels and 3,554 videos actually found; sections 2 to '
      + '6 enumerate every endpoint we use with its quota cost and the fields it returns; section 7 '
      + 'is the detectability table — the line between public API data and channel-owner Analytics '
      + 'data. This is the document that settles arguments about whether a metric is available.',

    keyFindings: [
      {
        finding:
          'Premiere adoption is invisible in titles and metadata, which makes title-based premiere '
          + 'detection actively misleading.',
        basis:
          'Only 1 mention of "premiere" across 3,554 video titles from 138 monitored channels. '
          + 'Direct browser inspection of 15 official music videos found 9 of 15 (60%) had been '
          + 'premiered, rising to 8 of 10 (80%) for videos released 2024 or later.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Premieres can nevertheless be detected at full dataset scale, because liveStreamingDetails '
          + 'is only populated on videos that were premiered or livestreamed.',
        basis:
          'videos.list with the liveStreamingDetails part. The document scopes a full scan of all '
          + '3,554 video IDs at roughly 72 API calls, against a free tier of 10,000 quota units per '
          + 'day (videos.list costs 1 unit per call of up to 50 IDs).',
        confidence: 'HIGH',
      },
      {
        finding:
          'The Community tab is no longer a usable surface for music channels.',
        basis:
          'Deprecated for music channels as of 2024-2025 and replaced with YouTube Notes. Four '
          + 'channels checked directly (Tove Lo, Charli XCX, Taylor Swift, Ed Sheeran) all show '
          + '"This Community isn\'t available".',
        confidence: 'MEDIUM',
      },
      {
        finding: 'After parties are effectively unused across the monitored set.',
        basis: 'Only 3 videos across 2 channels (Wet Leg, jigitz) out of 3,554 videos on 138 channels — roughly 1% adoption.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Collaboration credits are common in titles, but that is a naming convention and not the '
          + 'YouTube collab tool.',
        basis:
          '79 of 138 channels (57.2%) and 379 videos carry feat./ft./with/x in titles. The document '
          + 'is explicit that the co-creator feature is a separate backend tool with no API or '
          + 'metadata exposure.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Live content is the most widely adopted detectable feature across the monitored set, and '
          + 'covers more channels than official audio, tour/BTS, remixes or trailers.',
        basis:
          'Title detection across 3,554 videos on 138 channels: live content 95/138 channels '
          + '(68.8%), 427 videos; official audio 55/138 (39.9%), 515 videos; tour/festival/BTS '
          + '68/138 (49.3%), 220 videos; remixes 42/138 (30.4%), 127; trailers and teasers 31/138 '
          + '(22.5%), 63; covers 15/138 (10.9%), 28.',
        confidence: 'MEDIUM',
      },
      {
        finding:
          'Live Redirect and the collab (co-creator) tool are not detectable from any accessible '
          + 'data source, so their adoption cannot be measured at all.',
        basis:
          'Section 7 detectability table across the 138-channel / 3,554-video dataset: Live Redirect '
          + '— "No API field. Real-time streaming feature — the redirect destination is not recorded '
          + 'anywhere accessible." Collab tool — page scraping only, does not scale to thousands of '
          + 'videos.',
        confidence: 'HIGH',
      },
      {
        finding:
          'Everything the label actually wants to know about audience behaviour sits behind channel-'
          + 'owner OAuth, which this system does not have.',
        basis:
          'Section 7 marks watch time and retention, impressions and CTR, traffic sources, '
          + 'demographics and revenue as "No (owner only) — requires channel owner OAuth" via the '
          + 'Analytics API, across the whole 138-channel monitored set.',
        confidence: 'HIGH',
      },
    ],

    usefulBenchmarks: [
      {
        metric: 'Premiere adoption on official music videos',
        value: '9 of 15 (60%) overall; 8 of 10 (80%) for videos released 2024 or later',
        basis: '15 official music videos inspected directly in a browser, drawn from the 138 monitored channels.',
        caveat:
          'n=15 — a hand-checked sample, not a dataset figure. The document frames it as evidence '
          + 'that premieres are the standard launch mechanic while noting they leave zero trace in '
          + 'exportable metadata. A full scan is scoped but not yet run.',
      },
      {
        metric: 'Collaboration credits in titles',
        value: '79 of 138 channels (57.2%), 379 videos',
        basis: '3,554 videos across 138 monitored channels, title keyword detection (feat./ft./with/x).',
        caveat: 'Measures naming conventions, not use of the YouTube collab/co-creator tool, which has no API exposure.',
      },
      {
        metric: 'Live content in titles',
        value: '95 of 138 channels (68.8%), 427 videos',
        basis: '3,554 videos across 138 monitored channels, title keyword detection.',
        caveat: 'Title-based, so it captures anything labelled live and misses live material that is not.',
      },
      {
        metric: 'Official audio uploads in titles',
        value: '55 of 138 channels (39.9%), 515 videos — the highest video count of any detected feature',
        basis: '3,554 videos across 138 monitored channels, title keyword detection.',
        caveat: 'High video count on relatively few channels: this is a small group of channels uploading a lot of audio.',
      },
      {
        metric: 'Trailers and teasers in titles',
        value: '31 of 138 channels (22.5%), 63 videos',
        basis: '3,554 videos across 138 monitored channels, title keyword detection.',
        caveat: 'Broadly consistent with the Final Benchmark Library figure of 11.8% teaser adoption across 136 campaigns, but computed on a different population and unit.',
      },
      {
        metric: 'After party adoption',
        value: '3 videos across 2 channels (~1%)',
        basis: '3,554 videos across 138 monitored channels.',
        caveat: 'Detection is heuristic — a live video published the same day as a premiere on the same channel. There is no explicit after-party flag.',
      },
      {
        metric: 'Quota cost of a full-catalogue premiere scan',
        value: 'About 72 videos.list calls (1 unit each) for 3,554 video IDs, against a 10,000 unit/day free tier',
        basis: '3,554 videos across 138 monitored channels, at 50 video IDs per call.',
        caveat: 'search.list costs 100 units and captions.list 50, so any design that reaches for search instead is two orders of magnitude more expensive.',
      },
    ],

    strategicPrinciples: [
      'Detect premieres via videos.list → liveStreamingDetails, never via titles. A title scan finds 1 premiere where a direct check finds 9 in 15.',
      'Prefer videos.list, channels.list, playlists.list and playlistItems.list (1 unit each) over search.list (100 units) and captions.list (50 units).',
      'Use playlistItems.list against the uploads playlist to enumerate a full catalogue rather than relying on whatever is already in a CSV.',
      'Treat the co-creator collab tool and Live Redirect as unmeasurable. Do not build a recommendation whose success would be invisible to us.',
      'Do not plan around the Community tab for music channels — it has been replaced by YouTube Notes.',
      'Anything requiring watch time, retention, impressions, CTR, traffic sources, demographics or revenue needs channel-owner OAuth through label CMS access. Without it, that analysis does not exist and should not be implied.',
      'Playlist structure and channel section curation are public and cheap to read, and are a legitimate way to see how deeply an artist organises their catalogue.',
    ],

    caveats: [
      'Title-based detection is the weak point throughout section 1. Every "channel reach" figure in '
        + 'the feature table is keyword matching against titles and will miss assets that are not '
        + 'labelled and capture ones that merely mention the word.',
      'Premiere adoption is from a 15-video browser-inspected sample, not a dataset-wide scan. The '
        + 'full scan is scoped in the document as a next step, not reported as done.',
      'Collaboration detection measures naming conventions only; the YouTube collab (co-creator) '
        + 'feature has no public API field and is detectable only visually on a video page.',
      'Live Redirect is not detectable from any source available to us — no titles, no metadata, no '
        + 'page content.',
      'liveBroadcastContent only distinguishes currently-live and scheduled videos; it is not useful '
        + 'for historical premiere detection.',
      'recordingDetails is rarely populated for music videos, so recording date and location are not '
        + 'reliable fields.',
      'activities.list is partially deprecated — bulletin and social post types have been removed. '
        + 'Upload activity still works.',
      'subscriptions.list is frequently set to private by artists.',
      'The oEmbed endpoint returns very limited fields and no premiere or statistics data. The RSS '
        + 'feed returns only the most recent 15 uploads per channel.',
      'Page scraping returns the most (premiere status, collab badges, description mentions, '
        + 'community tab state, live chat replay, ytInitialData blobs) but is slow, one page at a '
        + 'time, and rate limited by YouTube.',
      'The entire YouTube Analytics API and Reporting API — watch time, audience retention curves, '
        + 'impressions, CTR, unique viewers, average view duration, traffic sources, demographics, '
        + 'revenue, end screen and card click rates — requires channel-owner OAuth or delegated CMS '
        + 'access. This system has an API key only. None of those metrics exist anywhere in our '
        + 'analysis, and any claim that appears to rest on one is wrong.',
      'liveBroadcasts, liveStreams, liveChatModerators and liveChatBans are owner-only. Only '
        + 'liveChatMessages is public with an API key.',
      'The document is marked CONFIDENTIAL — internal distribution only.',
    ],

    methodologyNotes: [
      'Dated July 2026, based on analysis of 138 monitored channels and 3,554 videos.',
      'Two detection methods are used and kept separate: title/metadata keyword scanning at full '
        + 'dataset scale, and live browser inspection of individual video pages on small samples. '
        + 'The premiere finding exists only because the two disagree.',
      'Access model: YouTube Data API v3 needs an API key only, no channel ownership, free tier '
        + '10,000 quota units per day. The Analytics and Reporting APIs need channel-owner OAuth.',
      'Quota costs are documented per endpoint: videos.list 1 unit (up to 50 IDs), channels.list 1, '
        + 'playlists.list 1, playlistItems.list 1 (paginated at 50), commentThreads.list 1, '
        + 'channelSections.list 1, activities.list 1, captions.list 50, search.list 100.',
      'Premiere detection method: check for liveStreamingDetails on a video that is not a '
        + 'traditional livestream. An alternative route is search.list with eventType=completed, '
        + 'which returns past livestreams and premieres at 100 units per call.',
      'After party detection is explicitly heuristic: a live video published the same day as a '
        + 'premiere on the same channel. There is no flag for it.',
      'Section 7 is the detectability contract — every feature is marked Yes / Partial / No with the '
        + 'method and the reason, so a proposal can be checked against it before it is written.',
    ],

    relevantArtistExamples: [
      'Premiered, confirmed by direct inspection: Taylor Swift (Oct 2025), beabadoobee (Feb 2023), Tame Impala (Sep 2025), Eminem (Aug 2024), David Kushner (Jan 2024), Tove Lo [Virgin] (May 2026), French The Kid [Virgin] (Aug 2024), Olivia Rodrigo (Jun 2026), Angus & Julia Stone [Virgin] (Jun 2026).',
      'Not premiered: Charli XCX (May 2025), Childish Gambino (May 2024), Bloc Party (2013), The Big Moon (2019), Lip Critic [Virgin] (Feb 2026), K-Trap [Virgin] (Jun 2026).',
      'After parties: Wet Leg and jigitz are the only two channels in the monitored set using them (3 videos total).',
      'Community tab checked and unavailable on: Tove Lo, Charli XCX, Taylor Swift, Ed Sheeran.',
    ],

    transcribedBy: TRANSCRIBED_BY,
    transcribedAt: TRANSCRIBED_AT,
  },
];

/* ══ Accessors ═══════════════════════════════════════════════════════════ */

/**
 * Returns null rather than throwing, and rather than returning a plausible
 * near-match. A caller that asked for a resource we do not have should be
 * told we do not have it, not handed the closest one.
 */
export function getResourceContext(id: string): ResourceContext | null {
  return RESOURCE_CONTEXTS.find((r) => r.resourceId === id) ?? null;
}

/**
 * The index view. Carries the finding and benchmark counts so a caller can
 * tell a thin record from a dense one before deciding whether to load it.
 */
export function listResourceContexts(): {
  resourceId: string;
  title: string;
  type: string;
  lastUpdated: string;
  purpose: string;
  findingCount: number;
  benchmarkCount: number;
}[] {
  return RESOURCE_CONTEXTS.map((r) => ({
    resourceId: r.resourceId,
    title: r.title,
    type: r.type,
    lastUpdated: r.lastUpdated,
    purpose: r.purpose,
    findingCount: r.keyFindings.length,
    benchmarkCount: r.usefulBenchmarks.length,
  }));
}
