# EZRA COLLECTIVE — *Here Because of Hope*
## Internal audit, written before any deck is designed

Virgin Music Group / Partisan Records · prepared 15 September 2026
Source data pulled 15 Sep 2026 10:52 UTC. Raw rows: `/tmp/ez/cat.js`.

**This document exists to be argued with.** Nothing here goes on a slide until it has
survived that argument. Every line is tagged:

- **[API]** — public YouTube Data API v3. Anyone can reproduce it.
- **[WATCHER]** — our own weekly cron snapshots of the public API. Observed, not modelled.
- **[INFERENCE]** — our reading. Could be wrong.

There are **no Studio metrics anywhere in this document**. No impressions, no CTR, no
retention, no traffic sources, no unique viewers, no new-vs-returning. We do not have
authenticated access to this channel and we have not estimated any of those numbers.

---

## 1. Campaign period

**[API]** Album: *Here Because of Hope*, Partisan Records.

**Release date: 11 September 2026.** Read from the channel's own uploads — one source,
three consistent signals within it, not three independent sources:

| Evidence | Date | Video |
|---|---|---|
| Short: "out tomorrow and we can't wait for you to hear it" | 10 Sep | `LIsKhSRD1Fg` |
| 11 song visualisers + 3 spoken interludes published | 10–11 Sep | `_d4tu0tCN58` … `MR0K-Ta9M2o` |
| Short: "Here Because of Hope" London Block Party | 12 Sep | `asYBb11UesE` |

**Campaign window used throughout: 27 May 2026 → 15 September 2026 (111 days).**
Start is the album announcement Short `qYFr_GvFhfA` (27 May). End is the pull date.

**Today is day 4 post-release.** This is the single most important framing fact in the
whole document, and section 5 is mostly about what it stops us saying.

> ⚠️ **DISCREPANCY, AND IT IS LOAD-BEARING.** The 28 May announcement Short `TN6YONzpx7E`
> reads "Out September 18th 2026". Everything else on the channel points to 11 September.
> We have not confirmed the commercial release date with Partisan, and **"day 4
> post-release", the release-week comparison in section 3, and the October re-read date all
> rest on 11 September being right.** If the commercial date is 18 September, sections 3,
> 5.2 and 6 need rewriting. **Confirm this with Partisan before the deck is built.**
> Until then the deck should not state a precise date as established fact.

**Comparison window: *Dance, No One's Watching*, 18 June 2024 → 6 October 2024 (110 days).**
Chosen because it is within one day of the same length, making structural comparison clean.
Start is the lead single `5JUjFN9AuFU`; the album landed 27 Sep 2024.

---

## 2. Dataset coverage — and its one serious hole

**[API]** Channel `UCDjQX5MfQrWowYF9ucLpdOQ`, at pull:

- 72,700 subscribers
- 27,305,501 lifetime views
- 246 public videos · channel created 23 Aug 2013
- 251 rows retrieved from the uploads playlist

**[API] The hole: the 251 retrieved rows sum to 12,223,598 views. The channel reports
27,305,501. A gap of 15,081,903 views — 55.2% of the reported lifetime total — is not
accounted for by the public uploads playlist.**

**[INFERENCE]** Deleted or privated uploads are the most likely explanation. We have not
diagnosed it and should not speculate further in the deck.

**Consequence, and it is binding: we cannot make any "share of lifetime views" claim.**
No "the campaign delivered X% of the channel's all-time views". No "the album accounts for
Y% of the catalogue". **The single exception is the disclosure above** — stating the size of
the gap requires lifetime as a denominator, which is the whole point of disclosing it.
Everywhere else in this document, view percentages use window totals as denominators.

**[API] Comments:** 15 videos scanned via `/api/comment-scan` on 15 Sep 10:58 UTC,
266 top-level comments retrieved, 0 videos with comments disabled.

> ⚠️ **The scan returns a sample, not a census.** We requested up to 40 comments per video,
> relevance-ranked. Ally Pally has 251 comments in total and we saw 40 of them. Every
> quotation in this document is therefore drawn from *the comments YouTube surfaces most
> prominently*, which is not the same as what the commenter base as a whole is saying.

---

## 3. Before vs after — did the channel actually grow?

