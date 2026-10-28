# Insomniac × YouTube — audit pack

**For independent review.** Read 28 October 2026. Everything below is the raw material
behind the deck at `/insomniac`. Its Analysis sheet carries the summary tables; this file
carries the provenance, the rules, the rows, the arithmetic behind every claim, what was
considered and dropped, and the places I think it is weakest.

Please **try to break it**. Take a claim from §5, trace it to the rows in §4, and say where
the claim outruns the evidence. The deck is meant as a constructive review of a large,
well-run channel for a business review. If a finding reads as a manufactured problem, say so.

Method and evidence standards follow the Defected audit pack (`/defected/AUDIT.md`).

---

## 1. Provenance

| | |
|---|---|
| Channel | `@insomniac` — `UCr45VhwCBYwMfdN-gz7W_OA`, created 17 June 2006 |
| Source | YouTube Data API v3, one pull, 28 October 2026, 11:12–11:23 UTC, through the project's own routes: `/api/full-catalogue?handle=@insomniac&cap=5000` (uploads), `/api/channel-shelf?channelId=…` (playlists, Home sections), `/api/channel?q=@Insomniac` (cached channel record) |
| Lifetime view counter | **195,160,777** |
| Subscribers | **722,000** (YouTube's rounded public figure) |
| Public videos | **4,169** (channel statistic) |
| Uploads retrieved | **4,171** — the uploads playlist to exhaustion, not capped (two uploads landed between the statistic and the pull). 17 June 2006 → 27 October 2026. **This is the whole channel, not a sample.** |
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
- 195 uploads carry `wasLive`; 189 of those have a `scheduledStart` (Premieres or
  scheduled streams). Four live items report **0 views** because the count is hidden
  (the Insomniac TV station, two "EDC Afters Live" streams, a 2023 station); they are
  classed separately and contribute nothing.

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

## 3. Questions the brief asked, and where they are answered

| Brief | Slide(s) | Short answer |
|---|---|---|
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

By stage (from the description): kineticFIELD 16, median 282,627, 10 ≥ 100K · circuitGROUNDS
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

Publication lag after the festival's last day (17 May), counted over 80 (one more set
titled "EDC 2026"): ≤ 7 days 48 · 8–14 days 17 · 15–30 days 9 · > 30 days 6.

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

Twelve events after EDC LV and Zombie Apocalypse; none with sets. Uploads per month 2026:
Jan 87 · Feb 81 · Mar 87 · Apr 60 · May 147 · Jun 71 · Jul 66 · Aug 43 · Sep 12 · Oct 7.

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

## 5. Every claim on the deck, with its arithmetic

**5.1 Cover / slide 2 — "195.2M views · 722K subscribers · 4,169 videos · 1,125 Shorts, 774
since October 2025"; "three eras"; "2026 alone is already the best year since 2020".** §1,
§2.1, §4.1. 2026 uploads 15,156,857 vs 2023 15,037,286 and 2021 11,313,123. **Challenge:**
"best year" ranks years by the lifetime views of that year's uploads; 2026's are the
youngest, so if anything this understates 2026.

**5.2 Slide 3 — "Trailers built the channel"; shares 38.7 / 24.3 / 17.9 / 7.9 / 3.3%; "the
main EDC trailer drew 1.6–3.6M for every edition from 2010 to 2020; since 2022, 110–200K".**
§4.2, §4.4. 2013 is 1.59M ("1.6M" rounded). **Challenge:** lifetime totals favour old
trailers. The 2023 trailer has had 3.5 years and sits at 165K, against 1.6–3.6M for every
pre-2021 edition; age can't explain a 10× gap, but "moved to other platforms" is a
reading, not a finding.

**5.3 Slide 4 — "Since last October, the sets did most of the work": 940 uploads, Shorts
82% / 24% of views; sets 9% / 62%; "typical Short 3.3K, typical set 69K"; "19 uploads in
September and October".** §4.3: Sep 12 + Oct 7 = 19. **Challenge:** Shorts and sets do
different jobs (reach vs depth). The deck says so and doesn't call Shorts a failure.

