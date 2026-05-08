import Link from 'next/link';
import { ARTISTS, mergeArtistLists, fmtNum, daysSince, deriveFromLive, STATUS_COLOR, type Artist, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import {
  listPinned, listNotes, getBaseline,
  listWeeklySnapshots, saveWeeklySnapshot,
  type PinnedCampaign, type CampaignNote, type CampaignWeeklySnapshot,
} from '@/lib/campaignStore';
import { readLiveSnapByHandle, readSyncMeta } from '@/lib/kvCache';
import { readHistory, campaignDelta, type ChannelSnapshot } from '@/lib/snapshots';
import {
  generateYouTubeGrowthRead, getCampaignSignal, getChannelHealth,
  getYouTubeGrowthState, type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { checkContentStructure, type StructureWarning } from '@/lib/contentStructure';
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
  subsDelta: number;
  viewsDelta: number;
  uploadsShipped: number;
  stateAtStart: string;
  stateNow: string;
};

// ── Campaign window data (full campaign period) ─────────────────────────
export type CampaignWindowData = {
  campaignName: string;
  campaignDay: number;
  contentViews: number;
  channelViewsDelta: number;
  subsGained: number;
  contentMix: { uploads: number; shorts: number; videos: number };
};

// ── Campaign trend data ─────────────────────────────────────────────────
export type CampaignTrendData = {
  currentWeekViews: number;
  previousWeekViews: number;
  bestWeekViews: number;
  bestWeekNumber: number;
  totalCampaignViews: number;
  totalCampaignSubs: number;
};

// ── Weekly progress entry (for display) ─────────────────────────────────
export type WeeklyProgressEntry = {
  week: number;
  views7d: number;
  subs7d: number;
  channelHealth: string;
  campaignSignal: string;
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
  // Artist type for value model scoping
  artistType?: 'managed' | 'observed' | 'external';
  // Revenue ownership — only 'virgin' gets value calculations
  ownership?: 'virgin' | 'observed';
  // Content structure warning (only present when a gap exists)
  structureWarning?: StructureWarning | null;
};

// ── Helpers for weekly snapshot computation ─────────────────────────────
function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function computeWeeklyWindows(
  history: ChannelSnapshot[],
  campaignStartDate: string,
): { week: number; views7d: number; subs7d: number }[] {
  if (history.length < 2) return [];
  const startTs = new Date(campaignStartDate).getTime();
  const windows: { week: number; views7d: number; subs7d: number }[] = [];
  // Filter to campaign-period history, sorted by time
  const relevantHistory = history
    .filter((h) => new Date(h.ts).getTime() >= startTs)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  if (relevantHistory.length < 2) return [];

  // Use fixed 7-day windows from campaign start, with the previous
  // week's last snapshot as the baseline for the next week (no gaps).
  const firstSnap = relevantHistory[0];
  let weekNum = 1;
  let windowStart = startTs;
  let baseline = firstSnap; // running baseline from previous week

  while (windowStart < Date.now()) {
    const windowEnd = windowStart + 7 * 86400000;
    // Find the latest snapshot within this window
    const inWindow = relevantHistory.filter((h) => {
      const t = new Date(h.ts).getTime();
      return t >= windowStart && t < windowEnd;
    });
    // Also include any snapshot before the window for baseline
    const latestInWindow = inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;

    if (latestInWindow) {
      windows.push({
        week: weekNum,
        views7d: Math.max(0, latestInWindow.views - baseline.views),
        subs7d: latestInWindow.subs - baseline.subs,
      });
      baseline = latestInWindow; // carry forward for next week
    } else if (windowStart > Date.now()) {
      break; // future weeks — stop
    }
    // If no data this week, skip but keep same baseline
    weekNum++;
    windowStart = windowEnd;
    // Stop if we've gone past the last snapshot + 1 week
    if (windowStart > new Date(relevantHistory[relevantHistory.length - 1].ts).getTime() + 7 * 86400000) break;
  }
  return windows;
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
        subsDelta: (snap.subs ?? 0) - baseline.subs,
        viewsDelta: (snap.views ?? 0) - baseline.views,
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
    const campaignDay = Math.max(1, Math.floor((Date.now() - startTs) / 86400000));

    // Content uploaded since campaign start
    const campaignUploads = (snap.recentUploads ?? []).filter(
      (u) => new Date(u.publishedAt).getTime() >= startTs,
    );
    const contentViews = campaignUploads.reduce((sum, u) => sum + u.viewCount, 0);
    const shortsCount = campaignUploads.filter((u) => u.durationSec <= 62).length;

    // Channel-level deltas since campaign
    const campViewsDelta = campaignDelta(history, campaignStart, 'views');
    const campSubsDelta = campaignDelta(history, campaignStart, 'subs');

    campaignWindow = {
      campaignName: artist.campaign ?? 'Tracking',
      campaignDay,
      contentViews,
      channelViewsDelta: campViewsDelta?.delta ?? 0,
      subsGained: campSubsDelta?.delta ?? 0,
      contentMix: {
        uploads: campaignUploads.length,
        shorts: shortsCount,
        videos: campaignUploads.length - shortsCount,
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
      };
    });

    // Campaign trend from weekly windows
    if (weeklyWindows.length >= 1) {
      const currentWeek = weeklyWindows[weeklyWindows.length - 1];
      const previousWeek = weeklyWindows.length >= 2
        ? weeklyWindows[weeklyWindows.length - 2]
        : { views7d: 0, subs7d: 0, week: 0 };
      const bestWeek = weeklyWindows.reduce((best, w) =>
        w.views7d > best.views7d ? w : best, weeklyWindows[0]);

      campaignTrend = {
        currentWeekViews: currentWeek.views7d,
        previousWeekViews: previousWeek.views7d,
        bestWeekViews: bestWeek.views7d,
        bestWeekNumber: bestWeek.week,
        totalCampaignViews: campViewsDelta?.delta ?? contentViews,
        totalCampaignSubs: campSubsDelta?.delta ?? 0,
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
        views7d: rawDelta(nc.views7d) ?? 0,
        subs7d: rawDelta(nc.subs7d) ?? 0,
        uploads30d: snap.uploads30d ?? 0,
        shorts30d: snap.shorts30d ?? 0,
        campaignContentViews: contentViews,
        campaignChannelViews: campViewsDelta?.delta ?? 0,
        campaignSubsGained: campSubsDelta?.delta ?? 0,
        contentMix: {
          uploads: campaignUploads.length,
          shorts: shortsCount,
          videos: campaignUploads.length - shortsCount,
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
    diagnosis: derived?.reason ?? 'No data',
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
    artistType: artist.artistType ?? 'managed',
    ownership: artist.ownership,
    structureWarning: checkContentStructure(snap.recentUploads ?? []),
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
      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40 mb-1">
              YouTube Campaign System
            </div>
            <h1 className="font-black text-[28px] leading-tight">Campaign Status Board</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/cockpit"
              className="text-[11px] uppercase tracking-[0.14em] text-ink/35 hover:text-ink/60 transition-colors"
            >
              All Artists
            </Link>
            <span className="text-[10px] text-ink/20">·</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/25">Live</span>
          </div>
        </div>

        <CampaignStatusBoard
          initialCards={cards}
          availableArtists={available.map((a) => ({ slug: a.slug, name: a.name }))}
        />
      </div>
    </div>
  );
}
