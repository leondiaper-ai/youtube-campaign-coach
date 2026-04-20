import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, deriveFromLive, fmtNum, daysSince, type Artist, type RecentUpload } from '@/lib/artists';
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
import MissedReachCard, { type MissedReachVideo, type FormatGap } from '@/components/MissedReachCard';
import MissedReachSection from '@/components/MissedReachSection';
import WatcherReport, { type ReportMissedVideo } from '@/components/WatcherReport';

export const revalidate = 600;

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

// ── Use the SAME 4-state system as the overview page ────────────────────────
// The watcher expands on the state with detail — it never contradicts it.
import { STATUS_COLOR, type ChannelState } from '@/lib/artists';

const STATE_LABEL: Record<ChannelState, string> = {
  HEALTHY:  'Healthy',
  BUILDING: 'Building',
  'AT RISK': 'At Risk',
  COLD:     'Cold',
};

// Fallback: when derived is null, map decision.type → ChannelState
const DECISION_TO_STATE: Record<string, ChannelState> = {
  FIX: 'COLD',
  CORRECT: 'AT RISK',
  MAINTAIN: 'HEALTHY',
  ACCELERATE: 'HEALTHY',
};

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

  // Missed audience opportunities — per-video gaps, full catalogue scan
  const videoOppsAll = opps.filter((o) => !!o.videoId);
  const videoGroups = new Map<string, Opportunity[]>();
  for (const o of videoOppsAll) {
    const arr = videoGroups.get(o.videoId!) ?? [];
    arr.push(o);
    videoGroups.set(o.videoId!, arr);
  }
  const allMissedOpps = Array.from(videoGroups.entries())
    .map(([id, items]) => {
      // Sort by impact level first (HIGH before MEDIUM before LOW),
      // then by format priority as tiebreaker within same impact level.
      const sorted = [...items].sort((a, b) => {
        const impactDiff = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
        if (impactDiff !== 0) return impactDiff;
        const rank = (o: Opportunity) => {
          if (o.subtype.includes('lyric')) return 0;
          if (o.subtype.includes('Short')) return 1;
          if (o.subtype.includes('demand')) return 2;
          if (o.subtype.includes('visualizer')) return 3;
          if (o.subtype.includes('caption')) return 4;
          return 5;
        };
        return rank(a) - rank(b);
      });
      return {
        id,
        title: items[0].videoTitle ?? id,
        views: items[0].videoViews ?? 0,
        primaryOpp: sorted[0],
        secondaryCount: items.length - 1,
        items: sorted,
      };
    })
    .sort((a, b) => b.views - a.views);

  // Tier assignment for missed reach — check ALL items, not just primaryOpp
  type MissedTier = 'HIGH' | 'MEDIUM' | 'LOW';
  function assignTier(v: { views: number; items: Opportunity[] }): MissedTier {
    const hasHighFormat = v.items.some((o) =>
      o.impact === 'HIGH' || o.subtype.includes('lyric') || o.subtype.includes('Short')
    );
    if (v.views >= 1_000_000 && hasHighFormat) return 'HIGH';
    if (v.views >= 500_000 || hasHighFormat) return 'MEDIUM';
    return 'LOW';
  }
  const missedHigh = allMissedOpps.filter((v) => assignTier(v) === 'HIGH');
  const missedMedium = allMissedOpps.filter((v) => assignTier(v) === 'MEDIUM');
  const missedLow = allMissedOpps.filter((v) => assignTier(v) === 'LOW');

  // Pattern detection: if 3+ videos share the same gap, it's structural
  const gapCounts: Record<string, number> = {};
  for (const v of allMissedOpps) {
    for (const o of v.items) {
      const key = formatName(o.subtype);
      gapCounts[key] = (gapCounts[key] ?? 0) + 1;
    }
  }
  const structuralGaps = Object.entries(gapCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Backward compat — missedOpps used by campaignAction
  const missedOpps = allMissedOpps;

  // ── Use derived.status (same 4-state as overview). Fallback via decision.type.
  const channelState: ChannelState = derived?.status ?? DECISION_TO_STATE[decision.type] ?? 'BUILDING';
  const sc = STATUS_COLOR[channelState];

  // ── Mode: LIVE CAMPAIGN vs COLD ─────────────────────────────────────────
  const uploads30d = live?.uploads30d ?? 0;
  const nearMoment = daysToNextMoment != null && daysToNextMoment >= 0 && daysToNextMoment <= 30;
  const isColdMode = channelState === 'COLD' || (channelState === 'AT RISK' && uploads30d === 0 && !nearMoment);
  const isLiveCampaign = !isColdMode;

  return (
    <main className="bg-paper min-h-screen" style={{ color: INK }}>
      <div className="max-w-[880px] mx-auto px-6 py-10">
        {/* Breadcrumb + Active Campaign CTA */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/cockpit" className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink">
            ← All artists
          </Link>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35">
                Live · YouTube API
              </span>
            )}
            <CoachLink slug={slug} size="sm" />
          </div>
        </div>

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
          <YouTubeMark />
          <span>Watcher</span>
          <CoachCampaignBadge slug={slug} fallback={artist.campaign} />
        </div>
        <h1 className="font-black text-3xl mt-1">{artist.name}</h1>

        {/* ─── STATE + HEADLINE + CONSEQUENCE ─────────────────────────── */}
        <div className="mt-5 flex items-start gap-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-[0.14em] shrink-0 mt-0.5"
            style={{ background: sc.bg, color: sc.fg }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: sc.dot }} />
            {STATE_LABEL[channelState]}
          </span>
          <div>
            <div className="text-[18px] font-black leading-snug">
              {decision.headline}
            </div>
            {(decision.type === 'FIX' || decision.type === 'CORRECT') && (
              <div className="mt-2 text-[12px] text-ink/50 leading-snug max-w-[60ch]">
                <span className="font-bold text-ink/60">If nothing changes:</span> {decision.ifIgnored}
              </div>
            )}
          </div>
        </div>

        {/* ─── PERFORMANCE SNAPSHOT — primary data surface ────────────── */}
        <div className="mt-6 grid grid-cols-4 gap-3">
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


        {/* ─── FIX NOW ────────────────────────────────────────────────────── */}
        {(fixNow.length > 0 || isColdMode) && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF4A1C' }} />
              <h2 className="font-black text-lg">Fix now</h2>
            </div>
            <div className="space-y-3">
              {isColdMode && fixNow.length === 0 ? (
                <ColdFixCard lastUpDays={lastUpDays} uploads30d={uploads30d} />
              ) : (
                fixNow.map((o) => (
                  <FixCard
                    key={o.id}
                    o={o}
                    daysToNextMoment={daysToNextMoment}
                    momentLabel={artist.nextMomentLabel ?? null}
                  />
                ))
              )}
            </div>
          </section>
        )}


        {/* ─── NEXT MOVE — campaign-aware ────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: isLiveCampaign ? '#F08A3C' : '#2C6BFF' }} />
            <h2 className="font-black text-lg">
              {isLiveCampaign ? 'Next campaign move' : 'Next step'}
            </h2>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            <div className="text-[15px] font-bold leading-snug">
              {campaignAction(decision, fixNow, secondaryOpps, videoOppsAll, live?.recentUploads ?? [], {
                isColdMode,
                daysToNextMoment,
                momentLabel: artist.nextMomentLabel ?? null,
                uploads30d,
                lastUpDays,
              })}
            </div>
            <div className="text-[12px] text-ink/50 mt-2 leading-snug max-w-[60ch]">
              {campaignOutcome(decision, live?.recentUploads ?? [], isColdMode)}
            </div>
          </div>
        </section>


        {/* ─── 4. MISSED REACH — full catalogue, tiered, expandable ────── */}
        {allMissedOpps.length > 0 && (() => {
          const structuralGapNames = structuralGaps.map((g) => g.name);
          const toCard = (v: typeof allMissedOpps[0]): MissedReachVideo => {
            const tier = assignTier(v);
            return {
              id: v.id,
              title: v.title,
              views: v.views,
              primaryLabel: oppTypeLabel(v.primaryOpp),
              primaryConsequence: oppConsequence(v.primaryOpp),
              primaryAction: oppAction(v.primaryOpp),
              isHighImpact: v.views >= 5_000_000,
              secondaryFormats: v.items.slice(1).map((o): FormatGap => ({
                name: formatName(o.subtype),
                impact: formatImpact(o.subtype),
                action: oppAction(o),
              })),
              impactLevel: tier,
              impactBullets: impactBullets(v.views, v.primaryOpp.subtype, tier, structuralGapNames),
            };
          };

          // 3-tier split: priority (top 3 HIGH), secondary (rest of HIGH + MEDIUM), remaining (LOW)
          const priorityCards = missedHigh.slice(0, 3).map(toCard);
          const secondaryItems = [...missedHigh.slice(3), ...missedMedium];
          const secondaryCardsList = secondaryItems.map(toCard);
          const remainingCardsList = missedLow.map(toCard);

          return (
            <MissedReachSection
              priorityCards={priorityCards}
              secondaryCards={secondaryCardsList}
              remainingCards={remainingCardsList}
              structuralGaps={structuralGaps}
              totalScanned={allMissedOpps.length}
              tierCounts={{
                high: missedHigh.length,
                medium: missedMedium.length,
                low: missedLow.length,
              }}
            />
          );
        })()}


        {/* Nothing flagged */}
        {fixNow.length === 0 && missedOpps.length === 0 && decision.type === 'MAINTAIN' && (
          <div
            className="mt-10 rounded-xl border p-5 text-[13px] text-ink/50"
            style={{ borderColor: MUTED, background: PAPER }}
          >
            Nothing flagged. Channel is in good shape.
          </div>
        )}


        {/* ─── REPORT EXPORT ──────────────────────────────────────────────── */}
        <WatcherReport
          artistName={artist.name}
          channelState={channelState}
          stateReason={derived?.reason ?? decision.headline}
          riskLine={decision.type === 'FIX' || decision.type === 'CORRECT' ? decision.ifIgnored : null}
          nextMove={campaignAction(decision, fixNow, secondaryOpps, videoOppsAll, live?.recentUploads ?? [], {
            isColdMode,
            daysToNextMoment,
            momentLabel: artist.nextMomentLabel ?? null,
            uploads30d,
            lastUpDays,
          })}
          missedReach={allMissedOpps.map((v): ReportMissedVideo => ({
            title: v.title,
            views: v.views,
            formats: v.items.map((o) => ({
              name: formatName(o.subtype),
              impact: formatImpact(o.subtype),
            })),
          }))}
          structuralGaps={structuralGaps}
          stats={{
            subs: live?.subs ?? null,
            views7d: views7?.delta ?? null,
            subs7d: subs7?.delta ?? null,
            uploads30d,
            lastUpDays,
          }}
        />


        {/* ─── NEXT MOMENT ────────────────────────────────────────────────── */}
        <NextMomentFromCoach
          slug={slug}
          fallbackLabel={artist.nextMomentLabel}
          fallbackDate={artist.nextMomentDate}
        />


        {/* ─── COACH CTA (secondary, bottom) ────────────────────────────── */}
        <div className="mt-12 flex items-center justify-center">
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
// 3. CAMPAIGN-AWARE ACTIONS — specific, time-bound, tied to real data
// ═══════════════════════════════════════════════════════════════════════════════

