# Steven Wilson × YouTube — audit pack

**For independent review.** Read 20 October 2026. This is the raw material behind the deck
at `/stevenwilson` (13 slides plus an Analysis sheet). The deck is a constructive channel
deep dive for the label, built around the current album campaign. Its stated takeaway:
*here's what fans already respond to, and here are a few thoughtful ways to deepen that
relationship and sustain the album campaign.*

You are being asked to **try to break this**, not to confirm it. The most useful thing you
can do is take a claim from §5, trace it to the rows in §4, and say where the claim outruns
the evidence. If anything reads as generic growth advice, or as implying the channel needs
fixing, say so: the brief asked for neither.

---

## 1. The brief, in short

- Help the label understand what works on Steven's channel and how to build on an engaged
  fan base around the current album campaign. Encouraging, specific, grounded in evidence.
- Identify formats that consistently resonate. Use named examples with views, dates and
  context; compare videos at similar ages; look beyond the biggest videos.
- Use comments as qualitative illustration, not research.
- Separate public data from anything needing YouTube Studio. Do not infer organic traffic,
  retention or returning viewers from public views and likes.
- Start from **On Chapel Slope**; verify album title, release date and campaign stage.
- Assess four possibilities the team already suggested to the label: making the song;
  making the video; a performance/session version (Village Hall Session as precedent); a
  lyric video or visualiser. Prioritise a few. Don't assume footage exists, or that
  supporting uploads drive views to the main video.
- A short section on Afterparty, a YouTube Music Station, a message to Top Fans, and
  Community posts. Check functionality and eligibility; mark partner-manager confirmations.
- Finish with three realistic next steps, separating "assemble now" from "needs filming".

## 2. Provenance

| | |
|---|---|
| Channel | `@StevenWilsonHQ` — `UC-9mlH6az1Q_XUP3fw1N4Fg`, created 25 June 2012, Official Artist Channel |
| Uploads | **295** retrieved (the channel shows 281 public videos; the API returns all 295 including Shorts/legacy), YouTube Data API v3 via the project's `/api/full-catalogue`, 20 Oct 2026 09:26 UTC |
| Public counters | 319,000 subscribers (rounded by YouTube); lifetime views 97,597,940 |
| Per-video daily series | The project's Watcher (`/api/video-series`): daily public views/likes/comments. Campaign uploads from 15 Sep 2026; On Chapel Slope from its Premiere day |
| Channel-level series | Watcher channel snapshots since 22 Apr 2026 — **not used**: the lifetime counter only updates intermittently (identical 97,597,940 from 7 to 20 Oct) |
| Comments | `/api/comment-scan`, 40 top-level comments per video ordered by relevance, 13 videos, 20 Oct 2026 |
| Playlists / Home | `/api/channel-shelf`: 18 public playlists, 15 Home sections |
| Manual surfaces | Posts tab and requiemforavillage.com viewed signed-out in a browser, 20 Oct 2026 |
| External | Louder (Prog) articles 8 Sep, 11 Sep, 18 Sep, 2 Oct 2026; YouTube Help; YouTube for Artists; trade press for Stations / Top Fans |
| YouTube Studio | **None.** No impressions, CTR, retention, watch time, traffic sources, returning viewers, subscribers gained, Top Fans counts |

### Campaign facts verified before writing

- **The album is *Requiem For A Village*** (ninth studio album, Fiction Records), out
  **6 November 2026**, 12 tracks. **On Chapel Slope is the second single** (track 6) — the
  brief treated it as the starting point, and the deck does, inside the album campaign.
- **Single 1:** "Steven Wilson - Requiem for a Village (The Village Hall Sessions)",
  Premiere 11 Sep 2026 10:00 UTC. Credits: Steven (vocals, guitars, synths, piano), Randy
  McStine (guitars, backing vocals), Russell Holzman (drums). Recorded and filmed at
  Sensible Music; directed by Miles Skarin, produced by Crystal Spotlight.
- **Single 2:** "Steven Wilson - On Chapel Slope (Official Video)", Premiere 2 Oct 2026
  10:00 UTC; dir. Mike Bennion, Joyrider. Credits list "Photographer / B-Roll: Miles Skarin".
