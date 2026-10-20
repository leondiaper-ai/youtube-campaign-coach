# Tom A. Smith × YouTube — audit pack

**For independent review.** Read 20 October 2026. This is the raw material behind the deck
at `/tomasmith`: **version 2**, 12 slides plus an appendix, for the UK commercial team and
Fiction Records.

The deck is a channel deep dive and album-preparation plan for a developing artist. Version 2
is restructured on the Amyl deck (`/amyl`): direct headlines that carry the plan on their own,
practical "what to do" language, and method and inventories moved to the appendix. The story:
something distinctive already exists; the songs are still finding viewers; put the
performance into the feed; give people somewhere to go next; start with existing footage;
stay active without a second job; one idea from each peer; plan each single's follow-up; give
the album a recognisable identity; who does what next.

**New in v2: the key videos were watched** (sampled frames, sound not heard — §4.10). That
corrected the Shorts classification: none of the 11 Shorts is a plain announcement card.

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

**v2.1 instruction (applied):** asset rights, ownership, permissions, raw-file availability
and technical production checks are out of scope (handled separately by the team) and are
removed from the whole deck, appendix included. Existing footage is presented as creative
opportunity; repeated caveats trimmed.

**v2 instructions (applied):**
- Simplify using the Amyl deck for structure, clarity and practical recommendations; keep
  Tom's camcorder identity and evidence.
- Watch the key Tom videos, Shorts and peer examples first; correct classifications;
  separate observation from interpretation.
- Performance can come from music videos as well as live footage.
- Present clip → song video → playlist as the intended journey, not proven conversion.
- Start from existing footage before any new filming (superseded in v2.1: presented as creative opportunity, no clearance questions).
- Priority tiers (First / Next / Optional) plus a light between-release example — not a quota.
- Follow-up timeline; 7–14 days is a planning prompt, not a proven optimum, and not a
  reason to manufacture a video.
- Album identity: Tommy's Dance Place is a reference only; don't assume the album continues
  it or needs a fictional world.
- Close on actions and ownership (Tom/Fiction provide; VMG analyses, plans, packages).
- Studio questions in one concise section.

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
6. Formats are classified from sampled frames as well as titles (§4.10). Shorts use the
   API's `isShort` flag. Sound was not heard, so nothing is claimed about audio.
7. Observation (what the frames and data show) is kept separate from interpretation (what we
   think it suggests, to be tested).

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

| Short | ID | Views | What we saw (frames) |
|---|---|---:|---|
| I see you smiling #livemusic | 0-Rnxi-s67w | 13,008 | Multi-angle live edit, white vest, yellow lyric captions |
| I dont blame you for looking at me 🕺 | acFYP0MTvpA | 5,189 | Live, dancing, lyric caption |
| I don't blame you for looking at me #musicvideo | Jrs-39ip02w | 3,058 | Vertical dance piece from the video world: cut-out Tom over changing graphics, pink lyric bubbles |
| Our summer headline shows in York and Tyldesley are on sale | 9RRL9smbWfE | 1,148 | Live performance footage |
| put on a record let me dance dance dance #live | bYbMwv9SkCE | 1,054 | POART dance-hall teaser, lyric text, "out May 1st" end card |
| Our Song | tXfg44fnca8 | 854 | Live, polka shirt, no on-screen text |
| new ep out now ! | d6sI4BXTFoE | 722 | POART dance-hall footage, dark |
| Our Song Live in Birmingham | BLQAH7HGnE8 | 699 | Phone footage from the crowd, no on-screen text |
| out may 1st x | _au140gT9jo | 673 | Dark dance-hall clip with text |
| Full Video for Our Song is at 12pm Friday 26th | on9UEsJfZuA | 660 | Our Song record-shop video clip, yellow title card |
| 'Our Song' full video out today 12pm | x56q2KigouA | 616 | Our Song record-shop video clip, yellow title card |

**Correction from v1.** v1 grouped five of these as "announcements" by title. The frames show
all five contain performance or music-video footage. v1's "performing vs announcements"
medians are withdrawn.

**Slide 4 (v2).**
- *Observation:* all 11 Shorts show Tom performing, live or from a music video. The three
  that travelled (13K, 5.2K, 3.1K) are titled with a lyric and open on a close, bright
  performance moment. Most others lead with a date, time or song title; several use darker
  footage.
