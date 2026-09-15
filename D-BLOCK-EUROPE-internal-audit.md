# D-BLOCK EUROPE — CHANNEL AUDIT

**Internal working document. Not the deck. Not for circulation outside Virgin.**

Channel `UCzyLniLK2YQ5xCJigB2WetA` · `@DBlockEuropeTV`
Catalogue pulled 15 September 2026, 14:25 UTC. 197 of 197 public videos retrieved — full coverage, not capped.

> **Revision note.** This is version 2. Version 1 was rebuilt after adversarial review found fifteen defects, **every one of which made the opportunity look bigger than the evidence supported.** The largest was the headline metric: a "2.02× the peer median" claim that was an artefact of comparing D-Block Europe's padded lifetime view total against peers whose totals are padded half as much. On a like-for-like basis it is 1.40×, and the cohort lead is a statistical tie. What that review found, and what it means for how this document should be read, is recorded in the Appendix. Do not skip it.

---

## HOW TO READ THIS DOCUMENT

Every claim carries a tag. If a line has no tag, it has no evidence and should not survive into the deck.

| Tag | Means |
|---|---|
| `[API]` | Computed from the YouTube Data API pull. Reproducible from `/tmp/dbe/cat.json`. |
| `[PEER]` | Computed from the same endpoint run against the eight peer channels, 15 Sep 2026. Not in `cat.json`. |
| `[SHELF]` | From `/api/channel-shelf` — public playlists and homepage sections. |
| `[OBSERVED]` | Seen directly on a YouTube page on 15 Sep 2026, described as seen. |
| `[VERIFIED]` | Confirmed against a named external source, with its date. |
| `[SAMPLE]` | From a relevance-ranked comment sample. **Not a census.** Raw counts only, never percentages of the audience. |
| `[INFERENCE]` | My reading of the evidence. Arguable. Flagged so it can be argued with. |
| `[UNRESOLVED]` | Measured, not explained. Stated as unexplained rather than guessed at. |

### What this audit cannot see

> Everything here is public API data. **There are no YouTube Studio metrics anywhere in this document** — no impressions, no click-through rate, no retention, no traffic sources, no unique viewers, no subscriber-gain-per-video. Where a question can only be answered from Studio, this document says so and stops.

Four limits that affect specific numbers:

- **Views are plays, not people.** Nothing in public data distinguishes one person watching a video fifty times from fifty people watching it once. Every per-subscriber ratio in this document is a ratio of plays to subscribers, and it is **not** a statement about how many humans have seen D-Block Europe. Unique viewers is a Studio metric. `[API]`
- **Subscriber counts are rounded by YouTube** to three significant figures. 659,000 could be 658,500 to 659,499. Every per-subscriber ratio here carries roughly ±0.5% of imprecision from the denominator alone.
- **Shorts views and long-form views are not the same unit**, and YouTube redefined Shorts views in March 2025 to count every play. 38 of DBE's 44 Shorts predate that change, so the Shorts column is itself a blend of two definitions. Any cross-format ratio in Section 8 carries that caveat. `[VERIFIED]`
- **Comment data is a relevance-ranked sample capped at 40 per video.** It tells us what the most-engaged conversation is about. It cannot establish proportions, and it cannot establish an absence. Note also that YouTube's relevance ranking sorts partly by likes, so using like counts as evidence of weight within a like-sorted sample is circular. `[SAMPLE]`

---

## 1. THE HEADLINE

**D-Block Europe built a release-day playbook that is genuinely excellent when they run it — and they have not run it since 2023 except twice, including not for the record that came out four days ago.**

Three facts, in order of how much they matter:

1. **Worldwide Wave was released on 11 September with 3 of its 19 tracks given an artist-channel asset.** The other 16 exist on YouTube only as distributor-fed art tracks on the auto-generated Topic channel. There is no Worldwide Wave playlist and no homepage section. The channel has published nothing since 10 September. `[API]` `[VERIFIED]` `[SHELF]`
2. **When DBE do run the playbook, it is close to flawless: Rolling Stone 15 of 15 tracks, PTSD 2 29 of 29, both on release day.** But four of seven projects since 2019 got that layer and three got nothing — there is not a single multi-upload day anywhere between November 2019 and July 2023. This is a capability that is used intermittently, not a standard that has been maintained. `[API]`
3. **Roughly 175 million views of D-Block Europe's own catalogue sit on GRM Daily's channel, not theirs** — the pre-2019 era was published to platform channels and has never been connected back. `[VERIFIED]`

`[INFERENCE]` The framing that survives the evidence: this is not a channel doing YouTube badly, and it is not a channel that has been coasting. It is a channel whose own best work is applied unevenly, with a large live example of that sitting on the homepage right now.

---

## 2. CHANNEL SCALE

| Metric | Value | Source |
|---|---|---|
| Subscribers | 659,000 (rounded by YouTube) | `[API]` |
| Lifetime views | 969,590,934 | `[API]` |
| Public videos | 197 | `[API]` |
| Channel created | 20 October 2013 | `[API]` |
| Sum of views on all 197 public videos | 492,891,888 | `[API]` |
| Views per public video | 2,501,989 | `[API]` |
| Last upload | 10 September 2026 — five days ago | `[API]` |

### Views per subscriber — measured two ways, because the difference matters

A channel's **lifetime** view count includes views from content that is no longer public. That share varies enormously between channels, so lifetime-based ratios are not comparable across a cohort. Both bases are shown; **only the catalogue basis should be used.**

