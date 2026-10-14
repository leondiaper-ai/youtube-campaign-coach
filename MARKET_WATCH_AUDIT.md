# Market Watch — audit pack

Written for external review. You do not need the repository or any VMG context.
Where something is wrong, thin or unverified, this says so; finding the
remaining errors is the point, not confirming the work.

**Status:** working, gated, real data, never released to production.
**Date:** 14 October 2026.
**Branch:** `feature/market-watch` on `youtube-campaign-coach`. 17 commits since
the last audit, HEAD `4e13713`.

---

## 1. What this is, and what changed since the last audit

VMG (Virgin Music Group) runs an internal YouTube tool called **Watcher** that
monitors 252 **artist** channels. **Market Watch** is a gated experimental
feature inside it, looking at the opposite subject: **multi-artist
destinations** — genre discovery (Trap Nation), mood curation (Chill Nation),
label catalogues (Monstercat, Enhanced), culture (Flighthouse).

The brief has been rewritten by the stakeholder three times during this period,
and the direction of travel is the most important thing in this document:

1. **Recommendation engine.** "Which destination should this song go to?"
   Abandoned — see §5. It produced confident cards without discrimination.
2. **Programming shortlist.** "Which songs merit consideration for
   owned-channel support?" Built, working, §3.
3. **Destination-first editorial research.** "Which of our songs suit this
   environment?" Run once by hand, §6. Produced a finding that undermines the
   premise of all three.

VMG's owned-channel inventory **does not exist yet**. Market channels are
reference examples only, never destinations VMG controls. That distinction is
enforced in storage, not just in wording.

## 2. Infrastructure

**Runtime.** Next.js 14 App Router on Vercel, inside the existing Watcher
project. No new project, database or credentials. ~4,800 lines across
`src/lib/marketWatch/`, `src/app/market-watch/`, `src/app/api/market-watch/`.

**Access control.** Watcher itself has *no* authentication — no middleware, no
session layer, no user model. So this brings its own (`gate.ts`):

- Without `MARKET_WATCH_SECRET` every page and all six API routes return
  **404**, not 403. Default off.
- On `VERCEL_ENV === 'preview'` the feature enables itself and relies on
  Vercel Deployment Protection (verified ON), which requires a Vercel login and
  team membership — an identity check rather than a shared string.
- Non-preview use exchanges the secret once for an httpOnly cookie carrying an
  HMAC. The secret is never in a URL or the client bundle.
- **Every refusal is 404**, so a disabled feature and a failed sign-in are
  indistinguishable from outside.

Verified: 16 runtime checks against a live server, including the three routes
added this period and the POST that writes tags. Production returns **404 on
every Market Watch route**, confirmed cross-origin during this session.

**Known dependency, recorded in the gate file:** safe only while Deployment
Protection stays on. Turning it off makes previews public, and this with them.

**Storage.** Upstash, `mw:` namespace only — `mw:ch:{key}`, `mw:artist:{slug}`,
`mw:desc:{kind}:{id}`, `mw:shortlist`, `mw:feedback`, `mw:index`. Nothing reads
or writes `live:`, `chanmap:` or `sync:`. Nothing added to the cron.

**Quota.** Shared with Watcher (~1,500 units/day of 10,000). Collection is
manual, capped at 400 units per request.

## 3. Data actually held

| | |
|---|---|
| Market channels collected | **19 of 21**, **7,260** uploads, up to 36 months |
| Largest | Flighthouse 1,200 · Enhanced 1,126 · 7clouds 1,077 · Rap Nation 858 · Nettwerk 842 |
| Watcher artists | 252, all with cached uploads; **118 flagged `virgin` ownership** |
| Canonical songs built | **919**, from 40 artists scanned |
| Per-video observation series | **669** featured assets; **575** have a usable 7-day window |

**Four channels resolved to empty or near-empty records** — House Nation 0,
R&B Nation 0, Nettwerk Backstage 0, Monstercat Uncaged 2 — handle collisions,
flagged `suspect`, excluded rather than shown as findings.

**The per-video series is the one genuinely new capability.** Watcher had been
fetching `viewCount` on every sync and overwriting it. `videoSnapshots.ts`
appends one dated observation per video per day at zero extra quota. Typical
coverage is 26 observations, 19 Sept – 14 Oct. It **refuses to reconstruct
history**: a video published before the file existed has no series and shows
nothing, because deriving "what it would have had at day 7" produces a
confident number with no observation underneath it.

## 4. What is built and working

**Songs tab** — three lenses, deliberately not combined into one score:

- **Biggest** — most lifetime views on the song's best full-track asset.
- **Moving now** — views added over a *measured* window from the series.
  Lifetime ÷ age is never used; a song without two dated observations is
  absent, not estimated.
- **Worth extending** — a named asset-level signal: a Short at ≥2× that
  artist's median Short and ≥25,000 absolute.

