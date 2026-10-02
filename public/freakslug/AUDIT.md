# Freak Slug — audit pack

**For independent review.** Read 2 October 2026. Everything below is the raw material
behind the deck at `/freakslug` and the working page at `/freakslug/analysis`.

You are being asked to **try to break this**, not to confirm it. The specific questions
are at the end, but the most useful thing you can do is check the arithmetic against the
catalogue in §2 and tell me where a claim outruns its evidence.

---

## 1. Provenance

| | |
|---|---|
| Channel | `@freakslug` — `UCPPyyg5x0Txuic9N869_I_Q` |
| Source | YouTube Data API v3, single pull, 2 October 2026 |
| Uploads retrieved | **181 of 181 public uploads.** API reported `capped: false`, `playlistIds: 181` |
| Fields used | `publishedAt`, `durationSec`, `isShort`, `views`, `likes`, `comments`, `wasLive`, `title`, `description` |
| Subscribers | 24,300 |
| Lifetime view counter | 5,826,056 |
| Sum of the 181 uploads | **1,368,348** |
| Secondary source | Watcher channel snapshot series, 29 June – 2 October 2026 (14 weeks) |

### The coverage problem, stated first

The 181 public uploads account for **23.5%** of the lifetime channel counter. Roughly
**4.46 million views (76.5%)** sit in uploads that are no longer public.

Every share quoted anywhere in this work is a share of the **1,368,348**, not of channel
history. I believe this is handled correctly — comparisons *between* currently-public
assets are all on the same basis — but it is the single biggest thing to attack.

**Specifically worth challenging:** the claim "FRIDAY is 57% of all long-form views" is
57% *of what is public*. If the removed content included other large videos, FRIDAY's
dominance is overstated. I cannot test this.

---

## 2. The full catalogue — every long-form upload

All 18 non-Shorts, ascending by date. Views as at 2 Oct 2026.

| Date | Title | Dur (s) | Views | Likes | Comments |
|---|---|---|---|---|---|
| 2018-07-12 | Freak Slug - Real hi | 172 | 3,629 | 142 | 10 |
| 2020-11-24 | Freak Slug - FRIDAY | 205 | 614,437 | 15,034 | 385 |
| 2024-09-13 | Freak Slug - Spells | 192 | 83,937 | 2,155 | 131 |
| 2024-11-08 | Freak Slug - Piece of Cake | 193 | 71,685 | 690 | 37 |
| 2025-02-06 | Freak Slug - Liquorice | 170 | 21,701 | 697 | 45 |
| 2025-03-07 | Freak Slug - Killer | 187 | 24,727 | 806 | 45 |
| 2025-04-16 | Freak Slug - Killer (Live at Union Pool, Brooklyn) | 152 | 5,861 | 188 | 10 |
| 2025-09-05 | Freak slug - Honest Man | 175 | 41,652 | 953 | 104 |
| 2025-10-03 | Freak Slug - Blue Eyes | 139 | 28,961 | 394 | 25 |
| 2025-11-07 | Freak Slug - Miss June | 182 | 32,068 | 550 | 34 |
| 2026-05-17 | ily new york can't wait to come back | 66 | 2,025 | 150 | 1 |
| 2026-07-09 | Freak Slug - Girl, Intentions | 226 | 53,815 | 933 | 110 |
| 2026-07-22 | Freak Slug - Girl, Intentions (BTS) | 97 | 727 | 36 | 5 |
| 2026-08-03 | chattin with Molly from Earworm | 81 | 288 | 14 | 0 |
| 2026-08-07 | Freak Slug - If I Could | 234 | 26,126 | 464 | 61 |
| 2026-09-16 | Freak Slug - Wishing Bone | 210 | 56,854 | 280 | 29 |
| 2026-09-18 | Freak Slug - Amulet (Album Visualizer) | 2,692 | 5,584 | 109 | 24 |
| 2026-10-01 | Freak Slug - Serpent | 217 | 3,686 | 154 | 14 |

**Sum: 1,077,763.** Shorts (163 uploads) sum to **290,585**. Total **1,368,348**. ✔

### Top 10 Shorts

