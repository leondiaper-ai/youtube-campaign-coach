# Palaye Royale × YouTube — Album Campaign Deck, Review Pack v3

**What this is.** Everything behind the *current* Palaye Royale campaign deck, written for independent review. The deck is artist-facing and deliberately positive, which makes it *more* important that the analysis underneath is attacked properly. This pack is written to be argued with, not agreed with.

**If you are reviewing this, start at §2.** The live/performance recommendation is the newest, boldest and least-supported claim in the deck. It rests on **four videos from 2020**. I believe it is right. I am not confident it is proven, and I would rather you broke it now than a manager broke it in a meeting.

| | |
|---|---|
| Live deck | https://youtube-campaign-coach.vercel.app/palaye |
| Prepared by | Leon Diaper, Virgin Music Group |
| Deck data pulled | **4 September 2026** |
| Source | YouTube Data API v3 only — **no Studio, no Analytics** |
| Artist channel | Palaye Royale · `UCmtnvb5ParBm8yTuNROr6XQ` (verified by API title) |
| Label channel | SUMERIAN · `UCAtlZO9a52JIhQRyXDRLaZQ` |
| Audio channel | Palaye Royale - Topic · `UCCWM3XuCiHzsVIhLXSgiF2w` |
| Deck | 9 slides, artist and management facing |
| Research behind it | `docs/PalayeRoyale_Strategy_Research_v1.md` — 2,195 uploads, 7 channels |

**This supersedes Review Pack v2.** v2 audited the pre-revision deck; roughly half its findings have since been fixed and half its targets no longer exist. §8 lists what changed. **v1 is void** — its central claim was factually wrong (see v2 §9).

---

## 0. An error in the research document, found while writing this pack

`PalayeRoyale_Strategy_Research_v1.md` states that Palaye "upload more often than four of the six peers analysed." **That is wrong. The correct figure is five of six.**

Trailing 24 months: Palaye 136 uploads, versus YUNGBLUD 353, BMTH 110, Falling In Reverse 40, Motionless In White 37, Sleep Token 22, Bad Omens 12. Palaye are above everyone except YUNGBLUD.

The error *understates* the deck's own argument, so nothing on the deck is wrong because of it — the slide says "a higher upload rate than most bands we looked at", which is true at 5/6 and would also have been true at 4/6. But the research document is the evidence base and it is inaccurate. **A reviewer should assume other counts in that document may be similarly loose and spot-check them.**

---

## 1. The headline number: 201,511,732

Slide 2 opens on **201 million views**. All three components are now the sum of **currently visible uploads**, pulled 4 Sep 2026:

| Destination | Views | Videos | Share |
|---|---:|---:|---:|
| Sumerian (Palaye videos only) | 142,510,177 | 114 | 70.7% |
| Palaye Royale artist channel | 37,762,412 | 340 | 18.7% |
| Palaye Royale - Topic | 21,239,143 | 154 | 10.5% |
| **Total** | **201,511,732** | | |

**What v2 attacked has been fixed.** The previous 222,160,315 used the artist channel's lifetime `viewCount` (58,617,481) alongside per-video sums for the other two — so ~20.9m of views on deleted or private videos were counted on one row only. That is gone.

**Note what the fix did to the argument.** The artist channel's share fell from 26% to **19%**, which makes the deck's case *stronger*. The correction was adopted because it is the consistent basis, and this is recorded in the source. **A reviewer should still check that I have not talked myself into a method because I liked its output.**

**"An audience of 222 million" has been removed** from the close. Views are not people; that line should never have shipped.

**Remaining problems with this number, in order of severity:**

1. **The three surfaces are not provably exhaustive.** This is the sum of *the destinations we happened to map*. Territory channels, other label uploads, playlists and collaborator channels are unmapped. The deck says so in small type. **Is a total that depends on an arbitrary boundary a defensible thing to open on at all?**
2. **The Sumerian figure nearly shipped badly wrong.** My first pull was silently truncated at 1,000 of 3,667 uploads, returning only 58 Palaye videos worth 22.6m — missing *Mr. Doctor Man* (19.3m) entirely. It was caught only because that omission was conspicuous. **A reviewer should ask what other truncation I have not noticed.**
3. **Percentages are not printed on the cards.** 70.7 / 18.7 / 10.5 rounds to 71/19/11 and visibly sums to 101, so the bars carry proportion and only Sumerian's 71% is stated in words. **Is that honest simplification or is it hiding the rounding problem?**

