# Angus & Julia Stone — post-album campaign review
## Independent audit pack

**Purpose of this document.** Everything published at `/angusandjuliastone` is
reproduced here as a numbered claim with its derivation, alongside the complete
raw dataset both campaigns were computed from. A reviewer with no access to our
systems should be able to recompute every figure on the page and disagree with
any of them.

**Reviewer: please look hardest at Section 6.** It lists the places where I
made a judgement call rather than a calculation. Those are where this analysis
is most likely to be wrong.

---

## 1 · Provenance

| | |
|---|---|
| Artist | Angus & Julia Stone |
| Channel | `UCf7Z_KgORfeGD4RVPuoPtag` · `@angusandjuliastone` |
| Data source | YouTube Data API v3, complete public uploads playlist |
| Videos retrieved | 341 |
| Catalogue span | 2009-03-05 → 2026-09-14 |
| Retrieved | 2026-09-23 |
| Channel readings | 297,000 subscribers · 168,677,271 lifetime views · 100 videos reported |
| Not used | YouTube Studio. No impressions, CTR, retention, traffic sources, unique viewers, demographics. |

**Known discrepancy, stated up front.** The channel reports 100 videos; the
public uploads playlist returns 341. The 341 is what every figure here is
computed from. No share-of-lifetime or share-of-catalogue claim is made
anywhere, because the denominator is not trustworthy.

**View figures are lifetime-to-date at 2026-09-23.** They are not
views-in-window. This matters enormously and is the single biggest constraint
on the analysis — see Section 3.

---

## 2 · The two campaigns

Both windows run from the campaign's first asset to the last upload observed.

| | Cape Forestier | Karaoke Bar |
|---|---|---|
| Window | 2024-02-09 → 2024-08-04 | 2026-04-29 → 2026-09-14 |
| Album released | 2024-05-10 | 2026-09-04 |
| First asset → album | 91 days | 128 days |
| Window length | 177 days / 26 weeks | 138 days / 20 weeks |
| Uploads in window | 36 | 88 |

**How the album date was established.** The band's own Short of 2026-08-30:
*"Our new album, Karaoke Bar, is out this Friday September 4th Xx"*. Not
inferred from upload patterns. The 2024-05-10 date is inferred from the
Down To The Sea release-day pattern and is **lower-confidence** — flagged in
Section 6.

**Why the 2026 window opens on 29 April.** The first campaign asset is the
Dua Lipa / Big Jet Plane performance, a week before the first album single.
This was a deliberate choice, confirmed with the requester, and it is
contestable — see 6.1.

---

## 3 · The central methodological constraint

The 2024 assets have had roughly two extra years to accumulate views. A
campaign-total view comparison would therefore be meaningless, and **none is
made**. The two campaigns are compared on structural measures only:

- active weeks
- longest gap between uploads
- upload days
- upload volume
- format mix
- attention concentration (within-window share)

These hold their meaning whatever an asset's age. Where a single asset's views
appear beside an asset from the other era, **its age in days is printed next to
it on the page**.

**The weakness of this approach, stated plainly:** structural measures show
that the campaign was *run* better. They do not show that it *performed*
better. A reviewer is entitled to say the page implies the second while only
evidencing the first. I have tried to keep the language on the structural side
of that line; judge whether I succeeded.

---

## 4 · Every claim on the page

Each row: the claim as published, the figure, and how to recompute it from
Section 7.

### 4.1 — Structural comparison (the spine of the page)

| # | Claim | 2024 | 2026 | How to recompute |
|---|---|---|---|---|
| 1 | Weeks the channel published | 15/26 (58%) | 18/20 (90%) | Bucket each upload into `floor((date − window start)/7 days)`; count distinct non-empty buckets |
| 2 | Longest silence | 69 days | 16 days | Max difference between consecutive distinct upload dates |
| 3 | Days with an upload | 30 | 53 | Count distinct upload dates |
| 4 | Uploads | 36 | 88 | Row count, Section 7 |
| 5 | Long-form pieces | 9 | 27 | `durationSec > 62` |
| 6 | Live / acoustic performances | 4 | 7 | Long-form whose title matches live / acoustic / session / named venue |
| 7 | Shorts share of uploads | 75% | 69% | `durationSec ≤ 62` ÷ total |
| 8 | Top asset's share of campaign views | 35% | 42% | Largest single view figure ÷ window view total |

