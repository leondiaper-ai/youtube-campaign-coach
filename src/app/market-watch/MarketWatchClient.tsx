'use client';
/* Two views over collected data. No API key reaches this component — it
   receives what the server already fetched, and asks the gated collect
   route to refresh it. */

import { useState, useMemo } from 'react';
import { fmtNum } from '@/lib/artists';
import type { MwCollection, MwVideo } from '@/lib/marketWatch/collect';

type Row = MwVideo & { ch: string; chKey: string };

/* Format is the container, read from duration. Shorts are counted and
   filtered separately throughout and never pooled with long-form. */
function format(v: MwVideo) {
  if (v.live === 'live' || v.live === 'upcoming') return 'live';
  if (v.durationSec == null) return 'unknown';
  if (v.durationSec <= 62) return 'short';
  if (v.durationSec >= 900) return 'long';
  return 'video';
}
const FMT: Record<string, string> = { short: 'Short', video: 'Video', long: 'Long-form', live: 'Live', unknown: '—' };

/* Version is the treatment, read from the title — independent of format,
   because a remix can be a Short. */
const VERSION_RULES: [RegExp, string][] = [
  [/\bsped\s*up\b/i, 'sped up'], [/\bslowed\b|\breverb\b/i, 'slowed'],
  [/\bremix\b/i, 'remix'], [/\b(edit|flip|bootleg|rework)\b/i, 'edit'],
  [/\blyric[s]?\b/i, 'lyric'], [/\bvisuali[sz]er\b/i, 'visualiser'],
  [/\bacoustic\b|\bstripped\b/i, 'acoustic'], [/\blive\b|\bsession\b/i, 'live'],
  [/\bcover\b/i, 'cover'], [/\b(mix|compilation|megamix|best of)\b/i, 'mix'],
];
const version = (t: string | null) => { for (const [re, n] of VERSION_RULES) if (re.test(t || '')) return n; return null; };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function parseTitle(title: string | null) {
  let t = (title || '').trim().replace(/#[^\s#]+/g, ' ');
  t = t.replace(/\s*[\[(](?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?|visuali[sz]er|hd|hq|4k)[^\])]*[\])]\s*/gi, ' ');
  const p = t.split(/\s+[-–—]\s+/);
  if (p.length < 2) return { artist: null as string | null, artistDisplay: null as string | null, track: null as string | null, trackDisplay: t.trim() };
  const a = p[0].trim();
  const tr = p.slice(1).join(' - ').replace(/\s*[\[(][^\])]*[\])]/g, ' ').trim();
  return { artist: norm(a), artistDisplay: a, track: norm(tr), trackDisplay: tr.replace(/\s+/g, ' ') };
}

