# TEN (@tenoffcl) — full channel audit

**Independent review pack.** Prepared for external review before any client-facing
deep dive is built.

Channel: **TEN** — `youtube.com/@tenoffcl` — `UC1a1QawKLefYNAjpT0ELNrQ`
Data retrieved: **23 September 2026, 13:06 UTC**
Source: **public YouTube Data API v3 only.** No YouTube Studio access, no
private analytics, no retention or traffic-source data.

---

## 0. How to review this document

This pack exists to be argued with. Every figure below is either a **retrieved
value** (came directly off the API) or a **derived value** (arithmetic on
retrieved values, with the arithmetic shown). Nothing here is an estimate.

Three things are worth checking hardest, because they are where the analysis
is most exposed:

1. **§1 — the 41M view discrepancy.** We cannot reconcile it. Read that section
   before anything else, because it constrains what the rest of the document is
   allowed to claim.
2. **§5 — the OUTWEST anomaly.** We have a hypothesis about paid amplification.
   It is labelled a hypothesis. It should not be repeated as fact.
3. **§9 — recommendations.** These are judgements, not findings. They can be
   wrong without anything in §1–§8 being wrong.

Figures move hourly on a live channel. Re-pull before quoting.

---

## 1. The claim boundary — read this first

### The discrepancy

| Measure | Value | Source |
|---|---|---|
| Channel lifetime views (`statistics.viewCount`) | **48,095,197** | retrieved |
| Sum of views across all public uploads | **7,070,488** | derived, 59 videos |
| Unaccounted | **~41,024,709** | derived |
| Public video count (`statistics.videoCount`) | **59** | retrieved |
| Videos we retrieved from the uploads playlist | **59** | retrieved |
| Playlist retrieval capped or truncated? | **No** | retrieved |

We retrieved **59 of 59** videos. The uploads playlist was not truncated. The
channel's own video count agrees with ours. And yet the channel reports roughly
**seven times** more lifetime views than its entire public catalogue accounts for.

### What we ruled out

- **Truncated retrieval.** The API reported `capped: false` and returned 59 of 59
  playlist IDs. Not this.
- **An older channel with deleted history.** The channel was created
  **7 July 2026** (`publishedAt`, retrieved). It is 78 days old. There is no
  decade of removed uploads sitting behind the counter.

### What we cannot rule out

Videos uploaded and later removed or made private within the last 78 days;
view attribution from collaborative or cross-posted uploads; a platform-side
counting behaviour we cannot observe from outside. We do not know which. We are
not going to guess in a client document.

> **Binding constraint on everything that follows.**
> This audit makes **no claim about any video's share of channel lifetime views**,
> and no claim of the form "X% of the channel's audience came from Y". Every share
> figure below is explicitly a **share of the public uploads catalogue**, which is
> a smaller and different denominator. Anyone extending these figures to the 48.1M
> number is making a claim this data does not support.

---

## 2. The channel in one page

| | | |
|---|---|---|
| Channel created | **7 Jul 2026** | retrieved |
| First upload | **28 Jul 2026** | retrieved |
| Most recent upload | **22 Sep 2026** | retrieved |
| Active publishing span | **57 days** | derived |
| Subscribers | **115,000** (+3,000 in 7 days) | retrieved |
| Public uploads | **59** | retrieved |
| — long-form | **12** | derived |
| — Shorts | **47** | derived |
| Catalogue views (public uploads) | **7,070,488** | derived |
| — long-form | **6,212,560** (87.9%) | derived |
| — Shorts | **857,000** (12.1%) | derived |
| Total likes (catalogue) | **167,043** | derived |
| Total comments (catalogue) | **15,668** | derived |

This is a **brand-new solo channel**, not an established one. Every comparison in
this document is internal — asset against asset, week against week. There is no
prior era on this channel to compare against, and we have deliberately not
benchmarked against other artists' channels, because a 57-day-old channel and a
five-year-old channel are not comparable objects.

