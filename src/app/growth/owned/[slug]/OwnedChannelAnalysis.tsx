'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { DAY, LENGTH_LABELS, lengthGroup, lengthBreakdown, meanDailyViews, observedMovement, publishingSeries, type OwnedAnalysis } from '@/lib/ownedChannels/analysis';
import { buildLibraryStats, countPublishedSince, SHORT_MAX_SEC, UPLOAD_SWEEP_CAP } from '@/lib/ownedChannels/metrics';
import { observeChannel } from '@/lib/ownedChannels/observations';
import { GrowthChart, PublishingChart, LengthChart } from './OwnedChannelCharts';

const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const date = (at: string | number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const delta = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const exact = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB').format(n);
const share = (n: number | null) => n == null ? '—' : `${n < 0.01 ? '<1' : Math.round(n * 100)}%`;
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
  const [view, setView] = useState<'views' | 'gains' | 'newest'>('views');
  const [published, setPublished] = useState<'all' | 'window'>('all');
  const [detail, setDetail] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const at = Date.parse(asOf);
  const from = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) - (days - 1) * DAY;
  const currentItems = row.current?.items.filter(v => Number.isFinite(Date.parse(v.publishedAt)) && Date.parse(v.publishedAt) <= at && v.live !== 'upcoming') ?? [];
  const windowItems = currentItems.filter(v => Date.parse(v.publishedAt) >= from);
  const breakdown = lengthBreakdown(windowItems);
  const series = publishingSeries(currentItems, at, days, !!row.current && (row.current.reachedEnd || row.current.reachedWindow), row.current?.publishedPerDay);
  const covered = series.every(p => p.count != null);
  /* Never present "latest N uploads" as a complete window: say where the
     coverage actually starts. */
  const coveredFrom = series.find(p => p.count != null)?.day ?? null;
  const shortInWindow = windowItems.filter(v => v.durationSec != null && v.durationSec > 0 && v.durationSec <= SHORT_MAX_SEC).length;
  const viewsMovement = observedMovement(readings, 'views', from);
  const subsMovement = observedMovement(readings, 'subs', from);
  /* The library is the default scope. Most of what a destination channel
     has done sits outside the publishing window, so framing the table on
     the window hides the part that is actually carrying the channel. */
  /* Older readings predate sweeps and carry no `library`, so rebuild the
     same shape from whatever they stored rather than showing nothing. */
  const library = row.current?.library ?? buildLibraryStats(currentItems, !!row.current?.reachedEnd, null);
  const perDay = row.current?.publishedPerDay;
  const windowCount = perDay ? countPublishedSince(perDay, from, at) : windowItems.length;
  /* Two different periods, kept apart on purpose: `published` filters by
     publication date, while a gain is measured between two readings and
     has nothing to do with when the upload went out. */
  const tableItems = published === 'window' ? windowItems : currentItems;
  const measured = (v: typeof currentItems[number]) => videoGains[v.id]?.kind === 'measured' ? videoGains[v.id].value : null;
  const filtered = tableItems
    .filter(v => v.title.toLowerCase().includes(search.toLowerCase()) && (length === 'all' || lengthGroup(v) === Number(length)))
    .filter(v => view !== 'gains' || (measured(v) ?? 0) > 0);
  const sortValue = (v: typeof currentItems[number]) => view === 'newest' ? Date.parse(v.publishedAt) : view === 'gains' ? measured(v) : v.views;
  filtered.sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b);
    if (av == null || bv == null) return av == null ? (bv == null ? a.title.localeCompare(b.title) : 1) : -1;
    return bv - av || a.id.localeCompare(b.id);
  });
  /* Five rows is enough to see what is working; browsing the rest is a
     deliberate act rather than the default wall of table. */
  const perPage = showAll ? 10 : 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * perPage, safePage * perPage + perPage);
  const observationNote = (m: typeof viewsMovement) => !m ? 'A second reading is needed' : `${delta(m.value)} over ${m.days.toFixed(1)} recorded days`;

  const baselineDays = analysis.baselineAt ? (at - Date.parse(analysis.baselineAt)) / DAY : null;
  const hasGains = baselineDays != null;
  const observations = row.current ? observeChannel({
    items: currentItems, library, gains: videoGains, baselineDays, at,
    perDay, viewsGain: viewsMovement ? { value: viewsMovement.value, days: viewsMovement.days } : null,
  }) : [];
  /* One reading draws a dot, not a curve. Collapse rather than render an
     empty panel the size of a chart. */
  const growthPoints = readings.filter(r => Date.parse(r.at) >= from && Date.parse(r.at) <= at && r[metric] != null).length;
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

    {/* 1 — Compact overview. Lifetime totals and period measures are
          labelled as such, and no number appears twice on the page. */}
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-h4 font-bold">Channel overview</h2>
        <p className="text-micro text-muted mt-1">
          {!row.current ? 'Awaiting channel data' : <>
            Read {date(at)}{library.newestPublishedAt ? ` · latest upload ${date(library.newestPublishedAt)}` : ''}
            {covered ? '' : ` · publishing figures cover ${coveredFrom ? `${date(coveredFrom)} onwards` : 'part of this period'} only`}
          </>}
        </p>
      </div>
      <div className="inline-flex border border-line rounded-control bg-surface p-1" aria-label="Analysis period">{([7, 30] as const).map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => { setDays(n); setPage(0); }} className={`text-meta font-semibold px-3 py-1 rounded ${days === n ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{n} days</button>)}</div>
    </div>
    <div className="bg-surface border border-line rounded-card shadow-card grid grid-cols-2 sm:grid-cols-4 mb-7 overflow-hidden">
      {[
        ['Channel views', fmt(row.current?.views), 'Lifetime'],
        ['Subscribers', fmt(row.current?.subs), 'Lifetime · rounded'],
        ['Public videos', fmt(library.videoCount ?? (row.current ? library.swept : null)),
          !row.current ? 'No reading yet'
            : (library.videoCount ?? library.swept) === 0 ? 'No uploads yet'
            : library.videoCount == null ? `${exact(library.swept)} read`
            : library.swept >= library.videoCount ? 'All read'
            : `${exact(library.swept)} read`],
        [`Uploads · ${days}d`, row.current ? `${covered ? '' : '≥'}${fmt(windowCount)}` : '—',
          !row.current ? 'No reading yet' : covered ? 'In this period' : `Partial · from ${coveredFrom ? date(coveredFrom) : 'mid-period'}`],
      ].map(([label, value, note], i) => <div key={label} className={`px-4 py-4 ${i ? 'border-l border-line-faint' : ''} ${i > 1 ? 'border-t sm:border-t-0 border-line-faint' : ''}`}>
        <p className="text-micro font-semibold text-secondary">{label}</p>
        <p className="text-h3 font-black tabular-nums mt-1">{value}</p>
        <p className="text-micro text-muted mt-0.5">{note}</p>
      </div>)}
    </div>

    {/* 2 — The working section. Everything else on the page supports it. */}
    <section className="mb-8" aria-labelledby="upload-performance">
      <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
        <div>
          <h2 id="upload-performance" className="text-h4 font-bold">Upload performance</h2>
          <p className="text-meta text-muted mt-1">The music driving viewing. Search a song, artist or version.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex border border-line rounded-control bg-surface p-1" aria-label="Table view">
            {([['views', 'Most viewed'], ['gains', 'Recent gains'], ['newest', 'Newest']] as const).map(([key, label]) =>
              <button key={key} type="button" aria-pressed={view === key} disabled={key === 'gains' && !hasGains}
                onClick={() => { setView(key); setPage(0); }}
                className={`text-meta font-semibold px-3 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed ${view === key ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{label}</button>)}
          </div>
          <span className="text-meta text-muted tabular-nums">{fmt(filtered.length)} uploads</span>
        </div>
      </div>

      {/* Said once, above the table, rather than on every row. */}
      <p className="text-micro text-muted mb-3 leading-relaxed">
        {hasGains
          ? <>Gains are measured between two readings {baselineDays!.toFixed(1)} days apart{analysis.baselineAt ? ` (baseline ${date(analysis.baselineAt)})` : ''}. That measured period is separate from the publication filter below, which selects uploads by when they were published.</>
          : <>Recent gains need readings about a week apart. No matching seven-day baseline is available yet. Views below are lifetime totals.</>}
        {' '}{library.swept === 0 ? <>No uploads yet.</> : <>
          {library.videoCount != null && library.videoCount > library.swept
            ? <>Figures cover {exact(library.swept)} uploads read of {exact(library.videoCount)} on the channel.</>
            : <>Figures cover all {exact(library.swept)} uploads on the channel.</>}
          {tableItems.length < library.swept && <> The table lists the {exact(currentItems.length)} kept from that read — the most viewed and the most recent.</>}
        </>}
      </p>

      <div className="flex flex-wrap gap-3 mb-3">
        <label className="flex-1 min-w-[200px]"><span className="sr-only">Search uploads</span><input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Find an upload…" className={`${control} w-full placeholder:text-faint`} /></label>
        <label><span className="sr-only">Filter by publication date</span><select value={published} onChange={e => { setPublished(e.target.value as 'all' | 'window'); setPage(0); }} className={control}>
          <option value="all">Published: any time</option><option value="window">Published: last {days} days</option>
        </select></label>
        <label><span className="sr-only">Filter by video length</span><select value={length} onChange={e => { setLength(e.target.value); setPage(0); }} className={control}><option value="all">All lengths</option>{LENGTH_LABELS.map((label, i) => <option value={i} key={label}>{label}</option>)}</select></label>
        <button type="button" onClick={() => setDetail(!detail)} aria-pressed={detail} className={`${control} font-semibold text-secondary`}>{detail ? 'Hide detail' : 'More detail'}</button>
      </div>

      <div className="bg-surface border border-line rounded-card overflow-hidden shadow-card">
        <div className="overflow-x-auto"><table className={`w-full ${detail ? 'min-w-[900px]' : 'min-w-[600px]'} text-body text-left`}>
          <thead className="text-micro uppercase tracking-label text-muted bg-raised/60 border-b border-line"><tr>
            {['Upload', 'Published', 'Views'].map(label => <th key={label} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{label}</th>)}
            {hasGains && <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">Gained</th>}
            {detail && ['Avg / day', 'Likes', 'Comments'].map(label => <th key={label} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{label}</th>)}
          </tr></thead>
          <tbody>{paged.map(video => {
            const age = (at - Date.parse(video.publishedAt)) / DAY;
            const movement = videoGains[video.id];
            return <tr key={video.id} className="border-b border-line-faint last:border-b-0 hover:bg-raised/30">
              <td className="px-4 py-3 max-w-[420px]"><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-center no-underline group">
                <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" width={80} height={45} loading="lazy" className="w-20 aspect-video object-cover rounded shrink-0 bg-raised" />
                <span><span className="text-ink font-semibold group-hover:text-electric line-clamp-2">{video.title}</span><span className="block text-micro text-muted mt-1">{duration(video.durationSec)} · {LENGTH_LABELS[lengthGroup(video)]}</span></span></a></td>
              <td className="px-4 py-3 whitespace-nowrap text-meta">{date(video.publishedAt)}<span className="block text-micro text-muted">{age < 1 ? 'Under 1 day old' : `${Math.floor(age)} days old`}</span></td>
              <td className="px-4 py-3 font-bold tabular-nums">{fmt(video.views)}</td>
              {hasGains && <td className="px-4 py-3 tabular-nums">{movement?.value == null ? '—' : delta(movement.value)}{movement?.kind === 'new' && <span className="block text-micro text-muted">Published since baseline</span>}</td>}
              {detail && <><td className="px-4 py-3 tabular-nums">{fmt(meanDailyViews(video, at))}</td>
                <td className="px-4 py-3 tabular-nums">{fmt(video.likes)}</td><td className="px-4 py-3 tabular-nums">{fmt(video.comments)}</td></>}
            </tr>;
          })}</tbody>
        </table></div>
        {!filtered.length && <div className="p-10 text-center text-meta text-muted">{!row.current ? 'Refresh the channel to load its uploads.'
          : view === 'gains' ? 'No upload gained measurable views between the matched readings.'
          : published === 'window' ? <>No uploads published in the last {days} days. <button className="underline text-ink" onClick={() => { setPublished('all'); setPage(0); }}>Show all collected uploads</button></>
          : !tableItems.length ? 'No public uploads were recorded for this channel.'
          : <>No uploads match. <button className="underline text-ink" onClick={() => { setSearch(''); setLength('all'); setPage(0); }}>Clear filters</button></>}</div>}
        <div className="px-4 py-3 bg-raised/50 border-t border-line flex flex-wrap justify-between items-center gap-3 text-micro text-muted">
          <span>{filtered.length ? `${safePage * perPage + 1}–${Math.min((safePage + 1) * perPage, filtered.length)} of ${fmt(filtered.length)}` : '0 uploads'}{detail ? ' · Avg / day is lifetime views ÷ age, not recent growth.' : ''}</span>
          <div className="flex gap-2 items-center">
            {!showAll && filtered.length > 5 && <button type="button" onClick={() => { setShowAll(true); setPage(0); }} className="px-2 py-1 border border-line rounded bg-surface font-semibold text-ink">Browse all {fmt(filtered.length)}</button>}
            {showAll && <><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Previous</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Next</button></>}
          </div>
        </div>
      </div>
    </section>

    {/* 3 — Observations, after the evidence they refer to. */}
    {observations.length > 0 && <section className="mb-8" aria-labelledby="observations">
      <h2 id="observations" className="text-h4 font-bold mb-1">What stands out</h2>
      <p className="text-meta text-muted mb-4">Measured from the stored readings. Observations, not recommendations.</p>
      <div className="grid gap-3">
        {observations.map(o => <div key={o.id} className="bg-surface border border-line rounded-card shadow-card p-5">
          <p className="text-body font-bold text-ink">{o.headline}</p>
          <p className="text-meta text-secondary mt-2 leading-relaxed">{o.detail}{o.note ? <span className="text-muted"> {o.note}</span> : null}</p>
          {o.videos.length > 0 && <p className="text-meta mt-3 leading-relaxed">
            {o.videos.map((v, i) => <span key={v.id}>{i > 0 ? ' · ' : ''}
              <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-electric font-semibold no-underline hover:underline">{v.title.length > 48 ? `${v.title.slice(0, 48)}…` : v.title}</a>
            </span>)}
          </p>}
        </div>)}
      </div>
    </section>}

    {/* 4 — Activity. The chart only when it can show a change. */}
    <section className="mb-8" aria-labelledby="activity">
      <h2 id="activity" className="text-h4 font-bold mb-4">Activity</h2>
      <div className="grid gap-5">
        <Panel title="Publishing rhythm" description={covered ? `Uploads per day over ${days} days` : `Uploads per day · coverage starts ${coveredFrom ? date(coveredFrom) : 'mid-period'}`} action={<span className="text-meta font-bold tabular-nums text-secondary">{row.current ? fmt(windowCount) : '—'}</span>}>
          {!row.current ? <p className="text-meta text-muted py-6">A first reading will populate the publishing timeline.</p>
            : windowCount === 0 ? <p className="text-meta text-muted py-6">No uploads published in the last {days} days{coveredFrom && !covered ? `, over the part of the period covered (from ${date(coveredFrom)})` : ''}.</p>
            : <PublishingChart series={series} />}
        </Panel>
      </div>
      <p className="text-meta text-muted mt-3">{growthPoints >= 2
        ? <>Channel growth is charted in supporting analysis below.</>
        : row.current ? <>One reading recorded, {date(asOf)}. Channel growth and per-upload gains need a second reading on another day.</>
        : <>No readings yet.</>}</p>
    </section>

    <details className="mt-6 bg-surface border border-line rounded-card px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">Data coverage and definitions</summary>
      {growthPoints >= 2 && <div className="mt-4 mb-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <p className="text-meta font-semibold text-ink">Channel growth across recorded readings</p>
          <div className="inline-flex gap-1 bg-raised rounded-control p-1">{(['views', 'subs'] as const).map(key => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)} className={`px-2 py-1 rounded text-micro font-semibold ${metric === key ? 'bg-surface text-ink shadow-control' : 'text-muted'}`}>{key === 'views' ? 'Views' : 'Subscribers'}</button>)}</div>
        </div>
        <GrowthChart key={`${metric}-${days}`} readings={readings} metric={metric} from={from} to={at} />
      </div>}

      {row.current && library.swept > 0 && <div className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-meta font-semibold text-secondary">Short-form <span className="font-normal text-muted">· 3 minutes or less</span></p>
            <p className="text-micro text-muted mt-1">Duration only — the public API does not say whether a video sits on the Shorts surface.</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 tabular-nums">
            <span><span className="text-h4 font-black">{fmt(library.shortCount)}</span><span className="text-micro text-muted block">of {fmt(library.swept)} collected · {share(library.shortCount / Math.max(1, library.swept))}</span></span>
            <span><span className="text-h4 font-black">{fmt(shortInWindow)}</span><span className="text-micro text-muted block">of {exact(windowItems.length)} kept uploads published in this {days}d period</span></span>
            <span><span className="text-h4 font-black">{fmt(library.shortMedianViews)}</span><span className="text-micro text-muted block">median, across {fmt(library.shortWithViews)} short uploads</span></span>
            <span><span className="text-h4 font-black">{fmt(library.longMedianViews)}</span><span className="text-micro text-muted block">median, longer uploads</span></span>
          </div>
        </div>
        {library.shortCount > 0 && library.longMedianViews != null && library.shortMedianViews != null &&
          <p className="text-micro text-muted mt-3 pt-3 border-t border-line-faint leading-relaxed">Those two medians are not comparable: YouTube counts a Short's view differently from a long-form view, and the groups differ in age. Read each as a description of its own group.</p>}
        {library.unknownDuration > 0 && <p className="text-micro text-muted mt-2">{fmt(library.unknownDuration)} collected upload{library.unknownDuration === 1 ? '' : 's'} had no duration recorded and sit in neither group.</p>}
      </div>}

      <div className="mt-4 mb-5">
        <p className="text-meta font-semibold text-ink mb-1">Where views sit, by length</p>
        <p className="text-micro text-muted mb-3">Uploads published in the last {days} days, grouped by length. Groups differ in age and size, so this compares exposure, not format quality.</p>
        <LengthChart breakdown={breakdown} />
      </div>
      <div className="mb-5">
        <p className="text-meta font-semibold text-ink mb-1">Catalogue shape</p>
        <p className="text-micro text-muted leading-relaxed">
          {row.current ? <>Median upload {fmt(library.medianViews)} views across the {fmt(library.withViews)} uploads read{library.underTen ? `, ${share(library.underTen / Math.max(library.withViews, 1))} of them under ten views` : ''}.{library.halfShareCount != null ? ` ${library.halfShareCount} upload${library.halfShareCount === 1 ? '' : 's'} hold half the recorded upload views.` : ''} Typical track views {fmt(row.medianTrack)}{row.trackSample ? `, from ${row.trackSample} track${row.trackSample === 1 ? '' : 's'} aged 7–30 days` : ' — no tracks old enough to judge yet'}.</> : 'No reading yet.'}
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-5 leading-relaxed">
        <p><strong className="block text-ink mb-1">What is recorded</strong>{row.current ? `${row.current.items.length} public uploads in the latest sample. ${row.current.reachedEnd ? 'The public upload list was exhausted.' : row.current.reachedWindow ? 'The 18-month sample window was reached.' : `The ${UPLOAD_SWEEP_CAP}-upload sweep ceiling was reached; coverage may be partial.`}` : 'No public upload reading yet.'} Channel totals and video totals can differ. No growth is backfilled.</p>
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
