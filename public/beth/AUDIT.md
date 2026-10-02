# Beth McCarthy — YouTube channel deep dive
## Audit pack for independent review

**Version 2 · 2 October 2026**
Deck: `/beth` · Evidence page: `/beth/analysis`

---

## What I am asking you to do

Check this analysis for errors of fact, arithmetic and inference. I would
rather find a problem here than in a meeting with the artist's management.

Please be adversarial. In particular:

1. **Arithmetic.** Every figure and percentage below. They should reconcile.
2. **Classification.** The single biggest judgement call is what counts as a
   "response" song. If that call is wrong the headline finding moves.
3. **Inference.** Flag anywhere I have implied causation from what is only
   co-occurrence, or treated a correlation as a mechanism.
4. **Omission.** Anything in the data that contradicts the story and is not
   on the deck.
5. **Actionability.** Whether the four recommendations actually follow from
   the evidence, or whether they are plausible-sounding advice that would be
   given to any artist.

---

## 1. The data

Single pull, YouTube Data API v3, against `@BethMcCarthy`
(channel `UC51Jwy26FL8JU5Wt7UlIpJg`), **2 October 2026 at 10:18 UTC**.
Re-pulled at 10:20 to confirm stability; figures moved by single digits.

| | |
|---|---|
| Public uploads returned | **26** |
| API reported `publicVideoCount` | **26** |
| Response capped? | **No** |
| Uploads summed | **12,071,222** |
| Channel lifetime counter | **12,069,430** |
| Subscribers | **96,300** |
| Channel created | 24 April 2011 |

**Note the reconciliation.** The uploads sum to **1,792 above** the lifetime
counter. On most channels the counter sits *above* the sum (removed/private
videos). Here it sits very slightly below, which is ordinary intra-day counter
lag — the counter updates less often than per-video counts.

**Consequence:** unlike most channels, there is no unaccounted gap. Every
percentage in this analysis is a share of the *entire* channel.

**Is 26 really everything?** Worth challenging — 26 uploads for a channel with
96.3K subscribers and a 2.9M video is unusually few. Checks done: the API
returned 26 of a stated 26 and was not capped, and the uploads-playlist count
also returned 26.

**RESOLVED (2 Oct).** The public Shorts tab at `youtube.com/@BethMcCarthy/shorts`
was loaded and read directly. It contains **exactly one Short** — "wrote an
anthem for the baddies", 2.6K views — matching the API. The channel header on
that page independently reports "26 videos" and "96.3K subscribers".

This closes what was the largest data risk in version 1 of this pack. The
"one Short" claim is now verified rather than inferred.

### Full catalogue (all 26, as pulled)

