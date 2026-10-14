'use client';
/* Three views: a comparison homepage, a per-channel page, and track examples.
   All read collected data — no API key reaches the browser. */

import { useState, useMemo, useEffect } from 'react';
import { fmtNum } from '@/lib/artists';
import type { MwChannelData, MwVideo } from '@/lib/marketWatch/collect';
import { MW_REGISTRY, REL_LABEL, ROLE_LABEL } from '@/lib/marketWatch/channels';
import ConnectView from './ConnectView';
import PilotView from './PilotView';
import SongShortlist from './SongShortlist';

type Row = MwVideo & { ch: string; chKey: string };

/* Format is the container, from duration. Version is the treatment, from the
   title. Independent — a remix can be a Short. */
function format(v: MwVideo) {
  if (v.live === 'live' || v.live === 'upcoming') return 'live';
  if (v.durationSec == null) return 'unknown';
  if (v.durationSec <= 62) return 'short';
  if (v.durationSec >= 900) return 'long';
  return 'video';
}
const FMT: Record<string, string> = { short:'Short', video:'Video', long:'Long-form', live:'Live', unknown:'—' };
const VERSION_RULES: [RegExp, string][] = [
  [/\bsped\s*up\b/i,'sped up'], [/\bslowed\b|\breverb\b/i,'slowed'], [/\bremix\b/i,'remix'],
  [/\b(edit|flip|bootleg|rework)\b/i,'edit'], [/\blyric|letra|testo\b/i,'lyric'],
  [/\bvisuali[sz]er\b/i,'visualiser'], [/\bacoustic\b|\bstripped\b/i,'acoustic'],
  [/\blive\b|\bsession\b/i,'live'], [/\bcover\b/i,'cover'],
  [/\b(mix|compilation|megamix|best of)\b/i,'mix'],
];
const version = (t: string) => { for (const [re,n] of VERSION_RULES) if (re.test(t)) return n; return null; };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
function parseTitle(title: string) {
  let t = title.replace(/#[^\s#]+/g,' ')
    .replace(/\s*[\[(](?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?|letra|testo|visuali[sz]er|hd|hq|4k)[^\])]*[\])]\s*/gi,' ');
  const p = t.split(/\s+[-–—]\s+/);
  if (p.length < 2) return { artist:null as string|null, artistDisplay:null as string|null, track:null as string|null, trackDisplay:t.trim() };
  const a = p[0].trim();
  const tr = p.slice(1).join(' - ').replace(/\s*[\[(][^\])]*[\])]/g,' ').trim();
  return { artist:norm(a), artistDisplay:a, track:norm(tr), trackDisplay:tr.replace(/\s+/g,' ') };
}

