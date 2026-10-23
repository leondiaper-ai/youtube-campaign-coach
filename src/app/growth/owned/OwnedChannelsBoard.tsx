'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validChannelId } from '@/lib/ownedChannels/channels';
import { FORMAT_LABELS, videoFormat, type OwnedRow } from '@/lib/ownedChannels/metrics';

const number = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const gain = (n: number | null) => n == null ? '—' : `${n > 0 ? '+' : ''}${number(n)}`;
const date = (at: string) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const formatColors = ['bg-longform', 'bg-shorts', 'bg-positive', 'bg-line-strong'];

export default function OwnedChannelsBoard({ rows, canCollect, readFailed, linkSuffix = '' }: { rows: OwnedRow[]; canCollect: boolean; readFailed: boolean; linkSuffix?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All purposes');
  const [sort, setSort] = useState('name');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const ready = rows.filter(r => r.current);
  const fresh = ready.filter(r => !r.stale);
  const movement = fresh.filter(r => r.views7d != null);
  const totals = ready.filter(r => r.current?.subs != null);
  const viewTotals = ready.filter(r => r.current?.views != null);
  const cadence = fresh.filter(r => r.covers30d);
  const totalSubs = totals.length ? totals.reduce((s, r) => s + r.current!.subs!, 0) : null;
  const totalViews = viewTotals.length ? viewTotals.reduce((s, r) => s + r.current!.views!, 0) : null;
  const totalGain = movement.length ? movement.reduce((s, r) => s + r.views7d!, 0) : null;
  const uploads = cadence.length ? cadence.reduce((s, r) => s + r.recent.length, 0) : null;
  const filtered = rows.filter(r => (role === 'All purposes' || r.role === role) &&
    `${r.name} ${r.handle ?? ''} ${r.id} ${r.purpose}`.toLowerCase().includes(search.toLowerCase()));
  const sortValue = (r: OwnedRow): number | null => sort === 'views' ? r.views7d : sort === 'typical' ? r.medianTrack : r.current ? r.recent.length : null;
  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    const av = sortValue(a), bv = sortValue(b);
    if (av == null || bv == null) return av == null ? (bv == null ? a.name.localeCompare(b.name) : 1) : -1;
    return bv - av || a.name.localeCompare(b.name);
  });

  async function refresh() {
    if (busy) return;
    setBusy(true); setFailures([]);
    const errors: string[] = [];
    const valid = rows.filter(r => validChannelId(r.id));
    try {
      for (let i = 0; i < valid.length; i++) {
        const row = valid[i];
        setMessage(`Reading ${i + 1}/${valid.length} · ${row.name}`);
        try {
          const response = await fetch('/api/owned-channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: row.id }) });
          const result = await response.json();
          if (!response.ok) errors.push(`${row.name}: ${result.error ?? 'Could not refresh'}`);
        } catch { errors.push(`${row.name}: Could not reach the preview server.`); }
      }
      setFailures(errors);
      setMessage(errors.length ? `${valid.length - errors.length}/${valid.length} channels refreshed.` : `${valid.length} channels refreshed. Seven-day movement appears once a baseline exists.`);
      router.refresh();
    } finally { setBusy(false); }
  }

  return <>
    <div className="bg-surface border border-line rounded-card shadow-card grid grid-cols-2 lg:grid-cols-4 mb-7 overflow-hidden">
      {[
        ['Views to date', number(totalViews), `${viewTotals.length}/${rows.length} channels with a reading`],
        ['Subscribers', number(totalSubs), `${totals.length}/${rows.length} channels · not unique people`],
        ['Views gained · 7d', gain(totalGain), `${movement.length}/${rows.length} with a fresh baseline`],
        ['Uploads · 30d', number(uploads), `${cadence.length}/${rows.length} with complete 30d coverage`],
      ].map(([label, value, note], i) => <div key={label} className={`px-5 py-5 ${i ? 'border-l border-line-faint' : ''} ${i > 1 ? 'border-t lg:border-t-0 border-line-faint' : ''}`}>
        <p className="text-meta font-semibold text-secondary">{label}</p>
        <p className="mt-2 mb-2 text-kpi font-black tabular-nums">{value}</p>
        <p className="text-micro text-muted">{note}</p>
      </div>)}
    </div>

    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="max-w-[680px]">
        <h2 className="text-h4 font-bold">The network at a glance</h2>
        <p className="text-meta text-muted mt-1">All channels are new. Start with output, first audiences and early upload response; weekly movement becomes useful as each channel builds a history.</p>
      </div>
      <button type="button" disabled={!canCollect || busy} onClick={refresh}
        className="px-3 py-2 border border-line-strong rounded-control bg-surface text-body font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:border-ink">
        {busy ? 'Refreshing…' : 'Refresh channel data'}
      </button>
    </div>

    {(!canCollect || readFailed || !ready.length || rows.some(r => r.stale)) && <div className="mb-5 rounded-control border border-line bg-raised px-4 py-3 text-meta text-secondary">
      {readFailed ? 'Stored data could not be loaded. Channels are shown without figures; this is not a zero reading.' :
        !canCollect ? 'Draft roster is ready. Channel metrics will appear when YouTube and storage are available in the preview environment.' :
        !ready.length ? 'Ready for a first reading. Refresh channel data to load public totals and uploads. Seven-day growth needs a second reading about a week later.' :
        'Some readings are over 48 hours old. Their dates remain visible; stale readings are excluded from current growth and upload totals.'}
    </div>}
    <div aria-live="polite" className="text-meta text-secondary mb-3">{message}</div>
    {failures.length > 0 && <ul className="mb-5 text-meta text-negative list-disc pl-5">{failures.map(f => <li key={f}>{f}</li>)}</ul>}

    <div className="flex flex-wrap items-center gap-3 mb-3">
      <label className="flex-1 min-w-[180px]"><span className="sr-only">Search channels</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a channel…"
          className="w-full px-3 py-2 border border-line rounded-control bg-surface text-body placeholder:text-faint focus:outline-2 focus:outline-electric" /></label>
      <label><span className="sr-only">Filter by purpose</span>
        <select value={role} onChange={e => setRole(e.target.value)} className="border border-line rounded-control bg-surface px-3 py-2 text-body">
          {['All purposes', 'Genre', 'Mood', 'Activity', 'Seasonal', 'Unconfirmed'].map(p => <option key={p}>{p}</option>)}
        </select></label>
      <label><span className="sr-only">Sort channels</span>
        <select value={sort} onChange={e => setSort(e.target.value)} className="border border-line rounded-control bg-surface px-3 py-2 text-body">
          <option value="name">Sort: channel name</option><option value="views">Sort: views gained · 7d</option>
          <option value="typical">Sort: typical track views</option><option value="uploads">Sort: uploads · 30d</option>
        </select></label>
      <span className="text-meta text-muted tabular-nums">{filtered.length} channels</span>
    </div>

    <div className="border border-line rounded-card shadow-card overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-left text-body">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label">
            <tr>{['Channel / purpose', 'Subscribers', 'Views gained · 7d', 'Uploads · 30d', 'Typical track · 7–30d', 'First upload', 'Reading'].map(t =>
              <th scope="col" key={t} className="px-4 py-3 font-bold whitespace-nowrap">{t}</th>)}</tr>
          </thead>
          <tbody>{filtered.map(row => <Fragment key={row.id}>
            <tr className="border-b border-line-faint hover:bg-raised/40">
              <td className="px-4 py-4"><div className="flex items-center gap-3">
                <Link href={`/growth/owned/${row.slug}${linkSuffix}`} className="text-left flex items-center gap-3 flex-1 group no-underline">
                {row.current?.thumbnail ? <img src={row.current.thumbnail} width={36} height={36} alt="" className="rounded-full shrink-0" /> :
                  <span aria-hidden className="w-9 h-9 rounded-full bg-raised text-muted flex items-center justify-center font-bold shrink-0">{row.identityVerified ? row.name[0] : '?'}</span>}
                <span><span className="font-bold group-hover:text-electric">{row.current?.title ?? row.name}</span>
                  <span className="block text-micro text-muted">{row.role} · {row.purpose}</span></span>
                </Link>
                <button type="button" onClick={() => setExpanded(expanded === row.id ? null : row.id)} aria-expanded={expanded === row.id} aria-controls={`channel-${row.id}`} aria-label={`Quick view: ${row.name}`} className="p-2 text-muted hover:text-ink"><span aria-hidden>{expanded === row.id ? '−' : '+'}</span></button>
              </div></td>
              <td className="px-4 py-4 tabular-nums font-semibold">{number(row.current?.subs)}<span className="block text-micro font-normal text-muted">{row.subs7d != null ? `${gain(row.subs7d)} in 7d` : 'Public count'}</span></td>
              <td className="px-4 py-4 tabular-nums font-semibold">{gain(row.views7d)}<span className="block text-micro font-normal text-muted">{row.views7d == null ? `${number(row.current?.views)} total views` : row.views7d < 0 ? 'Net count correction' : `${number(row.current?.views)} total views`}</span></td>
              <td className="px-4 py-4 tabular-nums font-semibold">{row.current ? `${row.covers30d ? '' : '≥'}${row.recent.length}` : '—'}
                <span className="block text-micro font-normal text-muted">{row.current ? `${number(row.recent.length / (30 / 7))} / week${row.covers30d ? '' : ' · partial'}` : 'No reading yet'}</span></td>
              <td className="px-4 py-4 tabular-nums font-semibold">{number(row.medianTrack)}<span className="block text-micro font-normal text-muted">{row.trackSample ? `n=${row.trackSample}${row.typicalCoverage ? '' : ' · partial'}` : 'Building a baseline'}</span></td>
              <td className="px-4 py-4 text-meta font-semibold whitespace-nowrap">{row.firstUpload ? date(row.firstUpload) : '—'}<span className="block text-micro font-normal text-muted">{row.firstUpload && row.current ? `${Math.floor((Date.parse(row.current.collectedAt) - Date.parse(row.firstUpload)) / 86400000)} days publishing` : row.current ? 'Full history needed' : 'Not collected'}</span></td>
              <td className="px-4 py-4 text-micro whitespace-nowrap"><span className={row.stale || !validChannelId(row.id) ? 'text-warn font-semibold' : 'text-muted'}>
                {!validChannelId(row.id) ? 'Check channel ID' : row.current ? (row.stale ? 'Stale reading' : date(row.current.collectedAt)) : 'Not collected'}</span></td>
            </tr>
            {expanded === row.id && <tr id={`channel-${row.id}`}><td colSpan={7} className="bg-raised/40 px-5 py-5 border-b border-line">
              <ChannelDetail row={row} />
            </td></tr>}
          </Fragment>)}</tbody>
        </table>
      </div>
      {!filtered.length && <div className="px-5 py-10 text-center text-body text-muted">No channels match. <button type="button" className="underline text-ink" onClick={() => { setSearch(''); setRole('All purposes'); }}>Clear filters</button></div>}
      <div className="px-4 py-3 text-micro text-muted bg-raised/50 border-t border-line">Typical track = median views to date on track uploads aged 7–30 days (sample size shown). Small samples are an early signal, not a performance grade. First upload is shown only when the public upload history is complete.</div>
    </div>

    <details className="mt-6 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">What this view measures</summary>
      <div className="grid md:grid-cols-3 gap-5 mt-4 leading-relaxed">
        <p><strong className="text-ink block mb-1">Scale and current listening</strong>Subscribers and lifetime views describe scale. Growth compares two channel totals about seven days apart; it is net public count change, including corrections. Subscriber gains are rounded public counts.</p>
        <p><strong className="text-ink block mb-1">Early upload response</strong>Typical track views use uploads aged 7–30 days. They have different time to accumulate views, so compare cautiously and read the sample size. A blank means it is too early or data is unavailable. There is no mature-network benchmark or pass/fail score.</p>
        <p><strong className="text-ink block mb-1">Formats and channel purpose</strong>Short-form means up to three minutes by duration; it does not confirm Shorts placement. Titles and duration suggest formats. Returning viewers, watch time, revenue and traffic to artist channels need channel analytics access.</p>
      </div>
    </details>
  </>;
}

