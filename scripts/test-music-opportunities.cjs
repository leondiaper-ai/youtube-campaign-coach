/* Focused matching, parsing, dedup and gate checks for the Music Opportunities sandbox.
   No network or credentials. Run: node scripts/test-music-opportunities.cjs */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('node:assert/strict');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const m = new Module(file); m.filename = file; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = name => {
    if (name === '@upstash/redis') return { Redis: class { } };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(`${target}.ts`) ? '.ts' : '.tsx'));
    }
    return original(name);
  };
  m._compile(source, file); cache.set(file, m.exports); return m.exports;
}
const { OWNED_CHANNELS, validChannelId } = load('src/lib/ownedChannels/channels.ts');
const { labsEnabled } = load('src/lib/labs/musicOpportunities/gate.ts');
const { normalise, splitArtists, parseUploadTitle, indexCatalogue, matchEntry } = load('src/lib/labs/musicOpportunities/match.ts');
const { parseManualChart } = load('src/lib/labs/musicOpportunities/sources/manualImport.ts');
const { parseSourceCatalogue } = load('src/lib/labs/musicOpportunities/catalogue.ts');
const { buildOpportunities, ownedEvidence, songKey, unmatchedCount } = load('src/lib/labs/musicOpportunities/opportunities.ts');
const { demoObservation } = load('src/lib/labs/musicOpportunities/demo.ts');
const { makeDecision } = load('src/lib/labs/musicOpportunities/decisions.ts');

/* ── Registry facts the brief asked us to verify ─────────────────── */
const gameDay = OWNED_CHANNELS.find(c => c.slug === 'game-day-radio');
assert.equal(gameDay.id, 'UC0tfvGUDEmYh169ZBlMH0gw', 'Game Day Radio ID as held in the registry');
assert.equal(gameDay.id.length, 24);
assert.equal(OWNED_CHANNELS.filter(c => validChannelId(c.id)).length, 9);
assert.equal(OWNED_CHANNELS.find(c => !c.identityVerified).id, 'UChVWfn28jaZSxBqwwP0VnL');

/* ── Gate: production always off, preview on ─────────────────────── */
const env = { ...process.env };
process.env.VERCEL_ENV = 'production'; process.env.NODE_ENV = 'production'; assert.equal(labsEnabled(), false);
process.env.VERCEL_ENV = 'preview'; assert.equal(labsEnabled(), true);
delete process.env.VERCEL_ENV; process.env.NODE_ENV = 'development'; assert.equal(labsEnabled(), true);
process.env.NODE_ENV = 'production'; assert.equal(labsEnabled(), false);
Object.assign(process.env, env);

/* ── Text normalisation and title parsing ────────────────────────── */
assert.equal(normalise('What a Friend We Have in Jesus (Official Lyric Video)'), 'what a friend we have in jesus');
assert.equal(normalise('Él Pátio & Co.'), 'el patio and co');
assert.deepEqual(splitArtists('Dolly Parton feat. Alison Krauss & Someone'), ['dolly parton', 'alison krauss', 'someone']);
assert.deepEqual(parseUploadTitle('What a Friend We Have in Jesus – Dolly Parton'), { artist: 'What a Friend We Have in Jesus', title: 'Dolly Parton', version: null });
assert.deepEqual(parseUploadTitle('Artist - Song (Lyric Video)'), { artist: 'Artist', title: 'Song', version: 'Lyric Video' });
assert.equal(parseUploadTitle('Just a title').artist, null);

/* ── Matching tiers against a catalogue ──────────────────────────── */
const track = (id, title, extra = {}) => ({ id: `upload:${id}`, origin: 'owned-upload', title, artist: parseUploadTitle(title).artist, version: null, isrc: null,
  channelSlug: 'folk-and-nature', channelName: 'Folk and Nature', videoId: id, publishedAt: '2026-08-25T00:00:00Z', genre: null, language: null, releaseYear: null, territories: null, rightsNote: null, ...extra });
