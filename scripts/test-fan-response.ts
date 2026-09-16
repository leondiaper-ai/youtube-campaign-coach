/**
 * FAN RESPONSE — behaviour tests.
 *
 * Run:  ./node_modules/.bin/sucrase-node scripts/test-fan-response.ts
 *
 * The important assertions here are the ones that prove the module STAYS
 * SILENT. Campaign Home may show a genuine positive read or nothing at
 * all, so a test suite that only proved the happy path would be testing
 * the half that cannot hurt anyone. Cases 2-6 are the ones that matter.
 */
import {
  buildFanResponse, isSafeToFeature, polarityOf, themeOf, decodeCommentText,
  type RawComment,
} from '../src/lib/intelligence/fanResponse';

const NOW = new Date('2026-09-16T12:00:00Z');
const FRESH = '2026-09-10T12:00:00Z';
const STALE = '2026-06-01T12:00:00Z';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.log(`  ✗ ${name} ${detail}`); }
  else console.log(`  ✓ ${name}`);
};

const rows = (n: number, texts: string[], videoId: string): RawComment[] =>
  Array.from({ length: n }, (_, i) => ({
    text: texts[i % texts.length], likes: 10 - (i % 5), replies: 0,
    at: FRESH, videoId,
  }));

const assets = (ids: string[], publishedAt = FRESH) =>
  ids.map(id => ({ videoId: id, title: `asset ${id}`, publishedAt, comments: 100 }));

const POS = ["WE SO BACK", "we're so back!!!", "welcome back boys", "missed you so much",
             "the return of the greatest band", "so happy they are back", "finally new music",
             "can't wait for this", "best thing they've done"];
const NEG = ["this is trash", "they fell off years ago", "worst thing they've released",
             "so disappointing", "cash grab", "ruined it", "boring", "overrated", "mid"];

console.log('\nDISPLAY GATES');

{ // 1 — genuine positive
  const fr = buildFanResponse(rows(80, POS, 'a').concat(rows(20, POS, 'b')), assets(['a','b']), NOW);
  check('1 POSITIVE displays', fr.display === true, JSON.stringify(fr.withheldReason));
  check('1 POSITIVE displays only WITH a real quote', !!fr.quote);
  check('1 POSITIVE quote is safe', !!fr.quote && isSafeToFeature(fr.quote.text));
}
{ // 1b — a comment the audience pushed far above the rest DOES lead
  const base = rows(60, POS, 'a').concat(rows(59, POS, 'b'));
  base.forEach(c => { c.likes = 2; });
  const fr = buildFanResponse(
    base.concat([{ text: 'WE SO BACK', likes: 184, replies: 0, at: FRESH, videoId: 'b' }]),
    assets(['a','b']), NOW);
  check('1b standout, echoed quote is selected', fr.quote?.text === 'WE SO BACK', String(fr.quote?.text));
}
{ // 2 — THE CRITICAL ONE: negative fixture must render nothing
  const fr = buildFanResponse(rows(100, NEG, 'a').concat(rows(20, NEG, 'b')), assets(['a','b']), NOW);
  check('2 NEGATIVE withholds', fr.display === false);
  check('2 NEGATIVE emits no quote', fr.quote === null);
  check('2 NEGATIVE keeps the true classification internally', fr.tone === 'negative');
}
{ // 3 — mixed is not rounded up
  const fr = buildFanResponse(
    rows(60, POS, 'a').concat(rows(60, NEG, 'b')), assets(['a','b']), NOW);
  check('3 MIXED withholds', fr.display === false, String(fr.tone));
  check('3 MIXED emits no quote', fr.quote === null);
}
{ // 4 — too little evidence
  const fr = buildFanResponse(rows(4, POS, 'a').concat(rows(4, POS, 'b')), assets(['a','b']), NOW);
  check('4 THIN withholds', fr.display === false);
  check('4 THIN says why', /retrieved/.test(fr.withheldReason ?? ''), String(fr.withheldReason));
}
{ // 5 — old campaign, no longer "right now"
  const fr = buildFanResponse(
    rows(60, POS, 'a').concat(rows(60, POS, 'b')), assets(['a','b'], STALE), NOW);
  check('5 STALE withholds', fr.display === false, String(fr.withheldReason));
}
{ // 6 — one loud video is not an audience
  const fr = buildFanResponse(rows(120, POS, 'a'), assets(['a']), NOW);
  check('6 ONE ASSET withholds', fr.display === false, String(fr.withheldReason));
}

/* The positive share is taken over POLARISED comments, which is a more
   permissive denominator than "all retrieved". These two cases exist to
   prove that change did not quietly become a way to display anything. */
const MUTE = ['🍒', 'out now', 'obrigado', '2026', 'link?', 'ok', '...', 'who else here'];
{ // 7 — a handful of positives inside a large unreadable sample: 100% of
  //     polarised, and still must not display.
  const fr = buildFanResponse(
    rows(6, POS, 'a').concat(rows(114, MUTE, 'b')), assets(['a','b']), NOW);
  check('7 SPARSE withholds despite 100% of polarised being positive', fr.display === false);
  check('7 SPARSE blames the sample, not the audience',
    /too few comments expressed/.test(fr.withheldReason ?? ''), String(fr.withheldReason));
}
{ // 8 — negatives must not be dilutable by an unreadable tail.
  const fr = buildFanResponse(
    rows(40, POS, 'a').concat(rows(20, NEG, 'a'), rows(80, MUTE, 'b')), assets(['a','b']), NOW);
  check('8 DILUTED negatives still withhold', fr.display === false, String(fr.withheldReason));
}