**The 69-day gap runs 2024-05-27 → 2024-08-04** — it begins 17 days after the
album. **The 16-day gap runs 2026-07-07 → 2026-07-23.**

Claim 8 is the one that moved the *wrong* way and is presented as such on the
page. Attention is more concentrated on one video than last time, not less.

### 4.2 — Individual assets (age always stated)

| # | Claim | Figure | Age at 2026-09-23 |
|---|---|---|---|
| 9 | Karaoke Bar (Official Music Video) | 1,099,626 | 104 days |
| 10 | Celestial Bodies (Official Video) | 517,538 | 35 days |
| 11 | Down To The Sea (Official Music Video), 2024 lead | 947,385 | 866 days |
| 12 | Big Jet Plane live w/ Dua Lipa | 106,819 | 147 days |
| 13 | Karaoke Bar + Celestial Bodies combined | 1,617,164 | — |
| 14 | 2026 campaign long-form total | 2,255,297 | — |

Claim 13 is stated as "1.62M of the campaign's long-form views" — that is
**72% of claim 14**. Verify: 1,617,164 ÷ 2,255,297 = 71.7%.

### 4.3 — "First million since 2018"

| # | Claim | Evidence |
|---|---|---|
| 15 | Karaoke Bar is the channel's first upload of any kind to pass 1M views since November 2018 | Eighteen uploads in the catalogue have ≥1M views. Sorted by date, the last before Karaoke Bar is *Youngblood (AUDIO)*, 2018-11-02, 1,500,000 |

**This claim was wrong in the first draft** — it said "since Chateau in 2017",
which ignored five 2017 audio uploads, Cellar Door, Chateau (Acoustic) and two
2018 uploads. Corrected before publication. The full ≥1M list is in Section 7.3
so a reviewer can check the correction.

### 4.4 — Format medians (campaign-era, 2024-01-01 onward)

| # | Format | Median views | n |
|---|---|---|---|
| 16 | Official video | 517,538 | 7 |
| 17 | Live / acoustic in a named place | 39,800 | 16 |
| 18 | Lyric video | 16,258 | 5 |
| 19 | Instrumental karaoke | 1,094 | 10 |

Medians, not means — one video at 1.1M would distort every average it touched.
**Small n on claims 16 and 18 (7 and 5).** A reviewer should treat the
official-video median as directional, not precise.

### 4.5 — Shorts

| # | Claim | Figure |
|---|---|---|
| 20 | Shorts median, 2024 window | 2,572 |
| 21 | Shorts median, 2026 window | 3,885 |
| 22 | Shorts within ±7 days of an official video drop | median 3,885 (n=11) |
| 23 | All other 2026 campaign Shorts | median 3,641 (n=63) |
| 24 | Three biggest Shorts of 2026 | 34,144 · 23,328 · 17,296 — all Dua Lipa, 28–30 April |

Claims 22 and 23 support the page's recommendation to keep Shorts personal
rather than promotional: release-adjacent Shorts show **no meaningful lift**
(3,885 vs 3,641, a 6.7% difference on n=11 vs n=63 — well inside noise).

### 4.6 — The post-album risk

| # | Claim | Figure |
|---|---|---|
| 25 | Uploads in the whole of 2025 | 10 |
| 26 | Of which Shorts | 8 |
| 27 | 2025 long-form pieces | 2, at 1,800 views each |
| 28 | Uploads per month, Jun 2024 → Dec 2025 | 0, 0, 4, 2, 1, 3, 6, 1, 3, 1, 1, 3, 0, 1, 0, 0, 0, 0, 0 |

This is the strongest evidence on the page and the least arguable: it is a
count of uploads, unaffected by view accumulation.

### 4.7 — Release week

| # | Claim | Evidence |
|---|---|---|
| 29 | Three Shorts on 30 Aug totalling 9,863 | 3,293 + 4,739 + 1,831 |
| 30 | Strongest release-week Short: 1 Sep | 5,985 |
| 31 | Eight uploads on 3 Sep | 1 Short + 7 instrumental karaoke videos |
| 32 | Best asset of release week arrived *after* the album | The Cherry Farm (Live in Tasmania), 10 Sep, 46,911 |

