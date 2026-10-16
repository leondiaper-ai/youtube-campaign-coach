# underscores × YouTube — audit of the deep dive

Written for external review. You do not need the repository, the presentation
or any VMG context to read this. Every claim the presentation makes is listed
below with its evidence, and every claim it deliberately does **not** make is
listed with the reason.

**Subject:** artist channel opportunity presentation at `/underscores`
**Date of data:** 16 October 2026 · **Channel:** `@underscores`
**Audience of the presentation:** artist management and YouTube UK

---

## 1. What the presentation is, and the constraint it works inside

Twelve slides arguing that underscores is a strong artist-development
opportunity for YouTube, with a separate Analysis panel holding the method.

**It uses only the public YouTube Data API v3.** There is no YouTube Studio
access. That means **no** impressions, click-through, retention, average view
duration, traffic sources, unique viewers, returning viewers, territory
splits or subscriber-gain-by-video. Five analytics requests are listed in the
presentation instead of being estimated.

This single constraint explains most of the limitations below. A reviewer's
most useful question is probably: *does the presentation ever quietly behave
as though it has analytics it does not have?*

### Data actually read

| Source | Detail |
|---|---|
| Channel + videos | All **102 public uploads**, uploads playlist paged to exhaustion, uncapped. `videos.list` for per-video statistics. |
| Descriptions | Re-read with `desc=full` (5,000 chars) for authorship claims. |
| Comments | **160**, via `commentThreads` — 40 each from four singles. |
| Growth | **28 days** of VMG channel snapshots (not public API history). |
| Public research | Wikipedia (biography, pronouns, discography); YouTube Official Blog, 16 Sep 2026 (Foundry). |
| Internal | VMG email thread 5–15 Oct 2026 — tour dates, Spotify figures, proposed activity. |

---

## 2. The claims, and what backs each one

### Headline claims

| Claim | Evidence | Confidence |
|---|---|---|
| 145K subscribers, 36.8M lifetime views, 102 public uploads | API, direct read | **High** — though subscriber count is a rounded public display |
| **+798,252 channel views in 7 days** | 28-day snapshot series. The lifetime view counter is exact, so the delta is reliable | **High** |
| **Zero uploads in that 30-day window** | Newest upload 28 Aug 2026 | **High** |
| Subscriber display moved ~135K → 145K over 30 days | Snapshot series | **Low precision** — public counts are rounded; the true figure could be ~5K–15K. Labelled as coarse in both deck and Analysis |
| All four current-era singles cleared 700K | Lifetime view counts | **High** |
| The Peace: 1,373,924 views, 3,089 comments, 65 days | Direct read | **High** |
| A-side production stream: 136,839 views, 3h 22m | Direct read | **High** |
| Do It: six assets in 25 days, nine across the campaign | Publication dates, full list in Analysis | **High** |
| Topic channel: 13,797,333 views, 549 subscribers | Direct read of a separate channel | **High** for the figures; see §4 for what is *not* inferred from them |

### Authorship claims (new, and the weakest-tested area)

All drawn from her own public video descriptions:

| Claim | Source |
|---|---|
| Credited as **creative director** on *The Peace* | Description lists "creative director / underscores" alongside director Ayodeji, production company bigkid, dp Shane Bagwell |
| Makes her own artwork | "Artwork by underscores" on two current-era uploads |
| Opens with an accessibility note | "This video contains flashing lights and fast cuts." |
| *U* written on the I-10 and I-20 | *Unlimited Love* description names Chicago, Phoenix, Austin, Houston, Seattle, "on the I–10, and on the I–20" |
| Chapters the 3.4-hour stream by song | Five timestamps in each stream description |
| Three eras, three title grammars | Observed across all 102 titles |
| Two *'YouTube Music' billboard* Shorts, Sept 2023 | Titles in catalogue |

**These are descriptive observations about how the channel is authored. They
are not performance claims.** The presentation says so. A reviewer might
reasonably ask whether a deck aimed at a platform partner should lean on
unfalsifiable "personality" material at all — that is a fair challenge and I
have no measurement to defend it with.

---

## 3. Claims deliberately **not** made

These were in an earlier draft and were removed after an accuracy pass. They
are listed because they are the most likely places for an error to return.

| Not claimed | Why |
|---|---|
| The 13.5M gap between 36.8M lifetime and 23.3M summed public uploads is deleted/private/unlisted video | The cause is **not in public data**. No figure is expressed as a share of lifetime views |
| The Topic channel's 549 subscribers indicate an OAC configuration fault | Topic channels are auto-generated and behave differently. The subscriber count is not a signal. **No technical gap is asserted without verification** |
| Shorts drive viewers to the video | Publication order is a **sequence, not a funnel**. Traffic sources would be needed |
| The long production stream proves long viewing sessions | **Length and like rate do not indicate retention** |
| Shorts outperform long-form (or vice versa) | View counts are not comparable across formats; YouTube changed Shorts counting in March 2025 |
| Extra versions of a song split attention | Asserted in an earlier draft with no evidence |
| Crew, footage, rights or budget are available for recommended filming | Not assumed anywhere |
| The November tour is an opportunity management has failed to exploit | Framed as an opportunity, not a failure |
| Any pace comparison between singles | **Not age-matched.** The Peace has had 65 days, Music 476. No per-video daily history exists far enough back |
| Sold-out shows mean those buyers watch the channel | Live demand ≠ YouTube audience. Stated explicitly |

