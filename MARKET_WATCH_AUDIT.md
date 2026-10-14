# Market Watch — audit pack

Written for external review. You do not need the repository. Where something is
wrong or unverified, this says so; finding the remaining errors is the point.

**Status:** working, gated, real data, never deployed to production.
**Date:** 14 October 2026.
**Branch:** `feature/market-watch` on `youtube-campaign-coach`.

---

## 1. What it is

VMG (Virgin Music Group) runs an internal YouTube tool called **Watcher** that
monitors 252 **artist** channels — campaign phases, upload cadence, hero videos.

**Market Watch** is a gated experimental feature *inside* Watcher, for the
opposite subject: **multi-artist destinations** — genre discovery (Trap Nation),
mood curation (Chill Nation), label catalogue (Monstercat, Strut), culture
(Flighthouse). The goal is to connect VMG's watched artists to evidence from
those destinations, to support decisions of the form *"test this song, on this
destination, with this treatment, for these inspectable reasons."*

It started as a standalone prototype and was moved inside Watcher to reuse the
configured API key, Upstash storage, hosting and design system.

## 2. Infrastructure

**Runtime:** Next.js 14 App Router on Vercel, inside the existing Watcher
project. No new project, database or credentials.

**Access control.** Watcher has *no* authentication — no middleware, no session
layer, no user model; the only access control in the codebase is a bearer check
on cron routes. So this brings its own, in `src/lib/marketWatch/gate.ts`:

- **Feature flag.** Without `MARKET_WATCH_SECRET`, the page and all four API
  routes return **404** — not 403. Default off.
- **Preview exemption.** On `VERCEL_ENV === 'preview'` the feature enables
  itself, relying on Vercel's Deployment Protection (Vercel Authentication,
  Standard Protection — verified ON), which requires a Vercel login and team
  membership. That is an identity check, stronger than a shared string.
- **Signed cookie** for any non-preview use: the secret is POSTed once and
  exchanged for an httpOnly cookie carrying an HMAC, never the secret.
- **Every refusal is 404**, including a wrong secret, so a disabled feature and
  a failed sign-in are indistinguishable from outside.

**Verified:** 12 runtime checks passed against a live server (unauthenticated
page + all routes, wrong secret, forged cookie, truncated cookie, httpOnly,
cookie never contains the secret). Separately, 9 unit cases proving production
stays closed with and without a cookie. Production currently returns **404 on
all four routes**, confirmed cross-origin from a browser.

**Known dependency, recorded in the gate file:** safe only while Deployment
Protection stays on. Turning it off makes previews public, and this with them.

**Storage.** Upstash, `mw:` namespace only — `mw:ch:{key}`, `mw:artist:{slug}`,
`mw:index`, `mw:artist:index`. Nothing reads or writes `live:`, `chanmap:` or
`sync:`. Nothing added to the cron. Collection is manual.

**Quota.** Shared with Watcher, which uses ~1,500 units/day of a 10,000 default.
Market collection cost ~300 units for 17 channels; artist catalogues ~25 each.
Per-request cap of 400 units; 12 artists max per request; 1,200 uploads per
channel, 600 per artist.

## 3. Data collected (all real)

| | |
|---|---|
| Market channels | **17 of 21** resolved and collected |
| Market uploads | **6,390**, up to 36 months |
| Artist catalogues | 2 piloted — Nickelback 600 (capped, to 2012), Tom Odell **509, complete to 2012** |
| Watcher artists readable | 252, all with cached uploads, 118 flagged `virgin` ownership |

**Not collected:** Latin Nation, Lowly, House Nation, R&B Nation — handles
unresolved or squatted. Comments — never fetched; audience-response analysis is
unbuilt.

## 4. Findings that survived checking

1. **Shorts split the market, and scale does not predict the side.** In 90 days:
   Nettwerk Music 197 uploads, 192 Shorts, median **1,123** views. Flighthouse
   91 uploads, 90 Shorts, median **157,625**. Same format, 140× apart. Trap
   Nation and Chill Nation have published **zero Shorts in three years**.
2. **Subscriber count does not predict output or performance.** Trap Nation:
   30.1M subs, 2.7 uploads/week, median 32K. Flighthouse: 1.9M subs, 7.1/week,
   median 158K.
3. **Cross-posting runs one direction.** 21 of 3,464 tracks appeared on more
   than one channel; the pattern is Chill Nation first, 7clouds later, 7clouds
   larger (CHRYSTAL *THE DAYS* 3.2M vs 174K; HUGEL *I Adore You* 1.0M vs 217K).
   Sequence is observed; coordination is not.
