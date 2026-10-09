import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, daysSince, deriveFromLive,
  STATUS_RANK, classifyArtist, isVirginOwned,
  type Artist, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { getMarketFromRequest } from '@/lib/marketServer';
import { getArtistsForMarket } from '@/lib/marketScope';
import { listAllTeamEntries } from '@/lib/teamWatcherStore';
import { TEAMS, TEAM_SLUGS } from '@/lib/teams';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { listPinned } from '@/lib/campaignStore';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import ChannelHealthBoard, { type RowData, type TopVideo, type MarketFormatStats } from '@/components/ChannelHealthBoard';
import { computeMultiformat } from '@/lib/contentStructure';
import { resolveRowFormatSplit } from '@/lib/formatSplit';
import { readFormatDaysBatch } from '@/lib/formatHistory';
import AddArtistButton from '@/components/AddArtistButton';
import { AppHeader, PageTitle } from '@/components/ui/AppHeader';

export const revalidate = 600;

export const metadata = {
  title: 'Channel Health — YouTube Campaign System',
  description: 'Which channels are growing, flat, or at risk.',
};

export default async function ControlPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const market = await getMarketFromRequest(searchParams);
  /* Every internal link on this page carries the market. The page resolved it
     and then discarded it, which is the most common way a workspace leaks. */
  const mq = market.id === 'uk' ? '' : `?market=${market.id}`;
  const custom = await listCustomArtists();

  /* ── WHO ELSE IS WATCHING ───────────────────────────────────────────
     Artists a regional team adds already arrive here: everything added
     through any board lands in the same `artists:custom` pool, and this
     page reads that pool. What was missing was WHOSE they are — an
     unfamiliar name in the roster with no explanation is a puzzle rather
     than information.

     So each row picks up the tag of the team that added it. Read-only,
     and keyed on channel id so a rename on their side cannot break it. */
  const teamEntries = await listAllTeamEntries(TEAM_SLUGS);
  const teamTagByChannel = new Map(
    teamEntries.map(e => [e.channelId, TEAMS[e.team]?.regionTag ?? e.regionTag]),
  );
  /* Scoped to the market so the Watcher shows this team's roster. Markets
     with a team board get everyone on that board — see marketScope. */
  const allArtists = await getArtistsForMarket(market.id);
  const syncMeta = await readSyncMeta();
  const pinned = await listPinned(market.id);
  const pinnedSlugs = pinned.map((p) => p.slug);

  // Batch-read all cached snaps from KV (zero YouTube API calls)
  const handles = allArtists
    .map((a) => a.channelHandle)
    .filter(Boolean) as string[];
  const snapMap = await readAllLiveSnaps(handles);

  /* ── FORMAT SPLIT, SERVER-SIDE, NO NEW API CALLS ────────────────────
     Everything the split needs is already on this page: recentUploads
     and lifetime views come from the snaps read above. The only extra
     fetch is the stored daily history, batched into one Redis mget so
     the Formats column costs a single round trip for the whole roster
     rather than one per artist. */
  const formatDaysByChannel = await readFormatDaysBatch(
    allArtists
      .map((a) => (a.channelHandle ? snapMap.get(a.channelHandle)?.channelId : null))
      .filter(Boolean) as string[],
  );

  const rows: RowData[] = await Promise.all(
    allArtists.map(async (a) => {
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      const history =
        snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];

      // ── Normalized data layer ───────────────────────────────────────────
      const nc = normalizeChannelData(snap, history);

      // Week-on-week: compare this 7d delta vs previous 7d delta
      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);
      // For WoW we need the raw 14d deltas to derive "previous week"
      const { deltaOver: deltaOverFn } = await import('@/lib/snapshots');
      const subs14Raw = deltaOverFn(history, 14, 'subs');
      const views14Raw = deltaOverFn(history, 14, 'views');
      // Use centralized WoW calculator with proper guards
      const subsWoWResult = computeWoW(nc.subs7d, subs14Raw);
      const viewsWoWResult = computeWoW(nc.views7d, views14Raw);
      const subsWoW = subsWoWResult?.value ?? null;
      const viewsWoW = viewsWoWResult?.value ?? null;

      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7Val,
        views7Delta: views7Val,
      }) : null;
      const status: ChannelState = derived?.status ?? 'COLD';
      const classification = classifyArtist(status, nc.cadence.uploads30d);
      const reason = derived?.reason ?? 'No cached data yet';

      return {
        slug: a.slug,
        name: a.name,
        isVirgin: isVirginOwned(a),
        teamTag: snap?.channelId ? teamTagByChannel.get(snap.channelId) : undefined,
        subs: nc.subs,
        subs7Delta: subs7Val,
        views7Delta: views7Val,
        subsWoW,
        viewsWoW,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        status,
        classification,
        reason,
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
        /* Recent-vs-lifetime decided by the shared resolver, so this
           column can never disagree with the artist strip. */
        formatSplit:
          snap?.recentUploads && snap.channelId
            ? resolveRowFormatSplit(
                snap.recentUploads,
                formatDaysByChannel.get(snap.channelId) ?? [],
                snap.views ?? null,
              ) ?? undefined
            : undefined,
      };
    })
  );

  // ── Top Performing Videos (managed artists, last 14d, ranked by velocity) ──
  const topVideos: TopVideo[] = (() => {
    const now = Date.now();
    const cutoff = 14 * 86400000; // 14 days
    const videos: TopVideo[] = [];

    for (const a of allArtists) {
      if (!isVirginOwned(a)) continue;
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      if (!snap?.recentUploads) continue;

      for (const u of snap.recentUploads) {
        const ageMs = now - new Date(u.publishedAt).getTime();
        if (ageMs > cutoff || ageMs < 0) continue; // only last 14 days
        const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
        const velocity = Math.round(u.viewCount / daysAgo);
        if (velocity < 100) continue; // skip negligible

        videos.push({
          videoId: u.id,
          title: u.title,
          artistName: a.name,
          artistSlug: a.slug,
          views: u.viewCount,
          velocity,
          publishedAt: u.publishedAt,
          daysAgo,
          isShort: u.durationSec <= 62,
        });
      }
    }

    // Return all qualifying videos — component splits into Shorts vs Long-form
    return videos.sort((a, b) => b.velocity - a.velocity);
  })();

  // ── Market Format Stats (long-form vs Shorts across market artists, 30d) ──
  const marketFormatStats: MarketFormatStats = (() => {
    let longformCount = 0;
    let longformViews = 0;
    let shortsCount = 0;
    let shortsViews = 0;
    const activeArtistSlugs = new Set<string>();

    for (const a of allArtists) {
      if (isVirginOwned(a)) continue; // market only
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      if (!snap?.recentUploads) continue;

      let hasUpload = false;
      for (const u of snap.recentUploads) {
        hasUpload = true;
        if (u.durationSec <= 62) {
          shortsCount++;
          shortsViews += u.viewCount;
        } else {
          longformCount++;
          longformViews += u.viewCount;
        }
      }
      if (hasUpload) activeArtistSlugs.add(a.slug);
    }

    return {
      longformCount,
      longformViews,
      shortsCount,
      shortsViews,
      totalUploads: longformCount + shortsCount,
      activeArtists: activeArtistSlugs.size,
    };
  })();

  /* The same four destinations the page already had, in the shared shell
     rather than hand-drawn pills. The market query is still threaded by
     this page, exactly as before. */
  const nav = [
    { href: `/growth${mq}`, label: 'Channel Health', match: '/growth' },
    { href: `/campaigns${mq}`, label: 'Active Campaigns', match: '/campaigns' },
    { href: `/coach${mq}`, label: 'Coach', match: '/coach' },
    { href: '/resources', label: 'Resources', match: '/resources' },
  ];

  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader
        nav={nav}
        workspace={market.orgName}
        actions={<AddArtistButton />}
        meta={
          syncMeta ? (
            <>
              <div className="tabular-nums">
                Synced {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <div className="tabular-nums">
                {syncMeta.artistsSuccess}/{syncMeta.artistsTotal} artists
              </div>
            </>
          ) : (
            <div>No sync data yet</div>
          )
        }
      />

      <div className="max-w-[1180px] mx-auto px-6">
        <PageTitle
          title="Channel Health"
          lede="Which channels are growing, which are converting attention into audience, and which need feeding."
        />

        {/* Client-side board with toggle */}
        <ChannelHealthBoard linkSuffix={mq} behaviourBase={`/campaigns${mq}`} rows={rows} topVideos={topVideos} marketFormatStats={marketFormatStats} pinnedSlugs={pinnedSlugs} />

        <div className="mt-14 pt-5 pb-10 border-t border-line flex items-center gap-2 text-micro text-faint">
          <span className="font-semibold text-muted">Channel Health</span>
          <span aria-hidden>→</span>
          <Link href={`/campaigns${mq}`} className="font-semibold text-muted hover:text-ink no-underline transition-colors">
            Active Campaigns
          </Link>
          <span aria-hidden>→</span>
          <Link href={`/coach${mq}`} className="font-semibold text-muted hover:text-ink no-underline transition-colors">
            Coach
          </Link>
          <span className="ml-auto">Channel Health watches · Campaigns track · Plans direct</span>
        </div>
      </div>
    </main>
  );
}