| Artist | Catalogue views/sub | Lifetime views/sub | Unaccounted share of lifetime views |
|---|---|---|---|
| **D-Block Europe** | **747.9** | 1,471.3 | **49.2%** |
| Potter Payper | 741.4 | 1,090.0 | 32.0% |
| Nines | 707.5 | 1,011.9 | 30.1% |
| Fredo | 665.9 | 846.8 | 21.4% |
| J Hus | 553.7 | 713.1 | 22.4% |
| Headie One | 514.8 | 746.4 | 31.0% |
| Dave | 501.0 | 598.5 | 16.3% |
| Aitch | 352.3 | 427.1 | 17.5% |
| Digga D | 163.9 | 209.8 | 21.9% |
| **Peer median (8 peers)** | **534.3** | 729.8 | **22.1%** |

`[API]` for D-Block Europe · `[PEER]` for the eight peers — all pulled 15 Sep 2026, none capped, `retrieved` ≥ `publicVideoCount` in every case.

**On the catalogue basis DBE are 1st of 9 at 747.9 — but by 0.9% over Potter Payper's 741.4, which is inside the noise from subscriber rounding alone. That is a tie, not a lead. DBE sit at 1.40× the peer median.** `[PEER]`

> **What version 1 of this document got wrong, and why it matters.** On the lifetime basis DBE look like a clear outlier: 2.02× the median, 35% clear of second place. **Almost all of that apparent dominance was an artefact of DBE's 49.2% unaccounted share being more than double any peer's.** The lifetime ratio was comparing a padded numerator against less-padded ones. **Do not put 2.02× in a deck. Do not say "highest in the cohort" without saying "by 0.9%".**

`[INFERENCE]` What survives: DBE's live catalogue converts subscribers at roughly the same rate as Potter Payper and Nines, and materially better than Dave, Aitch and Digga D. That is a real and respectable finding. It is not evidence that the music wins by a wider margin than anyone comparable.

### Concentration

| Band | Share of catalogue views |
|---|---|
| Top 1 video | 21.5% |
| Top 5 | 38.2% |
| Top 10 | 53.6% |
| Top 20 | 71.0% |

`[API]`

| Videos above | Count (cumulative) |
|---|---|
| 100m views | 1 |
| 50m | 1 |
| 25m | 1 |
| 10m | 13 |
| 5m | 22 |
| 1m | 61 |
| (under 1m) | 136 |

`[API]` — **cumulative bands**, so 61 + 136 = 197.

Biggest asset: **Overseas ft. Central Cee — 106,070,561 views**, published 18 November 2021. One video is 21.5% of everything. `[API]`

---

## 3. THE 476.7 MILLION VIEW GAP — MEASURED, NOT EXPLAINED

Lifetime channel views (969,590,934) exceed the sum of views on all 197 currently-public videos (492,891,888) by **476,699,046 — a 49.2% gap.** `[API]`

Peer cohort, same calculation: **median 22.1%, range 16.3% (Dave) to 32.0% (Potter Payper).** DBE sit **17 points above the highest peer** and outside the range entirely. `[PEER]`

`[INFERENCE]` A gap of roughly 20% appears structural — lifetime view counts retain views from content no longer public, and every channel in the cohort has one. What needs explaining is DBE's **excess over that baseline**: roughly 27 percentage points, on the order of 260 million views.

### Hypotheses tested and rejected

**"Content was deleted from the channel."** Checked the unavailable-video count on every public playlist. "Official Music Videos" (51 items) hides **2 unavailable videos**. PTSD official, Street Trauma, Blueprint, Home Alone 2, DBE World, Rolling Stone and PTSD 2 show **none**. `[OBSERVED]` Two hidden videos cannot account for 260 million views.

**"The 2018 gap in the upload record is deleted content."** The catalogue contains zero videos published in 2018, jumping from 5 uploads in 2017 to 38 in 2019. This looked like the answer. It is not — see Section 4, the 2018 videos were never on this channel, and views accrued on GRM Daily never counted toward DBE's lifetime total. `[VERIFIED]`

`[UNRESOLVED]` **Neither hypothesis survives, and I cannot explain the excess from public data. Note the limit of the rejection: removals from outside any playlist would not show up in either check**, so "not deleted" is not proven — only "not deleted from anything playlisted."

**This is a good question to take into the room rather than a hole in the audit.** Anyone with Studio access can resolve it in minutes, and it is worth resolving: if a material share of that 260 million is restorable content, it is the largest single item in this document.

---

## 4. THE PRE-2019 CATALOGUE IS ON SOMEONE ELSE'S CHANNEL

D-Block Europe's breakout era was published to **platform channels — principally GRM Daily, secondarily Link Up TV — not to their own channel.** `[VERIFIED]`

| Song | Host | Views (as YouTube displays) | Year |
|---|---|---|---|
| Kitchen Kings | GRM Daily | 58m | **2019** |
| Nassty | GRM Daily | 25m | 2018 |
| Large Amounts | GRM Daily | 25m | 2017 |
| The Shard | GRM Daily | 24m | 2018 |
| Gucci Mane (w/ Yxng Bane) | GRM Daily | 21m | 2018 |
| Home | GRM Daily | 13m | **2019** |
| Mazzaleen | GRM Daily | 9.6m | 2018 |
| **Total** | | **~176m, band roughly ±1m** | |

`[VERIFIED]` — read from watch pages, 15 Sep 2026.

**Three things to be honest about before this figure is used:**

- These are **YouTube's rounded display figures**, summed. "~176m" carries a real uncertainty band of about ±1m. Do not write 175.6m and imply precision the inputs do not have.
- **Two of the seven — Kitchen Kings and Home, about 71m or 40% of the total — are 2019, not pre-2019.** The section heading is a simplification.
- This is **seven videos, not the full set.** DBE's own "Official Music Videos" playlist names roughly 24 cross-hosted entries (about 15 GRM Daily, 9 Link Up TV). ~176m is a partial count. The true figure is larger and unmeasured. `[OBSERVED]`

