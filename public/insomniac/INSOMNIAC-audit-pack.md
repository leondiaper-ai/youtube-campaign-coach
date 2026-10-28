# Insomniac × YouTube — audit pack

**For independent review.** Read 28 October 2026. Everything below is the raw material
behind the deck at `/insomniac`. Its Analysis sheet carries the summary tables; this file
carries the provenance, the rules, the rows, the arithmetic behind every claim, what was
considered and dropped, and the places I think it is weakest.

Please **try to break it**. Take a claim from §5, trace it to the rows in §4, and say where
the claim outruns the evidence. The deck is meant as a constructive review of a large,
well-run channel for a business review. If a finding reads as a manufactured problem, say so.

Method and evidence standards follow the Defected audit pack (`/defected/AUDIT.md`).

**Version 3 adds §10, the Content Support & Cadence Audit (investigation only; deck unchanged).**

**Version 2 (refinement pass, 28 October 2026).** The deck was restructured for a business
review (14 slides), a native-tools slide was added, and every disputed figure was re-derived
from the stored rows. What changed, and why, is in §0. Nothing in v1's evidence was deleted;
superseded figures are marked.

---

## 0. Changes in version 2

### 0.1 Data corrections

| Item | v1 | v2 | Why |
|---|---|---|---|
| kineticFIELD sets / median | 16 / 282,627 | **15 / 291,036** | The six stage counts in v1 summed to 79 *plus* one unnamed set = 80. Re-reading each description: kineticFIELD has 15 sets (listed in §4.5). The v1 "16" was a counting error. 10 ≥ 100K unchanged; no other stage changes; the over-performer ratios (§4.6) involve no kineticFIELD set and are unaffected |
| Publication lag | 48 / 17 / 9 / 6, "over 80" | **50 / 14 / 9 / 6, over 79** | v1's 80-set base could not be reproduced: all EDC-titled long-form uploads of 2026 are the 79 sets plus the lineup reveal, two Afters streams and one Inside The Drop episode. v2 counts the 79 by Pacific calendar date after 17 May (day 0 = 17 May; ≤ 7 days = published by 24 May). Counting in UTC hours instead gives 43 / 21 / 9 / 6; the deck uses calendar days |
| 4,169 vs 4,171 | "two uploads landed between the statistic and the pull" | **Unexplained two-video gap in YouTube's public counter** | The counter and the uploads list were read in the same request; the newest upload is 27 Oct 17:47 UTC; no duplicate IDs. The v1 explanation was wrong. YouTube's `videoCount` is known to lag and may exclude live-now items (two live stations sit in the uploads list), but which two is unknown. The deck now leads with **4,171 uploads read** |
| Live / Premiere items | "195 carry `wasLive`; 189 scheduled" | **73; 72 scheduled** | Recounted from the stored rows by year: 2019 1 · 2020 2 · 2021 7 · 2022 13 · 2023 16 · 2024 22 · 2025 4 · 2026 8. The v1 figure could not be reproduced |
| Zombie Apocalypse views | Skull Machine 22,143 · YDG 21,851 · Avello 24,148 · Sullivan King 91,876 | 22,142 · 21,849 · 24,145 · 91,880 in the stored API rows | v1's figures came from the watch pages read minutes apart; differences of 1–4 views. Deck rounds both to the same K |

### 0.2 Reframed claims

- **Trailers (slide 3).** v1: "Trailer audiences have most likely moved to other platforms."
  v2: a change in the trailer's role on the channel, not a verdict on the marketing; public
  data can't show where trailer audiences watch now. Age-aware wording kept.
- **Genre (slide 7).** v1 headline: "Techno, house and trance sets travel further than their
  billing." v2: "The headliners lead — but some sets beat their stage by four or five times";
  genre is "a pattern worth investigating, not a reason to favour a genre".
- **Shorts (slides 4, 8).** v1 headline: "Shorts kept the channel busy. Few of them
  travelled." v2: "Shorts keep the festival in the feed, every week of the year", with the
  reach role stated and Studio named as the judge.
- **Autumn (slide 9).** v1 posed "planned rest, or a resourcing change?" v2 adds the
  like-for-like comparison (§4.11): the drop is the end of a year-long high-volume Shorts run;
  output is back near 2023–24 levels; upload counts are not demand.
- **Other events (slides 9, 13).** v1: "One festival got the full treatment. The rest of the
  calendar got a trailer." v2: "EDC gets the full cycle. The rest of the calendar is the
  opportunity", with "whether they were filmed, and on what terms, isn't visible from
  outside" and the experiment limited to "two or three more events, where filming and rights
  allow".
- **Artist-channel model (slide 6).** Promoted to its own slide. Playlist views are stated as
  separate from, and never added to, the channel's 195.2M; the playlist is described as a
  curated selection, so no host-vs-host comparison is made.

### 0.3 Slide order, v1 → v2

1 Cover · 2 At a glance · 3 How the channel has evolved (was "Where the audience is") ·
4 What is driving viewing today (was "The content engine") · 5 EDC 2026 · 6 The distributed
artist-channel model (was "Who hosts the sets") · 7 Which performances are connecting (was
"Artists and genres") · 8 Shorts · 9 Festival content across the calendar · 10 Channel
organisation · 11 What Insomniac already does well · **12 Beyond the festival: YouTube's
native tools (new)** · 13 Double down / optimise / experiment (rewritten) · 14 The opportunity
(rewritten). The four "questions for the team" moved from the slide to the Analysis sheet and
§9.

---

## 1. Provenance

