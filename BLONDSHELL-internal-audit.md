# Blondshell — YouTube channel / Violins audit

Prepared 17 November 2026. Sources captured around 16:00 UTC. This research
precedes the dated presentation and is reproducible with
`python scripts/build-blondshell.py` from the checked-in API rows.

## Sources and evidence classes

- **API**: `/api/full-catalogue?handle=%40Blondshell&desc=full&cap=2000`,
  `/api/channel-shelf?channelId=UCJ1FMy0FK0aSeXosWvGXShg`, and
  `/api/comment-scan?ids=…&max=40&order=relevance`.
- **WATCHER**: `/api/debug/snapshots?handle=%40Blondshell` and
  `/api/video-series?ids=…`. Actual implementations and shapes inspected.
- **INFERENCE**: editorial interpretation and proposals, never substituted
  for API counters or observations.

Public evidence lives in `public/blondshell/research-2026-11-17.json`.
It retains all 520 catalogue rows and description opening lines, channel
history, video history, shelf responses and comment-sampling metadata.
Full descriptions containing lyrics and commenter identities are not bundled.
Exact calculations are in `calculations-2026-11-17.json` beside the source.

## Release dates and cohorts

Violins: 25 September 2026, verified against Partisan's official store,
artist Bandcamp, and primary upload descriptions. Official album tracklist:
Violins; Heart Has To Work So Hard; Lucky; Sea Legs; New Shape; Stone Fruit;
Two Fried; New Age Trojan Horse; Knotted; Reinstall; Fur Elise.

Current full audit window: 14 May–17 November 2026. Start is the explicit
Heart Has To Work So Hard teaser; first full song 18 May, title track /
album announcement 25 June. End is day +53 after album release.

Previous album: If You Asked For A Picture, 2 May 2025, verified against
Partisan's announcement and official Bandcamp. First explicit named
What's Fair teaser: 12 August 2024; full song 21 August. Full reconstruction
runs 12 August 2024–24 June 2025, day +53. Contains 137 channel uploads.
The 2025 formal announcement/T&A video was 9 January.

Equal publishing windows: day −130 through +53, both 184 days inclusive.
2026: 18 May–17 November. 2025: 23 December–24 June. What's Fair predates
the latter and remains in the full previous reconstruction. These are
publishing-window matches, **not age-matched view results**.

## Coverage restrictions

520 unique rows, playlist exhausted, not capped. Public video counter 513.
Retrieved views 6,290,022; channel lifetime counter 8,523,384. Difference
2,233,362 is not reconciled. No denominator mixing, no whole-channel
catalogue-share claim. No specific explanation for the discrepancy is established.

One zero-duration Live Stream (oHAC9CnFgmE), zero views, no actualStart:
retained in evidence, excluded from playable upload counts. This does not
prove a completed stream or Premiere.

The upstream endpoint's isShort field means duration >0 and ≤62 seconds.
Deck calls these Shorts and discloses the proxy. It cannot establish
Shorts-feed status and can miss longer native Shorts.

## Findings

**API — current rollout:** 110 playable uploads: 11 album full songs,
99 surrounding Shorts. Window uploads have 675,544 current lifetime views:
396,051 full-song (58.62697%) and 279,493 Short views. Median Short 2,321.
The 99 include personality, covers, touring and catalogue, not only album
promotional assets. Never label the aggregate as 110 confirmed album assets
or views generated in the campaign.

**API — album format mix:** two music videos 236,044; one visualizer
98,977; one lyric video 33,902; seven audios 27,128. Music videos account
for 59.599% of these 11 asset counters. This is a captured descriptive
share; it can change with time and does not isolate spend, age or format effects.

**API — rollout:** Heart Has To Work So Hard 18 May; Violins 25 June;
Fur Elise 18 August; Stone Fruit 25 September. Between-full-song gaps
38, 54 and 38 days. Fourteen-May teaser starts the wider activity cohort.
71 uploads before release day; 15 on release day; 24 afterwards.

**API — album day:** eight full songs (Stone Fruit and seven audios)
plus seven Shorts. Together with three preceding songs, all 11 album tracks
had a full-song destination by release day. No duplicate delivery needed.
Release-week window 25 September–1 October: 18 playable uploads.

