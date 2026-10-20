# Tom A. Smith × YouTube — audit pack

**For independent review.** Read 20 October 2026. This is the raw material behind the deck
at `/tomasmith`: 13 slides plus an appendix, for the UK commercial team and Fiction Records.

The deck is a channel deep dive and album-preparation plan for a developing artist. Its main
story: Tom has a distinctive visual identity, encouraging results around several songs, and
promising performance-led Shorts. The plan builds on those strengths without overcommitting.

You are being asked to **try to break this**, not to confirm it. Take a claim from §5, trace
it to the rows in §4, and say where it outruns the evidence. Flag anything that reads as
generic advice, as overcommitting a small team, or as a judgement on the creative work.

---

## 1. The brief, in short

- Confirm his identity, and don't confuse him with similarly named artists.
- Establish channel size, activity and trends; album details if confirmed; his identity;
  and the assets that already exist.
- Find what works: strongest songs and uploads, consistent formats, recent results against
  his own normal, personality and musicianship content, whether older uploads still attract
  views, gaps worth testing.
- Account for upload age, and never present lifetime views divided by days as momentum.
- Read comments as qualitative insight. Don't infer retention, CTR, returning viewers,
  subscriber conversion or paid versus organic performance from public data.
- Assess the youtube-insights preview, and what Studio-based analysis would change.
- Give 3–5 peer examples from the Watcher, with a realistic tactic to borrow from each.
- Build a relative album rollout (no date is confirmed) with a core plan and optional extras.
- Audit the basics, and verify feature eligibility from official YouTube guidance.
- Set progress measures against his own baseline, with no invented targets.
- End with five prioritised actions and the missing inputs.

**Follow-up instructions from the team, applied in this version:**
- Lifetime medians are context, not 28-day targets.
- Paid support is a neutral question: like rates prove nothing.
- Comments can't establish audience age.
- Recheck the descriptions and captions findings.
- Establish existing footage first, then ONE capture (a session OR a filmed tour show),
  with any more filming conditional on resources and response.
- Peer examples illustrate single ideas, not requirements.
- Don't call the channel "COLD".
- Add album-era world-building.
- Replace Jamie Webster with Freak Slug.
- Give each peer a distinct idea.

## 2. Provenance

| | |
|---|---|
| Channel | `@tomasmithmusic` — `UCsSIZ1VDZjJjwS5qGlIutnw`, created 2006, Fiction Records artist |
| Uploads | **106**, retrieved with full descriptions, YouTube Data API v3 via `/api/full-catalogue`, 20 Oct 2026 |
| Public counters | 6,270 subscribers (rounded), 743,991 lifetime views |
| Daily per-video readings | The project's `/api/video-series`: **60 of 106 uploads, from 19 Sep 2026 only** (32 days). There is no release-week history for any past single |
| Channel views counter | Daily snapshots from 9 Jun 2026 (130 readings). The counter updates in steps |
| Subscribers over time | Only the last fortnight (6,240 → 6,270) through the routes checked |
| Comments | `/api/comment-scan`: 40 top-level comments per video by relevance, on 15 videos (~450 read) |
| Channel surfaces | `/api/channel-shelf` (6 public playlists, 12 Home sections); Home, Releases and Posts tabs viewed signed out |
| Peers | Watcher list (`/api/weekly-pulse`, 262 channels), filtered to 1.5K–80K subscribers (81), then catalogues pulled for 8 candidates |
| youtube-insights | Live preview page plus its repo (`leondiaper-ai/youtube-insights`): a static data file and a Next.js page, with no Studio connection |
| Source code | Neither repo has any YouTube Analytics or Studio integration |
| Studio | **None.** No retention, CTR, traffic sources, returning viewers, subscribers per video, geography or paid/organic split |

### Identity and release facts

- Tom A. Smith: songwriter from Sunderland (21 in July 2025, per Dork). Signed to Fiction
  Records in July 2025. **Not** Tom Smith of Editors.
- Mentor and co-producer: Barry Hyde (The Futureheads). He co-wrote "Like You Do" with
  Miles Kane. Rowetta guests on "Put On A Record Tommy".
- Visuals are mostly by Katie Anderson (Katie Anderson Promo). "What" was made by Crew Gal
  Creative House. There's an alternative "Fashion" video with Andy Dawson.
- *Say What You Want* EP: 26 Sep 2025.
- *Put On A Record Tommy* EP: May 2026. The deluxe edition (12 tracks) came out
  9 Sep 2026, adding "Am I Ever Gonna Be A Rockstar?", Talking Heads' "Life During Wartime"
  and an extended title track. The EP's concept is "Tommy's Dance Place", a fictional club.