**Three songs have been worked in 57 days:**

| Song | MV date | MV views | Assets built around it |
|---|---|---|---|
| If You Don't Mean It | 30 Jul 2026 | 9,463 | 1 long-form + a handful of launch Shorts |
| **OUTWEST** | 4 Sep 2026 | **5,687,472** | **30** |
| IRL | 14 Sep 2026 | 143,665 | 11 |

---

## 3. Cadence — this is the channel's clearest strength

**59 uploads in 57 days.** Uploads landed on **30 of 57 days (53%)**. The
**longest gap was 9 days** (2 Aug → 11 Aug), in the pre-campaign window.

Uploads per week from first upload:

| Week | Dates | Long-form | Shorts | Total |
|---|---|---|---|---|
| 1 | 28 Jul – 3 Aug | 1 | 11 | **12** |
| 2 | 4 – 10 Aug | 0 | 0 | **0** |
| 3 | 11 – 17 Aug | 1 | 0 | **1** |
| 4 | 18 – 24 Aug | 2 | 1 | **3** |
| 5 | 25 – 31 Aug | 0 | 3 | **3** |
| 6 | 1 – 7 Sep | 3 | 11 | **14** |
| 7 | 8 – 14 Sep | 3 | 15 | **18** |
| 8 | 15 – 21 Sep | 1 | 6 | **7** |
| 9 | 22 Sep (1 day) | 1 | 0 | **1** |

**Observed.** The shape is a soft launch (week 1), a four-week trough
(weeks 2–5, 7 uploads total), then a hard campaign push (weeks 6–7, 32 uploads),
then a taper.

**Interpretation.** Weeks 6–7 are genuinely well-run: 32 assets in 14 days,
with long-form and Shorts interleaved rather than batched. This is the standard
most channels are told to reach and do not. It is worth saying plainly that the
campaign execution here is above average.

The weakness is not the push — it is the **four-week trough before it** and the
**taper after it**. A channel that publishes 32 assets in a fortnight and then 8
in the following nine days is teaching the algorithm and the audience that this
channel is episodic. The subscriber base built during a spike has nothing to
return to.

---

## 4. Format architecture — what exists and what does not

Across all 59 uploads, by keyword classification of titles:

| Format | Count | Present? |
|---|---|---|
| Official Music Video | 3 | ✅ |
| Dance Practice | 2 | ✅ |
| Behind the Scenes / Sketch | 8 | ✅ |
| MV Teaser | 3 | ✅ |
| Fanchant Guide | 1 | ✅ |
| Concert recap / concert BTS | 2 | ✅ |
| **Lyric video** | **0** | ❌ |
| **Visualiser** | **0** | ❌ |
| **Audio-only / official audio upload** | **0** | ❌ |
| **Live performance / stage video** | **0** | ❌ |
| **Dance challenge (formatted, repeatable)** | **0** | ❌ |

### The support-asset matrix, by song

| Asset | OUTWEST | IRL | If You Don't Mean It |
|---|---|---|---|
| Official MV | ✅ 5,687,472 | ✅ 143,665 | ✅ 9,463 |
| MV Teaser | ✅ ×2 (19K, 32K) | ✅ ×1 (11K) | ❌ |
| Dance Practice | ✅ 144,483 | ✅ 97,748 | ❌ |
| Fanchant Guide | ✅ 34,679 | ❌ | ❌ |
| MV Behind the Scenes | ✅ 21,183 | ✅ 14,756 | ❌ |
| Recording Behind the Scenes | ❌ | ✅ 10,327 | ❌ |
| **Lyric video** | ❌ | ❌ | ❌ |
| **Visualiser** | ❌ | ❌ | ❌ |
| **Official audio** | ❌ | ❌ | ❌ |
| **Live performance** | ❌ | ❌ | ❌ |
| Promo Shorts | 30 | 7 | 4 |

**The three clearest gaps, in priority order:**