**Yes, and we can show it with observed data rather than inference.**

**[WATCHER]** Four weekly snapshots bracket release week:

| Week starting | Subscribers | Lifetime views | Views (prior 7d) | Subs (prior 7d) | Uploads 30d |
|---|---|---|---|---|---|
| 24 Aug | 70,600 | 26,327,535 | 234,269 | 300 | 13 |
| 31 Aug | 71,000 | 26,587,444 | 259,909 | 400 | 13 |
| 7 Sep | 71,300 | 26,769,957 | 182,513 | 300 | 11 |
| **14 Sep** | **72,400** | **27,305,501** | **535,544** | **1,100** | **27** |

**[API]** Read on the pull date, three days later: 72,700 subscribers.

Two movements are observed:

- **[WATCHER] The public subscriber count rose by 1,100 in release week, against a rise of
  300–400 in each of the three preceding weeks.**
- **[WATCHER] Weekly views went from a 225,564 average across those three weeks to
  535,544 in release week — 2.4×.**

**[WATCHER]+[API] Public subscriber count 24 Aug → 15 Sep: 70,600 → 72,700, +2,100 (+3.0%).**
**[WATCHER] Channel view total 24 Aug → 14 Sep: +977,966 in three weeks.**

> ⚠️ **These are not subscriber additions, and the deck must never call them that.** They
> are movements in the *publicly displayed* subscriber count, which YouTube rounds (to the
> nearest 100 at this channel size) and which already nets off unsubscribes. Gross and net
> subscriber additions are Studio metrics and we do not have them. Correct phrasing: "the
> public subscriber count rose by".
>
> ⚠️ **And do not put a multiple on the subscriber figure.** Every input is rounded to the
> nearest 100, so "1,100 against 300" could honestly be anything from about 2.6× to 4.4×.
> Quoting "3.3×" is false precision dressed as an observation. Say "roughly three times the
> weekly rate of the preceding three weeks", or just show the four numbers and let the
> reader do it. The view figures are not rounded and 2.4× is safe.

**[WATCHER] Baseline limitation: our snapshots begin 24 August 2026.** We have no weekly
observations for the earlier campaign (May–August) or for the 2024 album. So the
before/after evidence is strong for *release week specifically* and does not exist for the
campaign as a whole.

---

## 4. The five strongest findings

### Finding 1 — Output went up 2.6×, and the channel never went quiet **[API]**

| | 2026 *Hope* (111d) | 2024 *Dance* (110d) |
|---|---|---|
| Uploads | **69** | 27 |
| Shorts | **45** | 9 |
| Long-form | 24 | 18 |
| Weeks with at least one upload | **16 of 16** | 7 of 16 |
| Longest silent gap | **9 days** | **43 days** |

The 2024 campaign had a 43-day silence between 22 July and 3 September. The upload that
opened that silence was the *instrumental* of the lead single; the next thing the channel
posted, six weeks later, was the second single. In 2026 the longest gap is nine days.

**This is the single most defensible finding in the document,** because upload counts, week
coverage and gap lengths do not change as assets age. They are the same numbers today as
they were on the day each window closed.

### Finding 2 — Concentration fell sharply: the campaign stopped depending on one video **[API]**

**Top-3 share of window views: 84.7% in 2024 → 56.5% in 2026.**

In 2024, one video — *God Gave Me Feet For Dancing* — is **62.8% of the entire 110-day
window** on its own. The second asset, the *No One's Watching Me* visualiser, is 19.1%.
The other 25 uploads in that window share 18.1% between them.

In 2026 the leader, *Only Love*, is **27.4%** of its window. The next two are *Well
Organised* (15.5%) and the *Rehearsal Tapes* (13.6%) — and those are three different kinds
of asset: a music video, a second music video, and a 14-minute rehearsal film.

Every figure in this finding is a share of its own window. It is age-independent, because
both sides have aged together.

> ⚠️ **Deck rule for this finding: percentages only, never the raw view counts.** Putting
> 2,634,667 next to 245,066 is exactly the un-age-matched comparison section 5.1 forbids,
> and it is an easy mistake to make when writing this slide.

### Finding 3 — Long-form live and process films are where this audience talks **[API] + [INFERENCE]**

