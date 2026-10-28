const fs = require('fs');
const ts = require('typescript');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('src/lib/intelligence/campaignCoverSelection.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const box = { exports: {} }; vm.runInNewContext(compiled, box);
const { selectCoverHeroes, isCoverLongForm } = box.exports;
const now = Date.parse('2026-10-27T12:00:00Z');
const item = (videoId, publishedAt, kind, durationSec, title = videoId) => ({videoId, publishedAt, kind, durationSec, title, sourceAspect: kind === 'short' ? 'portrait' : 'landscape'});
const lyric = item('lyric','2026-10-20T12:00:00Z','lyric',200);
const visual = item('visual','2026-10-23T12:00:00Z','visualiser',220);
const short = item('short','2026-10-26T12:00:00Z','short',40);
const trailer = item('trailer','2026-10-25T12:00:00Z','trailer',150);
const scheduled = item('future','2026-10-28T12:00:00Z','omv',220);
assert.deepStrictEqual(Array.from(selectCoverHeroes([lyric,short,trailer,visual,scheduled],now), x=>x.videoId), ['visual']);
assert.deepStrictEqual(Array.from(selectCoverHeroes([short,lyric,short],now), x=>x.videoId), ['lyric']);
assert.equal(isCoverLongForm(item('vertical','2026-10-26','long',150,'A song #shorts')),false);
assert.equal(isCoverLongForm(item('live','2026-10-26','live',240)),true);
assert.equal(isCoverLongForm(item('bts','2026-10-26','bts',240)),true);
assert.deepStrictEqual(Array.from(selectCoverHeroes([short],now),x=>x.videoId),['short']);
console.log('Campaign cover selection tests passed');
let events = [];
const timelineSource = fs.readFileSync('src/lib/intelligence/campaignTimeline.ts','utf8');
const timelineBox = { exports:{}, require: (name) => {
  if (name === '../coach-bot/horizon') return { listMergedEvents: async()=>events,
    isMajor:t=>['SINGLE_RELEASE','ALBUM_RELEASE'].includes(t),
    isLongForm:t=>['OMV','LYRIC_VIDEO','VISUALISER'].includes(t) };
  throw new Error(name);
}, Date };
vm.runInNewContext(ts.transpileModule(timelineSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,timelineBox);
(async()=>{
  const {buildCampaignTimeline}=timelineBox.exports;
  const now = Date.parse('2026-10-27T12:00:00Z');
  events=[{eventId:'1',eventType:'LYRIC_VIDEO',eventDate:'2026-10-27',status:'CONFIRMED',title:'Roses - lyric video'},
    {eventId:'2',eventType:'SINGLE_RELEASE',eventDate:'2026-10-30',status:'CONFIRMED',title:'Overthinker - single'},
    {eventId:'3',eventType:'ALBUM_RELEASE',eventDate:'2027-01-22',status:'CONFIRMED',title:'Album'}];
  const assets=[{videoId:'1',title:'Artist - Roses (Lyric Video)',publishedAt:'2026-10-27T10:00:00Z',dateLabel:'27 OCT',formatLabel:'LYRIC VIDEO',aspect:'landscape',thumb:'',url:'',views:10}];
  const rollout={items:[{spine:true,needTags:['follow_up_7_14'],status:'AHEAD',title:'Follow up'}]};
  const closed={from:'2026-10-01',to:'2026-10-08',fromLabel:'1 OCT',toLabel:'8 OCT',state:'CLOSED',daysUntilOpens:-26,daysUntilCloses:-19};
  const result=await buildCampaignTimeline('artist',assets,rollout,now,closed);
  assert.equal(result.moments.find(m=>m.kind==='NEXT').title,'Overthinker');
  assert.equal(result.moments.some(m=>m.kind==='WINDOW'),false);
  const open={...closed,state:'OPEN',from:'2026-10-27',to:'2026-11-03',fromLabel:'27 OCT',toLabel:'3 NOV'};
  const withWindow=await buildCampaignTimeline('artist',assets,rollout,now,open);
  assert.equal(withWindow.moments.some(m=>m.kind==='WINDOW'),true);
  events[1].title='Overthinker - Single release + announce album and pre-order';
  events[1].eventType='ANNOUNCEMENT';
  assets.push({...assets[0],videoId:'2',title:'Artist - Overthinker (Lyric Video)'});
  const published=await buildCampaignTimeline('artist',assets,rollout,now,closed);
  assert.equal(published.moments.find(m=>m.kind==='NEXT').title,'announce album and pre-order');
  console.log('Campaign timeline tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
