# D-BLOCK EUROPE — V3 DECK AUDIT PACK

**For independent adversarial review.** Self-contained: everything needed to attack this deck is below. No access to our systems required.

Deck: `/dblock` · Virgin Music Group · All data read **7 October 2026**
Supersedes V2 ("The machine has one gear") entirely.

---

## HOW TO REVIEW THIS

You are being asked to **break it**, not to approve it. The previous version of this deck went through the same process and adversarial review found **fifteen substantive defects — every single one of which made the opportunity look bigger than the evidence supported.** Not one biased it smaller.

That is the known failure mode here, and it is the thing to hunt for.

The generalisable lesson recorded from that review, which applies again now:

> When a document is written to make a room excited, the drift goes into the numbers that size the excitement, not into the tone. Checking whether the criticism survived is the wrong test. The right test is recomputing every multiple, superlative and implied total on a like-for-like basis.

Three of the four structural defects last time were **comparisons whose two sides were measured differently**. There are four comparisons in this deck. Start there.

### Questions worth asking of every claim

1. Are both sides of this comparison measured the same way, over the same period, at the same age?
2. Is a lifetime total being presented where a current rate is implied, or vice versa?
3. Is a share being taken of a denominator that is itself incomplete?
4. Does "X views" get heard in the room as "X people"?
5. Would this still be true if the reader checked it on YouTube tomorrow?
6. Is a recommendation carrying an implied causal claim the data cannot support?

---

## PART 1 — SOURCES AND WHAT THEY CANNOT SEE

### Sources
| Source | Scope | Date |
|---|---|---|
| YouTube Data API v3 | Complete public uploads playlist, **198 of 198 videos, uncapped** | 7 Oct 2026 |
| Per-video daily observation series | Views/likes/comments per video per day | series begins mid-Sep 2026 |
| VMG UK Landscape — Chartmetric | UK monthly YouTube views, territory rank | 25 Sep 2026 |
| VMG UK Landscape — consumption | VMG UK consumption reporting | 23 Mar – 20 Sep 2026 |
| VMG Watcher | Channel snapshots | 7 Oct 2026 |

### Not available — anywhere in this deck
**No YouTube Studio data of any kind.** No impressions, click-through rate, retention, watch time, traffic sources, unique viewers, new-vs-returning, subscriber attribution, or revenue.

Consequences the reviewer should hold onto:
- **Views are plays, not people.** Nothing distinguishes one person watching fifty times from fifty people watching once. No figure here is a count of humans reached.
- **Subscriber counts are rounded by YouTube to three significant figures.** 661,000 could be 660,500–661,499.
- **Shorts views and long-form views are not the same unit.** YouTube redefined Shorts views in March 2025 to count every play. The Shorts figures below straddle that change.
- **No causal claim is testable.** We cannot show that any action would have produced more views.

---

## PART 2 — EVERY CLAIM, SLIDE BY SLIDE

Provenance tags: `[API]` computed from the catalogue pull · `[LANDSCAPE]` from the UK Landscape datasets · `[SERIES]` from daily per-video observations · `[INFERENCE]` our reading, arguable · `[UNRESOLVED]` measured but unexplained.

### Slide 01 — Cover
| Claim | Value | Tag |
|---|---|---|
| UK monthly views | 9,230,272 | `[LANDSCAPE]` |
| "#1 Virgin artist" for UK monthly views | rank 1 | `[LANDSCAPE]` |
| Lifetime channel views | 972,502,684 → shown as 973M | `[API]` |
| Subscribers | 661,000 | `[API]` |
| "UK is their top territory" | territory rank 1 | `[LANDSCAPE]` |

**Attack surface:** "#1 Virgin artist" is scoped to **UK monthly YouTube views**. On *raw VMG UK consumption* DBE is **#2**, behind Underworld at 4,714,347. The deck does not claim #1 on consumption — check that the slide never implies it.

### Slide 02 — Scale
| Claim | Value | Tag |
|---|---|---|
| Lifetime views | 972,502,684 | `[API]` |
| Public uploads | 198 | `[API]` |
| Videos over 1M | 61 | `[API]` |
| Videos over 10M | 13 | `[API]` |
| Overseas, single video | 106,612,109 | `[API]` |

