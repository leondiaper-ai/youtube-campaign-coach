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
  check('1 POSITIVE quote is safe', !!fr.quote && isSafeToFeature(fr.quote.text));
}
{ // 2 — THE CRITICAL ONE: negative fixture must render nothing
  const fr = buildFanResponse(rows(100, NEG, 'a').concat(rows(20, NEG, 'b')), assets(['a','b']), NOW);
  check('2 NEGATIVE withholds', fr.display === false);
  check('2 NEGATIVE emits no headline', fr.headline === null);
  check('2 NEGATIVE emits no line', fr.line === null);
  check('2 NEGATIVE emits no quote', fr.quote === null);
  check('2 NEGATIVE keeps the true classification internally', fr.tone === 'negative');
}
{ // 3 — mixed is not rounded up
  const fr = buildFanResponse(
    rows(60, POS, 'a').concat(rows(60, NEG, 'b')), assets(['a','b']), NOW);
  check('3 MIXED withholds', fr.display === false, String(fr.tone));
  check('3 MIXED emits no headline', fr.headline === null);
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
