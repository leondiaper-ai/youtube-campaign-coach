/* Focused calculation and release-gate checks. No network or credentials. */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const m = new Module(file); m.filename = file; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = name => {
    if (name === 'next/headers') return { cookies: () => ({ get: () => undefined }) };
    if (name === 'next/navigation') return { usePathname: () => '/growth', useRouter: () => ({ push() {}, refresh() {} }) };
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(`${target}.ts`) ? '.ts' : '.tsx'));
    }
    return original(name);
  };
  m._compile(source, file); cache.set(file, m.exports); return m.exports;
}
const { OWNED_CHANNELS, validChannelId } = load('src/lib/ownedChannels/channels.ts');
const { summariseChannel, median } = load('src/lib/ownedChannels/metrics.ts');
const { ownedChannelsEnabled } = load('src/lib/ownedChannels/gate.ts');
const { analyseOwnedChannel, observedMovement, meanDailyViews, publishingSeries, lengthBreakdown } = load('src/lib/ownedChannels/analysis.ts');
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
// A short observed span must retain its true duration instead of becoming "7d".
const readings = [snap(2, 100), snap(0, 180)].map(s => ({ at: s.collectedAt, views: s.views, subs: s.subs }));
const movement = observedMovement(readings, 'views', now - 7 * day);
assert.equal(movement.days, 2); assert.equal(movement.value, 80);
assert.equal(observedMovement(readings.slice(0, 1), 'views', now - 7 * day), null);
assert.equal(meanDailyViews(video('under-one-day', .5, 100), now), null);
assert.equal(meanDailyViews(video('eight-days', 8, 80), now), 10);
let analysis = analyseOwnedChannel(def, [snap(7, 100, [video('old', 20, 100)]), snap(0, 180, [video('old', 20, 90), video('new', 2, 10), video('unmatched', 20, 80)])], now);
assert.equal(analysis.videoGains.old.value, -10); // Corrections stay visible.
assert.deepEqual(analysis.videoGains.new, { value: 10, kind: 'new' });
assert.deepEqual(analysis.videoGains.unmatched, { value: null, kind: 'missing' });
analysis = analyseOwnedChannel(def, [snap(-1, 400), snap(0, 200)], now);
assert.equal(analysis.row.current.views, 200); // Future readings are excluded.
const publishing = publishingSeries([video('today', .1, 10)], now, 7, false);
assert.equal(publishing.length, 7); assert.equal(publishing[0].count, null);
assert.equal(publishing.at(-1).minimum, 1); // Unknown coverage is not filled with zero.
const completePublishing = publishingSeries([video('today', .1, 10)], now, 7, true);
assert.equal(completePublishing[0].count, 0); assert.equal(completePublishing.at(-1).count, 1);
const groups = lengthBreakdown([video('known', 10, 100), video('missing', 10, null)]);
assert.equal(groups[1].count, 2); assert.equal(groups[1].known, 1);
assert.equal(groups[1].views, 100); assert.equal(groups[1].median, 100);
// Render the sparse-data states and a populated graph. Warnings can indicate
// server/client hydration defects that type checks alone cannot catch.
const AnalysisView = load('src/app/growth/owned/[slug]/OwnedChannelAnalysis.tsx').default;
const originalError = console.error, renderWarnings = [];
try {
  console.error = (...args) => renderWarnings.push(args.join(' '));
  for (const history of [[], [snap(0, 200)], [snap(7, 100), snap(0, 200, [video('track', 10, 80)])]]) {
    const html = renderToStaticMarkup(React.createElement(AnalysisView, { analysis: analyseOwnedChannel(def, history, now), canCollect: false, readFailed: false }));
    assert(html.includes('Upload performance'));
    assert(!html.includes('NaN')); assert(!html.includes('Infinity'));
    if (history.length < 2) assert(html.includes('No matching seven-day baseline'));
    else { assert(html.includes('+100')); }
  }
} finally { console.error = originalError; }
assert.deepEqual(renderWarnings, [], 'Channel charts must render without hydration warnings');
process.env.NODE_ENV = 'production'; process.env.VERCEL_ENV = 'production'; assert.equal(ownedChannelsEnabled(), false);
process.env.VERCEL_ENV = 'preview'; assert.equal(ownedChannelsEnabled(), true);
delete process.env.VERCEL_ENV; process.env.NODE_ENV = 'development'; assert.equal(ownedChannelsEnabled(), true);
console.log('Owned Channels checks passed: roster, cohorts, observation spans, video gains, missing counters, publishing coverage and production gate.');

// Production authentication: missing key fails closed, tampered/expired sessions fail.
const auth = load('src/lib/ownedChannels/auth.ts');
process.env.VERCEL_ENV = 'production'; process.env.NODE_ENV = 'production';
delete process.env.OWNED_CHANNELS_SECRET;
assert.equal(auth.verifyOwnedSecret('anything'), false);
assert.equal(auth.validOwnedSession('123.fake'), false);
process.env.OWNED_CHANNELS_SECRET = 'test-only-key-at-least-20-characters';
assert.equal(ownedChannelsEnabled(), true);
assert.equal(auth.verifyOwnedSecret('wrong'), false);
assert.equal(auth.verifyOwnedSecret(null), false);
assert.equal(auth.verifyOwnedSecret(process.env.OWNED_CHANNELS_SECRET), true);
const cookie = auth.ownedSessionCookie();
assert.equal(auth.validOwnedSession(cookie.value), true);
assert.equal(auth.validOwnedSession(cookie.value + 'x'), false);
assert.equal(auth.validOwnedSession(cookie.value, Date.now() + 13 * 3600000), false);
assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true);
process.env.OWNED_CHANNELS_SECRET = 'a-different-test-only-key-at-least-20';
assert.equal(auth.validOwnedSession(cookie.value), false);
delete process.env.OWNED_CHANNELS_SECRET;
const { AppHeader } = load('src/components/ui/AppHeader.tsx');
const nav = [{ href: '/growth', label: 'Channel Health' }];
const renderNav = workspace => renderToStaticMarkup(React.createElement(AppHeader, { workspace, nav }));
assert(renderNav('Virgin Music UK').includes('Owned Channels'));
for (const workspace of ['Virgin Music Australia', 'Virgin Music Nordics', 'Virgin Music US']) assert(!renderNav(workspace).includes('Owned Channels'));
console.log('Production auth and UK-only navigation checks passed.');