> ⚠️ **Read this finding's caveats before using it.** It is the softest finding in the
> document and the one most likely to be overstated on a slide. The original draft of this
> section claimed the audience was "actively hunting" for this footage. The evidence does
> not carry that weight, and the claim has been narrowed accordingly.

**[API] Method and its limit.** 15 videos scanned, 266 top-level comments retrieved, none
disabled. The API returned a *relevance-ranked sample* of up to 40 per video, not the full
set — Ally Pally alone has 251 comments and we saw 40. **These quotes represent the
comments YouTube surfaces most prominently, not the commenter base.**

**[API]** Two long-form videos carry the densest comment activity in the scan:

`Jih5_ZRlQqc` — *Ezra Collective & Kano, Live at Alexandra Palace* (8 May 2026, 8m44s,
337,985 views, 6,548 likes, 251 comments).

> ⚠️ **This video sits 19 days OUTSIDE the campaign window.** It is evidence about the
> audience, not about the campaign, and its views must never be folded into campaign
> totals. Wherever it appears, it appears labelled.

`lsTsx7FPpQ0` — *Rehearsal Tapes* (9 Sep 2026, 14m32s, 121,499 views, 2,758 likes,
57 comments). The third-largest asset of the campaign window, and it is not a song.

**[API] What two commenters on the Ally Pally video actually said** — the only direct
evidence of people looking for this footage before it existed on the channel:

> "I always go and search for the small clip version of this floating on youtube and today
> I searched and this popped up its crazy my day has been made" — 183 likes
>
> "Been trying to find the full set for ages! Best live set I've ever seen — thank you for
> letting us relive it!!" — 9 likes

**[INFERENCE]** Two comments on one out-of-window video is thin. It is suggestive, not
conclusive, and the deck should present it as two people saying something interesting
rather than as a demonstrated audience behaviour.

**[API] What the rest of the comment evidence actually shows** — not search behaviour, but
craft attention. The highest-liked comment in the entire 266-comment scan is about the
camerawork, not the music:

> "Putting people with cameras at different positions in the crowd and around the stage is
> a brilliant way to capture the feeling of a live gig" — 402 likes

and on the Rehearsal Tapes:

> "fantastic! mad props to the steadicam operator and the focus puller!" — 14 likes

**[INFERENCE]** The defensible version of this finding is the narrower one: **when Ezra
publish a well-shot long-form film, the comments are about how it was made.** That is a
different claim from "the audience is hunting for it", and it is the one the evidence
supports.

### Finding 4 — Long-form still does the heavy lifting; Shorts do something else **[API]**

2026 window: **83.6% of views came from the 24 long-form uploads**, despite Shorts being
65% of the upload count. Median long-form 6,839.5 views; median Short 2,290. (Both medians
are within the 2026 window, so they are comparable to each other. They are **not**
comparable to the 2024 medians — see 5.1.)

**[INFERENCE]** The 45 Shorts should not be judged on views. They are what kept the channel
present in the 16 consecutive weeks of Finding 1 — the gratitude posts from the festival
run, the tour announcements, the "what hope means to Femi" pieces. Read as a presence
layer they worked. Read as a reach layer they did not, and the deck should say so plainly
rather than dress 2,290 median views up as a win.

### Finding 5 — Release week was structured as a block, not a trickle **[API]**

19 uploads in the week of 9 September — 12 long-form, 7 Shorts — including all 11 song
visualisers across 10–11 Sep, three Letitia Wright spoken interludes published as Shorts,
the full Rehearsal Tapes, and the block party.

**[API]** Those 19 uploads have accumulated **242,582 views between them as of 15 Sep**.

> ⚠️ **242,582 and 535,544 are different quantities and must never be juxtaposed without
> saying so.** 242,582 is the total view count *of the videos uploaded that week*, read on
> 15 Sep. 535,544 is the channel's *total views during the seven days to 14 Sep*, across the
> entire catalogue including the back catalogue. The second is larger because most of what
> people watch on this channel in any given week is not that week's uploads. Presented
> side by side without definitions, a reader will conclude the visualisers underperformed,
> which is not what these numbers say.

