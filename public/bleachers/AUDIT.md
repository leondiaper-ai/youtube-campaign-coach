# Bleachers × YouTube deep dive — audit pack

**Artefact:** `https://youtube-campaign-coach.vercel.app/bleachers`
**Version:** v3 — 30 September 2026
**Audience for the deck:** the artist and their management.

---

## 0. Version history

| Version | What it got wrong | Fixed in |
|---|---|---|
| v1 | Said 15 music videos / 60.2M — missed "Tiny Moves (Official)" (4.43M) because the title omits the word "Video", and the stated count didn't match its own sum. Said only two songs got the full support package while its own table showed three. Took 54% against the 189M lifetime counter on the cover. Claimed "all 230 uploads classified" while showing 174. | v2 |
| v2 | Headlined "the live take beat the music video" from a single comparison. Presented lifetime live-video medians against Shorts medians as though it were a controlled experiment. Implied the Stone Pony show being public meant rights were settled. Presented the four lyric videos' average as a clean per-upload return, ignoring that they are old and attached to the biggest songs. Chart bars rendered as hairlines. | **v3** |

---

## 1. Data sources

| Source | What it gives | Window |
|---|---|---|
| YouTube Data API v3 | 230 uploads: views, likes, comments, duration, publish date, title, description | Read 30 Sep 2026 |
| Our own daily channel snapshots | Channel-level view and subscriber totals | **From 20 Apr 2026 only** — 23 weekly readings |
| UK Official Charts Company | Public chart record for Merry Christmas, Please Don't Call | Dec 2024 – Feb 2026 |

**No Studio access.** No watch time, retention, traffic sources or demographics, and no claim on the page requires them.

### Counters move

Read at 15:20 UTC the catalogue summed to **111,033,880** across 230 uploads. Earlier the same day it was 111,031,833 — a drift of ~2,000 views in a few hours. The deck rounds every figure for this reason and footnotes the exact total once with its read time. Differences of this size between this document and a later re-pull are expected and are not errors.

### The coverage gap

| | |
|---|---|
| 230 uploads, summed | **111,033,880** ("the catalogue") |
| Channel lifetime counter | **188,997,142** ("lifetime") |
| Unaccounted | **77,963,262 — 41.3%** |

The deck keeps these two words strictly apart, gives both their own object on slide 2, and divides nothing by the lifetime figure. It also states that if the missing 78M is not spread evenly across formats the shares would shift, and that this cannot be tested from outside.

---

## 2. Format census — exhaustive and self-checking

| Category | Uploads | Views | Share of catalogue |
|---|---|---|---|
| Music video | 17 | 64,643,354 | 58.2% |
| Official audio | 16 | 27,856,744 | 25.1% |
| Live | 45 | 8,635,469 | 7.8% |
| Lyric video | 4 | 4,885,844 | 4.4% |
| Album tracks & remixes | 30 | 2,606,419 | 2.3% |
| Docs & behind the scenes | 24 | 1,343,066 | 1.2% |
| Shorts | 94 | 1,062,984 | 1.0% |
| **Total** | **230** | **111,033,880** | **100%** |

**Both columns reconcile exactly.** Every upload lands in exactly one category. A miscount would break the sum, which is the control that v1 lacked.

### Manual verification of all 17 music videos

Every one inspected for title, duration and date. Durations run 182–307s, all consistent with music videos.

| Video | Date | Views | Duration |
|---|---|---|---|
| I Wanna Get Better | 2014-03-27 | 15,686,722 | 293s |
| Rollercoaster | 2014-10-29 | 11,805,014 | 211s |
| Merry Christmas, Please Don't Call | 2024-11-26 | 7,060,665 | 200s |
| Don't Take The Money | 2017-05-02 | 5,012,123 | 307s |
| **Tiny Moves (Official)** | 2024-01-17 | 4,425,809 | 247s |
| Modern Girl | 2023-09-20 | 4,247,766 | 247s |
| Chinatown | 2020-11-16 | 3,612,679 | 282s |
| Stop Making This Hurt | 2021-05-18 | 2,764,651 | 225s |
| I Miss Those Days | 2017-05-25 | 2,677,300 | 219s |
| you and forever | 2026-02-11 | 2,198,689 | 236s |
| Alfie's Song | 2018-03-19 | 1,465,433 | 206s |
| the van | 2026-04-13 | 1,384,172 | 199s |
| Alma Mater | 2023-12-07 | 1,342,754 | 231s |
| Like a River Runs | 2015-08-11 | 437,346 | 200s |
| How Dare You Want More | 2022-01-28 | 304,157 | 275s |
| Dirty Wedding Dress | 2026-04-17 | 202,366 | 291s |
| How Dare You Want More — Verdine White Remix | 2022-06-14 | 15,708 | 182s |

