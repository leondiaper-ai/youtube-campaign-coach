/**
 * FAN RESPONSE — what fans are positively responding to, right now.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 *
 * Campaign Home already says what the campaign DID. This says what the
 * audience is saying back — in about eight words, or not at all.
 *
 * The question it answers is deliberately not "is sentiment positive". That
 * is a number nobody acts on. It answers "what are fans responding TO",
 * because the theme is the part a manager can use: a return landing is a
 * different campaign from a song connecting, and both are different from
 * an audience that has come for the visual.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THAT SHAPES EVERYTHING
 *
 * Campaign Home is a positive-facing surface. So this module may either
 * show a genuine positive signal or show NOTHING. It may never soften a
 * mixed result into a warm one, and it may never print a negative state.
 *
 * That is omission, not reinterpretation — and the distinction matters,
 * because the two failure modes look identical on the page and are
 * completely different in honesty terms. When the evidence is mixed we
 * return `display:false` and keep the real classification in the object,
 * where Watcher and the Coach can still read it. The page just gets
 * nothing. Never a placeholder, never a neutral state, never a warning.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY RULE-BASED AND NOT A MODEL
 *
 * Classification here is keyword and pattern matching, not an LLM call.
 * Three reasons, in order of importance:
 *   1. It is auditable. Every theme assignment can be traced to the token
 *      that caused it, which is what lets us defend a quote in a room.
 *   2. It is deterministic. The same comments produce the same read, so a
 *      page does not quietly change its mind between refreshes.
 *   3. It is free and instant, which is what lets this ride the existing
 *      campaign refresh instead of becoming its own system.
 * The cost is recall on unusual phrasing. That is the right trade when the
 * output is eight words on a client-facing page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SAMPLING — THE LIMIT THAT GOVERNS THE OUTPUT
 *
 * commentThreads returns at most 100 top-level comments per video, ranked
 * by RELEVANCE, which over-weights high-like comments — precisely the
 * enthusiasm being measured. There is also no author identity in the
 * payload, so two comments from one person are indistinguishable from two
 * people.
 *
 * Both facts have the same consequence: NO PERCENTAGE MAY EVER REACH THE
 * PAGE. Raw counts are kept internally with the denominator attached. The
 * object has no percentage field anywhere, by design.
 */


/* ══════════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════════ */

export type FanTheme =
  | 'return' | 'song' | 'visual' | 'live'
  | 'nostalgia' | 'anticipation' | 'surprise' | 'member';

export type FanTone =
  | 'overwhelmingly_positive' | 'mostly_positive' | 'mixed' | 'negative';

export type FanQuote = { text: string; likes: number; videoId: string; theme: FanTheme | null };

export type FanResponse = {
  /* ── the only four fields Campaign Home reads ── */
  display: boolean;
  headline: string | null;          // "WE SO BACK"  or  "THE RETURN IS LANDING"
  line: string | null;              // one sentence, <= 14 words
  commentCount: number | null;      // public count on the asset the quote came from

  /* ── everything below is stored and never rendered ── */
  quote: FanQuote | null;
  tone: FanTone;
  dominantTheme: FanTheme | null;
  themes: { theme: FanTheme; count: number }[];
  recurringPhrases: { phrase: string; count: number; totalLikes: number }[];
  candidateQuotes: FanQuote[];

  evidence: {
    assetsSampled: { videoId: string; title: string; publishedAt: string; retrieved: number }[];
    commentsRetrieved: number;
    commentsClassified: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    samplingNote: string;
  };

  confidence: 'high' | 'medium' | 'low';
  gates: {
    volume: boolean; concentration: boolean; spread: boolean;
    freshness: boolean; positive: boolean;
  };
  withheldReason: string | null;    // why the page shows nothing
  computedAt: string;
  quotaUnitsUsed: number;
};

export type RawComment = { text: string; likes: number; replies: number; at: string; videoId: string };

/* ══════════════════════════════════════════════════════════════════════
   LEXICONS
   Word-boundary matched, lower-cased. Kept explicit rather than clever so
   that a wrong theme assignment can be found and fixed by reading a list.
   ══════════════════════════════════════════════════════════════════════ */

