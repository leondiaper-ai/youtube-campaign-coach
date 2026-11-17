import type { RecentUpload } from './artists';
import type { UploadFormat } from './formatClassifier';

const DAY = 86400000;
const number = (v: number) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const date = (v: number) => new Date(v).toISOString().slice(0, 10);
const count = (n: number, singular: string, plural = singular + 's') => `${n} ${n === 1 ? singular : plural}`;

type Item = { u: RecentUpload; format: UploadFormat };
export type IntelVideo = {
  id: string; title: string; publishedAt: string; format: string; views: number;
  likes: number | null; comments: number | null; rate: number | null; older: boolean;
};
export type AuditIntel = {
  version: 1;
  state: 'limited' | 'empty' | 'early' | 'quiet-response' | 'quiet' | 'release-led' | 'shorts-led' | 'concentrated' | 'inconsistent' | 'regular' | 'developing';
  headline: string; read: string;
  window: { from: string; to: string; fresh: boolean; playlistComplete: boolean; reliable: boolean; note: string };
  activity: { uploads: number; shorts: number; audio: number; videos: number; views: number; activeWeeks: number; totalWeeks: number; latest: string | null };
  months: { month: string; label: string; videos: number; shorts: number; audio: number; partial: boolean }[];
  engagement: { views: number; likes: number; comments: number; measuredUploads: number; rate: number | null; note: string };
  formats: { key: string; name: string; uploads: number; views: number; measuredUploads: number; rate: number | null }[];
  proof: IntelVideo[];
  next: { title: string; evidence: string; action: string }[];
  movement: string | null;
  context: string | null;
  coverageWarning: string | null;
};
const NAMES: Record<UploadFormat, string> = {
  short:'Shorts', omv:'Music videos', live:'Live performance', lyric:'Lyric videos', visualiser:'Visualisers', bts:'Behind the scenes',
  acoustic:'Acoustic performance', audio:'Release audio', documentary:'Documentaries', interview:'Interviews', tour:'Tour films', longform:'Other long-form',
};
/** Old caches converted absent API fields to zero. A positive legacy count is
 * usable; a legacy zero remains unknown until a reading carries availability. */
