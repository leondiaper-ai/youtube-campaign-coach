const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, req = require) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports:{}};
  new Function('require','module','exports',code)(req,mod,mod.exports);
  return mod.exports;
}
(async () => {
  const {parseTimeline} = load('src/lib/planEngine.ts');
  const events = parseTimeline('18 December 2026 - Single release\n15 January 2027 - Album release\n2027-02-12 - Music video\n2027-02-31 - Invalid date');
  assert.deepEqual(events.map(e=>e.dateISO), ['2026-12-18','2027-01-15','2027-02-12']);
  const {parseBriefingDate,daysUntilBriefingDate} = load('src/lib/briefingDates.ts');
  const now = new Date('2026-11-09T12:00:00Z');
  assert.equal(parseBriefingDate('15 Jan 2027',now).getFullYear(),2027);
  assert.equal(daysUntilBriefingDate('15 Jan 2027',now),67);
  assert.equal(daysUntilBriefingDate('15 Jan 2026',now),-298);
  assert.equal(daysUntilBriefingDate(null,now),null);
  assert.equal(daysUntilBriefingDate('invalid',now),null);
  const data = new Map([
    ['plan:digga-new-album',{slug:'digga-new-album'}],
    ['plan:keep',{slug:'keep'}],
    ['plans:index',[{slug:'digga-new-album'},{slug:'keep'}]],
  ]);
  process.env.KV_REST_API_URL='https://test.invalid'; process.env.KV_REST_API_TOKEN='test';
  class Redis { async get(k){return data.get(k)} async set(k,v){data.set(k,v)} async del(k){data.delete(k)} }
  const {deletePlan,listPlans,loadPlan} = load('src/lib/planStore.ts', n=>n==='@upstash/redis'?{Redis}:require(n));
  await deletePlan('digga-new-album');
  assert.equal(await loadPlan('digga-new-album'),undefined);
  assert.deepEqual((await listPlans()).map(p=>p.slug),['keep']);
  assert.deepEqual(await loadPlan('keep'),{slug:'keep'});
  console.log('PASS: explicit 2027 dates, ISO timeline dates, invalid dates, deletion persistence and unrelated campaign preservation');
})().catch(e=>{console.error(e);process.exit(1)});