**API — post-release gap:** 26 September–17 November: 24 uploads, all
Shorts, no further full-song album version in retrieved owned-channel
uploads. November Sirius XMU excerpts of Heart Has To Work and Stone Fruit
exist. Full-take availability, broadcaster rights and filming inventory
are unknown. Partner channels are not exhaustive here.

**API — earlier album:** two MVs, three lyrics, seven album-day audios;
12 primary album songs available by release. At days +1–53, 24 Shorts
and one Diet Pepsi cover, no new album-song full version. Toy/Thumbtack
Vevo DSCVR at +129 days; Arms/Gigi Perez +159; Another Picture +196.
These later resources are precedents, not part of equivalent early windows.

| Structural measure | Previous | Violins |
|---|---:|---:|
| Uploads in D−130…+53 | 110 | 108 |
| Shorts | 98 | 97 |
| Full-length uploads | 12 (includes cover) | 11 |
| Active seven-day bins | 25/27 | 23/27 |
| Maximum between-upload gap | 14d | 16d |
| New full album-song versions D+1…+53 | 0 | 0 |

Seven-day bins start at each window start; the last bin contains two days.
The maximum gap is a date difference, not a count of empty days. No raw
lifetime-view or median-view comparison is used between album eras.

**API — catalogue:** Olympus official audio leads retrieved catalogue
671,019. Salad lyric 279,699; MV 344,704, published 41 days later. Docket
visualizer 252,301 and Saturn Sound 144,661, 92 days later. These are
precedents for song extensions, not causal comparisons or current momentum.
No claim that all audiences prefer live, audio or lyrics.

**WATCHER — history:** channel mapped correctly. 22 observations from
27 October–17 November; no launch baseline. 8,339,175 → 8,523,384 is
+184,209 stored movement. Several plateaus, notably 9–17 November; API
capture matches latest stored count. Exclude fresh pace claims and do not
call the repeated counter zero audience growth. Recent subscriber series
moves 18,700→18,800 between 6–7 Nov; older subscriber history not returned.

**WATCHER — assets:** eleven video-series queries; only Fur Elise and
Stone Fruit have observations. Fur Elise: 31,089→32,342, 27 Oct–6 Nov;
stops before capture. Stone Fruit: 92,168→97,384, 27 Oct–17 Nov,
22 readings, +5,216 across 21 elapsed days. Fresh API 97,490 is a separate
capture. No per-day splice or claim of fastest current song.

**API — organisation:** five public playlists: Violins 11, previous plus
Another Picture 19, debut 9, Official Audio 11, Official Videos 11.
Violins created on release day. Three single-playlist homepage sections;
six additional types undefined. Endpoint does not report pinned playlist
IDs. No public live-specific playlist found. End screens/cards/Community/
Related Videos and trailer data are not assessed.

**API — comments:** 271 relevance-ranked comments across seven videos,
max 40 each, no videos reported disabled. Two short quotations in the deck
illustrate visual-world/personality recognition; do not generalise sentiment
or infer traffic sources, including comments mentioning advertising/radio.

## Strategic judgement

The channel has personality, a coherent song catalogue, adequate album-day
coverage and a history of successful individual assets in several formats.
The equivalent campaigns publish at nearly the same volume. Another general
instruction to publish more would miss the issue: neither album has a new
full-song album version in the first 53 days after release.

Prioritise clearance of full XMU takes before a new shoot; start with Stone
Fruit or Heart Has To Work. Catalogue-to-current curation and Studio routing
review use existing assets. Artist stories and performance Shorts need edits
and approvals. New filming/session production requires additional resources.

The six-week roadmap is proposed, conditional, and owner-led. The official
artist page lists London on 15 December 2026, but no filming is agreed.
A 7–14-day second version is a scheduling test, not a measured optimum.
Judge future work using matched-age day-7/day-28 counters plus authorised
Studio retention, traffic paths, returning viewers and subscriber contribution.
No paid/organic split, ROI, unique-fan total or conversion forecast is available.

## Source links

- https://store.partisanrecords.com/products/violins-lp
- https://blondshell.bandcamp.com/album/violins
- https://partisanrecords.com/moment/blondshells-sophomore-album
- https://blondshell.bandcamp.com/album/if-you-asked-for-a-picture
- https://www.partisanrecords.com/artists/blondshell
- Portrait: Reese Layton / Partisan artist press imagery.
- Thumbnail files: YouTube's actual video thumbnail endpoints, cached locally.