**Tiny Moves specifically:** 4:07, published 17 Jan 2024 as a premiere, choreography by Margaret Qualley, with a separate "Tiny Moves (Live at Red Rocks)" also on the channel. It is the official music video. v1 missed it; v3 counts it.

**The one judgement call:** the 17 include the Verdine White *remix* video. The deck says "17 music videos" in the census and "sixteen songs have an official music video" on the support slide. Both are accurate. Excluding the remix would make it 16 / 64,627,646 and move nothing material.

---

## 3. Claims, with figures

### Catalogue longevity — the central argument

| | |
|---|---|
| Views 27 Apr 2026 | 165,112,313 |
| Views 28 Sep 2026 | 188,997,142 |
| Gain over 154 days | **+23,884,829** (~155,096/day) |
| Uploads published in window | 5 |
| Views held by those five | **650,634 (2.7%)** |
| Landing on older material | 23,234,195 (97.3%) |

The five: `vPyhRkfMGak` 388,227 · `468J7e1clU4` 227,059 · `L7xZiSVChvM` 25,020 · `9QUgwQBv9fE` 5,647 · `BBGIgBuzqHc` 4,681.

> **The distinction the slide makes explicitly.** This does not mean the 23.88M would have arrived with no activity. A release, tour announcement or press moment lifts catalogue viewing too, and that halo is invisible from outside — we can see where views landed, not what sent them there. The claim is about **where viewing lands**, not about what would have happened otherwise. The slide says this in its own words before drawing the conclusion.

### The seasonal asset

**On YouTube.** `aBpYk9vuneE`, 26 Nov 2024, **7,060,665 views**. Third-largest music video on the channel behind two from 2014 — so the largest released since 2014.

**UK Official Singles Chart** (officialcharts.com, fetched 30 Sep 2026) — chart performance, not YouTube viewing:

| Season | Weeks | Run | Peak |
|---|---|---|---|
| One — Dec 24 / Jan 25 | 1 | 02 Jan (77) | **77** |
| Two — Dec 25 / Jan 26 | 4 | 11 Dec (65), 18 Dec (66), 25 Dec (78), 01 Jan (68) | **65** |

Also two four-week runs on the Official Independent Singles Chart, peaking 10 and 12; Physical Singles peak 24; Vinyl Singles peak 18; Irish Singles 47.

**Channel output by season:** season one, official music video + 5 Shorts. Season two, **2 Shorts and no video asset**. A December 2025 network television performance was not published to the channel — the catalogue shows no upload between 31 Oct 2025 and 3 Feb 2026. The one new Christmas asset since is the Annie DiRusso live version, published **14 Aug 2026**.

> **STATED PROMINENTLY ON THE SLIDE.** Our daily snapshots begin **20 April 2026**. We have **no observation of either Christmas period** and the deck declines to estimate one. The seasonality claim rests entirely on the chart record, which is independent of YouTube. The deck does **not** claim measured YouTube seasonal growth, and the chart graphic is labelled as chart position.

### Live performance

Twelve songs have both an official video and a live version. **The official video leads in ten.** The two exceptions:

| Song | Live | Official video |
|---|---|---|
| How Dare You Want More | 601,311 | 304,157 |
| Dirty Wedding Dress | 388,227 | 202,366 |

These are also the two lowest-viewed official music videos in the catalogue. The deck's claim is therefore: live is a second opening for a song whose video didn't land — explicitly *not* a ranking of formats.

**Stone Pony** `468J7e1clU4`: 91 minutes, 227,059 views, published 5 Jun 2026, never split into songs.
**Red Rocks precedent**, 8 Jul 2024: `LvwZVMk2v6o` 171,061 + `YE68EpoHT3k` 143,285 + `-b9D3TVmssI` 68,986 = **383,332** from one night, published individually.
The channel holds **28 single-song live videos** in total.