**The decisive artefact** is that playlist — created 29 March 2018, 51 videos `[SHELF]` — which is a **cross-channel curated playlist**: pre-2019 entries hosted on GRM Daily (The Shard, Large Amounts, Traphouse, Favourite Girl, Kitchen Kings, Home, Nookie, Rich, Pain Game, Free 22, Plain Jane, We Won, UFO, Destiny) and Link Up TV (Do A Dab, Must Be, Pablo, Girl, Anybody, Ringing, Squad, Thank The Plug, 3 Gutta Remix). Self-hosted entries dominate only from 2019. `[OBSERVED]`

`[INFERENCE]` The shift to owned-channel publishing lines up with the 2019 label deal (*Home Alone*, D-Block Europe / Caroline / UMG, February 2019). This is the ordinary history of a UK rap act that came up through the platform channels, not a mistake anyone made.

**What this is and is not.** Those videos are live and carry their original dates. `[OBSERVED]` It is an **audience-surface** opportunity — see Section 9, and note the hard constraint there: **a collaboration credit does not move views.** The ~176m is a measure of how much attention sits on catalogue that has no path to DBE's channel. It is **not** a pool of views that can be recovered.

---

## 5. FORMAT MAP

Classifier built from DBE's own title conventions. DBE do not consistently use "(Official Music Video)" — some use square brackets, the 2019 PTSD block has no format suffix at all — so a generic classifier misreads a quarter of the catalogue. **All 197 videos and all 492,891,888 views are accounted for below; nothing is dropped into an unexplained remainder.**

| Format | Videos | Views | Share | Median |
|---|---|---|---|---|
| Music video | 41 | 333,206,627 | 67.6% | 3,322,046 |
| Other (non-standard titling) | 8 | 49,285,886 | 10.0% | 3,423,014 |
| Album track (2019 PTSD block, untagged) | 24 | 38,381,629 | 7.8% | 717,496 |
| Visualiser | 66 | 35,027,525 | 7.1% | 206,804 |
| Official audio | 3 | 28,830,025 | 5.8% | 5,020,735 |
| Lyric video | 1 | 2,734,383 | 0.6% | 2,734,383 |
| Freestyle | 2 | 2,479,684 | 0.5% | 1,239,842 |
| Shorts | 44 | 1,555,904 | 0.3% | 26,772 |
| Vlog / archive | 7 | 1,377,128 | 0.3% | 162,790 |
| Trailer | 1 | 13,097 | 0.0% | 13,097 |
| **Total** | **197** | **492,891,888** | **100%** | |

`[API]`

**The "Other" row is not filler and should not be described as immaterial** — it is the second-largest row by views and contains real assets: Kevin McCallister (18,431,964 — the 6th-biggest video on the channel), 3 GODDY REMIX (11,585,105), Press Da Button (10,594,225), Lake 29 (5,824,260), Turn Off The Light (1,021,767). These are songs released without a format convention in the title. `[API]`

### Reading it

- **Music videos carry the channel: 41 videos, 67.6% of all views.** `[API]`
- **Visualisers are the volume layer, not the view layer.** 66 uploads, 7.1% of views, median 206,804. Their job is coverage — every track having a home — not individual performance. `[INFERENCE]`
- **One lyric video exists in the entire catalogue.** Ferrari Horses ft. Raye, April 2021, 2,734,383 views. It is **12th among non-music-video assets, and three visualisers beat it** — Still Outside (7,917,196), Hush Lil Baby (3,838,432), Girls Love Lies (2,815,776). `[API]`
  **And the deflater that must travel with it:** the *same song's* Official Audio did **21,782,016 views twelve days earlier — eight times the lyric video.** `[API]` This is not evidence that lyric videos work. It is the third-largest asset for a song that was already a hit. `[INFERENCE]` **Version 1 called it "the third-best-performing non-music-video asset". That was wrong and it inflated a recommendation.**
- **Shorts are 44 uploads and 0.32% of catalogue views.** `[API]` See Section 8.

---

## 6. THE RELEASE-DAY PLAYBOOK — EXCELLENT, AND INTERMITTENT

This is the most important section and the one version 1 most overstated.

**The claim that survives the evidence:** when DBE run a release-day track-asset layer, they run it better than most. **They have run it for four of seven projects since 2019, and not at all between November 2019 and July 2023.**

| Project | Released | Tracks | Assets on release day | Upload date | Lag | Views on those assets |
|---|---|---|---|---|---|---|
| PTSD (mixtape) | 27 Sep 2019 | 28 | 24 | 7 Nov 2019 | +41d | 38,381,629 |
| Street Trauma | 27 Dec 2019 | — | **0** | — | — | — |
| The Blueprint: Us vs Them | 2020 | — | **0** | — | — | — |
| Home Alone 2 | 2021 | — | **0** | — | — | — |
| DBE World (mixtape) | 7 Jul 2023 | 24 | 23 | 10 Jul 2023 | +3d | 10,803,360 |
| Rolling Stone (album) | 12 Jan 2024 | 15 | **15** | 12 Jan 2024 | **0d** | 17,068,878 |
| PTSD 2 (mixtape) | 14 Nov 2025 | 29 | **29** | 14 Nov 2025 | **0d** | 6,186,502 |
| **Worldwide Wave** | **11 Sep 2026** | **19** | **0** | **—** | **—** | **—** |

Release dates and track counts `[VERIFIED]` (Wikipedia discography; VERSUS 24 Sep 2019; Complex 10 Jul 2023; Apple Music). Upload dates, asset counts and views `[API]`. Music videos excluded from asset counts — these are track-level uploads only, so PTSD 2's Bad Luck music video is not in its 29.