- *Interpretation, presented as a test:* lead with the song, not the logistics. The next
  4–6 Shorts: lyric in the title and on screen, performance from the first second, the song
  video set as the related link.
- *Confounds stated:* two of the top three are I Don't Blame You, so the song may matter as
  much as the edit; 11 Shorts; one lyric-titled Short ("put on a record let me dance", 1,054)
  didn't travel far either.

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

### 4.10 Frame review — how and what

**Method.** Long-form: four storyboard stills per video (`i.ytimg.com/vi/ID/hqdefault, hq1,
hq2, hq3`). Shorts: the player's `<video>` sought to 5/20/35/50/70/90% and frames drawn to
canvas. **Sound was not heard.**

| Video | Observed |
|---|---|
| Put On A Record Tommy | Polka-dot shirt, Rowetta, dark dance hall with a disco ball (the Tommy's Dance Place set) |
| I Don't Blame You | Tom performing to camera; ornate background, lying in grass, blue scenes |
| Little Bits | Band studio performance |
| Fashion | Tom against a sheet, outfit changes |
| What | Black and white, sunglasses, mic |
| SFX | Red shirt, mic, green title card |
| Our Song | Record shop (Waterloo Records), yellow title |
| Rockstar? | Blue background, braces, close singing |
| Antony Szmierek · The Heron | A man with large wings in a period house |
| mary in the junkyard · Crash Landing session / video | Studio, headphones, piano / aviator imagery |
| Freak Slug · Wishing Bone / Serpent / Amulet visualiser | Home-video feel with friends / fire at dusk / captioned montage |

*Interpretation:* nearly every official video is performance-led; Tom's "visualisers" are
performance-to-camera pieces, not abstract visualisers.

### 4.11 Possible footage sources (public uploads only)

| Source | ID | Published | Views |
|---|---|---|---:|
| Tom A Smith Live at IOW 2026 — full set, 41 min (plus POART / IDBY clips; Sky IOW playlist) | 97kne_eYrHI | 25 Aug 2026 | 3,067 |
| Live at Old Royal Naval College, supporting The Kooks | lTJAYivuM5Q | 7 Aug 2026 | 1,493 |
| It's All Over — Live at Third Man Records London | s9JzNGt42w4 | 12 Dec 2025 | 1,232 |
| Man Overboard — Live at The Bunker, Sunderland | LztmHJNku7I | 19 Dec 2024 | 993 |
| "…THE MOVIE — Our First Full Tour" (2024 tour film) | Zxh_JPRhD10 | 16 Jun 2024 | 716 |
| SXSW / Waterloo Records footage (used in the Our Song visualiser) | qqJcrdPFD2g | 26 Jun 2026 | — |

Slide 6 presents these as creative opportunities. Asset rights, permissions, raw files and
technical production checks are handled separately by the team and are out of scope for this
brief and deck.

## 5. Every claim on the deck (v2), slide by slide

1. **Cover — "Tommy's Dance Place is open."** Something distinctive is already here; put the
   performance into the feed, give people somewhere to go next, build towards the album
   without a second job.
2. **"There's already something distinctive here."** Four points: a look (polka dots,
   braces, camcorder texture, title cards, mostly Katie Anderson); performance at the centre
   (§4.10); a world (Tommy's Dance Place, "everyone is invited"); fans talk about the dancing
   and the shows (two quotes, §4.6). Six thumbnails.
3. **"The songs are still finding viewers."** 6,270 subscribers; ~10K channel views a week
   since June (§4.5); 55 days since the last upload; +15K last month across six uploads
   (§4.4: 14,819). Six cards: lifetime views (labelled) plus last-month additions. Note: paid
   support unknown, asked about before reading the two biggest.
4. **"Put the performance into the feed."** §4.3 — observation / test, confounds stated.
5. **"Give people somewhere to go next."** Clip → song video → playlist, each with the setup
   step: Shorts related video (Set in Studio); end screen, pinned comment, description link
   block (5 of 106 have a link — Checked), lyric captions; an official-videos playlist (none
   of the six public playlists holds them — Checked). *"This is the route we're building, not
   one we've shown people take. Studio would tell us whether they do."*
6. **"Start with what already exists."** §4.11, each with what it could become (IOW cut song
   by song; Greenwich open-air clips; Waterloo Records tied to Our Song; Third Man and The
   Bunker for between releases; the 2024 tour film as a look back). "The next few Shorts and
   a live song video can come from what's already been filmed."
7. **"Stay active without creating a second job."**
   - **First** (artist time: little or none): the route; performance Shorts from existing
     footage; live cut-downs from the IOW set; lyric captions; Community posts in Tom's voice.
   - **Next** (around the tour, if it adds something new): one filmed tour show *or* one
     short session.
   - **Optional** (only when it adds something): personality pieces, BTS, extra sessions.
   - A month between releases *could* look like: 2–4 performance Shorts; 1 song video (live
     version or lyric video); a few Community posts; now and then something personal. "An
     example to adapt, not a quota."
8. **"Borrow one useful idea from each artist."** Antony Szmierek — a running motif (For Tom:
   if the album has a strong image or phrase, let it recur). mary in the junkyard — a simple
   live version (For Tom: one live version of the next single). Freak Slug — a steady rhythm
   (For Tom: something to watch each month of the album era, often from existing footage).
   §4.8.
9. **"Plan the follow-up before the single goes live."** Before release (main asset, 2–3
   clips, playlist, links) → Release (one focal point) → Following days (Shorts, comments,
   Community) → Around 7–14 days (a worthwhile follow-up, *if there is one*) → Between
   singles (performances, personality, catalogue) → Album week and after (focus tracks chosen
   by response). The 7–14 days is labelled a planning prompt, not a proven best time.
10. **"Give the album a recognisable identity."** Artwork, video treatment, thumbnails,
    language, playlists. Tommy's Dance Place shown as a reference only. "It doesn't have to
    continue Tommy's Dance Place or invent a fictional world — it just has to be
    recognisable."
11. **"A fuller picture, with channel access."** "This review uses public YouTube data. If
    you're happy to add me to YouTube Studio, I can look more closely at who's watching, how
    they're finding Tom and which content is connecting." / "That would help us refine these
    ideas and support the album campaign as it develops." A light offer, not a measurement
    programme.
12. **"What we can help with next."** From Tom and Fiction: the performances Tom rates;
    Studio access if they're happy to; the album window and direction. From VMG: set up the route; package
    what exists (Shorts test, live cut-down); plan each single's follow-up, ready before
    release day.

Removed from v1 slides (now appendix or cut): the weekly chart, the fans quotes slide (two
quotes folded into slide 2), the six-fix basics slide (folded into slide 5), the
session-vs-show trade-off grid, the era slide's Steven Wilson trailer and Freak Slug album
visualiser, and the dated album rollout grid.

## 6. Where I think it's weakest

1. **Slide 4's test rests on 11 Shorts**, with a song confound (two of three are I Don't
   Blame You). The slide frames it as a test, but "lyric title + bright opening" is our
   reading, not an established cause.
2. **Frames were sampled and sound wasn't heard.** "Close, bright moment" is judged from six
   frames; a different opening second is possible.
3. **Slide 3's "+15K" sums six uploads chosen because they're the biggest movers**; the
   channel counter shows ~39K for the same period (§4.4). The slide labels it as the six
   shown.
4. **The route on slide 5 is unproven.** Labelled as such; Studio would show it.
6. **Peer evidence is thin in places** (Antony's Shorts small; Freak Slug four times Tom's
   size; mary's sessions far below their videos).
7. **The between-release month is an illustration**, not derived from Tom's data.
8. **Basics are partly unverified** (captions, end screens, pinned comments, Shorts links).

## 7. Deliberately not claimed

- That any upload caused channel or subscriber growth.
- That any video had paid support — or didn't.
- Retention, traffic sources, returning viewers, subscribers per video, geography.
- Audience age or territory size.
- Any growth forecast or numeric target.
- That Afterparty, Top Fans or Stations are available to the channel.

## 8. Questions for the reviewer, in priority order

1. Do the headlines alone tell the plan clearly? Is any one vague or generic?
2. Is slide 4 defensible — is the observation / test split clean, and are the confounds
   enough?
3. Does slide 5 anywhere imply the route is proven?
4. Are the First / Next / Optional tiers proportionate for a small team? Does the month
   example read as a quota?
5. Does slide 9 make 7–14 days sound like a rule?
6. Does slide 10 assume anything about the album's concept?
7. Is ownership on slide 12 clear and fair to the label?
8. Tone: is anything patronising to the artist, or likely to land as criticism of the label?
