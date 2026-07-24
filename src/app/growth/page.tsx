import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, daysSince, deriveFromLive,
  STATUS_RANK, classifyArtist, isVirginOwned,
  type Artist, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import ChannelHealthBoard, { type RowData, type TopVideo, type MarketFormatStats } from '@/components/ChannelHealthBoard';
import { computeMultiformat } from '@/lib/contentStructure';
import AddArtistButton from '@/components/AddArtistButton';

export const revalidate = 600;

export const metadata = {
  title: 'Channel Health — YouTube Campaign System',
  description: 'Which channels are growing, flat, or at risk.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';

export default async function ControlPage() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const syncMeta = await readSyncMeta();

  // Batch-read all cached snaps from KV (zero YouTube API calls)
  const handles = allArtists
    .map((a) => a.channelHandle)
    .filter(Boolean) as string[];
  const snapMap = await readAllLiveSnaps(handles);

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

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
              YouTube Campaign System
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span
                className="px-3 py-1.5 rounded-md text-[13px] font-black"
                style={{ background: SOFT }}
              >
                Channel Health
              </span>
              <Link
                href="/campaigns"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                Active Campaigns
              </Link>
              <Link
                href="/coach"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                Coach
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 mt-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 text-right">
              {syncMeta ? (
                <>
                  <span>Last sync: {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <br />
                  <span className="text-ink/20">{syncMeta.artistsSuccess}/{syncMeta.artistsTotal} artists · from cache</span>
                </>
              ) : (
                <span>No sync data yet</span>
              )}
            </span>
            <AddArtistButton />
          </div>
        </div>

        {/* Client-side board with toggle */}
        <ChannelHealthBoard rows={rows} topVideos={topVideos} marketFormatStats={marketFormatStats} />

        {/* Navigation flow */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px]">
          <span className="font-black text-ink/60 px-3 py-1.5 rounded-md" style={{ background: SOFT }}>
            Channel Health
          </span>
          <span className="text-ink/25">→</span>
          <Link href="/campaigns" className="font-bold text-ink/40 hover:text-ink/70 px-3 py-1.5 rounded-md hover:bg-[#F6F1E7] transition-colors">
            Active Campaigns
          </Link>
          <span className="text-ink/25">→</span>
          <Link href="/coach" className="font-bold text-ink/40 hover:text-ink/70 px-3 py-1.5 rounded-md hover:bg-[#F6F1E7] transition-colors">
            Coach
          </Link>
        </div>

        <div className="mt-8 text-[10px] uppercase tracking-[0.18em] text-ink/25">
          Channel Health watches · Campaigns track · Plans direct
        </div>
      </div>
    </main>
  );
}
