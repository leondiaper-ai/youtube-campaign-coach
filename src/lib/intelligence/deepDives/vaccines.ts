import type { DeepDiveContext } from '../types';

/** Frozen 9 Nov 2026 Watcher research. Proposed strategy is not an agreed plan. */
export const VACCINES_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'thevaccinesuk',
  artistName: 'The Vaccines',
  title: 'The Vaccines × YouTube — Make the next record last longer',
  deckUpdated: '2026-11-09',
  deckUrl: '/vaccines',
  dataCapturedAt: '2026-11-09',
  coreThesis: 'Keep the Pink Carnations visual language and plan its second chapter. Four primary visualisers hold 723,014 of the eight identified album video assets’ 1,090,830 lifetime views (66.3%). No further album long-form appears after 12 January through 12 April 2024 in the retrieved list. Prioritise a primary visual plus one distinct follow-up; test a current new-song performance before commissioning a live series. These are working proposals, not confirmed campaign plans.',
  channelStrengths: [
    { point: 'Primary visualisers already have a substantial role.', basis: 'Four primary visualisers: 723,014 lifetime views at 9 Nov 2026. Sometimes, I Swear leads the album non-MV assets at 205,071.', needTags: ['visualiser'] },
    { point: 'Catalogue lyrics and live sessions offer creative precedent.', basis: 'All My Friends Are Falling In Love lyric video: 1,688,915. Your Love Is My Favourite Band live session: 552,488. Both from 2018; not matched-age benchmarks.', needTags: ['lyric_video', 'performance_as_hero'] },
    { point: 'Several substantial catalogue entry points exist.', basis: 'If You Wanna, Post Break-Up Sex and I Always Knew total 30,156,339 lifetime views: 40.5% of retrieved-upload viewing, not today’s traffic share.', needTags: ['catalogue_activation'] },
  ],
  channelGaps: [
    { point: 'The long-form run stopped on album day.', basis: 'Eight song videos across five album tracks; the last is 12 Jan 2024. Seven short clips appear after release through 12 Apr, with no new album long-form in that retrieved period. Topic and partner coverage are not comprehensive.', needTags: ['album_campaign', 'hero_continuity'] },
    { point: 'Lyric follow-ups clustered late in the pre-release run.', basis: 'All three published 20 Dec 2023, 83/65/33 days after the primary uploads. Timing effects were not measured.', needTags: ['follow_up_7_14', 'release_sequencing'] },
  ],
  campaignRisks: [
    { point: 'Treating format share as evidence of format superiority.', basis: 'Four visualisers versus one music video, different songs and upload ages. All numbers are lifetime at capture.', needTags: ['visualiser'] },
    { point: 'Assuming any live footage will reproduce the old sessions.', basis: 'Three 2018 sessions total 1,193,533; seven Reading 2018 archive songs uploaded in 2026 total 40,243. Different age/context; not a causal test.', needTags: ['archive_live'] },
    { point: 'Using the displayed weekly growth as viewing pace.', basis: 'Channel total repeats from 15 Oct to 8 Nov, then refreshes on 9 Nov. The 910,965 delta is excluded from pace claims. No 2023–24 subscriber history.', needTags: ['channel_reactivation'] },
  ],
  strategicOpportunities: [
    { point: 'Reserve a distinct follow-up while commissioning the primary.', basis: 'Proposed 7–14 day test; not a proven optimum. Performance, lyric treatment or band story should have a separate reason to watch.', needTags: ['follow_up_7_14'] },
    { point: 'Connect catalogue to the new record through programming.', basis: 'Proposed homepage, playlist and Station run. Rights and Station access need confirming.', needTags: ['catalogue_activation', 'named_series'] },
  ],
  recommendedContentDirections: [
    { point: 'Postcards from the next record.', basis: 'Working idea: related real-world visualisers with one place, one action and one song. Rooted in the last campaign’s four visualisers; new artwork and branding not agreed.', needTags: ['visualiser'] },
    { point: 'The small room, the big chorus.', basis: 'Working idea: one new song and one fan favourite, two full songs, 4–6 clips and one short conversation. Budget, availability and rights not confirmed.', needTags: ['performance_as_hero', 'low_band_time'] },
  ],
  recommendedCampaignArchitecture: [
    { point: 'A six-week pilot with two long-form destinations and twelve distinct Shorts.', basis: 'Proposed primary in week one; follow-up in week two; two Shorts plus one Community conversation per week. Further long-form conditional on response and cost. Dates follow the confirmed release calendar.', needTags: ['release_sequencing', 'shorts_programme', 'hero_continuity'] },
    { point: 'Make every album track findable, then sustain the record.', basis: 'Audit existing Topic/audio delivery before adding anything. A new performance/film or song treatment after release addresses the observed 2024 gap.', needTags: ['album_campaign'] },
  ],
  existingSuccesses: [
    { point: 'Sometimes, I Swear is the highest-view identified album asset outside the music video.', basis: 'R4VTfu95HHc: primary visualiser, 205,071 lifetime views as at 9 Nov 2026.', needTags: ['visualiser'] },
  ],
  relevantHistoricalExamples: [
    { point: 'Use all four reference decks for structure and questions, not transferred benchmarks.', basis: 'CHVRCHES: continuity; Ezra: counted publishing rhythm; IDLES: live as a destination; Amyl: existing-footage programming. The Vaccines’ data and identity determine this review.', needTags: ['hero_continuity', 'archive_live'] },
  ],
  keyEvidence: [
    { claim: '241 upload entries retrieved; channel lifetime 91,649,008; subscribers 141,000.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/vaccines/research-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: 'Four primary visualisers total 723,014 / eight song assets’ 1,090,830 lifetime views = 66.3%.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: '/vaccines/research-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: 'Displayed 910,965 seven-day delta is unsuitable as a consumption-pace measurement because history repeats cached totals.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: '/api/debug/snapshots?handle=%40thevaccinesuk', observedAt: '2026-11-09' },
  ],
  knownConstraints: [
    'No confirmed new album title, dates, budget, footage rights or artist availability supplied.',
    'Public API data only; no Studio retention, viewer journeys, paid/organic split or historical asset-level subscriber attribution.',
  ],
  knownCampaignPlans: [],
  youtubePlatformOpportunities: [
    { point: 'Pursue Weekly Release Support first with a six-week deliverable plan.', basis: 'Priority judgement from the supplied brief, not confirmed access or support.', needTags: ['album_campaign'] },
    { point: 'Explore Top Fans, London OOH and Station; treat Music Night / Release Party as a stretch ask.', basis: 'Screenshot-origin opportunities. Eligibility, mechanics, inventory, rights, artist availability and the brief’s six-week requirement assumption all need confirmation with YouTube.', needTags: ['community_activation', 'long_form_event', 'named_series'] },
  ],
  openQuestions: [
    'What are the confirmed release dates, new artwork and primary asset?',
    'What current performance can be captured or cleared within the actual budget?',
    'What does Studio show about retention, repeat viewers, paid support and catalogue-to-new journeys?',
    'Which partner opportunities and Station access are actually available to this channel?',
  ],
  transcribedBy: 'Codex from the 9 Nov 2026 Watcher catalogue and history, supplied brief and four reference deep dives; strategy remains a working proposal.',
  transcribedAt: '2026-11-09',
  limitations: [
    'Lifetime asset totals are not campaign-period or matched-age views. Format mix is not causal evidence.',
    'Retrieved-upload views total 74,525,862 versus the 91,649,008 channel counter; no full-universe share or today’s traffic share is asserted.',
    'Short-clip classification uses a duration proxy; raw Shorts counts across 2024 and 2026 have different view definitions.',
    'No 2023–24 subscriber history. The current cached-history jump is excluded from pace conclusions.',
    'Platform opportunities, Station programming, creative directions and rollout cadence are proposals, not agreed plans.',
  ],
};