- **Royal Albert Hall** 28 & 29 Oct 2026 with the Parallax Orchestra and choir — "my only
  live shows of the year" (channel post).
- Narration by David Tennant, written by Andy Partridge (who also wrote some lyrics);
  Katherine Priddy also features (Louder).
- The website requiemforavillage.com is a mock parish-council site: scrolling notice
  ticker, "observances" mapped to release dates (11 Sep, 2 Oct), Autumn Festival 6 Nov,
  a guestbook ("The birds and the stones thank you for your guestbook entries").
- **Stage at writing (20 Oct):** two singles out, 17 days to release, RAH in between.

## 3. Rules the deck follows

1. Formats are compared **within one album campaign** (similar ages), or at **matched days
   since Premiere** using the Watcher. Lifetime totals across eras appear as examples only.
2. Public views are not watch time; likes are not loyalty; nothing infers traffic sources,
   retention or returning viewers.
3. No supporting upload is said to send views to a main video.
4. No footage is assumed to exist; each idea states what it would need.
5. YouTube features: functionality as documented; account eligibility marked "confirm".
6. Every example is on Steven's own channel; no third-party channels are added in.

Classification is **by title** (I did not watch the videos). Shorts use the API `isShort`
flag.

## 4. The rows

### 4.1 Current campaign uploads (lifetime views, 20 Oct 2026)

| Date | ID | Upload | Type | Views | Likes | Comments |
|---|---|---|---|---:|---:|---:|
| 8 Sep | UFEGih4iCFs | The village is alive. (trailer) | Short, 56s | 73,180 | 2,862 | 345 |
| 11 Sep | RPZ8Xy1hO9s | Requiem for a Village (The Village Hall Sessions) | Premiere, 8:09 | 706,482 | 20,612 | 1,966 |
| 12 Sep | Bi9bvwuS4Vk | A glimpse into the first Village Hall Session… | Short | 45,610 | 1,718 | 78 |
| 29 Sep | my-LfLeyjRE | …talk to Anil Prasad @ Innerviews about the themes… | Short | 20,050 | 734 | 49 |
| 29 Sep | T0F2cGqU0UE | The First October Observance is elsewhere… | Short | 7,986 | 214 | 7 |
| 2 Oct | kaMG5ef7G4w | On Chapel Slope (Official Video) | Premiere, 6:04 | 348,118 | 9,858 | 966 |
| 2 Oct | k-6JopcXrf8 | You'll stay with us, as stones, evermore… | Short | 11,233 | 506 | 19 |

The "Requiem for a Village" playlist holds 2 videos.

### 4.2 Watcher daily series — the two singles (day = calendar days since Premiere date)

Village Hall Session (first reading 15 Sep = day 4):
`d4 409,343 · d5 452,829 · d6 485,786 · d7 511,864 · d8 533,108 · d9 540,237 · d10 550,339 ·
d11 558,157 · d12 567,380 · d13 575,211 · d14 582,779 · d15 591,596 · d16 600,392 ·
d17 607,857 · d18 615,107 · d19 620,354 · d20 625,823 · d21 631,644 · d22 640,511 ·
d23 647,137 · d24 652,348 · d25 657,024 · d26 661,397 · d27 665,711 · d28 670,173 ·
d29 674,527 · d30 678,267 · d31 681,747 · d32 684,806 · d33 687,619 · d34 690,627 ·
d35 693,740 · d36 697,209 · d37 700,305 · d38 703,321 · d39 706,224`

On Chapel Slope (reading of 2 Oct = 8 views, pre-Premiere):
`d1 152,530 · d2 201,163 · d3 231,517 · d4 254,427 · d5 271,957 · d6 285,007 · d7 295,222 ·
d8 303,489 · d9 310,217 · d10 315,520 · d11 319,999 · d12 324,331 · d13 328,818 ·
d14 333,000 · d15 337,340 · d16 341,239 · d17 344,501 · d18 347,771`