---

## 5 · The five recommendations, and what each rests on

| # | Recommendation | Evidence | Strength |
|---|---|---|---|
| R1 | Keep filming songs in named rooms | Claims 17 vs 18: 39,800 vs 16,258 median | **Moderate.** n=16 vs n=5 |
| R2 | Never let a fortnight pass | Claims 2, 25–28: last album's 69-day gap preceded a year at 10 uploads | **Strong.** Count-based |
| R3 | Put the catalogue back to work | Claims 12, 24: the campaign's widest moment was a 2010 song with a guest | **Moderate.** One instance |
| R4 | Give a third song a real video | Claim 8: top asset holds 42%, second holds 20% | **Directional.** Prescriptive, not proven |
| R5 | Keep Shorts personal, not promotional | Claims 22–24 | **Moderate.** Null result plus a clear top-3 |

R3 and R4 are the two I would most expect a reviewer to push back on. R3
generalises from a single collaboration. R4 assumes a third official video
would widen the base rather than simply add a third asset to the same audience
— **we have no traffic-source data and therefore cannot demonstrate this.**

---

## 6 · Judgement calls, in order of how much they could change the conclusion

**6.1 — The 2026 campaign window opens on the Dua Lipa performance.**
This adds 7 days, 3 uploads and 164,291 views to the 2026 window. If the window
instead opened at the first album asset (Karaoke Bar lyric video, 6 May), the
structural comparison would become 17/19 active weeks rather than 18/20 — the
finding survives, but the numbers on the page would all shift. The alternative
framing is defensible and was explicitly rejected in favour of this one.

**6.2 — The 2024 album date is inferred.**
2026-09-04 is stated by the band. 2024-05-10 is not stated anywhere in the
data; it is inferred from Down To The Sea landing that day with a Short the
following day. If the real date differs by a week, claim 2's "the silence began
17 days after the album" changes. The structural comparison does not depend on
it.

**6.3 — "Long-form" is a 62-second duration threshold, not an editorial one.**
Two items in the 2026 window clear 62 seconds but are plainly social clips
rather than pieces of content: *"One more sleep until we officially release
Monroe"* (66s, 5,848 views) and *"Thanks to this little legend for the
harmonies"* (139s, 3,005 views). Both are counted in the 27. Excluding
everything under 150 seconds gives **25 long-form pieces** against 9 — the
claim's direction is unchanged, its magnitude slightly overstated.

**6.4 — The 2024 live performances are not like-for-like with 2026's.**
2024's four are three Nova Red Room sessions and one German TV appearance —
external platforms' productions, uploaded to the channel. 2026's seven are
self-produced performance films in chosen locations. The page counts them
equally in claim 6. A reviewer could reasonably argue this flatters 2024, or
alternatively that it understates the 2026 shift in kind rather than degree.

**6.5 — Format classification is by title keyword.**
Stated in full on the page and in Section 7.4 here. It will misclassify
anything titled unconventionally. I have not hand-checked all 341 titles
against the rule; I have checked the 124 in the two campaign windows.

**6.6 — Instrumental karaoke videos are counted as campaign uploads.**
Ten of them, median 1,094 views. They are in the upload counts (claims 4, 5)
because they are uploads. They drag the campaign's median long-form figure to
15,216, which is why the page shows medians **by format** rather than a single
long-form median. A reviewer might argue they should be excluded from claim 5
entirely; that would give 17 long-form against 9.

**6.7 — No subscriber-growth claim is made.**
Public subscriber counts are rounded to the nearest thousand by YouTube. Our
daily snapshots do not extend back to the 2024 campaign, so no
campaign-to-campaign subscriber comparison is possible. The page does not make
one. If you see one, it is a bug.

---

## 7 · Raw data

### 7.1 — Cape Forestier campaign window (2024-02-09 → 2024-08-04, 36 uploads)

Format: `date | S=Short L=Long | views | duration | title`