| # | Published | Title | Dur | Short | Views | Likes | Comments |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-07 | wrote an anthem for the baddies | 16s | Y | 2,672 | 93 | 3 |
| 2 | 2026-09-04 | Pretty Villain (Official Music Video) | 141s | | 11,302 | 557 | 49 |
| 3 | 2026-06-22 | Hey Handsome (Visualiser) | 159s | | 28,909 | 1,254 | 64 |
| 4 | 2026-02-06 | How Am I Supposed To Love Myself? (Visualiser) | 253s | | 19,275 | 973 | 71 |
| 5 | 2025-12-26 | The Hot & Stupid Tour Live from London | 1549s | | 6,651 | 370 | 26 |
| 6 | 2025-09-12 | What If I Never Make It? (Visualiser) | 213s | | 13,045 | 696 | 47 |
| 7 | 2025-02-14 | Hot and Stupid (Official Music Video) | 147s | | 188,814 | 5,068 | 137 |
| 8 | 2024-05-31 | Good Bi (Visualiser) | 200s | | 294,309 | 9,658 | 341 |
| 9 | 2024-03-27 | IDK How To Talk To Girls (Official Video) | 165s | | 213,019 | 6,383 | 198 |
| 10 | 2024-01-05 | IDK How To Talk To Girls (Visualiser) | 161s | | 338,812 | 10,238 | 209 |
| 11 | 2023-08-17 | She's Pretty (Official Music Video) | 178s | | 292,741 | 7,429 | 177 |
| 12 | 2023-06-01 | She's Pretty (Official Lyric Video) | 175s | | 265,963 | 5,141 | 96 |
| 13 | 2023-04-27 | What Do You Call It? (Official Music Video) | 253s | | 132,490 | 4,181 | 92 |
| 14 | 2023-03-24 | What Do You Call It? (Official Lyric Video) | 209s | | 30,278 | 1,107 | 39 |
| 15 | 2022-09-29 | You Ruined Love (Visualiser) | 207s | | 68,942 | 1,941 | 44 |
| 16 | 2022-03-25 | No Hard Feelings (Official Music Video) | 221s | | 49,622 | 1,713 | 50 |
| 17 | 2021-12-08 | Friendship Bracelet (Visualiser) | 180s | | 47,199 | 1,584 | 49 |
| 18 | 2021-06-11 | She Gets The Flowers (Acoustic) | 218s | | 133,954 | 5,298 | 224 |
| 19 | 2021-04-15 | She Gets The Flowers (Official Music Video) | 230s | | 2,895,684 | 112,643 | 2,506 |
| 20 | 2021-03-26 | She Gets the Flowers (Lyric Video) | 228s | | 537,039 | 21,621 | 687 |
| 21 | 2021-03-21 | (Self) Love Story (Taylor Swift Response) | 195s | | 3,044,922 | 98,454 | 2,597 |
| 22 | 2021-03-05 | July (Noah Cyrus Response) | 138s | | 2,433,511 | 76,889 | 1,245 |
| 23 | 2021-01-15 | Omg Did She Call Him Baby? (Official Music Video) | 241s | | 797,057 | 33,278 | 633 |
| 24 | 2020-09-11 | A Little Bit Mine / A Little Bit Yours (JP Saxe Response) | 212s | | 167,463 | 3,790 | 87 |
| 25 | 2016-11-02 | Streets Of London (From "100 Streets") | 222s | | 36,756 | 497 | 23 |
| 26 | 2016-05-06 | Left Behind (Live Session) | 196s | | 20,793 | 590 | 31 |

---

## 2. The headline claim, and how to break it

> **Four response songs hold 53.4% of the channel. She Gets The Flowers holds
> 29.5%. Together 82.9%.**

| Group | Uploads | Views | Share |
|---|---|---|---|
| Response / rewrite | 4 | 6,442,953 | 53.4% |
| She Gets The Flowers (3 assets) | 3 | 3,566,677 | 29.5% |
| Everything else | 19 | 2,061,592 | 17.1% |
| **Total** | **26** | **12,071,222** | **100%** |

Response = rows 21, 22, 23, 24.

### The judgement call

Three of the four are explicitly titled "(… Response)": rows 21, 22, 24.

**Row 23, `Omg Did She Call Him Baby?`, is not.** I counted it as a response
because its own YouTube description reads: *"'Omg Did She Call Him Baby?' by
Beth McCarthy is a rewrite of the song 'Be Around Me' by Will Joseph Cook"*.

**If you disagree**, the figures become:

| | Response share | "Everything else" |
|---|---|---|
| With row 23 (as published) | 53.4% | 17.1% |
| Without row 23 | **46.8%** | 23.7% |

The combined response + Flowers figure moves **82.9% → 76.3%**. The deck's
argument survives either way, but the headline number changes. Tell me if you
think the deck should use the more conservative figure.

### The deeper challenge I want you to make

All four response uploads, and all three Flowers assets, were published
between **11 September 2020 and 11 June 2021**. Three of the four responses
went up within **16 days of each other** (5, 21 March and — further out —
15 January 2021).

So "response songs work" and "this artist had a moment in early 2021" are
**not separable from outside this data**. The deck says the format and the
moment cannot be separated (evidence page, under the recommendations table).

**Is that caveat prominent enough, given the deck's cover makes the response
claim the headline?** I think this is the most legitimate attack on the whole
analysis and I want your view.

---

## 3. She Gets The Flowers

Quoted verbatim from the video's own YouTube description:

> "The original concept for this song was inspired by a video of Hannah Klein
> […] After seeing this and having experienced those emotions myself, I posted
> my initial idea for 'She Gets The Flowers' onto TikTok. I honestly couldn't
> believe the amount of people who commented saying…"

