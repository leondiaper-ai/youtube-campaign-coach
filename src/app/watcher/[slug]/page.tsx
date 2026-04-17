import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, type Artist } from '@/lib/artists';
import { fetchChannelSnap } from '@/lib/youtube';
import { listCustomArtists } from '@/lib/artistStore';
import { detectOpportunities, IMPACT_RANK, type Opportunity } from '@/lib/opportunities';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { decideWatcher, DECISION_COLOR } from '@/lib/watcherDecision';
import {
  computeConversion,
  rateTrend,
  formatRate,
  type ConversionResult,
} from '@/lib/conversion';
import CoachLink from '@/components/CoachLink';
import { CoachCampaignBadge, NextMomentFromCoach } from '@/components/WatcherCoachOverlay';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified status mapping: FIX/CORRECT → Needs Attention, MAINTAIN → Healthy,
// ACCELERATE → Opportunity. Verdict provides the one-word summary.
// ─────────────────────────────────────────────────────────────────────────────
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
  // Fix Now = channel-level HIGH impact (max 2)
  const channelOpps = opps.filter((o) => !o.videoId);
  const fixNow = channelOpps.filter((o) => o.impact === 'HIGH').slice(0, 2);

  // What To Do Next = the decision's primary action + strongest secondary opp
  const secondaryOpps = channelOpps
    .filter((o) => o.impact !== 'HIGH')
    .slice(0, 1);

  // Missed audience opportunities = per-video gaps, framed as missed upside (max 3)
  const videoOppsAll = opps.filter((o) => !!o.videoId);
  const videoGroups = new Map<string, Opportunity[]>();
  for (const o of videoOppsAll) {
    const arr = videoGroups.get(o.videoId!) ?? [];
    arr.push(o);
    videoGroups.set(o.videoId!, arr);
  }
  const missedOpps = Array.from(videoGroups.entries())
    .map(([id, items]) => ({
      id,
      title: items[0].videoTitle ?? id,
      views: items[0].videoViews ?? 0,
      topItem: items.sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact])[0],
      items,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const dc = DECISION_COLOR[decision.type];
  const sm = STATUS_MAP[decision.type];

  // ── Growth context line ─────────────────────────────────────────────────
  const growthLine = buildGrowthLine(subs7, views7, lastUpDays, conv7, conv30);

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

        {/* Status + decision sentence */}
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

        {/* Growth context — one line */}
        {growthLine && (
          <div className="mt-3 text-[13px] text-ink/65 font-medium">
            {growthLine}
          </div>
        )}

        {/* Quick stats strip */}
        <div className="mt-4 flex items-center gap-4 text-[12px] text-ink/50 font-mono flex-wrap">
          {live?.subs != null && <span>{fmtNum(live.subs)} subs</span>}
          {live?.views != null && <span>· {fmtNum(live.views)} views</span>}
          {live?.uploads30d != null && <span>· {live.uploads30d} uploads/30d</span>}
          {lastUpDays != null && <span>· Last upload {lastUpDays === 0 ? 'today' : `${lastUpDays}d ago`}</span>}
        </div>

        {/* If Ignored — subtle warning */}
        {(decision.type === 'FIX' || decision.type === 'CORRECT') && (
          <div className="mt-4 text-[12px] text-ink/50 leading-snug max-w-[70ch]">
            <span className="font-bold text-ink/60">If nothing changes:</span> {decision.ifIgnored}
          </div>
        )}


        {/* ─── 1. FIX NOW ─────────────────────────────────────────────────── */}
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


        {/* ─── 2. WHAT TO DO NEXT ─────────────────────────────────────────── */}
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
              {decision.type === 'MAINTAIN'
                ? 'Keep doing what you\'re doing. The plan is working.'
                : decision.type === 'ACCELERATE'
                ? decision.headline
                : fixNow.length > 0
                ? fixNow[0].action
                : secondaryOpps.length > 0
                ? secondaryOpps[0].action
                : 'No specific action needed right now.'}
            </div>
            <div className="text-[12px] text-ink/55 mt-2 leading-snug max-w-[60ch]">
              {decision.expectedImpact}
            </div>
            {secondaryOpps.length > 0 && fixNow.length > 0 && (
              <div className="mt-4 pt-3 border-t text-[13px] text-ink/65" style={{ borderColor: MUTED }}>
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink/40 mr-2">Also consider</span>
                {secondaryOpps[0].action}
              </div>
            )}
          </div>
        </section>


        {/* ─── 3. MISSED AUDIENCE OPPORTUNITIES ───────────────────────────── */}
        {missedOpps.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2C6BFF' }} />
              <h2 className="font-black text-lg">Missed audience opportunities</h2>
            </div>
            <div className="space-y-3">
              {missedOpps.map((v) => (
                <MissedOppCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}


        {/* Nothing flagged at all */}
        {fixNow.length === 0 && missedOpps.length === 0 && decision.type === 'MAINTAIN' && (
          <div
            className="mt-10 rounded-xl border p-5 text-[13px] text-ink/55"
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
          <div className="text-[12px] text-ink/55 max-w-[50ch]">
            Ready to plan? Open Coach to turn this into a campaign timeline.
          </div>
          <CoachLink slug={slug} />
        </div>

        <div className="mt-10 text-[10px] uppercase tracking-[0.18em] text-ink/30">
          Watcher watches · Coach plans · You decide
        </div>
      </div>
    </main>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

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


/**
 * Fix Now card — problem, action, why.
 */
function FixCard({ o }: { o: Opportunity }) {
  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: '#FF4A1C', background: PAPER }}
    >
      <div className="text-[14px] font-bold leading-snug">{humanizeSubtype(o)}</div>
      <div className="text-[12px] text-ink/55 mt-1">{o.signal}</div>
      <div className="mt-3 text-[13px] font-bold text-ink/90 leading-snug">
        → {o.action}
      </div>
      <div className="mt-2 text-[11px] text-ink/45 leading-snug max-w-[60ch]">
        {humanizeImpact(o)}
      </div>
    </article>
  );
}


/**
 * Missed audience opportunity — framed as missed upside, not a checklist.
 */
function MissedOppCard({
  video,
}: {
  video: {
    id: string;
    title: string;
    views: number;
    topItem: Opportunity;
    items: Opportunity[];
  };
}) {
  const topOpp = video.topItem;
  return (
    <article
      className="rounded-xl border p-5"
      style={{ borderColor: MUTED, background: PAPER }}
    >
      <div className="text-[14px] font-bold leading-snug">
        {humanizeMissedOpp(topOpp)}
      </div>
      <div className="text-[12px] text-ink/55 mt-1 font-mono">
        {video.views.toLocaleString()} views · {missingFormats(video.items)}
      </div>
      <div className="mt-2 text-[11px] text-ink/45 leading-snug max-w-[60ch]">
        Limiting discovery and continued growth from this track.
      </div>
      <div className="mt-3 text-[13px] font-bold text-ink/90 leading-snug">
        → {topOpp.action}
      </div>
    </article>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// COPY HUMANIZERS — replace product language with manager-speak
// ═══════════════════════════════════════════════════════════════════════════════

function humanizeSubtype(o: Opportunity): string {
  const map: Record<string, string> = {
    'Channel has gone cold': 'This channel has gone quiet',
    'Quiet before next moment': 'Quiet ahead of an upcoming release',
    'No Shorts in the last 30 days': 'No Shorts activity — missing the fastest-growing format',
    'No published caption track on recent uploads': 'Recent uploads are missing captions',
    'Top recent upload has no Short companion': 'Your top video isn\'t reaching new audiences',
  };
  return map[o.subtype] ?? o.subtype;
}

function humanizeImpact(o: Opportunity): string {
  const map: Record<string, string> = {
    'Channel has gone cold': 'YouTube stops recommending channels that don\'t upload. The longer the silence, the smaller the audience when you come back.',
    'Quiet before next moment': 'Channels that post in the weeks before a release see 2–3× the launch-day views. Every quiet day shrinks that ceiling.',
    'No Shorts in the last 30 days': 'Shorts reach viewers who never click long-form. Without them, you\'re only reaching half your potential audience.',
    'No published caption track on recent uploads': 'Captions unlock YouTube search indexing and auto-translation to 100+ languages — roughly 15–25% of watch-time comes from non-native regions.',
  };
  return map[o.subtype] ?? o.impactRange;
}

function humanizeMissedOpp(o: Opportunity): string {
  if (o.subtype.includes('no Short')) return 'This video isn\'t reaching new audiences';
  if (o.subtype.includes('no lyric')) return 'No additional formats to extend this track\'s reach';
  if (o.subtype.includes('no visualizer')) return 'No background-listen version for passive viewers';
  if (o.subtype.includes('no published caption')) return 'Missing captions limiting international reach';
  return 'Missed reach from high-performing video';
}

function missingFormats(items: Opportunity[]): string {
  const parts: string[] = [];
  for (const o of items) {
    if (o.subtype.includes('Short')) parts.push('no Short');
    else if (o.subtype.includes('lyric')) parts.push('no lyric cut');
    else if (o.subtype.includes('visualizer')) parts.push('no visualizer');
    else if (o.subtype.includes('caption')) parts.push('no captions');
  }
  return parts.length > 0 ? parts.join(' · ') : `${items.length} gap${items.length === 1 ? '' : 's'}`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// GROWTH CONTEXT LINE — one readable sentence with the headline numbers
// ═══════════════════════════════════════════════════════════════════════════════

function buildGrowthLine(
  subs7: { delta: number; pct: number } | null,
  views7: { delta: number; pct: number } | null,
  lastUpDays: number | null,
  conv7: ConversionResult,
  conv30: ConversionResult,
): string | null {
  const parts: string[] = [];

  if (views7 && views7.delta !== 0) {
    const sign = views7.delta > 0 ? '+' : '';
    const v = Math.abs(views7.delta) >= 1_000_000
      ? (views7.delta / 1_000_000).toFixed(1) + 'M'
      : Math.abs(views7.delta) >= 1_000
      ? (views7.delta / 1_000).toFixed(1) + 'K'
      : String(views7.delta);
    parts.push(`${sign}${v} views (7d)`);
  } else if (views7) {
    parts.push('Views flat (7d)');
  }

  if (subs7 && subs7.delta !== 0) {
    const sign = subs7.delta > 0 ? '+' : '';
    const pct = (subs7.pct * 100).toFixed(1);
    parts.push(`Subs ${sign}${pct}% (7d)`);
  } else if (subs7) {
    parts.push('Subs flat (7d)');
  }

  // Add conversion if we have it
  const convAnchor = conv7.band !== 'INSUFFICIENT' ? conv7 : conv30.band !== 'INSUFFICIENT' ? conv30 : null;
  if (convAnchor) {
    parts.push(`${formatRate(convAnchor)} subs per 1K new views`);
  }

  if (parts.length === 0) {
    if (lastUpDays != null) {
      return `Last upload ${lastUpDays === 0 ? 'today' : `${lastUpDays}d ago`}. Growth data builds over the next few days.`;
    }
    return null;
  }

  // Prepend trend arrow
  const trending = (views7?.delta ?? 0) > 0 || (subs7?.delta ?? 0) > 0;
  const declining = (views7?.delta ?? 0) < 0 || (subs7?.delta ?? 0) < 0;
  const arrow = trending ? '↑' : declining ? '↓' : '→';

  return `${arrow} ${parts.join(' · ')}`;
}
