import type { DeepDiveContext } from '../types';

/** Frozen 9 Nov 2026 Watcher research. Proposed strategy is not an agreed plan. */
export const VACCINES_DEEP_DIVE: DeepDiveContext = {
  artistSlug: 'thevaccinesuk',
  artistName: 'The Vaccines',
  title: 'The Vaccines × YouTube — Channel review and future recommendations',
  deckUpdated: '2026-11-09',
  deckUrl: '/vaccines',
  dataCapturedAt: '2026-11-09',
  coreThesis: 'Begin with the channel: Chartmetric daily history totals 2,835,749 artist YouTube views across 180 reported days (9 May–5 Nov 2026; 21 Jun missing), averaging 15,754 per reported day; artist scope includes channel plus featured videos, alongside 141,000 public subscribers, 91,649,008 lifetime views and 60 days since the latest upload at capture. Review Pink Carnations through its eight identified album video assets: visualisers contributed 66.3% of lifetime viewing, but same-song follow-ups were late and no additional Pink Carnations full-song video appears in the thirteen weeks after release. Build the next campaign around a coherent visual world, a fuller multi-format rhythm and clear post-release support. Catalogue strength and the existing fifteenth-anniversary story support the warm-up rather than lead the whole review. Station programming is integrated into the deck. All rollout, creative and partner opportunities remain proposals.',
  channelStrengths: [
    { point: 'Writing access, Shorts supporting key singles and distinctive live performances offer content tests.', basis: 'Lifetime sample: 48 retrieved Shorts-era clips, 105,282 views, median 1,991. Top writing Planet of the Youth 6,528, Sony collaboration 5,620 (support unknown), Sometimes, I Swear lyric 4,833, Victorious Festival 3,810. Six pre-Shorts-era short videos excluded. Duration proxy; Shorts-feed placement unverified and longer Shorts may be missed. Different ages/counting rules prevent causal format conclusions.', needTags: ['shorts_programme'] },
    { point: 'The debut offers a substantial catalogue foundation.', basis: 'Six selected debut-era videos total 32,671,448 lifetime views; fifteenth-anniversary touring is already happening in 2026. Use it as a bridge to new music, not a current-traffic forecast.', needTags: ['catalogue_activation'] },
    { point: 'Primary visualisers already have a substantial role.', basis: 'Four primary visualisers: 723,014 lifetime views at 9 Nov 2026. Sometimes, I Swear leads the album non-MV assets at 205,071.', needTags: ['visualiser'] },
    { point: 'Catalogue lyrics and live sessions offer creative precedent.', basis: 'All My Friends Are Falling In Love lyric video: 1,688,915. Your Love Is My Favourite Band live session: 552,488. Both from 2018; not matched-age benchmarks.', needTags: ['lyric_video', 'performance_as_hero'] },
    { point: 'Several substantial catalogue entry points exist.', basis: 'If You Wanna, Post Break-Up Sex and I Always Knew total 30,156,339 lifetime views: 40.5% of retrieved-upload viewing, not today’s traffic share.', needTags: ['catalogue_activation'] },
  ],
  channelGaps: [
    { point: 'The long-form run stopped on album day.', basis: 'Eight song videos across five album tracks; the last is 12 Jan 2024. Seven short clips appear after release through 12 Apr, with no additional Pink Carnations full-song video in that retrieved period. Topic and partner coverage are not comprehensive.', needTags: ['album_campaign', 'hero_continuity'] },
    { point: 'Lyric follow-ups clustered late in the pre-release run.', basis: 'All three published 20 Dec 2023, 83/65/33 days after the primary uploads. Timing effects were not measured.', needTags: ['follow_up_7_14', 'release_sequencing'] },
  ],
  campaignRisks: [
    { point: 'Treating format share as evidence of format superiority.', basis: 'Four visualisers versus one music video, different songs and upload ages. All numbers are lifetime at capture.', needTags: ['visualiser'] },
    { point: 'Assuming any live footage will reproduce the old sessions.', basis: 'Three 2018 sessions total 1,193,533; seven Reading 2018 archive songs uploaded in 2026 total 40,243. Different age/context; not a causal test.', needTags: ['archive_live'] },
    { point: 'Using the displayed weekly growth as viewing pace.', basis: 'Channel total repeats from 15 Oct to 8 Nov, then refreshes on 9 Nov. The 910,965 delta is excluded from pace claims. No 2023–24 subscriber history.', needTags: ['channel_reactivation'] },
  ],
  strategicOpportunities: [
    { point: 'Use the support audit to select gaps, not fill every format box.', basis: 'Ten biggest retrieved upload videos and five historical album leads are mapped to official audio, live, lyric, story, alternate and short-clip support in a separate Analysis view. Verify Topic/OAC delivery before adding audio duplicates. Not found is a title-match retrieval gap, not never made; partner/Topic and anonymous uploads may be missed. Existing live cuts should be reused before commissioning replacements.', needTags: ['catalogue_activation', 'hero_continuity'] },
    { point: 'Reserve a distinct follow-up while commissioning the primary.', basis: 'Proposed 7–14 day test; not a proven optimum. Performance, lyric treatment or band story should have a separate reason to watch.', needTags: ['follow_up_7_14'] },
    { point: 'Connect catalogue to the new record through programming.', basis: 'Proposed homepage, playlist and Station run shown inside the campaign deck, not as a separate page. Rights and Station access need confirming.', needTags: ['catalogue_activation', 'named_series'] },
  ],
  recommendedContentDirections: [
    { point: 'Prioritise a focused two-song live capture; keep full sets optional.', basis: 'Three 2018 sessions hold 305,504–552,488 each, but seven 2018 Reading songs uploaded in 2026 hold 2,329–10,152. No full-set comparison in the retrieved channel list. Proposed single-song cuts plus optional full show; audit footage rights first. Packaging suggestions are tests because CTR/retention are unavailable.', needTags: ['performance_as_hero', 'archive_live'] },
    { point: 'Capture focused BTS lightly and test one alternate arrangement only when musically justified.', basis: 'Three 2021–22 BTS videos hold 3,069–5,747; older making-of films 33,679/49,153. If You Wanna acoustic 17,319; Paranormal Romance orchestral 177,893, an Amazon Original. Different ages/contexts, no production-return or causal format claim.', needTags: ['low_band_time', 'follow_up_7_14'] },
    { point: 'Build two different weekly clips around the focus track or key single.', basis: 'Use a performance or visualiser clip plus a band story, then use an eligible Related Video into the full song. Rankings describe observed lifetime counts; conversion and retention are unmeasured.', needTags: ['shorts_programme', 'catalogue_activation'] },
    { point: 'Three-week anniversary warm-up: the song, the band, the next chapter.', basis: 'Proposed two Shorts and one Community conversation per week, one longer retrospective if existing footage supports it. Fan memories and band reflections should lead into later records and the priority new song.', needTags: ['catalogue_activation', 'shorts_programme'] },
  ],
  recommendedCampaignArchitecture: [
    { point: 'Budget around 10 full-song uploads, 40–50 Shorts and 20–25 Community posts for the provisional next campaign.', basis: 'User supplied a provisional brief of three singles, an album launch and underplay/CRM activity. No dated future timeline is added to the deck. Full-song allocation: three single visuals + three full follow-ups + one album-day focus visual + three post-album videos. Album-focus follow-up occupies the first post-album slot and is counted once. Film one underplay/session to supply cuts within these totals. Around two Shorts/week through roughly 23–25 active weeks, 3–4 replacing the album-week allocation, supports a rounded 40–50 Short budget; one Community post/week supports 20–25 posts. Reserve six post-album weeks. Commissioning envelope, not a measured optimum, guaranteed output or confirmed production budget. Adjust to audience response, rights and artist availability.', needTags: ['release_sequencing', 'shorts_programme', 'hero_continuity'] },
    { point: 'Commission album week and six weeks of post-release activity together.', basis: 'Proposed album week: one focus-song visual, 3–4 distinct Shorts, 1–2 Community posts and a complete official album playlist after checking Topic/OAC delivery. Full-song follow-ups at +7–14 days, week 4 (lyric) and week 6 (second captured song or another responsive album track). Week 3 is light story/Community support, not another full-video commission. Two distinct Shorts and one Community conversation a week through the follow-up run. Pre-book edits and rights; review day 7/day 28. Timing and assets remain proposals, not confirmed new album activity.', needTags: ['release_sequencing', 'shorts_programme', 'hero_continuity'] },
    { point: 'Make every album track findable, then sustain the record.', basis: 'Audit existing Topic/audio delivery before adding anything. A new performance/film or song treatment after release addresses the observed 2024 gap.', needTags: ['album_campaign'] },
  ],
  existingSuccesses: [
    { point: 'Sometimes, I Swear is the highest-view identified album asset outside the music video.', basis: 'R4VTfu95HHc: primary visualiser, 205,071 lifetime views as at 9 Nov 2026.', needTags: ['visualiser'] },
  ],
  relevantHistoricalExamples: [
    { point: 'The fifteenth-anniversary year is an existing catalogue story to continue.', basis: 'The debut was released in March 2011. The promoter lists 2026 anniversary shows, including November dates; the channel already carries 2026 anniversary material. Six selected original debut-era videos total 32,671,448 lifetime views, not current demand.', needTags: ['catalogue_activation', 'channel_reactivation'] },
  ],
  keyEvidence: [
    { claim: 'No matched full live-song asset for the five Pink Carnations leads within the 20 Sep 2023–12 Apr 2024 retrieved window; three lyric versions follow at 83/65/33 days.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: '/vaccines/support-audit-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: 'Chartmetric youtube_artist.daily_views totals 2,835,749 across 180 reported days, 9 May–5 Nov 2026 (21 Jun missing); average 15,754.16 per reported day. Artist scope includes channel plus featured videos, not owned-channel-only or returning viewers.', evidenceClass: 'OBSERVED', trust: 'PARTIAL', sourceRef: '/vaccines/channel-activity-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: '241 upload entries retrieved; channel lifetime 91,649,008; subscribers 141,000.', evidenceClass: 'OBSERVED', trust: 'TRUSTED', sourceRef: '/vaccines/research-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: 'Four primary visualisers total 723,014 / eight song assets’ 1,090,830 lifetime views = 66.3%.', evidenceClass: 'DERIVED', trust: 'TRUSTED', sourceRef: '/vaccines/research-2026-11-09.json', observedAt: '2026-11-09' },
    { claim: 'Displayed 910,965 seven-day delta is unsuitable as a consumption-pace measurement because history repeats cached totals.', evidenceClass: 'DERIVED', trust: 'PARTIAL', sourceRef: '/api/debug/snapshots?handle=%40thevaccinesuk', observedAt: '2026-11-09' },
  ],
  knownConstraints: [
    'There is no new album campaign to assess. All measured album evidence concerns Pink Carnations and its 2023–24 uploads; future rollout, creative and asset suggestions are recommendations only.',
    'No confirmed new album title, dates, budget, footage rights or artist availability supplied.',
    'Public YouTube API metadata plus a labelled Chartmetric artist daily-view history; no Studio retention, viewer journeys, paid/organic split or historical asset-level subscriber attribution.',
  ],
  knownCampaignPlans: ['2026 fifteenth-anniversary touring is publicly announced by promoters. The new album calendar, asset plan and proposed YouTube programme remain unconfirmed.'],
  youtubePlatformOpportunities: [
    { point: 'Pitch release support with album week and the six-week follow-through as one package.', basis: 'VMG pitch intent. Artist participation, regular full-song uploads, Shorts and Community activity support a stronger case for higher-tier partner backing; no placement or universal eligibility threshold is confirmed.', needTags: ['album_campaign', 'hero_continuity', 'shorts_programme'] },
    { point: 'Pitch Top Fans, London OOH, Music Night / release party and Stations.', basis: 'VMG pitch targets supported by active artist involvement, strong creative assets and a deliverable editorial/channel programme. Station scope combines catalogue, live, lyric and future music. Approval, inventory, lead times and rights apply.', needTags: ['community_activation', 'long_form_event', 'named_series'] },
    { point: 'Pitch Sky TV support for a suitable marquee-asset launch.', basis: 'User-supplied VMG pitch route when a documentary, full show or other marquee film is ready for a bigger launch. Separate from YouTube programme support; subject to asset readiness, rights, timing and partner approval.', needTags: ['long_form_event'] },
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
