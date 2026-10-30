import type { GeneratedPlan, PhaseName } from '../planEngine';
import type { CoachEvidence, Decisions, RoadmapAction, TrackRoadmap } from './roadmap';
import { classifyUploadFormat, getFormatMeta } from '../formatClassifier';
import { viewsAtAge, type VideoSeries } from '../videoSnapshots';
import { RULES_VERSION } from '../intelligence/fanResponse';
import { campaignPerformanceFor } from '../intelligence/campaignWindow';

export type CoachStatus = {
  phase: PhaseName;
  headline: string;
  current: string;
  next: string;
  cadence: string;
  fresh: boolean;
  campaign: string | null;
  priorities: TrackRoadmap[];
  metrics: {views:number|null;assets:number;shorts:number;longform:number;start:string}|null;
  shortsRead: {weekly:number;mean:number|null;count:number};
  launch: string|null;
  audience: {tone:string;theme:string|null;comments:number;assets:number;date:string}|null;
  albumIdea: {label:string;reason:string;date:string}|null;
};
const DAY=86400000;
const date=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const n=(v:number)=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(v);
const visual=(f:string)=>['omv','lyric','visualiser','live','acoustic'].includes(f.split(':')[0]);
const add=(s:string,d:number)=>new Date(Date.parse(s+'T12:00:00Z')+d*DAY).toISOString().slice(0,10);