1. **No evergreen lyric or visualiser asset for any of the three songs.** This is
   the single largest missing piece. Lyric videos and visualisers are the assets
   that keep accruing search and recommendation traffic for years after the
   promotional window closes. This channel currently has nothing that works
   after the campaign stops. Every asset on it is a campaign asset.
2. **No live performance content at all** — despite a **10th anniversary concert
   having happened** (TEN:CORE0110, recapped 11 Aug, BTS 19 Aug). The concert was
   documented but not performed on the channel. There is captured live material
   here that was used for a 2-minute recap and a 15-minute BTS, and not for a
   single performance video.
3. **If You Don't Mean It was never given a campaign.** It has an MV and a few
   launch Shorts. It sits at 9,463 views — the **lowest-performing long-form
   asset on the channel**. Whether that is because the song was not a priority or
   because it was not supported, the public record shows an unsupported release.

---

## 5. The OUTWEST anomaly — the most important finding, and the most fragile

### Observed

| Video | Views | Likes | Comments | Likes/1k | Comments/1k |
|---|---|---|---|---|---|
| **OUTWEST (Official MV)** | **5,687,472** | **hidden** | 5,237 | — | **0.92** |
| IRL (Official MV) | 143,665 | 11,745 | 1,498 | 81.8 | 10.43 |
| OUTWEST Dance Practice | 144,483 | 9,465 | 715 | 65.5 | 4.95 |
| IRL Dance Practice | 97,748 | 7,301 | 583 | 74.7 | 5.97 |
| OUTWEST Fanchant Guide | 34,679 | 3,204 | 468 | 92.4 | 13.50 |
| OUTWEST MV BTS | 21,183 | 2,446 | 361 | 115.5 | 17.04 |
| IRL MV BTS | 14,756 | 1,849 | 224 | 125.3 | 15.18 |
| IRL Recording BTS | 10,327 | 1,561 | 266 | 151.2 | 25.76 |
| **All long-form except OUTWEST** | **525,088** | **47,268** | 5,537 | **90.0** | **10.5** |

Two facts sit inside that table.

**Fact one: the like count is hidden on the OUTWEST MV.** The API returns no
like count for it, and the YouTube watch page shows a Like button with no number
beside it. **Every other video on the channel displays its likes.** This is the
channel's single biggest asset and it is the one asset where the most visible
social-proof signal has been switched off. We verified this directly on the watch
page rather than inferring it from the API.

**Fact two: OUTWEST's comment rate is an order of magnitude below the rest of the
channel.** 0.92 comments per 1,000 views, against **10.5** for every other
long-form video. That is an **11× gap**, on the same channel, in the same
fortnight, for the same artist.

### Hypothesis — labelled as such

The signature of *very high views with proportionally very low engagement* is
consistent with **substantial paid amplification** driving impressions that do
not convert to interaction at the same rate as organic views. That is a common
and entirely legitimate campaign tactic.

**We cannot confirm it from public data.** Doing so would require Studio traffic
source data we do not have. Competing explanations exist — a viral surge from a
non-fan audience, heavy embedding, or a platform placement — and produce a
similar shape. **This must not be stated as fact in any client-facing document.**

### Why it matters either way

Whichever explanation is right, the strategic read is the same and it is the most
useful thing in this pack:

> **IRL is the honest baseline for this channel's organic pull. OUTWEST is not.**

IRL's MV did **143,665** views with **81.8 likes and 10.43 comments per 1,000** —
engagement rates consistent with the rest of the catalogue. OUTWEST's dance
practice, at **144,483**, did almost exactly the same number as the IRL music
video. Two different songs, two different formats, the same ceiling.

**That ceiling — roughly 100–150K on a well-supported long-form asset — is what
this channel currently converts organically.** Any plan built on the 5.69M number
is building on a foundation we cannot verify. Any plan built on the 144K number
is building on something consistent across four separate assets.

---

## 6. Guesting — already a habit; the variable is who