Derived: last 7 days — session +21,418 (≈3,060/day); On Chapel Slope +23,440 (≈3,350/day).
Session day 12→18 ≈7,955/day; On Chapel Slope day 12→18 ≈3,907/day. Likes/views 2.9% vs
2.8%. The session's daily gain rose on 3 Oct (+8,867 vs +5,821 the day before), the day
after OCS's Premiere — noted, not interpreted. The reading time of day is not fixed.

### 4.3 Official videos vs sessions, The Future Bites era (Sep 2020 – Mar 2021)

Official videos (median 622,477): KING GHOST 892,912 (29 Oct 2020) · PERSONAL SHOPPER
655,798 · SELF 622,475 · EMINENT SLEAZE 405,932 · MAN OF THE PEOPLE (Official Lyric Video)
352,058.

The Future Bites Sessions (n=8, median 190,933): Voyage 34 389,677 · Drown With Me 285,047
· Last Chance to Evacuate Planet Earth… 221,700 · 12 Things I Forgot 191,333 · Collapse The
Light Into Earth 190,533 · Half-Light 149,554 · Significant Other 148,752 · KING GHOST
119,655 (31 Oct 2020, two days after its official video). The playlist is listed as 9
items; 8 session uploads were identified by title.

### 4.4 The Harmony Codex official videos (Aug–Nov 2023), median 562,449

What Life Brings 822,243 · Rock Bottom (with Ninet Tayeb) 631,351 · Impossible Tightrope
576,346 · Economies of Scale 548,552 · Beautiful Scarecrow 428,681 · The Harmony Codex
356,733.

### 4.5 Every Short in The Harmony Codex window (15 Aug – 20 Dec 2023), n=27

| Date | Title (truncated) | Views | My group |
|---|---|---:|---|
| 20 Dec | What are the best Christmas gifts for music lovers? | 13,062 | excluded (gift guide) |
| 14 Dec | I made a Christmas song with AI | 28,645 | on his music |
| 11 Dec | Not every track takes months to craft… | 22,145 | on his music |
| 29 Nov | The making of 'The Harmony Codex' with Miles Skarin… | 4,080 | behind the video |
| 24 Nov | Economies of Scale (Manic Street Preachers Remix) is out now! | 2,979 | announcement |
| 21 Nov | Economies of Scale – MSP Remix. Out Friday. | 4,286 | announcement |
| 14 Nov | How I turned my book into a record… | 11,092 | on his music |
| 10 Nov | How the Beautiful Scarecrow music video came to life… | 4,376 | behind the video |
| 8 Nov | The 'Beautiful Scarecrow' video is out now. | 3,545 | announcement |
| 4 Nov | Beautiful Scarecrow – 8th November 2023 | 6,602 | announcement |
| 30 Oct | A tour of my home studio, where I created… | 97,442 | on his music |
| 25 Oct | What other tracks would you like to know more about…? (drums) | 138,080 | on his music |
| 11 Oct | Revealing what "the Object" stands for… | 23,563 | on his music |
| 9 Oct | …how I created the foundations of 'The Harmony Codex' | 50,870 | on his music |
| 3 Oct | The Harmony Codex – Out Now | 5,540 | announcement |
| 1 Oct | A closer look at The Harmony Codex on 2LP vinyl | 13,521 | announcement |
| 29 Sep | 'The Harmony Codex' is out now | 4,538 | announcement |
| 28 Sep | …it's a beautiful thing. Out tomorrow. Pre-order… | 14,081 | announcement |
| 28 Sep | …an exclusive teaser of one of my favourite tracks | 17,711 | announcement |
| 26 Sep | How I wrote 'What Life Brings'… | 12,379 | on his music |
| 22 Sep | Welcome to the set of 'What Life Brings'… | 10,061 | behind the video |
| 15 Sep | What Life Brings. Tuesday. | 16,336 | announcement |
| 8 Sep | Rock Bottom. Steven Wilson & Ninet Tayeb. Tuesday. | 23,387 | announcement |
| 2 Sep | Behind The Song: Economies of Scale | 31,100 | on his music |
| 25 Aug | Economies of Scale. Tuesday. | 14,080 | announcement |
| 24 Aug | #TheHarmonyCodex | 10,003 | announcement |
| 15 Aug | #TheHarmonyCodex | 10,008 | announcement |

