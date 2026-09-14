# VENUS GRRRLS deck — independent audit pack

> **SUPERSEDED — this pack audits deck v1 (the analytics-led version).**
> The deck was rebuilt on 14 Sep 2026 around the channel and its creative, with
> different slides and a fresher data pull. Two things this pack does NOT cover,
> and which a reviewer using it against the current deck will wrongly flag:
>
> 1. **Pull-date drift.** The figures below come from the earlier pull. The current
>    deck uses the 14 Sep full-catalogue pull, where view counts have moved up:
>    Eve 74,595 → 74,619 · Mother Knows 10,403 → 10,430 · 3x3 3,887 → 3,893 ·
>    lifetime 283,484 → 283,602 · campaign total 106,487 → 106,544.
> 2. **Missing columns.** This pack has no premiere fields (`scheduledStartTime` /
>    `actualStartTime`) and no description text, so it cannot verify the premiere
>    claims or any creative claim drawn from the descriptions. Those were verified
>    against the video objects directly, not against this table.
>
> Ask for a regenerated pack before auditing the current deck externally.

Paste this whole document into ChatGPT (or any other model) as a single message.
It is self-contained: the complete source data and every claim made in the deck.
No links need to be followed and no files need to be opened.

---

## INSTRUCTIONS TO THE REVIEWER

You are fact-checking a strategy deck against its source data. **Be adversarial.
Your job is to find wrong numbers, not to agree.** A previous check of an earlier
draft found nine errors, so assume more are present.

For every numeric claim and every factual assertion listed in Part 4:

1. Do the arithmetic yourself from the raw data in Part 2. Do not trust the deck's
   working.
2. State: the claim as written → what the data says → **PASS** or **FAIL**.
3. For each FAIL, give the correct figure.

Then, separately, flag:

- Anywhere the deck presents an **interpretation as an observation**, or asserts
  something the source data cannot actually show.
- Anywhere a comparison uses an **inconsistent population** (e.g. a median taken
  over one group but described as another).
- Anywhere a claim is **technically true but misleading** in context.
- Any **internal contradiction** between slides.

Today's date for all date arithmetic: **14 September 2026**.

---

## PART 1 — WHAT THE DECK IS

A 10-slide YouTube strategy deep dive for the band VENUS GRRRLS, covering the final
phase of their 2026 campaign. The structure is: where we are now → what's working →
what we've learned → the opportunity → three forward phases → three actions.

The campaign window used throughout is **uploads from 22 January 2026 onward**,
on the basis that 22 Jan is the first single of the 2026 campaign. The reviewer
should check whether the figures are internally consistent with that window.

---

## PART 2 — SOURCE DATA

The complete VENUS GRRRLS YouTube catalogue. All 32 uploads, pulled from the public
YouTube Data API on 14 September 2026. This is the entire channel, not a sample.

| # | date | kind | dur (s) | views | likes | comments | title |
|---|------|------|---------|-------|-------|----------|-------|
| 1 | 2026-08-30 | short | 35 | 1212 | 27 | 1 | Goth Chappell Roan it is |
| 2 | 2026-08-18 | video | 186 | 10403 | 396 | 55 | Mother Knows (Visualiser) |
| 3 | 2026-07-27 | short | 6 | 420 | 29 | 4 | News tomorrow |
| 4 | 2026-07-26 | short | 11 | 1490 | 27 | 0 | drummer vs singer final boss |
| 5 | 2026-07-26 | short | 19 | 1756 | 33 | 3 | do you think it worked?? |
| 6 | 2026-07-26 | short | 35 | 1269 | 16 | 0 | can you guess who it was?? |
| 7 | 2026-07-26 | short | 33 | 342 | 11 | 0 | Our top summerween movies |
| 8 | 2026-07-17 | short | 16 | 1476 | 25 | 1 | welcome back hex girls ig |
| 9 | 2026-07-14 | short | 14 | 1372 | 43 | 3 | we keep leaking out new music |
| 10 | 2026-07-10 | short | 23 | 1154 | 32 | 4 | hex girls fans come join the coven |
| 11 | 2026-07-10 | short | 36 | 1218 | 34 | 2 | gothic literature inspired lyrics |
| 12 | 2026-07-10 | short | 17 | 1078 | 32 | 5 | Heyyy we're Venus Grrrls |
| 13 | 2026-04-24 | video | 190 | 74595 | 456 | 36 | Eve (Official Music Video) |
| 14 | 2026-03-02 | short | 14 | 1732 | 75 | 1 | hex girls invented music in 1999 |
| 15 | 2026-02-27 | short | 12 | 3083 | 65 | 4 | ZOINKS it's the witches |
| 16 | 2026-01-22 | video | 142 | 3887 | 218 | 14 | 3x3 (Official Video) |
| 17 | 2025-09-26 | short | 33 | 1036 | 68 | 4 | *(hashtags only, no title text)* |
| 18 | 2025-09-23 | short | 28 | 1361 | 26 | 6 | Witchcraft opinions |
| 19 | 2025-09-15 | video | 168 | 6992 | 282 | 41 | Ivy Tree (Official Video) |
| 20 | 2025-08-20 | short | 21 | 1906 | 34 | 3 | *(hashtags only)* |
| 21 | 2025-03-07 | video | 206 | 27484 | 1204 | 125 | Eighteen Crows (Official Video) |
| 22 | 2025-01-19 | short | 42 | 1087 | 50 | 2 | hex girls created music in 1999 |
| 23 | 2024-08-15 | video | 180 | 5832 | 281 | 13 | Darla (Official Video) |
| 24 | 2024-03-22 | video | 165 | 8259 | 292 | 19 | Bloodsick (Official Video) |
| 25 | 2024-01-26 | video | 167 | 19577 | 621 | 26 | Divine (Official Video) |
| 26 | 2023-10-30 | video | 186 | 24165 | 764 | 34 | Hex (Official Music Video) |
| 27 | 2023-09-21 | video | 183 | 11425 | 288 | 14 | Liar Liar (Official Video) |
| 28 | 2023-08-08 | video | 152 | 9455 | 327 | 35 | Lidocaine (Official Video) |
| 29 | 2023-07-31 | short | 16 | 381 | 38 | 2 | Lidocaine out Aug 8th |
| 30 | 2022-10-21 | video | 171 | 20269 | 342 | 16 | Aries (Official Video) |
| 31 | 2022-07-13 | video | 142 | 22574 | 384 | 31 | Violet State of Mind (Official Video) |
| 32 | 2021-01-29 | video | 155 | 15402 | 476 | 33 | Goth Girl (Official Video) |

