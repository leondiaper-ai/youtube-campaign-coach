import { Suspense } from 'react';
import { ARTISTS, mergeArtistLists, fmtNum, daysSince, deriveFromLive, STATUS_COLOR, type Artist, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import {
  listPinned, listNotes, getBaseline,
  listWeeklySnapshots, saveWeeklySnapshot,
  type PinnedCampaign, type CampaignNote, type CampaignWeeklySnapshot,
} from '@/lib/campaignStore';
import { readLiveSnapByHandle, readSyncMeta } from '@/lib/kvCache';
import { readHistory, channelDeltaSince, type ChannelSnapshot } from '@/lib/snapshots';
import { campaignPerformanceFor } from '@/lib/intelligence/campaignWindow';
import {
  generateYouTubeGrowthRead, getCampaignSignal, getChannelHealth,
  getYouTubeGrowthState, type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { checkContentStructure, type StructureWarning } from '@/lib/contentStructure';
import { computeWeeklyWindows } from '@/lib/campaignWeeks';
import { normalizeChannelData, toGrowthInput, rawDelta } from '@/lib/youtube/normalizeChannelData';
import CampaignStatusBoard from '@/components/CampaignStatusBoard';

export const revalidate = 600;

export const metadata = {
  title: 'Campaign Status Board',
  description: 'Live campaign status at a glance.',
};

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';

// ── Board uses the unified 5-state ChannelState from artists.ts ─────────────

function cadenceLine(uploads30d: number): string {
  if (uploads30d >= 10) return `Strong cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 3) return `Moderate cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 1) return `Light cadence — ${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  return 'No recent cadence';
}

// ── Impact data (since takeover) ─────────────────────────────────────────
export type ImpactData = {
  daysSinceTakeover: number;
  subsDelta: number | null;
  viewsDelta: number | null;
  uploadsShipped: number;
  stateAtStart: string;
  stateNow: string;
};

// ── Campaign window data (full campaign period) ─────────────────────────
export type CampaignWindowData = {
  campaignName: string;
  campaignDay: number;
  contentViews: number | null;
  channelViewsDelta: number | null;
  subsGained: number | null;
  contentMix: { uploads: number; shorts: number; videos: number };
};

// ── Campaign trend data ─────────────────────────────────────────────────
export type CampaignTrendData = {
  currentWeekViews: number | null;
  previousWeekViews: number | null;
  bestWeekViews: number | null;
  bestWeekNumber: number;
  /* CHANNEL scope. Named so after these were rendered as "Campaign views:
     19,043,112" for a campaign whose own assets had earned 1.08M. */
  totalChannelViews: number | null;
  totalChannelSubs: number | null;
  /* The campaign's own figures, from campaignWindow.ts. */
  campaignViews: number | null;
  campaignAssets: number | null;
};

// ── Weekly progress entry (for display) ─────────────────────────────────
export type WeeklyProgressEntry = {
  week: number;
  views7d: number | null;
  subs7d: number | null;
  channelHealth: string;
  campaignSignal: string;
  /** Week data status: confirmed = real delta, missing = no snapshot, partial = one metric only */
  status: 'confirmed' | 'missing' | 'partial';
};

// ── Card data shape (serializable to client) ────────────────────────────────
export type StatusCardData = {
  slug: string;
  name: string;
  campaign?: string;
  pinnedAt: string;
  priority: 'high' | 'normal';
  // Hero metrics
  subs7Delta: number | null;
  views7Delta: number | null;
  // Cadence data
  uploads30d: number;
  shorts30d: number;
  // Unified status from deriveFromLive
  boardStatus: ChannelState;
  diagnosis: string;
  actions: string[];
  cadenceLine: string;
  // Sparkline (30d subs series)
  sparkline: { x: number; y: number }[];
  // Channel-level data for aggregation
  subs: number | null;
  views: number | null;
  lastUploadDaysAgo: number | null;
  // Notes
  notes: CampaignNote[];
  // Impact tracking (null if no baseline captured)
  impact: ImpactData | null;
  // Campaign window (null if no campaign start date)
  campaignWindow: CampaignWindowData | null;
  // Campaign trend (null if fewer than 1 week of snapshots)
  campaignTrend: CampaignTrendData | null;
  // Weekly progress history
  weeklyProgress: WeeklyProgressEntry[];
  // Dual state
  channelHealth: string;
  campaignSignal: string;
  campaignSignalLabel: string;
  // YouTube channel thumbnail URL
  thumbnail?: string;
  // Artist type for value model scoping
  artistType?: 'managed' | 'observed' | 'external';
  // Revenue ownership — only 'virgin' gets value calculations
  ownership?: 'virgin' | 'observed';
  // Content structure warning (only present when a gap exists)
  structureWarning?: StructureWarning | null;
  // Data quality
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  healthNote?: string;
  dataStatus?: 'FRESH' | 'PARTIAL' | 'LIMITED' | 'STALE' | 'UNAVAILABLE';
  dataStatusNote?: string;
  viewDataFreshness?: 'fresh' | 'stale' | 'insufficient_history' | 'unavailable';
  /** Movement data confidence — drives UI tone (cautious vs assertive) */
  movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
  /** Movement freshness tier */
  movementFreshness?: 'live' | 'recent' | 'delayed' | 'stale';
  /** Last known good views 7d delta (retained from history) */
  lastKnownGoodViews7d?: number | null;
  /** Last known good subs 7d delta (retained from history) */
  lastKnownGoodSubs7d?: number | null;
  /** Days since last known good movement was confirmed */
  lastKnownGoodDaysAgo?: number | null;
  /** Best available movement source */
  bestAvailableSource?: 'live_7d' | 'recent_snapshot' | 'campaign_period' | 'recent_uploads' | 'last_confirmed' | 'none';
  /** Best available explanation for display */
  bestAvailableExplanation?: string;
};

// ── Helpers for weekly snapshot computation ─────────────────────────────
function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}


async function loadCard(
  pin: PinnedCampaign,
  allArtists: Artist[],
): Promise<StatusCardData | null> {
  const artist = allArtists.find((a) => a.slug === pin.slug);
  if (!artist) return null;

  const base: StatusCardData = {
    slug: artist.slug,
    name: artist.name,
    campaign: artist.campaign,
    pinnedAt: pin.pinnedAt,
    priority: pin.priority ?? 'normal',
    subs7Delta: null,
    views7Delta: null,
    uploads30d: 0,
    shorts30d: 0,
    boardStatus: 'COLD',
    diagnosis: 'No data yet',
    actions: ['Reawaken the page with 2–3 catalogue Shorts this week'],
    cadenceLine: cadenceLine(0),
    sparkline: [],
    subs: null,
    views: null,
    lastUploadDaysAgo: null,
    notes: await listNotes(artist.slug),
    impact: null,
    campaignWindow: null,
    campaignTrend: null,
    weeklyProgress: [],
    channelHealth: 'Cold',
    campaignSignal: 'NO_CAMPAIGN',
    campaignSignalLabel: 'No campaign',
  };

  const handle = artist.channelHandle ?? artist.name;
  if (!handle) return base;

  const snap = await readLiveSnapByHandle(handle);
  if (!snap || snap.error) return { ...base, diagnosis: 'No cached data yet' };

  const history = snap.channelId ? await readHistory(snap.channelId) : [];

  // ── Normalized data layer — single source of truth for metrics ────────
  const campaignStart = artist.campaignStartDate ?? pin.pinnedAt ?? null;
  const nc = normalizeChannelData(snap, history, campaignStart ? {
    campaignName: artist.campaign ?? 'Tracking',
    campaignStartDate: campaignStart,
    isActive: true,
  } : null);

  const derived = deriveFromLive(snap, {
    subs7Delta: rawDelta(nc.subs7d),
    views7Delta: rawDelta(nc.views7d),
    phase: artist.phase,
  });

  const currentStatus = derived?.status ?? 'COLD';

  // ── Growth OS dual state (bridged from normalized data) ───────────────
  const growthInput: GrowthInput = {
    ...toGrowthInput(nc, artist),
    hasActiveCampaign: true, // All pinned cards are actively tracked campaigns
    campaignName: artist.campaign ?? 'Active Campaign',
    lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo ?? 60,
  };
  const gsResult = getYouTubeGrowthState(growthInput);
  const chHealth = getChannelHealth(gsResult.state, growthInput);
  const campSig = getCampaignSignal(growthInput);

  // ── Impact from baseline ──────────────────────────────────────────────
  let impact: ImpactData | null = null;
  try {
    const baseline = await getBaseline(artist.slug);
    if (baseline && snap.subs != null) {
      const daysSinceTakeover = Math.max(
        1,
        Math.round((Date.now() - new Date(baseline.capturedAt).getTime()) / 86400000),
      );
      const baselineTs = new Date(baseline.capturedAt).getTime();
      const uploadsSinceBaseline = history.filter(
        (h) => new Date(h.ts).getTime() >= baselineTs,
      ).reduce((max, h) => Math.max(max, h.uploads30d), 0);

      impact = {
        daysSinceTakeover,
        subsDelta: (snap.subs != null && baseline.subs != null) ? snap.subs - baseline.subs : null,
        viewsDelta: (snap.views != null && baseline.views != null) ? snap.views - baseline.views : null,
        uploadsShipped: uploadsSinceBaseline,
        stateAtStart: baseline.channelState,
        stateNow: currentStatus,
      };
    }
  } catch {
    // Non-critical
  }

  // ── Campaign window data ──────────────────────────────────────────────
  // campaignStart already computed above for normalizeChannelData
  let campaignWindow: CampaignWindowData | null = null;
  let campaignTrend: CampaignTrendData | null = null;
  let weeklyProgress: WeeklyProgressEntry[] = [];

  if (campaignStart) {
    const startTs = new Date(campaignStart).getTime();

    /* ── CAMPAIGN PERFORMANCE — one definition, one function ───────────
       This block used to filter uploads, sum viewCount, count Shorts on
       its own duration rule and compute its own Day N. So did four other
       surfaces, and they had drifted: two Shorts rules, five Day-N
       formulas. campaignWindow.ts owns all of it now.

       `campaignStart` above is the pin date, which is not when the
       campaign began — it is the day somebody added the artist here. It
       is passed as `baselineAt`, the last resort, so the resolver prefers
       the channel's own observable era onset. For Kings of Leon that is
       12 Aug rather than 18 Aug: four more assets, and the difference
       between this page and the Campaign Home disappears. */
    const perf = campaignPerformanceFor({
      uploads: snap.recentUploads ?? [],
      baselineAt: campaignStart,
    });
    const campaignDay = perf?.day ?? Math.max(1, Math.floor((Date.now() - startTs) / 86400000) + 1);

    /* Whole-channel movement. Kept, because knowing the channel is up
       13.5M is worth knowing — but never again under a campaign label. */
    const campViewsDelta = channelDeltaSince(history, campaignStart, 'views');
    const campSubsDelta = channelDeltaSince(history, campaignStart, 'subs');

    campaignWindow = {
      campaignName: artist.campaign ?? 'Tracking',
      campaignDay,
      contentViews: perf?.views ?? null,
      channelViewsDelta: campViewsDelta?.delta ?? null,
      subsGained: campSubsDelta?.delta ?? null,
      contentMix: {
        uploads: perf?.assets ?? 0,
        shorts: perf?.shorts ?? 0,
        videos: perf?.longForm ?? 0,
      },
    };

    // ── Weekly windows for trend + progress ────────────────────────────
    const weeklyWindows = computeWeeklyWindows(history, campaignStart);

    // Load existing weekly snapshots
    const existingSnapshots = await listWeeklySnapshots(artist.slug);
    const existingById = new Map(existingSnapshots.map((s) => [s.id, s]));

    // Build weekly progress from windows + existing snapshots
    weeklyProgress = weeklyWindows.map((w) => {
      const existing = existingSnapshots.find((s) => s.week === w.week);
      return {
        week: w.week,
        views7d: w.views7d,
        subs7d: w.subs7d,
        channelHealth: existing?.channelHealth ?? chHealth,
        campaignSignal: existing?.campaignSignal ?? campSig.label,
        status: w.status,
      };
    });

    // Campaign trend from weekly windows
    if (weeklyWindows.length >= 1) {
      const currentWeek = weeklyWindows[weeklyWindows.length - 1];
      const previousWeek = weeklyWindows.length >= 2
        ? weeklyWindows[weeklyWindows.length - 2]
        : { views7d: null, subs7d: null, week: 0 };
      const bestWeek = weeklyWindows.reduce((best, w) =>
        (w.views7d ?? 0) > (best.views7d ?? 0) ? w : best, weeklyWindows[0]);

      campaignTrend = {
        currentWeekViews: currentWeek.views7d,
        previousWeekViews: previousWeek.views7d,
        bestWeekViews: bestWeek.views7d,
        bestWeekNumber: bestWeek.week,
        /* Named for what they are. These were `totalCampaignViews` and
           printed as "Campaign views: 19,043,112" for a channel whose
           campaign assets had earned 1.08M. */
        totalChannelViews: campViewsDelta?.delta ?? null,
        totalChannelSubs: campSubsDelta?.delta ?? null,
        campaignViews: perf?.views ?? null,
        campaignAssets: perf?.assets ?? null,
      };
    }

    // ── Auto-save weekly snapshot (fire-and-forget) ─────────────────────
    const thisWeekId = getISOWeekId(new Date());
    if (!existingById.has(thisWeekId)) {
      const growthRead = generateYouTubeGrowthRead(artist.name, growthInput);
      const weekNum = weeklyWindows.length > 0 ? weeklyWindows[weeklyWindows.length - 1].week : 1;
      const weeklySnap: CampaignWeeklySnapshot = {
        id: thisWeekId,
        snapshotDate: new Date().toISOString(),
        campaignDay,
        week: weekNum,
        views7d: rawDelta(nc.views7d) ?? null,
        subs7d: rawDelta(nc.subs7d) ?? null,
        uploads30d: snap.uploads30d ?? 0,
        shorts30d: snap.shorts30d ?? 0,
        campaignContentViews: perf?.views ?? null,
        campaignChannelViews: campViewsDelta?.delta ?? null,
        campaignSubsGained: campSubsDelta?.delta ?? null,
        contentMix: {
          uploads: perf?.assets ?? 0,
          shorts: perf?.shorts ?? 0,
          videos: perf?.longForm ?? 0,
        },
        channelHealth: chHealth,
        campaignSignal: campSig.label,
        signal: growthRead.signal,
        blocker: growthRead.blocker.label,
        actionThisWeek: growthRead.actions.doNow.slice(0, 2),
        notes: '',
      };
      // Fire-and-forget — don't block render
      saveWeeklySnapshot(artist.slug, weeklySnap).catch(() => {});
    }
  }

  return {
    ...base,
    // Core metrics from normalized data layer
    subs7Delta: rawDelta(nc.subs7d),
    views7Delta: rawDelta(nc.views7d),
    subs: nc.subs,
    views: nc.views,
    lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo,
    uploads30d: nc.cadence.uploads30d,
    shorts30d: nc.cadence.shorts30d,
    boardStatus: currentStatus,
    diagnosis: derived?.reason ?? 'Awaiting data',
    actions: [derived?.nextAction ?? 'Ship something this week'],
    cadenceLine: nc.cadence.cadenceLine,
    sparkline: nc.sparklineSubs30d,
    impact,
    campaignWindow,
    campaignTrend,
    weeklyProgress,
    channelHealth: chHealth,
    campaignSignal: campSig.signal,
    campaignSignalLabel: campSig.label,
    thumbnail: snap.thumbnail ?? undefined,
    artistType: artist.artistType ?? 'managed',
    ownership: artist.ownership,
    structureWarning: checkContentStructure(snap.recentUploads ?? []),
    confidence: nc.confidence,
    healthNote: nc.healthNote,
    dataStatus: nc.dataStatus,
    dataStatusNote: nc.dataStatusNote,
    viewDataFreshness: nc.viewDataFreshness,
    movementConfidence: nc.movementConfidence,
    movementFreshness: nc.movementFreshness,
    lastKnownGoodViews7d: nc.lastKnownGood.views7d,
    lastKnownGoodSubs7d: nc.lastKnownGood.subs7d,
    lastKnownGoodDaysAgo: nc.lastKnownGood.daysAgo,
    bestAvailableSource: nc.bestAvailable.source,
    bestAvailableExplanation: nc.bestAvailable.explanation,
  };
}

export default async function CampaignsPage() {
  const pinned = await listPinned();
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);

  const cards = (
    await Promise.all(pinned.map((p) => loadCard(p, allArtists)))
  ).filter((c): c is StatusCardData => c !== null);

  cards.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
  });

  const pinnedSlugs = new Set(pinned.map((p) => p.slug));
  const available = allArtists.filter((a) => !pinnedSlugs.has(a.slug));

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-6xl mx-auto px-5 py-6">

        <Suspense fallback={null}>
          <CampaignStatusBoard
            initialCards={cards}
            availableArtists={available.map((a) => ({ slug: a.slug, name: a.name }))}
          />
        </Suspense>
      </div>
    </div>
  );
}