---

## 2. Attack this hardest: the live/performance recommendation

Slide 7 makes live/acoustic/session a **tier-one-equivalent format** — one of three named jobs — and the source line reads:

> Performance earns its place on your own evidence — the 4 live and acoustic videos from 2020 median 133,828 views, the strongest non-music-video assets the channel has ever carried · nothing live since 2021

**The evidence, in full:**

| Asset | Views | Date |
|---|---:|---|
| Mr. Doctor Man (Live Acoustic) | 283,747 | May 2020 |
| Hang On To Yourself (Live Acoustic) | 157,980 | May 2020 |
| Dying In A Hot Tub (Live From a Hot Tub) | 109,675 | Mar 2020 |
| Black Sheep (Live Acoustic) | 101,121 | Aug 2020 |
| **Median** | **133,828** | |

Supporting peer evidence (deliberately **not** on the artist-facing deck): live is the only non-music-video format clearing 10% of an artist's own contemporary music-video median in more than one catalogue — YUNGBLUD 0.147×, BMTH 0.190×. YUNGBLUD's longest 2025 gap (176 days) was carried by live, including one asset at 1.9× his own MV median. Bad Omens run a 24-upload channel whose non-Shorts output is essentially all live.

**Why I think this is the deck's weakest link:**

1. **n = 4.** Four videos. A median of four numbers is a weak foundation for a tier in a strategic hierarchy.
2. **They are all from a single five-month window in 2020** — lockdown. Acoustic-at-home content had unusual conditions then. **Is this a format finding or a 2020 finding?** I cannot separate them and the deck does not acknowledge the possibility.
3. **They are five years old.** Age cuts *against* them versus Royal Television Season 05 (2025), which is the comparison the argument leans on — so the 6× gap is if anything understated. That direction is favourable, but it is still an unmatched comparison.
4. **The peer ratios rest on small n too.** YUNGBLUD's 2024+ MV baseline is n=5; BMTH's is n=3.
5. **Nothing establishes causation.** No claim is made that live *drives* anything, but a reader may infer it.

**Questions:**

1. **Is four videos enough to justify a tier?** If not, what would be — and is the honest alternative to demote live to "worth testing" rather than a named job?
2. **Does the 2020 lockdown context invalidate the comparison?** Should the deck say so?
3. **Should the deck admit n=4 on the slide?** It currently gives the median and the count but frames it as settled.
4. **Is there a credible counter-argument** — for example that Palaye's audience has changed since 2020, or that live capture costs more than its likely return at 272k subscribers?

---

## 3. The reframed diagnosis (slide 4)

> **The channel isn't quiet. It's busy without a job.**

| Figure | Value |
|---|---:|
| Uploads, trailing 24 months | 136 |
| Of which Shorts | 135 (90%) |
| Non-Shorts | 14 |
| Active months | 17 / 24 |
| Shorts median, since Jan 2024 | 4,068 |
| Shorts total, since Jan 2024 | 1,384,951 |

**This directly reverses the previous deck**, which said the channel had gone quiet and implied the fix was to post more. The 81-dormant-days figure and the stale-bio observation were removed with it — both true, both supporting a diagnosis that no longer holds.

**Claim discipline.** Nothing on this slide says Shorts don't work, don't drive discovery, or are wasted effort. Public data cannot see discovery, subscriber acquisition, or Shorts-to-long-form journeys. The only claim is that **Shorts dominate the activity while destinations are thin**. I believe this line holds. **Check it.**

**Questions:**

5. **Is "busy without a job" too harsh for an artist-facing deck?** It is a sharper judgement than anything in the previous version.
6. **Does the slide implicitly devalue Shorts** despite the careful wording? A reader may hear "your Shorts don't matter" whatever the copy says.
7. **Is comparing upload *rate* across artists of wildly different scale meaningful at all?** Bad Omens post 12 times in two years and have 505k subscribers. Sleep Token post 22 times and have 1.29m. **Maybe low upload counts are a sign of health, not a deficiency — which would undercut the whole "busy" framing.** This is the sharpest available counter-argument and I have not answered it.

---

## 4. Royal Television (slide 6)

