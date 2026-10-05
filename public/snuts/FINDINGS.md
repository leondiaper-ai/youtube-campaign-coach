# The Snuts — Joy In Short Moments
## Deep-dive findings note · 5 October 2026 · 18 days to album day

**Read this first.** Three of the conclusions in the v1 deck did not survive the stress test. One
was built on a truncated data field, one on a daily series that cannot support daily reading, and
one — "live is the acquisition engine" — is contradicted by the actual festival dates. All three
are corrected below. Two genuinely new findings came out of the re-testing, and they point at a
different decision from the one the v1 deck implied.

I have cut: *live content works*, *improve CTAs*, *convert listeners to followers*, *make more
content*, *improve pre-saves*. None of them passed the test.

---

# PART 0 — INSTRUMENT FAILURES FOUND WHILE TESTING

These are not findings about the campaign. They are findings about the tools, and two of them
invalidated analysis I had already given you.

### 0a. The Spotify monthly-listener series cannot be read day by day

Day-of-week means for daily listener gain, across 195 non-interpolated observations:

| Sun | Mon | Fri | Sat | Tue | Wed | Thu |
|---|---|---|---|---|---|---|
| **2,301** | 1,187 | 1,176 | 937 | 800 | 661 | **583** |

Sunday runs 3.95× Thursday, every week, all year. Six of the seven daily jumps above 6,000 fall
on a Sunday or Monday. There is no behavioural reason Sunday would carry four times Thursday's
new listeners consistently for nine months. This is a settlement/sampling cadence in the data,
not audience behaviour.

**Consequence.** The 24/48/72-hour event analysis you asked for cannot be done on Spotify
listening. Anything I tell you about listeners is reliable at weekly resolution or coarser, and
I have used nothing finer. In particular, the "+14,478 on 9 August" and "+13,171 on 23 August"
single-day spikes I was about to report as distribution events are artefacts. They are gone.

The **follower** series passes the same test far better — Sunday 76 vs 40–47 elsewhere, and that
is driven by one genuine release-weekend outlier (1 February). Daily followers are usable.

### 0b. I audited pre-save links against truncated descriptions

`/api/full-catalogue` capped every description at 400 characters. Artist descriptions run copy →
stream link → pre-order → pre-save → tour → socials, and on this campaign the pre-save sits around
character 300–450. So the cap cut it off on exactly the assets that matter, and a truncated
description is indistinguishable from one that never had the link.

Seven assets were truncated, all long-form, carrying **98,204 views — 65% of all post-announcement
views**, including the PTS video and the podcast. My "5 of 10 long-form carry a pre-save" figure is
unsafe. **All 44 Shorts were under the cap, so the Shorts half of that audit stands.**

I have pushed a fix (`?desc=full`). Two checks are blocked until it deploys — flagged in Part 3.

### 0c. The YouTube channel daily series has unrecorded days

The cron misses days and the next reading carries the whole interval. A naive daily read shows
zeros and false spikes. Every YouTube figure below is computed on gap-adjusted blocks: a run of
zeros plus its catch-up reading, divided by the real number of days.

---

# PART 1 — FINDINGS THAT CHANGE A DECISION

---

## FINDING 1 — August was the biggest listening month of the year and never touched a single owned surface

### What appears to be happening
August added more Spotify monthly listeners than any other month of the campaign. On every
platform The Snuts actually control, August is invisible — flat or below baseline.

### Evidence

| Month | Listeners gained | Spotify followers/day | Listeners per follower gained |
|---|---|---|---|
| June | +39,517 | 50.5 | 26 |
| **July** | +30,862 | **57.9** | **18** |
| **August** | **+86,303** | 46.8 | **61** |
| September | −40,018 | 43.5 | — |

August produced **2.8× July's listening gain on fewer followers** (1,404 vs 1,736). Capture
efficiency fell from 18 listeners-per-follower in July to 61 in August — **3.4× worse**, in
adjacent months, same artist, same catalogue.

Everything else in August, against baseline:

