# Cohort & Data Audit — what can actually be tested today

Phase: MAKE GROK EARN ITS PLACE, step 1.
No code written. No metadata invented. Nothing implemented.

---

## Headline

Of the twelve cohort dimensions in the brief, **four are complete across the roster**, **four are derivable per-artist but not stored**, **one exists for 16% of the roster in the wrong layer**, and **three do not exist at all**.

The specific consequence: **a genre-aware K-Trap cohort — "UK rap/drill, established, comparable scale, active frontline campaign" — cannot be built reliably today.** Genre covers 28 of 177 artists. Career stage does not exist. Catalogue-vs-frontline does not exist. Country does not exist.

What *can* be built today is a defensible **size + relationship + campaign-state** cohort, and — more interestingly — **within-artist comparison**, which needs no cohort metadata at all and is where the one genuinely useful finding from the delta test came from.

---

## A. What exists today

### Roster metadata (the `Artist` record)

The whole shape, verbatim from `src/lib/artists.ts`:

| Field | Type |
|---|---|
| `slug` | string |
| `name` | string |
| `channelHandle` | string? |
| `phase` | `PRE \| START \| RELEASE \| PUSH \| PEAK \| SUSTAIN` |
| `artistType` | `managed \| observed \| external` |
| `ownership` | `virgin \| observed` |
| `campaign` | string? (campaign name) |
| `nextMomentLabel` / `nextMomentDate` | string? |
| `campaignStartDate` | string? (ISO) |
| `custom` | boolean? |
| `collabs` | string[]? (video IDs on other channels) |

That is the entire stored artist model. The file's own comment says this is deliberate — everything else is meant to come live from the YouTube Data API. That decision is why the cohort problem exists.

### Genre

`GENRE_BY_ARTIST` in `src/components/PartnerBriefing.tsx` (~line 1295). 28 entries, hand-curated:

UK Rap (k-trap, catch) · Rap (french the kid, jjerome87) · Indie (mary in the junkyard) · Electronic Pop (tove lo, tove lo music) · Legacy / Rock (peter gabriel, nickelback) · Indie Rock (the snuts, bloc party, the big moon) · Pop (anna lille, tom odell) · Indie / Folk (jamie webster, angus and julia stone) · Electronic (gener8ion, james blake) · Alt / Spoken Word (antony szmierek) · UK Garage (kurupt fm, jigitz) · Indie / Post-Punk (man woman chainsaw) · Jazz (ezra collective) · Rock / Metal (bad omens) · Indie Pop (freak slug) · Reggae / Dancehall (original koffee) · Alt Pop (precious pepala) · Alt / Folk (david kushner)

### Campaign plans

`planStore` (Redis) holds real dated plans for **11 artists**: thisisblocparty, antonyszmierek, thebigmoon, freakslug, ezra-collective, tovelomusic, davidkushner, originalkoffee, thesnuts, nickelback, mgnacrrrta.

### Existing theses

Six Deep Dive decks in `/public`: amyl, chvrches, idles, kol, ktrap, palaye. Each carries a stated campaign thesis in prose. These are the only written strategic positions in the system.

### Derivable from catalogue reconstruction (no metadata required)

`reconstruct_catalogue`, `get_release_moments`, `run_gap_study`, `run_followup_study` and `get_channel_history` can compute, per artist, from public YouTube data:

- release frequency / cadence
- hero-asset history (what the big moments were, and when)
- format mix (MV / Shorts / live / performance / other)
- campaign architecture (what shipped, in what order, at what intervals)
- gap contents (what was posted, or not, between heroes)

---

## B. Where it lives

| Dimension | Location | Layer correctness |
|---|---|---|
| Channel size | Live YouTube Data API via `fetchChannelSnap()` | correct |
| Relationship | `Artist.artistType` / `ownership`, `src/lib/artists.ts` | correct |
| Campaign state | `Artist.phase` + `campaignStartDate` + `planStore` | correct |
| Campaign plans | `planStore` (Upstash Redis) | correct |
| Genre | `GENRE_BY_ARTIST` const inside a React component | **wrong layer** |
| Release freq / hero history / format mix / campaign architecture | Computed on demand from catalogue reconstruction | correct, but not persisted — recomputed every run |
| Existing theses | Prose in six static HTML decks | not machine-readable |
| Country / market | — | does not exist |
| Career stage | — | does not exist |
| Catalogue vs frontline | — | does not exist |

Two structural problems worth naming:

1. **Genre is keyed by lowercase display name, not slug.** Both `'tove lo'` and `'tove lo music'` are present, which is the map compensating for the fact that it has no stable key. Any renaming of an artist silently drops their genre.
2. **`CoachScope` already declares a `TERRITORY` kind** (`src/lib/coach-service/types.ts`) with the comment *"not yet enforced — no territory field exists"*, and `scopeAllows` returns `true` unconditionally for it. The seam is honest, but it is a seam over nothing.

---

## C. Completeness across the roster

Live roster: **177 artists** (figures from the last live pull).

| Field | Coverage |
|---|---|
| `channelHandle` | 177 / 177 — 100% |
| `phase` | 177 / 177 — 100% |
| `artistType` | 173 / 177 (110 managed, 63 observed, 4 unset) |
| `campaignStartDate` | **30 / 177 — 17%** |
| `campaign` (name) | **2 / 177 — 1%** |
| Genre | **28 / 177 — 16%** |
| Dated forward plan (`planStore`) | **11 / 177 — 6%** |
| Written thesis (deck) | **6 / 177 — 3%** |
| Country / market | 0 / 177 |
| Career stage | 0 / 177 |
| Catalogue vs frontline | 0 / 177 |

