"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { actionStatus, type CoachSummary, type TrackRoadmap, type Decision, type Decisions } from "@/lib/coach/roadmap";

const fmt = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {day:"numeric", month:"short"});
export default function CoachActionBoard({mode="full",tracks,slug,evidence,decisions:initial}: {
  mode?:"full"|"overview"|"embedded"|"priority"; tracks:TrackRoadmap[]; slug:string; evidence:CoachSummary; decisions:Decisions;
}) {
  const router=useRouter();
  const [decisions,setDecisions]=useState(initial);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false);
  const [showEvidence,setShowEvidence]=useState(false);
  useEffect(()=>setDecisions(initial),[initial]);
  useEffect(()=>{
    if(mode==="embedded"||mode==="priority") return;
    const timer=setInterval(()=>{if(!document.hidden && !["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName??"")) router.refresh();},120000);
    return ()=>clearInterval(timer);
  },[router,mode]);
  async function save(id:string,d:Decision){
    setBusy(id);setError("");
    try {
      const r=await fetch("/api/coach/roadmap",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,id,...d})});
      if(!r.ok) throw new Error((await r.json()).error??"Could not save");
      setDecisions(old=>({...old,[id]:d}));setEditing(null);router.refresh();
    } catch(e){setError(e instanceof Error?e.message:"Could not save. Try again.");} finally {setBusy(null);}
  }
  async function scan(){
    setScanning(true);setError("");
    try {
      const r=await fetch("/api/channel-audit/"+encodeURIComponent(evidence.artistSlug),{method:"POST"});
      if(!r.ok)throw new Error((await r.json()).error??"Scan failed");
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Scan failed");}finally{setScanning(false);}
  }
  return <div className="coach-inline" aria-label={mode==="overview"?"Channel reading":"Release next steps"}>
    <style>{`.coach-inline{color:#0e0e0e;font-size:13px}.coach-inline button{font:inherit;cursor:pointer;background:none;border:0;padding:0;color:#615c53;text-decoration:underline;text-underline-offset:3px}.coach-inline button:disabled{opacity:.5;cursor:wait}.coach-inline button:focus-visible,.coach-inline input:focus-visible{outline:2px solid #2d6a4f;outline-offset:4px}.coach-next{border-top:1px solid #e9e2d3;margin-top:14px;padding-top:12px}.coach-next-row{display:flex;align-items:start;gap:12px;padding:9px 0}.coach-next-row input[type=checkbox]{width:17px;height:17px;margin-top:2px;accent-color:#2d6a4f;flex-shrink:0}.coach-next-copy{flex:1;min-width:0}.coach-next-label{font-weight:700;font-size:13px}.coach-next-reason{font-size:11px;line-height:1.45;color:#777168;margin-top:3px}.coach-next-date{font-size:11px;white-space:nowrap}.coach-assets{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.coach-assets a{font-size:10px;color:#2d6a4f;background:#edf3ee;padding:4px 7px;border-radius:4px;text-decoration:none}.coach-tools{max-width:1100px;margin:24px auto 0;padding:0 40px;font-size:11px;color:#777168}.coach-tools-line{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.coach-edit{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.coach-edit input{font:inherit;padding:6px;border:1px solid #d8d0c1;border-radius:4px}.coach-evidence{padding-top:12px;line-height:1.6;max-width:720px}.coach-evidence a{color:#2d6a4f}@media(max-width:700px){.coach-tools{padding:0 20px}.coach-next-row{gap:9px}.coach-next-date{font-size:10px}}`}</style>
    {mode!=="overview" && tracks.map(track=>{
      const live=track.actions.filter(a=>a.video&&!a.scheduled);
      const next=track.actions.filter(a=>!a.video||a.scheduled);
      return <div key={track.id}>
        {mode!=="priority" && live.length>0 && <div className="coach-assets" aria-label="Published assets">{live.map(a=><a key={a.id} href={"https://www.youtube.com/watch?v="+a.video!.id} target="_blank" rel="noreferrer" title={a.video!.title}>✓ {a.label} · {fmt(a.video!.date)}</a>)}</div>}
        {next.length>0 && <div className="coach-next">
          <div style={{fontSize:9,fontWeight:800,letterSpacing:".12em",color:"#777168",textTransform:"uppercase"}}>{mode==="priority"?"Do next":"Next steps · suggested from this channel"}</div>
          {next.map(a=>{
            const d=decisions[a.id]??{status:"suggested" as const};
            const target=d.targetDate??a.date;
            const done=d.status==="done";
            const skipped=d.status==="dismissed";
            return <div key={a.id} className="coach-next-row">
              <input type="checkbox" aria-label={"Mark "+a.label+" done for "+track.name} checked={done} disabled={busy!==null||!!a.scheduled} onChange={e=>save(a.id,{...d,status:e.target.checked?"done":"suggested"})}/>
              <div className="coach-next-copy">
                <div className="coach-next-label" style={{textDecoration:done||skipped?"line-through":undefined,opacity:skipped?.5:1}}>{a.label}</div>
                {!done&&!skipped && <div className="coach-next-reason">{a.scheduled?"Linked video — check publication":a.available?"Matching file available — confirm approval":mode==="priority"?a.reason:a.reason.split(". ")[0]+"."}</div>}
                {(done||skipped||d.status==="planned"||d.status==="ready")&&<div className="coach-next-reason">{actionStatus(a,d)}</div>}
                {editing===a.id && <form className="coach-edit" onSubmit={e=>{e.preventDefault();const date=new FormData(e.currentTarget).get("date") as string;save(a.id,{...d,targetDate:date});}}>
                  <input aria-label={"Target date for "+a.label+" — "+track.name} name="date" type="date" defaultValue={target} required/>
                  <button type="submit" disabled={busy!==null}>Save date</button>
                  <button type="button" disabled={busy!==null} onClick={()=>save(a.id,{...d,status:skipped?"suggested":"dismissed"})}>{skipped?"Restore":"Not needed"}</button>
                  <button type="button" onClick={()=>setEditing(null)}>Cancel</button>
                </form>}
              </div>
              <button className="coach-next-date" aria-label={"Change target date for "+a.label+" — "+track.name} onClick={()=>setEditing(editing===a.id?null:a.id)}>{done?"Done":skipped?"Not needed":`Aim: ${fmt(target)}`}</button>
            </div>;
          })}
        </div>}
      </div>;
    })}
    {mode!=="embedded" && mode!=="priority" && <div className="coach-tools">
      <div className="coach-tools-line">
        <span>Channel reading {evidence.audit.dataAt?fmt(evidence.audit.dataAt.slice(0,10)):"unavailable"}</span>
        <button onClick={()=>router.refresh()}>Refresh</button>
        <button aria-expanded={showEvidence} onClick={()=>setShowEvidence(!showEvidence)}>{showEvidence?"Close channel evidence":"Channel evidence"}</button>
      </div>
      {showEvidence&&<div className="coach-evidence">
        <p>{evidence.audit.coverage} {evidence.audit.visuals.takeaway}</p>
        <p>Suggestions use channel uploads, campaign dates and available deep-dive findings. Lifetime views are not age-adjusted. Dates are starting points to agree, not a proven optimal cadence. An unmatched asset is not confirmed missing.</p>
        {evidence.dive?.deckUrl&&<p><a href={evidence.dive.deckUrl} target="_blank" rel="noreferrer">Read the deep dive</a> · {evidence.dive.dataCapturedAt??"date unavailable"}</p>}
        <p><a href="https://support.google.com/youtube/answer/18736733?hl=en" target="_blank" rel="noreferrer">YouTube release guidance</a> · <button disabled={scanning} onClick={scan}>{scanning?"Scanning…":"Scan channel catalogue"}</button></p>
      </div>}
    </div>}
    {error&&<p role="alert" style={{color:"#b91c1c",fontSize:12}}>{error}</p>}
  </div>;
}
