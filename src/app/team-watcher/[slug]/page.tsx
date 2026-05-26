import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ARTISTS, mergeArtistLists, deriveFromLive, fmtNum, daysSince,
  STATUS_COLOR, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnap } from '@/lib/kvCache';
import { readHistory, campaignDelta } from '@/lib/snapshots';
import {
  normalizeChannelData, rawDelta, computeWoW,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getCampaignSignal, getChannelHealth,
  type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { toGrowthInput } from '@/lib/youtube/normalizeChannelData';
import { listEntries, type TeamWatcherEntry } from '@/lib/teamWatcherStore';
import {
  CAMPAIGN_STATE_STYLE,
  CAMPAIGN_STATES,
  type CampaignState,
} from '@/lib/teamWatcherStore';
import {
  CAMPAIGN_SIGNAL_STYLE,
  type CampaignSignal,
} from '@/lib/youtubeGrowthOS';
import Sparkline from '@/components/Sparkline';
import TeamDetailClient, { type SnapshotData, type CampaignTrackingData, type WeeklyProgressEntry } from './TeamDetailClient';
import { checkContentStructure } from '@/lib/contentStructure';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entries = await listEntries();
  const entry = entries.find((e) => e.artistSlug === slug);
  return {
    title: entry
      ? `${entry.displayName} — Team Campaign Board`
      : 'Artist — Team Campaign Board',
  };
}

// ── Design tokens ────────────────────────────────────────────────────────────
const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';
const MUTED = '#E9E2D3';

const STATE_LABEL: Record<ChannelState, string> = {
  HEALTHY:           'Healthy',
  'WEAK CONVERSION': 'Weak Conversion',
  BUILDING:          'Building',
  'AT RISK':         'At Risk',
  COLD:              'Cold',
};

function fmtDelta(n: number): string {
  return (n >= 0 ? '+' : '') + fmtNum(n);
}