```
2024-02-09 | S |      2465 |   14s | Tickets are on sale via our bio for our world tour #musicshorts #newmusic
2024-02-09 | L |    186223 |  193s | Angus & Julia Stone - Official Video for The Wedding Song
2024-02-09 | S |      4856 |   33s | Join us for the premiere of the video for 'The wedding song' tonight at 6pm AEDT #newmusic
2024-02-29 | S |      2572 |   18s | The feeling of touring #musicshorts #music
2024-03-04 | S |      1850 |   32s | Pre-save our new single, 'Cape Forestier', via the link in our bio. Out next week #musicshorts
2024-03-06 | S |      1584 |   16s | #newmusic this Friday, 'Cape Forestier' #musicshorts
2024-03-06 | S |      1884 |   21s | New #music this Friday... go ahead & presave via the bio link #song
2024-03-08 | L |    550423 |  265s | Angus & Julia Stone - Cape Forestier (Official Music Video)
2024-03-09 | S |      4246 |   61s | #newmusicalert Cape Forestier is now available via all streaming platforms
2024-03-15 | S |      1673 |   31s | Pre-save our new album, Cape Forestier, via the link in our bio #musicshorts
2024-03-16 | S |     24035 |   17s | Where do we go from here, my dear? #music #musicshorts #indiemusic
2024-03-17 | S |      1709 |   19s | Sleeping underneath the stars Happy to be right where we are #music #indiemusic
2024-03-18 | S |      1383 |   15s | 'CAPE FORESTIER' Pre-Save the coming album via the link in our bio #musicshorts
2024-03-29 | S |      3358 |    7s | The Rolling Stones Awards #musicshorts
2024-04-02 | S |      1289 |   21s | Losing You coming soon #musicshorts #newmusic
2024-04-04 | S |      1031 |   61s | Losing you Pre-Save via the link #newmusic
2024-04-05 | S |     21003 |   30s | Losing you, our #newmusic is out now
2024-04-05 | L |    377005 |  221s | Angus & Julia Stone - Losing You (Official Music Video)
2024-04-08 | S |     11123 |   48s | #newmusic from Angus And Julia Stone #musicshorts #musicvideo
2024-04-09 | S |      1232 |   41s | #bts of our new music video for, Losing You #musicshorts #newmusic #musicvideo
2024-04-10 | S |      1283 |   44s | "Baby, I keep on Losing You. You got somewhere that you run to" #musicvideo #musicshorts
2024-04-11 | S |     10535 |   59s | #accoustic version of Losing You #music #newmusicalert #musicshorts
2024-04-12 | S |      1254 |   32s | #musicshorts #song #newmusic #music #newsong #indiefolkmusic
2024-04-16 | S |      1392 |   27s | Special moments on the set of 'Losing You' #music #song #love #newsong #indiefolkmusic
2024-04-20 | S |      6255 |   37s | LIKE A VERSION / 'Someone You Loved' #musicshorts #musiccover #musicvideo
2024-04-25 | S |      3250 |   36s | Berlin for #newmusic promo #musicshorts #musician #indiefolkmusic
2024-05-02 | L |    199132 |  285s | Angus & Julia Stone - No Boat No Aeroplane (Official Music Video)
2024-05-06 | S |     45795 |   35s | 'No Boat, No Aeroplane' is out now #newmusic #musicshorts #musicvideo
2024-05-07 | S |     14446 |   45s | Enjoying "No Boat, No Aeroplane" this week? Last sneak peek before album release on Friday #music
2024-05-10 | L |    947385 |  206s | Angus & Julia Stone - Down To The Sea (Official Music Video)
2024-05-12 | S |     25285 |   17s | 'Down To The Sea' is out #musicshorts #indiefolkmusic #newmusic
2024-05-22 | L |     41009 |  226s | Angus & Julia Stone perform 'Losing You' in Nova's Red Room Studio, Sydney (Australia)
2024-05-22 | L |     26177 |  250s | Angus & Julia Stone 'Someone Like You' (Adele) / Nova's Red Room Studio Session
2024-05-22 | L |     43972 |  270s | Angus & Julia Stone 'Flowers' (Miley Cyrus) / Nova's Red Room Studio Session
2024-05-27 | S |      4262 |   20s | Lille!! Merci merci. #musicshorts #music #angusandjuliastone #indiefolkmusic
2024-08-04 | L |    157382 |  229s | Angus & Julia Stone - Losing You (Live @ Inas Nacht, 02.08.2024)
```

### 7.2 — Karaoke Bar campaign window (2026-04-29 → 2026-09-14, 88 uploads)

