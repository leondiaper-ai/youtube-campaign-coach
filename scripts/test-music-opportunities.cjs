/* Focused checks for the Music Opportunities research bank: gate, seeds, classification,
   bank building, pattern guardrails, matching, stages, imports, empty states.
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
  if (file.endsWith('.json')) { const j = JSON.parse(fs.readFileSync(file, 'utf8')); cache.set(file, j); return j; }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const m = new Module(file); m.filename = file; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = name => {
    if (name === '@upstash/redis') return { Redis: class { } };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      if (target.endsWith('.json')) return load(target);
      return load(target + (fs.existsSync(`${target}.ts`) ? '.ts' : '.tsx'));
    }
    return original(name);
  };
  m._compile(source, file); cache.set(file, m.exports); return m.exports;
}
const { OWNED_CHANNELS, validChannelId } = load('src/lib/ownedChannels/channels.ts');
const { labsEnabled } = load('src/lib/labs/musicOpportunities/gate.ts');
const { normalise, parseUploadTitle, indexCatalogue, matchEntry } = load('src/lib/labs/musicOpportunities/match.ts');
const { splitCredit, versionFromTitle, presentationFromTitle, languageFromTitle, eraFromRelease, labelsFromArtists, mergeLabels, classifyChartRow, classifyUpload } = load('src/lib/labs/musicOpportunities/classify.ts');
const { seedObservations, mergeObservations, chartPageUrl } = load('src/lib/labs/musicOpportunities/sources/youtubeCharts.ts');
const { parseManualChart } = load('src/lib/labs/musicOpportunities/sources/manualImport.ts');
const { parseSourceCatalogue } = load('src/lib/labs/musicOpportunities/catalogue.ts');
const { buildBank, persistence, songKey, crossMeasureSongs } = load('src/lib/labs/musicOpportunities/bank.ts');
const { findPatterns, labelCoverage, PATTERN_FLOOR } = load('src/lib/labs/musicOpportunities/patterns.ts');
const { buildOpportunities, ownedEvidence, unmatchedCount } = load('src/lib/labs/musicOpportunities/opportunities.ts');
const { contextualMatches } = load('src/lib/labs/musicOpportunities/connections.ts');
const { buildFindings } = load('src/lib/labs/musicOpportunities/findings.ts');
const { demoObservation } = load('src/lib/labs/musicOpportunities/demo.ts');
const { makeDecision } = load('src/lib/labs/musicOpportunities/decisions.ts');
const { MEASURE_ENTITY, VOCAB } = load('src/lib/labs/musicOpportunities/types.ts');

/* ── Registry facts ─────────────────────────────────────────────── */
assert.equal(OWNED_CHANNELS.find(c => c.slug === 'game-day-radio').id, 'UC0tfvGUDEmYh169ZBlMH0gw');
assert.equal(OWNED_CHANNELS.filter(c => validChannelId(c.id)).length, 9);
assert.equal(OWNED_CHANNELS.find(c => !c.identityVerified).id, 'UChVWfn28jaZSxBqwwP0VnL');

/* ── Gate ───────────────────────────────────────────────────────── */
const env = { ...process.env };
process.env.VERCEL_ENV = 'production'; process.env.NODE_ENV = 'production'; assert.equal(labsEnabled(), false);
process.env.VERCEL_ENV = 'preview'; assert.equal(labsEnabled(), true);
delete process.env.VERCEL_ENV; process.env.NODE_ENV = 'development'; assert.equal(labsEnabled(), true);
process.env.NODE_ENV = 'production'; assert.equal(labsEnabled(), false);
Object.assign(process.env, env);