const dt = (iso: string) => new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'});
const ageDays = (iso: string) => Math.max(0, Math.floor((Date.now()-Date.parse(iso))/864e5));
const ageLabel = (d: number) => d===0?'today' : d===1?'1d old' : d<60?`${d}d old` : `${Math.round(d/30.44)}mo old`;
const mmss = (s: number|null) => s==null?'—' : s>=3600?`${Math.floor(s/3600)}h${String(Math.floor(s%3600/60)).padStart(2,'0')}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

const WINDOWS: [number, string][] = [[90,'Last 90 days'],[180,'Last 6 months'],[365,'Last year'],[1100,'All collected']];

export default function MarketWatchClient() {
  const [chans, setChans] = useState<MwChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try { const j = await (await fetch('/api/market-watch/data', { cache:'no-store' })).json();
          setChans(j.channels ?? []); } catch {}
    setLoading(false);
  })(); }, []);
  const [view, setView] = useState<'home'|'channel'|'tracks'|'virgin'|'connect'|'pilot'|'songs'>('songs');
  const [current, setCurrent] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [win, setWin] = useState(90);

  /* Every hook runs on every render. This useMemo used to sit below the
     loading and empty-state early returns, so React saw a different number
     of hooks once data arrived and threw #310. Hooks before branches. */
  const rows: Row[] = useMemo(()=> chans.flatMap(c=>c.items.map(v=>({...v, ch:c.name, chKey:c.key}))), [chans]);
  const have = new Set(chans.map(c => c.key));
  const missing = MW_REGISTRY.filter(c => !have.has(c.key)).map(c => c.key);

  async function collect(keys: string[]) {
    setBusy(true);
    let queue = [...keys], done = 0, failedAll: any[] = [], units = 0;
    while (queue.length) {
      setProgress(`Collecting — ${done}/${keys.length} done, ${queue.length} to go…`);
      const r = await fetch('/api/market-watch/collect',{ method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ keys: queue.slice(0,4) }) });
      const j = await r.json().catch(()=>({}));
      if (!j.ok) { setProgress(`Stopped: ${j.error ?? r.status}`); break; }
      done += j.done.length; units += j.quotaUnits; failedAll.push(...j.failed);
      queue = [...j.remaining, ...queue.slice(4)];
      if (!j.done.length && !j.failed.length && !j.remaining.length) break;
      if (!j.done.length && j.failed.length === queue.length) break;
      queue = queue.filter(k => !j.done.includes(k) && !j.failed.some((f:any)=>f.key===k));
    }
    const fresh = await fetch('/api/market-watch/data').then(r=>r.json());
    setChans(fresh.channels ?? []);
    setBusy(false);
    setProgress(`${done} collected · ${units} quota units${failedAll.length?` · ${failedAll.length} failed: ${failedAll.map(f=>f.name).join(', ')}`:''}`);
  }

  if (loading) {
    return <Shell busy={busy} progress={progress} onCollect={()=>{}} missing={0} view={view} setView={setView} chans={[]}>
      <Card><p className="text-ink/45 m-0 text-body">Loading collected data…</p></Card></Shell>;
  }
  if (!chans.length) {
    return <Shell busy={busy} progress={progress} onCollect={()=>collect(MW_REGISTRY.map(c=>c.key))} missing={missing.length} view={view} setView={setView} chans={[]}>
      <Card><p className="text-body text-ink/60 m-0">Nothing collected. <b>Collect all</b> fetches up to 36 months of uploads from {MW_REGISTRY.length} channels, in batches.</p></Card>
    </Shell>;
  }


  return (
    <Shell busy={busy} progress={progress} onCollect={()=>collect(missing.length?missing:MW_REGISTRY.map(c=>c.key))}
           missing={missing.length} view={view} setView={setView} chans={chans}
           win={win} setWin={setWin} current={current} setCurrent={setCurrent}>
      {view==='home'   && <Home chans={chans} win={win} open={(k)=>{setCurrent(k);setView('channel');}} />}
      {view==='channel'&& <Channel chans={chans} current={current} setCurrent={setCurrent} />}
      {view==='tracks' && <Tracks rows={rows} />}
      {view==='virgin' && <Virgin />}
      {view==='songs' && <SongShortlist />}
      {view==='connect' && <Connect />}
      {view==='pilot' && <PilotView />}
    </Shell>
  );
}

/* ── Homepage: what are they publishing, and how do they differ ───────── */
function Home({ chans, win, open }: { chans: MwChannelData[]; win: number; open:(k:string)=>void }) {
  const cut = Date.now() - win*864e5;
  const summary = chans.map(c => {
    const inWin = c.items.filter(v => Date.parse(v.publishedAt) >= cut);
    const f: Record<string,number> = {}, ver: Record<string,number> = {};
    inWin.forEach(v => { f[format(v)] = (f[format(v)]||0)+1; const x=version(v.title); if(x) ver[x]=(ver[x]||0)+1; });
    const views = inWin.map(v=>v.views).filter((x):x is number=>x!=null).sort((a,b)=>a-b);
    const durs = inWin.map(v=>v.durationSec).filter((x):x is number=>x!=null).sort((a,b)=>a-b);
    const topVer = Object.entries(ver).sort((a,b)=>b[1]-a[1])[0];
    return { c, n:inWin.length, perWeek:+(inWin.length/(win/7)).toFixed(1),
      median: views.length?views[Math.floor(views.length/2)]:null,
      medianDur: durs.length?durs[Math.floor(durs.length/2)]:null,
      shorts: f.short||0, formats:f,
      topVer: topVer ? `${topVer[0]} ${Math.round(topVer[1]/Math.max(1,inWin.length)*100)}%` : null,
      newest: inWin[0] };
  }).sort((a,b)=> b.perWeek - a.perWeek);

  const members = summary.filter(s=>s.c.relationship==='network_member');
  const external = summary.filter(s=>s.c.relationship!=='network_member');

  const Table = ({ list, title }: any) => !list.length ? null : (
    <div className="mb-6">
      <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-2">{title}</div>
      <div className="rounded-card border border-line bg-surface shadow-card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-micro uppercase tracking-label text-ink/45">
            <th className="text-left font-bold px-4 py-2.5">Channel</th>
            <th className="text-left font-bold px-2">Purpose</th>
            <th className="text-right font-bold px-2">Uploads</th>
            <th className="text-right font-bold px-2">Per week</th>
            <th className="text-right font-bold px-2">Median views</th>
            <th className="text-left font-bold px-2">Recurring</th>
            <th className="text-right font-bold px-4">Subs</th>
          </tr></thead>
          <tbody>
            {list.map((s:any)=>(
              <tr key={s.c.key} onClick={()=>open(s.c.key)}
                  className="border-t border-line hover:bg-raised cursor-pointer">
                <td className="px-4 py-2.5"><b>{s.c.name}</b>
                  <div className="text-micro text-ink/40">{ROLE_LABEL[s.c.role as keyof typeof ROLE_LABEL]}</div></td>
                <td className="px-2 text-ink/60 max-w-[260px]">{s.c.purpose}</td>
                <td className="px-2 text-right tabular-nums">{s.n}</td>
                <td className="px-2 text-right tabular-nums font-semibold">{s.perWeek}</td>
                <td className="px-2 text-right tabular-nums">{s.median!=null?fmtNum(s.median):'—'}</td>
                <td className="px-2">{s.topVer ? <Pill tone="vv">{s.topVer}</Pill> : <span className="text-ink/30">—</span>}
                  {s.shorts>0 && <Pill tone="sh">{s.shorts} Shorts</Pill>}</td>
                <td className="px-4 text-right tabular-nums text-ink/60">{s.c.subs!=null?fmtNum(s.c.subs):'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const allShorts = summary.reduce((a,s)=>a+s.shorts,0);
  const totalIn = summary.reduce((a,s)=>a+s.n,0);

  return (
    <>
      <div className="grid gap-3 mb-6 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Stat v={String(chans.length)} l="Channels collected" />
        <Stat v={totalIn.toLocaleString()} l={`Uploads in window`} />
        <Stat v={allShorts.toLocaleString()} l="Of those, Shorts" />
        <Stat v={summary[0]?.c.name ?? '—'} l="Most frequent publisher" s={summary[0]?`${summary[0].perWeek}/week`:''} />
      </div>
      <Table list={members} title={`${REL_LABEL.network_member} — Create / The Nations`} />
      <Table list={external} title={`${REL_LABEL.external_reference} — independently operated`} />
    </>
  );
}

/* ── Channel page ────────────────────────────────────────────────────── */
function Channel({ chans, current, setCurrent }: any) {
  const c: MwChannelData = chans.find((x:MwChannelData)=>x.key===current) ?? chans[0];
  const [win, setWin] = useState(90);
  const [fmtF, setFmtF] = useState('');
  const [verF, setVerF] = useState('');
  const [artist, setArtist] = useState('');
  const [sort, setSort] = useState<'date'|'views'>('date');

  const cut = Date.now() - win*864e5;
  const inWin = c.items.filter(v=>Date.parse(v.publishedAt)>=cut);
  const f: Record<string,number> = {}, ver: Record<string,number> = {}, artists: Record<string,number> = {};
  inWin.forEach(v=>{ f[format(v)]=(f[format(v)]||0)+1; const x=version(v.title); ver[x??'original']=(ver[x??'original']||0)+1;
    const p=parseTitle(v.title); if(p.artistDisplay) artists[p.artistDisplay]=(artists[p.artistDisplay]||0)+1; });

  let shown = inWin
    .filter(v=>!fmtF || format(v)===fmtF)
    .filter(v=>!verF || (version(v.title)??'original')===verF)
    .filter(v=>!artist || parseTitle(v.title).artistDisplay===artist);
  shown = [...shown].sort(sort==='views'
    ? (a,b)=>(b.views??-1)-(a.views??-1)
    : (a,b)=>b.publishedAt.localeCompare(a.publishedAt));

  const views = inWin.map(v=>v.views).filter((x):x is number=>x!=null).sort((a,b)=>a-b);
  const median = views.length?views[Math.floor(views.length/2)]:null;
  const notable = [...inWin].filter(v=>v.views!=null && median!=null && v.views > median*3)
    .sort((a,b)=>(b.views??0)-(a.views??0)).slice(0,4);
  const topArtists = Object.entries(artists).sort((a,b)=>b[1]-a[1]).slice(0,8);

  return (
    <>
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <select value={c.key} onChange={e=>setCurrent(e.target.value)} className="rounded-control border border-lineStrong bg-surface px-2.5 py-1.5 text-meta font-semibold">
          {chans.map((x:MwChannelData)=><option key={x.key} value={x.key}>{x.name}</option>)}
        </select>
        <Pill tone={c.relationship==='network_member'?'lf':'nt'}>{REL_LABEL[c.relationship as keyof typeof REL_LABEL]}</Pill>
        <Pill tone="nt">{ROLE_LABEL[c.role as keyof typeof ROLE_LABEL]}</Pill>
        <a className="text-micro text-ink/45" target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/channel/${c.channelId}`}>YouTube ↗</a>
      </div>

      <Card className="mb-4">
        <p className="text-body m-0 mb-2">{c.purpose}</p>
        <p className="text-meta text-ink/50 m-0">
          {c.retrieved.toLocaleString()} uploads collected{c.oldest&&c.newest?`, ${dt(c.oldest)} to ${dt(c.newest)}`:''}
          {c.cappedAt?` · stopped at the ${c.cappedAt} cap, older uploads exist`:c.reachedWindow?' · full 36-month window':''}
          {c.subs!=null?` · ${fmtNum(c.subs)} subscribers`:''}
        </p>
      </Card>

      <div className="flex gap-2 items-center flex-wrap mb-4">
        <Sel value={String(win)} onChange={(v:string)=>setWin(+v)} opts={WINDOWS.map(([d,l])=>[String(d),l] as [string,string])} />
        <Sel value={fmtF} onChange={setFmtF} opts={[['','All formats'],...Object.keys(f).map(k=>[k,`${FMT[k]} (${f[k]})`] as [string,string])]} />
        <Sel value={verF} onChange={setVerF} opts={[['','All versions'],...Object.entries(ver).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[k,`${k} (${n})`] as [string,string])]} />
        <Sel value={artist} onChange={setArtist} opts={[['','All artists'],...topArtists.map(([a,n])=>[a,`${a} (${n})`] as [string,string])]} />
        <Sel value={sort} onChange={(v:string)=>setSort(v as 'date'|'views')} opts={[['date','Newest first'],['views','Most views']]} />
        <span className="text-micro text-ink/40">{shown.length} shown{sort==='views'&&' · lifetime views, older uploads have had longer'}</span>
      </div>

      <div className="grid gap-3 mb-6 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Stat v={String(inWin.length)} l={`Uploads, ${win}d`} />
        <Stat v={String(+(inWin.length/(win/7)).toFixed(1))} l="Per week" />
        <Stat v={median!=null?fmtNum(median):'—'} l="Median views" s="in window" />
        <Stat v={String(f.short??0)} l="Shorts" s={`of ${inWin.length}`} />
      </div>

      {notable.length>0 && (
        <div className="mb-6">
          <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-2">
            Notable — more than 3× this channel&rsquo;s median in the window
          </div>
          <Grid>{notable.map((v:MwVideo)=><VCard key={v.id} v={{...v, ch:c.name, chKey:c.key}} />)}</Grid>
        </div>
      )}

      <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-2">Uploads</div>
      <Grid>{shown.slice(0,60).map((v:MwVideo)=><VCard key={v.id} v={{...v, ch:c.name, chKey:c.key}} />)}</Grid>
    </>
  );
}