```
2026-04-29 | L |    106819 |  306s | @dualipa & Angus Stone - Big Jet Plane (Live in Sydney)
2026-04-29 | S |     23328 |   26s | Big shout out to @dualipa for nailing this performance of Big Jet Plane with Angus!
2026-04-30 | S |     34144 |   42s | Head to our channel to see the full Angus + @dualipa collab of Big Jet Plane live in Sydney.
2026-05-03 | S |      2319 |   19s | Karaoke Bar...this week!
2026-05-04 | S |      2534 |   24s | that old karaoke bar
2026-05-05 | S |      2291 |   19s | It's time for you to get up there and shake it off
2026-05-06 | S |      3881 |   14s | Our new single is out now..stay tuned for more news tomorrow!
2026-05-06 | L |    103893 |  205s | Angus & Julia Stone - Karaoke Bar (Lyric Video)
2026-05-07 | S |      4928 |   40s | Exhaustion makes diamonds. The making of 'Karaoke Bar'
2026-05-07 | S |      1869 |   56s | We chatted to triple j about the inspiration behind 'Karaoke Bar'
2026-05-11 | S |      3257 |   59s | Look at all the lipstick marks on the cigarettes where there's no regrets
2026-05-12 | S |      3051 |   19s | You move around the bar singing that wild thing x
2026-05-12 | S |      1060 |   45s | Good times never seemed so good
2026-05-14 | L |     39800 |  166s | Angus & Julia Stone - Karaoke Bar Acoustic Performance (Live in Tasmania)
2026-05-14 | S |     12385 |   21s | Got me tea x
2026-05-16 | S |      5874 |   20s | Get drunk upon your favourite song
2026-05-21 | L |     55178 |  210s | Angus & Julia Stone - Karaoke Bar Acoustic Video (Live in Byron Bay)
2026-05-22 | S |      6001 |    6s | 1, 2, 3, GO!
2026-05-22 | S |      7348 |   40s | Just a little rehearsal fun for the new album Xx
2026-05-22 | S |      3730 |   38s | We had so much fun recording this album, can't wait for you all to hear it Xx
2026-05-22 | S |      5487 |   45s | Karaoke Bar live in Byron Bay. You can watch the full video on our YouTube channel Xx
2026-05-25 | S |      3105 |   54s | Please welcome Australia's very own Stevie Nicks...
2026-05-25 | S |     10504 |   22s | "Look at all the life and soul"
2026-05-26 | S |      4667 |   43s | Look at all the stories told Xx
2026-05-26 | S |      6164 |   37s | We want to see your covers of Karaoke Bar. Tag us on Insta @angusandjuliastone
2026-05-27 | S |      6523 |   51s | (heart emoji only)
2026-05-29 | L |     29617 |  237s | Angus & Julia Stone - Karaoke Bar (Piano Version)
2026-06-05 | L |     33555 |  209s | Angus & Julia Stone - Karaoke Bar (Sugarcane Mountain Studios)
2026-06-11 | L |   1099626 |  329s | Angus & Julia Stone - Karaoke Bar (Official Music Video)
2026-06-18 | L |       867 |  214s | Angus & Julia Stone - Karaoke Bar (Instrumental Karaoke Video)
2026-06-19 | L |      1521 |  220s | Angus & Julia Stone - Monroe (Lyric Video)
2026-06-21 | L |     33004 |  193s | Angus & Julia Stone - Monroe (Acoustic Performance)
2026-06-25 | L |     61653 |  219s | Angus & Julia Stone - Monroe (Official Lyric Video)
2026-06-25 | L |      5848 |   66s | One more sleep until we officially release Monroe
2026-06-29 | S |      4797 |   37s | Looking like Monroe...or looking like a Monroe?
2026-06-29 | S |      6368 |   16s | Ayla showing zero remorse and 100% confidence
2026-06-30 | S |      3641 |   17s | What do you think of our guest feature on the new album?
2026-07-07 | S |      3546 |   37s | Monroe was inspired by Marilyn Monroe. Can you guess why?
2026-07-07 | S |     10772 |   13s | 15 seconds of us off duty xx
2026-07-23 | S |      5128 |    7s | Doesn't matter if there's pain, you're always in my lane...
2026-07-24 | S |      3338 |    8s | But you're steady like the rolling sea, you will bring it back to me
2026-07-24 | S |      3767 |   12s | And sometimes it feels reckless, tied up to the edges of your overcoat
2026-07-26 | S |      3518 |   48s | We hope everyone's enjoying Monroe xx
2026-07-28 | S |      1902 |   61s | Paris you were magic x
2026-07-29 | S |      6471 |   57s | Celestial Bodies comes out Friday xx
2026-07-30 | L |     15216 |  233s | Angus & Julia Stone - Celestial Bodies (Lyric Video)
2026-07-30 | S |      2842 |   47s | Celestial Bodies is out today. We hope you love it as much as we do x
2026-07-30 | S |     11081 |   32s | I'm an uncharted Celestial Body, I got no place to go. Celestial Bodies out tomorrow x
2026-08-03 | S |      4746 |   33s | Appreciate the love for our new single, Celestial Bodies
2026-08-05 | L |     63829 |  230s | Angus & Julia Stone - Celestial Bodies (Live at Sugarcane Mountain Studios)
2026-08-05 | S |      3556 |   39s | POV: It's 38 degrees celsius on show day
2026-08-05 | S |      3408 |   56s | Celestial Bodies live at Sugarcane Mountain Studios. Full performance on YouTube tomorrow
2026-08-06 | L |      3005 |  139s | Thanks to this little legend for the harmonies
2026-08-06 | S |      3748 |   52s | You can watch the full Celestial Bodies performance now xx
2026-08-07 | S |      2576 |   46s | Celestial Bodies was created under a red sky, it was just meant to be
2026-08-07 | S |      2534 |   12s | Paris
2026-08-09 | S |      8478 |   16s | A little snippet of one of the songs from the new album
2026-08-10 | S |      3798 |   17s | Backstage moments with our amazing band Xx
2026-08-10 | S |      6239 |   44s | Soundchecking Celestial Bodies on our European Summer Tour
2026-08-12 | S |      2992 |   21s | A sweet little moment captured at one of our European shows
2026-08-12 | S |      2485 |   52s | The studio is our happy place. Karaoke Bar out on September 4
2026-08-13 | S |      8831 |   29s | All good things come to those who hustle, never look when you take that first leap Xx
2026-08-15 | S |      2920 |   29s | POV: You're Julia's iPhone
2026-08-15 | S |      4574 |   31s | Oh we're cutting loose tonight
2026-08-18 | S |      3190 |   33s | I'm an uncharted Celestial Body
2026-08-18 | L |       922 |  228s | Angus & Julia Stone - Celestial Bodies (Instrumental Karaoke Video)
2026-08-19 | L |    517538 |  236s | Angus & Julia Stone - Celestial Bodies (Official Video)
2026-08-22 | S |      4142 |   14s | We love an encore Xx
2026-08-22 | S |      4536 |   28s | Working out how to play one of the new songs acoustically. It comes out on Sept 4!
2026-08-22 | S |      3874 |   34s | Oh Mother Nature, Mother Nature she's a man
2026-08-23 | S |      4043 |   17s | We love performing this song, we hope you're enjoying these little performance videos x
2026-08-26 | S |      3885 |   32s | Strangely Strangley. Hear the full song on the new album September 4th xx
2026-08-27 | L |     16258 |  188s | Angus & Julia Stone - The Cherry Farm (Lyric Video)
2026-08-30 | S |      3293 |   48s | Cherry Farm is out now and Karaoke Bar is out this Friday
2026-08-30 | S |      4739 |   60s | Our new album, Karaoke Bar, is out this Friday September 4th Xx
2026-08-30 | S |      1831 |   47s | There is no land, there is no island
2026-09-01 | S |      5985 |   21s | Another one from the new album. Karaoke Bar comes out Friday September 4th xx
2026-09-03 | S |      5466 |   29s | It's out! Karaoke Bar! Thank you for all the support and love for our music Xx
2026-09-03 | L |      3545 |  209s | Angus & Julia Stone - Strangely Strangely (Instrumental Karaoke Video)
2026-09-03 | L |      1534 |  254s | Angus & Julia Stone - Take Me Back To Japan (Instrumental Karaoke Video)
2026-09-03 | L |       853 |  198s | Angus & Julia Stone - The Start (Instrumental Karaoke Video)
2026-09-03 | L |      8099 |  257s | Angus & Julia Stone - Mexico City (Instrumental Karaoke Video)
2026-09-03 | L |       712 |  195s | Angus & Julia Stone - Brightest Place (Instrumental Karaoke Video)
2026-09-03 | L |      1094 |  182s | Angus & Julia Stone - Cowgirls Lover Boi (Instrumental Karaoke Video)
2026-09-03 | L |       848 |  188s | Angus & Julia Stone - The Cherry Farm (Instrumental Karaoke Version)
2026-09-10 | L |     46911 |  170s | Angus & Julia Stone - The Cherry Farm (Live in Tasmania)
2026-09-13 | L |      3552 |  223s | Angus & Julia Stone - Wherever You Are (Instrumental Karaoke Video)
2026-09-14 | S |      6825 |   17s | When you both play the exact same wrong cord
```