type VideoGap = { title: string; gaps: string[]; views: number };
function scanVideoGaps(uploads: RecentUpload[]): VideoGap[] {
  const now = Date.now();
  const longform = uploads.filter(
    (u) => u.durationSec > 62 && u.live === 'none' &&
      (now - new Date(u.publishedAt).getTime()) / 86400000 <= 30
  );
  const results: VideoGap[] = [];
  for (const u of longform) {
    const gaps: string[] = [];
    // Only flag as gap when confidence is 'none' — 'likely' or 'confirmed' means companion found
    if ((u.lyricCompanion ?? 'none') === 'none') gaps.push('Lyric Video');
    if ((u.visualizerCompanion ?? 'none') === 'none') gaps.push('Visualizer');
    if ((u.shortCompanion ?? 'none') === 'none') gaps.push('Short');
    if (gaps.length > 0) {
      results.push({ title: u.title, gaps, views: u.viewCount });
    }
  }
  return results.sort((a, b) => b.views - a.views);
}

type CampaignCtx = {
  isColdMode: boolean;
  daysToNextMoment: number | null;
  momentLabel: string | null;
  uploads30d: number;
  lastUpDays: number | null;
};

function campaignAction(
  decision: { type: string; headline: string; signals: string[] },
  fixNow: Opportunity[],
  secondaryOpps: Opportunity[],
  videoOpps: Opportunity[],
  uploads: RecentUpload[],
  ctx: CampaignCtx,
): string {
  const upload = readUploadContext(uploads);
  const videoGaps = scanVideoGaps(uploads);

  // ── COLD / NO CAMPAIGN — focus on reactivation ─────────────────────────
  if (ctx.isColdMode) {
    if (ctx.daysToNextMoment != null && ctx.daysToNextMoment >= 0 && ctx.daysToNextMoment <= 30 && ctx.momentLabel)
      return `Once the first upload lands, post a teaser for ${ctx.momentLabel} (${ctx.daysToNextMoment}d away). The algorithm needs 2 weeks of activity before a drop converts.`;
    return 'After the first post, upload twice more this week. Three uploads in 7 days is typically enough to re-activate subscriber reach.';
  }

  // ── LIVE CAMPAIGN — actions tied to specific content + timing ───────────

  // Near-moment urgency
  const nearMoment = ctx.daysToNextMoment != null && ctx.daysToNextMoment >= 0 && ctx.daysToNextMoment <= 14;

  // 1. Active release window — reference specific tracks
  if (upload.isRelease) {
    if (upload.hasShorts)
      return `${upload.audioTitleCount} tracks just dropped. Cut Shorts from the standout tracks this week — the first 48h window is when the algorithm distributes most aggressively.`;
    return `${upload.audioTitleCount} tracks just dropped with no Shorts yet. Cut 2–3 vertical clips from the best tracks today — you're losing the first-48h distribution window.`;
  }

  if (upload.hasDropSignal && ctx.momentLabel)
    return `${ctx.momentLabel} is incoming. Post a teaser Short this week — channels that warm up before a drop see 2–3× the announce-day views.`;
  if (upload.hasDropSignal)
    return 'Drop is incoming. Post a teaser Short this week to prime subscriber notifications before the release lands.';

  // 2. Top performer needs support formats
  if (videoGaps.length > 0) {
    const top = videoGaps[0];
    const gapList = top.gaps.join(' + ');
    if (nearMoment && ctx.momentLabel)
      return `"${truncate(top.title, 30)}" at ${fmtNum(top.views)} views is missing ${gapList}. Fill these before ${ctx.momentLabel} in ${ctx.daysToNextMoment}d — each format compounds the track's reach into the drop.`;
    return `"${truncate(top.title, 30)}" at ${fmtNum(top.views)} views is missing ${gapList}. Ship the ${top.gaps[0]} this week — it's the highest-ROI move on the channel right now.`;
  }

  // 3. Near moment with no specific gap — push cadence
  if (nearMoment && ctx.momentLabel) {
    if (upload.shortsCount === 0)
      return `${ctx.daysToNextMoment}d to ${ctx.momentLabel} and no Shorts in the last 2 weeks. Post 2–3 Shorts from catalogue this week to warm the channel for the drop.`;
    return `${ctx.daysToNextMoment}d to ${ctx.momentLabel}. Maintain this Shorts cadence through the drop — the algorithm is watching consistency.`;
  }

  // 4. Active release window
  if (upload.hasReleaseSignal && upload.topRecent)
    return `"${truncate(upload.topRecent.title, 35)}" is leading the release at ${fmtNum(upload.topRecent.viewCount)} views. Cut a Short from it this week to extend the window.`;

  // 5. Live content
  if (upload.hasLiveContent && upload.topRecent)
    return `"${truncate(upload.topRecent.title, 35)}" (${fmtNum(upload.topRecent.viewCount)} views) from ${upload.liveVenue ?? 'the live set'}. Cut Shorts from the best moments this week.`;

  // 6. Collabs
  if (upload.hasCollabs && upload.topRecent)
    return `The collab "${truncate(upload.topRecent.title, 35)}" is at ${fmtNum(upload.topRecent.viewCount)} views. Push it with a Short or lyric cut this week while the feature drives traffic.`;

  // 7. Cadence-based
  if (upload.recentCount > 0 && upload.shortsCount === 0 && upload.topRecent)
    return `${upload.recentCount} uploads in 14d but zero Shorts. Cut a clip from "${truncate(upload.topRecent.title, 35)}" this week — Shorts reach audiences who never click long-form.`;
  if (upload.topRecent && decision.type === 'ACCELERATE')
    return `"${truncate(upload.topRecent.title, 35)}" is at ${fmtNum(upload.topRecent.viewCount)} views and climbing. Don't add new formats — keep feeding this track with Shorts and let it compound.`;
  if (upload.topRecent)
    return `"${truncate(upload.topRecent.title, 35)}" is the top performer at ${fmtNum(upload.topRecent.viewCount)} views. Extend it with a Short this week.`;

  // 8. Maintain — no generic advice, reference cadence
  if (decision.type === 'MAINTAIN')
    return `${ctx.uploads30d} uploads in 30d is holding. Don't change the cadence — focus on support formats for your top content.`;

  return `${ctx.uploads30d} uploads in 30d. Push one more Short this week to keep the algorithm engaged.`;
}