> **⚠️ This section was wrong in the first issue of this pack and has been
> rewritten.** It previously reported *8 collaborations of 47, at a 1.9× median
> advantage, the clearest underexploited asset on the channel.* Every part of
> that was an artefact of a bad classifier. What it should have said is below;
> the failure is documented in §6.1 rather than quietly removed.

47 Shorts, **857,000** views, **median 16,941**, range 4,592 – 58,987.

**21 of 47 Shorts name a guest.** Guesting is not an underused tactic here — it
is a standing habit, running since the first week of the channel. But it does
not pay the same every time:

| Group | n | Median views | Range |
|---|---|---|---|
| **Major K-pop idol guest** | **5** | **31,230** | 22,238 – 58,987 |
| Other named guest | 8 | 19,451 | 5,318 – 26,076 |
| No guest named | 26 | 16,189 | 4,592 – 32,705 |
| **Thai launch guest** | 8 | **11,403** | 6,482 – 17,146 |
| All Shorts | 47 | 16,941 | 4,592 – 58,987 |

The four groups are mutually exclusive and sum to 47.

**The five major-guest Shorts, all of them:**

| Views | Guest |
|---|---|
| 58,987 | **andTEAM · NICHOLAS** |
| 45,910 | **WayV · KUN** |
| 31,230 | **SEVENTEEN · DINO** |
| 25,757 | **Stray Kids · MINHO** |
| 22,238 | **KWON EUNBI** |

**Observed.** Four of the channel's top five Shorts carry a major-idol guest.
Meanwhile the eight Thai launch guests — NuNew, JAYLERR, PP Krit, Butterbear,
PiXXiE, URBOYTJ, LUNAR, SIN Singular — sit **below** the channel's own solo
median.

**Observed.** The strongest Short carrying no guest at all is
**"😺When Louis is talking about his perfect crush to Leon…" at 32,705** — a bit
about TEN's two cats, which outperforms every collaboration except andTEAM and
WayV.

**Interpretation.** Collaboration is not the finding; it is the baseline. The
finding is that the *scale of the guest's own fandom* is what moves the number,
and that the channel's own personality content competes with it.

**The objection to raise first.** All five major-guest Shorts ran inside the
OUTWEST push, when the channel was at its most visible; the eight Thai guests
ran in week one, when it was days old. **Guest scale and campaign timing are
confounded and cannot be separated from this data.** n=5 is a strong indication,
not a measurement.

### 6.1 How the original figure came to be wrong

Recorded because the method matters more than the number.

1. The first classifier was **a hand-written list of K-pop names I had spotted
   by eye** while reading the titles. It found 8 collaborations because it was
   only ever looking for 8 kinds of name. It missed the entire Thai launch
   block, which is 8 more.
2. The second attempt matched those names as **loose substrings**, at which
   point `Est` matched inside `OUTWEST` and swept nearly every campaign Short
   into the "collaboration" bucket, producing 39 of 47.
3. The classifier now extracts only **`#hashtag` and `@handle` tokens** and
   matches them whole. Every one of the 47 assignments was printed and read
   before the figures above were written.

This is precisely the failure mode §10 warns about for format classification —
keyword matching against a multilingual title set — and it happened to the
collaboration analysis first. Any figure in this pack derived from title text
should be treated as carrying this risk until it has been eyeballed.

---

## 7. Engagement structure — the counter-intuitive read

| | Videos | Views | Likes/1k | Comments/1k |
|---|---|---|---|---|
| Shorts | 47 | 857,000 | **139.8** | **5.71** |
| Long-form (excl. OUTWEST) | 11 | 525,088 | 90.0 | **10.5** |
| Long-form (incl. OUTWEST) | 12 | 6,212,560 | 7.6 | 1.73 |

**The behind-the-scenes videos are the most engaged content on the channel, and
the least watched.**

