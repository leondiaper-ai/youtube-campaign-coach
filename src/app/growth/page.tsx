import Link from 'next/link';
import { ARTISTS, fmtNum, daysSince, deriveFromLive, STATUS_COLOR, STATUS_RANK, type Artist, type LiveSnap, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import Sparkline from '@/components/Sparkline';

export const revalidate = 600;

export const metadata = {
  title: 'Channel Health — YouTube Campaign System',
  description: 'Which channels are growing, flat, or at risk.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS SYSTEM — unified 5-state from artists.ts
// ─────────────────────────────────────────────────────────────────────────────
const STATE_LABEL: Record<ChannelState, string> = {
  HEALTHY:           'Healthy',
  'WEAK CONVERSION': 'Weak Conversion',
  BUILDING:          'Building',
  'AT RISK':         'At Risk',
  COLD:              'Cold',
};

const STATUS_STYLE: Record<ChannelState, { bg: string; fg: string; dot: string; rowBg: string }> = {
  HEALTHY:           { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A', rowBg: '#F8FDF9' },
  'WEAK CONVERSION': { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C', rowBg: '#FFFAF5' },
  BUILDING:          { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C', rowBg: PAPER },
  'AT RISK':         { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C', rowBg: '#FFF8F5' },
  COLD:              { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C', rowBg: '#FFF8F5' },
};

function fmtDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type RowData = {
  artist: Artist;
  snap: LiveSnap | null;
  subs7: { delta: number; pct: number } | null;
  views7: { delta: number; pct: number } | null;
  lastUpDays: number | null;
  uploads30d: number;
  status: ChannelState;
  reason: string;
  subsSeries: { x: number; y: number }[];
};

export default async function ControlPage() {
  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom].filter(
    (a, i, arr) => arr.findIndex((b) => b.slug === a.slug) === i
  );

  const rows: RowData[] = await Promise.all(
    allArtists.map(async (a) => {
      const snap = a.channelHandle ? await fetchChannelSnap(a.channelHandle) : null;
      const history =
        snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
      const subs7 = deltaOver(history, 7, 'subs');
      const views7 = deltaOver(history, 7, 'views');
      const lastUpDays = daysSince(snap?.lastUploadAt);
      const uploads30d = snap?.uploads30d ?? 0;
      const subsSeries = seriesForField(history, 'subs', 30);
      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7?.delta ?? null,
        views7Delta: views7?.delta ?? null,
      }) : null;
      const status: ChannelState = derived?.status ?? 'COLD';
      const reason = derived?.reason ?? 'No data yet';
      return { artist: a, snap, subs7, views7, lastUpDays, uploads30d, status, reason, subsSeries };
    })
  );

  // Sort: worst state first (COLD → AT RISK → WEAK CONVERSION → BUILDING → HEALTHY)
  const sorted = [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const notGrowing = rows.filter((r) => r.status !== 'HEALTHY').length;
  const atRisk = rows.filter((r) => r.status === 'AT RISK' || r.status === 'COLD').length;

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[960px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
              YouTube Campaign System
            </div>

            {/* View toggle: Channel Health (active) / All Artists / Active Campaigns */}
            <div className="flex items-center gap-1 mt-2">
              <span
                className="px-3 py-1.5 rounded-md text-[13px] font-black"
                style={{ background: SOFT }}
              >
                Channel Health
              </span>
              <Link
                href="/cockpit"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                All Artists
              </Link>
              <Link
                href="/campaigns"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                Active Campaigns
              </Link>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 mt-2">
            Live · YouTube API
          </span>
        </div>

        <div className="text-[13px] text-ink/50 mb-2">
          Track which channels are growing vs stalling.
        </div>

        {/* ─── SUMMARY STRIP — blunt headline ────────────────────────────── */}
        <div
          className="mt-5 rounded-xl px-5 py-3.5 flex items-center gap-4 flex-wrap"
          style={{ background: notGrowing > 0 ? '#FFE2D8' : '#E6F8EE' }}
        >
          <span className="font-black text-[15px]" style={{ color: notGrowing > 0 ? '#8A1F0C' : '#0C6A3F' }}>
            {notGrowing}/{rows.length} channel{rows.length === 1 ? '' : 's'} not growing
          </span>
          {atRisk > 0 && (
            <>
              <span className="text-ink/20">·</span>
              <span className="font-bold text-[13px]" style={{ color: '#8A1F0C' }}>
                {atRisk} at risk
              </span>
            </>
          )}
        </div>

        {/* ─── TABLE ──────────────────────────────────────────────────────── */}
        <div className="mt-6 rounded-xl overflow-hidden border" style={{ borderColor: MUTED }}>
          {/* Header row */}
          <div
            className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] gap-3 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 border-b"
            style={{ borderColor: MUTED, background: SOFT }}
          >
            <div>Artist</div>
            <div>30d trend</div>
            <div>Status</div>
            <div className="text-right">Subs</div>
            <div className="text-right">Subs (7d)</div>
            <div className="text-right">Views (7d)</div>
          </div>

          {/* Data rows */}
          {sorted.map((r, i) => (
            <ControlRow key={r.artist.slug} row={r} last={i === sorted.length - 1} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-[10px] uppercase tracking-[0.18em] text-ink/25">
          Channel Health watches · Watcher diagnoses · Coach plans
        </div>
      </div>
    </main>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TABLE ROW — clickable → opens Watcher for that artist
// ═══════════════════════════════════════════════════════════════════════════════

/** Sparkline colour matched to status */
const SPARK_COLOR: Record<ChannelState, { stroke: string; fill: string }> = {
  HEALTHY:           { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' },
  'WEAK CONVERSION': { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.06)' },
  BUILDING:          { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' },
  'AT RISK':         { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
  COLD:              { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
};

function ControlRow({ row, last }: { row: RowData; last: boolean }) {
  const { artist, snap, subs7, views7, status, reason, subsSeries } = row;
  const st = STATUS_STYLE[status];
  const sp = SPARK_COLOR[status];
  const subsTotal = snap?.subs != null ? fmtNum(snap.subs) : '—';

  const fmtSubs7 = subs7
    ? `${subs7.delta >= 0 ? '+' : ''}${subs7.delta.toLocaleString()}`
    : '—';
  const fmtViews7 = views7 ? fmtDelta(views7.delta) : '—';

  const subsColor = subs7
    ? subs7.delta > 0 ? '#0C6A3F' : subs7.delta < 0 ? '#8A1F0C' : undefined
    : undefined;
  const viewsColor = views7
    ? views7.delta > 0 ? '#0C6A3F' : views7.delta < 0 ? '#8A1F0C' : undefined
    : undefined;

  return (
    <Link
      href={`/watcher/${artist.slug}`}
      className={`grid grid-cols-[1.6fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] gap-3 px-5 py-4 items-center hover:brightness-[0.97] transition-all ${
        last ? '' : 'border-b'
      }`}
      style={{ borderColor: MUTED, background: st.rowBg }}
    >
      {/* Artist */}
      <div className="min-w-0">
        <div className="font-black text-[14px] truncate">{artist.name}</div>
        <div className="text-[11px] text-ink/40 mt-0.5 leading-snug">{reason}</div>
      </div>

      {/* 30d sparkline */}
      <div className="flex items-center">
        <Sparkline data={subsSeries} width={100} height={32} stroke={sp.stroke} fill={sp.fill} />
      </div>

      {/* Status badge */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.12em] whitespace-nowrap"
          style={{ background: st.bg, color: st.fg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
          {STATE_LABEL[status]}
        </span>
      </div>

      {/* Subs total */}
      <div className="text-right text-[13px] font-bold tabular-nums">
        {subsTotal}
      </div>

      {/* Subs 7d delta */}
      <div className="text-right text-[13px] tabular-nums font-bold" style={subsColor ? { color: subsColor } : { color: 'rgba(14,14,14,0.35)' }}>
        {fmtSubs7}
      </div>

      {/* Views 7d delta */}
      <div className="text-right text-[13px] tabular-nums font-bold" style={viewsColor ? { color: viewsColor } : { color: 'rgba(14,14,14,0.35)' }}>
        {fmtViews7}
      </div>
    </Link>
  );
}