### Slide 03 — The Dave comparison ⚠️ **COMPARISON 1 OF 4**
| | DBE | Dave |
|---|---|---|
| UK monthly YouTube views | 9,230,272 | 5,376,965 |
| Subscribers | 661,000 | 2,550,000 |

Stated as: "Roughly **1.7×** the UK monthly viewing on about a quarter of the subscribers."

**Why we think it stands:** same dataset, same date, same genre, same roster.
**Attack surface:** Is "1.7× on a quarter of the subscribers" heard as an efficiency claim? The deck explicitly does **not** compute a ratio-of-ratios and does **not** claim subscribers cause views — verify that holds in the room. Also: subscriber counts are rounded, and Dave's catalogue is older. Does age confound this?

### Slide 04 — Five levers
| Lever | Figure | Tag |
|---|---|---|
| Momentum | 23,393 views/day (SEPA) | `[SERIES]` |
| Releases | 92 same-day assets across 4 launches | `[API]` |
| Catalogue | 498M views across current public uploads | `[API]` |
| Formats | 172,253 views, 2019 PTSD tour diary | `[API]` |
| Audience | 9,230,272 UK monthly views | `[LANDSCAPE]` |

### Slide 05 — How the channel works
| Claim | Value | Tag |
|---|---|---|
| Long-form uploads | 154 | `[API]` |
| Long-form total views | 496,531,449 | `[API]` |
| Long-form median | 691,491 | `[API]` |
| Shorts uploads | 44 | `[API]` |
| Shorts total views | 1,578,291 | `[API]` |
| Shorts median | 27,911 | `[API]` |
| Shorts above 100K | 4 of 44 | `[API]` |
| Long-form share of catalogue views | 99.7% | `[API]` |
| Most recent upload | 15 September 2026 | `[API]` |

**Method note:** Shorts classified as duration ≤62 seconds. Shares are of the **498.1M public catalogue**, never of the lifetime counter.
**Attack surface:** Does the ≤62s rule misclassify anything? And the Shorts-vs-long-form view comparison spans the March 2025 Shorts counting change — is "99.7%" comparing two different units?

### Slide 06 — The full-project layer ⚠️ **COMPARISON 2 OF 4**
| Date | Uploads that day | Views on those uploads | Project |
|---|---|---|---|
| 7 Nov 2019 | 24 | 38,605,010 | PTSD |
| 10 Jul 2023 | 23 | 10,880,643 | Mixtape |
| 12 Jan 2024 | 15 | 17,315,960 | Rolling Stone |
| 14 Nov 2025 | 30 | 9,144,132 | PTSD 2 |
| **Total** | **92** | | |

**Method:** days with 3+ uploads, from publish timestamps.
**Attack surface — this is the weakest comparison on the deck.** The view totals are **lifetime at 7 Oct 2026**, so 2019 has had seven years to accumulate and 2025 has had eleven months. They are placed side by side. The deck's towers are sized by **upload count**, not views, which is the defensible axis — but the view figures sit underneath them. **Does a reader conflate the two?** If so, this slide needs the view totals removed or explicitly age-labelled.

### Slide 07 — Biggest videos ⚠️ **COMPARISON 3 OF 4**
| Video | Views | Collab? |
|---|---|---|
| Overseas ft. Central Cee | 106,612,109 | yes |
| Elegant & Gang | 22,804,476 | no |
| Ferrari Horses ft. Raye | 21,841,507 | yes |
| Make You Smile ft. AJ Tracey | 19,405,912 | yes |
| Pakistan ft. Clavish | 18,704,483 | yes |
| Eagle ft. Noizy | 14,272,634 | yes |

Claims: "Overseas alone has done more than the entire Rolling Stone and PTSD 2 release days combined" (106.6M vs 17.3M + 9.1M = 26.4M). "Five of the six largest videos are collaborations."

