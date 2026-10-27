import type { RecentUpload } from './artists';
import { classifyUploadFormat, getFormatMeta, type UploadFormat } from './formatClassifier';
import { songKey } from './formatStack';

export type AuditVideo = { id: string; title: string; views: number; format: string; publishedAt: string };
export type AuditFinding = { title: string; evidence: string; action?: string; videos?: AuditVideo[] };
export type ChannelAudit = {
  name: string; slug: string; generatedAt: string; dataAt: string | null;
  catalogue?: { complete: boolean; fetchedAt: string; publicVideoCount: number | null; scannedIds: number };
  visuals: {
    split: { longform: number; shorts: number; longformCount: number; shortsCount: number };
    formats: { key: string; name: string; count: number; views: number; median: number; share: number; verdict: string; examples: AuditVideo[] }[];
    weeks: { date: string; longform: number; shorts: number; covered: boolean }[];
    activeWeeks: number; coveredWeeks: number; takeaway: string; actions: string[];
  };
  reference?: { title: string; href: string | null; date: string | null; points: { point: string; basis: string }[]; note: string };
  stats: { subs: number | null; lifetimeViews: number | null; views7d: number | null; views30d: number | null; subs7d: number | null };
  summary: string; coverage: string; findings: AuditFinding[]; gaps: AuditFinding[]; priorities: string[];
  leaders: AuditVideo[]; formats: { name: string; count: number; views: number; median: number }[];
  territories: { name: string; views: number; estimated: boolean }[]; territoryNote: string; limitations: string[];
};
export const auditNumber = (v: number | null): string => v == null ? 'Unavailable' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const day = 86400000;
const median = (a: number[]) => { const s = [...a].sort((x,y)=>x-y); return s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2; };
export function buildChannelAudit(input: {
  name: string; slug: string; dataAt: string | null; now?: number; uploads: RecentUpload[];
  catalogue?: ChannelAudit['catalogue'];
  stats: ChannelAudit['stats']; territories?: ChannelAudit['territories']; territoryNote?: string;
}): ChannelAudit {
  const now = input.now ?? Date.now();
  // Only uploads on this channel, already published. Never include external collaborations or future premieres.
  const uploads = Array.from(new Map(input.uploads.filter(u => !u.isCollab && u.live !== 'upcoming' && Date.parse(u.publishedAt) <= now).map(u=>[u.id,u])).values());
  const classified = uploads.map(u=>({ u, format: classifyUploadFormat({...u,description:''}) }));
  const video = (x: typeof classified[number]): AuditVideo => ({ id:x.u.id, title:x.u.title, views:x.u.viewCount, publishedAt:x.u.publishedAt, format:getFormatMeta(x.format).label });
  const ranked = [...classified].sort((a,b)=>b.u.viewCount-a.u.viewCount);
  const leaders = ranked.slice(0,3).map(video);
  const total = uploads.reduce((s,u)=>s+u.viewCount,0);
  const first = uploads.map(u=>u.publishedAt.slice(0,10)).sort()[0];
  const groups = new Map<UploadFormat, typeof classified>();
  for (const x of classified) groups.set(x.format,[...(groups.get(x.format) ?? []),x]);
  const formats = Array.from(groups).map(([f,x])=>({name:f==='longform'?'Other long-form':getFormatMeta(f).label,count:x.length,views:x.reduce((s,i)=>s+i.u.viewCount,0),median:median(x.map(i=>i.u.viewCount))})).sort((a,b)=>b.views-a.views);
  const recent = classified.filter(x=>now-Date.parse(x.u.publishedAt)<=30*day);
  const shorts = recent.filter(x=>x.format==='short').length;
  const findings: AuditFinding[] = [];
  const gaps: AuditFinding[] = [];
  const priorities: string[] = [];
  if (leaders.length && total > 0) {
    const share = Math.round(leaders.reduce((s,u)=>s+u.views,0)/total*100);
    findings.push({title:'Where the recorded views sit',evidence:`These ${leaders.length} uploads hold ${share}% of the ${auditNumber(total)} lifetime views across the ${uploads.length} tracked uploads. This is a share of analysed uploads, not the channel lifetime counter.`,videos:leaders});
  }
  const support = Array.from(groups).filter(([f,x])=>!['omv','audio','short','longform'].includes(f) && x.length>=3).map(([f,x])=>({f,x,median:median(x.map(i=>i.u.viewCount))})).sort((a,b)=>b.median-a.median)[0];
  if (support) {
    const examples = [...support.x].sort((a,b)=>b.u.viewCount-a.u.viewCount).slice(0,2).map(video);
    findings.push({title:'A support format with repeat evidence',evidence:`${getFormatMeta(support.f).label}: ${support.x.length} tracked uploads, ${auditNumber(support.median)} median lifetime views. Highest median among support formats with at least three examples; upload ages differ.`,videos:examples});
    priorities.push(`Use ${getFormatMeta(support.f).label.toLowerCase()} as a candidate support asset for the next priority single; review ${examples.map(v=>'“'+v.title+'”').join(' and ')} for the creative approach, then compare new assets at the same age.`);
  }
  if (recent.length) findings.push({title:'What the channel is publishing now',evidence:`${recent.length} tracked uploads in the last 30 days: ${recent.length-shorts} long-form and ${shorts} Shorts. Upload counts describe output, not demand or incremental reach.`});
  // Match an identifiable official video to companions for that same song. Never call unrelated uploads support.
  const hero = ranked.find(x=>x.format==='omv' && now-Date.parse(x.u.publishedAt)<=180*day && songKey(x.u.title,input.name).length>=3);
  if (hero) {
    const key = songKey(hero.u.title,input.name).toLowerCase();
    const family = classified.filter(x=>songKey(x.u.title,input.name).toLowerCase()===key);
    const destinations = family.filter(x=>['lyric','visualiser','live','acoustic'].includes(x.format));
    if (!destinations.length) {
      gaps.push({title:'A priority video with no matched support destination',evidence:`“${hero.u.title}” has ${auditNumber(hero.u.viewCount)} lifetime views. No lyric video, visualiser, live or acoustic version for this song was matched in the analysed uploads. Matching uses titles; check the full channel before commissioning.`,action:'If the song remains a priority, choose one distinct follow-up asset that adds a new way into it.',videos:[video(hero)]});
      priorities.push(`Check the full catalogue for companions to “${hero.u.title}”. If none exist and the song remains a priority, brief one follow-up destination rather than duplicating the official video.`);
    }
    const age = Math.floor((now-Date.parse(hero.u.publishedAt))/day);
    const followups = family.filter(x=>x.u.id!==hero.u.id && Date.parse(x.u.publishedAt)>Date.parse(hero.u.publishedAt));
    if (age>=7 && age<=28 && !followups.length) gaps.push({title:'Check the follow-up window',evidence:`“${hero.u.title}” is ${age} days old; no later upload for the same song was matched.`,action:'Review a cutdown or complementary asset now if this is still a focus track. A follow-up is a test, not a promised view lift.',videos:[video(hero)]});
  }
  if (!groups.has('live') && uploads.length>=10) gaps.push({title:'Live is not represented in this sample',evidence:`No live performance was identified among ${uploads.length} tracked uploads using titles and descriptions. This does not cover appearances on other channels.`,action:'Check the wider live catalogue and whether performance is central to this artist before adding live to the plan.'});
  const captionWindow = classified.filter(x=>x.format!=='short' && now-Date.parse(x.u.publishedAt)<=90*day);
  const captionChecks = captionWindow.filter(x=>x.u.captions===false).sort((a,b)=>b.u.viewCount-a.u.viewCount);
  if (captionChecks.length) gaps.push({title:'Caption tracks to review',evidence:`YouTube reports no caption track on ${captionChecks.length} of ${captionWindow.length} tracked long-form uploads published in the last 90 days. The examples below have the most lifetime views in that group.`,action:'Prioritise spoken-word, documentary, interview and vocal performances. Check existing on-screen lyrics and whether captions are appropriate; the public flag does not assess caption quality, language coverage or accessibility in full.',videos:captionChecks.slice(0,3).map(video)});
  if (!support) findings.push({title:'Support-format evidence is still limited',evidence:'No identified support format has three tracked examples. A strongest repeatable support format cannot yet be selected confidently.'});
  if (!priorities.length && leaders[0]) priorities.push(`Review “${leaders[0].title}” (${auditNumber(leaders[0].views)} lifetime views) for the song, creative and presentation that drew interest. Separate those factors before copying the format.`);
  if (input.territories?.length) priorities.push(`Review ${input.territories.slice(0,3).map(t=>t.name).join(', ')} for release servicing and localisation. Confirm recording-level demand and campaign fit before allocating spend.`);
  if (priorities.length<3) priorities.push('For the next priority release, record each asset’s 7- and 28-day performance so follow-up decisions can use comparable ages, rather than lifetime totals.');
  const summary = input.stats.views7d != null ? `${input.name} recorded ${auditNumber(input.stats.views7d)} channel views over the available 7-day comparison${input.stats.subs7d!=null ? ' and '+auditNumber(input.stats.subs7d)+' net subscribers' : ''}. ${leaders[0] ? 'The leading tracked upload is “'+leaders[0].title+'” ('+auditNumber(leaders[0].views)+' lifetime views).' : ''}` : `${input.name}: ${auditNumber(input.stats.lifetimeViews)} lifetime channel views and ${auditNumber(input.stats.subs)} subscribers. A reliable 7-day movement reading is not available yet.`;
  const longformViews = classified.filter(x=>x.format!=='short').reduce((s,x)=>s+x.u.viewCount,0);
  const shortsViews = classified.filter(x=>x.format==='short').reduce((s,x)=>s+x.u.viewCount,0);
  const formatOrder: UploadFormat[] = ['omv','live','lyric','visualiser','bts','acoustic','short','longform'];
  const formatReads = formatOrder.map(f=>{
    const items=groups.get(f)??[];
    const views=items.reduce((s,x)=>s+x.u.viewCount,0);
    return {key:f,name:f==='longform'?'Other long-form':getFormatMeta(f).label,count:items.length,views,median:items.length?median(items.map(x=>x.u.viewCount)):0,share:total>0?views/total:0,verdict:f==='longform' && items.length ? 'Needs labelling' : !items.length ? (input.catalogue?.complete ? 'Not found' : 'Not in sample') : items.length<3 ? 'Too few to judge' : views===0 ? 'No recorded views' : 'Repeat evidence',examples:[...items].sort((a,b)=>b.u.viewCount-a.u.viewCount).slice(0,2).map(video)};
  });
  const monday = new Date(now); monday.setUTCHours(0,0,0,0); monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
  const weeks=Array.from({length:13},(_,i)=>{
    const from=monday.getTime()-(12-i)*7*day;
    const items=classified.filter(x=>Date.parse(x.u.publishedAt)>=from && Date.parse(x.u.publishedAt)<from+7*day);
    return {date:new Date(from).toISOString().slice(0,10),longform:items.filter(x=>x.format!=='short').length,shorts:items.filter(x=>x.format==='short').length,covered:!!input.catalogue?.complete || (!!first && Date.parse(first)<=from)};
  });
  const leaderFormat=formats.find(f=>f.name!=='Other long-form');
  const takeaway=leaderFormat && total>0 ? `${leaderFormat.name} leads among labelled formats: ${auditNumber(leaderFormat.views)} lifetime views across ${leaderFormat.count} uploads (${Math.round(leaderFormat.views/total*100)}% of analysed upload views).` : 'Not enough upload evidence for a format verdict yet.';
  const actions=[...(support ? [`Keep ${getFormatMeta(support.f).label.toLowerCase()} in the support mix: ${support.x.length} examples, ${auditNumber(support.median)} typical lifetime views.`] : []),...(gaps.find(g=>g.title==='A priority video with no matched support destination') ? [`Check a follow-up asset for “${hero!.u.title}” — none matched in this inventory.`] : []),...(captionChecks.length ? [`Review caption tracks on ${captionChecks.length} recent long-form uploads, starting with spoken and vocal content.`] : []),...(input.territories?.length ? [`Use ${input.territories.slice(0,3).map(t=>t.name).join(', ')} as the starting markets for a localisation review.`] : [])].slice(0,3);
  const coverage = input.catalogue ? `${uploads.length} published uploads analysed · ${input.catalogue.scannedIds} playlist IDs read${input.catalogue.publicVideoCount!=null ? ' · YouTube reports '+input.catalogue.publicVideoCount+' public videos' : ''} · ${input.catalogue.complete ? 'playlist fully scanned' : 'scan in progress'} · read ${input.catalogue.fetchedAt.slice(0,10)}${first ? ' · earliest '+first : ''}. Counts may differ because of unavailable, upcoming or removed videos.` : `${uploads.length} cached uploads${first ? ', back to '+first : ''}. Recent sample only — scan the catalogue to include older videos.`;
  const dataAge = input.dataAt ? Math.floor((now-Date.parse(input.dataAt))/day) : null;
  return {catalogue:input.catalogue,visuals:{split:{longform:longformViews,shorts:shortsViews,longformCount:classified.filter(x=>x.format!=='short').length,shortsCount:classified.filter(x=>x.format==='short').length},formats:formatReads,weeks,activeWeeks:weeks.filter(w=>w.covered && w.longform+w.shorts>0).length,coveredWeeks:weeks.filter(w=>w.covered).length,takeaway,actions},name:input.name,slug:input.slug,generatedAt:new Date(now).toISOString(),dataAt:input.dataAt,stats:input.stats,summary,coverage,findings,gaps,priorities:priorities.slice(0,3),leaders,formats,territories:input.territories ?? [],territoryNote:input.territoryNote ?? 'No cached country breakdown available.',limitations:[...(dataAge!=null && dataAge>2 ? [`Channel reading is ${dataAge} days old; check freshness before using this in a current update.`] : []),'Format labels use titles and duration to avoid unrelated description keywords; song-family matches use titles; versions and inconsistent titles can be misclassified.','Lifetime views are not age-adjusted. These observations do not prove a format caused growth.','Watch time, retention, traffic sources, audience overlap and incremental paid impact require YouTube Studio. Channel packaging, playlists and end screens have not been inspected.']};
}
export function channelAuditText(a: ChannelAudit): string {
  return [`${a.name} — CHANNEL AUDIT`, `Prepared ${a.generatedAt.slice(0,10)} · Channel data ${a.dataAt?.slice(0,10) ?? 'date unavailable'}`,a.visuals.takeaway,'',`FORMAT READ\n${a.visuals.formats.map(f=>f.name+': '+f.verdict+' · '+f.count+' uploads · '+auditNumber(f.views)+' lifetime views · '+auditNumber(f.median)+' median').join('\n')}`,`VIEWING SPLIT (analysed uploads, lifetime)\nLong-form: ${auditNumber(a.visuals.split.longform)} · Shorts: ${auditNumber(a.visuals.split.shorts)}`,`PUBLISHING\n${a.visuals.activeWeeks} of ${a.visuals.coveredWeeks} covered weeks had an upload; last 13 calendar weeks, current week incomplete.`,a.summary,'',`SCALE & MOVEMENT\nSubscribers: ${auditNumber(a.stats.subs)} · Lifetime channel views: ${auditNumber(a.stats.lifetimeViews)}\n7-day views: ${auditNumber(a.stats.views7d)} · 30-day views: ${auditNumber(a.stats.views30d)} · 7-day net subscribers: ${auditNumber(a.stats.subs7d)}`,'',...a.findings.map(f=>`${f.title}\n${f.evidence}${f.videos?.map(v=>'\n• '+v.title+' — '+auditNumber(v.views)+' lifetime views — https://www.youtube.com/watch?v='+v.id).join('') ?? ''}`),'',`MISSED OPPORTUNITIES & ASSET CHECKS\n${a.gaps.length ? a.gaps.map(g=>g.title+'\n'+g.evidence+'\n'+(g.action??'')+(g.videos?.map(v=>'\n• '+v.title+' — '+auditNumber(v.views)+' lifetime views — https://www.youtube.com/watch?v='+v.id).join('') ?? '')).join('\n\n') : 'No specific asset gap identified in this sample; this is not a full-catalogue clearance.'}`,'',...(a.reference ? [`PAST CAMPAIGN REFERENCE — ${a.reference.title} (data ${a.reference.date ?? 'date not recorded'})`,...a.reference.points.map(p=>p.point+'\n'+p.basis),a.reference.note,a.reference.href ? 'https://youtube-campaign-coach.vercel.app'+a.reference.href : ''] : []),'',`KEY MARKETS\n${a.territories.map(t=>t.name+': '+auditNumber(t.views)+' monthly views'+(t.estimated?' (estimated)':'')).join('\n')}\n${a.territoryNote}`,'',`PRIORITIES\n${a.priorities.map((p,i)=>(i+1)+'. '+p).join('\n')}`,'',`COVERAGE & SOURCES\n${a.coverage}\n${a.limitations.join('\n')}\nSource: Watcher cached YouTube Data API readings; Chartmetric for markets where stated.`].join('\n\n');
}