function campaignOutcome(
  decision: { type: string; expectedImpact: string },
  uploads: RecentUpload[],
  isColdMode: boolean,
): string {
  if (isColdMode)
    return 'Three uploads in a week typically re-activates subscriber reach. Consistency signals tend to improve distribution within 7–14 days.';

  const gaps = scanVideoGaps(uploads);
  if (gaps.length > 0 && gaps[0].views >= 100_000)
    return `"${truncate(gaps[0].title, 30)}" already has audience validation. Each support format compounds that reach — Shorts alone can add 30–50% incremental views.`;
  if (gaps.length > 0)
    return 'Each missing format is a discovery surface this track isn\'t using. Shorts and lyric cuts extend a video\'s active life by weeks.';
  if (decision.type === 'ACCELERATE')
    return 'The channel is compounding. Every extra upload this week rides existing momentum at a fraction of the cost of new content.';
  if (decision.type === 'MAINTAIN')
    return 'Cadence is working. Changing it now risks breaking the feedback loop the algorithm has built around this channel.';
  return decision.expectedImpact;
}

/**
 * Read recent uploads to understand what the channel is doing.
 *
 * Key rule: "Live at X" in a DESCRIPTION means recorded there (release context).
 *           "Live at X" in a TITLE means actual live content.
 *           Release signals always take priority.
 */
