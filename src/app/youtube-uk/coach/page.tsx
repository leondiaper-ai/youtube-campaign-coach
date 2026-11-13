import Link from 'next/link';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';
import { getAllArtists } from '@/lib/marketScope';
import { YOUTUBE_UK_ROSTER } from '@/lib/youtubeUkRoster';
import { getLabelWorkspace, isLabelArtist } from '@/lib/labels';
import { listPartnerSlugs } from '@/lib/youtubeUkPartnerStore';
import { listPlans, loadPlan } from '@/lib/planStore';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'YouTube UK · Campaign monitoring', robots: { index: false, follow: false } };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const day = (date: string) => Math.floor((Date.parse(date + 'T12:00:00Z') - Date.parse(new Date().toISOString().slice(0,10) + 'T12:00:00Z')) / 86400000);
const dateLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const release = (title: string) => /\b(single|album|ep|release|premiere|music video|official video|launch|out now)\b/i.test(title);
type Plan = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;
type Entry = { plan: Plan; status: 'live' | 'soon' | 'planned'; next: Plan['plan']['events'][number]; upcoming: number; recent: number; daysUntil: number };
function classify(plan: Plan, now: string): Entry | null {
 const events = [...(plan.plan?.events ?? [])].filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.dateISO)).sort((a,b) => a.dateISO.localeCompare(b.dateISO));
 const future = events.filter(e => e.dateISO >= now);
 if (!future.length) return null;
 const past = events.filter(e => e.dateISO < now);
 const next = future[0];
 const daysUntil = day(next.dateISO);
 // Campaign is underway only when a dated release or premiere milestone has passed.
 // Planning meetings, uploads and asset preparation alone do not establish a launch.
 const launched = past.some(e => release(e.title));
 const status = launched ? 'live' : daysUntil <= 14 ? 'soon' : 'planned';
 return { plan, status, next, upcoming: future.length, recent: past.filter(e => day(e.dateISO) >= -30).length, daysUntil };
}
const groups = [
 { status: 'live' as const, title: 'Live campaigns', description: 'A release or premiere milestone has passed. Monitor the ongoing rollout.', accent: 'border-emerald-400', dot: 'bg-emerald-500' },
 { status: 'soon' as const, title: 'Launching soon', description: 'No recorded launch yet; the next milestone is within 14 days.', accent: 'border-amber-400', dot: 'bg-amber-500' },
 { status: 'planned' as const, title: 'Upcoming / not launched', description: 'Future timelines without a recorded launch milestone.', accent: 'border-line', dot: 'bg-slate-400' },
];
export default async function SharedCoach() {
 const [artists, extra, plans] = await Promise.all([getAllArtists(), listPartnerSlugs().catch(() => [] as string[]), listPlans()]);
 const rosterNames = new Set(YOUTUBE_UK_ROSTER.map(r => norm(r.name)));
 const partisan = getLabelWorkspace('partisan');
 const allowedNames = new Set(artists.filter(a => rosterNames.has(norm(a.name)) || extra.includes(a.slug) || (partisan && isLabelArtist(partisan, a))).map(a => norm(a.name)));
 for (const r of YOUTUBE_UK_ROSTER) allowedNames.add(norm(r.name));
 const full = await Promise.all(plans.filter(p => allowedNames.has(norm(p.artist))).map(p => loadPlan(p.slug)));
 const now = new Date().toISOString().slice(0,10);
 const entries = full.flatMap(p => { const entry = p ? classify(p, now) : null; return entry ? [entry] : []; });
 entries.sort((a,b) => a.daysUntil - b.daysUntil || b.recent - a.recent);
 return <main className="min-h-screen bg-paper text-ink">
  <AppHeader hideAutoLabels workspace="YouTube UK · Shared Watcher" nav={[{href:'/youtube-uk',label:'Channel Health'},{href:'/youtube-uk/coach',label:'Active Coach Timelines'}]}/>
  <section className="max-w-[1180px] mx-auto px-6 pb-12">
   <PageTitle title="Campaign monitoring" lede="Live view of saved Coach timelines for artists on the shared YouTube UK roster. Open any campaign to see the same Coach page as the team, without editing controls."/>
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
    <div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{entries.length}</div><div className="text-sm text-muted">Campaigns to follow</div></div>
    <div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{entries.filter(e=>e.status==='live').length}</div><div className="text-sm text-muted">Live rollouts</div></div>
    <div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{entries.filter(e=>e.status==='soon').length}</div><div className="text-sm text-muted">Launching soon</div></div>
    <div className="bg-surface border border-line rounded-xl p-5"><div className="text-3xl font-black">{entries.filter(e=>e.status==='planned').length}</div><div className="text-sm text-muted">Planned / not launched</div></div>
   </div>
   {entries.length === 0 && <div className="border border-line rounded-xl bg-surface p-8 text-muted">No roster campaigns have upcoming dated milestones.</div>}
   {groups.map(group => { const items = entries.filter(e => e.status === group.status); return items.length ? <section key={group.status} className="mb-9">
    <div className="flex items-center gap-3 mb-2"><span className={`w-2.5 h-2.5 rounded-full ${group.dot}`}/><h2 className="text-xl font-black">{group.title}</h2><span className="text-sm text-muted">{items.length}</span></div>
    <p className="text-sm text-muted mb-4">{group.description}</p>
    <div className="space-y-3">{items.map(({plan,next,upcoming,recent,daysUntil}) => <Link key={plan.slug} href={`/coach/${encodeURIComponent(plan.slug)}?partner=youtube-uk`} className={`block bg-surface border border-line border-l-4 ${group.accent} rounded-xl p-5 hover:bg-paper no-underline text-ink`}>
     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div><h3 className="font-black text-lg">{plan.artist}</h3><p className="text-sm text-muted">{plan.campaignName}</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-md bg-paper border border-line px-3 py-1.5 font-bold">{daysUntil === 0 ? 'Next milestone today' : daysUntil === 1 ? 'Next milestone tomorrow' : `Next in ${daysUntil} days`}</span><span className="text-muted">{plan.market?.toUpperCase() || 'UK'}</span><span className="font-bold">View Coach ↗</span></div>
     </div>
     <div className="mt-4 pt-4 border-t border-line flex flex-col md:flex-row md:justify-between gap-2">
      <div><div className="text-[11px] uppercase tracking-wider font-bold text-muted">Next milestone · {dateLabel(next.dateISO)}</div><div className="text-sm font-semibold mt-1">{next.title}</div></div>
      <div className="text-xs text-muted md:text-right">{upcoming} upcoming milestone{upcoming===1?'':'s'}{recent ? ` · ${recent} in past 30d` : ''}</div>
     </div>
    </Link>)}</div>
   </section> : null; })}
   <p className="text-xs text-muted mt-5">Status is inferred from dated Coach milestones, not confirmed release metadata. “Live” means a release or premiere milestone is recorded in the past; “launching soon” means the next milestone is within 14 days. Only plans with future milestones appear. All views are read-only.</p>
  </section>
 </main>;
}
