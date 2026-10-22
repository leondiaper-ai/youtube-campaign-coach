// Run with: node scripts/test-chartmetric-weekly.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const NOW = Date.parse('2026-10-22T12:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const country = (date, value = 1000) => ({obj:{insights:{countries:[{name:'United States',code2:'US',value,timestp:date}],cities:[]}}});
const ok = data => ({ok:true,data});
const markets = { US:{code:'US',name:'United States'}, AU:{code:'AU',name:'Australia'}, NZ:{code:'NZ',name:'New Zealand'} };
function vendor(handler) {
  const calls = [], exports = {};
  vm.runInNewContext(compile('src/lib/chartmetric/territories.ts'), {
    exports, Date:Clock, process:{env:{}}, require:name => {
      if(name === './client') return {cmFetch: async path => {calls.push(path);return handler(path);}};
      if(name === './resolve') return {resolveCmArtist: async () => ({cmArtistId:3657,cmArtistName:'Flight Facilities'})};
      if(name === '@/lib/territories/markets') return {MARKETS:markets};
      throw Error('Unexpected import '+name);
    },
  });
  return {calls,run:()=>exports.fetchTerritories({slug:'flightfacilities',name:'Flight Facilities'},'UCvBxvcqGSQkbs1BRafBIYSg')};
}
function api(seed, fetcher) {
  const data = new Map(seed), writes = [], exports = {};
  class Redis {
    async get(key) { return data.get(key) ?? null; }
    async set(key,value,options) {
      writes.push({key,options});
      if(options?.nx && data.has(key)) return null;
      data.set(key,value);return 'OK';
    }
  }
  vm.runInNewContext(compile('src/app/api/chartmetric/territories/[slug]/route.ts'), {
    exports, Date:Clock, setTimeout,
    process:{env:{UPSTASH_REDIS_REST_URL:'https://cache.invalid',UPSTASH_REDIS_REST_TOKEN:'test-only'}},
    require:name => {
      if(name === 'next/server') return {NextResponse:{json:(body,options)=>({body,status:options?.status??200})}};
      if(name === '@upstash/redis') return {Redis};
      if(name === '@/lib/artists') return {ARTISTS:[{slug:'flightfacilities',name:'Flight Facilities',channelHandle:'@flightfacilities'}],mergeArtistLists:(a,b)=>[...a,...b]};
      if(name === '@/lib/artistStore') return {listCustomArtists:async()=>[]};
      if(name === '@/lib/kvCache') return {readLiveSnapByHandle:async()=>({channelId:'UCtest'})};
      if(name === '@/lib/chartmetric/auth') return {chartmetricConfigured:()=>true};
      if(name === '@/lib/chartmetric/territories') return {fetchTerritories:fetcher};
      throw Error('Unexpected import '+name);
    },
  });
  return {data,writes,run:()=>exports.GET({}, {params:Promise.resolve({slug:'flightfacilities'})})};
}
(async()=>{
  let v=vendor(()=>ok(country('2026-10-21'))), result=await v.run();
  assert.equal(v.calls.length,1,'Fresh complete coverage needs one vendor request');
  v=vendor(path=>ok(path.includes('/stat/') ? {obj:{monthly_views:[{value:1000,timestp:'2026-10-01'}]}} : country('2026-10-01')));
  result=await v.run();
  assert.equal(result.reportingDate,'2026-10-01');
  assert.ok(v.calls.length<=5,'Unchanged source must stop without scanning all configured markets');
  v=vendor(path=>ok(path.includes('/stat/') ? {obj:{monthly_views:[{value:path.includes('code2=AU')?2000:1000,timestp:'2026-10-21'}]}} : country('2026-10-01')));
  result=await v.run();
  assert.equal(result.reportingDate,'2026-10-21','Newer country stats must replace a stale complete coverage response');
  assert.equal(result.countryMarketsChecked,3); assert.equal(result.countries[0].code2,'AU');
  v=vendor(path=>ok(path.includes('/stat/') ? {obj:{monthly_views:[{value:1000,timestp:'2026-10-01'}]}} : path.includes('?date=')?country('2026-10-01'):country('2026-10-11')));
  result=await v.run(); assert.equal(result.reportingDate,'2026-10-11','An older fallback must not replace newer saved coverage');
  const key='cm:territories:UCtest';
  const fresh={...result,countryLookupVersion:3,countryLookupComplete:true,fetchedAt:'2026-10-20T12:00:00Z'};
  let calls=0;
  let route=api([[key,fresh]],async()=>{calls++;throw Error('Unexpected vendor refresh');});
  await route.run();await route.run();assert.equal(calls,0,'Repeated visits within seven days spend zero vendor requests');
  const old={...fresh,fetchedAt:'2026-10-14T12:00:00Z'};
  const updated={...fresh,fetchedAt:'2026-10-22T12:00:00Z'};
  route=api([[key,old]],async()=>{calls++;await new Promise(r=>setTimeout(r,10));return updated;});
  await Promise.all([route.run(),route.run()]); assert.equal(calls,1,'Concurrent stale visits share one refresh');
  await route.run();assert.equal(calls,1,'A completed refresh is reused');
  assert.equal(route.writes.find(w=>w.key===key).options.ex,30*24*60*60,'Retain prior successful data through temporary failures');
  calls=0;route=api([[key,old]],async()=>{calls++;return {ok:false,reason:'http-429'};});
  assert.equal((await route.run()).body.fetchedAt,old.fetchedAt);
  await route.run();assert.equal(calls,1,'Failure backoff prevents repeated vendor calls');
  assert.equal(route.data.get(key).fetchedAt,old.fetchedAt,'A failure must not overwrite successful data or its check date');
  console.log('PASS: freshness selection, unchanged-source request bound, weekly cache, concurrent refresh lock, failure backoff, and last successful data.');
})().catch(e=>{console.error(e);process.exitCode=1;});
