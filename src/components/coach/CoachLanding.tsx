'use client';

/* ═══════════════════════════════════════════════════════════════════════
   COACH LANDING

   Header · Do next · one campaign card · rollout. Nothing else.

   Reuses the shared primitives (Card, Kpi, Badge, Eyebrow, SectionHead)
   so this reads as the same product as the campaign board and the
   watcher. `Kpi` is used deliberately: it refuses to render without a
   `period`, which is the guarantee that no figure on this page appears
   without the window it was measured over.

   Decisions persist per campaign and refresh the shared rollout after saving.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Badge, Card, Eyebrow, Kpi } from '@/components/ui';
import { color } from '@/lib/design/tokens';
import { compact, exact, shortDate, type LandingAction, type LandingModel, type ReleaseAsset, type UploadRef } from '@/lib/coach/landingModel';

const TONE = {
  ok: { fg: color.positive, bg: color.positiveSoft },
  warn: { fg: '#9A6324', bg: '#FAF0E2' },
  ghost: { fg: color.inkMuted, bg: '#F4F2EC' },
} as const;

function Thumb({ v, className = '' }: { v: UploadRef; className?: string }) {
  return (
    <span className={`block relative overflow-hidden rounded bg-raised ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Image
        fill
        sizes="(max-width: 640px) 148px, 160px"
        src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </span>
  );
}

function AssetRow({ title, items, shape }: { title: string; items: UploadRef[]; shape: 'long' | 'short' }) {
  const [all, setAll] = useState(false);
  const limit = shape === 'long' ? 3 : 6;
  const shown = all ? items : items.slice(0, limit);
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="flex items-center gap-2"><span className="w-1 h-3 rounded-sm" style={{background:shape==='short'?'#C77A16':'#2C6BFF'}} /><Eyebrow>{title}</Eyebrow></span>
        <span className="text-[11px] text-faint tabular-nums">
          {items.length}
          {items.length > limit && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="ml-2 font-semibold text-electric hover:underline"
            >
              {all ? 'Show fewer' : 'View all'}
            </button>
          )}
        </span>
      </div>
      <ul className={shape === 'long' ? `grid ${shown.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3 list-none m-0 p-0` : 'grid grid-cols-3 sm:grid-cols-6 gap-2 list-none m-0 p-0'}>
        {shown.map(v => (
          <li key={v.id} className="min-w-0">
            <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="no-underline block">
              <Thumb v={v} className={shape === 'long' ? 'aspect-video' : 'aspect-[9/16]'} />
              <span className="block text-[11px] font-bold tabular-nums text-ink mt-1.5">
                {v.views == null ? '—' : compact(v.views)} views
              </span>
              <span className="block text-[10.5px] text-muted leading-tight line-clamp-2">
                {v.format ?? (shape === 'short' ? 'Short' : 'Video')} · {shortDate(v.publishedAt)}
              </span>
              <span className="block text-[10.5px] text-muted leading-tight line-clamp-2 mt-0.5">{shape === 'long' ? v.title : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionCard({ action, slug, readOnly = false }: { action: LandingAction; slug?: string; readOnly?: boolean }) {
  const router = useRouter();
  const [ticked, setTicked] = useState(action.state === 'agreed');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'error'>('idle');

  const [date, setDate] = useState(action.dueISO ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { setTicked(action.state === 'agreed'); setDate(action.dueISO ?? ''); }, [action.state, action.dueISO]);

  /* One write path for both controls. The route merges per field, so a
     date change never clears someone else's agreed status and a status
     change never clears a date. */
  async function save(patch: { status?: string; targetDate?: string }) {
    if (!slug) { setSaving('error'); return; }
    setSaving('saving');
    try {
      const r = await fetch('/api/coach/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, actionId: action.id, ...patch }),
      });
      if (!r.ok) { setTicked(action.state === 'agreed'); setDate(action.dueISO ?? ''); setSaving('error'); return; }
      setSaving('idle');
      router.refresh();
    } catch { setTicked(action.state === 'agreed'); setDate(action.dueISO ?? ''); setSaving('error'); }
  }

  function toggle(nextValue: boolean) {
    setTicked(nextValue);
    void save({ status: nextValue ? 'planned' : 'suggested' });
  }
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {action.stage && <Badge fg={action.stage==='Live now'||action.stage==='Album week'?color.positive:'#2458CC'} bg={action.stage==='Live now'||action.stage==='Album week'?color.positiveSoft:'#EDF3FF'}>{action.stage}</Badge>}
          <Eyebrow>{action.context}</Eyebrow>
        </div>
        {readOnly ? <span className="text-[11px] font-semibold text-secondary px-2 py-[3px] rounded border border-line">{date ? `by ${new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : action.due}</span> : editing ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={e => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get('targetDate') ?? '');
            if (!value) return;
            setDate(value); setEditing(false); void save({targetDate:value});
          }}>
            <input type="date" name="targetDate" defaultValue={date} required autoFocus
              className="text-[12px] font-semibold px-2 py-1 rounded border border-line-strong bg-surface"
              aria-label="Target date" />
            <button type="submit" className="text-[12px] font-semibold text-electric">Save date</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-muted">Cancel</button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Change the target date"
            className="text-[11px] font-semibold text-secondary px-2 py-[3px] rounded border border-line whitespace-nowrap hover:text-electric"
          >
            {date ? `by ${new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : action.due}
          </button>
        )}
      </div>

      <div className="flex-1">
        <h3 className="text-[18px] sm:text-[20px] font-extrabold text-ink leading-snug m-0">{action.label}</h3>
        {action.window && <p className="text-[13px] font-semibold text-electric m-0 mt-1.5">{action.window}</p>}
        <p className="text-meta text-secondary leading-relaxed m-0 mt-2">{action.reason}</p>
        {action.observation && <p className="text-[11.5px] text-muted leading-snug m-0 mt-3">{action.observation}</p>}
      </div>

      {/* Native disclosure: keyboard-operable and open-able without JS. */}
      <details className="group mt-3 pt-3 border-t border-line-faint">
        <summary className="flex items-center gap-4 cursor-pointer list-none marker:hidden">
          <span
            role={readOnly ? undefined : 'checkbox'}
            aria-checked={readOnly ? undefined : ticked}
            tabIndex={readOnly ? undefined : 0}
            onClick={e => { if(readOnly) return; e.preventDefault(); e.stopPropagation(); void toggle(!ticked); }}
            onKeyDown={e => { if (readOnly) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void toggle(!ticked); } }}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-secondary select-none"
          >
            <span
              aria-hidden
              className="w-4 h-4 rounded-[4px] border-[1.5px] border-line-strong bg-surface grid place-content-center text-[10px] font-black text-white"
              style={ticked ? { background: color.positive, borderColor: color.positive } : undefined}
            >{ticked ? '✓' : ''}</span>
            <span className={ticked ? 'text-positive' : ''}>{ticked ? 'In plan' : 'Add to plan'}</span>
            {saving === 'saving' && <span className="text-[11px] text-faint font-normal">saving…</span>}
            {saving === 'error' && <span className="text-[11px] text-negative font-normal">not saved</span>}
          </span>
          <span className="ml-auto text-[12.5px] font-semibold text-electric group-open:hidden">Why this?</span>
          <span className="ml-auto text-[12.5px] font-semibold text-electric hidden group-open:inline">Hide details</span>
        </summary>
        <div className="mt-2.5 p-3 bg-raised rounded-control text-[12.5px] text-secondary leading-relaxed">
          {action.evidence.map(e => (
            <p key={e.heading} className="m-0 mb-1.5 last:mb-0">
              <strong className="text-ink">{e.heading}</strong> {e.body}{e.href && <> <a href={e.href} target="_blank" rel="noopener noreferrer" className="text-electric underline">Read YouTube’s guide ↗</a></>}
            </p>
          ))}
        </div>
      </details>
    </Card>
  );
}

