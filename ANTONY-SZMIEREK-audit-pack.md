# ANTONY SZMIEREK × YouTube — independent audit pack

Paste this whole document into ChatGPT (or any other model) as a single message.
It is self-contained: the complete source data, the campaign context, and every
claim the analysis currently makes. No links need to be followed and no files
need to be opened.

> **Status: this audits the ANALYSIS, not a finished deck.** The deep dive has
> not been built yet. What follows is the evidence base and the conclusions
> drawn from it. Catching a bad number here is far cheaper than catching it on
> a slide.

---

## INSTRUCTIONS TO THE REVIEWER

You are an adversarial fact-checker. Assume each claim is wrong until the data
below proves it. Do not be agreeable.

1. Recompute every number in PART 4 from the table in PART 2. Write your own
   arithmetic; do not trust the stated figure.
2. Separate your findings into:
   - **(a) WRONG** — the arithmetic does not hold.
   - **(b) MISLEADING** — the arithmetic holds but the wording implies a
     different population, a stronger claim, or a causal story the data cannot
     support.
   - **(c) UNSUPPORTED** — no basis in the data at all (invented dates, invented
     causes, "X is the strongest signal" with nothing behind it).
   - **(d) SMALL SAMPLE STATED AS LAW** — true of the handful of items measured,
     written as though true generally.
3. Pay particular attention to comparisons between uploads of **different ages**.
   This is the single most likely place for an error in this analysis.
4. For each issue: quote the claim, say what the data actually supports, and give
   the corrected wording.
5. End with the three claims you consider weakest even where not strictly wrong,
   and anything you think the analysis has MISSED in the data.

---

## PART 1 — WHAT THIS IS

Antony Szmierek is a Manchester/Stockport spoken-word and electronic artist.
His album **DECODING BIRDSONG** was released **21 August 2026**. The campaign is
in its post-album sustain phase: the label is rolling out an Official Lyric Video
roughly every week for album tracks, with five more scheduled through to
18 October.

The deep dive being audited asks: what worked, what is still working, what is the
label already doing right, what have we learned about the audience, and what can
be added now to give the album a longer life.

### Sources

| Source | What it gives | Pulled |
|---|---|---|
| YouTube Data API v3 via `/api/full-catalogue?handle=@antonyszmierek` | All 66 public uploads with title, description, publish date, duration, views, likes, comments, tags, `liveStreamingDetails` | 14 Sep 2026, 16:12 UTC |
| YouTube Data API v3 via `/api/comment-scan` (`commentThreads`) | 535 public top-level comments across 21 videos | 14 Sep 2026, 16:38 UTC |
| Watcher — `/watcher/antonyszmierek` | Channel state, recent movement, campaign day count | 14 Sep 2026 |
| Campaign Coach — `/coach/antony-szmierek-antony-szmierek-campaign` | What the label has released and what is scheduled | 14 Sep 2026 |

**No YouTube Studio data is used anywhere.** Nothing about traffic sources, watch
time, retention, impressions, click-through or promotion is claimed. Channel ID
`UC-VwXR6M4HD4Wo1UpTBi4SA`.

### Known data problem, stated up front

The 66 current public uploads sum to **702,642 views**. The API's channel
`viewCount` is **1,130,576**. The gap of **427,934 views** is not explained by
the current catalogue — most likely views on uploads that have since been made
private, unlisted or deleted, though the public API cannot confirm this.

**Consequence:** no claim in this analysis expresses anything as a percentage of
*lifetime* views. Shares are computed against the 702,642 total of current public
uploads, and say so. Check that this discipline holds everywhere.

---

## PART 2 — SOURCE DATA: ALL 66 PUBLIC UPLOADS

Newest first. "Live/prem" = the video carries `liveStreamingDetails`
(scheduledStartTime + actualStartTime + wasLive), i.e. it was premiered or
streamed rather than published as a normal upload.

