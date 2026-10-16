# Defected Records × YouTube — audit pack

**For independent review.** Read 16 October 2026. Everything below is the raw material
behind the deck at `/defected`. Its Analysis sheet carries the summary tables; this file
carries the rows, the rules and the places I think it is weakest.

You are being asked to **try to break this**, not to confirm it. The questions are at the
end, but the most useful thing you can do is take a claim from §4, trace it to the rows in
§3, and tell me where the claim outruns the evidence. The deck is a constructive review of
an established, well-run channel. If a finding reads as a manufactured problem, say so.

---

## 1. Provenance

| | |
|---|---|
| Channel | `@DefectedMusic` — `UCnOxaDXBiBXg9Nn9hKWu6aw`, created 7 January 2009 |
| Source | YouTube Data API v3, one pull, 16 October 2026, 11:11–11:21 UTC, through the project's own routes (`/api/full-catalogue`, `/api/channel-shelf`, `/api/channel`) |
| Lifetime view counter | **1,011,854,634** |
| Subscribers | **1,520,000** (YouTube's rounded public figure) |
| Public videos | **5,243** |
| Uploads retrieved | **5,000** (the route's cap): every upload from 14 June 2011 to 16 October 2026. The 243 not retrieved are the oldest, 2009 to mid-2011 |
| Sum of views over the 5,000 | **910,708,685** — 90.0% of the lifetime counter |
| Fields used | `publishedAt`, `durationSec`, `isShort`, `views`, `likes`, `comments`, `wasLive`, `scheduledStart`, `actualStart`, `title` |
| Playlists and sections | 71 public playlists; 12 home sections (10 single-playlist shelves plus two untyped sections) |
| Manual surfaces | Home, Videos, Shorts, Podcasts, Playlists walked in a browser the same day; the "Defected Radio" podcast and the "Defected Broadcasting House" playlist opened in full. Screenshots in `/defected/img/` |
| Podcast directories | Apple Podcasts and Spotify listings for *Defected: Moments In Music*, read 16 October 2026 |
| Snapshot history | **None.** The channel entered the project's daily sync on 16 October 2026 (history depth: 1 day). There is no velocity, momentum, release-week or growth series anywhere in this work |
| YouTube Studio | **None.** No impressions, CTR, retention, watch time, traffic sources, returning viewers, subscriber conversion, end-screen or Community data |

### The coverage facts, stated first

- Every view figure is a **lifetime total as at 16 October 2026**. Older uploads have had
  longer to accumulate. The deck therefore never ranks old uploads against new ones on
  totals, and never divides lifetime views by age to claim momentum.
- The **101.1M gap** between the sum of the 5,000 uploads and the lifetime counter is the
  243 oldest uploads plus deleted or private videos. No share-of-lifetime claim is made
  beyond the pre-2022 split in §4.1, which is robust to it (see the two denominators there).
- Shorts are identified by the API's `isShort` flag, not by duration. 500 of the 5,000
  uploads carry it; 441 of those are since 2022.
- 134 of the 135 uploads flagged `wasLive` have a `scheduledStart`: they are Premieres,
  not live streams. Nothing in the deck is read as a live stream.

---

## 2. The classification rule

Formats were assigned from title and duration, in this order, first match wins:

| Class | Rule |
|---|---|
| Short | API `isShort` flag |
| Podcast | title contains "Moments in Music" |
| Radio show | title contains "Defected Radio" |
| Live Sessions | title contains "Live Session(s)" and duration < 25 min |
| Broadcasting House | title contains "Broadcasting House" |
| Interview / feature | "in conversation", "interview", "documentary", "10 questions", "Pop Your Cherry", "carpool", "24 hours", "Hot Ones", "story of", "The Korg", "how to DJ" |
| Promo / trailer | "aftermovie", "trailer", "announce", "lineup" |
| DJ set (live from) | duration ≥ 20 min and title contains "live from / live at / live @ / b2b / live in / livestream" |
| Mix (studio / compiled) | duration ≥ 20 min, otherwise |
| Music video | "official video" / "official music video" |
| Visualiser | "visualiser" / "visualizer" |
| Lyric video | "lyric" |
| Release audio | title has " - ", "–", " x ", "feat.", "(…mix)" or "remix" |
| Other | none of the above |

Checked by sampling every 25th upload and by reading every title in the DJ-set,
compilation, Shorts and podcast groups. Since 2022, 15 uploads land in "Other" and 4 in
"Promo / trailer"; totals are quoted with n so the margin is visible. All-time, "Other"
holds 541 uploads (267.6M views) — mostly 2011–2016 release uploads titled with curly
quotes and no dash (`Camelphat & Elderbrook ‘Cola’`). They are releases; the rule simply
predates that title style. Nothing in the deck depends on the all-time format split.

Compilations (slide 5) use a narrower, hand-checked rule: duration ≥ 40 minutes, "mix" in
the title, **not** "live from / live at / Broadcasting House / radio / episode / Anything
Goes / Essential Grooves / Faith Radio / b2b". That excludes the Basement and event
recordings and the radio show, and includes the artist-mixed "In The House" strand.

---

## 3. The rows

### 3.1 Observed views by upload year (the 5,000)

| Year | Uploads | Views | | Year | Uploads | Views |
|---|---|---|---|---|---|---|
| 2011 (from 14 Jun) | 63 | 5,902,073 | | 2019 | 237 | 78,556,892 |
| 2012 | 164 | 24,490,200 | | 2020 | 406 | 84,601,533 |
| 2013 | 782 | 102,097,202 | | 2021 | 297 | 45,514,858 |
| 2014 | 238 | 38,338,186 | | 2022 | 489 | 59,464,165 |
| 2015 | 209 | 18,460,888 | | 2023 | 577 | 31,642,380 |
| 2016 | 201 | 53,931,901 | | 2024 | 390 | 22,901,847 |
| 2017 | 209 | 241,897,086 | | 2025 | 305 | 17,399,090 |
| 2018 | 195 | 79,962,550 | | 2026 (to 16 Oct) | 238 | 5,547,834 |

Pre-2022: **3,001 uploads, 773,753,369 views.** Since 2022: **1,999 uploads, 136,955,316.**

Top ten all-time: Camelphat & Elderbrook ‘Cola’ (`qke-jOUqSXU`, Jun 2017) 174,267,044 ·
‘Cola’ official video (`LcNXG-6SqWA`, Oct 2017) 36,700,866 · Endor – Pump It Up
(`BfnjX88Va4Y`, 2019) 27,525,933 · Fish Go Deep & Tracey K – The Cure & The Cause
(`ikJCO_FrQQ8`, 2013) 26,452,379 · Oliver $ & Jimi Jules – Pushing On (2014) 18,338,677 ·
Fatboy Slim – Praise You (PDM remix) (2018) 15,265,760 · *When performance meets house
music…* Short (`8kCGWI7crn0`, Nov 2022) 14,399,785 · Selace – So Hooked On Your Lovin’
(2018) 9,880,184 · Sonny Fodera – Always Gonna Be (2016) 9,618,793 · Purple Disco Machine
live from Dresden (2020) 9,321,537. Top ten = 33.8% of the counter; top 100 = 68%.

### 3.2 Radio show

490 episodes all-time; 248 since 1 January 2022 (250 counting two December 2021 episodes
inside the 2,000-upload window, which is the figure on slide 3).

Publish day (UTC), 2022–26: Friday **238**, Saturday 6, Monday 3, Sunday 2, Tuesday 1.

Per year: 2017 34 · 2018 48 · 2019 52 · 2020 53 · 2021 55 · 2022 52 · 2023 51 · 2024 51 ·
2025 52 · 2026 (to 16 Oct) 42.

Median lifetime views by upload year: 2017 30.9K · 2018 37.0K · 2019 42.6K · 2020 47.7K ·
2021 62.6K · 2022 67.1K · 2023 59.8K · 2024 43.8K · 2025 34.2K · 2026 26.4K.

By host, episodes since 1 January 2024 (host parsed from "Hosted by …"): Sam Divine n=57
median 46,916 max 147,755 · Monki n=29 median 31,035 max 55,134 · Rimarkable n=32 median
22,933 max 33,415 · Rio Tashan n=4 median 20,666 · one-offs (Mike Dunn 59,224, Eliza Rose
27,681, Kitty Amor guest 45,195, Andy Daniell guest 48,557) · 19 other / takeover
episodes median 28,544.

Weeks, Friday→Thursday, 17 Oct 2025 → 16 Oct 2026 (uploads / radio episodes):
1/1 2/1 5/1 7/1 5/1 6/1 5/1 2/1 **0/0** 2/2 **0/0** 3/2 4/1 18/1 4/1 5/1 8/1 4/1 4/1 4/1 3/0
3/2 5/1 9/1 11/2 6/1 3/1 8/1 11/1 4/1 2/0 5/2 3/1 2/1 5/1 3/1 4/1 5/1 7/1 3/1 2/1 3/1 4/1
2/1 3/1 6/1 5/1 6/1 22/1 4/1 6/1 19/0. → **50 of 52 weeks with an upload; a radio episode
in 47 of 52.** The two dark weeks are 26 Dec–8 Jan. The 18, 22 and 19 weeks are the Melé
album, the Oden & Fatzo singles run and album day (16 October).

Last 90 days (18 Jul → 16 Oct 2026): 85 uploads — 41 release audio, 12 radio, 11 Shorts,
8 DJ sets, 3 interview/feature, 2 live sessions, 1 lyric, 1 music video, 1 mix, 1 promo,
4 other. 19 of the 41 releases are the Oden & Fatzo album tracks published on 16 October.

### 3.3 DJ sets, 1 January 2024 → 16 October 2026 (n=122)

Setting assigned from the title: Croatia · Malta (Malta, The Ditch, Café del Mar, Uno) ·
Chinois · Pacha · HQ (Defected HQ, The Basement) · NYE (Worldwide, NYE) · other.

| Setting | n | Years | Median | Over 100K | Largest |
|---|---|---|---|---|---|
| HQ / Basement | 59 | 2024: 45 · 2025: 8 · 2026: 6 | 27,389 | 9 | David Morales 205,694 |
| Croatia | 18 | 2024: 10 · 2025: 5 · 2026: 3 | 37,134 | 3 | Da Capo 182,982 |
| Other venues | 15 | 2024: 13 · 2025: 1 · 2026: 1 | 31,971 | 4 | Groove Armada, Ushuaïa 340,919 |
| Worldwide NYE 23/24 | 12 | all Jan–Mar 2024 | 36,883 | 4 | Armand Van Helden, Wembley 1,045,612 |
| Malta | 10 | 2024: 1 · 2025: 4 · 2026: 5 | 79,043 (59,091 without Green Velvet) | 3 | Green Velvet 549,584 |
| Chinois | 5 | all Sep 2026 | 25,709 | 0 | Eliza Rose 29,785 |
| Pacha | 3 | all 2025 | 228,097 | 2 | Sam Divine 328,415 |

The 25 sets over 100K, by setting: HQ 9 (Morales 206K, Caiiro 178K, Sam Divine 25th
party 175K, Sun El-Musician 172K, Mike Dunn 160K, Enoo Napa 157K, Terry Hunter 146K, Maz
135K, Sam Divine & Kyle Watson 122K) · NYE 4 (Armand Van Helden 1.05M, Carl Cox 1.00M,
Sam Divine Wembley 244K, Low Steppa Wembley 116K) · other venues 4 (Groove Armada Ushuaïa
341K, Ferrer b2b Eats Everything Ushuaïa 296K, Vinny Da Vinci 242K, Defected B25B 121K) ·
Croatia 3 (Da Capo 183K, Dennis Ferrer 112K, Kid Fonque 106K) · Malta 3 (Green Velvet
550K, Sam Divine Ditch 110K, Ferrer b2b Honeyluv 106K) · Pacha 2 (Sam Divine 328K, Oden &
Fatzo 228K).

Afro / South African house strand (title or artist: Caiiro, Sun El-Musician, Enoo Napa,
Vinny Da Vinci, Da Capo, Kid Fonque, Atmos Blaq, FKA Mash, Themba, Kitty Amor, "Afro",
"SA", "amapiano", "3-step"): n=21, median 36,959, 6 over 100K. The other 101 sets:
median 33,084.

HQ split by year: 2024 n=45 median 21,995 (7 over 100K) · 2025–26 n=14 median 41,890
(2 over 100K). Younger uploads with the higher median; not read as a trend.

HQ title order, 2024: `Afro House Music DJ Mix | Caiiro | Live from Defected HQ` (genre
first). 2026: `Jackin House Mix | Leyo | Live from Defected HQ` and `DJ Gregory | Best
House & Club Mix | Live from Defected HQ` both exist, and Chinois sets are
`Riva Starr | Live from Defected Chinois` (no descriptor).

### 3.4 Compilations (rule in §2)

| Year | n | Median | Over 100K | Uploads |
|---|---|---|---|---|
| 2021 | 13 | 612,220 | 10 | lockdown-era "Defected Virtual Festival" / summer mixes |
| 2022 | 8 | 147,604 | 4 | incl. Disco House – Defected × Glitterbox `Byb0DLtNN_0` 2,717,032 · House Music 2022 Summer Mix 745,584 · Defected Ibiza 2022 560,223 · Todd Terry Takeover 287,617 · Malta Summer Mix 147,604 |
| 2023 | 9 | 48,904 | 4 | incl. Defected Ibiza 2023 434,672 · Croatia Festival Season Mix 155,818 · Worldwide Europe 115,593 |
| 2024 | 10 | 129,783 | 5 | Flavour Trip `JF5IYpI6IXA` 2,758,949 · Purple Disco Machine In The House `vRvr2nQ3-RI` 1,904,781 · Latin House Summer Mix `kvAd8bnrpgc` 383,285 · Mousse T. 25th 331,421 · TSHA In The House 129,783 · House Music 2024 88,914 · Defected Annual 1999 41,567 · Jesse Saunders 40 Years 16,274 · Mark De Clive-Lowe 9,028 · Girls Of The Internet 9,095 |
| 2025 | 3 | 138,212 | 3 | Ibiza Sunset House Mix `FlwsC4VmncA` 138,253 · Jonas Blue In The House `O1mxdjYAapk` 138,212 · Carl Craig In The House 129,233 |
| 2026 (to 16 Oct) | 3 | 17,111 | 1 | Defected Ibiza Summer Mix 2026 `qXoTwOZO84w` 245,714 (22 Apr) · Harry Romero Disco House 17,111 (7 Feb) · Reznik Afterhours 10,363 (25 Jul) |

Hit-rate comparison used on the slide ("roughly one in five sets, one in twenty radio
episodes"): sets 2022–25 over 100K / n = 31/206 = 15%; radio 2022–25 = 10/206 = 4.9%.
Compilations 2022–25 = 16/30 = 53%.

### 3.5 Releases (release audio + lyric + official video) — now Analysis-only on the deck

| Year | n | Median | Over 100K | Over 1M |
|---|---|---|---|---|
| 2024 | 115 | 17,976 | 15 | 0 |
| 2025 | 68 | 43,212 | 22 | 3 — Just Stay The Night `8QiN1PiXDpU` 1,369,879 · Deep Inside `voQQVBtF72Q` 1,356,980 · Edge Of Desire `lACS1E3HQGM` 1,274,249 |
| 2026 (to 16 Oct) | 100 | 9,372 | 6 | 0 |

### 3.6 Shorts, 1 January 2025 → 16 October 2026 (n=198)

Groups assigned from titles. Heritage/catalogue: "classic", "remember", "story of",
"sample", "what is house", "history", "anthem", a 1980s/90s/2000s year, "legend", "roots",
"Frankie Knuckles", "iconic". Promotional: "out now", "watch now", "catch his/her/the",
"full set", "tickets", "shop", "on sale", "tune in", "lands", "dropping this/tomorrow",
"incoming", "out on", "available", "live now", "sign up", "join us", "countdown",
"returns" — and not heritage. Everything else: the rest.

| Group | n | Median | Over 20K | Top items |
|---|---|---|---|---|
| Heritage / catalogue | 22 | 13,104 | 4 | Aly-Us Follow Me `udw-U-01BUI` 10 Mar 2025 54,131 · Story of the Sample `Bmv5Xq9Db1E` 26 Mar 2025 38,907 · What is House Music? `U4ZVZHKHPNk` 27 Jan 2025 29,000 · Hollis P Monroe at Malta `sDWMBAzpWwM` 12 Jan 2026 22,143 · Honey Dijon Boiler Room anniversary 16,870 · Todd Terry Café del Mar 14,868 · Do You Remember House? Ep.5 `T0j-SSNSg34` 14,511, Ep.3 13,380, Ep.1 `10F6v5TSQF4` 13,104, Ep.6 7,318, Ep.6b 6,148, Ep.2 6,510 |
| Promotional | 42 | 6,342 | 4 | Croatia One Last Dance `w64Wf3NOIh8` 20 Nov 2025 45,088 · Malta "meet me at the Ditch" `6D8Ey-eYj28` 18 Aug 2025 40,350 · Ferrer b2b Eats Everything live now 26,597 · "Heading out on a Friday" 22,386 |
| Everything else | 134 | 7,047 | 8 | Pacha / Freak Like Me `zZBio2m5yww` 12 Aug 2025 49,685 · ANOTR drops Edge Of Desire 39,542 · Bibi/Carola/Martinez drop Freak Like Me 38,922 · Re-Bokk Robot weekend 33,433 · Groove Armada at Pacha 27,703 |

Monthly, Jan 2025 → Oct 2026: 10 · 22 · 13 · 17 · 13 · 10 · 11 · 10 · 21 · 5 · 11 · 4 ·
4 · 7 · 3 · 12 · 10 · 1 · 3 · 0 · 5 · 6.

The four biggest Shorts ever (reposted crowd/dance clips, credited to other accounts):
14,399,785 (Nov 2022) · 6,615,605 (Aug 2023) · 3,346,415 (Jan 2022) · 1,498,658 (Nov
2022). Outside all three groups.

### 3.7 Moments in Music

| Ep | Guest | Published | Views |
|---|---|---|---|
| S1E01 | Sam Divine | 21 Jan 2024 | 30,891 |
| S1E02 | Skream | 4 Feb 2024 | 21,827 |
| S1E03 | Roger Sanchez | 18 Feb 2024 | 8,635 |
| S1E04 | Joseph Capriati | 3 Mar 2024 | 15,944 |
| S1E05 | Rudimental | 19 Jun 2024 | 2,407 |
| S1E06 | MK | 24 Jul 2024 | 17,171 |
| S1E07 | Carl Craig | 26 Feb 2025 | 15,632 |
| S1E08 | Josh Baker | 16 Sep 2025 | 27,032 |
| S1E09 | Purple Disco Machine | 18 Feb 2026 | 18,415 |

Announcement Shorts for the series (n=17, titles naming the podcast or an episode drop):
median about 4K; largest "Listening to music hurt me" (Sam Divine) 16,426. The one excerpt
cut from a conversation, Skream `dc1auJdrj7E` (4 Feb 2024): 14,265. Apple Podcasts and
Spotify list the same nine episodes; neither carries a season-two trailer or date.

### 3.8 Channel organisation, as observed 16 October 2026

**Podcasts tab:** two tiles. "Defected Radio" — 45 episodes, cover is a release sleeve
(Prunk & Riva Starr ft. Danny Losito – I Want Your Love), owner shown as Defected Records,
"Last updated on 25 Sep 2026", description "Defected Radio – your weekly round-up of the
most upfront house music…". Opened, its rows are tracks on other channels: Prunk – Topic
(251K), 8bit Records (Nick Curly – Tempo, 13K), TMPLE (Black Cat, 332K), TruThoughtsJukeBox
(Maddslinky, 14 yr ago), PapaRecordsTv, Souldynamic, … Hot Since 82 (Life's Too Short
visualiser), simo not simon – Topic, Joseph Capriati (Control). "Moments in Music" — 9
episodes, branded cover.

**"Defected Broadcasting House" playlist** (631 items, 114,056 views), read in full on
16 October 2026 (14:45 UK, signed-in Chrome, scrolled to the end): 622 videos available
(the rest private or removed). By title: 357 Broadcasting House shows, 198 DJ sets, 20
mixes, 45 other, **2 radio episodes** — "Sam Divine – Defected Radio Show on Defected
Broadcasting House (Live from Sydney) (04.03.22)" and "Defected Radio Show Hosted by
Monki – 03.02.23". An earlier id-level check of the newest 100 (added since March 2024)
found 82 DJ sets, 7 Broadcasting House shows, 7 mixes, 1 release, 1 Short and 0 radio
episodes.

**All 71 public playlists** (none titled for the radio show episodes): Oden & Fatzo –
Somehow It Flies (ALBUM) 17 · Melé – Alive On Arrival 15 · House of Roots 4 · Dames
Brown 15 · Jonas Blue & Malive – Edge Of Desire 12 · Oden & Fatzo | Defected 35 ·
Defected Malta 57 · Defected XXV 30 · Together: 25th 33 · Bad Decisions 1 · Defected In
The House 7 · Sam Divine DJ Sets 9 · Club & Tech Basement Sets 7 · Moments in Music 9 ·
Defected Annual 1 · Worldwide NYE 23/24 13 · Worldwide Mix Series 5 · Ballantine's True
Music Croatia 2023 5 · Live Sessions 18 · Defected Croatia 87 · Kayper BH Shows 15 ·
Croatia 2022 10 · Unsung Heroes 7 · Broadcasting House 631 · The Basement 78 · Sondela 4 ·
Bacardi D-RUM 5 · Back To Reality 17 · Croatia 2021 13 · Toshiba Y/OUR HOUSE 6 · Remedy
Project 6 · Defected & Glitterbox Live DJ Sets 59 · Defected 2026: The Playlist 101 ·
Playlist Mixes 22 · D4 D4NCE 9 · 2021 Live DJ Moments 10 · Opel 6 · Defected HQ 47 · 20th
Anniversary Show 2 · DJ EZ 24 Hour 3 · The Vision 14 · Ultimate Party Playlist 12 · House
Masters Mike Dunn 39 · We Dance As One 23 · Heineken 8 · DVINE Sounds 6 · WWWorldwide 16 ·
Inside A&R 11 · The Vision Is Here 2 · Virtual Festival 49 · (one unnamed) · Croatia 2019
7 · Croatia 2018 LIVE 10 · New House Music 52 · Glitterbox LIVE 1 · Defected LIVE 29 ·
Defected Croatia 71 · Defected Moments 3 · Most Rated 24 · Best House & Club Tracks 60 ·
Glitterbox 98 · Defected Classics 144 · Bargrooves 84 · 4 To The Floor 85 · Defected Radio
45 · Defected Events 18 · Live Performances 11 · Defected Interviews 29 · Album Samplers
69 · Defected Releases 1,008 · DFTD 425 · Official Music Videos 117.

**Home, top to bottom:** featured video (David Rodigan, House of Roots) · Oden & Fatzo –
Somehow It Flies · Defected Releases · "Defected Broadcasting House" (showing Rodigan,
Leyo HQ, Low Steppa / Riva Starr / Monki / Darius Syrossian Chinois) · Moments in Music ·
Defected Live Sessions · Jonas Blue & Malive – Edge Of Desire (extended mix, lyric video,
In The House set, tour video, radio takeover, interview) · Playlist Mixes · Defected
2026: The Playlist (includes uploads from Moby, ANOTR / No Art, CircoLoco Records) ·
Defected XXV · Official Music Videos.

---

### 3.9 Premieres and co-publishing (API live-streaming details, read 16 October 2026)

| Measure | Value | Note |
|---|---|---|
| "Was live" uploads in the 5,000 | 195 | |
| With a scheduled start (Premieres) | 189 | 2017: 4 · 2018: 9 · 2019: 5 · 2020: 12 · 2021: 26 · 2022: 14 · 2023: 21 · 2024: 65 · 2025: 21 · 2026: 12 |
| Since 2022 | 133 of 134 | the earlier audit row said "134 of 135"; corrected |
| Premiered, uploads since Jan 2024 by format | podcast 9/9 · music videos 3/3 · live sessions 8/10 · DJ sets 59/122 · studio mixes 8/17 · release audio 3/274 · radio 1/145 · Shorts 1/303 | |
| Flagship set Premieres with a tracklist or chapters | 0 of 5 | hlbMcaCYq-Q, wW4vI546r-s, dO1TSqF2mF8, AEMfEGGsE8I, 1AhqoSVFoc0; David Morales HQ (6o9S_-DGV4Q, not a Premiere) has 8 chapters |
| Co-published videos on Home | 18 | Oden & Fatzo, Jonas Blue, Malive, Purple Disco Machine, Denis Sulta, Astels, Moby "and 3 more", Chinois Ibiza |
| Hannah Wants ft. ARA – Hold Me | 221K | WLa8AoK9Sz0, premiered 22 Feb 2025, chat replay available |

Tool conditions (YouTube Help, YouTube for Artists, 16 Oct 2026): Premiere trailer 15 s–3 min,
over 1,000 subscribers, no active strikes · Live Redirect: over 1,000 subscribers, no
live-streaming restriction; stream → Premiere, Premiere → Premiere or another channel's
stream with permission · Collaborations: up to 10 channels, recommended to every
collaborator's audience, revenue to the poster · Premium Afterparty: Premium-only artist
live stream hosted with YouTube, no self-serve route.

### 3.10 Lyric-video status, checked 16 October 2026

| Record | Fan upload | Lyric-led, version | Official lyric video |
|---|---|---|---|
| Cola (Defected, Jun 2017) | Groove Bassment RpmFVcMggZE, 2017, 6.1M | yes; original single 3:43 | none found: @DefectedMusic, @camelphat_music, @elderbrook-music searched; WOW TV "Official Lyric Video" 315K is a fan channel |
| Pump It Up (Defected, 2019) | Sunrise Sounds -OWvghF_rpA, 13 Apr 2025, 7.1M | yes; radio edit 2:30, DFTD sleeve shown | exists: Armada Music TV wRkax1FYiBI, 31 Mar 2020, 89.6K; @endormusicuk has none |
| Edge Of Desire (2025) | 7clouds Afro House b5yMWNPU_y4, 2025, 1.7M | yes; radio edit 2:15 | exists: Jonas Blue eNEnxdqyQEw, 13 Nov 2025, 116K |

The nine-record coverage table (official audio, video, lyric, alt, live, Shorts, story,
playlist) is reproduced in the deck's Analysis sheet under slide 10.

### 3.11 Anniversaries

| Record | Original release | Source | Channel assets (id, lifetime views, 16 Oct) |
|---|---|---|---|
| The Cure & The Cause | Defected 2006: 12" DFTD129; Dennis Ferrer remix single DFTD145, 28 Aug 2006; 2024 reissue | AllMusic release listing; the channel's "2006" uploads | ikJCO_FrQQ8 26M · -LQlVFTaLcs 59K · JbM0DtQZ9AY 1.6M (2008 video) · diiWzCXoMac 63K (acoustic) · llyBrtHVqgc 77K (Idris Elba) · FWtOmRLIjss 8K (Zoe Kypri live) · 10F6v5TSQF4 13K (DYRH Ep.1) · DKf6g9OjDwI 16K (Shy FX) · IWlcdPprdzg 6.7K (Rodigan at Croatia) · remixes by Charles Webster 37K, Full Intention 10K, Balearic Soul 10K, Atmos Blaq 21K |
| Cola | June 2017 (Wikipedia 17 June; Traxsource 2017) | Wikipedia, Traxsource; channel upload Jun 2017 | qke-jOUqSXU 174.3M · LcNXG-6SqWA 36.7M · ARTBAT 2025 remix 259K · Elderbrook chilled mix on @elderbrook-music |

## 4. Every claim on the deck, with its arithmetic

**4.1 Slide 2 — "85% of observed upload views sit on the 3,001 uploads published before 2022."**
773,753,369 / 910,708,685 = 84.96%. Against the lifetime counter: 773,753,369 /
1,011,854,634 = 76.5% (stated in the source line). 'Cola' 174,267,044 / 1,011,854,634 =
17.2%. Since 2022: 1,999 uploads, 136,955,316 ("137M"). The slide's own caveat says this
is where accumulated views sit, not what is watched now, and not a verdict on recent
output. **Challenge:** is 85% of observed views the right headline when the 243 oldest
uploads are missing? Including them could only raise the pre-2022 share.

**4.2 Slide 3 — "50 of 52 weeks with an upload"; "238 of 250 on a Friday"; "52 a year since 2019"; "85 uploads in 90 days".**
§3.2. "52 a year" rounds 51–55; 2026 is 42 at week 41. **Challenge:** weeks are
Friday-to-Thursday in UTC; a Thursday-night UK upload could fall either side.

**4.3 Slide 4 — "The strong sets come from every setting."**
§3.3. 25 of 122 over 100K; HQ 9 of them. Medians and n on the slide match the table.
"What recurs is the name on the bill … and in six of the 25 a South African / Afro house
selection": the six are Sun El-Musician, Caiiro, Enoo Napa, Vinny Da Vinci, Da Capo, Kid
Fonque. The slide says the Afro strand's overall median (37K) is close to the rest (33K).
**Challenge:** "setting" is a title parse; "Other venues" mixes Ushuaïa with Madrid and a
B2B stream; the NYE sets are all 2.7 years old against Chinois at five weeks. The slide
says so, but check that the headline does not still imply a venue effect.

**4.4 Slide 5 — "In every year since 2022, at least four in ten passed 100K"; "ten in 2024, three in 2025, three so far this year".**
§3.4: 4/8, 4/9, 5/10, 3/3, 1/3. 2026 is incomplete and its uploads are young; the slide
marks it. **Challenge:** the rule includes the artist-mixed "In The House" strand and the
Flavour Trip collaboration (2.76M). Without Flavour Trip and PDM, 2024 is 3/8. Decide
whether the strand belongs in the same bucket as the seasonal "Defected Summer Mix"
compilations — the deck argues it is the same product with the artist first.

**4.5 Slide 6 — "One record, several ways for fans to discover it": Edge Of Desire's twelve-video Home shelf; eight formats with their hosting channels; "one of three 2025 releases past a million views (the Extended Mix, 1.27M)".**
§3.5 for the million-view milestone (the three over 1M in 2025). The shelf and its
playlist (PLoRGBexfBL8c7zDulW2j4G_2JlMOhnqjC, 12 videos, 102,794 playlist views) were read
on 16 Oct; each tile on the slide carries the upload's hosting channel because two of the
formats — the live performance (Y1HUL-TALoE, 2.3M) and the lyric video (eNEnxdqyQEw,
116K) — are on Jonas Blue's channel and are pulled into Defected's shelf, and three of the
Defected uploads carry YouTube's co-publisher credit. Asset ids and views are listed in the
deck's Analysis sheet under slide 6. The 43K-vs-18K year comparison that used to be on the
slide is now only in the Analysis sheet, with its method and the 68-vs-115 sample caveat.
**Challenge:** the slide celebrates the approach without attributing the views to it, and
says so; check the shelf screenshot was not taken in a signed-in state that personalises
the row (it was captured from the channel page with the sidebar cropped out). Also check
that slide 7's "co-publishing" lane and this slide do not read as the same point: slide 6
is the gathering of formats, slide 7 the credit that recommends to both audiences.

**4.6 Slide 7 — the six strengths.** Each number appears on an earlier slide or in §3.9:
52 a year (4.2); three million-view records (4.5); 59 sets, nine over 100K (4.3); 16 of 30
(4.4); 189 Premieres (§3.9); 18 co-published videos on Home (§3.9).

**4.7 Slide 8 — "no public playlist collects them (the Broadcasting House archive holds two from 2022–23), the podcast tile carrying the show's name is a list of tracks hosted on other channels, and Home … has no shelf for the radio show."**
§3.8. The 631-item playlist has been read in full: 2 radio episodes among 622, both from
2022–23. Home's 11 shelves were read the same day; none is the radio show. The slide now
also carries the Home shelf audit and the HQ title-order note (§3.3), merged from the
former slide 9. **Challenge:** a private or unlisted playlist is invisible to the API and
to a signed-out visitor; the slide says "public", and the fix is the same either way.
The proposed shelf order is explicitly a test; the measure named is Studio's Home-tab
impressions by shelf.

**4.8 Slide 9 — "189 Premieres"; "9 / 9 podcast episodes premiered"; "59 / 122 DJ sets since 2024"; "five of the six flagship event-set Premieres we checked carry neither" a tracklist nor chapters; the four tool conditions.**
§3.9. Premieres are uploads with a scheduled start in the API's live-streaming details:
189 of 195 "was live" uploads; the other six were live streams. 9/9, 59/122 and the
per-format counts are from the same flag crossed with the §2 classification. Chapters
were checked by opening six watch pages on 16 Oct and reading the description for
timestamps: Green Velvet (hlbMcaCYq-Q), Sam Divine at Pacha (wW4vI546r-s), Oden & Fatzo
at Pacha (dO1TSqF2mF8), Dennis Ferrer at Croatia (AEMfEGGsE8I), Eats Everything at Malta
(1AhqoSVFoc0) — none; David Morales at HQ (6o9S_-DGV4Q) — eight chapters. Tool conditions
are quoted from YouTube Help (Premieres; Live Redirect; Collaborations; Premium
Afterparty) and YouTube for Artists' release-day guidance, read 16 Oct, and the slide
states the trailer and Live Redirect conditions separately with "confirm in Studio".
**Challenge:** "rarely treats a Premiere as an occasion" rests on what is visible — no
trailer on the pages opened, no tracklist, announcement Shorts as the only visible
promotion. Trailers may have run and expired; reminders and chat volume are not public.
The quarterly cadence is one option, not a target.

**4.8a Slide 10 — the three lyric-video cases.**
§3.10. Each fan upload was opened and watched (Chrome, 16 Oct) to confirm it is lyric-led
and which version it uses; the artist, label and partner channels were searched for an
official lyric video. Cola: Groove Bassment RpmFVcMggZE (2017, 6.1M, original single
3:43) — none found on @DefectedMusic, @camelphat_music or @elderbrook-music. Pump It Up:
Sunrise Sounds -OWvghF_rpA (13 Apr 2025, 7.1M, radio edit 2:30) — an official lyric
video exists on Armada Music TV, wRkax1FYiBI (31 Mar 2020, 89.6K). Edge Of Desire: 7clouds
b5yMWNPU_y4 (2025, 1.7M, radio edit 2:15) — an official lyric video exists on Jonas Blue's
channel, eNEnxdqyQEw (13 Nov 2025, 116K). The slide therefore recommends testing one, names
Cola as the one with a clear gap, and leaves hosting to the artist and label.
**Challenge:** a fan upload's views show an audience watched a lyric video; they do not
show that an official one would reach it, nor that viewers wanted the lyrics rather than
the record. A 315K "Official Lyric Video" for Cola by WOW TV is a fan channel; if the
label knows it to be licensed, the Cola row changes.

**4.8b Slide 11 — "The Cure & The Cause turns twenty this year"; "Cola turns ten in June 2027".**
§3.11. The Cure & The Cause: Defected 2006 (12" DFTD129; the Dennis Ferrer remix single
DFTD145 dated 28 Aug 2006 on AllMusic's release listing), so 2026 is its twentieth year;
the channel's own uploads carry "2006" in their titles. Not read from upload dates
(2008–13). Cola: Wikipedia gives 17 June 2017, Traxsource "P&C 2017"; the channel's audio
upload is June 2017. The slide says "June 2027" and asks for the exact day to be confirmed
against the label's records. The eight assets on the slide are listed in §3.11 with ids
and lifetime views. **Challenge:** the anniversary has ten weeks of 2026 left; the slide's
ask is a playlist, one story piece and links, which is sized for that.

**4.9 Slide 12 — "heritage 13.1K median (n=22) vs promotional 6.3K (n=42) vs everything else 7.0K (n=134); 4, 4 and 8 over 20K"; monthly strip.**
§3.6. Framed as "promising enough to test properly, not proven." **Challenge:** the
groups are keyword-assigned; a Short can be both heritage and promotional (handled by
heritage-first). With n=22 and equal 20K+ counts, is "twice the median" a fair headline
even with the caveat? The related-video link is stated as introduced in September 2023
and "confirm the option still appears" — that is a Studio check, not a claim.

**4.10 Slide 13 — nine episodes in 25 months; gaps of 3, 7, 7, 5 months; median 17K; announcements ~4K; the Skream clip 14.3K.**
§3.7. 21 Jan 2024 → 18 Feb 2026 is 25 months. Gaps: Mar→Jun 2024 (3), Jul 2024→Feb 2025
(7), Feb→Sep 2025 (7), Sep 2025→Feb 2026 (5). Season two: "the label's planned season
two", no date. **Challenge:** "almost none had an excerpt" rests on titles; an excerpt
titled as a quote would be missed. Only the Skream clip was found.

**4.11 Slide 14 — the three priorities and the Studio checks.** No new figures. Each
measure named is either public (playlist views, 28-day views) or Studio (impressions,
related-link clicks, reminders, concurrent viewers). **Challenge:** priority 2 bundles
four things (anniversary, a Premiere occasion, a lyric video, mixes on a calendar); check
that "three priorities" is honest about the amount of work beneath it.

---

## 5. The places I think this is weakest

1. **The radio-show medians by year and by host** (Analysis sheet, not the slides) invite
   a "decline" reading that the data cannot support without Studio traffic sources. They
   are in the sheet because a reviewer would ask; they are kept off the slides. If you
   think they should go entirely, say so.
2. **The compilation definition is hand-drawn.** It is the right shape for the finding,
   but it is a judgement, and 2024's rate depends on two unusual uploads (Flavour Trip,
   Purple Disco Machine).
3. **The Shorts groups are keyword groups.** The heritage sample is 22. The slide's
   language ("promising test, not proven") is the defence; check it is strong enough.
4. **Setting.** The earlier draft said "setting beats studio"; the data killed that. The
   corrected slide still shows setting medians, which a room may read as a ranking.
5. **No snapshots.** Nothing about momentum, first-week shape or catalogue growth can be
   said. The deck says so three times; the risk is a listener inferring it anyway.
6. **The lyric-video evidence is fan views.** Three cases were checked by hand and two of
   the three turned out to have an official lyric video already (Armada; Jonas Blue). The
   slide says so and recommends one test; the risk is the room hearing "7.1M" as demand.
7. **Premiere promotion is partly invisible.** Trailers expire with the Premiere; reminder
   counts and chat volume are Studio-only. "Rarely treated as an occasion" is a reading of
   what remains visible.

## 6. Things deliberately not claimed

- That any setting, title, thumbnail or host *caused* a result.
- That the archive's share of accumulated views says anything about current consumption.
- That Shorts viewers convert to long-form.
- That season two launches on any date.
- Any growth, revenue or view forecast for any recommendation.
- Anything about end screens, cards, Community posts, the channel trailer, or private
  playlists — the public API does not expose them.
- Any share-of-lifetime figure beyond the pre-2022 split.
- That a fan lyric video's audience would transfer to an official one.
- That any record is resurging — there is no historical series.
- That a trailer, Live Redirect or Afterparty is available to the channel until confirmed
  in Studio or with YouTube.

## 7. Questions for the reviewer, in priority order

1. Trace 4.7. The full-playlist read found 2 radio episodes in 622. Is there any other
   public surface (a Live tab playlist, a Community post series) that would count as
   "a place that holds the episodes"?
2. Trace 4.3. Does the slide headline still imply a venue effect the table does not show?
3. Trace 4.4. Should "In The House" and Flavour Trip be in the compilation bucket? Rerun
   the per-year rates without them and say whether the recommendation survives.
4. Trace 4.9. With n=22, is the Shorts comparison worth a slide, or should it be a line on
   slide 12?
5. Read slide 2 as the label would. Does "85% … before 2022" land as context, or as a
   criticism of the current team?
6. Are there recommendations the evidence supports that the deck leaves out — and are any
   of the three priorities on slide 14 ones the evidence does not support?
7. Trace 4.8a. Is a Defected-hosted lyric video for Cola the right first test, given the
   artists' own channels, or should the slide stop at "explore"?
8. Trace 4.8. Are the trailer and Live Redirect conditions quoted correctly, and is it
   right to present the quarterly cadence as an option rather than a target?