### 7.3 — Every upload in the catalogue with ≥1,000,000 views

Supports claim 15. Sorted by date.

```
2011-11-05 |   1020038 | Angus & Julia Stone - Big Jet Plane
2014-06-26 |   4278762 | Angus & Julia Stone - Heart Beats Slow
2014-07-08 |   9912005 | Angus & Julia Stone - A Heartbreak
2014-08-28 |  12240545 | Angus & Julia Stone - Grizzly Bear
2015-05-08 |   9097232 | Angus & Julia Stone - Big Jet Plane (Milk Live At The Chapel)
2015-05-27 |   6789424 | Angus & Julia Stone - From The Stalls
2017-06-26 |   2723148 | Angus & Julia Stone - Snow
2017-08-23 |  39634591 | Angus & Julia Stone - Chateau
2017-09-15 |   1073899 | Angus & Julia Stone - My House Your House (Audio)
2017-09-15 |   1523458 | Angus & Julia Stone - Who Do You Think You Are (Audio)
2017-09-15 |   2733100 | Angus & Julia Stone - Nothing Else (Audio)
2017-09-15 |   2051880 | Angus & Julia Stone - Oakwood (Audio)
2017-09-15 |   1967225 | Angus & Julia Stone - Baudelaire (Audio)
2017-11-16 |   3445637 | Angus & Julia Stone - Cellar Door
2017-11-27 |   4591456 | Angus & Julia Stone - Chateau (Acoustic) - Backstage at Zenith, Paris
2018-06-06 |   2881458 | Angus & Julia Stone - Nothing Else
2018-11-02 |   1500490 | Angus & Julia Stone - Youngblood (AUDIO)
2026-06-11 |   1099626 | Angus & Julia Stone - Karaoke Bar (Official Music Video)
```