**Corrected.** 84 uploads match "Royal Television"; **15 are 17–45-second promo clips** (median duration 40s, median 6,192 views). The series is **69 real episodes**, 3,308,906 views.

| Season | Episodes | Period | Median | Median duration |
|---|---:|---|---:|---:|
| 01 | 20 | 2018 | 77,142 | 16m |
| 02 | 3 | 2018 | 89,532 | 22m |
| 03 | 17 | 2018–19 | 37,983 | 12m |
| 04 | 17 | 2021–23 | 25,181 | 16m |
| **05** | **12** | **2025** | **22,318** | **27m** |

**The old Season 05 median of 12,682 was wrong** — it averaged 40-second promo clips in with 27-minute episodes. The corrected figure is **22,318**, which is *better* for the deck. **The 3.7×-a-Short comparison is gone entirely** and the source records that it must not return: it was never age-matched.

**The recommendation changed** from "restart it" to **"don't restart a weekly series — make four episodes matter."** Season 05 began weekly on 28 Jan and slipped to gaps of 14, 21 and 70 days before stopping in July.

**Questions:**

8. **Is excluding the 15 promo clips correct?** I think obviously yes — a 40-second promo is not an episode. But it raises the series' headline numbers, so it deserves a second opinion.
9. **Season 05 declines within itself** — 28,228 / 25,498 / 27,902 / 43,783 / 41,954 / 26,546 / 19,138 / 16,205 / 6,311 / 8,745 / 15,286 / 10,109. Later episodes are both **newer and lower**, so age and genuine decline cannot be separated. **Does the deck lean on a series that is visibly cooling?**
10. **Is "four episodes" the right number, or is it just a tidy match to four hero moments?** It is not derived from anything.

---

## 5. The format hierarchy (slide 7)

The deck's central answer, replacing a flat menu of seven equally-weighted tiles:

| Tier | Format | Where | Job |
|---|---|---|---|
| 1 | Official music video | Sumerian | The release itself |
| 2 | Royal Television | Artist channel | The narrative around the record |
| 3 | Live, acoustic or session | Artist channel | The second music moment |
| — | Shorts | — | Support; cut from the three above |
| — | Lyric & visualiser | — | Response-led only |

**Evidence for the demotions.** YUNGBLUD's recent lyric median is **22,200** — 0.2% of his own MV median. His strong visualiser figure is one Aerosmith collaboration at 8.6m, not a format effect. Shorts run at 0.018 / 0.003 / 0.006 of own-MV median for YUNGBLUD / BMTH / MIW.

**Questions:**

11. **Is demoting lyric videos safe?** BMTH's recent lyric median is 699,318 and MIW's is 279,798 — both far above YUNGBLUD's 22,200. **The evidence for demoting lyric videos is much weaker than the deck implies, and rests disproportionately on one artist.** I consider this the second-weakest claim in the deck.
12. **Does a three-tier hierarchy over-simplify?** Real campaigns are messier than three jobs.
13. **Is the Shorts demotion defensible without discovery data?** It is defended on observed viewing only. That is honest, but incomplete — and Shorts could be doing work we cannot see.

---

## 6. The rest of the deck

**Slide 5 (the model)** — unchanged recommendation: videos stay on Sumerian; the artist channel becomes the campaign home. Now carries the 2024 campaign's five-video median of **1,182,195** (top: *Showbiz* 2,364,949) as justification. **This is a recommendation, not a finding**, and is unfalsifiable from public data.

**Slide 6 (Stations)** — YouTube Stations is presented on-slide as **a new product in beta that we would pitch YouTube for**, with the explicit fallback that Royal Television works as a programmed run either way. Moved out of the source bar deliberately. Metallica is referenced as a format example only, with no scale comparison.

**Slide 8 (four moments)** — gaps corrected from "four to nine weeks" to **"three to nine"**. Actual: 25 days, 23 days, 64 days. The 23-day gap is 3.3 weeks, so "three to nine" is now accurate. *This was flagged in v1 and v2 and is finally fixed.*

**Slide 1** — 28 days to first single. Hardcoded against 4 Sep; **will silently go stale.**

---

## 7. Limitations

