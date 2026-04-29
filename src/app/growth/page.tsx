import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, fmtNum, daysSince, deriveFromLive,
  STATUS_COLOR, STATUS_RANK, classifyArtist, isManaged,
  CLASSIFICATION_LABEL, CLASSIFICATION_STYLE,
  type Artist, type LiveSnap, type ChannelState, type ArtistClassification,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import { computeSystemValue, fmtVal } from '@/lib/valueModel';
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

function fmtPct(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type RowData = {
  artist: Artist;
  snap: LiveSnap | null;
  subs7: { delta: number; pct: number } | null;
  views7: { delta: number; pct: number } | null;
  // Previous 7d (days 7–14) for week-on-week comparison
  subs14: { delta: number; pct: number } | null;
  views14: { delta: number; pct: number } | null;
  // Week-on-week % change
  subsWoW: number | null; // % change from prev week to this week
  viewsWoW: number | null;
  lastUpDays: number | null;
  uploads30d: number;
  status: ChannelState;
  classification: ArtistClassification;
  reason: string;
  subsSeries: { x: number; y: number }[];
};

export default async function ControlPage() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);

  const rows: RowData[] = await Promise.all(
    allArtists.map(async (a) => {
      const snap = a.channelHandle ? await fetchChannelSnap(a.channelHandle) : null;
      const history =
        snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
      const subs7 = deltaOver(history, 7, 'subs');
      const views7 = deltaOver(history, 7, 'views');
      const subs14 = deltaOver(history, 14, 'subs');
      const views14 = deltaOver(history, 14, 'views');

      // Week-on-week: compare this 7d vs previous 7d
      // prev7d = 14d_total - 7d_current
      const prevSubsDelta = subs14 && subs7 ? subs14.delta - subs7.delta : null;
      const prevViewsDelta = views14 && views7 ? views14.delta - views7.delta : null;
      const subsWoW = prevSubsDelta != null && prevSubsDelta !== 0 && subs7
        ? ((subs7.delta - prevSubsDelta) / Math.abs(prevSubsDelta)) * 100 : null;
      const viewsWoW = prevViewsDelta != null && prevViewsDelta !== 0 && views7
        ? ((views7.delta - prevViewsDelta) / Math.abs(prevViewsDelta)) * 100 : null;

      const lastUpDays = daysSince(snap?.lastUploadAt);
      const uploads30d = snap?.uploads30d ?? 0;
      const subsSeries = seriesForField(history, 'subs', 30);
      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7?.delta ?? null,
        views7Delta: views7?.delta ?? null,
      }) : null;
      const status: ChannelState = derived?.status ?? 'COLD';
      const classification = classifyArtist(status, uploads30d);
      const reason = derived?.reason ?? 'No data yet';
      return { artist: a, snap, subs7, views7, subs14, views14, subsWoW, viewsWoW, lastUpDays, uploads30d, status, classification, reason, subsSeries };
    })
  );

  // Sort: worst state first (COLD → AT RISK → WEAK CONVERSION → BUILDING → HEALTHY)
  const sorted = [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  // Classification counts
  const growingCount = rows.filter((r) => r.classification === 'GROWING').length;
  const weakConvCount = rows.filter((r) => r.classification === 'WEAK_CONVERSION').length;
  const underfedCount = rows.filter((r) => r.classification === 'UNDERFED').length;
  const coldCount = rows.filter((r) => r.classification === 'COLD').length;

  const notGrowing = rows.filter((r) => r.status !== 'HEALTHY').length;
  const atRisk = rows.filter((r) => r.status === 'AT RISK' || r.status === 'COLD').length;

  // System-level value aggregation (managed artists only)
  const managedRows = rows.filter((r) => isManaged(r.artist));
  const systemValue = computeSystemValue(
    managedRows.map((r) => ({
      views7d: r.views7?.delta ?? 0,
      subs7d: r.subs7?.delta ?? 0,
      uploads30d: r.uploads30d,
      channelState: r.status,
      classification: r.classification,
    }))
  );

  // System pattern insights
  const insights: string[] = [];
  if (weakConvCount > 0)
    insights.push(`${weakConvCount} channel${weakConvCount > 1 ? 's' : ''} showing weak conversion`);
  if (underfedCount > 0)
    insights.push(`${underfedCount} channel${underfedCount > 1 ? 's' : ''} underfed (low cadence)`);
  if (coldCount > 0)
    insights.push(`${coldCount} channel${coldCount > 1 ? 's' : ''} inactive (60+ days)`);
  // Check if majority of growth from top N
  const growingRows = rows.filter((r) => r.classification === 'GROWING');
  if (growingRows.length > 0 && growingRows.length <= 3 && rows.length > 4) {
    insights.push(`Majority of growth coming from ${growingRows.length} artist${growingRows.length > 1 ? 's' : ''}`);
  }
  // Detect common cadence issue
  const lowCadence = rows.filter((r) => r.uploads30d <= 2 && r.classification !== 'COLD');
  if (lowCadence.length >= 3) {
    insights.push(`${lowCadence.length} channels uploading ≤2 times per month`);
  }
  // Declining momentum
  const declining = rows.filter((r) => r.viewsWoW != null && r.viewsWoW < -30);
  if (declining.length >= 2) {
    insights.push(`${declining.length} channels lost 30%+ views week-on-week`);
  }

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
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

        {/* ─── SUMMARY BAR — system health at a glance ───────────────────── */}
        <div className="grid grid-cols-4 gap-3 mt-5 mb-4">
          <div className="rounded-xl px-4 py-3" style={{ background: CLASSIFICATION_STYLE.GROWING.bg }}>
            <div className="text-[24px] font-black" style={{ color: CLASSIFICATION_STYLE.GROWING.fg }}>{growingCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CLASSIFICATION_STYLE.GROWING.fg }}>Growing</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.bg : SOFT }}>
            <div className="text-[24px] font-black" style={{ color: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.fg : 'rgba(14,14,14,0.25)' }}>{weakConvCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: weakConvCount > 0 ? CLASSIFICATION_STYLE.WEAK_CONVERSION.fg : 'rgba(14,14,14,0.25)' }}>Weak Conversion</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.bg : SOFT }}>
            <div className="text-[24px] font-black" style={{ color: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.fg : 'rgba(14,14,14,0.25)' }}>{underfedCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: underfedCount > 0 ? CLASSIFICATION_STYLE.UNDERFED.fg : 'rgba(14,14,14,0.25)' }}>Underfed</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.bg : SOFT }}>
            <div className="text-[24px] font-black" style={{ color: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.fg : 'rgba(14,14,14,0.25)' }}>{coldCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: coldCount > 0 ? CLASSIFICATION_STYLE.COLD.fg : 'rgba(14,14,14,0.25)' }}>Cold</div>
          </div>
        </div>

        {/* ─── SYSTEM PATTERN SUMMARY — auto-generated insights ──────────── */}
        {insights.length > 0 && (
          <div className="rounded-xl px-5 py-3.5 mb-6" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2">System Patterns</div>
            <div className="space-y-1">
              {insights.map((insight, i) => (
                <div key={i} className="text-[12px] text-ink/55 leading-snug">
                  <span className="text-ink/20 mr-2">·</span>{insight}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── VALUE OPPORTUNITY — system-level missed value ────────────── */}
        {systemValue.totalMissedValueHigh > 0 && (
          <div className="rounded-xl px-5 py-3.5 mb-6" style={{ background: '#FFFFFF', border: `1px solid ${MUTED}` }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/35 mb-2">Value Opportunity · Virgin Managed</div>
            <div className="space-y-1.5">
              {systemValue.byClassification
                .filter((b) => b.classification !== 'GROWING' && b.missedValueHigh > 0)
                .map((b) => {
                  const style = CLASSIFICATION_STYLE[b.classification];
                  const label =
                    b.classification === 'WEAK_CONVERSION' ? 'missed long-term value'
                    : b.classification === 'UNDERFED' ? 'weekly opportunity'
                    : 'untapped opportunity';
                  return (
                    <div key={b.classification} className="flex items-center gap-2 text-[12px] leading-snug">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: style.dot }}
                      />
                      <span className="text-ink/50">
                        {CLASSIFICATION_LABEL[b.classification]} ({b.artistCount}):
                      </span>
                      <span className="font-bold text-ink/70">
                        {'£'}{fmtVal(b.missedValueLow)}{'–'}{'£'}{fmtVal(b.missedValueHigh)} {label}
                      </span>
                    </div>
                  );
                })}
              {systemValue.totalMissedValueHigh > 0 && (
                <div className="text-[11px] text-ink/35 mt-1 pt-1.5" style={{ borderTop: `1px solid ${MUTED}` }}>
                  Total opportunity: {'£'}{fmtVal(systemValue.totalMissedValueLow)}{'–'}{'£'}{fmtVal(systemValue.totalMissedValueHigh)}/week across {managedRows.length} managed channels
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TABLE ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: MUTED }}>
          {/* Header row */}
          <div
            className="grid grid-cols-[1.4fr_0.6fr_0.65fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40 border-b"
            style={{ borderColor: MUTED, background: SOFT }}
          >
            <div>Artist</div>
            <div>30d trend</div>
            <div>Status</div>
            <div className="text-right">Subs</div>
            <div className="text-right">Subs (7d)</div>
            <div className="text-right">WoW</div>
            <div className="text-right">Views (7d)</div>
            <div className="text-right">WoW</div>
          </div>

          {/* Data rows */}
          {sorted.map((r, i) => (
            <ControlRow key={r.artist.slug} row={r} last={i === sorted.length - 1} />
          ))}
        </div>

        {/* ─── NAVIGATION FLOW ───────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px]">
          <span className="font-black text-ink/60 px-3 py-1.5 rounded-md" style={{ background: SOFT }}>
            Channel Health
          </span>
          <span className="text-ink/25">→</span>
          <Link href="/campaigns" className="font-bold text-ink/40 hover:text-ink/70 px-3 py-1.5 rounded-md hover:bg-[#F6F1E7] transition-colors">
            Active Campaigns
          </Link>
          <span className="text-ink/25">→</span>
          <span className="font-bold text-ink/30 px-3 py-1.5">
            Coach (per artist)
          </span>
        </div>

        {/* Footer */}
        <div className="mt-8 text-[10px] uppercase tracking-[0.18em] text-ink/25">
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

function wowColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.2)';
  if (v > 10) return '#0C6A3F';
  if (v < -10) return '#8A1F0C';
  return 'rgba(14,14,14,0.35)';
}

function ControlRow({ row, last }: { row: RowData; last: boolean }) {
  const { artist, snap, subs7, views7, subsWoW, viewsWoW, status, reason, subsSeries } = row;
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
      className={`grid grid-cols-[1.4fr_0.6fr_0.65fr_0.7fr_0.7fr_0.5fr_0.7fr_0.5fr] gap-2 px-5 py-4 items-center hover:brightness-[0.97] transition-all ${
        last ? '' : 'border-b'
      }`}
      style={{ borderColor: MUTED, background: st.rowBg }}
    >
      {/* Artist */}
      <div className="min-w-0">
        <div className="font-black text-[14px] truncate">{artist.name}</div>
        <div className="text-[11px] text-ink/40 mt-0.5 leading-snug truncate">{reason}</div>
      </div>

      {/* 30d sparkline */}
      <div className="flex items-center">
        <Sparkline data={subsSeries} width={80} height={28} stroke={sp.stroke} fill={sp.fill} />
      </div>

      {/* Status badge */}
      <div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap"
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

      {/* Subs WoW % */}
      <div className="text-right text-[11px] tabular-nums font-bold" style={{ color: wowColor(subsWoW) }}>
        {subsWoW != null ? fmtPct(subsWoW) : '—'}
      </div>

      {/* Views 7d delta */}
      <div className="text-right text-[13px] tabular-nums font-bold" style={viewsColor ? { color: viewsColor } : { color: 'rgba(14,14,14,0.35)' }}>
        {fmtViews7}
      </div>

      {/* Views WoW % */}
      <div className="text-right text-[11px] tabular-nums font-bold" style={{ color: wowColor(viewsWoW) }}>
        {viewsWoW != null ? fmtPct(viewsWoW) : '—'}
      </div>
    </Link>
  );
}
