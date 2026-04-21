import Link from 'next/link';
import { ARTISTS, fmtNum, daysSince, type Artist, type LiveSnap } from '@/lib/artists';
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
// STATUS SYSTEM — one label per artist, no interpretation required
// ─────────────────────────────────────────────────────────────────────────────
type ControlStatus = 'Growing' | 'Flat' | 'At risk';

const STATUS_STYLE: Record<ControlStatus, { bg: string; fg: string; dot: string; rowBg: string }> = {
  'At risk':  { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C', rowBg: '#FFF8F5' },
  'Flat':     { bg: '#F6F1E7', fg: '#6B5E4A', dot: '#B0A68E', rowBg: PAPER },
  'Growing':  { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A', rowBg: '#F8FDF9' },
};

const STATUS_RANK: Record<ControlStatus, number> = {
  'At risk': 0,
  'Flat': 1,
  'Growing': 2,
};

/**
 * Determine status from 7d deltas + upload recency.
 *
 * Growing: positive view OR sub movement in 7d
 * At risk: losing subs, OR no uploads in 30+ days, OR declining views with no uploads in 14d
 * Flat:    everything else
 */
function deriveStatus(
  subs7: { delta: number; pct: number } | null,
  views7: { delta: number; pct: number } | null,
  lastUpDays: number | null,
  uploads30d: number,
): ControlStatus {
  // At risk: channel gone cold or actively losing
  if (lastUpDays != null && lastUpDays > 30) return 'At risk';
  if (uploads30d === 0 && lastUpDays != null) return 'At risk';
  if (subs7 && subs7.delta < 0 && subs7.pct < -0.002) return 'At risk';
  if (lastUpDays != null && lastUpDays > 14 && views7 && views7.delta <= 0) return 'At risk';

  // Growing: any meaningful positive movement
  // Use both % thresholds AND absolute floors so smaller channels aren't penalised
  if (views7 && views7.delta > 0 && (views7.pct > 0.002 || views7.delta >= 10_000)) return 'Growing';
  if (subs7 && subs7.delta > 0 && (subs7.pct > 0.001 || subs7.delta >= 50)) return 'Growing';

  return 'Flat';
}

/** One-line reason for the status — blunt, no jargon */
function statusReason(
  status: ControlStatus,
  subs7: { delta: number; pct: number } | null,
  views7: { delta: number; pct: number } | null,
  lastUpDays: number | null,
  uploads30d: number,
): string {
  if (status === 'At risk') {
    if (lastUpDays != null && lastUpDays > 30) return `No uploads in ${lastUpDays} days`;
    if (uploads30d === 0) return 'No activity in 30 days';
    if (subs7 && subs7.delta < 0) return `Losing subscribers (${subs7.delta.toLocaleString()} in 7d)`;
    if (lastUpDays != null && lastUpDays > 14) return `Not posting. Last upload ${lastUpDays}d ago`;
    return 'Declining';
  }
  if (status === 'Growing') {
    if (views7 && views7.delta > 0) return `${fmtDelta(views7.delta)} views (7d)`;
    if (subs7 && subs7.delta > 0) return `+${subs7.delta.toLocaleString()} subs (7d)`;
    return 'Positive movement';
  }
  // Flat
  if (views7 && views7.delta === 0) return '0 views (7d)';
  if (!views7 && !subs7) return 'No growth data yet';
  return 'No meaningful movement (7d)';
}

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
  status: ControlStatus;
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
      const status = deriveStatus(subs7, views7, lastUpDays, uploads30d);
      const reason = statusReason(status, subs7, views7, lastUpDays, uploads30d);
      return { artist: a, snap, subs7, views7, lastUpDays, uploads30d, status, reason, subsSeries };
    })
  );

  // Sort: At risk → Flat → Growing
  const sorted = [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const notGrowing = rows.filter((r) => r.status !== 'Growing').length;
  const atRisk = rows.filter((r) => r.status === 'At risk').length;

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
const SPARK_COLOR: Record<ControlStatus, { stroke: string; fill: string }> = {
  'Growing':  { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' },
  'Flat':     { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' },
  'At risk':  { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' },
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
          {status}
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
