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
const { buildChannelAudit, channelAuditText } = load('src/lib/channelAudit.ts');
const now = Date.parse('2026-10-27T12:00:00Z');
const base = {name:'Example',slug:'example',now,dataAt:'2026-10-27T08:00:00Z',stats:{subs:12000,lifetimeViews:1000000,views7d:null,views30d:null,subs7d:null}};
function upload(id,title,views=1000,days=20) {return {id,title,viewCount:views,publishedAt:new Date(now-days*86400000).toISOString(),durationSec:200,description:'',live:'none',likeCount:1,commentCount:0};}
const empty = buildChannelAudit({...base,uploads:[]});
assert.equal(empty.stats.views7d,null);
assert(!empty.gaps.length);
assert(!empty.summary.includes('0 channel views'));
assert(channelAuditText(empty).includes('Unavailable'));
const hero=upload('hero','Example - Song (Official Video)',50000);
const external={...upload('external','Example - Song (Live)',1000000),isCollab:true};
const future={...upload('future','Example - Song (Lyric Video)'),publishedAt:'2026-11-01T00:00:00Z',live:'upcoming'};
const a=buildChannelAudit({...base,uploads:[hero,hero,external,future]});
assert.equal(a.leaders.length,1,'Exclude duplicate, external and future uploads');
assert(a.gaps.some(g=>g.title.includes('no matched support')));
assert(a.findings[0].evidence.includes('sample share'));
const paired=buildChannelAudit({...base,uploads:[hero,upload('lyric','Example - Song (Lyric Video)',3000,10)]});
assert(!paired.gaps.some(g=>g.title.includes('no matched support')),'A matching lyric prevents a false gap');
const other=buildChannelAudit({...base,uploads:[hero,upload('other','Example - Other Song (Lyric Video)')]});
assert(other.gaps.some(g=>g.title.includes('no matched support')),'An unrelated song is not support');
const support=buildChannelAudit({...base,uploads:[hero,...[1,2,3].map(i=>upload('l'+i,'Example - Track '+i+' (Lyric Video)',i*100))]});
assert(support.findings.some(f=>f.title.includes('repeat evidence') && f.evidence.includes('200')));
const stale=buildChannelAudit({...base,dataAt:'2026-10-01',uploads:[hero]});
assert(stale.limitations.some(l=>l.includes('26 days old')));
console.log('Channel audit checks passed: unknowns, coverage, support evidence, matching, duplicates, external/future exclusions and export.');
const captions=buildChannelAudit({...base,uploads:[{...hero,captions:false}, {...upload('short','Example #shorts'),durationSec:25,captions:false}]});
assert(captions.gaps.some(g=>g.title==='Caption tracks to review' && g.evidence.includes('1 of 1')));
assert(!buildChannelAudit({...base,uploads:[{...hero,captions:true}]}).gaps.some(g=>g.title==='Caption tracks to review'));
assert(!buildChannelAudit({...base,uploads:[hero]}).gaps.some(g=>g.title==='Caption tracks to review'),'Unknown caption flag must not mean missing');
console.log('Caption audit guards passed.');
