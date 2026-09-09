# Data quality audit

Every dataset feeding Watcher, Campaign Assistant, Scout, Coach and the
knowledge layer. The purpose is not completeness for its own sake — it is to
identify which inputs can **contaminate a Campaign Read or a Scout finding**,
because those are the outputs that persist and influence later reasoning.

Trust levels use the vocabulary in `lib/knowledge/evidence.ts`:
`TRUSTED` / `PARTIAL` / `AMBIGUOUS` / `STALE` / `INVALID`.

---

## 1. YouTube catalogue (`/api/full-catalogue`)

| | |
|---|---|
| **Source** | YouTube Data API v3 — `channels.list`, `playlistItems.list`, `videos.list` |
| **Coverage** | Any channel with a public uploads playlist. Capped at 2,000 videos (hard ceiling 6,000) |
| **Freshness** | Read live, uncached. As fresh as the request |
| **Trust** | **TRUSTED** for id, title, publish date, duration, live flag. **TRUSTED but easily misused** for view counts |
| **Known problems** | View counts are lifetime totals at the instant of the call. There is no history. `publishedAt` is the UPLOAD date, not the song's release date |
| **Used by** | Campaign Reads, Scout assessment, Coach investigations, deep dive research |
| **Safe for** | Sequence, architecture, dates, gaps, format mix, within-artist comparison of like-for-like assets |
| **Not safe for** | Velocity, momentum, growth rate, any comparison of a recent asset's views against an older one, catalogue-vs-frontline separation |

This is the single most important dataset in the system and the one most
likely to be misread. Both the read prompt and the Scout prompt state the
limitation explicitly, and `BOUNDARY_RULES` encodes it twice
(`views-not-velocity`, `upload-not-release`).

## 2. Channel snapshots (`snap:{channelId}`)

| | |
|---|---|
| **Source** | `fetchChannelSnap` side effect + twice-daily cron |
| **Coverage** | 180 days max, but **opportunistic** — entries exist only for days the cron ran or the channel was fetched |
| **Freshness** | Cron at 05:00 and 06:00 UTC. `historyDepthDays` reports the real depth per channel |
| **Trust** | **PARTIAL** — depth varies per channel and is not guaranteed |
| **Known problems** | Gaps are invisible unless `historyDepthDays` is checked. `deltaOver` anchors to the newest snapshot, `computeConversion` anchors to `Date.now()` — the two disagree whenever the cron is behind |
| **Used by** | Channel Health, Watcher decisions, conversion, sparklines |
| **Safe for** | Within-channel movement over a stated window, when depth is checked |
| **Not safe for** | Any claim of continuous observation. Cross-channel comparison of deltas measured over different actual spans |

## 3. Roster metadata (`lib/artists.ts` + `artistStore`)

| | |
|---|---|
| **Source** | Hand-maintained, plus custom artists in Redis |
| **Coverage** | 177 artists. `channelHandle` 177/177, `phase` 177/177, `campaignStartDate` 30/177, `campaign` 2/177 |
| **Trust** | **AMBIGUOUS** for `artistType`/`ownership`, **INVALID** for `phase` |
| **Known problems** | See below — this is the worst dataset in the system |
| **Used by** | Everything. Scout's roster exclusion, priority ranking, Channel Health grouping, revenue calculations |
| **Safe for** | Identity — slug, name, handle |
| **Not safe for** | Any inference about relationship, priority or campaign stage without checking the specific record |

**Three confirmed defects:**

1. **`phase` is a default, not an observation.** 133 of 177 are `PRE`.
   `watcherDecision.ts` already carries a comment saying it must not be used
   in decision logic. It is `INVALID` for reasoning.
2. **Ownership is wrong for at least three channels.** Tomorrowland, aespa
   and David Guetta are flagged `managed` + `virgin`. They are market
   benchmark channels. This inflates their strategic importance in any
   priority ranking and would inflate any Virgin-vs-market figure computed
   from ownership.
3. **`campaign` is populated for 2 of 177.** Campaign identity mostly comes
   from `campaignStartDate` (30) or `planStore` (11).

## 4. Genre (`GENRE_BY_ARTIST` in `PartnerBriefing.tsx`)

| | |
|---|---|
| **Source** | Hand-typed constant inside a React component |
| **Coverage** | **28 of 177 (16%)**, keyed by lowercase display name |
| **Trust** | **PARTIAL** where present, absent otherwise |
| **Known problems** | Wrong layer. Fragile key — renaming an artist silently drops their genre. Contains both `tove lo` and `tove lo music`, compensating for the lack of a stable key |
| **Safe for** | Labelling the 28 in a UI |
| **Not safe for** | Peer selection, cohort construction, any roster-wide statement about genre |

## 5. Market / territory / career stage

**These fields do not exist.** `CoachScope` declares a `TERRITORY` kind with
a comment saying no territory field exists, and `scopeAllows` returns `true`
unconditionally for it. Channel country from the API is the channel's
declared country, not the artist's market.

Encoded as boundary rules `unknown-market` and `unknown-stage`.

