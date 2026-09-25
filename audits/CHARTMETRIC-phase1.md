# Chartmetric integration — Phase 1 inspection

**Scope of this document.** What is in the Watcher today, what Chartmetric
actually offers, and the smallest clean way to join the two. No code has been
changed. One of the sixteen items — the real response body — cannot be
answered yet, and §11 says exactly why and what unblocks it.

Date: 25 September 2026.

---

## 1. Current Watcher architecture relevant to this integration

Next.js 14 App Router on Vercel. The parts that matter here:

| Layer | Where | What it does |
|---|---|---|
| Artist roster | `src/lib/artists.ts` (7 seed) + `src/lib/artistStore.ts` (`artists:custom` in KV, 228 live) | One `Artist` per row; identity is `slug` + `channelHandle` |
| YouTube client | `src/lib/youtube.ts` | The only outbound API client in the codebase. Single key read at module top, in-memory `Map` cache with TTL, quota flag with cooldown |
| Durable cache | `src/lib/kvCache.ts` (Upstash Redis) | Written **only** by the daily cron. Every page and API route reads from here — zero YouTube calls during browsing |
| History | `src/lib/snapshots.ts` | Per-channel time series, deltas, freshness |
| Artist page | `src/app/watcher/[slug]/page.tsx` → `src/components/WatcherArtistView.tsx` | Server component, 1,395 lines, shared with the regional team boards |

The single most useful thing found in the inspection: **`WatcherArtistView`
already has a `footer` slot** — a `ReactNode` rendered under the analysis,
currently `null` on our own page and used by the team boards for their notes.
A Chartmetric module can therefore be mounted with **no edit to
`WatcherArtistView` at all** — one prop passed from
`src/app/watcher/[slug]/page.tsx`. That satisfies "do not redesign the Watcher"
about as literally as it can be satisfied.

## 2. How artists are represented

```ts
type Artist = {
  slug: string;              // identity
  name: string;
  channelHandle?: string;    // '@handle' or a raw 'UC…' channel ID
  phase, artistType, ownership, campaign, nextMomentLabel,
  nextMomentDate, campaignStartDate, custom, collabs
};
```

Seven seeded in `ARTISTS`; 228 more persisted in KV under `artists:custom`
and merged at read time by `mergeArtistLists()`.

## 3. Where YouTube channel IDs already live

Three places, in order of cheapness:

1. `LiveSnap.channelId` — present on every cron-written snapshot in KV. **This
   is the one to use.** It is already loaded on the artist page.
2. `chanmap:{handle}` in KV — the handle → channel-ID mapping,
   `readChannelMapping()` in `kvCache.ts`.
3. `resolveChannelId()` / `resolveChannelIdWithSearch()` in `youtube.ts` —
   live resolution, costs YouTube quota. Not needed for this.

So we have a `UC…` channel ID for every artist with a successful snapshot,
free, server-side. That matters for §5.

## 4. The existing external-API client pattern (to copy, not reinvent)

`src/lib/youtube.ts` establishes the house shape:

- one `process.env.*` read at module top;
- a module-level `Map` in-memory cache with an explicit TTL constant;
- a module-level failure flag (`quotaExhausted` + `quotaExhaustedAt`) with a
  cooldown so a dead upstream is not hammered;
- defensive coercion of upstream values (`statCount()` returns `undefined`
  rather than `NaN`);
- KV as the durable layer; routes read KV, not the upstream.

Chartmetric should look like this file, not like something new.

## 5. Caching mechanisms available

Two tiers, both already in use:

- **In-memory `Map` + TTL** — per serverless instance, survives warm
  invocations, free. Right for the access token and for hot responses.
- **Upstash KV** (`@upstash/redis`) — durable, shared across instances,
  already wired with `KV_REST_API_URL/TOKEN` and `UPSTASH_REDIS_REST_*`.
  Right for the channel-ID → Chartmetric-artist-ID mapping, which is a fact
  that essentially never changes.

## 6. Environment variables currently in use

`ANTHROPIC_API_KEY`, `CRON_SECRET`, `KV_REST_API_TOKEN`, `KV_REST_API_URL`,
`MCP_TOKEN`, `MODEL_ENABLED`, `NEXT_PUBLIC_WATCHER_URL`, `OPENAI_API_KEY`,
`RESEARCHER_MODEL`, `REVIEW_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`,
`UPSTASH_REDIS_REST_URL`, `XAI_API_KEY`, `YOUTUBE_API_KEY`.

**No `CHARTMETRIC_*` variable is set.** One is needed:
`CHARTMETRIC_REFRESH_TOKEN`, server-side only, not `NEXT_PUBLIC_`.

## 7. Chartmetric authentication — confirmed from the docs

Two-token model.

