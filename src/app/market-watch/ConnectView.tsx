'use client';
/* The connection layer, both directions.
 *
 * Layout follows the brief's §6 order deliberately: fit evidence comes
 * first, performance second, timing third, uncertainty last but never
 * collapsed. Readiness sits in the header because "worth investigating"
 * and "ready to propose" are different asks and the eye should catch
 * which one it is looking at before reading anything else.
 *
 * Provenance is rendered on every attribute. A tool that shows a stated
 * tag and an inferred one in identical type is lying by typography.
 */

import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '@/lib/artists';

const dt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

const PROV: Record<string, { label: string; cls: string }> = {
  stated:   { label: 'stated',   cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  observed: { label: 'counted',  cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  parsed:   { label: 'parsed',   cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  inferred: { label: 'inferred', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
};
const Prov = ({ from }: { from: string }) => {
  const p = PROV[from] ?? PROV.inferred;
  return <span className={`text-[9px] uppercase tracking-wider font-bold border rounded px-1 py-px ${p.cls}`}>{p.label}</span>;
};

const ROUTE_STYLE: Record<string, string> = {
  same_artist: 'bg-emerald-600', comparable_track: 'bg-amber-600', treatment_pattern: 'bg-slate-500',
};
const ROUTE_LABEL: Record<string, string> = {
  same_artist: 'Exact — same artist published here',
  comparable_track: 'Inferred — comparable description',
  treatment_pattern: 'Observed — destination treatment pattern',
};

const VERDICTS = [
  ['useful', 'Useful', 'Worth acting on'],
  ['obvious', 'Obvious', 'True but already known'],
  ['unsuitable', 'Unsuitable', 'Editorial judgement is wrong'],
  ['unsupported', 'Unsupported', 'Evidence does not justify it'],
] as const;


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

const Section = ({ title, children }: any) => (
  <div className="mt-3">
    <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-ink/45 mb-1">{title}</div>
    {children}
  </div>
);

const Vid = ({ v }: any) => (
  <a href={v.url} target="_blank" rel="noreferrer"
     className="block text-[12px] leading-snug hover:underline py-0.5">
    <span className="text-ink/80">{v.title.length > 72 ? v.title.slice(0, 72) + '…' : v.title}</span>
    <span className="text-ink/45 tabular-nums"> · {dt(v.publishedAt)}{v.views != null ? ` · ${fmtNum(v.views)} lifetime` : ' · views withheld'}</span>
  </a>
);

function CandidateCard({ c, verdict, onVerdict }: any) {
  const [open, setOpen] = useState(false);
  const propose = c.readiness === 'propose';
  return (
    <div className="border border-line rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-line/70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight truncate">{c.song}</div>
            <div className="text-[12px] text-ink/60 mt-0.5">
              {c.artistName} → <span className="font-semibold text-ink/80">{c.destination}</span>
              <span className="text-ink/45"> · {c.destinationRole.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <span className={`shrink-0 text-[10px] uppercase tracking-wider font-bold text-white rounded px-2 py-1 ${propose ? 'bg-ink' : 'bg-ink/35'}`}>
            {propose ? 'Ready to propose' : 'Investigate'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] font-bold text-white rounded px-1.5 py-px ${ROUTE_STYLE[c.route]}`}>
            {ROUTE_LABEL[c.route]}
          </span>
          {c.suggestedTreatment && (
            <span className="text-[11px] font-semibold text-ink/70">Treatment: {c.suggestedTreatment}</span>
          )}
        </div>
        <Axes c={c} />
        <div className="text-[11px] text-ink/55 mt-1.5 leading-snug">{c.readinessReason}</div>
      </div>

      <div className="px-4 py-3">
        {/* FIT, first and alone — §5 keeps this away from performance. */}
        <Section title="Specific similarities">
          {c.similarities.length ? (
            <div className="space-y-1">
              {c.similarities.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="text-ink/50 w-20 shrink-0">{s.axis}</span>
                  <span className="font-semibold">{s.values.join(', ')}</span>
                  <Prov from={s.from} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-ink/50">No axis matched. This pairing rests on the destination&rsquo;s own pattern, not on a comparison.</div>
          )}
          {c.uncomparable.length > 0 && (
            <div className="text-[11px] text-ink/45 mt-1.5">
              Not comparable — nothing recorded on either side: {c.uncomparable.join(', ')}
            </div>
          )}
        </Section>

        <Section title="Supporting videos">
          <div className="text-[11px] text-ink/55 mb-1 leading-snug">{c.supportingNote}</div>
          {c.supporting.map((v: any) => <Vid key={v.id} v={v} />)}
        </Section>

        {/* PERFORMANCE, explicitly second and explicitly a distribution. */}
        <Section title="Performance context">
          <div className="grid grid-cols-3 gap-2 mb-1.5">
            {[['Lower quartile', c.performance.lowerQuartile], ['Median', c.performance.median], ['Upper quartile', c.performance.upperQuartile]].map(([l, v]: any) => (
              <div key={l} className="bg-paper rounded-lg px-2 py-1.5">
                <div className="text-[16px] font-black tabular-nums leading-none">{v != null ? fmtNum(v) : '—'}</div>
                <div className="text-[9px] uppercase tracking-wider text-ink/45 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-ink/60 leading-snug">{c.performance.caveat}</div>
          {c.performance.weakest && (
            <div className="mt-1.5">
              <div className="text-[10px] uppercase tracking-wider text-ink/40 font-bold">Weakest example — the one not to leave out</div>
              <Vid v={c.performance.weakest} />
            </div>
          )}
        </Section>

        <Section title="Why test now">
          <div className="text-[11px] mb-1">
            <span className={`font-bold uppercase tracking-wider ${c.whyNow.strength === 'supported' ? 'text-emerald-700' : c.whyNow.strength === 'weak' ? 'text-amber-700' : 'text-rose-700'}`}>
              {c.whyNow.strength}
            </span>
            <span className="text-ink/45"> — timing only. A weak timing case does not weaken the editorial evidence above.</span>
          </div>
          <ul className="text-[12px] space-y-0.5">
            {c.whyNow.points.map((p: string, i: number) => <li key={i} className="text-ink/75">· {p}</li>)}
            {c.whyNow.gaps.map((p: string, i: number) => <li key={`g${i}`} className="text-ink/45">· {p}</li>)}
          </ul>
        </Section>

        <button onClick={() => setOpen(o => !o)}
          className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ink/55 hover:text-ink">
          {open ? '− Hide' : '+ Show'} uncertainty, counter-evidence and next action
        </button>

        {open && (
          <div className="mt-2 border-t border-line/70 pt-2">
            <Section title="Uncertainty">
              <ul className="text-[12px] space-y-1">
                {c.uncertainty.length
                  ? c.uncertainty.map((u: string, i: number) => <li key={i} className="text-ink/75">· {u}</li>)
                  : <li className="text-ink/50">· Nothing flagged — which is not the same as nothing missing.</li>}
              </ul>
            </Section>
            <Section title="Counter-evidence">
              <ul className="text-[12px] space-y-1">
                {c.counterEvidence.map((u: string, i: number) => <li key={i} className="text-ink/75">· {u}</li>)}
              </ul>
            </Section>
            <Section title="Proposed next action">
              <div className="text-[12px] text-ink/80 leading-snug">{c.nextAction}</div>
            </Section>
            <Section title="Rights status">
              <div className="text-[12px]">
                <span className="text-ink/55">Ownership recorded in Watcher: </span>
                <span className="font-semibold">{c.ownership}</span>
                <span className="text-ink/55"> · Permission to create or place a version: </span>
                <span className="font-semibold text-rose-700">unknown</span>
              </div>
              <div className="text-[11px] text-ink/45 mt-0.5">Permission is recorded nowhere in this codebase. Being monitored, and ownership of a revenue interest, are both different things.</div>
            </Section>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-line/70 bg-paper/60 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45 mr-1">Verdict</span>
        {VERDICTS.map(([v, label, hint]) => (
          <button key={v} title={hint} onClick={() => onVerdict(c.id, v)}
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border transition ${
              verdict?.verdict === v ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink/65 hover:border-ink/40'}`}>
            {label}
          </button>
        ))}
        {verdict && <span className="text-[10px] text-ink/40 ml-1">saved {dt(verdict.at)}</span>}
      </div>
    </div>
  );
}

/* ── Tag editor. The §3 escape hatch: rather than refusing when musical
   characteristics are unavailable, let Leon state them. ───────────────── */
function TagEditor({ kind, id, description, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({
    genre: (description?.genre?.value ?? []).join(', '),
    subgenre: (description?.subgenre?.value ?? []).join(', '),
    mood: (description?.mood?.value ?? []).join(', '),
    energy: description?.energy?.value ?? '',
    language: (description?.language?.value ?? []).join(', '),
    vocal: (description?.vocal?.value ?? []).join(', '),
    context: (description?.context?.value ?? []).join(', '),
    summary: description?.summary?.value ?? '',
  }));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch('/api/market-watch/connect', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, id, description: f }),
    }).catch(() => {});
    setSaving(false); setOpen(false); onSaved?.();
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-[11px] font-bold uppercase tracking-wider text-ink/55 hover:text-ink border border-line rounded-lg px-2 py-1">
      Edit tags
    </button>
  );
  return (
    <div className="border border-line rounded-xl p-3 bg-paper mt-2">
      <div className="text-[11px] text-ink/60 mb-2 leading-snug">
        Nothing here is derived from audio — there is none in this data. What you type is stored as <strong>stated</strong> and overrides everything inferred.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[['genre', 'Genre'], ['subgenre', 'Subgenre'], ['mood', 'Mood'], ['language', 'Language'], ['vocal', 'Vocal style'], ['context', 'Listening context']].map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">{label}</span>
            <input value={(f as any)[k]} onChange={e => setF({ ...f, [k]: e.target.value })}
              placeholder="comma separated"
              className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-0.5" />
          </label>
        ))}
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">Energy 1–5</span>
          <input value={f.energy as any} onChange={e => setF({ ...f, energy: e.target.value })} type="number" min={1} max={5}
            className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-0.5" />
        </label>
      </div>
      <label className="block mt-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">Short description</span>
        <textarea value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} rows={2}
          className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-0.5" />
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={save} disabled={saving}
          className="text-[12px] font-bold bg-ink text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save tags'}
        </button>
        <button onClick={() => setOpen(false)} className="text-[12px] text-ink/55 px-2">Cancel</button>
      </div>
    </div>
  );
}

