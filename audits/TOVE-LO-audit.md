# Tove Lo — ESTRUS post-album review
## Audit pack

**Artefact:** `/tovelo` (`public/tovelo/index.html`)
**Version:** v1 — 1 October 2026, 13 days after release
**Benchmark:** `/angusandjuliastone`. Its components, rules and analysis sheet are reused here, not rebuilt.

---

## 0 · The one structural difference from every other deck

Every other deep dive freezes one pull of the uploads playlist into its HTML.
This one could not. It was built in a cloud session that had:

- no `YOUTUBE_API_KEY`, Redis or Chartmetric credentials in the environment;
- no network route to `youtube-campaign-coach.vercel.app`, `youtube.com`,
  `i.ytimg.com`, `wikipedia.org` or `api.chartmetric.com` (egress policy).

`googleapis.com` was reachable but unauthenticated, and `youtubei.googleapis.com`
(YouTube's internal client API) was reachable but is **not** one of our
authorised integrations, so it was deliberately not used.

Rather than invent or estimate figures, the deck reads the app's own
authorised endpoints **when it is opened** — same origin first, then
production, the pattern `/ktrap-live` and `/deck` already use:

| Endpoint | Source | CORS |
|---|---|---|
| `/api/full-catalogue?handle=@tovelomusic&slim=1` | YouTube Data API v3, complete public uploads playlist | open (`*`) — works from a preview |
| `/api/debug/snapshots?handle=@tovelomusic` | Watcher daily channel readings (Redis) | same-origin only |
| `/api/chartmetric/territories/tovelomusic` | Chartmetric YouTube territories | same-origin only |

Every headline that states a number is a template filled from that data. If
a source fails, the slide says so and shows no figure. The status chips on
the cover and the first table of the sheet show which sources loaded.

**To freeze it like the other decks** (recommended before it is shared
externally): open `/tovelo` on production, confirm the figures, then pull
`/api/full-catalogue?handle=@tovelomusic&slim=1` once and inline the JSON as a
constant in place of the fetch — the render code does not need to change.

---

## 1 · What was verified without the API

| Fact | Source | Confidence |
|---|---|---|
| ESTRUS released 18 Sep 2026, Pretty Swede Records / VMG | UK Hit List release sheet (Drive, 14 Sep) | High |
| des fleurs × Stromae, 12 Jun 2026 | UK Hit List release sheet (Drive, June) | High |
| IYGR official video premiered 13 May 2026, dir. Nogari | YouTube Premiere notification (Gmail); LBB, Promonews | High |
| "Tove Lo – ESTRUS" Premiere, 18 Sep 2026 18:01 UTC | YouTube Premiere notification (Gmail) | High |
| des fleurs official video, dir. Melchior Leroux | mxdwn, 30 Jun 2026 | Medium — the roster recorded a premiere date of 20 Jun |
| DNH released with a visualiser | Press | Date conflicts: 29 Jul (one source) vs 30 Jul (another). The channel's upload date governs. |
| North American tour from 15 Sep; UK/EU 5–19 Nov | Consequence, Stereoboard | High |
| #13 Sweden, #32 UK album chart | Search snippet of public chart reporting | **Low** — not checked against OCC / Sverigetopplistan |
| The YouTube plan | "Tove ESTRUS YouTube Plan", Google Doc, last edited 20 May 2026 | High — primary document |

## 2 · Watcher digest readings — dated observations, not a series

The automated daily campaign review (built on Watcher data) mentioned Tove Lo on:

| Date | Reading |
|---|---|
| 15 Sep | "ESTRUS album release in 3 days; channel currently cold (no uploads in 30d)." |
| 17 Sep | "ESTRUS album release tomorrow." |
| 18 Sep | Multiple official visualisers uploaded that morning (named: die for my art with a lonely heart, if I could I would, F.A.M.T, I'm the cake, idiot, I'm your girl right, source of life, are we on a break, roomie, the bad one). 3.88M subs; +10k subs / +42M views over 30 days. des fleurs ~4.2M. "Steady short-form cadence in the run-up." |

**The 15 Sep and 18 Sep readings contradict each other** on the run-up. The
deck does not pick one; slide 4 and slide 8 compute the answer from the
uploads playlist.

The digests are LLM-written summaries. They are quoted as dated readings and
nothing is computed from them.

## 3 · The data premise — corrected

The brief said Tove Lo is not in the watch list and has no historical
snapshots. The codebase says otherwise:

- `@tovelomusic` was added to the hardcoded `ARTISTS` list in
  `src/lib/artists.ts` on **16 Jun 2026** (commit `ff0adb7`), with
  `campaignStartDate: 2026-05-01`.
- `/api/cron/snapshot` iterates `mergeArtistLists(ARTISTS, custom)`, so the
  daily cron should have been writing snapshots for this channel since then.
- The 18 Sep digest's 30-day deltas could only have been computed from at
  least 30 days of readings.
- `api/debug` and `api/debug/repair-snapshots` name `tove-lo` as a known
  stale-zero case — a sign of history, and of why the deck drops zero and
  regressing readings before drawing anything.

This could not be confirmed from the build session (no Redis access). The deck
tries to read the history and states the result either way. If it loads, it is
a real daily series from 16 Jun onward, and the before/after-album deltas on
slide 9 are between real readings, not derived from lifetime totals.

## 4 · Rules

1. No campaign-total view comparison against Dirt Femme. Structural measures only.
2. Any single asset's views carry its age.
3. Nothing attributed to an upload. No traffic-source data.
4. No momentum from lifetime totals. Rates only between two real Watcher readings
   (±2 days of the target date, else "no readings at both ends").
5. The album-day race (slide 5) is the only views comparison treated as fair,
   because the uploads were published within the same three days.

## 5 · Definitions

| Term | Rule |
|---|---|
| Short | Catalogue endpoint flag, ≤ 62 s (as Angus & Julia Stone) |
| Format | Title text, first match: Short → film/live stream (≥ 15 min) → visualiser → lyric → official video → BTS → live & performance → trailer & teaser → audio → other |
| Campaign window | 1 May 2026 → read time |
| Scorecard windows | Lead single → album + N days, N = days since ESTRUS at read time. Dirt Femme: No One Dies From Love, 4 May 2022 → 14 Oct 2022 + N |
| Phases (Shorts) | Lead single 13 May–11 Jun · des fleurs 12 Jun–28 Jul · Bridge 29 Jul–20 Aug (plan 2–4/wk) · Ramp 21 Aug–17 Sep (plan 3–5/wk) · Since album |
| Plan items | 16 planned + 1 unplanned (des fleurs official video); title + date matchers listed in the sheet |
| Song | Title minus artist prefix, featured artists, brackets and trailing format descriptors |

## 6 · Judgement calls — where this is most likely to be wrong

1. **Title matching.** A planned asset titled unconventionally (e.g. a visualiser
   titled only "(Official Visualiser)" without the song) or published to a Topic
   or Vevo channel reads as missing. The sheet lists every campaign upload so a
   miss can be checked by eye.
2. **The bridge/ramp boundary (20/21 Aug)** is my reading of "July / August" and
   "Late August / Early September" in the plan.
3. **Dirt Femme's lead single.** "How Long" (Jan 2022, Euphoria) was also on the
   album; the window starts at No One Dies From Love because that is where the
   album campaign began. Starting in January would lengthen the 2022 window and
   change its structure measures.
4. **The palette** is chosen, not sampled from campaign frames (the frames could
   not be fetched). Re-sample on the next revision.

## 7 · Open items

- Confirm the figures on production and freeze the catalogue pull (section 0).
- Confirm the album chart positions against OCC and Sverigetopplistan.
- `/bleachers` and `/angusandjuliastone` returned 404 at the bare path under a
  local `next start` (only rewrite-listed decks resolved). `/tovelo` has a
  rewrite. Worth checking those two on production.