/* SELECTION. The page shows a fan's own words or nothing — there is no
   generated fallback line, so these prove both halves of that. */
console.log('\nSELECTION');
{ // 9 — no dominant theme is no longer a reason to stay silent
  const SPLIT = ["can't wait for this", 'so excited', 'welcome back boys', 'missed you so much',
                 'what a tune', 'this song is perfect', 'please tour uk', 'the video looks amazing'];
  const fr = buildFanResponse(rows(70, SPLIT, 'a').concat(rows(50, SPLIT, 'b')), assets(['a','b']), NOW);
  check('9 SPLIT displays on a real comment, not a theme', fr.display === true, String(fr.withheldReason));
  check('9 SPLIT quote is one of the real comments', !!fr.quote && SPLIT.includes(fr.quote.text));
  check('9 SPLIT still records the theme spread internally', fr.themes.length > 1);
}
{ // 10 — popular but unquotable: no fallback copy may appear
  const LONG = ['what an absolutely beautiful song that I will never stop playing'];
  const fr = buildFanResponse(rows(60, LONG, 'a').concat(rows(60, LONG, 'b')), assets(['a','b']), NOW);
  check('10 over-long comment never reaches the page', fr.display === false);
  check('10 says why', /no single comment is safe and representative/.test(fr.withheldReason ?? ''));
}

{ /* 11 — THE OUTLIER RULE. A joke that collected likes is popular but
       speaks for nobody. A quieter comment using the language 60 other
       fans reached for speaks for all of them. Likes alone must not win. */
  const ECHOED = ['this song is perfect', 'this song is everything', 'this song is a classic'];
  const base = rows(120, ECHOED, 'a').map((c, i) => ({ ...c, videoId: i % 2 ? 'a' : 'b', likes: 25 }));
  const fr = buildFanResponse(
    base.concat([{ text: 'my cat left the room', likes: 400, replies: 0, at: FRESH, videoId: 'a' }]),
    assets(['a','b']), NOW);
  check('11 popular outlier does not win', fr.quote?.text !== 'my cat left the room', String(fr.quote?.text));
  check('11 the echoed comment wins instead',
    !!fr.quote && ECHOED.includes(fr.quote.text), String(fr.quote?.text));
}
{ /* 12 — but when the most-liked comment IS representative, prefer it.
       Leon's rule: that combination is the strongest evidence there is. */
  const ECHOED = ['this song is perfect', 'this song is everything'];
  const base = rows(120, ECHOED, 'a').map((c, i) => ({ ...c, videoId: i % 2 ? 'a' : 'b', likes: 20 }));
  const fr = buildFanResponse(
    base.concat([{ text: 'this song is perfect', likes: 900, replies: 0, at: FRESH, videoId: 'a' }]),
    assets(['a','b']), NOW);
  check('12 top-liked AND representative is preferred', fr.quote?.likes === 900, String(fr.quote?.likes));
}

console.log('\nSAFETY FILTER (all drawn from comments real scans returned)');
const unsafe = [
  'MARRY ME', 'she is so hot', 'I named my baby boy Leon, born with cleft lip',
  'Yesterday my wife just asked for divorce', 'To all those we love and lost',
  'RIP to the best drummer', 'my dad introduced me to this band',
  'check out my channel', 'leak the album', 'first comment', 'god bless this band',
  'this song got me through chemo',
];
for (const t of unsafe) check(`blocks: ${t.slice(0, 44)}`, !isSafeToFeature(decodeCommentText(t)));
const safe = ["It&#39;s a crime how underrated this band is", 'WE SO BACK',
              'Best song in years. What a tune.', 'Making music with real instruments again'];
for (const t of safe) check(`allows: ${t.slice(0, 44)}`, isSafeToFeature(decodeCommentText(t)));

console.log('\nTHEME ROUTING (a KoL page must never inherit CHVRCHES language)');
const themes: [string, string | null][] = [
  ['WE SO BACK', 'return'],
  ['welcome back boys', 'return'],
  ['Loooooove KOL returning to their Southern roots', null], // musical direction, NOT a comeback
  ['Best song in years. What a tune.', 'song'],
  ['the video is stunning', 'visual'],
  ['please tour latam', 'live'],
  ['takes me back to being 16', 'nostalgia'],
];
for (const [text, want] of themes)
  check(`${want ?? 'none'} ← "${text.slice(0, 40)}"`, themeOf(text) === want, `got ${themeOf(text)}`);

console.log('\nTEXT DECODING');
check('decodes &#39;', decodeCommentText('It&#39;s') === "It's");
check('strips tags', decodeCommentText('a<br>b') === 'a b');
check('elongation matched, spelling preserved', polarityOf('Loooooove this') === 'positive');

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nALL PASS\n');
process.exit(failures ? 1 : 0);