The API truncates descriptions at ~400 characters, so **I cannot read the rest
of that sentence.** The deck's fourth loop panel — "real submitted stories,
held up to camera on handwritten cards" — is from the **campaign brief**, and
is consistent with the video thumbnail, but is **not** quoted from the
description. Flag if you think the deck implies otherwise.

| Asset | Published | Views |
|---|---|---|
| Official music video | 2021-04-15 | 2,895,684 |
| Lyric video | 2021-03-26 | 537,039 |
| Acoustic | 2021-06-11 | 133,954 |
| **Total** | | **3,566,677** |

**Assets per song.** 19 distinct songs across 24 song-asset uploads (the other
two uploads are the full-show live film and the Short).

- 3 assets: **1 song** (She Gets The Flowers)
- 2 assets: **3 songs** (She's Pretty, IDK How To Talk To Girls, What Do You Call It?)
- 1 asset: **15 songs**

Check: (1×3) + (3×2) + (15×1) = 24, + 2 non-song uploads = 26. ✓

---

## 4. Format census

| Category | Uploads | Views | Share |
|---|---|---|---|
| Response / rewrite | 4 | 6,442,953 | 53.4% |
| Official video | 7 | 3,783,672 | 31.3% |
| Lyric video | 3 | 833,280 | 6.9% |
| Visualiser | 7 | 810,491 | 6.7% |
| Acoustic | 1 | 133,954 | 1.1% |
| Sync / film | 1 | 36,756 | 0.3% |
| Live | 2 | 27,444 | 0.2% |
| Shorts | 1 | 2,672 | 0.0% |
| **Total** | **26** | **12,071,222** | **100%** |

Categories are assigned from titles, which on this channel are explicit —
every song asset names its format in brackets. The only inferred assignment is
row 23 (see §2).

**Derived claims on the deck:**
- "23 of 26 uploads are a song asset" = 26 − 2 live − 1 Short = 23. ✓
- "1 Short, ever" — subject to the Shorts-tab risk in §1.
- "0 standalone live song destinations" — the two live uploads are a 2016
  session and a 25m49s full show. Neither is a single song published as its
  own destination.
- "0 personality, community, BTS or fan uploads" — no upload in the 26 fits
  any of those descriptions.

---

## 5. Engagement — the claim that the audience deepened

Likes and comments **per 1,000 views**, which is comparable across uploads of
different ages and sizes in a way raw totals are not.

| Era | Uploads | Views | Likes/1k | Comments/1k |
|---|---|---|---|---|
| 2020–21 | 8 | 10,056,829 | 35.2 | 0.80 |
| 2022–24 | 9 | 1,686,176 | 28.3 | 0.74 |
| 2025–26 | 7 | 270,668 | 33.3 | **1.47** |

2026 uploads individually:

| Upload | Views | Likes/1k | Comments/1k |
|---|---|---|---|
| How Am I Supposed To Love Myself? | 19,275 | 50.5 | 3.68 |
| Hey Handsome | 28,909 | 43.4 | 2.21 |
| **Pretty Villain** | 11,302 | 49.3 | **4.34** |
| wrote an anthem for the baddies | 2,672 | 34.8 | 1.12 |

Pretty Villain ranks **1st of 26 on comment rate**, 4th of 26 on like rate.
Channel median like rate: 33.6 per 1,000.

### Challenges I want you to make here

1. **Small-denominator effect.** Pretty Villain's rate is computed on 11,302
   views. Is 4.34 per 1,000 meaningfully different from noise at that scale?
   (49 comments absolute.)
2. **Age confound.** New uploads accumulate likes and comments early and views
   for years afterwards, so a 28-day-old upload will *structurally* show a
   higher engagement rate than a five-year-old one. **I think this is a real
   weakness in the "audience deepened" claim and the deck does not currently
   state it.** Please tell me how serious you think it is.
3. Is "four times harder" (0.80 → 4.34) a fair thing to put on a slide, given
   it compares an *era average* to a *single upload*?

---

## 6. The two abandoned series

Both quoted from the uploads' own descriptions.

| Announced | Stated | Delivered |
|---|---|---|
| Left Behind, 2016-05-06 | "the first of 5 live sessions that will be uploaded every Friday over the next 5 weeks" | **1 of 5** |
| What Do You Call It?, 2023-04-27 | "episode 1 … the first of a five part series" | **2 of 5** |
| She's Pretty, 2023-08-17 | "episode 2: she's pretty" | (same series) |

No episode 3, 4 or 5 exists in the catalogue. The next music video is IDK How
To Talk To Girls, 2024-03-27, fourteen months after episode 2, with no series
reference in its description (description is empty).

**Possible objection:** the 2016 sessions may have been published to a
different channel or since removed. I cannot rule this out. The claim is
specifically about *this* channel's public catalogue.

---

## 7. Act I

| Date | Moment | Observable on YouTube |
|---|---|---|
| 28–29 Aug 2026 | Reading & Leeds | **Nothing** |
| 4 Sep 2026 | Pretty Villain MV | 11,302 views at 28 days |
| 7 Sep 2026 | "wrote an anthem for the baddies" Short | 2,672 views |
| 2 Oct 2026 | Love After Love Of Your Life | **Not public at 10:20 UTC** |
| 23 Oct 2026 | Say Less | — |
| 13 Nov 2026 | Your Next Forever | — |
| 19 Nov 2026 | London residency | — |

Gaps between the four singles: **28, 21, 21 days**. Span 4 Sep → 13 Nov =
**70 days = 10.0 weeks**.

All dates except the first three rows come from the **campaign brief**, not
from YouTube.

---

## 8. What is deliberately NOT claimed

- That response songs would work again. The format and the 2021 moment are
  not separable (§2).
- Any YouTube seasonality, retention, watch time, traffic source or audience
  demographic. No Studio access.
- That Reading & Leeds footage is cleared. We did not check.
- That the 4.3M social clip in the brief exists as stated. Unverified; the
  deck labels it campaign context and does not rely on it.
- That the ~24M Spotify streams figure is verified. Same.
- That building more assets *causes* better performance. The one song with
  three assets is also the breakout, which is the same confound as everywhere.

---

## 9. Recommendations, and whether they follow

| # | Action | Evidence | My own confidence |
|---|---|---|---|
| 01 | Give Act I a door | 2 uploads in the new era; PV 1st of 26 on comment rate | **Moderate** — the gap is real, the fix is untested |
| 02 | Put the audience back in the work | Response + Flowers = 82.9% | **Moderate** — strong historical signal, unrepeatable conditions |
| 03 | Capture live as songs | 0 standalone live destinations; full show did 6,651 | **Weak-moderate** — no same-channel precedent, unlike Bleachers |
| 04 | Finish something small | 1 of 5, 2 of 5 | **Observed pattern, twice** — but n=2 |

**Please attack recommendation 03 hardest.** On the Bleachers deep dive this
recommendation was supported by a same-channel precedent (Red Rocks: three
individual song uploads from one night, 383K combined). **Beth has no such
precedent.** The only evidence is an absence plus one full-show upload that
did poorly (6,651). Is that enough to recommend it? I think it is the weakest
of the four and I am not certain it belongs.

---

## 10. Specific questions

1. Is the response-song finding robust, or is it a 2021 artefact dressed as a
   mechanic? (§2)
2. Does the age confound invalidate the "audience deepened" slide? (§5)
3. Should row 23 be counted as a response? (§2)
4. ~~Is the "one Short" claim safe?~~ **Resolved — Shorts tab verified directly (§1).**
5. Does recommendation 03 survive without a precedent? (§9)
6. Is there anything in the 26-row table in §1 that contradicts the deck and
   is not addressed anywhere?
7. The deck's cover says the channel's biggest songs "were answers". Is that
   a fair summary, or is it a selective reading that ignores that She Gets
   The Flowers — the second-biggest upload — is an original song?

---

*Compiled 2 October 2026. All figures from a single public API pull; no
private, Studio or third-party data was used. Campaign dates and the Spotify
and social figures are from a brief supplied to us and were not verified.*