## 6. Forward plans (`planStore` / `horizon`)

| | |
|---|---|
| **Source** | Human-entered Coach plans, plus manual horizon events |
| **Coverage** | **11 of 177** artists have dated plans |
| **Freshness** | `FRESH_DAYS = 21`, `STALE_DAYS = 60`, with `horizonConfidence` reporting it |
| **Trust** | **TRUSTED** at `HIGH` confidence, **PARTIAL** otherwise |
| **Known problems** | 94% of the roster has no plan. Events may be undated |
| **Safe for** | Timing advice where `horizonKnown` is true |
| **Not safe for** | Inferring that no plan means no campaign — boundary rule `missing-plan` |

The horizon layer already reports its own confidence and reason, which is
why this is `PARTIAL` rather than `AMBIGUOUS`: it tells you when to distrust it.

## 7. Format classification (`formatClassifier.ts`)

| | |
|---|---|
| **Source** | Deterministic heuristic over title, duration and live flags |
| **Coverage** | Every upload |
| **Trust** | **TRUSTED** on a full catalogue, **PARTIAL** below 20 uploads |
| **Known problems** | Title-driven, so it inherits whatever naming convention the artist uses. Three inconsistent Shorts boundaries exist in the codebase: 60s (+90s catch) in `formatClassifier`, 62s in `campaignPipeline`, ≤60s in `youtube.ts` |
| **Used by** | Campaign Reads, Scout assessment, release windows, deep dive analysis |
| **Safe for** | Format mix, clustering, sequence |
| **Not safe for** | Cross-artist format comparison where naming conventions differ |

The read layer already downgrades this to `PARTIAL` below 20 uploads and
states the sample size in the caveat.

## 8. Hero identification

| | |
|---|---|
| **Source** | `classifyUploadFormat(...) === 'omv'` |
| **Trust** | **AMBIGUOUS** when no hero is found |
| **Known problems** | An artist who does not put "Official Video" in titles has no detectable hero. Absence of a hero is reported as `AMBIGUOUS` with an explicit note that it may mean no hero, or a hero whose title does not read as one |
| **Not safe for** | Concluding a channel has no releases |

This is the most likely source of a wrong Campaign Read, and it is the one
where the evidence layer's `AMBIGUOUS` label does real work: it caps
confidence at MEDIUM whenever hero detection came back empty.

## 9. Scout artist/non-artist classification

| | |
|---|---|
| **Source** | `artistCheck.ts` — title self-reference rate + upload volume |
| **Coverage** | Every assessed Scout channel |
| **Trust** | **TRUSTED** at the extremes, **AMBIGUOUS** between 20% and 50% self-reference |
| **Known problems** | Tested against one live set. False negative found and fixed (name pattern was being matched against descriptions, rejecting Madonna). VEVO channels sit legitimately in the ambiguous band |
| **Safe for** | Excluding aggregators from the Scout universe |
| **Not safe for** | Treating AMBIGUOUS as a decision — those stay `CANDIDATE`, not `WATCHING` |

**Live test set result:** all five known false positives (T-Series, Sony
Music India, Times Music, Think Music India, Lyrical Lemonade) correctly
rejected on structural grounds. Three false negatives found and fixed.

## 10. Model output (Campaign Reads, Scout findings)

| | |
|---|---|
| **Source** | grok-4 via `runResearch` |
| **Trust** | **AMBIGUOUS** by construction — `inferred()` never returns TRUSTED |
| **Known problems** | The model will state a confident conclusion from thin evidence unless capped. It produced a WATCH status with a "no action" recommendation on the first run |
| **Safe for** | Interpretation, presented as interpretation |
| **Not safe for** | Anything that will be read back as fact by a later run |

Guarded three ways: `assertNoSilentPromotion` throws if model output is
classed OBSERVED or HUMAN; `capConfidence` reduces stated confidence to
match the basis; `reconcile` forces status and recommendation to agree.

---

## What can actually contaminate future reasoning

Ranked by how likely the damage is to persist.

**1. An inference stored as an observation.** The whole reason the evidence
hierarchy exists. Now blocked at runtime, but only for code paths that route
through `EvidenceRecord` — anything writing free prose into a store bypasses
it.

**2. Ownership misclassification.** Tomorrowland and aespa being `virgin`
managed is wrong in a way that looks right, propagates into every ranking,
and would corrupt any Virgin-vs-market benchmark. Not yet fixed.

**3. Absent hero read as absent campaign.** `AMBIGUOUS` labelling reduces
this to a stated uncertainty rather than a silent error, but a read that says
"no hero release identified" can still be misread by a human skimming.

**4. Stale snapshots presented as current.** Depth is opportunistic and the
UI does not always surface `historyDepthDays`. `applyFreshness` handles this
where evidence records are used; Channel Health predates that layer.

**5. A Campaign Read quoted later as a finding.** Reads are disposable and
intentionally bypass the knowledge gate. The risk is a human copying one into
a deck, where it acquires an authority the record never claimed. Mitigated by
provenance being visible in the report, not by anything structural.