**[INFERENCE]** This co-occurs with the release-week movements in section 3. It does not
explain them. Release week would have lifted the channel whether or not the visualisers
were published as a block, and we have no way to separate the two. What we can say without
claiming causation is that the channel was fully stocked on the day the album landed, so
every arriving viewer found the whole record rather than one song.

---

## 5. Three weak points we have to hold in front of us

### Weak point 1 — The cross-campaign view comparison is not age-matched. This is the big one.

2024's assets have had roughly two years to accumulate views. 2026's have had between three
days and sixteen weeks since upload. **Comparing 894,941 window views against 4,195,902
window views is not a valid comparison and must never appear on a slide as one.**

The 2024 window will have looked nothing like 4.2 million on day 111. We cannot reconstruct
what it looked like, because the API returns current view counts only and our Watcher
snapshots do not reach back to 2024.

**What survives:** upload count, format mix, week coverage, gap length, top-3 share,
long-form share of window views. All ratios or counts internal to each window.

**What does not survive:** any absolute view comparison between 2026 and 2024, any
"the campaign is bigger/smaller than last time", and any median-views comparison. The gap
between the two median long-form figures is confounded by age to an unknown degree — we
cannot say how much of it is age and how much is anything else, which is precisely why the
comparison cannot be made.

If the deck implies 2026 underperformed 2024 on views, it is making a claim the data cannot
support. If it implies 2026 outperformed, the same. The honest position is that we do not
know, and that structure is what we can compare.

### Weak point 2 — Four days is not a campaign

The album is four days old and the release-week observation covers seven days to 14 Sep.
Subscriber movement, visualiser performance, release-week views: all of it can move
substantially over the next month, in either direction. The 2.4× view lift may be a launch
spike that decays, or a step change. **We will not know which until roughly mid-October.**

Any "this worked" verdict written today is provisional. The deck should be explicit that it
is a day-4 reading and should propose a re-read date rather than pretending to a conclusion.

### Weak point 3 — We cannot attribute, only observe

We have no traffic-source data, so we cannot say whether the subscriber lift came from the
visualisers, the Rehearsal Tapes, the block party, press, playlisting, the tour
announcement, or Spotify's release radar spilling over. **[INFERENCE]** Everything in
Finding 5 is co-occurrence.

Two further specifics worth naming:

- **The Ally Pally video (Finding 3) is outside the campaign window** — published 8 May,
  nineteen days before the announcement. It is evidence about the *audience*, not about the
  *campaign*. The deck must not fold its 337,985 views into campaign totals, and it must
  carry the pre-window label every single time it appears — not "where relevant".
  **This matters more than it looks:** the audience half of the proposed deck narrative
  leans on an asset that is not part of the campaign, and we should be upfront about that
  rather than let the slide order imply otherwise.
- **The ~15.1M view gap (section 2)** means we do not fully understand this channel's own
  historical numbers. That is a caveat on everything, and we should say so once, plainly,
  rather than bury it.
- **[WATCHER] A data-integrity flag for whoever builds the deck:** the 14 Sep snapshot
  reports a channel view total of 27,305,501 — byte-identical to the 15 Sep API pull.
  Either the channel gained no views in a day (implausible) or the two readings share a
  source. Resolve this before quoting both figures as independent observations.

---

## 6. Provisional best-in-class verdict

**Not yet. And we should say that, because a case study that concludes "best in class" four
days after release is not a case study.**

What we can defend today:

**This is a strong example of campaign *structure*.** 16 consecutive active weeks with a
9-day maximum gap, 2.6× the output of the previous campaign, concentration down from 84.7%
to 56.5% top-3 share, and a fully-stocked channel on release day. Those are structural
facts and they are age-independent.

> ⚠️ **"Best in class" needs a class, and we have not defined one here.** The only
> comparison in this document is Ezra against Ezra — the 43-day silence in their own 2024
> window. That is a real and useful contrast, but it is a sample of one. If the deck wants
> to claim this is unusual *across the roster*, someone must compute the gap-length and
> week-coverage distribution across the Watcher channels and state the n. Until that
> exists, the honest framing is "a marked improvement on their own previous campaign", not
> "best in class".

**We cannot yet defend best-in-class *outcomes*.** The release-week subscriber and view
movements are real and observed, but they are one week old, the subscriber figure is
rounded, and we have no comparable release-week observation from 2024 to benchmark them
against.