## Implementation / validation

Vaccines CSS, editorial layouts and presentation/analysis JavaScript reused
within Blondshell's own directory; no reference presentation changed. The
Next page keeps its established iframe route and now permits fullscreen.
Frozen dated API evidence means all headline numbers and narrative remain
consistent. Regenerate deliberately after new research; do not hydrate a
static conclusion with changing counters at page load.

## Violins visual identity update · 17 November 2026

The cover now uses the official Violins artwork, retrieved from the artist's
Bandcamp og:image (https://f4.bcbits.com/img/a1970050484_5.jpg).
The artist's current official website supplies the olive accent #817819:
https://static1.squarespace.com/static/custom-css/62c5e930a7fabc72bdc99ed1/62c5e931a7fabc72bdc99ef1/22/custom.css
The remaining palette follows the record cover's sand, umber, silver-grey
and pale rose. Lowercase, regular-weight sans-serif typography replaces
the reference deck's condensed caps, contrasting serif and star motif.
A separate violins.css skin scopes this change to Blondshell.
All research rows, calculations, recommendations and slide IDs are retained.


## 18 November: artist-specific signals and Analysis rebuild

Catalogue and campaign counters remain fixed to the 17 November capture. A new
18 November metadata/comment pass is separately dated; no day-on-day growth is
inferred. `signals-2026-11-18.json` holds the selected source evidence, not raw
commenter identities or a full comment export.

- 2,076 relevance-ranked top-level comments sampled across 62 selected uploads:
  all 54 playable full-length entries and eight highest-viewed duration-proxy
  Shorts, up to 100 comments each. This is not a representative audience sample.
- 55 of 100 sampled Olympus comments mention Invincible. An existing artist
  Short explicitly references that discovery route. This is not a traffic share.
- Individual Arms comments request an acoustic version and recognise the later
  Gigi Perez alternate. Arrangement credits confirm acoustic instrumentation.
  Acoustic content already exists; a stripped Violins performance is a proposed
  test, not remediation of an entirely absent format.
- Docket live comments specifically respond to the paired voices; the live duet
  has 144,661 lifetime views at the counter capture. No controlled format test
  or recommendation to commission another collaboration is implied.
- Four official music videos retain both scheduled and actual broadcast starts:
  Joiner, Salad, T&A and Event of a Fire. The Yves Rothman conversation is a
  separate livestream, starting 16 May 2023 at 16:30 UTC before Salad at 17:00.
  Its description explicitly invites that sequence. The publication date is
  17 May; it is not the actual broadcast date. Missing current-album broadcast
  metadata means unknown, not proof no Premiere took place.
- Live is classified more carefully: three full performance videos plus one
  session audio (Diet Pepsi). A KEXP partner full performance is linked outside
  owned-channel counts. BBC and Berlin acoustic examples are short excerpts.

The new Analysis surface opens with readable channel, format, song-version,
fan-signal and broadcast tables; long inventories stay available on demand.
Recommendations now name the full XMU takes, one stripped performance test and
an optional title-track lyric route, with asset clearance and production needs
made explicit. `scripts/blondshell_signals.py` rebuilds these additions and
asserts core counts against the saved research. Other artists are unchanged.


## Post-album programming proposal · 18 November

The new Plan navigation opens an illustrative eight-week calendar, 23 November
2026 to 17 January 2027, plus an asset-led Stone Fruit example. The calendar is
stored in `public/blondshell/post-album-plan.json` and generated by
`scripts/blondshell_post_album.py`; counts and seven-day week spacing are
asserted at generation.

The proposed budget is two Shorts per week (16 total), one full-length upload
in the week of 30 November, and an optional second full-length version in the
week of 11 January. Neither upload is booked or assumed to exist. Stone Fruit
XMU is the first footage enquiry; its public excerpt does not establish access
to a full usable recording. If unavailable, an approved stripped take or lyric
edit is an alternative and dates should reset to asset readiness. January is
a decision after reviewing day-28 response, not a promise of another shoot.

The 7–14-day supporting window and two-Short weekly cadence are programming
tests. They are not measured optima or YouTube requirements. Playlists and
Related Videos can connect catalogue to Violins throughout; current settings
need checking in Studio. Station availability is a separate discussion with
YouTube. No view forecast or incremental channel uplift is calculated.