- **The debut album is not announced.** Dork (18 Oct 2026) says the deluxe edition doesn't
  replace a debut album, which "should arrive at the right time".
- UK headline tour: 11 Nov – 5 Dec 2026 (12 dates).

## 3. Rules the deck follows

1. Lifetime medians describe the channel. They are never targets for a 28-day window.
2. Paid support is asked about neutrally. Nothing is inferred from like rates.
3. Comments are qualitative. Older listeners appear in them, but no audience-age claim is made.
4. No footage, budget, date or artist availability is assumed.
5. Peer examples illustrate single, achievable ideas. Their limits are stated.
6. Formats are classified by title (I did not watch the videos). Shorts use the API's
   `isShort` flag.

## 4. The rows

### 4.1 Official videos and visualisers since January 2025 (lifetime public views, 20 Oct)

| Upload | ID | Published | Views | Likes | Comments |
|---|---|---|---:|---:|---:|
| Put On A Record Tommy Official Video | z8LiBxFroao | 11 May 2026 | 140,897 | 926 | 109 |
| I Don't Blame You (Official Visualiser) | UEXWjKSZGp0 | 26 Sep 2025 | 88,963 | 1,722 | 157 |
| Fashion Official Visualiser | Doz07EqVRjk | 30 Jul 2025 | 27,419 | 588 | 68 |
| What (Official Visualiser) | pSyitVjuKo4 | 29 Sep 2025 | 21,142 | 501 | 45 |
| SFX (Official Video) | CZUVjJ70UhU | 20 Mar 2026 | 16,940 | 408 | 38 |
| Our Song (Official Visualiser) | qqJcrdPFD2g | 26 Jun 2026 | 8,719 | 270 | 35 |
| Am I Ever Gonna Be A Rockstar? (Visualiser) | u0uUStPPXqI | 17 Aug 2026 | 3,480 | 142 | 9 |
| Fashion — from Andy Dawson… | gIXuzuKMkXw | 12 Aug 2025 | 3,264 | 116 | 20 |

Median ≈ **19K** (n=8). Older examples shown on slide 4:
- Little Bits (Official Music Video, Feb 2023): 30,252.

Older examples in the appendix:
- Boltcutters (Official Visualiser, Feb 2022): 21,946.
- Weirdo (Official Visualiser, Jun 2023): 14,987.

### 4.2 Live uploads since January 2025 (median ≈ 1.6K, n=11)

| Upload | Views |
|---|---:|
| Let's Go Dancing 🕺 (90s live clip, Jan 2026) | 5,455 |
| Put On A Record Tommy Live At Isle Of Wight Festival 2026 | 3,196 |
| Tom A Smith Live at IOW 2026 (41 min full set) | 3,066 |
| Little Bits Live at Hull KR v Wigan Warriors | 2,047 |
| I Don't Blame You At Isle of Wight Festival 2026 | 1,967 |
| SFX Live at The Bullingdon Oxford | 1,571 |
| Live at Old Royal Naval College, supporting The Kooks | 1,493 |
| It's All Over Live at Third Man Records London | 1,232 |
| Fading Away Live At The Bunker | 803 |
| Dragonfly Live at The Bunker | 668 |
| Amazing night supporting The Kooks | 583 |

### 4.3 Every Short since December 2025 (n=11)

| Short | ID | Views | Deck group |
|---|---|---:|---|
| I see you smiling #livemusic | 0-Rnxi-s67w | 13,008 | performing (top three) |
| I dont blame you for looking at me 🕺 | acFYP0MTvpA | 5,189 | performing (top three) |
| I don't blame you for looking at me #musicvideo | Jrs-39ip02w | 3,058 | performing — a clip from the video (top three) |
| Our summer headline shows in York and Tyldesley are on sale | 9RRL9smbWfE | 1,148 | announcement |
| put on a record let me dance dance dance #live | bYbMwv9SkCE | 1,054 | performing |
| Our Song | tXfg44fnca8 | 854 | performing? (content not checked) |
| new ep out now ! | d6sI4BXTFoE | 722 | announcement |
| Our Song Live in Birmingham | BLQAH7HGnE8 | 699 | performing |
| out may 1st x | _au140gT9jo | 673 | announcement |
| Full Video for Our Song is at 12pm Friday 26th | on9UEsJfZuA | 660 | announcement |
| 'Our Song' full video out today 12pm | x56q2KigouA | 616 | announcement |