const THEME_PATTERNS: { theme: FanTheme; patterns: RegExp[] }[] = [
  { theme: 'return', patterns: [
    /\b(we|they|you)('?re| are|'?ve)?\s*(so|sooo+|totally|officially|finally)?\s*back\b/i,
    /\bwelcome back\b/i, /\bcome ?back\b/i,
    /* NOT a bare /return(ed|ing)/. Replaying the real Kings of Leon scan,
       "Loooooove KOL returning to their Southern roots" was classified as
       a comeback — it is a comment about musical direction. That single
       token was enough to hand a KoL page CHVRCHES' comeback language,
       which is the exact failure this feature must not have. Require the
       return to be OF the artist or the music. */
    /\bthe return of\b/i,
    /\b(they|he|she|band|boys|girls|guys)('?re| are| have| has|'?ve|'?s)? return(ed|ing)?\b/i,
    /\breturn(ed|ing)? (to (us|the (stage|scene|game))|after \d)/i,
    /\bmissed (you|them|this)\b/i, /\bit'?s been (so long|years|\d+ years)\b/i,
    /\bfinally\b.*\b(new|music|back|here)\b/i, /\bresurrect|revival\b/i,
  ]},
  { theme: 'song', patterns: [
    /\b(song|track|tune|single|melody|chorus|hook|lyrics?|beat|production|sound)\b/i,
    /\b(banger|bop|slaps|goes hard|on repeat|replay)\b/i,
    /\blisten(ing|ed)? to (this|it)\b/i, /\bthis (song|track|one) (is|goes)\b/i,
  ]},
  { theme: 'visual', patterns: [
    /\b(video|visual|aesthetic|cinemat|colou?r|styling|outfit|set design|shot|film(ed|ing)?|director)\b/i,
    /\b(looks?|looking) (so |absolutely |incredible|amazing|beautiful|stunning|gorgeous)/i,
    /\b(artwork|cover art|imagery)\b/i,
  ]},
  { theme: 'live', patterns: [
    /\b(tour|touring|live|concert|gig|show|festival|tickets?|stage|setlist)\b/i,
    /\bcome to\b.*\b(uk|us|australia|europe|brazil|mexico|canada|japan|asia)\b/i,
    /\bsee (you|them) (live|on tour)\b/i,
  ]},
  { theme: 'nostalgia', patterns: [
    /\b(nostalgi|childhood|teenage|remember when|takes me back|old days|back in \d{4})\b/i,
    /\b(first album|debut|early (stuff|work|days)|classic era|og fan)\b/i,
    /\bbeen (a fan|listening|here) (since|for)\b/i,
  ]},
  { theme: 'anticipation', patterns: [
    /\b(can'?t wait|cannot wait|so excited|hyped|counting down|need this|give us|release it|drop it)\b/i,
    /\b(waiting|wait) for\b/i, /\bwhen (is|does) (it|this)\b/i, /\bhurry up\b/i,
    /\b(pre-?save|pre-?order)\b/i,
  ]},
  { theme: 'surprise', patterns: [
    /\b(didn'?t expect|out of nowhere|no warning|surprise|shocked|wasn'?t ready|plot twist)\b/i,
    /\bwhat (is|just) happen(ing|ed)\b/i, /\bblindsided\b/i,
  ]},
  { theme: 'member', patterns: [
    /\b(lauren|mayberry|iain|martin|caleb|nathan|jared|matthew followill)\b/i,
    /\b(her|his) (voice|vocals)\b/i, /\bvocals? (are|is)\b/i,
  ]},
];

const POSITIVE = [
  /\b(love|loving|loved|amazing|incredible|perfect|beautiful|brilliant|stunning|gorgeous)\b/i,
  /\b(excited|hyped|happy|thrilled|obsessed|goosebumps|chills|masterpiece|iconic|legend(ary)?)\b/i,
  /\b(banger|bop|slaps|goes hard|fire|insane|unreal|so good|the best|yes+)\b/i,
  /\b(can'?t wait|cannot wait|need this|finally|thank you|welcome back)\b/i,
  /\b(we|they|you)('?re| are|'?ve)?\s*(so|sooo+)?\s*back\b/i,
  /\b(let'?s go+|lfg|lesgo+|vamos|allez)\b/i,
  /[❤️🖤💜💙💚🧡🤍🔥😍🥰🙌👏✨🎉🥹😭]/,
  /* Added after replaying real scans: the list above scored "Best song in
     years. What a tune." as neutral, because it only had "the best" and
     not a bare "best". Every token below is unambiguous praise on its own,
     which matters — the risk when widening this list is not mislabelling
     criticism (NEGATIVE always wins that contest and forces 'neutral'), it
     is counting merely descriptive comments as positive and inflating the
     share that clears the 70% gate. So: praise words only, nothing that
     could be read flatly. */
  /\b(best|great|superb|sublime|flawless|outstanding|magnificent|beautifully)\b/i,
  /\b(a|what a|absolute|proper) (tune|classic|banger|song|track|record)\b/i,
  /\b(classic|timeless|nailed it|smashed it|back on form|quality)\b/i,
  /\b(so good|really good|bloody good|too good|this is it|here for this)\b/i,
];

const NEGATIVE = [
  /\b(terrible|awful|garbage|trash|worst|hate|hated|boring|bland|disappoint(ed|ing|ment)?)\b/i,
  /\b(lost (it|the plot)|fell off|not the same|used to be (good|better)|overrated|mid\b)\b/i,
  /\b(cash grab|sell ?out|ruined|unlistenable|cringe|flop)\b/i,
  /👎|🤮|💩/,
];

/* Comments that must never be featured, even if popular and on-theme.
   Built from what a real scan actually returned, not hypotheticals: a
   demand for a leak plus "MARRY ME" and a comment on the singer's body;
   view-selling spam ranking into top comments on another artist. */
const UNSAFE = [
  // directed at a person rather than the work
  /\b(marry me|marry her|marry him|i love you \w+|my (wife|husband|queen|king)|mommy|daddy)\b/i,
  /\b(hot|sexy|beautiful|gorgeous|pretty|fine|thicc|body|legs|thighs|lips|eyes)\b.*\b(her|him|she|he)\b/i,
  /\b(she|he) (is|looks) so (hot|sexy|beautiful|pretty|fine|gorgeous)\b/i,
  /\bgothy|lil thang|baby girl|shawty\b/i,
  // profanity
  /\b(fuck|fucking|fuckin|shit|bitch|cunt|bastard|dick|piss|asshole)\b/i,
  /\bf+u+c+k+|s+h+i+t+\b/i,
  // political / religious
  /\b(christ|jesus|god|allah|bible|pray(ing|er)?|church of|lord|heaven|holy)\b/i,
  /\b(politic|goverment|government|war|genocide|palestine|israel|ukraine|russia|vote|election|president|trump|biden)\b/i,
  /\bstand for humanity\b/i,
  // spam / promotion / leaks
  /\b(sub(scribe)? to|check out my|my channel|promo|free views|buy views|authentic views|hipviews|dawt cawm|\.com|https?:\/\/|t\.me|whats ?app)\b/i,
  /\b(leak|leaked|download link|dm me)\b/i,
  // self-reference that reads oddly when featured
  /\b(first|1st) (comment|view)\b/i,
  /* Personal circumstance. Real scans surfaced a fan naming his newborn
     after the band and describing the child's cleft palate, and another
     fan whose wife had asked for a divorce that morning. Both are warm,
     both are genuinely positive about the music, and neither belongs on
     a label's campaign page — the person wrote it to the band, not to be
     quoted back at a partner meeting. Length alone was catching the first
     one and that is luck, not a rule. */
  /\b(cancer|chemo|tumou?r|diagnos(ed|is)|hospital|palliative|hospice|surgery|cleft|disabilit)/i,
  /\b(died|dying|passed away|funeral|grave|in memory of|rest in peace|\brip\b|we (love|lost) and lost|lost my|miss (you|him|her) so)/i,
  /\b(divorce|breakup|broke up with|my ex\b|widow|miscarriage|depress|anxiety|suicid|therapy|rehab|sober)/i,
  /\b(my (son|daughter|baby|child|kid|mum|mom|dad|father|mother|brother|sister|grandad|grandma))\b/i,
];

/* ══════════════════════════════════════════════════════════════════════
   CLASSIFICATION
   ══════════════════════════════════════════════════════════════════════ */

/* Fans type "Loooooove", "sooo good", "YESSSS". None of those match a
   \bword\b rule, so the real KoL scan scored an obviously delighted
   comment as neutral. Collapse any run of 3+ identical letters to one
   before matching. Runs of exactly two are left alone so "good" and
   "feel" survive. This is applied for MATCHING ONLY — the quote shown
   on the page is always the fan's own spelling. */
const forMatching = (s: string) => s.replace(/([a-z])\1{2,}/gi, '$1');

const hits = (s: string, list: RegExp[]) => {
  const m = forMatching(s);
  return list.some(r => r.test(s) || r.test(m));
};

const ENTITIES: Record<string, string> = {
  '&#39;': "'", '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&nbsp;': ' ', '&#34;': '"', '&#38;': '&', '&apos;': "'",
};

export function decodeCommentText(raw: string): string {
  return (raw || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#\d+;|&[a-z]+;/gi, m => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSafeToFeature(text: string): boolean {
  if (!text || text.length < 3) return false;
  if (text.length > 90) return false;             // a pull-quote, not a paragraph
  if (/[Ѐ-ӿ一-鿿؀-ۿ]/.test(text)) return false; // non-Latin: cannot safety-check
  return !hits(text, UNSAFE);
}

export function polarityOf(text: string): 'positive' | 'negative' | 'neutral' {
  const neg = hits(text, NEGATIVE);
  const pos = hits(text, POSITIVE);
  if (neg && !pos) return 'negative';
  if (neg && pos) return 'neutral';               // genuinely conflicted — never counted as positive
  return pos ? 'positive' : 'neutral';
}

export function themeOf(text: string): FanTheme | null {
  /* First match wins, and the ordering of THEME_PATTERNS is the priority.
     'return' sits first deliberately: "we're so back, can't wait" is a
     comeback reaction that happens to contain anticipation language, and
     reading it as anticipation would lose the actual story. */
  for (const { theme, patterns } of THEME_PATTERNS) {
    if (hits(text, patterns)) return theme;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════
   COPY — one line per theme. Deliberately not templated from the data:
   eight words that a human would write, chosen by which theme won.
   ══════════════════════════════════════════════════════════════════════ */

const THEME_COPY: Record<FanTheme, { headline: string; line: string }> = {
  return:       { headline: 'THE RETURN IS LANDING',   line: "Excitement is focused on the band's return." },
  song:         { headline: 'THE SONG IS CONNECTING',  line: 'Fans are responding to the music itself.' },
  visual:       { headline: 'THE VISUAL IS LANDING',   line: 'Fans are responding to how it looks.' },
  live:         { headline: 'THEY WANT IT LIVE',       line: 'The conversation has turned to tour dates.' },
  nostalgia:    { headline: 'THE CATALOGUE IS ALIVE',  line: 'Long-time fans are reaching back through the catalogue.' },
  anticipation: { headline: 'ANTICIPATION IS BUILDING',line: 'Fans are counting down to what comes next.' },
  surprise:     { headline: 'IT LANDED AS A SURPRISE', line: 'Nobody saw it coming, and they liked that.' },
  member:       { headline: 'THE PERFORMANCE IS LANDING', line: 'Fans are responding to the performance.' },
};

/* ══════════════════════════════════════════════════════════════════════
   RECURRING PHRASES
   Shared fan vocabulary is often the truest read — "WE SO BACK" said eight
   different ways is a stronger signal than any single comment.
   ══════════════════════════════════════════════════════════════════════ */

function recurringPhrases(comments: { text: string; likes: number }[]) {
  const norm = (t: string) =>
    t.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const families: { key: string; test: RegExp }[] = [
    { key: 'we are so back', test: /\b(we|were|we re|we are)\s*(so+|totally|officially|unbelievably|frickin\w*)?\s*back\b/ },
    { key: "let's go",       test: /\b(let s go+|lets go+|lfg|lesgo+)\b/ },
    { key: "can't wait",     test: /\b(can t wait|cannot wait)\b/ },
    { key: 'welcome back',   test: /\bwelcome back\b/ },
    { key: 'finally',        test: /\bfinally\b/ },
  ];
  const out: { phrase: string; count: number; totalLikes: number }[] = [];
  for (const f of families) {
    let count = 0, totalLikes = 0;
    for (const c of comments) {
      if (f.test.test(norm(c.text))) { count++; totalLikes += c.likes; }
    }
    if (count >= 2) out.push({ phrase: f.key, count, totalLikes });
  }
  return out.sort((a, b) => b.totalLikes - a.totalLikes);
}

/* ══════════════════════════════════════════════════════════════════════
   GATES
   ══════════════════════════════════════════════════════════════════════ */

const GATE = {
  MIN_RETRIEVED: 60,          // total comments across campaign assets
  MIN_THEME_SHARE: 0.35,      // dominant positive theme, of classified positives
  MIN_THEME_RATIO: 2,         // ... and this many times the runner-up
  MIN_ASSETS: 2,              // spread, so one viral post cannot carry it
  MAX_AGE_DAYS: 14,           // freshness of the newest sampled asset
  MIN_POSITIVE_SHARE: 0.70,   // positive share of polarity-classified comments
  MAX_NEGATIVE_SHARE: 0.10,   // hard ceiling — above this we never display
};

/* ══════════════════════════════════════════════════════════════════════
   BUILD
   ══════════════════════════════════════════════════════════════════════ */

export function buildFanResponse(
  comments: RawComment[],
  assets: { videoId: string; title: string; publishedAt: string; comments?: number | null }[],
  now: Date = new Date(),
): FanResponse {
  /* The API returns `textDisplay`, which is HTML: apostrophes arrive as
     &#39; and quotes as &quot;. Left alone this breaks twice over — the
     safety and theme regexes stop matching across a contraction, and any
     quote that reaches the page renders the entity literally. Decode once
     here rather than at render, so the rules and the reader see the same
     string. Tags are stripped too (<br>, <a href> from linked comments). */
  comments = comments.map(c => ({ ...c, text: decodeCommentText(c.text) }));

  const assetsSampled = assets.map(a => ({
    videoId: a.videoId, title: a.title, publishedAt: a.publishedAt,
    retrieved: comments.filter(c => c.videoId === a.videoId).length,
  }));

  const base = (extra: Partial<FanResponse>): FanResponse => ({
    display: false, headline: null, line: null, commentCount: null,
    quote: null, tone: 'mixed', dominantTheme: null, themes: [],
    recurringPhrases: [], candidateQuotes: [],
    evidence: {
      assetsSampled,
      commentsRetrieved: comments.length,
      commentsClassified: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0,
      samplingNote: 'relevance-ranked, capped at 100 per video — not a census',
    },
    confidence: 'low', withheldReason: null, computedAt: now.toISOString(),
    quotaUnitsUsed: assets.length,
    gates: { volume: false, concentration: false, spread: false, freshness: false, positive: false },
    ...extra,
  });

  if (!comments.length) {
    return base({ withheldReason: 'no comments retrieved' });
  }

  /* ── polarity ── */
  let positive = 0, negative = 0, neutral = 0;
  const positives: RawComment[] = [];
  for (const c of comments) {
    const p = polarityOf(c.text);
    if (p === 'positive') { positive++; positives.push(c); }
    else if (p === 'negative') negative++;
    else neutral++;
  }
  const polarityTotal = positive + negative + neutral;
  const posShare = polarityTotal ? positive / polarityTotal : 0;
  const negShare = polarityTotal ? negative / polarityTotal : 0;

  const tone: FanTone =
    negShare > 0.25 ? 'negative'
    : posShare >= 0.85 ? 'overwhelmingly_positive'
    : posShare >= GATE.MIN_POSITIVE_SHARE ? 'mostly_positive'
    : 'mixed';

  /* ── themes, computed over POSITIVE comments only ──
     The page says what fans are positively responding to, so a theme that
     is only dominant because people are complaining about it must not win. */
  const counts = new Map<FanTheme, number>();
  for (const c of positives) {
    const t = themeOf(c.text);
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const themes = Array.from(counts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  const classified = themes.reduce((n, t) => n + t.count, 0);
  const top = themes[0] ?? null;
  const runnerUp = themes[1]?.count ?? 0;
  const themeShare = classified && top ? top.count / classified : 0;
  const themeRatio = top ? (runnerUp ? top.count / runnerUp : Infinity) : 0;

  const newest = assets
    .map(a => new Date(a.publishedAt).getTime())
    .filter(n => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  const ageDays = newest ? (now.getTime() - newest) / 86_400_000 : Infinity;

  const gates = {
    volume:        comments.length >= GATE.MIN_RETRIEVED,
    concentration: !!top && themeShare >= GATE.MIN_THEME_SHARE && themeRatio >= GATE.MIN_THEME_RATIO,
    spread:        assetsSampled.filter(a => a.retrieved > 0).length >= GATE.MIN_ASSETS,
    freshness:     ageDays <= GATE.MAX_AGE_DAYS,
    positive:      posShare >= GATE.MIN_POSITIVE_SHARE && negShare <= GATE.MAX_NEGATIVE_SHARE,
  };

  /* ── candidate quotes: on-theme, safe, and actually quotable ── */
  const candidateQuotes: FanQuote[] = positives
    .filter(c => isSafeToFeature(c.text))
    .map(c => ({ text: c.text.trim(), likes: c.likes, videoId: c.videoId, theme: themeOf(c.text) }))
    .filter(q => top && q.theme === top.theme)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5);

  const evidence = {
    assetsSampled,
    commentsRetrieved: comments.length,
    commentsClassified: classified,
    positiveCount: positive, negativeCount: negative, neutralCount: neutral,
    samplingNote: 'relevance-ranked, capped at 100 per video — not a census',
  };

  const allPassed = Object.values(gates).every(Boolean);

  const confidence: 'high' | 'medium' | 'low' =
    !allPassed ? 'low'
    : comments.length >= 120 && themeShare >= 0.45 ? 'high'
    : 'medium';

  /* ── withhold ──
     Order matters only for the message; any single failure withholds. */
  if (!allPassed) {
    const why =
      !gates.positive      ? (tone === 'negative' ? 'response is not predominantly positive' : 'response is mixed')
      : !gates.volume      ? `only ${comments.length} comments retrieved (need ${GATE.MIN_RETRIEVED})`
      : !gates.concentration ? 'no single positive theme is dominant enough'
      : !gates.spread      ? 'comments came from too few assets'
      : 'newest sampled asset is stale';
    return base({
      tone, themes, evidence, gates, confidence,
      dominantTheme: top?.theme ?? null,
      recurringPhrases: recurringPhrases(comments),
      candidateQuotes,
      withheldReason: why,
    });
  }

  /* ── display ── */
  const theme = top!.theme;
  const copy = THEME_COPY[theme as FanTheme];
  const quote = candidateQuotes[0] ?? null;

  /* The quote replaces the headline when one qualifies — a fan's own words
     outperform ours. Otherwise the themed headline carries it alone, which
     is the whole point of "quote optional, useful read mandatory". */
  const headline = quote ? `“${quote.text}”` : copy.headline;

  /* Comment count shown is the PUBLIC count on the asset the quote came
     from — exact and checkable — not the size of our sample, and not a
     campaign total, which would be a different number wearing the same
     label. */
  const quoteAsset = quote ? assets.find(a => a.videoId === quote.videoId) : null;
  const commentCount = quoteAsset?.comments ?? null;

  return base({
    display: true,
    headline, line: copy.line, commentCount,
    quote, tone, dominantTheme: theme, themes,
    recurringPhrases: recurringPhrases(comments),
    candidateQuotes, evidence, gates, confidence,
    withheldReason: null,
  });
}

/* ══════════════════════════════════════════════════════════════════════
   FETCH — top-level comments for a set of campaign assets.
   1 quota unit per video. Failure of one video never fails the set.
   ══════════════════════════════════════════════════════════════════════ */

export async function fetchCommentsForAssets(
  videoIds: string[],
  perVideo = 100,
): Promise<{ comments: RawComment[]; disabled: string[] }> {
  const KEY = process.env.YOUTUBE_API_KEY;
  const comments: RawComment[] = [];
  const disabled: string[] = [];
  if (!KEY) return { comments, disabled };

  for (const videoId of videoIds) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&order=relevance` +
        `&maxResults=${Math.min(perVideo, 100)}&videoId=${videoId}&key=${KEY}`,
        { cache: 'no-store' },
      );
      if (!r.ok) { if (r.status === 403) disabled.push(videoId); continue; }
      const j = await r.json() as {
        items?: { snippet?: { totalReplyCount?: number; topLevelComment?: { snippet?: {
          textDisplay?: string; likeCount?: number; publishedAt?: string } } } }[]
      };
      for (const it of j.items ?? []) {
        const s = it.snippet?.topLevelComment?.snippet;
        if (!s?.textDisplay) continue;
        comments.push({
          text: s.textDisplay.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 500),
          likes: Number(s.likeCount ?? 0),
          replies: Number(it.snippet?.totalReplyCount ?? 0),
          at: (s.publishedAt ?? '').slice(0, 10),
          videoId,
        });
      }
    } catch { /* one video failing is not the set failing */ }
  }
  return { comments, disabled };
}

/** Campaign assets worth scanning: newest first, capped, to hold quota down. */
export function assetsToScan<T extends { videoId: string; publishedAt: string }>(
  assets: T[], max = 4,
): T[] {
  return [...assets]
    .filter(a => a.videoId && a.publishedAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, max);
}

