import type { GeneratedPlan, PhaseName } from '../planEngine';
import { isAlbumRelease } from './roadmap';
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
const visual=(f:string)=>['omv','lyric','visualiser','live','acoustic','longform'].includes(f.split(':')[0]);
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
  const album=plan.events.filter(isAlbumRelease).sort((a,b)=>a.dateISO.localeCompare(b.dateISO))[0];
  const albumFuture=album&&album.dateISO>today;
  const age=anchor?Math.floor((now-Date.parse(anchor.video!.date+'T12:00:00Z'))/DAY):null;
  let phase:PhaseName=anchor?(age!<=7?'RELEASE':'SCALE'):focus?'RELEASE':'BUILD';
  const u=anchor?inventory.find(u=>u.id===anchor.video!.id):undefined;
  let current=anchor?`${focus!.name}: ${anchor.label.toLowerCase()} live · ${n(u?.viewCount??0)} views since ${date(anchor.video!.date)}`:focus?`${focus.name}: release reached; main video not identified`:'No release video identified yet';
  const next=upcoming?`${upcoming.name} · ${date(upcoming.releaseDate)}`:albumFuture?`Album · ${date(album.dateISO)}`:'No further release date mapped';
  const headline=anchor?`${focus!.name} is live${albumFuture?` · album due ${date(album.dateISO)}`:''}.`:upcoming?`Preparing ${upcoming.name} · ${date(upcoming.releaseDate)}.`:'Confirm the release assets and dates.';
  const latest=long[0];
  if (!anchor && latest) current=`Latest video: ${latest.title}`;
  const albumAge=album ? Math.floor((now-Date.parse(album.dateISO+'T00:00:00Z'))/DAY) : null;
  if (album && albumAge!==null && albumAge>=0) { phase=albumAge<=7?'RELEASE':'SCALE'; current=`Album released ${date(album.dateISO)}${latest?` · latest video: ${latest.title}`:''}`; }
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
  if (!fresh) {
    const context=upcoming ?? focus ?? (album?{id:`album:${album.dateISO}`,name:'Campaign',releaseDate:album.dateISO,actions:[]}:null);
    if (context) push(context,{id:`${context.id}:review-data`,format:'campaign_data',label:'Review the release plan',date:context.releaseDate,
      reason:'The dates are saved. Refresh the channel reading before checking published assets and choosing the next uploads.',basis:'Planning dates are available; the channel reading is missing or more than three days old.'});
  }
  if(fresh){
    // Album preparation and launch are campaign-level moments, even when every
    // single already has several videos. They do not depend on a deep dive.
    if (album && albumAge!==null && albumAge>=-14 && albumAge<=14) {
      const released=albumAge>=0;
      const context:TrackRoadmap={id:`album:${album.dateISO}`,name:'Album rollout',releaseDate:album.dateISO,actions:[]};
      const count=metrics?.longForm ?? 0;
      push(context,{
        id:`album:${album.dateISO}:${released?'connect':'prepare'}`,format:'campaign_album',
        label:released?'Connect the album rollout':'Prepare the album-week video',
        date:released?today:album.dateISO,
        reason:released
          ? `${count} campaign videos are live. Check the album playlist, featured video and links from new Shorts.`
          : `Album due ${date(album.dateISO)}. Confirm the release-week video and bring the ${count} existing campaign videos together in an album playlist.`,
        basis:released?'Album date reached; campaign upload inventory. Check playlist and related-video settings in Studio.':'Album release within two weeks; campaign dates and published uploads. Confirm the creative plan with the team.'
      });
    }

    const unplanned=long.find(v => !tracks.some(t=>t.actions.some(a=>a.video?.id===v.id))
      && now-Date.parse(v.publishedAt)<=14*DAY
      && plan.events.some(e=>e.dateISO<=v.publishedAt.slice(0,10)));
    if (unplanned) {
      const context:TrackRoadmap={id:`observed:${unplanned.id}`,name:unplanned.title,releaseDate:unplanned.publishedAt.slice(0,10),actions:[]};
      push(context,{id:`observed:${unplanned.id}:support`,format:'campaign_support',label:'Plan support for the latest video',
        date:add(unplanned.publishedAt.slice(0,10),10),
        reason:`${n(unplanned.viewCount)} views on this upload. Review a supporting video or Short that adds to it, using available material.`,
        basis:'Recent upload found on the channel but not matched to a release in the saved timeline. Check the campaign association before adding support.'});
    }

    // Current focus first, never old campaign backlog. Once a second visual exists,
    // do not keep commissioning another merely because another format is absent.
    if(focus&&anchor&&age!<=35&&focusLive.length<2){
      const a=focus.actions.find(a=>!a.video&&a.format!=='hero'&&a.format!=='short'&&pending(a));
      if(a){
        const gain=u?gains[u.id]:undefined;
        const performance=u?`${n(u.viewCount)} views since ${date(anchor.video!.date)}${gain?`; +${n(gain.gain)} across ${gain.spanDays} recorded days`:''}`:'Release video is live';
        const windowFrom=add(anchor.video!.date,7), windowTo=add(anchor.video!.date,14);
        const windowPassed=windowTo<today;
        const nominal=add(anchor.video!.date,10);
        let target=nominal<today?today:nominal;
        if(upcoming&&target>=upcoming.releaseDate)target=add(upcoming.releaseDate,-3)<today?today:add(upcoming.releaseDate,-3);
        const format=evidence.audit.visuals.formats.find(f=>f.key===a.format);
        const testFormat=format&&format.count>=3;
        push(focus,{...a,label:a.format==='live'&&!focusLive.some(v=>v.format.split(':')[0]==='visualiser')?'Plan a live version or visualiser follow-up':testFormat?`Plan a ${format.name.toLowerCase()} follow-up`:'Choose a follow-up video',date:target,
          /* ── expired windows ──────────────────────────────────────
             The nominal window is day 7–14 from the release. When that
             has already passed, `target` is clamped to today above — so
             printing the original window alongside a due date of today
             produced a card that contradicted itself ("by 30 Oct ·
             suggested window 2–9 Oct"). Past windows are now described
             as past, and the date is the only instruction. */
          reason:windowPassed
            ? 'The suggested follow-up window has passed. Review whether a new video still fits the campaign.'
            : `${a.format==='live'&&!focusLive.some(v=>v.format.split(':')[0]==='visualiser')?'Build the multi-format rollout with a live version or visualiser, using available material.':a.format==='lyric'?'Build the multi-format rollout with a lyric video that gives fans another way into the words.':a.format==='bts'?'Build the multi-format rollout with a behind-the-scenes video that adds to the song’s story.':a.format==='acoustic'?'Build the multi-format rollout with an acoustic performance if suitable material is available.':a.format==='visualiser'?'Build the multi-format rollout with a visualiser that develops the song’s visual world.':'Build the multi-format rollout with a supporting video that fits the song and available material.'} Suggested follow-up: 7–14 days after release (${date(windowFrom)}–${date(windowTo)}).`,
          basis:`Channel observation: one release video identified for this track. ${a.reason} ${a.basis} YouTube recommends continuing supporting visuals after release and using audience response to shape the format and cadence. Our ${date(windowFrom)}–${date(windowTo)} window is a campaign planning suggestion, not a YouTube requirement.`});
      }
    }
    if(upcoming){
      const a=upcoming.actions.find(a=>a.format==='hero'||a.scheduled);
      if(a)push(upcoming,{...a,label:a.scheduled?'Check the scheduled release video':'Prepare the release video',reason:a.scheduled?`Check the linked video’s visibility and scheduled date for ${date(upcoming.releaseDate)}.`:`Choose the video format and confirm the upload for ${date(upcoming.releaseDate)}. Check the title, thumbnail and release settings with the team.`});
    }
    if(!anchor&&focus){const a=focus.actions.find(a=>a.format==='hero'||a.scheduled);if(a)push(focus,{...a,label:'Check the release upload',date:today,reason:'The release date has arrived. Confirm whether the video is public, scheduled or still being prepared before planning another upload.'});}
  }
  return {metrics:metrics?{views:metrics.views,assets:metrics.assets,shorts:metrics.shorts,longform:metrics.longForm,start:metrics.start.at}:null,shortsRead,launch,audience,albumIdea,phase,headline,current,next,cadence,fresh,campaign,priorities:priorities.slice(0,2)};
}