**Slide 5 claim:** "His most-viewed Shorts all show him performing." The top three are all
Tom on camera performing, and all five announcements are between 616 and 1,148. The slide
also notes that not every performance Short travels (Our Song live in Birmingham: 699).
Group medians: performing ≈ 2.1K (n=6); announcements 673 (n=5). Tiny samples.

### 4.4 Last month (19 Sep → 20 Oct readings)

| Upload | Added | Total |
|---|---:|---:|
| Put On A Record Tommy (Official Video) | +6,037 | 140,881 |
| I Don't Blame You (Official Visualiser) | +4,195 | 88,935 |
| Our Song (Official Visualiser) | +1,449 | 8,709 |
| SFX (Official Video) | +1,081 | 16,934 |
| Live at IOW 2026 (full set) | +1,031 | 3,061 |
| What (Official Visualiser) | +1,026 | 21,140 |

Sum across the 60 tracked uploads: +20,726. The channel counter rose by about 39K over the
same period. The gap is unexplained: it covers uploads without daily readings, and the
counter steps irregularly.

### 4.5 Channel views per week (counter differences)

| Week starting | Views |
|---|---:|
| 9 Jun | 12,106 |
| 16 Jun | 7,435 |
| 23 Jun | 13,626 |
| 30 Jun | 13,090 |
| 7 Jul | 7,038 |
| 14 Jul | 14,193 |
| 21 Jul | 10,602 |
| 28 Jul | 6,331 |
| 4 Aug | 10,621 |
| 11 Aug | 6,412 |
| 18 Aug | 11,865 |
| 25 Aug | 2,757 |
| 1 Sep | 19,079 |
| 8 Sep | 7,165 |
| 15 Sep | 8,138 |
| 22 Sep | 15,276 |
| 29 Sep | 7,793 |
| 6 Oct | 7,501 |
| 13 Oct | 8,536 |

Averages: about 9.7K a week from 9 Jun to 1 Sep, and about 10.5K from 1 Sep to 20 Oct.
**Slide 3 claim:** "Views have held at around 10K a week since June, even with nothing new
since August." (The last upload was 25 Aug.)

*Correction history:* the first outline said views "fell to 7–8K a week". That came from
uneven sampling and was corrected before the deck was built.

### 4.6 Comments (qualitative)

Videos read: z8LiBxFroao, UEXWjKSZGp0, CZUVjJ70UhU, qqJcrdPFD2g, 97kne_eYrHI,
uVgr54j8ZIo, 0-Rnxi-s67w, Doz07EqVRjk, yimsu_yvtvQ, T41K0NHo0TQ, s9JzNGt42w4,
gIXuzuKMkXw, u0uUStPPXqI, pSyitVjuKo4, PfJp0vmwuBU.

Recurring themes (each across several videos):
- **Dancing.**
- **Seeing him live.**
- **Retro reference points:** Talking Heads, Bowie, Jagger, Mark E. Smith, Depeche Mode,
  early MTV.
- **Older listeners describing themselves** (53–72, Gen X).
- **Praise for the videos.**
- **"You came to my school"** (four videos).
- **Overseas requests to tour:** the US, Canada, Spain, Portugal, Denmark.
- **"How is this kid not a household name?"**

Isolated comments: notes on live sound; one "lacks originality".

Quotes on slide 6:
- "Impossible not to dance." (I Don't Blame You; the full comment continues with
  "Congratulations.")
- "Seen him three times, just gets better and better." (Our Song)
- "I'm 65 and I love this guy. Takes me back to the 70s energy." (What; 34 likes)
- "The long-lost 'Art of the Music Video' has just been found again." (I Don't Blame You;
  42 likes)

### 4.7 Basics — what the data supports

- **Descriptions (verified).** Full text came back for all 106 uploads.
  - 5 contain a link, all from 2021–23.
  - 68 are empty, mostly live clips and Shorts.
  - The singles carry full credits (writing, production, mixing, video) but no listen,
    ticket or mailing-list link.
- **Captions (needs Studio).** `contentDetails.caption` is false on every upload. That means
  no caption tracks are listed; YouTube's automatic captions aren't reliably reflected in
  that field. The slide says "Confirm in Studio".
- **Playlists (verified):** Lower Third (6), Sky Isle of Wight (3), Tom on Telly (6),
  Best of Me (16), Piano Sessions (6), Scruff Of The Neck TV (4). There's no official-videos
  or EP playlist; the Releases tab lists the EPs automatically.
