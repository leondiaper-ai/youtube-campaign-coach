# Tom A. Smith × YouTube — deep dive and album preparation plan

**Deck outline and supporting evidence.** Read 20 October 2026, for the UK commercial team
and Fiction. This is the first deliverable, as the brief asks: research, then an outline.
The deck gets built once the outline is agreed.

**How to read it.** Each finding is labelled:
- **[Verified]**: read directly from public data or official sources.
- **[Interpretation]**: my reading of the evidence.
- **[Proposed]**: an experiment or plan.

---

## 0. Identity, sources and gaps

**[Verified] Who he is.**
- Tom A. Smith, singer-songwriter from Sunderland (21 in July 2025, per Dork). Signed to
  **Fiction Records** in July 2025. He is not Tom Smith of Editors, who also has solo releases.
- Long-time mentor and producer: Barry Hyde (The Futureheads). He co-wrote "Like You Do" with
  Miles Kane. Rowetta guests on "Put On A Record Tommy".
- Visuals are mostly by **Katie Anderson** (Katie Anderson Promo); "What" was made by Crew Gal
  Creative House.
- **Sound:** dance-punk and new-wave alt-rock. Reviews compare him to The Dare and LCD
  Soundsystem; fans compare him to Talking Heads, Bowie and Jagger.
- **Look:** a vintage, camcorder-and-VHS aesthetic. He filmed "Fashion" on a 1994 camcorder,
  and an early live upload is "recorded on tape camcorder". He likes recording gear more than
  30 years old.
- **Organising idea:** *Tommy's Dance Place*, a fictional club "where everyone is invited".

**[Verified] Release context.**

| Release | Date | Notes |
|---|---|---|
| *Say What You Want* EP | 26 Sep 2025 | "I Don't Blame You", "Fashion" |
| *Put On A Record Tommy* EP | May 2026 | SFX, Our Song, Put On A Record Tommy (feat. Rowetta), The Only One, No Matter What, The Band |
| *Put On A Record Tommy (Deluxe)* | 9 Sep 2026 | 12 tracks: adds "Am I Ever Gonna Be A Rockstar?", a cover of Talking Heads' "Life During Wartime", and an extended title track |
| **Debut album** | **Not announced** | Dork (18 Oct 2026): the 12-track edition does not replace a debut album, which "should arrive at the right time" |
| UK headline tour | 11 Nov – 5 Dec 2026 | Brighton, Cardiff, Stoke, Bedford, Plymouth, Portsmouth, Hull, Whitehaven, Huddersfield, Edinburgh, Liverpool, Wrexham |
| Recent live | 2026 | Isle of Wight Festival (Big Top), support for The Kooks, SXSW (footage filmed at Waterloo Records, Austin) |

Because there is no album date, the plan uses a relative timeline around release week (R).

**[Verified] Sources and coverage.**
- **Uploads:** all 106 public uploads via the Watcher (`/api/full-catalogue`), 20 Oct 2026.
- **Daily per-video readings:** 60 of the 106 uploads, from 19 Sep 2026 only (32 days).
- **Channel daily snapshots:** from 9 Jun 2026 (130 readings). The views counter is usable.
  Subscriber readings are only available for the last fortnight through the routes I checked.
- **Comments:** 40 per video by relevance, on 15 videos (`/api/comment-scan`).
- **Channel surfaces:** playlists and Home sections (`/api/channel-shelf`). The live channel,
  Posts tab and Releases tab were viewed signed out.
- **The youtube-insights preview:** the live page, plus its source repo
  (`leondiaper-ai/youtube-insights`), which is a static data file and a Next.js page.
- **Source code checked:** neither repo (youtube-campaign-coach or youtube-insights) has any
  YouTube Analytics or Studio integration.

**[Verified] Gaps.**
- No YouTube Studio data. Nothing here describes retention, CTR, traffic sources, returning
  viewers, subscriber conversion or paid versus organic views.
- No daily history before 19 Sep for any video, so there is no release-week curve for past
  singles.