function deltaColor(v: number | null): string {
  if (v == null) return 'rgba(14,14,14,0.25)';
  if (v > 0) return '#0C6A3F';
  if (v < 0) return '#8A1F0C';
  return 'rgba(14,14,14,0.4)';
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Find the team watcher entry
  const entries = await listEntries();
  const entry = entries.find((e) => e.artistSlug === slug);
  if (!entry) notFound();

  // Load cached YouTube data
  const snap = await readLiveSnap(entry.channelId);
  const history = snap?.channelId ? await readHistory(snap.channelId) : [];

  const campaignStart = entry.campaignStartDate || null;
  const nc = normalizeChannelData(snap, history, campaignStart ? {
    campaignName: entry.campaignName || 'Tracking',
    campaignStartDate: campaignStart,
    isActive: true,
  } : null);

  const subs7Val = rawDelta(nc.subs7d);
  const views7Val = rawDelta(nc.views7d);

  // Derive channel state
  const derived = snap ? deriveFromLive(snap, {
    subs7Delta: subs7Val,
    views7Delta: views7Val,
  }) : null;
  const channelState: ChannelState = derived?.status ?? 'COLD';
  const sc = STATUS_COLOR[channelState];

  // Match existing artist for phase/type
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const artist = allArtists.find((a) => a.slug === entry.artistSlug);

  // Growth OS dual state
  const growthInput: GrowthInput = {
    ...toGrowthInput(nc, artist ?? { slug: entry.artistSlug, name: entry.displayName, phase: 'PRE' as const }),
    hasActiveCampaign: !!entry.campaignName,
    campaignName: entry.campaignName || undefined,
    lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? 60,
  };
  const gsResult = getYouTubeGrowthState(growthInput);
  const chHealth = getChannelHealth(gsResult.state, growthInput);
  const campSig = getCampaignSignal(growthInput);

  // Campaign period deltas
  let campaignDay: number | null = null;
  let campaignViewsDelta: number | null = null;
  let campaignSubsDelta: number | null = null;
  if (campaignStart) {
    const startTs = new Date(campaignStart).getTime();
    campaignDay = Math.max(1, Math.floor((Date.now() - startTs) / 86400000));
    const cv = campaignDelta(history, campaignStart, 'views');
    const cs = campaignDelta(history, campaignStart, 'subs');
    campaignViewsDelta = cv?.delta ?? null;
    campaignSubsDelta = cs?.delta ?? null;
  }

  // Conversion metric
  const spk = (views7Val != null && views7Val > 0 && subs7Val != null)
    ? (subs7Val / views7Val) * 1000
    : null;

  // WoW deltas
  const { deltaOver } = await import('@/lib/snapshots');
  const subs14Raw = deltaOver(history, 14, 'subs');
  const views14Raw = deltaOver(history, 14, 'views');
  const subsWoW = computeWoW(nc.subs7d, subs14Raw);
  const viewsWoW = computeWoW(nc.views7d, views14Raw);

  const lastUpDays = nc.cadence.lastUploadDaysAgo;

  // Best available movement data
  const ba = nc.bestAvailable;

  // Campaign content stats (if campaign is active)
  const campaignUploads = campaignStart
    ? (snap?.recentUploads ?? []).filter(
        (u: { publishedAt: string }) => new Date(u.publishedAt).getTime() >= new Date(campaignStart).getTime()
      )
    : [];
  const campaignContentViews = campaignUploads.reduce((sum: number, u: { viewCount: number }) => sum + u.viewCount, 0);
  const campaignContentCount = campaignUploads.length;
  const campaignShortsCount = campaignUploads.filter((u: { durationSec: number }) => u.durationSec <= 62).length;

  // ── Campaign tracking data (weekly progress, trend, structure) ────────
  let campaignTracking: CampaignTrackingData | undefined;
  if (campaignStart && campaignDay) {
    const startTs = new Date(campaignStart).getTime();
    const uploads = campaignUploads as { publishedAt: string; viewCount: number; durationSec: number; id: string; title: string }[];

    // Weekly progress from history
    const weeklyProgress: WeeklyProgressEntry[] = [];
    const relevantHistory = history
      .filter((h: { ts: string; views?: number | null; subs?: number | null }) =>
        new Date(h.ts).getTime() >= startTs && (h.views != null || h.subs != null)
      )
      .sort((a: { ts: string }, b: { ts: string }) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (relevantHistory.length >= 2) {
      let weekNum = 1;
      let windowStart = startTs;
      let baseline = relevantHistory[0];

      while (windowStart < Date.now()) {
        const windowEnd = windowStart + 7 * 86400000;
        const inWindow = relevantHistory.filter((h: { ts: string }) => {
          const t = new Date(h.ts).getTime();
          return t >= windowStart && t < windowEnd;
        });
        const latest = inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;

        if (latest) {
          const vd = (latest.views != null && baseline.views != null)
            ? Math.max(0, latest.views - baseline.views) : null;
          const sd = (latest.subs != null && baseline.subs != null)
            ? latest.subs - baseline.subs : null;
          const status = (vd == null && sd == null) ? 'partial' as const
            : (vd != null || sd != null) ? 'confirmed' as const : 'partial' as const;
          weeklyProgress.push({
            week: weekNum,
            views7d: vd,
            subs7d: sd,
            channelHealth: STATE_LABEL[channelState],
            campaignSignal: campSig.label,
            status,
          });
          baseline = latest;
        } else {
          weeklyProgress.push({
            week: weekNum,
            views7d: null,
            subs7d: null,
            channelHealth: STATE_LABEL[channelState],
            campaignSignal: campSig.label,
            status: 'missing',
          });
        }
        weekNum++;
        windowStart = windowEnd;
      }
    }

    // Current/previous week views for momentum
    const currentWeekViews = weeklyProgress.length > 0 ? weeklyProgress[weeklyProgress.length - 1].views7d : null;
    const previousWeekViews = weeklyProgress.length >= 2 ? weeklyProgress[weeklyProgress.length - 2].views7d : null;

    // Content structure warning — use full recentUploads from snap (includes all required fields)
    const campaignRecentUploads = (snap?.recentUploads ?? []).filter(
      (u: { publishedAt: string }) => new Date(u.publishedAt).getTime() >= startTs,
    );
    const structureWarning = checkContentStructure(campaignRecentUploads);

    campaignTracking = {
      campaignName: entry.campaignName || 'Tracking',
      campaignDay,
      contentViews: campaignContentViews,
      channelViewsDelta: campaignViewsDelta,
      subsGained: campaignSubsDelta,
      contentMix: {
        uploads: campaignContentCount,
        shorts: campaignShortsCount,
        videos: campaignContentCount - campaignShortsCount,
      },
      currentWeekViews,
      previousWeekViews,
      weeklyProgress,
      structureWarning: structureWarning ? { headline: structureWarning.headline, detail: structureWarning.detail } : null,
      campaignSignalLabel: campSig.label,
    };
  }

  // Sparkline data
  const sparkColor = (() => {
    if (channelState === 'HEALTHY') return { stroke: '#0C6A3F', fill: 'rgba(12,106,63,0.08)' };
    if (channelState === 'WEAK CONVERSION') return { stroke: '#F08A3C', fill: 'rgba(240,138,60,0.06)' };
    if (channelState === 'AT RISK' || channelState === 'COLD') return { stroke: '#FF4A1C', fill: 'rgba(255,74,28,0.06)' };
    return { stroke: '#B0A68E', fill: 'rgba(176,166,142,0.06)' };
  })();

  const stateStyle = CAMPAIGN_STATE_STYLE[entry.campaignState as CampaignState] ?? CAMPAIGN_STATE_STYLE.Monitoring;

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[880px] mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/team-watcher"
            className="text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-ink"
          >
            &larr; Team Campaign Board
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45 mb-1">
          YouTube Campaign System
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-black text-3xl">{entry.displayName}</h1>
          {/* Campaign state pill */}
          <span
            className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-[0.08em]"
            style={{ background: stateStyle.bg, color: stateStyle.fg }}
          >
            {entry.campaignState}
          </span>
          {entry.regionTag && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em]"
              style={{ background: SOFT, color: 'rgba(14,14,14,0.4)' }}
            >
              {entry.regionTag}
            </span>
          )}
        </div>

        {/* Dual health labels */}
        <div className="flex items-center gap-3 mt-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-[0.14em]"
            style={{ background: sc.bg, color: sc.fg }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: sc.dot }} />
            {STATE_LABEL[channelState]}
          </span>
          {campSig.signal !== 'NO_CAMPAIGN' && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                background: CAMPAIGN_SIGNAL_STYLE[campSig.signal as CampaignSignal]?.bg ?? SOFT,
                color: CAMPAIGN_SIGNAL_STYLE[campSig.signal as CampaignSignal]?.fg ?? INK,
              }}
            >
              {campSig.label}
            </span>
          )}
        </div>

        {/* Diagnosis */}
        {derived?.reason && (
          <div className="mt-4 text-[14px] font-semibold text-ink/70 leading-snug max-w-[60ch]">
            {derived.reason}
          </div>
        )}

        {/* Performance snapshot — 4-tile grid */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          <MetricTile
            label={ba.source === 'live_7d' ? 'Views (7d)' : ba.source === 'campaign_period' ? 'Campaign views' : 'Views (7d)'}
            value={ba.viewsValue != null ? fmtDelta(ba.viewsValue) : '—'}
            color={ba.viewsValue != null ? deltaColor(ba.viewsValue) : undefined}
            sub={ba.sublabel}
          />
          <MetricTile
            label={ba.source === 'live_7d' ? 'Subs (7d)' : ba.source === 'campaign_period' ? 'Campaign subs' : 'Subs (7d)'}
            value={ba.subsValue != null ? fmtDelta(ba.subsValue) : (nc.subs != null ? fmtNum(nc.subs) : '—')}
            color={ba.subsValue != null ? deltaColor(ba.subsValue) : undefined}
            sub={ba.subsValue != null ? ba.sublabel : 'total'}
          />
          <MetricTile
            label="Uploads (30d)"
            value={nc.cadence.uploads30d != null ? String(nc.cadence.uploads30d) : '—'}
            sub={nc.cadence.shorts30d > 0 ? `${nc.cadence.shorts30d} Shorts` : null}
          />
          <MetricTile
            label="Last upload"
            value={lastUpDays != null ? (lastUpDays === 0 ? 'Today' : `${lastUpDays}d ago`) : '—'}
            color={lastUpDays != null ? (lastUpDays <= 3 ? '#0C6A3F' : lastUpDays >= 14 ? '#8A1F0C' : undefined) : undefined}
            sub={null}
          />
        </div>

        {/* Movement source indicator */}
        {ba.source !== 'live_7d' && ba.source !== 'none' && ba.explanation && (
          <div className="mt-2 text-[10px] italic text-ink/35">{ba.explanation}</div>
        )}

        {/* Conversion + Sparkline row */}
        <div className="mt-6 flex items-end gap-6 flex-wrap">
          <div>
            <div
              className="text-[24px] font-black leading-none tabular-nums"
              style={{ color: spk != null ? (spk >= 2 ? '#0C6A3F' : spk >= 1 ? '#7A5A00' : '#8A1F0C') : 'rgba(14,14,14,0.25)' }}
            >
              {spk != null ? spk.toFixed(1) : '—'}
            </div>
            <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold" style={{
              color: spk != null ? (spk >= 2 ? '#0C6A3F' : spk >= 1 ? '#7A5A00' : '#8A1F0C') : 'rgba(14,14,14,0.25)',
            }}>
              subs/1K views{spk != null ? ` · ${spk >= 2 ? 'strong' : spk >= 1 ? 'healthy' : 'weak'}` : ''}
            </div>
          </div>

          {viewsWoW?.value != null && (
            <div>
              <div
                className="text-[18px] font-black leading-none tabular-nums"
                style={{ color: deltaColor(viewsWoW.value) }}
              >
                {viewsWoW.value >= 0 ? '+' : ''}{viewsWoW.value.toFixed(0)}%
              </div>
              <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold text-ink/35">
                views WoW
              </div>
            </div>
          )}

          {subsWoW?.value != null && (
            <div>
              <div
                className="text-[18px] font-black leading-none tabular-nums"
                style={{ color: deltaColor(subsWoW.value) }}
              >
                {subsWoW.value >= 0 ? '+' : ''}{subsWoW.value.toFixed(0)}%
              </div>
              <div className="text-[9px] mt-1 uppercase tracking-[0.1em] font-bold text-ink/35">
                subs WoW
              </div>
            </div>
          )}

          <div className="ml-auto rounded-lg px-3 py-2" style={{ background: sparkColor.fill }}>
            <Sparkline
              data={nc.sparklineSubs30d}
              width={160}
              height={48}
              stroke={sparkColor.stroke}
              fill={sparkColor.fill}
            />
            <div className="text-[9px] text-right mt-0.5 uppercase tracking-wider font-bold" style={{ color: sparkColor.stroke }}>
              30d subs trend
            </div>
          </div>
        </div>

        {/* Actions from derived */}
        {derived?.nextAction && (
          <div className="mt-8 rounded-lg p-4" style={{ background: SOFT }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-2">
              Recommended action
            </div>
            <div className="text-[13px] font-medium leading-snug flex gap-2">
              <span className="text-ink/40 shrink-0">&rarr;</span>
              <span>{derived.nextAction}</span>
            </div>
          </div>
        )}

        {/* Content cadence */}
        <div className="mt-6 rounded-lg p-4 border" style={{ borderColor: MUTED, background: PAPER }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-1">
            Content cadence
          </div>
          <div className="text-[13px] text-ink/60 leading-snug">
            {nc.cadence.cadenceLine}
          </div>
        </div>

        {/* Team notes + snapshot + campaign — client component for interactivity */}
        <TeamDetailClient
          channelId={entry.channelId}
          initialNotes={entry.teamNotes}
          campaignState={entry.campaignState}
          regionTag={entry.regionTag}
          hasCampaign={!!campaignStart && !!entry.campaignName}
          initialCampaignName={entry.campaignName}
          campaignTracking={campaignTracking}
          snapshotData={{
            artistName: entry.displayName,
            channelState: STATE_LABEL[channelState],
            campaignState: entry.campaignState,
            diagnosis: derived?.reason ?? 'No data yet',
            nextAction: derived?.nextAction ?? null,
            cadenceLine: nc.cadence.cadenceLine,
            subs: nc.subs,
            views7d: views7Val,
            subs7d: subs7Val,
            uploads30d: nc.cadence.uploads30d,
            shorts30d: nc.cadence.shorts30d,
            lastUpDays: lastUpDays ?? null,
            spk,
            viewsWoW: viewsWoW?.value ?? null,
            subsWoW: subsWoW?.value ?? null,
            campaignName: entry.campaignName,
            campaignDay,
            campaignViewsDelta,
            campaignSubsDelta,
            campaignContentViews,
            campaignContentCount,
            campaignShortsCount,
          }}
        />
      </div>
    </main>
  );
}

// ── MetricTile ──────────────────────────────────────────────────────────────

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
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: SOFT }}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 mb-1">
        {label}
      </div>
      <div
        className="text-[20px] font-black leading-none tabular-nums"
        style={{ color: color ?? INK }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-ink/35 mt-1">{sub}</div>
      )}
    </div>
  );
}
