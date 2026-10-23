'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { MATCH_STRENGTH, type Decision, type Opportunity, type OwnedUploadEvidence, type Stage } from '@/lib/labs/musicOpportunities/types';
import type { ChannelCoverage } from '@/lib/labs/musicOpportunities/catalogue';
import type { ObsIndexEntry } from '@/lib/labs/musicOpportunities/store';
import { CM_CHARTS, CM_TERRITORIES, DATA_API_REGIONS, type CmChart } from '@/lib/labs/musicOpportunities/sources/constants';
import { MANUAL_MEASURES } from '@/lib/labs/musicOpportunities/sources/manualImport';
import { DEMO_VIDEO_ID } from '@/lib/labs/musicOpportunities/demo';

const number = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const exact = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB').format(n);
const date = (at: string | null | undefined) => at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : '—';
const when = (at: string | null | undefined) => at ? new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '—';

const MEASURE_LABEL: Record<string, string> = {
  'most-popular-music-videos': 'Most popular music videos (Data API; measure unpublished)',
  'song-views-weekly': 'Top Songs · weekly views across official versions',
  'music-video-views-weekly': 'Top Music Videos · weekly views', 'music-video-views-daily': 'Top Music Videos · daily views',
  'shorts-creations-weekly': 'Top Songs on Shorts · weekly Shorts created', 'shorts-creations-daily': 'Top Songs on Shorts · daily Shorts created',
  'artist-views-weekly': 'Top Artists · weekly views', 'trending-new-releases': 'Trending · popularity since release',
};
const SOURCE_LABEL: Record<string, string> = { 'youtube-data-api': 'YouTube Data API', 'chartmetric': 'Chartmetric (licensed YouTube Charts)', 'manual-import': 'Manual import (charts.youtube.com)' };
const STAGE: Record<Stage, { label: string; cls: string; blurb: string }> = {
  'monitor': { label: 'Monitor', cls: 'bg-raised text-secondary border-line', blurb: 'A signal exists. No credible match yet, or a match that needs a human check.' },
  'act-editorially': { label: 'Act editorially', cls: 'bg-positive-soft text-positive border-positive/30', blurb: 'A credible match and a feasible editorial action.' },
  'consider-paid-test': { label: 'Consider a paid test', cls: 'bg-warn-soft text-warn border-warn/30', blurb: 'Verified recording, the signal held across readings, and an owned baseline exists. A gate for writing a hypothesis, not a recommendation to spend.' },
};

type ObsSummary = { id: string; source: string; measure: string; territory: string; period: string; periodLabel: string; collectedAt: string; rows: number; sourceUrl: string; note: string | null };
type Props = {
  opportunities: Opportunity[]; counts: { total: number; unmatched: number }; index: ObsIndexEntry[]; observations: ObsSummary[];
  coverage: ChannelCoverage[]; sourceCatalogue: { present: boolean; rows: number; importedAt: string | null; note: string | null };
  decisions: Decision[]; demo: Opportunity | null; demoReading: Pick<OwnedUploadEvidence, 'views' | 'readingAt' | 'gain'> | null;
  env: { storage: boolean; dataApi: boolean; chartmetric: boolean; readFailed: boolean; defaultRegions: string[] };
};

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: { error: 'Could not reach the preview server.' } }; }
}

