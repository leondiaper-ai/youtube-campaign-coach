# THE SNUTS — DATA & PROVENANCE AUDIT
### Triggered by the Brush Me Like A Horse contamination · 5 October 2026

Everything below was re-verified from primary sources, not from earlier versions of the deck.
Where an earlier analysis and a primary source disagreed, the primary source won.

---

## ERRORS FOUND

### E1 · "Brush Me Like A Horse" is not a Snuts track — CONFIRMED
**Test:** searched the complete Snuts catalogue from two independent primary sources.

| Source | Scope | Matches for "brush" or "horse" |
|---|---|---|
| YouTube Data API v3, `@thesnuts` | 310 uploads, entire public catalogue | **0** |
| Chartmetric, artist 349107 | 98 tracks, full ISRC-level track list | **0** |

It appears nowhere in The Snuts' discography. It entered this analysis from a line in the supplied
internal brief — *"Another track, Brush Me Like A Horse, had previously shown roughly…"* — which I
read as a Snuts campaign track. It is not. **My error: I never verified it against the catalogue
before building a decision rule on it.**

**Where it reached:** 5 instances in the deck (all on the Spotify slide), 2 in the working page.
All removed.

### E2 · The "2× median day" threshold is unsupported — REMOVED
The Spotify lean-in rule said a track earns a paid test when *"save rate and SPL sit closer to
Summer Rain than to Brush Me — and follower gain is running at least 2× a median day."*

Both halves fail. The first pole is another artist. The second number was never derived from Snuts
evidence at all — I chose 2× because it sat between Summer Rain's 3.94× and the 1.11–1.65× band of
the other four. **That is a threshold invented to fit a gap, not read from data.** Removed.

### E3 · The YouTube rule claimed a mechanism we cannot observe — CORRECTED
Previous wording: *"If only the one video lifts, it's a recommendation surface doing its job."*

We have no traffic-source data. Browse, Suggested, Search and External are all invisible from
outside Studio. **Corrected to:** the movement appears video-specific rather than a broad channel
lift — and the mechanism requires YouTube Studio traffic sources before anyone attributes it.

### E4 · A Spotify conclusion rested entirely on the contaminated contrast — REMOVED
*"Editorial share is not the signal. Save rate and SPL are."* That claim was built from a
two-point comparison in which one point belonged to another artist. With Brush Me removed we have
save rate and SPL for **one** release and no contrast at all. The claim is gone.

### E5 · Two conflicting internal reads of Summer Rain were presented as one — NOW BOTH SHOWN
The supplied brief contains two different Summer Rain readings:

| Reading | Save rate | SPL | Algorithmic share |
|---|---|---|---|
| February internal analysis (UK) | **34.6%** | **1.74** | ≈36% |
| "Later internal read" (UK) | **22%** | **≈1.9** | ≈40% |

I used 34.6% / 1.74 throughout as though it were the figure. Per the rule that two disagreeing
primary sources must both be flagged rather than resolved by preference, the deck now shows both
and labels them as point-in-time internal reads of a moving metric.

### E6 · A quadrant assignment was forced — CORRECTED
The day-5 matrix put Motherlands in "capture without reach". Its follower conversion was **1.34×**
a median day — barely above normal. It did not capture unusually well. What it did was generate
listener movement well above its support level. The quadrant is relabelled accordingly.

---

## CONTAMINATED DATA REMOVED

| Item | Classification | Where it was | Action |
|---|---|---|---|
| Brush Me Like A Horse — save rate 4.9% | **OTHER ARTIST** | Deck slide 4, working page | Removed |
| Brush Me Like A Horse — SPL 1.23 | **OTHER ARTIST** | Deck slide 4 | Removed |
| Brush Me Like A Horse — editorial share ≈39% | **OTHER ARTIST** | Deck slide 4 | Removed |
| "Closest in shape to the Brush Me pattern" (Defibrillator) | **OTHER ARTIST** comparison | Working page | Removed |
| 2× median-day paid-test threshold | **UNSUPPORTED** | Deck slide 4 | Removed |