function ChannelDetail({ row }: { row: OwnedRow }) {
  return <>
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><p className="font-bold text-body">{row.purpose}</p><p className="text-micro text-muted mt-1">{row.id}</p></div>
      {validChannelId(row.id) ? <a href={`https://www.youtube.com/channel/${row.id}`} target="_blank" rel="noopener noreferrer" className="text-meta font-semibold text-secondary">Open channel ↗</a> :
        <p className="text-meta text-warn">Supplied ID has {row.id.length} characters; expected 24. A corrected ID is needed.</p>}
    </div>
    {!row.current ? <p className="text-meta text-muted">{validChannelId(row.id) ? 'Channel identity verified. Collect a first reading to see uploads, formats and performance.' : 'This channel has not been resolved. No replacement has been assumed.'}</p> : <>
      <div className="grid md:grid-cols-3 gap-6">
        <div><h3 className="font-bold text-body mb-2">Publishing mix · 30d</h3>
          <div className="flex h-2 rounded-full overflow-hidden bg-line mb-3" aria-hidden>{row.formats.map((f, i) => <span key={f.label} className={formatColors[i]} style={{ width: `${row.recent.length ? f.count / row.recent.length * 100 : 0}%` }} />)}</div>
          <div className="space-y-2">{FORMAT_LABELS.map((label, i) => <div key={label} className="flex items-center gap-2 text-meta"><span className={`w-2 h-2 rounded-full ${formatColors[i]}`} />{label}<span className="ml-auto tabular-nums font-semibold">{row.formats[i].count}</span></div>)}</div>
          <p className="text-micro text-muted mt-3">{row.covers30d ? '30-day upload window covered.' : 'Partial window: counts are a lower bound.'} Short-form is a duration estimate.</p>
        </div>
        <div><h3 className="font-bold text-body mb-2">Launch footprint</h3>
          <p className="text-h3 font-black tabular-nums">{number(row.current.views)}</p>
          <p className="text-meta text-muted mt-1">channel views to date</p>
          <p className="text-micro text-muted mt-3">{row.firstUpload ? `First public upload: ${date(row.firstUpload)}.` : 'First public upload is not yet confirmed.'} {row.current.items.length} uploads in the reading.</p>
          <p className="text-micro text-muted mt-2">{row.current.reachedEnd ? 'All public uploads reached.' : row.current.reachedWindow ? '18-month window reached; earlier uploads are outside the sample.' : '300-upload cap reached; upload coverage may be partial.'}</p>
        </div>
        <div><h3 className="font-bold text-body mb-2">Early track response</h3>
          <p className="text-h3 font-black tabular-nums">{number(row.medianTrack)}</p>
          <p className="text-meta text-muted mt-1">median views to date · track uploads aged 7–30d</p>
          <p className="text-micro text-muted mt-3">{row.trackSample ? `${row.trackSample} eligible uploads${row.trackSample < 5 ? ' · small sample' : ''}. Each is between one week and one month old.` : 'No eligible uploads yet. Let uploads build a first week of listening before drawing conclusions.'}</p>
          <p className="text-micro text-muted mt-2">Use this as a channel’s early baseline. Genre, format, publication age and seasonal timing all affect the result.</p>
        </div>
      </div>
      <h3 className="font-bold text-body mt-6 mb-2">Uploads finding an audience <span className="text-muted font-normal">· lifetime views</span></h3>
      <ul className="divide-y divide-line-faint">{row.topVideos.map(v => <li key={v.id} className="py-2 flex gap-3 items-baseline text-meta">
        <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-ink font-semibold flex-1">{v.title} ↗</a>
        <span className="text-muted hidden md:block">{videoFormat(v)} · {date(v.publishedAt)}</span><span className="font-bold tabular-nums">{number(v.views)}</span>
      </li>)}</ul>
      {!row.topVideos.length && <p className="text-meta text-muted">No public uploads with view counts in this reading.</p>}
    </>}
  </>;
}
