'use client';
import type { CoachSummary, Decisions } from '@/lib/coach/roadmap';
import CoachActionBoard from './CoachActionBoard';
export default function CoachCampaignStatus({slug,evidence,decisions}:{slug:string;evidence:CoachSummary;decisions:Decisions}) {
  const s=evidence.status;
  if(!s)return null;
  return <section className="coach-status" aria-label="Campaign status and next actions">
    <style>{`.coach-status{max-width:1100px;margin:28px auto;padding:22px 26px;background:#fff;border:1px solid #e9e2d3;border-radius:12px;color:#0e0e0e}.coach-status-label{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#777168}.coach-status-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}.coach-status-facts{display:grid;grid-template-columns:1.7fr 1fr;gap:24px}.coach-status-current{font-size:17px;line-height:1.4;font-weight:800}.coach-status-sub{font-size:12px;color:#777168;line-height:1.5;margin-top:7px}.coach-status .coach-next{margin-top:10px;padding-top:10px}.coach-status .coach-next-row{padding:10px 0}.coach-status .coach-next-label{font-size:14px}.coach-status .coach-next-reason{font-size:12px;line-height:1.5;max-width:850px}.coach-status .coach-next-date{font-size:12px}@media(max-width:1180px){.coach-status{margin:24px 20px}}@media(max-width:700px){.coach-status{padding:20px}.coach-status-facts{grid-template-columns:1fr;gap:16px}}`}</style>
    <div className="coach-status-head"><span className="coach-status-label">Campaign status</span>{s.campaign&&<span className="coach-status-sub" style={{margin:0}}>{s.campaign}</span>}</div>
    <div className="coach-status-facts">
      <div><div className="coach-status-current">{!s.fresh?'Last reading · ':''}{s.current}</div><p className="coach-status-sub">{s.cadence}</p></div>
      <div><div className="coach-status-label">Next release</div><p style={{fontWeight:750,fontSize:15,marginTop:5}}>{s.next}</p></div>
    </div>
    {!s.fresh?<p className="coach-status-sub">Channel reading is stale or unavailable. Refresh the channel data before deciding which assets are missing.</p>:s.priorities.length?<CoachActionBoard mode="priority" tracks={s.priorities} slug={slug} evidence={evidence} decisions={decisions}/>:<p className="coach-status-sub">No urgent asset gap identified. Review the rollout below with the artist team.</p>}
  </section>;
}