Phase distribution: PRE 133 · SUSTAIN 18 · RELEASE 13 · START 8 · PEAK 3 · PUSH 2.

**Read the phase distribution carefully.** 75% of the roster sits in `PRE`. `PRE` is almost certainly acting as the default for "nobody has touched this record", not as an observed campaign state. Phase is 100% *populated* and probably far less than 100% *meaningful*. I would not build cohort logic on phase without spot-checking a sample of PRE artists against their actual upload behaviour.

---

## D. What is missing

**Absent entirely — no field, no store, no proxy:**

1. **Country / market.** Nothing anywhere. Not derivable from the YouTube Data API on our current calls.
2. **Career stage** (developing / established / legacy). Not stored. Subscriber count is *not* a substitute — it conflates reach with maturity, and the age confound applies (all view counts are lifetime totals).
3. **Catalogue vs frontline orientation.** Not stored. Partially inferable from upload recency and gap structure, but that inference is an interpretation, not a fact, and would need labelling as such.

**Present but insufficient:**

4. **Genre** — 16% coverage, wrong layer, fragile key. Usable for a hand-picked test set; not usable for automated peer selection across the roster.
5. **Campaign history** — `campaignStartDate` on 30 artists gives one campaign boundary each. There is no record of *prior* campaigns, so "how did this campaign compare to their last one" cannot be answered from stored data; it has to be re-derived from the catalogue each time, and the boundaries are then inferred, not recorded.
6. **Per-video time series.** Still absent, as established earlier. Every view figure is a lifetime total at the moment of the call. This is the single biggest constraint on any cohort work, because it means cross-artist view comparisons are only valid within matched age buckets.

**Already honest about its own limits:**

`find_similar_artists` matches on subscriber size band and nothing else, and already returns the caveat *"these are size peers, not creative peers."* That caveat is accurate and should stay until the underlying data changes. It is also the reason the cross-campaign delta test returned `INSUFFICIENT_EVIDENCE`.

---

## What this means for the cohort design — proposal, not implementation

Per the brief, I am returning the proposal rather than building it, because the existing data cannot support the requested cohort logic reliably.

### Cohorts that are honest today

**C1 — Size band × relationship.** Complete data. Weak discriminating power. This is what exists now.

**C2 — Size band × campaign state × age-matched assets.** Complete data, and the age-matching removes the lifetime-views confound. Meaningfully better than C1 at no metadata cost. This is the best available *cross-artist* cohort today.

**C3 — Genre × size band, restricted to the 28 known-genre artists.** Defensible as a hand-selected test set, explicitly labelled as a 28-artist subset. Not a roster capability. K-Trap has exactly one genre peer in the map (`catch`), so a "UK rap cohort" is a cohort of two.

### The cohort that isn't a cohort

**C4 — the artist against themselves.** No metadata required, no age confound (same channel, comparable asset ages available within catalogue), and it is where the one useful finding of the delta test actually came from. Every one of the six investigation classes in the brief except COHORT DIFFERENCE can run purely within-artist:

- STRENGTH NOT EXPLOITED — within-artist ✓
- CAMPAIGN ARCHITECTURE DEVIATION — within-artist ✓ (this campaign vs their own prior architecture)
- MISSED ATTENTION WINDOW — within-artist ✓
- THESIS CONTRADICTION — within-artist ✓ (needs the deck theses, which exist for 6)
- EMERGING PATTERN — within-artist ✓
- COHORT DIFFERENCE — **the only class that needs metadata we do not have**

That is the finding worth acting on: **five of the six investigation classes are fully supported by data already in the system.** The sixth is blocked, and it is the one that would need invented metadata to unblock.

### Minimal metadata addition, if you want C4 → full coverage

Three fields on `Artist`, moved to the data layer, keyed by slug:

- `genre?: string` — migrate the existing 28, leave the rest undefined rather than guessing
- `market?: string` — ISO country code, human-entered, undefined where unknown
- `careerStage?: 'developing' | 'established' | 'legacy'` — human-entered, undefined where unknown

All three optional and honestly nullable, so cohort logic degrades to "insufficient peers" rather than silently matching on absence. Roughly 110 managed artists would need a one-time human pass; the 63 observed could stay undefined indefinitely without breaking anything.

I have not written these fields. Say the word and I will — or say no, and the harness runs within-artist only, which on this evidence is where the value is anyway.

---

## Recommended next step

Build the research harness against **the five within-artist investigation classes**, with COHORT DIFFERENCE stubbed to return `NOTHING_MATERIAL` with the reason *"no creative peer data exists; size peers are not creative peers"* — which is true, and which will keep being true until someone enters the metadata.

The ~10-artist validation set should draw from where evidence is richest, not where it is convenient: the 6 artists with written deck theses (amyl, chvrches, idles, kol, ktrap, palaye) plus 4 from the 11 with dated plans. That gives THESIS CONTRADICTION something real to contradict, and avoids the circularity risk — the deck theses were written by us, so a finding that merely restates a deck is a failure, not a success.
