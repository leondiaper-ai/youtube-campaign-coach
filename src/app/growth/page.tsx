import Link from 'next/link';
import { ARTISTS, fmtNum } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import Sparkline from '@/components/Sparkline';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const MUTED = '#E9E2D3';
const GOOD = '#0C6A3F';
const BAD = '#8A1F0C';

export default async function GrowthPage() {
  const rows = await Promise.all(
    ARTISTS.map(async (a) => {
      const snap = a.channelHandle ? await fetchChannelSnap(a.channelHandle) : null;
      const history =
        snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
      return {
        artist: a,
        snap,
        history,
        subs7: deltaOver(history, 7, 'subs'),
        subs30: deltaOver(history, 30, 'subs'),
        views7: deltaOver(history, 7, 'views'),
        subsSeries: seriesForField(history, 'subs', 30),
      };
    })
  );
  const sorted = [...rows].sort(
    (a, b) => (b.subs7?.pct ?? -Infinity) - (a.subs7?.pct ?? -Infinity)
  );
  const tracked = rows.filter((r) => r.history.length > 0).length;

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link href="/cockpit" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← Cockpit
          </Link>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/50">
            Growth · {tracked}/{rows.length} tracked
          </div>
        </div>
        <h1 className="font-black text-3xl leading-tight">Growth</h1>
        <p className="text-[13px] text-ink/65 mt-2 max-w-[60ch]">
          Time-series across every tracked artist. Daily snapshot, 30-day window.
          History builds as the cron runs.
        </p>

        <div className="mt-8 rounded-xl overflow-hidden border" style={{ borderColor: MUTED, background: PAPER }}>
          <div
            className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45 border-b"
            style={{ borderColor: MUTED, background: '#F6F1E7' }}
          >
            <div>Artist</div>
            <div>Subs · 30d trend</div>
            <div>Subs 7d</div>
            <div>Subs 30d</div>
            <div>Views 7d</div>
          </div>
          {sorted.map((r, i) => (
            <GrowthRow key={r.artist.slug} row={r} last={i === sorted.length - 1} />
          ))}
        </div>

        <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/35">
          Snapshots stored daily via Vercel Cron · backfills from today forward
        </div>
      </div>
    </main>
  );
}

function GrowthRow({ row, last }: { row: any; last: boolean }) {
  const { artist, snap, history, subs7, subs30, views7, subsSeries } = row;
  const subs = snap?.subs != null ? fmtNum(snap.subs) : '—';
  const fmt = (d: { delta: number; pct: number } | null) => {
    if (!d) return '—';
    const sign = d.delta > 0 ? '+' : d.delta < 0 ? '' : '';
    const n =
      Math.abs(d.delta) >= 1_000_000
        ? (d.delta / 1_000_000).toFixed(1) + 'M'
        : Math.abs(d.delta) >= 1_000
        ? (d.delta / 1_000).toFixed(1) + 'K'
        : String(d.delta);
    return `${sign}${n} (${(d.pct * 100).toFixed(1)}%)`;
  };
  const color = (d: { delta: number } | null) =>
    !d ? '#8A8A8A' : d.delta > 0 ? GOOD : d.delta < 0 ? BAD : '#8A8A8A';
  return (
    <Link
      href={`/watcher/${artist.slug}`}
      className={`grid grid-cols-[1.6fr_1.2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center hover:bg-[#F6F1E7] ${
        last ? '' : 'border-b'
      }`}
      style={{ borderColor: MUTED }}
    >
      <div className="min-w-0">
        <div className="font-bold text-[14px] truncate">{artist.name}</div>
        <div className="text-[10px] text-ink/45 mt-0.5 font-mono">
          {subs} subs · {history.length}d history
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Sparkline data={subsSeries} width={140} height={36} />
      </div>
      <div className="text-[12px] font-mono" style={{ color: color(subs7) }}>
        {fmt(subs7)}
      </div>
      <div className="text-[12px] font-mono" style={{ color: color(subs30) }}>
        {fmt(subs30)}
      </div>
      <div className="text-[12px] font-mono" style={{ color: color(views7) }}>
        {fmt(views7)}
      </div>
    </Link>
  );
}