**The honest verdict for the deck:** *the campaign was built well, and the first week
responded. Whether it converts into sustained channel growth is a question for
mid-October.* That is a stronger thing to put in front of YouTube than a premature
victory lap — it shows we know the difference between a structure claim and an outcome
claim, which is the whole point of sharing our method with them.

---

## 7. Proposed slide narrative

Eleven slides. The spine is: *a channel that stopped going quiet.* That is the claim the
evidence supports, and it is the only one strong enough to carry a deck. The audience
material in Finding 3 is a supporting texture slide, not a second thesis — an earlier draft
of this plan made it co-equal, which the evidence does not justify.

| # | Slide | Carries |
|---|---|---|
| 1 | **Here Because of Hope** — cover | Album, label, release date, day-4 framing stated up front |
| 2 | **What we can and cannot see** | Public API only. The 15.1M view gap. No Studio metrics. Put the limits first — this is what makes the rest credible |
| 3 | **The channel never went quiet** | Finding 1. 16 of 16 weeks. 9-day max gap vs 43 days in 2024 |
| 4 | **2.6× the output** | Finding 1. 69 vs 27 uploads; 45 vs 9 Shorts |
| 5 | **The campaign stopped depending on one video** | Finding 2. 84.7% → 56.5% top-3 share. **Percentages only — no raw view counts** |
| 6 | **When the film is good, they talk about the film** | Finding 3, in its narrowed form. Ally Pally labelled pre-window on the slide itself, not in a footnote |
| 7 | **Long-form carries; Shorts hold the room** | Finding 4. 83.6% of views from 24 uploads. Shorts judged on presence, not reach |
| 8 | **Release week, fully stocked** | Finding 5. 19 uploads; 11 song visualisers in 48 hours. No causal language |
| 9 | **What the first week did** | Section 3. The Watcher table. Public-count language, no multiple on the subscriber figure |
| 10 | **What we still don't know** | Section 5, all three, unsoftened. Age-matching, four days, no attribution |
| 11 | **Read it again in October** | The provisional verdict and a specific re-read date |

**Design note for the build phase:** the design system should come from Ezra's own frames —
the Here Because of Hope palette, the block-party and Lagos/Kingston footage — sampled from
real thumbnails, not chosen. Same principle as the Antony deck, not the same execution.

---

## 8. Verify these hardest

If you are checking this document, start here:

1. **The release date.** 11 Sep vs the announced 18 Sep. Confirm with Partisan. Sections 3,
   5.2 and 6 depend on it.
2. **The 15.1M gap.** Does 27,305,501 − 12,223,598 hold? Is there a benign explanation
   that changes what we can claim?
3. **The 43-day gap in 2024.** 22 Jul → 3 Sep 2024. Confirm no upload sits between them.
4. **Top-3 share both windows.** 84.7% and 56.5%. Recompute from `cat.js`.
5. **Whether any view comparison has leaked into the findings** despite section 5.1. This
   is the failure mode most likely to make it onto a slide.
6. **Whether the subscriber figure has acquired a multiple anywhere.** The inputs are
   rounded to the nearest 100 and will not carry one.
7. **The identical view total** in the 14 Sep snapshot and the 15 Sep pull (see 5.3).

### What this pass already caught

An adversarial read of the first draft found, and this version fixes: the phrase
"subscriber additions" used in bold directly above the box forbidding it; a "3.3×"
multiple built on values rounded to the nearest 100; raw 2024 and 2026 view counts placed
side by side in Finding 2 in violation of 5.1; a Finding 3 that claimed the audience was
"actively hunting" for footage on the strength of two comments on one out-of-window video,
with two further quotes that supported nothing; "almost nothing else" for a 2024 window
whose second asset is 19.1%; three [API] tags on Watcher readings; a lifetime-view
denominator used four lines below the ban on lifetime-view denominators; "established
three ways" for one source read three times; and "four days" and "one week" describing the
same figures in adjacent sections.

The count matters less than the pattern: **every one of those errors made the campaign look
better than the evidence supports.** That is the direction this document will drift in, and
it is what the next reviewer should be looking for.