const Desc = ({ d }: any) => {
  const axes: [string, string][] = [['genre', 'Genre'], ['mood', 'Mood'], ['language', 'Language'], ['vocal', 'Vocal'], ['context', 'Context'], ['treatments', 'Treatments']];
  const rows = axes.filter(([k]) => (d?.[k]?.value ?? []).length);
  if (!rows.length && d?.energy?.value == null) return (
    <div className="text-[11px] text-ink/45">Nothing recorded on any descriptive axis. Route B cannot run until genre, mood or context is stated.</div>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-paper border border-line rounded-lg px-1.5 py-0.5">
          <span className="text-ink/45">{label}</span>
          <span className="font-semibold">{d[k].value.join(', ')}</span>
          <Prov from={d[k].from} />
        </span>
      ))}
      {d?.energy?.value != null && (
        <span className="inline-flex items-center gap-1 text-[11px] bg-paper border border-line rounded-lg px-1.5 py-0.5">
          <span className="text-ink/45">Energy</span><span className="font-semibold">{d.energy.value}</span><Prov from={d.energy.from} />
        </span>
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════════════ */
export default function ConnectView({ artists }: { artists: { slug: string; name: string; ownership: string; tracks: number }[] }) {
  const [dir, setDir] = useState<'track' | 'destination'>('track');
  const [slug, setSlug] = useState<string>('');
  const [songs, setSongs] = useState<any[]>([]);
  const [songKey, setSongKey] = useState<string>('');
  const [dests, setDests] = useState<any[]>([]);
  const [destKey, setDestKey] = useState<string>('');
  const [res, setRes] = useState<{ candidates: any[]; notes: string[]; profile?: any } | null>(null);
  const [feedback, setFeedback] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    try {
      const j = await (await fetch('/api/market-watch/connect?destinations=1', { cache: 'no-store' })).json();
      setDests(j.destinations ?? []); setFeedback(j.feedback ?? {});
    } catch {}
  })(); }, []);

  const loadSongs = useCallback(async (s: string) => {
    setBusy(true); setSongs([]); setSongKey(''); setRes(null);
    try {
      const j = await (await fetch(`/api/market-watch/connect?artist=${encodeURIComponent(s)}`, { cache: 'no-store' })).json();
      setSongs(j.songs ?? []);
    } catch {}
    setBusy(false);
  }, []);

  const run = useCallback(async () => {
    setBusy(true); setRes(null);
    const url = dir === 'track'
      ? `/api/market-watch/connect?artist=${encodeURIComponent(slug)}&song=${encodeURIComponent(songKey)}`
      : `/api/market-watch/connect?destination=${encodeURIComponent(destKey)}`;
    try {
      const j = await (await fetch(url, { cache: 'no-store' })).json();
      setRes({ candidates: j.candidates ?? [], notes: j.notes ?? [], profile: j.profile });
      if (j.feedback) setFeedback(j.feedback);
    } catch { setRes({ candidates: [], notes: ['Request failed.'] }); }
    setBusy(false);
  }, [dir, slug, songKey, destKey]);

  const onVerdict = useCallback(async (id: string, verdict: string) => {
    setFeedback(f => ({ ...f, [id]: { id, verdict, at: new Date().toISOString() } }));
    await fetch('/api/market-watch/connect', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedback: { id, verdict } }),
    }).catch(() => {});
  }, []);

  const song = songs.find(s => s.key === songKey);
  /* Unsupported pairings are hidden rather than ranked low. A card that
     exists at all reads as a recommendation, however softly it is worded —
     and a screen of weak cards is what made the pilot look confident
     without being discriminating. */
  const supported = (c: any) => c.editorialFit === 'strong' || c.editorialFit === 'moderate';
  const hidden = (res?.candidates ?? []).filter(c => !supported(c)).length;
  const exact = res?.candidates.filter(c => c.routeKind === 'exact' && supported(c)) ?? [];
  const inferred = res?.candidates.filter(c => c.routeKind !== 'exact' && supported(c)) ?? [];

  return (
    <div>
      <div className="border border-line rounded-xl bg-white p-4 mb-4">
        <div className="flex gap-1 mb-3">
          {([['track', 'Track-first — where might this song fit?'], ['destination', 'Destination-first — what suits this environment?']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setDir(k); setRes(null); }}
              className={`text-[12px] font-bold rounded-lg px-3 py-2 border transition ${dir === k ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink/60 hover:border-ink/40'}`}>
              {label}
            </button>
          ))}
        </div>

        {dir === 'track' ? (
          <div className="flex gap-2 flex-wrap items-end">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">Watched artist</span>
              <select value={slug} onChange={e => { setSlug(e.target.value); loadSongs(e.target.value); }}
                className="block text-[13px] border border-line rounded-lg px-2 py-1.5 mt-0.5 min-w-[220px]">
                <option value="">Select…</option>
                {artists.map(a => <option key={a.slug} value={a.slug}>{a.name}{a.ownership === 'virgin' ? ' ·' : ''} ({a.tracks})</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">Canonical song</span>
              <select value={songKey} onChange={e => setSongKey(e.target.value)} disabled={!songs.length}
                className="block text-[13px] border border-line rounded-lg px-2 py-1.5 mt-0.5 min-w-[260px] disabled:opacity-50">
                <option value="">{songs.length ? 'Select…' : 'No confirmed songs'}</option>
                {songs.map(s => <option key={s.key} value={s.key}>{s.name} ({s.counts.recordings}rec/{s.counts.shorts}sh)</option>)}
              </select>
            </label>
            <button onClick={run} disabled={!songKey || busy}
              className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-2 disabled:opacity-40">
              {busy ? 'Working…' : 'Find destinations'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap items-end">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink/45">Destination</span>
              <select value={destKey} onChange={e => setDestKey(e.target.value)}
                className="block text-[13px] border border-line rounded-lg px-2 py-1.5 mt-0.5 min-w-[280px]">
                <option value="">Select…</option>
                {dests.map(d => <option key={d.key} value={d.key}>{d.name} — {d.uploads} uploads{d.suspect ? ' (unverified)' : ''}</option>)}
              </select>
            </label>
            <button onClick={run} disabled={!destKey || busy}
              className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-2 disabled:opacity-40">
              {busy ? 'Working…' : 'Find songs'}
            </button>
          </div>
        )}

        {/* The selected song's description, with the tag editor. */}
        {dir === 'track' && song && (
          <div className="mt-3 border-t border-line/70 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-bold">{song.name}</div>
                <div className="text-[11px] text-ink/55">
                  {song.counts.recordings} recording(s) · {song.counts.shorts} Short(s) attached · {song.counts.promos} promotional
                  {song.counts.uncertain ? ` · ${song.counts.uncertain} uncertain link(s)` : ''}
                </div>
              </div>
              <TagEditor kind="track" id={`${slug}:${song.key}`} description={song.description}
                onSaved={() => loadSongs(slug)} />
            </div>
            <div className="mt-2"><Desc d={song.description} /></div>
            {song.promoAttachments?.length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] text-ink/50 cursor-pointer">
                  {song.promoAttachments.length} promotional upload(s) attached to this song — never used as its name
                </summary>
                <ul className="text-[11px] text-ink/55 mt-1 space-y-0.5">
                  {song.promoAttachments.map((p: any) => <li key={p.id}>· {p.title}</li>)}
                </ul>
              </details>
            )}
            {song.uncertainLinks?.length > 0 && (
              <details className="mt-1">
                <summary className="text-[11px] text-amber-700 cursor-pointer">
                  {song.uncertainLinks.length} uncertain link(s) — attached by title text alone, kept separate
                </summary>
                <ul className="text-[11px] text-ink/55 mt-1 space-y-0.5">
                  {song.uncertainLinks.map((p: any) => <li key={p.id}>· {p.title}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Destination profile, derived from repertoire — §3. */}
      {dir === 'destination' && res?.profile && (
        <div className="border border-line rounded-xl bg-white p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold">{res.profile.name}</div>
              <div className="text-[11px] text-ink/55">{res.profile.purpose}</div>
            </div>
            <TagEditor kind="dest" id={res.profile.key} description={res.profile.description} onSaved={run} />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[['Uploads', res.profile.uploads], ['Per week', res.profile.uploadsPerWeek],
              ['Median lifetime', res.profile.medianViews != null ? fmtNum(res.profile.medianViews) : '—'],
              ['Lower quartile', res.profile.lowerQuartileViews != null ? fmtNum(res.profile.lowerQuartileViews) : '—']].map(([l, v]: any) => (
              <div key={l} className="bg-paper rounded-lg px-2 py-1.5">
                <div className="text-[17px] font-black tabular-nums leading-none">{v}</div>
                <div className="text-[9px] uppercase tracking-wider text-ink/45 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3"><Desc d={res.profile.description} /></div>
          <Section title="Treatments it actually uses, with representative examples">
            <div className="space-y-1.5">
              {res.profile.treatments.slice(0, 5).map((t: any) => (
                <div key={t.name}>
                  <div className="text-[12px] font-semibold">{t.name} <span className="text-ink/50 font-normal tabular-nums">{t.n} uploads · {Math.round(t.share * 100)}%</span></div>
                  {t.examples.map((e: any) => <Vid key={e.id} v={e} />)}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {res && (
        <div>
          {hidden > 0 && (
            <div className="border border-line rounded-xl px-4 py-3 text-[12px] text-ink/55 mb-3 leading-snug">
              {hidden} pairing(s) hidden: editorial fit rested on language, format or a broad genre word rather than on a specific genre match.
            </div>
          )}
          {exact.length === 0 && inferred.length === 0 && (
            <div className="border border-line rounded-xl px-4 py-3 text-[13px] text-ink/70 mb-3">
              Nothing here has supported editorial fit. That is the honest answer, not an empty state to fill.
            </div>
          )}
          {res.notes.map((n, i) => (
            <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[12px] text-amber-900 mb-3 leading-snug">{n}</div>
          ))}

          {exact.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink/45 mb-2">
                Exact matches — observed fact, kept separate
              </div>
              <div className="space-y-3 mb-5">
                {exact.map(c => <CandidateCard key={c.id} c={c} verdict={feedback[c.id]} onVerdict={onVerdict} />)}
              </div>
            </>
          )}
          {inferred.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink/45 mb-2">
                Inferred editorial similarity — leads, not findings
              </div>
              <div className="space-y-3">
                {inferred.map(c => <CandidateCard key={c.id} c={c} verdict={feedback[c.id]} onVerdict={onVerdict} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