function readUploadContext(uploads: RecentUpload[]) {
  const now = Date.now();
  const recent14d = uploads.filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 14
  );

  const titles = recent14d.map((u) => u.title.toLowerCase());
  const descs = recent14d.map((u) => (u.description ?? '').toLowerCase());
  const allText = recent14d.map((u) => `${u.title} ${u.description ?? ''}`.toLowerCase());

  // ── Release detection (titles + descriptions) ──────────────────────
  const audioTitleCount = titles.filter((t) => /\b(official audio|audio)\b/.test(t)).length;
  const hasReleaseSignal = allText.some((t) =>
    /\b(re-?release|anniversary|deluxe|remaster|out now|out today|available now|officially re-?released)\b/.test(t)
  );
  const hasDropSignal = allText.some((t) =>
    /\b(out tomorrow|drops? tomorrow|pre-?save|coming soon)\b/.test(t)
  );
  const isRelease = audioTitleCount >= 3 || (audioTitleCount >= 2 && hasReleaseSignal);

  // ── Live detection (TITLES only — avoids "recorded live at" false positives) ──
  const LIVE_TITLE_RX = /\b(live at|live from|live in|live session|tiny desk)\b/;
  const liveTitleHits = titles.filter((t) => LIVE_TITLE_RX.test(t));
  const hasLiveContent = liveTitleHits.length > 0 && !isRelease; // release trumps live

  let liveVenue: string | null = null;
  if (hasLiveContent) {
    liveVenue = extractVenueFromTitles(liveTitleHits);
  }

  // ── Other signals ─────────────────────────────────────────────────
  const shortsCount = recent14d.filter((u) => u.durationSec <= 62).length;
  const featCount = titles.filter((t) => /\b(feat\.?|ft\.?|featuring)\b/.test(t)).length;

  // Top recent by views
  const topRecent = recent14d.length > 0
    ? recent14d.reduce((best, u) => (u.viewCount > best.viewCount ? u : best), recent14d[0])
    : null;

  return {
    recentCount: recent14d.length,
    isRelease,
    hasReleaseSignal,
    hasDropSignal,
    audioTitleCount,
    hasLiveContent,
    liveVenue,
    hasShorts: shortsCount > 0,
    shortsCount,
    hasCollabs: featCount >= 2,
    hasOfficialAudio: audioTitleCount > 0,
    topRecent: topRecent && topRecent.viewCount >= 100 ? topRecent : null,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FIX NOW CARDS — campaign-aware, specific, time-bound
// ═══════════════════════════════════════════════════════════════════════════════

function FixCard({
  o,
  daysToNextMoment,
  momentLabel,
}: {
  o: Opportunity;
  daysToNextMoment: number | null;
  momentLabel: string | null;
}) {
  // Build timing context line
  const timing = daysToNextMoment != null && daysToNextMoment >= 0 && daysToNextMoment <= 30 && momentLabel
    ? `${daysToNextMoment}d to ${momentLabel}`
    : null;

  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: '#FF4A1C', background: PAPER }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-black leading-snug">{humanizeSubtype(o)}</span>
        {timing && (
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
            style={{ background: '#FFE2D8', color: '#8A1F0C' }}>
            {timing}
          </span>
        )}
      </div>
      <div className="text-[12px] text-ink/50 mt-1 leading-snug max-w-[60ch]">{o.signal}</div>
      <div className="mt-3 text-[13px] font-black text-ink/90 leading-snug">
        → {o.action}
      </div>
    </article>
  );
}