const dt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
const mmss = (s: number | null) => s == null ? '—'
  : s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`
  : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function MarketWatchClient({ initial }: { initial: MwCollection | null }) {
  const [data, setData] = useState<MwCollection | null>(initial && !(initial as any).empty ? initial : null);
  const [tab, setTab] = useState<'uploads' | 'tracks'>('uploads');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [chFilter, setChFilter] = useState('');
  const [fmtFilter, setFmtFilter] = useState('');
  const [sort, setSort] = useState<'date' | 'views'>('date');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const rows: Row[] = useMemo(() =>
    (data?.channels ?? []).flatMap(c => c.items.map(v => ({ ...v, ch: c.name, chKey: c.key }))), [data]);

  async function collect() {
    setBusy(true); setMsg('Collecting…');
    const r = await fetch('/api/market-watch/collect', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { setMsg(`Failed: ${j.error ?? r.status}`); setBusy(false); return; }
    const d = await fetch('/api/market-watch/data').then(x => x.json());
    setData(d); setBusy(false);
    setMsg(`${j.channels.map((c: any) => `${c.name} ${c.retrieved}`).join(' · ')} — ${j.quotaUnits} units`);
  }

  if (!data) {
    return (
      <Shell onCollect={collect} busy={busy} msg={msg} data={null} tab={tab} setTab={setTab}>
        <div className="rounded-card border border-line bg-surface shadow-card p-6">
          <p className="text-body text-ink/60 m-0">
            Nothing collected yet. <b>Collect now</b> fetches the latest {100} uploads from Trap Nation,
            Chill Nation and 7clouds — about 13 quota units.
          </p>
        </div>
      </Shell>
    );
  }

  const shown = rows
    .filter(v => !chFilter || v.chKey === chFilter)
    .filter(v => fmtFilter === 'short' ? format(v) === 'short' : fmtFilter === 'notshort' ? format(v) !== 'short' : true)
    .sort(sort === 'views'
      ? (a, b) => (b.views ?? -1) - (a.views ?? -1)
      : (a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const shorts = shown.filter(v => format(v) === 'short').length;

  /* Grouped on artist AND track, so two different songs sharing a title
     are never merged. Uploads with no parseable artist are held out
     entirely rather than guessed into someone's catalogue. */
  const { groups, noArtist } = useMemo(() => {
    const idx = new Map<string, { p: ReturnType<typeof parseTitle>; rows: Row[] }>();
    const none: Row[] = [];
    rows.forEach(v => {
      const p = parseTitle(v.title);
      if (!p.artist || !p.track || p.track.length < 3) { none.push(v); return; }
      const k = `${p.artist}::${p.track}`;
      if (!idx.has(k)) idx.set(k, { p, rows: [] });
      idx.get(k)!.rows.push(v);
    });
    const gs = Array.from(idx.entries())
      .map(([k, g]) => ({ k, ...g,
        channels: new Set(g.rows.map((r: Row) => r.chKey)).size,
        versions: new Set(g.rows.map((r: Row) => version(r.title) || 'original')).size }))
      .filter(g => g.channels > 1 || g.versions > 1 || g.rows.length > 1)
      .sort((a, b) => b.channels - a.channels || b.rows.length - a.rows.length);
    return { groups: gs, noArtist: none };
  }, [rows]);

  return (
    <Shell onCollect={collect} busy={busy} msg={msg} data={data} tab={tab} setTab={setTab}>
      {tab === 'uploads' ? (
        <>
          <div className="flex gap-2 flex-wrap items-center mb-4">
            <Select value={chFilter} onChange={setChFilter}
              opts={[['', 'All channels'], ...data.channels.map(c => [c.key, `${c.name} (${c.retrieved})`] as [string, string])]} />
            <Select value={fmtFilter} onChange={setFmtFilter}
              opts={[['', 'Shorts and other'], ['notshort', 'Exclude Shorts'], ['short', 'Shorts only']]} />
            <Select value={sort} onChange={(v: string) => setSort(v as 'date' | 'views')}
              opts={[['date', 'Newest first'], ['views', 'Most views']]} />
            <span className="text-micro text-ink/40">
              {shown.length} shown · {shorts} Shorts, {shown.length - shorts} other
              {sort === 'views' && ' · lifetime views, not growth'}
            </span>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {shown.slice(0, 200).map((v: Row) => <Card key={v.id + v.chKey} v={v} />)}
          </div>
        </>
      ) : (
        <>
          <p className="text-meta text-ink/50 mb-4">
            Matched on artist and track parsed from the title — the Data API exposes no ISRC. Suggestions, for review.
          </p>
          {groups.length === 0 && <Empty>No repeated tracks or versions found across the collected uploads.</Empty>}
          {groups.map(g => {
            const seq = [...g.rows].sort((a, b) => (a.publishedAt || '').localeCompare(b.publishedAt || ''));
            const vers = Array.from(new Set(seq.map((r: Row) => version(r.title)).filter(Boolean))) as string[];
            const isOpen = open.has(g.k);
            return (
              <div key={g.k} className="rounded-card border border-line bg-surface shadow-card mb-2">
                <button
                  onClick={() => { const n = new Set(open); n.has(g.k) ? n.delete(g.k) : n.add(g.k); setOpen(n); }}
                  className="w-full flex justify-between items-center gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-bold text-body">{g.p.trackDisplay}</span>
                    <span className="block text-meta text-ink/50">{g.p.artistDisplay}</span>
                  </span>
                  <span className="flex gap-1.5 items-center flex-wrap justify-end">
                    {g.channels > 1 && <Pill tone="lf">{g.channels} channels</Pill>}
                    {vers.slice(0, 3).map(v => <Pill key={v} tone="vv">{v}</Pill>)}
                    <span className="text-micro text-ink/35 whitespace-nowrap">{seq.length} uploads</span>
                    <span className="text-ink/30 text-[11px]">{isOpen ? '▾' : '▸'}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-line px-4 py-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                    {seq.map((v: Row) => <Card key={v.id + v.chKey} v={v} />)}
                  </div>
                )}
              </div>
            );
          })}
          {noArtist.length > 0 && (
            <details className="mt-5">
              <summary className="text-micro font-bold uppercase tracking-label text-ink/45 cursor-pointer">
                No artist parsed from the title — not matched ({noArtist.length})
              </summary>
              <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                {noArtist.slice(0, 24).map((v: Row) => <Card key={v.id + v.chKey} v={v} />)}
              </div>
            </details>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, onCollect, busy, msg, data, tab, setTab }: any) {
  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-[1180px] mx-auto px-6 py-8">
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <h1 className="font-black text-[26px] leading-tight">Market Watch</h1>
          <span className="text-micro font-bold uppercase tracking-label px-2 py-0.5 rounded bg-warnSoft text-warn">
            Experimental
          </span>
        </div>
        <p className="text-meta text-ink/45 mb-5">
          How multi-artist channels publish and package music. Not artist monitoring.
        </p>

        {data && (
          <div className="flex gap-4 flex-wrap text-micro text-ink/50 border border-dashed border-lineStrong rounded-control bg-raised px-3 py-2 mb-5">
            <span>Collected <b className="text-ink/70">{new Date(data.collectedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b></span>
            {data.channels.map((c: any) => (
              <span key={c.key}>{c.name} <b className="text-ink/70">{c.retrieved}/{c.requested}</b>{c.complete ? '' : ' (incomplete)'}</span>
            ))}
            <span>{data.quotaUnits} quota units</span>
            {data.errors?.length > 0 && <span className="text-negative">{data.errors.length} error(s)</span>}
          </div>
        )}

        <div className="flex gap-2 items-center mb-5 flex-wrap">
          <Tab on={tab === 'uploads'} onClick={() => setTab('uploads')}>Latest uploads</Tab>
          <Tab on={tab === 'tracks'} onClick={() => setTab('tracks')}>Track examples</Tab>
          <span className="ml-auto flex items-center gap-3">
            {msg && <span className="text-micro text-ink/45">{msg}</span>}
            <button onClick={onCollect} disabled={busy}
              className="rounded-control bg-ink text-page text-[11px] font-bold uppercase tracking-[0.12em] px-3.5 py-2 disabled:opacity-40">
              {busy ? 'Collecting…' : data ? 'Refresh' : 'Collect now'}
            </button>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

const Tab = ({ on, onClick, children }: any) => (
  <button onClick={onClick}
    className={`text-[13px] font-semibold pb-1.5 border-b-2 ${on ? 'text-ink border-signal' : 'text-ink/40 border-transparent'}`}>
    {children}
  </button>
);
const Select = ({ value, onChange, opts }: any) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className="rounded-control border border-lineStrong bg-surface px-2.5 py-1.5 text-meta">
    {opts.map(([v, l]: [string, string]) => <option key={v} value={v}>{l}</option>)}
  </select>
);
const Pill = ({ tone, children }: any) => (
  <span className={`text-micro px-2 py-0.5 rounded-full ${
    tone === 'sh' ? 'bg-[#FBF0E0] text-shorts' : tone === 'vv' ? 'bg-[#EFEAFF] text-[#4B36C9]' : 'bg-[#E8EEFF] text-longform'}`}>
    {children}
  </span>
);
const Empty = ({ children }: any) => (
  <div className="rounded-card border border-line bg-surface p-5 text-body text-ink/50">{children}</div>
);

function Card({ v }: { v: Row }) {
  const p = parseTitle(v.title);
  const f = format(v);
  const ver = version(v.title);
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer"
      className="no-underline rounded-card border border-line bg-surface shadow-card overflow-hidden block hover:border-lineStrong transition-colors">
      <div className="relative bg-sunken aspect-video">
        {v.thumb
          ? /* eslint-disable-next-line @next/next/no-img-element */
            <img src={v.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full" />}
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white bg-black/75 rounded px-1.5 py-0.5 tabular-nums">
          {mmss(v.durationSec)}
        </span>
      </div>
      <div className="p-3">
        {p.artist && <div className="text-micro font-bold uppercase tracking-label text-ink/45 truncate">{p.artistDisplay}</div>}
        <div className="text-[13px] font-semibold leading-snug line-clamp-2 mt-0.5">{p.artist ? p.trackDisplay : v.title}</div>
        <div className="flex gap-1.5 items-center flex-wrap mt-2">
          <Pill tone={f === 'short' ? 'sh' : 'lf'}>{FMT[f]}</Pill>
          {ver && <Pill tone="vv">{ver}</Pill>}
          <span className="text-micro text-ink/40">{v.ch}</span>
          <span className="text-micro text-ink/35">{dt(v.publishedAt)}</span>
        </div>
        <div className="text-meta mt-1.5 tabular-nums">
          {v.views != null ? <><b>{fmtNum(v.views)}</b> <span className="text-ink/45">views</span></> : <span className="text-ink/35 italic">views unavailable</span>}
          {v.likes != null && <span className="text-ink/45"> · {fmtNum(v.likes)} likes</span>}
          {v.comments != null && <span className="text-ink/45"> · {fmtNum(v.comments)} comments</span>}
        </div>
      </div>
    </a>
  );
}
