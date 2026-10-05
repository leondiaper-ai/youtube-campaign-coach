# Tove Lo — ESTRUS deep dive · audit pack v2

**For independent review.** Read 5 October 2026. Covers the deck at
[`/tovelo`](https://youtube-campaign-coach.vercel.app/tovelo) and the working page at
[`/tovelo/analysis`](https://youtube-campaign-coach.vercel.app/tovelo/analysis).

You are being asked to **try to break this**. The deck has changed shape since v1 of this
pack: it is no longer mainly a retrospective. It now spends roughly 40% of its slides on what
happened and 60% on what to do next, and the forward half makes **recommendations with money
attached**. That raises the stakes on the evidence, so this pack leads with the three places I
think it is weakest rather than with the findings.

**Read §1 first.** One of the three is an error I made and then caught; I want to know whether
my fix is sufficient or whether the claim should come out entirely.

---

## 1. The three things most likely to be wrong

### ⚠ 1a · I made the exact mistake this project exists to avoid, and I want a second opinion on the fix

The deck's founding rule is that **a lifetime view total cannot be compared across assets of
different ages** (§3 below — it is why no ESTRUS/Dirt Femme view totals appear anywhere).

I then wrote this on the A Night In ESTRUS slide:

> 97.7K — *more than 7 of the 11 album-day visualizers*

That is the same error. `DNH live at A Night In ESTRUS` was published 6 August and is **59 days
old**. The album-day visualizers are **17 days old**. Ranking a 59-day lifetime total against
17-day lifetime totals is a publication-vs-accumulation comparison, and I had explicitly
forbidden it 400 lines earlier in the same file.

**What I changed it to:** the figure now reads *"97.7K — in its first 59 days, with no album
behind it"*, with no comparison to the visualizer set, and the slide's qualifier now says
plainly that the two are not comparable and why.

**What I want from you:** is that enough? The argument I am trying to make is "one live asset
carried itself outside a release moment, so live is worth more attention than one upload."
A per-day rate would be the obvious correction — but DNH live runs at ~1,656/day over 59 days
against *source of life* at ~59,545/day over 17, and I do not trust per-day either, because
view curves are front-loaded and a 17-day average sits much higher on the curve than a 59-day
one. **Is there an honest version of this comparison at all, or should the slide simply state
the figure and stop?** My instinct is the latter.

### ⚠ 1b · The tier cut points are defensible but not unique, and the deck does not admit that

The deck sorts the eleven release-day visualizers into three tiers and attaches a different
spending instruction to each. Tier 2 is described as *"the only others clearing 100,000"*.

100,000 is a round number I chose. In its favour, it does coincide with a real break — here is
every gap down the ranking:

| Rank | Track | Views | Drop from the one above |
|---|---|---|---|
| 1 | source of life | 1,012,266 | — |
| 2 | F.A.M.T | 118,745 | **88.3%** |
| 3 | die for my art with a lonely heart | 111,376 | 6.2% |
| 4 | are we on a break | 109,813 | 1.4% |
| 5 | the bad one | 74,460 | **32.2%** |
| 6 | roomie | 74,378 | 0.1% |
| 7 | I'm the cake | 67,373 | 9.4% |
| 8 | if I could I would | 42,891 | **36.3%** |
| 9 | idiot | 42,441 | 1.0% |
| 10 | a lot of feelings, no solutions | 22,826 | **46.2%** |
| 11 | I'm your girl right | 19,298 | 15.5% |

The 1/3/7 split I used falls on the 88.3% and 32.2% breaks. But there are two other breaks of
similar size further down (36.3% and 46.2%), so a 1/3/3/4 or 1/6/4 split would also be
arguable. **Have I cut this where the data cuts, or where the round number is?** And should the
deck show this gap table so the reader can see the cut was a choice?

### ⚠ 1c · "You do not hire a show director to film one song" is rhetoric, not evidence

This is the line carrying the biggest recommendation in the deck. What is **verifiable** is the
credit block on the DNH live upload:

> Shot by Blair Brown · Editor and Colorist — Chris Martin · Creative Director — Charlie
> Twaddle · **Show Director — Phil Marfleet** · Producer — JSE Studio · Tove Lo Styling —
> Annie & Han

What is **not** verifiable, and is not claimed anywhere on the slide: which songs were
performed, whether they were filmed, whether the footage is usable, or whether rights allow
release. No setlist for the event is public — I searched, and the only Tove Lo setlists I could
find are for the September–October ESTRUS tour, which is a different thing and is **not** used
as evidence anywhere.

The slide therefore recommends an **audit of the rushes**, not a release schedule. But the
emotional weight of the slide comes from an inference, and I want it challenged:

1. **Is the inference sound?** A show director could plausibly be credited for a single-song
   staged shoot. How much weight does that credit really carry?
2. **Is "recommend an audit" a legitimate way to put an unverified idea in a deck**, or is it
   a way of implying something while keeping deniability? This is the question I am least sure
   about. It is genuinely the cheapest high-value action on the list if the footage exists —
   and genuinely worthless if it does not.
3. The campaign's own Short *"ESTRUS in nyc 🖤"* (31 July) suggests the event was in New York in
   late July, which fits a 6 August upload. That is the only corroboration I have and it is weak.

---

## 2. Provenance

| | |
|---|---|
| Channel | `@tovelomusic` |
| Source | YouTube Data API v3, single pull, 5 October 2026 |
| Uploads retrieved | **565 of 565 public uploads.** `capped: false` |
| Subscribers | 3,880,000 (YouTube's rounded public figure) |
| Lifetime view counter | 3,330,599,183 |
| Sum of the 565 uploads | 2,808,559,662 — **84.3%** of the counter |

Every view figure is a live counter read at that moment and drifts by a few hundred within the
hour. Figures in this pack were re-read on 5 October and are a few hundred higher than the ones
in the deck, which was built earlier the same day. Nothing material moves.

Campaign window throughout: **13 May – 5 October 2026** (lead single to read date), 145 days.
58 uploads: 38 Shorts, 20 long-form.

---

## 3. The two limitations — unchanged, and still binding

### 3a · ESTRUS and Dirt Femme view totals are not comparable

Dirt Femme's assets were published in 2022 and have accumulated for about four years; ESTRUS's
have had between 17 days and five months. A matched window of *publication* is not a matched
window of *accumulation*, and it cannot be corrected — the API returns a lifetime counter and
nothing else, so there is no way to ask what Dirt Femme had done at day 17.

**The 2.21× figure from v1 of this pack does not appear in the deck and must not be
reintroduced.** The deck compares structure and shares only. The one valid cross-era figure is
the long-form share of window views: **92.6% ESTRUS, 91.7% Dirt Femme** — a share is not
distorted by age the way a total is.

Where Dirt Femme appears, it is as evidence that the previous campaign kept producing
substantial assets long after release, labelled as lifetime totals on three-year-old assets,
and never set against an ESTRUS number.

### 3b · There is no ESTRUS release-week velocity data at all

The channel snapshot froze on 22 September; the per-video daily series stops on 17 September,
the day *before* the album. So every ESTRUS figure is a **lifetime total as at 5 October** with
no visible shape behind it.

**Every grade and recommendation in the deck is therefore about publishing behaviour, not
performance.** Check me on this — if any slide reads as a performance judgement, it is wrong.

---

## 4. What the deck now claims, with arithmetic

### 4a · Format depth per song (long-form only)

| Song | Surfaces | What they were |
|---|---|---|
| I'm your girl right? | **6** | Official video (premiered) · BTS · Her Cut visualizer · lyric video · Fcukers remix audio · album-day visualizer |
| des fleurs x stromae | 2 | Visualizer · official video (premiered) |
| DNH | 2 | Visualizer · live performance |
| Nine other album tracks | 1 each | Album-day visualizer |

Seven distinct long-form formats in the campaign, plus the 33-minute album film. **Three songs
received more than one of them.**

This is the test of our own earlier case study, which found *five formats in just over two
weeks* around the lead single. **Confirmed** — official video 13 May, BTS 26 May, Her Cut
visualizer 29 May, lyric 3 June, remix 5 June, all inside 23 days. The full window shows it
described how the *lead single* was handled, not the campaign. The deck says so rather than
repeating the original slide.

### 4b · Cadence

28 active days. Shorts on 27 of them, long-form on 10; **18 days carry a Short and nothing
else**. Every gap of seven days or more:

| From | To | Days |
|---|---|---|
| 13 May | 20 May | 7 |
| 19 Jun | 29 Jun | 10 |
| 30 Jun | 16 Jul | 16 |
| **6 Aug** | **18 Sep** | **43** |
| **18 Sep** | **5 Oct** | **17, open** |

Shape: 46 uploads across 85 days to 6 August → six weeks silent → 12 uploads on album day →
nothing since.

### 4c · Follow-through

| Hero | First long-form follow-up | Gap |
|---|---|---|
| I'm your girl right? video, 13 May | Behind the scenes, 26 May | 13 days |
| des fleurs visualizer, 12 Jun | des fleurs official video, 30 Jun | 18 days |
| des fleurs official video, 30 Jun | None for this song, ever | — |
| DNH visualizer, 29 Jul | DNH live, 6 Aug | 8 days |
| ESTRUS album, 18 Sep | Nothing published since | 17 days |

### 4d · Premieres — the cleanest finding in the pack

Recoverable from `scheduledStart` / `actualStart`. Three uploads carry the Premiere signature
(a scheduled time with the broadcast starting within seconds of it):

| Upload | Scheduled | Started after |
|---|---|---|
| I'm your girl right? (Official Video), 13 May | 17:30 UTC | 6s |
| des fleurs x stromae (Official Video), 30 Jun | 08:00 UTC | 6s |
| ESTRUS, 18 Sep — 33m 25s album film | 18:00 UTC | 8s |

**Nothing else premiered.** Not one of the fourteen visualizers, not the lyric video, not the
live cut. Premiere was reserved for the three hero moments.

*Is the scheduledStart/actualStart inference safe?* A scheduled live stream that started on
time would look the same. The 33-minute album film is the one I am least sure about — it could
be a genuine stream rather than a Premiere. Does that matter to the finding?

### 4e · The release-day set

Combined 1,695,587 across eleven. *source of life* at 1,012,266 is **59.7%** of the set, and
**14.28× the median of the other ten** (median 70,875.5; on the mean of 68,360 it is 14.81×).
I used the median as the more conservative of the two.

**Caveat carried on the slide:** *I'm your girl right?* sits bottom of the set at 19,298, but
that song already has a 2.18M official video. A low visualizer number on a song that has had
its moment is not a demand signal.

### 4f · Shorts

38 Shorts (65.5% of uploads) carrying **7.4%** of window views; 20 long-form carrying **92.6%**.
Shorts occupied 18 days on which nothing else went out. The deck's claim is therefore limited
to publishing frequency, and it explicitly does **not** claim Shorts drove long-form viewing —
that is not visible in public data and has not been tested.

### 4g · The good-practice grades

| Behaviour | Evidence | Grade |
|---|---|---|
| Album depth | 11 tracks surfaced on album day, plus the album film | Strong |
| World-building | One naming convention, one treatment, one release day, one named event | Strong |
| Premieres | 3 of 3 hero moments; 0 of everything else | Strong |
| Long-form weight | 92.6% of window views on 20 assets | Strong |
| Multi-format | 7 formats, but 6 surfaces to one song and 1 each to nine | Mixed |
| Follow-through | 8–18 days where it happened; a 43-day and a 17-day silence | Mixed |
| Shorts support | 38 on 27 days, 18 of them alone — but stopping 6 Aug | Mixed |
| Live / performance | One asset in the entire campaign | Limited |
| Post-album extension | 17 days, no uploads. Too early to grade | Open |

---

## 5. The forward half — where recommendations acquire cost

This is new since v1 and is the part that spends someone's money. The chain is:

> surface every track → watch what separates → support the signal cheapest-first → turn the
> winner into a mini-campaign → repeat

Specific recommendations made:

1. **source of life has earned a second asset.** Effort ladder ordered cheapest-first (cut
   Shorts from the existing visualizer → use footage already shot → commission a hero video),
   explicitly *not* recommending all three.
2. **Audit the A Night In ESTRUS rushes.** See §1c.
3. **Cut Shorts out of existing assets** rather than shooting disconnected ones.
4. **Give the three Tier 2 tracks a cheap push**, then re-read.
5. **Re-read the set every 30 days** and let the tier decide the spend.

**Questions:**

1. **Is the des fleurs precedent strong enough to carry recommendation 1?** The deck uses it to
   argue a visualizer does not exhaust a song (visualizer 12 Jun 899.9K → official video 30 Jun
   4.98M). It is stated as sequence, not cause. But it is **one instance**, and it is the song
   with a Stromae feature, which is a confound the deck does not mention. Should it?
2. **Is recommending re-reads every 30 days safe** when the thing being re-read is a lifetime
   total? Month-on-month deltas on lifetime counters are fine in principle, but the Watcher's
   daily collection has already failed once in this campaign. Should the deck say that the
   monitoring it recommends depends on collection we have not proven reliable?
3. **Does the deck over-read a single breakout?** 14.28× is enormous. But it is one song, at 17
   days, with no velocity data. Is "has earned a second moment" too strong, and should it be
   "is the only candidate currently visible"?

---

## 6. Things deliberately not claimed

- That ESTRUS out- or under-performed Dirt Femme. §3a.
- Anything about release-week momentum, velocity or first-week performance. §3b.
- That the quiet year of 2025 cost anything. One upload is a fact; consequences are not visible.
- That the two silences cost anything. Facts about publishing only.
- That Shorts drove long-form viewing.
- That the des fleurs visualizer caused the official video.
- That footage of any specific song exists from A Night In ESTRUS.
- That more surfaces per song produce more viewing. The depth table counts what each song was
  *given*, not what it earned.
- Anything about streaming, radio or touring. No DSP data was used.

---

## 7. Questions for the reviewer, in priority order

1. **§1a** — is the corrected live figure honest now, or should the comparison be dropped
   entirely? This is the one I most want a second opinion on.
2. **§1c** — is "recommend an audit" a legitimate device for an unverified but high-value idea,
   or is it implication with deniability?
3. **§1b** — are the tier cuts where the data cuts, or where the round number is? Should the
   gap table be on the slide?
4. **§5 Q1** — does the Stromae feature confound the des fleurs precedent enough that the deck
   should name it?
5. **§5 Q3** — is "source of life has earned a second moment" too strong at 17 days?
6. **§4d** — is the Premiere inference safe, particularly for the 33-minute album film?
7. Does anything in the deck read as a **performance** judgement rather than a publishing one?
   If so it violates §3b and needs rewriting.
8. Is the 40/60 retrospective/forward balance right for a label audience, or has the deck now
   under-explained the campaign in order to get to the recommendations?
