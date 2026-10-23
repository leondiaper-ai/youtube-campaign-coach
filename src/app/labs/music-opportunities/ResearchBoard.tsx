'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OWNED_CHANNELS, validChannelId } from '@/lib/ownedChannels/channels';
import { MATCH_STRENGTH, VOCAB, type ContextualMatch, type Decision, type Dimension, type Label, type Opportunity, type Pattern, type Persistence, type Provenance, type Stage } from '@/lib/labs/musicOpportunities/types';
import type { ChannelCoverage } from '@/lib/labs/musicOpportunities/catalogue';
import type { Finding } from '@/lib/labs/musicOpportunities/findings';
import { CHART_TYPES, chartPageUrl } from '@/lib/labs/musicOpportunities/sources/youtubeCharts';
import { MANUAL_MEASURES } from '@/lib/labs/musicOpportunities/sources/manualImport';

const exact = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB').format(n);
const compact = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const date = (at: string | null | undefined) => at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : '—';
const when = (at: string | null | undefined) => at ? new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '—';
const pct = (n: number | null | undefined) => n == null ? '—' : `${Math.round(n * 100)}%`;

const MEASURE_LABEL: Record<string, string> = {
  'song-views-weekly': 'Top Songs · weekly views across official versions',
  'music-video-views-weekly': 'Top Music Videos · weekly views of the video', 'music-video-views-daily': 'Top Music Videos · daily views',
  'shorts-creations-weekly': 'Top Songs on Shorts · weekly Shorts created (count not published)', 'shorts-creations-daily': 'Top Songs on Shorts · daily Shorts created',
  'artist-views-weekly': 'Top Artists · weekly views', 'trending-new-releases': 'Trending · popularity since release',
};
const SHORT: Record<string, string> = { 'song-views-weekly': 'Songs', 'music-video-views-weekly': 'Music Videos', 'music-video-views-daily': 'Music Videos (daily)', 'shorts-creations-weekly': 'Shorts songs', 'shorts-creations-daily': 'Shorts songs (daily)', 'artist-views-weekly': 'Artists', 'trending-new-releases': 'Trending' };
const SOURCE_LABEL: Record<string, string> = { 'youtube-charts-page': 'charts.youtube.com (page read)', 'manual-import': 'Manual import' };
const STAGE: Record<Stage, { label: string; cls: string; blurb: string }> = {
  'monitor': { label: 'Monitor', cls: 'bg-raised text-secondary border-line', blurb: 'A signal exists. No credible match yet, or a match that needs a human check.' },
  'act-editorially': { label: 'Act editorially', cls: 'bg-positive-soft text-positive border-positive/30', blurb: 'A credible match and a feasible editorial action.' },
  'consider-paid-test': { label: 'Consider a paid test', cls: 'bg-warn-soft text-warn border-warn/30', blurb: 'Verified recording, the signal held across comparable readings, and the verified upload has its own owned baseline. A gate for writing a hypothesis, not a recommendation to spend.' },
};
const PROV: Record<Provenance, string> = { human: 'bg-positive-soft text-positive border-positive/30', verified: 'bg-raised text-ink border-line-strong', inferred: 'bg-warn-soft text-warn border-warn/30' };

export type SongView = {
  key: string; title: string; artists: string[]; releaseDate: string | null; labels: Label[]; linkedVideoIds: string[]; persistence: Persistence;
  appearances: { measure: string; territory: string; period: string; rank: number; previousRank: number | null; measureValue: number | null; periodsOnChart: number | null }[];
};
type VideoView = Omit<SongView, 'key' | 'linkedVideoIds' | 'persistence'> & { videoId: string; songKey: string | null };
type ObsSummary = { id: string; source: string; measure: string; territory: string; period: string; periodLabel: string; collectedAt: string; rows: number; sourceUrl: string; note: string | null };
type Props = {
  findings: Finding[]; patterns: Pattern[]; opportunities: Opportunity[]; contextual: ContextualMatch[]; counts: { total: number; unmatched: number };
  observations: ObsSummary[]; series: { measure: string; territory: string; periods: string[] }[]; songs: SongView[]; videos: VideoView[]; latestRowCount: number;
  labelCoverage: { dimension: Dimension; labelled: number; total: number; byProvenance: Record<Provenance, number> }[];
  coverage: ChannelCoverage[]; sourceCatalogue: { present: boolean; rows: number; importedAt: string | null; note: string | null };
  decisions: Decision[]; humanLabelCount: number;
  env: { storage: boolean; dataApi: boolean; readFailed: boolean };
};

async function post(path: string, body: unknown, method = 'POST'): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: { error: 'Could not reach the preview server.' } }; }
}

