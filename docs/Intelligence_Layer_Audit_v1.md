# Watcher × Grok Intelligence Layer — Audit and Build

11 September 2026

The brief asked for an audit before implementation. This is that audit, followed by
what was built against it.

---

## 1. What data already exists

| Domain | Exists | Where |
|---|---|---|
| Roster: slug, name, handle, artistType, phase, campaign, campaignStartDate | Yes | `src/lib/artists.ts` (7 static) + Redis via `artistStore.listCustomArtists()` |
| Live channel snapshot: subs, views, uploads30d, shorts30d, lastUploadAt | Yes | `kvCache.readLiveSnapByHandle()` |
| Daily channel history, up to 180 days | Yes | `snapshots.readHistory()` — the only true time series in the system |
| Format mix, hero identification, release moments, gaps, follow-up windows, per-age baselines | Yes | `researcher/catalogue.ts` → `CatalogueRecon`, cached 12h |
| Channel health, classification, momentum, conversion bands | Yes | `channelScore.ts`, `watcherDecision.ts`, `conversion.ts` |
| Campaign events: dated plans, next major moment, horizon confidence | Yes, **server-side** | `coach-bot/horizon.ts` (Redis) |
| Campaign memory: findings, interpretations, hypotheses, human decisions | Yes | `coach-service/memory.ts` |
| Coach recommendations with human verdicts | Yes | `coach-bot/store.ts` |
| Findings, case studies, principles | Yes | `knowledge/store.ts` |
| Evidence hierarchy and trust levels | Yes | `knowledge/evidence.ts` |
| Deep Dive strategic analysis | **As six hand-built HTML decks**, not as data | `public/{chvrches,idles,kol,ktrap,amyl,palaye}/index.html` |
| Resource analysis | **As a link list only** | `resources.ts` — title, blurb, href, date. No findings, no benchmarks |
| Human context: availability, constraints, partner asks, intentions | **No** | Nowhere |
| External research examples with cultural scoring | **No** | `CaseStudy` existed but had no mechanic, tags, scores or source links |

## 2. Which MCP tools already exposed it

22 tools, all reachable at `/api/mcp` behind `MCP_TOKEN`: ten coach tools
(`get_active_campaigns`, `get_campaign_timeline`, `get_campaign_horizon`,
`get_campaign_state`, `get_recent_video_performance`, `get_coach_history`,
`record_coach_recommendation`, `get_campaign_memory`, `remember_for_campaign`,
`record_coach_feedback`) and twelve researcher tools (`list_roster`,
`get_artist_context`, `get_channel_history`, `reconstruct_catalogue`,
`get_release_moments`, `find_similar_artists`, `run_followup_study`,
`run_gap_study`, `compare_artists`, `search_research`, `record_finding`,
`record_hypothesis`).

Channel and campaign coverage was already good. The gap was entirely in the
strategic layer.

## 3. What Grok could not retrieve

1. **Any Deep Dive analysis.** It could read a deck URL as HTML and get a slide
   order. It could not get the argument.
2. **Any resource analysis.** `list_resources` did not exist, and the index held
   no findings or benchmarks to return if it had.
3. **Anything a person knows.** No availability, no constraints, no partner asks,
   no "there is a documentary already filmed".
4. **External research.** Nowhere to put an Aimyon or a Wet Leg, and no way to
   ask which of them matters to whom.
5. **Any notion of what an artist needs.** `find_similar_artists` matched on
   subscriber band and said so in its own caveat: *"size peers, not creative peers."*

## 4. What was browser-only

The live Coach plan, at `localStorage['pih-campaign-coach-v4:<slug>']`, read by
`coachPlan.ts`, `CoachLink.tsx`, `CampaignCockpit.tsx` and `horizonSync.ts`.

**This is less broken than the brief assumed.** `coach-bot/horizon.ts` is already a
server-side projection of that plan in Redis, and `syncFromCoachPlan` pushes the
durable parts across. Dated campaign events survive server-side today.

What does *not* survive is everything undated — availability, constraints,
intentions, partner asks — because the horizon is an event store and those are not
events. That is the actual gap, and it is the one `humanContext.ts` fills.

## 5. Schema changes required

- **New**: `DeepDiveContext`, `ResourceContext`, `HumanContextItem`, `NeedTag`,
  `ResearchScores`, `MatchExplanation` — all in `src/lib/intelligence/types.ts`.
- **Extended, not forked**: `CaseStudy` gains ten optional fields (`mechanic`,
  `archetype`, `usefulFor`, `country`, `observedAt`, `sourceUrls`,
  `thumbnailVideoId`, `scores`, `scoredBy`) and two statuses (`WATCHLIST`,
  `BOARD_ELIGIBLE`). Every field is optional, so **no migration is needed** and
  existing records stay valid, returning unscored — which is the honest answer
  for them.
- **No new database.** Redis throughout, alongside the existing keys.

