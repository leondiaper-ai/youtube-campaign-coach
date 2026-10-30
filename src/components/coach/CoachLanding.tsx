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

function ShortsProgress({data,slug}:{data:NonNullable<LandingModel['shortsProgress']>;slug?:string}) {
  const router=useRouter();
  const [editing,setEditing]=useState(false);
  const [error,setError]=useState(false);
  const [saving,setSaving]=useState(false);
  const target=data.target;
  async function save(value:number|null) {
    setSaving(true); setError(false);
    try {
      const r=await fetch('/api/coach/decisions',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({slug,actionId:'campaign:shorts-target',shortsWeeklyTarget:value})});
      if(!r.ok) throw new Error();
      setEditing(false); router.refresh();
    } catch {setError(true);} finally {setSaving(false);}
  }
  return <div className="border-t border-line-faint px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
    <div><Eyebrow>Shorts · last 28 days</Eyebrow><p className="m-0 mt-1 text-body font-bold text-ink">{data.count}{target!==null?` / ${target*4}`:''} published <span className="font-normal text-muted">· {data.weekly} / week</span></p></div>
    <div className="text-meta text-secondary">{target!==null?<><strong className="text-ink">Team target: {target} / week</strong><span className="block">{data.weekly<target?`${Math.max(0,target*4-data.count)} more Shorts to reach 4-week target`:'At or above target'} · rolling 4 weeks</span></>:<span>Set a weekly trial target to track pace.</span>}</div>
    {editing?<form className="flex items-center gap-2" onSubmit={e=>{e.preventDefault();void save(Number(new FormData(e.currentTarget).get('weekly')));}}>
      <input className="w-16 border border-line rounded p-1" type="number" name="weekly" aria-label="Weekly Shorts target" min="1" max="14" required defaultValue={target??Math.max(1,Math.ceil(data.weekly))}/>
      <button disabled={saving} className="text-electric text-meta font-semibold">{saving?'Saving…':'Save target'}</button>
      <button type="button" onClick={()=>setEditing(false)} className="text-meta text-muted">Cancel</button>
      {target!==null&&<button type="button" onClick={()=>void save(null)} className="text-meta text-muted">Clear</button>}
    </form>:<button onClick={()=>setEditing(true)} className="ml-auto text-meta text-electric font-semibold">{target!==null?'Edit target':'Set target'}</button>}
    {error&&<span role="alert" className="text-meta text-negative">Target not saved. Try again.</span>}
  </div>;
}