**Channel totals, same API call:**

- subscriberCount: **2,970**
- viewCount (channel lifetime): **283,484**
- videoCount: **32**
- subscriberDelta, 7 days: **+10**
- viewDelta, 7 days: **+1,649**
- lastUploadDate: **2026-08-30**
- daysSinceLastUpload, as reported by the API: **14**

> Note for the reviewer: the per-video views in the table sum to slightly more than
> the channel `viewCount` (a normal YouTube reporting discrepancy). State which base
> you used if it changes an answer.

---

## PART 3 — NON-NUMERIC SOURCE FACTS

**From the campaign plan ("Coach"):**

- Next major moment: **"Carmilla" single release — 13 October 2026**
- Release week shown as **12–18 October**, currently "in 29d"
- The EP is titled **"To Die As Lovers May"**
- The EP announce moment was planned for **17–23 August** and its status is still
  PLANNED — it never ran
- The "Mother Knows single release" and "Mother Knows music video release" moments
  are both marked LIVE, and **both were fulfilled by the same 18 August visualiser**
- Suggested release-week support: Official Video or Visualiser; Community Post;
  Lyric Video at +7–10 days; BTS at +14–21 days; Acoustic/live session at +14–21 days;
  Story behind the song at +14–21 days
- Shorts guidance: 3 per release — tease / drop-day / follow-up

**From the channel monitor ("Watcher"):**

- Overall read: *"BUILDING — Every viewer is converting. The constraint is volume —
  push more content."*
- Views 7d +1.6K (+0.6%); Subs 7d +10 (+0.6%)
- Uploads in last 30 days: 2 (1 Short)
- Last upload: 14 days ago
- Structural gap reported: **"14 videos scanned — 14 missing Captions"**

---

## PART 4 — EVERY CLAIM IN THE DECK

### Slide 1 — Cover
1. "Three singles, sixteen uploads, and more than a third of everything the channel has ever earned"
2. "One release left — Carmilla, 13 October"
3. "an EP with no YouTube date on it yet"
4. "The channel has 32 uploads in total, so this is the whole catalogue rather than a sample"
5. "Nothing here uses YouTube Studio data"

### Slide 2 — Where we are now
6. **106,487** campaign views, "16 assets since 22 Jan"
7. **37.6%** of lifetime views; "283,484 all time"
8. **2,970** subscribers, "+10 last 7 days"
9. **13 / 3** Shorts / long-form
10. "long-form = **83%** of campaign views"
11. **14** days quiet; "29 to Carmilla"
12. "This campaign is already the biggest thing the channel has done"
13. "Three singles have already done the work of building an audience here"

### Slide 3 — What's working
14. Mother Knows: **10,403** views in **27 days**, like rate **3.81%**, **55** comments, 27 days live
15. 3x3: **3,887** views in "8 months", like rate **5.61%**, **14** comments, **235** days live
16. "A visualiser did **2.7×** the views of a full music video in **an eighth of the time**"
17. "and pulled **four times the comments**"
18. "3x3 has the better like rate — the content isn't the problem — but almost nobody saw it"

