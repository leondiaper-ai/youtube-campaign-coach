'use client';
/* The pilot, §7 — five songs, three destinations, judged on one page.
 *
 * The summary at the top is deliberately unflattering: songs that produced
 * nothing are named, not omitted. A pilot that hides its misses cannot tell
 * anyone whether the tool works.
 */

import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '@/lib/artists';

const dt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });


const A_CLS: Record<string,string> = {
  strong:'bg-emerald-600', moderate:'bg-amber-500', weak:'bg-orange-400', none:'bg-ink/25',
};
/* Four bars, never one score. The brief's point: a catalogue track with real
   editorial fit and no campaign should not look like a track with no fit. */
const Axes = ({ c }: any) => (
  <div className="flex gap-2 flex-wrap mt-2">
    {[['Editorial fit', c.editorialFit], ['Performance support', c.performanceSupport],
      ['Timing', c.timing], ['Execution', c.execution]].map(([l, v]: any) => (
      <div key={l} className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${A_CLS[v] ?? A_CLS.none}`} />
        <span className="text-[10px] uppercase tracking-wider text-ink/50">{l}</span>
        <span className="text-[10px] font-bold text-ink/75">{v}</span>
      </div>
    ))}
  </div>
);

const VERDICTS = [['useful', 'Useful'], ['obvious', 'Obvious'], ['unsuitable', 'Unsuitable'], ['unsupported', 'Unsupported']] as const;

export default function PilotView() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, any>>({});

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const j = await (await fetch('/api/market-watch/pilot?songs=5&destinations=3', { cache: 'no-store' })).json();
      setData(j); setFeedback(j.feedback?.entries ?? {});
    } catch { setData({ error: 'Request failed.' }); }
    setBusy(false);
  }, []);
  useEffect(() => { run(); }, [run]);

  const onVerdict = useCallback(async (id: string, verdict: string) => {
    setFeedback(f => ({ ...f, [id]: { id, verdict, at: new Date().toISOString() } }));
    await fetch('/api/market-watch/connect', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedback: { id, verdict } }),
    }).catch(() => {});
  }, []);

  if (busy && !data) return <div className="border border-line rounded-xl bg-white p-4 text-[13px] text-ink/50">Running the pilot across five songs and three destinations…</div>;
  if (!data) return null;
  if (data.error) return <div className="border border-rose-200 bg-rose-50 rounded-xl p-4 text-[13px] text-rose-900">{data.error}</div>;

  const s = data.summary, sel = data.selection;

  return (
    <div>
      <p className="text-meta text-ink/50 mb-4">
        Selection is automatic so the result cannot be flattered by hand-picking. Songs need a <b>confirmed recording</b> —
        a promotional caption cannot be selected. Destinations need 20+ collected uploads and a verified identity.
      </p>

      {/* The scoreboard, misses included. */}
      <div className="border border-line rounded-xl bg-white p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[['Songs', s.songs], ['Candidates shown', s.candidates], ['Needing tags', s.songsNeedingTags]].map(([l, v]: any) => (
            <div key={l} className="bg-paper rounded-lg px-3 py-2">
              <div className="text-[22px] font-black tabular-nums leading-none">{v}</div>
              <div className="text-[9px] uppercase tracking-wider text-ink/45 mt-1">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap mt-3 text-[11px] text-ink/60">
          <span>Exact <b className="text-ink">{s.byRoute.same_artist}</b></span>
          <span>Inferred <b className="text-ink">{s.byRoute.comparable_track}</b></span>
          <span>Treatment pattern <b className="text-ink">{s.byRoute.treatment_pattern}</b></span>
          <span className="text-ink/45">· {sel.priorSplit.withPriorAppearance} song(s) from artists these destinations have published before, {sel.priorSplit.without} from artists they never have</span>
        </div>
        {s.songsWithNoCandidate.length > 0 && (
          <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-900 mb-1">Produced nothing — named rather than omitted</div>
            <div className="text-[12px] text-amber-900">{s.songsWithNoCandidate.join(' · ')}</div>
          </div>
        )}
        <div className="mt-3 text-[11px] text-ink/45 leading-snug">
          {sel.songRule} {sel.destinationRule} Pool: {sel.candidatePool.selectable} selectable songs from {sel.candidatePool.virginArtists} Virgin-owned artists.
        </div>
      </div>

      {/* Destinations */}
      <div className="grid md:grid-cols-3 gap-3 mb-5">
        {sel.destinations.map((d: any) => (
          <div key={d.key} className="border border-line rounded-xl bg-white p-3">
            <div className="text-[14px] font-bold">{d.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink/45">{d.role.replace(/_/g, ' ')} · {d.relationship.replace(/_/g, ' ')}</div>
            <div className="flex gap-3 mt-2 text-[11px] text-ink/65">
              <span><b className="text-ink tabular-nums">{d.uploads}</b> uploads</span>
              <span><b className="text-ink tabular-nums">{d.uploadsPerWeek}</b>/wk</span>
            </div>
            <div className="text-[11px] text-ink/60 mt-1 tabular-nums">
              Median {d.medianViews != null ? fmtNum(d.medianViews) : '—'} · lower quartile {d.lowerQuartileViews != null ? fmtNum(d.lowerQuartileViews) : '—'}
            </div>
            <div className="text-[10px] text-ink/45 mt-1">{d.topTreatments.join(' · ')}</div>
          </div>
        ))}
      </div>

      {/* Per song */}
      <div className="space-y-4">
        {data.results.map((r: any) => (
          <div key={r.slug + r.songKey} className="border border-line rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-line/70 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold">{r.song}</div>
                <div className="text-[12px] text-ink/60">{r.artist} · {r.recordings} confirmed recording(s)</div>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-[10px] uppercase tracking-wider font-bold rounded px-2 py-1 ${r.priorAppearance ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-violet-50 text-violet-800 border border-violet-200'}`}>
                  {r.priorAppearance ? 'Published here before' : 'No previous appearance'}
                </span>
                {r.missingAxes.length > 0 && (
                  <div className="text-[10px] text-ink/45 mt-1">missing: {r.missingAxes.join(', ')}</div>
                )}
              </div>
            </div>
            <div className="px-4 py-3">
              {r.notes.map((n: string, i: number) => (
                <div key={i} className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 leading-snug">{n}</div>
              ))}
              {r.candidates.filter((c: any) => c.editorialFit === 'strong' || c.editorialFit === 'moderate').length === 0 ? (
                <div className="text-[12px] text-ink/50">No candidate with supported editorial fit. Pairings resting on language, format or broad genre are not shown.</div>
              ) : (
                <div className="space-y-2">
                  {r.candidates.filter((c: any) => c.editorialFit === 'strong' || c.editorialFit === 'moderate').map((c: any) => (
                    <div key={c.id} className="border border-line rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold">{c.destination}
                            {c.suggestedTreatment && <span className="font-normal text-ink/60"> · {c.suggestedTreatment}</span>}
                          </div>
                          <div className="text-[11px] text-ink/50">{c.route.replace(/_/g, ' ')} · {c.routeKind}</div>
                        </div>
                        <span className={`shrink-0 text-[10px] uppercase tracking-wider font-bold text-white rounded px-2 py-0.5 ${c.readiness === 'propose' ? 'bg-ink' : 'bg-ink/35'}`}>
                          {c.readiness === 'propose' ? 'Propose' : 'Investigate'}
                        </span>
                      </div>
                      {c.similarities.length > 0 && (
                        <div className="text-[11px] mt-1.5">
                          <span className="text-ink/45">Matched: </span>
                          {c.similarities.map((x: any) => `${x.axis} (${x.values.join('/')}, ${x.from})`).join(' · ')}
                        </div>
                      )}
                      <div className="text-[11px] text-ink/60 mt-1 tabular-nums">
                        {c.performance.n} comparable upload(s) · median {c.performance.median != null ? fmtNum(c.performance.median) : '—'}
                        {c.performance.lowerQuartile != null ? ` · lower quartile ${fmtNum(c.performance.lowerQuartile)}` : ''}
                      </div>
                      <Axes c={c} />
                      <div className="text-[11px] text-ink/50 mt-1 leading-snug">{c.readinessReason}</div>
                      {c.supporting.slice(0, 2).map((v: any) => (
                        <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="block text-[11px] text-ink/60 hover:underline mt-0.5">
                          · {v.title.length > 64 ? v.title.slice(0, 64) + '…' : v.title} <span className="tabular-nums text-ink/40">{v.views != null ? fmtNum(v.views) : '—'}</span>
                        </a>
                      ))}
                      {c.uncertainty.length > 0 && (
                        <details className="mt-1.5">
                          <summary className="text-[11px] text-ink/50 cursor-pointer">{c.uncertainty.length} uncertainty note(s)</summary>
                          <ul className="text-[11px] text-ink/55 mt-1 space-y-0.5">
                            {c.uncertainty.map((u: string, i: number) => <li key={i}>· {u}</li>)}
                          </ul>
                        </details>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-line/60 flex-wrap">
                        {VERDICTS.map(([v, label]) => (
                          <button key={v} onClick={() => onVerdict(c.id, v)}
                            className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition ${
                              feedback[c.id]?.verdict === v ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink/60 hover:border-ink/40'}`}>
                            {label}
                          </button>
                        ))}
                        {feedback[c.id] && <span className="text-[10px] text-ink/40">saved {dt(feedback[c.id].at)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button onClick={run} disabled={busy}
        className="mt-4 text-[12px] font-bold bg-ink text-white rounded-lg px-4 py-2 disabled:opacity-40">
        {busy ? 'Running…' : 'Re-run pilot'}
      </button>
    </div>
  );
}
