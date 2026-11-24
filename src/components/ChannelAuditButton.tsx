'use client';
import VideoCaptionActions from './VideoCaptionActions';
import ChannelAuditVisuals from './ChannelAuditVisuals';
import ChannelAuditIntel from './ChannelAuditIntel';
import { auditTitleSuggestion } from '@/lib/auditTitleSuggestion';
import { useEffect, useRef, useState } from 'react';
import { auditNumber, channelAuditText, auditNeedsCatalogue, type ChannelAudit, type AuditFinding } from '@/lib/channelAudit';


/** A print-ready, three-page editorial summary. The browser's print dialog saves it as PDF. */
function printThreePageAudit(a: ChannelAudit) {
  const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const n=(v:number|null)=>auditNumber(v);
  const formats=a.visuals.formats.filter(f=>f.count>0 && !['longform','short'].includes(f.key)).sort((x,y)=>y.median-x.median).slice(0,6);
  const maxMedian=Math.max(1,...formats.map(f=>f.median));
  const weeklyMax=Math.max(1,...a.visuals.weeks.map(w=>w.longform+w.shorts));
  const months=a.intel.months;
  const monthlyMax=Math.max(1,...months.map(m=>m.videos+m.shorts+m.audio));
  const formatRows=formats.map(f=>`<div class="format"><div class="formatname"><b>${esc(f.name)}</b><span>${f.count} uploads · ${n(f.median)} median views</span></div><div class="track"><i style="width:${Math.max(2,f.median/maxMedian*100)}%"></i></div></div>`).join('');
  const monthBars=months.map(m=>`<div class="barcol"><div class="barstack" style="height:${Math.max(2,(m.videos+m.shorts+m.audio)/monthlyMax*100)}%"><i style="flex:${m.shorts};background:#3027e8"></i><i style="flex:${m.videos};background:#ff4a1c"></i><i style="flex:${m.audio};background:#99928a"></i></div><small>${esc(m.label)}${m.partial?'*':''}</small></div>`).join('');
  const weekBars=a.visuals.weeks.map(w=>`<div class="barcol"><div class="barstack" style="height:${Math.max(2,(w.longform+w.shorts)/weeklyMax*100)}%;opacity:${w.covered?1:.35}"><i style="flex:${w.shorts};background:#3027e8"></i><i style="flex:${w.longform};background:#ff4a1c"></i></div><small>${esc(w.date.slice(8))}/${esc(w.date.slice(5,7))}</small></div>`).join('');
  const exampleVideos=[...a.findings.flatMap(f=>f.videos||[]),...a.leaders].filter((v,i,arr)=>arr.findIndex(x=>x.id===v.id)===i).slice(0,3);
  const examples=exampleVideos.map(v=>`<div class="video"><img src="https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/mqdefault.jpg" /><div><b>${esc(v.title)}</b><small>${n(v.views)} lifetime views · ${esc(v.publishedAt.slice(0,10))}</small><a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}">Watch video ↗</a></div></div>`).join('');
  const actions=(a.visuals.actions.length?a.visuals.actions:a.priorities).slice(0,3).map((p,i)=>`<div class="action"><strong>0${i+1}</strong><p>${esc(p)}</p></div>`).join('');
  const markets=a.territories.slice(0,5).map(t=>`<div><b>${n(t.views)}</b><small>${esc(t.name)}${t.estimated?' (est.)':''}</small></div>`).join('');
  const split=a.visuals.split;const share=split.longform+split.shorts?split.longform/(split.longform+split.shorts)*100:0;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${esc(a.name)} · YouTube Channel Audit</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#171717;background:#fff} .page{height:297mm;width:210mm;padding:17mm 17mm 15mm;break-after:page;page-break-after:always;position:relative;overflow:hidden}.page:last-child{break-after:auto;page-break-after:auto}
    .eyebrow{color:#f04b24;font-weight:800;letter-spacing:2px;font-size:10px;text-transform:uppercase}.page h1{font-size:35px;line-height:1.1;margin:13px 0 10px}.page h2{font-size:24px;margin:10px 0 15px}.page h3{font-size:16px;margin:21px 0 10px}.muted{color:#716f6a}.intro{font-size:14px;line-height:1.55;color:#555;max-width:95%;margin:12px 0 20px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:23px 0}.metric{background:#f6f3ee;border-radius:9px;padding:13px 10px}.metric b{display:block;font-size:22px}.metric small,.foot,small{font-size:10px;color:#777}.metric small{display:block;margin-top:5px}.panel{background:#f6f3ee;border-radius:12px;padding:18px;margin:16px 0}.panel h3{margin:0 0 9px}.headline{font-size:22px;font-weight:800;line-height:1.25;margin:0 0 10px}.chart{display:flex;gap:7px;align-items:end;height:106px;border-bottom:1px solid #d7d2c9;padding-top:10px}.barcol{flex:1;height:100%;display:flex;align-items:center;flex-direction:column;justify-content:end;min-width:0}.barstack{width:100%;display:flex;flex-direction:column;overflow:hidden;min-height:2px}.barstack i{display:block;min-height:0}.barcol small{font-size:9px;margin-top:7px;white-space:nowrap}.legend{font-size:10px;color:#666;margin:13px 0}.legend em{font-style:normal;color:#3027e8}.legend strong{color:#ff4a1c}.split{height:14px;display:flex;border-radius:5px;overflow:hidden;background:#eee}.split span:first-child{background:#ff4a1c}.split span:last-child{background:#3027e8}.twocol{display:flex;justify-content:space-between;gap:20px;margin:12px 0}.twocol b{font-size:24px;display:block}.format{margin:13px 0}.formatname{display:flex;justify-content:space-between;align-items:baseline;font-size:12px}.formatname span{font-size:10px;color:#777}.track{height:7px;background:#eee;border-radius:10px;margin-top:7px;overflow:hidden}.track i{display:block;background:#ff4a1c;height:100%;border-radius:10px}.video{display:flex;gap:12px;padding:10px 0;border-top:1px solid #e6e0d7;align-items:center}.video img{width:100px;height:56px;object-fit:cover;border-radius:5px}.video b{display:block;font-size:11px;line-height:1.3}.video small{display:block;margin-top:4px}.video a{font-size:10px;color:#2620b4;display:block;margin-top:5px}.action{display:flex;gap:15px;border-bottom:1px solid #e9e3d9;padding:16px 0}.action strong{color:#ff4a1c;font-size:19px}.action p{font-size:13px;line-height:1.5;margin:0}.markets{display:flex;justify-content:space-between;gap:10px;margin-top:12px}.markets b{font-size:19px;display:block}.markets small{display:block;margin-top:4px}.foot{position:absolute;bottom:12mm;left:17mm;right:17mm;border-top:1px solid #e8e2d9;padding-top:8px;line-height:1.4}.foot span{float:right}a{color:inherit}@media screen{body{background:#e6e6e6}.page{background:#fff;margin:15px auto;box-shadow:0 4px 20px #0002}}@media print{.page{margin:0;box-shadow:none}print-color-adjust:exact;-webkit-print-color-adjust:exact}
  </style></head><body>
  <section class="page"><div class="eyebrow">YouTube / Channel audit · ${esc(a.generatedAt.slice(0,10))}</div><h1>${esc(a.name)}</h1><p class="muted">Channel performance, publishing and next steps</p><div class="metrics"><div class="metric"><b>${n(a.stats.subs)}</b><small>Subscribers</small></div><div class="metric"><b>${n(a.stats.views30d)}</b><small>Channel views · 30d</small></div><div class="metric"><b>${n(a.stats.views7d)}</b><small>Channel views · 7d</small></div><div class="metric"><b>${a.intel.activity.uploads}</b><small>Uploads · six-month sample</small></div></div>
  <div class="panel"><div class="eyebrow">The main finding</div><p class="headline">${esc(a.intel.headline)}</p><p class="intro">${esc(a.intel.read)}</p></div>
  <h3>Publishing rhythm · monthly</h3><div class="chart">${monthBars}</div><div class="legend"><strong>■ Videos</strong> · <em>■ Shorts</em> · ■ Release audio · *Partial month</div>
  <h3>Weekly publishing · last 13 weeks</h3><div class="chart">${weekBars}</div><div class="legend"><strong>■ Long-form</strong> · <em>■ Shorts</em> · Faded bars indicate incomplete coverage</div>
  <div class="foot">Monthly figures: six-month upload sample. Weekly figures: analysed upload inventory. Publishing volume is not proof of view growth.<span>01 / 03</span></div></section>
  <section class="page"><div class="eyebrow">02 / Content performance</div><h2>What content is working?</h2><p class="intro">Compare typical lifetime views per upload. Different upload ages mean these are directional clues, not a like-for-like ranking.</p>
  <h3>Where recorded viewing sits</h3><div class="twocol"><div><b>${n(split.longform)}</b><small>Long-form · ${split.longformCount} uploads</small></div><div style="text-align:right"><b>${n(split.shorts)}</b><small>Shorts · ${split.shortsCount} uploads</small></div></div><div class="split"><span style="width:${share}%"></span><span style="width:${100-share}%"></span></div><p class="muted" style="font-size:10px">Analysed upload lifetime views only; not the full channel lifetime counter.</p>
  <h3>Formats with recorded examples</h3>${formatRows||'<p class="muted">Not enough classified examples yet.</p>'}
  <h3>Videos worth reviewing</h3>${examples||'<p class="muted">No named examples available.</p>'}
  <div class="foot">${esc(a.coverage)}<span>02 / 03</span></div></section>
  <section class="page"><div class="eyebrow">03 / Recommended next steps</div><h2>Where to focus next</h2><p class="intro">Three practical actions based on the tracked evidence. Confirm creative fit and available assets before committing production or spend.</p>${actions}
  <h3>Priority markets</h3><div class="markets">${markets||'<p class="muted">No cached market data available.</p>'}</div><p class="muted" style="font-size:10px;margin-top:12px">${esc(a.territoryNote)}</p>
  <div class="panel" style="margin-top:28px"><h3>Before acting on this report</h3><p style="font-size:12px;line-height:1.6;margin:0">Format classifications are inferred from upload metadata and may need review. Lifetime views are not age-matched. The scanned playlist may not include every release or third-party appearance. YouTube Studio is needed for retention, traffic sources and paid impact.</p></div>
  <div class="foot">Prepared from the shared Watcher channel audit · ${esc(a.generatedAt.slice(0,10))}. Data reading: ${esc(a.dataAt?.slice(0,10)||'date unavailable')}.<span>03 / 03</span></div></section></body></html>`;
  const win=window.open('','_blank');
  if(!win) { alert('Please allow pop-ups to open the printable audit.');return; }
  win.document.open();win.document.write(html);win.document.close();win.focus();
  // The user can select Save as PDF in the native print dialog.
  win.onload=()=>win.print();
}

export default function ChannelAuditButton({ slug, name }: { slug: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewPanel = useRef<HTMLDetailsElement>(null);
  const [open,setOpen] = useState(false);
  const [audit,setAudit] = useState<ChannelAudit | null>(null);
  const [error,setError] = useState('');
  const [copied,setCopied] = useState('');
  const [scanning,setScanning] = useState(false);
  const [scanStatus,setScanStatus] = useState('');
  const [reviewError,setReviewError] = useState('');
  const [reviewBusy,setReviewBusy] = useState(false);
  const storageKey = 'channel-audit:formats:v1:'+slug;
  function readCorrections(): Record<string,string> {
    try { const v=JSON.parse(localStorage.getItem(storageKey) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  }
  async function applyCorrections(data: ChannelAudit, signal?: AbortSignal): Promise<ChannelAudit> {
    const overrides=readCorrections();
    if (!Object.keys(overrides).length) return data;
    const response=await fetch('/api/channel-audit/'+encodeURIComponent(slug), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',overrides}),signal});
    const result=await response.json();
    if (!response.ok) throw Error(result.error ?? 'Could not apply saved format corrections.');
    return result;
  }
  async function updateFormat(id:string, value:string) {
    setReviewError(''); setReviewBusy(true);
    try {
      const overrides=readCorrections();
      if(value==='auto') delete overrides[id]; else overrides[id]=value;
      // Store only after successfully recalculating the full audit.
      const response=await fetch('/api/channel-audit/'+encodeURIComponent(slug),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',overrides})});
      const data=await response.json(); if(!response.ok) throw Error(data.error ?? 'Could not update the audit.');
      localStorage.setItem(storageKey,JSON.stringify(overrides)); setAudit(data);
    } catch(e) { setReviewError(e instanceof Error ? e.message : 'Could not save the correction.'); } finally {setReviewBusy(false);}
  }
  const activeScan=useRef<AbortController|null>(null);
  useEffect(()=>{
    if (!open) return;
    const controller = new AbortController();
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow='hidden';
    setAudit(null); setError(''); setCopied(''); setScanStatus('');
    fetch('/api/channel-audit/'+encodeURIComponent(slug),{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error ?? 'Could not load the audit.');return applyCorrections(data,controller.signal);}).then(d=>{if(controller.signal.aborted)return;setAudit(d);if(auditNeedsCatalogue(d))void scan();}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>{controller.abort();activeScan.current?.abort();setScanning(false);document.body.style.overflow=previous;dialog.current?.close();};
  },[open,slug]);
  async function scan() {
    if(scanning)return;
    const controller=new AbortController();activeScan.current=controller;
    setScanning(true);setScanStatus('Scanning public uploads…');
    try {
      for(let batch=0;batch<20;batch++) {
        const response=await fetch('/api/channel-audit/'+encodeURIComponent(slug),{method:'POST',signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw Error(data.error??'Scan failed; saved progress is preserved.');
        setAudit(await applyCorrections(data,controller.signal));setScanStatus(`${data.catalogue.scannedIds} playlist IDs read${data.catalogue.complete?' · scan complete':' · collecting older uploads…'}`);
        if(data.catalogue.complete)break;
        if(batch===19)setScanStatus('Progress saved. Select Continue scan for the remaining uploads.');
      }
    } catch(e) {if(!controller.signal.aborted)setScanStatus(e instanceof Error?e.message:'Could not complete scan.');}
    finally {setScanning(false);}
  }
  async function png(quick=false) {
    if(!audit)return;
    setCopied('Preparing PNG…');
    try {const {downloadAuditPng}=await import('@/lib/channelAuditPng');await downloadAuditPng(audit,quick);setCopied('PNG downloaded');} catch {setCopied('PNG export failed. Text export remains available.');}
  }
  async function copy(summary=false) {
    if (!audit) return;
    const i = audit.intel, a = i.activity;
    const n = auditNumber;
    const longViews = i.formats.filter(f=>f.key!=='short').reduce((sum,f)=>sum+f.views,0);
    const concise = (s:string)=>s.replace(/ Links and end screens have not been inspected\./g,'').replace(/ Compare new uploads at the same age\./g,'');
    const quick = [
      audit.name+' | YouTube channel update',
      ['Last 7 days',audit.stats.views7d!=null?'• '+n(audit.stats.views7d)+' channel views added':null,audit.stats.subs7d!=null?'• '+(audit.stats.subs7d>0?'+':'')+n(audit.stats.subs7d)+' subscribers':null].filter(Boolean).join('\n'),
      ['Last 6 months ('+i.window.from+' to '+i.window.to+')','• '+a.uploads+' uploads, including '+a.shorts+' Shorts','• '+n(a.views)+' lifetime views on these uploads',a.views>0?'• Long-form accounts for '+Math.round(longViews/a.views*100)+'% of those views':null].filter(Boolean).join('\n'),
      i.proof.length?['What’s working',...i.proof.slice(0,2).map(p=>'• '+p.title+' — '+n(p.views)+' views'+(p.older?' (older upload)':''))].join('\n'):null,
      i.next.length?['Next steps',...i.next.slice(0,2).map(p=>'• '+concise(p.action))].join('\n'):null,
      i.coverageWarning
    ].filter(Boolean).join('\n\n');
    const text = summary ? quick : channelAuditText(audit);
    try {await navigator.clipboard.writeText(text);setCopied(summary?'Summary copied':'Audit copied');} catch {setCopied('Clipboard unavailable — use Download text.');}
  }
  function download() {
    if(!audit)return;
    const url=URL.createObjectURL(new Blob([channelAuditText(audit)],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`${slug}-channel-audit-${audit.generatedAt.slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url);
  }
  const ready=!!audit?.catalogue?.complete && !scanning;
  return <>
    <button type="button" onClick={e=>{e.stopPropagation();setOpen(true);}} className="px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer" style={{background:'#2C25FF',color:'#fff'}}>Channel audit</button>
    {open && <dialog ref={dialog} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} onClick={e=>{e.stopPropagation();if(e.target===dialog.current)setOpen(false);}} aria-labelledby={`audit-title-${slug}`} className="p-0 rounded-xl border border-line bg-paper text-ink shadow-2xl backdrop:bg-black/50" style={{width:'min(1100px, calc(100vw - 24px))',maxHeight:'90dvh'}}>
      <div className="sticky top-0 z-10 bg-paper border-b border-line px-6 py-4 flex justify-between gap-4 items-start">
        <div><div className="text-[10px] font-bold uppercase tracking-widest text-signal">Channel audit · evidence & priorities</div><h2 id={`audit-title-${slug}`} className="text-2xl font-black mt-1">{name}</h2><p className="text-xs text-muted mt-1">Activity, audience response and the next useful step.</p></div>
        <button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Close channel audit" className="rounded px-3 py-1 text-xl hover:bg-black/5">×</button>
      </div>
      {!audit && !error && <p role="status" className="p-8 text-sm text-muted">Reading stored channel data…</p>}
      {error && <div role="alert" className="p-8"><p>{error}</p><button className="underline mt-4" onClick={()=>setOpen(false)}>Close</button></div>}
      {audit && <div className="px-6 sm:px-8 py-6 space-y-7">
        <div className="flex flex-wrap gap-2 items-center">
          <button disabled={!ready} onClick={()=>printThreePageAudit(audit!)} className="disabled:opacity-40 bg-ink text-white rounded px-4 py-2 text-xs font-bold">Print / save 3-page PDF</button>
          <button disabled={!ready} onClick={()=>copy(true)} className="disabled:opacity-40 bg-ink text-white rounded px-4 py-2 text-xs font-bold">Copy channel summary</button>
          {ready && <details className="relative"><summary className="border border-line rounded px-4 py-2 text-xs font-bold cursor-pointer list-none">Export ▾</summary><div className="absolute left-0 top-full mt-2 z-20 bg-white border border-line rounded-lg shadow-lg p-1 min-w-[180px]">
            <button onClick={()=>png(true)} className="block w-full text-left px-3 py-2 text-xs hover:bg-black/5 rounded">Download intel PNG</button>
            <button onClick={()=>png()} className="block w-full text-left px-3 py-2 text-xs hover:bg-black/5 rounded">Download full audit PNG</button>
            <button onClick={()=>copy()} className="block w-full text-left px-3 py-2 text-xs hover:bg-black/5 rounded">Copy full audit</button>
            <button onClick={download} className="block w-full text-left px-3 py-2 text-xs hover:bg-black/5 rounded">Download text</button>
          </div></details>}
          <span aria-live="polite" className="text-xs text-muted">{copied}</span>
        </div>
        {(!audit.catalogue?.complete || scanning) && <div className="rounded-lg border border-line p-4 text-xs flex flex-wrap items-center justify-between gap-3"><div className="flex-1 min-w-[220px]"><p className="font-bold">{audit.catalogue?.complete?'Full playlist scanned':audit.catalogue?'Catalogue scan in progress':'Recent-upload sample'}</p><p className="text-muted mt-1 leading-relaxed">{audit.coverage}</p><p aria-live="polite" className="mt-1 text-muted">{scanStatus}</p></div>{(!audit.catalogue?.complete || scanning) && <button disabled={scanning} onClick={scan} className="border border-line rounded px-3 py-2 font-bold disabled:opacity-50">{scanning?'Scanning…':audit.catalogue?.complete?'Check catalogue cache':audit.catalogue?'Continue scan':'Scan full catalogue'}</button>}<p className="w-full text-[10px] text-muted">Opening an audit collects the full public uploads playlist if needed. Completed scans are reused for 7 days.</p></div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-line pb-5">{[['Subscribers',audit.stats.subs],['Lifetime channel views',audit.stats.lifetimeViews],['Channel views · 30d',audit.stats.views30d],['Channel views · 7d',audit.stats.views7d]].map(([label,value])=><div key={String(label)}><div className="text-2xl font-black">{auditNumber(value as number|null)}</div><p className="text-[10px] text-muted mt-1">{label}</p></div>)}</div>
        <ChannelAuditIntel audit={audit}/>
        {audit.catalogue?.complete && (
          <details className="rounded-xl border border-line bg-white p-5 sm:p-6" aria-label="Asset format performance"><summary className="text-sm font-bold cursor-pointer mb-2">Explore all formats · full inventory</summary>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-signal">Full asset audit</div>
                <h3 className="mt-1 text-xl font-black">Which video formats work?</h3>
                <p className="mt-1 text-xs text-muted">All scanned public uploads · lifetime views · compare typical results, not just totals.</p>
              </div>
              <span className="rounded-full bg-black/5 px-3 py-1.5 text-[11px] font-bold">{audit.catalogue.scannedIds} video IDs scanned</span>
            </div>
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...audit.visuals.formats]
                .filter(f => f.key !== 'longform' && f.key !== 'short' && f.count > 0)
                .sort((a,b) => b.median-a.median)
                .slice(0,8)
                .map(f => (
                  <article key={f.key} className="min-w-0 rounded-lg border border-line bg-paper p-3.5">
                    <div className="text-xs font-bold text-ink">{f.name}</div>
                    <div className="mt-2 text-2xl font-black">{auditNumber(f.median)}</div>
                    <div className="text-[11px] text-muted">median views per upload</div>
                    <div className="mt-2 text-[11px] text-muted">{f.count} upload{f.count===1?'':'s'} · {auditNumber(f.views)} total views</div>
                    {f.examples[0] && <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(f.examples[0].id)}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[11px] font-semibold text-ink underline underline-offset-2 line-clamp-2" title={f.examples[0].title}>Watch example ↗ {f.examples[0].title}</a>}
                  </article>
                ))}
            </div>
            <div className="mt-4 border-t border-line pt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {audit.visuals.formats.filter(f=>['live','bts','omv','lyric','visualiser','acoustic','short'].includes(f.key) && f.count===0).map(f=>(
                <span key={f.key} className="text-muted">{f.name}: no examples identified</span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">Formats are detected from upload metadata and may need review. Medians are lifetime views, not age-matched performance. A format with one upload is an example, not a proven pattern.</p>
          </details>
        )}

        {audit.catalogue?.complete ? <details className="border-t border-line pt-4"><summary className="text-sm font-bold cursor-pointer">Full channel analysis · formats, cadence & markets</summary><div className="mt-5"><ChannelAuditVisuals audit={audit} onReview={()=>{if(reviewPanel.current){reviewPanel.current.open=true;reviewPanel.current.scrollIntoView({behavior:'smooth',block:'start'});}}}/></div></details> : <section className="border border-line rounded-lg p-6"><h3 className="font-black text-lg">Building the full-channel read</h3><p className="text-sm text-muted mt-2">Recent uploads alone can miss the videos that built this channel. Format verdicts and exports appear once the playlist scan finishes.</p><p role="status" className="text-xs font-semibold mt-3">{scanStatus||'Preparing catalogue scan…'}</p></section>}
        {!!audit.formatReview?.total && <details ref={reviewPanel} className="border border-line rounded-lg p-4"><summary className="text-sm font-bold cursor-pointer">Review video formats · {audit.formatReview.total}</summary><p className="text-xs text-muted mt-2">Highest-viewed first. Confirm the format to get a suggested title. Audit corrections are saved in this browser.</p>{reviewError && <p role="alert" className="text-xs text-red-700 mt-2">{reviewError}</p>}<div className="mt-3 divide-y divide-line">{audit.formatReview.videos.map(v=><div key={v.id} className="py-3 flex flex-wrap gap-3 items-center justify-between"><div className="min-w-0 flex-1"><a className="text-xs font-bold underline" href={'https://www.youtube.com/watch?v='+v.id} target="_blank" rel="noreferrer">{v.title} ↗</a><p className="text-[11px] text-muted mt-1">{auditNumber(v.views)} views · {v.reason}</p>{v.reason==='Saved in this browser' && auditTitleSuggestion(v.title,v.key) && <div className="mt-2 text-xs"><span className="text-muted">Suggested title: </span><span className="font-semibold">{auditTitleSuggestion(v.title,v.key)}</span><button type="button" className="ml-2 underline font-bold" onClick={async()=>{try{await navigator.clipboard.writeText(auditTitleSuggestion(v.title,v.key)!);setCopied('Suggested title copied');}catch{setReviewError('Could not copy the title.');}}}>Copy</button><a href={'https://studio.youtube.com/video/'+v.id+'/edit'} target="_blank" rel="noreferrer" className="ml-2 underline">Open Studio ↗</a></div>}</div><label className="text-xs text-muted">Format <select aria-label={'Format for '+v.title} disabled={reviewBusy} value={v.reason==='Saved in this browser'?v.key:'auto'} onChange={e=>void updateFormat(v.id,e.target.value)} className="ml-2 border border-line rounded p-2 bg-white"><option value="auto">Automatic · {v.format}</option><option value="omv">Official music video</option><option value="live">Live performance</option><option value="lyric">Lyric video</option><option value="visualiser">Visualiser</option><option value="audio">Audio</option><option value="acoustic">Acoustic</option><option value="bts">Behind the scenes</option><option value="documentary">Documentary</option><option value="interview">Interview</option><option value="tour">Tour / festival</option><option value="short">Short</option><option value="longform">Other long-form</option></select></label></div>)}</div><p aria-live="polite" className="text-xs text-muted mt-2">{copied === 'Suggested title copied' ? copied : ''}</p>{audit.formatReview.total>audit.formatReview.videos.length && <p className="text-xs text-muted mt-2">Showing the {audit.formatReview.videos.length} highest-viewed videos needing review.</p>}</details>}
        <details className="border-t border-line pt-4"><summary className="text-sm font-bold cursor-pointer">Video evidence, asset checks & past campaigns</summary><div className="space-y-6 mt-5">
        <section><h3 className="text-lg font-black mb-4">What is working</h3><div className="space-y-5">{audit.findings.map(f=><Finding key={f.title} finding={f}/>)}</div></section>
        <section className="rounded-lg p-5" style={{background:'#F6F1E7'}}><h3 className="text-lg font-black mb-4">Missed opportunities & asset checks</h3>{audit.gaps.length ? <div className="space-y-5">{audit.gaps.map(f=><Finding key={f.title} finding={f}/>)}</div> : <p className="text-sm">No specific gap identified in the tracked sample. This does not confirm that the channel has every asset it needs.</p>}</section>
        {audit.reference && <section className="border-t border-line pt-6"><h3 className="text-lg font-black mb-2">Past campaign reference</h3><p className="text-xs text-muted mb-4">{audit.reference.title} · Data captured {audit.reference.date ?? 'date not recorded'}</p><div className="space-y-4">{audit.reference.points.map(p=><Finding key={p.point} finding={{title:p.point,evidence:p.basis}}/>)}</div><p className="text-xs text-muted leading-relaxed mt-4">{audit.reference.note}</p>{audit.reference.href && <a href={audit.reference.href} target="_blank" rel="noreferrer" className="text-xs font-bold underline inline-block mt-3">Open the full deep dive ↗</a>}</section>}
        </div></details>
        <details className="border-t border-line pt-4 text-xs text-muted"><summary className="cursor-pointer font-bold">Evidence, format breakdown & coverage</summary><p className="mt-3">{audit.coverage}</p><div className="overflow-x-auto mt-4"><table className="w-full text-left"><thead><tr><th className="py-2">Format</th><th>Uploads</th><th>Lifetime views in sample</th><th>Median lifetime views</th></tr></thead><tbody>{audit.formats.map(f=><tr key={f.name} className="border-t border-line"><td className="py-2">{f.name}</td><td>{f.count}</td><td>{auditNumber(f.views)}</td><td>{f.count?auditNumber(f.median):'—'}</td></tr>)}</tbody></table></div><ul className="list-disc pl-4 mt-4 space-y-2">{audit.limitations.map(l=><li key={l}>{l}</li>)}</ul><p className="mt-4">Source: cached YouTube Data API channel totals, history and uploads; Chartmetric for the stated market figures. Full-catalogue scans collect YouTube data on first use or after seven days; other readings are reused from the cache.</p></details>
      </div>}
    </dialog>}
  </>;
}
function Finding({finding:f}: {finding:AuditFinding}) {
  return <article><h4 className="text-sm font-bold">{f.title}</h4><p className="text-sm text-ink/65 leading-relaxed mt-1">{f.evidence}</p>{f.action && <p className="text-sm font-semibold mt-2">{f.action}</p>}{f.videos && <div className="flex flex-wrap gap-3 mt-3">{f.videos.map(v=><a key={v.id} href={'https://www.youtube.com/watch?v='+v.id} target="_blank" rel="noreferrer" className="flex gap-2 items-center max-w-[260px] no-underline"><span className="relative flex items-center justify-center shrink-0 rounded bg-black/5 text-muted" style={{width:80,height:45}}><span aria-hidden>▶</span><img src={'https://i.ytimg.com/vi/'+v.id+'/mqdefault.jpg'} width={80} height={45} alt="" className="absolute inset-0 rounded object-cover w-full h-full" onError={e=>{e.currentTarget.style.display='none';}}/></span><span className="text-[11px] leading-snug"><span className="font-bold line-clamp-2">{v.title}</span><span className="text-muted">{auditNumber(v.views)} lifetime views · {v.publishedAt.slice(0,10)}</span></span></a>)}</div>}{f.title==='Caption tracks to review' && f.videos?.map(v=><div key={v.id} className="mt-3"><p className="text-xs font-semibold">{v.title}</p><VideoCaptionActions id={v.id} title={v.title}/></div>)}</article>;
}
