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
    if (name === '@upstash/redis') return { Redis: FakeRedis };
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

const data=new Map();
class FakeRedis {
  async get(k){const v=data.get(k);return v?structuredClone(v):null;}
  async set(k,v,opts){if(opts?.nx && data.has(k))return null;data.set(k,structuredClone(v));return 'OK';}
  async del(k){data.delete(k);}
}
process.env.UPSTASH_REDIS_REST_URL='https://example.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='test';process.env.YOUTUBE_API_KEY='test';
let requests=0;
global.fetch=async raw=>{
  requests++;const u=new URL(raw);let result;
  if(u.pathname.endsWith('/channels'))result={items:[{statistics:{videoCount:'12'},contentDetails:{relatedPlaylists:{uploads:'playlist'}}}]};
  else if(u.pathname.endsWith('/playlistItems')) {const p=Number(u.searchParams.get('pageToken')||0);result={items:[{contentDetails:{videoId:'video'+p}}],...(p<11?{nextPageToken:String(p+1)}:{})};}
  else result={items:u.searchParams.get('id').split(',').map(id=>({id,snippet:{channelId:id==='video0'?'linked-channel':'channel',title:id,publishedAt:'2020-01-01',liveBroadcastContent:'none'},contentDetails:{duration:'PT3M',caption:'true'},statistics:{viewCount:'100'}}))};
  return {ok:true,json:async()=>result};
};
(async()=>{
  const {scanAuditCatalogue,readAuditCatalogue}=load('src/lib/channelAuditCatalogue.ts');
  const first=await scanAuditCatalogue('channel');assert.equal(first.scannedIds,10);assert.equal(first.complete,false);assert.equal(first.nextPage,'10');
  const second=await scanAuditCatalogue('channel');assert.equal(second.scannedIds,12);assert.equal(second.complete,true);assert.equal(second.uploads.length,12);assert(second.uploads[0].captions);assert.equal(second.uploads[0].uploaderChannelId,'linked-channel','Retain linked uploads explicitly returned in the artist uploads playlist');assert(second.includesLinkedUploads);assert.equal(second.uploads[0].durationSec,180);
  const before=requests;await scanAuditCatalogue('channel');assert.equal(requests,before,'Fresh complete scan must make zero vendor calls');
  assert.equal((await readAuditCatalogue('channel')).uploads.length,12);
  data.set('audit:catalogue:v1:channel',{...second,includesLinkedUploads:undefined});
  const repaired=await scanAuditCatalogue('channel');assert.equal(repaired.complete,false);assert.equal(repaired.scannedIds,10,'Old filtered caches must restart, not remain falsely complete');
  console.log('Catalogue checks passed: pagination, saved progress, resume, captions, duration and weekly cache.');
})().catch(e=>{console.error(e);process.exitCode=1;});
