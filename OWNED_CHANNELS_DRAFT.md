# Owned Channels — UK production release

Production route: `/growth/owned`; individual channels below it. The tab appears
only in the UK header. Non-UK market URLs return 404. Market scope is not auth.
Production requires OWNED_CHANNELS_SECRET (20+ characters) in Vercel. A same-origin
POST exchanges it for a signed, expiring, secure httpOnly cookie. Both the pages
and collection endpoint require authorisation. Sign-in is rate limited in Redis.
Preview deployments retain Vercel Deployment Protection.

Retrieve the team access key directly from Vercel environment settings; never put
it in source, URLs or logs. Rotating the key invalidates previous sessions.

Existing readings remain in owned:preview:v1: to preserve history. Refresh is
manual with the existing one-hour per-channel cooldown. Artist cron and rosters
are unchanged. The Music Opportunities sandbox is not included in this release.

## Original implementation notes (historical preview design)

# Owned Channels — launch-stage draft

The VMG channels are all new. This dashboard measures their own early progress;
it does not grade them against Create Music, mature networks, or artist campaigns.
The Create review informs the distinction between channel purpose, publishing
formats and listening, rather than supplying benchmarks.

- Direct preview entry only: `/growth/owned`. No tab is added to `/growth`.
- Reuses the Watcher header, type scale, colours, table and expandable details.
- Channel names open dedicated analysis pages at `/growth/owned/[slug]`, with
  a channel switcher and a direct link back to the network. No public tab is added.
- Individual pages include 7/30-day period controls, recorded view/subscriber
  charts, daily publishing bars, video-length breakdowns and a searchable,
  sortable, paginated uploads table. Views per day are labelled as lifetime
  averages; observed seven-day video gains are shown separately.
- Growth graphs contain recorded readings only. Missing days over 36 hours
  break the line. A single reading is a baseline, not a reconstructed trend.
- Length groups avoid claiming that a short song is necessarily a YouTube Short.
- Likes and comments are included on new manual collections; older snapshots
  lacking them remain blank. Collection uses the same videos.list statistics call.
- Main figures: public views to date, subscribers, 7-day net growth, 30-day output.
- Per-channel purpose, first public upload and publishing age where complete
  upload history is available. A first public upload is not the channel creation date.
- Early track response is the median views to date on track uploads aged 7–30 days,
  with sample count and partial coverage shown. This is not a day-seven metric.
- Duration-based short-form classification is explicitly a proxy, not confirmed Shorts.
- No health scores, mature-network targets, inferred revenue or campaign uplift.

## Roster and data

Nine identities verified from public channel pages on 23 October 2026. The supplied
`UChVWfn28jaZSxBqwwP0VnL` has 23 characters and returns 404; retain it visibly
unresolved until a corrected ID is provided. Purpose labels are provisional
descriptions of public positioning, not a verified rights or ownership audit.

Reading the dashboard makes no YouTube calls. A manual refresh reads one
allowlisted channel per request, up to 300 uploads / 18 months. Missing counters
stay null. Seven-day gains require a fresh reading and a baseline seven days
earlier (12-hour tolerance); short observation windows are never extrapolated.
Preview history uses isolated `owned:preview:` keys, 29 days of readings and
30-day expiry. No artist roster, shared live cache or scheduled job is changed.

## Preview and production

This branch is a draft. Production always returns 404 for the page and write API,
and no navigation tab is added. The feature is enabled only in development or Vercel Preview.
Preview access relies on the project's existing Vercel Deployment Protection;
do not disable that protection. Collection also checks request origin, validates
the channel allowlist and uses a per-channel lock and one-hour cooldown.

Metrics need the existing YouTube API and Redis environment configuration in
the preview runtime. Without them the roster renders with clear missing-data
states and refresh disabled. Local build/TypeScript and calculation/gate checks
can run without credentials. An actual YouTube → Redis → dashboard refresh
still needs verification in the configured preview environment.

Checks: `node scripts/test-owned-channels.cjs`, `npx tsc --noEmit`, `npm run build`.