| | |
|---|---|
| Channel | `@insomniac` — `UCr45VhwCBYwMfdN-gz7W_OA`, created 17 June 2006 |
| Source | YouTube Data API v3, one pull, 28 October 2026, 11:12–11:23 UTC, through the project's own routes: `/api/full-catalogue?handle=@insomniac&cap=5000` (uploads), `/api/channel-shelf?channelId=…` (playlists, Home sections), `/api/channel?q=@Insomniac` (cached channel record) |
| Lifetime view counter | **195,160,777** |
| Subscribers | **722,000** (YouTube's rounded public figure) |
| Public videos | **4,169** (YouTube's public counter) |
| Uploads retrieved | **4,171** — the uploads playlist to exhaustion, not capped. 17 June 2006 → 27 October 2026 (newest 27 Oct 17:47 UTC). No duplicate IDs. The two-video gap sits in YouTube's counter, not the pull (§0.1). **This is the whole channel, not a sample; every figure uses the 4,171.** |
| Sum of views over the 4,171 | **194,196,683** — 99.51% of the lifetime counter. The 0.96M gap is deleted or private videos |
| Fields used | `title`, `publishedAt`, `durationSec`, `views`, `likes`, `comments`, `wasLive`, `scheduledStart`, `actualStart`, first 300 characters of `description` |
| Shorts | Verified individually (§2.1), not from the API's duration flag |
| Playlists and sections | 108 public playlists with item counts; 6 Home sections |
| Live pages read the same day | Home (`/@insomniac/featured`, from the page's own data), the `Insomniac TV` live station, the "EDC Las Vegas 2026 Full Sets" playlist (63 items read one by one), the "Insomniac Events Live" playlist (83 items read one by one), YouTube search for artist-hosted EDC 2026 sets (§4.7) |
| External | YouTube's announcement of the EDC 2026 livestream (blog.youtube, 14 May 2026); EDMTunes' livestream guide (May 2026); the Night Owl Radio podcast feed (podengine.ai, read 28 Oct 2026) |
| Snapshot history | **One day.** The channel entered the project's daily sync on 27 October 2026. No velocity, momentum, release-week or growth figure exists anywhere in this work |
| YouTube Studio | **None.** No impressions, CTR, retention, watch time, traffic sources, returning viewers, subscriber conversion, end-screen, card, related-video-link or Community data |
| Territory data | **None.** Not available from the public API; no claim about geography is made |

### Coverage facts, stated first

- Every view figure is a **lifetime total as at 28 October 2026**. Older uploads have had
  longer to accumulate. Where the deck compares an older group with a newer one, it says
  which way the age difference cuts (§5).
- The catalogue is complete, so shares of "all views" use the 194.2M observed sum and are
  within 0.5% of what they would be against the counter.
- 73 uploads carry live-broadcast details (Premieres or streams); 72 of those have a
  `scheduledStart` (§0.1 — v1 said 195/189). Four live items report **0 views** because the
  count is hidden (the Insomniac TV station, two "EDC Afters Live" streams, a 2023
  station); they are classed separately and contribute nothing.

---

## 2. Classification

### 2.1 Shorts — verified, not inferred

The `/api/full-catalogue` route flags a Short when `durationSec ≤ 62`. That rule is wrong in
both directions for this channel:

- Since October 2024, Shorts can be up to 3 minutes; Insomniac's casual vertical clips of
  63–130 s ("This or That…", "do we need more lasers?") were being counted as long-form.
- Before Shorts existed, the channel posted many sub-minute horizontal teasers and trailers.

So every upload of **≤ 185 seconds (1,744 uploads)** was requested at
`https://www.youtube.com/shorts/{id}` with redirects disabled, from a youtube.com page. A
real Short returns 200; anything else redirects (303) to `/watch`. 0 errors.

| Result | n |
|---|---|
| Real Shorts | **1,125** |
| API-flagged ≤62 s but **not** Shorts (horizontal) | 200 — 2006–2021: 57; 2022: 18; 2023: 32; 2024: 43; 2025: 38; 2026: 7 |
| Not flagged but **are** Shorts (63–178 s) | 18 |

Earliest verified Short: 27 September 2019 (YouTube classifies older vertical uploads
retroactively). Shorts since 1 January 2025: 979; since 1 October 2025: **774**.

### 2.2 Formats

Title and duration, first match wins, in this order (case-insensitive):

| Class | Rule |
|---|---|
| Short | §2.1 |
| Night Owl Radio | "night owl radio" and ≥ 30 min |
| Event marketing | "lineup reveal", "music through music"; or < 15 min and "trailer", "tráiler", "announcement", "announce", "anuncio", "lineup", "on sale", "dates", "tickets", "aftermovie", "recap", "post-event", "thank you video", "headliner quote" |
| Editorial | "inside the drop", "behind the daisy", "documentary", "reflections from" (checked before the set rule, because Inside The Drop episodes can run over 20 min) |
| Podcast / talk | "wide awake stories", "podcast" |
| Release | < 15 min and "insomniac records", "(official)", "official audio / lyric / music video", "visualiser", "track of the day"; later, < 15 min with " - " or " – " and no festival property in the title |
| Livestream (2020 – mid-2021) | ≥ 20 min, published before July 2021, and "rave-a-thon", "livestream", "artist series", "satellite series", "month in isolation", "presents the atlas", " for ", or a "(Month D, 20YY)" date in the title |
| Livestream series (2021–22) | ≥ 20 min, before 2023, "edm maniac", "takeover", "livestream", "mi tierra sessions", "krush by kvsh", "for the", or a dated title |
| Full set | ≥ 20 min and "full set", "live at", "live from", "@", "b2b", an EDC stage name, or a festival property in the title |
| Long mix / other | ≥ 20 min otherwise |
| Performance clip | < 15 min and "live at/@/from", "performs", "drops", "highlights", "edc curated", "moment" |
| Other | none of the above |

Festival property is a separate title rule (EDC Las Vegas, Orlando, Mexico, Asia, other;
Beyond Wonderland; Nocturnal; Escape; Dreamstate; HARD; Countdown; Day Trip; Middlelands;
Bassrush/Basscon; Wasteland; Electric Forest; Okeechobee; Zombie Apocalypse; Sphere/UNITY).
EDC stage names in a title with an EDC or year reference count as EDC Las Vegas. **Known
misfire:** "Wasteland SoCal 2026 Official Trailer" is caught by the stage list ("wasteland")
and tagged EDC Las Vegas; it is counted as a separate event in §4.8.

**Checks.** Read every title in the full-set, Night Owl Radio and "Other" groups since
2022; read samples of 25–40 titles per group per era; re-classified after each read. Since
2022, "Other" holds 74 uploads, 1.08M views (largest: MORTEN, ARTBAT — Hollow, 315K, a
release with an em dash the rule doesn't catch; Escape Halloween 2024 Venue Experience 117K).
Nothing in the deck depends on "Other".

**EDC 2026 stage** comes from the description ("…set from Quantum Valley Stage…", "…from
bassPOD…"), which names the stage on 78 of 79 sets.

---

## 3. Questions the brief asked, and where they are answered (v2)

| Brief | Slide(s) | Short answer |
|---|---|---|
| A. What is driving the channel? | 2, 3, 4 | Lifetime: trailers (38.7%), lockdown livestreams (24.3%), releases (17.9%). Uploads since Oct 2025: full sets (61.8% of views from 9% of uploads) |
| B. Which content deserves more investment? | 4, 5, 13 | Full sets, on the EDC 2026 model; Shorts do a different (reach) job that public data can't value |
| C. Are festival audiences becoming year-round audiences? | 9, 11, 12, 13 | EDC runs the full cycle (reveal stream → live → sets → Insomniac TV); other events appear as trailers/aftermovies. Insomniac TV is the always-on thread. Viewing momentum can't be measured (no snapshots) |
| D. What is working at artist level? | 6, 7 | The artist-channel model (46.9M in the curated playlist; Collaborations both ways); within EDC 2026, sets beating their stage 3–5× — a pattern to investigate, not a genre rule |
| E. How effectively is the channel organised? | 10 | Well: set-led Home, 108 playlists. Gaps: 18 sets outside the 2026 playlist, 2/63 with timestamps, no stage/sound/artist browsing |
| F. What should Insomniac try next? | 12, 13, 14 | Double down (sets, Collaborations, the EDC cycle, Afterparties) · Optimise (finish and connect the library) · Experiment (2–3 more events, an Insomniac TV block, Shorts-to-set, Premiere + Afterparty) |

---|---|---|
| A. What is driving the channel? | 2, 3, 4 | Lifetime: trailers (38.7%), lockdown livestreams (24.3%), releases (17.9%). Since Oct 2025: full sets (61.8% of new views from 9% of uploads) |
| B. Which content deserves more investment? | 4, 5, 12 | Full sets. Shorts are 82% of uploads and 24% of views |
| C. Are festival audiences becoming year-round audiences? | 9, 10, 12 | Only around EDC LV. 12 other 2026 events got a trailer or aftermovie only; output fell to 19 uploads in Sep–Oct. Insomniac TV is the always-on thread. Momentum can't be measured (no snapshots) |
| D. What is working at artist level? | 6, 7 | Over-performers against their stage lean techno, house, trance; the biggest set audiences sit on artist channels; Collaborations now share them |
| E. How effectively is the channel organised? | 10 | Well: set-led Home, 108 playlists. Gaps: 18 sets outside the 2026 playlist, 2/63 with timestamps, no stage/sound playlists, Night Owl Radio playlist frozen |
| F. What should Insomniac try next? | 12 | Double down: sets at a few more events. Improve: finish the set library. Experiment: point some Shorts at sets |

---

## 4. The rows

### 4.1 Views by upload year (all 4,171)

| Year | Uploads | Views | | Year | Uploads | Views |
|---|---|---|---|---|---|---|
| 2006 | 1 | 34,828 | | 2017 | 40 | 6,888,271 |
| 2007 | 1 | 61,663 | | 2018 | 245 | 11,960,786 |
| 2009 | 2 | 790,915 | | 2019 | 186 | 8,763,415 |
| 2010 | 9 | 5,264,525 | | 2020 | 870 | 44,807,896 |
| 2011 | 18 | 8,051,134 | | 2021 | 616 | 11,313,123 |
| 2012 | 22 | 7,958,280 | | 2022 | 237 | 10,280,304 |
| 2013 | 15 | 7,851,053 | | 2023 | 194 | 15,037,286 |
| 2014 | 53 | 8,908,454 | | 2024 | 232 | 7,107,877 |
| 2015 | 102 | 8,421,671 | | 2025 | 617 | 8,504,734 |
| 2016 | 50 | 7,033,611 | | 2026 (to 27 Oct) | 661 | 15,156,857 |

Eras: 2006–2019 744 uploads, 81,988,606 (42.2%) · 2020–2021 1,486, 56,121,019 (28.9%) ·
2022–2024 663, 32,425,467 (16.7%) · 2025–Oct 2026 1,278, 23,661,591 (12.2%). Within
2022–24, releases are 71.4% of views (event marketing 14.7%, full sets 3.8%, Shorts 2.7%).

Concentration: top 10 uploads 16.9% of observed views; top 100 48.9%. Top 12: Noizu &
Westend – Push To Start (release, Feb 2023) 7.22M · EDC 2010 trailer 3.63M · EDC Vegas 2014
announcement 3.22M · DJ Soda – Countdown Virtual Rave-A-Thon (Mar 2020) 3.19M · EDC 2012
trailer 3.00M · EDC LV 2016 trailer 2.73M · EDC Vegas 2011 trailer 2.55M · EDC LV 2015
trailer 2.52M · EDC 2012 dates announcement 2.46M · EDC LV 2019 trailer 2.32M · EDC NYC
2014 trailer 2.09M · EDC LV 2020 trailer 2.03M.

### 4.2 Formats

| Format | All-time n | Views | Share | Median | p25–p75 | ≥100K | Since 2022 n | Median | Since 1 Oct 2025 n | Views | Median |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Event marketing | 313 | 75,151,585 | 38.7% | 48,329 | 11K–224K | 123 | 134 | 13,851 | 31 | 1,134,384 | 9,712 |
| Livestream 2020–21 | 1,092 | 47,138,613 | 24.3% | 14,205 | 4.9K–43K | 105 | — | — | — | — | — |
| Release | 514 | 34,845,168 | 17.9% | 9,873 | 2.4K–50K | 87 | 193 | 41,275 | 18 | 991,869 | 8,773 |
| Full set | 155 | 15,278,494 | 7.9% | 26,896 | 8.1K–98K | 38 | 114 | 42,767 | **85** | **10,473,978** | **69,407** |
| Short (verified) | 1,125 | 6,409,978 | 3.3% | 3,355 | 1.8K–6.7K | 2 | 1,114 | 3,282 | **774** | **4,102,321** | **3,259** |
| Editorial | 189 | 3,036,000 | 1.6% | 7,498 | 2.2K–15K | 4 | 38 | 3,805 | 22 | 139,793 | 2,941 |
| Performance clip | 25 | 2,235,903 | 1.2% | 11,024 | 6.2K–36K | 3 | 15 | 8,324 | 3 | 79,265 | 32,930 |
| Livestream series 2021–22 | 157 | 1,406,571 | 0.7% | 2,492 | 1.5K–6.0K | 2 | 29 | 2,282 | — | — | — |
| Night Owl Radio | 368 | 1,222,103 | 0.6% | 2,472 | 1.7K–3.7K | 0 | 220 | 2,502 | 0 | — | — |
| Other / long mix / podcast / hidden-count live | 233 | 7,472,268 | 3.8% | — | — | 17 | — | — | 7 | 14,420 | — |
| **Total** | **4,171** | **194,196,683** | | | | | | | **940** | **16,936,030** | |

Likes per 1,000 views since 2022: Shorts 26.2 · full sets 17.1 · releases 10.0 · event
marketing 7.0. Not used on a slide: likes per view are not comparable across formats that
are watched for different lengths.

### 4.3 Since 1 October 2025, by month of upload

| Month | Shorts | Sets | Other | Shorts views | Set views | Other views |
|---|---|---|---|---|---|---|
| Oct 2025 | 83 | 0 | 11 | 628,957 | 0 | 106,352 |
| Nov | 82 | 0 | 13 | 268,475 | 0 | 256,245 |
| Dec | 85 | 0 | 5 | 441,045 | 0 | 78,099 |
| Jan 2026 | 84 | 0 | 3 | 500,200 | 0 | 341,620 |
| Feb | 76 | 0 | 5 | 368,947 | 0 | 361,334 |
| Mar | 84 | 0 | 3 | 259,159 | 0 | 38,000 |
| Apr | 52 | 0 | 8 | 132,141 | 0 | 41,802 |
| May | 72 | 64 | 11 | 531,737 | 8,332,499 | 243,819 |
| Jun | 50 | 13 | 8 | 426,028 | 1,800,469 | 124,837 |
| Jul | 53 | 7 | 6 | 329,056 | 306,784 | 684,929 |
| Aug | 42 | 0 | 1 | 186,958 | 0 | 5,873 |
| Sep | 9 | 1 | 2 | 27,338 | 34,226 | 23,368 |
| Oct (to 27th) | 2 | 0 | 5 | 2,280 | 0 | 53,453 |
| **Total** | **774** | **85** | **81** | **4,102,321** | **10,473,978** | **2,359,731** |

Shares: uploads 82.3% / 9.0% / 8.6%; views 24.2% / 61.8% / 13.9%. Average upload date of
the Shorts in this window is 1 March 2026 (mean age 7.9 months); of the sets, 30 May 2026
(4.9 months) — so the comparison favours the Shorts. The July "Other" spike is one release video (Odd Mob, Walker & Royce,
Benni Ola – Can't Say Nah | DJing at 70MPH, 666,861, premiered 30 Jul 2026).

### 4.4 EDC Las Vegas trailers by edition

| Edition | Video | Published | Views |
|---|---|---|---|
| 2010 | 9u-vmk9iapQ | 10 May 2010 | 3,628,718 |
| 2011 | jMDd-V4zxI4 | 18 May 2011 | 2,549,182 |
| 2012 | GRs7a-wDlno | 3 Jun 2012 | 3,002,430 |
| 2013 | e-PRse6jsiE | 29 May 2013 | 1,588,139 |
| 2015 | vu4dsCtsocE | 4 May 2015 | 2,516,088 |
| 2016 | Zo47D-ZeMmI | 28 Apr 2016 | 2,730,852 |
| 2017 | LzuHNfzdx4I | 6 Apr 2017 | 1,657,449 |
| 2019 | GKKQuG9baDg | 24 Sep 2018 | 2,315,484 |
| 2020 | EChd8F4mw_g | 16 Sep 2019 | 2,032,610 |
| 2021 | id24zen_IJE | 5 Aug 2021 | 895,745 |
| 2022 | FWRVUoKKfaE | 12 Apr 2022 | 125,347 |
| 2023 | Nq0djQjBk4M | 3 May 2023 | 164,715 |
| 2024 | 3f-xarogbT4 | 28 Sep 2023 | 200,936 |
| 2025 | d4XUm5Ul2gc | 10 Oct 2024 | 192,967 |
| 2026 | -aLQdaOX5Z0 | 17 Feb 2026 | 106,458 |

Rule: the highest-viewed EDC LV upload titled "trailer" naming that edition's year,
excluding livestream, Camp EDC, EDC Week and Hotel trailers. 2014 and 2018 have no titled
trailer (the announcements drew 3.22M and 1.35M). The 2026 lineup-reveal stream (226,601)
and EDC Mexico 2026 trailer (331,703) both out-drew the 2026 LV trailer.

### 4.5 EDC Las Vegas 2026 sets on Insomniac's channel (79)

Rule: full set, published 2026, title contains "EDC Las Vegas 2026" or "EDC 2026", excluding
the lineup-reveal stream and the two "EDC Afters" live streams. n = 79, total 10,072,480,
median 69,407, p25 22,671, p75 164,314, 73 ≥ 10K, 28 ≥ 100K, 4 ≥ 500K.

By stage (from the description): kineticFIELD **15, median 291,036** (v1: 16 / 282,627 — §0.1), 10 ≥ 100K · circuitGROUNDS
5, 124,794, 4 · cosmicMEADOW 13, 100,661, 7 · quantumVALLEY 18, 75,236, 6 · bassPOD 18,
37,239, 1 · bionicJUNGLE 9, 13,495, 0 · no stage named 1 (Sarah De Warren, 23,710).

All 79, views to 28 Oct (KF kineticFIELD · CG circuitGROUNDS · CM cosmicMEADOW · QV
quantumVALLEY · BP bassPOD · BJ bionicJUNGLE): Solomun CG 650,221 · The Chainsmokers KF
610,274 · Porter Robinson KF 555,549 · Hardwell KF 553,437 · Subtronics KF 492,919 ·
Underworld CM 470,977 · Kaskade KF 442,184 · KREAM QV 309,682 · Griz B2B Wooli KF 298,592 ·
Steve Aoki KF 295,659 · Korolova KF 291,036 · Seven Lions CM 285,265 · Mathame QV 281,160 ·
Funk Tribu KF 274,217 · Meduza³ CM 262,006 · Tinlicker (DJ Set) QV 216,103 · Cosmic Gate QV
212,092 · San Holo CM 174,871 · Alison Wonderland CM 168,025 · Gareth Emery QV 164,314 ·
Innellea QV 144,517 · DJ Gigola B2B MCR-T CM 141,580 · Layton Giordani KF 139,517 · Wooli CG
134,339 · Whethan BP 126,453 · LEVEL UP CG 124,794 · RØZ CG 104,946 · Westend CM 100,661 ·
Andrew Rayel QV 93,131 · Billy Gillies QV 90,924 · Eli & Fur QV 88,936 · Laidback Luke B2B
Chuckie KF 87,376 · VTSS (In The Round) CM 86,896 · Walker & Royce B2B VNSSA CM 85,061 ·
Frost Children CM 84,539 · Eptic B2B Space Laces BP 83,247 · Getter BP 74,631 · Virtual Riot
BP 74,138 · HOL! BP 72,797 · HAYLA KF 69,407 · Ilan Bluestone QV 61,536 · Darren Porter QV
61,260 · Robert Hood BJ 57,153 · Infekt B2B Samplifire BP 55,803 · Boogie T B2B Distinct
Motive BP 52,095 · Pegassi QV 49,980 · ÆON:MODE BP 48,521 · Tiga BJ 47,921 · Darude QV 47,788 ·
GHENGAR BP 40,477 · Ship Wrek KF 34,690 · ALPHA 9 QV 34,226 · Muzz BP 34,001 · Avello B2B
Dennett BP 29,183 · AHEE B2B Liquid Stranger BP 24,942 · Sarah De Warren 23,710 · GorillaT BP
23,653 · Mary Droppinz BP 23,616 · Sippy BP 22,736 · EAZYBAKED BP 22,671 · SUPERSTRINGS QV
21,522 · T78 QV 21,296 · Gravagerz CM 21,180 · Chris Metcalfe QV 18,780 · Jackie Hollander CM
18,654 · DJ Mandy CG 17,792 · Nostalgix CM 17,038 · AR/CO KF 14,386 · ISAbella BJ 14,099 ·
Club Angel BJ 14,028 · KinAhau BJ 13,495 · BAUGRUPPE90 BJ 13,100 · Alves BJ 12,843 · The
Carry Nation BJ 9,112 · Stacy Christine BJ 8,744 · Nightstalker with MC Dino BP 8,070 ·
Fallen with MC Dino BP 7,978 · Matty Ralph QV 4,698 · Trace KF 3,230.

Publication lag after the festival's last day (17 May), by Pacific calendar date, over the
79: ≤ 7 days **50** · 8–14 days 14 · 15–30 days 9 · > 30 days 6. By date: 17 May 1 · 19 May 6 ·
20 May 12 · 21 May 8 · 22 May 13 · 23 May 7 · 24 May 3 · 25 May 6 · 26 May 4 · 27 May 2 ·
28 May 2 · 1–4 Jun 9 · 17 Jun 3 · 2 Jul 1 · 21 Jul 1 · 9 Sep 1. (v1's 48/17/9/6 over 80 is
withdrawn — §0.1.) Two of the 79 were Premieres (Alison Wonderland, 26 May; Mary Droppinz,
3 Jun).

**Comparison sets.** EDC LV 2025 on Insomniac's channel: 8 sets, median 20,792, total
317,105 (ALOK 157,909 · Alignment 60,451 · Armand Van Helden 45,056 · Carlita 36,377 ·
Annicka 5,206 · TOKiMONSTA 5,184 · LF SYSTEM 3,592 · Masha Mar 3,330), published June–August
2025, ~16 months old. EDC LV 2022 stage mixes: 9, median 9,334. Zombie Apocalypse 2026: 5
sets (Zomboy 117,128 · Sullivan King 91,876 · Avello 24,148 · Skull Machine 22,143 · YDG
21,851).

### 4.6 Ratio to stage median (top ten)

Solomun 5.21 · Underworld 4.68 · Robert Hood 4.24 · KREAM 4.12 · Mathame 3.74 · Tiga 3.55 ·
Whethan 3.40 · Tinlicker 2.87 · Seven Lions 2.83 · Cosmic Gate 2.82. Genre assigned by us:
techno/house/trance — Solomun, Underworld, Robert Hood, KREAM, Mathame, Tiga, Tinlicker,
Cosmic Gate (8); bass — Whethan, Seven Lions (2). Bottom: Trace 0.01, AR/CO 0.05, Matty
Ralph 0.06, Ship Wrek 0.12, DJ Mandy 0.14 (early-day slots, by inference only).

### 4.7 Who hosts the sets

**"Insomniac Events Live"** (`PLtZ1Nsu2D5r1xVEcO8vBjQuv4j40OvkEc`, on Home, 84 items, 83
readable). Each watch page read for owner, date and views:

| | Sets | Views | Median | ≥ 1M | ≥ 100K |
|---|---|---|---|---|---|
| All | 83 | 46,912,716 | 209,099 | 12 | 59 |
| On artist channels (63 channels) | 75 | 45,618,255 | | | |
| On Insomniac's channel | 8 | 1,294,461 | | | |
| Published 2025 (52 artist channels) | 55 | 18,693,911 | 165,113 | | |
| Published 2023–24 | 21 | | 575,687 | | |

Events: EDC LV 55 · EDC Orlando 5 · Beyond Wonderland 6 · Escape 5 · EDC Mexico 3 · HARD 2 ·
other 7. Largest: Tiësto EDC LV 2023 (yU4yrbUQYlU) 6.63M · Tiësto 2025 (wFl_ttYwixk) 3.40M ·
Armin van Buuren 2023 3.38M · Dom Dolla 2024 2.74M · FISHER EDC Orlando 2024 2.40M · Martin
Garrix 2024 2.38M · Alok EDC Orlando 2023 1.62M · Above & Beyond 2023 1.61M · Subtronics B2B
John Summit 2023 1.61M · Alesso 2025 1.23M · FISHER 2025 1.17M · James Hype 2025 1.04M.

**2026 full-set playlist** (`PLtZ1Nsu2D5r1crrp2eYh9RTuQRdwJ-XtA`, 64 items, 63 readable).
Each watch page read: 61 carry a Collaboration credit ("Insomniac and The Chainsmokers",
"Insomniac and Solomun (Official)"); not credited: Fallen with MC Dino, Darude. Descriptions
with ≥ 3 timestamps: 2. Mentioning "tracklist": 1. Two items aren't in Insomniac's uploads
(`NNKJh_xbAQs`, `IkcYzXMqHwk`) — likely artist-hosted collaborations.

**2026 sets hosted by the artist with Insomniac as collaborator.** Found with 24 YouTube
searches (12 phrasings, with and without the video filter), keeping results whose owner
line names Insomniac and whose title has EDC and 2026. A floor, not a census: 11 videos,
7,203,206 views — Tiësto (kG0SVvz9e-g) 2,209,088 · Charlotte de Witte (is834eCbUD4)
1,304,784 · Armin van Buuren (n-MhD_TdzN4) 1,281,222 · Above & Beyond (OI02QgEA1Zw) 992,537 ·
DABIN 388,863 · Lilly Palmer 370,869 · Sub Focus 249,336 · Levity 178,458 · 1991 140,069 ·
Black Tiger Sex Machine 71,914 · HEYZ 16,066.

**Not found as an official upload** (searches of 28 Oct): John Summit and Martin Garrix at
EDC LV 2026. Fan recordings: John Summit (RaveWithBee) 48,117; Martin Garrix (DerekD2)
54,081. An official upload elsewhere, or a deliberate choice not to publish, can't be ruled
out; the deck words this as "we found no official upload".

### 4.8 2026 by event

| Event | Long-form uploads, 2026 |
|---|---|
| EDC Las Vegas | 78–79 sets · lineup-reveal stream (226,601) · trailer (106,458) · Day 1–3 recaps · aftermovie (131,520) · Camp EDC aftermovie · 3 editorial · 1 performance clip |
| Zombie Apocalypse | 5 sets · trailer (51,576) |
| EDC Mexico | trailer (331,703) |
| Beyond Wonderland SoCal | aftermovie (6,820) |
| Beyond Wonderland at The Gorge | aftermovie (6,902) |
| EDC Korea | trailer (14,594) |
| EDC Colombia | trailer (19,059), aftermovie (14,687) |
| Day Trip SoCal | aftermovie (4,969) |
| Wasteland SoCal | trailer (3,072) |
| EDC Orlando | trailer (17,262) |
| Nocturnal Wonderland | aftermovie (6,106) |
| EDC Thailand | trailer (7,411) |
| Dreamstate SoCal | trailer (6,678) |
| Escape Psycho Circus | trailer (9,466) |

Twelve events after EDC LV and Zombie Apocalypse; none with sets on Insomniac's channel.
Whether they were filmed, and who holds the rights, is not visible publicly. Uploads per month 2026:
Jan 87 · Feb 81 · Mar 87 · Apr 60 · May 147 · Jun 71 · Jul 66 · Aug 43 · Sep 12 · Oct 7.

### 4.11 The autumn, like for like

Uploads 1 September – 27 October:

| Year | All | Shorts | Everything else |
|---|---|---|---|
| 2023 | 27 | 2 | 25 |
| 2024 | 48 | 24 | 24 |
| 2025 | 135 | 115 | 20 |
| 2026 | **19** | 11 | 8 |

Monthly uploads (Shorts in brackets): 2025 Jan 28 (12) · Feb 38 (16) · Mar 33 (22) · Apr 41 (30)
· May 28 (18) · Jun 45 (23) · Jul 35 (22) · Aug 37 (20) · **Sep 53 (42) · Oct 94 (83) · Nov 95 (82) ·
Dec 90 (85)**; 2026 Jan 87 (84) · Feb 81 (76) · Mar 87 (84) · Apr 60 (52) · May 147 (72) · Jun 71
(50) · Jul 66 (53) · Aug 43 (42) · **Sep 12 (9) · Oct 7 (2)**. A high-volume Shorts run began in
September 2025 and ended in August 2026; output is now near 2023–24 levels. Long-form in the
autumn window is lower than any of the three prior years (8 vs 20–25). Upload counts describe
publishing, not audience demand; no claim is made about what the drop means.

### 4.12 YouTube's native tools — observed

Read from the live pages, 28 October 2026 (watch-page player and initial data).

**Insomniac TV** (`VJrd9doSRwA`). `isLiveNow: true` since 2026-05-20 01:21 UTC (created
12 May); live chat rendered; viewer count hidden. Description: "Thanks for checking out our
Station! Enjoy live sets from festivals like EDC Las Vegas, Zombie Apocalypse, and more!" No
chapters or published schedule. First shelf on Home. An earlier station, "🔴InsomniacTV •
Livestreams + Live Sets • Music 24/7" (`aKeSNC8Fmv8`, 2023), is offline ("This live event will
begin in a few moments"). Playlist "Insomniac TV" (`PLtZ1Nsu2D5r2g4kFFU2ugcDTIGOAbOJ9f`): 842
videos, 741 views, last updated 12 Oct 2025; the first items are 2021–22 Dreamstate Artist
Series streams. What the current station plays, and how often it rotates, is **not public**.

**Afterparties.** Live tab, top two items: "EDC Afters Live With Kaskade | Day One"
(`kc9_A3goOAQ`, 17 May 00:50–01:54 UTC, 1:04:30) and "EDC Afters Live With Armin van Buuren |
Day Two" (`V2aW4hTOqws`, 18 May 00:50–01:49 UTC, 59:25). Description of each: "Join the
Afterparty!"; view counts hidden. The Premium tier itself isn't visible in the public page
data; the identification as YouTube Premium afterparties rests on the Live-tab screenshot
supplied with the brief and on YouTube Help, which defines afterparties as "Premium-exclusive
live streams with artists", available wherever Premium is (support.google.com/youtube/answer/10184580).
Hosting requirements are not published; the deck says to confirm per event with the partner team.

**Live streams.** Live tab also holds the EDC LV lineup-reveal streams: 2024 (`7cKrdpErlwc`)
240K · 2025 (`Rfect811u2c`) 170K · 2026 (`TzpqoarmmH4`) 226,601. The 15–17 May 2026 festival
streams ran on Insomniac's channel (YouTube blog, 14 May 2026: six feeds a day, multiview) but
are not among the public uploads today.

**Premieres.** Since October 2025: EDC LV 2026 trailer (premiered 17 Feb), Odd Mob, Walker &
Royce, Benni Ola – Can't Say Nah (`Gqtwmsrk0qw`, premiered 30 Jul, 666,861 — the largest 2026
upload outside the sets), Alison Wonderland and Mary Droppinz EDC sets. 2 of 79 EDC sets; none
of the 5 Zombie Apocalypse sets. Whether the Premiere helped the Odd Mob release is not
knowable from public data and is not claimed.

**Collaborations.** §4.7: 61 of 63 sets in the 2026 playlist; ≥ 11 artist-hosted 2026 sets
credit Insomniac.

**Live Redirect, end screens, cards, Shorts related-video links.** Not exposed publicly. Four
Shorts were read (`ouihpBTPAUk`, `umrLzbs1POE`, `kzwSgzaB64k`, `aTEIaNNqGCM`): no linked video
appears in the desktop page data (the only other video ID on one was its music attribution),
but the desktop page does not reliably carry the related-video link, so **no feature is said to
be unused**. Live Redirect rules (YouTube Help, answer 10359590): channels with more than 1,000
subscribers and no Community Guidelines strikes; redirecting to another channel needs that
channel's permission in Studio; Premieres can redirect too.

**Reference — Metallica TV** (`1fz60gNnSdU`, Metallica's channel). Live since 6 Mar 2026
22:31 UTC (created 2 Mar), live chat rendered, "108 watching now" at 11:5x UTC 28 Oct. Its
description, verbatim in part: "Music videos. Live cuts. Full concerts… A continuous stream of
Metallica across eras and tours… Live chat's open for anyone who wants to argue about setlists
in real time." No chapters or schedule visible. Loaded in a browser from the UK (GL=GB), the
player status was OK and the page named the item then playing — "Metallica: Devil's Dance
(Tuktoyaktuk, Canada - September 3, 1995)" — a live cut, consistent with the description.
Whether Insomniac TV shows a now-playing label could not be confirmed (the page didn't render
it in our browser). The deck claims only these features. (A raw page-data request returned
"Video unavailable"; the browser load played normally.)

**What is already partly in place**, so the deck builds on it rather than proposing it:
always-on station (Insomniac TV); Afterparties (two in 2026); Premieres (trailer, a release,
two sets); Collaborations (61/63); lineup-reveal streams (three years); festival set playlists
(EDC LV 2015–19, 2024, 2026; Zombie Apocalypse 2026, 5).

### 4.9 Shorts, 1 October 2025 → 27 October 2026

774 Shorts, 13.8 a week. Median 3,259; p25 1,774; p75 6,288. Under 2K 247 · 2–5K 256 ·
5–10K 183 · 10–100K 87 · ≥ 100K 1. Largest: "we're on another world with gesaffelstein"
(kzwSgzaB64k, Oct 2025) 284,242 · "we miss you all already" 34,094 · "you can take the purse,
just not the usb" 30,107 · "it's a sara landry take over at edc" 29,505 · "EDC Las Vegas
streams live only on @YouTube" 28,999 · "@OfficialSubtronics iconic tbh" 25,493.

### 4.10 Channel organisation

**Home (28 Oct):** Insomniac TV (`VJrd9doSRwA`, `isLiveNow: true`, live since 2026-05-20
01:21 UTC; description "Enjoy live sets from festivals like EDC Las Vegas, Zombie
Apocalypse, and more!") · EDC Las Vegas 2026 Full Sets · For You · Electric Daisy Carnival ·
Shorts · Insomniac Events Live. Channel tabs: Home, Videos, Shorts, Live, Shows (Golf Cart
Confessions), Podcasts (empty), Playlists, Posts, Store.

**EDC 2026 sets missing from the 2026 full-set playlist (18):** Meduza³ 262,006 · Whethan
126,453 · Andrew Rayel 93,131 · VTSS 86,896 · Walker & Royce B2B VNSSA 85,061 · HOL! 72,797 ·
Robert Hood 57,153 · Pegassi 49,980 · Tiga 47,921 · AHEE B2B Liquid Stranger 24,942 · Sarah De
Warren 23,710 · Mary Droppinz 23,616 · Sippy 22,736 · Chris Metcalfe 18,780 · Club Angel
14,028 · Nightstalker with MC Dino 8,070 · Matty Ralph 4,698 · Trace 3,230.

**Playlists (108):** largest — Insomniac TV 842 · Night Owl Radio 310 · Rave-A-Thon 191 ·
Bassrush Records 159 · Insomniac Events Trailers 155 (and a second with 128) · Lost In Dreams
Records 124 · Track of the Day 114 · Insomniac Records: NEW MUSIC 103 · Insomniac Events Live
84 · Golf Cart Confessions 82 · Park N' Rave 73 · Factory 93 Recordings 69 · EDC Las Vegas 2026
Full Sets 64 · Basscon Records 59 · EDC Las Vegas 2024 Live Sets 55. Plus 16 "EDC 20-Year
Playlist Series" (1997–2012), festival playlists, label imprints. No playlist by stage,
genre or artist.

**Night Owl Radio:** 368 episodes on the channel, 4 Sep 2018 → 23 Sep 2025 (#524); per year
2018 16 · 2019 55 · 2020 52 · 2021 25 · 2022 80 · 2023 51 · 2024 49 · 2025 40; median 2,472,
none ≥ 100K. Podcast feed lists #582 (10 Oct), #583 (17 Oct), #584 (24 Oct 2026): the show
continues weekly off YouTube.

**Releases:** per year 2018 172 · 2019 66 · 2020 57 · 2021 25 · 2022 50 · 2023 58 · 2024 25 ·
2025 46 · 2026 14 (last 21 Aug 2026). 2024–25: 71, median 59,753, 28 ≥ 100K. Title format
changed in November 2025 from "| Insomniac Records" to "(Official)". 2026 releases median
8,093 at 2–9 months old (not compared with 2025 on totals: ages differ). Most consistent
artists since 2022 (≥ 3 releases, median): Odd Mob 11 releases, 101,313 · HUGEL 7, 105,827 ·
HoneyLuv 4, 106,460 · Biscits 5, 119,207 · CID 3, 175,878. No separate Insomniac Records
YouTube channel was found (`@insomniacrecords` 404; `@insomniacrecs` is an unrelated
28-subscriber channel).

---

## 5. Every claim on the deck (v2), with its arithmetic

**5.1 Cover / slide 2 — "195.2M views · 722K subscribers · 4,171 uploads, every one read ·
1,125 Shorts, 774 since October 2025"; "three eras"; "2026 alone is already the best year
since 2020".** §1, §2.1, §4.1. 2026 uploads 15,156,857 vs 2023 15,037,286. **Challenge:**
"best year" ranks years by the lifetime views of that year's uploads; 2026's are the youngest,
so if anything this understates 2026. YouTube's counter reads 4,169 (§0.1).

**5.2 Slide 3 — "Trailers built the channel. Today the sets do the heavy lifting"; shares
38.7 / 24.3 / 17.9 / 7.9 / 3.3%; "1.6–3.6M for every edition to 2020; since 2022, 110–200K";
"a change in the trailer's role on YouTube, not a verdict on the marketing".** §4.2, §4.4.
2021 (896K) sits between and is not quoted. **Challenge:** lifetime totals favour old trailers;
the 2023 trailer has had 3.5 years and sits at 165K, so age alone doesn't explain the gap — but
nothing public says why. The slide doesn't say.

**5.3 Slide 4 — "Full sets: 9% of the uploads, 62% of the views": 940 uploads since 1 Oct
2025; Shorts 82% / 24%; sets 9% / 62%; typical Short 3.3K, typical set 69K; 30 sets past
100K; "the two do different jobs".** §4.3. 85 sets / 940 = 9.0%; 10,473,978 / 16,936,030 =
61.8%. 30 ≥ 100K = 28 EDC + Zomboy (117,128) + Kaskade at Sunsoaked 2025 (124,354, uploaded
June 2026). Mean age: Shorts 7.9 months, sets 4.9 — the comparison favours Shorts.

**5.4 Slide 5 — "79 sets · 10.1M views in five months · typical 69K · 28 over 100K · 2/3 of
all views on the channel's 2026 uploads · 50 within a week, 79 by September · EDC 2025 on the
channel 8 sets, typical 21K after 16 months · Zombie Apocalypse 5 sets"; "the festival
streamed live on Insomniac's channel, 15–17 May — six feeds a day, multiview for the first
time"; "most of them credited jointly".** §4.5, §4.7, YouTube blog (14 May 2026). 10,072,480 /
15,156,857 = 66.5%. "Most credited jointly": 61 of the 63 readable playlist items; the 16
outside the playlist were not read for credits, so ≥ 61 of 79 (77%). **Challenge:** 2025 vs
2026 isn't like for like (2025's big sets went to artist channels); the slide says so.

**5.5 Slide 6 — "46.9M views on the 83 performances in Insomniac's Insomniac Events Live
playlist"; "75 on 63 artist channels · 45.6M; 8 on Insomniac's own · 1.3M"; "twelve past a
million; 2025 alone 55 sets on 52 channels, 18.7M"; "61 of 63 sets carry both names"; "at
least 11 more, 7.2M views"; "a curated selection … not a like-for-like comparison … separate
from the channel's own 195.2M, never added to them".** §4.7. 45,618,255 + 1,294,461 =
46,912,716. Bar: 45.6 / 46.9 = 97.2%. **Challenge:** the playlist is Insomniac's own selection;
the 2026 artist-hosted count is a search floor. Neither is used as a scorecard. "Both routes
now credit both sides" refers to 2026 only; whether 2025's artist uploads credited Insomniac
wasn't checked.

**5.6 Slide 7 — stage medians (kineticFIELD 15 sets, 291K … bionicJUNGLE 13K); "some sets
beat their stage by four or five times"; "Solomun, Underworld and Robert Hood each drew four
to five times their stage's typical set"; "most of the ten lean techno, house or trance — a
pattern worth investigating, not a reason to favour a genre".** §4.5, §4.6, §0.1. Ratios
5.21 / 4.68 / 4.24.

**5.7 Slide 8 — "774 on-brand Shorts in thirteen months, a typical one reaching 3.3K and 88
past 10K"; "the biggest by far was a moment from a set — Gesaffelstein, 284K".** §4.9.

**5.8 Slide 9 — "EDC gets the full cycle. The rest of the calendar is the opportunity";
"lineup-reveal stream in February (227K)"; "Twelve other 2026 events … a trailer or an
aftermovie"; "19 uploads in September–October, against 135 a year earlier; nearly all of the
difference is Shorts (115 then, 11 now); output back near 2023–24 levels; a publishing rhythm,
not a measure of demand".** §4.8, §4.11. 135 − 19 = 116; Shorts 115 − 11 = 104 (90% of it).

**5.9 Slide 10 — "18 of the 79 EDC 2026 sets aren't in the 2026 full-set playlist"; "2 of 63
sets have a tracklist or timestamps"; "Night Owl Radio stops at episode 524"; "108 public
playlists — EDC set playlists by year …".** §4.7, §4.10, §4.12. Shorts link: "none visible on
the ones we sampled, but the public page doesn't reliably show it" (§4.12).

**5.10 Slide 11 — five strengths.** 01 sets (slide 5) · 02 "46.9M views on 83 curated
performances, most on artists' channels" (slide 6) · 03 Insomniac TV live since 20 May (§4.12)
· 04 "Lineup-reveal streams three years running (170–240K), the festival live on YouTube, and
EDC Afters with Kaskade and Armin van Buuren" (§4.12) · 05 archive: 1,092 lockdown livestreams,
47.1M (§4.2).

**5.11 Slide 12 — native tools.** Every "Already" line is in §4.12. "An 842-video Insomniac TV
playlist holds the archive": the playlist exists and holds livestream-era sets; what the live
station actually plays is not public, and the slide quotes the station's own description for
that. Odd Mob "667K, the year's biggest upload outside the sets": 666,861, the largest 2026
non-set upload (§4.3 note). Metallica TV: only the features listed in §4.12. Afterparty and
Live Redirect rules: YouTube Help, cited on the slide.

**5.12 Slide 13 — double down / optimise / experiment.** Evidence lines repeat 5.4–5.9.
"Zombie Apocalypse's 5 sets: 22–117K" (§4.5). Each item carries a measure and a Studio check;
nothing promises a number.

**5.13 Slide 14 — "10.1M views on 79 EDC 2026 sets in five months"; "46.9M on the performances
Insomniac curates from artists' channels"; "24/7 — Insomniac TV, live since 20 May".** As above.

## 6. Considered and dropped

1. **"Shorts don't work."** Shorts reach people the channel doesn't yet have; views alone
   can't judge that. Dropped for "many and rarely large", with a test.
2. **A Shorts content-type split** (artist moment / festival life / promotion) by title.
   Titles are too casual ("hold up 🫸", "✨") to classify; the split moved with every rule
   change. Dropped.
3. **"The trailer audience has collapsed because of X."** No cause is visible in public data.
   Kept as an observation with the likely reading labelled as such.
4. **"Releases are declining."** 2026 releases are younger than 2025's, and the cadence
   change may be a distribution decision. Turned into a question.
5. **"Night Owl Radio failed on YouTube."** The show continues weekly elsewhere; leaving
   YouTube at a 2.5K median may be the right call. Turned into a question.
6. **Insomniac-hosted vs artist-hosted, as a performance comparison.** The artist-hosted
   playlist is a curated selection, and the artist-led 2026 collaborations were found by
   search. Kept as a description of the model, not a scorecard.
7. **Momentum around events.** No snapshot history exists (§1). The event-lifecycle slide
   describes publishing, not viewing over time.
8. **Lockdown archive as a resurfacing play.** 1,092 sets, 47.1M views, already organised
   in playlists (Insomniac TV 842, Rave-A-Thon 191, Park N' Rave 73) and plausibly what
   feeds the Insomniac TV station. No public evidence of what it does today, so it stays a
   strength rather than a recommendation.
9. **Engagement rate by format** (likes per 1,000 views). Not comparable across formats of
   very different lengths; kept only in §4.2.

**Rejected or withdrawn in the v2 pass**

10. **"Trailer audiences moved to other platforms."** Withdrawn from slide and Analysis; no
    public evidence of where they went (§0.2).
11. **"Techno, house and trance travel further than their billing"** as a headline. Ten sets,
    genre assigned by us, confounded with artist profile and slot. Demoted to "a pattern worth
    investigating" (§0.2).
12. **"The autumn slowdown is a problem."** The like-for-like comparison (§4.11) shows the end of
    a year-long Shorts push, with output back near 2023–24 levels. No claim about demand.
13. **"Launch an always-on station."** Insomniac TV already exists (§4.12); the recommendation is
    to programme it, not launch it.
14. **"Start using Afterparties / Premieres / Collaborations."** All three are already in use
    (§4.12); the recommendations build on them selectively.
15. **"Insomniac doesn't use Live Redirect / end screens / Shorts links."** Not observable
    publicly; left as Studio checks, never as gaps.
16. **Premiere effect** ("the Odd Mob release did well because it premiered"). One example; no
    comparison group. Kept only as a fact about usage.

---

## 7. Needs YouTube Studio

- Traffic sources for the full sets: Home, playlists, suggested, search, external.
- Whether Shorts carry a related-video link; related-link clicks; set views from Shorts.
- New vs returning viewers and subscribers gained, by format (Shorts vs sets).
- Watch time and average view duration on sets, by stage.
- Insomniac TV concurrent viewers and watch time.
- Views per viewer within the 2026 set playlist.
- How Collaboration views split between Insomniac and the artist's channel.
- End screens and cards on the sets.
- Insomniac TV: what it plays and in what order, concurrent viewers, watch time, chat activity,
  and traffic from the station to uploads — the baseline for any programming test.
- Afterparties: Premium viewers and watch time for the two EDC Afters; eligibility and
  availability for future events (YouTube partner team).
- Premieres vs uploads without one: first-week views and watch time for the two premiered
  EDC sets against comparable same-stage sets.
- Live Redirect history, if any, from the festival streams.
- Collaboration split for the artist-hosted 2026 sets (views attributed to Insomniac).

## 8. The places I think this is weakest

1. **The genre read (slide 7).** Ten sets, genres assigned by us, stage confounded with
   billing.
2. **"Trailer audiences moved."** The most quotable line, and the least proven.
3. **The artist-hosted 2026 count** is a search floor; a full census would need each
   artist's uploads or Insomniac's Studio.
4. **The autumn slowdown** (19 uploads in Sep–Oct) may be seasonal: there is no 2025
   comparison without snapshots of what was planned. October 2025 had 94 uploads, so it is
   at least unlike last year.
5. **Classification edges:** the Wasteland misfire (§2.2); "Other" since 2022 (74 uploads).
6. **v1 counting errors.** kineticFIELD (16 → 15), lag base (80 → 79), live count (195 → 73)
   and the 4,169/4,171 explanation were wrong in v1 (§0.1). They didn't move a headline, but
   they argue for re-deriving any figure before quoting it outside the deck.
7. **Afterparty identification** rests on the Live-tab screenshot supplied with the brief and
   YouTube's definition; the Premium gate isn't visible in public page data.

## 9. Questions for the reviewer, in priority order

1. Trace 5.5. Does slide 6 imply Insomniac-hosted sets "beat" artist-hosted ones, or add the
   playlist's 46.9M to the channel's 195.2M anywhere? It shouldn't.
2. Trace 5.2. Is "a change in the trailer's role" fair given lifetime totals?
3. Read slide 12 as Insomniac's team would. Does anything recommend launching something they
   already run?
4. Is "the full-set model at two or three more events, where filming and rights allow"
   proportionate, given filming, rights and artist approvals may sit outside the YouTube team?
5. Read slides 4, 8 and 13 as Insomniac's social team would. Do they read as criticism of
   their Shorts work?

### Questions for the Insomniac team (from the Analysis sheet)

- **Releases.** Insomniac Records uploads: 46 in 2025, 14 in 2026, none since 21 August. Has
  release video moved elsewhere?
- **Night Owl Radio.** Off the channel since #524 (September 2025), median 2.5K here; still
  weekly on podcast platforms (#584). A deliberate call?
- **Headliner sets.** No official 2026 upload found for some headliners (John Summit, Martin
  Garrix). Rights, artist choice — or an opening?
- **Other events.** Were 2026's other flagships filmed, and on what terms?

---

## 10. Content Support & Cadence Audit

**Investigation only (28 October 2026, v3).** Nothing in the deck has changed yet. §10.8 says
which findings deserve a place there.

### 10.1 Method and limitations

- **Cadence.** All 4,171 uploads, bucketed into Monday-starting UTC weeks. Classes: Shorts
  (verified, §2.1); full performances (full sets, livestream archives, hidden-count live
  streams); event marketing; releases; editorial and other long-form (Night Owl Radio
  separated where it matters).
- **Hero support.** 21 performances: the 16 most-watched Insomniac-hosted EDC 2026 sets
  (Tinlicker excluded to make room), Whethan, Zomboy, and the four largest artist-hosted 2026
  collaborations. For each one:
  - the whole catalogue was searched from 1 Oct 2025 for the artist's name, alternate
    spellings and @handle, in titles and the first 300 characters of descriptions;
  - the watch page was read for the full description, chapters, end-screen elements, info
    cards, Collaboration credit and owner;
  - its membership was checked in the 2026 set playlist (64 items), Insomniac Events Live
    (84) and Zombie Apocalypse Live Sets (5).
- **All 79 EDC sets** were then read the same way for chapters, tracklists, end screens,
  credits and title format.
- **Limits.**
  - A Short that features an artist without naming them is invisible to a title and
    description search. "No named Short" means **none identifiable**, not none at all.
  - Shorts related-video links, traffic, end-screen and card click-through, and watch time are
    Studio-only. No feature is called absent because public data can't show it.
  - End screens and info cards *are* in the public player data. The only card on every page
    read (including the artist-hosted ones) is YouTube's generic "View corrections" element;
    no creator-added info cards were observed.

### 10.2 Weekly cadence

| Calendar year | Uploads | Active weeks | Zero weeks | Median / week | Busiest week | Longest gap, any upload |
|---|---|---|---|---|---|---|
| 2024 | 232 | 53 / 53 | 0 | 4 | 12 | 8.9 days |
| 2025 | 617 | 53 / 53 | 0 | 9 | 24 | 7.9 days |
| 2026 to 27 Oct | 661 | 41 / 44 | **3** | 16 | 71 (EDC week + 1) | **19.7 days** (23 Sep → 13 Oct) |

The longest gap in each earlier year: 2019 9.9 · 2020 8.5 · 2021 10.9 · 2022 13.0 · 2023 9.7 days.
**The autumn 2026 gap is the longest on the channel since at least 2019.**

By class (zero weeks / weeks in range; median per week):

| Class | 2024 | 2025 | 2026 to 27 Oct |
|---|---|---|---|
| Shorts | 84 · 20/53 empty · median 1 | 455 · 2/53 · 6 | 524 · 4/44 · 13 |
| Full performances | 1 · 52/53 empty | 8 · 49/53 | 88 · 34/44 (all in 10 weeks) |
| Event marketing | 29 · 30/53 · 0 | 41 · 27/53 · 0 | 21 · 31/44 · 0 |
| Releases | 25 · 32/53 · 0 | 46 · 19/53 · 1 | 14 · 30/44 · 0 |
| Editorial and other long-form | 93 (49 Night Owl Radio) · 14/53 | 67 (40 NOR) · 3/53 · 1 | 14 (0 NOR) · 30/44 · 0 |

**The Shorts programme.**
- From the week of 6 Oct 2025 to the week of 30 Mar 2026: **19 Shorts every week, 26 weeks
  running**, on fixed hourly slots (17:00, 19:00 and 21:00 UTC most often).
- The weekly pattern was three a day Monday to Wednesday, four on Friday and Saturday, two on
  Sunday, and none on Thursdays.
- After that: 10 a week through April and early May; 29 in EDC week; 4–17 a week in
  June–July; 3–14 in August; 1–4 in September.
- Then **no Shorts at all from 22 Sep to 26 Oct (35 days)**.

**Around EDC (5½ weeks before, the festival, 4 weeks after):**

| | Before | During | After |
|---|---|---|---|
| 2025 (EDC 16–18 May) | 47 uploads · 34 Shorts · long-form: 6 NOR, 6 releases, 1 promo | 0 | 30 · 13 Shorts · 2 sets, 6 promo, 5 NOR, 3 releases |
| 2026 (EDC 15–17 May) | 66 · 59 Shorts · 3 editorial, 3 releases | 33 · 28 Shorts · 2 Afters, 1 set, 2 promo | 118 · 38 Shorts · **72 sets**, 4 promo, 2 editorial |

**Answer to the brief's question.**
- The channel ran a **highly consistent, scheduled Shorts programme** from October 2025 to
  March 2026, then a festival-driven summer.
- Long-form has never had a year-round baseline outside events, apart from Night Owl Radio,
  which ran weekly until September 2025.
- In 2026, long-form outside the sets is 49 uploads in 43 weeks: event marketing 21, releases
  14, editorial 14. Each class has 30–31 empty weeks.
- The Sep–Oct 2026 slowdown **is exceptional** in continuity: three empty weeks, a 35-day Shorts
  pause and the longest silence since 2019. In total volume it is only back near 2023–24
  levels.
- It ended with the *30 Years of EDC* documentary (26 Oct), so a planned pause around that
  release is plausible. That is a question for the team, not a finding.

### 10.3 Hero asset support matrix

Views are lifetime to 28 Oct. "Named Shorts" are Shorts naming the artist since 1 Oct 2025,
with dates. Abbreviations: KF kineticFIELD · CM cosmicMEADOW · CG circuitGROUNDS · QV
quantumVALLEY · BP bassPOD. "End screen ✓" means channel + "EDC Las Vegas 2026 Full Sets" +
the artist's channel. "Collab ✓" means the YouTube Collaboration credit.

| Hero asset | Views | Supporting Shorts (named) | Other support assets | Playlist status | Metadata | Confirmed gaps | Studio checks | Recommended action |
|---|---|---|---|---|---|---|---|---|
| [Solomun · CG](https://youtu.be/g1vH9C_o-vo) | 650K | **None.** The set is the only upload on the channel that names Solomun | — | 2026 ✓ | Standard description, no @handle; no chapters; end screen ✓; collab ✓ | No identifiable Short for the channel's #1 set; no chapters | Shorts featuring him unnamed? Traffic sources | 2–3 set-moment Shorts linked to the set; chapters |
| [The Chainsmokers · KF](https://youtu.be/3AQ_Srbe1lQ) | 610K | 17 May ([2.7K](https://youtu.be/WvZYjQkZMIk)); 23 May, **same day as the set** ([10.5K](https://youtu.be/MBxhSe7Y6yQ)) | — | 2026 ✓ | No chapters; end screen ✓; collab ✓ | Chapters | Shorts → set link | Chapters |
| [Porter Robinson · KF](https://youtu.be/zkT8FjfBjYI) | 556K | 6 Shorts: Nov 2.5K · Mar 6.8K · 17 May [6.7K](https://youtu.be/RZ9tpIaJMR4) · 20 May [7.7K](https://youtu.be/DXVlge3WgkQ) · 18 Jun 3.7K · 13 Jul [5.1K](https://youtu.be/rMpUtBqEsNk) | — | 2026 ✓ | No chapters; end screen ✓; collab ✓ | Chapters | Shorts → set link | **Good practice**; chapters |
| [Hardwell · KF](https://youtu.be/UNtEX3GB6jU) | 553K | **None**, ever, on the channel | Named headliner in YouTube's livestream announcement | 2026 ✓ | **Best EDC description:** @hardwell, 1001Tracklists link, artist links; end screen ✓; collab ✓ | No identifiable Short | As Solomun | Set-moment Shorts; turn the 1001Tracklists list into chapters |
| [Subtronics · KF](https://youtu.be/-A-XIBMDgj0) | 493K | Dec: 2 ([1.7K](https://youtu.be/xtbhkN9OqJQ), [2.9K](https://youtu.be/IUGmdNPZRKs)); 23–25 Jun: 3 ([7.3K](https://youtu.be/dml_dpn4hfE), [25.5K](https://youtu.be/ouihpBTPAUk), [19.7K](https://youtu.be/WAcOtBYL2UI)) | [Inside The Drop ep. 2](https://youtu.be/-sncABS6AV8) (Dec, 29K) | 2026 ✓ | @handle; no chapters; end screen ✓; collab ✓ | Chapters | Shorts → set link | **Good practice** |
| [Underworld · CM](https://youtu.be/4wzyC3J6-NU) | 471K | 1, before the set: 17 May ([1.5K](https://youtu.be/KLShnQr0Ofk)) | — | 2026 ✓ | No chapters; end screen ✓; collab ✓ | Nothing after the set, despite 4.7× its stage median | — | Set-moment Shorts; chapters |
| [Kaskade · KF](https://youtu.be/l5wro3bMZWc) | 442K | 15 May [21.2K](https://youtu.be/FK47T9W_cmM) · 26 May [3.7K](https://youtu.be/WOHibVbTXYg) (ITD promo) · 30 Jun [2.3K](https://youtu.be/tuq3NKfcWVY) | [EDC Afters Live](https://youtu.be/kc9_A3goOAQ) (16 May) · ["Meet Again" live clip](https://youtu.be/J1yT2WhrrrA) (22 May, 40K) · [Inside The Drop ep. 8](https://youtu.be/Tft7mF8UsO4) (26 May, 11K) · [Sunsoaked 2025 set](https://youtu.be/sBZc8aoUFhk) (19 Jun, 124K) | 2026 ✓ | @handle; no chapters; end screen ✓; collab ✓ | Chapters | Which asset fed which | **Best practice: a full ecosystem** |
| [KREAM · QV](https://youtu.be/kM7iuhXXaZg) | 310K | **None** | — | 2026 ✓ | Artist links; no chapters; end screen ✓; collab ✓ | No identifiable Short at 4.1× its stage median | — | Set-moment Shorts; chapters |
| [Griz B2B Wooli · KF](https://youtu.be/xq-7nU66OmQ) | 299K | 10 (Wooli/GRiZ), incl. 17 May [5.9K](https://youtu.be/4B1ubYeI5Vk) · 1 Jun · 22 Jun [8.4K](https://youtu.be/QeiMzzdW2ww) · 5 Jul · 22 Aug | [Wooli solo set](https://youtu.be/PaBcY8VTZZI) (134K) | 2026 ✓ | Title off-standard: "Live at EDC 2026", without "Las Vegas" or "(Official Full Set)"; end screen ✓ (both artists) | Title | — | **Good practice**; fix the title |
| [Steve Aoki · KF](https://youtu.be/kw_C3HE6VRY) | 296K | Oct 4.4K · Nov 6.5K · 2 Jun [9.3K](https://youtu.be/SnKKbfw-fys) | [Inside The Drop ep. 9](https://youtu.be/t9PxMIOFWJM) (2 Jun) | 2026 ✓ | @handle; no chapters; end screen ✓ | Chapters | — | Good practice |
| [Korolova · KF](https://youtu.be/sl7ogG9pypM) | 291K | **None** | — | 2026 ✓ | No chapters; end screen ✓; collab ✓ | No identifiable Short | — | Set-moment Shorts |
| [Seven Lions · CM](https://youtu.be/tpteTL5ycRo) | 285K | 3 before, ≤ 1.1K each; 26 Aug [4.2K](https://youtu.be/DdAEBooh2Rk) | — | 2026 ✓ | No chapters; end screen ✓ | Chapters | — | Chapters |
| [Mathame · QV](https://youtu.be/i7PGl_PyHvI) | 281K | **None** | — | 2026 ✓ | No chapters; end screen ✓; collab ✓ | No identifiable Short at 3.7× its stage median | — | Set-moment Shorts |
| [Funk Tribu · KF](https://youtu.be/APt5j9Abwo8) | 274K | **None** | — | 2026 ✓, **plus an unlisted 38-min earlier cut ([IkcYzXMqHwk](https://youtu.be/IkcYzXMqHwk), 5.4K) at the next position** | End screen ✓ | Duplicate in the playlist | — | Remove the unlisted cut from the playlist |
| [Meduza³ · CM](https://youtu.be/W3VuzjQfWz4) | 262K | **None** since 2020 | — | **Not in the 2026 playlist**, yet its end screen promotes that playlist | End screen ✓ | Missing from the playlist | — | Add to the playlist |
| [Whethan · BP](https://youtu.be/1Q-j11Nlm4k) | 126K | **None** | — | **Not in the 2026 playlist**; end screen promotes it | End screen ✓ | Missing from the playlist | — | Add to the playlist |
| [Zomboy · Zombie Apocalypse](https://youtu.be/Jpei7G2j0EQ) | 117K | None named | — | Zombie Apocalypse Live Sets ✓ · Insomniac Events Live ✓ | **Chapters (33 timestamps)**, @handle, artist links; end screen points to the *Insomniac TV* playlist, not Zombie Apocalypse | End-screen target | — | **Good practice (metadata)**; point the end screen at the Zombie playlist |
| [Tiësto (artist-hosted)](https://youtu.be/kG0SVvz9e-g) | 2.21M | 8 since Oct 2025, e.g. 7 May [4.0K](https://youtu.be/VrsWsQoKjl0) · 28 Jul [4.1K](https://youtu.be/bEa73dG8gSE) | — | **In no Insomniac playlist** | Chapters (set list) on Tiësto's upload; Collaboration "Tiësto and Insomniac" | Not gathered by Insomniac | Collab view split | Add to Insomniac Events Live |
| [Charlotte de Witte (artist-hosted)](https://youtu.be/is834eCbUD4) | 1.31M | 19 Oct 2025 [21.5K](https://youtu.be/i7dMcPGPZJ4) · 4 Mar [11.6K](https://youtu.be/x4e57kubAvM) | — | **In no Insomniac playlist** | No chapters; collab ✓ | Not gathered | As Tiësto | Add to Events Live |
| [Armin van Buuren (artist-hosted)](https://youtu.be/n-MhD_TdzN4) | 1.28M | None named | [EDC Afters Live with Armin](https://youtu.be/V2aW4hTOqws) (17 May) | **In no Insomniac playlist** | 1001Tracklists link; collab ✓ | Not gathered | As Tiësto | Add to Events Live |
| [Above & Beyond (artist-hosted)](https://youtu.be/OI02QgEA1Zw) | 993K | Nov 2025 [1.7K](https://youtu.be/10iG_EblTWk) | — | **In no Insomniac playlist** | Chapters; "Video courtesy of Insomniac"; collab ✓ | Not gathered | As Tiësto | Add to Events Live |

**Summary of the 16 Insomniac-hosted EDC heroes:**
- **8 have no identifiable named Short**: Solomun, Hardwell, KREAM, Korolova, Mathame, Funk
  Tribu, Meduza³ and Whethan. Together that is 2.75M of the heroes' views.
- **5 have a strong support set**: Kaskade, Subtronics, Wooli/GRiZ, Porter Robinson and Steve
  Aoki.
- **0 have chapters.**
- None of the 16 was a Premiere. Only 2 of the 79 sets were: Alison Wonderland and Mary
  Droppinz.

### 10.4 Catalogue-wide checks — all 79 EDC Las Vegas 2026 sets (watch pages, 28 Oct)

| Check | Result | Detail |
|---|---|---|
| Title format "X Live at EDC Las Vegas 2026 (Official Full Set)" | **75 / 79** | Off-standard: [Griz B2B Wooli](https://youtu.be/xq-7nU66OmQ) 299K · [Cosmic Gate](https://youtu.be/EO8fj6FfCPk) 212K · [Sippy](https://youtu.be/CM80hrwF6io) 23K · [The Carry Nation](https://youtu.be/K0Qg0wqhCdY) 9K ("Live From") |
| Collaboration credit | **74 / 79** | None observed: [Robert Hood](https://youtu.be/CHoqTHETVoY) 57K · [Darude](https://youtu.be/dXBoIY65P8s) 48K · [Sarah De Warren](https://youtu.be/KIb3psOt9hI) 24K · [Chris Metcalfe](https://youtu.be/nsLTs0KG0lA) 19K · [Fallen with MC Dino](https://youtu.be/o1Wly2tbJ1c) 8K. The credit needs the artist's channel and acceptance, so this may sit on the artist's side |
| End screen with 3 elements | **71 / 79** | None: [Virtual Riot](https://youtu.be/t3UtUpatiWw) 74K · [Robert Hood](https://youtu.be/CHoqTHETVoY) 57K · [ÆON:MODE](https://youtu.be/I02YBw_-vw8) 49K · [AHEE B2B Liquid Stranger](https://youtu.be/yXHoHK_jQvc) 25K · [Stacy Christine](https://youtu.be/ROX9gE8LeIU) 9K · [Fallen with MC Dino](https://youtu.be/o1Wly2tbJ1c) 8K. Two elements: ALPHA 9, ISAbella. Three point to the Insomniac TV playlist instead of the 2026 set playlist (Laidback Luke B2B Chuckie, GHENGAR, Gareth Emery) |
| In the 2026 set playlist | **61 / 79** | 18 missing, **1,025,208 views** (10.2% of the 79's views). **16 of the 18 end on an end screen that promotes the 2026 playlist**: Meduza³ 262K · Whethan 126K · Andrew Rayel 93K · VTSS 87K · Walker & Royce B2B VNSSA 85K · HOL! 73K · Pegassi 50K · Tiga 48K · Sarah De Warren 24K · Mary Droppinz 24K · Sippy 23K · Chris Metcalfe 19K · Club Angel 14K · Nightstalker 8K · Matty Ralph 5K · Trace 3K (Robert Hood and AHEE have no end screen) |
| Playlist hygiene | 2 unlisted items in the public playlist | [IkcYzXMqHwk](https://youtu.be/IkcYzXMqHwk): a 38-min Funk Tribu cut uploaded the morning of the public 67-min set, sitting beside it · [NNKJh_xbAQs](https://youtu.be/NNKJh_xbAQs): Adventure Club, 57 min, 10.8K, unlisted, so it's not in the uploads, search or the 79 |
| Chapters | **2 / 79** | Getter, Laidback Luke B2B Chuckie. Tracklist references: 3 (those two plus Hardwell's link). For comparison: Zombie Apocalypse **3 / 5** (Zomboy, Sullivan King, Avello) |
| Artist @handle in the description's first line | 7 / 79 | e.g. Hardwell, Subtronics, Kaskade, Steve Aoki |
| Shorts descriptions linking a video | **0 / 774** (first 300 characters, since Oct 2025) | The Shorts related-video link is separate and not public (Studio) |
| Artist-hosted 2026 collaborations in an Insomniac playlist | **0 of the ≥ 11** | The 7 items Insomniac Events Live gained in 2026 are all Insomniac's own uploads (5 Zombie Apocalypse sets, Kaskade at Sunsoaked, Matty Ralph). In 2025 the same playlist gathered 55 artist-hosted sets |

### 10.5 Existing good practice

- **Consistent packaging at scale:** 75/79 standard titles, 74/79 Collaboration credits,
  71/79 full end screens that send viewers to the artist, the channel and the set playlist.
- **The Kaskade ecosystem.** Festival-day Short (21K), EDC Afters live, the set, a live
  performance clip of the EDC anthem (40K), an Inside The Drop episode with its own promo
  Short, a second full set and follow-up Shorts. This is the template.
- **Inside The Drop as a supported series.** Each December episode (Chris Lake, Subtronics,
  Sara Landry, Cloonee) was paired with an "out now" Short within a day. April's Loco Dice
  and Cole Knight episodes each had 4–5 themed Shorts.
- **Zombie Apocalypse metadata:** chapters on 3 of 5 sets, its own playlist, artist links, and
  all five added to Insomniac Events Live.
- **The Shorts schedule:** 26 consecutive weeks at 19 a week shows the team can run a
  programme to a fixed slot plan.

### 10.6 Findings, ranked (audience benefit × evidence × ease)

1. **The 2026 artist-hosted collaborations aren't gathered anywhere on Insomniac's channel.**
   - The four largest alone (Tiësto, Charlotte de Witte, Armin van Buuren, Above & Beyond)
     hold 5.8M views.
   - Insomniac Events Live, the Home shelf that gathered 55 artist-hosted sets in 2025, has
     added none in 2026.
   - *Evidence: strong · ease: minutes · benefit: high.*
2. **The 2026 set playlist is incomplete, and the end screens point into it.**
   - 18 sets (1.03M views) are missing; 16 of them end by sending viewers to the playlist they
     aren't in.
   - It also holds two unlisted items, one a shorter duplicate of Funk Tribu.
   - *Strong · minutes · medium-high.*
3. **Chapters are almost absent on EDC sets: 2 of 79**, against 3 of 5 for Zombie Apocalypse.
   - Tiësto's and Above & Beyond's own uploads of their sets have them.
   - None of the top 16 EDC sets does, although Hardwell's description already links a full
     tracklist.
   - *Strong · hours (top 20 first) · medium.*
4. **Half the biggest sets have no identifiable supporting Short.**
   - 8 of the 16 heroes, including the #1 (Solomun, 650K) and #4 (Hardwell, 553K, YouTube's
     own featured headliner), have no Short naming the artist.
   - Shorts ran at 4–17 a week through June–July at the same time.
   - The over-performers KREAM, Mathame, Meduza³ and Whethan are among the eight.
   - *Medium (title-based lower bound) · moderate · medium-high.*
5. **No visible route from Shorts to sets.** 0 of 774 Shorts descriptions link a video. Whether
   Shorts carry a related-video link is Studio-only. *Medium · easy to fix if absent.*
6. **Cadence continuity broke in autumn.**
   - A 35-day Shorts pause, a 19.7-day gap with no uploads at all (the longest since at least
     2019) and three empty weeks, against none in 2024–25.
   - It may be planned around the 30 Years of EDC documentary.
   - *Strong as a fact; the cause is unknown.*
7. **Small metadata fixes.**
   - 4 off-standard titles (incl. Griz B2B Wooli 299K and Cosmic Gate 212K).
   - 6 sets without end screens (incl. Virtual Riot 74K and Robert Hood 57K).
   - 3 end screens pointing to the Insomniac TV playlist instead of the set playlist.
   - 5 sets without Collaboration credit (possibly artist-side).
   - *Strong · minutes · low-medium.*
8. **No Premieres on headline sets** (2 of 79, neither a headliner). This was already noted in
   v2; it remains an experiment, not a gap.

**Considered and rejected in this pass**
- **"Pre-festival Shorts didn't build EDC."** In the 5½ weeks before EDC 2026, only 2 of 59
  Shorts named EDC, against 17 of 34 in 2025. But most of 2026's Shorts covered other Insomniac
  properties (Beyond Wonderland, Factory Town, EDC Thailand) and titles are casual. The one
  explicit livestream promo (8 May, [29K](https://youtu.be/umrLzbs1POE)) was among the
  period's best. Too weak to keep.
- **"Shorts views by artist predict set views."** Too few named Shorts per artist, with no
  control for set date. Not kept.

### 10.7 Exact actions

| # | Action | Where | Effort |
|---|---|---|---|
| 1 | Add the ≥ 11 artist-hosted 2026 sets (start with Tiësto, Charlotte de Witte, Armin van Buuren, Above & Beyond, DABIN, Lilly Palmer) to Insomniac Events Live; consider a "EDC Las Vegas 2026 — on artists' channels" section | Playlists | < 30 min |
| 2 | Add the 18 missing sets to "EDC Las Vegas 2026 Full Sets"; remove the unlisted Funk Tribu cut (IkcYzXMqHwk); decide on Adventure Club (publish or remove) | Playlists | < 30 min |
| 3 | Chapters (or a timestamped tracklist) on the 20 most-watched EDC sets, Solomun to Wooli first; seed from 1001Tracklists where one exists | Descriptions | ~10 min per set |
| 4 | For the 8 heroes with no identifiable Short: one or two set-moment Shorts each, linked to the full set via the related-video field — within the existing weekly volume | Shorts | Within current output |
| 5 | Fix 4 titles; add end screens to 6 sets; repoint 3 end screens and Zomboy's to the right set playlist; check the 5 missing credits with the artists | Studio | < 1 hour |
| 6 | Agree an autumn/winter baseline (e.g. the 19-a-week slot plan, or a lighter fixed one) so the channel never goes dark between events | Planning | Team decision |

### 10.8 What deserves space in the deck

- **Proposal: replace the content of slide 10 ("Channel organisation and discoverability")**
  with one visual slide, **"Are the biggest performances getting the support they deserve?"**
  - About six real performances in a strong-support vs opportunity layout:
    - Kaskade: full ecosystem.
    - Subtronics or Porter Robinson: Shorts before and after.
    - Zomboy: chapters.
    - Solomun: #1 set, no identifiable Short, no chapters.
    - Meduza³: not in the playlist its end screen promotes.
    - Tiësto: 2.2M, not gathered on Insomniac's channel.
  - Then three numbers: **0 of ≥ 11** artist-hosted sets in a playlist · **18 sets / 1.03M
    views** outside the 2026 playlist · **2 of 79** with chapters.
  - Slide 10's Home rail compresses to one line; its two "confirmed" items (18 missing sets,
    2/63 timestamps) are absorbed.
- **Slide 9:** correct "output is back near 2023–24 levels" to state the continuity break (the
  longest silence since 2019, three empty weeks), keeping "not a measure of demand" and the
  documentary as a possible reason.
- **Slide 13 (Optimise):** replace the generic bullets with actions 1–3 above, and add
  "Shorts for the eight biggest sets without one" to Experiment.
- **Not for the deck:** metadata fixes (action 5) and the rejected pre-festival read. They
  stay here.

### 10.9 Studio-only checks raised by this pass

- Do the Shorts carry a related-video link, and to what?
- Shorts → set traffic for the heroes with Shorts (Kaskade, Subtronics, Porter Robinson)
  against those without.
- End-screen element click-through, especially the playlist element on the 16 sets missing
  from the playlist.
- Playlist starts and views per viewer for the 2026 set playlist and Insomniac Events Live.
- Chapter engagement on Getter, Laidback Luke and the Zombie sets against comparable sets
  without chapters.
- Collaboration view attribution on the artist-hosted sets.
- Whether unnamed Shorts feature the eight heroes without a named Short (the team's own
  asset log would answer this faster than Studio).
