'use client';
/* Compact song cards for owned-channel programming.
 *
 * Every number on a card says what it covers. "1.2M views" is useless if the
 * reader cannot tell whether it is this video, this song's assets, or the
 * channel — and the third would be meaningless here, so it never appears.
 *
 * The trend is drawn from dated observations and nothing else. No sparkline
 * is invented, no gap is interpolated, and a single observation draws
 * nothing, because a line between one point and the present implies a
 * measurement that was never taken.
 */

import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '@/lib/artists';

const LENS: Record<string, { label: string; fg: string; bg: string }> = {
  biggest:   { label: 'Biggest',        fg: '#0C6A3F', bg: '#E6F8EE' },
  moving:    { label: 'Moving now',     fg: '#8A4A1A', bg: '#FFEAD6' },
  extending: { label: 'Worth extending', fg: '#4A3A7A', bg: '#EFEAFB' },
};

const dt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const age = (d: number) => d < 1 ? 'today' : d < 60 ? `${d}d` : d < 730 ? `${Math.round(d / 30.44)}mo` : `${(d / 365.25).toFixed(1)}y`;

/* ── Trend from real observations only ──────────────────────────────── */
function Trend({ points, note }: { points: { ts: string; views: number }[]; note: string }) {
  if (points.length < 2) {
    /* One short line on the face of the card. The full explanation of why
       there is no history belongs in the drawer, not in the scan view. */
    return <div className="text-[10px] text-ink/35 mt-1">
      {points.length === 1 ? 'One reading — a trend needs two.' : 'No recorded history for this video.'}
    </div>;
  }
  const w = 132, h = 26;
  const xs = points.map(p => Date.parse(p.ts));
  const minX = xs[0], maxX = xs[xs.length - 1];
  const ys = points.map(p => p.views);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanY = Math.max(1, maxY - minY), spanX = Math.max(1, maxX - minX);
  const d = points.map((p, i) =>
    `${i ? 'L' : 'M'}${((Date.parse(p.ts) - minX) / spanX * w).toFixed(1)},${(h - (p.views - minY) / spanY * h).toFixed(1)}`
  ).join(' ');
  return (
    <div className="mt-1">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="#0E0E0E" strokeOpacity="0.45" strokeWidth="1.25"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={(Date.parse(p.ts) - minX) / spanX * w} cy={h - (p.views - minY) / spanY * h}
                  r="1.1" fill="#0E0E0E" fillOpacity="0.35" />
        ))}
      </svg>
      <div className="text-[9px] text-ink/35 tabular-nums mt-0.5">
        {points.length} readings · {dt(points[0].ts)} – {dt(points[points.length - 1].ts)}
      </div>
    </div>
  );
}

const Metric = ({ value, label, scope }: { value: string; label: string; scope?: string }) => (
  <div className="min-w-0">
    <div className="text-[19px] font-black leading-none tabular-nums truncate">{value}</div>
    <div className="text-[9px] uppercase tracking-[0.1em] text-ink/40 mt-1 truncate">{label}</div>
    {scope && <div className="text-[9px] text-ink/30 truncate">{scope}</div>}
  </div>
);

