'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { DAY, LENGTH_LABELS, lengthGroup, lengthBreakdown, meanDailyViews, observedMovement, publishingSeries, type OwnedAnalysis } from '@/lib/ownedChannels/analysis';
import { GrowthChart, PublishingChart, LengthChart } from './OwnedChannelCharts';

const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const date = (at: string | number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const delta = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const duration = (n: number | null) => n == null ? '—' : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const control = 'border border-line bg-surface rounded-control px-3 py-2 text-body focus-visible:outline-electric';

export default function OwnedChannelAnalysis({ analysis, canCollect, readFailed, linkSuffix = '' }: {
  analysis: OwnedAnalysis; canCollect: boolean; readFailed: boolean; linkSuffix?: string;
}) {
  const { row, readings, videoGains, asOf } = analysis;
  const router = useRouter();
  const [days, setDays] = useState<7 | 30>(30);
  const [metric, setMetric] = useState<'views' | 'subs'>('views');
  const [search, setSearch] = useState('');
  const [length, setLength] = useState('all');
  const [sort, setSort] = useState('views');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const at = Date.parse(asOf);
  const from = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (days - 1) * DAY;
  const currentItems = row.current?.items.filter(v => Number.isFinite(Date.parse(v.publishedAt)) && Date.parse(v.publishedAt) <= at && v.live !== 'upcoming') ?? [];
  const windowItems = currentItems.filter(v => Date.parse(v.publishedAt) >= from);
  const breakdown = lengthBreakdown(windowItems);
  const series = publishingSeries(currentItems, at, days, !!row.current && (row.current.reachedEnd || row.current.reachedWindow));
  const covered = series.every(p => p.count != null);
  const viewsMovement = observedMovement(readings, 'views', from);
  const subsMovement = observedMovement(readings, 'subs', from);
  const filtered = windowItems.filter(v => v.title.toLowerCase().includes(search.toLowerCase()) && (length === 'all' || lengthGroup(v) === Number(length)));
  const sortValue = (v: typeof currentItems[number]) => sort === 'published' ? Date.parse(v.publishedAt) : sort === 'daily' ? meanDailyViews(v, at) : sort === 'gain' ? videoGains[v.id]?.value ?? null : v.views;
  filtered.sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b);
    if (av == null || bv == null) return av == null ? (bv == null ? a.title.localeCompare(b.title) : 1) : -1;
    return bv - av || a.id.localeCompare(b.id);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * 10, safePage * 10 + 10);
  const observationNote = (m: typeof viewsMovement) => !m ? 'A second reading is needed' : `${delta(m.value)} over ${m.days.toFixed(1)} recorded days`;
  async function refresh() {
    if (busy) return;
    setBusy(true); setMessage('Reading channel totals and uploads…');
    try {
      const response = await fetch('/api/owned-channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: row.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not refresh this channel.');
      setMessage(result.cached ? 'Already up to date. Refresh becomes available one hour after the last reading.' : 'Channel refreshed. Recorded growth will build as more daily readings are collected.');
      router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not reach the preview server.'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="flex flex-wrap justify-between items-center gap-3 pt-5 pb-5 border-b border-line">
      <Link href={`/growth/owned${linkSuffix}`} className="text-meta font-semibold text-secondary no-underline hover:text-ink">← Owned Channels <span className="mx-2 text-faint">/</span> <span className="text-ink">{row.name}</span></Link>
      <label><span className="sr-only">Switch owned channel</span><select value={row.slug} onChange={e => router.push(`/growth/owned/${e.target.value}${linkSuffix}`)} className={`${control} max-w-[240px]`}>
        {OWNED_CHANNELS.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
      </select></label>
    </div>

    <div className="flex flex-wrap justify-between items-start gap-5 py-7">
      <div className="flex gap-4 min-w-0">
        {row.current?.thumbnail ? <img src={row.current.thumbnail} alt="" width={56} height={56} className="rounded-card w-14 h-14 shrink-0" /> :
          <div aria-hidden className="w-14 h-14 rounded-card bg-surface border border-line flex items-center justify-center text-h3 font-black text-electric shrink-0">{row.name[0]}</div>}
        <div><div className="flex flex-wrap items-center gap-2 mb-2"><span className="text-micro font-bold text-electric uppercase tracking-label">Owned channel analysis</span><span className="text-micro font-semibold px-2 py-0.5 bg-raised rounded text-muted">Early stage</span></div>
          <h1 className="text-h1 font-black break-words">{row.current?.title ?? row.name}</h1>
          <p className="text-body text-secondary mt-2">{row.purpose}</p>
          <p className="text-meta text-muted mt-2">{row.handle ?? 'Identity unresolved'}{row.firstUpload ? ` · Publishing since ${date(row.firstUpload)}` : ''}</p>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        {validChannelId(row.id) && <a href={`https://www.youtube.com/channel/${row.id}`} target="_blank" rel="noopener noreferrer" className={`${control} no-underline font-semibold text-secondary`}>YouTube ↗</a>}
        <button type="button" disabled={!canCollect || busy} onClick={refresh} className={`${control} font-semibold disabled:opacity-50 disabled:cursor-not-allowed`}>{busy ? 'Refreshing…' : 'Refresh channel'}</button>
      </div>
    </div>
    <p aria-live="polite" className="text-meta text-secondary mb-3">{message}</p>

    {(readFailed || !row.current || row.stale) && <div className="border border-line rounded-control bg-raised text-meta text-secondary px-4 py-3 mb-6">
      {readFailed ? 'Stored data could not be loaded. These are unavailable readings, not zero results.' :
        !validChannelId(row.id) ? 'This channel ID needs correcting before data can be collected.' :
        !row.current ? (canCollect ? 'Ready for a first reading. Refresh this channel to populate the analysis; growth curves need readings on more than one day.' : 'Channel identity is ready. Metrics need YouTube and storage access in this preview environment.') :
        `This reading is more than 48 hours old. Figures below are historical, as of ${date(asOf)}. Refresh before treating them as current.`}
    </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h2 className="text-h4 font-bold">Channel overview</h2><p className="text-micro text-muted mt-1">{date(from)} – {date(at)} · {row.current ? 'as of the latest reading' : 'awaiting channel data'} · publication dates in UTC</p></div>
      <div className="inline-flex border border-line rounded-control bg-surface p-1" aria-label="Analysis period">{([7, 30] as const).map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => { setDays(n); setPage(0); }} className={`text-meta font-semibold px-3 py-1 rounded ${days === n ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{n} days</button>)}</div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Metric label="Channel views" value={fmt(row.current?.views)} note={row.current ? observationNote(viewsMovement) : 'No reading yet'} />
      <Metric label="Subscribers" value={fmt(row.current?.subs)} note={row.current ? `${observationNote(subsMovement)} · rounded public count` : 'No reading yet'} />
      <Metric label={`Uploads · ${days}d`} value={row.current ? `${covered ? '' : '≥'}${windowItems.length}` : '—'} note={row.current ? `${fmt(windowItems.length / (days / 7))} per week${covered ? '' : ' · incomplete window'}` : 'No publication sample yet'} />
      <Metric label="Typical track views" value={fmt(row.medianTrack)} note={`Median · ${row.trackSample} tracks aged 7–30d${row.trackSample && row.trackSample < 5 ? ' · small sample' : ''}`} />
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-5 mb-5">
      <Panel title="Audience growth" description="Channel totals across recorded readings." action={<div className="inline-flex gap-1 bg-raised rounded-control p-1">{(['views', 'subs'] as const).map(key => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)} className={`px-2 py-1 rounded text-micro font-semibold ${metric === key ? 'bg-surface text-ink shadow-control' : 'text-muted'}`}>{key === 'views' ? 'Views' : 'Subscribers'}</button>)}</div>}>
        <GrowthChart key={`${metric}-${days}`} readings={readings} metric={metric} from={from} to={at} />
      </Panel>
      <Panel title="Where views sit" description={`Uploads published in this ${days}-day window, grouped by length.`}>
        <LengthChart breakdown={breakdown} />
      </Panel>
    </div>

    <Panel title="Publishing rhythm" description="How regularly this channel is building its library." action={<span className="text-meta font-bold tabular-nums text-secondary">{row.current ? windowItems.length : '—'} uploads</span>}>
      {row.current ? <PublishingChart series={series} /> : <div className="h-[200px] flex items-center justify-center text-meta text-muted">A first upload reading will populate the publishing timeline.</div>}
    </Panel>

    <section className="mt-8" aria-labelledby="upload-performance">
      <div className="flex flex-wrap justify-between items-end gap-3 mb-4"><div><h2 id="upload-performance" className="text-h4 font-bold">Upload performance</h2><p className="text-meta text-muted mt-1">Views to date on uploads published in the selected period. Search a song, artist or version.</p></div><span className="text-meta text-muted tabular-nums">{filtered.length} uploads</span></div>
      <div className="flex flex-wrap gap-3 mb-3">
        <label className="flex-1 min-w-[200px]"><span className="sr-only">Search uploads</span><input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Find an upload…" className={`${control} w-full placeholder:text-faint`} /></label>
        <label><span className="sr-only">Filter by video length</span><select value={length} onChange={e => { setLength(e.target.value); setPage(0); }} className={control}><option value="all">All lengths</option>{LENGTH_LABELS.map((label, i) => <option value={i} key={label}>{label}</option>)}</select></label>
        <label><span className="sr-only">Sort upload performance</span><select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className={control}>
          <option value="views">Most viewed</option><option value="published">Newest first</option><option value="daily">Average views / day</option><option value="gain">Recorded 7d gains</option>
        </select></label>
      </div>
      <div className="bg-surface border border-line rounded-card overflow-hidden shadow-card">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-body text-left">
          <thead className="text-micro uppercase tracking-label text-muted bg-raised/60 border-b border-line"><tr>{['Upload', 'Published', 'Views to date', 'Avg / day', 'Recorded · ~7d', 'Likes', 'Comments'].map(label => <th key={label} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{paged.map(video => {
            const age = (at - Date.parse(video.publishedAt)) / DAY;
            const movement = videoGains[video.id];
            return <tr key={video.id} className="border-b border-line-faint last:border-b-0 hover:bg-raised/30">
              <td className="px-4 py-3 max-w-[370px]"><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-center no-underline group">
                <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" width={80} height={45} loading="lazy" className="w-20 aspect-video object-cover rounded shrink-0 bg-raised" />
                <span><span className="text-ink font-semibold group-hover:text-electric line-clamp-2">{video.title}</span><span className="block text-micro text-muted mt-1">{duration(video.durationSec)} · {LENGTH_LABELS[lengthGroup(video)]}</span></span></a></td>
              <td className="px-4 py-3 whitespace-nowrap text-meta">{date(video.publishedAt)}<span className="block text-micro text-muted">{age < 1 ? 'Under 1 day old' : `${Math.floor(age)} days old`}</span></td>
              <td className="px-4 py-3 font-bold tabular-nums">{fmt(video.views)}</td>
              <td className="px-4 py-3 tabular-nums">{fmt(meanDailyViews(video, at))}<span className="block text-micro text-muted">{age < 1 ? 'Too early' : 'Since upload'}</span></td>
              <td className="px-4 py-3 tabular-nums">{movement?.value == null ? '—' : delta(movement.value)}<span className="block text-micro text-muted">{movement?.kind === 'new' ? 'New since baseline' : movement?.kind === 'measured' ? 'Matched readings' : 'No matched baseline'}</span></td>
              <td className="px-4 py-3 tabular-nums">{fmt(video.likes)}</td><td className="px-4 py-3 tabular-nums">{fmt(video.comments)}</td>
            </tr>;
          })}</tbody>
        </table></div>
        {!filtered.length && <div className="p-10 text-center text-meta text-muted">{!row.current ? 'Refresh the channel to load its uploads.' : !windowItems.length ? 'No sampled public uploads in this period.' : <>No uploads match. <button className="underline text-ink" onClick={() => { setSearch(''); setLength('all'); setPage(0); }}>Clear filters</button></>}</div>}
        <div className="px-4 py-3 bg-raised/50 border-t border-line flex flex-wrap justify-between items-center gap-3 text-micro text-muted">
          <span>{filtered.length ? `${safePage * 10 + 1}–${Math.min((safePage + 1) * 10, filtered.length)} of ${filtered.length}` : '0 uploads'} · Average / day is lifetime views ÷ age; it is not recent daily growth.</span>
          <div className="flex gap-2"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Previous</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Next</button></div>
        </div>
      </div>
    </section>

    <details className="mt-6 bg-surface border border-line rounded-card px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">Data coverage and definitions</summary>
      <div className="grid md:grid-cols-3 gap-5 mt-4 leading-relaxed">
        <p><strong className="block text-ink mb-1">What is recorded</strong>{row.current ? `${row.current.items.length} public uploads in the latest sample. ${row.current.reachedEnd ? 'The public upload list was exhausted.' : row.current.reachedWindow ? 'The 18-month sample window was reached.' : 'The 300-upload cap was reached; coverage may be partial.'}` : 'No public upload reading yet.'} Channel totals and video totals can differ. No growth is backfilled.</p>
        <p><strong className="block text-ink mb-1">How to read comparisons</strong>Typical track views use eligible tracks aged 7–30 days; the sample is not age matched. Recorded video gains require readings about seven days apart.{analysis.baselineAt ? ` Baseline: ${date(analysis.baselineAt)}.` : ' No seven-day baseline is available yet.'} Count corrections can be negative. Missing counts stay blank.</p>
        <p><strong className="block text-ink mb-1">What needs channel access</strong>Watch time, returning viewers, traffic sources, revenue and audience movement to artist channels are not available in these public readings. Likes and comments appear after a new collection; older readings may not contain them.</p>
      </div>
    </details>
  </>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="bg-surface border border-line rounded-card px-5 py-5 shadow-card"><p className="text-meta font-semibold text-secondary">{label}</p><p className="text-kpi font-black tabular-nums mt-3 mb-2">{value}</p><p className="text-micro text-muted leading-relaxed">{note}</p></div>;
}
function Panel({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="bg-surface border border-line rounded-card shadow-card p-5 min-w-0"><div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="text-h4 font-bold">{title}</h2><p className="text-meta text-muted mt-1">{description}</p></div>{action}</div>{children}</section>;
}
