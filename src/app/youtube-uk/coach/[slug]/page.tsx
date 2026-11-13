import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { YOUTUBE_UK_ROSTER } from '@/lib/youtubeUkRoster';
import { listPartnerSlugs } from '@/lib/youtubeUkPartnerStore';
import { getArtistsForMarket } from '@/lib/marketScope';
import { loadPlan } from '@/lib/planStore';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export default async function PartnerTimeline({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;
 const [plan,artists,extra]=await Promise.all([loadPlan(slug),getArtistsForMarket('uk'),listPartnerSlugs().catch(()=>[] as string[])]);
 if(!plan)notFound();
 const allowed=new Set([...YOUTUBE_UK_ROSTER.map(r=>norm(r.name)),...artists.filter(a=>extra.includes(a.slug)).map(a=>norm(a.name))]);
 if(!allowed.has(norm(plan.artist)))notFound();
 const now=new Date().toISOString().slice(0,10);
 const events=[...(plan.plan.events??[])].sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
 if(!events.some(e=>e.dateISO>=now))notFound();
 return <main className="min-h-screen bg-paper text-ink"><AppHeader hideAutoLabels workspace="YouTube UK · Shared Watcher" nav={[{href:'/youtube-uk',label:'Channel Health'},{href:'/youtube-uk/coach',label:'Active Coach Timelines'}]}/><section className="max-w-[1000px] mx-auto px-6 pb-16"><div className="pt-6"><Link href="/youtube-uk/coach" className="text-sm text-muted underline">← All active timelines</Link></div><PageTitle title={`${plan.artist} · ${plan.campaignName}`} lede="Shared Coach timeline · Read-only partner view"/><div className="flex flex-wrap gap-3 mb-8 text-sm"><span className="border border-line bg-surface rounded-lg px-3 py-2">{events.length} milestones</span><span className="border border-line bg-surface rounded-lg px-3 py-2">Workspace: {plan.market||'UK'}</span><span className="border border-line bg-surface rounded-lg px-3 py-2">Updated {new Date(plan.updatedAt).toLocaleDateString('en-GB')}</span></div><h2 className="text-xl font-black mb-4">Campaign timeline</h2><div className="border border-line rounded-xl bg-surface overflow-hidden">{events.map((e,i)=><div key={i} className={`grid md:grid-cols-[130px_1fr] gap-3 p-5 ${i?'border-t border-line':''} ${e.dateISO<now?'opacity-60':''}`}><div className="text-sm font-bold tabular-nums">{e.dateISO}</div><div><div className="font-bold">{e.title}</div><div className="text-xs uppercase tracking-wide text-muted mt-1">{e.kind||'Milestone'} · {e.dateISO<now?'Past':'Upcoming'}</div></div></div>)}</div><p className="text-xs text-muted mt-6">Timeline data is read directly from the saved Coach plan. Changes made by the originating team will appear here. Editing, planning and internal workspace links are not available.</p></section></main>;
}