const catalogue = [
  track('hSkegNLcf8A', 'What a Friend We Have in Jesus – Dolly Parton'),
  track('aaaaaaaaaaa', 'Dolly Parton - Jolene (Lyric Video)'),
  track('bbbbbbbbbbb', 'Someone Else - What a Friend We Have in Jesus'),
  track('ccccccccccc', 'Completely Unrelated - Nothing Here'),
  { id: 'source:GBAYE0601498', origin: 'source-catalogue', title: 'Jolene', artist: 'Dolly Parton', version: null, isrc: 'GBAYE0601498', channelSlug: null, channelName: null, videoId: null, publishedAt: null, genre: 'Country', language: 'en', releaseYear: 1973, territories: 'WW', rightsNote: 'cleared' },
];
const index = indexCatalogue(catalogue);
const entry = (o) => ({ rank: 1, previousRank: null, isNew: null, periodsOnChart: null, title: '', artists: [], isrc: null, videoId: null, channelId: null, channelTitle: null, measureValue: null, ...o });

let m = matchEntry(entry({ title: 'What a Friend We Have in Jesus', artists: ['Dolly Parton'] }), index);
assert.equal(m[0].kind, 'title-artist'); assert.equal(m[0].track.videoId, 'hSkegNLcf8A', 'title/artist in either order');
assert.ok(m.some(x => x.kind === 'title-only' && x.track.videoId === 'bbbbbbbbbbb'), 'same title, different artist is weaker');
assert.ok(m.some(x => x.kind === 'artist' && x.track.videoId === 'aaaaaaaaaaa'), 'artist-only is weakest');
assert.ok(!m.some(x => x.track.videoId === 'ccccccccccc'), 'unrelated upload is not matched');
for (let i = 1; i < m.length; i++) assert.ok(['exact-upload', 'isrc', 'title-artist', 'title-only', 'artist'].indexOf(m[i - 1].kind) <= ['exact-upload', 'isrc', 'title-artist', 'title-only', 'artist'].indexOf(m[i].kind), 'strongest first');

m = matchEntry(entry({ title: 'Dolly Parton - What a Friend We Have in Jesus (Official Video)', videoId: 'zzzzzzzzzzz' }), index);
assert.equal(m[0].kind, 'title-artist', 'combined Data API title is parsed');

m = matchEntry(entry({ title: 'Jolene', artists: ['Dolly Parton'], isrc: 'gbaye0601498' }), index);
assert.equal(m[0].kind, 'isrc'); assert.equal(m[0].track.origin, 'source-catalogue');
assert.equal(m[1].kind, 'title-artist'); assert.equal(m[1].track.videoId, 'aaaaaaaaaaa');

m = matchEntry(entry({ title: 'Jolene', artists: ['Dolly Parton'], videoId: 'aaaaaaaaaaa' }), index);
assert.equal(m[0].kind, 'exact-upload');

assert.deepEqual(matchEntry(entry({ title: 'Blinding Lights', artists: ['The Weeknd'] }), index), [], 'no credible match is an empty list');
assert.deepEqual(matchEntry(entry({ title: 'In', artists: [] }), index), [], 'tiny titles never match');

/* ── Manual chart import: header-driven, tolerant, labelled ───────── */
const csv = 'Rank,Previous Rank,Track Name,Artist Names,Periods on Chart,Views,YouTube URL\n2,"5","What a Friend We Have in Jesus","Dolly Parton",3,"1,234,567",https://www.youtube.com/watch?v=hSkegNLcf8A\n1,-,Other Song,"A, B",1,999,';
const imported = parseManualChart({ text: csv, measure: 'song-views-weekly', territory: 'gb'.toUpperCase(), period: '2026-10-17', sourceUrl: '', note: 'test' });
assert.equal(imported.observation.source, 'manual-import');
assert.equal(imported.observation.id, 'manual-import|song-views-weekly|GB|2026-10-17');
assert.equal(imported.observation.entries[0].rank, 1); assert.equal(imported.observation.entries[0].isNew, true);
assert.deepEqual(imported.observation.entries[0].artists, ['A', 'B']);
assert.equal(imported.observation.entries[1].previousRank, 5); assert.equal(imported.observation.entries[1].measureValue, 1234567);
assert.equal(imported.observation.entries[1].videoId, 'hSkegNLcf8A');
assert.equal(imported.observation.sourceUrl, 'https://charts.youtube.com/');
assert.throws(() => parseManualChart({ text: 'a,b\n1,2', measure: 'song-views-weekly', territory: 'GB', period: '2026-10-17', sourceUrl: '', note: '' }), /No title column/);
assert.throws(() => parseManualChart({ text: csv, measure: 'song-views-weekly', territory: 'GB', period: 'last week', sourceUrl: '', note: '' }), /period/);
assert.throws(() => parseManualChart({ text: csv, measure: 'song-views-weekly', territory: 'Britain', period: '2026-10-17', sourceUrl: '', note: '' }), /Territory/);
const tsv = parseManualChart({ text: 'Rank\tSong\tArtist\n1\tX\tY', measure: 'shorts-creations-weekly', territory: 'US', period: '2026-10-17', sourceUrl: '', note: '' });
assert.equal(tsv.observation.measure, 'shorts-creations-weekly'); assert.match(tsv.observation.periodLabel, /Shorts/);