Medians: on his music (n=9) **28,645**; announcements & teasers (n=14) **10,006**; behind
the video (n=3) **4,376**.

Later Shorts cited: Records I've worked on that may surprise you (Jun 2024) 322,252 ·
A mind blowing fact… (Jan 2025) 275,170 · Playing bass on a new song! (Aug 2025) 212,646 ·
Looking back at The Raven… (Apr 2024) 125,197 · Three unusual instruments in my studio
(Mar 2024) 115,167 · The ARP 2600… (Mar 2025) 101,821. All 113 Shorts Jan 2024 – Aug 2026:
median ≈17K.

### 4.6 Home Invasion: In Concert at the Royal Albert Hall clips (median 414,244)

Pariah 1,439,902 (Sep 2018) · Ancestral 775,463 (May 2020) · The Raven That Refused To Sing
509,782 (Feb 2019) · Home Invasion / Regret #9 318,705 (Dec 2024, 4K reissue) · Song of I
225,682 (Oct 2018) · Vermillioncore 222,271 (Nov 2018).

### 4.7 Longer films and conversations

The Overview in India (mini doc, 22 min, Apr 2026) 95,957 · Ask Me Nicely: The Making of
To The Bone (85 min, Aug 2024) 50,586 · The Overview Roundtable (34 min, Apr 2025) 20,475 ·
The Making of The Harmony Codex Video (5 min, Nov 2023) 21,401 · To The Bone (Track-by-Track)
(14 min, Aug 2017) 72,718 · How The Artwork for The Overview Was Made parts 1–3 (Apr 2025)
7,625 / 4,187 / 5,206 · A Conversation with Steven Wilson (2017) 67,239 · THE FUTURE BITES:
A Conversation (2020) 58,846 · Limited Edition of One – In Conversation with Mick Wall
(2022) 18,786 · Insurgentes documentary (2022 upload of 2008 film) 80,858.
Older studio series: Steven Wilson in LA parts 1–4 (2012) 167K–405K; at AIR Studios parts
1–3 (2014) 100K–243K.

### 4.8 Lyric / listening videos

Refuge (Lyric Video, Aug 2017) 2,547,338 · Pariah (Listening Video, May 2017) 779,585 ·
Permanating (Listening Video, Jun 2017) 437,258 · MAN OF THE PEOPLE (Official Lyric Video,
Jan 2021) 352,058.

### 4.9 Other cited

Objects Outlive Us: Russell Holzman drum playthrough (Jun 2025) 69,652 · The Overview:
Perspective (Official Video, Jul 2025) 89,091 · Objects Outlive Us: Objects: Meanwhile
(Mar 2025) 405,571.

### 4.10 Comments used on slide 7 (likes in brackets)

- Village Hall Session: "Russell Holzman - what a formidable drummer." (681)
- Records I've worked on (Short): "This new open Steven presence online is highly appreciated." (928)
- Making of To The Bone: "I really love that artists share these moments of the creation process…" (16)
- On Chapel Slope: "Great to finally see such an upbeat and happy video from Steven Wilson." (964)
- On Chapel Slope: "Came here from the village parish circular." (68)
- Voyage 34 (Sessions): "…Hope he does more of these. Radioactive Toy please!" (218)

Comments read on: RPZ8Xy1hO9s, kaMG5ef7G4w, GwfGi_Qomc8, I1Ql5nVY4Ao, 79HocZcJxoA,
kCM3iQ6wJgE, pVUzCTSiSkE, GPfcL5K7VZ8, my-LfLeyjRE, Bi9bvwuS4Vk, dlHxl5Q3pIA, tL0tSluwHpE,
azLnNKC1NEU. Quotes were selected by me to illustrate themes.

### 4.11 Community posts observed (Posts tab, 20 Oct 2026)

Trailer post (~1 month ago, 153 likes) · Headphone Dust store (~6 months, 555) · **photo
call-out** for special-edition artwork — amateur village photos, deadline 3 Apr 2026,
credited, free deluxe edition if used (~6 months, 1.2K likes, 29 comments) · Hand. Cannot.
Erase. Definitive Digital Edition (~6 months, 1.1K) · Royal Albert Hall announcement
(~8 months, 1.2K) · earlier posts on Substack, SiriusXM show.