export default function MusicOpportunitiesBoard({ opportunities, counts, index, observations, coverage, sourceCatalogue, decisions, demo, demoReading, env }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [regions, setRegions] = useState<string[]>(env.defaultRegions);
  const [cmChart, setCmChart] = useState<CmChart>('tracks');
  const [cmTerritory, setCmTerritory] = useState('GB');
  const say = (m: string) => setLog(l => [`${new Date().toLocaleTimeString('en-GB')} · ${m}`, ...l].slice(0, 12));

  async function readDataApi() {
    setBusy('dataapi');
    try {
      for (const region of regions) {
        const r = await post('/api/labs/music-opportunities/charts', { source: 'youtube-data-api', region });
        say(r.ok ? (r.data.cached ? `${region}: ${r.data.message}` : `${region}: ${r.data.rows} rows saved (${r.data.units} quota units)${r.data.replaced ? ', replacing today’s earlier reading' : ''}.`) : `${region}: ${r.data.error}`);
      }
      router.refresh();
    } finally { setBusy(null); }
  }
  async function readChartmetric() {
    setBusy('cm');
    try {
      const r = await post('/api/labs/music-opportunities/charts', { source: 'chartmetric', chart: cmChart, territory: cmTerritory });
      say(r.ok ? (r.data.cached ? String(r.data.message) : `Chartmetric ${cmChart} ${cmTerritory}: ${r.data.rows} rows, chart dated ${r.data.period}.`) : `Chartmetric: ${r.data.error}`);
      router.refresh();
    } finally { setBusy(null); }
  }
  async function indexUploads(ids: string[]) {
    setBusy('uploads');
    try {
      for (const id of ids) {
        const def = OWNED_CHANNELS.find(c => c.id === id)!;
        const r = await post('/api/labs/music-opportunities/uploads', { channelId: id });
        say(r.ok ? `${def.name}: ${r.data.incremental ? `${r.data.added} new, ` : ''}${exact(Number(r.data.total))} uploads indexed${r.data.complete ? '' : ' (incomplete: ceiling reached)'} · ${r.data.units} quota units.` : `${def.name}: ${r.data.error}`);
      }
      router.refresh();
    } finally { setBusy(null); }
  }

  const byStage = (s: Stage) => opportunities.filter(o => o.stage === s).length;
  const shown = stageFilter === 'all' ? opportunities : opportunities.filter(o => o.stage === stageFilter);
  const indexed = coverage.reduce((s, c) => s + (c.inventory?.count ?? c.ownedWorkingSet?.count ?? 0), 0) + sourceCatalogue.rows;
  const latestRows = observations.length ? counts.total : 0;

  return <>
    <div className="bg-surface border border-line rounded-card shadow-card grid grid-cols-2 lg:grid-cols-4 mb-7 overflow-hidden">
      {[
        ['Stored chart readings', exact(observations.length), `${index.length} source × chart × territory series`],
        ['Rows in latest readings', exact(latestRows), latestRows ? `${exact(counts.unmatched)} with no catalogue connection` : 'Nothing read yet'],
        ['Opportunities', exact(opportunities.length), `${byStage('act-editorially')} act · ${byStage('consider-paid-test')} paid-test gate · ${byStage('monitor')} monitor`],
        ['Catalogue rows indexed', exact(indexed), sourceCatalogue.present ? `${exact(sourceCatalogue.rows)} from a source catalogue` : 'Owned uploads only · no source catalogue'],
      ].map(([label, value, note], i) => <div key={label} className={`px-5 py-5 ${i ? 'border-l border-line-faint' : ''} ${i > 1 ? 'border-t lg:border-t-0 border-line-faint' : ''}`}>
        <p className="text-meta font-semibold text-secondary">{label}</p>
        <p className="mt-2 mb-2 text-kpi font-black tabular-nums">{value}</p>
        <p className="text-micro text-muted">{note}</p>
      </div>)}
    </div>

    {(env.readFailed || !env.storage) && <div className="mb-5 rounded-control border border-line bg-raised px-4 py-3 text-meta text-secondary">
      {env.readFailed ? 'Stored data could not be loaded. Nothing below is a zero result.' : 'Preview storage is not configured. Readings cannot be saved here.'}
    </div>}

    {/* ── Sources ───────────────────────────────────────────────── */}
    <section className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <div className="max-w-[680px]"><h2 className="text-h4 font-bold">Signals</h2>
          <p className="text-meta text-muted mt-1">Three ways in, each labelled by what it measures. Readings of the same chart period replace rather than duplicate.</p></div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border border-line rounded-card bg-surface p-4">
          <h3 className="font-bold text-body">YouTube Data API</h3>
          <p className="text-micro text-muted mt-1 mb-3">chart=mostPopular, Music category, by region. 1 quota unit per 50 rows; 2 per region. Not the YouTube Music Charts product: no measure, period or previous rank is published, so movement only appears across our own daily readings.</p>
          <div className="flex flex-wrap gap-1.5 mb-3">{DATA_API_REGIONS.map(r => <button key={r} type="button" onClick={() => setRegions(s => s.includes(r) ? s.filter(x => x !== r) : [...s, r])}
            className={`px-2 py-1 rounded-control border text-micro font-semibold ${regions.includes(r) ? 'bg-ink text-paper border-ink' : 'bg-surface border-line text-secondary'}`}>{r}</button>)}</div>
          <button type="button" disabled={!env.dataApi || !env.storage || !!busy || !regions.length} onClick={readDataApi}
            className="px-3 py-2 border border-line-strong rounded-control bg-surface text-body font-semibold disabled:opacity-50 hover:enabled:border-ink">{busy === 'dataapi' ? 'Reading…' : `Read ${regions.length} region${regions.length === 1 ? '' : 's'}`}</button>
          {!env.dataApi && <p className="text-micro text-warn mt-2">YouTube access is not configured in this environment.</p>}
        </div>
        <div className="border border-line rounded-card bg-surface p-4">
          <h3 className="font-bold text-body">Chartmetric · licensed YouTube Charts</h3>
          <p className="text-micro text-muted mt-1 mb-3">Weekly Top Songs (with ISRC), Top Music Videos (with video id) and Top Songs on Shorts (creations, not views). Updated Thursdays. Whether this plan includes chart endpoints is unverified: a refusal is shown as such.</p>
          <div className="flex gap-2 mb-3">
            <select value={cmChart} onChange={e => setCmChart(e.target.value as CmChart)} className="border border-line rounded-control bg-surface px-2 py-1.5 text-meta flex-1">
              {(Object.keys(CM_CHARTS) as CmChart[]).map(k => <option key={k} value={k}>{CM_CHARTS[k].label}</option>)}</select>
            <select value={cmTerritory} onChange={e => setCmTerritory(e.target.value)} className="border border-line rounded-control bg-surface px-2 py-1.5 text-meta">
              {CM_TERRITORIES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <button type="button" disabled={!env.chartmetric || !env.storage || !!busy} onClick={readChartmetric}
            className="px-3 py-2 border border-line-strong rounded-control bg-surface text-body font-semibold disabled:opacity-50 hover:enabled:border-ink">{busy === 'cm' ? 'Reading…' : 'Read chart'}</button>
          {!env.chartmetric && <p className="text-micro text-warn mt-2">Chartmetric is not configured in this environment.</p>}
        </div>
        <ManualImport busy={!!busy} setBusy={setBusy} say={say} storage={env.storage} />
      </div>
      <div aria-live="polite" className="mt-3 text-meta text-secondary space-y-0.5">{log.map((l, i) => <p key={i}>{l}</p>)}</div>

      {observations.length > 0 && <div className="mt-4 border border-line rounded-card bg-surface overflow-hidden">
        <table className="w-full text-left text-meta">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label"><tr>{['Source', 'Chart (measure)', 'Territory', 'Chart period', 'Rows', 'Collected'].map(t => <th key={t} className="px-4 py-2.5 font-bold">{t}</th>)}</tr></thead>
          <tbody>{[...observations].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)).slice(0, 40).map(o => <tr key={o.id} className="border-b border-line-faint">
            <td className="px-4 py-2.5"><a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{SOURCE_LABEL[o.source] ?? o.source} ↗</a>{o.note && <span className="block text-micro text-muted">{o.note}</span>}</td>
            <td className="px-4 py-2.5">{MEASURE_LABEL[o.measure] ?? o.measure}</td><td className="px-4 py-2.5 font-semibold">{o.territory}</td>
            <td className="px-4 py-2.5 tabular-nums">{o.period}</td><td className="px-4 py-2.5 tabular-nums">{o.rows}</td><td className="px-4 py-2.5 text-muted whitespace-nowrap">{when(o.collectedAt)}</td>
          </tr>)}</tbody>
        </table>
        {observations.length > 40 && <p className="px-4 py-2 text-micro text-muted">Showing the 40 most recent of {observations.length} stored readings.</p>}
      </div>}
    </section>

    {/* ── Opportunities ─────────────────────────────────────────── */}
    <section className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <div className="max-w-[680px]"><h2 className="text-h4 font-bold">Opportunities</h2>
          <p className="text-meta text-muted mt-1">One line per charted song with a connection to what we hold, from the latest reading of each chart. Older readings count towards persistence only.</p></div>
        <div className="flex gap-1.5">{(['all', 'consider-paid-test', 'act-editorially', 'monitor'] as const).map(s => <button key={s} type="button" onClick={() => setStageFilter(s)}
          className={`px-2.5 py-1.5 rounded-control border text-micro font-semibold ${stageFilter === s ? 'bg-ink text-paper border-ink' : 'bg-surface border-line text-secondary'}`}>{s === 'all' ? `All (${opportunities.length})` : `${STAGE[s].label} (${byStage(s)})`}</button>)}</div>
      </div>
      {!observations.length ? <Empty>No chart readings stored yet. Read a chart above, or paste one from charts.youtube.com.</Empty>
        : !opportunities.length ? <Empty>{counts.total} charted rows in the latest readings and no credible connection to the {exact(indexed)} catalogue rows indexed. That is a result: nothing we hold is behind current demand in these territories. Widen coverage by indexing more channels or importing a source catalogue.</Empty>
        : !shown.length ? <Empty>No opportunities at this stage.</Empty>
        : <div className="space-y-4">{shown.map(o => <OpportunityCard key={o.id} o={o} busy={!!busy} setBusy={setBusy} say={say} onSaved={() => router.refresh()} />)}</div>}
    </section>

    {/* ── Demonstration ────────────────────────────────────────── */}
    {demo && <section className="mb-8">
      <h2 className="text-h4 font-bold">Demonstration <span className="text-warn text-meta font-semibold ml-2">Invented chart entry · not a live finding</span></h2>
      <p className="text-meta text-muted mt-1 mb-3">What the matcher produces when a signal arrives for a song we already hold. The chart position below is made up. The upload, its stored reading and the match are real.</p>
      <OpportunityCard o={demo} busy demo setBusy={() => {}} say={() => {}} onSaved={() => {}} />
      <p className="text-micro text-muted mt-2">Stored reading for the real upload {DEMO_VIDEO_ID}: {demoReading?.views != null ? `${exact(demoReading.views)} lifetime views at ${when(demoReading.readingAt)}` : 'no owned reading held for this upload yet'}{demoReading?.gain ? ` · ${demoReading.gain.views >= 0 ? '+' : ''}${exact(demoReading.gain.views)} over ${demoReading.gain.days} days between readings` : ' · no earlier reading, so no movement can be stated'}. A lifetime counter cannot say when or why views arrived.</p>
    </section>}
    {!demo && <section className="mb-8"><h2 className="text-h4 font-bold">Demonstration</h2><Empty>The Folk and Nature upload used as the worked example is not in the indexed catalogue yet. Index that channel to see the match pipeline run against a real upload.</Empty></section>}

    {/* ── Catalogue coverage ───────────────────────────────────── */}
    <section className="mb-8">
      <h2 className="text-h4 font-bold">Catalogue coverage</h2>
      <p className="text-meta text-muted mt-1 mb-3">The matching source is the music already published on the owned channels, plus a verified source catalogue if one has been imported. Published uploads are never presented as everything we hold.</p>
      <div className="border border-line rounded-card bg-surface overflow-hidden">
        <table className="w-full text-left text-meta">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label"><tr>{['Channel', 'Rows the matcher uses', 'Inventory', 'YouTube public count', 'Last swept', ''].map(t => <th key={t} className="px-4 py-2.5 font-bold">{t}</th>)}</tr></thead>
          <tbody>{coverage.map(c => <tr key={c.slug} className="border-b border-line-faint">
            <td className="px-4 py-2.5 font-semibold">{c.name}{!c.identityVerified && <span className="block text-micro text-warn font-normal">Supplied ID has {c.channelId.length} characters; expected 24. Not matched.</span>}</td>
            <td className="px-4 py-2.5 tabular-nums">{c.using === 'inventory' ? exact(c.inventory!.count) : c.using === 'owned-working-set' ? `${exact(c.ownedWorkingSet!.count)} (working set)` : '0'}
              <span className="block text-micro text-muted">{c.using === 'inventory' ? 'Full title index' : c.using === 'owned-working-set' ? `Owned Channels newest/top sample from ${date(c.ownedWorkingSet!.readingAt)} — partial` : 'Nothing indexed'}</span></td>
            <td className="px-4 py-2.5">{c.inventory ? (c.inventory.complete ? 'Complete' : 'Incomplete · ceiling reached') : '—'}</td>
            <td className="px-4 py-2.5 tabular-nums">{exact(c.inventory?.videoCount)}</td>
            <td className="px-4 py-2.5 text-muted whitespace-nowrap">{c.inventory ? `${when(c.inventory.sweptAt)}${c.inventory.lastIncrementalAt ? ' · incremental' : ' · first sweep'}` : '—'}</td>
            <td className="px-4 py-2.5 text-right">{c.identityVerified && <button type="button" disabled={!env.dataApi || !env.storage || !!busy} onClick={() => indexUploads([c.channelId])} className="text-micro font-semibold text-secondary underline disabled:opacity-50">{c.inventory ? 'Update' : 'Index uploads'}</button>}</td>
          </tr>)}</tbody>
        </table>
        <div className="px-4 py-3 text-micro text-muted bg-raised/50 border-t border-line flex flex-wrap justify-between gap-3">
          <span>A first sweep reads every public upload at 1 quota unit per 50 (a 6,500-upload channel ≈ 130 units); updates stop at the first known upload. Titles only: views for matched uploads come from the Owned Channels readings.</span>
          <button type="button" disabled={!env.dataApi || !env.storage || !!busy} onClick={() => indexUploads(OWNED_CHANNELS.filter(c => validChannelId(c.id)).map(c => c.id))} className="font-semibold text-secondary underline disabled:opacity-50">{busy === 'uploads' ? 'Indexing…' : 'Index all nine'}</button>
        </div>
      </div>
      <div className="mt-3 text-meta text-secondary">
        <strong className="text-ink">Source catalogue:</strong> {sourceCatalogue.present ? `${exact(sourceCatalogue.rows)} rows imported ${when(sourceCatalogue.importedAt)}${sourceCatalogue.note ? ` · ${sourceCatalogue.note}` : ''}.` : 'none imported. No catalogue feed, ISRC list or rights export was found in the repository or the connected Drive, Dropbox and Airtable sources on 23 Oct 2026, so tier 2 (available but not yet published) is empty.'}
        <CatalogueImport busy={!!busy} setBusy={setBusy} say={say} storage={env.storage} />
      </div>
    </section>

    {/* ── Learning history ─────────────────────────────────────── */}
    <section className="mb-8">
      <h2 className="text-h4 font-bold">Learning history</h2>
      <p className="text-meta text-muted mt-1 mb-3">What was known when each decision was recorded, and later readings of the same uploads. A rise after an action is a comparison, not a cause.</p>
      {!decisions.length ? <Empty>No decisions recorded yet. Record one from an opportunity above; the evidence is frozen as it stood.</Empty>
        : <div className="space-y-3">{[...decisions].reverse().map(d => <div key={d.id} className="border border-line rounded-card bg-surface p-4 text-meta">
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <span><span className={`inline-block px-2 py-0.5 rounded-control border text-micro font-semibold mr-2 ${STAGE[d.stage].cls}`}>{STAGE[d.stage].label}</span><strong className="text-ink">{d.signal.title}</strong>{d.signal.artists.length ? ` — ${d.signal.artists.join(', ')}` : ''}</span>
            <span className="text-muted">Recorded {when(d.recordedAt)}</span></div>
          <p className="text-secondary">Signal then: #{d.signal.rank} · {d.signal.territory} · {d.signal.periodLabel}. Match: {d.matches.length ? d.matches.map(m => `${MATCH_STRENGTH[m.kind].label} → ${m.title}${m.channelName ? ` (${m.channelName})` : ''}`).join('; ') : 'none'}.</p>
          <p className="text-secondary mt-1"><strong className="text-ink">Suggested:</strong> {d.suggestedAction}</p>
          {d.actualAction && <p className="text-secondary mt-1"><strong className="text-ink">Done:</strong> {d.actualAction}</p>}
          {d.notes && <p className="text-muted mt-1">{d.notes}</p>}
          {d.test && <dl className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-micro">{Object.entries(d.test).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-ink capitalize">{k.replace(/([A-Z])/g, ' $1')}: </dt><dd className="inline text-secondary">{v}</dd></div>)}</dl>}
          {d.ownedUploads.length > 0 && <ul className="mt-2 space-y-1">{d.ownedUploads.map(u => {
            const later = d.followUps.filter(f => f.videoId === u.videoId).sort((a, b) => a.at.localeCompare(b.at));
            const last = later.at(-1);
            return <li key={u.videoId} className="text-micro text-secondary"><a href={`https://www.youtube.com/watch?v=${u.videoId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{u.title} ↗</a> · {u.channelName} · at decision: {exact(u.views)} views ({when(u.readingAt)})
              {last ? ` · latest: ${exact(last.views)} (${when(last.at)}, ${last.views != null && u.views != null ? `${last.views - u.views >= 0 ? '+' : ''}${exact(last.views - u.views)} over ${Math.round((Date.parse(last.at) - Date.parse(u.readingAt ?? d.recordedAt)) / 86400000)} days` : 'no comparison'})` : ' · no later reading yet'}</li>; })}</ul>}
        </div>)}</div>}
    </section>

    <details className="mt-6 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">Definitions and limits</summary>
      <div className="grid md:grid-cols-3 gap-5 mt-4 leading-relaxed">
        <p><strong className="text-ink block mb-1">Signals</strong>Each reading records source, chart, territory, chart period and collection time. A ranking is only the measure its source defines: Shorts charts rank Shorts created, not views. The Data API list is YouTube&rsquo;s own most-popular ranking with no published measure. Persistence counts distinct periods of the same chart; different sources are never pooled. Public data says nothing about impressions, retention, traffic source or audience geography.</p>
        <p><strong className="text-ink block mb-1">Matches</strong>Exact upload and ISRC are identifier matches. Title-and-artist, title-only and artist-only are text matches after normalisation and say so; they can be a different version, a cover or a shared title. Genre, language, era and rights arrive only from a source catalogue that states them. No credible match is a valid result. Nothing here infers artist relationships.</p>
        <p><strong className="text-ink block mb-1">Stages and spend</strong>Monitor, act editorially, consider a paid test. The third is a gate for writing a hypothesis: verified recording, signal held across readings, owned baseline. A chart entry alone never justifies spend. Budgets, returns and revenue are not estimated and cannot be recorded. Decisions freeze the evidence; later readings are appended for a like-for-like comparison, never as proof of cause.</p>
      </div>
    </details>
  </>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-line rounded-card px-5 py-8 text-center text-body text-muted">{children}</div>;
}

function OpportunityCard({ o, busy, demo, setBusy, say, onSaved }: { o: Opportunity; busy: boolean; demo?: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(o.stage);
  const [actualAction, setActualAction] = useState('');
  const [notes, setNotes] = useState('');
  const [test, setTest] = useState({ territory: o.signal.territory, whyTimely: '', creative: '', destination: '', organicBaseline: '', learningGoal: '', successCriteria: '', stopCriteria: '' });
  const best = o.matches[0];
  const movement = o.signal.previousRank != null ? (o.signal.previousRank === o.signal.rank ? 'unchanged' : o.signal.previousRank > o.signal.rank ? `up from #${o.signal.previousRank}` : `down from #${o.signal.previousRank}`) : o.signal.isNew ? 'new entry' : 'movement not published';
  async function save() {
    setBusy('decision');
    try {
      const r = await post('/api/labs/music-opportunities/decisions', { opportunityId: o.id, stage, actualAction, notes, test: stage === 'consider-paid-test' ? test : undefined });
      say(r.ok ? `Decision recorded for "${o.signal.title}".` : `Decision: ${r.data.error}`);
      if (r.ok) { setOpen(false); onSaved(); }
    } finally { setBusy(null); }
  }
  return <article className={`border rounded-card bg-surface p-5 ${demo ? 'border-dashed border-warn/50' : 'border-line shadow-card'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <span className={`inline-block px-2 py-0.5 rounded-control border text-micro font-semibold ${STAGE[o.stage].cls}`}>{STAGE[o.stage].label}</span>
        <h3 className="text-h4 font-bold mt-2"><strong>{o.signal.title}</strong>{o.signal.artists.length ? <span className="text-secondary font-semibold"> — {o.signal.artists.join(', ')}</span> : null} <span className="text-secondary font-normal">is #{o.signal.rank} in {o.signal.territory}</span></h3>
        <p className="text-meta text-muted mt-1">{MEASURE_LABEL[o.signal.measure] ?? o.signal.measure} · {o.signal.periodLabel} · {movement}{o.signal.periodsOnChart != null ? ` · ${o.signal.periodsOnChart} period${o.signal.periodsOnChart === 1 ? '' : 's'} on chart` : ''}{o.signal.measureValue != null ? ` · ${number(o.signal.measureValue)} in the chart's measure` : ''}</p>
        <p className="text-micro text-muted mt-0.5"><a href={o.signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_LABEL[o.signal.source]} ↗</a> · collected {when(o.signal.collectedAt)}{o.signal.videoId && <> · <a href={`https://www.youtube.com/watch?v=${o.signal.videoId}`} target="_blank" rel="noopener noreferrer" className="underline">charted video ↗</a>{o.signal.channelTitle ? ` (${o.signal.channelTitle})` : ''}</>}{o.signal.isrc ? ` · ISRC ${o.signal.isrc}` : ''}</p>
      </div>
      <div className="text-right text-micro text-muted shrink-0">
        <p className="font-semibold text-ink">{o.persistence.periods} reading{o.persistence.periods === 1 ? '' : 's'} of this chart</p>
        <p>{o.persistence.periods > 1 ? `${o.persistence.firstSeen} → ${o.persistence.lastSeen}` : 'single reading'}{o.persistence.territories.length > 1 ? ` · also ${o.persistence.territories.filter(t => t !== o.signal.territory).join(', ')}` : ''}</p>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-5 mt-4">
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">We hold</p>
        <ul className="space-y-2">{o.matches.map(m => <li key={m.track.id} className="text-meta">
          <span className={`inline-block px-1.5 py-0.5 rounded-control border text-micro font-semibold mr-2 ${m.kind === 'exact-upload' || m.kind === 'isrc' ? 'bg-positive-soft text-positive border-positive/30' : m.kind === 'title-artist' ? 'bg-raised text-ink border-line' : 'bg-warn-soft text-warn border-warn/30'}`}>{MATCH_STRENGTH[m.kind].label}</span>
          {m.track.videoId ? <a href={`https://www.youtube.com/watch?v=${m.track.videoId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{m.track.title} ↗</a> : <span className="font-semibold text-ink">{m.track.title}{m.track.artist ? ` — ${m.track.artist}` : ''}</span>}
          <span className="block text-micro text-muted">{m.track.origin === 'owned-upload' ? `On ${m.track.channelName} · published ${date(m.track.publishedAt)}` : `Source catalogue · not on an owned channel${m.track.rightsNote ? ` · rights: ${m.track.rightsNote}` : ''}${m.track.genre ? ` · ${m.track.genre}` : ''}${m.track.language ? ` · ${m.track.language}` : ''}`}{m.track.version ? ` · "${m.track.version}"` : ''}</span>
          <span className="block text-micro text-faint">{m.evidence}</span>
        </li>)}</ul>
        {o.ownedUploads.length > 0 && <>
          <p className="text-micro font-bold uppercase tracking-label text-muted mt-4 mb-1.5">Owned-upload readings</p>
          <ul className="space-y-1">{o.ownedUploads.map(u => <li key={u.videoId} className="text-meta tabular-nums">
            <span className="font-semibold">{u.views != null ? exact(u.views) : '—'}</span> <span className="text-muted">lifetime views {u.readingAt ? `at ${when(u.readingAt)}` : '· no owned reading for this upload'} · <a href={`https://www.youtube.com/watch?v=${u.videoId}`} target="_blank" rel="noopener noreferrer" className="underline">{u.title}</a> · {MATCH_STRENGTH[u.matchKind].label.toLowerCase()}</span>
            {u.gain ? <span className="block text-micro text-secondary">{u.gain.views >= 0 ? '+' : ''}{exact(u.gain.views)} between readings {u.gain.days} days apart (from {when(u.gain.baselineAt)}). Measured, not extrapolated.</span>
              : <span className="block text-micro text-muted">No earlier owned reading: a baseline, not growth.</span>}
          </li>)}</ul></>}
      </div>
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">Suggested action</p>
        <p className="text-body font-semibold">{o.action}</p>
        <p className="text-micro text-muted mt-1">{STAGE[o.stage].blurb}</p>
        <p className="text-micro font-bold uppercase tracking-label text-muted mt-4 mb-1.5">Unknown</p>
        <ul className="list-disc pl-4 text-micro text-secondary space-y-0.5">{o.unknowns.map(u => <li key={u}>{u}</li>)}</ul>
        {!demo && <div className="mt-4">
          {!open ? <button type="button" disabled={busy} onClick={() => setOpen(true)} className="px-3 py-1.5 border border-line-strong rounded-control bg-surface text-meta font-semibold disabled:opacity-50 hover:enabled:border-ink">Record a decision</button>
            : <div className="border border-line rounded-card bg-raised/40 p-3 text-meta space-y-2">
              <label className="block">Stage<select value={stage} onChange={e => setStage(e.target.value as Stage)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full">
                {(Object.keys(STAGE) as Stage[]).map(s => <option key={s} value={s}>{STAGE[s].label}</option>)}</select></label>
              <label className="block">What was actually done (optional)<input value={actualAction} onChange={e => setActualAction(e.target.value)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full" placeholder="e.g. pinned to channel home on 24 Oct" /></label>
              <label className="block">Notes (optional)<input value={notes} onChange={e => setNotes(e.target.value)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full" /></label>
              {stage === 'consider-paid-test' && <div className="grid sm:grid-cols-2 gap-2">
                {([['territory', 'Territory'], ['whyTimely', 'Why this is timely'], ['creative', 'Creative'], ['destination', 'Destination'], ['organicBaseline', 'Organic baseline'], ['learningGoal', 'What we want to learn'], ['successCriteria', 'Success criteria'], ['stopCriteria', 'Stop criteria']] as const).map(([k, label]) =>
                  <label key={k} className="block text-micro">{label}<input value={test[k]} onChange={e => setTest(t => ({ ...t, [k]: e.target.value }))} className="block mt-0.5 border border-line rounded-control bg-surface px-2 py-1.5 w-full text-meta" /></label>)}
                <p className="sm:col-span-2 text-micro text-muted">No budgets, expected returns or revenue. Keep paid and organic results separate when the test runs.</p>
              </div>}
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={save} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper text-meta font-semibold disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-meta text-secondary">Cancel</button></div>
            </div>}
        </div>}
      </div>
    </div>
  </article>;
}

function ManualImport({ busy, setBusy, say, storage }: { busy: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; storage: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ measure: 'song-views-weekly', territory: 'GB', period: '', sourceUrl: 'https://charts.youtube.com/', note: '', text: '' });
  async function submit() {
    setBusy('import');
    try {
      const r = await post('/api/labs/music-opportunities/import', { kind: 'chart', ...form });
      say(r.ok ? `Manual import: ${r.data.rows} rows saved as ${form.territory} ${form.measure} for ${form.period}${(r.data.warnings as string[])?.length ? ` · ${(r.data.warnings as string[]).join(' ')}` : ''}.` : `Manual import: ${r.data.error}`);
      if (r.ok) { setOpen(false); setForm(f => ({ ...f, text: '' })); }
    } finally { setBusy(null); }
  }
  return <div className="border border-line rounded-card bg-surface p-4">
    <h3 className="font-bold text-body">Manual import · charts.youtube.com</h3>
    <p className="text-micro text-muted mt-1 mb-3">YouTube Charts has no documented public API. Export or copy a chart there, state the chart type, territory and period shown on the page, and paste. Stored as a manual import with your note.</p>
    {!open ? <button type="button" disabled={busy || !storage} onClick={() => setOpen(true)} className="px-3 py-2 border border-line-strong rounded-control bg-surface text-body font-semibold disabled:opacity-50 hover:enabled:border-ink">Paste a chart</button>
      : <div className="space-y-2 text-meta">
        <select value={form.measure} onChange={e => setForm(f => ({ ...f, measure: e.target.value }))} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full">{MANUAL_MEASURES.map(m => <option key={m.id} value={m.id}>{m.label} · {m.measureName}</option>)}</select>
        <div className="flex gap-2"><input value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value.toUpperCase() }))} placeholder="GB" maxLength={6} className="border border-line rounded-control bg-surface px-2 py-1.5 w-24" />
          <input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="Chart period YYYY-MM-DD" className="border border-line rounded-control bg-surface px-2 py-1.5 flex-1" /></div>
        <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="Source URL" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full" />
        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note: who imported, from what" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full" />
        <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} rows={6} placeholder={'Rank,Previous Rank,Track Name,Artist Names,Periods on Chart,Views,YouTube URL\n1,2,Song,Artist,3,1234567,https://youtube.com/watch?v=...'} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full font-mono text-micro" />
        <div className="flex gap-2"><button type="button" disabled={busy || !form.text || !form.period} onClick={submit} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper font-semibold disabled:opacity-50">Import</button><button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-secondary">Cancel</button></div>
      </div>}
  </div>;
}

function CatalogueImport({ busy, setBusy, say, storage }: { busy: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; storage: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(''); const [note, setNote] = useState('');
  async function submit() {
    setBusy('catalogue');
    try {
      const r = await post('/api/labs/music-opportunities/import', { kind: 'catalogue', text, note });
      say(r.ok ? `Source catalogue: ${r.data.rows} rows imported (${r.data.skipped} skipped; columns ${(r.data.columns as string[]).join(', ')})${r.data.capped ? ' · capped at 5,000' : ''}.` : `Source catalogue: ${r.data.error}`);
      if (r.ok) { setOpen(false); setText(''); }
    } finally { setBusy(null); }
  }
  return <div className="mt-2">
    {!open ? <button type="button" disabled={busy || !storage} onClick={() => setOpen(true)} className="text-micro font-semibold text-secondary underline disabled:opacity-50">Import a source catalogue (CSV/TSV with title, artist; optional isrc, version, genre, language, year, territories, rights)</button>
      : <div className="space-y-2 mt-2 max-w-[720px]">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note: which export, from whom, when" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full text-meta" />
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={'isrc,title,artist,version,genre,language,year,territories,rights'} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full font-mono text-micro" />
        <div className="flex gap-2"><button type="button" disabled={busy || !text} onClick={submit} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper text-meta font-semibold disabled:opacity-50">Import (replaces the previous import)</button><button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-meta text-secondary">Cancel</button></div>
      </div>}
  </div>;
}
