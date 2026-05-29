import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, daysSince, deriveFromLive,
  STATUS_RANK, classifyArtist, isVirginOwned,
  type Artist, type ChannelState, type RecentUpload,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import ChannelHealthBoard, { type RowData, type TopVideo, type MarketFormatStats } from '@/components/ChannelHealthBoard';
import { computeMultiformat } from '@/lib/contentStructure';
import { listPlans, loadPlan, type SavedPlan } from '@/lib/planStore';
import type { ParsedEvent } from '@/lib/planEngine';
import { calculateChannelScore, computeBenchmarkPool, type ChannelScoreInput } from '@/lib/channelScore';
import { classifyUploadFormat } from '@/lib/coach/matchEngine';
import type { SpotlightChannel, SpotlightVideo } from '@/components/WeeklySpotlight';

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

  // ── Weekly Channel Spotlight (top 2–5 Virgin-managed channels) ──────────
  const spotlightChannels: SpotlightChannel[] = await (async () => {
    const managed = allArtists.filter((a) => isVirginOwned(a));
    const managedRows = rows.filter((r) => r.isVirgin);
    if (managedRows.length === 0) return [];

    // Score using existing channel score system
    const inputs: ChannelScoreInput[] = managedRows.map((r) => ({
      views7Delta: r.views7Delta,
      subs7Delta: r.subs7Delta,
      uploads30d: r.uploads30d,
      shorts30d: r.shorts30d,
      lastUploadAt: null,
      subs: r.subs,
      totalViews: r.totalViews ?? null,
      prevViews7Delta: null,
      movementConfidence: r.movementConfidence,
    }));
    const pool = computeBenchmarkPool(inputs);
    const scored = managedRows.map((r, i) => ({
      row: r,
      score: calculateChannelScore(inputs[i], pool),
    }));

    // Composite spotlight score: channel score + bonus for growth + multiformat + cadence
    const withComposite = scored.map(({ row, score }) => {
      let composite = score.totalPoints * 10; // 0–60 base
      if (row.classification === 'GROWING') composite += 30;
      if (row.status === 'HEALTHY') composite += 20;
      if (row.multiformat?.score === 'Strong') composite += 20;
      else if (row.multiformat?.score === 'Good') composite += 12;
      if (row.uploads30d >= 8) composite += 15;
      else if (row.uploads30d >= 4) composite += 8;
      if ((row.subs7Delta ?? 0) > 0) composite += 10;
      if (score.grade === 'A') composite += 25;
      else if (score.grade === 'B') composite += 12;
      if (row.viewsWoW != null && row.viewsWoW > 0) composite += 5;
      // Penalise stale/cold
      if (row.movementConfidence === 'stale') composite -= 20;
      if (row.status === 'COLD') composite -= 30;
      if (row.uploads30d === 0) composite -= 25;
      return { row, score, composite };
    });

    // Sort by composite, take top 5 (minimum composite > 30 to qualify)
    const top = withComposite
      .filter((c) => c.composite > 30)
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 5);

    // Load coach plans for matching
    const planIndex = await listPlans();
    const norm = (s: string) => s.replace(/-/g, '');
    const coachPlans = new Map<string, SavedPlan>();
    for (const entry of planIndex) {
      const planNorm = norm(entry.slug);
      for (const { row } of top) {
        const artistNorm = norm(row.slug);
        if (planNorm.startsWith(artistNorm) || artistNorm.startsWith(planNorm)) {
          if (!coachPlans.has(row.slug)) {
            const plan = await loadPlan(entry.slug);
            if (plan) coachPlans.set(row.slug, plan);
          }
        }
      }
    }

    // Clean event title helper
    const cleanTitle = (t: string) =>
      t.replace(/^[,\s]*\d{4}\s*[–—-]\s*/, '').replace(/^[,\s]+/, '').trim();

    // Event priority scoring (reused from partner briefing logic)
    const eventPriority = (kind: string, title: string): number => {
      const t = title.toLowerCase();
      if (kind === 'albumRelease' || kind === 'albumAnnounce') return 100;
      if (kind === 'singleRelease') return 100;
      if (kind === 'documentaryRelease') return 100;
      if (/\bofficial\s*(music\s*)?video\b/.test(t)) return 100;
      if (/\blongform\b/.test(t)) return 100;
      if (kind === 'documentaryTease') return 80;
      if (/\btrailer\b/.test(t)) return 80;
      if (/\b(bts|behind\s*the\s*scenes)\b/.test(t)) return 80;
      if (/\bvisuali[sz]er\b/.test(t)) return 80;
      if (/\blyric\s*video\b/.test(t)) return 80;
      if (/\b(live\s*session|acoustic|performance\s*video)\b/.test(t)) return 80;
      if (/\bpremiere\b/.test(t)) return 80;
      if (kind === 'collab') return 60;
      if (kind === 'snippet') return 60;
      if (/\b(community|shorts|fan\s*content|reaction)\b/.test(t)) return 60;
      if (kind === 'festival' || kind === 'tourDate' || kind === 'liveShow' || kind === 'tourAnnounce') return 30;
      if (kind === 'promoTrip' || kind === 'podcast') return 30;
      if (/\b(radio|press|interview)\b/.test(t)) return 30;
      return 60;
    };

    const now = Date.now();
    return top.map(({ row, score, composite }) => {
      const artist = managed.find((a) => a.slug === row.slug);
      const snap = artist?.channelHandle ? (snapMap.get(artist.channelHandle) ?? null) : null;
      const longform30d = row.uploads30d - row.shorts30d;

      // Recent videos — top 5 by velocity from last 14d
      const recentVideos: SpotlightVideo[] = [];
      if (snap?.recentUploads) {
        const cutoff = 14 * 86400000;
        for (const u of snap.recentUploads) {
          const ageMs = now - new Date(u.publishedAt).getTime();
          if (ageMs > cutoff || ageMs < 0) continue;
          const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
          const velocity = Math.round(u.viewCount / daysAgo);
          if (velocity < 50) continue;
          const isShort = u.durationSec <= 62;
          let format = 'Upload';
          try { format = classifyUploadFormat(u); } catch { /* fallback */ }
          recentVideos.push({
            id: u.id,
            title: u.title,
            views: u.viewCount,
            velocity,
            daysAgo,
            format: typeof format === 'string' ? format : 'Upload',
            isShort,
          });
        }
        recentVideos.sort((a, b) => b.velocity - a.velocity);
        recentVideos.splice(5);
      }

      // Coach plan moments
      const coachPlan = coachPlans.get(row.slug);
      let currentMoment: string | null = null;
      let nextMoment: string | null = null;
      let upcomingMoment: string | null = null;
      if (coachPlan?.plan?.events) {
        const enriched = coachPlan.plan.events.map((e: ParsedEvent) => {
          const d = new Date(e.dateISO + 'T00:00:00');
          const diff = Math.round((d.getTime() - now) / 86400000);
          const title = cleanTitle(e.title);
          return { ...e, title, diff, priority: eventPriority(e.kind, title) };
        });
        const upcoming = enriched
          .filter((e) => e.diff >= -7)
          .sort((a, b) => b.priority - a.priority || a.diff - b.diff);
        const hasHigh = upcoming.some((e) => e.priority >= 60);
        const filtered = hasHigh ? upcoming.filter((e) => e.priority >= 60) : upcoming;
        if (filtered.length > 0) currentMoment = filtered[0].title;
        if (filtered.length > 1) nextMoment = filtered[1].title;
        if (filtered.length > 2) upcomingMoment = filtered[2].title;
      }

      // Conversion rate
      const subsPer1kViews =
        row.views7Delta != null && row.views7Delta > 0 && row.subs7Delta != null
          ? (row.subs7Delta / row.views7Delta) * 1000
          : null;

      // Ecosystem signal
      let ecosystemSignal = 'Getting Started';
      if (row.multiformat?.score === 'Strong' || row.multiformat?.score === 'Good') {
        ecosystemSignal = row.shorts30d > 0 && longform30d > 0 ? 'Full Ecosystem' : 'Multi-Format Active';
      } else if (row.shorts30d > 0 && longform30d === 0) {
        ecosystemSignal = 'Shorts Momentum';
      } else if (longform30d > 0 && row.shorts30d === 0) {
        ecosystemSignal = 'Multi-Format Active';
      }

      // Auto-generate "what's working" notes
      const whatsWorking: string[] = [];
      if (row.classification === 'GROWING') {
        whatsWorking.push('Channel classified as GROWING — positive momentum across cadence and conversion.');
      }
      if (ecosystemSignal === 'Full Ecosystem') {
        whatsWorking.push(`Multi-format strategy active: ${row.shorts30d} Shorts + ${longform30d} longform in 30 days. Shorts driving discovery, longform building depth.`);
      } else if (row.shorts30d > 0 && longform30d > 0) {
        whatsWorking.push(`Multi-format mix: ${row.shorts30d} Shorts + ${longform30d} longform in 30 days.`);
      }
      if (subsPer1kViews != null && subsPer1kViews >= 3) {
        whatsWorking.push(`Strong conversion at ${subsPer1kViews.toFixed(1)} subs per 1K views — audience is subscribing.`);
      }
      if (recentVideos.length > 0 && recentVideos[0].velocity >= 3000) {
        const top = recentVideos[0];
        whatsWorking.push(`Top content: "${top.title}" averaging ${Math.round(top.velocity).toLocaleString()} views/day.`);
      }
      // Follow-through detection: official video + supporting content within 10 days
      if (recentVideos.length >= 2) {
        const hasOfficial = recentVideos.some((v) =>
          /official|music video/i.test(v.format) || /official/i.test(v.title)
        );
        const hasSupport = recentVideos.some((v) =>
          v.isShort || /live|session|bts|behind/i.test(v.format) || /visuali|lyric/i.test(v.format)
        );
        if (hasOfficial && hasSupport) {
          whatsWorking.push('Follow-through content active — official video supported by additional uploads keeping recommendations alive.');
        }
      }
      if (row.uploads30d >= 8) {
        whatsWorking.push(`Strong upload cadence of ${row.uploads30d} uploads in 30 days — well above roster average.`);
      }

      // Headline
      const statusLabel = row.classification === 'GROWING' ? 'GROWING' : row.status;
      let headline = `${statusLabel} status with ${ecosystemSignal.toLowerCase()} signal. `;
      if (row.uploads30d >= 8 && (row.subs7Delta ?? 0) > 0) {
        headline += 'Strong execution across cadence, format diversity, and audience conversion.';
      } else if (row.uploads30d >= 4 && ecosystemSignal === 'Full Ecosystem') {
        headline += 'Multi-format content strategy building sustainable momentum.';
      } else if ((row.subs7Delta ?? 0) > 0) {
        headline += 'Converting viewers into subscribers — positive trajectory.';
      } else {
        headline += 'Active channel with room to accelerate cadence and conversion.';
      }

      return {
        slug: row.slug,
        name: row.name,
        subs: row.subs,
        subs7d: row.subs7Delta,
        views7d: row.views7Delta,
        viewsWoW: row.viewsWoW,
        subsPer1kViews,
        uploads30d: row.uploads30d,
        shorts30d: row.shorts30d,
        longform30d,
        status: row.status,
        classification: row.classification,
        multiformatScore: row.multiformat?.score ?? null,
        ecosystemSignal,
        headline,
        whatsWorking,
        recentVideos,
        hasCoachPlan: !!coachPlan,
        currentMoment,
        nextMoment,
        upcomingMoment,
        grade: score.grade,
        scoreLabel: score.label,
        spotlightScore: composite,
      };
    });
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
                href="/cockpit"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                All Artists
              </Link>
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
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 mt-2 text-right">
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
        </div>

        {/* Client-side board with toggle */}
        <ChannelHealthBoard rows={rows} topVideos={topVideos} marketFormatStats={marketFormatStats} spotlightChannels={spotlightChannels} />

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
