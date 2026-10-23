/* Focused calculation and release-gate checks. No network or credentials. */
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = new Module(file); m.filename = file; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : original(name);
  m._compile(source, file); cache.set(file, m.exports); return m.exports;
}
const { OWNED_CHANNELS, validChannelId } = load('src/lib/ownedChannels/channels.ts');
const { summariseChannel, median } = load('src/lib/ownedChannels/metrics.ts');
const { ownedChannelsEnabled } = load('src/lib/ownedChannels/gate.ts');
assert.equal(OWNED_CHANNELS.length, 10);
assert.equal(OWNED_CHANNELS.filter(c => validChannelId(c.id)).length, 9);
assert.equal(median([10, 20]), 15); assert.equal(median([]), null);
const now = Date.parse('2026-10-23T12:00:00Z'), day = 86400000, def = OWNED_CHANNELS[0];
const video = (id, age, views) => ({ id, title: 'Artist - Song', publishedAt: new Date(now - age * day).toISOString(), durationSec: 220, views, live: 'none' });
const snap = (ago, views, items = []) => ({ channelId: def.id, title: def.name, collectedAt: new Date(now - ago * day).toISOString(), subs: 100, views, thumbnail: null, items, reachedEnd: true, reachedWindow: false });
let row = summariseChannel(def, [], now);
assert.equal(row.views7d, null); assert.equal(row.current, null); assert.equal(row.medianTrack, null);
row = summariseChannel(def, [snap(0, 200, [video('new', 2, 100), video('week', 8, 20), video('old', 31, 20000), video('future', -1, 500)])], now);
assert.equal(row.views7d, null); assert.equal(row.medianTrack, 20); assert.equal(row.trackSample, 1);
assert.equal(row.recent.length, 2); assert.equal(row.topVideos.length, 3);
row = summariseChannel(def, [snap(2, 100), snap(0, 200)], now); assert.equal(row.views7d, null);
row = summariseChannel(def, [snap(7, 100), snap(0, 200)], now); assert.equal(row.views7d, 100); assert.equal(row.subs7d, 0);
row = summariseChannel(def, [snap(7, 300), snap(0, 200)], now); assert.equal(row.views7d, -100);
row = summariseChannel(def, [snap(10, 100), snap(3, 200)], now); assert.equal(row.stale, true); assert.equal(row.views7d, null);
row = summariseChannel(def, [{ ...snap(0, 200), reachedEnd: false }], now); assert.equal(row.firstUpload, null); assert.equal(row.covers30d, false);
row = summariseChannel(def, [{ ...snap(0, 200, [video('last', 8, 20)]), reachedWindow: true }], now); assert.equal(row.firstUpload, null);
process.env.NODE_ENV = 'production'; process.env.VERCEL_ENV = 'production'; assert.equal(ownedChannelsEnabled(), false);
process.env.VERCEL_ENV = 'preview'; assert.equal(ownedChannelsEnabled(), true);
delete process.env.VERCEL_ENV; process.env.NODE_ENV = 'development'; assert.equal(ownedChannelsEnabled(), true);
console.log('Owned Channels checks passed: roster, missing data, early cohorts, baselines, staleness, corrections, partial history and production gate.');
