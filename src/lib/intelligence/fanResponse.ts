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
  rulesVersion: number;             // see RULES_VERSION — cached reads from an
                                    // older rule set are recomputed, not served
  quotaUnitsUsed: number;
};

/* Bump on ANY change to the lexicons, gates, tiers or copy.
   The read is cached for 12 hours, so without this a rule change is
   invisible on a live page for half a day — and worse, a stale object
   looks exactly like a freshly computed one. That nearly sent a wrong
   answer upstream: after the polarity denominator was fixed, both live
   campaigns still returned the OLD counts and I read it as the fix not
   working. The cache cannot know the rules moved unless the rules say so,
   so correctness here is structural, not a thing to remember. */
export const RULES_VERSION = 3;

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
  MIN_POSITIVE_SHARE: 0.85,   // positive share of POLARISED comments (pos+neg), not of all retrieved
  MAX_NEGATIVE_SHARE: 0.10,   // hard ceiling on the same polarised base — above this we never display
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
    rulesVersion: RULES_VERSION,
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
  /* DENOMINATOR. 'neutral' here does not mean "felt neutrally about it".
     It means "this rule set found no polarity token" — which covers a
     comment in Portuguese, a lone 🍒, "out now", and a genuinely lukewarm
     reaction, all identically. Dividing by every retrieved comment
     therefore scores my own vocabulary gaps as evidence against the
     artist. The first live run made that concrete: Kings of Leon returned
     134 positive against 2 negative and still failed the gate, because 60
     unrecognised comments dragged the share to 68%.

     So the share is taken over comments that actually expressed a
     polarity, which is what this was always documented to do. Two things
     stop that from being a quiet loosening:
       - the threshold rises to 0.85, because the denominator is stricter;
       - negatives use the SAME denominator, so a handful of criticisms
         cannot be diluted by a large unreadable tail;
       - and an absolute floor (below) means a near-silent audience with
         three positives and no negatives can never reach 100% and show. */
  const polarised = positive + negative;
  const posShare = polarised ? positive / polarised : 0;
  const negShare = polarised ? negative / polarised : 0;

  /* Guards against a tiny polarised base speaking for a large sample. */
  const positiveFloor = positive >= 25 && positive / comments.length >= 0.25;

  const tone: FanTone =
    negShare > 0.25 ? 'negative'
    : posShare >= 0.95 ? 'overwhelmingly_positive'
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
    positive:      posShare >= GATE.MIN_POSITIVE_SHARE
                   && negShare <= GATE.MAX_NEGATIVE_SHARE
                   && positiveFloor,
  };

  /* ── candidate quotes ──
     On-theme first when a theme is clear, but NEVER restricted to it.
     Quote selection must not be able to decide whether Fan Response
     appears, so this list is allowed to be empty and is allowed to be
     off-theme; the display decision upstream does not consult it. */
  const safePositives: FanQuote[] = positives
    .filter(c => isSafeToFeature(c.text))
    .map(c => ({ text: c.text.trim(), likes: c.likes, videoId: c.videoId, theme: themeOf(c.text) }))
    .sort((a, b) => b.likes - a.likes);

  const candidateQuotes: FanQuote[] = (
    top ? [...safePositives.filter(q => q.theme === top.theme),
           ...safePositives.filter(q => q.theme !== top.theme)]
        : safePositives
  ).slice(0, 5);

  const evidence = {
    assetsSampled,
    commentsRetrieved: comments.length,
    commentsClassified: classified,
    positiveCount: positive, negativeCount: negative, neutralCount: neutral,
    samplingNote: 'relevance-ranked, capped at 100 per video — not a census',
  };

  /* ── TWO SEPARATE QUESTIONS ──
     "Can we say the vibe is positive?" and "Can we say what fans are
     positive about?" are different questions with different evidence
     requirements, and conflating them was the design error here. The
     first is answered by polarity across a decent sample; the second
     needs one theme to actually dominate. Only the FIRST decides whether
     the block appears. The second decides how specific the copy gets.

     So `concentration` stays in `gates` — Watcher and the Coach still
     want to know whether the theme was legible — but it is deliberately
     NOT part of `canDisplay`. A campaign whose fans are loudly excited
     about three different things is still a campaign whose fans are
     loudly excited, and the page should be able to say so. */
  const canDisplay = gates.volume && gates.spread && gates.freshness && gates.positive;

  const confidence: 'high' | 'medium' | 'low' =
    !canDisplay ? 'low'
    : comments.length >= 120 && gates.concentration ? 'high'
    : 'medium';

  /* ── withhold ──
     Any single failure withholds; the order here only decides which
     message is reported. It runs cheapest-evidence-first — volume,
     spread, freshness — before anything that characterises the AUDIENCE.
     That ordering is not cosmetic: nothing reads this on the page, but
     the Coach and Watcher do, and a thin sample that was reported as
     "response is mixed" would tell them the audience was lukewarm when
     the truth is we barely looked. Describe the sample before you
     describe the people in it. */
  if (!canDisplay) {
    const why =
      !gates.volume      ? `only ${comments.length} comments retrieved (need ${GATE.MIN_RETRIEVED})`
      : !gates.spread    ? 'comments came from too few assets'
      : !gates.freshness ? 'newest sampled asset is stale'
      : tone === 'negative' ? 'response is not predominantly positive'
      : positive < 25 || positive / comments.length < 0.25
        ? 'too few comments expressed a clear positive reaction'
        : 'response is mixed';
    return base({
      tone, themes, evidence, gates, confidence,
      dominantTheme: top?.theme ?? null,
      recurringPhrases: recurringPhrases(comments),
      candidateQuotes,
      withheldReason: why,
    });
  }

  /* ══ display — three tiers of specificity ══
     The block is already going to appear. All that is left is deciding
     how much we are entitled to claim about WHY fans are excited. Each
     tier says exactly as much as the evidence supports and no more. */

  const theme = gates.concentration ? top!.theme : null;
  const copy = theme ? THEME_COPY[theme] : null;

  /* TIER 3 — a fan's own words. Strongest when it happens, but strictly
     optional: it never decides whether the block appears, only how the
     headline reads. A pull-quote has to work typographically as well as
     evidentially, so a well-liked 49-character sentence stays in the
     object and out of the headline slot. */
  const quote = candidateQuotes[0] ?? null;

  /* Short and well-liked is not enough. "can't wait for this" is both, and
     putting it in the headline slot says nothing a reader could not have
     guessed. What makes a quote worth elevating is that the AUDIENCE
     elevated it — a comment sitting far above its neighbours is the crowd
     agreeing on how they feel, which is the thing being reported. A
     comment merely at the top of a flat pile is one person talking.
     When nothing stands out, the broad or themed copy is the honest
     output and the quote stays in the object. */
  const likeMedian = (() => {
    const xs = safePositives.map(q => q.likes).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : 0;
  })();
  const quotable =
    quote && quote.text.length <= 28 && quote.likes >= 10
      && quote.likes >= Math.max(3 * likeMedian, 10)
      ? quote : null;

  /* TIER 2 — a clear theme, named. When the winning theme is the song and
     the asset that carried it is titled in the standard "Artist - Title"
     form, the track can be named outright; a title that does not match
     that shape is left alone rather than guessed at. */
  const songTitle = (() => {
    if (theme !== 'song') return null;
    const byTheme = new Map<string, number>();
    for (const c of positives) if (themeOf(c.text) === 'song')
      byTheme.set(c.videoId, (byTheme.get(c.videoId) ?? 0) + 1);
    const leadId = Array.from(byTheme.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const raw = assets.find(a => a.videoId === leadId)?.title ?? '';
    const m = raw.match(/^[^-–—]{2,40}\s[-–—]\s([^-–—(\[|]{2,40})$/);
    return m ? m[1].trim() : null;
  })();

  /* TIER 1 — positivity is clear, the reason is not. Say that, plainly,
     rather than picking whichever theme happened to edge ahead. Claiming
     a driver we cannot evidence is the same failure as claiming a
     sentiment we cannot evidence, just harder to spot. */
  const BROAD = {
    headline: 'STRONG FAN RESPONSE',
    line: 'Plenty of excitement around the campaign so far.',
  };

  const headline = quotable ? `“${quotable.text}”` : (copy?.headline ?? BROAD.headline);
  const line =
    songTitle ? `Fans are responding strongly to ${songTitle}.`
    : copy?.line ?? BROAD.line;

  /* Comment count shown is the PUBLIC count on the asset the quote came
     from — exact and checkable — not the size of our sample, and not a
     campaign total, which would be a different number wearing the same
     label. */
  const quoteAsset = quotable ? assets.find(a => a.videoId === quotable.videoId) : null;
  const commentCount = quoteAsset?.comments ?? null;

  return base({
    display: true,
    headline, line, commentCount,
    quote: quotable, tone, dominantTheme: top?.theme ?? null, themes,
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