4. **36 watched artists appear on collected destinations, 12 Virgin-owned** —
   after correcting the matching (see §5).
5. **Aureal publishes Spanish-translated lyric videos**, including Tom Odell
   catalogue (*Another Love*, 103,880 views). No Nations channel does this.

## 5. Errors found and corrected — the important section

Five bugs, all caught by inspecting output rather than reasoning about code.
Four are the same class.

**a. Substring matching inflated 12 overlaps to 40.** `Y$` normalises to `"y"`,
and the test was `name.includes(key)` either way — so one upload matched Lykke
Li, Poppy, Rico Nasty, Bloc Party and fifteen others. `IVE` sits inside
`Ezra Collective`, attributing a K-pop lyric video to a London jazz band.

**b. Market appearances matched on title alone.** 16 of 18 Tom Odell "matches"
were different songs sharing a title — Linkin Park's *Numb*, Billy Joel's
*Piano Man*, Frank Sinatra's *Have Yourself a Merry Little Christmas*. Now
requires a credited-name match; proven against 12 real cases, 3 kept, 9 excluded.

**c. Shorts captions became tracks.** Grouping on every title produced 44
"tracks" for Nickelback, nearly all captions — *"Join the club at
nickelback.com."* A caption list, not a catalogue.

**d. Handle resolution trusted too far.** I wrote that a unique `forHandle` hit
*is* the identity. True of the handle, false of the channel: `@RnBNation`
resolved to a channel with **one subscriber**, `@MonstercatUncaged` to **two**,
`@HouseNation` to 3,930 with no uploads. Squatters. Now flagged `suspect`.

**e. A React hook below an early return** crashed the dashboard the moment data
arrived (error #310).

**The pattern:** permissive string matching on names produced a plausible
finding four separate times. Treat any name join without both operands as a
defect.

## 6. Deliberate constraints

- **Container and treatment are separate axes.** A remix can be a Short.
  Treatments are a list — "Sped Up Lyric Video" is both.
- **Three statuses never collapsed:** *monitored* (in Watcher), *ownership*
  (revenue interest recorded), *permission* (may we cut or place an asset —
  **recorded nowhere**, always `unknown`, printed on every suggestion).
- **Shorts link to a song only by title match.** Ambiguous ones counted
  separately, never folded in.
- **Lifetime views are never called growth.** Video age shown on every card.
- **"Not found" means not found in our coverage**, never "does not exist".
- **No fit scores, no predicted views.** Suggestions return "insufficient
  evidence" with a reason when nothing qualifies.
- **Never claimed:** revenue, demographics, audience overlap, conversion, causal
  algorithmic impact. Combined subscribers are never summed into reach.

## 7. Known limitations

1. **The Explore action has never produced a suggestion I would stand behind.**
   The three findings above are my reading of the data, not the tool's output.
   This is the single biggest gap.
2. **Watcher caches ~100 recent uploads per artist**, so catalogue was invisible
   to the connection layer. Artist catalogue collection fixes this but is
   piloted on 2 artists of 252.
3. **Title parsing carries the whole analytical layer.** No ISRC in the Data API,
   no artist field. The `Artist - Title` convention is Western and Latin-script.
4. **Comments never fetched.** Audience-response themes, a brief requirement,
   are unbuilt. ~1 unit per video, should run on a shortlist only.
5. **Treatment precedence is arbitrary** — first match wins, so "Acoustic Live
   Session" returns acoustic because acoustic is tested first.
6. **62 seconds is a proxy for "Short"** — the API exposes no Shorts flag.
7. **Ownership evidence is single-source** — one trade-press article for the
   Create/Nations relationship.
8. **Retention:** YouTube's API Terms require non-authorized data refreshed or
   deleted within 30 days; a 36-month allowance exists for clients approved for
   the *analytics use case*, which is **not established** for this client.
   Documented, not treated as a blocker for a gated prototype. Watcher itself
   stores long-running history under the same rule — flagged, untouched.

## 8. Questions worth a second opinion

1. Given five bugs of which four were the same class, what review practice would
   have caught them earlier than "look at the output"?
2. Is the preview-exemption gate (§2) sound, or does relying on Vercel
   Deployment Protection create an unacceptable single point of failure?
3. Title parsing (§7.3) is load-bearing and fragile. Is there a better signal in
   the YouTube Data API that has been missed?
4. The suggestion engine requires a destination to have published the same
   artist within 18 months. Is that too strict to ever fire usefully, and what
   weaker-but-still-honest evidence of editorial fit would you accept?
5. Is "insufficient evidence" the right default, or does a tool that usually
   refuses simply go unused?
6. What is missing entirely from this design?