**The three-year hole is real and should not be hidden:** there is **not one single day between 7 November 2019 and 10 July 2023 with more than one upload**, and the channel published only **28 videos across the whole of 2020–2022**. `[API]` Street Trauma, The Blueprint and Home Alone 2 all have their own playlists `[SHELF]` and no track layer.

`[INFERENCE]` So the honest story is: **the discipline is recent, not longstanding.** Since 2023 they have been excellent — DBE World +3 days, then two consecutive same-day complete drops. That is a genuinely high standard and a real capability. But "every project since 2019" was false, "better every cycle" was false, and PTSD at 24 of 28 tracks and +41 days was neither full nor on release day.

**What cannot be claimed at all:** version 1 said DBE run "the best release-day playbook in UK rap" and do this "better than anyone". **No peer's release-day behaviour was measured at any point in this audit.** The peer cohort was measured on one variable — views per subscriber. That superlative has no evidence base and is deleted.

### Worldwide Wave

Released **11 September 2026**, credited to **D-Block Europe & French Montana** as joint primary artists, **19 tracks**, distributed by Virgin Music Group. `[VERIFIED]` (Apple Music). The act's own channel description calls it a mixtape; the DSPs call it an album. Use "joint project" unless you need to pick a side.

On the artist channel: **three official music videos**, all pre-release singles — FULLY LOADED (20 Aug), RICO (27 Aug), RIPS & FR33 (10 Sep). `[API]`

The other **16 tracks are on YouTube only as auto-generated art tracks on "D-Block Europe - Topic"** (`UCb7jnkQW94hzOoWkG14zs4w`), uploaded 10 September, descriptions reading "Provided to YouTube by Virgin Music Group". `[VERIFIED]` Distributor-fed. Not channel uploads, no artwork programme, no presence on the artist channel.

**No Worldwide Wave playlist and no Worldwide Wave homepage section**, four days after release. Every project since 2019 has a playlist. `[SHELF]` — 14:38 UTC, 15 Sep 2026.

**Nothing published since 10 September.** `[API]`

`[INFERENCE]` **This is the largest and most time-sensitive item in the audit.** The tour opens 22 October. On the three most recent comparable drops the track layer was worth 6.2m, 10.8m and 17.1m cumulative views.

**How to size it honestly.** Those are **cumulative totals to date, not release-window figures** — Rolling Stone's 17.1m has had 20 months to accrue, PTSD 2's 6.2m ten months. PTSD 2 is the most recent and the lowest, across the most assets. Worldwide Wave is a joint project with a different audience shape. **The defensible sizing is single-digit millions of views over the following year, and the stronger argument is not the view count at all — it is that 16 of 19 tracks currently have no home on the artist's own channel during a campaign with a tour attached.**

---

## 7. WHAT THE AUDIENCE IS ACTUALLY SAYING

469 comments across 12 videos spanning 2021–2026. Relevance-ranked, 40 per video maximum. **Raw counts only. This sample cannot establish proportions and cannot establish an absence.** Like counts quoted below are the output of a ranking that sorts partly by likes — treat them as indicative of what surfaced, not as a measure of weight. `[SAMPLE]`

### Dirtbike LB is the loudest signal in the sample

Several recent releases are credited "D-Block Europe (Young Adz)". **The audience has noticed and reads it as a rupture.** `[SAMPLE]`

- *"no LB no party what is going on"* — 318 likes, 26 replies (Turn Off The Light)
- *"and just like that lb is back"* — 364 likes, 12 replies (SEPA)
- *"Is LB gonna come back on the tracks again? Looks like another adz solo run incoming"* — 122 likes
- *"LB needs to make a return"* — 116 likes

And simultaneously — **LB is among the most praised elements of the tracks he is on**, roughly 25 comments in the sample: *"LB carrying 2026 icl"* (137), *"Rumour has it that LB's still looking in his bag"* (187), *"I WISH LB DONE A SOLO RUN LIKE ADZ DID"* (76).

`[INFERENCE]` The billing is legible to the audience and appears to be costing goodwill, while the same audience asks for more of him. This is an artist and management conversation, not a YouTube one — but it is the highest-engagement theme in the sample and the deck should not pretend it isn't there.

### The DSP takedowns

**Eight separate comments, across two videos, spanning March to August, asking why FOREVER 29 and Yurrr vanished from Spotify and Apple Music.** `[SAMPLE]`

- *"Why has this disappeared off spotify?"* — 73 likes
- *"Why ain't this on Spotify anymore? 😠"* — 22 likes
- *"Been like 2 weeks and it still ain't back on Spotify 😞"*

`[INFERENCE]` No answer surfaced in the sample. **A capped, relevance-ranked sample cannot prove nobody replied** — a pinned response or a reply buried inside those threads would not necessarily appear. Version 1 stated flatly that "nobody has ever answered"; that exceeded the evidence and is corrected here. What can be said: the question keeps recurring over six months and no answer is visible to a viewer reading the top comments.

**Also corrected:** version 1 called these "the channel's most-engaged tracks". They are not. FOREVER 29 has 481 comments and Yurrr 277. **Overseas has 12,065.** `[API]`

### What fans praise

Adz's flow and vocal (~20 comments): *"no one is doing vocals like adz in the uk"* (57). **Work rate as a distinct, repeated frame** (~12): *"DBE's consistency just has to be studied"* (101). And **lyrics quoted back verbatim** (~18) — the top comment on FOREVER 29 is a fan repeating a line: *"used to think getting high was a flex, now its just embarrassing"* (400 likes).

### Old versus new