### Slide 4 — Eve
19. Eve like rate **0.61%**
20. **3.46%** labelled "Median official video, excluding Eve"
21. Eve has **74,595** views
22. "**26%** of everything the channel has ever earned"
23. "**2.7×** the next best video"
24. "the **lowest-engaging upload on the channel**"
25. "running **5.7× below the median official video**"
26. "fewer comments than Mother Knows — **36 against 55** — on **7.2× the views**"
27. Labelled as interpretation: "a promoted or suggested-traffic spike is the most likely explanation for that shape, but the API cannot confirm it"

### Slide 5 — The gaps
28. After 3x3 = **36d**
29. Before Eve = **53d**
30. After Eve = **77d**
31. Before Mother Knows = **22d**
32. Right now = **14d**
33. "quiet for 77 days immediately after its single biggest view moment"
34. "The two longest gaps of the year sit either side of Eve — 53 days walking into it, 77 days walking away"
35. Bar widths rendered proportionally: 47 / 69 / 100 / 29 / 18 (percent of the 77d maximum)

### Slide 6 — The opportunity
36. Shorts shown: ZOINKS **3,083** ("best Short", 27 Feb); do you think it worked?? **1,756**; drummer vs singer **1,490**; Goth Chappell Roan **1,212** ("last upload", 30 Aug)
37. "The Shorts that reach furthest are the personality ones … rather than the announcement ones"
38. "the weakest is a release announcement at **420**"
39. "Across all **18** they engage at a **2.78% median like rate**"
40. "the same band as the official videos"
41. "converts viewers to subscribers at **1.05% lifetime**"
42. "**0.61%** over the last seven days, in a week with nothing uploaded in it at all"
43. "nothing on the channel currently gathers it into one place"

### Slide 7 — Now → release
44. "Phase one · 15 Sep → 12 Oct"
45. "Announce *To Die As Lovers May* — the moment planned for August that never ran"
46. "One EP playlist: 3x3, Eve, Mother Knows"
47. "**All 14 long-form videos** are missing them [captions]"
48. "the four weeks before the record"

### Slide 8 — Release week
49. "Phase two · 12–18 October"; visualiser live **13 October**
50. "Three Shorts: 11 Oct tease · 13 Oct drop · 16 Oct follow-up — the Coach plan already specifies this shape"
51. "**85,000** views already sit on those two videos [Eve + Mother Knows]"
52. "One destination for **four singles**"
53. "**2,970** subscribers who have already opted in"

### Slide 9 — After release
54. "Carmilla lyric video, **+7–10 days**. Already in the Coach plan"
55. "**No live or performance upload appears anywhere in the 32-video catalogue**"
56. "Mother Knows drew **55 comments on 10K views, the channel's second-highest rate**"
57. "landing exactly where the last two campaigns went quiet"

### Slide 10 — Three things
58. "**Fourteen** days of silence with **twenty-nine** to go"
59. "Repeat what Mother Knows proved — **10,403** views and a **3.81%** like rate in 27 days"
60. "point Eve's **74,595** views at it with an end screen"
61. "No live or performance video appears anywhere in the 32-video catalogue"

---

## PART 5 — CHECK THESE HARDEST

These are the claims most likely to be wrong, because they involve a chosen
population, a ratio, or a date boundary:

- **#20 and #25 together.** Is 3.46% actually the median like rate of official videos
  excluding Eve? Recompute it. Then check whether 5.7× follows from it. Then ask
  whether "lowest-engaging upload on the channel" and "5.7× below the median" are
  being conflated — what is the gap between Eve and the *next lowest actual upload*,
  and does the sentence imply that instead?
- **#39.** Median like rate across all 18 Shorts. Compute it exactly. With an even
  count of items, say which convention you used.
- **#10.** Long-form share of campaign views — check the denominator is campaign
  views and not lifetime.
- **#16.** Both halves. 27 days vs 235 days is what fraction?
- **#42.** Is "0.61% over the last seven days" derived from 7-day figures, and is the
  "nothing uploaded" part consistent with a last upload 14 days ago?
- **#47.** The channel has 32 uploads but only 14 were scanned for captions. Is the
  deck's wording accurate about which 14?
- **#52.** "four singles" — how many singles exist at the moment the playlist is built?
- **#55 / #61.** Can the absence of live content be *proved* from the data supplied,
  given that two uploads have no title text at all? Should this be labelled as
  inference rather than observation?
- **#33 and #34 together.** Are these consistent with each other and with the gap
  figures in #28–32?
- **#12.** "the biggest thing the channel has done" — biggest by what measure, and is
  that measure stated anywhere?

---

## PART 6 — OUTPUT FORMAT REQUESTED

1. A table: claim number → claim → what the data says → PASS / FAIL → correction.
2. A short list of interpretation-stated-as-observation problems.
3. A short list of internal contradictions.
4. The three errors that matter most, and why.

If you find nothing wrong with a claim, say PASS and move on — do not pad.