| Date | Title | Views | Likes |
|---|---|---|---|
| 2026-04-13 | Coachella that was amazing! See you back at the Sonora stage… | 75,826 | 4,427 |
| 2026-07-09 | GIRL, INTENTIONS. OUT NOW | 12,041 | 1,498 |
| 2026-05-13 | killer live in LA xx | 4,709 | 35 |
| 2025-04-23 | @audiotree ! | 4,206 | 24 |
| 2025-04-23 | My @audiotree session is out today! | 3,714 | 46 |
| 2024-11-06 | How I write music! | 3,620 | 158 |
| 2024-11-05 | Album out this Friday 😱 | 3,014 | 0 |
| 2024-02-12 | Hey guys! I'm selling some merch, worldwide! | 2,825 | 108 |
| 2024-02-12 | Here's me doing a cover of Britney toxic | 2,723 | 164 |
| 2024-02-18 | #indieband #drummer #guitarist | 2,626 | 45 |

Shorts distribution: **1** above 50,000 · **2** above 10,000 · **7** above 3,000 ·
median **1,231**.

---

## 3. Method — the matched window

Albums, taken from the videos' own descriptions:

- **I Blow Out Big Candles** — 8 November 2024, Future Classic
  (verbatim, Spells description: *"From the New Album 'I Blow Out Big Candles' out on Nov 8th via Future Classic"*)
- **Amulet** — 18 September 2026, Future Classic
  (verbatim, If I Could description: *"From the forthcoming album Amulet, out on Sep 18 via Future Classic"*)

Both campaigns are measured on a **campaign clock**: day −71 to day +14 relative to
release day. +14 is chosen because that is Amulet's age at reading, so neither era gets
more campaign time than the other. −71 is chosen because it is the day the Amulet lead
single landed; the debut's lead single landed at −56, which is **inside** the window, so
no debut asset is excluded by the choice.

> **Challenge this.** The window boundary is the most arguable decision in the whole
> piece. A −56 start would exclude Girl, Intentions (53,815) from the Amulet side and
> change the headline completely. I chose −71 because excluding a campaign's lead single
> seemed worse than including it, but I am not confident this is the only defensible call.

### Window contents

**Debut — 10 uploads (2 long, 8 Shorts)**

| Day | Asset | Views |
|---|---|---|
| D−56 | Spells (MV) | 83,937 |
| D+0 | Piece of Cake (MV) | 71,685 |
| | **Long-form total** | **155,622** |
| | 8 Shorts total | 11,107 |

**Amulet — 46 uploads (7 long, 39 Shorts)**

| Day | Asset | Views |
|---|---|---|
| D−71 | Girl, Intentions (MV) | 53,815 |
| D−58 | Girl, Intentions (BTS) | 727 |
| D−46 | Chattin with Molly from Earworm | 288 |
| D−42 | If I Could (MV) | 26,126 |
| D−2 | Wishing Bone (MV) | 56,854 |
| D+0 | Amulet (Album Visualizer) | 5,584 |
| D+13 | Serpent (MV) | 3,686 |
| | **Long-form total** | **147,080** |
| | 39 Shorts total | 41,059 |

---

## 4. Every claim on the deck, with its arithmetic