/* ── Source catalogue import ─────────────────────────────────────── */
const cat = parseSourceCatalogue('isrc,title,artist,genre,year,rights\nGBAYE0601498,Jolene,Dolly Parton,Country,1973,cleared\n,No Artist,,,,');
assert.equal(cat.rows.length, 1); assert.equal(cat.skipped, 1); assert.equal(cat.rows[0].releaseYear, 1973); assert.equal(cat.rows[0].rightsNote, 'cleared');
assert.throws(() => parseSourceCatalogue('title\nX'), /artist/);

/* ── Opportunities: stages, persistence, evidence ────────────────── */
const snap = (at, items, viewsById) => ({ channelId: 'UC2_BNEOjEi2plnmHUppPLzQ', title: 'Folk and Nature', thumbnail: null, collectedAt: at, subs: 1, views: 1, items, reachedEnd: true, reachedWindow: false, viewsById });
const history = [
  snap('2026-10-16T12:00:00Z', [], { hSkegNLcf8A: 270000 }),
  snap('2026-10-23T12:00:00Z', [{ id: 'hSkegNLcf8A', title: 'What a Friend We Have in Jesus – Dolly Parton', publishedAt: '2026-08-25T00:00:00Z', durationSec: 200, views: 280866, live: 'none' }]),
];
const ev = ownedEvidence('hSkegNLcf8A', history);
assert.equal(ev.views, 280866); assert.deepEqual(ev.gain, { views: 10866, days: 7, baselineAt: '2026-10-16T12:00:00Z' });
assert.deepEqual(ownedEvidence('hSkegNLcf8A', [history[1]]).gain, null, 'one reading is a baseline, not growth');
assert.equal(ownedEvidence('nope', history).views, null);

const layer = { tracks: catalogue, coverage: [{ slug: 'folk-and-nature', name: 'Folk and Nature', channelId: 'UC2_BNEOjEi2plnmHUppPLzQ', identityVerified: true, inventory: null, ownedWorkingSet: null, using: 'inventory' }],
  source: { present: true, rows: 1, importedAt: null, note: null }, ownedLatest: {}, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: history } };
const obs = (period, territory, entries, extra = {}) => ({ id: `manual-import|song-views-weekly|${territory}|${period}`, source: 'manual-import', measure: 'song-views-weekly', territory, period, periodLabel: period, sourceUrl: 'x', collectedAt: `${period}T10:00:00Z`, note: null, entries, ...extra });
const weHave = entry({ rank: 7, title: 'What a Friend We Have in Jesus', artists: ['Dolly Parton'] });
const jolene = entry({ rank: 3, title: 'Jolene', artists: ['Dolly Parton'], isrc: 'GBAYE0601498' });
const nothing = entry({ rank: 1, title: 'Blinding Lights', artists: ['The Weeknd'] });
let ops = buildOpportunities([obs('2026-10-17', 'GB', [nothing, weHave])], layer);
assert.equal(ops.length, 1); assert.equal(ops[0].stage, 'act-editorially'); assert.equal(ops[0].persistence.periods, 1);
assert.equal(ops[0].ownedUploads[0].views, 280866); assert.ok(ops[0].ownedUploads[0].gain);
assert.ok(ops[0].unknowns.some(u => /Rights/.test(u)) && ops[0].unknowns.some(u => /one reading/.test(u)));
assert.deepEqual(unmatchedCount([obs('2026-10-17', 'GB', [nothing, weHave])], layer), { total: 2, unmatched: 1 });