| # | Video ID | Date | Type | Secs | Views | Likes | Comments | Live/prem | Title |
|---|---|---|---|---|---|---|---|---|---|
| 1 | UevSqYI_oVk | 2026-09-10 | Long | 187 | 505 | 21 | 4 | — | Antony Szmierek - You're Not Supposed To Do This Forever (Official Lyric Video) |
| 2 | we_8ev9RhPE | 2026-09-03 | Long | 99 | 719 | 19 | 5 | — | Antony Szmierek - The Same Heron Again (Official Lyric Video] |
| 3 | VExP3_NwpeM | 2026-08-28 | Long | 211 | 1685 | 52 | 4 | — | Antony Szmierek - Bookie's Favourite (feat. Ellur) [Official Lyric Video] |
| 4 | bbasdP-u4WA | 2026-08-21 | Long | 206 | 2966 | 82 | 6 | — | Antony Szmierek - The First Five Minutes Of Magnolia (feat. Pretty Girl) [Official Lyric Video] |
| 5 | Bns4zGjlpKA | 2026-08-10 | Short | 10 | 1570 | 16 | 0 | — | flight simulator, starring Craig Cash |
| 6 | zMSe5rukv8M | 2026-08-07 | Short | 33 | 358 | 14 | 1 | — | today we attempt to land Flight Simulator |
| 7 | bPq-zhiC3aw | 2026-08-07 | Long | 301 | 11706 | 519 | 105 | yes | Antony Szmierek - Flight Simulator (feat. Imogen and the Knife) [Official Video] |
| 8 | G0SYbDMJbJ4 | 2026-07-09 | Short | 28 | 1053 | 36 | 3 | — | Seminal #electronicmusic #antonyszmierek |
| 9 | y875VU7Sac0 | 2026-06-30 | Long | 189 | 14473 | 441 | 29 | — | Antony Szmierek - Seminal (Official Video) |
| 10 | z-lnilhTpYk | 2026-06-29 | Short | 33 | 801 | 17 | 0 | — | Find something to love #antonyszmierek #electronicmusic #livemusic |
| 11 | q3MWzlSJ1VU | 2026-06-23 | Short | 18 | 1667 | 24 | 0 | — | Your never be alone again my love #antonyszmierek #live |
| 12 | 611mkjfzHtQ | 2026-06-18 | Short | 32 | 1469 | 29 | 1 | — | everyone can face a crisis #livemusic |
| 13 | kOahOSaL2u4 | 2026-06-16 | Short | 25 | 143 | 11 | 0 | — | Im on the edge.... |
| 14 | PLQCFlwXXgg | 2026-05-08 | Short | 35 | 817 | 20 | 2 | — | Decoding Birdsong UK/IE tour on sale right now!! |
| 15 | 3NmrnehrF-Y | 2026-05-05 | Short | 18 | 1400 | 23 | 0 | — | what if you had to play #snooker on a televised gameshow but you suddenly had massive hands? |
| 16 | TkTRa6a2zQI | 2026-05-05 | Long | 323 | 26718 | 709 | 43 | — | Antony Szmierek - Chalk (Official Video) |
| 17 | 54wiFGS8Slg | 2026-04-01 | Short | 27 | 791 | 23 | 1 | — | THE YOUNG AND THE DYING HAVE THE WORST PHILOSOPHIES, AND YOU ARE BOTH BUT ALSO NEITHER |
| 18 | 4s_t7hnEi0Q | 2026-03-11 | Short | 29 | 1874 | 71 | 4 | — | THE HERON, YOURS FOREVER |
| 19 | L8lAWBK0v9E | 2026-03-11 | Long | 189 | 39965 | 1125 | 141 | — | Antony Szmierek - The Heron (Official Video) |
| 20 | 74K4TNyZBjI | 2026-03-09 | Short | 8 | 730 | 32 | 1 | — | THE HORRORS PERSIST |
| 21 | 6lYtprWziyo | 2026-03-04 | Short | 9 | 278 | 9 | 0 | — | YOUR PERSONALITY HAS BEEN BROKEN APART AND SOLD BACK TO YOU IN A SERIES OF SHORT FORM CLIPS |
| 22 | ypqNwBzz8jU | 2026-03-02 | Short | 12 | 712 | 24 | 3 | — | THE HERON WAITS PATIENTLY |
| 23 | 8Jbid5OwE3E | 2026-01-16 | Long | 96 | 1042 | 30 | 3 | — | you can watch 'ever thought about getting to know yourself' in full now |
| 24 | Vta35XGavjo | 2025-12-29 | Long | 1356 | 2429 | 171 | 17 | yes | ever thought about getting to know yourself? |
| 25 | ASlqLIc5Vw4 | 2025-11-14 | Long | 143 | 6806 | 169 | 17 | — | Antony Szmierek - That Face You Make When It's Raining (Official Music Video) |
| 26 | xhqlOPAeUT8 | 2025-02-28 | Long | 211 | 16533 | 219 | 30 | — | Antony Szmierek - Take Me There (Official Visualiser) |
| 27 | ZvxRs2sqrEM | 2025-02-19 | Short | 28 | 988 | 29 | 0 | — | bruce bogtrotter core #newmusic |
| 28 | 5khQSfxgRBU | 2025-02-16 | Short | 32 | 906 | 29 | 2 | — | the man up the pole is 62 years old. message your mates and never stop being silly x |
| 29 | TNbmUTWRFJY | 2025-02-12 | Short | 52 | 1271 | 38 | 2 | — | szmierek live '25!! tickets on sale now bebeh!! #ontour #newmusic |
| 30 | GlElWbgnS4o | 2025-02-05 | Short | 26 | 365 | 19 | 4 | — | pre-order the record and get a personalised poem from me #newmusic #valentinesday |
| 31 | EPVwldsSQzQ | 2025-01-22 | Short | 32 | 246 | 12 | 0 | — | Angie's Wedding, Out Now |
| 32 | NuFT4ls68BA | 2025-01-22 | Long | 235 | 34505 | 525 | 51 | — | Antony Szmierek - Angie's Wedding (Official Music Video) |
| 33 | I6akcGxOBEI | 2025-01-21 | Short | 41 | 380 | 35 | 2 | — | No War But Class War. Tomorrow 9am |
| 34 | UnySdiwocKE | 2025-01-20 | Long | 66 | 310 | 9 | 1 | — | Angie's Wedding - Wednesday. RSVP at your convenience x #weddingcake #newmusic |
| 35 | 5Mj_IZIfV-Y | 2025-01-19 | Short | 28 | 678 | 17 | 0 | — | rafters live for @3voor12 xxx #newmusic #alternative |
| 36 | vvWkyhdqmhI | 2025-01-18 | Short | 19 | 881 | 10 | 0 | — | it's the wedding of the century… #newmusic |
| 37 | lZp5kGbeqk0 | 2025-01-16 | Short | 34 | 495 | 27 | 2 | — | it's the wedding of the century… #newmusic #wedding |
| 38 | cHWaNJkCNlw | 2024-11-21 | Short | 19 | 784 | 23 | 0 | — | downward-facing class traitor? accidental napper? #yoga #yogamusic #newmusic |
| 39 | iEPHboSL5rc | 2024-11-21 | Long | 184 | 53957 | 675 | 49 | — | Antony Szmierek - Yoga Teacher (Official Video) |
| 40 | DloCLWptg7c | 2024-11-16 | Short | 32 | 1017 | 51 | 3 | — | i'm a downward-facing class traitor #yoga #yogamusic #yogapractice |
| 41 | CPmQuCKaVg4 | 2024-10-24 | Short | 59 | 545 | 35 | 1 | — | makes you think #conspiracytiktok #stockport |
| 42 | AfzUlbrkTQc | 2024-10-16 | Short | 42 | 3924 | 101 | 3 | — | The Great Pyramid of Stockport shines bright. The Eight Wonder of the world #stockport #pyramid |
| 43 | XP8fS9WuGqU | 2024-10-03 | Long | 156 | 153698 | 1370 | 105 | — | Antony Szmierek - The Great Pyramid Of Stockport (Official Video) |
| 44 | BJPy6QAr7Og | 2024-10-03 | Short | 17 | 529 | 26 | 1 | — | Stockport or Giza? #stockport #pyramid |
| 45 | 26dzA9jmOEo | 2024-09-19 | Short | 16 | 1196 | 45 | 3 | — | the eighth wonder of the world is in stockport x |
| 46 | kZt69t3OsEQ | 2024-08-22 | Short | 61 | 531 | 28 | 3 | — | the poem that became Rafters #newmusic #spokenword #poetry |
| 47 | b0d_5DDoE1A | 2024-08-15 | Short | 37 | 824 | 30 | 1 | — | Tony's first billboard thank you spotify i feel like a supervillain #newmusic |
| 48 | RyZCGJRA3jI | 2024-08-09 | Short | 35 | 182 | 8 | 0 | — | there's a first time for everything Sweden #electronicmusic #newmusic |
| 49 | 03F2w7l88V0 | 2024-07-31 | Short | 26 | 351 | 11 | 0 | — | rafters coming thru ur radio right now!!! #electronicmusic #radio1 #stutterhouse |
| 50 | tDaAaTI4-1o | 2024-07-29 | Short | 47 | 1587 | 39 | 4 | — | rafters live at glastonbury !! #newmusic #electronicmusic #alternativemusic |
| 51 | 5H14Q8NptYg | 2024-07-25 | Short | 44 | 174 | 15 | 0 | — | rafters is out now!! #newmusic |
| 52 | NSbdyFT2x1Y | 2024-07-25 | Long | 188 | 99007 | 1733 | 127 | — | Antony Szmierek - Rafters (Official Video) |
| 53 | lJpdtSTtNx8 | 2024-07-24 | Short | 43 | 614 | 15 | 1 | — | the result: i also cry #electronicmusic #romania |
| 54 | _NSxb01m3iI | 2024-07-17 | Short | 59 | 2469 | 70 | 4 | — | a poem for England, as seen on Newsnight #poetry #euro2024 #newsnight |
| 55 | le-f7X4sVXg | 2023-11-16 | Long | 222 | 23412 | 288 | 22 | — | Antony Szmierek - Dance Better |
| 56 | KuHZJFUDtJw | 2023-09-27 | Short | 21 | 1004 | 34 | 2 | — | How Did You Get Here Full Video Out Now #newmusic #6music #antonyszmierek #alternative |
| 57 | vVP8KPVvHyM | 2023-09-27 | Long | 175 | 36760 | 454 | 45 | yes | Antony Szmierek - How Did You Get Here? |
| 58 | BJnw-xxexPU | 2023-09-17 | Short | 17 | 631 | 13 | 0 | — | you're probably wondering how i got here |
| 59 | LqZvcxbrMa4 | 2023-08-24 | Short | 39 | 585 | 21 | 2 | — | Antony Szmierek Headline Tour November 2023 |
| 60 | 7XxVlPMEkOo | 2023-08-11 | Long | 259 | 2498 | 61 | 7 | yes | Antony Szmierek - The Words to Auld Lang Syne (Porij Remix) |
| 61 | yvRJjTzQ4hM | 2023-07-12 | Long | 204 | 65557 | 683 | 67 | — | Antony Szmierek - The Words to Auld Lang Syne |
| 62 | d7EPNDZhBAk | 2023-03-24 | Long | 128 | 6548 | 78 | 4 | — | Antony Szmierek - Heaven is Other People |
| 63 | sZ0LC_H88pU | 2023-01-19 | Long | 170 | 41427 | 549 | 38 | yes | Antony Szmierek - Rock and a Calm Place (Official Video) |
| 64 | tfH0bHD9e3g | 2022-10-20 | Long | 266 | 8579 | 111 | 13 | yes | Antony Szmierek - Working Classic (LIVE @ VIBE) |
| 65 | lptnsKyQl04 | 2022-08-15 | Long | 203 | 11420 | 165 | 19 | — | Antony Szmierek - The Hitchhiker's Guide to the Fallacy (LIVE @ VIBE) |
| 66 | 6_xsP6LbNt0 | 2021-11-05 | Long | 232 | 2597 | 39 | 1 | yes | Antony Szmierek - Giving Up For Beginners (Live at Lock 91) |