/* ── Seeds: provenance, measures, period vs collection, no duplicates ── */
const seeds = seedObservations();
assert.equal(seeds.length, 10);
assert.ok(seeds.every(o => o.source === 'youtube-charts-page' && /charts\.youtube\.com\/charts\//.test(o.sourceUrl)));
assert.ok(seeds.every(o => /^\d{4}-\d{2}-\d{2}$/.test(o.period) && o.collectedAt > o.period), 'collection date is after, and separate from, the chart period');
assert.equal(new Set(seeds.map(o => o.id)).size, 10, 'ids are unique per source|measure|territory|period');
const shorts = seeds.filter(o => o.measure === 'shorts-creations-weekly');
assert.ok(shorts.length === 2 && shorts.every(o => o.entries.every(e => e.measureValue === null)), 'Shorts chart publishes no count: measureValue null, never 0');
assert.ok(seeds.filter(o => o.measure === 'song-views-weekly').every(o => o.entries.every(e => e.measureValue > 0)), 'song charts carry views');
const gb15 = seeds.find(o => o.id === 'youtube-charts-page|song-views-weekly|GB|2026-10-15');
assert.equal(gb15.entries.length, 100); assert.equal(gb15.periodLabel, 'Oct 9 – 15, 2026');
const carnage = gb15.entries.find(e => /^Carnage/.test(e.title));
assert.deepEqual(carnage.artists, ['Chase & Status'], 'ampersand bands are not split'); assert.equal(carnage.isNew, true); assert.equal(carnage.previousRank, null);
const dai = gb15.entries[0]; assert.equal(dai.previousRank, 2); assert.equal(dai.isNew, false); assert.deepEqual(dai.artists, ['Shakira', 'Burna Boy']);
const reentry = gb15.entries.find(e => e.rank === 51); assert.equal(reentry.previousRank, null); assert.equal(reentry.isNew, false, 'off-chart last week with 2 periods is a re-entry, not new');
assert.equal(chartPageUrl('TopSongs', 'GB', '2026-10-08'), 'https://charts.youtube.com/charts/TopSongs/gb/weekly/20261008');
assert.equal(mergeObservations(seeds, [{ ...gb15, note: 'replaced' }]).filter(o => o.id === gb15.id).length, 1, 'a stored reading replaces a seed of the same period');
assert.equal(mergeObservations(seeds, [{ ...gb15, note: 'replaced' }]).find(o => o.id === gb15.id).note, 'replaced');

/* ── Classification ─────────────────────────────────────────────── */
assert.deepEqual(splitCredit('Chase & Status'), ['Chase & Status']);
assert.deepEqual(splitCredit('Dolly Parton & Alison Krauss'), ['Dolly Parton', 'Alison Krauss']);
assert.equal(versionFromTitle('Dracula (Remix) (feat. JENNIE)').value, 'remix');
assert.equal(versionFromTitle('Tus Mentiras (En Vivo)').value, 'live');
assert.equal(versionFromTitle('Raya (Slowed)').value, 'slowed/sped-up edit');
assert.equal(versionFromTitle('Ordinary'), null, 'a plain title yields no version label');
assert.equal(presentationFromTitle('9 To 5 (Official Video)').value, 'official music video');
assert.equal(presentationFromTitle('Willing and Able (Official Lyric Video)').value, 'lyric video');
assert.equal(presentationFromTitle('Chase & Status - Carnage (Visualiser) ft. Little Simz').value, 'visualiser');
assert.equal(presentationFromTitle('Ordinary'), null);
assert.equal(languageFromTitle('गुज़ारिश').value, 'hi');
assert.equal(languageFromTitle('Nunca Supiste Que Te Esperé').value, 'es');
assert.equal(languageFromTitle('Ordinary'), null, 'no language is inferred from one English-looking word');
assert.equal(eraFromRelease('1980-11-17', '2026-10-15').value, VOCAB.era[3]); assert.equal(eraFromRelease('1980-11-17', '2026-10-15').provenance, 'verified');
assert.equal(eraFromRelease('2026-10-08', '2026-10-15').value, VOCAB.era[0]);
assert.equal(eraFromRelease('2021', '2026-10-15').value, VOCAB.era[2]); assert.equal(eraFromRelease('2021', '2026-10-15').confidence, 'medium');
assert.equal(eraFromRelease(null, '2026-10-15'), null);
assert.ok(labelsFromArtists(['Dolly Parton']).some(l => l.dimension === 'genre' && l.value === 'country' && l.provenance === 'inferred'));
assert.deepEqual(labelsFromArtists(['Someone Nobody Knows']), [], 'unknown artists get no genre');
const merged = mergeLabels([{ dimension: 'genre', value: 'pop', provenance: 'inferred', confidence: 'medium', basis: 'x' }], [{ dimension: 'genre', value: 'country', provenance: 'human', confidence: 'high', basis: 'y' }]);
assert.deepEqual(merged.map(l => l.value), ['country'], 'a human label replaces an inferred one on the same dimension');
const songRow = classifyChartRow({ title: '9 to 5', artists: ['Dolly Parton'], releaseDate: '1980-11-17' }, 'song', '2026-10-15');
assert.ok(!songRow.some(l => l.dimension === 'presentation'), 'a song chart row never gets a presentation label');
const videoRow = classifyChartRow({ title: '9 To 5 (Official Video)', artists: ['Dolly Parton'], releaseDate: '2014-03-15' }, 'video', '2026-10-15');
assert.ok(videoRow.some(l => l.dimension === 'presentation' && l.value === 'official music video'));
assert.ok(!classifyUpload('9 to 5 (Live) - Dolly Parton', 'Dolly Parton').some(l => l.dimension === 'era'), 'upload date is not release date: no era on uploads');

/* ── Bank ───────────────────────────────────────────────────────── */
const bank = buildBank(seeds);
assert.ok(bank.songs.size > 300 && bank.videos.size > 100);
const nine = Array.from(bank.songs.values()).find(s => s.title === '9 to 5' && s.artists[0] === 'Dolly Parton');
const p9 = persistence(nine.appearances, bank.seriesPeriods);
const gbSeries = p9.bySeries.find(s => s.territory === 'GB' && s.measure === 'song-views-weekly');
assert.deepEqual(gbSeries.periods, ['2026-10-01', '2026-10-08', '2026-10-15']); assert.equal(gbSeries.bestRank, 23); assert.equal(gbSeries.latestRank, 42);
assert.deepEqual(p9.territories, ['GB', 'US']); assert.ok(p9.measures.includes('song-views-weekly') && !p9.measures.includes('music-video-views-weekly'), 'video-chart rows do not create song appearances');
assert.ok(nine.labels.some(l => l.dimension === 'era' && /heritage/.test(l.value) && l.provenance === 'verified'));
assert.ok(nine.labels.some(l => l.dimension === 'genre' && l.value === 'country' && l.provenance === 'inferred'));
const jolene = Array.from(bank.songs.values()).find(s => s.title === 'Jolene');
const pj = persistence(jolene.appearances, bank.seriesPeriods).bySeries[0];
assert.equal(pj.latestRank, null, 'absent from the latest stored period of its series: dropped, not persisting');
const nineVideo = bank.videos.get('UbxUSsFXYo4');
assert.equal(nineVideo.appearances.length, 2); assert.equal(nineVideo.songKey, nine.key, 'song chart link ties the video record to the song, without adding an appearance');
assert.ok(crossMeasureSongs(bank).some(c => c.song.title === 'Training Season' && c.measures.length === 2));
assert.equal(MEASURE_ENTITY['shorts-creations-weekly'], 'song');

/* ── Patterns: floors, baseline, provenance, persistence ───────── */
const patterns = findPatterns(bank);
assert.ok(patterns.every(p => p.entities >= PATTERN_FLOOR.entities && p.artists >= PATTERN_FLOOR.artists));
assert.ok(patterns.find(p => p.dimension === 'language' && p.value === 'en' && p.territory === 'GB').baseline, 'the territory language is baseline');
assert.ok(patterns.find(p => p.dimension === 'language' && p.value === 'es' && p.territory === 'US') && !patterns.find(p => p.dimension === 'language' && p.value === 'es' && p.territory === 'US').baseline, 'Spanish in the US chart is a pattern, not baseline');
assert.ok(patterns.filter(p => p.territory === 'MX').every(p => p.persistentEntities === null), 'one stored period: persistence is null, not a count');
assert.ok(patterns.filter(p => p.dimension === 'genre').every(p => p.provenance.inferred > 0 && p.caveats.some(c => /inferred/.test(c))), 'genre patterns say their labels are inferred');
assert.ok(patterns.every(p => p.caveats[0].length > 0 && p.caveats.some(c => /selected successes/.test(c))));
assert.ok(!patterns.some(p => p.dimension === 'presentation' && p.measure === 'song-views-weekly'));
const cov = labelCoverage(bank);
assert.equal(cov.find(c => c.dimension === 'presentation').total, 100, 'presentation coverage counts video rows only');
assert.ok(cov.find(c => c.dimension === 'era').labelled >= 440);

/* ── Matching tiers ─────────────────────────────────────────────── */
const track = (id, title, extra = {}) => ({ id: `upload:${id}`, origin: 'owned-upload', title, artist: parseUploadTitle(title).title, version: parseUploadTitle(title).version, isrc: null,
  channelSlug: 'folk-and-nature', channelName: 'Folk and Nature', videoId: id, publishedAt: '2026-08-25T00:00:00Z', views: 100, durationSec: 200, genre: null, language: null, releaseYear: null, territories: null, rightsNote: null, labels: [], ...extra });
const catalogue = [
  track('hSkegNLcf8A', 'What a Friend We Have in Jesus - Dolly Parton'),
  track('aaaaaaaaaaa', '9 to 5 (Live) - Dolly Parton'),
  track('bbbbbbbbbbb', 'Someone Else - What a Friend We Have in Jesus'),
  track('ccccccccccc', 'Completely Unrelated - Nothing Here'),
  { ...track('', 'Jolene'), id: 'source:GBAYE0601498', origin: 'source-catalogue', artist: 'Dolly Parton', isrc: 'GBAYE0601498', channelSlug: null, channelName: null, videoId: null, publishedAt: null, views: null, genre: 'Country', rightsNote: 'cleared' },
];
const index = indexCatalogue(catalogue);
const entry = (o) => ({ rank: 1, previousRank: null, isNew: null, periodsOnChart: null, title: '', artists: [], isrc: null, videoId: null, channelId: null, channelTitle: null, measureValue: null, releaseDate: null, ...o });
let m = matchEntry(entry({ title: '9 to 5', artists: ['Dolly Parton'] }), index);
assert.equal(m[0].kind, 'title-artist'); assert.match(m[0].evidence, /marked "Live"/, 'a version marker on our side is spelled out');
m = matchEntry(entry({ title: 'What a Friend We Have in Jesus', artists: ['Dolly Parton'] }), index);
assert.equal(m[0].track.videoId, 'hSkegNLcf8A'); assert.ok(m.some(x => x.kind === 'title-only' && x.track.videoId === 'bbbbbbbbbbb')); assert.ok(!m.some(x => x.track.videoId === 'ccccccccccc'));
m = matchEntry(entry({ title: 'Jolene', artists: ['Dolly Parton'], isrc: 'gbaye0601498' }), index);
assert.equal(m[0].kind, 'isrc');
m = matchEntry(entry({ title: '9 to 5', artists: ['Dolly Parton'], videoId: 'aaaaaaaaaaa' }), index);
assert.equal(m[0].kind, 'exact-upload');
assert.deepEqual(matchEntry(entry({ title: 'Blinding Lights', artists: ['The Weeknd'] }), index), []);

/* ── Opportunities, stages, snapshot fallback ───────────────────── */
const snap = (at, items, viewsById) => ({ channelId: 'UC2_BNEOjEi2plnmHUppPLzQ', title: 'Folk and Nature', thumbnail: null, collectedAt: at, subs: 1, views: 1, items, reachedEnd: true, reachedWindow: false, viewsById });
const history = [snap('2026-10-16T12:00:00Z', [], { aaaaaaaaaaa: 60 }), snap('2026-10-23T12:00:00Z', [{ id: 'aaaaaaaaaaa', title: '9 to 5 (Live) - Dolly Parton', publishedAt: '2026-08-25T00:00:00Z', durationSec: 200, views: 73, live: 'none' }])];
assert.deepEqual(ownedEvidence('aaaaaaaaaaa', history).gain, { views: 13, days: 7, baselineAt: '2026-10-16T12:00:00Z' });
assert.equal(ownedEvidence('aaaaaaaaaaa', [history[1]]).gain, null);
const coverageRow = { slug: 'folk-and-nature', name: 'Folk and Nature', channelId: 'UC2_BNEOjEi2plnmHUppPLzQ', identityVerified: true, using: 'seed-snapshot', rows: 5, complete: true, videoCount: 5, readAt: '2026-10-23T19:05:00Z', note: null, rowViews: 500, channelViews: 500, profile: {}, topUploads: [] };
const layerNoHistory = { tracks: catalogue, coverage: [coverageRow], source: { present: true, rows: 1, importedAt: null, note: null }, ownedLatest: {}, ownedHistory: {} };
const layer = { ...layerNoHistory, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: history } };
const obs = (period, territory, entries, extra = {}) => ({ id: `manual-import|song-views-weekly|${territory}|${period}`, source: 'manual-import', measure: 'song-views-weekly', territory, period, periodLabel: period, sourceUrl: 'x', collectedAt: `${period}T10:00:00Z`, note: null, entries, ...extra });
const nineEntry = entry({ rank: 42, title: '9 to 5', artists: ['Dolly Parton'], releaseDate: '1980-11-17' });
let ops = buildOpportunities([obs('2026-10-15', 'GB', [nineEntry, entry({ rank: 1, title: 'Blinding Lights', artists: ['The Weeknd'] })])], layerNoHistory);
assert.equal(ops.length, 1); assert.equal(ops[0].stage, 'act-editorially'); assert.match(ops[0].action, /"Live" recording of the same composition/);
assert.equal(ops[0].ownedUploads[0].views, 100, 'no owned reading: lifetime views come from the inventory snapshot'); assert.equal(ops[0].ownedUploads[0].readingAt, '2026-10-23T19:05:00Z'); assert.equal(ops[0].ownedUploads[0].gain, null);
assert.deepEqual(unmatchedCount([obs('2026-10-15', 'GB', [nineEntry, entry({ rank: 1, title: 'Blinding Lights', artists: ['The Weeknd'] })])], layerNoHistory), { total: 2, unmatched: 1 });
// Composition match never opens the paid-test gate, however persistent and however good the baseline.
ops = buildOpportunities([obs('2026-10-08', 'GB', [nineEntry]), obs('2026-10-15', 'GB', [nineEntry])], layer);
assert.equal(ops[0].persistence.periods, 2); assert.equal(ops[0].stage, 'act-editorially'); assert.ok(ops[0].ownedUploads[0].gain);
// Exact upload + 2 periods + own baseline opens the gate; one period or no baseline does not.
const exact = entry({ rank: 3, title: '9 to 5', artists: ['Dolly Parton'], videoId: 'aaaaaaaaaaa' });
assert.equal(buildOpportunities([obs('2026-10-08', 'GB', [exact]), obs('2026-10-15', 'GB', [exact])], layer)[0].stage, 'consider-paid-test');
assert.equal(buildOpportunities([obs('2026-10-15', 'GB', [exact])], layer)[0].stage, 'act-editorially');
assert.equal(buildOpportunities([obs('2026-10-08', 'GB', [exact]), obs('2026-10-15', 'GB', [exact])], { ...layer, ownedHistory: { UC2_BNEOjEi2plnmHUppPLzQ: [history[1]] } })[0].stage, 'act-editorially');
// Different sources are never pooled for persistence.
ops = buildOpportunities([obs('2026-10-08', 'GB', [exact]), { ...obs('2026-10-15', 'GB', [exact]), id: 'youtube-charts-page|song-views-weekly|GB|2026-10-15', source: 'youtube-charts-page' }], layer);
assert.ok(ops.every(o => o.persistence.periods === 1));
assert.equal(songKey(nineEntry), 'text:9 to 5|dolly parton');

/* ── Contextual matches respect floors and skip baseline/era/presentation ── */
const ctx = contextualMatches(patterns, { tracks: [], coverage: [], source: { present: false, rows: 0, importedAt: null, note: null }, ownedLatest: {}, ownedHistory: {} });
assert.deepEqual(ctx, [], 'no catalogue, no contextual matches');

/* ── Findings on the real seeds, with a tiny catalogue ─────────── */
const realOps = buildOpportunities(seeds, layerNoHistory);
const findings = buildFindings(bank, patterns, realOps, []);
assert.ok(findings.find(f => f.id === 'persistence').headline.includes('all 3 stored weeks'));
assert.ok(findings.find(f => f.id === 'era|GB'));
assert.ok(findings.find(f => f.id === 'direct-fit').headline.includes('compositions we hold'));
assert.ok(findings.every(f => f.numbers.every(n => typeof n.value === 'string')));
assert.equal(buildFindings(buildBank([]), [], [], [])[0].id, 'none');

/* ── Manual chart import ────────────────────────────────────────── */
const csv = 'Rank,Previous Rank,Track Name,Artist Names,Periods on Chart,Views,YouTube URL,Release Date\n2,"5","9 to 5","Dolly Parton",8,"216,151",https://www.youtube.com/watch?v=UbxUSsFXYo4,1980-11-17\n1,-,Other Song,"A, B",1,999,,';
const imported = parseManualChart({ text: csv, measure: 'song-views-weekly', territory: 'GB', period: '2026-10-15', sourceUrl: '', note: 'test' });
assert.equal(imported.observation.id, 'manual-import|song-views-weekly|GB|2026-10-15');
assert.equal(imported.observation.entries[1].releaseDate, '1980-11-17'); assert.equal(imported.observation.entries[1].measureValue, 216151); assert.equal(imported.observation.entries[1].videoId, 'UbxUSsFXYo4');
assert.equal(imported.observation.entries[0].isNew, true);
assert.throws(() => parseManualChart({ text: 'a,b\n1,2', measure: 'song-views-weekly', territory: 'GB', period: '2026-10-17', sourceUrl: '', note: '' }), /No title column/);
assert.throws(() => parseManualChart({ text: csv, measure: 'song-views-weekly', territory: 'Britain', period: '2026-10-17', sourceUrl: '', note: '' }), /Territory/);
const cat = parseSourceCatalogue('isrc,title,artist,genre,year,rights\nGBAYE0601498,Jolene,Dolly Parton,country,1973,cleared\n,No Artist,,,,');
assert.equal(cat.rows.length, 1); assert.equal(cat.skipped, 1); assert.ok(cat.rows[0].labels.some(l => l.dimension === 'genre' && l.provenance === 'verified'));

/* ── Demonstration and decisions ───────────────────────────────── */
const demo = buildOpportunities([demoObservation()], layerNoHistory)[0];
assert.match(demo.signal.periodLabel, /DEMONSTRATION/); assert.equal(demo.matches[0].track.videoId, 'hSkegNLcf8A');
const d = makeDecision({ opportunity: demo, stage: 'act-editorially', actualAction: ' pinned ', notes: '' }, '2026-10-23T12:00:00Z');
assert.equal(d.actualAction, 'pinned'); assert.equal(d.test, null); assert.equal(d.ownedUploads[0].views, 100);
assert.equal(makeDecision({ opportunity: demo, stage: 'consider-paid-test' }).test, null);

/* ── Empty states ───────────────────────────────────────────────── */
assert.deepEqual(buildOpportunities([], layer), []);
assert.deepEqual(findPatterns(buildBank([])), []);
assert.deepEqual(buildOpportunities([obs('2026-10-15', 'GB', [nineEntry])], { ...layer, tracks: [] }), []);

console.log('music-opportunities: all checks passed');