**No other artist's data was found anywhere in the Snuts outputs.** Full track-name sweep across
the deck, working page, findings note and demand map returned only the five campaign releases plus
Snuts catalogue titles.

### Track classification — every name referenced across all outputs

| Track | Classification | Appears in | Permitted use |
|---|---|---|---|
| Summer Rain, Motherlands, Defibrillator, In Motion, PTS | **SNUTS — CURRENT CAMPAIGN** | Deck, all docs | Full analytical use |
| Always, Glasgow, Gloria, Seasons, Elephants | **SNUTS — CATALOGUE** | `FINDINGS.md`, `DEMAND-MAP.md` only — **not in the deck** | Downstream catalogue behaviour only |
| Brush Me Like A Horse | **OTHER ARTIST** | Was in deck + working page | **Removed everywhere** |

No UNKNOWN track names remain.

---

## CORRECTED VALUES

| Item | Old | New |
|---|---|---|
| Spotify lean-in rule | Two-pole threshold vs Brush Me, 2× follower gate | Single-benchmark rule, no numeric gate — see below |
| Summer Rain save rate | 34.6% presented as the figure | 34.6% (Feb) **and** 22% (later read), both shown |
| Summer Rain SPL | 1.74 presented as the figure | 1.74 (Feb) **and** ≈1.9 (later read), both shown |
| YouTube mechanism | "a recommendation surface doing its job" | "appears video-specific — mechanism needs Studio traffic sources" |
| Motherlands quadrant | "Capture without reach" | "Listener response above its support level" |
| Podcast views / rate | 18,101 → 8,995/day | **18,244 → 9,122/day** (counter moved) |
| PTS views / rate | 70,001 → 7,000/day | **70,690 → 7,069/day** (counter moved) |
| Shorts total views | 49,370 | **49,445** (counter moved) |
| Shorts total comments | 43 | **39** (comments can be removed) |
| TikTok follower multiple | 7.4× baseline | **≈7.6×** (74.2/day vs 9.8/day campaign mean) |

---

## UNSUPPORTED CLAIMS REMOVED

1. **"Editorial share is not the signal, save rate and SPL are."** Built on the contaminated contrast.
2. **The 2× follower threshold.** Invented to fill a gap between observed values.
3. **"It's a recommendation surface."** Mechanism not observable from available data.
4. **Motherlands as a capture success.** 1.34× median is not a capture event.

---

## RE-VERIFIED AND UNCHANGED

Every one of these was recomputed from source today and matched the deck exactly.

- Follower gain, 9 days from release, all five releases — exact match
- Monthly-listener gain, 7 days from release, all five releases — exact match
- Median observed daily follower gain = **41** (205 non-interpolated days)
- PTS full daily trajectory — every one of 10 values exact
- Four older campaign assets during the PTS window: 108 → 121 views/day, **net +13**
- PTS share of trailing-week channel views: **42.4%**
- Channel deltas: 7d +100 subs / +128,829 views · 30d +200 / +277,716 · both WEAK band
- TikTok creations per day of life: PTS 1.40 · In Motion 0.68 · Defibrillator 0.41 · Summer Rain 0.37 · Motherlands 0.22 — exact
- Instagram: April −1.8/day · late June +98.6/day · PTS window +51.1/day · **0% interpolated**
- TikTok interpolation: followers 69%, likes 72% — caveat stands

---

## DECISION RULES THAT SURVIVE

### YouTube early-evaluation rule — SURVIVES, interpretation corrected
**Verified evidence.** PTS daily gain: day 1 7,199 · day 2 2,441 · **day 3 1,698** · day 4 3,912 ·
day 5 6,814 · day 6 7,821 · day 7 8,568 · **day 8 10,250** · day 9 9,489 · day 10 7,725. Across the
same window the four other tracked campaign assets moved from 108 to 121 views/day combined.

