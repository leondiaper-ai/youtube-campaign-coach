'use client';
import { useEffect, useRef, useState } from 'react';
import { auditNumber, channelAuditText, type ChannelAudit, type AuditFinding } from '@/lib/channelAudit';

export default function ChannelAuditButton({ slug, name }: { slug: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open,setOpen] = useState(false);
  const [audit,setAudit] = useState<ChannelAudit | null>(null);
  const [error,setError] = useState('');
  const [copied,setCopied] = useState('');
  useEffect(()=>{
    if (!open) return;
    const controller = new AbortController();
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow='hidden';
    setAudit(null); setError(''); setCopied('');
    fetch('/api/channel-audit/'+encodeURIComponent(slug),{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error ?? 'Could not load the audit.');return data;}).then(setAudit).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>{controller.abort();document.body.style.overflow=previous;dialog.current?.close();};
  },[open,slug]);
  async function copy(summary=false) {
    if (!audit) return;
    const text = summary ? `${audit.name} — YouTube channel read (${audit.dataAt?.slice(0,10) ?? 'date unavailable'})\n\n${audit.summary}\n\n${audit.priorities.map((p,i)=>(i+1)+'. '+p).join('\n')}\n\nBased on ${audit.coverage} Market figures, if used, are Chartmetric artist-level estimates/readings.` : channelAuditText(audit);
    try {await navigator.clipboard.writeText(text);setCopied(summary?'Summary copied':'Audit copied');} catch {setCopied('Clipboard unavailable — use Download text.');}
  }
  function download() {
    if(!audit)return;
    const url=URL.createObjectURL(new Blob([channelAuditText(audit)],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`${slug}-channel-audit-${audit.generatedAt.slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url);
  }
  return <>
    <button type="button" onClick={e=>{e.stopPropagation();setOpen(true);}} className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-[0.08em] cursor-pointer" style={{background:'#2C25FF',color:'#fff'}}>Channel audit</button>
    {open && <dialog ref={dialog} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} onClick={e=>{e.stopPropagation();if(e.target===dialog.current)setOpen(false);}} aria-labelledby={`audit-title-${slug}`} className="p-0 rounded-xl border border-line bg-paper text-ink shadow-2xl backdrop:bg-black/50" style={{width:'min(1000px, calc(100vw - 24px))',maxHeight:'90dvh'}}>
      <div className="sticky top-0 z-10 bg-paper border-b border-line px-6 py-4 flex justify-between gap-4 items-start">
        <div><div className="text-[10px] font-bold uppercase tracking-widest text-signal">Channel audit · evidence & priorities</div><h2 id={`audit-title-${slug}`} className="text-2xl font-black mt-1">{name}</h2><p className="text-xs text-muted mt-1">A reusable channel read for your next brief, meeting or email.</p></div>
        <button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Close channel audit" className="rounded px-3 py-1 text-xl hover:bg-black/5">×</button>
      </div>
      {!audit && !error && <p role="status" className="p-8 text-sm text-muted">Reading stored channel data…</p>}
      {error && <div role="alert" className="p-8"><p>{error}</p><button className="underline mt-4" onClick={()=>setOpen(false)}>Close</button></div>}
      {audit && <div className="px-6 sm:px-8 py-6 space-y-7">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={()=>copy()} className="bg-ink text-white rounded px-4 py-2 text-xs font-bold">Copy full audit</button>
          <button onClick={()=>copy(true)} className="border border-line rounded px-4 py-2 text-xs font-bold">Copy short brief</button>
          <button onClick={download} className="border border-line rounded px-4 py-2 text-xs font-bold">Download text</button>
          <span aria-live="polite" className="text-xs text-muted">{copied}</span>
        </div>
        <div><p className="text-[11px] text-muted mb-3">Channel reading {audit.dataAt?.slice(0,10) ?? 'date unavailable'} · Audit prepared {audit.generatedAt.slice(0,10)}</p><p className="text-lg font-semibold leading-relaxed">{audit.summary}</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 border-y border-line py-5">{[
          ['Subscribers',audit.stats.subs],['Lifetime channel views',audit.stats.lifetimeViews],['Channel views · 7d',audit.stats.views7d],['Channel views · 30d',audit.stats.views30d],['Net subscribers · 7d',audit.stats.subs7d],
        ].map(([label,value])=><div key={String(label)}><div className="text-2xl font-black tabular-nums">{auditNumber(value as number|null)}</div><div className="text-[11px] text-muted mt-1">{label}</div></div>)}</div>
        <section><h3 className="text-lg font-black mb-4">What is working</h3><div className="space-y-5">{audit.findings.map(f=><Finding key={f.title} finding={f}/>)}</div></section>
        <section className="rounded-lg p-5" style={{background:'#F6F1E7'}}><h3 className="text-lg font-black mb-4">Missed opportunities & asset checks</h3>{audit.gaps.length ? <div className="space-y-5">{audit.gaps.map(f=><Finding key={f.title} finding={f}/>)}</div> : <p className="text-sm">No specific gap identified in the tracked sample. This does not confirm that the channel has every asset it needs.</p>}</section>
        {audit.reference && <section className="border-t border-line pt-6"><h3 className="text-lg font-black mb-2">Past campaign reference</h3><p className="text-xs text-muted mb-4">{audit.reference.title} · Data captured {audit.reference.date ?? 'date not recorded'}</p><div className="space-y-4">{audit.reference.points.map(p=><Finding key={p.point} finding={{title:p.point,evidence:p.basis}}/>)}</div><p className="text-xs text-muted leading-relaxed mt-4">{audit.reference.note}</p>{audit.reference.href && <a href={audit.reference.href} target="_blank" rel="noreferrer" className="text-xs font-bold underline inline-block mt-3">Open the full deep dive ↗</a>}</section>}
        <section><h3 className="text-lg font-black mb-4">Key markets</h3>{audit.territories.length>0 && <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-3">{audit.territories.map(t=><div key={t.name}><div className="text-xl font-black">{auditNumber(t.views)}</div><div className="text-xs font-bold mt-1">{t.name}</div><div className="text-[10px] text-muted">Monthly views{t.estimated?' · est.':''}</div></div>)}</div>}<p className="text-xs leading-relaxed text-muted">{audit.territoryNote}</p></section>
        <section className="border-t border-line pt-6"><h3 className="text-lg font-black mb-4">Priorities for the team</h3><ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">{audit.priorities.map(p=><li key={p}>{p}</li>)}</ol></section>
        <details className="border-t border-line pt-4 text-xs text-muted"><summary className="cursor-pointer font-bold">Evidence, format breakdown & coverage</summary><p className="mt-3">{audit.coverage}</p><div className="overflow-x-auto mt-4"><table className="w-full text-left"><thead><tr><th className="py-2">Format</th><th>Uploads</th><th>Lifetime views in sample</th><th>Median lifetime views</th></tr></thead><tbody>{audit.formats.map(f=><tr key={f.name} className="border-t border-line"><td className="py-2">{f.name}</td><td>{f.count}</td><td>{auditNumber(f.views)}</td><td>{auditNumber(f.median)}</td></tr>)}</tbody></table></div><ul className="list-disc pl-4 mt-4 space-y-2">{audit.limitations.map(l=><li key={l}>{l}</li>)}</ul><p className="mt-4">Source: cached YouTube Data API channel totals, history and uploads; Chartmetric for the stated market figures. No extra vendor calls are made by this audit.</p></details>
      </div>}
    </dialog>}
  </>;
}
function Finding({finding:f}: {finding:AuditFinding}) {
  return <article><h4 className="text-sm font-bold">{f.title}</h4><p className="text-sm text-ink/65 leading-relaxed mt-1">{f.evidence}</p>{f.action && <p className="text-sm font-semibold mt-2">{f.action}</p>}{f.videos && <div className="flex flex-wrap gap-3 mt-3">{f.videos.map(v=><a key={v.id} href={'https://www.youtube.com/watch?v='+v.id} target="_blank" rel="noreferrer" className="flex gap-2 items-center max-w-[260px] no-underline"><span className="relative flex items-center justify-center shrink-0 rounded bg-black/5 text-muted" style={{width:80,height:45}}><span aria-hidden>▶</span><img src={'https://i.ytimg.com/vi/'+v.id+'/mqdefault.jpg'} width={80} height={45} alt="" className="absolute inset-0 rounded object-cover w-full h-full" onError={e=>{e.currentTarget.style.display='none';}}/></span><span className="text-[11px] leading-snug"><span className="font-bold line-clamp-2">{v.title}</span><span className="text-muted">{auditNumber(v.views)} lifetime views · {v.publishedAt.slice(0,10)}</span></span></a>)}</div>}</article>;
}