export default function ResearchBoard(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState<{ kind: string; id: string } | null>(null);
  const say = (m: string) => setLog(l => [`${new Date().toLocaleTimeString('en-GB')} · ${m}`, ...l].slice(0, 12));
  const songByKey = new Map(p.songs.map(s => [s.key, s]));
  const videoById = new Map(p.videos.map(v => [v.videoId, v]));
  const byQuestion = (q: Finding['question']) => p.findings.filter(f => f.question === q);
  const indexed = p.coverage.reduce((s, c) => s + c.rows, 0) + p.sourceCatalogue.rows;
  const main = p.opportunities.filter(o => o.matches[0].kind !== 'title-only');
  const sharedTitles = p.opportunities.filter(o => o.matches[0].kind === 'title-only');
  const nonBaseline = p.patterns.filter(x => !x.baseline);
  const baselines = p.patterns.filter(x => x.baseline);

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

  const openRef = (ref: Finding['refs'][number]) => setOpen({ kind: ref.kind, id: ref.id });

  return <>
    {/* ── Headline numbers ──────────────────────────────────────── */}
    <div className="bg-surface border border-line rounded-card shadow-card grid grid-cols-2 lg:grid-cols-4 mb-7 overflow-hidden">
      {[
        ['Chart readings stored', exact(p.observations.length), `${p.series.length} chart × territory series · ${p.series.reduce((s, x) => s + x.periods.length, 0)} chart weeks`],
        ['Songs and videos in the bank', `${exact(p.songs.length)} · ${exact(p.videos.length)}`, `${exact(p.latestRowCount)} rows in the latest readings`],
        ['Direct connections', exact(main.length), `${p.opportunities.filter(o => ['exact-upload', 'isrc'].includes(o.matches[0].kind)).length} verified recording · ${p.opportunities.filter(o => o.matches[0].kind === 'title-artist').length} same composition · ${p.opportunities.filter(o => o.matches[0].kind === 'artist').length} artist only`],
        ['Catalogue rows indexed', exact(indexed), `${p.coverage.filter(c => c.rows).length} of ${p.coverage.filter(c => c.identityVerified).length} channels · ${p.sourceCatalogue.present ? `${exact(p.sourceCatalogue.rows)} source-catalogue rows` : 'no source catalogue yet'}`],
      ].map(([label, value, note], i) => <div key={label} className={`px-5 py-5 ${i ? 'border-l border-line-faint' : ''} ${i > 1 ? 'border-t lg:border-t-0 border-line-faint' : ''}`}>
        <p className="text-meta font-semibold text-secondary">{label}</p>
        <p className="mt-2 mb-2 text-kpi font-black tabular-nums">{value}</p>
        <p className="text-micro text-muted">{note}</p>
      </div>)}
    </div>
    {(p.env.readFailed || !p.env.storage) && <div className="mb-5 rounded-control border border-line bg-raised px-4 py-3 text-meta text-secondary">
      {p.env.readFailed ? 'Stored data could not be loaded; the committed readings and inventory snapshots are shown. Nothing below is a zero result.' : 'Preview storage is not configured: imports, labels and decisions cannot be saved here. Committed readings and snapshots still show.'}
    </div>}

    {/* ── 1. What demand are we seeing? ────────────────────────── */}
    <Section n="1" title="What demand are we seeing on YouTube?" lede="Findings from the stored chart readings, each with its numbers and what it does not show. Click an entry to inspect the song behind it.">
      <div className="space-y-3">{byQuestion('demand').map(f => <FindingCard key={f.id} f={f} onRef={openRef} />)}</div>
      <details className="mt-4 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
        <summary className="font-semibold text-ink cursor-pointer">Recurring labels by chart and territory <span className="text-muted font-normal">· {nonBaseline.length} patterns clear the floor ({baselines.length} baseline labels set aside)</span></summary>
        <p className="text-micro text-muted mt-2">A pattern needs at least 5 songs/videos from 3 artists in the latest reading of one chart. Share is of rows that carry a label on that dimension, not of all rows. A label on 80% or more of labelled rows, or a chart&rsquo;s own language, is the chart&rsquo;s baseline and is listed separately. &ldquo;Recurring among the chart entries observed&rdquo; is the strongest claim any of these supports.</p>
        <div className="overflow-x-auto mt-3"><table className="w-full min-w-[900px] text-left text-meta">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label"><tr>{['Label', 'Chart · territory', 'Songs/videos', 'Artists', 'Share of labelled', 'Top artist share', 'Present every week', 'Labels (h/v/i)', ''].map(t => <th key={t} className="px-3 py-2 font-bold">{t}</th>)}</tr></thead>
          <tbody>{nonBaseline.map(x => <Fragment key={x.id}><tr className="border-b border-line-faint">
            <td className="px-3 py-2 font-semibold">{x.value} <span className="text-micro text-muted font-normal">{x.dimension}</span></td>
            <td className="px-3 py-2">{SHORT[x.measure]} · {x.territory}</td>
            <td className="px-3 py-2 tabular-nums">{x.entities}</td><td className="px-3 py-2 tabular-nums">{x.artists}</td>
            <td className="px-3 py-2 tabular-nums">{pct(x.share)} <span className="text-micro text-muted">of {x.labelledRows}/{x.totalRows}</span></td>
            <td className="px-3 py-2 tabular-nums">{pct(x.topArtistShare)} <span className="text-micro text-muted">{x.topArtist}</span></td>
            <td className="px-3 py-2 tabular-nums">{x.persistentEntities == null ? <span className="text-muted">1 week stored</span> : `${x.persistentEntities}/${x.entities} · ${x.periodsObserved} wks`}</td>
            <td className="px-3 py-2 tabular-nums text-micro">{x.provenance.human}/{x.provenance.verified}/{x.provenance.inferred}</td>
            <td className="px-3 py-2 text-right"><button type="button" onClick={() => setOpen(open?.id === x.id ? null : { kind: 'pattern', id: x.id })} className="text-micro font-semibold text-secondary underline">{open?.id === x.id ? 'Hide' : 'Entries'}</button></td>
          </tr>{open?.kind === 'pattern' && open.id === x.id && <tr><td colSpan={9} className="bg-raised/40 px-4 py-3 border-b border-line">
            <ul className="text-meta space-y-1">{x.examples.map(e => <li key={`${e.rank}-${e.title}`}>#{e.rank} <button type="button" className="font-semibold text-ink underline" onClick={() => setOpen({ kind: 'song', id: e.songKey })}>{e.title}</button> — {e.artists.join(', ')}{e.videoId && <> · <a href={`https://www.youtube.com/watch?v=${e.videoId}`} target="_blank" rel="noopener noreferrer" className="text-micro underline">video ↗</a></>}</li>)}</ul>
            <ul className="list-disc pl-4 mt-2 text-micro text-secondary space-y-0.5">{x.caveats.map(c => <li key={c}>{c}</li>)}</ul>
          </td></tr>}</Fragment>)}</tbody>
        </table></div>
        {baselines.length > 0 && <p className="text-micro text-muted mt-3"><strong className="text-ink">Baselines (not patterns):</strong> {baselines.map(b => `${b.value} is ${pct(b.share)} of ${b.dimension}-labelled rows in ${b.territory} ${SHORT[b.measure]}`).join(' · ')}.</p>}
      </details>
      <details className="mt-3 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
        <summary className="font-semibold text-ink cursor-pointer">Readings in the bank <span className="text-muted font-normal">· {p.observations.length} readings · collection date kept separate from chart period</span></summary>
        <div className="overflow-x-auto mt-3"><table className="w-full text-left text-meta">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label"><tr>{['Source', 'Chart (measure)', 'Territory', 'Chart period', 'Rows', 'Collected by us'].map(t => <th key={t} className="px-3 py-2 font-bold">{t}</th>)}</tr></thead>
          <tbody>{[...p.observations].sort((a, b) => b.period.localeCompare(a.period) || a.territory.localeCompare(b.territory)).map(o => <tr key={o.id} className="border-b border-line-faint">
            <td className="px-3 py-2"><a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{SOURCE_LABEL[o.source] ?? o.source} ↗</a>{o.note && <span className="block text-micro text-muted max-w-[420px]">{o.note}</span>}</td>
            <td className="px-3 py-2">{MEASURE_LABEL[o.measure] ?? o.measure}</td><td className="px-3 py-2 font-semibold">{o.territory}</td>
            <td className="px-3 py-2 tabular-nums whitespace-nowrap">{o.periodLabel}</td><td className="px-3 py-2 tabular-nums">{o.rows}</td><td className="px-3 py-2 text-muted whitespace-nowrap">{when(o.collectedAt)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold text-ink text-body">Add a reading</h4>
            <p className="text-micro text-muted mt-1">charts.youtube.com has no documented public API, and the Data API&rsquo;s most-popular list is a different product, so it is not used as a substitute. Open the dated chart page, use its Download control or copy the table, and paste below. Each weekly chart is published on Thursdays. Dated pages:</p>
            <ul className="text-micro mt-2 space-y-0.5">{(Object.keys(CHART_TYPES) as (keyof typeof CHART_TYPES)[]).map(k => <li key={k}><a href={chartPageUrl(k, 'gb')} target="_blank" rel="noopener noreferrer" className="underline">{CHART_TYPES[k].label} · GB ↗</a> <span className="text-muted">({CHART_TYPES[k].measureName})</span></li>)}</ul>
            <p className="text-micro text-muted mt-2">Label coverage of the latest rows: {p.labelCoverage.map(c => `${c.dimension} ${c.labelled}/${c.total}`).join(' · ')}. Human labels stored: {p.humanLabelCount}.</p>
          </div>
          <ManualImport busy={!!busy} setBusy={setBusy} say={say} storage={p.env.storage} onDone={() => router.refresh()} />
        </div>
      </details>
    </Section>

    {/* ── 2. Which of our music fits? ───────────────────────────── */}
    <Section n="2" title="Which of our music fits, and how strong is the connection?" lede="Direct connections are a recording, composition or artist we hold. Contextual connections are a recurring chart label a channel already programmes — hypotheses, and weaker.">
      <div className="space-y-3">{byQuestion('fit').map(f => <FindingCard key={f.id} f={f} onRef={openRef} />)}</div>
      <h3 className="text-body font-bold mt-6 mb-2">Direct connections <span className="text-muted font-normal">· {main.length} · strongest first</span></h3>
      {!main.length ? <Empty>{p.observations.length ? `${p.counts.total} charted rows in the latest readings and no recording, composition or artist connection to the ${exact(indexed)} catalogue rows indexed. That is a result.` : 'No chart readings yet.'}</Empty>
        : <div className="space-y-3">{main.slice(0, 24).map(o => <OpportunityCard key={o.id} o={o} busy={!!busy} setBusy={setBusy} say={say} onSaved={() => router.refresh()} onInspect={k => setOpen({ kind: 'song', id: k })} highlighted={open?.kind === 'opportunity' && open.id === o.id} />)}
          {main.length > 24 && <p className="text-micro text-muted">Showing 24 of {main.length}.</p>}</div>}
      {sharedTitles.length > 0 && <details className="mt-3 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
        <summary className="font-semibold text-ink cursor-pointer">Shared titles only <span className="text-muted font-normal">· {sharedTitles.length} · almost always different songs; kept out of the main list</span></summary>
        <ul className="mt-2 space-y-1 text-micro">{sharedTitles.map(o => <li key={o.id}>#{o.signal.rank} {o.signal.title} — {o.signal.artists.join(', ')} ({o.signal.territory} {SHORT[o.signal.measure]}) ↔ <a href={`https://www.youtube.com/watch?v=${o.matches[0].track.videoId}`} target="_blank" rel="noopener noreferrer" className="underline">{o.matches[0].track.title}</a> on {o.matches[0].track.channelName}</li>)}</ul>
      </details>}
      <h3 className="text-body font-bold mt-6 mb-2">Contextual connections <span className="text-muted font-normal">· {p.contextual.length} · hypotheses</span></h3>
      {!p.contextual.length ? <Empty>No recurring label (outside each chart&rsquo;s baseline) is carried by at least 3 uploads and 10% of a channel&rsquo;s labelled catalogue.</Empty>
        : <div className="grid md:grid-cols-2 gap-3">{p.contextual.slice(0, 8).map(c => { const pat = p.patterns.find(x => x.id === c.patternId)!; return <article key={`${c.patternId}|${c.channelSlug}`} className={`border rounded-card bg-surface p-4 ${open?.kind === 'contextual' && open.id === `${c.patternId}|${c.channelSlug}` ? 'border-ink' : 'border-line'}`}>
          <p className="text-meta"><strong className="text-ink">{pat.value}</strong> <span className="text-muted">{pat.dimension} · recurs in {pat.territory} {SHORT[pat.measure]} ({pat.entities} songs/videos, {pat.artists} artists)</span></p>
          <p className="text-meta mt-1"><strong className="text-ink">{c.channelName}</strong> carries it on {pct(c.channelShare)} of its {exact(c.channelLabelled)} {pat.dimension}-labelled uploads ({exact(c.channelTotal)} indexed).</p>
          <ul className="mt-2 space-y-0.5 text-micro">{c.tracks.slice(0, 5).map(t => <li key={t.track.id}><a href={`https://www.youtube.com/watch?v=${t.track.videoId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{t.track.title} ↗</a> · {exact(t.track.views)} views · <span className={`px-1 rounded-control border ${PROV[t.label.provenance]}`}>{t.label.provenance}</span></li>)}</ul>
          <p className="text-micro text-secondary mt-2">{c.hypothesis}</p>
          <ul className="list-disc pl-4 mt-1 text-micro text-muted space-y-0.5">{c.caveats.map(x => <li key={x}>{x}</li>)}</ul>
        </article>; })}</div>}
    </Section>

    {/* ── 3. What should we investigate or test? ────────────────── */}
    <Section n="3" title="What should we investigate or test?" lede="Stages, not scores: monitor; act editorially; consider a paid test. The third is a gate for writing a hypothesis down, and nothing here spends.">
      <div className="space-y-3">{byQuestion('next').map(f => <FindingCard key={f.id} f={f} onRef={openRef} />)}</div>
      <h3 className="text-body font-bold mt-6 mb-2">Learning history <span className="text-muted font-normal">· {p.decisions.length} decisions</span></h3>
      {!p.decisions.length ? <Empty>No decisions recorded yet. Record one from a direct connection above; the signal, match and owned-upload figures are frozen as they stood, and later readings are appended for a like-for-like comparison.</Empty>
        : <div className="space-y-3">{[...p.decisions].reverse().map(d => <div key={d.id} className="border border-line rounded-card bg-surface p-4 text-meta">
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <span><span className={`inline-block px-2 py-0.5 rounded-control border text-micro font-semibold mr-2 ${STAGE[d.stage].cls}`}>{STAGE[d.stage].label}</span><strong className="text-ink">{d.signal.title}</strong>{d.signal.artists.length ? ` — ${d.signal.artists.join(', ')}` : ''}</span>
            <span className="text-muted">Recorded {when(d.recordedAt)}</span></div>
          <p className="text-secondary">Signal then: #{d.signal.rank} · {d.signal.territory} · {d.signal.periodLabel}. Match: {d.matches.map(m => `${MATCH_STRENGTH[m.kind].label} → ${m.title}${m.channelName ? ` (${m.channelName})` : ''}`).join('; ') || 'none'}.</p>
          <p className="text-secondary mt-1"><strong className="text-ink">Suggested:</strong> {d.suggestedAction}</p>
          {d.actualAction && <p className="text-secondary mt-1"><strong className="text-ink">Done:</strong> {d.actualAction}</p>}
          {d.notes && <p className="text-muted mt-1">{d.notes}</p>}
          {d.test && <dl className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-micro">{Object.entries(d.test).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-ink capitalize">{k.replace(/([A-Z])/g, ' $1')}: </dt><dd className="inline text-secondary">{v}</dd></div>)}</dl>}
          {d.ownedUploads.length > 0 && <ul className="mt-2 space-y-1">{d.ownedUploads.map(u => {
            const last = d.followUps.filter(f => f.videoId === u.videoId).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
            return <li key={u.videoId} className="text-micro text-secondary"><a href={`https://www.youtube.com/watch?v=${u.videoId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{u.title} ↗</a> · {u.channelName} · at decision: {exact(u.views)} views ({when(u.readingAt)})
              {last ? ` · latest: ${exact(last.views)} (${when(last.at)}, ${last.views != null && u.views != null ? `${last.views - u.views >= 0 ? '+' : ''}${exact(last.views - u.views)} over ${Math.round((Date.parse(last.at) - Date.parse(u.readingAt ?? d.recordedAt)) / 86400000)} days` : 'no comparison'})` : ' · no later reading yet'}</li>; })}</ul>}
        </div>)}</div>}
    </Section>

    {/* ── Inspector ─────────────────────────────────────────────── */}
    {open?.kind === 'song' && songByKey.get(open.id) && <Inspector onClose={() => setOpen(null)}><SongDetail s={songByKey.get(open.id)!} videoById={videoById} onLabel={async (dimension, value) => {
      setBusy('label');
      const s = songByKey.get(open.id)!;
      const r = await post('/api/labs/music-opportunities/labels', { subject: s.key, dimension, value, by: 'reviewer' });
      say(r.ok ? `Label saved: ${s.title} · ${dimension} = ${value}.` : `Label: ${r.data.error}`);
      setBusy(null); if (r.ok) router.refresh();
    }} /></Inspector>}
    {open?.kind === 'song' && !songByKey.get(open.id) && videoById.get(open.id.replace(/^video:/, '')) && <Inspector onClose={() => setOpen(null)}><VideoDetail v={videoById.get(open.id.replace(/^video:/, ''))!} /></Inspector>}
    <div aria-live="polite" className="mt-4 text-meta text-secondary space-y-0.5">{log.map((l, i) => <p key={i}>{l}</p>)}</div>

    {/* ── Catalogue coverage ────────────────────────────────────── */}
    <Section n="" title="Catalogue coverage" lede="The matching source is the music already published on the owned channels, plus a verified source catalogue if one has been imported. Published uploads are never presented as everything we hold.">
      <div className="border border-line rounded-card bg-surface overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-meta">
          <thead className="bg-raised/60 border-b border-line text-micro text-muted uppercase tracking-label"><tr>{['Channel', 'Rows the matcher uses', 'Source of rows', 'Complete', 'YouTube public count', 'Views in rows / channel', 'Catalogue labels (inferred unless noted)', ''].map(t => <th key={t} className="px-3 py-2.5 font-bold">{t}</th>)}</tr></thead>
          <tbody>{p.coverage.map(c => <tr key={c.slug} className="border-b border-line-faint align-top">
            <td className="px-3 py-2.5 font-semibold">{c.name}{!c.identityVerified && <span className="block text-micro text-warn font-normal">{c.note}</span>}</td>
            <td className="px-3 py-2.5 tabular-nums">{exact(c.rows)}</td>
            <td className="px-3 py-2.5 text-micro">{c.using === 'inventory' ? 'Live sandbox inventory' : c.using === 'seed-snapshot' ? 'Committed snapshot (production /api/full-catalogue)' : c.using === 'owned-working-set' ? 'Owned Channels working set' : 'Nothing indexed'}{c.readAt && <span className="block text-muted">{when(c.readAt)}</span>}{c.identityVerified && c.note && c.using !== 'none' && <span className="block text-muted max-w-[260px]">{c.note}</span>}</td>
            <td className="px-3 py-2.5">{c.complete == null ? '—' : c.complete ? 'Yes' : <span className="text-warn font-semibold">No</span>}</td>
            <td className="px-3 py-2.5 tabular-nums">{exact(c.videoCount)}</td>
            <td className="px-3 py-2.5 tabular-nums">{compact(c.rowViews)} / {compact(c.channelViews)}</td>
            <td className="px-3 py-2.5 text-micro">{Object.entries(c.profile).filter(([d]) => d === 'genre' || d === 'language').map(([d, vals]) => <span key={d} className="block">{d}: {Object.entries(vals).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v, n]) => `${v} ${n}`).join(' · ')}</span>)}{!Object.keys(c.profile).length && '—'}</td>
            <td className="px-3 py-2.5 text-right">{c.identityVerified && <button type="button" disabled={!p.env.dataApi || !p.env.storage || !!busy} onClick={() => indexUploads([c.channelId])} className="text-micro font-semibold text-secondary underline disabled:opacity-50">{c.using === 'inventory' ? 'Update' : 'Index live'}</button>}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="px-4 py-3 text-micro text-muted bg-raised/50 border-t border-line flex flex-wrap justify-between gap-3">
          <span>A live sweep reads every public upload at 1 quota unit per 50 (a 6,500-upload channel ≈ 130 units); updates stop at the first known upload. Snapshots were read once through the production full-catalogue route (≈ 2 units per 50 uploads, including view counts). Channel &ldquo;genre&rdquo; here is the model-assigned artist map applied to upload credits, never the channel&rsquo;s name.</span>
          <button type="button" disabled={!p.env.dataApi || !p.env.storage || !!busy} onClick={() => indexUploads(OWNED_CHANNELS.filter(c => validChannelId(c.id)).map(c => c.id))} className="font-semibold text-secondary underline disabled:opacity-50">{busy === 'uploads' ? 'Indexing…' : 'Index all nine live'}</button>
        </div>
      </div>
      <div className="mt-3 text-meta text-secondary">
        <strong className="text-ink">Source catalogue (tier 2, available but not published):</strong> {p.sourceCatalogue.present ? `${exact(p.sourceCatalogue.rows)} rows imported ${when(p.sourceCatalogue.importedAt)}${p.sourceCatalogue.note ? ` · ${p.sourceCatalogue.note}` : ''}.` : 'none imported. No catalogue feed, ISRC list or rights export was found in the repository or the connected Drive, Dropbox and Airtable sources on 23 Oct 2026, so this tier is empty and availability of unpublished tracks is unknown.'}
        <CatalogueImport busy={!!busy} setBusy={setBusy} say={say} storage={p.env.storage} onDone={() => router.refresh()} />
      </div>
    </Section>

    <details className="mt-6 border border-line rounded-card bg-surface px-5 py-4 text-meta text-secondary">
      <summary className="font-semibold text-ink cursor-pointer">Definitions and limits</summary>
      <div className="grid md:grid-cols-3 gap-5 mt-4 leading-relaxed">
        <p><strong className="text-ink block mb-1">Signals</strong>Each reading records source, chart, territory, chart period and the date we collected it. Top Songs ranks views across a song&rsquo;s official versions; Top Music Videos ranks views of one video; Top Songs on Shorts ranks Shorts created and publishes no count. Persistence is counted inside one chart series; breadth across territories and chart types is reported separately. Rank movement is not a growth rate and is not comparable across chart types. Public data says nothing about impressions, retention, traffic source or audience geography.</p>
        <p><strong className="text-ink block mb-1">Labels and matches</strong>Verified (stated by the source), human (recorded here) and inferred (title rules, or the model-assigned artist map) labels are shown with their provenance; a human label overrides the others. A song chart never gets a presentation label, and an upload never gets an era label from its upload date. Exact upload and ISRC are identifier matches; title-and-artist is a composition match whose recording may differ; shared titles are set aside. Genre, language, era and rights become verified only from a source catalogue that states them.</p>
        <p><strong className="text-ink block mb-1">Patterns, stages and spend</strong>A chart is selected successes: a label&rsquo;s frequency is not its success rate, a charting video does not show its format caused the result, and one act is not a genre. The paid-test gate needs a verified recording, a signal held across two or more comparable readings, and that upload&rsquo;s own earlier reading; it records a hypothesis and refuses budgets, returns or revenue. Decisions freeze the evidence; later readings are appended, never as proof of cause.</p>
      </div>
    </details>
  </>;
}

function Section({ n, title, lede, children }: { n: string; title: string; lede: string; children: React.ReactNode }) {
  return <section className="mb-9">
    <div className="max-w-[760px] mb-3">
      <h2 className="text-h3 font-bold">{n && <span className="text-faint mr-2">{n}</span>}{title}</h2>
      <p className="text-meta text-muted mt-1">{lede}</p>
    </div>
    {children}
  </section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-line rounded-card px-5 py-7 text-center text-body text-muted">{children}</div>;
}
function Inspector({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="mt-4 border border-ink rounded-card bg-surface p-5 relative">
    <button type="button" onClick={onClose} className="absolute top-3 right-4 text-meta text-secondary underline">Close</button>
    {children}
  </div>;
}

function FindingCard({ f, onRef }: { f: Finding; onRef: (r: Finding['refs'][number]) => void }) {
  return <article className="border border-line rounded-card bg-surface shadow-card p-5">
    <h3 className="text-h4 font-bold">{f.headline}</h3>
    <p className="text-meta text-secondary mt-1.5">{f.detail}</p>
    {f.numbers.length > 0 && <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">{f.numbers.map(n => <div key={n.label}><p className="text-h4 font-black tabular-nums">{n.value}</p><p className="text-micro text-muted">{n.label}</p></div>)}</div>}
    {f.refs.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5">{f.refs.map(r => <li key={`${r.kind}-${r.id}`}><button type="button" onClick={() => onRef(r)} className="px-2 py-1 rounded-control border border-line bg-raised/50 text-micro text-ink hover:border-ink">{r.label}</button></li>)}</ul>}
    {f.limits.length > 0 && <ul className="list-disc pl-4 mt-3 text-micro text-muted space-y-0.5">{f.limits.map(l => <li key={l}>{l}</li>)}</ul>}
  </article>;
}

function LabelChips({ labels }: { labels: Label[] }) {
  if (!labels.length) return <span className="text-micro text-muted">No labels (unknown on every dimension).</span>;
  return <ul className="flex flex-wrap gap-1.5">{labels.map(l => <li key={`${l.dimension}-${l.value}`} title={l.basis} className={`px-1.5 py-0.5 rounded-control border text-micro ${PROV[l.provenance]}`}>{l.dimension}: <strong>{l.value}</strong> · {l.provenance} · {l.confidence}</li>)}</ul>;
}

function SongDetail({ s, videoById, onLabel }: { s: SongView; videoById: Map<string, VideoView>; onLabel: (d: Dimension, v: string) => void }) {
  const [dim, setDim] = useState<Dimension>('genre');
  const [val, setVal] = useState<string>(VOCAB.genre[0]);
  return <>
    <p className="text-micro font-bold uppercase tracking-label text-muted">Song record</p>
    <h3 className="text-h4 font-bold mt-1">{s.title} <span className="text-secondary font-semibold">— {s.artists.join(', ')}</span></h3>
    <p className="text-micro text-muted mt-0.5">Key {s.key}{s.releaseDate ? ` · release date (source) ${s.releaseDate}` : ' · no release date from source'}</p>
    <div className="mt-3"><LabelChips labels={s.labels} /></div>
    <div className="grid md:grid-cols-2 gap-5 mt-4">
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">Chart appearances <span className="font-normal normal-case">· persistence per series, breadth separately</span></p>
        <ul className="space-y-1.5 text-meta">{s.persistence.bySeries.map(b => <li key={`${b.measure}-${b.territory}`}><strong className="text-ink">{b.territory} {SHORT[b.measure]}</strong>: {b.periods.length} of {b.periods.length} stored week{b.periods.length === 1 ? '' : 's'} it appears in ({b.periods.map(x => x.slice(5)).join(', ')}) · best #{b.bestRank} · latest {b.latestRank == null ? <span className="text-warn">not in the latest stored week</span> : `#${b.latestRank}`}</li>)}</ul>
        <p className="text-micro text-muted mt-2">Breadth: {s.persistence.territories.length} territor{s.persistence.territories.length === 1 ? 'y' : 'ies'} ({s.persistence.territories.join(', ')}) · {s.persistence.measures.length} chart type{s.persistence.measures.length === 1 ? '' : 's'} ({s.persistence.measures.map(m => SHORT[m]).join(', ')}).</p>
        <table className="w-full text-left text-micro mt-2"><thead className="text-muted"><tr><th className="py-1 pr-2">Week</th><th className="py-1 pr-2">Chart</th><th className="py-1 pr-2">Rank</th><th className="py-1 pr-2">Prev</th><th className="py-1 pr-2">Measure</th><th className="py-1">Weeks on chart</th></tr></thead>
          <tbody>{s.appearances.map((a, i) => <tr key={i} className="border-t border-line-faint"><td className="py-1 pr-2 tabular-nums">{a.period}</td><td className="py-1 pr-2">{a.territory} {SHORT[a.measure]}</td><td className="py-1 pr-2 tabular-nums">#{a.rank}</td><td className="py-1 pr-2 tabular-nums">{a.previousRank ?? '—'}</td><td className="py-1 pr-2 tabular-nums">{a.measureValue == null ? (a.measure.startsWith('shorts') ? 'not published' : '—') : exact(a.measureValue)}</td><td className="py-1 tabular-nums">{a.periodsOnChart ?? '—'}</td></tr>)}</tbody></table>
      </div>
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">Linked videos <span className="font-normal normal-case">· the video the song-chart row pointed at; representative, not the measured entity</span></p>
        {s.linkedVideoIds.length ? <ul className="space-y-1 text-meta">{s.linkedVideoIds.map(id => { const v = videoById.get(id); return <li key={id}><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{v?.title ?? id} ↗</a>{v ? <span className="block text-micro text-muted">Also on the video chart: {v.appearances.map(a => `${a.territory} #${a.rank} (${a.period.slice(5)})`).join(', ')}{v.labels.filter(l => l.dimension === 'presentation').map(l => ` · presentation: ${l.value} (${l.provenance})`).join('')}</span> : <span className="block text-micro text-muted">Not on a video chart in the stored readings; its format is unknown here.</span>}</li>; })}</ul> : <p className="text-micro text-muted">None.</p>}
        <p className="text-micro font-bold uppercase tracking-label text-muted mt-4 mb-1.5">Add a human label</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={dim} onChange={e => { const d = e.target.value as Dimension; setDim(d); setVal(VOCAB[d][0]); }} className="border border-line rounded-control bg-surface px-2 py-1.5 text-meta">{(Object.keys(VOCAB) as Dimension[]).map(d => <option key={d}>{d}</option>)}</select>
          <select value={val} onChange={e => setVal(e.target.value)} className="border border-line rounded-control bg-surface px-2 py-1.5 text-meta">{VOCAB[dim].map(v => <option key={v}>{v}</option>)}</select>
          <button type="button" onClick={() => onLabel(dim, val)} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper text-meta font-semibold">Save label</button>
        </div>
        <p className="text-micro text-muted mt-1">A human label overrides inferred and verified labels on that dimension for this song. &ldquo;Unknown&rdquo; is the absence of a label.</p>
      </div>
    </div>
  </>;
}

function VideoDetail({ v }: { v: VideoView }) {
  return <>
    <p className="text-micro font-bold uppercase tracking-label text-muted">Video record</p>
    <h3 className="text-h4 font-bold mt-1"><a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer">{v.title} ↗</a> <span className="text-secondary font-semibold">— {v.artists.join(', ')}</span></h3>
    <p className="text-micro text-muted mt-0.5">{v.videoId}{v.releaseDate ? ` · release/upload date (source) ${v.releaseDate}` : ''}{v.songKey ? ` · linked from song ${v.songKey}` : ''}</p>
    <div className="mt-3"><LabelChips labels={v.labels} /></div>
    <ul className="mt-3 space-y-1 text-meta">{v.appearances.map((a, i) => <li key={i}>{a.territory} {SHORT[a.measure]} · {a.period}: #{a.rank}{a.previousRank ? ` (prev ${a.previousRank})` : ''} · {exact(a.measureValue)} views in the chart week</li>)}</ul>
  </>;
}

function OpportunityCard({ o, busy, setBusy, say, onSaved, onInspect, highlighted }: { o: Opportunity; busy: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; onSaved: () => void; onInspect: (songKey: string) => void; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(o.stage);
  const [actualAction, setActualAction] = useState('');
  const [notes, setNotes] = useState('');
  const [test, setTest] = useState({ territory: o.signal.territory, whyTimely: '', creative: '', destination: '', organicBaseline: '', learningGoal: '', successCriteria: '', stopCriteria: '' });
  const movement = o.signal.previousRank != null ? (o.signal.previousRank === o.signal.rank ? 'unchanged' : o.signal.previousRank > o.signal.rank ? `up from #${o.signal.previousRank}` : `down from #${o.signal.previousRank}`) : o.signal.isNew ? 'new entry' : 'not on the previous chart';
  const songKey = o.id.split('#')[1];
  async function save() {
    setBusy('decision');
    try {
      const r = await post('/api/labs/music-opportunities/decisions', { opportunityId: o.id, stage, actualAction, notes, test: stage === 'consider-paid-test' ? test : undefined });
      say(r.ok ? `Decision recorded for "${o.signal.title}".` : `Decision: ${r.data.error}`);
      if (r.ok) { setOpen(false); onSaved(); }
    } finally { setBusy(null); }
  }
  return <article className={`border rounded-card bg-surface p-5 shadow-card ${highlighted ? 'border-ink' : 'border-line'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <span className={`inline-block px-2 py-0.5 rounded-control border text-micro font-semibold ${STAGE[o.stage].cls}`}>{STAGE[o.stage].label}</span>
        <span className={`inline-block ml-1.5 px-2 py-0.5 rounded-control border text-micro font-semibold ${o.matches[0].kind === 'exact-upload' || o.matches[0].kind === 'isrc' ? 'bg-positive-soft text-positive border-positive/30' : o.matches[0].kind === 'title-artist' ? 'bg-raised text-ink border-line-strong' : 'bg-warn-soft text-warn border-warn/30'}`}>{MATCH_STRENGTH[o.matches[0].kind].label}</span>
        <h3 className="text-h4 font-bold mt-2"><button type="button" onClick={() => onInspect(songKey)} className="text-left hover:underline"><strong>{o.signal.title}</strong>{o.signal.artists.length ? <span className="text-secondary font-semibold"> — {o.signal.artists.join(', ')}</span> : null}</button> <span className="text-secondary font-normal">is #{o.signal.rank} in {o.signal.territory} {SHORT[o.signal.measure]}</span></h3>
        <p className="text-meta text-muted mt-1">{MEASURE_LABEL[o.signal.measure] ?? o.signal.measure} · {o.signal.periodLabel} · {movement}{o.signal.periodsOnChart != null ? ` · ${o.signal.periodsOnChart} week${o.signal.periodsOnChart === 1 ? '' : 's'} on chart` : ''}{o.signal.measureValue != null ? ` · ${exact(o.signal.measureValue)} in the chart's measure` : ''}</p>
        <p className="text-micro text-muted mt-0.5"><a href={o.signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_LABEL[o.signal.source]} ↗</a> · collected {when(o.signal.collectedAt)}{o.signal.videoId && <> · <a href={`https://www.youtube.com/watch?v=${o.signal.videoId}`} target="_blank" rel="noopener noreferrer" className="underline">{o.signal.measure.startsWith('music-video') ? 'charted video' : 'linked video'} ↗</a></>}</p>
      </div>
      <div className="text-right text-micro text-muted shrink-0">
        <p className="font-semibold text-ink">{o.persistence.periods} of the stored weeks of this chart</p>
        <p>{o.persistence.periods > 1 ? `${o.persistence.firstSeen} → ${o.persistence.lastSeen}` : 'single week'}{o.persistence.territories.length > 1 ? ` · also ${o.persistence.territories.filter(t => t !== o.signal.territory).join(', ')}` : ''}</p>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-5 mt-4">
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">We hold</p>
        <ul className="space-y-2">{o.matches.slice(0, 4).map(m => <li key={m.track.id} className="text-meta">
          <span className="inline-block px-1.5 py-0.5 rounded-control border border-line bg-raised text-micro font-semibold mr-2">{MATCH_STRENGTH[m.kind].label}</span>
          {m.track.videoId ? <a href={`https://www.youtube.com/watch?v=${m.track.videoId}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink">{m.track.title} ↗</a> : <span className="font-semibold text-ink">{m.track.title}{m.track.artist ? ` — ${m.track.artist}` : ''}</span>}
          <span className="block text-micro text-muted">{m.track.origin === 'owned-upload' ? `On ${m.track.channelName} · published ${date(m.track.publishedAt)}${m.track.views != null ? ` · ${exact(m.track.views)} lifetime views at the inventory reading` : ''}` : `Source catalogue · not on an owned channel${m.track.rightsNote ? ` · rights: ${m.track.rightsNote}` : ''}`}</span>
          <span className="block text-micro text-faint">{m.evidence}</span>
        </li>)}{o.matches.length > 4 && <li className="text-micro text-muted">+{o.matches.length - 4} more uploads by the same artist.</li>}</ul>
        {o.ownedUploads.length > 0 && <>
          <p className="text-micro font-bold uppercase tracking-label text-muted mt-4 mb-1.5">Owned-upload readings</p>
          <ul className="space-y-1">{o.ownedUploads.slice(0, 3).map(u => <li key={u.videoId} className="text-meta tabular-nums">
            <span className="font-semibold">{u.views != null ? exact(u.views) : '—'}</span> <span className="text-muted">lifetime views {u.readingAt ? `at ${when(u.readingAt)}` : '· no reading'} · {u.title} · {MATCH_STRENGTH[u.matchKind].label.toLowerCase()}</span>
            {u.gain ? <span className="block text-micro text-secondary">{u.gain.views >= 0 ? '+' : ''}{exact(u.gain.views)} between two readings {u.gain.days} days apart (from {when(u.gain.baselineAt)}). Measured, not extrapolated.</span>
              : <span className="block text-micro text-muted">One reading: a baseline, not growth. Upload age {u.publishedAt ? `${Math.floor((Date.now() - Date.parse(u.publishedAt)) / 86400000)} days` : 'unknown'}.</span>}
          </li>)}</ul></>}
      </div>
      <div>
        <p className="text-micro font-bold uppercase tracking-label text-muted mb-1.5">Suggested action</p>
        <p className="text-body font-semibold">{o.action}</p>
        <p className="text-micro text-muted mt-1">{STAGE[o.stage].blurb}</p>
        <p className="text-micro font-bold uppercase tracking-label text-muted mt-4 mb-1.5">Unknown</p>
        <ul className="list-disc pl-4 text-micro text-secondary space-y-0.5">{o.unknowns.map(u => <li key={u}>{u}</li>)}</ul>
        <div className="mt-4">
          {!open ? <button type="button" disabled={busy} onClick={() => setOpen(true)} className="px-3 py-1.5 border border-line-strong rounded-control bg-surface text-meta font-semibold disabled:opacity-50 hover:enabled:border-ink">Record a decision</button>
            : <div className="border border-line rounded-card bg-raised/40 p-3 text-meta space-y-2">
              <label className="block">Stage<select value={stage} onChange={e => setStage(e.target.value as Stage)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full">
                {(Object.keys(STAGE) as Stage[]).map(s => <option key={s} value={s}>{STAGE[s].label}</option>)}</select></label>
              <label className="block">What was actually done (optional)<input value={actualAction} onChange={e => setActualAction(e.target.value)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full" placeholder="e.g. moved to the top of the channel playlist on 24 Oct" /></label>
              <label className="block">Notes (optional)<input value={notes} onChange={e => setNotes(e.target.value)} className="block mt-1 border border-line rounded-control bg-surface px-2 py-1.5 w-full" /></label>
              {stage === 'consider-paid-test' && <div className="grid sm:grid-cols-2 gap-2">
                {([['territory', 'Territory'], ['whyTimely', 'Why this is timely'], ['creative', 'Creative'], ['destination', 'Destination'], ['organicBaseline', 'Organic baseline'], ['learningGoal', 'What we want to learn'], ['successCriteria', 'Success criteria'], ['stopCriteria', 'Stop criteria']] as const).map(([k, label]) =>
                  <label key={k} className="block text-micro">{label}<input value={test[k]} onChange={e => setTest(t => ({ ...t, [k]: e.target.value }))} className="block mt-0.5 border border-line rounded-control bg-surface px-2 py-1.5 w-full text-meta" /></label>)}
                <p className="sm:col-span-2 text-micro text-muted">No budgets, expected returns or revenue. Keep paid and organic results separate when the test runs.</p>
              </div>}
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={save} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper text-meta font-semibold disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-meta text-secondary">Cancel</button></div>
            </div>}
        </div>
      </div>
    </div>
  </article>;
}

function ManualImport({ busy, setBusy, say, storage, onDone }: { busy: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; storage: boolean; onDone: () => void }) {
  const [form, setForm] = useState({ measure: 'song-views-weekly', territory: 'GB', period: '', sourceUrl: 'https://charts.youtube.com/', note: '', text: '' });
  async function submit() {
    setBusy('import');
    try {
      const r = await post('/api/labs/music-opportunities/import', { kind: 'chart', ...form });
      say(r.ok ? `Manual import: ${r.data.rows} rows saved as ${form.territory} ${form.measure} for ${form.period}${(r.data.warnings as string[])?.length ? ` · ${(r.data.warnings as string[]).join(' ')}` : ''}.` : `Manual import: ${r.data.error}`);
      if (r.ok) { setForm(f => ({ ...f, text: '' })); onDone(); }
    } finally { setBusy(null); }
  }
  return <div className="text-meta space-y-2">
    <h4 className="font-bold text-ink text-body">Paste a chart export</h4>
    <select value={form.measure} onChange={e => setForm(f => ({ ...f, measure: e.target.value }))} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full">{MANUAL_MEASURES.map(m => <option key={m.id} value={m.id}>{m.label} · {m.measureName}</option>)}</select>
    <div className="flex gap-2"><input value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value.toUpperCase() }))} placeholder="GB" maxLength={6} className="border border-line rounded-control bg-surface px-2 py-1.5 w-24" />
      <input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="Chart week end YYYY-MM-DD" className="border border-line rounded-control bg-surface px-2 py-1.5 flex-1" /></div>
    <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="Source URL (the dated chart page)" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full" />
    <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note: who imported, from what" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full" />
    <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} rows={5} placeholder={'Rank,Previous Rank,Track Name,Artist Names,Periods on Chart,Views,YouTube URL,Release Date\n1,2,Song,Artist,3,1234567,https://youtube.com/watch?v=...,2024-01-25'} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full font-mono text-micro" />
    <button type="button" disabled={busy || !storage || !form.text || !form.period} onClick={submit} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper font-semibold disabled:opacity-50">Import</button>
    {!storage && <p className="text-micro text-warn">Storage is not configured here; imports cannot be saved.</p>}
  </div>;
}

function CatalogueImport({ busy, setBusy, say, storage, onDone }: { busy: boolean; setBusy: (b: string | null) => void; say: (m: string) => void; storage: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(''); const [note, setNote] = useState('');
  async function submit() {
    setBusy('catalogue');
    try {
      const r = await post('/api/labs/music-opportunities/import', { kind: 'catalogue', text, note });
      say(r.ok ? `Source catalogue: ${r.data.rows} rows imported (${r.data.skipped} skipped; columns ${(r.data.columns as string[]).join(', ')})${r.data.capped ? ' · capped at 5,000' : ''}.` : `Source catalogue: ${r.data.error}`);
      if (r.ok) { setOpen(false); setText(''); onDone(); }
    } finally { setBusy(null); }
  }
  return <div className="mt-2">
    {!open ? <button type="button" disabled={busy || !storage} onClick={() => setOpen(true)} className="text-micro font-semibold text-secondary underline disabled:opacity-50">Import a source catalogue (CSV/TSV: title, artist; optional isrc, version, genre, language, year, territories, rights)</button>
      : <div className="space-y-2 mt-2 max-w-[720px]">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note: which export, from whom, when" className="border border-line rounded-control bg-surface px-2 py-1.5 w-full text-meta" />
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={'isrc,title,artist,version,genre,language,year,territories,rights'} className="border border-line rounded-control bg-surface px-2 py-1.5 w-full font-mono text-micro" />
        <div className="flex gap-2"><button type="button" disabled={busy || !text} onClick={submit} className="px-3 py-1.5 border border-ink rounded-control bg-ink text-paper text-meta font-semibold disabled:opacity-50">Import (replaces the previous import)</button><button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-meta text-secondary">Cancel</button></div>
      </div>}
  </div>;
}
