import {
  ARTISTS, mergeArtistLists, deriveFromLive, isVirginOwned,
  type Artist, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readLiveSnap, readSyncMeta, readChannelMapping } from '@/lib/kvCache';
import { readHistory, channelDeltaSince } from '@/lib/snapshots';
import { campaignPerformanceFor } from '@/lib/intelligence/campaignWindow';
import {
  normalizeChannelData, rawDelta, computeWoW, toGrowthInput,
} from '@/lib/youtube/normalizeChannelData';
import {
  getYouTubeGrowthState, getCampaignSignal, getChannelHealth,
  type GrowthInput,
} from '@/lib/youtubeGrowthOS';
import { checkContentStructure, computeMultiformat } from '@/lib/contentStructure';
import { listEntries, type TeamWatcherEntry } from '@/lib/teamWatcherStore';
import ChannelHealthBoard, { type RowData } from '@/components/ChannelHealthBoard';
import TeamCampaignCards from '@/components/TeamCampaignCards';
import TeamBoardShell from '@/components/TeamBoardShell';
import type { CardData } from '@/components/CampaignDecisionCard';
import type { TeamCardData } from '@/components/TeamCampaignCards';
import { computeWeeklyWindows } from '@/lib/campaignWeeks';
import AddArtistModal, { AddArtistModalInline } from '@/components/AddArtistModal';

import type { Team } from '@/lib/teams';

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';
const SOFT = '#F6F1E7';

