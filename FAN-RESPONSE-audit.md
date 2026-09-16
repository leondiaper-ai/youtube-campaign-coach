# FAN RESPONSE — feasibility audit

**Internal. Audit only — nothing built, no frontend touched.**
16 September 2026 · evidence pulled live from the public YouTube Data API

---

## 1. WHAT ALREADY EXISTS

### Comment capability

| Thing | Where | What it does |
|---|---|---|
| `/api/comment-scan` | `src/app/api/comment-scan/route.ts` | GET, up to **40 video IDs**, up to **100 comments each**, `order=relevance\|time`. Returns `{ text, likes, replies, at }` per comment plus a `commentsDisabled` list. Uncached, `force-dynamic`. **Deliberately excluded from the cron** — its own header says so. |
| `fetchTopComments()` | `src/lib/youtube.ts:339` | Pulls **5 comments** for the top-3 performing uploads during channel sync. Attaches as `upload.topComments`. |
| `TopComment` type | `src/lib/artists.ts:191` | Typed. Consumed only by `src/lib/opportunities.ts:287`. |

### Sentiment capability

**None.** The only occurrence of the word in the codebase is an instruction in `src/lib/coach-service/service.ts:373` telling the Coach LLM the opposite:

> *"State plainly that you cannot see comment TEXT, sentiment, retention, or who is watching… Do not speculate about sentiment as though you had read it."*

So the system currently has a deliberate, explicit prohibition on exactly this. Adding a fan-response read means **that prompt must be updated too**, or the Coach will keep telling users something that is no longer true.

### The critical gap — comment text never reaches storage or any page

`writeLiveSnap` spreads the whole snap, so `topComments` *could* persist. But verified empirically against the live API this morning:

```
artist-live   chvrches     payloadHasCommentText: false
artist-live   kingsofleon  payloadHasCommentText: false
campaign-cover chvrches    hasCommentText:        false
```

Video objects expose exactly: `videoId, title, publishedAt, durationSeconds, thumbnail, kind, videoType, views, likes, comments`.

**Comment *counts* survive. Comment *text* does not reach any served surface.** `videoSnapshots.ts` records `commentCount` per video per day — a genuinely useful volume-and-velocity signal we already have, and one nobody is using for this.

---

## 2. WHAT CHVRCHES MATERIAL WE ALREADY HAVE

`src/lib/intelligence/deepDives/chvrches.ts` — 255 lines. Strategy and deck material. Two incidental mentions of "fan" (about giving core fans access around big moments). **No sentiment analysis, no comment evidence, no stored quotes.**

**The CHVRCHES sentiment read you're remembering was done in conversation and never persisted.** There is nothing to reuse. That is the main reason this keeps having to be redone by hand.

What we *do* have stored is the engagement shape of the campaign assets:

| Asset | Date | Views | Likes | Comments |
|---|---|---|---|---|
| Now, we can start. *(teaser)* | 9 Sep | 40,042 | 3,033 | **301** |
| On your marks. | 10 Sep | 14,257 | 854 | 56 |
| Oh, what to do…? | 13 Sep | 11,444 | 856 | 60 |
| The body, the head, and the heart. | 15 Sep | 7,336 | 588 | 31 |

---

## 3. WHAT WE CAN RELIABLY COLLECT

| Available | Not available |
|---|---|
| Top-level comment **text** (HTML stripped, 500 chars) | Comment **replies' text** (only the reply *count*) |
| **Like count** per comment | **Author name or channel ID** — the route drops them |
| **Reply count** per comment | A stable **comment ID** |
| **Published date** per comment | Anything from YouTube Studio |
| `commentsDisabled` flag | A true random sample |

**Three constraints that shape the whole design:**

1. **100 per video is a hard cap, and it is relevance-ranked.** On the CHVRCHES teaser that meant 100 of 301 — and they are the 100 YouTube considers most relevant, which over-weights high-like comments. **This biases toward exactly the enthusiasm we are trying to measure.** It is the single biggest threat to the feature's defensibility and it applies to every future scan, not just this one. It is survivable if we never claim precision — it is fatal if we ever print a percentage.

2. **No author identity means no duplicate-account detection.** We cannot tell one enthusiastic person posting five times from five people. Another reason to avoid numeric claims.

