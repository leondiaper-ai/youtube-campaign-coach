import { rankWeeklyVideoGains } from '@/lib/weeklyVideoRanking';
import { getLabelWorkspace } from '@/lib/labels';
import { deepDiveFor } from '@/lib/deepDiveLink';
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
import { bestFormatStack } from '@/lib/formatStack';
import { commentDemand } from '@/lib/commentDemand';
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
  const label = getLabelWorkspace(market.id);
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
  const teamEntries = label ? [] : await listAllTeamEntries(TEAM_SLUGS);
  const teamTagByChannel = new Map(
    teamEntries.map(e => [e.channelId, TEAMS[e.team]?.regionTag ?? e.regionTag]),
  );
  /* Scoped to the market so the Watcher shows this team's roster. Markets
     with a team board get everyone on that board — see marketScope. */
  const allArtists = await getArtistsForMarket(market.id);
  const labelReports = label ? allArtists.flatMap(artist => {
    const report = deepDiveFor(artist.name);
    return report ? [{ artist, report }] : [];
  }).sort((a, b) => a.artist.name.localeCompare(b.artist.name)) : [];
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
      // Directional fallback: use nearby *observed* channel totals when exact
      // weekly anchors are missing. Normalise by elapsed days so an 8-day
      // snapshot interval is not treated as a 7-day interval.
      // Never extrapolate lifetime views or invent a missing baseline.
      let directionalViewsWoW: number | null = null;
      if (viewsWoW == null && history.length >= 3) {
        const valid = history.filter(h => h.views != null && Number.isFinite(h.views));
        const latest = valid[valid.length - 1];
        if (latest) {
          const latestMs = Date.parse(latest.ts);
          const nearest = (days: number) => valid
            .filter(h => h.ts !== latest.ts)
            .map(h => ({ h, gap: Math.abs((latestMs - Date.parse(h.ts)) / 86400000 - days) }))
            .filter(x => x.gap <= 2)
            .sort((a, b) => a.gap - b.gap)[0]?.h;
          const w1 = nearest(7);
          const w2 = nearest(14);
          if (w1 && w2 && w1.ts !== w2.ts) {
            const d1 = (latestMs - Date.parse(w1.ts)) / 86400000;
            const d2 = (Date.parse(w1.ts) - Date.parse(w2.ts)) / 86400000;
            if (d1 >= 5 && d1 <= 9 && d2 >= 5 && d2 <= 9) {
              const currentRate = (latest.views! - w1.views!) / d1;
              const previousRate = (w1.views! - w2.views!) / d2;
              if (currentRate >= 0 && previousRate > 0) {
                directionalViewsWoW = (currentRate / previousRate - 1) * 100;
              }
            }
          }
        }
      }
      const displayedViewsWoW = viewsWoW ?? directionalViewsWoW;

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
        viewsWoW: displayedViewsWoW,
        viewsWoWApprox: viewsWoW == null && directionalViewsWoW != null,
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
        /* Release-level, unlike multiformat above, which is channel-level.
           Both are kept because they answer different questions — see the
           header of formatStack.ts. */
        /* The channel avatar is already on the snap — the campaigns
           sidebar has been using it. No fetch, no extra field to sync. */
        thumbnail: snap?.thumbnail ?? undefined,
        /* Free: commentCount is already on every cached upload. */
        commentDemand: snap?.recentUploads
          ? commentDemand(snap.recentUploads) ?? undefined
          : undefined,
        recentUploadFresh: !!snap && !snap.error && Number.isFinite(Date.parse((snap as typeof snap & { cachedAt?: string }).cachedAt ?? '')) && Date.now() - Date.parse((snap as typeof snap & { cachedAt?: string }).cachedAt ?? '') <= 48 * 3600000,
        formatStack: snap?.recentUploads
          ? bestFormatStack(snap.recentUploads, a.name) ?? undefined
          : undefined,
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
  const topVideos: TopVideo[] = await (async () => {
    const now = Date.now();
    const cutoff = 90 * 86400000; // include established catalogue within cached upload history
    const videos: TopVideo[] = [];

    for (const a of allArtists) {
      // Label boards must only rank artists in that label's monitored roster.
      // Never silently mix in the whole VMG/market roster.
      if (!label && !isVirginOwned(a)) continue;
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      if (!snap?.recentUploads || snap.error) continue;
      // A cached lifetime total is not current performance if the source
      // hasn't refreshed. Hide stale rankings instead of implying live data.
      const fetchedAt = Date.parse((snap as typeof snap & { cachedAt?: string }).cachedAt ?? '');
      if (!Number.isFinite(fetchedAt) || now - fetchedAt > 48 * 3600000) continue;

      for (const u of snap.recentUploads) {
        const ageMs = now - new Date(u.publishedAt).getTime();
        if (ageMs > cutoff || ageMs < 0) continue; // only last 14 days
        const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
        // Average views/day since upload, not a measured last-14-day velocity.
        const velocity = 0; // replaced by measured seven-day change below

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
    return rankWeeklyVideoGains(videos);
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
    { href: '/teams', label: 'Workspaces', match: '/teams' },
    { href: '/resources', label: 'Resources', match: '/resources' },
  ];

  return (
    <main className="min-h-screen bg-paper text-ink">
      <AppHeader
        nav={nav}
        workspace={market.orgName}
        actions={<AddArtistButton market={market.id} />}
        meta={
          syncMeta ? (
            <>
              <div className="tabular-nums">
                Synced {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <div className="tabular-nums">
                {label ? `${rows.filter(r => r.subs != null).length}/${rows.length} tracked channels with data` : `${syncMeta.artistsSuccess}/${syncMeta.artistsTotal} artists`}
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
        <ChannelHealthBoard singleTab={!!label} labelRoster={!!label} linkSuffix={mq} behaviourBase={label ? `/labels/${label.slug}/behaviour` : `/campaigns${mq}`} rows={rows} topVideos={topVideos} marketFormatStats={marketFormatStats} pinnedSlugs={pinnedSlugs} />

        {!label && <div className="mt-14 pt-5 pb-10 border-t border-line flex items-center gap-2 text-micro text-faint">
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
        </div>}
      </div>
    </main>
  );
}
