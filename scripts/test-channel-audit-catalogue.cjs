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
  else result={items:u.searchParams.get('id').split(',').map(id=>({id,snippet:{channelId:id==='video0'?'linked-channel':'channel',title:id,publishedAt:'2020-01-01',liveBroadcastContent:'none'},contentDetails:{duration:'PT3M',caption:'true'},statistics:{viewCount:'100',...(id==='video0'?{likeCount:'0',commentCount:'0'}:{})}}))};
  return {ok:true,json:async()=>result};
};
(async()=>{
  const {scanAuditCatalogue,readAuditCatalogue}=load('src/lib/channelAuditCatalogue.ts');
  const first=await scanAuditCatalogue('channel');assert.equal(first.scannedIds,10);assert.equal(first.complete,false);assert.equal(first.nextPage,'10');
  const second=await scanAuditCatalogue('channel');assert.equal(second.scannedIds,12);assert.equal(second.complete,true);assert.equal(second.uploads.length,12);assert(second.uploads[0].captions);assert.equal(second.uploads[0].uploaderChannelId,'linked-channel','Retain linked uploads explicitly returned in the artist uploads playlist');assert(second.includesLinkedUploads);assert.equal(second.uploads[0].durationSec,180);
  assert.deepEqual(second.uploads[0].engagementAvailability,{likes:true,comments:true},'Reported zeroes are measured zeroes');
  assert.deepEqual(second.uploads[1].engagementAvailability,{likes:false,comments:false},'Absent counters remain unavailable');
  const before=requests;await scanAuditCatalogue('channel');assert.equal(requests,before,'Fresh complete scan must make zero vendor calls');
  assert.equal((await readAuditCatalogue('channel')).uploads.length,12);
  data.set('audit:catalogue:v1:channel',{...second,includesLinkedUploads:undefined});
  const repaired=await scanAuditCatalogue('channel');assert.equal(repaired.complete,false);assert.equal(repaired.scannedIds,10,'Old filtered caches must restart, not remain falsely complete');
  const {reviewedReleaseSource}=load('src/lib/channelAuditSources.ts');
  const channel='UCCr1ACiFCncsPFXDmGzZPbw',source=reviewedReleaseSource(channel);
  data.set('audit:catalogue:v1:'+channel,{...second,channelId:channel,playlistFetchedAt:new Date(Date.now()-6*86400000).toISOString()});
  const playlistBefore=requests;
  const enriched=await scanAuditCatalogue(channel);
  assert(enriched.complete);assert.equal(enriched.scannedIds,12,'Adding reviewed sources does not rescan a fresh playlist');
  assert.equal(enriched.reviewedReleases.version,source.version);
  assert(source.videoIds.every(id=>enriched.uploads.some(u=>u.id===id)),'Known reviewed releases are hydrated into the same cache');
  assert.equal(enriched.reviewedReleases.videoCount,source.videoIds.length);
  assert.equal(new Set(enriched.uploads.map(u=>u.id)).size,enriched.uploads.length);
  assert(requests-playlistBefore<=2,'Hydrate in batches of fifty, without search or playlist replay');
  assert(Date.now()-Date.parse(enriched.playlistFetchedAt)>5*86400000,'Source hydration must not reset playlist freshness');
  const warm=requests;await scanAuditCatalogue(channel);assert.equal(requests,warm,'Warm reviewed catalogues make zero vendor calls');
  // A failure after the first source batch resumes the source offset, not the playlist.
  const channel2='UCsije18aD3hyH5jrXbfkNFw';
  data.set('audit:catalogue:v1:'+channel2,{...second,channelId:channel2});
  const fetchOk=global.fetch;let sourceBatches=0;
  // Count source batches regardless of ID spelling; the artist has 102 registered IDs.
  global.fetch=async raw=>{const url=new URL(raw);if(url.pathname.endsWith('/videos') && !url.searchParams.get('id').startsWith('video')){sourceBatches++;if(sourceBatches===2)return {ok:false,status:503};}return fetchOk(raw);};
  await assert.rejects(scanAuditCatalogue(channel2),/503/);
  const progress=data.get('audit:catalogue:v1:'+channel2);assert(progress.playlistComplete);assert(!progress.complete);assert.equal(progress.sourceOffset,50);
  global.fetch=fetchOk;
  const resumed=await scanAuditCatalogue(channel2);assert(resumed.complete);assert.equal(resumed.scannedIds,12);assert.equal(resumed.sourceOffset,reviewedReleaseSource(channel2).videoIds.length);
  console.log('Catalogue checks passed: pagination, saved progress, resume, captions, duration and weekly cache.');
})().catch(e=>{console.error(e);process.exitCode=1;});