function measured(u: RecentUpload, key: 'likes' | 'comments'): number | null {
  const value = key === 'likes' ? u.likeCount : u.commentCount;
  const available = u.engagementAvailability?.[key];
  if (available === false || !Number.isFinite(value) || value < 0) return null;
  return available === true || value > 0 ? value : null;
}
function engagement(items: Item[]) {
  const known = items.filter(({u}) => u.viewCount > 0 && measured(u,'likes') != null && measured(u,'comments') != null);
  const views = known.reduce((sum,{u})=>sum+u.viewCount,0);
  const likes = known.reduce((sum,{u})=>sum+measured(u,'likes')!,0);
  const comments = known.reduce((sum,{u})=>sum+measured(u,'comments')!,0);
  return {views,likes,comments,measuredUploads:known.length,rate:views>0?(likes+comments)/views*100:null};
}
function sixMonthsBefore(at: number) {
  const d = new Date(at), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()-6);
  const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last)); d.setUTCHours(0,0,0,0); return d.getTime();
}
function monday(at: number) {
  const d = new Date(at); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); return d.getTime();
}
export function buildAuditIntel(input: {
  items: Item[]; now: number; dataAt: string | null; uploadsAt?: string | null;
  catalogue?: { complete: boolean; fetchedAt: string; publicVideoCount: number | null };
  stats: { subs: number | null; lifetimeViews: number | null; views7d: number | null; subs7d: number | null };
  context?: { campaign?: string; nextMomentLabel?: string; nextMomentDate?: string };
}): AuditIntel {
  const times = [input.uploadsAt ?? input.catalogue?.fetchedAt ?? input.dataAt].map(v=>Date.parse(v??'')).filter(v=>Number.isFinite(v) && v<=input.now);
  // A stale snapshot is not evidence that nothing was posted after it.
  const at = times.length ? Math.max(...times) : input.now;
  const from = sixMonthsBefore(at);
  const all = input.items.filter(({u})=>!u.isCollab && u.live!=='upcoming' && Number.isFinite(Date.parse(u.publishedAt)) && Date.parse(u.publishedAt)<=at && Number.isFinite(u.viewCount) && u.viewCount>=0);
  const recent = all.filter(({u})=>Date.parse(u.publishedAt)>=from);
  const views = recent.reduce((sum,{u})=>sum+u.viewCount,0);
  const shorts = recent.filter(x=>x.format==='short');
  const audio = recent.filter(x=>x.format==='audio');
  const videos = recent.filter(x=>x.format!=='short' && x.format!=='audio');
  const fresh = times.length>0 && input.now-at<=7*DAY;
  const complete = !!input.catalogue?.complete;
  const allViews = all.reduce((sum,{u})=>sum+u.viewCount,0);
  // This is a coverage check, not a claim that deleted/Topic videos explain the difference.
  const discrepancy = complete && ((input.catalogue?.publicVideoCount ?? 0)>all.length+2 ||
    (all.length>0 && all.length<=20 && (input.stats.lifetimeViews??0)>Math.max(allViews*4,10000)));
  const reliable = complete && fresh && !discrepancy;
  const months: AuditIntel['months'] = [];
  const cursor = new Date(from); cursor.setUTCDate(1);
  while(cursor.getTime()<=at) {
    const key=date(cursor.getTime()).slice(0,7);
    const items=recent.filter(({u})=>u.publishedAt.slice(0,7)===key);
    months.push({month:key,label:cursor.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'}),videos:items.filter(x=>x.format!=='audio' && x.format!=='short').length,shorts:items.filter(x=>x.format==='short').length,audio:items.filter(x=>x.format==='audio').length,partial:key===date(from).slice(0,7) || key===date(at).slice(0,7)});
    cursor.setUTCMonth(cursor.getUTCMonth()+1);
  }
  // Only complete calendar weeks wholly inside the six-month window.
  let week = monday(from); if(week<from)week+=7*DAY;
  const weekEnd = monday(at);
  const active = new Set(recent.map(({u})=>monday(Date.parse(u.publishedAt))).filter(w=>w>=week && w<weekEnd));
  const totalWeeks = Math.max(0,Math.round((weekEnd-week)/(7*DAY)));
  const engagementRead=engagement(recent);
  const groups = Array.from(new Set(recent.map(x=>x.format))).map(key=>{
    const items=recent.filter(x=>x.format===key), e=engagement(items);
    return {key,name:NAMES[key],uploads:items.length,views:items.reduce((sum,{u})=>sum+u.viewCount,0),measuredUploads:e.measuredUploads,rate:e.rate};
  }).sort((a,b)=>b.views-a.views);
  const ranked = [...(recent.length?recent:all)].sort((a,b)=>b.u.viewCount-a.u.viewCount);
  // Show the leading upload and a different format with a recorded response where possible.
  const first=ranked[0];
  const second=ranked.find(x=>x.u.id!==first?.u.id && x.format!==first?.format && (measured(x.u,'comments')??0)>0) ?? ranked.find(x=>x.u.id!==first?.u.id);
  const proof=[first,second].filter((x):x is Item=>!!x).map(({u,format})=>{
    const likes=measured(u,'likes'),comments=measured(u,'comments');
    return {id:u.id,title:u.title,publishedAt:u.publishedAt,format:NAMES[format],views:u.viewCount,likes,comments,rate:u.viewCount>0 && likes!=null && comments!=null?(likes+comments)/u.viewCount*100:null,older:Date.parse(u.publishedAt)<from};
  });
  const responding=proof.find(p=>(p.comments??0)>0 || (p.likes??0)>0);
  const best = groups.find(g=>g.key!=='longform');
  const longformViews=videos.reduce((sum,{u})=>sum+u.viewCount,0)+audio.reduce((sum,{u})=>sum+u.viewCount,0);
  const topShare=views>0?[...recent].sort((a,b)=>b.u.viewCount-a.u.viewCount).slice(0,3).reduce((sum,{u})=>sum+u.viewCount,0)/views:0;
  const firstPublished=all.length?Math.min(...all.map(({u})=>Date.parse(u.publishedAt))):at;
  const recentWeeks=recent.length?Math.ceil((at-Math.min(...recent.map(({u})=>Date.parse(u.publishedAt))))/(7*DAY)):0;
  const unknownDominates=(groups.find(g=>g.key==='longform')?.views??0)>views*.5;
  const next: AuditIntel['next']=[];
  let state: AuditIntel['state']='developing', headline='A channel read grounded in the uploads.', read='';
  if(!reliable) {
    state='limited';headline=responding?'The response is visible. Coverage needs checking.':all.length?'Read the verified uploads. Check the coverage.':'Build the upload evidence first.';
    read=discrepancy?'The channel totals and scanned upload inventory differ substantially. We can show verified examples, but cannot call the whole channel quiet.':!complete?'This is a partial upload inventory. The figures below show what was found; gaps are not yet evidence of missing content.':'The upload reading is over seven days old. Activity below ends at the recorded date.';
  } else if(!recent.length) {
    state=responding?'quiet-response':'empty';headline=responding?'Earlier content gets a response. No recent uploads found.':'No uploads found in the last six months.';
    read=responding?`“${responding.title}” records ${number(responding.views)} lifetime views${responding.comments!=null?' and '+number(responding.comments)+' comments':''}. It predates this window.`:'No public uploads in the scanned playlist fall inside this window. Release and partner appearances are not a complete inventory here.';
  } else if(firstPublished>=from && recentWeeks<=6) {
    state='early';headline='Early output. Use the first response to shape the next step.';
    read=`The earliest upload found is ${date(firstPublished)}. There is not a six-month publishing history to judge yet.`;
  } else if(audio.length>=Math.max(2,recent.length*.65) && videos.length<=3) {
    state='release-led';headline='Music is arriving. Artist content is limited.';
    read=`${count(audio.length,'release-audio upload')} alongside ${count(videos.length,'other video')} and ${count(shorts.length,'Short')}. Consumption and artist interaction need separate reads.`;
  } else if(recent.length<=8 && responding) {
    state='quiet-response';headline='People respond. Little regular artist content.';
    read=`${count(recent.length,'upload')} found in six months, including ${count(shorts.length,'Short')}. The leading example below records ${number(responding.views)} views.`;
  } else if(shorts.length>=recent.length*.7 && longformViews>=views*.7 && recent.length>=5) {
    state='shorts-led';headline='Shorts lead output. Long-form leads recorded viewing.';
    read=`${shorts.length} of ${recent.length} uploads are Shorts; long-form holds ${Math.round(longformViews/views*100)}% of their recorded lifetime views. This is not an age-matched comparison.`;
  } else if(recent.length>=10 && topShare>=.8) {
    state='concentrated';headline='A few uploads carry most recorded viewing.';
    read=`The three leading uploads hold ${Math.round(topShare*100)}% of lifetime views on ${recent.length} uploads in this window. Check their songs and creative before repeating the output volume.`;
  } else if(totalWeeks>0 && active.size/totalWeeks<.4) {
    state='inconsistent';headline='Activity arrives in bursts.';
    read=`${count(recent.length,'upload')} across ${active.size} of ${totalWeeks} complete weeks. ${best && !unknownDominates ? best.name+' leads recorded viewing among labelled formats.':'The timeline shows the publishing gaps.'}`;
  } else if(totalWeeks>0 && active.size/totalWeeks>=.65) {
    state='regular';headline=responding?'Regular output. Build on the formats getting a response.':'Regular output. Check the audience response.';
    read=`Uploads in ${active.size} of ${totalWeeks} complete weeks. ${best && !unknownDominates?best.name+' leads recorded viewing among labelled formats.':'Review the strongest examples below before selecting the next format.'}`;
  } else {
    headline=best && !unknownDominates?`${best.name} leads the recorded viewing.`:'The strongest uploads are the starting point.';
    read=`${count(recent.length,'upload')} found in six months; ${count(shorts.length,'Short')}. Use the examples and publishing timeline together.`;
  }
  if(!reliable) next.push({title:'Check coverage first',evidence:discrepancy?'The totals do not establish a complete release inventory.':!complete?'A complete uploads-playlist scan is still needed.':'The upload reading needs updating.',action:discrepancy?'Check the artist’s Releases and linked channels before making an inactivity or missing-asset claim.':!complete?'Finish the catalogue scan; the examples below remain useful while it runs.':'Refresh the catalogue before using this as a current channel brief.'});
  if(unknownDominates) {
    const v=recent.filter(x=>x.format==='longform').sort((a,b)=>b.u.viewCount-a.u.viewCount)[0];
    next.push({title:'Confirm the leading format',evidence:`“${v.u.title}” has ${number(v.u.viewCount)} views, but its format is not reliably labelled.`,action:'Review this upload before recommending more of a particular format.'});
  } else if(responding) {
    const candidate=ranked.find(x=>x.u.id===responding.id)!;
    const family=all.filter(x=>x.format===candidate.format);
    const dj=/\b(dj|mixmag|boiler room|dj set|mix set)\b/i.test(candidate.u.title);
    const idea=['live','acoustic'].includes(candidate.format)?(dj?'a performance-led DJ clip':'a performance clip'):['bts','documentary','interview','tour'].includes(candidate.format)?'an artist or behind-the-scenes clip':candidate.format==='short'?'one more Short with a similar song or creative hook':'an artist-led Short around the track';
    next.push({title:shorts.length<=2?'Give viewers a reason to return':'Build on a specific response',evidence:`“${responding.title}”: ${number(responding.views)} views${responding.likes!=null?', '+number(responding.likes)+' likes':''}${responding.comments!=null?', '+number(responding.comments)+' comments':''}${responding.older?' · older example':''}.`,action:family.length>=3?`Test ${idea}, using this format’s ${family.length} observed examples as the reference. Compare new uploads at the same age.`:`Test ${idea} using this upload as a creative reference${shorts.length<=2?'; a more regular rhythm could give viewers more reasons to return and subscribe':''}. One example is a starting point, not a proven formula.`});
  }
  if(next.length<2 && shorts.length>2 && reliable) next.push({title:'Test follow-through on the leading upload',evidence:`${count(shorts.length,'Short')} published in this window.`,action:ranked[0]?`Check that relevant Shorts point to “${ranked[0].u.title}” using a related video. Links and end screens have not been inspected.`:'Review how Shorts connect to a full-length destination.'});
  const contextDate=Date.parse(input.context?.nextMomentDate??'');
  const context=Number.isFinite(contextDate) && contextDate>input.now?`Saved next moment: ${input.context?.nextMomentLabel??'Release'} · ${input.context!.nextMomentDate}.` : input.context?.campaign?`Saved campaign: ${input.context.campaign}. No future release date is assumed.`:null;
  const movement=input.stats.views7d!=null || input.stats.subs7d!=null?[
    input.stats.views7d!=null?`${number(input.stats.views7d)} channel views in the available 7-day comparison`:null,
    input.stats.subs7d!=null?`${input.stats.subs7d>=0?'+':''}${number(input.stats.subs7d)} net subscribers`:null,
  ].filter(Boolean).join(' · ')+'. Channel movement does not attribute subscribers to a video.':null;
  return {version:1,state,headline,read,window:{from:date(from),to:date(at),fresh,playlistComplete:complete,reliable,note:'Six-month upload cohort; views, likes and comments are lifetime readings, not gains during these months. Formats, including Shorts, use title/duration evidence and saved corrections.'},activity:{uploads:recent.length,shorts:shorts.length,audio:audio.length,videos:videos.length,views,activeWeeks:active.size,totalWeeks,latest:recent.length?date(Math.max(...recent.map(({u})=>Date.parse(u.publishedAt)))):null},months,engagement:{...engagementRead,note:'(Likes + comments) ÷ views × 100, weighted across uploads where both counts are available. Counts are interactions, not unique fans; zeroes from old caches may be unknown. No returning-viewer, loyalty or subscriber-conversion claim.'},formats:groups,proof,next:next.slice(0,2),movement,context,coverageWarning:discrepancy?'Release coverage needs checking: the channel and upload totals differ.':!complete?'Partial inventory — no whole-channel absence claims.':!fresh?'Dated upload reading — not current activity.':null};
}

export function auditIntelText(name: string, intel: AuditIntel): string {
  const a=intel.activity;
  return [`${name} — QUICK CHANNEL INTEL`,`${intel.window.from} to ${intel.window.to} · ${intel.window.playlistComplete?'Uploads playlist scanned':'Partial inventory'}`,
    intel.headline,intel.read,`${a.uploads} uploads found · ${a.shorts} Shorts · ${a.audio} release audio · ${number(a.views)} lifetime views on those uploads`,
    ...(intel.window.reliable?[`${a.activeWeeks}/${a.totalWeeks} complete weeks with uploads`]:[]),
    ...intel.proof.map(p=>`${p.title} (${p.publishedAt.slice(0,10)}${p.older?', older example':''})\n${number(p.views)} views${p.likes!=null?' · '+number(p.likes)+' likes':''}${p.comments!=null?' · '+number(p.comments)+' comments':''}\nhttps://www.youtube.com/watch?v=${p.id}`),
    ...intel.next.map(p=>`${p.title}\n${p.evidence}\n${p.action}`),intel.context,intel.movement,intel.coverageWarning,intel.window.note,
    'Public channel totals do not measure subscribers attributed to a video. Release audio beyond the uploads playlist and third-party appearances have not been fully verified.',
  ].filter(Boolean).join('\n\n');
}