// Persistence across two periods of the same chart; only the latest reading yields opportunities; no duplicates.
ops = buildOpportunities([obs('2026-10-10', 'GB', [weHave, jolene]), obs('2026-10-17', 'GB', [weHave, jolene]), obs('2026-10-17', 'US', [jolene])], layer);
assert.equal(ops.filter(o => o.signal.title === 'What a Friend We Have in Jesus').length, 1);
const jo = ops.filter(o => o.signal.title === 'Jolene');
assert.equal(jo.length, 2, 'one per territory in the latest readings');
assert.equal(jo[0].persistence.periods, 2); assert.deepEqual(jo[0].persistence.territories, ['GB', 'US']);
assert.equal(jo[0].matches[0].kind, 'isrc');
const gb = jo.find(o => o.signal.territory === 'GB');
// The ISRC match is a source-catalogue row with no owned upload; the only owned baseline
// belongs to a DIFFERENT Dolly Parton song (artist-level match). That must not open the gate.
assert.equal(gb.stage, 'act-editorially', 'a baseline from a different song never opens the paid-test gate');
assert.ok(gb.ownedUploads.some(u => u.matchKind === 'artist' && u.gain), 'the stray baseline is listed, with its match kind');
assert.ok(gb.unknowns.some(u => /not on an owned channel/.test(u)));
// A text match never opens the paid-test gate, however persistent.
const wf = ops.find(o => o.signal.title === 'What a Friend We Have in Jesus');
assert.equal(wf.persistence.periods, 2); assert.equal(wf.stage, 'act-editorially');
// Verified upload (exact video id) + persisted across two periods + its OWN baseline opens the gate.
const joleneVideo = entry({ rank: 3, title: 'Jolene', artists: ['Dolly Parton'], videoId: 'aaaaaaaaaaa' });
const joleneHistory = [snap('2026-10-16T12:00:00Z', [], { aaaaaaaaaaa: 1000 }), snap('2026-10-23T12:00:00Z', [{ id: 'aaaaaaaaaaa', title: 'Dolly Parton - Jolene (Lyric Video)', publishedAt: '2026-08-25T00:00:00Z', durationSec: 200, views: 1500, live: 'none' }])];
const gated = buildOpportunities([obs('2026-10-10', 'GB', [joleneVideo]), obs('2026-10-17', 'GB', [joleneVideo])], { ...layer, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: joleneHistory } });
assert.equal(gated[0].matches[0].kind, 'exact-upload'); assert.equal(gated[0].stage, 'consider-paid-test');
assert.equal(buildOpportunities([obs('2026-10-17', 'GB', [joleneVideo])], { ...layer, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: joleneHistory } })[0].stage, 'act-editorially', 'one reading is not persistence');
assert.equal(buildOpportunities([obs('2026-10-10', 'GB', [joleneVideo]), obs('2026-10-17', 'GB', [joleneVideo])], { ...layer, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: [joleneHistory[1]] } })[0].stage, 'act-editorially', 'no baseline, no gate');
// Different sources are never pooled for persistence.
ops = buildOpportunities([obs('2026-10-17', 'GB', [jolene]), obs('2026-10-23', 'GB', [jolene], { id: 'youtube-data-api|most-popular-music-videos|GB|2026-10-23', source: 'youtube-data-api', measure: 'most-popular-music-videos' })], layer);
assert.ok(ops.every(o => o.persistence.periods === 1));
assert.ok(ops.find(o => o.signal.source === 'youtube-data-api').unknowns.some(u => /no measure/.test(u)));
assert.equal(songKey(weHave), 'text:what a friend we have in jesus|dolly parton');

// Demonstration is labelled, never a live finding, and matches the real upload.
const demo = buildOpportunities([demoObservation()], layer)[0];
assert.match(demo.signal.periodLabel, /DEMONSTRATION/); assert.equal(demo.matches[0].track.videoId, 'hSkegNLcf8A');

// Decisions freeze the evidence and refuse budgets in the test block (route-level); shape check here.
const d = makeDecision({ opportunity: gated[0], stage: 'act-editorially', actualAction: ' pinned ', notes: '' }, '2026-10-23T12:00:00Z');
assert.equal(d.actualAction, 'pinned'); assert.equal(d.notes, null); assert.equal(d.test, null); assert.equal(d.ownedUploads[0].views, 1500); assert.equal(d.matches[0].kind, 'exact-upload');
assert.equal(makeDecision({ opportunity: gb, stage: 'consider-paid-test' }).test, null, 'paid test needs a hypothesis block');

/* ── Empty states ───────────────────────────────────────────────── */
assert.deepEqual(buildOpportunities([], layer), []);
assert.deepEqual(buildOpportunities([obs('2026-10-17', 'GB', [])], layer), []);
assert.deepEqual(buildOpportunities([obs('2026-10-17', 'GB', [weHave])], { ...layer, tracks: [] }), []);

console.log('music-opportunities: all checks passed');