**Attack surface:** The Overseas comparison is again **lifetime vs lifetime at different ages** — Overseas is from 2021, PTSD 2 from 2025. Is it fair? And "five of six are collaborations" is a count on n=6 with no base rate: **what share of the whole catalogue is collaborations?** If it is also ~80%, the finding is nothing. **This is unchecked and should be checked.**

### Slide 08 — The lifetime/catalogue difference
| Claim | Value | Tag |
|---|---|---|
| Lifetime channel views | 972,502,684 | `[API]` |
| Sum of 198 public videos | 498,109,216 | `[API]` |
| Difference | 474,393,468 | `[API]` `[UNRESOLVED]` |

Stated as: "The public catalogue only explains half of the channel's lifetime views." Named possible causes: deleted videos, private/unlisted, Shorts accounting changes, other reporting differences.

**The deck explicitly states this does NOT mean those views sit elsewhere in the catalogue or on other channels.**
**Attack surface:** Is that disclaimer prominent enough to survive the room? Does the slide's placement next to the ecosystem slide imply a link the text denies?

### Slide 09 — The wider footprint
| Claim | Tag |
|---|---|
| Collaborator channels: Central Cee, Raye, AJ Tracey, Clavish, Noizy, French Montana, Morad | `[API]` from titles |
| GRM Daily hosts early DBE material and still resurfaces it — throwback posted 2 Oct 2026, 1,522 views | `[API]` |
| Topic channels carry album cuts with no artist-channel asset | `[INFERENCE]` |

**FAILED VERIFICATION — recorded so nobody reinstates it.** V2 claimed **~175M views of pre-2019 DBE catalogue on GRM Daily**. This **could not be verified**: the catalogue retrieval caps at 2,000 uploads and GRM Daily has 15,842, so the pre-2019 window sits outside the retrieved set. The figure can be neither confirmed nor refuted with available tooling. **The slide carries no number.**
**Attack surface:** Is "scale not yet measurable" honest, or is it implying magnitude by placement?

### Slide 10 — Current velocity ⚠️ **COMPARISON 4 OF 4 — THE SPINE OF THE DECK**
7-day average views/day to 7 Oct 2026, from `[SERIES]`:

| Asset | Published | Age | Views/day | Total views |
|---|---|---|---|---|
| **SEPA** (Morad, Big Papa313) | 23 Jul 2026 | 76d | **23,393** | 3,234,455 |
| Rips & Fr33 | 10 Sep 2026 | 27d | 11,283 | 901,821 |
| Rico | 27 Aug 2026 | 41d | 10,295 | 784,908 |
| Fully Loaded | 20 Aug 2026 | 48d | 2,549 | 673,512 |
| Million Dollar Sign | 15 Sep 2026 | 22d | 1,840 | 431,616 |

Claims: SEPA is doing **~90%** of the combined daily velocity of all four Worldwide Wave videos (23,393 vs 25,967 combined = 90.1%), and **2.07×** the fastest individually.

**Deliberately NOT claimed:** "12.7× the campaign". That compared SEPA against Million Dollar Sign alone and presented it as against the campaign. It was rejected before the slide was built.

**Attack surface — attack this hardest, it is the spine.** Both sides are current rates over the same 7-day window, which is the fairest comparison on the deck. But: SEPA is **older**, so is it past its decay curve while the others are still in theirs? Does an older asset at a steady rate beat a newer asset mid-decay in a way that reverses in a month? The per-video series only began mid-September — **is 7 days enough to call a trend?** And SEPA is a collaboration with two features; Worldwide Wave is a collaboration with one. Is like being compared with like?

### Slide 11 — Non-music formats
PTSD tour diary, Nov 2019, seven episodes: 20,107 / 16,511 / 17,141 / 13,577 / 28,781 / 48,225 / 27,911 = **172,253 total**, ~24,600 typical. Album trailer 2019: 142,925. Shorts median for scale: 27,911.

**FAILED VERIFICATION.** V2 claimed Young Adz's own channel showed strong long-form personality content. The handle `@YoungAdz1` resolves to an unrelated channel (9 subscribers, titled "Tiggzy OA"). **The claim could not be substantiated and was removed**, not restated. The slide is rebuilt on the DBE channel's own 2019 tour diary.

