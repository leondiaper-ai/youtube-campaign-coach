'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { DAY, LENGTH_LABELS, lengthGroup, lengthBreakdown, meanDailyViews, observedMovement, publishingSeries, type OwnedAnalysis } from '@/lib/ownedChannels/analysis';
import { buildLibraryStats, countPublishedSince, UPLOAD_SWEEP_CAP } from '@/lib/ownedChannels/metrics';
import { observeChannel } from '@/lib/ownedChannels/observations';
import { GrowthChart, PublishingChart, LengthChart } from './OwnedChannelCharts';

const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const date = (at: string | number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const delta = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
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
  const [sort, setSort] = useState('views');
  const [scope, setScope] = useState<'library' | 'window'>('library');
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
  const tableItems = scope === 'library' ? currentItems : windowItems;
  const filtered = tableItems.filter(v => v.title.toLowerCase().includes(search.toLowerCase()) && (length === 'all' || lengthGroup(v) === Number(length)));
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

  /* Leaders, pulled to the top: the videos are the point, the summary
     statistics about them are not. */
  const byViews = currentItems.filter(v => v.views != null).sort((a, b) => b.views! - a.views!);
  const leaders = byViews.slice(0, 5);
  const leaderShare = library.totalViews ? leaders.reduce((sum, v) => sum + (v.views ?? 0), 0) / library.totalViews : null;
  const risers = currentItems
    .filter(v => videoGains[v.id]?.kind === 'measured' && (videoGains[v.id].value ?? 0) > 0)
    .sort((a, b) => (videoGains[b.id].value ?? 0) - (videoGains[a.id].value ?? 0))
    .slice(0, 5);
  const baselineDays = analysis.baselineAt ? (at - Date.parse(analysis.baselineAt)) / DAY : null;
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      <Metric label="Channel views" value={fmt(row.current?.views)} note={row.current ? 'Lifetime' : 'No reading yet'} />
      <Metric label="Subscribers" value={fmt(row.current?.subs)} note={row.current ? 'Lifetime · rounded' : 'No reading yet'} />
      <Metric label="Public videos" value={fmt(library.videoCount ?? (row.current ? library.swept : null))} note={!row.current ? 'No reading yet' : library.videoCount == null ? `${fmt(library.swept)} read` : library.complete ? 'All read' : `${fmt(library.swept)} read`} />
      <Metric label={`Uploads · ${days}d`} value={row.current ? `${covered ? '' : '≥'}${fmt(windowCount)}` : '—'} note={row.current ? (covered ? 'In this period' : 'Partial coverage') : 'No reading yet'} />
    </div>

    {/* 2 — The videos, before any statistic about them. */}
    {row.current && (leaders.length > 0 || risers.length > 0) && <section className="mb-8" aria-labelledby="attracting">
      <h2 id="attracting" className="text-h4 font-bold mb-1">What is attracting viewers</h2>
      <p className="text-meta text-muted mb-4">
        {leaderShare != null && leaders.length
          ? <>These {leaders.length} uploads account for {share(leaderShare)} of the {fmt(library.totalViews)} views recorded across the {fmt(library.withViews)} uploads read{library.complete ? '' : ' so far'} — not of the channel total.</>
          : <>Ranked on views to date across the uploads held.</>}
      </p>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Most viewed overall" description={`Views to date · ${fmt(library.withViews)} uploads ranked`}>
          <VideoList videos={leaders} at={at} metric={v => fmt(v.views)} caption="views" />
        </Panel>
        <Panel title="Gaining views now" description={baselineDays != null ? `Measured over ${baselineDays.toFixed(1)} recorded days` : 'Needs a second reading'}>
          {baselineDays != null && risers.length
            ? <VideoList videos={risers} at={at} metric={v => delta(videoGains[v.id]?.value ?? 0)} caption="gained" />
            : <p className="text-meta text-muted py-6">{baselineDays == null
                ? 'Only one reading so far. Recent gains need a second reading about a week apart; the lifetime leaders are shown alongside in the meantime.'
                : 'No upload gained measurable views between the matched readings.'}</p>}
        </Panel>
      </div>
    </section>}

    {/* 3 — Observations. Absent entirely when nothing is supported. */}
    {observations.length > 0 && <section className="mb-8" aria-labelledby="observations">
      <h2 id="observations" className="text-h4 font-bold mb-1">Worth a look</h2>
      <p className="text-meta text-muted mb-4">Observations from the stored readings. Each is something measured, not a recommendation.</p>
      <div className="grid gap-3">
        {observations.map(o => <div key={o.id} className="bg-surface border border-line rounded-card shadow-card p-5">
          <p className="text-body font-bold text-ink">{o.headline}</p>
          <p className="text-meta text-secondary mt-2 leading-relaxed">{o.detail}</p>
          {o.videos.length > 0 && <div className="flex flex-wrap gap-2 mt-3">
            {o.videos.map(v => <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 no-underline border border-line rounded-control bg-raised/40 pr-3 hover:border-line-strong group max-w-[280px]">
              <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" width={48} height={27} loading="lazy" className="w-12 aspect-video object-cover rounded-l-control bg-raised" />
              <span className="text-micro text-secondary group-hover:text-ink truncate py-1">{v.title}</span>
            </a>)}
          </div>}
          <p className="text-meta text-muted mt-3 pt-3 border-t border-line-faint leading-relaxed"><strong className="text-secondary">Worth asking:</strong> {o.prompt}</p>
        </div>)}
      </div>
    </section>}

    {/* 4 — Activity. The chart only when it can show a change. */}
    <section className="mb-8" aria-labelledby="activity">
      <h2 id="activity" className="text-h4 font-bold mb-4">Activity</h2>
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-5">
        <Panel title="Publishing rhythm" description={covered ? `Uploads per day over ${days} days` : `Uploads per day · coverage starts ${coveredFrom ? date(coveredFrom) : 'mid-period'}`} action={<span className="text-meta font-bold tabular-nums text-secondary">{row.current ? fmt(windowCount) : '—'}</span>}>
          {row.current ? <PublishingChart series={series} /> : <p className="text-meta text-muted py-6">A first reading will populate the publishing timeline.</p>}
        </Panel>
        <Panel title="Audience growth" description={growthPoints >= 2 ? 'Channel totals across recorded readings' : 'Needs more readings'}
          action={growthPoints >= 2 ? <div className="inline-flex gap-1 bg-raised rounded-control p-1">{(['views', 'subs'] as const).map(key => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)} className={`px-2 py-1 rounded text-micro font-semibold ${metric === key ? 'bg-surface text-ink shadow-control' : 'text-muted'}`}>{key === 'views' ? 'Views' : 'Subscribers'}</button>)}</div> : undefined}>
          {growthPoints >= 2
            ? <GrowthChart key={`${metric}-${days}`} readings={readings} metric={metric} from={from} to={at} />
            : <p className="text-meta text-muted py-6">{row.current
                ? `One reading recorded (${date(asOf)}). A curve needs at least two; refresh on another day to start one.`
                : 'No readings yet.'}</p>}
        </Panel>
      </div>
    </section>

    <section className="mt-8" aria-labelledby="upload-performance">
      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div><h2 id="upload-performance" className="text-h4 font-bold">Upload performance</h2>
          <p className="text-meta text-muted mt-1">Views to date on {scope === 'library' ? `the ${tableItems.length} uploads kept from this sweep — the best performers and the most recent` : `uploads published in the last ${days} days`}. Search a song, artist or version.</p></div>
        <div className="flex items-center gap-3">
          <div className="inline-flex border border-line rounded-control bg-surface p-1" aria-label="Upload scope">
            {([['library', 'Top & newest'], ['window', `Last ${days} days`]] as const).map(([key, label]) =>
              <button key={key} type="button" aria-pressed={scope === key} onClick={() => { setScope(key); setPage(0); }}
                className={`text-meta font-semibold px-3 py-1 rounded ${scope === key ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{label}</button>)}
          </div>
          <span className="text-meta text-muted tabular-nums">{filtered.length} uploads</span>
        </div>
      </div>
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
        {!filtered.length && <div className="p-10 text-center text-meta text-muted">{!row.current ? 'Refresh the channel to load its uploads.' : !tableItems.length ? (scope === 'library' ? 'No public uploads were recorded for this channel.' : <>No uploads published in the last {days} days. <button className="underline text-ink" onClick={() => { setScope('library'); setPage(0); }}>Show the whole library</button></>) : <>No uploads match. <button className="underline text-ink" onClick={() => { setSearch(''); setLength('all'); setPage(0); }}>Clear filters</button></>}</div>}
        <div className="px-4 py-3 bg-raised/50 border-t border-line flex flex-wrap justify-between items-center gap-3 text-micro text-muted">
          <span>{filtered.length ? `${safePage * 10 + 1}–${Math.min((safePage + 1) * 10, filtered.length)} of ${filtered.length}` : '0 uploads'} · Average / day is lifetime views ÷ age; it is not recent daily growth.</span>
          <div className="flex gap-2"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Previous</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="px-2 py-1 border border-line rounded bg-surface disabled:opacity-40">Next</button></div>
        </div>
      </div>
    </section>

    <details className="mt-6 bg-surface border border-line rounded-card px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">Data coverage and definitions</summary>
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

/* Thumbnail, readable title, date, number. The number is passed in rather
   than assumed, so the same list shows lifetime views or measured gains. */
function VideoList({ videos, at, metric, caption }: {
  videos: { id: string; title: string; publishedAt: string; views: number | null }[];
  at: number; metric: (v: { id: string; title: string; publishedAt: string; views: number | null }) => string; caption: string;
}) {
  if (!videos.length) return <p className="text-meta text-muted py-6">No uploads with recorded views yet.</p>;
  return <ol className="mt-3 space-y-2">
    {videos.map((video, i) => <li key={video.id}>
      <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer"
        className="flex gap-3 items-center no-underline group rounded-control p-1 -m-1 hover:bg-raised/40">
        <span className="text-micro font-bold text-faint tabular-nums w-4 shrink-0">{i + 1}</span>
        <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" width={72} height={41} loading="lazy" className="w-[72px] aspect-video object-cover rounded shrink-0 bg-raised" />
        <span className="min-w-0 flex-1">
          <span className="block text-meta font-semibold text-ink group-hover:text-electric line-clamp-2 leading-snug">{video.title}</span>
          <span className="block text-micro text-muted mt-0.5">{new Date(video.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-body font-bold tabular-nums text-ink">{metric(video)}</span>
          <span className="block text-micro text-muted">{caption}</span>
        </span>
      </a>
    </li>)}
  </ol>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="bg-surface border border-line rounded-card px-5 py-5 shadow-card"><p className="text-meta font-semibold text-secondary">{label}</p><p className="text-kpi font-black tabular-nums mt-3 mb-2">{value}</p><p className="text-micro text-muted leading-relaxed">{note}</p></div>;
}
function Panel({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="bg-surface border border-line rounded-card shadow-card p-5 min-w-0"><div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="text-h4 font-bold">{title}</h2><p className="text-meta text-muted mt-1">{description}</p></div>{action}</div>{children}</section>;
}
