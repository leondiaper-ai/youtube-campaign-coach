'use client';
import { useSearchParams } from 'next/navigation';

const themes: Record<string, {label:string; color:string}> = {
 growth:{label:'Subscriber growth',color:'#0C6A3F'},
 catalogue:{label:'Catalogue opportunity',color:'#315D9D'},
 conversion:{label:'Audience conversion',color:'#985319'},
 cadence:{label:'Publishing cadence',color:'#985319'},
 momentum:{label:'Video momentum',color:'#226C6D'},
 formats:{label:'Format gap',color:'#684D9C'},
};
type Finding = {category:string;headline:string;context:string;action:string;videoId?:string;videoTitle?:string;videoDetail?:string};
type Asset = {id:string;title:string;format?:string;detail?:string};
export default function WeeklyInsightCard({artistName,fallbackInsight,assets=[],movers=[]}:{artistName:string;fallbackInsight:Finding|null;assets?:Asset[];movers?:Asset[]}) {
 const params=useSearchParams();
 const category=params.get('weeklyCategory') ?? '';
 const signal=params.get('weeklySignal') ?? '';
 const action=params.get('weeklyAction') ?? '';
 const selected=Object.hasOwnProperty.call(themes,category) && signal.startsWith(artistName+': ') && action;
 const finding:Finding|null=selected ? {category,headline:signal.slice(artistName.length+2),context:'',action,videoId:params.get('weeklyVideoId') ?? undefined,videoTitle:params.get('weeklyTitle') ?? undefined} : fallbackInsight;
 if(!finding) return null;
 const theme=themes[finding.category];
 if(!theme) return null;
 const videoId=finding.videoId;
 const valid=(id:string)=>/^[A-Za-z0-9_-]{11}$/.test(id);
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const quoted=finding.headline.match(/[“"]([^”"]+)[”"]/);
 const release=quoted?.[1];
 const song=release ? normalize(release).replace(new RegExp('^'+normalize(artistName)+' '),'') : '';
 const related=song.length>=3 ? assets.filter(v=>(' '+normalize(v.title)+' ').includes(' '+song+' ')) : [];
 const matches=related.filter(v=>v.format!=='short');
 const existingShorts=related.filter(v=>v.format==='short');
 const formatHeadline=finding.category==='formats' && existingShorts.length ? 'Existing Shorts support identified for “'+release+'”' : finding.headline;
 const explicit=videoId && valid(videoId) ? [{id:videoId,title:finding.videoTitle || assets.find(v=>v.id===videoId)?.title || 'View video',detail:finding.videoDetail}] : [];
 const candidates=finding.category==='formats' ? [...explicit,...existingShorts,...matches] : [...explicit,...movers];
 const evidence=candidates.filter((v,i)=>valid(v.id)&&candidates.findIndex(x=>x.id===v.id)===i).slice(0,3);
 const leader=movers[0];
 const nextAction=finding.category==='formats' && existingShorts.length ? 'Review the existing Shorts below and check their related-video links before planning any additional content.' : finding.category==='formats' && matches.length ? 'Check for existing Shorts using the track or sound. If none are suitable, create a Short from the existing release assets below and link it to the main release.' : leader && ['growth','catalogue','momentum','conversion','cadence'].includes(finding.category) ? (finding.category==='conversion' ? 'Add a relevant next watch to “'+leader.title+'” through playlists or eligible end screens.' : 'Build on “'+leader.title+'” with '+(assets.find(v=>v.id===leader.id)?.format==='short' ? 'a follow-up Short linked to the relevant long-form release.' : 'a supporting Short using the same track or footage, linked to this video.')) : finding.action;
 return <section className="mt-7 overflow-hidden rounded-xl border" style={{background:theme.color+'09',borderColor:theme.color+'30'}} aria-label={theme.label}>
 <div className="px-5 py-5 sm:px-6">
 <div className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{color:theme.color}}>{theme.label}</div>
 <h3 className="mt-1.5 text-[19px] sm:text-[21px] font-extrabold tracking-tight text-ink">{formatHeadline}</h3>
 {finding.category==='formats' && related.length>0 && <p className="mt-1 text-[13px] text-ink/65">Already identified: {Array.from(new Set(related.map(v=>v.format || 'unclassified'))).join(' · ')}.</p>}
 {finding.context && <p className="mt-1 text-[13px] leading-relaxed text-ink/65">{finding.context}</p>}
 <div className="mt-4 rounded-md bg-white/60 px-3.5 py-3 border-l-[3px]" style={{borderLeftColor:theme.color}}>
 <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{color:theme.color}}>Next step</span>
 <p className="mt-0.5 text-[13px] font-semibold text-ink/85">{nextAction}</p>
 </div></div>
 {evidence.length>0 && <div className="border-t px-5 py-4 sm:px-6" style={{borderColor:theme.color+'24',background:'rgba(255,255,255,0.4)'}}>
 <div className="text-[11px] font-bold text-ink/60 mb-2.5">{finding.category==='formats'?'Existing release assets':'Relevant content · tracked videos'}</div>
 <div className="grid gap-2 sm:grid-cols-3">{evidence.map(v=><a key={v.id} href={'https://www.youtube.com/watch?v='+v.id} target="_blank" rel="noopener noreferrer" className="flex gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 hover:underline"><img src={'https://i.ytimg.com/vi/'+v.id+'/mqdefault.jpg'} alt="" className="w-20 self-start rounded object-cover"/><span><span className="block text-[12px] font-semibold">{v.title}</span><span className="block mt-1 text-[11px] font-semibold" style={{color:theme.color}}>{'detail' in v && v.detail ? v.detail : 'Watch on YouTube'} ↗</span></span></a>)}</div></div>}
 </section>;
}
