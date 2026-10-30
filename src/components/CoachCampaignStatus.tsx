'use client';
import type { CoachSummary, Decisions } from '@/lib/coach/roadmap';
import CoachActionBoard from './CoachActionBoard';
const n=(v:number|null)=>v===null?'—':new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(v);
const date=(v:string)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export default function CoachCampaignStatus({slug,evidence,decisions}:{slug:string;evidence:CoachSummary;decisions:Decisions}) {
  const s=evidence.status;
  if(!s)return null;
  return <section className="coach-status" aria-label="Campaign status and next actions">
    <style>{`.coach-status{max-width:1100px;margin:28px auto;padding:24px;background:#fff;border:1px solid #e9e2d3;border-radius:14px;color:#0e0e0e}.coach-status-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#777168}.coach-status-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}.coach-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}.coach-metric{padding:16px;background:#f6f4ff;border:1px solid #ece9f6;border-radius:10px}.coach-metric b{display:block;font-size:30px;line-height:1.2;letter-spacing:-.03em}.coach-metric strong{display:block;font-size:12px;margin-top:5px}.coach-metric small{display:block;color:#777168;font-size:11px;line-height:1.5;margin-top:5px}.coach-status-facts{display:grid;grid-template-columns:1.7fr 1fr;gap:24px}.coach-status-current{font-size:17px;line-height:1.4;font-weight:800}.coach-status-sub{font-size:12px;color:#777168;line-height:1.5;margin-top:7px}.coach-status .coach-next-row{padding:12px 0}.coach-status .coach-next-label{font-size:14px}.coach-status .coach-next-reason{font-size:12px;line-height:1.5;max-width:850px}.coach-status .coach-next-date{font-size:12px}.coach-status-reading{font-size:12px;line-height:1.55;padding:10px 12px;background:#faf7f2;border-radius:7px;margin-top:12px}.coach-status-reading b{margin-right:5px}.coach-status-idea{font-size:12px;line-height:1.6;border-top:1px solid #e9e2d3;padding-top:12px;margin-top:10px}@media(max-width:1180px){.coach-status{margin:24px 20px}}@media(max-width:700px){.coach-status{padding:18px}.coach-status-facts{grid-template-columns:1fr;gap:14px}.coach-metrics{gap:7px}.coach-metric{padding:11px}.coach-metric b{font-size:23px}.coach-metric strong{font-size:11px}}`}</style>
    <div className="coach-status-head"><span className="coach-status-label">Campaign briefing</span><span className="coach-status-label">Channel reading {evidence.audit.dataAt?date(evidence.audit.dataAt):'unavailable'}</span></div>
    <div className="coach-metrics">
      <div className="coach-metric"><b>{n(s.metrics?.views??null)}</b><strong>Campaign upload views</strong><small>{s.metrics?`Since ${date(s.metrics.start)} · tracked uploads`:'Campaign window not established'}</small></div>
      <div className="coach-metric"><b>{s.metrics?.assets??'—'}</b><strong>Published campaign assets</strong><small>{s.metrics?`${s.metrics.longform} long-form · ${s.metrics.shorts} Shorts`:'Not yet established'}</small></div>
      <div className="coach-metric"><b>{s.shortsRead.weekly}<span style={{fontSize:13,fontWeight:600}}> / week</span></b><strong>Shorts · last 28 days</strong><small>{s.shortsRead.count} uploads · {n(s.shortsRead.mean)} avg lifetime views</small></div>
    </div>
    <div className="coach-status-facts">
      <div><div className="coach-status-current">{!s.fresh?'Last reading · ':''}{s.current}</div><p className="coach-status-sub">{s.cadence}</p></div>
      <div><div className="coach-status-label">Next release</div><p style={{fontWeight:750,fontSize:15,marginTop:5}}>{s.next}</p></div>
    </div>
    {s.launch&&<div className="coach-status-reading"><b>Launch pace</b>{s.launch}</div>}
    {s.audience&&<div className="coach-status-reading"><b>Sampled fan response</b>{s.audience.tone}{s.audience.theme?` · ${s.audience.theme}`:''} · {s.audience.comments} comments from {s.audience.assets} videos · read {date(s.audience.date)}. This is a sampled comment read, not the whole audience.</div>}
    {!s.fresh?<p className="coach-status-sub">Refresh the channel data before deciding which assets are missing.</p>:s.priorities.length?<CoachActionBoard mode="priority" tracks={s.priorities} slug={slug} evidence={evidence} decisions={decisions}/>:<p className="coach-status-sub">No urgent asset gap identified. Review the rollout below with the artist team.</p>}
    {s.albumIdea&&<div className="coach-status-idea"><b>Before the album · {date(s.albumIdea.date)}</b><br/>{s.albumIdea.label}. {s.albumIdea.reason}</div>}
  </section>;
}