- `POST https://api.chartmetric.com/api/token`, body `{"refreshtoken": "…"}`.
- Response: `{ token, expires_in, refresh_token, scope }` — `expires_in` is
  3600.
- Every request: `Authorization: Bearer <token>`, exactly one space.
- Errors: **400** malformed body · **401** invalid/expired token · **403**
  scope · **429** rate limit.
- The docs say in as many words: *"Reuse the same access token until it
  expires. Do not call /api/token per request."*

Note the response also returns a `refresh_token` — the documented pattern is
to keep using the one in the environment; we will not attempt to rotate the
stored value automatically.

## 8. Rate limits — confirmed from the docs

Not a fixed window. Chartmetric uses a **sliding window** that starts at the
first request and slides request-by-request, so three calls inside one second
breach a 2 req/sec cap even if a clock-aligned view would not.

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset` (a unix epoch). On 429: sleep until `Reset`, then retry;
do not tight-loop.

Design consequence for us: **a serial queue with a minimum gap between
requests**, not a concurrency pool. At a 2 req/sec trial limit a 600 ms floor
between calls is comfortably inside it, and the artist page needs at most two
calls anyway.

Also worth knowing: on the prepaid plan, requests cost credits, and a set of
endpoints marked 💎 Premium cost 2 instead of 1. **`youtube-audience-stats`
is a premium endpoint. `market-coverage-views/youtube` is not** — the POC
endpoint is the cheap one.

## 9. Artist resolution — the deterministic route exists

This was the open question, and the answer is good:

```
GET /api/artist/youtube/{UC…channelId}/get-ids
```

`getArtistIds`, "Get Cross-Platform Artist IDs". The `type` path segment
accepts `chartmetric | spotify | itunes | deezer | amazon | youtube |
instagram`, and the documentation states explicitly: *"`youtube` expects the
channel ID, not the artist ID."*

Response shape:

```jsonc
{ "obj": [ {
    "cm_artist": 12345,            // Chartmetric artist ID (aggregate=false)
    "artist_name": "…",
    "spotify_artist_id": "…",
    "youtube_channel_id": "UC…",
    …
} ] }
```

**So no fuzzy name search is required.** We already hold a `UC…` for every
artist with a snapshot (§3), which means the mapping is
`YouTube channel ID → cm_artist`, deterministic, one call, cached forever in
KV under `cm:artist:{channelId}`. `artist_name` comes back in the same
response and gives us a free sanity check against the Watcher's own title.

Fallback, only where a channel ID is genuinely absent: `GET /api/search`.
Flagged as lower confidence and stored with a `resolvedBy: 'search'` marker so
it is visible rather than silent.

## 10. The POC endpoint

```
GET /api/artist/{cm_artist}/market-coverage-views/youtube?date=YYYY-MM-DD
```

`listArtistYoutubeMarketCoverage` — "YouTube Views & Market Coverage".
Documented shape:

```jsonc
{ "obj": {
  "insights": {
    "cities":    [ { rank, value, timestp, name, code2, city_id, lat, lng,
                     continent, region: "CITY",
                     current_max_count, market_max_cm_artist_id,
                     market_max_artist_name,
                     trend: [ { timestp, monthlyViews } ] } ],
    "countries": [ { rank, value, timestp, name, code2, region: "COUNTRY", … } ]
  },
  "marketInsights": { "marketCities": [], "marketCountries": [] },
  "artistTotalViews": 1234567890
} }
```

Three things to flag now rather than discover later:

- `value` is typed `number | string | null` — **every numeric field in this
  response is nullable and may arrive as a string.** Normalization must coerce,
  the way `statCount()` already does for YouTube.
- Each row carries a **28-day `trend` series** of monthly views. More than a
  territory list; it is a territory list with momentum.
- `market_max_artist_name` names the artist with the highest views in that
  city — a competitive read we did not ask for and will get anyway.
- Top-100-cities coverage exists **only for dates on or after 2024-05-24**.
  Omitting `date` returns the most recent snapshot, which is what we want.

This is *YouTube-for-Artists* view data, i.e. it spans the artist's whole
YouTube presence (including topic/auto-generated channels), **not** the owned
channel the Watcher tracks. That distinction has to be stated on the module,
or the territory figures will be read as if they belong to the channel above
them.

## 11. Actual response structure after a test call — **NOT YET DONE**

This is the one item I cannot close, and I would rather say so plainly than
fill it with the documentation restated as if it were observed.

Two hard blockers:

1. **The sandbox has no outbound network.** Code runs here; HTTP does not
   leave here. The only network surface available to me is the browser pane,
   which cannot carry a secret.
2. **`CHARTMETRIC_REFRESH_TOKEN` is not set** in the Vercel environment, and
   per your instruction I am not going to ask you to paste it anywhere I can
   see it.

The honest sequence from here:

1. You add `CHARTMETRIC_REFRESH_TOKEN` to Vercel (all environments,
   server-side, **not** `NEXT_PUBLIC_`).
2. I build the auth service, the rate-limited client, the resolver, and a
   **token-guarded dev-only inspection route** — `/api/chartmetric/inspect`,
   gated on the existing `REVIEW_TOKEN` pattern, returning the raw body for
   one artist and nothing else.
3. You push.
4. I call that route through the browser pane, capture the **real** body, and
   only then write the normalizer and the UI against what actually came back.

Everything in §10 is documentation, clearly labelled as such. Nothing will be
built on it until step 4.

## 12. Proposed file layout

New, additive only:

```
src/lib/chartmetric/
  auth.ts        mintAccessToken + module-level cache {token, expiresAt}
                 refresh at expiry − 60s; single in-flight promise so a
                 cold start with three concurrent requests mints once
  client.ts      cmFetch(path) — serial queue with a 600ms floor, reads
                 X-RateLimit-* off every response, one retry on 401 after
                 a forced re-mint, sleep-to-Reset on 429, hard failure
                 cap with cooldown (the youtube.ts quotaExhausted pattern)
  resolve.ts     channelId → cm_artist, KV-cached at cm:artist:{channelId}
  territories.ts market-coverage fetch + normalize to our own type
  types.ts       our types, not theirs
