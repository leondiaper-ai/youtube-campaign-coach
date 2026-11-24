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
export default function WeeklyInsightCard({artistName,fallbackInsight}:{artistName:string;fallbackInsight:Finding|null}) {
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
 const linked=videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId);
 return <section className="mt-7 overflow-hidden rounded-xl border" style={{background:theme.color+'09',borderColor:theme.color+'30'}} aria-label={theme.label}>
 <div className="px-5 py-5 sm:px-6">
 <div className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{color:theme.color}}>{theme.label}</div>
 <h3 className="mt-1.5 text-[19px] sm:text-[21px] font-extrabold tracking-tight text-ink">{finding.headline}</h3>
 {finding.context && <p className="mt-1 text-[13px] leading-relaxed text-ink/65">{finding.context}</p>}
 <div className="mt-4 rounded-md bg-white/60 px-3.5 py-3 border-l-[3px]" style={{borderLeftColor:theme.color}}>
 <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{color:theme.color}}>Next step</span>
 <p className="mt-0.5 text-[13px] font-semibold text-ink/85">{finding.action}</p>
 </div></div>
 {linked && <div className="border-t px-5 py-4 sm:px-6" style={{borderColor:theme.color+'24',background:'rgba(255,255,255,0.4)'}}>
 <div className="text-[11px] font-bold text-ink/60 mb-2.5">Relevant video</div>
 <a href={'https://www.youtube.com/watch?v='+videoId} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 hover:underline"><span className="block text-[12px] font-semibold">{finding.videoTitle || 'View video'}</span><span className="block mt-1 text-[11px] font-semibold" style={{color:theme.color}}>{finding.videoDetail || 'Watch on YouTube'} ↗</span></a></div>}
 </section>;
}
