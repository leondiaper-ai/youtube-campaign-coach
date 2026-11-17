'use client';
import { auditNumber as n, type ChannelAudit } from '@/lib/channelAudit';

export default function ChannelAuditIntel({audit:a}:{audit:ChannelAudit}) {
  const i=a.intel, activity=i.activity;
  const max=Math.max(1,...i.months.map(m=>m.videos+m.shorts+m.audio));
  const rate=(v:number|null)=>v==null?'Unavailable':v.toFixed(2)+'%';
  return <section aria-labelledby={'intel-'+a.slug} className="space-y-5">
    <div className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex justify-between gap-3 flex-wrap text-[10px] font-bold uppercase tracking-widest text-muted"><span className="text-signal">Quick channel intel</span><span>{i.window.from} — {i.window.to}</span></div>
      <h3 id={'intel-'+a.slug} className="text-2xl sm:text-3xl font-black leading-tight mt-3 max-w-[32ch]">{i.headline}</h3>
      <p className="text-sm text-muted leading-relaxed mt-3 max-w-[90ch]">{i.read}</p>
      {i.coverageWarning && <p className="text-xs font-semibold mt-3 border-l-2 border-signal pl-3">{i.coverageWarning}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-line pt-4 mt-5">
        {[['Uploads found',activity.uploads],['Shorts identified',activity.shorts],['Release audio',activity.audio],['Views on these uploads',activity.views]].map(([label,v])=><div key={String(label)}><div className="text-3xl font-black">{n(v as number)}</div><p className="text-[11px] text-muted mt-1">{label}</p></div>)}
      </div>
      <p className="text-[10px] text-muted mt-3">Six-month upload cohort · lifetime view counts · includes release audio from the stated sources</p>
      {i.reviewedReleases && <p className="text-[10px] text-muted mt-2"><a className="underline" href={i.reviewedReleases.sourceUrl} target="_blank" rel="noreferrer">{i.reviewedReleases.videoCount} additional release uploads from reviewed artist sources ↗</a> · source checked {i.reviewedReleases.checkedAt}</p>}
    </div>
    {!!i.proof.length && <div><h4 className="font-black text-base mb-3">Where people respond</h4><div className="grid sm:grid-cols-2 gap-3">{i.proof.map(v=><article key={v.id} className="rounded-lg border border-line bg-white overflow-hidden">
      <a href={'https://www.youtube.com/watch?v='+v.id} target="_blank" rel="noreferrer" className="flex gap-3 p-4 items-start"><img src={'https://i.ytimg.com/vi/'+v.id+'/mqdefault.jpg'} width={120} height={68} alt="" className="w-24 sm:w-28 aspect-video object-cover rounded bg-black/5 shrink-0" onError={e=>{e.currentTarget.style.visibility='hidden';}}/><div className="min-w-0"><p className="text-xs text-muted">{v.format} · {v.publishedAt.slice(0,10)}{v.older?' · older example':''}</p><h5 className="font-bold text-sm leading-snug mt-1 line-clamp-2">{v.title} ↗</h5></div></a>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4">{[['Views',v.views],['Likes',v.likes],['Comments',v.comments]].map(([label,value])=><div key={String(label)}><b className="text-xl">{value==null?'—':n(value as number)}</b><p className="text-[10px] text-muted mt-1">{label}</p></div>)}</div>
    </article>)}</div><p className="text-[10px] text-muted mt-2">Lifetime counts on named uploads · comments measure participation, not sentiment or loyalty · — = not reported</p></div>}
    <div className="rounded-lg p-4 sm:p-5" style={{background:'#F6F1E7'}}>
      <div className="flex justify-between items-baseline gap-3"><h4 className="text-base font-black">The publishing rhythm</h4>{i.window.reliable && <span className="text-xs text-muted">{activity.activeWeeks}/{activity.totalWeeks} complete weeks active</span>}</div>
      <div className="flex items-end gap-3 h-24 mt-4" role="img" aria-label={'Monthly uploads found: '+i.months.map(m=>`${m.label} ${m.videos} videos, ${m.shorts} Shorts, ${m.audio} release audio`).join('; ')}>{i.months.map(m=><div key={m.month} className="flex-1 flex flex-col justify-end h-full min-w-0" title={`${m.month}: ${m.videos} videos, ${m.shorts} Shorts, ${m.audio} release audio${m.partial?' · partial month':''}`}><span className="text-xs font-bold mb-1">{m.videos+m.shorts+m.audio}</span><div style={{height:((m.videos+m.shorts+m.audio)/max*62)||2}} className="flex flex-col-reverse rounded-sm overflow-hidden bg-black/10"><div style={{height:(m.videos/max*62),background:'#FF4A1C'}}/><div style={{height:(m.shorts/max*62),background:'#2C25FF'}}/><div style={{height:(m.audio/max*62),background:'#8F887E'}}/></div><span className="text-[10px] text-muted mt-2">{m.label}{m.partial?'*':''}</span></div>)}</div>
      <p className="text-[10px] text-muted mt-3"><span style={{color:'#FF4A1C'}}>■ Videos</span> · <span style={{color:'#2C25FF'}}>■ Shorts</span> · <span style={{color:'#8F887E'}}>■ Release audio</span> · *Partial month{!i.window.reliable?' · Counts found; coverage is limited':''}</p>
    </div>
    {!!i.next.length && <div><h4 className="text-base font-black mb-3">What to do with this</h4><div className="grid sm:grid-cols-2 gap-4">{i.next.map((p,index)=><article key={p.title} className="border-l-2 border-signal pl-4"><p className="text-[10px] font-bold text-signal uppercase tracking-wide">0{index+1}</p><h5 className="font-bold text-sm mt-1">{p.title}</h5><p className="text-xs text-muted leading-relaxed mt-2">{p.evidence}</p><p className="text-sm leading-relaxed mt-2">{p.action}</p></article>)}</div></div>}
    {i.context && <p className="text-xs font-semibold border-t border-line pt-4">{i.context}</p>}
    <details className="border-t border-line pt-4 text-xs text-muted"><summary className="font-bold cursor-pointer">Engagement, growth & evidence notes</summary><div className="space-y-3 mt-4">
      <p>{i.window.note}</p><p>{i.engagement.note}</p>
      <p><b className="text-ink">{rate(i.engagement.rate)}</b> weighted interaction rate · both counters available on {i.engagement.measuredUploads}/{activity.uploads} uploads · {n(i.engagement.views)} views in that denominator</p>
      {!!i.formats.length && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="py-2 pr-3">Format</th><th className="pr-3">Uploads</th><th className="pr-3">Views</th><th className="pr-3">Rate</th><th>Measured uploads</th></tr></thead><tbody>{i.formats.map(f=><tr key={f.key} className="border-t border-line"><td className="py-2 pr-3">{f.name}</td><td>{f.uploads}</td><td>{n(f.views)}</td><td>{rate(f.rate)}</td><td>{f.measuredUploads}/{f.uploads}</td></tr>)}</tbody></table></div>}
      <p>{i.movement??'A reliable recent channel-growth comparison is not available. No growth or subscriber attribution is inferred.'}</p>
      <p>Source: cached YouTube Data API uploads and channel history. Linked videos returned in the artist playlist are included; external collaborations are excluded. Reviewed release sources are included where stated above; this is not an exhaustive or automatically discovered Releases/Topic inventory. Third-party appearances are not fully verified. A scanned playlist is not a complete inventory of every artist release on YouTube.</p>
    </div></details>
  </section>;
}