- No asset inventory (the Drive asset library has nothing for Tom).
- No album details, no budget, and no information on the artist's availability.

---

## 1. Where the channel is now

**Headline: "A small, real audience, with two breakout videos and a quiet two months."**

**[Verified]**
- **Size:** 6,270 subscribers; 743,991 lifetime views; 106 public uploads since 2021. The
  channel appears to be an Official Artist Channel: it has a Releases tab, and art tracks
  appear in the Music videos shelf. Confirm in Studio.
- **Channel views per week** (counter readings): about 9.7K a week on average from 9 Jun
  to 1 Sep, and about 10.5K from 1 Sep to 20 Oct. *Correction:* an earlier draft said
  views fell to 7–8K a week; exact weekly windows show they held steady.
- **Activity:** the last upload was 25 Aug (the full Isle of Wight set). There have been no
  uploads for 55 days, and the Watcher classifies the channel as COLD.
- **The two big videos are still finding viewers** in the last 31 days:
  - Put On A Record Tommy (Official Video): +6,037.
  - I Don't Blame You (Official Visualiser, 13 months old): +4,195.
  - Our Song: +1,449. SFX: +1,081. The Isle of Wight set: +1,031. What: +1,026.

**[Interpretation]** The older singles keep earning views, so the catalogue is doing quiet
work. But nothing new has gone up during an active period: the deluxe EP came out on
9 Sep and the headline tour starts in three weeks.

*Practical implication:* fix the basics and restart activity before the tour, not at the album.

---

## 2. What fans already respond to

### 2a. Songs and uploads (lifetime public views, 20 Oct 2026)