Live examples: Morgan Wallen *I Got Better* **+1,041,435 / 7d**; Hermanos
Espinoza *29:11* **+967,815 / 7d**; Tom Odell *Another Love* — a Short at
14,652,385, **670×** his median Short.

**Rules enforced in code, not prose:** Shorts and full-track are never summed.
Video IDs deduplicated before counting. Featured asset is never a Short.
Channel totals never appear in a song metric. Every figure states whether it
covers the featured video or a set of song assets. Permission is stored
separately from monitoring and ownership and defaults to `unknown`.

**Shortlist workflow** — save with destination, treatment, note, and a
`destinationKind` of `owned` / `reference` / `undecided`, so a reference
channel cannot blur into somewhere VMG can publish. Save, persistence across
requests, and undo all verified. Posting `destinationKind: "bogus"` and
`permission: "hacked"` was rejected to safe defaults.

## 5. The recommendation engine, and why it was abandoned

This is the most useful section for a reviewer.

A connection layer was built with three routes (same artist / comparable
description / treatment pattern), a shared descriptor vocabulary with
provenance labels, and both search directions. The stakeholder's verdict after
seeing it populated: *"plausible-looking cards without useful
discrimination."* He was right, and the specific failures were:

**a. Genre never matched anything.** Agreement was exact token equality, so
`"uk rap"` did not match `"rap"`. The one axis carrying musical fit was silent
on every pairing.

**b. With genre silent, the grader used what was left.** K-Trap's UK
rap/Afroswing record scored a **strong** fit for Chill Nation, a downtempo
channel, on `language=english`, `context=driving` and energy 3 vs 2. All five
pilot songs returned "strong, ready to propose".

**c. `n=858` "comparable uploads" was the entire channel.** When no upload
could be matched individually the support set silently fell back to all of
Rap Nation, and a channel median was presented as pairing evidence.

**d. `pop` carried genre agreement.** `"alternative pop"` matched `"pop"`, so a
stripped-back piano ballad fit a Latin-pop lyric channel.

**e. Both 7clouds suggestions rested on the channel's own releases** —
`[7clouds Release]` uploads by Rachel Lorin, its in-house artist, which is the
least comparable thing on a channel to a third-party placement.

**f. Flighthouse topped destination ranking on volume** with **one** parseable
artist credit in 1,200 uploads. It is a Shorts/meme channel with no readable
repertoire.

All six were fixed, and the result still did not discriminate. **The deeper
problem was the unit of analysis, not the implementation** — see §6.

**One pairing was inspected manually and reversed.** Joji *Blah Blah* →
7clouds was reported as the strongest candidate found. Checking it:

- 7clouds' two Joji uploads did **253,552** (312d) and **101,443** (350d) —
  **813** and **290** views/day.
- Against 7clouds uploads in the same 290–370 day age band (n=80): lower
  quartile **649**, median **1,384**, upper quartile **3,395** views/day.
  Both Joji uploads are **below median**; one is **below the lower quartile**.
- Those were Joji's two *biggest* tracks of that campaign — 17.9M and ~19.6M on
  his own channel. 7clouds captured **1.4%** and **0.5%**.
- *Blah Blah* has 1.9M, **9.4× smaller**. Expected range ~10,000–27,000.
- 7clouds has published **zero** Joji uploads in 2026 — four months since the
  album, including *Blah Blah*. The destination already made this decision.

The lifetime figures looked impressive only because they were old. That is
exactly the error the design existed to prevent, and it made it anyway.

**Current state:** cards whose editorial fit rests on language, format or a
broad genre word are hidden and counted. "Ready to propose" counters removed.

## 6. The destination-first exercise, and the finding that matters

One channel, examined properly.

**Chill Nation's editorial identity, from uploads rather than its name.**
Across 170 uploads in 400 days, **55% are remixes or edits of recognisable
songs by other artists** — The Lumineers *Ho Hey*, t.A.T.u. *all the things she
said*, Tame Impala, Owl City *Fireflies*, Yeah Yeah Yeahs — alongside current
rap and pop (Don Toliver ×3, Drake, Charli XCX, Billie Eilish). The remaining
45% are originals from a small affiliate roster (Ian Asher, HAVEN, EBEN,
Texture, MOONLGHT) who also produce many of the remixes.

**Remix is the format, not an advantage.** Median lifetime views: remixes
**28,257**, originals **26,498**. Any claim that commissioning a remix improves
outcomes has no support here.

**Three Virgin artists have already appeared there:**

| Upload | Date | Views |
|---|---|---|
| Lost Frequencies, Tom Odell — *Black Friday* | Jul 2024 | **666,392** |
| Morgan Wallen, Tate McRae — *What I Want* (VAVO × BVRNOUT Remix) | Jun 2025 | **37,204** |
| Tove Lo — *Talking Body* (Kogis Remix) | Mar 2026 | **34,730** |

