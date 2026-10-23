# Music Opportunities — labs research bank

A protected sandbox at `/labs/music-opportunities`: a research bank of
YouTube demand evidence, connected to the music that feeds the owned
channels and to what those channels achieve. The chart-to-track matcher
is one component of it. It reads the Owned Channels store and writes only
to its own `labs:mo:v1:` namespace. Nothing here publishes, edits YouTube
metadata, creates campaigns or spends.

- Preview-only, like the Owned Channels draft: production returns 404 for
  the page and every API route, even after a merge (`labsEnabled()`).
  Preview access relies on Vercel Deployment Protection. No navigation
  item anywhere; the page links back to `/growth/owned` only.
- API routes (`/api/labs/music-opportunities/{import,uploads,decisions,labels}`)
  reject cross-origin browser writes, validate against allowlists and
  vocabularies, and hold per-job locks.
- Artist rosters, `live:`/`cat:`/`sync:` keys and the cron are untouched.

## Three questions the page answers

1. **What demand are we seeing on YouTube?** Findings computed from the
   stored chart readings: persistence inside a chart series, how much of
   a chart is catalogue vs new, songs that appear in several chart types,
   and labels that recur (above a floor, below the chart's baseline).
2. **Which of our music fits, and how strong is the connection?** Direct
   connections (recording, composition, artist) and contextual ones (a
   recurring label a channel already programmes — hypotheses).
3. **What should we investigate or test?** Stages (monitor / act
   editorially / consider a paid test), decisions and the learning
   history.

## Source: YouTube Charts

`charts.youtube.com` is the only chart source. Established 23 Oct 2026:
no documented public API; each chart page has a Download (CSV) control;
dated pages exist at `/charts/<Chart>/<region>/weekly/<YYYYMMDD>`; the
rendered page carries rank, previous position, the chart's own count,
periods on chart, release date and the linked video. The Data API's
`chart=mostPopular` is a different product and is not used. Chartmetric
is paused.

Readings in `src/lib/labs/musicOpportunities/seed/charts/` were read from
the chart pages in the Claude browser pane with a per-reading checksum
verified after the copy, and are labelled with that provenance. New
readings arrive the same way or by pasting a chart export (manual
import). Stored imports replace a seed of the same series and period.

| Chart | Measure | Rows | Readings held |
|---|---|---|---|
| Top Songs | views across the song's official versions, weekly | 100 | GB ×3 weeks (to 1, 8, 15 Oct), US ×2, MX ×1 |
| Top Music Videos | views of the video, weekly | 100 | GB ×2 |
| Top Songs on Shorts | Shorts created, weekly; count not published | 50 | GB ×2 |

Collection date and chart period are separate fields. Persistence is
counted inside one (source, chart, territory) series; breadth across
territories and chart types is reported separately.

## The bank

`bank.ts` builds four kinds of record from the readings: **songs** (as a
song chart ranks them; key = ISRC when supplied, else normalised title +
lead artist), **videos** (video charts only), **appearances** (one row of
one reading) and the **linked video** a song-chart row points at — kept
on the song as a hint, never as evidence of a video format.

## Classification (`classify.ts`)

Small vocabulary (`VOCAB` in `types.ts`); multiple labels allowed;
unknown is the default and is counted. Every label carries provenance
and confidence:

- **verified** — stated by the source: release date → era, relative to
  the chart week; source-catalogue genre/language fields.
- **human** — recorded in the sandbox (`/api/.../labels`); overrides.
- **inferred** — title rules (version: remix/live/slowed…; presentation,
  video titles only; language from script and stop-words) and the
  model-assigned artist → genre/language map in
  `seed/labels/artist-genres.json` (medium confidence; acts the model did
  not know are absent).

A song-chart row never gets a presentation label. An upload never gets an
era label from its upload date.

## Patterns (`patterns.ts`)

Unit: label value × chart × territory over the latest reading of each
series. Floor: ≥5 songs/videos from ≥3 artists. A label on ≥80% of
labelled rows, or a chart's own main language, is that chart's
**baseline**, listed separately. Every pattern carries distinct
entities and artists, share of labelled rows, top-artist share, how
many entities were present in every stored week (null with one week),
label provenance counts, and caveats (selected successes ≠ success rate;
a charting video does not prove its format; one act is not a genre).

## Catalogue (`catalogue.ts`)

Tier 1, published on an owned channel, in order of preference: the live
sandbox inventory (incremental `playlistItems` sweeps), a committed
snapshot in `seed/uploads/` (read once through the production
`/api/full-catalogue` route, with lifetime views and durations), or the
Owned Channels working set. Snapshots held: Folk and Nature (2,580 of
2,581, complete), El Patio (3,371 of 3,374, complete), Venue Floor
(newest 5,000 of 6,579 — the route cap; older uploads hold most of its
views). Tier 2, a verified source catalogue: none found in the repo or
connected Drive, Dropbox and Airtable on 23 Oct 2026; importable. Tier 3:
unverified. Channel "genre" is the artist map applied to upload credits,
never the channel's name.

## Connections

Direct (`match.ts`, `opportunities.ts`): exact upload → ISRC → same title
and artist (composition; version may differ, and a version marker on
either side is spelled out) → shared title only (set aside) → same
artist. Contextual (`connections.ts`): a non-baseline genre/language/
version pattern × a channel carrying it on ≥3 uploads and ≥10% of its
labelled catalogue; explained as a hypothesis with the channel's own
profile as the fit evidence.

## Stages and learning

Monitor / act editorially / consider a paid test. The gate needs a
verified recording (exact upload or ISRC), ≥2 comparable readings and
that upload's own earlier owned reading; the record requires territory,
timing, creative, destination, organic baseline, learning goal, success
and stop criteria, and refuses budgets, returns or revenue. Decisions
freeze evidence; later owned readings are appended for a like-for-like
comparison, never as proof of cause.

## Checks

`node scripts/test-music-opportunities.cjs` (gate, seeds, classification,
bank, pattern guardrails, matching tiers, stages, imports, empty states),
`npx tsc --noEmit`, `npm run build`.