---

## PART 3 — CAMPAIGN CONTEXT (non-numeric source facts)

### From the Campaign Coach — what the label has already done

Eight campaign moments are recorded as complete, 11 Mar – 11 Sep 2026, each with
a hero asset confirmed live on YouTube:

| Planned window | Moment | Asset now live |
|---|---|---|
| Mar 9–15 | The Heron — single release | The Heron (Official Video) |
| May 4–10 | Chalk — single + LP announce | Chalk (Official Video) |
| Jun 29 – Jul 5 | Seminal — single release | Seminal (Official Video) |
| Aug 3–9 | Flight Simulator — single + music video | Flight Simulator (Official Video) |
| Aug 17–23 | The First Five Minutes Of Magnolia — lyric video | lyric video live |
| Aug 24–30 | Bookie's Favourite — lyric video | lyric video live |
| Aug 31 – Sep 6 | The Same Heron Again — lyric video | lyric video live |
| Sep 7–13 | You're Not Supposed To Do This Forever — lyric video | lyric video live |

### From the Campaign Coach — what is scheduled

Five further Official Lyric Videos, one per week:

- **17 Sep** — Aussie Goldhunters
- **21–27 Sep** — Godzilla Hotel
- **28 Sep – 4 Oct** — Dave's Angling Superstore
- **5–11 Oct** — Commune
- **12–18 Oct** — Decoding Birdsong (title track)