| Video | Duration | Views | Likes/1k | Comments/1k |
|---|---|---|---|---|
| IRL Recording BTS | 16 min | 10,327 | **151.2** | **25.76** |
| IRL MV BTS | 12 min | 14,756 | 125.3 | 15.18 |
| OUTWEST MV BTS | 27 min | 21,183 | 115.5 | 17.04 |
| OUTWEST Dance Practice | 3 min | 144,483 | 65.5 | 4.95 |
| OUTWEST MV | 4 min | 5,687,472 | — | 0.92 |

There is a clean inverse relationship: **the fewer people watch it, the harder
the people who do watch it engage.**

**Interpretation.** This should not be read as "BTS content underperforms". It
should be read as: **the long BTS videos are superfan retention assets, and they
are doing that job extremely well.** 25.76 comments per 1,000 views on a
16-minute video is a strong number by any standard.

The error would be to judge them on views and cut them. The opportunity is that
the channel currently has a well-served superfan tier and an under-served
discovery tier, with guest Shorts the main mechanic bridging the two.

---

## 8. Asset hygiene

| Check | Result |
|---|---|
| Long-form videos with tags | **10 of 12** |
| Long-form videos missing tags | **2** — *If You Don't Mean It MV*, *JisuLife Shooting Sketch* |
| Long-form videos with a real description | **10 of 12** (same two missing) |
| Shorts with tags | **7 of 47** |
| Shorts with a description ≥ 20 chars | **5 of 47** |
| Like count visible | **58 of 59** — hidden on the OUTWEST MV |

**Observed.** Long-form tagging is genuinely good where it exists — multilingual
(`TEN, 李永钦, 텐`), song-specific, and **cross-tagged**: the IRL assets all carry
`OUTWEST` as a tag, which is a deliberate and correct attempt to pull the bigger
song's traffic toward the newer one. Someone on this team knows what they are doing.

**Two clear misses:**

1. **The debut single's MV has no tags and no description.** *If You Don't Mean
   It* is the channel's first release and its worst performer at 9,463 views, and
   it is also the only MV with no metadata whatsoever. These may be related. At
   minimum it is free to fix.
2. **Shorts metadata is essentially absent** — 42 of 47 have no description, 40 of
   47 have no tags. All discovery information lives in the on-screen title's
   hashtags. This is a defensible Shorts strategy and we are not going to call it
   a failure, but it does mean the Shorts library contributes nothing to search.

---

## 9. Recommendations — judgements, not findings

Ordered by expected impact against effort.

**1. Build the evergreen layer. This is the biggest single gap.**
Three songs, zero lyric videos, zero visualisers, zero official audio uploads.
The channel has nothing that earns views after a campaign ends. Lyric videos for
OUTWEST and IRL are low-cost and would give the channel its first assets with a
multi-year tail.

**2. Choose guests for reach, not only for goodwill.**
Guesting is already habitual — 21 of 47 Shorts — so the recommendation is not to
do more of it. It is that the five major-idol guests run at a 31,230 median and
hold four of the top five slots, while the eight Thai launch guests landed below
the channel's own solo median. Same mechanic, very different outcomes. Worth
booking deliberately. (See §6 for why this figure is an indication rather than a
measurement.)

**3. Publish a live performance asset from TEN:CORE0110.**
The footage exists — it produced a recap and a 15-minute BTS. A performance video
from a 10th anniversary concert is a format this channel has never tried, and one
that serves both the superfan tier and the discovery tier at once.

**4. Plan for the trough, not just the push.**
Weeks 6–7 (32 uploads) were excellent. Weeks 2–5 (7 uploads) were not. The
campaign capability is clearly there; the between-campaign capability is not.
Two Shorts a week through a quiet period costs little and stops the channel
resetting to zero before each push.

**5. Restore the like count on the OUTWEST MV.**
5.69M views with no visible like count is a large amount of social proof left on
the floor. If this was deliberate, it is worth revisiting. If it was accidental —
which it may well have been, given every other video displays normally — it is a
one-click fix on the channel's most valuable asset.