/** One small decision layer; only observed signals become facts. */
export function buildCoachStatus({plan,evidence,tracks,decisions={},campaignStartDate,now=Date.now(),gains={},series={}}:{
  plan:GeneratedPlan;evidence:CoachEvidence;tracks:TrackRoadmap[];decisions?:Decisions;campaignStartDate?:string;
  now?:number;gains?:Record<string,{gain:number;spanDays:number}>;series?:Record<string,VideoSeries>;
}):CoachStatus {
  const today=new Date(now).toISOString().slice(0,10);
  const fresh=!!evidence.audit.dataAt && now-Date.parse(evidence.audit.dataAt)<=3*DAY && Date.parse(evidence.audit.dataAt)<=now+DAY;
  const inventory=evidence.uploads.filter(u=>!u.isCollab&&u.live!=='upcoming'&&Date.parse(u.publishedAt)<=now);
  const long=inventory.filter(u=>visual(classifyUploadFormat({...u,description:''}))).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  const actual=(t:TrackRoadmap)=>t.actions.filter(a=>a.video&&!a.scheduled&&visual(a.format));
  const started=tracks.filter(t=>t.releaseDate<=today||actual(t).length>0).sort((a,b)=>{
    const last=(t:TrackRoadmap)=>actual(t).map(a=>a.video!.date).sort().pop()??t.releaseDate;
    return last(b).localeCompare(last(a));
  });
  const focus=started[0];
  const focusLive=focus?actual(focus):[];
  const anchor=focusLive.slice().sort((a,b)=>b.video!.date.localeCompare(a.video!.date))[0];
  const upcoming=tracks.filter(t=>t.releaseDate>today&&!actual(t).length).sort((a,b)=>a.releaseDate.localeCompare(b.releaseDate))[0];
  const album=plan.events.filter(e=>e.kind==='albumRelease').sort((a,b)=>a.dateISO.localeCompare(b.dateISO))[0];
  const albumFuture=album&&album.dateISO>today;
  const age=anchor?Math.floor((now-Date.parse(anchor.video!.date+'T12:00:00Z'))/DAY):null;
  const phase:PhaseName=anchor?(age!<=7?'RELEASE':'SCALE'):focus?'RELEASE':'BUILD';
  const u=anchor?inventory.find(u=>u.id===anchor.video!.id):undefined;
  const current=anchor?`${focus!.name}: ${anchor.label.toLowerCase()} live · ${n(u?.viewCount??0)} views since ${date(anchor.video!.date)}`:focus?`${focus.name}: release reached; main video not identified`:'No release video identified yet';
  const next=upcoming?`${upcoming.name} · ${date(upcoming.releaseDate)}`:albumFuture?`Album · ${date(album.dateISO)}`:'No further release date mapped';
  const headline=anchor?`${focus!.name} is live${albumFuture?` · album due ${date(album.dateISO)}`:''}.`:upcoming?`Preparing ${upcoming.name} · ${date(upcoming.releaseDate)}.`:'Confirm the release assets and dates.';
  const latest=long[0];
  const recent=inventory.filter(u=>Date.parse(u.publishedAt)>=now-30*DAY);
  const shorts=recent.filter(u=>classifyUploadFormat({...u,description:''})==='short').length;
  const prior=anchor?long.find(u=>u.publishedAt.slice(0,10)<anchor.video!.date):undefined;
  const gap=prior&&anchor?Math.round((Date.parse(anchor.video!.date)-Date.parse(prior.publishedAt.slice(0,10)))/DAY):null;
  const cadence=`Last 30 days: ${recent.length-shorts} long-form · ${shorts} Shorts${gap&&gap>=14?` · ${gap} days between the latest tracked release videos`:latest?` · last long-form ${date(latest.publishedAt.slice(0,10))}`:''}`;
  const metrics=campaignPerformanceFor({uploads:inventory,statedAt:campaignStartDate,statedBy:campaignStartDate?'Artist campaign setup':undefined,now});
  const campaign=metrics?`${metrics.views==null?'—':n(metrics.views)} tracked campaign views · ${metrics.assets} assets`:null;
  const shortWindow=inventory.filter(u=>Date.parse(u.publishedAt)>=now-28*DAY && classifyUploadFormat({...u,description:''})==='short');
  const shortsRead={weekly:Math.round(shortWindow.length/4*10)/10,mean:shortWindow.length?Math.round(shortWindow.reduce((s,u)=>s+u.viewCount,0)/shortWindow.length):null,count:shortWindow.length};
  let launch:string|null=null;
  const currentSeries=u?series[u.id]:undefined;
  const latestObservation=currentSeries?.observations.filter(o=>o.ts<=today).slice().sort((a,b)=>a.ts.localeCompare(b.ts)).pop();
  const comparisonAge=latestObservation&&currentSeries?.publishedAt?Math.round((Date.parse(latestObservation.ts+'T12:00:00Z')-Date.parse(currentSeries.publishedAt))/DAY):null;
  if(anchor&&u&&comparisonAge!==null&&comparisonAge>=1&&comparisonAge<=28&&latestObservation&&now-Date.parse(latestObservation.ts+'T12:00:00Z')<=3*DAY){
    const priorReleaseIds=new Set(tracks.filter(t=>t.id!==focus?.id).flatMap(t=>actual(t).map(a=>a.video!.id)));
    const priorSame=long.find(v=>priorReleaseIds.has(v.id)&&Date.parse(v.publishedAt)<Date.parse(u.publishedAt)&&classifyUploadFormat({...v,description:''})===classifyUploadFormat({...u,description:''}));
    const currentDay=viewsAtAge(series[u.id]??null,comparisonAge,0);
    const priorDay=priorSame?viewsAtAge(series[priorSame.id]??null,comparisonAge,0):null;
    if(currentDay&&priorDay&&priorDay.views>0){
      const change=Math.round((currentDay.views/priorDay.views-1)*100);
      const priorTrack=tracks.find(t=>t.actions.some(a=>a.video?.id===priorSame!.id))?.name??'previous video';
      const firstCurrent=viewsAtAge(series[u.id]??null,1,0);
      const firstPrior=priorSame?viewsAtAge(series[priorSame.id]??null,1,0):null;
      const firstChange=firstCurrent&&firstPrior&&firstPrior.views>0?Math.round((firstCurrent.views/firstPrior.views-1)*100):null;
      const first=comparisonAge>1&&firstChange!==null?`Day 1 ${firstChange>=0?'+':''}${firstChange}%; `:'';
      launch=`${first}${change>=0?'+':''}${change}% vs ${priorTrack} at recorded day ${comparisonAge} (${n(currentDay.views)} vs ${n(priorDay.views)} views). Watching, not a reason to add uploads.`;
    }
  }
  const fr=evidence.fanResponse;
  const sampledIds=fr?.evidence?.assetsSampled?.map(a=>a.videoId)??[];
  const focusIds=new Set(focus?.actions.filter(a=>a.video&&!a.scheduled).map(a=>a.video!.id)??[]);
  const audience=fr&&fr.rulesVersion===RULES_VERSION&&Date.parse(fr.computedAt)<=now&&now-Date.parse(fr.computedAt)<=7*DAY&&fr.confidence!=='low'&&fr.gates?.volume&&fr.gates?.freshness&&sampledIds.some(id=>focusIds.has(id))?{
    tone:({overwhelmingly_positive:'Very positive',mostly_positive:'Mostly positive',mixed:'Mixed',negative:'Negative'} as const)[fr.tone],
    theme:fr.dominantTheme?({return:'The return',song:'The song',visual:'The visuals',live:'Live performance',nostalgia:'Catalogue memories',anticipation:'What comes next',surprise:'Surprise',member:'Band members'} as const)[fr.dominantTheme]:null,
    comments:fr.evidence.commentsRetrieved,assets:sampledIds.length,date:fr.computedAt.slice(0,10)
  }:null;
  const livePoint=evidence.dive?.recommendedContentDirections.find(p=>p.needTags.some(tag=>['archive_live','performance_as_hero'].includes(tag)));
  const priorTrack=started.find(t=>t.id!==focus?.id&&actual(t).length&&!actual(t).some(a=>['live','acoustic'].includes(a.format.split(':')[0])));
  const albumIdea=albumFuture&&livePoint&&priorTrack?{
    label:`Explore a ${priorTrack.name} performance before the album`,
    reason:`Deep dive: ${livePoint.point} Check whether suitable footage exists or can be captured.`,
    date:add(album.dateISO,-7)
  }:null;
  const priorities:TrackRoadmap[]=[];
  const pending=(a:RoadmapAction)=>!['done','dismissed'].includes(decisions[a.id]?.status??'suggested');
  const push=(t:TrackRoadmap,a:RoadmapAction)=>{if(pending(a))priorities.push({...t,id:t.id+":"+a.format,actions:[{...a,label:`${t.name}: ${a.label}`} ]});};
  if(fresh){
    // Current focus first, never old campaign backlog. Once a second visual exists,
    // do not keep commissioning another merely because another format is absent.
    if(focus&&anchor&&age!<=35&&focusLive.length<2){
      const a=focus.actions.find(a=>!a.video&&a.format!=='hero'&&a.format!=='short'&&pending(a));
      if(a){
        const gain=u?gains[u.id]:undefined;
        const performance=u?`${n(u.viewCount)} views since ${date(anchor.video!.date)}${gain?`; +${n(gain.gain)} across ${gain.spanDays} recorded days`:''}`:'Release video is live';
        const nominal=add(anchor.video!.date,10);
        let target=nominal<today?today:nominal;
        if(upcoming&&target>=upcoming.releaseDate)target=add(upcoming.releaseDate,-3)<today?today:add(upcoming.releaseDate,-3);
        const format=evidence.audit.visuals.formats.find(f=>f.key===a.format);
        const testFormat=format&&format.count>=3;
        push(focus,{...a,label:testFormat?`Test a ${format.name.toLowerCase()} follow-up`:'Agree one distinct follow-up video',date:target,
          reason:`No second visual identified for this track. Suggested window ${date(add(anchor.video!.date,7))}–${date(add(anchor.video!.date,14))}. ${testFormat?`${format.count} ${format.name.toLowerCase()} examples in the channel history; check available material.`:"Check available performance or visual material."}`,
          basis:`Current release inventory + upload history. ${a.reason} ${a.basis} A second destination is a suggestion, not a required format count.`});
      }
    }
    if(upcoming){
      const a=upcoming.actions.find(a=>a.format==='hero'||a.scheduled);
      if(a)push(upcoming,{...a,label:a.scheduled?'Verify the linked release video':'Confirm the release video',reason:`Next single ${date(upcoming.releaseDate)}; ${a.scheduled?'the linked video is not yet confirmed public':'no main visual identified in the channel reading'}. ${a.available?'A matching asset file is available.':'Confirm the asset with the artist team.'}`});
    }
    if(!anchor&&focus){const a=focus.actions.find(a=>a.format==='hero'||a.scheduled);if(a)push(focus,{...a,label:'Check the release video',date:today,reason:'Release date reached; a public main video has not been identified. Check visibility and matching before creating another asset.'});}
  }
  return {metrics:metrics?{views:metrics.views,assets:metrics.assets,shorts:metrics.shorts,longform:metrics.longForm,start:metrics.start.at}:null,shortsRead,launch,audience,albumIdea,phase,headline,current,next,cadence,fresh,campaign,priorities:priorities.slice(0,2)};
}
