# YouTube Campaign Intelligence — system rundown

A self-contained description of what has been built, why, what state it is in,
and what is unresolved. Written to be handed to someone with no prior context.

---

## 1. The problem

One strategist at a major music company is responsible for YouTube strategy
across ~177 artist channels. He cannot personally inspect hundreds of channels,
reconstruct campaign histories, spot unusual behaviour, remember every prior
finding, and decide what deserves attention — every day. Nor can he explore the
wider music-YouTube ecosystem to find best-in-class examples, which YouTube has
explicitly asked the company to produce.

## 2. The three parts

**WATCHER** — monitors the ~177 channels already known. Channel health, views,
subscribers, conversion, cadence, formats, campaign monitoring, top movers, what
changed this week. Deterministic. Already existed and works.

**SCOUT** — explores music YouTube *outside* that roster. Discovers channels,
qualifies them cheaply, analyses their campaign architecture, and has a model
investigate the few that look genuinely interesting. New; this is the current
build.

**DEEP DIVES** — six hand-built HTML strategy decks (Amyl and The Sniffers,
CHVRCHES, IDLES, Kings of Leon, K-Trap, Palaye Royale). Human-authored, well
received internally and by YouTube. Deliberately untouched.

The thesis: *Watcher watches the artists I know. Scout explores the artists I
don't. The model investigates what I couldn't realistically investigate myself.*

## 3. Technical context

- Next.js 14 App Router on Vercel. **Hobby plan: serverless functions are killed
  at 60 seconds.** This constraint shapes a lot of the architecture.
- Upstash Redis is the only persistence. No SQL database, deliberately.
- YouTube Data API v3, public endpoints only. No YouTube Studio access, so no
  retention, traffic sources, impressions, CTR, unique viewers, or
  Shorts→long-form conversion. Ever.
- Model access via `XAI_API_KEY` (grok-4) through an existing provider layer
  that also supports Anthropic and OpenAI.
- **Daily YouTube quota is 10,000 units.** The existing snapshot cron uses ~280.

## 4. The quota arithmetic that drives everything

```
search.list         100 units  — PER CALL, regardless of maxResults
channels.list         1 unit   — for up to FIFTY channel ids
playlistItems.list    1 unit   — per 50-item page
videos.list           1 unit   — per 50-video batch
```

Two consequences are non-negotiable and are enforced in code:

1. Every search requests `maxResults=50`. Asking for 10 costs the same 100 units.
2. Channel hydration is batched 50 at a time — 1 unit instead of 50.

Scout has a self-imposed budget of 5,000 units/day, tracked in a Redis ledger
keyed to the Pacific day boundary Google resets on. (The pre-existing quota guard
was an in-memory boolean, which dies with the serverless instance — survivable
for 1-unit calls, not for 100-unit ones.)

## 5. The Scout loop

```
DISCOVER → QUALIFY → OBSERVE → INVESTIGATE → SAVE → LEARN → APPLY
```

Stages are kept separate on purpose. The model appears at exactly one of them.

**DISCOVER.** Video-first search (`type=video`, `videoCategoryId=10` for Music),
not channel search — the behaviour we're looking for shows up in video titles
("live session", "behind the scenes"), not in channel metadata. Distinct
`channelId`s from the results are the discovery set. Results cache for a week, so
tuning a query doesn't cost repeated 100-unit calls.

**QUALIFY, tier 1 (free).** Batched `channels.list`. Rejects on: already on the
roster, already in Scout, no uploads playlist, non-artist channel (regex over
title/description catching karaoke, reaction, compilation, "Topic", label
aggregators), fewer than 12 uploads, under 5,000 subscribers. Most candidates die
here having cost essentially nothing.

**QUALIFY, tier 2 + OBSERVE (~4 units each).** Pull the last 100 uploads, build a
profile, apply the mission's own test.

**INVESTIGATE (expensive).** A handful of channels reach the model.

**SAVE.** Findings and case studies persist to a knowledge layer.

## 6. Research missions

Scout searches with a *question*, not for popular artists. Three of eight
candidate missions are active. The selection test was not "which is most
interesting" but **"which can be answered from public data without a claim we
cannot support."**

Everything visible reduces to: a list of uploads with a title, publish date,
duration, live flag, and lifetime view count. That supports questions about
**sequence** and **composition**. It does not support questions about
**audience** or **causation**.