| Upload | Published | Views | Likes / view |
|---|---|---:|---:|
| [Put On A Record Tommy (Official Video)](https://www.youtube.com/watch?v=z8LiBxFroao) | May 2026 | 140,897 | 0.7% |
| [I Don't Blame You (Official Visualiser)](https://www.youtube.com/watch?v=UEXWjKSZGp0) | Sep 2025 | 88,963 | 1.9% |
| [Little Bits (Official Music Video)](https://www.youtube.com/watch?v=yimsu_yvtvQ) | Feb 2023 | 30,252 | 1.6% |
| [Fashion (Official Visualiser)](https://www.youtube.com/watch?v=Doz07EqVRjk) | Jul 2025 | 27,419 | 2.1% |
| [Boltcutters (Official Visualiser)](https://www.youtube.com/watch?v=2CslXT3b-wA) | Feb 2022 | 21,946 | 0.7% |
| [What (Official Visualiser)](https://www.youtube.com/watch?v=pSyitVjuKo4) | Sep 2025 | 21,142 | 2.4% |
| [SFX (Official Video)](https://www.youtube.com/watch?v=CZUVjJ70UhU) | Mar 2026 | 16,940 | 2.4% |
| [Weirdo (Official Visualiser)](https://www.youtube.com/watch?v=BwSIVarxm88) | Jun 2023 | 14,987 | 1.5% |
| [Our Song (Official Visualiser)](https://www.youtube.com/watch?v=qqJcrdPFD2g) | Jun 2026 | 8,719 | 3.1% |
| [Am I Ever Gonna Be A Rockstar? (Visualiser)](https://www.youtube.com/watch?v=u0uUStPPXqI) | Aug 2026 | 3,480 | 4.1% |

**[Verified]**
- **Official videos and visualisers since Jan 2025:** median about **19K** (n=8, range
  3.3K–141K).
- **Live uploads since 2025:** median about **1.6K** (n=11). Examples: Put On A Record Tommy
  at the Isle of Wight 3.2K; the full Isle of Wight set 3.1K; SFX live in Oxford 1.6K.
- **Shorts since 2025:** median about **850** (n=11). They split clearly:
  - Live moments where he dances or performs: [I see you smiling](https://www.youtube.com/shorts/0-Rnxi-s67w) 13.0K; [I don't blame you for looking at me](https://www.youtube.com/shorts/acFYP0MTvpA) 5.2K; another 3.1K.
  - Announcements ("full video out today", "new EP out now", tickets): 600–1,150 each.
- **Covers and sessions** (2021–25): mostly 0.5–2.5K. The exception is the
  [Wunderhorse "Teal" cover](https://www.youtube.com/watch?v=T41K0NHo0TQ), at 5.5K.

**[Interpretation] Be careful with the two big videos.** Put On A Record Tommy has 141K views
but only a 0.7% like rate, against 2–3% for his other recent videos. Several comments say
"randomly popped up on my feed" or "came across you in a Facebook feed". Both are consistent
with paid promotion, and also with recommendation. Public data cannot tell them apart.
**Ask the label whether either video was promoted** before treating its view count as a
signal about the format.

### 2b. What comments say (15 videos, about 450 comments read)

Recurring themes — each appears across several videos, not just once:
1. **Older listeners say his music takes them back.** For example: "I'm 65 and I love this guy.
   Takes me back to the 70s energy" (What, 34 likes). Similar comments appear on I Don't Blame
   You, Put On A Record Tommy and the Shorts, from people describing themselves as 53 to 72 or
   Gen X.
2. **"It makes me want to dance."** This comes up on Put On A Record Tommy, I Don't Blame You,
   Our Song, Fashion and the Shorts.
3. **He's great live.** Fans write that they've seen him three times, or were at the Isle of
   Wight; they praise the audience interaction on the full set.
4. **Reference points:** Talking Heads, Bowie, Jagger, Mark E. Smith, Depeche Mode, early MTV.
   One comment: "The long-lost 'Art of the Music Video' has just been found again" (I Don't
   Blame You, 42 likes).
5. **"How is this kid not a household name?"** Fans feel they've discovered him and want to
   spread the word.
6. **"You came to my school."** School performances come up on four videos.
7. **Overseas fans asking him to tour:** the US (Seattle, Denver, New Orleans), Canada,
   Barcelona, Portugal and Denmark.

Isolated comments, not themes: a few on sound mixing ("sound technician has got this all
wrong") and one "lacks originality".

**[Interpretation]** Fans respond to the energy, the dancing and the live presence, and to his
retro reference points. The audience spans generations, and his openness and humour (the Andy
Dawson Fashion video, the band tour film) are part of the appeal.

### 2c. Keep / improve / test

- **Keep:** strong, characterful visualisers (Katie Anderson); live dancing moments as Shorts;
  full festival sets.
- **Improve:**
  - Restart activity — there have been no uploads in 55 days.
  - Descriptions: no recent upload has links, and captions are off on all of them.
  - There's no playlist for the EPs (only the auto-generated Releases tab), and no "official
    videos" playlist.
  - Announcement Shorts consistently underperform.
- **Test:** one simple session, recorded once and released in several pieces; performance-led
  Shorts linked to each song; a Premiere with Tom in the chat.

---

## 3. The biggest opportunities

**Headline: "Film the energy, then point every clip at a song."**

1. **One session, many pieces** [Proposed]. Film one afternoon of 4–5 songs, on camcorder plus
   two cameras, in a Sunderland room he already uses ("Live At The Bunker", 2024–25). That
   gives one full performance, a video per song, and 6–10 performance Shorts. It suits his
   camcorder look and costs little.
2. **Film the tour** [Proposed]. The 12-date headline run (11 Nov – 5 Dec) is the most
   concentrated live footage he'll have before the album. Capture one show properly, plus
   simple crowd and dancing clips at others.
3. **Shorts that earn a click** [Proposed]. Live dance moments, each with the related-video
   link set to that song's video. Fewer announcement Shorts.
4. **Basics, done once** [Proposed]: playlists, descriptions with links, captions, pinned
   comments, end screens. (See §6.)
5. **His personality, in small doses** [Proposed]. The band tour film, the Andy Dawson video
   and the school visits show a funny, warm performer; the comments respond to it. Keep it
   occasional and real, not a vlog schedule.

---

## 4. Examples to borrow from (from the Watcher's artist list)

These were chosen from the 81 Watcher channels between 1.5K and 80K subscribers. Figures are
public lifetime views on 20 Oct 2026, and "last month" means 19 Sep – 20 Oct readings.

### 4.1 Antony Szmierek: @antonyszmierek, 5.5K subscribers *(closest in size)*
- **Why relevant:** a Northern, personality-led artist on a UK indie label. He released his
  second album, *Decoding Birdsong*, on 21 Aug 2026. He also uses celebrity cameos, much as
  Tom did with Andy Dawson and Rowetta.
- **What he did:**
  - One official video per single: The Heron 47K; Chalk 30K; Flight Simulator (feat. Craig
    Cash) 33K, which gained +20.9K in the five weeks after the album.
  - A playlist per album: *Service Station At The End Of The Universe* (13 videos) and
    *Decoding Birdsong* (20).
  - Shorts with a median of about 460.
- **What Tom could borrow:**
  - An album playlist from day one.
  - A video for the strongest song released after the album — Flight Simulator kept growing
    after release.
  - A light comic cameo.
- **What we can't conclude:** whether the cameo caused anything; his views are of a similar
  order to Tom's.

### 4.2 mary in the junkyard: @mary-inthejunkyard, 7.9K subscribers
- **Why relevant:** a UK developing band. Their debut album, *Role Model Hermit*, came out
  in July 2026 to strong reviews. The YouTube Insights preview also uses them as its
  developing-artist case.
- **What they did:** each single got an official video plus a "live session recording":
  - Crash Landing: 126K video; [session](https://www.youtube.com/watch?v=n3wcUX7eWHQ) 16K.
  - New Muscles: 105K video; [session](https://www.youtube.com/watch?v=ULH6uRAzMXM) 16K.
  - Blood: 55K video; session 17K.
  The sessions are still gaining about 2.3–2.4K a month each.
- **What Tom could borrow:** the pairing of a video with a session for every single, done
  simply.
- **What we can't conclude:** whether the sessions helped the videos.

### 4.3 Jamie Webster: @jamiewebster, 57K subscribers *(larger; tactic is achievable)*
- **Why relevant:** a working-class Northern singer-songwriter with a strong hometown
  following — the closest parallel to Tom and Sunderland.
- **What he did:**
  - Films hometown shows: Live From Sefton Park, [Weekend In Paradise](https://www.youtube.com/watch?v=MHcBvoMN5jQ) 312K; This Must Be The Place 81K; Valerie with Dave McCabe 50K.
  - In July 2026, released the official video and a live version of Small Town Life together
    (55K each).
- **What Tom could borrow:**
  - Film one big hometown-area show.
  - Release a live version alongside the official video.
- **What we can't conclude:** anything about scale — his audience is nine times larger.

### 4.4 Newport: @whoisnewport, 6.2K subscribers *(a tactic, not a peer)*
- **Why relevant:** a similar channel size, though an Australian act, so the musical context
  differs.
- **What they did:** one song, "Fickle", filmed as four simple performances in different
  places and times: "5:35pm at the beach" 882K (+290K last month); "7:45pm on a rooftop"
  171K; "6:23am on a hill" 93K; "9:20pm in a carousel" 59K.
- **What Tom could borrow:** cheap repeat performances of one priority song — very compatible
  with a camcorder.
- **What we can't conclude:** the scale of the response may involve paid promotion; we don't
  know.

**Appendix examples:**
- **Fcukers (30.7K subscribers; dance-punk, the closest sonic cousin):** consistent official
  videos at 120K–613K, and an interview about their debut album *Ö* at 34K.
- **The Snuts (30.2K):** clear album and live playlists ("Millennials – Official Album
  Playlist", "Live Videos").

---

## 5. The album plan (relative to release week, R)

Core plan first, optional additions after it. Every action notes what would justify doing more.

### Now → tour (before 11 Nov) — prepare
| Action | Supports | Why him | Needs | Do more if… |
|---|---|---|---|---|
| **Fix the basics** (§6) | Whole catalogue | The channel is quiet, but people are still finding the singles | Half a day of label time | — |
| **2–3 live-moment Shorts** from the Isle of Wight and Kooks footage, each linked to its song | Put On A Record Tommy, I Don't Blame You, SFX | His best Shorts are live dance moments | Editing only, using existing footage | Any passes ~2K in 7 days (above his recent normal) |
| **Community post:** tour dates plus "which song should we film properly?" | The tour | The last post was 5 months ago | 10 minutes | Replies name specific songs |

### Tour (11 Nov – 5 Dec) — capture
| Action | Supports | Needs | Do more if… |
|---|---|---|---|
| **Film one show properly** (multi-camera, good sound); camcorder crowd and dance clips at others | Album songs being played live; the strongest singles | A videographer for one night; permission from the venue and band | The full set holds a steady audience, per Studio retention |

### Pre-release (R−6 to R−1 weeks)
| Action | Supports | Needs | Do more if… |
|---|---|---|---|
| **The session:** one afternoon in Sunderland, 4–5 album songs → a full performance, one video per song, 6–10 Shorts | Lead single plus focus tracks | 1 day of the artist and band; a small crew; camcorder | Session versions reach ~2K+ in 28 days (above his live baseline of ~1.6K) |
| **Lead single:** Short tease → Premiere with Tom in chat → official video or visualiser → the session version 7–14 days later | Lead single | The video is already budgeted by the label (unknown) | Premiere chat is active; the video beats his ~19K median in 28 days |

### Release week (R)
- **Album playlist** goes live with the album: focus videos, session versions, then art tracks.
- **Focus-track video** (official video or visualiser; Katie Anderson's style).
- **2–3 Shorts** from the session, each linked to its song.
- **Optional:** a Premiere with Tom in chat for the focus video. A YouTube Premium Afterparty
  needs YouTube's partner team; at his size, check whether it's available rather than assume.

### R+1 to R+2 weeks
- The first follow-up within 7–14 days: the session version of the focus track, plus 1–2
  Shorts.
- Reply to and pin comments; a Community post thanking fans and linking the album playlist.

### R+3 to R+6 weeks — let the response decide
- Whichever song gets the most views and comments gets one more piece: a live video from
  the tour footage, a lyric video, or a second visualiser.
- **Optional:** a short "Tommy's Dance Place" tour film, in the spirit of his 2024 tour movie
  ("Clips upon clips of no one saying anything of any value").

**Not recommended:** daily posting, a video for every track, or expensive shoots. The evidence
doesn't support the workload.

---

## 6. Best practice — the basics audit

**Essential (before the tour):**
- **Playlists.** The six public playlists are Lower Third, Sky Isle of Wight, Tom on Telly,
  Best of Me, Piano Sessions and Scruff Of The Neck TV. None is an EP, album or "official
  videos" playlist. Add an *Official videos* playlist and a *Put On A Record Tommy (Deluxe)*
  playlist now; the album playlist comes at release.
- **Descriptions.** None of the latest 25 uploads has a link: no listening, ticket or merch
  links. Add one standard block to every upload: listen link, tour link, and the "Tommy's
  Dance Place" mailing list or WhatsApp.
- **Captions.** Captions are off on every upload. Add lyrics or captions to the singles, at
  least the top 10. This is an accessibility basic, and fans quote the lyrics.
- **Pinned comment** on each single: a link to the next thing (a session, the playlist, tour
  dates).
- **Shorts related-video link.** Set it on every music Short, pointing to that song's video.
  YouTube Help: you can "Select a Related Video from your channel".

**Worthwhile:**
- **End screens** on the singles pointing to the playlist and the next single. The public API
  doesn't show whether they're already set, so check in Studio.
- **Titles.** Use one consistent style: "Tom A. Smith – Song (Official Video / Visualiser /
  Live at …)". Current titles mix formats, e.g. "TOM A SMITH LITTLE BITS OFFICIAL MUSIC VIDEO".
- **Home.** The "Music videos" shelf already leads with recent releases. Add a "Live" shelf and
  a featured video for new visitors.
- **The "Musician" bio line** could say who he is: Sunderland, Fiction Records, Tommy's Dance
  Place.

**Optional experiments:**
- **Premieres:** standard and broadly available.
- **Afterparty:** Premium only; set up via YouTube's partner team.
- **Top Fans exclusive videos:** YouTube says they're "only available to artists with a
  minimum number of top fans" — check eligibility.
- **Stations** (an invite-only test) aren't worth chasing at this size.

---

## 7. How we judge progress

**His own baselines** (public, 2025–26):
- Official videos and visualisers: median ~19K.
- Live uploads: ~1.6K.
- Shorts: ~850 overall. Live-moment Shorts reach 3–13K; announcement Shorts 0.6–1.2K.
- Like rate on recent singles: 2–4% (excluding Put On A Record Tommy).

| When | What to check (public) | What it should change |
|---|---|---|
| **48 hours** | Views and comments on the Premiere or video; whether Shorts are moving | Which Short to post next; the pinned-comment link |
| **7 days** | Video against his recent singles at a similar stage (the Watcher records day by day from now on); Shorts above ~2K | Whether to bring the session version forward |
| **28 days** | Video against his ~19K median; session versions against ~1.6K; comments naming songs | Which song gets the R+3–6 follow-up |

**Studio metrics that would strengthen this:** average view duration and retention; traffic
sources (including paid); new versus returning viewers; subscribers per video; Shorts →
long-form views; geography.

**[Interpretation]** At 6K subscribers, a result of a few thousand views can be promising but
still too small to show a pattern. Treat single results as a direction, not a verdict.

---

## 8. Could our deeper analysis help an artist this size?

**[Verified] What the youtube-insights preview can actually do.**
- It's a cross-channel benchmark built from public data: 138 channels and 3,554 videos,
  July 2026.
- It shows format adoption and rollout sequencing: the 7–14-day follow-up window, and whether
  a video has lyric-video or visualiser support.
- Its source is a static data file with no Studio connection.
- **So it can benchmark Tom's rollout shape, but it cannot answer the brief's audience
  questions.** Retention, new versus returning viewers, subscribers, Shorts → long-form,
  traffic sources and territories all need YouTube Studio data, through access or an export.

**Can do now (public data):**
- Track day-by-day results for every new upload from day 0.
- Compare each single against his own baseline.
- Run comment themes per song.
- Check the rollout shape (follow-up within 7–14 days) against the preview's benchmark.

**The three analyses to run first** (all need Studio access, or a Studio export from the
label):
1. **Were the two big videos promoted, and where did their viewers come from?**
   - *Data:* traffic sources for Put On A Record Tommy and I Don't Blame You, including paid
     and "YouTube advertising"; new versus returning viewers; spend from the label.
   - *Decision:* whether "official video with a big visual concept" is really his strongest
     format, or whether those views were bought.
   - *Limits:* two videos only.
2. **Do live and session videos hold attention?**
   - *Data:* audience retention and average view duration for the Isle of Wight full set,
     the Isle of Wight song clips, and the visualisers.
   - *Decision:* whether the session and tour footage should be released as full
     performances or as tight edits.
   - *Limits:* small view counts (1–3K) make retention curves noisy.
3. **Do Shorts lead people to the songs?**
   - *Data:* Shorts → long-form views and related-video clicks; subscribers gained per Short
     against per video.
   - *Decision:* how much effort Shorts get, and which kind (live moments or announcements).
   - *Limits:* only a handful of Shorts have more than 1K views.

Lower priority: **territories.** Comments suggest a US audience, but only Studio geography
would show its size. Act on it only if it's large.

---

## 9. Five actions, in priority order

1. **Fix the basics before the tour:** an official-videos playlist and an EP playlist, a
   standard description block with links, captions on the singles, pinned comments, and
   Shorts related-video links. *(Label, half a day.)*
2. **Post 2–3 live-moment Shorts now** from the Isle of Wight and Kooks footage, each linked to
   its song, plus a tour Community post. *(Editing only.)*
3. **Film one headline show properly** on the Nov–Dec tour, and grab simple camcorder clips at
   the others. *(One crew night.)*
4. **Book one session afternoon in Sunderland** before the album: 4–5 songs → a full
   performance, per-song videos and 6–10 Shorts. *(One artist day.)*
5. **Get a Studio export** for the three analyses in §8, and confirm whether Put On A Record
   Tommy or I Don't Blame You were promoted.

## Missing inputs that would most improve the plan

- **Album:** title, date, tracklist and focus tracks — or at least the planned window.
- **Promotion:** whether Put On A Record Tommy and I Don't Blame You had paid promotion, and
  how much.
- **Studio:** access or an export (traffic sources, retention, viewers, Shorts, geography).
- **Footage:** what already exists — multi-camera from the Isle of Wight, Waterloo Records /
  SXSW, the Kooks shows, the tour film archive, and Katie Anderson's material.
- **Time and budget:** Tom's availability, and whether the label can fund a session day and
  a tour shoot.

---

## Appendix A — full inventory notes

- **106 uploads:** 2021–2026. Shorts started in 2025.
- **Playlists:** Lower Third (6), Sky Isle of Wight (3), Tom on Telly (6), Best of Me (16),
  Piano Sessions (6), Scruff Of The Neck TV (4).
- **Releases tab:** the auto-generated Deluxe (12), Put On A Record Tommy (6), Say What You Want
  (5), EP3 (6), The Piano Sessions (6), 2 – EP (5).
- **Home:** Music videos; Releases; Videos; Popular videos; Shorts; Posts; Collaborations.
- **Last Community post:** about 5 months ago (summer show pre-sale via mailing list and
  WhatsApp).
- **Visuals:** Katie Anderson Promo (I Don't Blame You, SFX, Put On A Record Tommy, Our Song,
  Rockstar); Crew Gal Creative House (What); Andy Dawson (Fashion alternative version).

## Appendix B — sources

- Dork: [New era, same energy](https://readdork.com/features/tom-a-smith-new-era-same-energy) (30 Jul 2025) · [Put On A Record Tommy EP](https://readdork.com/news/tom-a-smith-details-put-on-a-record-tommy-ep) · [Deluxe and UK tour](https://readdork.com/news/tom-a-smith-deluxe-ep-uk-tour-announcement) (12 Aug 2026) · [Tommy's Dance Place guide](https://readdork.com/features/tom-a-smith-tommys-dance-place-put-on-a-record-tommy-guide-ce7bc0d514) (18 Oct 2026)
- [Taped Magazine — Say What You Want EP](https://tapedmagazine.uk/2025/09/15/tom-a-smith-announces-new-ep-say-what-you-want/) · [Record of the Day — signs to Fiction](https://www.recordoftheday.com/on-the-move/news-press/tom-a-smith-signs-to-fiction-records)
- Comparables: [Antony Szmierek — Decoding Birdsong](https://www.broadwayworld.com/article/Antony-Szmierek-Releases-Sophomore-Album-DECODING-BIRDSONG-20260821) · [mary in the junkyard — Role Model Hermit](https://faroutmagazine.co.uk/mary-in-the-junkyard-role-model-hermit-album-review/)
- [YouTube Insights preview](https://youtube-insights-pi.vercel.app/preview.html) and repo `leondiaper-ai/youtube-insights`
- YouTube Help: [Premium afterparties](https://support.google.com/youtube/answer/10184580) · [Release Strategy](https://support.google.com/youtube/answer/18736733) · [Shorts related video](https://support.google.com/youtube/answer/14075157)
