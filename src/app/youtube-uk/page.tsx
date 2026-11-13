import Link from 'next/link';
import { getAllArtists } from '@/lib/marketScope';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { YOUTUBE_UK_ROSTER } from '@/lib/youtubeUkRoster';

export const revalidate = 600;
export const metadata = {
  title: 'YouTube UK | Shared Channel Watcher',
  description: 'Agreed UK artist monitoring universe, using the same cached YouTube observations as the VMG Watcher.',
  robots: { index: false, follow: false },
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const fmt = (n: number | null | undefined) => n == null ? '—' : Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const count = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('en-GB');

export default async function YoutubeUkWatcher() {
  const all = await getAllArtists();
  const byName = new Map(all.map(a => [key(a.name), a]));
  const roster = YOUTUBE_UK_ROSTER.map(item => ({ ...item, artist: byName.get(key(item.name)) }));
  const handles = roster.map(r => r.artist?.channelHandle).filter((v): v is string => !!v);
  const [snaps, sync] = await Promise.all([readAllLiveSnaps(handles), readSyncMeta()]);
  const rows = await Promise.all(roster.map(async item => {
    const snap = item.artist?.channelHandle ? snaps.get(item.artist.channelHandle) : null;
    const history = snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
    const normalized = normalizeChannelData(snap ?? null, history);
    const uploads = snap?.recentUploads ?? [];
    const lastUpload = uploads.length ? uploads.map(u => u.publishedAt).sort().reverse()[0] : null;
    return {
      ...item,
      matched: !!item.artist,
      hasData: !!snap && !snap.error,
      subscribers: normalized.subs,
      views7d: rawDelta(normalized.views7d),
      subs7d: rawDelta(normalized.subs7d),
      uploads30d: normalized.cadence.uploads30d,
      shorts30d: normalized.cadence.shorts30d,
      lastUpload,
      freshness: normalized.dataStatus,
    };
  }));
  const tracked = rows.filter(r => r.hasData).length;
  const active = rows.filter(r => (r.uploads30d ?? 0) + (r.shorts30d ?? 0) > 0).length;
  const missing = rows.filter(r => !r.hasData).length;
  const syncedAt = sync?.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : 'Unavailable';

  return <main className="min-h-screen bg-paper text-ink">
    <header className="border-b border-line bg-surface">
      <div className="max-w-[1180px] mx-auto px-6 py-5 flex flex-wrap justify-between items-center gap-3">
        <div><div className="text-xs font-bold uppercase tracking-widest text-muted">VMG × YouTube UK</div><div className="text-xl font-bold">Shared Channel Watcher</div></div>
        <div className="text-xs text-muted">YouTube observations last synced: {syncedAt}</div>
      </div>
    </header>
    <section className="max-w-[1180px] mx-auto px-6 py-9">
      <div className="flex flex-wrap justify-between gap-4 items-end mb-7">
        <div><h1 className="text-3xl font-bold tracking-tight">UK priority channels</h1><p className="text-sm text-muted mt-2 max-w-2xl">One agreed artist universe for Virgin Music and YouTube UK. The numbers use the same Watcher cache, not a separate reporting engine.</p></div>
        <a className="text-sm font-semibold underline" href="https://docs.google.com/spreadsheets/d/1vgJXqW5kH4XAWAzyOUPOOZdiY78iOzOlEbVrzp0bzWI/edit?gid=0#gid=0" target="_blank" rel="noreferrer">Agreed roster ↗</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {[[String(rows.length),'Priority artists'],[String(tracked),'With Watcher data'],[String(active),'Publishing in 30d'],[String(missing),'Need channel matching / data']].map(([value,label]) => <div key={label} className="border border-line bg-surface rounded-xl p-4"><div className="text-3xl font-bold tabular-nums">{value}</div><div className="text-xs text-muted mt-1">{label}</div></div>)}
      </div>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase tracking-wide text-muted border-b border-line bg-paper"><tr><th className="p-3">Artist</th><th className="p-3">Label</th><th className="p-3 text-right">Subscribers</th><th className="p-3 text-right">Views 7d</th><th className="p-3 text-right">Subs 7d</th><th className="p-3 text-right">Uploads 30d</th><th className="p-3 text-right">Shorts 30d</th><th className="p-3">Last upload</th><th className="p-3">Coverage</th></tr></thead>
          <tbody>{rows.map((r,i) => <tr key={r.name + i} className="border-b border-line-faint last:border-0 hover:bg-paper/70">
            <td className="p-3 font-semibold whitespace-nowrap">{r.artist ? <Link href={`/channel/${r.artist.slug}`} className="underline decoration-line-strong hover:text-signal">{r.name}</Link> : r.name}</td>
            <td className="p-3 text-muted whitespace-nowrap">{r.label || '—'}</td>
            <td className="p-3 text-right tabular-nums">{fmt(r.subscribers)}</td>
            <td className="p-3 text-right tabular-nums">{fmt(r.views7d)}</td>
            <td className="p-3 text-right tabular-nums">{count(r.subs7d)}</td>
            <td className="p-3 text-right tabular-nums">{count(r.uploads30d)}</td>
            <td className="p-3 text-right tabular-nums">{count(r.shorts30d)}</td>
            <td className="p-3 text-muted whitespace-nowrap">{r.lastUpload ? new Date(r.lastUpload).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
            <td className="p-3 whitespace-nowrap text-xs">{!r.matched ? 'Channel not matched' : !r.hasData ? 'Awaiting snapshot' : 'Tracked'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-5 text-xs text-muted space-y-2"><p>Roster: agreed UK priority list, snapshot from 13 Nov 2026. Review membership every six months with YouTube UK. Edits to the Google Sheet do not yet update this page automatically.</p><p>Missing readings are shown as —, not zero. New artist channels need matching and inclusion in the shared Watcher collection before data can appear. This is a partner-facing view: it does not include private campaign plans or edit controls.</p></div>
    </section>
  </main>;
}