- **Official Artist Channel:** the channel has a Releases tab, and a merged Music videos
  shelf includes an art track ("The Only One"). This suggests an OAC; confirm in Studio.
- **Channel intro:** the description opens with "Musician" — truncated when viewed signed
  out, so not fully read.
- **Community:** the last post was about 5 months ago (summer show pre-sale via mailing list
  and WhatsApp): "Can't wait to see you all for another night at Tommy's Dance Place 🕺".
- **Not visible publicly:** end screens, cards, pinned comments, Shorts related-video links.

### 4.8 Peer examples

| Peer | Subscribers | Idea on slide | Evidence | Limit stated |
|---|---:|---|---|---|
| Antony Szmierek | 5.5K | Give the era a running character | The Heron (11 Mar 2026) 46,865; in-world Shorts Mar–Oct: "THE HERON, YOURS FOREVER" 1,885, "THE HERON WAITS PATIENTLY" 725 / 182, "WELCOME TO THE CULT OF THE HERON" 151–309, "MEDIA SMEAR CAMPAIGNS…" 1,287; album *Decoding Birdsong* 21 Aug 2026 | The teaser Shorts stayed small; the value is recognition, not reach |
| mary in the junkyard | 7.9K | A simple live version of a single | Crash Landing video 125,691 + live session recording 16,368; New Muscles 104,914 + 15,827; sessions +2.3–2.4K over the last month; debut album *Role Model Hermit* July 2026 | Doesn't mean every single needs a session |
| Freak Slug | 24.4K (larger) | A steady rhythm that carries on after release | Girl, Intentions (9 Jul) 55,140; If I Could (7 Aug) 27,203; Wishing Bone (16 Sep) 58,662; Serpent (1 Oct, after the 18 Sep album *Amulet*) 23,294; album visualiser 6,131; 18 uploads since the album | A few song videos hold most of the views |

Appendix only:
- **Steven Wilson** (Fiction label-mate; world-building approach): trailer Short "The village
  is alive." 73K; parish-council website with "observances" on release dates.
- **Newport:** one song filmed four ways — 882K, 171K, 93K, 59K. An Australian act; the
  scale may involve promotion.
- **Fcukers:** album interview, 34K.
- **The Snuts:** album and live playlists.
- **Removed at the team's request:** Jamie Webster.

### 4.9 YouTube features

| Feature | Source | Deck status |
|---|---|---|
| Premieres | Release Strategy help page | Used in the rollout (Tom in chat) |
| Shorts related video | support.google.com/youtube/answer/14075157: "Select a Related Video from your channel" | Fix 4, "Set in Studio" |
| Afterparty | support.google.com/youtube/answer/10184580; artists.youtube (partner representative) | Appendix only; not prioritised |
| Top Fans videos | Release Strategy: "only available to artists with a minimum number of top fans" | Appendix only |
| Stations | No YouTube help page (invite-only test, per trade press) | Not recommended at this size |

## 5. Every claim on the deck, slide by slide

1. **Cover.** "Tommy's Dance Place is open." A look you can spot in a second, songs that are
   connecting, live Shorts that move; "an achievable plan to build on them".
2. **"A look and a sound you can spot in a second."** Sunderland, Fiction, dance-punk,
   polka dots and braces, camcorder footage, Katie Anderson's visuals, Tommy's Dance Place.
   *What it means:* the identity is there; put it in front of people more often.
3. **"A real audience — and a pause since August."** 6,270 subscribers; 106 videos; 55 days
   since the last upload; I Don't Blame You +4.2K last month at 13 months old. Weekly views
   chart (§4.5). *What it means:* views have held at ~10K a week, so restart around the
   deluxe EP and tour.
4. **"Several songs are finding an audience."** Six thumbnails with lifetime views (§4.1).
   *What it means:* keep pointing people to these songs; we'll check whether either of the
   two biggest had paid support — "context, not a judgement on the work".
5. **"His most-viewed Shorts all show him performing."** Top three against every
   announcement Short (§4.3). *What it means:* make Shorts from performance, link each to its
   song, and keep announcements for Community.
6. **"Dancing, live shows and familiar echoes."** Four quotes (§4.6). The note says older
   listeners feature, but the comments can't show audience age.
7. **"A few fixes, done once."** Six fixes, each marked Checked or Studio check (§4.7).
8. **"One idea to borrow from each."** Antony Szmierek (a running character), mary in the
   junkyard (a live version), Freak Slug (a steady rhythm) (§4.8).