function ColdFixCard({ lastUpDays, uploads30d }: { lastUpDays: number | null; uploads30d: number }) {
  const reason = lastUpDays != null
    ? `No uploads in ${lastUpDays} days. YouTube has stopped pushing the channel.`
    : 'No upload data. The channel is invisible.';
  return (
    <article
      className="rounded-xl border-l-4 border p-5"
      style={{ borderColor: MUTED, borderLeftColor: '#FF4A1C', background: PAPER }}
    >
      <div className="text-[14px] font-black leading-snug">Channel is cold</div>
      <div className="text-[12px] text-ink/50 mt-1 leading-snug max-w-[60ch]">{reason}</div>
      <div className="mt-3 text-[13px] font-black text-ink/90 leading-snug">
        → Post one Short this week. Anything from catalogue — break the silence and restart subscriber notifications.
      </div>
    </article>
  );
}


// MissedOppCard moved to client component: src/components/MissedReachCard.tsx


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
  if (o.subtype.includes('lyric')) return 'No lyric video detected';
  if (o.subtype.includes('Short')) return 'No Short detected';
  if (o.subtype.includes('visualizer')) return 'No visualizer detected';
  if (o.subtype.includes('caption')) return 'Captions missing';
  if (o.subtype.includes('demand')) return 'Fan demand unmet';
  return 'Format gap';
}