### 4.12 YouTube features — what was found

| Feature | Source | What it says | Deck status |
|---|---|---|---|
| Afterparty | support.google.com/youtube/answer/10184580; artists.youtube/resources/after-party | Premium-exclusive live stream with video feed and chat, after a Premiere or live stream; markets where Premium launched; "reach out to your YouTube partner representative"; "will be available more broadly soon" | Confirm with partner manager |
| Top Fans exclusive videos | support.google.com/youtube/answer/18736733 (Release Strategy); /18735618 (Music Fandom) | Set Visibility to "Top Fans" at upload; "only available to artists with a minimum number of top fans" | Confirm availability. The "no separate DM tool" line comes from third-party write-ups (Symphonic, Tubefilter), not YouTube |
| Stations | **No YouTube help page found.** RouteNote, Music Ally (24 Aug 2026), Android Authority, StreamPush | 24/7 stream built from a channel's own videos, with live chat; invite-only test; extended 21 Aug 2026 to creators, podcasts and "select new music artists" | Confirm with partner manager; influences can't sit inside a Station of own videos |
| Community posts | Music Fandom help page | Posts, polls, reply to a comment with a Short | Available (posts exist on the channel) |
| Collaborations | support.google.com/youtube/answer/16554898 | Up to 10 creators credited on a video | Cited for the session players |

## 5. Every claim on the deck, slide by slide

1. **Cover.** "Welcome to the village." Ticker restates the observance dates (11 Sep, 2 Oct,
   RAH 28–29 Oct, 6 Nov). Image: On Chapel Slope thumbnail.
2. **"Two singles in, seventeen days to the album."** Timeline of §4.1 plus RAH and release.
3. **"Official videos lead. Performance and Steven's own voice reliably follow."** Five
   panels: Harmony Codex official videos median 562K (§4.4); Future Bites Sessions median
   191K, "none below 120K" (§4.3); RAH clips median 414K (§4.6); Shorts on his music median
   29K, "almost three times" announcements 10K (§4.5); longer films 20–96K (§4.7).
4. **"Both singles found their audience — and both are still being found."** Chart of §4.2;
   512K vs 295K at day 7; 615K vs 348K at day 18; ≈3K a day each over the last week. Caveat
   on slide: the session carried the album announcement and title track.
5. **"Steven and the band, playing the music."** Session 706K "the campaign's most-viewed
   upload"; Voyage 34 session 390K; Pariah RAH 1.44M; "the first Village Hall Session".
6. **"When Steven explains the music, Shorts travel further."** §4.5 medians; later Shorts
   322K and 213K "among the channel's most-viewed Shorts".
7. **"Fans talk about the playing, the story — and Steven being open."** §4.10.
8. **"The evidence is strongest for performance and for Steven's own voice."** Scorecard:
   session (3/3), making the song (3/3, "above all in Shorts"), lyric/visualiser (2/3,
   catalogue precedent), making the video (1/3, "keep it short").
9. **Priority 1 — "More from the village hall."** If further sessions were recorded,
   release one around the album and gather in a playlist; credit Randy McStine and Russell
   Holzman via Collaborations; if RAH is filmed, a single song. "Confirm what was filmed."
10. **Priority 2 — "Steven, explaining how the village was built."** One song/sound per
    Short; cut from existing material if it exists; one longer track-by-track after release.
11. **Priority 3 — "A visualiser that takes fans further into the village."** Built from
    the parish world; fan-submitted photos *where permissions allow*; keep making-of light.
12. **Bringing fans closer.** Afterparty after a release-week Premiere; Station of his own
    catalogue; Top Fans message before 6 Nov; Community parish notices, questions answered
    by Short replies, a poll. Status line on each.
13. **Three next steps.** (01, assemble now) Shorts of Steven explaining the songs + a
    Community question call; (02, assemble now with partner manager) release-week Top Fans
    message → Premiere → Afterparty, if a 6 Nov Premiere is planned; ask about Station;
    fill the Requiem playlist; (03, needs filming) the next Village Hall Session; confirm
    RAH filming; visualiser needs design time.