## 6. What was built

```
src/lib/intelligence/
  types.ts             the need vocabulary, Deep Dive / resource / research contracts
  deepDives/           six transcribed decks + registry
  deepDiveStore.ts     seeded (repo) + stored (Redis) with Redis winning
  resourceContexts.ts  seven analysis documents, structured
  humanContext.ts      durable human context, every item with a review date
  needs.ts             artist resolution + merged Deep Dive / Watcher needs
  match.ts             the matcher
  worldBuilder.ts      the one-call payload
  tools.ts             13 tools: 8 read, 5 write
  __tests__/           16 boundary checks + the brief's worked example
src/app/api/intelligence/route.ts   GET read-only, POST token-gated
```

Wired into `ALL_SPECS`, so all 13 appear on the MCP endpoint automatically.
Total tool surface is now 35.

### The Deep Dive layer

Six decks transcribed, not parsed and not regenerated. Each record carries the
deck's core thesis, strengths, gaps, risks, opportunities, recommended directions
and architecture, existing successes, key evidence with class and trust, known
constraints and plans, platform opportunities, open questions and limitations.

Every point states the figure it rests on. Every deck's own hedges are carried
across — the CHVRCHES lyric-video comparison is marked as not controlled, album
five is marked as inferred from two Shorts, the IDLES 16.7× is marked descriptive
on n=5, the K-Trap deck's *removed* headline figures are recorded as limitations
so nobody re-derives them.

Parsing the decks at runtime was considered and rejected: they are six bespoke
documents with the analysis in prose and in commented JS literals, a parser over
them breaks on the next restyle, and anything it failed to parse would become a
silent absence — which in this layer reads as "this artist has no gaps".

### The matcher

A closed vocabulary of 22 need tags, each naming a *strategic situation*. Matching
is the intersection of an artist's needs with an example's `usefulFor`. No model,
no genre — genre is not in the vocabulary, so it cannot be matched on.

A model asked "is this relevant to CHVRCHES?" always produces an answer and always
produces a fluent reason, including for the examples that are not relevant. A tag
intersection is worse at nuance and much better at being visibly wrong: when
nothing matches, nothing is returned, and `unmatchedNeeds` names the research
still worth doing.

### The two-score rule

An example carries three 0-3 scores: mechanic value, cultural relevance, visual
board value. Board eligibility is a **conjunction, not an average** — a brilliant
mechanic cannot buy its way past a proof artist you would not show a team.

## 7. Verification

Running the brief's own four examples against the real transcribed decks:

```
CHVRCHES — 11 distinct needs
  Aimyon        [archive_live, channel_reactivation, low_new_production]  board=true
  Wet Leg       [named_series, archive_live, low_new_production]          board=true
  Magdalena Bay [named_series]                                            board=true
  Dijon         [archive_live, follow_up_7_14]                            board=false
```

Aimyon matches CHVRCHES on exactly the grounds the brief predicted, from the
deck's own evidence — *"Live and archive material is present but under-programmed"*
(15 live uploads, 104K median, most recent 2023) and *"Reopen the channel before
any announcement"*.

Dijon is the useful row: strong mechanic, credible artist, nothing distinctive to
look at, so it matches, stays in the library, and does not reach the board.

K-Trap correctly matches none of Wet Leg's tags — no `named_series` or
`archive_live` need exists there. The matcher discriminates rather than finding
something for everyone.

16 of 16 boundary checks pass at `/api/assistant?view=matching-checks`, including
that no need tag contains a genre word and that every seeded Deep Dive is
matchable, sourced and states its limits.

## 8. Two things the audit turned up that were not asked for

**The resource documents contradict each other, and the contradiction is now
recorded rather than resolved.** The Observatory page states 17.2% of channels use
Shorts; the Final Benchmark Library computes 55.1% over 136 campaigns and names
17.2% as unsupported. Both are transcribed, with a "do not use 17.2%" instruction
in the Observatory's caveats.

**The Insights Methodology document is an audit, not a method.** Its own finding is
that the Insights report has no analytical pipeline — every number is a hardcoded
constant, claimed coverage is 138 channels and 3,554 videos, actual data in the
codebase is 21 assets across 6 case studies. Transcribed as what it is, with the
honest n attached.

## 9. What is not done

- **The library is empty.** Nothing external has been researched yet, because the
  model is disabled. The matcher works; it has nothing to match against.
- **Slug reconciliation.** Four of the six Deep Dives (`chvrches`, `kingsofleon`,
  `amyl`, `palaye`) use deck slugs that may not exist on the live Redis roster.
  `resolveArtist` falls back to a normalised name match and *reports* the mismatch
  rather than returning empty. This needs checking against the live roster.
- **No UI.** As instructed — intelligence first, page later.
- **The model is still off.** `MODEL_ENABLED` is unset, so `resolveProvider()`
  returns null. Nothing here spends anything until that changes.