/** Short consequence line — what's being lost, no explanation */
function oppConsequence(o: Opportunity): string {
  if (o.subtype.includes('lyric')) return 'no long-tail search capture';
  if (o.subtype.includes('Short')) return 'missing discovery layer';
  if (o.subtype.includes('visualizer')) return 'no passive-listen capture';
  if (o.subtype.includes('caption')) return 'no international / search reach';
  if (o.subtype.includes('demand')) return 'verified demand unmet';
  return 'missing support format';
}

/** Urgent action — what to do this week */
function oppAction(o: Opportunity): string {
  if (o.subtype.includes('lyric')) return 'Ship lyric video this week';
  if (o.subtype.includes('Short')) return 'Cut Short from best moment this week';
  if (o.subtype.includes('visualizer')) return 'Ship visualizer this week';
  if (o.subtype.includes('caption')) return 'Review and publish captions in YT Studio';
  if (o.subtype.includes('demand')) return o.action;
  return o.action;
}

/** Impact level for a specific format gap */
function formatImpact(subtype: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (subtype.includes('lyric')) return 'HIGH';
  if (subtype.includes('Short')) return 'HIGH';
  if (subtype.includes('visualizer')) return 'MEDIUM';
  if (subtype.includes('caption')) return 'MEDIUM';
  if (subtype.includes('demand')) return 'HIGH';
  return 'LOW';
}