3. **Cost is 1 quota unit per video.** A 4-asset campaign scan is 4 units. Trivial for ~15 live campaigns (~60 units/day). It would *not* be trivial across all 185 artists daily (~740+), which is why the existing route was kept out of the cron.

---

## 4. STORAGE — new store needed, but a small one

Nothing stores comment text today. We need a lightweight per-artist record, not a comment archive.

Proposal: **store the derived read plus a thin evidence trail, not the raw corpus.** One KV key per artist, overwritten each run, a few KB. That keeps the quotes we display auditable without accumulating tens of thousands of strangers' comments — which is both a storage problem and a data-minimisation one, since these are real identifiable people whose words we would be retaining indefinitely.

Retain: the read, theme counts, the 3–5 candidate quotes actually under consideration, and source video IDs. Discard the rest after classification.

---

## 5. WHEN IS A READ STRONG ENOUGH TO SURFACE?

Four gates, all must pass. Anything failing → **omit the block entirely**. Never render "neutral".

| Gate | Threshold | CHVRCHES today |
|---|---|---|
| **Volume** — comments retrieved across campaign assets | ≥ 60 | **227** ✓ |
| **Concentration** — dominant theme share of classified comments | ≥ 35% **and** ≥ 2× the runner-up | **57%, 6.5×** ✓ |
| **Spread** — assets contributing comments | ≥ 2 | **4** ✓ |
| **Freshness** — newest sampled asset | ≤ 14 days old | **1 day** ✓ |

Confidence label derived, not decorative: **high** = all four comfortably clear; **medium** = passes but volume < 120 or concentration < 45%; **low** = passes marginally → store it, but **do not display**.

A featured quote needs two further gates: it must sit **in the dominant theme** (blocks the funny outlier), and it must pass a **safety filter** (see §8).

---

## 6. PROPOSED DATA OBJECT

Richer underneath than what the page shows, as you asked. The Campaign Home reads three fields; the rest exists for audit, for the Coach, and for later surfaces.

```ts
type FanResponse = {
  // ── what Campaign Home actually renders ──
  headline: string;        // "STRONG POSITIVE RESPONSE"
  line: string;            // one sentence, ≤ 14 words
  quote: {                 // null when no quote clears both gates
    text: string;          // ≤ 60 chars, verbatim
    likes: number;
    videoId: string;
  } | null;
  commentCount: number | null;   // public count on the featured asset

  // ── everything below is stored, never displayed ──
  tone: 'overwhelmingly_positive' | 'mostly_positive' | 'mixed' | 'negative';
  dominantTheme:
    | 'return' | 'song' | 'visual' | 'live' | 'nostalgia'
    | 'anticipation' | 'surprise' | 'member';
  themes: { theme: string; count: number }[];   // ranked, raw counts only
  recurringPhrases: { phrase: string; count: number; totalLikes: number }[];
  candidateQuotes: { text: string; likes: number; videoId: string; theme: string }[];

  evidence: {
    assetsSampled: { videoId: string; title: string; publishedAt: string;
                     retrieved: number; statedTotal: number }[];
    commentsRetrieved: number;
    commentsClassified: number;
    samplingNote: 'relevance-ranked, capped at 100/video — not a census';
  };

  confidence: 'high' | 'medium' | 'low';
  gatesPassed: { volume: boolean; concentration: boolean; spread: boolean; freshness: boolean };
  computedAt: string;      // ISO
  quotaUnitsUsed: number;
};
```

**No percentage field anywhere, by design.** Given relevance-ranked sampling and no duplicate detection, any percentage would be false precision. `themes[].count` keeps the raw numbers for internal use, where the denominator is always stated.

---

## 7. THE EXACT CHVRCHES READ THE EVIDENCE PRODUCES TODAY

Measured across all four campaign assets. **227 comments retrieved of 448 stated.** Every retrieved comment classified individually.

- **Tone:** overwhelmingly positive — 216 positive, 9 neutral/off-topic, 1 impatient, **1 clearly negative**
- **Dominant theme:** return/comeback — **130 of 227**, against 20 for the runner-up (album speculation). 6.5× concentration.
- **Recurring language:** the "WE SO BACK" construction appears **8 times, 326 combined likes**. `"WE SO BACK"` itself is the **highest-liked comment retrieved (184 likes)** — and it is genuinely representative, not a funny outlier.