Both readings appear, roughly five comments each way. **Because the sample is capped and relevance-ranked, I cannot say which is more common, and version 1's claim that nostalgia is "used more often as a compliment than a complaint" broke this section's own rule and is withdrawn.**

Critical: *"Miss when Adz and LB were hungry. Don't hit the same no more 💔"* (226 likes, 32 replies — the highest-liked critical comment in the sample); *"Icl this should of been the blueprint 2... just don't match ptsd vibes"*; *"Last 2 album is very weak. Dissapointed"*.

Positive, using the old era as a benchmark being met: *"old DBE to the world"*; *"Album of the year for sure, reminds me of old DBE"*; *"this is what im tryna hear, no break from PTSD 2 straight back to it skiiii"* (141).

### The Morad observation

SEPA (x Morad x Big Papa313, July 2026) carries **five Spanish-language comments and four Moroccan flags**. `[SAMPLE]`  *"MORAD CON D BLOCK ESTAMOS LOCOOS"*, *"Siempre m.d.l.r 🇲🇦🇪🇦"*. A commenter has asked for a follow-up: *"Now all we need is dystinct x morad x DBE"*.

`[INFERENCE]` **Version 1 called this "an audience pocket opened by one collaboration" and "the cheapest international growth signal in this document". Both overstated it and are withdrawn.** SEPA is the only Morad collaboration in a 12-video sample, so the cluster being unique to it is tautological. n=5 in a capped sample cannot support a causal claim, and audience geography is a Studio metric this audit has forbidden itself. **What can honestly be said: it is a hypothesis worth one cheap test, not a finding.**

### Three more worth knowing

- **Overseas still has an unresolved production complaint as a top thread** — *"they did Cench dirty with the mixing"*, 638 likes, five years on. `[SAMPLE]` For scale: 638 likes on a 106-million-view video is 0.0006%. It surfaced to the top of a like-sorted sample; that is all we know.
- **Leak access is a status game.** *"I had this since last summer 😂"* (270 likes), *"4029 people knew about this already 🤫"* (104) — "4029" recurs as an in-group number. `[SAMPLE]` `[INFERENCE]` A superfan identity the channel has never addressed.
- **Comment spam is ranking into top comments** — the same view-selling bot copy appears five times across three videos. `[SAMPLE]` Housekeeping, but visible to every viewer.

---

## 8. SHORTS

| | Shorts | Long-form |
|---|---|---|
| Uploads | 44 | 153 |
| Total views | 1,555,904 | 491,335,984 |
| Share of catalogue views | 0.32% | 99.68% |
| Median views | 26,772 | — |
| Like rate | 2.708% | 0.628% |
| Comment rate | 0.0740% | 0.0138% |
| Uploaded in last 12 months | **5** | 40 |

`[API]`

**The cleanest fact: five Shorts in twelve months against forty long-form uploads.** `[API]`

> **The 4.3× like-rate ratio needs handling carefully.** The arithmetic is right (2.708 / 0.628 = 4.31) but **a Shorts view and a long-form view have never been the same unit**, and YouTube redefined Shorts views in March 2025 to count every play — 38 of these 44 Shorts predate that change. `[VERIFIED]` Presenting this as a clean cross-format engagement multiple invites the most basic possible correction from anyone in the room. **If it is used at all, it is used with the caveat attached.**

`[INFERENCE]` Almost every Short is an announcement card — *"SKIMS OUT NOW ⏳"*, *"POTENTIAL OUT NOW 🔥"*. They are promotional inventory rather than content.

> **Version 1 claimed the Shorts that "break the pattern are the ones that perform". The data contradicts this and the claim is deleted.** The four best-performing Shorts on the channel are all announcement cards: PTSD Album Trailer (142,906), EAGLE FT NOIZY OUT NOW (105,774), WORLDWIDE WAVE MIXTAPE (102,549), PAKISTAN OUT NOW (99,948). The two "content" Shorts cited in version 1 rank 5th and 6th. `[API]` **On this channel's own evidence, announcement Shorts work at least as well as anything else — which is an argument for more Shorts, not for different Shorts.**

### The rights-side point

DBE's music is used in other people's Shorts. Two Official Artist Channel shelves exist for this: `[VERIFIED]` — support.google.com/youtube/answer/9048214.

- **Fan Shorts** — artist-**curated** shelf featuring fan-made Shorts using their music. This is a real action someone can take.
- **Popular sounds from Shorts** — **auto-generated**, rolling 7-day window.

`[OBSERVED]` Neither was visible on the channel home on 15 Sep. **But version 1 listed both as things DBE are failing to do, and that is wrong for the second one:** an auto-generated shelf's absence may reflect eligibility, window population or surface rendering, not anything the artist failed to do. **Only Fan Shorts is an actionable item.** The specifics quoted from the Help page (curation, fan notification) should be re-checked against the live page before they reach a slide.

---

## 9. COLLABORATIONS — THEY HAVE ALREADY STARTED

**54 of 153 long-form videos carry a credited featured artist, holding 266,068,979 views — 54.0% of the catalogue — across roughly 31 distinct partner artists.** `[API]`

> **Read that denominator carefully: 106,070,561 of the 266m — 40% — is Overseas alone.** `[API]` The "266-million-view back catalogue" is one enormous video plus a long tail. Do not present it as 266m of evenly distributed opportunity.

Partners by view weight: Central Cee (106.8m across two videos), Raye (24.5m), AJ Tracey (19.8m), Clavish (19.1m), Noizy (15.0m), then Yxng Bane, Dave, Offset, Chip, Aitch, Nafe Smallz, M Huncho, Headie One, K-Trap, Popcaan, Lil Baby, Lil Tjay, Rich The Kid, Skepta, Nemzzz, Kodak Black, OhGeesy, Krept & Konan, French Montana, Morad. `[API]`