/** Generate 2-3 qualitative impact bullets for a missed reach card */
function impactBullets(
  views: number,
  primarySubtype: string,
  tier: 'HIGH' | 'MEDIUM' | 'LOW',
  structuralGapNames: string[],
): string[] {
  const bullets: string[] = [];
  const fName = formatName(primarySubtype);
  const isStructural = structuralGapNames.includes(fName);

  // Bullet 1: what you are losing
  if (primarySubtype.includes('Short')) {
    bullets.push('You are invisible to non-subscribers on mobile. Shorts fix that.');
  } else if (primarySubtype.includes('lyric')) {
    bullets.push('This track has no long-tail search capture. Lyric videos extend lifecycle by 2-4×.');
  } else if (primarySubtype.includes('visualizer')) {
    bullets.push('Passive listeners are going to auto-generated topics instead of your channel.');
  } else if (primarySubtype.includes('caption')) {
    bullets.push('15-25% of watch-time comes from non-native regions. You are locked out of it.');
  } else if (primarySubtype.includes('demand')) {
    bullets.push('Your most engaged viewers are asking for this. Ignoring it costs repeat views.');
  } else {
    bullets.push('No support format = no algorithmic surface beyond the main video.');
  }

  // Bullet 2: scale consequence
  if (views >= 5_000_000) {
    bullets.push(`${fmtViews(views)} views. Even 1% recapture = significant incremental reach.`);
  } else if (views >= 1_000_000) {
    bullets.push(`${fmtViews(views)} views proves demand. A companion captures the long tail.`);
  } else if (views >= 500_000) {
    bullets.push('Track has traction. Companion format extends the window before momentum fades.');
  }

  // Bullet 3: structural callout
  if (isStructural) {
    bullets.push(`Catalogue-wide ${fName} gap. Fixing systematically compounds the return.`);
  }

  return bullets.slice(0, 3);
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

/** Human-readable format name */
function formatName(subtype: string): string {
  if (subtype.includes('lyric')) return 'Lyric Video';
  if (subtype.includes('Short')) return 'Shorts';
  if (subtype.includes('visualizer')) return 'Visualizer';
  if (subtype.includes('caption')) return 'Captions';
  if (subtype.includes('demand')) return 'Fan Demand';
  return 'Support Format';
}


// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL CONTEXT — scans recent uploads for real-time intelligence
// ═══════════════════════════════════════════════════════════════════════════════

type ContentSignal = {
  mode: string;       // e.g. "Live performance content"
  detail: string;     // e.g. "Royal Albert Hall series"
};

type TopPerf = {
  title: string;
  views: number;
  id: string;
  kind: 'short' | 'video';
  daysAgo: number;
};

/**
 * Detect what the channel is doing right now.
 *
 * Priority: Release activity → Catalogue drop → Shorts-led → Collabs → Live performances → Fallback
 *
 * Key insight: "Live at the Royal Albert Hall" in a description doesn't mean
 * the channel is doing live content — it means tracks were RECORDED live.
 * Only flag live mode when the TITLES themselves are live performances.
 */
function detectContentMode(uploads: RecentUpload[]): ContentSignal | null {
  if (uploads.length === 0) return null;

  const now = Date.now();
  const recent14d = uploads.filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 14
  );
  if (recent14d.length === 0) return null;

  const titles = recent14d.map((u) => u.title.toLowerCase());
  const descs = recent14d.map((u) => (u.description ?? '').toLowerCase());
  const allText = recent14d.map((u) => `${u.title} ${u.description ?? ''}`.toLowerCase());
  const joinedTitles = titles.join(' | ');
  const joinedAll = allText.join(' | ');

  // ── 1. RELEASE / RE-RELEASE — highest priority ──────────────────────
  // Multiple "Official Audio" tracks + announcement = release day
  const audioCount = titles.filter((t) => /\b(official audio|audio)\b/.test(t)).length;
  const hasReleaseSignal = /\b(re-?release|anniversary|deluxe|remaster|out now|out today|available now)\b/.test(joinedAll);
  const hasDropSignal = /\b(out tomorrow|drops? tomorrow|pre-?save|coming soon|teaser|trailer)\b/.test(joinedAll);

  if (audioCount >= 3 || (audioCount >= 2 && hasReleaseSignal)) {
    const venue = extractVenueFromTitles(titles);
    const detail = hasReleaseSignal
      ? `${audioCount} tracks dropped${venue ? ` — ${venue}` : ''}`
      : `${audioCount} audio tracks in 14d${venue ? ` — ${venue}` : ''}`;
    return { mode: 'Release day', detail };
  }

  if (hasReleaseSignal || hasDropSignal) {
    return { mode: 'Release window', detail: hasDropSignal ? 'New content incoming' : 'Active release' };
  }

  // ── 2. CATALOGUE REPACKAGING ────────────────────────────────────────
  const catCount = titles.filter((t) => /\b(lyric|lyrics|visuali[sz]er|official audio|audio)\b/.test(t)).length;
  if (catCount >= 2 && audioCount < 3) {
    return { mode: 'Catalogue mode', detail: `${catCount} format variants in 14d` };
  }

  // ── 3. SHORTS-LED ──────────────────────────────────────────────────
  const shortsCount = recent14d.filter((u) => u.durationSec <= 62).length;
  if (shortsCount >= 3 && shortsCount >= recent14d.length * 0.5) {
    return { mode: 'Shorts-led strategy', detail: `${shortsCount} Shorts in 14d` };
  }

  // ── 4. COLLABORATION / FEATURES ─────────────────────────────────────
  const featCount = titles.filter((t) => /\b(feat\.?|ft\.?|featuring)\b/.test(t)).length;
  if (featCount >= 2) {
    return { mode: 'Active collab period', detail: `${featCount} features in 14d` };
  }

  // ── 5. REMIX ACTIVITY ──────────────────────────────────────────────
  const remixCount = titles.filter((t) => /\b(remix|edit|rework)\b/.test(t)).length;
  if (remixCount >= 2) {
    return { mode: 'Remix / repackage cycle', detail: `${remixCount} remixes in 14d` };
  }

  // ── 6. LIVE PERFORMANCE — only from TITLES, not descriptions ────────
  // "Live at X" in a title = actual live content.
  // "Live at X" in a description = where it was recorded — different signal.
  const liveTitleHits = titles.filter((t) =>
    /\b(live at|live from|live in|live session|tiny desk)\b/.test(t)
  );
  if (liveTitleHits.length >= 2) {
    const venue = extractVenueFromTitles(liveTitleHits);
    return { mode: 'Live performance content', detail: venue ?? `${liveTitleHits.length} live videos in 14d` };
  }
  if (liveTitleHits.length === 1) {
    const venue = extractVenueFromTitles(liveTitleHits);
    return { mode: 'Dropping live content', detail: venue ?? 'Live performance uploaded' };
  }

  // ── 7. ACTIVE AND POSTING — fallback ───────────────────────────────
  if (recent14d.length >= 3) {
    return { mode: 'Consistent output', detail: `${recent14d.length} uploads in 14d` };
  }

  return null;
}