**What the Campaign Home would render:**

```
FAN RESPONSE · 301 COMMENTS
"WE SO BACK"
Strong excitement, focused on the return itself.
```

Eight words plus the quote. Confidence: **high**.

**Three honest caveats to carry into the build:**

1. **"WE SO BACK" is a day-one reaction.** Zero instances on the 10th, 13th or 15th. If we feature it we are featuring the teaser moment — correct today, stale in a fortnight. The campaign-wide vocabulary is actually the *"let's go"* family (~18 across all four).
2. **The read is already drifting.** The 15 Sep post's dominant single mode is **impatience** (7 of 27) — *"Can we just get the music already? This is killing meeee"* (32 likes). Fans are responding to the return because **there is no music yet**. The truest strategic read is: *fans are treating the return as the event; the songs haven't been judged.*
3. **"301 comments" is the teaser's count, not the campaign's** (448 across four). Showing the teaser count next to a teaser quote is defensible; showing it as a campaign total is not. Pick one and label it.

---

## 8. SAFETY — a filter this needs before it ships

Auto-surfacing "top comments" on a music campaign will eventually surface something we should not put in front of a label or an artist. In this one small CHVRCHES sample the scan returned:

- A comment directed at **Lauren Mayberry** demanding a leak, then *"MARRY ME SO YOU CAN SING ME LULLABIES"* and calling her *"PRETTY GOTHY LIL THANG"*. Given this band's documented history of online harassment of its frontwoman, auto-featuring that would be a serious own-goal.
- Milder but same category: *"She is so beautiful"*, *"Stop teasing me Lauren"*.
- Profanity in three of the highest-liked comeback comments.
- A politically loaded demand: *"Will Chvrches come back and stand for humanity."*
- Religious phrasing that reads badly out of context: *"the return of christ"*.

**Required before any quote is displayed:** block comments directed at a person rather than the work; block profanity; block political/religious content; prefer quotes about the music or the moment. A quote failing the filter drops to the next candidate — and if none clear, show the block **without** a quote rather than reaching further down.

Also: **never claim "100% positive" or "no negativity"** — one negative comment exists and is trivially findable.

**No bot or spam contamination detected** in this sample. Worth noting DBE's comments *did* show view-selling spam ranking into top comments, so the filter needs a promo/spam rule too.

---

## 9. REUSABILITY AND WHERE IT RUNS

**It should ride the existing campaign intelligence refresh, not become a standalone system.**

`/api/campaign-cover` already composes exactly the right inputs for this: it resolves the artist, derives the campaign window, and ranks the campaign assets. The asset list it builds *is* the input a fan-response scan needs. A `buildFanResponse(assets)` step slots in beside `buildRollout` and `buildCampaignTimeline` with no new orchestration.

**Cost control:** scan only assets inside the campaign window, cap at the top 4 by recency, and only for artists whose state is `CAMPAIGN_LIVE` or `NEW_ACTIVITY`. That is ~4 units per live campaign — roughly **60 units/day across the current live set**, against the ~1,110 the full roster sync already spends. Cache the result for 12–24h; comment sentiment does not move hourly.

**Reusability is automatic** because it keys off campaign assets rather than anything artist-specific. CHVRCHES, KoL and DBE all expose the same shape. One caveat worth knowing now: **KoL would currently produce a *different* dominant theme** — its campaign is a released single with 902 comments on the music video, so the read would be about the song, not a return. That is the feature working correctly, and it is the argument for theme-detection rather than a polarity score.

---

## 10. RECOMMENDATION

Feasible, genuinely useful, and cheap. Three things I would want settled before building:

1. **The Coach prompt at `service.ts:373` must change** in the same pass, or the system will contradict itself.
2. **The safety filter is not optional** and should be built first, not bolted on.
3. **Nothing numeric on the page.** Counts of comments are fine (they are public and exact). Percentages of sentiment are not, and the sampling method is why.

What I would *not* do: store raw comment corpora, compute a sentiment score, or show this on any page where the campaign is not live.
