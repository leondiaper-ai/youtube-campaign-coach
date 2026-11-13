import Link from 'next/link';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { getArtistsForMarket } from '@/lib/marketScope';
import { YOUTUBE_UK_ROSTER } from '@/lib/youtubeUkRoster';
import { listPartnerSlugs } from '@/lib/youtubeUkPartnerStore';
import { listPlans, loadPlan } from '@/lib/planStore';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'YouTube UK · Active Coach Timelines', robots: { index: false, follow: false } };
const norm = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
export default async function SharedCoach() {
 const [artists, extra, plans] = await Promise.all([getArtistsForMarket('uk'),listPartnerSlugs().catch(()=>[] as string[]),listPlans()]);
 const rosterNames = new Set(YOUTUBE_UK_ROSTER.map(r=>norm(r.name)));
 const allowedNames = new Set(artists.filter(a=>rosterNames.has(norm(a.name))||extra.includes(a.slug)).map(a=>norm(a.name)));
 for(const r of YOUTUBE_UK_ROSTER) allowedNames.add(norm(r.name));
 const matching = plans.filter(p=>allowedNames.has(norm(p.artist)));
 const full = await Promise.all(matching.map(p=>loadPlan(p.slug)));
 const now = new Date().toISOString().slice(0,10);
 const active = full.filter((p):p is NonNullable<typeof p>=>!!p && Array.isArray(p.plan?.events) && p.plan.events.some(e=>e.dateISO>=now));
 active.sort((a,b)=>a.plan.events.filter(e=>e.dateISO>=now).map(e=>e.dateISO).sort()[0].localeCompare(b.plan.events.filter(e=>e.dateISO>=now).map(e=>e.dateISO).sort()[0]));
 return <main className="min-h-screen bg-paper text-ink"><AppHeader hideAutoLabels workspace="YouTube UK · Shared Watcher" nav={[{href:'/youtube-uk',label:'Channel Health'},{href:'/youtube-uk/coach',label:'Active Coach Timelines'}]}/><section className="max-w-[1180px] mx-auto px-6 pb-12"><PageTitle title="Active Coach timelines" lede="Read-only view of upcoming campaign timelines for artists on the agreed YouTube UK list, across UK, regional and label workspaces."/><div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-7"><div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{active.length}</div><div className="text-sm text-muted">Timelines with upcoming milestones</div></div><div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{new Set(active.map(p=>norm(p.artist))).size}</div><div className="text-sm text-muted">Artists with active timelines</div></div></div>{active.length===0?<div className="bg-surface border border-line rounded-xl p-8 text-muted">No matching saved Coach timelines with future dated milestones yet. New plans will appear here automatically.</div>:<div className="border border-line rounded-xl overflow-hidden bg-surface"><div className="grid grid-cols-[1fr_1fr_120px] gap-3 p-4 bg-paper text-xs uppercase tracking-wide text-muted font-bold"><span>Artist / campaign</span><span>Next milestone</span><span>Workspace</span></div>{active.map(p=>{const next=p.plan.events.filter(e=>e.dateISO>=now).sort((a,b)=>a.dateISO.localeCompare(b.dateISO))[0];return <Link key={p.slug} href={`/youtube-uk/coach/${encodeURIComponent(p.slug)}`} className="grid grid-cols-[1fr_1fr_120px] gap-3 p-4 border-t border-line text-sm hover:bg-paper no-underline text-ink"><span><strong className="block">{p.artist}</strong><span className="text-muted">{p.campaignName}</span></span><span><strong>{next.dateISO}</strong><span className="block text-muted">{next.title}</span></span><span className="text-muted">{p.market||'UK'}</span></Link>})}</div>}<p className="text-xs text-muted mt-5">Only saved plans with at least one future-dated timeline event are shown. This is a live read of the shared Coach archive, not a separate copy. No campaign creation or editing controls.</p></section></main>;
}