Each scheduled moment carries a planned "3 SHORTS — tease · drop-day · follow-up"
and the plan's stated target is "~40–60 Shorts across the campaign — cluster 3
around every release, keep 1–2 a week between."

**This matters for the audit:** the label's own plan already calls for Shorts.
Any recommendation that amounts to "post more Shorts" is telling them something
they have already written down. Flag it if the analysis does that.

### From the Watcher (14 Sep 2026)

- Campaign · ACTIVE · **DAY 25** · campaign views **5.8K** across **4 assets**
- Channel view delta **+255.6K** over 144 days tracked; subs gained **+1,230** over the same 144 days
- Recent movement: **+16.0K views**, **+30 subs**
- Uploads in 30 days: **4**, of which **0 Shorts**. Last upload 3 days ago.
- Watcher's own flag: "Only 0 Shorts in 30 days." Its stated consequence: *"Nothing urgent fails — the channel just keeps running at the current ceiling."*
- Watcher also reports **17 of 17 videos scanned are missing captions**. The analysis treats this as a CONFIRM IN YOUTUBE STUDIO item, since the public API cannot verify caption tracks.

### Creative facts drawn from titles, descriptions and thumbnails (not from numbers)

- The four post-album lyric videos share one designed identity: a heron against a pale sky with the track title in **red serif capitals**. Sampled off the actual artwork: red `#D22B2A`, pale `#DDE3E6`.
- Zak Watson directed, shot and edited The Heron, Chalk, Seminal, Flight Simulator and the 2025 film. Consistent creative partner.
- Flight Simulator stars **Craig Cash** (The Royle Family). Antony's own description of the shoot: *"of course a hero of mine … here he is performing words i wrote (!!) in that incredibly special way of his."*
- A recurring Shorts format uses **all-capital aphorisms** as the whole title: "THE HERON WAITS PATIENTLY", "THE HORRORS PERSIST", "YOUR PERSONALITY HAS BEEN BROKEN APART AND SOLD BACK TO YOU IN A SERIES OF SHORT FORM CLIPS", "THE YOUNG AND THE DYING HAVE THE WORST PHILOSOPHIES, AND YOU ARE BOTH BUT ALSO NEITHER".
- Antony's own upload titles are lower-case, chatty and self-deprecating: *"today we attempt to land Flight Simulator"*, *"Tony's first billboard 🤝 thank you spotify i feel like a supervillain"*, *"the man up the pole is 62 years old. message your mates and never stop being silly x"*.
- A UK/IE tour exists — a Short from 8 May 2026 reads *"Decoding Birdsong UK/IE tour on sale right now!!"*. **No tour dates appear in any source available here.** Any claim about upcoming live dates would be unsupported; check that none is made.

