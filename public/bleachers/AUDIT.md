# Bleachers × YouTube deep dive — audit pack

**Artefact:** `https://youtube-campaign-coach.vercel.app/bleachers`
**Version:** v2 — 30 September 2026
**Audience for the deck:** the artist and their management.

---

## 0. What changed in v2, and why

v1 was reviewed and three defects were found. All three are fixed, and fixing the
first one turned up a fourth that was more serious than any of them.

| # | v1 defect | Status |
|---|---|---|
| 1 | "Only two songs got the full support package" contradicted its own table, which showed three | **Fixed** — the answer is three (I Wanna Get Better, Rollercoaster, Alfie's Song), verified programmatically |
| 2 | Cover took 54% against the 189M lifetime counter instead of the 111M catalogue | **Fixed** — the cover no longer states a share at all, and the 111M/78M distinction now has its own slide object |
| 3 | Format slide said "all 230 uploads classified" while showing only 174 | **Fixed** — the census is now exhaustive: seven buckets, 230 uploads, summing to exactly 111,031,833 |
| 4 | **The music-video count was wrong.** v1 said 15 MVs / 60.2M | **Fixed** — the real figures are **17 MVs / 64,641,693** |

### Defect 4 in detail, because it is the one that matters

v1's classifier missed **"Bleachers - Tiny Moves (Official)"** — 4,425,773 views, the
channel's fifth-biggest music video — because the title says "(Official)" rather than
"(Official Video)". The stated count of 15 also didn't match its own sum, which
corresponded to 16 videos.

This is precisely the failure mode v1's own audit flagged as the top method risk
("a music video titled without '(Official Video)' can be misfiled"). It then happened.
The lesson applied in v2: **the census is now exhaustive and self-checking** — every
upload lands in exactly one bucket and the buckets are asserted to sum to the catalogue
total. A miscount can no longer hide, because it would break the sum.

---

## 1. Data sources

| Source | What it gives | Window |
|---|---|---|
| YouTube Data API v3 | 230 uploads: views, likes, comments, duration, publish date, title, description | Read 30 Sep 2026 |
| Our own daily channel snapshots | Channel-level view and subscriber totals | **From 20 Apr 2026 only** — 23 weekly readings |
| UK Official Charts Company | Public chart record for Merry Christmas, Please Don't Call | Dec 2024 – Feb 2026 |

**No Studio access.** No watch time, retention, traffic sources or demographics, and
nothing in the deck claims anything that would require them.

### The coverage gap

| | |
|---|---|
| 230 uploads, summed | **111,031,833** ("the catalogue") |
| Channel lifetime counter | **188,997,142** ("lifetime") |
| Unaccounted | **77,965,309 — 41.3%** |

The deck now keeps these two words strictly apart, states both on their own slide, and
takes **no percentage against the lifetime figure anywhere**. It also states the thing
v1 omitted: if the missing 78M is not spread evenly across formats, the shares would
shift, and that cannot be tested from outside.

---

## 2. Format census — exhaustive, self-checking

| Bucket | Uploads | Views | Share of catalogue |
|---|---|---|---|
| Music video | 17 | 64,641,693 | 58.2% |
| Official audio | 16 | 27,856,700 | 25.1% |
| Live | 45 | 8,635,421 | 7.8% |
| Lyric video | 4 | 4,885,844 | 4.4% |
| Album tracks & remixes | 31 | 2,615,084 | 2.4% |
| Docs & behind the scenes | 23 | 1,334,113 | 1.2% |
| Shorts | 94 | 1,062,978 | 1.0% |
| **Total** | **230** | **111,031,833** | **100%** |

Both columns sum exactly. Classification is rule-based on title, duration and the
API's `isShort` flag; the rules are in the page comment and reproducible.

One judgement call worth challenging: the 17 music videos include the **Verdine White
remix** of How Dare You Want More (15,708 views), which is an official music video for
a remix rather than a distinct song. The deck therefore says "17 music videos" in the
census but "sixteen songs have an official music video" on the support slide. Both are
accurate; a reviewer may think one number should be used throughout.

---

## 3. Every claim, with its figure

### Catalogue longevity — the deck's central fact

| | |
|---|---|
| Views on 27 Apr 2026 | 165,112,313 |
| Views on 28 Sep 2026 | 188,997,142 |
| Gain over 154 days | **+23,884,829** (~155,096/day) |
| Uploads published in the window | 5 |
| Their combined views | **650,611 (2.7%)** |
| Attributable to the back catalogue | 23,234,218 (97.3%) |

The five: `vPyhRkfMGak` 388,213 · `468J7e1clU4` 227,050 · `L7xZiSVChvM` 25,020 ·
`9QUgwQBv9fE` 5,647 · `BBGIgBuzqHc` 4,681.

**Caveat a reviewer should weigh.** The 2.7% counts only views *on the new uploads
themselves*. A new upload can also lift catalogue viewing, and that halo is invisible
here. The claim is therefore "97% of viewing landed on older material", not "97% would
have happened with no activity at all". The deck's wording ("came from work already
made") is intended to stay on the right side of that line — check whether it does.

### The seasonal asset

**YouTube.** `aBpYk9vuneE`, published 26 Nov 2024, **7,059,176 views**. Third-biggest
music video on the channel behind I Wanna Get Better (15.69M) and Rollercoaster
(11.81M), both 2014 — so it is the biggest released **since 2014**.

**UK Official Singles Chart** (source: officialcharts.com, fetched 30 Sep 2026):

| Year | Weeks on chart | Run | Peak |
|---|---|---|---|
| One | 1 | 02/01/2025 | **77** |
| Two | 4 | 11/12/2025 → 01/01/2026 (65, 66, 78, 68) | **65** |

Also two separate four-week runs on the Official Independent Singles Chart, peaking
**10** (02/01/2025) and **12** (18/12/2025); Official Physical Singles Chart peak 24
(05/02/2026); Official Vinyl Singles Chart peak 18 (05/02/2026); Irish Singles Chart 47
(01/01/2026).

**Supporting assets on the channel:** MV + 5 Shorts in Nov–Dec 2024; **2 Shorts only**
in Nov–Dec 2025; the Annie DiRusso live version (`L7xZiSVChvM`, 25,020) published
**14 Aug 2026**. A December 2025 network TV performance is reported by Consequence and
is not on the channel — the catalogue shows no upload between 31 Oct 2025 and 3 Feb 2026.

> **STATED LIMITATION, PROMINENT ON THE SLIDE.** Our daily snapshots begin **20 April
> 2026**. We have **no observation of either Christmas period** and the deck explicitly
> declines to estimate one. The seasonality claim rests entirely on the chart record,
> which is independent of YouTube. The deck does **not** claim measured YouTube
> seasonal growth.

### Performance footage

| | Count | Median |
|---|---|---|
| Single-song live videos | 28 | **95,800** |
| Radio City live Shorts (Aug–Sep 2023) | 6 | **2,739** |

Radio City Shorts: 1,841 / 2,326 / 2,556 / 2,922 / 3,609 / 6,083.
Stone Pony full show `468J7e1clU4`: 5,489s (91.5 min), 227,050 views, published
5 Jun 2026, never cut into songs.
Red Rocks precedent, 8 Jul 2024: `LvwZVMk2v6o` 171,061 + `YE68EpoHT3k` 143,289 +
`-b9D3TVmssI` 68,986 = **383,336** from one show.

**Live vs video — the corrected version.** v1 headlined "the live take beat the music
video" off a single comparison. Tested across every song with both, that generalisation
**fails**: 12 songs have an official video and a live version, and the video leads in 10.

The two exceptions:

| Song | Live | Video | Ratio |
|---|---|---|---|
| How Dare You Want More | 601,311 | 304,157 | 1.98× |
| Dirty Wedding Dress | 388,213 | 202,366 | 1.92× |

These are the **two lowest-performing official music videos in the catalogue**
(excluding the remix). The deck's claim is therefore narrowed to: live footage is a
second chance at a song whose video didn't land — not a way to beat a good video.
n=2, and the deck says so.

### Shorts

94 Shorts, median **6,083**, two above 50,000: `7XyRT_prqjY` 152,562 (Fallon, billed as
the only live performance of Modern Girl that exists) and `au7cm7Od7b8` 144,905
(Margaret Qualley's Tiny Moves choreography). Next highest are 46,996 and 46,381.
Neither top performer is a concert clip.

### Song support — corrected

Songs with video **and** lyric **and** audio **and** live: **three**, verified
programmatically — I Wanna Get Better (30.67M), Rollercoaster (18.92M), Alfie's Song
(3.72M). The last was 2018.

Only four lyric videos exist on the channel: I Wanna Get Better (3,714,016),
Alfie's Song (563,167), Shadow (480,248), Rollercoaster (128,413) — averaging
1,221,461 each, the highest per-upload return of any format. Note Shadow has a lyric
video, audio and live but **no** official music video, which is why it doesn't appear
in the support table.

**"you and forever" reconciled:** official video alone **2,198,654**; the 2.75M in the
table is video + Live From Electric Lady (49,500) + Jack at Electric Lady (501,998).
The deck states both figures and labels which is which.

---

## 4. What the deck deliberately does not claim

1. **No causal claim** that the asset build caused the size of the big songs — age and
   scale are confounded and the slide says so.
2. **No measured YouTube seasonality** — see the stated limitation above.
3. **No Studio metrics.**
4. **No percentage against the 189M lifetime counter.**
5. **No claim that live beats video in general** — corrected in v2, it beats video in
   2 of 12 cases and both were weak videos.
6. **No rights assertion** — the Stone Pony recommendation says rights are expected to
   be settled given the show is already public, flagged as an expectation.

---

## 5. Recommendation traceability

Every recommendation names its finding on the page.

| # | Recommendation | Finding it rests on | Evidence strength |
|---|---|---|---|
| 01 | Cut the Stone Pony set into single-song videos | Full-length live median 95,800 vs Shorts 2,739; Red Rocks precedent 383,336 | **Strong** — 28 assets, plus a same-channel precedent |
| 02 | Put a December plan around the Christmas song | Chart peak 65 in year two vs 77 in year one; 4 weeks vs 1 | **Strong on demand, none on YouTube** — stated |
| 03 | Give one upcoming song the full build | Three full builds, last 2018; 4 lyric videos average 1.2M | **Suggestive only** — confounded, framed as a test |
| 04 | Point Shorts at exclusive moments | Two Shorts above 50K, both exclusives; 6 concert clips at 2,739 median | **Weak** — n=2, the deck calls it a steer |

---

## 6. Open challenges for a reviewer

1. Does "97% came from work already made" overstate the case, given the invisible halo
   from new uploads onto catalogue viewing?
2. The Verdine White remix: should it count as a music video? It changes 17 → 16 and
   64.64M → 64.63M.
3. Is n=2 enough to carry recommendation 04, even labelled as a steer?
4. The Stone Pony show is the channel's own upload at 227,050. If it were cut into
   songs, would those cannibalise the full-show upload rather than add to it? The deck
   does not address this and arguably should.
5. Rec 02 assumes the December chart demand is reachable on YouTube. That is an
   inference across platforms. Is it a fair one?
6. Live medians span 2015 to 2026. Older assets have had more time to accumulate, so
   the 95,800 median is flattered by age. Should it be age-matched?
7. Is there anywhere the deck reads as blame rather than opportunity?