const STATUS_MARK: Record<ReleaseAsset['status'], { icon: string; cls: string }> = {
  published: { icon: '✓', cls: 'text-positive' },
  agreed: { icon: '◆', cls: 'text-longform' },
  suggested: { icon: '○', cls: 'text-faint' },
};

export default function CoachLanding({ model, slug, classicHref, timelineEditor, readOnly = false }: { model: LandingModel; slug?: string; classicHref?: string; timelineEditor?: ReactNode; readOnly?: boolean }) {
  const visualPilot = slug === 'chvrches-chvrches-campaign';
  const uploads = [...model.assets.long, ...model.assets.shorts].filter(u => Number.isFinite(Date.parse(u.publishedAt))).sort((a,b) => Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
  const last = uploads.at(-1);
  const first = uploads[0];
  const rhythm = Array.from({length: 12}, (_,i) => {
    if (!first || !last) return {long:0,short:0};
    const start = Date.parse(first.publishedAt), span = Math.max(1,Date.parse(last.publishedAt)-start+1);
    const slot = uploads.filter(u => Math.min(11,Math.floor((Date.parse(u.publishedAt)-start)/span*12))===i);
    return {long:slot.filter(u=>u.shape==='long').length,short:slot.filter(u=>u.shape==='short').length};
  });
  const maxRhythm = Math.max(1,...rhythm.map(r=>r.long+r.short));
  const gaps = uploads.slice(1).map((u,i)=>({days:Math.round((Date.parse(u.publishedAt)-Date.parse(uploads[i].publishedAt))/86400000),from:uploads[i],to:u})).filter(g=>g.days>14);
  const largestGap = gaps.sort((a,b)=>b.days-a.days)[0];
  // CHVRCHES-only editorial pilot: use the same observed assets and saved rollout plan.
  const videoLeaders = [...model.assets.long].filter(v => v.views !== null && v.views > 0).sort((a,b)=>(b.views??0)-(a.views??0));
  const leadingVideo = videoLeaders[0] ?? null;
  const videoMedian = videoLeaders.length >= 3 ? [...videoLeaders].map(v=>v.views??0).sort((a,b)=>a-b)[Math.floor((videoLeaders.length-1)/2)] : null;
  const notableLeader = leadingVideo && videoMedian !== null && videoMedian > 0 && (leadingVideo.views??0) >= videoMedian * 2 ? leadingVideo : null;
  const rolloutMoments = model.rollout.filter(r=>r.assets.length>0).slice(0,5);
  const rolloutCounts = {published:model.rollout.flatMap(r=>r.assets).filter(a=>a.status==='published').length, agreed:model.rollout.flatMap(r=>r.assets).filter(a=>a.status==='agreed').length,suggested:model.rollout.flatMap(r=>r.assets).filter(a=>a.status==='suggested').length};
  return (
    <div className="max-w-[1060px] mx-auto px-5 pb-16">

      <nav aria-label="Coach navigation" className="flex flex-wrap items-center gap-5 pt-5 pb-1 text-meta font-semibold">
        <a href={readOnly ? "/youtube-uk" : "/growth"} className="text-secondary no-underline hover:text-electric hover:underline">← Back to Watcher</a>
        <a href={readOnly ? "/youtube-uk/coach" : "/coach"} className="text-muted no-underline hover:text-electric hover:underline">All campaigns</a>
      </nav>

      {/* 1 · header */}
      <header className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-1">
        <div className="min-w-0">
          <h1 className="text-[32px] sm:text-[40px] font-black tracking-tight text-ink m-0 leading-none">{model.artist}</h1>
          <p className="text-body font-semibold text-secondary m-0 mt-2 leading-snug">{model.stageLine}</p>
        </div>
        <Badge fg={TONE.ok.fg} bg={TONE.ok.bg}>{model.completed?'Rollout complete':model.project}</Badge>
      </header>

      {model.nextMoment && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-4 py-3">
        <Eyebrow>{model.nextMoment.kind==='single'?'Next single':model.nextMoment.kind==='album'?'Next album':'Next release'}</Eyebrow><strong className="text-body text-ink">{model.nextMoment.name}</strong>
        <span className="font-extrabold text-body text-electric">{shortDate(model.nextMoment.date)}</span>
      </div>}

      {/* 2 · do next */}
      {!model.completed && <><Eyebrow className="mt-7 mb-2.5">Do next</Eyebrow>
      <div className="grid gap-3 md:grid-cols-2">
        {model.actions.map(a => <ActionCard key={a.id} action={a} slug={slug} readOnly={readOnly} />)}
        {!model.actions.length && <p className="text-meta text-muted">No immediate action identified. Review the rollout below.</p>}
      </div></>}

      {/* 3 · one campaign card */}
      <Eyebrow className="mt-7 mb-2.5">Campaign · {model.windowLabel}</Eyebrow>
      <Card pad={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-line-faint">
          {model.figures.map(f => (
            <div key={f.label} className="p-4">
              <Kpi value={f.value} label={f.label} period={f.period} tone={f.tone==='good'?color.positive:f.tone==='behind'?color.negative:undefined} />
            </div>
          ))}
        </div>

        {visualPilot && <section className="border-t border-line-faint bg-[#15191d] text-white p-5 sm:p-7" aria-label="CHVRCHES campaign delivery map">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[.2em] text-[#aebac5] font-bold m-0">Campaign delivery map</p><h2 className="text-[27px] sm:text-[34px] leading-tight font-black tracking-tight m-0 mt-1">What needs to go live next?</h2><p className="text-[12px] text-[#b9c5ce] m-0 mt-2">One view of the asset plan, publishing rhythm and format coverage.</p></div>
            <div className="text-right"><strong className="text-[36px] leading-none font-black tabular-nums">{rolloutCounts.agreed+rolloutCounts.suggested}</strong><span className="block text-[11px] text-[#bdc7d0] mt-1">assets still in the rollout plan</span></div>
          </div>
          {(() => {
            const upcoming=model.rollout.flatMap(r=>r.assets.filter(a=>a.status!=='published').map(a=>({...a,moment:r.name,date:r.dateLabel,stage:r.stage})));
            const next=upcoming.find(a=>a.status==='agreed')??upcoming[0];
            const framework=model.framework;
            const formats=framework&&framework.singles>0?[
              {name:'Release video',done:framework.heroes,target:framework.singles,shade:'#61b9ed'},
              {name:'Follow-up video',done:framework.followUps,target:framework.singles,shade:'#a4b9ff'},
              {name:'Release Shorts',done:framework.shorts,target:framework.shortsTarget,shade:'#f6b64b'},
            ]:[];
            return <>
              <div className="grid md:grid-cols-[1.2fr_1fr] gap-3 mt-6">
                <div className="rounded-xl bg-[#273138] border border-white/10 p-5">
                  <p className="text-[10px] uppercase tracking-[.16em] font-bold text-[#a9b8c5] m-0">Next asset to deliver</p>
                  <strong className="block text-[24px] leading-tight mt-3">{next?.label??'No outstanding planned asset'}</strong>
                  <p className="text-[13px] text-[#d2dbe2] mt-2 mb-0">{next?next.moment:'Review the rollout for the next campaign moment'}</p>
                  <div className="flex flex-wrap gap-2 mt-5"><span className="rounded-md bg-white/10 px-3 py-2 text-[12px] font-bold">{next?.date??'Date not set'}</span><span className="rounded-md bg-[#3c4b57] px-3 py-2 text-[12px] font-bold">{next?.status==='agreed'?'Agreed with team':next?'Suggested · confirm with team':'No action queued'}</span></div>
                  <p className="text-[11px] text-[#a9b8c5] mt-3 mb-0">Date is the saved release moment, not a confirmed asset deadline.</p>
                </div>
                <div className="rounded-xl border border-white/15 p-5">
                  <p className="text-[10px] uppercase tracking-[.16em] font-bold text-[#a9b8c5] m-0">Next 28 days · working requirement</p>
                  <div className="flex gap-6 mt-4">
                    <div><strong className="text-[34px] leading-none font-black tabular-nums">{framework?.next28Videos??'—'}</strong><span className="block text-[11px] mt-2 text-[#bdc7d0]">video moments</span></div>
                    <div><strong className="text-[34px] leading-none font-black tabular-nums">{framework?.next28Shorts??'—'}</strong><span className="block text-[11px] mt-2 text-[#bdc7d0]">minimum Shorts</span></div>
                  </div>
                  <p className="text-[12px] text-[#c8d2da] mt-5 mb-0">{framework?framework.upcomingMoments+' upcoming release moments · baseline of two Shorts per week, increased for releases.':'Add release dates to calculate the upcoming asset requirement.'}</p>
                </div>
              </div>
              {formats.length>0&&<div className="mt-6">
                <div className="flex flex-wrap justify-between items-baseline gap-2"><strong className="text-[16px]">Multi-format coverage</strong><span className="text-[11px] text-[#a9b8c5]">Observed / working campaign target</span></div>
                <div className="grid sm:grid-cols-3 gap-4 mt-3">{formats.map(f=><div key={f.name}><div className="flex items-baseline justify-between gap-2"><span className="text-[12px] font-semibold">{f.name}</span><span className="text-[15px] font-black tabular-nums">{f.done} / {f.target}</span></div><div className="h-3 bg-white/10 rounded-full overflow-hidden mt-2"><div className="h-full rounded-full" style={{background:f.shade,width:`${Math.min(100,f.target?f.done/f.target*100:0)}%`}} /></div><p className="text-[11px] text-[#b7c5ce] mt-1 mb-0">{Math.max(0,f.target-f.done)} to target</p></div>)}</div>
              </div>}
              <div className="mt-6 border-t border-white/15 pt-5">
                <div className="flex flex-wrap justify-between gap-2 items-baseline"><strong className="text-[16px]">Publishing cadence</strong><span className="text-[11px] text-[#a9b8c5]">{uploads.length} observed uploads · {model.windowLabel}</span></div>
                <div className="flex items-end gap-1 h-24 border-b border-white/20 mt-4 pb-1" role="img" aria-label="Twelve equal periods showing published long-form videos and Shorts">
                  {rhythm.map((bucket,i)=><div key={i} className="flex-1 h-full flex flex-col justify-end gap-px"><div className="bg-[#61b9ed] rounded-t-sm" style={{height:`${bucket.long/maxRhythm*82}px`}}/><div className="bg-[#f6b64b] rounded-sm" style={{height:`${bucket.short/maxRhythm*82}px`}}/></div>)}
                </div>
                <div className="flex flex-wrap justify-between gap-3 text-[11px] text-[#b9c5ce] mt-2"><span>{first?shortDate(first.publishedAt):'No dated uploads'} → {last?shortDate(last.publishedAt):'—'}</span><span><span className="text-[#61b9ed]">■</span> Videos &nbsp; <span className="text-[#f6b64b]">■</span> Shorts</span></div>
                <p className="text-[12px] text-[#d3dbe1] mt-3 mb-0">{largestGap?`Longest observed gap: ${largestGap.days} days. Check the planned follow-up and label-channel assets before treating it as inactivity.`:uploads.length>1?'No observed gap over 14 days in the available uploads.':'Insufficient dated uploads to assess cadence.'}</p>
              </div>
              <div className="mt-6 border-t border-white/15 pt-5">
                <strong className="text-[16px]">Release → asset sequence</strong>
                <div className="mt-3 grid gap-2">{model.rollout.filter(r=>r.assets.length>0).slice(0,6).map((moment,i)=><div key={i} className="grid grid-cols-[90px_1fr] sm:grid-cols-[110px_1fr] gap-3 items-center"><span className="text-[11px] text-[#bdc7d0]">{moment.dateLabel}</span><div className="min-w-0 rounded-lg bg-white/[.07] px-3 py-2"><strong className="block text-[12px] truncate">{moment.name}</strong><div className="flex flex-wrap gap-1 mt-2">{moment.assets.map((a,j)=><span key={j} title={a.label} className="text-[10px] rounded px-2 py-1 font-bold" style={{background:a.status==='published'?'#235c47':a.status==='agreed'?'#314c84':'#55472c',color:'#fff'}}>{a.status==='published'?'✓ ':a.status==='agreed'?'◆ ':'○ '}{a.format??a.label}</span>)}</div></div></div>)}</div>
                <p className="text-[10px] text-[#a9b8c5] mt-3 mb-0">✓ Published · ◆ Agreed · ○ Suggested. Targets are planning guidance, not YouTube quotas. Upload evidence may exclude other official or label channels.</p>
              </div>
            </>;
          })()}
        </section>}
                {!visualPilot && model.framework && model.framework.singles>0 && <div className="border-t border-line-faint p-4">
          <div className="flex flex-wrap justify-between gap-2 items-baseline mb-3"><Eyebrow>Rollout guide · {model.framework.singles} singles</Eyebrow><span className="text-micro text-muted">Status against guide due today</span></div>
          <div className="grid grid-cols-3 gap-3">
            {[{label:'Release videos',value:model.framework.heroes,target:model.framework.singles,status:model.framework.assessment.heroes},
              {label:'Follow-up videos',value:model.framework.followUps,target:model.framework.singles,status:model.framework.assessment.followUps},
              {label:'Release-linked Shorts',value:model.framework.shorts,target:model.framework.shortsTarget,status:model.framework.assessment.shorts}].map(f=><div key={f.label}>
                <p className="m-0 text-[24px] font-extrabold tabular-nums" style={{color:f.status.tone==='good'?color.positive:f.status.tone==='behind'?color.negative:color.ink}}>{f.value}<span className="text-muted font-normal"> / {f.target}</span></p>
                <span className="text-meta font-semibold text-secondary">{f.label}</span>
                <div className="h-1 mt-2 rounded bg-raised overflow-hidden"><div className="h-full rounded" style={{background:f.status.tone==='good'?color.positive:f.status.tone==='behind'?color.negative:'#B7B1A8',width:`${Math.min(100,f.target?f.value/f.target*100:0)}%`}} /></div>
                <p className="text-micro text-muted m-0 mt-1">{f.status.label}</p>
              </div>)}
          </div>
          <p className="m-0 mt-3 text-meta font-semibold text-secondary leading-relaxed">
            {model.framework.assessment.followUps.tone === 'behind' || model.framework.assessment.shorts.tone === 'behind'
              ? 'Possible multiformat support gap: the checked campaign uploads have fewer follow-up videos or release-linked Shorts than the rollout guide. Confirm other official and label channels before commissioning.'
              : 'Multiformat support is tracking against the rollout guide in the checked uploads.'}
          </p>
          <p className="m-0 mt-3 text-meta font-semibold text-ink">Next 28 days: {model.framework.upcomingMoments} release moment{model.framework.upcomingMoments===1?'':'s'}{(model.framework.next28Videos??0)>0?` · ${model.framework.next28Videos} video moments`:''} · at least {model.framework.next28Shorts} Shorts</p>
          <details className="mt-2 text-micro text-muted"><summary className="cursor-pointer text-electric font-semibold">How the guide works</summary><p className="m-0 mt-2">Per single: one release video, one distinct follow-up around days 7–14, and three Shorts across teaser, launch and follow-up. Totals include future singles; colours assess only support due by today. Cadence uses a working minimum of two Shorts per week, or more when dated release moments call for it. A saved team target takes precedence. This baseline is a planning choice, not a YouTube requirement. The next 28 days includes launch and follow-up video moments plus ongoing Shorts each week. Release-linked Shorts fill those weekly slots; extra release moments raise the weekly count. Actual upload dates are used where available. These are starting suggestions, not YouTube quotas. Only track-matched public uploads count toward the bars.</p></details>
        </div>}

        <div className="border-t border-line-faint px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-micro text-muted">
          <span><strong className="text-secondary">Campaign evidence:</strong> {model.assets.long.length} videos · {model.assets.shorts.length} Shorts observed in the selected window</span>
          <span>Partial coverage · other official or label channels may hold additional assets</span>
        </div>
        <div className="border-t border-line-faint grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="p-4 flex flex-col sm:flex-row gap-3.5">
            {model.latest && (
              <>
                <a href={`https://youtube.com/watch?v=${model.latest.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 no-underline">
                  <Thumb v={model.latest} className="w-[148px] aspect-video" />
                </a>
                <div className="min-w-0">
                  <Badge fg="#2458CC" bg="#EDF3FF">{model.latest.format ?? 'Video'} · Latest upload</Badge>
                  <h3 className="text-body font-extrabold text-ink m-0 mt-1.5 leading-snug">{model.latest.title}</h3>
                  <p className="text-meta font-semibold text-ink m-0 mt-1">
                    Uploaded {shortDate(model.latest.publishedAt)} · {model.latest.views == null ? '—' : exact(model.latest.views)} views
                    {model.latest.likes != null && ` · ${exact(model.latest.likes)} likes`}
                  </p>
                  {model.launchComparison ? <div className="mt-3 pt-2 border-t border-line-faint">
                    <Eyebrow>Launch vs {model.launchComparison.priorTrack}</Eyebrow>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-1.5">
                      {model.launchComparison.ageDays>1&&model.launchComparison.firstDayChangePct!==null&&<div>
                        <span className="block text-micro font-semibold text-secondary">Day 1</span>
                        <strong className="text-[24px] tabular-nums leading-tight" style={{color:model.launchComparison.firstDayChangePct>0?color.positive:model.launchComparison.firstDayChangePct<0?color.negative:color.ink}}>{model.launchComparison.firstDayChangePct>0?'+':''}{model.launchComparison.firstDayChangePct}%</strong>
                      </div>}
                      <div>
                        <span className="block text-micro font-semibold text-secondary">Day {model.launchComparison.ageDays}{model.launchComparison.partial?' · so far':''}</span>
                        <strong className="text-[24px] tabular-nums leading-tight" style={{color:model.launchComparison.changePct>0?color.positive:model.launchComparison.changePct<0?color.negative:color.ink}}>{model.launchComparison.changePct>0?'+':''}{model.launchComparison.changePct}%</strong>
                      </div>
                    </div>
                    <p className="text-[12px] font-semibold text-secondary m-0 mt-1">{compact(model.launchComparison.currentViews)} vs {compact(model.launchComparison.priorViews)} views at day {model.launchComparison.ageDays}</p>
                    {model.launchComparison.partial&&<p className="text-micro text-muted m-0 mt-0.5">Today’s reading is still updating.</p>}
                  </div> : model.paceLine ? <p className="text-[12.5px] text-secondary leading-relaxed m-0 mt-2">{model.paceLine}</p> : null}
                </div>
              </>
            )}
          </div>

          {model.fan && (
            <div className="p-4 border-t md:border-t-0 md:border-l border-line-faint">
              <Eyebrow>Fan response</Eyebrow>
              <p className="text-body font-extrabold text-ink m-0 mt-1 leading-snug">
                {model.fan.tone}{model.fan.theme ? ` · ${model.fan.theme}` : ''}
              </p>
              {!!model.fan.quotes?.length && <div className="mt-3 space-y-3">
                {model.fan.quotes.map(q=><blockquote key={q.videoId+q.text} className="m-0 pl-3 border-l-2 border-line-strong">
                  <p className="text-[16px] font-semibold text-ink leading-snug m-0">“{q.text}”</p>
                  <a href={`https://www.youtube.com/watch?v=${q.videoId}`} target="_blank" rel="noopener noreferrer" className="block mt-1 text-micro text-muted hover:text-electric">{compact(q.likes)} likes · {q.source??'Source video'} ↗</a>
                </blockquote>)}
              </div>}
              <p className="text-micro text-muted m-0 mt-3 leading-relaxed">
                Sampled from {exact(model.fan.commentsOnAsset)} comments across {model.fan.assetLabel},
                read {shortDate(model.fan.at)}. A sample, not the view of the audience.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line-faint p-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <AssetRow title={model.windowLabel === 'window not set' ? 'Channel videos · reference' : 'Campaign videos'} items={model.assets.long} shape="long" />
          <AssetRow title={model.windowLabel === 'window not set' ? 'Channel Shorts · reference' : 'Campaign Shorts'} items={model.assets.shorts} shape="short" />
        </div>
      </Card>

      {/* 4 · rollout */}
      <Eyebrow className="mt-7 mb-2.5">{model.completed?'Release history':'Rollout'}</Eyebrow>
      {!model.completed && <p className="flex flex-wrap gap-4 text-micro text-muted m-0 mb-3">
        <span><strong className="text-positive">✓</strong> Published on the channel</span>
        <span><strong className="text-longform">◆</strong> Agreed by the team</span>
        <span><strong className="text-faint">○</strong> Suggested</span>
        <span>— Format not identified</span>
      </p>}

      <ol className="relative list-none m-0 p-0 pl-6 before:content-[''] before:absolute before:left-[5px] before:top-3 before:bottom-3 before:w-[2px] before:bg-line">
        {model.rollout.map(r => (
          <li key={r.name} className="relative mb-3">
            <span
              className="absolute -left-[21px] top-5 w-3 h-3 rounded-full border-[2.5px] bg-surface"
              style={{
                borderColor: r.stage === 'shipped' ? color.positive : r.stage === 'live' ? color.signal : '#D9D2C6',
                background: r.stage === 'shipped' ? color.positive : r.stage === 'live' ? color.signal : '#fff',
              }}
              aria-hidden
            />
            <Card className={r.stage === 'live' ? 'border-line-strong' : ''}>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <Eyebrow>{r.dateLabel}</Eyebrow>
                <h3 className="text-h4 font-extrabold text-ink m-0">{r.name}</h3>
                {r.badge && <Badge fg={TONE[r.badge.tone].fg} bg={TONE[r.badge.tone].bg}>{r.badge.label}</Badge>}
              </div>

              {model.coverage?.find(c=>c.name===r.name) && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-micro" aria-label={`${r.name} format status`}>
                {model.coverage.find(c=>c.name===r.name)!.cells.map(c=><span key={c.label} className={c.count?'text-positive font-semibold':c.planned?'text-electric font-semibold':c.reported?'text-secondary font-semibold':'text-muted'}>{c.label} {c.count?`✓${c.count>1?' '+c.count:''}`:c.planned?'◆':c.reported?'· promoted':'—'}</span>)}
              </div>}
              {r.holding ? (
                <p className="text-meta text-muted m-0 mt-2.5">{r.holding}</p>
              ) : (
                <ul className="mt-3 list-none m-0 p-0 rounded-control overflow-hidden border border-line-faint divide-y divide-line-faint">
                  {r.assets.map(a => (
                    <li
                      key={a.label}
                      className={`flex gap-2.5 items-center px-3 py-2 text-meta ${a.status === 'suggested' ? 'bg-raised/40' : 'bg-surface'}`}
                    >
                      <span className={`w-4 text-center font-extrabold shrink-0 ${STATUS_MARK[a.status].cls}`} aria-hidden>
                        {STATUS_MARK[a.status].icon}
                      </span>
                      <span className="flex-1 min-w-0">
                        {a.videoId ? (
                          <a href={`https://youtube.com/watch?v=${a.videoId}`} target="_blank" rel="noopener noreferrer" className="no-underline text-ink font-semibold hover:text-electric">
                            {a.label}
                          </a>
                        ) : <span className="text-ink font-semibold">{a.label}</span>}
                        {a.format && <small className="block text-micro font-semibold text-secondary mt-0.5">{a.format}</small>}
                        {a.note && <small className="block text-micro text-muted font-normal">{a.note}</small>}
                      </span>
                      {a.meta && <span className="text-meta font-semibold text-ink tabular-nums whitespace-nowrap">{a.meta}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {r.opportunity && <div className="mt-3 rounded-control bg-raised p-3 text-meta text-secondary"><span className="block text-micro font-bold text-ink mb-1">Opportunity to revisit</span>{r.opportunity}</div>}
            </Card>
          </li>
        ))}
      </ol>

      {!readOnly && timelineEditor}

      <div className="mt-7 pt-3 border-t border-line text-micro text-muted leading-relaxed">
        {model.caveats.map(c => <p key={c} className="m-0 mb-1.5 last:mb-0">{c}</p>)}
        {!readOnly && classicHref && (
          <p className="m-0 mt-2">
            <a href={classicHref} className="text-electric font-semibold no-underline hover:underline">
              Open the previous timeline view
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