/** Extract venue from TITLES only — avoids false positives from "recorded live at" in descriptions */
function extractVenueFromTitles(titles: string[]): string | null {
  for (const t of titles) {
    const m = t.match(/live (?:at|from|in) (?:the )?(.{4,40}?)(?:\s*[\(\)\[\]|–—.,\-]|$)/i);
    if (m) {
      return m[1].replace(/^\s+|\s+$/g, '').replace(/^(.)/, (c) => c.toUpperCase());
    }
    if (/tiny desk/i.test(t)) return 'Tiny Desk';
  }
  return null;
}

/** Find the latest upload — this tells you what's coming next */
function findLatestUpload(uploads: RecentUpload[]): TopPerf | null {
  if (uploads.length === 0) return null;

  // uploads are already sorted newest-first from the API
  const latest = uploads.find((u) => u.live === 'none') ?? uploads[0];
  const now = Date.now();
  const daysAgo = Math.floor((now - new Date(latest.publishedAt).getTime()) / 86400000);
  if (daysAgo > 14) return null; // stale

  return {
    title: latest.title,
    views: latest.viewCount,
    id: latest.id,
    kind: latest.durationSec <= 62 ? 'short' : 'video',
    daysAgo,
  };
}

function ChannelContext({ uploads, artistName }: { uploads: RecentUpload[]; artistName: string }) {
  const mode = detectContentMode(uploads);

  // Last 5 uploads — the real-time feed (exclude upcoming/live streams)
  const now = Date.now();
  const recentFeed = uploads
    .filter((u) => u.live !== 'upcoming')
    .slice(0, 5)
    .map((u) => ({
      id: u.id,
      title: u.title,
      views: u.viewCount,
      kind: (u.durationSec <= 62 ? 'Short' : 'Video') as 'Short' | 'Video',
      daysAgo: Math.floor((now - new Date(u.publishedAt).getTime()) / 86400000),
    }));

  if (!mode && recentFeed.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl px-5 py-3.5 border" style={{ borderColor: MUTED, background: PAPER }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-2.5">
        Right now
      </div>

      {/* Content mode — what the channel is doing */}
      {mode && (
        <div className="text-[13px] leading-snug mb-3">
          <span className="font-black">{mode.mode}.</span>
          <span className="text-ink/55 ml-1.5">{mode.detail}</span>
        </div>
      )}

      {/* Last 3 uploads — mini feed */}
      {recentFeed.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35 mb-1">
            Recent uploads
          </div>
          {recentFeed.map((u) => (
            <div key={u.id} className="flex items-baseline gap-2 text-[12px] leading-snug">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: u.kind === 'Short' ? '#DCE8FF' : SOFT,
                  color: u.kind === 'Short' ? '#1C3B8A' : '#6B5E4A',
                }}
              >
                {u.kind}
              </span>
              <a
                href={`https://www.youtube.com/watch?v=${u.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink/70 hover:text-ink underline decoration-ink/10 underline-offset-2 truncate min-w-0"
              >
                {cleanTitle(u.title, artistName)}
              </a>
              <span className="text-ink/35 tabular-nums shrink-0">
                {fmtNum(u.views)}
                {u.daysAgo === 0 ? ' · today' : u.daysAgo === 1 ? ' · 1d' : ` · ${u.daysAgo}d`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Strip artist name prefix from video titles for cleaner display */
function cleanTitle(title: string, artistName: string): string {
  // Remove "Artist Name - " or "Artist Name – " prefix
  const prefixes = [
    `${artistName} - `,
    `${artistName} – `,
    `${artistName} — `,
    `${artistName}: `,
  ];
  for (const p of prefixes) {
    if (title.startsWith(p)) return title.slice(p.length);
    if (title.toLowerCase().startsWith(p.toLowerCase())) return title.slice(p.length);
  }
  return title;
}