Channel median over the last year is **25,788**. So the two actual Virgin
remixes landed *at* median. The 666K was Lost Frequencies' record featuring
Odell — a different proposition from a Virgin record being remixed.

**THE FINDING.** Chill Nation published **two remixes of the same song**:

- [MOONLGHT, Mr. Moon — *Talking Body*](https://www.youtube.com/watch?v=lpFxo4Hjd8c), Nov 2025 — **915,030**
- [Tove Lo — *Talking Body* (Kogis Remix)](https://www.youtube.com/watch?v=4XlRlj10HtA), Mar 2026 — **34,730**

Same song, same channel, **26× apart**. Whatever drove the 915K was not the
song choice. If producer, treatment and timing dominate that heavily, then
**ranking songs for a destination is the wrong unit of analysis** — and no
amount of additional data collection fixes that. This is the open question the
project currently sits on.

## 7. Coverage gaps that change interpretation

1. **The repertoire that fits these channels is the repertoire we do not
   hold.** Watcher caches a recent window per artist, so for most artists the
   back catalogue is invisible. Tove Lo's *Talking Body* — the one Virgin song
   demonstrably made to work on Chill Nation — **is not in our data at all**.
   Lykke Li's *I Follow Rivers*, one of the most-remixed indie records of the
   last 15 years, absent. Melanie C's *I Turn to You* appears only as a 2021
   acoustic at 200K. Lukas Graham's *7 Years* shows as a 0.7-year-old
   performance at 1.57M, plainly not the original.
   *Smallest fix, already built and unused:* `collectArtistCatalogue` for ~12
   catalogue-rich artists at ~25 units each — **~300 units**.
2. **40 of 118 Virgin artists scanned** (one catalogue read each).
3. **No comment text has ever been fetched.** `topComments` exists and the
   card renders it, but no scan has run, so audience-response analysis is
   built and untested. ~1 unit per video, should run on a shortlist only.
4. **Musical attributes cannot be derived.** No audio, no ISRC, no genre field
   in the Data API. Genre/mood/energy are stated by a human or absent; they
   are never guessed from an artist's or channel's name.
5. **Title parsing carries the analytical layer.** The `Artist - Title`
   convention is Western and Latin-script.
6. **62 seconds is a proxy for "Short"** — the API exposes no Shorts flag.
7. **Mobile layout is unverified visually.** Two responsive fixes were made on
   structural grounds; the screenshot tool returns a fixed 1384px viewport.
8. **Retention:** YouTube's API Terms require non-authorized data refreshed or
   deleted within 30 days; the 36-month allowance applies to clients approved
   for the *analytics use case*, which is **not established** here. Documented,
   not treated as a blocker for a gated prototype. Watcher itself stores
   long-running history under the same rule — flagged, untouched.

## 8. Errors found and corrected this period

Beyond §5. All were found by **reading populated output**, not by reasoning
about code.

- **A dash inside brackets split titles wrongly.** Modest Mouse's "The World At
  Large (…Jeremy Sherrer Remix - Official Audio)" produced a song named
  **"Official Audio)"**.
- **Reversed title order collapsed a catalogue.** Hermanos Espinoza publish
  "29:11 - Hermanos Espinoza (Lyric Video)" — song first. Read left-to-right,
  *every* song became "Hermanos Espinoza".
- **Feature credits split one song into two** — "50 ballerinas" and "50
  ballerinas ft. okgiorgio, Tabi".
- **"Worth extending" asked a structurally impossible question.** It required a
  Short to beat its record, which can only fire on songs with a few hundred
  views — exactly what the floor then removed. The lens came back empty and
  looked like restraint. Now artist-relative.
- **Measurement dates described the series, not the window.** A 7-day gain
  carried a 26-day date range, above a trend line spanning the same 26 days.
- **Every `bg-ink text-page` button rendered black-on-black.** `page` is not a
  colour in `tailwind.config`. Pre-existing on two components; copied into a
  third.
- **A 45-second timeout** introduced by issuing up to 8 KV reads per artist.

**The pattern across both audits:** permissive or naive string handling on
names and titles produces plausible findings. Treat any name join without both
operands, and any "ratio" without an absolute floor, as a defect.

## 9. Questions worth an outside view

1. §6 is the live question: given 915,030 vs 34,730 for the same song on the
   same channel, is song-level destination matching a coherent exercise at
   all? If the answer is "no, model producers and treatments instead", what
   would that look like with only public YouTube data?
2. The recommendation engine failed twice in the same way — plausible output,
   no discrimination. Is there a test that would have caught that before a
   human looked at the cards?
3. §7.1 says the useful repertoire is uncollected. Is 300 quota units the
   right next move, or does §6 make it moot?
4. Is "hide the weak cards" honest, or does it just relocate the problem —
   a tool that shows three things and silently drops twelve?
5. The preview gate depends entirely on Vercel Deployment Protection staying
   on. Acceptable single point of failure for an internal prototype?
6. What is missing from this design entirely?