function ActionCard({ action, slug }: { action: LandingAction; slug?: string }) {
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
      <div className="flex items-center gap-2.5 mb-2">
        {editing ? (
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
            className="text-[12px] font-extrabold px-2 py-[3px] rounded border whitespace-nowrap"
            style={action.dueTone === 'soon'
              ? { color: '#8C2D11', background: '#FFE9E2', borderColor: '#F7CFC2' }
              : { color: '#6F4617', background: '#FAF0E2', borderColor: '#EEDFC6' }}
          >
            {date ? `by ${new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : action.due}
          </button>
        )}
        <Eyebrow>{action.context}</Eyebrow>
      </div>

      {action.window && <p className="text-[18px] font-extrabold text-electric m-0 mb-2">{action.window}</p>}
      {action.observation && <p className="text-[13px] font-semibold text-ink bg-raised rounded-control px-2.5 py-2 m-0 mb-2.5">{action.observation}</p>}
      <h3 className="text-h4 font-extrabold text-ink leading-snug m-0 mb-1.5">{action.label}</h3>
      <p className="text-meta text-secondary leading-relaxed m-0">{action.reason}</p>

      {/* Native disclosure: keyboard-operable and open-able without JS. */}
      <details className="group mt-3 pt-3 border-t border-line-faint">
        <summary className="flex items-center gap-4 cursor-pointer list-none marker:hidden">
          <span
            role="checkbox"
            aria-checked={ticked}
            tabIndex={0}
            onClick={e => { e.preventDefault(); e.stopPropagation(); void toggle(!ticked); }}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void toggle(!ticked); } }}
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

export default function CoachLanding({ model, slug, classicHref, timelineEditor }: { model: LandingModel; slug?: string; classicHref?: string; timelineEditor?: ReactNode }) {
  return (
    <div className="max-w-[1060px] mx-auto px-5 pb-16">

      {/* 1 · header */}
      <header className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-1">
        <div className="min-w-0">
          <h1 className="text-[32px] sm:text-[40px] font-black tracking-tight text-ink m-0 leading-none">{model.artist}</h1>
          <p className="text-body font-semibold text-secondary m-0 mt-2 leading-snug">{model.stageLine}</p>
        </div>
        <Badge fg={TONE.ok.fg} bg={TONE.ok.bg}>{model.project}</Badge>
      </header>

      {model.nextMoment && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-4 py-3">
        <Eyebrow>Next release</Eyebrow><strong className="text-body text-ink">{model.nextMoment.name}</strong>
        <span className="font-extrabold text-body text-electric">{shortDate(model.nextMoment.date)}</span>
      </div>}

      {/* 2 · do next */}
      <Eyebrow className="mt-7 mb-2.5">Do next</Eyebrow>
      <div className="grid gap-3 md:grid-cols-2">
        {model.actions.map(a => <ActionCard key={a.id} action={a} slug={slug} />)}
        {!model.actions.length && <p className="text-meta text-muted">No immediate action identified. Review the rollout below.</p>}
      </div>

      {/* 3 · one campaign card */}
      <Eyebrow className="mt-7 mb-2.5">Campaign · {model.windowLabel}</Eyebrow>
      <Card pad={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-line-faint">
          {model.figures.map(f => (
            <div key={f.label} className="p-4">
              <Kpi value={f.value} label={f.label} period={f.period} />
            </div>
          ))}
        </div>

        {model.framework && model.framework.singles>0 && <div className="border-t border-line-faint p-4">
          <div className="flex flex-wrap justify-between gap-2 items-baseline mb-3"><Eyebrow>Rollout guide · {model.framework.singles} singles</Eyebrow><span className="text-micro text-muted">Suggested starting plan</span></div>
          <div className="grid grid-cols-3 gap-3">
            {[{label:'Release videos',value:model.framework.heroes,target:model.framework.singles},
              {label:'Follow-up videos',value:model.framework.followUps,target:model.framework.singles},
              {label:'Release-linked Shorts',value:model.framework.shorts,target:model.framework.shortsTarget}].map(f=><div key={f.label}><p className="m-0 text-[24px] font-extrabold text-ink tabular-nums">{f.value}<span className="text-muted font-normal"> / {f.target}</span></p><span className="text-meta font-semibold text-secondary">{f.label}</span><div className="h-1 mt-2 rounded bg-raised overflow-hidden"><div className="h-full rounded bg-electric" style={{width:`${Math.min(100,f.target?f.value/f.target*100:0)}%`}} /></div></div>)}
          </div>
          <p className="m-0 mt-3 text-meta font-semibold text-ink">Next 28 days: {model.framework.upcomingMoments} release moment{model.framework.upcomingMoments===1?'':'s'} · {model.framework.next28Shorts} suggested Short moments</p>
          <details className="mt-2 text-micro text-muted"><summary className="cursor-pointer text-electric font-semibold">How the guide works</summary><p className="m-0 mt-2">Per single: a release video, one distinct follow-up around days 7–14, and three Shorts: teaser (day −3), launch, follow-up (day +7). Counts cover the whole saved single timeline, including future releases; “Next 28 days” counts single and album release moments in that window, with teaser, launch and follow-up Shorts around each. Shorts between release moments are tracked separately against the weekly team target. These are trial planning defaults, not YouTube quotas. Adjust for material, artist and audience response. Timing follows the actual release video once published, otherwise the planned single date. Only track-matched public uploads count here.</p></details>
        </div>}
        {model.shortsProgress && <ShortsProgress data={model.shortsProgress} slug={slug} />}
        {!!model.coverage?.length && <div className="border-t border-line-faint px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><Eyebrow>Per-song format check</Eyebrow><span className="text-micro text-muted">✓ Live · ◆ In plan · — Not found in channel scan</span></div>
          <div className="overflow-x-auto"><table className="w-full text-meta text-left border-collapse">
            <thead><tr className="text-micro text-muted"><th className="py-2 pr-3 font-semibold">Single</th>{model.coverage[0].cells.map(c=><th key={c.label} className="px-2 py-2 text-center font-semibold">{c.label}</th>)}</tr></thead>
            <tbody>{model.coverage.map(r=><tr key={r.name} className="border-t border-line-faint"><th className="py-2 pr-3 font-semibold text-ink">{r.name}<span className="block text-micro font-normal text-muted">{r.date} · {r.guide}</span></th>{r.cells.map(c=><td key={c.label} className={`px-2 py-2 text-center font-bold ${c.count?'text-positive':c.planned?'text-electric':'text-muted'}`} aria-label={`${r.name}, ${c.label}: ${c.count?c.count+' published':c.planned?'in plan':'not found'}`}>{c.count?`✓ ${c.count}`:c.planned?'◆':'—'}</td>)}</tr>)}</tbody>
          </table></div><p className="text-micro text-muted m-0 mt-2">Format options, not a requirement to make every type. Unmatched or private uploads may not appear.</p>
        </div>}

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
                  {model.paceLine && (
                    <p className="text-[12.5px] text-secondary leading-relaxed m-0 mt-2">{model.paceLine}</p>
                  )}
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
              <p className="text-micro text-muted m-0 mt-1.5 leading-relaxed">
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
      <Eyebrow className="mt-7 mb-2.5">Rollout</Eyebrow>
      <p className="flex flex-wrap gap-4 text-micro text-muted m-0 mb-3">
        <span><strong className="text-positive">✓</strong> Published on the channel</span>
        <span><strong className="text-longform">◆</strong> Agreed by the team</span>
        <span><strong className="text-faint">○</strong> Suggested — reason shown</span>
      </p>

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

              {r.supportSummary && <p className="text-meta font-semibold text-secondary m-0 mt-2">{r.supportSummary}</p>}
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

      {timelineEditor}

      <div className="mt-7 pt-3 border-t border-line text-micro text-muted leading-relaxed">
        {model.caveats.map(c => <p key={c} className="m-0 mb-1.5 last:mb-0">{c}</p>)}
        {classicHref && (
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