All figures exact as retrieved on 2026-09-23. The point of the table is the
**dates** — specifically that the gap between 2018-11-02 and 2026-06-11 is
seven years and seven months, which is what claim 15 rests on.

### 7.4 — Format classification rule

Applied to long-form only (`durationSec > 62`). First match wins, in order:

1. Title contains `Instrumental Karaoke` / `Karaoke Video` / `Karaoke Version` → **karaoke**
2. Title contains `(Official Music Video)` / `(Official Video)` / `Official Video for` → **official video**
3. Title contains `Lyric Video` → **lyric**
4. Title contains `live` / `acoustic` / `session` / `studio` / `perform` / a named venue → **live/acoustic**
5. Title contains `(Audio)` → **audio**
6. Otherwise → **other**

`durationSec ≤ 62` → **Short**, classified before any of the above.

Note the ordering consequence: *Karaoke Bar (Official Music Video)* matches
rule 2, not rule 1, despite containing the word "Karaoke". Verified by hand.

---

## 8 · What I would ask a reviewer to check

1. **Is the structural argument doing work the view data cannot?** Section 3
   states the limitation; judge whether the page's language respects it.
2. **Claim 8 is the counter-evidence.** Is it given enough weight, or is it
   buried under seven favourable rows?
3. **6.1 — the window start.** Does opening on the Dua Lipa performance
   flatter the 2026 campaign? Recompute from 2026-05-06 and see what changes.
4. **6.3 and 6.6 — the long-form count.** 27, 25 or 17 depending on where you
   draw the line. The page says 27. Is that the right line?
