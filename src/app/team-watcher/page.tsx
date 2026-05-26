import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, deriveFromLive, isVirginOwned,
  type Artist, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnap, readSyncMeta, readChannelMapping } from '@/lib/kvCache';
import { readHistory, campaignDelta } from '@/lib/snapshots';
import {
  normalizeChannelData, rawDelta, computeWoW, toGrowthInput,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getCampaignSignal, getChannelHealth,
  type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { checkContentStructure } from '@/lib/contentStructure';
import { listEntries, type TeamWatcherEntry } from '@/lib/teamWatcherStore';
import ChannelHealthBoard, { type RowData } from '@/components/ChannelHealthBoard';
import TeamCampaignCards from '@/components/TeamCampaignCards';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Team Campaign Board — YouTube Campaign System',
  description: 'Shared team view — monitor channel health and campaign progress.',
};

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';
const SOFT = '#F6F1E7';

function cadenceLine(uploads30d: number): string {
  if (uploads30d >= 10) return `Strong cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 3) return `Moderate cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 1) return `Light cadence — ${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  return 'No recent cadence';
}

export default async function TeamWatcherPage() {
  const entries = await listEntries();
  const syncMeta = await readSyncMeta();
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);

  // ── Build RowData for Channel Health table (ALL entries) ──────────────
  const rows: RowData[] = await Promise.all(
    entries.map(async (entry) => {
      const snap = await readLiveSnap(entry.channelId);
      const history = snap?.channelId ? await readHistory(snap.channelId) : [];
      const nc = normalizeChannelData(snap, history);

      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);
      const { deltaOver: deltaOverFn } = await import('@/lib/snapshots');
      const subs14Raw = deltaOverFn(history, 14, 'subs');
      const views14Raw = deltaOverFn(history, 14, 'views');
      const subsWoWResult = computeWoW(nc.subs7d, subs14Raw);
      const viewsWoWResult = computeWoW(nc.views7d, views14Raw);

      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7Val,
        views7Delta: views7Val,
      }) : null;
      const status: ChannelState = derived?.status ?? 'COLD';
      const { classifyArtist } = await import('@/lib/artists');
      const classification = classifyArtist(status, nc.cadence.uploads30d);

      return {
        slug: entry.artistSlug,
        name: entry.displayName,
        isVirgin: true, // Team watcher shows all in managed view
        subs: nc.subs,
        subs7Delta: subs7Val,
        views7Delta: views7Val,
        subsWoW: subsWoWResult?.value ?? null,
        viewsWoW: viewsWoWResult?.value ?? null,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        status,
        classification,
        reason: derived?.reason ?? 'No cached data yet',
        subsSeries: nc.sparklineSubs30d,
        totalViews: nc.views,
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
        bestAvailableShouldUseInTopMovers: nc.bestAvailable.shouldUseInTopMovers,
      };
    }),
  );

  // ── Build rich CardData for pinned entries (Active Campaigns) ─────────
  const pinnedEntries = entries.filter((e) => e.pinnedAt != null);

  type TeamCardData = {
    slug: string;
    name: string;
    channelId: string;
    campaign: string;
    campaignState: string;
    regionTag: string;
    pinnedAt: string | null;
    subs7Delta: number | null;
    views7Delta: number | null;
    uploads30d: number;
    shorts30d: number;
    boardStatus: ChannelState;
    diagnosis: string;
    actions: string[];
    cadenceStr: string;
    sparkline: { x: number; y: number }[];
    subs: number | null;
    views: number | null;
    lastUploadDaysAgo: number | null;
    channelHealth: string;
    campaignSignal: string;
    campaignSignalLabel: string;
    spk: number | null;
    campaignDay: number | null;
    campaignViewsDelta: number | null;
    campaignSubsDelta: number | null;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    movementConfidence?: 'high' | 'medium' | 'limited' | 'stale';
    teamNotes: { id: string; text: string; createdAt: string }[];
  };

  const campaignCards: TeamCardData[] = await Promise.all(
    pinnedEntries.map(async (entry) => {
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

      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7Val,
        views7Delta: views7Val,
      }) : null;
      const currentStatus = derived?.status ?? 'COLD';

      // Match existing artist for phase/type
      const artist = allArtists.find((a) => a.slug === entry.artistSlug);

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

      return {
        slug: entry.artistSlug,
        name: entry.displayName,
        channelId: entry.channelId,
        campaign: entry.campaignName,
        campaignState: entry.campaignState,
        regionTag: entry.regionTag,
        pinnedAt: entry.pinnedAt,
        subs7Delta: subs7Val,
        views7Delta: views7Val,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        boardStatus: currentStatus,
        diagnosis: derived?.reason ?? 'Awaiting data',
        actions: [derived?.nextAction ?? 'Ship something this week'],
        cadenceStr: nc.cadence.cadenceLine,
        sparkline: nc.sparklineSubs30d,
        subs: nc.subs,
        views: nc.views,
        lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo,
        channelHealth: chHealth,
        campaignSignal: campSig.signal,
        campaignSignalLabel: campSig.label,
        spk,
        campaignDay,
        campaignViewsDelta,
        campaignSubsDelta,
        confidence: nc.confidence,
        movementConfidence: nc.movementConfidence,
        teamNotes: entry.teamNotes,
      };
    }),
  );

  const hasEntries = entries.length > 0;

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
              YouTube Campaign System
            </div>
            <h1 className="font-black text-[28px] leading-tight mt-1">
              Team Campaign Board
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/team-watcher/add"
              className="px-4 py-2 rounded-lg text-[12px] font-bold"
              style={{ background: INK, color: PAPER }}
            >
              + Add Artist
            </Link>
            {syncMeta && (
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 text-right">
                Last sync: {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!hasEntries && (
          <div className="text-center py-20">
            <h2 className="text-[24px] font-black mb-2">No artists yet</h2>
            <p className="text-[13px] text-ink/45 mb-6 max-w-[380px] mx-auto">
              Add your first artist to start monitoring channel health and
              campaign progress across the team.
            </p>
            <Link
              href="/team-watcher/add"
              className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-bold"
              style={{ background: INK, color: PAPER }}
            >
              + Add Artist
            </Link>
          </div>
        )}

        {/* Channel Health table */}
        {hasEntries && (
          <>
            <ChannelHealthBoard rows={rows} linkPrefix="/team-watcher" />

            {/* Active Campaigns section (pinned entries) */}
            {campaignCards.length > 0 && (
              <div className="mt-10">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/40 mb-4">
                  Active Campaigns
                </div>
                <TeamCampaignCards cards={campaignCards} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