**6. Add tags and a description to the If You Don't Mean It MV.**
Free. Ten minutes. It is the only MV on the channel without them.

**7. Give the next single an IRL-shaped plan, not an OUTWEST-shaped one.**
Plan against the ~100–150K organic ceiling that four separate assets agree on,
and treat anything above it as upside.

---

## 10. What a reviewer should push back on

We would rather raise these ourselves than have them found.

**The 41M discrepancy is unresolved and it is large.** We have stated the
boundary it imposes, but a reviewer is entitled to say that a channel whose
headline view count we cannot reconcile is a channel we do not fully understand.
That is a fair objection.

**The paid-amplification hypothesis is unfalsifiable from outside.** It is
labelled, it is caveated, and it still carries an implication. A reviewer should
check that no downstream document has quietly promoted it to fact.

**57 days is a very short window.** Every cadence finding in §3 rests on nine
weeks, two of which are the campaign and four of which are the trough. Week-level
patterns from a sample this small are suggestive, not conclusive.

**Format classification is keyword-based on titles.** A video whose title does
not contain "lyric" is counted as not being a lyric video. On a channel with
Thai and Korean titles and heavy emoji use, this will miss things. The specific
claim "zero lyric videos, zero visualisers, zero live performance" should be
confirmed by eye against the channel's video list before it is published.

**We do not have retention, traffic source, or demographic data.** Every read
about *why* something performed is inference from views, likes and comments.
Studio access would change several of the conclusions above, and might reverse
some of them.

**"Best" and "worst" throughout mean views on the public uploads catalogue.**
They do not mean revenue, streaming impact, ticket sales, or anything the artist
team might reasonably care about more.

---

## 11. Figure index

Every number in this document, with its origin.

| Figure | Value | Type |
|---|---|---|
| Channel created | 7 Jul 2026 | retrieved (`publishedAt`) |
| Subscribers | 115,000 | retrieved |
| Lifetime views | 48,095,197 | retrieved |
| Public video count | 59 | retrieved |
| Videos retrieved | 59 of 59, uncapped | retrieved |
| First / last upload | 28 Jul / 22 Sep 2026 | retrieved |
| Active span | 57 days | derived |
| Catalogue views | 7,070,488 | derived (sum of 59) |
| Unaccounted views | ~41,024,709 | derived |
| Long-form / Shorts split | 12 / 47 | derived |
| Long-form views | 6,212,560 | derived |
| Shorts views | 857,000 | derived |
| Upload days | 30 of 57 (53%) | derived |
| Longest gap | 9 days (2 → 11 Aug) | derived |
| OUTWEST MV | 5,687,472 views, likes hidden, 5,237 comments | retrieved |
| IRL MV | 143,665 / 11,745 / 1,498 | retrieved |
| OUTWEST share of catalogue | 80.5% | derived |
| OUTWEST share of long-form | 91.5% | derived |
| OUTWEST comments/1k | 0.92 | derived |
| Long-form excl. OUTWEST, comments/1k | 10.5 | derived |
| Long-form excl. OUTWEST, likes/1k | 90.0 | derived |
| Shorts likes/1k · comments/1k | 139.8 · 5.71 | derived |
| Shorts median views | 16,941 | derived |
| Shorts naming a guest | 21 of 47 | derived (#tag / @handle) |
| — major K-pop idol guest | 5, median 31,230 | derived |
| — other named guest | 8, median 19,451 | derived |
| — Thai launch guest | 8, median 11,403 | derived |
| Shorts with no guest named | 26, median 16,189 | derived |
| Best Short with no guest (the cats) | 32,705 | retrieved |
| Lyric / visualiser / audio / live count | 0 / 0 / 0 / 0 | derived (title keyword) |
| Long-form missing tags | 2 of 12 | derived |
| Shorts missing description | 42 of 47 | derived |

---

*Prepared 23 September 2026. Public YouTube Data API v3 only — no YouTube Studio
metrics are used or implied anywhere in this document.*