### Current status — verified video by video

| Video | Views | Collaborator credit visible? |
|---|---|---|
| Overseas ft. Central Cee (2021) | 106.1m | **No** |
| Make You Smile ft. AJ Tracey (2022) | 19.3m | **No** |
| Pakistan ft. Clavish (2023) | 18.6m | **No** |
| Eagle ft. Noizy (2024) | 14.2m | **No** |
| **RICO x French Montana (2026)** | 570k | **Yes — dual byline, two avatars** |
| **RIPS & FR33 x French Montana (2026)** | 403k | **Yes** |

`[OBSERVED]` — owner byline read directly on each watch page, 15 Sep 2026. On older videos the featured artist appears only as an `@handle` mention inside the title text, a different mechanism. "Overseas" does not appear on Central Cee's channel. `[OBSERVED]`

**The team is already using the Collaborations feature; it started with the current French Montana campaign.** The recommendation is not "start doing this" — it is "you have started, and the back catalogue is still waiting." `[INFERENCE]`

### The mechanics, verified — and the thing not to say in the room

`[VERIFIED]` — support.google.com/youtube/answer/16554898, current 15 Sep 2026:

- Up to **10 collaborators** per video. Long-form, Shorts and archived live streams.
- Set by the **uploading channel** in Studio (Details → Audience → Collaboration). No partner manager needed. **Each collaborator must accept.**
- The video surfaces on each accepting collaborator's channel and in their subscribers' feeds.

> **Views are not shared, credited or split.** The Help page is explicit: revenue goes to the channel where the video was posted and is not split. View counts and watch hours stay with the host. **Do not pitch this as view consolidation in front of YouTube.** It is a discovery and subscriber-surface play.
>
> **And apply that discipline to our own headline numbers.** The "266m" and "~176m" figures in this document are measures of *where attention currently sits*. They are **not** view opportunities and must not appear in a sentence alongside the Worldwide Wave numbers, which are.

`[UNRESOLVED]` **The official documentation covers the upload flow only.** Third-party guides state the field is editable on already-published videos. It is very likely true. **It is not verified, and two of this audit's recommendations depend entirely on it.** Someone should open Studio on one published video and confirm before this reaches a deck.

### The GRM Daily application

`[INFERENCE]` The same mechanism applies to Section 4, with one critical difference: **GRM Daily hosts those videos, so GRM Daily would issue the invitations.** DBE cannot apply it to a video they do not host. If accepted, those videos surface on DBE's channel and in DBE subscribers' feeds. The views stay with GRM Daily. This is a relationship conversation, not a switch to flip.

---

## 10. CHANNEL ARCHITECTURE

**10 public playlists `[SHELF]`** — of which **seven are project playlists** (PTSD, Street Trauma, The Blueprint: Us vs Them, Home Alone 2, DBE World, Rolling Stone, PTSD 2) and three are not (DBE Vlog, PTSD Tour Diary 2019, Official Music Videos). Version 1 said "ten playlists, one per project"; that was loose and is corrected.

**11 homepage sections, 9 of them pinned single playlists.** The front page is organised by project, which is the right architecture for a discography act. `[SHELF]` `[INFERENCE]`

**The gap: no Worldwide Wave playlist and no Worldwide Wave homepage section**, four days after release, when every project since 2019 has a playlist. `[SHELF]` This is minutes of work.

### Official Artist Channel status — confirmed

A **fully configured Official Artist Channel**. `[OBSERVED]` — 15 Sep 2026: OAC badge beside the channel name, and a **Releases tab** in the channel navigation, which is OAC-only. Releases is correctly ingesting Worldwide Wave (19 songs, 11 Sept 2026). No Vevo channel exists; music videos are self-uploaded.

`[INFERENCE]` The plumbing is right. Nothing in this document is about a channel set up wrong.

---

## 11. YOUTUBE PRODUCTS — VERIFIED, INCLUDING TWO TO DROP AND ONE THEY ALREADY USE

Checked against current YouTube documentation on 15 September 2026, because the brief said verify rather than assume.

| Product | Status | Recommend? |
|---|---|---|
| Official Artist Channel | Live; DBE already have it | Already in place |
| Collaborations | Live; DBE already using on 2026 releases | **Yes** — extend to back catalogue (mechanism unverified, see §9) |
| **Premieres** | Live. **DBE have already used this on 10 videos including Overseas** | **Already in use — do not present as new** |
| Posts (formerly Community tab) | Live. Current documentation states **no subscriber minimum**. Available on OACs | **Yes** |
| Communities (subscriber-only space) | Live. Requires posts access; VEVO channels excluded — not an issue here | Yes |
| Fan Shorts shelf | Live, OAC-only, **artist-curated** | **Yes** |
| Popular sounds from Shorts | Live, OAC-only, **auto-generated** | Not an action — see §8 |
| Live top-fans leaderboard | Live, official | Yes — tour-relevant |
| Concerts tab / Bandsintown | Live, enabled in Studio | **Yes** — tour opens 22 Oct |
| Album pre-saves and release countdowns | Live (announced 16 Sep 2025) | Yes, for the next one |
| **YouTube Stations** | **Invite-only pilot. No Help Center article, no published eligibility, no application route** | **No — do not present as available** |
| **"Top Fans" exclusive video drops** | **Beta. 2025 announcement official; current in-product mechanic third-party-reported only** | **No — flag as in testing, do not promise** |

`[VERIFIED]` — support.google.com/youtube articles 7336634, 9048214, 16554898, 9409631, 15739414, 9080341, 16132193; blog.youtube 21 Aug 2025 and 16 Sep 2025; Stations sourced to a YouTube Help community post of 21 Aug 2026 reported by Tubefilter and Music Ally, 24 Aug 2026.

