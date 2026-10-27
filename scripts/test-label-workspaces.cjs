const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  const req = name => {
    if (name === 'next/navigation') return { usePathname: () => '/labels/partisan' };
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(target+'.ts') ? '.ts' : '.tsx'));
    }
    return require(name);
  };
  new Function('require','module','exports',code)(req,mod,mod.exports);
  cache.set(file,mod.exports); return mod.exports;
}
const { getLabelWorkspace, isLabelArtist, joinLabelRoster } = load('src/lib/labels.ts');
const { resolveMarket, MARKET_IDS, marketKey } = load('src/lib/market.ts');
const { AppHeader } = load('src/components/ui/AppHeader.tsx');
const label = getLabelWorkspace('partisan');
assert.equal(label.name, 'Partisan Records');
assert.equal(getLabelWorkspace('label-partisan'), label);
assert.equal(getLabelWorkspace('unknown'), null);
assert(isLabelArtist(label, { name: 'IDLES' }));
assert(isLabelArtist(label, { name: "Sun's Signature" }));
assert(!isLabelArtist(label, { name: 'Kings of Leon' }));
assert(!isLabelArtist(label, { name: 'Fontaines D.C.' }), 'Alumni must not silently enter the current roster');
assert(isLabelArtist(label, { name: 'Explicitly added artist', markets: ['label-partisan'] }));
assert.equal(resolveMarket('label-partisan').orgName, label.name);
assert(!MARKET_IDS.includes('label-partisan'), 'Labels are not geographical workspaces');
assert.equal(marketKey('campaigns:pinned', 'uk'), 'campaigns:pinned');
assert.equal(marketKey('campaigns:pinned', 'label-partisan'), 'campaigns:pinned:label-partisan');
assert.notEqual(marketKey('plans:index', 'label-partisan'), marketKey('plans:index', 'uk'));
const nav = [{ href: '/growth?market=label-partisan', label:'Channel Health' },{ href:'/campaigns?market=label-partisan',label:'Active Campaigns' },{ href:'/coach?market=label-partisan',label:'Coach' },{ href:'/teams',label:'Workspaces' },{ href:'/resources',label:'Resources' },{ href:'/growth/owned',label:'Owned Channels' }];
const html = renderToStaticMarkup(React.createElement(AppHeader,{ workspace: label.name, nav }));
for (const name of ['Channel Health','Active Campaigns','Coach','Partisan Records']) assert(html.includes(name));
for (const name of ['Workspaces','Owned Channels','Resources','VMG']) assert(!html.includes(name));
assert(html.includes('/labels/partisan/logo.svg'));
assert(html.includes('aria-current="page"'));
const uk = renderToStaticMarkup(React.createElement(AppHeader,{ workspace:'Virgin Music UK', nav:nav.filter(n => n.label !== 'Owned Channels') }));
assert(uk.includes('VMG')); assert(uk.includes('Owned Channels'));
assert(fs.readFileSync('public/labels/partisan/logo.svg','utf8').includes('<svg'));
console.log('Label workspace checks passed: roster, isolation, branding, navigation and UK regression.');

const incoming = { name:'Incoming', phase:'PRE', ownership:'observed' };
const existing = { name:'IDLES', phase:'SUSTAIN', ownership:'virgin', campaignStartDate:'2026-01-01' };
const joined = joinLabelRoster(label, incoming, existing);
assert.equal(joined.phase, 'SUSTAIN'); assert.equal(joined.ownership, 'virgin');
assert.deepEqual(joined.markets, ['uk','label-partisan']);
assert.deepEqual(joinLabelRoster(label, incoming).markets, ['label-partisan']);
