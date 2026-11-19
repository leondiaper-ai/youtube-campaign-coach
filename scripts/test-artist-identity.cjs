const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/artistIdentity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod.exports);
const { normalizeArtistIdentity: norm, resolveArtistIdentity: resolve } = mod.exports;
// The production failure: both all-caps names previously normalised to empty.
const ruel = { name: 'RUEL', slug: 'oneruel', channelHandle: '@oneruel' };
const chvrches = { name: 'CHVRCHES', slug: 'chvrches', channelHandle: '@CHVRCHES' };
assert.equal(norm('CHVRCHES'), 'chvrches');
assert.equal(norm('RUEL'), 'ruel');
assert.equal(resolve([ruel, chvrches], 'CHVRCHES'), chvrches);
assert.equal(resolve([chvrches, ruel], 'RUEL'), ruel);
assert.equal(resolve([ruel, chvrches], 'chvrches'), chvrches);
assert.equal(norm('BÉYONCÉ'), 'beyonce');
assert.equal(norm('Tom A. Smith'), norm('tom-a-smith'));
assert.equal(resolve([ruel, chvrches], ''), undefined);
assert.equal(resolve([ruel, chvrches], '!!!'), undefined);
assert.equal(resolve([ruel, chvrches], 'Unknown'), undefined);
assert.equal(resolve([chvrches, { name: 'CHVRCHES', slug: 'different-channel' }], 'CHVRCHES'), undefined);
// All four former copies must use the shared, tested normalizer.
for (const file of ['src/app/coach/[slug]/page.tsx', 'src/app/watcher/[slug]/page.tsx', 'src/app/youtube-uk/page.tsx', 'src/app/api/youtube-uk/roster-export/route.ts']) {
  assert.ok(fs.readFileSync(file, 'utf8').includes("@/lib/artistIdentity"), file);
}
console.log('Artist identity regressions passed (cross-artist, accents, blank, unknown, ambiguity, shared consumers).');
