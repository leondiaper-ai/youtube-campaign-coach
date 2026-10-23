# Music Opportunities — labs sandbox

A separate, protected sandbox at `/labs/music-opportunities` that joins
YouTube demand signals to the music feeding the owned channels, and keeps
a record of what was known when a decision was taken. It reads the Owned
Channels store and writes only to its own `labs:mo:v1:` namespace. It
never publishes, edits YouTube metadata, creates campaigns or spends.

- Preview-only, like the Owned Channels draft: production returns 404 for
  the page and every API route, even after a merge (`labsEnabled()`).
  Preview access relies on Vercel Deployment Protection. No navigation
  item anywhere; the page links back to `/growth/owned` only.
- API routes (`/api/labs/music-opportunities/{charts,import,uploads,decisions}`)
  also reject cross-origin browser writes, validate against allowlists,
  hold a per-job lock, and apply an hourly cooldown per chart.
- Artist rosters, `live:`/`cat:`/`sync:` keys and the cron are untouched.

## Signals (three ways in, each labelled by its measure)

| Source | What it is | Period | Identifiers | Cost |
|---|---|---|---|---|
| YouTube Data API `videos.list chart=mostPopular` (category 10) | YouTube's own most-popular music list by region. **Not** the YouTube Music Charts product: no published measure, period or previous rank. | Collection date; movement only across our own daily readings | video id, channel | 1 quota unit per 50 rows (2 per region) |
| Chartmetric licensed YouTube Charts (`/api/charts/youtube/tracks`, `/videos`, `/shorts/{daily,weekly}`) | Weekly Top Songs (with ISRC), Top Music Videos (with video id), Top Songs on Shorts (Shorts **created**, not views). Updated Thursdays per their reference pages (read 23 Oct 2026). | Chart date from the response | ISRC / video id | 1 request each; plan coverage of chart endpoints **unverified** — a refusal is shown as a refusal |
| Manual import | charts.youtube.com has no documented public API. A person exports or copies a chart and pastes it with chart type, territory, period and a note. Header-driven, tolerant parser; rejects anything with no title column. | As typed from the page | video id from URL column if present | none |

Readings of the same source, measure, territory and period replace each
other, so refreshing twice never duplicates a record. Twelve readings are
kept per series, 60-day expiry. Persistence counts distinct periods of
the *same* chart; sources are never pooled.

## Catalogue (three tiers, kept apart)

1. **Published on an owned channel** — the sandbox's own title index of
   every public upload per channel (`playlistItems` only, 1 unit per 50;
   a 6,500-upload channel ≈ 130 units once; later sweeps stop at the
   first known upload). Falls back to the Owned Channels working set
   (newest 300 + top 100) for channels not yet swept, and says so.
2. **In a verified source catalogue, not yet published** — only after a
   CSV/TSV import (title, artist; optional isrc, version, genre,
   language, year, territories, rights). None was found in the repo or
   the connected Drive, Dropbox and Airtable sources on 23 Oct 2026.
3. **Unverified** — everything else. Text matches never become rights.

Views for matched uploads come from the Owned Channels readings
(`items` or `viewsById`); a gain is only stated between two of our own
readings and is reported with its actual span, never scaled.

## Matching, strongest first

exact upload (video id) → ISRC → same title and artist (normalised text;
version unverified) → same title, different artist (possible cover) →
same artist, different track. Both "Artist – Title" and "Title – Artist"
orderings are tried because both exist on these channels. "No credible
match" is returned as an empty list and counted on the page.

## Stages

- **Monitor** — a signal exists; no credible match, or a text match that
  needs a human check.
- **Act editorially** — credible match and a feasible editorial action
  (pin/feature, playlist position, a Short cut from the recording;
  upload if it is in the source catalogue and not yet published).
- **Consider a paid test** — a gate, not a recommendation: verified
  recording (exact upload or ISRC), signal held across ≥2 comparable
  readings, and an owned baseline exists. Recording one requires
  territory, why timely, creative, destination, organic baseline,
  learning goal, success and stop criteria, and refuses budgets, returns
  or revenue.

## Learning history

A decision freezes the signal, matches and owned-upload figures as they
stood. Later chart refreshes append the latest owned reading for those
uploads (`appendFollowUps`), so a like-for-like comparison is possible.
The page states the two readings and the days between; it never claims
cause.

## Demonstration

The Folk and Nature upload `hSkegNLcf8A` ("What a Friend We Have in
Jesus – Dolly Parton") is run through the real matcher with an
**invented** chart entry, labelled as such on the page and never saved.
The upload and its stored reading are real.

## Checks

`node scripts/test-music-opportunities.cjs`, `npx tsc --noEmit`,
`npm run build`. Live chart reads, upload sweeps and the Chartmetric
plan question need the configured preview environment.