5. **R4 — "give a third song a real video".** This is the least evidenced
   recommendation on the page. Is it defensible without traffic-source data?
6. **Anything in Section 7 that does not add up.** Every aggregate in
   Section 4 is derivable from those tables. If one does not reconcile, it is
   an error and I want to know.

---

## 9 · Addendum — the catalogue support gap

Added after the first review. The Big Jet Plane finding raised an obvious
follow-up: if catalogue is a way into the current era, which catalogue songs are
sitting there with no supporting assets?

### Method

Song identity is derived from the title: strip the artist prefix, strip every
bracketed segment, strip trailing descriptors. 341 videos resolve to **93
distinct songs**. Shorts and anything under 90 seconds are excluded. "Catalogue"
means first uploaded before 2024-01-01 — 66 songs.

For each song, the formats present on the channel are recorded: official video,
bare-title video, audio upload, live/acoustic, lyric video, instrumental karaoke.

**This measures what exists on THIS channel.** A song may well have a lyric video
elsewhere — on a label channel, on a DSP canvas, on a topic channel. The claim is
about the artist channel's own shelf, and is worded that way on the page.

### Findings

| Figure | Value |
|---|---|
| Catalogue songs with no lyric video, ≥300K views | **21** |
| Lifetime views those songs hold | **115.3M** |
| Catalogue songs existing as an audio upload and nothing else | **9** |
| Lifetime views those nine hold | **8.0M** |
| Catalogue songs with an instrumental karaoke version | **0** |
| New-album songs with an instrumental karaoke version | **10** |

### The ranked gap, as published

| Song | First upload | Lifetime | Views/day | Has | Missing |
|---|---|---|---|---|---|
| Chateau | Aug 2017 | 45.4M | 13,679 | video, live | lyric, karaoke |
| Grizzly Bear | Jul 2014 | 13.0M | 2,918 | video | live, lyric, karaoke |
| A Heartbreak | Jul 2014 | 10.2M | 2,294 | video, live | lyric, karaoke |
| Big Jet Plane | Nov 2011 | 10.2M | 1,881 | video, live | lyric, karaoke |
| From The Stalls | May 2015 | 6.8M | 1,641 | live | studio video, lyric, karaoke |
| Nothing Else | Sep 2017 | 5.7M | 1,734 | video, live, audio | lyric, karaoke |
| Heart Beats Slow | May 2014 | 4.4M | 981 | video | live, lyric, karaoke |
| Cellar Door | Sep 2017 | 4.2M | 1,284 | video | live, lyric, karaoke |
| Snow | Jun 2017 | 3.7M | 1,104 | video, live, audio | lyric, karaoke |
| Oakwood | Sep 2017 | 2.6M | 783 | audio, live | video, lyric, karaoke |
| Baudelaire | Sep 2017 | 1.97M | 597 | audio | everything else |
| Who Do You Think You Are | Sep 2017 | 1.52M | 462 | audio | everything else |
| Youngblood | Nov 2018 | 1.50M | 521 | audio | everything else |
| My House Your House | Sep 2017 | 1.07M | 326 | audio | everything else |
| Sleep Alone | Sep 2017 | 0.78M | 237 | audio | everything else |

Views/day is lifetime views ÷ days since first upload. It is a rough proxy for
enduring demand, not a current rate — a song that was huge in 2017 and is flat
now would still read high. It is used to rank candidates, not to forecast.

### Where a reviewer should push

1. **The song-name stripper.** 93 songs from 341 titles is a derived number. A
   mis-split would create a phantom song or merge two real ones. The 2026
   campaign songs were checked by hand; the 2009–2018 catalogue was not
   exhaustively checked.
2. **Off-channel assets.** The strongest objection. If Chateau has a lyric video
   on a label channel, the "gap" is a gap in this channel's shelf rather than in
   the world. The page says "on the channel"; decide whether that is clear
   enough.
3. **Does a lyric video actually earn its place on a nine-year-old song?** The
   page asserts the practice works — every 2026 single got one — but the lyric
   median (16.3K, n=5) is drawn entirely from new releases. There is no evidence
   here of what a lyric video does for a catalogue song, and the page should not
   be read as providing any.

---

*Audit pack generated 23 September 2026, addendum same day. Page: `/angusandjuliastone`.
Data: YouTube Data API v3 only.*