- **No YouTube Studio access.** No retention, traffic sources, subscriber attribution, or audience overlap between the three channels. Every claim about where an audience "is" is inferred from upload location alone.
- **No per-video history exists anywhere in the system.** Verified in source. D7/D30/D90 cannot be reconstructed for anything. Every figure is a current lifetime snapshot; no age adjustment is possible beyond restricting comparisons to matched windows.
- **Views were never divided by age**, and no "views per day" metric appears anywhere.
- **Small n throughout.** Live n=4. YUNGBLUD MV baseline n=5. BMTH n=3.
- **Two peers are poor comparisons.** Falling In Reverse is functionally a personal streaming/merch channel (70 livestreams titled things like *"9 SIGNED GUITARS LEFT"*, no music videos since 2024) and was excluded from format ratios. Sleep Token is included only as a counter-example — 4/24 active months, a 356-day silence, and 1.01bn lifetime views, which contradicts the deck's whole programming thesis.
- **Format classification is imperfect.** ~8% of uploads land in unclassified buckets. `wasLive` is unusable as a live signal because YouTube reports Premieres as live broadcasts — YUNGBLUD's *Zombie* music video (33.9m) carries `wasLive: true`.
- **Campaign dates are supplied, not verified.**
- **The research document contains at least one counting error** (§0).

---

## 8. What changed since v2

| | v2 (previous deck) | v3 (current deck) |
|---|---|---|
| Headline | 222,160,315, mixed bases | **201,511,732**, consistent basis |
| Close | "an audience of 222 million" | "201 million views" — no audience claim |
| Artist channel share | 26% | **19%** |
| Diagnosis | Channel went quiet (81 days dormant) | **Busy without destinations** (90% Shorts) |
| Royal Television | 84 episodes, S05 median 12,682, 3.7× a Short | **69 episodes**, S05 median **22,318**, no multiple |
| Formats | Flat menu of 7, "Have it / Opportunity" | **Three tiers, three jobs** + demoted support |
| Live | One tile among seven | **A named tier** with its own evidence |
| Campaign gaps | "four to nine weeks" | **"three to nine weeks"** |
| Stations beta | Buried in source bar | **On-slide, framed as something to pitch for** |

**Resolved from v2:** the mixed-basis total, the "audience" claim, the 84-episode error, the 12,682 median, the 3.7× comparison, and the "four to nine weeks" rounding.

**Newly introduced and previously unaudited:** the live recommendation (§2), the "busy not quiet" diagnosis (§3), and the format hierarchy's demotions (§5).

---

## 9. Questions for the reviewer, ranked

1. **Is four videos from a single 2020 window enough to make live a named tier?** (§2) The most important question in this pack.
2. **Does lockdown context invalidate the 2020 live evidence?** (§2)
3. **Is the lyric-video demotion supported?** BMTH 699,318 and MIW 279,798 contradict YUNGBLUD's 22,200. (§5)
4. **Is comparing upload rate across artists of different scale meaningful** — or are Bad Omens and Sleep Token evidence that low volume is fine? (§3, question 7)
5. **Is a total built from three arbitrarily-chosen surfaces a defensible thing to open on?** (§1)
6. **Is "busy without a job" too harsh for an artist-facing deck?** (§3)
7. **Does the deck lean on Royal Television while the series is visibly cooling?** (§4)
8. **Was excluding the 15 promo clips right?** (§4)
9. **Does anything in the deck imply a forecast or promise a result** that public data cannot support?
10. **Has the analyst adopted a method because it flattered the argument?** Specifically the basis change that dropped the artist channel to 19%. (§1)

---

## 10. Things that do not need re-litigating

Stated so review effort goes where it is useful.

- **The arithmetic.** Every total, median and count in the deck was recomputed from the raw arrays and matches.
- **Channel identity.** All seven research channels verified by API `channel.title`. Two traps were caught: `@BadOmens` resolves to an unrelated 8-video account, and `@MotionlessInWhite` to a "- Topic" auto-channel. Both would have produced fictional analysis.
- **Zero shared video IDs** across the three Palaye surfaces, so no cross-surface double-counting.
- **The Stations beta caveat** is explicit and on-slide, with a stated fallback.
- **No peer artist is named anywhere in the rendered deck** — verified against the file with comments stripped.
- **No Studio or Analytics data** is used or implied anywhere.

---

**All deck figures recomputed from a single API pull, 4 September 2026. Any figure on the deck that does not appear in this document should be treated as an error and reported.**