**Rule.** Do not judge a release before day 5. Judge the direction of daily gain across days 4–8,
not the volume at day 3. Separately check whether the rest of the channel moved: if it did not,
the movement appears **video-specific rather than a broad channel lift**.

**What the rule does not say.** It does not identify the traffic source. That needs YouTube Studio.

### Day-5 response matrix — SURVIVES with one quadrant relabelled
Conceptually sound and each quadrant is now anchored to a release that genuinely fits it.
Motherlands moves from "capture without reach" to "listener response above support level".

---

## DECISION RULES THAT NEED REBUILDING

### Spotify lean-in rule — REBUILT

**What we actually have.** Save rate, SPL and algorithmic share exist for **one** release, Summer
Rain, in **two conflicting internal reads**. For Motherlands, Defibrillator, In Motion and PTS
these metrics are **DATA NOT AVAILABLE** — Chartmetric's artist endpoints do not expose save rate,
streams-per-listener or algorithmic share, and no internal read was supplied for them.

**One benchmark and no contrast cannot produce a threshold.** The rebuilt rule:

> Summer Rain is the only release in this campaign with audience-quality data, and the only one
> that produced a step-change in followers (3.94× a median day). A focus track earns a controlled
> Spotify paid test when several audience-quality signals together approach or exceed the strongest
> behaviour this campaign has produced. We cannot state a numeric trigger, because save rate and
> SPL exist for one release only and in two conflicting readings.
>
> **Measure the test on follower gain per 1,000 reached against the 41/day organic baseline — not
> on streams. Stop if it does not beat organic.**

The 41/day median is Snuts-derived and verified, so the *measurement* is sound even though the
*entry threshold* is not.

---

## SOURCE-OF-TRUTH TABLE · five releases only

| Metric | Summer Rain | Motherlands | Defibrillator | In Motion | PTS |
|---|---|---|---|---|---|
| Release date | 30 Jan 2026 | 26 Mar 2026 | 16 Jun 2026 | 23 Jul 2026 | 25 Sep 2026 |
| Age at reading | 248d | 193d | 111d | 74d | 10d |
| **Listeners +7d** | **+30,843** | **+17,831** | **+11,142** | **+3,895** | **+11,899** |
| Rank of 270 weeks | 18th | 43rd | 97th | 167th | 89th |
| **Followers +9d** | **+1,453** | **+495** | **+609** | **+408** | **+511** |
| Per day | 161.4 | 55.0 | 67.7 | 45.3 | 56.8 |
| **vs 41/day median** | **3.94×** | 1.34× | 1.65× | 1.11× | 1.38× |
| Save rate | 34.6% (Feb) / 22% (later) | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE |
| SPL | 1.74 (Feb) / ≈1.9 (later) | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE |
| Algorithmic share | ≈36% (Feb) / ≈40% (later) | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE | DATA NOT AVAILABLE |
| Spotify editorial | SUPPORT DATA INCOMPLETE | **0 editorials** | NMF UK #44 · NMF Japan #52 · Indie List #41 · Rock The World #7 JP | NMF UK ≈#95 + Indie List | **No NMF UK** |
| Apple editorial | SUPPORT DATA INCOMPLETE | 1 confirmed editorial | New in Alt #6 US/UK +59 terrs · New in Rock #3 UK/IE/CA/AU/NZ · ALT CTRL #5 CA/TR | SUPPORT DATA INCOMPLETE | SUPPORT DATA INCOMPLETE |
| Amazon editorial | SUPPORT DATA INCOMPLETE | None documented | Brand New Music #8 UK · Fresh Alternative #3 · Fresh Indie #1 + COVER UK · Fresh Rock #12 DE · Indie Nation #5 UK · 2026! #37 UK | SUPPORT DATA INCOMPLETE | Brand New Music ≈#9 |
| YouTube editorial | SUPPORT DATA INCOMPLETE | None documented | RELEASED #23 · Heavy Stereo #15 · New Alt Indie #5 · Your New Alternative #76 | SUPPORT DATA INCOMPLETE | ≈#28 new-music surface |
| Deezer editorial | SUPPORT DATA INCOMPLETE | None documented | Brand New UK #68 · Radar Weekly #64 · Hot New Rock #6 | SUPPORT DATA INCOMPLETE | 1 editorial |
| YouTube hero asset | Official video | Lyric video | Lyric video | Lyric video | Official video |
| Hero views / rate | 183,492 · 740/day | 12,526 · 65/day | 81,197 · 738/day | 4,519 · 62/day | 70,690 · 7,069/day |
| Early-life YT series | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | **Full 10-day series** |
| **TikTok creations/day** | 0.37 | **0.22** | 0.41 | 0.68 | **1.40** |
| Instagram signal | DATA NOT AVAILABLE at release | DATA NOT AVAILABLE | +98.6/day across the late-June stack | DATA NOT AVAILABLE | +51.1/day |
| Paid activity | **DATA NOT AVAILABLE** | **DATA NOT AVAILABLE** | **DATA NOT AVAILABLE** | **DATA NOT AVAILABLE** | **DATA NOT AVAILABLE** |
| Campaign context | Campaign opener, release weekend, band returning after quiet 2025 | Released alone | Album announced next day; presale 23 Jun; TRNSMT 20 Jun | Released mid-festival run | France24, Barfly show, Louis Tomlinson Short + podcast |