---

## 4. Known weaknesses in the analysis

1. **The comment sample is relevance-ordered, n=160.** Not random; it
   over-represents comments with likes and replies. Four videos only, all
   current-era. Themes were coded by reading, not by any classifier.
   The low "live/touring" count (6 of 160) is **not** evidence of weak tour
   interest — the UK shows had not happened and relevance ordering buries
   recent comments.
2. **Third-party and fan uploads were not mapped.** No systematic search was
   run. The ecosystem picture is therefore incomplete, and the presentation
   says so rather than implying the four named surfaces are all of them.
3. **Growth rests on 28 days.** Short series, and it includes a period with no
   uploads — which is what makes it interesting, but also means it describes a
   dormant channel rather than a campaign.
4. **One slide's lead is a judgement call.** Slide 2 leads on "growing without
   publishing" rather than on scale. The +798K figure is real, but choosing it
   as the opening frame is an editorial decision, not a finding.
5. **Lifetime totals dominate.** Most per-video figures are lifetime, which
   favours older uploads. The presentation labels them, but a reader skimming
   could still compare a 2021 video to a 2026 one unfairly.
6. **Internal campaign inputs are unverified.** Tour dates and sold-out status
   are as reported on 14 Oct 2026 by a VMG email thread. Bristol was the one
   date not sold out. Spotify figures concern *"U"* specifically, not the
   catalogue, and describe a different platform.
7. **BBC Sound of 2027 is absent.** The internal thread referenced it and
   linked a pundits page. That page was **inaccessible**, so the year, names
   and roles could not be verified. No individual is named and no endorsement
   is implied. It was dropped from the shareable deck entirely.
8. **Imagery is YouTube thumbnails only.** No press shots or artwork outside
   the platform were available, which limits how much of her visual world the
   presentation can show — a real weakness given it argues she authors it.

---

## 5. Where the recommendations come from

Three opportunities, each traced to a figure rather than to an absent format:

| Opportunity | Evidence behind it |
|---|---|
| Extend the process strand | A-side stream 136,839 views, chaptered by song; production is the most-discussed theme in the comment sample (9 of 160) |
| Give the catalogue a front door | +798,252 views in 7 days with nothing published; a separate Topic surface carrying 13.8M |
| Keep releases open longer | The Yves remix reopened Do It ten weeks after release and drew 726,794 |

**Deliberately not recommended:** new lyric videos (18 already exist, median
111,637, and the current record has track-level audio uploads), and a
visualiser for The Peace. The rule applied was *do not turn every absent
format into a recommendation*.

---

## 6. Questions worth an outside view

1. **Is the authorship material (§2) appropriate evidence for a platform
   partner conversation, or is it decoration?** It is unfalsifiable by
   construction — she really is credited as creative director, but that fact
   predicts nothing measurable.
2. **Does leading slide 2 on "growing without publishing" overstate a 28-day
   window?** The figure is exact; the framing is a choice.
3. The presentation avoids every retention and conversion inference it cannot
   support, which leaves it describing **what exists** rather than **what
   works**. Is that honest or merely uninformative for the reader?
4. **Is the Topic channel treated correctly?** It is reported as a separate
   surface with 13.8M views and no inference drawn. An alternative reading is
   that 13.8M on a passive surface is itself the headline opportunity.
5. The deck recommends capturing the November shows. **With no UK viewing
   data, is that justified** — or is it an assumption that live demand
   transfers to YouTube?
6. What else should a presentation like this contain that is missing here?

---

## 7. Verification state

| Item | How checked |
|---|---|
| 102 uploads, uncapped | Playlist paged to exhaustion; `capped: false` |
| View and comment counts | Direct `videos.list` read, 16 Oct 2026 |
| Authorship quotes | `desc=full` descriptions, read verbatim |
| Foundry membership | YouTube Official Blog, 16 Sep 2026, artist named |
| Pronouns and solo status | Wikipedia; she/her, solo artist, not a band |
| Every video ID and link | Resolved from the API; one invented ID was caught and replaced during the build |
| 12 slides, no overflow in presentation mode | Every slide measured at presentation size |
| Thumbnails | All resolve; zero broken |

**All figures read 16 October 2026.** Public API data moves — the growth
numbers in particular should be re-read before the presentation is given, and
if the channel publishes in the meantime the "growing without publishing"
framing stops being true.