## 6. The places I think this is weakest

1. **Slide 4 is not a fair race.** The session was the album announcement, the title track
   and the first new music after a teaser campaign; On Chapel Slope was a second single.
   The slide says so, but a reader may still take "512K vs 295K" as a format verdict.
2. **"Performance is the strongest thread" leans on one 2026 video.** Historically, sessions
   (median 191K) sat well below official videos of the same era (622K). Sessions are strong
   *as supporting content*; only the Village Hall Session — which *was* the single — beat a
   video. Is slide 5's framing fair?
3. **RAH median mixes ages** (2018–2024 uploads of one concert film). Pariah's 1.44M may
   reflect its age and the song's popularity rather than the format.
4. **Shorts groups are mine, from titles.** n=9 vs n=14, one campaign. The "drums" Short
   (138K) and studio tour (97K) pull the top; the median is less sensitive, but the "≈3×"
   is a small-sample ratio. YouTube changed how Shorts views are counted from 31 Mar 2025;
   all the compared Shorts are from 2023, but the 2024–25 examples are not strictly comparable.
5. **Lyric-video evidence is old.** Refuge's 2.5M is from 2017; the only recent lyric video
   is 2021. Rated 2/3 — is that generous?
6. **"Making the song" long-form evidence is mixed** (To The Bone doc 50K at 26 months;
   track-by-track 73K in 2017). The deck confines the strong rating to Shorts. Check that the
   slide wording keeps to that.
7. **Existence of footage is unknown** throughout: further Village Hall Sessions, RAH
   filming, longer Innerviews footage (Innerviews is primarily a written outlet), OCS B-roll.
   The deck says "confirm" — does it still read as if these exist?
8. **Stations rests on trade press**, not a YouTube help page; the "invite-only" and
   "select new music artists" lines are secondhand.
9. **Top Fans "no separate DM tool"** is from third-party write-ups.
10. **Comments are hand-picked** from a relevance-ordered sample; like counts on a comment
    are not agreement counts.
11. **The fan-photo visualiser idea** depends on the terms fans accepted (credit + free
    deluxe if used, no remuneration) — reuse in video may not be covered.
12. **Channel count discrepancy:** API returned 295 uploads; channel page shows 281 public
    videos / 295 videos depending on surface. Nothing depends on it, but flag if it matters.

## 7. Things deliberately not claimed

- That any Short, session or post sent viewers to a main video, or will.
- Watch time, retention, traffic sources, returning viewers, subscriber gains.
- That further sessions, RAH footage, BTS or interview footage exist.
- That Afterparty, Stations or Top Fans videos are available to this channel.
- Any forecast for any recommendation.
- Channel growth (the counter is stale) or audience demographics.

## 8. Questions for the reviewer, in priority order

1. Trace slide 3 and slide 5 against §4.3–4.6. Does "Performance and Steven's own voice
   reliably follow" hold, or should sessions be framed more modestly against official videos?
2. Is slide 4 worth keeping, given the confound in §6.1? Would day-matched gains (≈3K/day
   each) be the safer headline?
3. Re-run §4.5 with your own grouping of the 27 Shorts. Does the "on his music" group still
   come out at roughly 3× announcements?
4. Are the four ideas rated in the right order on slide 8? In particular, is lyric/visualiser
   over-rated on 2017 evidence, and is "making the video" under-rated given fans are actively
   decoding On Chapel Slope in the comments?
5. Check §4.12 against current YouTube documentation: Afterparty set-up route, Top Fans
   minimum, Stations availability. Is anything stated more firmly than the sources allow?
6. Do the three next steps follow from the strongest evidence and from assets that are
   known to exist? Is anything in "assemble now" actually dependent on new filming?
7. Tone: does any slide read as implying the channel is under-performing or needs fixing?
8. What's missing? E.g. Premieres as a format (both singles premiered), the Album Years /
   SiriusXM audience, Headphone Dust / Atmos content, or catalogue anniversaries.