**Note on the DSP rows.** All placements come from the supplied internal brief and are reproduced
as given. Current playlist reach is **not** used anywhere as a proxy for release-week support —
it is a present-day reading that favours recent releases.

---

## PROVENANCE LABELS

| Finding | Label |
|---|---|
| Follower and listener movement per release, 41/day median | **VERIFIED** — Chartmetric daily, recomputed |
| PTS daily trajectory, catalogue flat at +13/day, 42.4% share | **VERIFIED** — Watcher vsnap, recomputed |
| TikTok creations per day of life | **DERIVED** — Chartmetric counts ÷ verified age |
| Instagram window movements | **VERIFIED** — Chartmetric, 0% interpolated |
| Shorts counts, views, comments, descriptions | **VERIFIED** — YouTube API, full descriptions |
| DSP placements | **VERIFIED AS SUPPLIED** — internal brief, not independently checkable |
| Summer Rain save/SPL/algorithmic | **VERIFIED AS SUPPLIED, WITH INTERNAL DISAGREEMENT** |
| "Stacked moments move more platforms" | **HYPOTHESIS** — two events, one confounded |
| "Album week should be stacked" | **HYPOTHESIS** built on the above |
| PTS traffic mechanism | **UNKNOWN** |
| Paid activity on any release | **UNKNOWN** |
| Save/SPL for four of five releases | **UNKNOWN** |
| Brush Me Like A Horse, 2× threshold, "recommendation surface" | **REMOVE** |

---

## REMAINING DATA GAPS THAT MATERIALLY AFFECT A DECISION

1. **Save rate, SPL and algorithmic share for Motherlands, Defibrillator, In Motion and PTS.**
   Without these there is no audience-quality comparison across the campaign and no defensible
   entry threshold for paid. *Spotify for Artists.*
2. **PTS traffic sources, daily, 25 Sep – 5 Oct.** Without these the strongest YouTube finding of
   the campaign has a verified shape and an unknown cause. *YouTube Studio.*
3. **Any paid-media activity on any of the five releases.** Currently DATA NOT AVAILABLE for all
   five, which means nothing in this analysis separates organic from bought. *Marketing.*

---

*Audit performed 5 October 2026 against: YouTube Data API v3 full catalogue (310 uploads, full
descriptions) · Watcher per-video daily series · Watcher channel history · Chartmetric artist
349107 (98 tracks, daily Spotify/Instagram/TikTok series) · comment scan · supplied internal brief.
Earlier versions of the deck, findings note and demand map were treated as analyses, not sources.*