**Active:**

| Mission | Question |
|---|---|
| `POST_HERO` | Which artists keep a campaign alive after the main music video rather than letting attention collapse? |
| `MULTI_FORMAT` | Which artists use several formats as one coherent system rather than simply uploading a lot? |
| `LIVE` | Which artists treat live/performance content as deliberate strategy rather than occasional uploads? |

**Inactive, with reasons:**

- `BEST_IN_CLASS_CAMPAIGNS` — a category, not a question; in practice the union
  of the other three through a vaguer filter.
- `CATALOGUE_AND_FRONTLINE` — needs each song's *release* date, not its upload
  date. A 2019 song uploaded today is indistinguishable from a new single.
- `SHORTS_AND_LONGFORM` — the interesting version asks whether Shorts feed
  long-form viewing. That is a Studio metric we do not have. Left off rather than
  allowed to produce a causal sentence we cannot support.
- `UNUSUAL_STRATEGY`, `EMERGING_PRACTICE` — comparative (unusual against what?
  emerging across whom?). They need the corpus of observed external channels that
  the active missions build. Impossible on run one by definition.

## 7. Evidence discipline

This is the part most likely to be got wrong, so it is enforced in several
places at once.

- **All view counts are lifetime totals read once.** For a channel we have not
  been observing there is no earlier reading. Dividing lifetime views by video
  age produces a number that looks like velocity and is not — an older video has
  simply had longer to accumulate.
- Scout computes **no** rate, trend or velocity for external channels.
- The evidence block handed to the model ends with an explicit limits paragraph
  stating exactly this.
- The model's system prompt forbids claims about retention, traffic sources,
  impressions, CTR, browse/suggested, unique viewers, subscriber attribution, or
  Shorts→long-form conversion.
- Scout channels are stored **without** genre, territory, career stage, label or
  campaign. We don't have those for our own roster; we certainly don't have them
  for a channel we met this morning. Unknown stays unknown. (Country is the one
  exception, because the API reports it.)

External channels are analysed with **the same format classifier** used on our
own roster, so both are described in one vocabulary. That is what eventually
makes "how does our campaign compare to the strongest channels" a real question
rather than two different measurements sharing a name.

## 8. The investigation

The model is given no tools. Scout has already computed the evidence; handing
over Watcher's tools would let it reach for data about *our* artists while
describing someone else's channel, and the resulting paragraph would blend the
two invisibly.

It returns strict JSON: either

```json
{"verdict":"NOTHING_MATERIAL","why":"<what you checked and why it was unremarkable>"}
```

or a structured finding with headline, what-they-did, why-interesting,
**why-not-obvious**, transferable lesson, **limitations**, confidence, and a
dated sequence.

`NOTHING_MATERIAL` is the expected outcome. The prompt says so explicitly, and
says the model is not judged on how much it finds. A finding the model itself
labels `ALREADY_VISIBLE` is suppressed on its own word — that concession is the
most useful thing it can report.

A case study requires **both** a transferable lesson and stated limitations.
Without the first it is trivia; without the second it is not safe to show
YouTube. `VALIDATED_CASE_STUDY` is unreachable by the model — a human promotes
it or it stays a candidate.

## 9. Knowledge layer

Kept in a separate module from Scout, deliberately. Models are replaceable; what
accumulates about how music campaigns behave on YouTube is not, and should not
live inside whichever feature happened to trigger the look.

Holds: findings (with provenance, confidence, human review status), case studies,
and best-practice principles. Principles are *not* prompt text — the unit of
value is the `researchQuestions` field, which is what a mission searches against.
Of seven seeded principles only one is `VALIDATED`, and it is the one that
*forbids* a claim (no Shorts-funnel assertions).

Repeat detection compares on **trigger kind**, not on the wording of a finding —
a model phrases the same observation differently every time, so text comparison
lets repeats through.

## 10. Live run results so far

Three missions run against the real public YouTube ecosystem. No seeding with
artists we already know are good.

**Funnel (per mission, 3 queries each):**

| | POST_HERO | MULTI_FORMAT | LIVE |
|---|---|---|---|
| Search results | 150 | 110 | 150 |
| Unique channels | 111 | 85 | 114 |
| Passed triage | 83 | 54 | 72 |
| Assessed (capped) | 8 | 8 | 8 |
| Qualified | 0 | 7 | 5 |
| Quota units | 335 | 334 | 335 |

