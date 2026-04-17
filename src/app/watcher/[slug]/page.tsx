import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, type Artist } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { listCustomArtists } from '@/lib/artistStore';
import { detectOpportunities, IMPACT_RANK, type Opportunity } from '@/lib/opportunities';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { decideWatcher } from '@/lib/watcherDecision';
import {
  computeConversion,
  type ConversionResult,
} from '@/lib/conversion';
import CoachLink from '@/components/CoachLink';
import { CoachCampaignBadge, NextMomentFromCoach } from '@/components/WatcherCoachOverlay';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const STATUS_MAP = {
  FIX:        { label: 'Needs attention', bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  CORRECT:    { label: 'At risk',         bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  MAINTAIN:   { label: 'Healthy',         bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  ACCELERATE: { label: 'Growing',         bg: '#DCE8FF', fg: '#1C3B8A', dot: '#2C6BFF' },
} as const;

export default async function WatcherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const custom: Artist[] = await listCustomArtists();
  const artist = ARTISTS.find((a) => a.slug === slug) ?? custom.find((a) => a.slug === slug);
  if (!artist) notFound();

  const live = artist.channelHandle ? await fetchChannelSnap(artist.channelHandle) : null;
  const daysToNextMoment = artist.nextMomentDate
    ? Math.round(
        (new Date(artist.nextMomentDate + 'T00:00:00').getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const derived = live
    ? deriveFromLive(live, { daysToNextMoment, phase: artist.phase })
    : null;
  const lastUpDays = daysSince(live?.lastUploadAt);

  const opps = detectOpportunities(artist, live, daysToNextMoment).sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
  );

  const history = live?.channelId ? await readHistory(live.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const subs30 = deltaOver(history, 30, 'subs');
  const views7 = deltaOver(history, 7, 'views');

  const conv7 = computeConversion(history, 7);
  const conv30 = computeConversion(history, 30);

  const decision = decideWatcher({
    artist,
    live,
    opps,
    daysToNextMoment,
    subs7,
    subs30,
    views7,
    history,
    conv7,
    conv30,
  });
  const isLive = !!(live && !live.error);

  // ── Section buckets ─────────────────────────────────────────────────────
  const channelOpps = opps.filter((o) => !o.videoId);
  const fixNow = channelOpps.filter((o) => o.impact === 'HIGH').slice(0, 2);

  const secondaryOpps = channelOpps
    .filter((o) => o.impact !== 'HIGH')
    .slice(0, 1);

  // Missed audience opportunities — per-video gaps, ONE primary opp per video
  const videoOppsAll = opps.filter((o) => !!o.videoId);
  const videoGroups = new Map<string, Opportunity[]>();
  for (const o of videoOppsAll) {
    const arr = videoGroups.get(o.videoId!) ?? [];
    arr.push(o);
    videoGroups.set(o.videoId!, arr);
  }
  const missedOpps = Array.from(videoGroups.entries())
    .map(([id, items]) => {
      // Priority: lyric → short → visualizer → captions
      const sorted = [...items].sort((a, b) => {
        const rank = (o: Opportunity) => {
          if (o.subtype.includes('lyric')) return 0;
          if (o.subtype.includes('Short')) return 1;
          if (o.subtype.includes('visualizer')) return 2;
          if (o.subtype.includes('caption')) return 3;
          return 4;
        };
        return rank(a) - rank(b);
      });
      return {
        id,
        title: items[0].videoTitle ?? id,
        views: items[0].videoViews ?? 0,
        primaryOpp: sorted[0],
        secondaryCount: items.length - 1,
        items,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const sm = STATUS_MAP[decision.type];

  return (
    <main className="bg-paper min-h-screen" style={{ color: INK }}>
      <div className="max-w-[880px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/cockpit" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← All artists
          </Link>
          {isLive && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35">
              Live · YouTube API
            </span>
          )}
        </div>

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
          <YouTubeMark />
          <span>Watcher</span>
          <CoachCampaignBadge slug={slug} fallback={artist.campaign} />
        </div>
        <h1 className="font-black text-3xl mt-1">{artist.name}</h1>

        {/* Status + decision headline */}
        <div className="mt-5 flex items-start gap-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-[0.14em] shrink-0 mt-0.5"
            style={{ background: sm.bg, color: sm.fg }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: sm.dot }} />
            {sm.label}
          </span>
          <div className="text-[18px] font-black leading-snug">
            {decision.headline}
          </div>
        </div>

        {/* ─── 1. SIGNAL STRIP — trust layer (max 2 lines) ──────────── */}
        <div
          className="mt-5 rounded-xl px-5 py-3.5"
          style={{ background: SOFT }}
        >
          <div className="flex items-baseline gap-2 flex-wrap text-[15px] font-black tabular-nums leading-tight">
            {live?.subs != null && <span>{fmtNum(live.subs)} subs</span>}
            {live?.views != null && (
              <><span className="text-ink/20 text-[13px]">·</span><span>{fmtNum(live.views)} views</span></>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-1 text-[12px] text-ink/50 tabular-nums">
            {views7 ? (
              <span style={views7.delta !== 0 ? { color: views7.delta > 0 ? '#0C6A3F' : '#8A1F0C' } : undefined}>
                {views7.delta !== 0 ? fmtDelta(views7.delta) + ' views' : 'Views flat'} (7d)
              </span>
            ) : null}
            <span className="text-ink/15">·</span>
            {subs7 ? (
              <span style={subs7.delta !== 0 ? { color: subs7.delta > 0 ? '#0C6A3F' : '#8A1F0C' } : undefined}>
                {subs7.delta !== 0 ? (subs7.delta > 0 ? '+' : '') + subs7.delta.toLocaleString() + ' subs' : 'Subs flat'} (7d)
              </span>
            ) : null}
            <span className="text-ink/15">·</span>
            {live?.uploads30d != null && <span>{live.uploads30d} uploads (30d)</span>}
            <span className="text-ink/15">·</span>
            {lastUpDays != null && (
              <span>Last upload: {lastUpDays === 0 ? 'today' : lastUpDays === 1 ? 'yesterday' : `${lastUpDays}d ago`}</span>
            )}
          </div>
        </div>

        {/* ─── 2. PERFORMANCE SNAPSHOT — numbers only ─────────────────── */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <MetricTile
            label="Views (7d)"
            value={views7 ? fmtDelta(views7.delta) : '—'}
            sub={views7 ? `${views7.delta >= 0 ? '+' : ''}${(views7.pct * 100).toFixed(1)}%` : null}
            color={views7 ? (views7.delta > 0 ? '#0C6A3F' : views7.delta < 0 ? '#8A1F0C' : undefined) : undefined}
          />
          <MetricTile
            label="Subs (7d)"
            value={subs7 ? (subs7.delta >= 0 ? '+' : '') + subs7.delta.toLocaleString() : '—'}
            sub={subs7 ? `${subs7.delta >= 0 ? '+' : ''}${(subs7.pct * 100).toFixed(1)}%` : null}
            color={subs7 ? (subs7.delta > 0 ? '#0C6A3F' : subs7.delta < 0 ? '#8A1F0C' : undefined) : undefined}
          />
          <MetricTile
            label="Uploads (30d)"
            value={live?.uploads30d != null ? String(live.uploads30d) : '—'}
            sub={live?.shorts30d != null ? `${live.shorts30d} Shorts` : null}
          />
          <MetricTile
            label="Last upload"
            value={lastUpDays != null ? (lastUpDays === 0 ? 'Today' : `${lastUpDays}d ago`) : '—'}
            sub={null}
            color={lastUpDays != null ? (lastUpDays <= 3 ? '#0C6A3F' : lastUpDays >= 14 ? '#8A1F0C' : undefined) : undefined}
          />
        </div>

        {/* If Ignored — blunt warning */}
        {(decision.type === 'FIX' || decision.type === 'CORRECT') && (
          <div className="mt-4 text-[12px] text-ink/50 leading-snug max-w-[70ch]">
            <span className="font-bold text-ink/60">If nothing changes:</span> {decision.ifIgnored}
          </div>
        )}


        {/* ─── FIX NOW ────────────────────────────────────────────────────── */}
        {fixNow.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF4A1C' }} />
              <h2 className="font-black text-lg">Fix now</h2>
            </div>
            <div className="space-y-3">
              {fixNow.map((o) => (
                <FixCard key={o.id} o={o} />
              ))}
            </div>
          </section>
        )}


        {/* ─── 3. WHAT TO DO NEXT — direct, confident, 1-2 lines ──────── */}
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F08A3C' }} />
            <h2 className="font-black text-lg">What to do next</h2>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            <div className="text-[15px] font-bold leading-snug">
              {directAction(decision, fixNow, secondaryOpps, videoOppsAll)}
            </div>
            <div className="text-[12px] text-ink/50 mt-2 leading-snug max-w-[60ch]">
              {directOutcome(decision)}
            </div>
          </div>
        </section>


        {/* ─── 4. MISSED AUDIENCE OPPORTUNITIES — redesigned ──────────── */}
        {missedOpps.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2C6BFF' }} />
              <h2 className="font-black text-lg">Missed reach</h2>
            </div>
            <div className="space-y-3">
              {missedOpps.map((v) => (
                <MissedOppCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}


        {/* Nothing flagged */}
        {fixNow.length === 0 && missedOpps.length === 0 && decision.type === 'MAINTAIN' && (
          <div
            className="mt-10 rounded-xl border p-5 text-[13px] text-ink/50"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            Nothing flagged. Channel is in good shape.
          </div>
        )}


        {/* ─── NEXT MOMENT ────────────────────────────────────────────────── */}
        <NextMomentFromCoach
          slug={slug}
          fallbackLabel={artist.nextMomentLabel}
          fallbackDate={artist.nextMomentDate}
        />


        {/* ─── COACH CTA ──────────────────────────────────────────────────── */}
        <div className="mt-12 flex items-center justify-between gap-4">
          <div className="text-[12px] text-ink/50 max-w-[50ch]">
            Ready to plan? Open Coach to build the campaign timeline.
          </div>
          <CoachLink slug={slug} />
        </div>

        <div className="mt-10 text-[10px] uppercase tracking-[0.18em] text-ink/25">
          Watcher watches · Coach plans · You decide
        </div>
      </div>
    </main>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtDelta(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sign}${(n / 1_000).toFixed(1)}K`;
  return `${sign}${n}`;
}

function MetricTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string | null;
  color?: string;
}) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: PAPER, border: `1px solid ${MUTED}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink/40 font-bold">{label}</div>
      <div className="font-black text-lg tabular-nums mt-0.5" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] tabular-nums mt-0.5" style={color ? { color } : { color: 'rgba(14,14,14,0.4)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function YouTubeMark() {
  return (
    <svg width="16" height="12" viewBox="0 0 24 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M23.5 2.7A3 3 0 0 0 21.4.6C19.6 0 12 0 12 0s-7.6 0-9.4.6A3 3 0 0 0 .5 2.7C0 4.5 0 8.5 0 8.5s0 4 .5 5.8a3 3 0 0 0 2.1 2.1c1.8.6 9.4.6 9.4.6s7.6 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8Z"
        fill="#FF0000"
      />
      <path d="M9.6 12.3 15.8 8.5 9.6 4.7v7.6Z" fill="#FAF7F2" />
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. DIRECT "WHAT TO DO NEXT" — confident, blunt, one clear directive
// ═══════════════════════════════════════════════════════════════════════════════

function directAction(
  decision: { type: string; headline: string; signals: string[] },
  fixNow: Opportunity[],
  secondaryOpps: Opportunity[],
  videoOpps: Opportunity[],
): string {
  if (decision.type === 'MAINTAIN')
    return 'Keep current cadence. Channel is active and holding momentum.';
  if (decision.type === 'ACCELERATE') {
    // Push the specific action into "what to do next" — headline stays clean
    const topVid = videoOpps.find((o) => o.impact === 'HIGH');
    if (topVid) return topVid.action;
    return 'Keep current cadence and scale what\'s working.';
  }
  if (fixNow.length > 0)
    return fixNow[0].action;
  if (secondaryOpps.length > 0)
    return secondaryOpps[0].action;
  return 'No action needed right now. Channel is on track.';
}

function directOutcome(decision: { type: string; expectedImpact: string }): string {
  if (decision.type === 'MAINTAIN')
    return 'Holding a working plan protects growth heading into the next drop.';
  return decision.expectedImpact;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FIX NOW CARD
// ═══════════════════════════════════════════════════════════════════════════════

function FixCard({ o }: { o: Opportunity }) {
  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: '#FF4A1C', background: PAPER }}
    >
      <div className="text-[14px] font-black leading-snug">{humanizeSubtype(o)}</div>
      <div className="text-[12px] text-ink/50 mt-1 leading-snug max-w-[60ch]">{o.signal}</div>
      <div className="mt-3 text-[13px] font-black text-ink/90 leading-snug">
        → {o.action}
      </div>
    </article>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. MISSED OPP CARD — redesigned: bold type headline, scale, one action
// ═══════════════════════════════════════════════════════════════════════════════

function MissedOppCard({
  video,
}: {
  video: {
    id: string;
    title: string;
    views: number;
    primaryOpp: Opportunity;
    secondaryCount: number;
    items: Opportunity[];
  };
}) {
  const primary = video.primaryOpp;
  const isHighImpact = video.views >= 5_000_000;

  return (
    <article
      className="rounded-xl border p-5"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      {/* Opportunity type — BOLD UPPERCASE headline */}
      <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: '#2C6BFF' }}>
        {oppTypeLabel(primary)}
      </div>

      {/* Scale: view count + HIGH IMPACT if >5M */}
      <div className="flex items-baseline gap-2.5 mt-2">
        <span className="font-black text-xl tabular-nums">{fmtNum(video.views)} views</span>
        {isHighImpact && (
          <span className="text-[10px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: '#FFE2D8', color: '#8A1F0C' }}>
            High impact
          </span>
        )}
      </div>

      {/* Insight — why this matters, direct language */}
      <div className="text-[13px] text-ink/65 mt-1.5 leading-snug max-w-[55ch]">
        {oppInsight(primary)}
      </div>

      {/* Video title — subtle, secondary */}
      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-ink/35 hover:text-ink/60 underline decoration-ink/10 underline-offset-2 mt-1 inline-block truncate max-w-[52ch]"
        title={video.title}
      >
        {video.title}
      </a>

      {/* ONE action — bold, directive */}
      <div className="mt-3 text-[13px] font-black text-ink/90 leading-snug">
        → {oppAction(primary)}
      </div>

      {/* Secondary gaps — subtle, not competing for attention */}
      {video.secondaryCount > 0 && (
        <div className="mt-2 text-[10px] text-ink/30 uppercase tracking-[0.12em]">
          +{video.secondaryCount} other format{video.secondaryCount === 1 ? '' : 's'} missing
        </div>
      )}
    </article>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. LANGUAGE SYSTEM — direct, commercial, slightly blunt
// ═══════════════════════════════════════════════════════════════════════════════

function humanizeSubtype(o: Opportunity): string {
  const map: Record<string, string> = {
    'Channel has gone cold': 'Channel has gone quiet — not posting',
    'Quiet before next moment': 'Quiet ahead of a release — missing warm-up',
    'No Shorts in the last 30 days': 'No Shorts — missing reach on the fastest-growing format',
    'No published caption track on recent uploads': 'Missing captions — limiting international reach',
    'Top recent upload has no Short companion': 'Top video not reaching new audiences',
  };
  return map[o.subtype] ?? o.subtype;
}

/** UPPERCASE opportunity type for missed-opp card headline */
function oppTypeLabel(o: Opportunity): string {
  if (o.subtype.includes('lyric')) return 'Lyric video missing';
  if (o.subtype.includes('Short')) return 'Short missing';
  if (o.subtype.includes('visualizer')) return 'Visualizer missing';
  if (o.subtype.includes('caption')) return 'Captions missing';
  if (o.subtype.includes('demand')) return 'Fan demand unmet';
  return 'Format gap';
}

/** Insight line — why the gap matters, direct language */
function oppInsight(o: Opportunity): string {
  if (o.subtype.includes('lyric'))
    return 'This video is not reaching sing-along audiences. No supporting format extending its lifecycle.';
  if (o.subtype.includes('Short'))
    return 'Not reaching mobile-first viewers. No Short driving new audiences back to this track.';
  if (o.subtype.includes('visualizer'))
    return 'No passive-listen version. Missing background-play and playlist audiences.';
  if (o.subtype.includes('caption'))
    return 'Missing captions. Not indexed for YouTube search. Not reaching international audiences.';
  if (o.subtype.includes('demand'))
    return 'Multiple top comments requesting this. Verified audience demand going unanswered.';
  return 'Missing reach from a high-performing video.';
}

/** ONE clear action — directive, this week */
function oppAction(o: Opportunity): string {
  if (o.subtype.includes('lyric'))
    return 'Create a lyric video or typographic version this week.';
  if (o.subtype.includes('Short'))
    return 'Cut a 30–60s vertical Short from the best moment this week.';
  if (o.subtype.includes('visualizer'))
    return 'Render a visualizer loop and upload as a companion this week.';
  if (o.subtype.includes('caption'))
    return 'Review auto-generated captions in YT Studio and publish.';
  if (o.subtype.includes('demand'))
    return o.action;
  return o.action;
}