> **On Premieres — a correction version 1 got badly wrong.** Ten videos in the pull carry premiere fields, including **Overseas (106.1m), Pakistan (18.6m), No Competition (9.9m), Ski Flow (5.0m), Euro Nights (4.9m)**. `[API]` **The channel's single biggest asset was a Premiere.** Version 1 listed Premieres as a recommendation without noticing. A partner manager will know this. The correct framing is the one Section 9 uses for Collaborations: they already do it.

> **On Stations.** The brief asked whether DBE meet the requirements. **There are no published requirements.** It launched around Coachella in April 2026 with roughly 40 artists and expanded on 21 August 2026. YouTube chooses participants; there is no route to apply. **Raise it as a question for the partner manager. Do not build a slide asserting DBE qualify.**

> **Diary note.** **Made On YouTube 2026 is 23 September** — eight days after this audit. Anything roadmap-shaped may be superseded within a fortnight.

---

## 12. THE BRIEF'S HYPOTHESES, AUDITED

The instruction was to challenge every assumption and kill anything the evidence does not support. Five of seven need correcting.

| Hypothesis | Verdict | Evidence |
|---|---|---|
| **Limited supporting assets** | **Half right — and the half that's right is live now** | 66 visualisers, and Rolling Stone 15/15 and PTSD 2 29/29 are excellent. But **three of seven projects since 2019 got no track layer at all**, and Worldwide Wave currently has none. The capability is real; the consistency is not. `[API]` |
| **Catalogue activation** | **Correct, and larger than assumed** | ~176m views on GRM Daily (partial count, seven of ~24 cross-hosted videos), never connected. Plus 266m of feature videos with no collaborator credit — 40% of which is one video. `[VERIFIED]` `[API]` |
| **Pathways** | **Mostly wrong** | Seven project playlists, nine pinned homepage sections. Correct architecture. Gap is Worldwide Wave only. `[SHELF]` |
| **Programming** | **Mostly wrong, with a caveat** | 45 uploads in 2023, 44 in 2025 — volume is not the issue now. But **28 uploads across all of 2020–2022** shows it has been. `[API]` |
| **Community layers** | **Partly right** | Posts tab exists and is available. The DSP question recurring over six months with no visible answer is suggestive but rests on a capped sample. `[SAMPLE]` |
| **Subscriber conversion** | **Correct, but far weaker than version 1 claimed** | 747.9 catalogue views/sub, **1.40×** the peer median, 1st of 9 **by 0.9%** — a tie, not a lead. The 2.02× figure was an artefact. `[PEER]` |
| **YouTube-native features** | **Mostly wrong — two recommendations killed** | Collaborations **already live** on 2026 releases. **Premieres already used on 10 videos including the biggest.** Popular Sounds is auto-generated, not an action. **Stations cannot be requested.** What survives: Fan Shorts, Posts, Concerts tab, Shorts volume. `[OBSERVED]` `[VERIFIED]` `[API]` |

---

## 13. THE 1 MILLION SUBSCRIBER QUESTION

**Current: 659,000. Required: +341,000, a 51.7% increase.** `[API]`

`[INFERENCE]` **If DBE converted their public-catalogue views at the peer median rate of 534.3 views per subscriber, the channel would have roughly 922,000 subscribers — below the million, not above it.**

> **This flips version 1's conclusion and the flip must be carried through to the deck.** Version 1 computed 1.33 million implied subscribers using lifetime views against a lifetime-basis median, and concluded "the million is below what their own view volume already implies." **Both inputs were on the confounded basis. On like-for-like figures the answer is the opposite: DBE's live catalogue does not currently imply a million subscribers — it implies about 922,000.**

**Every caveat this deserves, and they are load-bearing:**

- **Views are plays, not people.** This calculation treats 492.9m views as if they represented distinct viewers. They do not, and on a music catalogue dominated by repeat plays from existing subscribers the gap is large. **Unique viewers is a Studio metric.** Version 1 omitted this assumption entirely, which was its most serious methodological failure after the peer basis.
- Views-per-subscriber is a ratio of two totals and says nothing about *when* either arrived. DBE's top video is 21.5% of the catalogue. `[API]`
- Subscriber figures are rounded to three significant figures; at these magnitudes the DBE–Potter Payper gap is inside the rounding.
- **Nothing in public data can tell us why viewers do not subscribe.** That is a Studio question — subscriber-gain-per-video, traffic sources, returning-versus-new viewers.
- Version 1 asserted that "a large share of lifetime views arrive via search, suggested and browse". **That is a traffic-sources claim this document forbids itself, it was untagged, and it is deleted.**

**What the evidence supports saying:** DBE convert their live catalogue into subscribers at roughly the same rate as the strongest comparable acts and better than most of the cohort. Reaching a million is a growth target, not a correction of underperformance. **What it does not support:** that the million is already implied, or any mechanism or timeline for getting there.

---

## 14. WHAT IS LEFT ON THE TABLE

Ordered by **evidence strength**, not size of prize. Note the reordering from version 1: the two collaboration items moved down, because their mechanism is unverified.

**Strongly evidenced, time-sensitive, and the mechanism is proven:**

1. **The Worldwide Wave track-asset layer.** 16 of 19 tracks have no artist-channel asset. DBE have executed this exact move twice at 100% coverage. Tour opens 22 October. `[API]`
2. **The Worldwide Wave playlist and homepage section.** Every project since 2019 has a playlist. Minutes of work. `[SHELF]`

**Strongly evidenced, mechanism unverified — resolve before promising:**