Triage rejection reasons across all three: not-an-artist-channel 38, too-small
28, already-in-scout 17, already-on-roster 13, mission-test-failed 5,
no-relevant-formats 7, too-few-uploads 5.

**Investigations: 12 model calls, 12 × `NOTHING_MATERIAL`, 0 findings.**
~26k tokens, roughly £0.06.

Examples of what it declined and why:

- *JustinBieberVEVO* — "54 live/performance uploads noted but no dates, release
  ties or cadence pattern provided."
- *Gorillaz* — "Aggregate format counts show variety but no per-release
  clustering or dates tying formats to the same campaign."
- *T-Series Telugu* — "100 uploads in a single week with 5 formats shows volume
  and variety but no evidence of formats clustered around individual releases."
- *KATSEYE* — "12 post-hero uploads in 21 days is ordinary music-channel cadence
  with no distinctive long-form sequence."

**The reasons converge, and they are a diagnosis of the build, not of the
channels.** The evidence block carried aggregate format counts plus dates for
heroes only. Counts describe a channel's *diet*; only a dated sequence describes
its *architecture* — and architecture is what all three missions actually ask
about. `MULTI_FORMAT` cannot be answered from a histogram; `LIVE` cannot be
answered from a percentage. The model was right to refuse.

Fixed but not yet re-run: the profile now carries every analysed upload as
date + format + views + title, and the evidence block shows the most recent 60.

## 11. Known weaknesses

1. **The assess queue is ordered by subscriber count**, as a rough proxy for
   "has enough activity to read". This biases toward famous channels —
   Tomorrowland, David Guetta, aespa appeared high in early runs. "Big artist
   with lots of views" is explicitly *not* what best-in-class should mean. Needs
   a better ordering.
2. **The roster has data-quality problems Scout inherited.** Several market
   benchmark channels (Tomorrowland, aespa, David Guetta) are flagged as Virgin
   *managed* + *virgin-owned* in the artist store, which inflates their
   strategic importance in any ranking.
3. **No genre, market or career-stage metadata exists anywhere** — for our own
   roster either. Genre exists for 28 of 177 artists, hand-typed into a React
   component keyed by display name. This blocks any credible peer comparison and
   is why `find_similar_artists` matches on subscriber band alone.
4. **Discovery is only as good as three hand-written queries per mission.**
   Query quality is currently the binding constraint on what Scout can find.
5. Observation over time is designed and costed (weekly is affordable into the
   low thousands of channels; daily is not) but **not switched on**.

## 12. What is deliberately not built

No Scout homepage panel, no feed, no notifications, no dashboard, no chatbot, no
scheduling. Manual `POST /api/scout` only. The reasoning: prove Scout finds
something valuable before deciding how to deliver it.

Also excluded: automated deck generation, Slack, email, publishing, asset
generation, Chartmetric, YouTube Studio, Postgres migration, autonomous actions.

## 13. The test being applied

Not "how many channels did it discover". The success criterion is:

> Did Scout find one genuinely useful thing outside the existing Watcher
> universe that the strategist probably would not have found himself?

A good first run would legitimately look like: 400 results discovered, 55
channels qualified, 8 investigated, 6 `NOTHING_MATERIAL`, 1 interesting, 1
excellent case study. That is preferable to 30 generic "insights".

**Current status against that test: not yet met.** Zero findings across 12
investigations. The filter demonstrably works — the refusals are specific and
cite figures. What has not yet been demonstrated is that the pipeline can
surface something worth a strategist's morning. The evidence-block fix is the
next thing to test.

## 14. Useful questions for a reviewer

- Is the three-mission selection right, or is a rejected mission recoverable
  with data we do have?
- The assess queue ordering (currently subscriber count) needs replacing. With
  what, given no genre/market/stage metadata?
- Are the qualification thresholds (4+ distinct formats, 8%+ live share, 2+
  long-form within 21 days of a hero) defensible, or arbitrary?
- Is "the model returned NOTHING_MATERIAL twelve times" evidence the filter is
  calibrated correctly, or evidence the candidates were poorly chosen?
- What would make a case study genuinely presentable to YouTube, beyond
  behaviour + evidence + limitations?