> **Removed in v3:** the live-median-versus-Shorts-median bar comparison. Those sets differ in publication date, era and distribution conditions; presenting them side by side implied a controlled experiment that was never run. Live and Shorts now sit on separate slides.
>
> **Also removed:** any implication that the show being public establishes clearance. The recommendation now says rights clearance is required and that publication does not establish it.
>
> **Added:** the acknowledgement that individual uploads may redistribute viewing from the full-show upload rather than purely add to it.

### Shorts

94 Shorts, median **6,083**. Two above 50,000 — `7XyRT_prqjY` 152,565 (billed as the only live performance of Modern Girl that exists) and `au7cm7Od7b8` 144,905 (Margaret Qualley's choreography). Third is 46,996. Neither top performer is a concert excerpt.

Supporting context only: the six Radio City Shorts (Aug–Sep 2023) run 1,841 to 6,083. The deck states these were published in a different year under different conditions and that two successes out of ninety-four is thin. It is framed as a creative hypothesis — test distinctiveness as the variable — not a formula.

### Song support

Songs with video **and** lyric **and** audio **and** live: **three** — I Wanna Get Better (30.67M), Rollercoaster (18.92M), Alfie's Song (3.72M). The last was 2018.

Every total in the table counts the same four asset types and nothing else. The "you and forever" official video alone is 2,198,689 of its 2,750,183; the deck states both.

Four lyric videos exist: I Wanna Get Better 3,714,016 · Alfie's Song 563,167 · Shadow 480,248 · Rollercoaster 128,413. **v3 removes the "average 1.2M each, highest per-upload return" framing** — they are old and attached to the largest songs, so their totals are not evidence that a new lyric video would perform. The slide now says so.

Note Shadow has lyric, audio and live but no official music video, which is why it is not in the support table.

---

## 4. What the deck does not claim

1. That the 23.88M would have arrived with no activity — the halo is named on the slide.
2. Any measured YouTube seasonality.
3. That live outperforms official video.
4. That building assets caused the old songs' size — for the package or for lyric videos.
5. That a public concert film may be cut up without clearance.
6. Any Studio metric.
7. Any percentage against the 189M lifetime counter.

---

## 5. Recommendation traceability

| # | Action | Slide carrying the evidence | Strength |
|---|---|---|---|
| 01 | Test individual song edits from Stone Pony | Live — Red Rocks precedent (383K from one night), 28 single-song live videos | **Moderate** — one same-channel precedent; redistribution risk stated |
| 02 | Prepare a recurring November–December campaign | December — one chart week became four, peak 77 → 65 | **Strong on demand, none on YouTube** — stated |
| 03 | Test a complete support package on one song | Support — three full packages, none since 2018 | **Suggestive only** — confounded by age; framed as a test |
| 04 | Build Shorts around distinctive moments | Shorts — 152,565 and 144,905 against a 6,083 median | **Weak** — n=2, called a hypothesis |

Slide order matches action order, so each action's evidence is the slide the reader passed most recently.

---

## 6. Slide structure — 9 slides

1. Cover
2. The catalogue — scale, and the 111M / 78M distinction
3. What earns — seven-category census
4. Catalogue longevity — 97.3%, with the halo distinction
5. Live — the two exceptions, and the Stone Pony show
6. December — the seasonal asset
7. Song support — three packages, none since 2018
8. Shorts — two worked, neither a concert clip
9. What next — four prioritised actions
+ colophon

---

## 7. Outstanding items a reviewer should press on

1. **Redistribution.** If Stone Pony is split into songs, do those add viewing or draw it from the full-show upload? The deck flags this; it cannot answer it in advance.
2. **Cross-platform inference.** Recommendation 02 assumes December chart demand is reachable on YouTube. That is an inference across platforms, stated but not proven.
3. **The Verdine White remix** counted as a music video — 17 vs 16.
4. **The five-upload halo** is unquantifiable from outside, so 97.3% is a statement about where views landed, not about causation. Check the slide wording holds that line.
5. **n=2** carries recommendation 04 even labelled a hypothesis.
6. **Season-two output** is stated as 2 Shorts; that is what the channel published, but promotion may have run elsewhere (television, playlists, DSPs) and we cannot see it.