| Signal | August | Baseline | Verdict |
|---|---|---|---|
| YouTube channel views (gap-adjusted) | 6,114–7,308/day | ~6,841/day median | **flat** |
| TikTok followers | +7/day | ~10/day | **flat** |
| TikTok likes | 406/day | 618/day in late June | **below** |
| Spotify followers | 46.8/day | 41/day median | marginal |
| Instagram | series has gaps at the window edges | +99/day in late June | **not measurable** |

### New or already known?
**New.** The team knew August was strong on Spotify. The quantified finding that it moved *nothing
else at all* has not, as far as I can tell from the supplied context, been established.

### Alternative explanations
1. **Monthly listeners is a 28-day rolling count**, so a single late-July event (Kendal Calling,
   31 July; Y Not, 30 Jul–2 Aug) raises the level for 28 days. Partly true — but the level was
   still *climbing* on 28 August, which a 31 July one-off cannot produce, since by then it is
   rolling out of the window.
2. **Chartmetric is wrong about August.** Possible. The weekly figures are internally consistent
   and the peak (802,842 on 4 September) sits where a late-August accumulation should put it.
3. **The owned platforms are simply too small to register.** Real, and it cuts the other way:
   YouTube is 30,200 subscribers against 780,062 monthly listeners. Which is the point.

### The decision it changes
This is the one that matters. **"Improve capture" is the wrong instruction for the August
audience, because the campaign never met them.** They arrived through Spotify's own distribution,
listened on Spotify, and were never on a surface The Snuts control. No pinned comment, Short
description, YouTube end-card or Instagram link could have reached them.

So the capture lever for this audience is **on Spotify itself and nowhere else** — the artist
profile, Canvas, the Countdown Page, and paid targeting inside Spotify. Every pound or hour spent
improving conversion routes on owned social is aimed at a different, much smaller, mostly-core
audience.

Last week that would have changed where the pre-album conversion effort was pointed.

### Actionable before 23 October
**Yes.** Spotify-side assets and Countdown Page placement are within the window.

### Confidence
**Medium-High** on the fact (August listening up, owned platforms flat). **Low** on the cause —
see the data gap.

### Data needed
Spotify for Artists → Audience → **source of streams for August** (editorial / algorithmic /
artist profile / other), and the playlist-add log for August. That single export turns this from
"we don't know how they arrived" into a targetable segment. It is the highest-value missing number
in the whole analysis.

---

## FINDING 2 — The campaign has had exactly two multi-platform attention events, and both were stacked days

### What appears to be happening
Across nine months, only twice did attention move on more than one platform at the same time.
Both times, several things landed inside the same few days. Every other moment — including four
of the five single releases — moved one platform or none.

### Evidence

**Event A — 16 to 30 June.** Defibrillator (16 Jun, best DSP week of the campaign) + album
announcement (17 Jun) + **TRNSMT, 20 June** + presale opening (23 Jun).

| Signal | Late June | Baseline | Multiple |
|---|---|---|---|
| YouTube channel views | 14,577/day (21–24 Jun), 18,033 (25 Jun), 18,167 (27 Jun), 12,041/day (28 Jun–2 Jul) | ~6,841/day | **2.1–2.7×** |
| Instagram followers | **+99/day** | **−2/day** in April | reversal |
| Spotify followers | +127, +107, +166 on 22/23/27 Jun | 41/day median | **3.1–4.0×** |
| TikTok likes | 618/day | ~351/day | 1.8× |
| Spotify listeners | +10,576 on 22 Jun (weekly gain rank 97/270 by 23 Jun) | — | moderate |

Sustained for roughly twelve days.

**Event B — 25 September to 5 October.** PTS (25 Sep) + Louis Tomlinson teaser Short (28 Sep) +
France24 + Barfly + podcast episode one (2 Oct).

| Signal | PTS window | Baseline | Multiple |
|---|---|---|---|
| TikTok likes | **2,828/day** | ~351/day | **8.1×** |
| TikTok followers | **74/day** | ~10/day | **7.4×** |
| YouTube channel views | 10,246/day (28 Sep–1 Oct), 21,714/day (3–5 Oct) | ~6,841/day | **1.5–3.2×** |
| Spotify followers | 56.8/day | 41/day median | 1.4× |
| Instagram followers | +51/day | −2/day April | reversal |