---

## PART 4 — EVERY NUMERIC CLAIM, NUMBERED

Recompute each from PART 2.

C1  Channel: 5,320 subscribers, 1,130,576 lifetime views (API channel statistics), 66 public uploads. Pulled 2026-09-14.
C2  The 66 rows in the table below sum to 702,642 views. The API channel viewCount is 1,130,576. GAP = 427,934 views unaccounted for by current public uploads.
C3  Format split: 40 Shorts, 26 long-form.
C4  Long-form accounts for 94.8% of views across the 66 current uploads (665,822 of 702,642).
C5  Median views: Shorts 787.5, long-form 11,563.
C6  Album Decoding Birdsong released 2026-08-21. Deck treats 2026-09-14 as "today" (= day 25 of the post-album window, matching the Watcher's "CAMPAIGN · ACTIVE · DAY 25").
C7  Post-album uploads (on/after 2026-08-21): 4, all long-form, all Official Lyric Videos, totalling 5,875 views. The Watcher reports "CAMPAIGN VIEWS 5.8K / 4 assets" — these agree.
C8  The First Five Minutes Of Magnolia (feat. Pretty Girl) [Official Lyric Video] — published 2026-08-21, 24 days old at pull, 2,966 views, 82 likes (2.76% like rate), 6 comments. Lifetime average 123.6 views/day.
C9  Bookie's Favourite (feat. Ellur) [Official Lyric Video] — published 2026-08-28, 17 days old at pull, 1,685 views, 52 likes (3.09% like rate), 4 comments. Lifetime average 99.1 views/day.
C10  The Same Heron Again (Official Lyric Video] — published 2026-09-03, 11 days old at pull, 719 views, 19 likes (2.64% like rate), 5 comments. Lifetime average 65.4 views/day.
C11  You're Not Supposed To Do This Forever (Official Lyric Video) — published 2026-09-10, 4 days old at pull, 505 views, 21 likes (4.16% like rate), 4 comments. Lifetime average 126.3 views/day.
C12 Of the four post-album lyric videos, the NEWEST (You're Not Supposed To Do This Forever, 4 days old) has BOTH the highest lifetime average views/day (126.3) AND the highest like rate (4.16%).
C13 Official long-form by year — median views / median like rate / median comments per 1,000 views:
      2023: n=1, median views 41,427, median like 1.33%, median c/1k 0.92
      2024: n=3, median views 99,007, median like 1.25%, median c/1k 0.91
      2025: n=3, median views 16,533, median like 1.52%, median c/1k 1.81
      2026: n=8, median views 7,336, median like 2.93%, median c/1k 2.95
C14 2026 official long-form has a median like rate 2.34x that of 2024 (2.93% vs 1.25%) and a median comment rate 3.24x (2.95 vs 0.91 per 1,000 views).
C15 The Stockport cluster (1 long-form + 4 Shorts) = 159,892 views = 22.8% of views across all 66 uploads.
C16 The Great Pyramid Of Stockport (Official Video) is the channel's most-viewed upload at 153,698 views — 1.55x the next biggest (Rafters, 99,007).
C17 The Heron (Official Video, 11 Mar 2026) has 39,965 views. The album's callback track, The Same Heron Again (Official Lyric Video, 3 Sep 2026), has 719. Ratio 56:1. NOTE the two are 176 days apart, so this is NOT an age-matched comparison.
C18 Flight Simulator (Official Video, 7 Aug 2026) has the highest comment rate of any upload over 2,000 views: 8.97 comments per 1,000 views (105 comments / 11,706 views), and a 4.43% like rate.
C19 "ever thought about getting to know yourself?" (29 Dec 2025, 22.6 minutes) has the highest like rate of any upload over 2,000 views at 7.04% (171 likes / 2,429 views) and 7.00 comments per 1,000 views.
C20 Shorts by hand-assigned theme — LIVE n=6 median 1,261 | PLACE n=4 median 871 | PERSONALITY n=10 median 865 | WORDS n=9 median 712 | ANNOUNCEMENTS n=11 median 495. Live-clip Shorts have a median 2.5x that of announcement Shorts.
C21 Announcements are the LARGEST Shorts group (11 of 40 = 28%) and the lowest-performing by median views.
C22 Most recent Short: 2026-08-10 ("flight simulator, starring Craig Cash") = 35 days before the pull date. Zero Shorts published in the last 30 days, against 4 long-form uploads.
C23 Uploads in the last 90 days: 13, of which 7 Shorts.
C24 Seven uploads carry liveStreamingDetails (scheduledStart + actualStart + wasLive), i.e. were premiered or streamed: Flight Simulator (2026), "ever thought about getting to know yourself?" (2025), How Did You Get Here? (2023), Auld Lang Syne Porij Remix (2023), Rock and a Calm Place (2023), Working Classic LIVE @ VIBE (2022), Giving Up For Beginners (2021). Flight Simulator is the only 2026 one. None of the four post-album lyric videos was premiered.

### Shorts theme assignment used in C20 and C21

Assigned by hand from titles and hashtags. All 40 Shorts are classified; none is
left out. Group them yourself from PART 2 and check the medians.

- **LIVE (6)** — on stage, crowd, festival: "Your never be alone again my love", "everyone can face a crisis", "Find something to love", "rafters live at glastonbury", "rafters live for @3voor12", "Seminal #electronicmusic"
- **PLACE (4)** — Stockport, the pyramid: "The Great Pyramid of Stockport shines bright", "the eighth wonder of the world is in stockport x", "Stockport or Giza?", "makes you think #conspiracytiktok #stockport"
- **PERSONALITY (10)** — jokes, Antony being Antony: "flight simulator, starring Craig Cash", "today we attempt to land Flight Simulator", "what if you had to play #snooker…", "bruce bogtrotter core", "the man up the pole is 62 years old", "i'm a downward-facing class traitor", "downward-facing class traitor? accidental napper?", "Tony's first billboard", "the result: i also cry", "there's a first time for everything Sweden"
- **WORDS (9)** — lyric cards, poems, spoken word: "a poem for England, as seen on Newsnight", "THE HERON, YOURS FOREVER", "THE HORRORS PERSIST", "YOUR PERSONALITY HAS BEEN BROKEN APART…", "THE HERON WAITS PATIENTLY", "THE YOUNG AND THE DYING…", "the poem that became Rafters", "Im on the edge….", "you're probably wondering how i got here"
- **ANNOUNCEMENTS (11)** — out now, tickets, pre-order, radio: "Decoding Birdsong UK/IE tour on sale right now!!", "szmierek live '25!! tickets on sale now bebeh!!", "pre-order the record and get a personalised poem from me", "Angie's Wedding, Out Now", "No War But Class War. Tomorrow 9am", "it's the wedding of the century…" (×2), "rafters is out now!!", "rafters coming thru ur radio right now!!!", "Antony Szmierek Headline Tour November 2023", "How Did You Get Here Full Video Out Now"

**Challenge this taxonomy.** Several Shorts could sit in two groups — the Craig
Cash one is personality but also promotes a single; the Glastonbury one is live
but also announces. If regrouping a handful of items collapses the differences,
the finding is weaker than stated.

---

## PART 5 — AUDIENCE RESEARCH: COMMENT METHODOLOGY AND FINDINGS

### Method

- **535 public top-level comments** across **21 videos**, retrieved 14 Sep 2026 via `commentThreads`.
- Ordered by YouTube's `relevance` (what a visitor actually sees), except Flight Simulator, which returned zero under `relevance` and was re-pulled under `order=time` (60 comments). **This is a sampling inconsistency — flag it.**
- Up to 40 per video. Videos with fewer than 40 comments returned all of them.
- Per video: The Heron 40, Great Pyramid 40, Rafters 40, Auld Lang Syne 40, Angie's Wedding 40, Yoga Teacher 38, Rock and a Calm Place 37, Chalk 36, How Did You Get Here 34, Take Me There 29, Seminal 27, Dance Better 18, Flight Simulator 60, That Face You Make 15, "ever thought…" 15, Magnolia 6, The Same Heron Again 5, Bookie's Favourite 4, You're Not Supposed To… 4, THE HERON YOURS FOREVER 4, Pyramid Short 3.
- **Replies are not included**, only top-level comments.
- Themes were counted by regular-expression keyword match, then read by hand. No sentiment scoring, no percentages of positivity.

### Keyword match counts (of 535)

| Theme | Matches | What the pattern looked for |
|---|---|---|
| Discovery story | 40 | 6 Music, Radio 1, BBC, "heard this on", "found him", "recommended", "popped up", "brought me here", named TV shows |
| Live | 35 | saw/seen him, gig, festival, named venues, tour, "see you in" |
| Lyrics / words | 26 | lyric, words, line, poetry, storytelling, wordplay |
| Comparisons | 24 | "reminds me of", The Streets, Just Jack, Born Slippy, etc. |
| Quoting | 19 | any quoted phrase of 12–90 characters |
| Place | 18 | Stockport, Manchester, Crewe, "where I live", "local" |
| Album | 15 | "the album", "album of the year" |
| Emotional impact | 14 | cried, goosebumps, "needed that", "got me through" |
| Should be bigger | 9 | underrated, "needs to blow up", "hidden gem", "deserves" |
| Repeat listening | 4 | "on repeat", "can't stop", "obsessed" |

**Check these counts are being used honestly.** They are keyword matches on a
non-random sample of 535 comments, not a survey of the fanbase. A claim like
"discovery is the biggest theme" is defensible; "40% of fans found him on radio"
is not. Flag any drift toward the second.

### Representative comments quoted verbatim

Highest-liked first. `♥` = likes.

- **225♥** *"Thanks for letting me be THE Heron. You made an old man very happy."* — on The Heron
- **90♥** *"Used to live in Cairo, now live in Stockport. This song speaks to me"* — on The Great Pyramid Of Stockport
- **50♥** *"I don't know if there's an Oscars category for 'best martial artist heron in a music video,' but if there is, Robbie Knox should absolutely win it."*
- **44♥** *"I was recommended this video by Sophie from Buckles in Chippenham!"*
- **37♥** *"How did this not make it to mainstream radio. Good lord."*
- **34♥** *"Heard this on BBC 6, great song!"*
- **34♥** *"For those of you watching in black and white, the pink is next to the green"* — on Chalk, a snooker-commentary joke
- **31♥** *"It's like just jack, the streets and real lies had a baby.."*
- **28♥** *"'I'm a downward facing class traitor' 😂😂❤"* — quoting the Yoga Teacher lyric
- **26♥** *"Great lyrics, reminds me of The Streets and weak become heroes."*
- **21♥** *"I only discovered you today and this track is the best new thing I've heard in quite a while."*
- **20♥** *"…it'll take me back to when he was a hidden gem in the music world"*
- **16♥** *"Heard this song from Finding Emily and had to look it up."*
- **14♥** *"Gotta thank radio 6 for introducing me to this legend!!"*
- **13♥** *"Love the storytelling of bedsheets and those messages on roundabouts."*
- **12♥** *"Saw Antony a week ago today at AYL? in a church in Reading… what a warm and generous guy"*
- **9♥** *"BBC euros coverage brought me here 🙌"*
- **8♥** *"met this guy on the mcr tram a few months ago, asked me for some chewing gum. recommended me his music. been a fan since"*
- **8♥** *"Was working security on the sound stage at latitude and he's bang on live"*
- **6♥** *"I can't remember this episode of the Royle Family!"* — on Flight Simulator
- **5♥** *"Insanely good album. Telling everyone I know about it!"* — on the Magnolia lyric video
- **3♥** *"Remember everyone, never leave the bookies with a smile on your face."* — on Bookie's Favourite
- **2♥** *"wish this was longer.........bloody brilliant !"* — on The Same Heron Again (99 seconds, the shortest lyric video)
- **1♥** *"please do a longer version x"* — also on The Same Heron Again
- **1♥** *"'You don't see the blossom giving itself a hard time' goes so hard"* — on You're Not Supposed To Do This Forever

### Claims the analysis draws from the comments

- **S1** The single most common thing people write is where they found him — radio (6 Music especially), TV, or a person. Basis: 40 of 535 matched the discovery pattern, and it is the largest theme.
- **S2** People quote specific lines back. Basis: 19 comments contain a quoted phrase; "I'm a downward-facing class traitor" appears in at least two separate comments on Yoga Teacher.
- **S3** People who have seen him live say so unprompted, and consistently describe the person as much as the show. Basis: 35 live-related comments including named venues and festivals.
- **S4** The Heron's comment section turned into a running joke about its lead actor, Robbie Knox, who commented himself and received the most-liked comment on the channel (225♥). At least five of the top 25 comments on that video are about Robbie rather than the song.
- **S5** The audience plays along in Antony's own register — snooker commentary on Chalk, a bookies aphorism on Bookie's Favourite, Royle Family references on Flight Simulator.
- **S6** Two separate people asked for a longer version of The Same Heron Again, the shortest lyric video at 99 seconds. **n=2. This is an anecdote, not a finding, and must be labelled as one.**

---

## PART 6 — CHECK THESE HARDEST

These are the places the analysis is most likely to be wrong. Attack them first.

1. **The age problem in C8–C12.** The four lyric videos are 24, 17, 11 and 4 days old. Views/day is a *lifetime average*, and a video's first days always run hotter than its later ones — so a 4-day-old video's average is inflated relative to a 24-day-old one by construction. Does C12's claim that the newest is performing best actually survive that? What comparison *would* be valid from a single snapshot? Is there any honest way to say "the rollout is holding up" with this data, or does it need a second pull a week later?

2. **C13 and C14 — engagement by year.** n=1 for 2023 and n=3 each for 2024 and 2025. Is a 2.34× like-rate difference meaningful across those sample sizes? And consider the alternative explanation: a video that reaches far beyond the fanbase (Great Pyramid, 153,698 views) will mechanically show a *lower* like rate than one seen mostly by fans. Is "the audience is more engaged" the right reading, or is it "2026 videos have reached fewer strangers"? Which does the data actually support?

3. **C17 — The Heron vs The Same Heron Again.** 39,965 vs 719 is a 56:1 ratio between a 187-day-old music video and an 11-day-old lyric video. Is the comparison meaningful at all? Does the *creative* observation (the album track is a callback to a song 39,965 people watched, and nothing on the channel connects them) stand on its own without the ratio?

4. **C20 and C21 — the Shorts taxonomy.** Groups of 4, 6, 9, 10 and 11. Try reassigning the ambiguous items and see whether the ordering survives. Note also that the groups span 2023–2026, so a group weighted toward 2024 is competing on a different channel size than one weighted toward 2026 — is that controlled for anywhere? It is not.

5. **C2 — the 427,934-view gap.** Verify that no claim anywhere uses 1,130,576 as a denominator, and that no claim implies the 66 uploads are the whole history of the channel.

6. **C24 — premiere classification.** `liveStreamingDetails` is present on both genuine live recordings ("LIVE @ VIBE") and premiered uploads. Is the analysis distinguishing them, or is it treating all seven as premieres?

7. **The Flight Simulator comment sample.** It is the only video pulled under `order=time` rather than `relevance`, and the only one with 60 rather than 40. Does that bias any claim made about it?

8. **Anything stated as observation that is really inference.** The public API cannot show traffic sources. Every claim about *where* an audience came from rests on people saying so in comments — which is self-selected and skews toward people motivated to comment. Is that hedge present wherever it needs to be?

---

## PART 7 — OUTPUT FORMAT REQUESTED

A numbered list. For each issue:

- the exact claim ID and quoted text
- what the source data actually supports
- the precise corrected wording

Then:

- **The three weakest claims** even where not strictly wrong.
- **What the analysis has missed** — patterns in PART 2 or PART 5 that are not currently claimed and look more interesting than what is.
- **Anything that would need YouTube Studio to confirm**, which should be labelled rather than asserted.

If a claim checks out, do not list it.