src/app/api/chartmetric/
  territories/[slug]/route.ts   the only thing the UI ever calls
  inspect/route.ts              dev-only, REVIEW_TOKEN-gated, removed after
src/components/
  YouTubeTerritories.tsx        client component, own fetch, own error state
```

`src/app/watcher/[slug]/page.tsx` gains one line: `footer={<YouTubeTerritories
slug={slug} />}`. **`WatcherArtistView.tsx` is not touched.**

## 13. How it cannot break the Watcher

Four independent guarantees, because one is not enough:

1. It mounts in the existing `footer` slot — the artist analysis above it does
   not know it exists.
2. The component fetches **client-side, after paint**. A hanging Chartmetric
   request cannot delay the server render of the page.
3. Every failure path returns `{ ok: false, reason }` with HTTP 200 from our
   own route. The component renders nothing, or a single quiet line. No throw
   reaches a React boundary.
4. Missing `CHARTMETRIC_REFRESH_TOKEN` is a **no-op**, not an error — the same
   way `artistStore.ts` already degrades gracefully when the KV env is absent.
   The module simply does not render.

## 14. Secret handling

- `CHARTMETRIC_REFRESH_TOKEN` read once, in `src/lib/chartmetric/auth.ts`,
  server-side only.
- The refresh token never appears in a response body, a log line, an error
  message, source, or git. `auth.ts` will log failures by status code only.
- The **access** token is equally server-side. It is never sent to the
  browser; the browser only ever talks to `/api/chartmetric/*` on our own
  origin.
- Nothing `NEXT_PUBLIC_`.
- `.env*` is already gitignored; I will not create a `.env` containing a real
  value.

## 15. Request budget for the POC

Per artist page view, cold: **2 requests** (resolve, then territories) — and
the resolve is cached in KV permanently, so steady state is **1**.
Token minting is ~1 per hour per warm instance, not per request. At a 600 ms
serial floor this sits at roughly 1.7 req/sec worst case against a 2 req/sec
ceiling, and realistically far below it.

## 16. Uncertainties and limitations

1. **Nothing has been observed.** §7–§10 are read from Chartmetric's OpenAPI
   document and guides. They are consistent and detailed, but they are
   documentation. See §11.
2. **Coverage is unknown.** Chartmetric may not hold every Watcher artist,
   and a developing K-pop or UK rap channel is exactly where a coverage gap
   would sit. The resolver must treat "not found" as a normal outcome.
3. **The scope of the figure.** As flagged in §10, these are YouTube-for-Artists
   views across the artist's whole YouTube presence, not the owned channel.
   Presenting them next to the Watcher's channel views without saying so would
   be the same class of mistake as the subscribers-vs-views conflation on the
   UK Top 100.
4. **Credits.** If the trial is the prepaid plan, every call costs credits and
   we have no visibility of the balance from the API. Worth checking in
   Settings → API Usage before any roll-out beyond one artist.
5. **`X-RateLimit-Limit` is unverified.** The trial limit is assumed to be
   2 req/sec; the header will tell us the truth on the first real call, and
   the client will read it rather than trust the assumption.
6. **`date` semantics.** Omitting it returns "the most recent snapshot", but
   how stale that is in practice is unknown until we see a `timestp`.

---

## What I need from you to proceed

One thing: **`CHARTMETRIC_REFRESH_TOKEN` in the Vercel environment.** Do not
send it to me.

Then I build §12 with the inspection route, you push, I capture the real
response, and the UI gets written against that — not against §10.