/* ── Save panel ─────────────────────────────────────────────────────── */
function SavePanel({ card, onSave, onCancel, destinations }: any) {
  const [dest, setDest] = useState('');
  const [kind, setKind] = useState<'owned' | 'reference' | 'undecided'>('undecided');
  const [treatment, setTreatment] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-t border-line bg-raised px-3 py-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] uppercase tracking-wider font-bold text-ink/40">Destination</span>
          <input list="mw-dests" value={dest} onChange={e => setDest(e.target.value)}
            placeholder="Destination to decide"
            className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-0.5 bg-surface" />
          <datalist id="mw-dests">{destinations.map((d: any) => <option key={d.key} value={d.name} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-wider font-bold text-ink/40">Treatment</span>
          <input value={treatment} onChange={e => setTreatment(e.target.value)}
            placeholder="Existing asset or new treatment"
            className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-0.5 bg-surface" />
        </label>
      </div>
      {/* A market channel is a reference example, never somewhere we can
          publish. Recorded at save time so the shortlist cannot blur them. */}
      <div className="flex gap-1.5 mt-2">
        {([['undecided', 'Undecided'], ['owned', 'VMG owned'], ['reference', 'Reference only']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)}
            className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 border transition ${
              kind === k ? 'bg-ink text-paper border-ink' : 'bg-surface border-line text-ink/50'}`}>{l}</button>
        ))}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
        className="w-full text-[12px] border border-line rounded-lg px-2 py-1 mt-2 bg-surface" />
      <div className="flex gap-2 mt-2">
        <button disabled={busy}
          onClick={async () => { setBusy(true); await onSave({ destination: dest, destinationKind: kind, treatment, note }); setBusy(false); }}
          className="text-[11px] font-bold uppercase tracking-wider bg-ink text-paper rounded-lg px-3 py-1.5 disabled:opacity-40">
          {busy ? 'Saving…' : 'Save to shortlist'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-ink/45 px-2">Cancel</button>
      </div>
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────────── */
function Card({ c, saved, onSave, onRemove, destinations }: any) {
  const [panel, setPanel] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const L = LENS[c.lens] ?? LENS.biggest;

  return (
    <div className="rounded-card border border-line bg-surface shadow-card overflow-hidden flex flex-col">
      <div className="flex gap-3 p-3">
        <a href={c.featured.url} target="_blank" rel="noreferrer" className="shrink-0 relative">
          <img src={c.featured.thumb} alt="" width={116} height={65}
            className="w-[116px] h-[65px] object-cover rounded-lg bg-raised" />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-black leading-tight truncate" title={c.song}>{c.song}</div>
              <div className="text-[11px] text-ink/50 truncate">{c.artist}</div>
            </div>
            <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
              style={{ background: L.bg, color: L.fg }}>{L.label}</span>
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {(c.featured.treatments.length ? c.featured.treatments : ['untagged']).slice(0, 2).map((t: string) => (
              <span key={t} className="text-[9px] uppercase tracking-wider text-ink/45 bg-raised rounded px-1.5 py-0.5">{t}</span>
            ))}
            {c.featured.isShort && <span className="text-[9px] uppercase tracking-wider text-ink/45 bg-raised rounded px-1.5 py-0.5">short</span>}
          </div>
        </div>
      </div>

      <div className="px-3 grid grid-cols-3 gap-2">
        <Metric
          value={c.measured ? `+${fmtNum(c.measured.gain)}` : '—'}
          label={c.measured ? `${c.measured.spanDays}d measured` : 'Not measured'}
          scope="featured video" />
        <Metric value={c.featured.views == null ? '—' : fmtNum(c.featured.views)}
          label="Lifetime" scope="featured video" />
        <Metric value={age(c.featured.ageDays)} label="Asset age" />
      </div>

      <div className="px-3 pt-1">
        <Trend points={c.trend} note={c.trendNote} />
      </div>

      <div className="px-3 py-2 text-[11px] text-ink/65 leading-snug">{c.why}</div>

      {/* Shorts are reported beside the record, never added to it. */}
      {c.shorts.count > 0 && (
        <div className="px-3 pb-2 text-[10px] text-ink/45">
          Separately: {c.shorts.count} Short{c.shorts.count > 1 ? 's' : ''}
          {c.shorts.views != null ? `, ${fmtNum(c.shorts.views)} views combined` : ', views unavailable'} — not included above.
        </div>
      )}

      <div className="mt-auto">
        {saved ? (
          <div className="flex items-center gap-2 border-t border-line bg-raised px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#0C6A3F' }}>✓ Shortlisted</span>
            <span className="text-[10px] text-ink/45 truncate flex-1">{saved.destination} · {saved.treatment}</span>
            <button onClick={onRemove} className="text-[10px] font-bold uppercase tracking-wider text-ink/40 hover:text-ink/70">Undo</button>
          </div>
        ) : panel ? (
          <SavePanel card={c} destinations={destinations} onCancel={() => setPanel(false)}
            onSave={async (v: any) => { await onSave(v); setPanel(false); }} />
        ) : (
          <div className="flex gap-2 border-t border-line px-3 py-2">
            <button onClick={() => setPanel(true)}
              className="text-[11px] font-bold uppercase tracking-wider bg-ink text-paper rounded-lg px-3 py-1.5">
              Add to shortlist
            </button>
            <button onClick={() => setDrawer(d => !d)}
              className="text-[11px] font-bold uppercase tracking-wider text-ink/45 hover:text-ink/75 px-2">
              {drawer ? 'Hide evidence' : 'View evidence'}
            </button>
          </div>
        )}
      </div>

      {drawer && (
        <div className="border-t border-line px-3 py-3 bg-raised/60 text-[11px]">
          <Row label="Coverage">{c.coverage}</Row>
          <Row label="Full-track assets">
            {c.fullTrack.count} asset(s){c.fullTrack.views != null ? `, ${fmtNum(c.fullTrack.views)} views across them` : ''} — sum over song assets, not one video.
            <div className="mt-1 space-y-0.5">
              {c.fullTrack.assets.map((a: any) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-ink/60 hover:underline truncate">
                  · {a.title} <span className="tabular-nums text-ink/40">{a.views == null ? 'n/a' : fmtNum(a.views)}</span>
                </a>
              ))}
            </div>
          </Row>
          {c.shorts.best && (
            <Row label="Best Short">
              <a href={c.shorts.best.url} target="_blank" rel="noreferrer" className="text-ink/60 hover:underline">
                {c.shorts.best.title} <span className="tabular-nums text-ink/40">{fmtNum(c.shorts.best.views ?? 0)}</span>
              </a>
            </Row>
          )}
          <Row label="Measurement">
            {c.measured
              ? `+${fmtNum(c.measured.gain)} views over ${c.measured.spanDays} days on the featured video. ${c.trendNote}`
              : c.trendNote}
          </Row>
          <Row label="Audience response">
            {c.comments.note}
            {c.comments.sample.length > 0 && (
              <div className="mt-1 space-y-1">
                {c.comments.sample.map((t: any, i: number) => (
                  <div key={i} className="text-ink/60 border-l-2 border-line pl-2">
                    “{t.text.slice(0, 140)}” <span className="text-ink/35">— {t.likeCount} likes</span>
                  </div>
                ))}
              </div>
            )}
          </Row>
          {c.marketAppearances.length > 0 && (
            <Row label="Seen on monitored market channels">
              {c.marketAppearances.map((m: any) => (
                <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="block text-ink/60 hover:underline truncate">
                  · {m.channel}: {m.title} <span className="tabular-nums text-ink/40">{m.views == null ? 'n/a' : fmtNum(m.views)}</span>
                </a>
              ))}
              <div className="text-ink/35 mt-1">Reference examples. These are not channels VMG controls.</div>
            </Row>
          )}
          {c.campaign && (
            <Row label="Campaign context">
              {c.campaign.phase ? `Phase ${c.campaign.phase}. ` : ''}
              {c.campaign.nextMoment ? `Next moment ${c.campaign.nextMoment.slice(0, 10)}.` : 'No upcoming moment recorded.'}
            </Row>
          )}
          <Row label="Permission">
            Not recorded anywhere in Watcher. Monitoring and ownership are different things from permission to create or place an asset.
          </Row>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, children }: any) => (
  <div className="mb-2 last:mb-0">
    <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-ink/35 mb-0.5">{label}</div>
    <div className="text-ink/70 leading-snug">{children}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════ */
export default function SongShortlist() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [shortlist, setShortlist] = useState<Record<string, any>>({});
  const [tab, setTab] = useState<'candidates' | 'saved'>('candidates');
  const [dests, setDests] = useState<any[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const j = await (await fetch('/api/market-watch/songs?window=7&per=4', { cache: 'no-store' })).json();
      setData(j); setShortlist(j.shortlist ?? {});
    } catch { setData({ error: true }); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { (async () => {
    try {
      const j = await (await fetch('/api/market-watch/connect?destinations=1', { cache: 'no-store' })).json();
      setDests(j.destinations ?? []);
    } catch {}
  })(); }, []);

  const save = useCallback(async (c: any, v: any) => {
    const body = { save: { key: c.key, slug: c.slug, artist: c.artist, song: c.song,
      featuredId: c.featured.id, featuredTitle: c.featured.title, lens: c.lens, ...v } };
    const j = await (await fetch('/api/market-watch/songs', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json().catch(() => null);
    if (j?.shortlist) setShortlist(j.shortlist);
  }, []);
  const remove = useCallback(async (key: string) => {
    const j = await (await fetch('/api/market-watch/songs', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ remove: key }) })).json().catch(() => null);
    if (j?.shortlist) setShortlist(j.shortlist);
  }, []);

  if (busy && !data) return <div className="rounded-card border border-line bg-surface p-4 text-[13px] text-ink/45">Reading song evidence…</div>;
  if (!data || data.error) return <div className="rounded-card border border-line bg-surface p-4 text-[13px] text-ink/60">Could not load song evidence.</div>;

  const cards: any[] = data.cards ?? [];
  const d = data.diagnostics ?? {};
  const saved = Object.values(shortlist);
  const groups: [string, any[]][] = [
    ['moving', cards.filter(c => c.lens === 'moving')],
    ['extending', cards.filter(c => c.lens === 'extending')],
    ['biggest', cards.filter(c => c.lens === 'biggest')],
  ];

  return (
    <div>
      <div className="flex gap-4 items-center mb-4 flex-wrap">
        {(['candidates', 'saved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[12px] font-bold uppercase tracking-wider pb-1 border-b-2 transition ${
              tab === t ? 'border-ink text-ink' : 'border-transparent text-ink/40 hover:text-ink/70'}`}>
            {t === 'candidates' ? 'Candidates' : `Shortlist (${saved.length})`}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink/40">
          {d.featuredAssetsWithMeasuredWindow ?? 0} of {d.songsBuilt ?? 0} songs have a measured {d.windowDays ?? 7}-day window
        </span>
      </div>

      {tab === 'candidates' ? (
        <>
          {groups.map(([lens, list]) => (
            <div key={lens} className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: LENS[lens].fg }}>
                  {LENS[lens].label}
                </span>
                <span className="text-[10px] text-ink/35">
                  {lens === 'moving' ? 'Views added over a measured window. Songs without dated observations are absent, not estimated.'
                   : lens === 'extending' ? 'A specific asset-level signal worth a follow-up.'
                   : 'Most consumption on the song’s own best full-track asset. Popularity earns consideration, not destination fit.'}
                </span>
              </div>
              {list.length === 0 ? (
                <div className="rounded-card border border-line bg-surface px-4 py-3 text-[12px] text-ink/50">
                  Nothing qualifies. {lens === 'moving' ? String(d.note ?? '') : ''}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map(c => (
                    <Card key={c.key} c={c} destinations={dests} saved={shortlist[c.key]}
                      onSave={(v: any) => save(c, v)} onRemove={() => remove(c.key)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      ) : (
        <div>
          {saved.length === 0 ? (
            <div className="rounded-card border border-line bg-surface px-4 py-3 text-[13px] text-ink/55">
              Nothing shortlisted yet.
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <table className="w-full text-[12px]">
                <thead><tr className="text-[10px] uppercase tracking-wider text-ink/40 border-b border-line">
                  <th className="text-left font-bold px-3 py-2">Song</th>
                  <th className="text-left font-bold px-2">Why</th>
                  <th className="text-left font-bold px-2">Destination</th>
                  <th className="text-left font-bold px-2">Treatment</th>
                  <th className="text-left font-bold px-2">Permission</th>
                  <th className="px-3"></th>
                </tr></thead>
                <tbody>
                  {saved.map((s: any) => (
                    <tr key={s.key} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-bold">{s.song}</div>
                        <div className="text-ink/45 text-[11px]">{s.artist}</div>
                      </td>
                      <td className="px-2 text-ink/60">{LENS[s.lens]?.label ?? s.lens}</td>
                      <td className="px-2">
                        <div>{s.destination}</div>
                        <div className="text-[10px] uppercase tracking-wider"
                          style={{ color: s.destinationKind === 'owned' ? '#0C6A3F' : s.destinationKind === 'reference' ? '#8A4A1A' : 'rgba(14,14,14,0.35)' }}>
                          {s.destinationKind === 'owned' ? 'VMG owned' : s.destinationKind === 'reference' ? 'Reference only' : 'Undecided'}
                        </div>
                      </td>
                      <td className="px-2 text-ink/70">{s.treatment}</td>
                      <td className="px-2 text-ink/50">{s.permission}</td>
                      <td className="px-3 text-right">
                        <button onClick={() => remove(s.key)} className="text-[10px] font-bold uppercase tracking-wider text-ink/35 hover:text-ink/70">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {saved.some((s: any) => s.note) && (
            <div className="mt-3 text-[11px] text-ink/55">
              {saved.filter((s: any) => s.note).map((s: any) => (
                <div key={s.key} className="mb-1"><b>{s.song}</b> — {s.note}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