3. **Collaborator credits on the back catalogue.** 54 videos, 266m views (40% of it Overseas), ~31 partners, zero credits pre-2026 — and the team has already demonstrated they know how. **Depends on retroactive editability, which is unverified.** `[API]` `[OBSERVED]` `[UNRESOLVED]`
4. **The GRM Daily catalogue.** ~176m views, partial count. **Requires GRM Daily to issue the invitations, and depends on the same unverified mechanism.** `[VERIFIED]` `[UNRESOLVED]`

**Evidenced, lower confidence on size:**

5. **Shorts volume.** Five posted in twelve months against forty long-form. The channel's own best-performing Shorts are announcement cards, so this is an argument for *more*, not *different*. `[API]`
6. **The Posts tab and the DSP question.** Recurring over six months with no visible answer. One post closes it. `[SAMPLE]`
7. **Fan Shorts shelf.** Free, OAC-only, artist-curated, not observed in use. (Popular Sounds is auto-generated and is **not** an action.) `[VERIFIED]` `[OBSERVED]`
8. **Concerts tab / Bandsintown**, with a tour opening 22 October. `[VERIFIED]`

**Hypotheses worth one cheap test — not findings:**

9. **A second lyric video.** One exists. It is 12th among non-music-video assets, three visualisers beat it, and the same song's official audio did 8× more. Weak. `[API]`
10. **A second Spanish-language collaboration.** Five comments on one video. Tautologically unique to that video. `[SAMPLE]`

**Measured but unexplained — take it into the room:**

11. **476.7m views, 49.2% gap, 17 points above the highest peer.** Playlist-level deletion tested and rejected; removals outside any playlist not testable from outside. Resolvable from Studio in minutes. `[UNRESOLVED]`

---

## 15. THE STRONGEST STORY

> **D-Block Europe have twice done something most campaigns never manage: put every single track of a record on their own channel on the day it came out — fifteen of fifteen on Rolling Stone, twenty-nine of twenty-nine on PTSD 2. Worldwide Wave came out four days ago with three of nineteen, no playlist, and nothing published since the day before release. The tour opens on 22 October. Behind that sits a decade of collaborations and a pre-label catalogue that have never been connected back to the channel that should own them.**

`[INFERENCE]` The tone this has to carry: **the biggest opportunity in this document is DBE's own best work, applied to their own record, in a window that is still open.** That framing is true, it is generous, and it does not require overstating anything — which matters, because version 1 overstated five separate things trying to make the same point land harder.

**Three sentences that must not appear in the deck**, because each was in version 1 and each is false or unevidenced:

- "2.02× the peer median" / "the music wins by a wider margin than any comparable act"
- "the best release-day playbook in UK rap" / "every project since 2019"
- "the million is below what their own view volume already implies"

---

## APPENDIX — REVIEW FINDINGS AND DRIFT

### What adversarial review found

Fifteen substantive defects. **Every single one biased the story toward a bigger opportunity. Not one biased it smaller.** The four structural ones:

| Defect | Was | Is |
|---|---|---|
| Views/sub built on an unexplained 49% gap | 2.02× median, clear 1st | **1.40× median, 1st by 0.9% — a tie** |
| Three post-2019 projects with no track layer omitted from the table | "Every project since 2019" | **Four of seven; a three-year hole** |
| Comparative superlative with no comparative measurement | "Best in UK rap" | **Deleted — no peer release behaviour was ever measured** |
| Views treated as unique viewers; traffic-sources claim asserted | 1.33m subscribers implied | **~922,000 implied — below the target** |

Plus: Premieres recommended as new when DBE have used them on ten videos including Overseas; the lyric video called 3rd-best when it is 12th; 11.7% of the catalogue dismissed as "immaterial early-era one-offs" when it contained the 6th-biggest video on the channel; a "content Shorts outperform" claim contradicted by the channel's own top four Shorts; "nobody has ever answered" asserted from a sample that cannot establish absence; and several bare arithmetic slips (Overseas by 262 views, views-per-upload, a median reported as a maximum).

### Drift — the correction that matters most

**Version 1's own drift-watch section was wrong about its own direction, and the error is instructive.** It said:

> "The Ezra audit recorded that every error found by adversarial review pushed in the same direction… The drift risk here is **the opposite**: this audit is written for a room that must not feel criticised, which creates pressure to soften findings."

It then named two uncomfortable findings it had *kept* as evidence it was resisting that pressure. But fifteen defects across nine sections all pushed the other way. **The pressure was never to soften the criticism of DBE. It was to inflate the size of the prize being brought to YouTube** — which is the same drift direction as the Ezra audit, in a different costume.

`[INFERENCE]` The generalisable lesson, worth carrying into the next one: **when a document is written to make a room excited, the drift goes into the numbers that size the excitement, not into the tone.** Checking whether the criticism survived is the wrong test. The right test is recomputing every multiple, superlative and implied total on a like-for-like basis. Three of the four structural defects here were comparisons whose two sides were measured differently.

### What would change these conclusions

- **The Collaborations retroactivity check.** If the Studio field is not editable on published videos, items 3 and 4 collapse. Unverified and load-bearing.
- **Worldwide Wave activity after 15 Sep.** If visualisers go up this week, Section 6 is history rather than an opportunity. **Re-pull before presenting.**
- **Studio access.** Sections 3 and 13 are where one screenshot beats everything this audit can compute.
- **Made On YouTube, 23 September.** May change Section 11.
- **Chart position.** Worldwide Wave was absent from the Official Albums Chart Update Top 100 for 14–20 Sep, read live 15 Sep. `[VERIFIED]` The first complete chart week ends 18 Sep. `[INFERENCE]` A midweek Top 100 absence for an act with nine Top 10 albums may point at a chart-registration issue rather than a commercial verdict — **cause not verified, do not assert either reading.**