**Everything else.** Motherlands, Defibrillator-as-a-release, In Motion and August each moved one
platform or none. Motherlands' release-day follower gain was +41 — exactly the median day.

### New or already known?
**New as a pattern.** The team knows late June was a good fortnight. The finding that *stacking*
is the only thing that has ever moved more than one platform at once — and that four single
releases on their own never did — is not something the supplied context shows anyone has tested.

### Alternative explanations
1. **Late June is hopelessly confounded** — four things in a fortnight, and I cannot separate
   TRNSMT from the announcement from the presale from the DSP week. **Correct, and it is the
   finding.** The claim is not "TRNSMT worked". It is "when four things land together, everything
   moves; when one lands alone, it doesn't."
2. **Bigger events are simply bigger.** Partly — but Defibrillator alone had the campaign's best
   editorial week (NMF UK #44, Indie List #41, Apple New in Rock #3) and produced +36 followers on
   release day, below median. Editorial scale by itself did not travel.
3. **Seasonality.** June and late September are not obviously comparable to a flat April.

### The decision it changes
**Album week should be stacked, not sequenced.** The instinct with 18 days left is to spread
assets across them to keep the channel warm. The evidence says that is the pattern that has
produced nothing all year. Both times this campaign moved multiple platforms, it was because a
live/PR moment, a release and a reason-to-act landed inside the same 72 hours.

Concretely: put the podcast episode two, any live/PR moment, and the album-day push on the same
days — not spread across the fortnight.

### Actionable before 23 October
**Yes.** This is a scheduling decision, not a production one.

### Confidence
**Medium.** Two events is a thin base, and late June is confounded. It is strong enough to change
a scheduling choice and not strong enough to spend against on its own.

### Data needed
Nothing further is obtainable before 23 October. Instagram post-level and TikTok video-level data
(not in the Chartmetric artist endpoints available here) would let us test which component of each
stack did the work.

---

## FINDING 3 — PTS shows the campaign is being evaluated before organic behaviour exists, and the acceleration was video-specific

### What appears to be happening
PTS was being worried about on day three. Its daily gain then rose 6× over the following five days
with no second push. And the lift was confined to that one video — not the channel, not the brand.

### Evidence

Daily view gain, PTS official video (clean 10-day series, no gaps):

| Day | 1 | 2 | **3** | 4 | 5 | 6 | 7 | **8** | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Gain | 7,199 | 2,441 | **1,698** | 3,912 | 6,814 | 7,821 | 8,568 | **10,250** | 9,489 | 7,725 |

Day 3 was the trough. The internal read was taken there.

**The decisive test — did anything else on the channel move?** Views per day for every other
tracked campaign asset, 16–25 Sep (before) vs 29 Sep–5 Oct (during):

| Asset | Before | During | Change |
|---|---|---|---|
| Defibrillator lyric | 33 | 45 | +12 |
| In Motion lyric | 30 | 36 | +6 |
| In Motion Live Berlin | 16 | 11 | −5 |
| In Motion stripped | 26 | 24 | −2 |
| Defibrillator acoustic | 3 | 5 | +2 |
| **Four older assets, net** | **108** | **121** | **+13/day** |
| **PTS** | — | **8,445/day** | — |

**Thirteen views a day.** A PR or brand event — France24, the Barfly show, German press — lifts the
catalogue. This did not. The lift was inside one video.

**Which signal moved first.** The acceleration begins 29 September. The Louis Tomlinson teaser
Short published 28 September and is running 175 views/day, the strongest Short of the campaign
against a 1,087 lifetime median. The podcast did not publish until 2 October — day 7 — by which
point PTS was already at +8,568/day. **The podcast did not cause this.**

**Cross-platform corroboration.** Monthly-listener gain in the seven days after each release, the
one genuinely age-matched comparison available:

| Single | Gain | Rank of 270 weeks |
|---|---|---|
| Summer Rain | +30,843 | 18th |
| Motherlands | +17,831 | 43rd |
| **PTS** | **+11,899** | **89th** |
| Defibrillator | +11,142 | 97th |
| In Motion | +3,895 | 167th |

PTS is third of five and 3.1× In Motion — achieved while the 28-day listener window was still
shedding the August peak, a headwind none of the others faced.

### New or already known?
**New.** The internal position on PTS was concern. The quantified version — trough at day 3, 6×
by day 8, 42.4% of the channel's trailing week, catalogue unmoved — reverses it.

### Alternative explanations
1. **PR drove search for the new song specifically**, which would lift PTS and not the catalogue.
   Genuinely possible and I cannot rule it out without traffic sources. Against it: the France24
   and Barfly activity was 28 September, and the curve kept *rising* for five days after. Search
   spikes from a press hit decay inside 48 hours.
2. **The Louis Short seeded it.** Plausible — it published 28 September, one day before the lift.
   But a 2,011-view Short is unlikely to generate 8,445 views/day on another video.
3. **Normal music-video behaviour.** Possible. We have no early-life series for any earlier
   single, so we cannot say whether this shape is typical for this artist. That is the honest gap.

### The decision it changes
Two, and the second is bigger than the campaign.

**Immediate:** do not spend against PTS as a rescue. It is accelerating on its own, holds the
campaign's highest Spotify playlist reach (1,207,306 — 6.9× the next single) and its highest
popularity score (47 vs a 41–43 band). Intervening now risks paying for views it is getting free,
and makes the result unreadable.

**Wider:** the campaign evaluated a release at day three and nearly acted on it. Had the band
spent at day three, the day 4–8 acceleration would have been attributed to the spend. **The
evaluation window is the problem, not the release.** The indicator that mattered was not day-3
volume — it was the *direction of the daily gain* from day 4, and the fact that the catalogue
wasn't moving (which distinguishes organic surfacing from a PR bump).

### Actionable before 23 October
**Yes** for the spend decision. **No** for the Watcher change, but it is worth logging.

### Confidence
**High** that the acceleration is real and video-specific. **Medium** on the cause.

### Data needed
YouTube Studio → PTS → **Traffic sources, daily, 25 Sep–5 Oct**. If Browse/Suggested rises from
day 4 this is settled. One export, five minutes, and it also tells us whether to expect the same
shape on album day.

**Watcher implication worth logging:** the system already stores the per-video daily series that
made this visible. A rule — *flag any campaign video whose daily gain rises for three consecutive
days after day 3 while the rest of the channel stays flat* — would have caught this automatically
on 1 October, four days before anyone looked.

---

# PART 2 — FINDINGS DEMOTED OR WITHDRAWN

### WITHDRAWN — "Live is the acquisition engine"

The v1 deck said August's expansion came from the festival run. **The dates do not support it.**

TRNSMT was **20 June**. Kendal Calling was **31 July**. Y Not was **30 July – 2 August**. The
festival run was over before the August listening gains, by one to three weeks. And the one
festival that *is* inside a multi-signal event — TRNSMT — sits in late June alongside an album
announcement, a presale and the campaign's best DSP week, so it cannot be isolated.

What survives, as a much smaller claim: the strongest live-adjacent window (July, with TRNSMT's
tail, the Kings of Leon support slot, Paris and Amsterdam) has the campaign's **best capture
efficiency — 18 listeners per follower gained, against 61 in August.** That is interesting and it
is not "live works".

One thing worth noting rather than claiming. The 2026 festival setlists are overwhelmingly
catalogue: TRNSMT ran 16 songs of which 3 were from this album; Kendal Calling 12 of which 4. If
live did drive listening, it drove it to *Gloria, Elephants, Glasgow, Seasons, Always* — not to
Joy In Short Moments. We cannot test that without per-track stream history.

### DEMOTED — the Shorts pre-save finding

Still true, and it matters less than I made it look.

**What survives:** 0 of 44 Shorts published since the album announcement carry the album pre-save
link; 22 have no description at all, including the album announcement Short (17 Jun) and the
presale announcement Short (22 Jun). All 44 were under the truncation cap, so this is safe. I also
checked for a pinned call-to-action: across all 44 Shorts there are **37 top-level comments in
total**, 22 Shorts have no comments at all, and **not one comment on any of them contains a link**.
A pinned CTA would be a comment and would surface first in relevance order. There is none.

**Why it is demoted:** those 44 Shorts earned **49,232 views between them** — a median of 1,087
each against 30,200 subscribers. That is almost entirely the existing audience. Prioritised by
volume rather than by count of missing links, this is an operational tidy-up, not a strategic
finding. Fixing it is free and worth doing. It will not move the album.

**What I cannot check:** on-screen text or link stickers inside the Shorts themselves, the channel
About and banner links, and the Linkfire destination behaviour. Those need a human to look.

**Still open, and potentially the version that does matter:** the podcast episode (17,990 views,
1,015 likes, the campaign's highest engagement rate by a wide margin) and the PTS video (70,001
views) both have truncated descriptions in my pull. **If the podcast carries no album route, that
is a single missed conversion opportunity larger than all 44 Shorts combined.** Blocked on the
`?desc=full` fix deploying.

### WITHDRAWN — "587,761 listeners have no standing relationship with the band"

You were right to flag this. Monthly listeners is a 28-day flow; followers is a cumulative stock.
They are not a subset of each other, so the subtraction is not a headcount of individuals, and a
non-follower on Spotify may well follow on Apple, subscribe on YouTube or have the band in their
library.

**The defensible statement:** followers are **24.1% of monthly listeners, down from 35.9% on
1 January**. Listening is expanding substantially faster than any durable-capture metric we can
observe on any platform — Spotify followers +7.5%, Instagram +4.0%, TikTok +2.6%, against monthly
listeners +56.2%. That is a ratio claim about growth rates, which the data supports, rather than a
claim about half a million individuals, which it does not.

---

# PART 3 — WHAT I STILL CANNOT ANSWER

Your question four — *who are the new listeners, where did they come from, what did they consume
next, where exactly does the journey break* — I can answer the last part and not the first three.

| Question | Answerable? | What is missing |
|---|---|---|
| Is listener growth concentrated in particular territories? | **No** | Chartmetric returns a single current city snapshot (London 76,236, Manchester 35,505, Glasgow 24,931, Birmingham 22,540, Sydney 13,824). No time series, so no way to see where August's growth landed. |
| Concentrated around particular songs? | **No** | Track-level stream figures are one reading each, not a series. |
| Editorial, algorithmic, or direct? | **No** | Needs Spotify for Artists source split. This is the gap that matters most. |
| Which playlists? | **No** | Chartmetric's current-playlists endpoint returns 404 for this artist. We can see 1,207,306 of reach on PTS and nothing about its composition. |
| Did they explore the catalogue? | **Partly** | 64.3% of the channel's 30-day views (178,553) are pre-5-September material — but we cannot see which videos or how anyone reached them. YouTube Studio → Content + Traffic Sources, 30 days. |
| Did they become followers/subscribers? | **Yes** | They largely did not. That is Finding 1. |

**Three exports would close most of this**, and all three are held by people in the meeting:
Spotify for Artists audience source split for August; the Spotify playlist-add log; YouTube Studio
traffic sources for PTS and for the 30-day catalogue.

---

# THE QUESTION THIS LEAVES

Not *why aren't we capturing more of that audience* — that assumes we met them.

**The campaign's biggest listening month happened entirely on Spotify and never appeared on a
single surface we control. Before 23 October, do we know how those people found the band — and is
there anything on Spotify itself we can put in front of them?**

If the answer to the first half is no, that export is the most valuable thing anyone can do this
week, and it costs nothing.

---

*Sources: YouTube Data API v3 full catalogue (310 uploads) · Watcher per-video daily series
(15 Sep – 5 Oct, no gaps) · Watcher channel history (169 readings, 18 Apr – 5 Oct, gap-adjusted) ·
Chartmetric artist 349107 (Spotify daily followers and listeners, Instagram, TikTok, track stats) ·
comment scan (218 comments on 15 videos, plus all 44 campaign Shorts) · festival dates from
setlist.fm. All pulled 5 October 2026.*