/* ── Track examples ──────────────────────────────────────────────────── */
function Tracks({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { cross, versions, unparsed } = useMemo(()=>{
    const idx = new Map<string,{p:ReturnType<typeof parseTitle>;rows:Row[]}>();
    const none: Row[] = [];
    rows.forEach(v=>{ const p=parseTitle(v.title);
      if(!p.artist||!p.track||p.track.length<3){none.push(v);return;}
      const k=`${p.artist}::${p.track}`; if(!idx.has(k)) idx.set(k,{p,rows:[]}); idx.get(k)!.rows.push(v); });
    const all = Array.from(idx.entries()).map(([k,g])=>({k,...g,
      channels:new Set(g.rows.map(r=>r.chKey)).size,
      versions:new Set(g.rows.map(r=>version(r.title)??'original')).size }));
    return { cross: all.filter(g=>g.channels>1).sort((a,b)=>b.channels-a.channels||b.rows.length-a.rows.length),
             versions: all.filter(g=>g.channels===1&&g.versions>1).sort((a,b)=>b.versions-a.versions).slice(0,40),
             unparsed: none };
  },[rows]);

  const Group = ({g}:any) => {
    const seq=[...g.rows].sort((a:Row,b:Row)=>a.publishedAt.localeCompare(b.publishedAt));
    const isOpen=open.has(g.k);
    return (
      <div className="rounded-card border border-line bg-surface shadow-card mb-2">
        <button onClick={()=>{const n=new Set(open);n.has(g.k)?n.delete(g.k):n.add(g.k);setOpen(n);}}
          className="w-full flex justify-between items-center gap-3 px-4 py-3 text-left">
          <span><span className="block font-bold text-body">{g.p.trackDisplay}</span>
            <span className="block text-meta text-ink/50">{g.p.artistDisplay}</span></span>
          <span className="flex gap-1.5 items-center flex-wrap justify-end">
            {g.channels>1 && <Pill tone="lf">{g.channels} channels</Pill>}
            {g.versions>1 && <Pill tone="vv">{g.versions} versions</Pill>}
            <span className="text-micro text-ink/35">{dt(seq[0].publishedAt)} → {dt(seq[seq.length-1].publishedAt)}</span>
            <span className="text-ink/30 text-[11px]">{isOpen?'▾':'▸'}</span></span>
        </button>
        {isOpen && <div className="border-t border-line px-4 py-3"><Grid small>{seq.map((v:Row)=><VCard key={v.id+v.chKey} v={v} showCh />)}</Grid></div>}
      </div>
    );
  };

  return (
    <>
      <p className="text-meta text-ink/50 mb-4">
        Matched on artist and track parsed from the title — no ISRC is available from the Data API. Different artists sharing a title are never merged.
      </p>
      <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-2">
        Same track on more than one channel ({cross.length})
      </div>
      {cross.length ? cross.map(g=><Group key={g.k} g={g} />)
        : <Card className="mb-6"><p className="m-0 text-ink/55 text-body">None found across the collected uploads.</p></Card>}

      <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-2 mt-6">
        More than one version, same channel ({versions.length})
      </div>
      {versions.map(g=><Group key={g.k} g={g} />)}

      {unparsed.length>0 && (
        <details className="mt-5">
          <summary className="text-micro font-bold uppercase tracking-label text-ink/45 cursor-pointer">
            No artist parsed — not matched ({unparsed.length})
          </summary>
          <div className="mt-3"><Grid small>{unparsed.slice(0,24).map(v=><VCard key={v.id+v.chKey} v={v} showCh />)}</Grid></div>
        </details>
      )}
    </>
  );
}


/* ── Virgin watched artists → evidence → suggestions ─────────────────── */
function Virgin() {
  const [artists,setArtists]=useState<any[]>([]);
  const [slug,setSlug]=useState('');
  const [tracks,setTracks]=useState<any[]>([]);
  const [open,setOpen]=useState<string|null>(null);
  const [sugg,setSugg]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [marks,setMarks]=useState<Record<string,string>>({});

  useEffect(()=>{(async()=>{
    const j=await (await fetch('/api/market-watch/virgin')).json();
    setArtists(j.artists??[]); setLoading(false);
  })();},[]);
  useEffect(()=>{ if(!slug) return; (async()=>{
    setBusy(true); setTracks([]); setOpen(null); setSugg(null);
    const j=await (await fetch(`/api/market-watch/virgin?artist=${slug}`)).json();
    setTracks(j.tracks??[]); setBusy(false);
  })();},[slug]);

  async function explore(key:string){
    setBusy(true); setSugg(null);
    const j=await (await fetch(`/api/market-watch/virgin?artist=${slug}&track=${encodeURIComponent(key)}`)).json();
    setSugg(j); setBusy(false);
  }

  if (loading) return <Card><p className="m-0 text-ink/45">Loading watched artists…</p></Card>;

  const withUploads=artists.filter(a=>a.uploads>0);
  return (
    <>
      <p className="text-meta text-ink/50 mb-4">
        Read from Watcher&rsquo;s stored artist data. <b>Monitored</b>, <b>ownership</b> and <b>permission to create or place an asset</b>
        are three different things — permission is recorded nowhere in this codebase and is always shown as unknown.
      </p>
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <Sel value={slug} onChange={setSlug}
          opts={[['','Select a watched artist'],...withUploads.map((a:any)=>[a.slug,`${a.name} — ${a.tracks} tracks, ${a.uploads} uploads`] as [string,string])]} />
        <span className="text-micro text-ink/40">{withUploads.length} artists with cached uploads</span>
      </div>

      {busy && <Card><p className="m-0 text-ink/45">Working…</p></Card>}

      {!slug && !busy && (
        <div className="rounded-card border border-line bg-surface shadow-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="text-micro uppercase tracking-label text-ink/45">
              <th className="text-left font-bold px-4 py-2.5">Artist</th>
              <th className="text-left font-bold px-2">Ownership</th>
              <th className="text-right font-bold px-2">Tracks</th>
              <th className="text-right font-bold px-2">Uploads</th>
              <th className="text-right font-bold px-4">Last upload</th>
            </tr></thead>
            <tbody>{withUploads.slice(0,40).map((a:any)=>(
              <tr key={a.slug} onClick={()=>setSlug(a.slug)} className="border-t border-line hover:bg-raised cursor-pointer">
                <td className="px-4 py-2.5"><b>{a.name}</b></td>
                <td className="px-2"><Pill tone={a.ownership==='virgin'?'lf':'nt'}>{a.ownership}</Pill></td>
                <td className="px-2 text-right tabular-nums">{a.tracks}</td>
                <td className="px-2 text-right tabular-nums">{a.uploads}</td>
                <td className="px-4 text-right text-ink/50">{a.lastUpload?dt(a.lastUpload):'—'}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {slug && !busy && tracks.length===0 && (
        <Card><p className="m-0 text-ink/55">No cached uploads for this artist in Watcher&rsquo;s store.</p></Card>)}

      {slug && tracks.map((t:any)=>(
        <div key={t.songKey} className="rounded-card border border-line bg-surface shadow-card mb-2">
          <button onClick={()=>setOpen(open===t.songKey?null:t.songKey)}
            className="w-full flex justify-between items-center gap-3 px-4 py-3 text-left">
            <span><span className="block font-bold text-body">{t.title}</span>
              <span className="block text-meta text-ink/50">{t.assets.length} asset(s) · first {dt(t.firstSeen)}</span></span>
            <span className="flex gap-1.5 items-center flex-wrap justify-end">
              {Object.entries(t.containers).map(([k,n]:any)=><Pill key={k} tone={k==='short'?'sh':'lf'}>{k} {n}</Pill>)}
              {t.marketAppearances.length>0 && <Pill tone="vv">{t.marketAppearances.length} market</Pill>}
              <span className="text-ink/30 text-[11px]">{open===t.songKey?'▾':'▸'}</span></span>
          </button>
          {open===t.songKey && (
            <div className="border-t border-line px-4 py-3">
              <div className="grid gap-3 mb-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                <Stat v={String(t.assets.length)} l="Assets found" />
                <Stat v={String(t.shortsLinked.length)} l="Shorts named for it" s={t.shortsAmbiguous?`${t.shortsAmbiguous} ambiguous`:''} />
                <Stat v={String(t.treatmentsFound.length)} l="Treatments present" />
                <Stat v={String(t.marketAppearances.length)} l="Market appearances" />
              </div>

              <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-1">Treatments present</div>
              <div className="flex gap-1.5 flex-wrap mb-3">{t.treatmentsFound.length
                ? t.treatmentsFound.map((x:string)=><Pill key={x} tone="vv">{x}</Pill>)
                : <span className="text-ink/40 text-meta">none tagged</span>}</div>

              <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-1">
                Not found in our coverage <span className="font-normal normal-case tracking-normal text-ink/35">— absence here is not proof it does not exist</span>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">{t.treatmentsNotFound.map((x:string)=>
                <span key={x} className="text-micro px-2 py-0.5 rounded-full bg-sunken text-ink/40">{x}</span>)}</div>

              <Grid small>{t.assets.slice(0,8).map((a:any)=>(
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                   className="no-underline rounded-control border border-line bg-raised p-2.5 block hover:border-lineStrong">
                  <div className="text-[12px] font-semibold leading-snug line-clamp-2">{a.title}</div>
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    <Pill tone={a.container==='short'?'sh':'lf'}>{a.container}</Pill>
                    {a.treatments.filter((x:string)=>x!=='untagged').slice(0,2).map((x:string)=><Pill key={x} tone="vv">{x}</Pill>)}
                  </div>
                  <div className="text-micro text-ink/45 mt-1.5 flex justify-between">
                    <span>{a.views!=null?fmtNum(a.views)+' views':'views unavailable'}</span>
                    <span>{a.ageDays}d old</span></div>
                </a>))}</Grid>

              <div className="mt-3"><button onClick={()=>explore(t.songKey)}
                className="rounded-control bg-ink text-paper text-[11px] font-bold uppercase tracking-[0.12em] px-3.5 py-2">
                Explore opportunities</button></div>

              {sugg && open===t.songKey && (
                <div className="mt-4">
                  {sugg.suggestions?.length ? sugg.suggestions.map((s:any,i:number)=>(
                    <div key={i} className="rounded-control border border-line bg-raised p-3.5 mb-2">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <div><b className="text-body">{s.destination}</b>
                          <span className="text-meta text-ink/50"> · {s.asset}</span>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            <Pill tone="nt">{s.destinationRole.replace(/_/g,' ')}</Pill>
                            <Pill tone={s.destinationRelationship==='network_member'?'lf':'nt'}>{s.destinationRelationship.replace(/_/g,' ')}</Pill>
                            <Pill tone="sh">permission unknown</Pill>
                          </div></div>
                        <div className="flex gap-1">{['Useful','Obvious','Unsuitable','Unsupported'].map(m=>(
                          <button key={m} onClick={()=>setMarks({...marks,[s.destination+i]:m})}
                            className={`text-micro px-2 py-1 rounded border ${marks[s.destination+i]===m?'bg-ink text-paper border-ink':'border-line text-ink/50'}`}>{m}</button>))}</div>
                      </div>
                      <p className="text-meta m-0 mb-2">{s.why}</p>
                      <Det title="Watcher evidence" items={s.watcherEvidence} />
                      <div className="text-micro font-bold uppercase tracking-label text-ink/45 mt-2 mb-1">Market examples</div>
                      {s.marketExamples.map((e:any,j:number)=>(
                        <a key={j} href={e.url} target="_blank" rel="noopener noreferrer" className="block text-meta text-longform mb-0.5">
                          {e.label} <span className="text-ink/40">— {e.note}</span></a>))}
                      <Det title="Why comparable" items={[s.comparability]} />
                      <Det title="Counter-evidence" items={s.counterEvidence} />
                      <Det title="Test" items={[s.test]} />
                      <Det title="Review criteria" items={[s.review]} />
                    </div>
                  )) : (
                    <div className="rounded-control border border-line bg-raised p-3.5">
                      <b className="text-body">Insufficient evidence</b>
                      <p className="text-meta text-ink/55 m-0 mt-1">{sugg.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
const Det = ({title,items}:any)=>(
  <div className="mt-2">
    <div className="text-micro font-bold uppercase tracking-label text-ink/45 mb-0.5">{title}</div>
    {items.filter(Boolean).map((x:string,i:number)=><div key={i} className="text-meta text-ink/65 leading-snug">{x}</div>)}
  </div>);

/* ── Shell + primitives ──────────────────────────────────────────────── */
function Shell({ children, busy, progress, onCollect, missing, view, setView, chans, win, setWin }: any) {
  const oldest = chans.length ? chans.map((c:MwChannelData)=>c.collectedAt).sort()[0] : null;
  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-[1180px] mx-auto px-6 py-8">
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <h1 className="font-black text-[26px] leading-tight">Market Watch</h1>
          <span className="text-micro font-bold uppercase tracking-label px-2 py-0.5 rounded bg-warnSoft text-warn">Experimental</span>
        </div>
        <p className="text-meta text-ink/45 mb-5">How multi-artist channels publish and package music.</p>

        {chans.length>0 && (
          <div className="flex gap-4 flex-wrap items-center text-micro text-ink/50 border border-dashed border-lineStrong rounded-control bg-raised px-3 py-2 mb-5">
            <span><b className="text-ink/70">{chans.length}</b> of {MW_REGISTRY.length} channels</span>
            <span><b className="text-ink/70">{chans.reduce((a:number,c:MwChannelData)=>a+c.retrieved,0).toLocaleString()}</b> uploads, up to 36 months</span>
            {oldest && <span>Collected {new Date(oldest).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>}
            {missing>0 && <span className="text-warn">{missing} not yet collected</span>}
          </div>
        )}

        <div className="flex gap-4 items-center mb-5 flex-wrap">
          <Tab on={view==='songs'} onClick={()=>setView('songs')}>Songs</Tab>
          <Tab on={view==='home'} onClick={()=>setView('home')}>Overview</Tab>
          <Tab on={view==='channel'} onClick={()=>setView('channel')}>Channels</Tab>
          <Tab on={view==='tracks'} onClick={()=>setView('tracks')}>Track examples</Tab>
          <Tab on={view==='virgin'} onClick={()=>setView('virgin')}>Virgin tracks</Tab>
          <Tab on={view==='connect'} onClick={()=>setView('connect')}>Connect</Tab>
          <Tab on={view==='pilot'} onClick={()=>setView('pilot')}>Pilot</Tab>
          {view==='home' && setWin && (
            <Sel value={String(win)} onChange={(v:string)=>setWin(+v)} opts={WINDOWS.map(([d,l])=>[String(d),l] as [string,string])} />
          )}
          <span className="ml-auto flex items-center gap-3">
            {progress && <span className="text-micro text-ink/45">{progress}</span>}
            <button onClick={onCollect} disabled={busy}
              className="rounded-control bg-ink text-paper text-[11px] font-bold uppercase tracking-[0.12em] px-3.5 py-2 disabled:opacity-40">
              {busy?'Collecting…':missing>0?`Collect ${missing} missing`:'Refresh all'}
            </button>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
const Tab = ({on,onClick,children}:any)=>(
  <button onClick={onClick} className={`text-[13px] font-semibold pb-1.5 border-b-2 ${on?'text-ink border-signal':'text-ink/40 border-transparent'}`}>{children}</button>);
const Sel = ({value,onChange,opts}:any)=>(
  <select value={value} onChange={e=>onChange(e.target.value)} className="rounded-control border border-lineStrong bg-surface px-2.5 py-1.5 text-meta">
    {opts.map(([v,l]:[string,string])=><option key={v} value={v}>{l}</option>)}</select>);
const Pill = ({tone,children}:any)=>(
  <span className={`text-micro px-2 py-0.5 rounded-full whitespace-nowrap ${
    tone==='sh'?'bg-[#FBF0E0] text-shorts':tone==='vv'?'bg-[#EFEAFF] text-[#4B36C9]':tone==='nt'?'bg-sunken text-ink/60':'bg-[#E8EEFF] text-longform'}`}>{children}</span>);
const Card = ({children,className=''}:any)=>(
  <div className={`rounded-card border border-line bg-surface shadow-card p-4 ${className}`}>{children}</div>);
const Stat = ({v,l,s}:any)=>(
  <div className="rounded-control border border-line bg-raised px-3 py-2.5">
    <div className="text-[22px] font-black leading-none tabular-nums truncate">{v}</div>
    <div className="text-micro font-bold uppercase tracking-label text-ink/50 mt-2">{l}</div>
    {s && <div className="text-micro text-ink/35 mt-0.5">{s}</div>}</div>);
const Grid = ({children,small}:any)=>(
  <div className={`grid gap-3 ${small?'[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]':'[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]'}`}>{children}</div>);

function VCard({ v, showCh }: { v: Row; showCh?: boolean }) {
  const p = parseTitle(v.title), f = format(v), ver = version(v.title), age = ageDays(v.publishedAt);
  return (
    <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
      className="no-underline rounded-card border border-line bg-surface shadow-card overflow-hidden block hover:border-lineStrong transition-colors">
      <div className="relative bg-sunken aspect-video">
        {v.thumb && /* eslint-disable-next-line @next/next/no-img-element */
          <img src={v.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />}
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white bg-black/75 rounded px-1.5 py-0.5 tabular-nums">{mmss(v.durationSec)}</span>
      </div>
      <div className="p-3">
        {p.artistDisplay && <div className="text-micro font-bold uppercase tracking-label text-ink/45 truncate">{p.artistDisplay}</div>}
        <div className="text-[13px] font-semibold leading-snug line-clamp-2 mt-0.5">{p.artist?p.trackDisplay:v.title}</div>
        <div className="flex gap-1.5 items-center flex-wrap mt-2">
          <Pill tone={f==='short'?'sh':'lf'}>{FMT[f]}</Pill>
          {ver && <Pill tone="vv">{ver}</Pill>}
          {showCh && <span className="text-micro text-ink/45">{v.ch}</span>}
        </div>
        <div className="text-meta mt-1.5 tabular-nums flex justify-between gap-2">
          <span>{v.views!=null?<><b>{fmtNum(v.views)}</b> <span className="text-ink/45">views</span></>:<span className="text-ink/35 italic">unavailable</span>}</span>
          <span className="text-ink/35">{ageLabel(age)}</span>
        </div>
      </div>
    </a>
  );
}

/* Connect needs the watched-artist list for its picker; everything else it
   fetches itself. */
function Connect() {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try {
      const j = await (await fetch('/api/market-watch/virgin', { cache:'no-store' })).json();
      setArtists((j.artists ?? []).filter((a:any)=>a.uploads>0));
    } catch {}
    setLoading(false);
  })(); }, []);
  if (loading) return <Card><p className="m-0 text-ink/45">Loading watched artists…</p></Card>;
  return (
    <>
      <p className="text-meta text-ink/50 mb-4">
        A previous appearance is <b>evidence</b>, not a gate. Three routes qualify a pairing: the destination has
        published this artist (exact), another artist&rsquo;s track overlaps on description (inferred), or the
        destination leans on a treatment this song lacks (observed on the destination only).
        Fit is retrieved first; performance is attached afterwards as a distribution, never as a prediction.
      </p>
      <ConnectView artists={artists} />
    </>
  );
}