**5.4 Slide 5 — "79 sets · 10.1M views in five months · typical 69K · 28 over 100K · +7.2M
on at least 11 artist-hosted sets · 48 within a week · EDC 2025 on the channel 8 sets,
typical 21K after 16 months · Zombie Apocalypse 5 sets, 117K and 92K"; "YouTube carried the
EDC livestream exclusively, 15–17 May, six feeds a day, multiview".** §4.5, §4.7; the
livestream facts are from YouTube's own blog post (14 May 2026). **Challenge:** 2025 vs 2026
isn't like for like: in 2025 the big names posted on their own channels (§4.7). The slide
uses 2025 to show the change of model, not that 2026's sets were "better".

**5.5 Slide 6 — "46.9M views on 83 sets … from 63 artist channels; typical 209K; twelve
past a million; 2025 alone 55 sets on 52 channels, 18.7M"; "61 of 63 sets carry both
names"; "Tiësto 2.2M, Charlotte de Witte 1.3M, Armin van Buuren 1.3M, Above & Beyond 993K";
"for some headliners we found no official upload".** §4.7. **Challenge:** the curated
playlist is a selection (the best-performing artist uploads Insomniac chose to feature);
its median isn't comparable to Insomniac's own sets and the deck doesn't compare them.

**5.6 Slide 7 — stage medians; "eight of the ten are techno, house or trance"; "the bass
stage had joint-most sets (18) but only one past 100K".** §4.5, §4.6. **Challenge:** n = 79
split six ways; stage mixes billing and sound; genre assigned by us. Framed as "a pattern
worth testing, not a rule".

**5.7 Slide 8 — "774 Shorts, about 14 a week; half reach fewer than 3,300; 88 past 10K; one
past 100K; the biggest by far was a moment from Gesaffelstein's set".** §4.9 (87 in
10–100K plus 1 ≥ 100K = 88 ≥ 10K).

**5.8 Slide 9 — "One festival got the full treatment. The rest of the calendar got a
trailer."; "Insomniac TV, live since 20 May"; "uploads fell away after August".** §4.8,
§4.10. Zombie Apocalypse's five sets are named on the slide, so "one festival" is a
headline simplification for the full livestream-to-sets cycle. **Challenge:** whether
other events were filmed at all is unknown; the recommendation is selective for that
reason.

**5.9 Slide 10 — "18 of the 79 EDC 2026 sets aren't in the 2026 playlist"; "2 of 63 sets
have a tracklist or timestamps"; "Night Owl Radio stops at episode 524 … still weekly
elsewhere (#584)"; "108 public playlists".** §4.7, §4.10.

**5.10 Slide 11 — five strengths.** Each figure appears on an earlier slide. "Two-thirds of
everything the channel has drawn in 2026": 10,072,480 / 15,156,857 = 66.5%.

**5.11 Slide 12 — three priorities and four questions.** Evidence lines repeat §5.3–5.9.
"Twelve other events" §4.8. Releases 46 → 14, last 21 Aug §4.10. Night Owl Radio typical
2.5K §4.10.

**5.12 Slide 13 — "10.1M from 79 EDC sets in five months"; "46.9M on artist-hosted
Insomniac sets"; "12 other events in 2026 with no sets".** As above.

---

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

## 9. Questions for the reviewer, in priority order

1. Trace 5.4 and 5.5. Does slide 5 or 6 imply Insomniac-hosted sets "beat" artist-hosted
   ones? It shouldn't.
2. Trace 5.2. Is "Today they reach a fraction of that" fair given lifetime totals?
3. Trace 5.6. Should the genre slide be cut to a line in Analysis?
4. Is "Take the EDC set model to a few more events" proportionate, given filming, rights and
   artist approvals sit outside the YouTube team?
5. Read slides 8 and 12 as Insomniac's social team would. Do they read as criticism of
   their Shorts work?