**Attack surface:** These are small numbers — ~24,600 per episode. Is "evidence the appetite exists" too strong for n=7 from seven years ago? Is a 2019 audience of 172K relevant to a 661K-subscriber channel in 2026?

### Slide 12 — Tour
Output volumes (1 long-form, 3–5 Shorts per date) are **labelled illustrative** until production planning sets them.
**Attack surface:** The only on-channel tour promo verified is from **9 Nov 2025** with a Live Nation link. Current tour dates are **not verified** and the slide says to confirm with the campaign team. Is that caveat visible enough?

### Slides 13–14 — Operating model and actions
No new figures. Actions reference SEPA (slide 10) and the 474M difference (slide 08).

---

## PART 3 — WHAT V2 CLAIMED THAT V3 DOES NOT

Every one of these was removed. **Do not reinstate without new evidence.**

| V2 claim | Status |
|---|---|
| "2.02× the peer median" / "best in UK rap" | Withdrawn in V2 review — like-for-like it was 1.40× and a statistical tie. **No peer view comparison appears in V3 at all.** |
| "The machine has one gear" / "second gear" | Removed — framing, not finding |
| "Eleven of them lead nowhere" | Removed — courtroom framing |
| "84 days until the channel published anything again" | Removed |
| "Film the corridors, not the stage" | Removed — required decoding |
| DBE TV / separate channel proposition | Removed — no evidence supported a second channel |
| "3 of 19 Worldwide Wave tracks have assets" | Removed — based on a 15 Sep pull, not reproducible, and the 19-track denominator cannot be derived from public data |
| "Nothing published since 10 September" | **Was wrong.** The channel published on 15 September |
| GRM Daily ~175M | Unverifiable — see slide 09 |
| Young Adz personality channel | Unverifiable — see slide 11 |
| 60,199/day lifetime average for Overseas | Not used — a lifetime average heard as "today" |

---

## PART 4 — KNOWN WEAKNESSES, STATED BY US

Listed so the reviewer can confirm or escalate rather than discover.

1. **Slide 06 mixes upload counts with lifetime view totals of very different ages.** Our most likely remaining defect.
2. **"Five of six are collaborations" has no base rate.** We did not compute the collaboration share of the whole catalogue. Unchecked.
3. **The velocity window is 7 days** and the series itself only began mid-September. Thin.
4. **The 474M difference is genuinely unexplained.** We state possible causes without evidence for any of them.
5. **Shorts/long-form comparisons straddle the March 2025 Shorts counting change.**
6. **No base rate for anything.** We have no peer set in this deck at all — deliberately, after V2's peer comparisons failed, but it means nothing here is contextualised against another channel.
7. **Two findings failed verification** and the slides were changed rather than the thesis forced. Confirm we did not leave implied magnitude behind.
8. **The tour dates are unconfirmed.**
9. **Every recommendation is untested.** No claim that any of them will produce a measurable result.

---

## PART 5 — WHAT WOULD CHANGE THE CONCLUSIONS

- **Studio access.** Traffic sources on SEPA would show whether its velocity is search, suggested or external — which changes the response entirely.
- **A collaboration base rate.** If most of the catalogue is collabs, slide 07's finding dissolves.
- **Four more weeks of velocity data.** If SEPA decays to the Worldwide Wave rate, slide 10's spine weakens considerably.
- **An explanation for the 474M.** If it is mostly deleted content, the catalogue opportunity is smaller than implied.
- **Confirmed tour dates**, or their absence.

---

## THE ASK OF THE REVIEWER

1. Recompute every multiple and superlative on a like-for-like basis. Flag any where the two sides differ in age, period or unit.
2. Name any claim that would be heard in a room as stronger than it is written.
3. Identify anything where views are being heard as people.
4. Say which of the four comparisons you would remove entirely.
5. Tell us the direction of our drift. Last time every defect inflated the prize. **If that is true again, say so plainly.**