9. **"Use what's filmed. Then capture one thing well."**
   - Step 1, existing footage: the Isle of Wight full set, the Kooks support, SXSW (Waterloo
     Records), Live at The Bunker. If usable, 2–3 Shorts.
   - Step 2, choose ONE: a filmed tour show or a focused session, with what each gives, its
     trade-off and what it needs.
   - "Do one first. Film more only if there's budget and the response is clearly
     encouraging."
10. **"Give the album its own world, so fans know the era."** Four blocks:
    - A look across everything (Tom's EP era).
    - A trailer before the first single (Steven Wilson's, 73K).
    - In-world posts (Tom's own Dance Place post).
    - One place that holds the album: a playlist, plus optionally a full-album visualiser
      (Freak Slug).

    The decision to make first: does the album continue Tommy's Dance Place or open a new
    room?
11. **"A flexible album rollout, built around release week."**
    - 6 → 1 weeks before: the era set (look, trailer Short); lead single with a Premiere;
      the playlist ready; optionally the live version.
    - Release week: a focus-track video, 2–3 performance Shorts, a Community post;
      optionally a full-album visualiser.
    - Weeks 1–2 after: one follow-up within 7–14 days; comment replies.
    - Weeks 3–6 after: the song fans respond to most gets one more piece; optionally a tour
      film.
12. **"Three questions worth answering first"** (Studio):
    1. What support did the strongest videos have?
    2. Do the live videos hold people?
    3. Do Shorts lead to the songs?

    Each is shown with the data needed and the decision it informs.
13. **Five next steps.** Now: fix the basics; find the footage; choose one capture. Album
    preparation: share a Studio export and the paid-support answer; tell us the album window
    and its world.

## 6. Where I think it's weakest

1. **Slide 5 rests on very few Shorts** (11 since Dec 2025). The "top three" framing is
   accurate but thin. One of the three is a clip from the music video, not a live
   performance. One Short ("Our Song", 854) was grouped without its content being checked.
2. **Slide 4 may still read as a ranking.** Lifetime views across ages, with 141K and 89K
   leading. Paid support is unknown either way.
3. **"Views have held at ~10K a week" uses a stepping counter.** Single weeks swing from
   2.8K to 19.1K. Averages over 7–12 weeks are steadier but approximate.
4. **The weekly counter and the per-video sums disagree** (+39K against +20.7K over the
   month). The deck uses the counter for the channel trend and per-video readings for
   individual uploads.
5. **The peer evidence is thin in places.** Antony's in-world Shorts are small; the slide
   says so. Freak Slug is four times Tom's size. mary in the junkyard's session numbers sit
   far below their videos.
6. **The world-building slide uses a much larger label-mate** (Steven Wilson) for the
   trailer example. Is that reasonable, or should a peer of Tom's size be found?
7. **The footage inventory is unknown.** The deck lists public uploads as clues, not
   confirmed raw material.
8. **The basics are partly unverified:** captions, end screens, pinned comments, Shorts
   links and the full channel description need Studio or a signed-in view.
9. **The tour-show versus session trade-off is reasoned, not evidenced** — no channel data
   compares them for Tom.
10. **The "Familiar echoes" quote** is from an older listener, with age in the quote itself.
    The slide notes the limit, but a reader may still generalise.

## 7. Deliberately not claimed

- That any upload caused channel or subscriber growth.
- That any video had paid support — or didn't.
- Retention, traffic sources, returning viewers, subscribers per video, geography.
- Audience age or territory size.
- Any growth forecast or numeric target.
- That a specific footage archive exists, or that any filming is budgeted.
- That Afterparty, Top Fans or Stations are available to the channel.

## 8. Questions for the reviewer, in priority order

1. Does the main story (identity, songs connecting, performance Shorts) follow from §4,
   or is any part stronger than the evidence?
2. Is slide 5's Shorts claim defensible on 11 Shorts? Would you reword it?
3. Does slide 4 or the appendix still imply anything about paid support, or rank formats
   by lifetime views?
4. Is the ONE-capture recommendation (slide 9) clear and proportionate? Is the trade-off
   fair?
5. Is the album rollout (slide 11) achievable for a small team without a date? Is anything
   in "core" really optional?
6. Are the three peer ideas the most useful ones available from the Watcher's list, and
   are their limits stated honestly?
7. Is the album-era slide grounded enough in Tom's own material, or does it lean on other
   artists?
8. Tone: is anything patronising to the artist, or likely to land as criticism of the label?