function cadenceLine(uploads30d: number): string {
  if (uploads30d >= 10) return `Strong cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 3) return `Moderate cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 1) return `Light cadence — ${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  return 'No recent cadence';
}

/* ── ONE BOARD, MANY TEAMS ──────────────────────────────────────────
   This was the Nordics page. It is now the board itself, and the team is
   an argument — which is the whole difference between adding Australia
   and adding the region after that.

   `linkPrefix` matters more than it looks: the row links have to stay
   inside the team's own space so somebody following one does not land on
   an internal page they were never given. */
export default async function TeamBoard({ team, linkPrefix, linkSuffix = '' }: {
  team: Team;
  linkPrefix: string;
  /** Carried onto every row link so the key survives a click. */
  linkSuffix?: string;
}) {
  const entries = await listEntries(team.slug);
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
        channelId: entry.channelId,
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
        multiformat: snap?.recentUploads ? computeMultiformat(snap.recentUploads) : undefined,
      };
    }),
  );

  // ── Build rich CardData for pinned entries (Active Campaigns) ─────────
  const pinnedEntries = entries.filter((e) => e.pinnedAt != null);

  /* ── THE SAME CARD, THE SAME FIELDS ──────────────────────────────
     A team's pinned artist used to get a card built here with a
     narrower shape than the one the campaigns board draws. It now
     builds CardData — the real one — so the team reads the same
     figures, in the same order, with the same growth read.

     Two fields stay empty by honest default: `impact` needs a takeover
     date nobody has entered for a regional artist, and `priority` is
     ours. Everything else is computed from the same sources. */

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
      /* This list held `snap` all along and never read `recentUploads`,
         so every card showed a whole-channel delta under a Day-N header.
         The uploads were one property away. */
      const perf = campaignPerformanceFor({
        uploads: (snap?.recentUploads ?? []) as { publishedAt: string; viewCount?: number | null; durationSec?: number | null }[],
        statedAt: campaignStart || null,
        statedBy: 'Team Watcher',
      });
      let campaignViews: number | null = null;
      let campaignAssets: number | null = null;
      if (campaignStart) {
        campaignDay = perf?.day ?? null;
        campaignViews = perf?.views ?? null;
        campaignAssets = perf?.assets ?? null;
        const cv = channelDeltaSince(history, campaignStart, 'views');
        const cs = channelDeltaSince(history, campaignStart, 'subs');
        campaignViewsDelta = cv?.delta ?? null;
        campaignSubsDelta = cs?.delta ?? null;
      }

      // Conversion metric
      const spk = (views7Val != null && views7Val > 0 && subs7Val != null)
        ? (subs7Val / views7Val) * 1000
        : null;

      /* ── WEEKLY PROGRESS AND TREND ──────────────────────────────
         Same windows the campaigns board uses, from the same helper,
         so a team's week 3 is our week 3. Absent when there is no
         stated campaign start, because without one there is nothing to
         count weeks from. */
      const weeklyWindows = campaignStart
        ? computeWeeklyWindows(history, campaignStart)
        : [];

      const weeklyProgress = weeklyWindows.map((w) => ({
        week: w.week,
        views7d: w.views7d,
        subs7d: w.subs7d,
        channelHealth: chHealth,
        campaignSignal: campSig.label,
        status: w.status,
      }));

      let campaignWindow = null as CardData['campaignWindow'];
      let campaignTrend = null as CardData['campaignTrend'];

      if (campaignStart && campaignDay) {
        campaignWindow = {
          campaignName: entry.campaignName || 'Tracking',
          campaignDay,
          contentViews: perf?.views ?? null,
          channelViewsDelta: campaignViewsDelta,
          subsGained: campaignSubsDelta,
          contentMix: {
            uploads: perf?.assets ?? 0,
            shorts: perf?.shorts ?? 0,
            videos: perf?.longForm ?? 0,
          },
        };

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
            totalChannelViews: campaignViewsDelta,
            totalChannelSubs: campaignSubsDelta,
            campaignViews: perf?.views ?? null,
            campaignAssets: perf?.assets ?? null,
          };
        }
      }

      return {
        slug: entry.artistSlug,
        name: entry.displayName,
        campaign: entry.campaignName || undefined,
        /* Non-null by the filter above; the type wants a string. */
        pinnedAt: entry.pinnedAt ?? new Date().toISOString(),
        priority: 'normal' as const,
        subs7Delta: subs7Val,
        views7Delta: views7Val,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        boardStatus: currentStatus,
        diagnosis: derived?.reason ?? 'Awaiting data',
        actions: [derived?.nextAction ?? 'Ship something this week'],
        cadenceLine: nc.cadence.cadenceLine,
        sparkline: nc.sparklineSubs30d,
        subs: nc.subs,
        views: nc.views,
        lastUploadDaysAgo: nc.cadence.lastUploadDaysAgo,
        /* The team's own notes, in the shape the card reads. */
        notes: entry.teamNotes.map((n) => ({
          id: n.id, text: n.text, createdAt: n.createdAt,
        })),
        /* Needs a takeover date nobody enters for a regional artist. */
        impact: null,
        campaignWindow,
        campaignTrend,
        weeklyProgress,
        channelHealth: chHealth,
        campaignSignal: campSig.signal,
        campaignSignalLabel: campSig.label,
        thumbnail: snap?.thumbnail ?? undefined,
        structureWarning: snap?.recentUploads
          ? checkContentStructure(snap.recentUploads)
          : null,
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
        /* Carried for the board's own use, not the card's. */
        channelId: entry.channelId,
      };
    }),
  );

  const hasEntries = entries.length > 0;

  const header = (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
          YouTube Campaign System
        </div>
        <h1 className="font-black text-[28px] leading-tight mt-1">
          {team.name}
        </h1>
        <p className="text-[11px] text-ink/35 mt-1">
          {team.blurb}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <AddArtistModal team={team.slug} regionTag={team.regionTag} />
        {syncMeta && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 text-right">
            Last sync: {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );

  if (!hasEntries) {
    return (
      <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
        <div className="max-w-[1080px] mx-auto px-6 py-10">
          {header}
          <div className="text-center py-20">
            <h2 className="text-[24px] font-black mb-2">No artists yet</h2>
            <p className="text-[13px] text-ink/45 mb-6 max-w-[380px] mx-auto">
              Add your first artist to start monitoring channel health and
              campaign progress across the team.
            </p>
            <AddArtistModalInline team={team.slug} regionTag={team.regionTag} />
          </div>
        </div>
      </main>
    );
  }

  /* ── TWO TABS, AND THE BEHAVIOUR VIEW BEHIND THEM ──────────────────
     The shell owns the page from here down, including the header —
     opening a channel's behaviour replaces the whole board, the way it
     does on ours, rather than hanging a full-width chart underneath a
     board the reader has stopped looking at. */
  return (
    <TeamBoardShell
      header={header}
      allCount={rows.length}
      priorityCount={campaignCards.length}
      rail={campaignCards.map((c) => ({
        slug: c.slug,
        name: c.name,
        thumbnail: c.thumbnail,
        status: c.boardStatus,
      }))}
      allTab={
        <ChannelHealthBoard
          rows={rows}
          linkPrefix={linkPrefix}
          linkSuffix={linkSuffix}
          singleTab
          removable
          team={team.slug}
          pinnedChannelIds={pinnedEntries.map((e) => e.channelId)}
        />
      }
      priorityTab={
        <TeamCampaignCards cards={campaignCards} team={team.slug} />
      }
      emptyPriority={
        <div className="text-center py-16">
          <p className="text-[13px] text-ink/45">Nothing pinned yet.</p>
        </div>
      }
    />
  );
}