| # | Claim | Arithmetic | Confidence |
|---|---|---|---|
| 1 | "46 uploads instead of 10" | Direct count in window | **Fact** |
| 2 | "Eight posts account for 85%" | (147,080 + 12,041) ÷ 188,139 = 84.58% | **Fact**, subject to window choice |
| 3 | "94.5% of the debut window's total" | 147,080 ÷ 155,622 = 94.51% | **Fact**, see §5 caveat |
| 4 | "Gap of 8,542 views" | 155,622 − 147,080 | **Fact** |
| 5 | "Longest silence 19 days vs 27" | Max inter-upload gap in each window | **Fact** |
| 6 | "9.9% of uploads are long-form, 78.8% of views" | 18÷181; 1,077,763÷1,368,348 | **Fact**, of public catalogue |
| 7 | "Reach per Short down 45%" | 764 vs 1,388 mean = −44.96% | **Fact** |
| 8 | "One Short took 29% of views, 67% of likes" | 12,041÷41,059 = 29.3%; 1,498÷2,237 = 67.0% | **Fact** |
| 9 | "Coachella = 26% of all Short views" | 75,826 ÷ 290,585 = 26.1% | **Fact**, of public catalogue |
| 10 | "Girl, Intentions song total 66,583" | 53,815 + 12,041 + 727 | **Fact** |
| 11 | "90-day and 244-day silences" | 8 Nov 24 → 6 Feb 25; 7 Nov 25 → 9 Jul 26 | **Fact** |
| 12 | "1 upload across Dec 2025 – Mar 2026" | Count by month | **Fact** |
| 13 | "w/c 28 Sep is the biggest week in the record" | 78,674, highest of 14 weekly totals | **Fact**, partial week, see §5 |
| 14 | "Moment Shorts travel, song restatements don't" | 5 of 5 top Shorts are moments/announcements | **Interpretation** |
| 15 | "The cheap tier made the biggest video" | Wishing Bone 56,854, self-directed | **Fact**, confounded — see §5 |
| 16 | "The tour is the strongest content engine" | One festival = 26% of Short views | **Interpretation** |

---

## 5. The four places I think this is weakest

**(a) Age asymmetry in the headline comparison.**
The debut's 155,622 has had up to two years to accrue; Amulet's 147,080 has had at most
twelve weeks. This makes the comparison conservative *in the debut's favour*, which is
why I think stating it is fair — but it absolutely does **not** support any claim about
which era finishes larger, and the deck must not be read that way. Is "nearly matched
two years" overclaiming? I think not, but it is the closest call in the deck.

**(b) The production-tier finding is confounded.**
Wishing Bone (self-directed, 56,854) released **two days before the album** — the
highest-attention slot in the whole campaign. The three commissioned videos released at
D−71, D−42 and D+13. Release slot plausibly explains the entire difference. I have
caveated this on both pages and reduced the claim to "the cheap tier can carry a lead
asset", but check whether even that survives.

**(c) The Shorts typology is mine, not YouTube's.**
"Moment vs restatement" is my reading of five videos. Five is a small sample, the
categories are not measured, and I may be pattern-matching. The recommendation that
follows from it — publish fewer, better Shorts — is the one I would most expect a label
to push back on.

**(d) Weekly velocity rests on irregular snapshots.**
Several days read a zero daily gain and the next day carries the whole interval, so only
weekly totals are quoted. The w/c 28 Sep figure (78,674) is also a **partial week** at
reading — it is a floor, not a final number, which strengthens rather than weakens the
claim, but the reader should know.

---

## 6. Things I deliberately did not claim

- **That the Amulet strategy caused the result.** More uploads and more views co-occur;
  the album, the touring and press cycle, and Coachella are all uncontrolled.
- **Anything about streaming.** No DSP data was used. YouTube views are not a proxy.
- **That Shorts "don't work".** They are 21.2% of measured views on 90.1% of uploads,
  which is a yield observation, not a verdict on the format.
- **A lifetime-growth narrative.** With 76.5% of history invisible, any claim about the
  channel's long-run trajectory would be unsupportable.
- **Anything about why uploads were removed.** Unknowable from outside.

---

## 7. Questions for the reviewer

1. **Is the −71 window boundary defensible**, or does including Girl, Intentions on the
   Amulet side while the debut's lead sits at −56 bias the comparison? What would you use?
2. **Is "two weeks in, it has nearly matched two years" an overclaim** given the age
   asymmetry, even with the caveat printed next to it?
3. **Does claim 15 survive the confound** in §5(b), or should the production-tier slide
   be cut entirely?
4. **Is the Shorts recommendation (publish fewer, better) supported** by five data
   points, or is that an interpretation dressed as a finding?
5. **Is there a reading of the 76.5% coverage gap** that would invalidate the long-form
   share figures, rather than merely qualify them?
6. **Is the tour recommendation circular?** Coachella was a one-off festival with its own
   audience; does a headline club run in North America generate comparable material, or am
   I generalising from a single unrepresentative event?
7. **What have I missed in the catalogue?** Is there a pattern in §2 that the deck does
   not address at all?
