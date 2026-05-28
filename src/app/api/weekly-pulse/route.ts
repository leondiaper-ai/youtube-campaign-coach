/**
 * GET /api/weekly-pulse
 *
 * Aggregates all data needed for the Weekly Pulse page in one call.
 * Uses the SAME data source as /growth (Channel Health / Watcher):
 *   - Hardcoded ARTISTS + custom artists (merged)
 *   - KV-cached LiveSnaps (zero YouTube API calls)
 *   - Snapshot history for 7d/30d deltas & WoW
 *   - Weekly rollups for trend context
 *   - Sync metadata for freshness
 */

import { NextResponse } from 'next/server';
import {
  ARTISTS,
  mergeArtistLists,
  deriveFromLive,
  classifyArtist,
  isVirginOwned,
  daysSince,
  type Artist,
  type ChannelState,
  type ArtistClassification,
  type RecentUpload,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta, computeWoW } from '@/lib/youtube/normalizeChannelData';
import { listRollups, type WeeklyRollup } from '@/lib/weeklySnapshotStore';
import { classifyUploadFormat, type UploadFormatLabel } from '@/lib/coach/matchEngine';

export const dynamic = 'force-dynamic';

// ── KV helpers (snapshot caching) ────────────────────────────────────────────

async function kv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/** ISO week key, e.g. "weekly-pulse:2026-W22" */
function pulseWeekKey(): string {
  const now = new Date();
  // ISO week calculation
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly-pulse:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Response Types ────────────────────────────────────────────────────────────

type PulseChannel = {
  slug: string;
  name: string;
  isVirgin: boolean;
  channelHandle: string | null;
  // YouTube data
  subs: number | null;
  totalViews: number | null;
  views7d: number | null;
  subs7d: number | null;
  viewsWoW: number | null;
  subsWoW: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  lastUploadAt: string | null;
  lastUploadDaysAgo: number | null;
  thumbnail: string | null;
  // Campaign
  phase: string;
  campaign: string | null;
  campaignStartDate: string | null;
  // Health
  status: ChannelState;
  classification: ArtistClassification;
  reason: string;
  nextAction: string;
  watcherRead: string;
  // Cadence
  cadenceLabel: string;
  // Subs per 1K views (derived from 7d data)
  subsPer1kViews: number | null;
};

type PulseVideo = {
  id: string;
  title: string;
  channelName: string;
  artistSlug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  durationSec: number;
  format: UploadFormatLabel;
  thumbnail: string;
  velocity: number;
  daysAgo: number;
};

type PulseSignals = {
  growing: number;
  weakConversion: number;
  underfed: number;
  cold: number;
  totalManaged: number;
  totalMarket: number;
  total: number;
};

type PulseResponse = {
  weekRange: string;
  generatedAt: string;
  lastSyncAt: string | null;
  signals: PulseSignals;
  managedChannels: PulseChannel[];
  marketChannels: PulseChannel[];
  topVideos: PulseVideo[];
  topShorts: PulseVideo[];
  rollups: WeeklyRollup[];
  editorial: string;
  insights: string[];
  playbook: { title: string; why: string; when: string; actions: string[] };
  marketInsights: string[];
};

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const redis = await kv();
    const weekKey = pulseWeekKey();

    // Check for a cached snapshot for this week (auto-lock on first view)
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (redis && !forceRefresh) {
      const cached = await redis.get<PulseResponse>(weekKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // No cache — generate fresh snapshot
    // Load all artists (same as /growth page)
    const custom = await listCustomArtists();

    // Exclude non-music channels from the Weekly Pulse
    const PULSE_EXCLUDE_NAMES = ['league of legends'];
    const allArtists = mergeArtistLists(ARTISTS, custom)
      .filter(a => {
        const name = a.name.toLowerCase();
        return !PULSE_EXCLUDE_NAMES.some(ex => name.includes(ex));
      });
    const syncMeta = await readSyncMeta();

    // Batch-read all cached snaps from KV (zero YouTube API calls)
    const handles = allArtists
      .map(a => a.channelHandle)
      .filter(Boolean) as string[];
    const snapMap = await readAllLiveSnaps(handles);

    const managedChannels: PulseChannel[] = [];
    const marketChannels: PulseChannel[] = [];
    const allRecentVideos: PulseVideo[] = [];

    const now = Date.now();
    const videoCutoff = 21 * 86400000; // 21 days for top videos

    for (const a of allArtists) {
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      const history = snap?.channelId && !snap.error
        ? await readHistory(snap.channelId)
        : [];

      // Normalized data layer (same as /growth)
      const nc = normalizeChannelData(snap, history);

      const subs7Val = rawDelta(nc.subs7d);
      const views7Val = rawDelta(nc.views7d);

      const subs14Raw = deltaOver(history, 14, 'subs');
      const views14Raw = deltaOver(history, 14, 'views');
      const subsWoWResult = computeWoW(nc.subs7d, subs14Raw);
      const viewsWoWResult = computeWoW(nc.views7d, views14Raw);

      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7Val,
        views7Delta: views7Val,
      }) : null;

      const status: ChannelState = derived?.status ?? 'COLD';
      const classification = classifyArtist(status, nc.cadence.uploads30d);

      // Subs per 1K views
      const subsPer1kViews = views7Val && views7Val > 0 && subs7Val != null
        ? Math.round((subs7Val / views7Val) * 1000 * 10) / 10
        : null;

      const channel: PulseChannel = {
        slug: a.slug,
        name: a.name,
        isVirgin: isVirginOwned(a),
        channelHandle: a.channelHandle ?? null,
        subs: nc.subs,
        totalViews: nc.views,
        views7d: views7Val,
        subs7d: subs7Val,
        viewsWoW: viewsWoWResult?.value ?? null,
        subsWoW: subsWoWResult?.value ?? null,
        uploads30d: nc.cadence.uploads30d,
        shorts30d: nc.cadence.shorts30d,
        longform30d: Math.max(0, nc.cadence.uploads30d - nc.cadence.shorts30d),
        lastUploadAt: snap?.lastUploadAt ?? null,
        lastUploadDaysAgo: daysSince(snap?.lastUploadAt),
        thumbnail: snap?.thumbnail ?? null,
        phase: a.phase,
        campaign: a.campaign ?? null,
        campaignStartDate: a.campaignStartDate ?? null,
        status,
        classification,
        reason: derived?.reason ?? 'No cached data yet',
        nextAction: derived?.nextAction ?? '',
        watcherRead: derived?.watcherRead ?? '',
        cadenceLabel: nc.cadence.cadenceLabel,
        subsPer1kViews,
      };

      if (isVirginOwned(a)) {
        managedChannels.push(channel);
      } else {
        marketChannels.push(channel);
      }

      // Collect recent uploads (Virgin managed only)
      if (isVirginOwned(a) && snap?.recentUploads) {
        for (const u of snap.recentUploads) {
          const ageMs = now - new Date(u.publishedAt).getTime();
          if (ageMs > videoCutoff || ageMs < 0) continue;
          const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
          const velocity = Math.round(u.viewCount / daysAgo);
          const fmt = classifyUploadFormat(u);
          // Longform needs minimum velocity; Shorts always qualify to fill the grid
          if (fmt !== 'Short' && velocity < 20) continue;
          allRecentVideos.push({
            id: u.id,
            title: u.title,
            channelName: a.name,
            artistSlug: a.slug,
            viewCount: u.viewCount,
            likeCount: u.likeCount,
            commentCount: u.commentCount,
            publishedAt: u.publishedAt,
            durationSec: u.durationSec,
            format: fmt,
            thumbnail: `https://i.ytimg.com/vi/${u.id}/mqdefault.jpg`,
            velocity,
            daysAgo,
          });
        }
      }
    }

    // Sort videos by velocity, split into longform + Shorts
    allRecentVideos.sort((a, b) => b.velocity - a.velocity);
    const topVideos = allRecentVideos.filter(v => v.format !== 'Short').slice(0, 8);

    // Diverse shorts: max 2 per artist first pass, then backfill to 24
    const allShortsSorted = allRecentVideos.filter(v => v.format === 'Short');
    const topShorts: PulseVideo[] = [];
    const shortsCount = new Map<string, number>();
    const shortsOverflow: PulseVideo[] = [];
    for (const v of allShortsSorted) {
      const n = shortsCount.get(v.artistSlug) ?? 0;
      if (n < 2) {
        topShorts.push(v);
        shortsCount.set(v.artistSlug, n + 1);
      } else {
        shortsOverflow.push(v);
      }
      if (topShorts.length >= 24) break;
    }
    // Backfill if needed
    for (const v of shortsOverflow) {
      if (topShorts.length >= 24) break;
      topShorts.push(v);
    }

    // Signals (managed only)
    const signals: PulseSignals = {
      growing: managedChannels.filter(c => c.classification === 'GROWING').length,
      weakConversion: managedChannels.filter(c => c.classification === 'WEAK_CONVERSION').length,
      underfed: managedChannels.filter(c => c.classification === 'UNDERFED').length,
      cold: managedChannels.filter(c => c.classification === 'COLD').length,
      totalManaged: managedChannels.length,
      totalMarket: marketChannels.length,
      total: managedChannels.length + marketChannels.length,
    };

    // Weekly rollups
    const rollups = await listRollups(4);

    // Generate content
    const editorial = generateEditorial(managedChannels, marketChannels, signals, topVideos, topShorts);
    const insights = generateInsights(managedChannels, marketChannels, signals, topVideos, topShorts);
    const marketInsights = generateMarketInsights(managedChannels, marketChannels);
    const playbook = generatePlaybook(managedChannels, signals, topVideos, topShorts);

    // Week range
    const nowDate = new Date();
    const weekStart = new Date(nowDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekRange = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const response: PulseResponse = {
      weekRange,
      generatedAt: nowDate.toISOString(),
      lastSyncAt: syncMeta?.lastSyncAt ?? null,
      signals,
      managedChannels,
      marketChannels,
      topVideos,
      topShorts,
      rollups,
      editorial,
      insights,
      playbook,
      marketInsights,
    };

    // Cache this snapshot for the week (expires in 8 days as safety margin)
    if (redis) {
      try {
        await redis.set(weekKey, response, { ex: 8 * 86400 });
      } catch {
        // Cache write failure is non-fatal
      }
    }

    return NextResponse.json(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Insight Generation Engine ─────────────────────────────────────────────────

function generateEditorial(
  managed: PulseChannel[],
  market: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): string {
  // Analyse the shape of the week
  const totalShorts = managed.reduce((s, c) => s + c.shorts30d, 0);
  const totalLongform = managed.reduce((s, c) => s + c.longform30d, 0);
  const shortsRatio = totalShorts / Math.max(totalShorts + totalLongform, 1);
  const growingCount = signals.growing;
  const issueCount = signals.weakConversion + signals.underfed + signals.cold;
  const topArtist = topVideos.length > 0 ? topVideos[0].channelName : null;

  // Build a narrative lede — grounded in observed behaviour
  if (growingCount >= issueCount && growingCount >= 3 && topArtist) {
    if (shortsRatio > 0.55) {
      return `Shorts are driving discovery this week. ${topArtist} leads the standout moments, but the channels converting best are the ones pairing Shorts with deeper formats — BTS, live clips, artist-led context. That's where the audience relationship deepens.`;
    }
    return `${growingCount} channels in a growth state this week. The campaigns posting regularly and mixing formats are the ones seeing the algorithm respond. ${topArtist} is setting the pace, with depth building across the roster.`;
  }

  if (signals.underfed + signals.cold > growingCount) {
    if (topArtist) {
      return `Cadence is becoming the defining signal this week. ${topArtist} shows what sustained content flow looks like. Across the roster, the channels that go quiet between releases see momentum soften quickly — even lightweight follow-through keeps recommendation signals active.`;
    }
    return `Cadence remains the clearest opportunity across the roster. Strong foundations everywhere, but momentum softens quickly between releases. Even lightweight follow-through — catalogue Shorts, archive clips, reactions — helps keep recommendation signals active.`;
  }

  if (signals.weakConversion >= 3) {
    return `Audience growth remains the clearest opportunity across the roster. Discovery is pulling well, but the channels converting best this week are pairing Shorts with deeper formats — BTS, live clips, artist-led context.`;
  }

  if (shortsRatio > 0.65) {
    return `Shorts doing the heavy lifting on discovery this week. The question is where that attention goes next. The channels pairing Shorts with longform and supporting content are building lasting audiences — that's the model working across the roster.`;
  }

  if (topArtist) {
    return `A week of contrasts. ${topArtist} breaking through alongside quieter campaigns where cadence could shift the trajectory. The growing channels share a pattern: they treat YouTube as an always-on ecosystem, not a release-day moment.`;
  }

  return `Steady week across the roster. Consistent output and format diversity remain the strongest signals — the campaigns building audience depth are the ones that keep showing up.`;
}

function generateInsights(
  channels: PulseChannel[],
  market: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): string[] {
  const insights: string[] = [];

  // Market context for cross-referencing
  const marketAvgCadence = market.length > 0
    ? market.reduce((s, c) => s + c.uploads30d, 0) / market.length : 0;
  const managedAvgCadence = channels.length > 0
    ? channels.reduce((s, c) => s + c.uploads30d, 0) / channels.length : 0;
  const marketShortsRatio = market.length > 0
    ? market.reduce((s, c) => s + c.shorts30d, 0) / Math.max(market.reduce((s, c) => s + c.uploads30d, 0), 1) : 0;
  const marketGrowingPct = market.length > 0
    ? market.filter(c => c.classification === 'GROWING').length / market.length : 0;

  // ── Narrative 1: The audience depth story ──
  const weakConvChannels = channels.filter(c => c.classification === 'WEAK_CONVERSION');
  const shortHeavy = channels.filter(c => c.shorts30d > 3 && c.longform30d === 0);
  if (weakConvChannels.length >= 2 && shortHeavy.length >= 1) {
    const names = weakConvChannels.slice(0, 2).map(c => c.name).join(' and ');
    insights.push(
      `Audience growth remains the clearest opportunity across the roster. ${names} are pulling discovery, but the channels converting best this week are pairing Shorts with deeper formats — BTS, live clips, artist-led context.`
    );
  } else if (weakConvChannels.length >= 2) {
    insights.push(
      `Discovery is working well across several channels. The ones converting that reach into lasting audience are adding depth — BTS, longform, artist-led storytelling — rather than relying on Shorts alone.`
    );
  }

  // ── Narrative 2: The cadence story ──
  const lowCadence = channels.filter(c => c.uploads30d <= 2 && c.status !== 'COLD');
  const coldChannels = channels.filter(c => c.classification === 'COLD');
  if (lowCadence.length >= 2 || coldChannels.length >= 3) {
    const quietNames = lowCadence.slice(0, 2).map(c => c.name);
    const coldNames = coldChannels.slice(0, 2).map(c => c.name);
    const exampleNames = Array.from(new Set([...quietNames, ...coldNames])).slice(0, 2);
    const nameStr = exampleNames.length >= 2
      ? `${exampleNames.join(' and ')} both show how quickly momentum softens between releases when channels go quiet`
      : exampleNames.length === 1
        ? `${exampleNames[0]} shows how quickly momentum softens between releases`
        : 'Momentum softens quickly between releases across the roster';
    const cadenceContext = marketAvgCadence > managedAvgCadence * 1.2
      ? ` Market peers averaging ${marketAvgCadence.toFixed(1)} uploads/30d offer a useful reference point.`
      : '';
    insights.push(
      `Cadence is becoming a defining signal. ${nameStr}. Even lightweight follow-through — catalogue Shorts, archive clips, reactions — helps keep recommendation signals active.${cadenceContext}`
    );
  }

  // ── Narrative 3: The strongest ecosystems ──
  // Holistic ecosystem score — any active channel can qualify, not just GROWING
  const earlierMentions = new Set([
    ...weakConvChannels.map(c => c.slug),
    ...coldChannels.map(c => c.slug),
    ...lowCadence.map(c => c.slug),
    ...shortHeavy.map(c => c.slug),
  ]);

  // Ecosystem score: format diversity, cadence, follow-through, efficiency, momentum, scale
  function ecosystemScore(c: PulseChannel): number {
    let score = 0;
    // Format diversity: reward having both shorts AND longform
    const hasShorts = c.shorts30d >= 1;
    const hasLongform = c.longform30d >= 1;
    if (hasShorts && hasLongform) score += 25;
    else if (hasShorts || hasLongform) score += 8;
    // Format depth: more variety = better ecosystem
    score += Math.min(c.shorts30d, 4) * 3;
    score += Math.min(c.longform30d, 3) * 4;
    // Cadence: consistent uploading
    score += Math.min(c.uploads30d, 10) * 2;
    // Recency: active in last 7 days matters
    if ((c.lastUploadDaysAgo ?? 999) <= 7) score += 10;
    // Growth momentum
    if (c.classification === 'GROWING') score += 15;
    const wow = c.viewsWoW ?? 0;
    if (wow > 20) score += 10;
    else if (wow > 0) score += 5;
    // Efficiency: high engagement relative to size
    if ((c.subsPer1kViews ?? 0) >= 2) score += 10;
    else if ((c.subsPer1kViews ?? 0) >= 1) score += 5;
    // Scale factor: meaningful audience, but capped so it doesn't dominate
    const v7d = c.views7d ?? 0;
    if (v7d >= 100000) score += 12;
    else if (v7d >= 20000) score += 8;
    else if (v7d >= 5000) score += 4;
    return score;
  }

  // All channels with real multiformat activity
  const ecosystemCandidates = channels.filter(c =>
    c.uploads30d >= 3 &&
    (c.shorts30d >= 1 || c.longform30d >= 1) &&
    (c.lastUploadDaysAgo ?? 999) <= 14 &&
    !earlierMentions.has(c.slug)
  ).map(c => ({ channel: c, score: ecosystemScore(c) }))
    .sort((a, b) => b.score - a.score);

  // Pick top 2 established + 1 smaller channel doing it right
  const ecoEstablished = ecosystemCandidates.filter(e => (e.channel.views7d ?? 0) >= 10000);
  const ecoEmerging = ecosystemCandidates.filter(e => (e.channel.views7d ?? 0) < 10000 && e.score >= 30);
  const ecoPicks: PulseChannel[] = [];
  for (const e of ecoEstablished) {
    if (ecoPicks.length >= 2) break;
    ecoPicks.push(e.channel);
  }
  // Add 1 emerging channel if available
  if (ecoEmerging.length > 0 && ecoPicks.length >= 1) {
    ecoPicks.push(ecoEmerging[0].channel);
  }
  // Backfill if we don't have 3 yet
  for (const e of ecosystemCandidates) {
    if (ecoPicks.length >= 3) break;
    if (!ecoPicks.includes(e.channel)) ecoPicks.push(e.channel);
  }

  if (ecoPicks.length >= 2) {
    const ecoNames = ecoPicks.map(c => c.name);
    const multiFormatCount = ecoPicks.filter(c => c.shorts30d >= 1 && c.longform30d >= 1).length;
    const ecosystemNote = multiFormatCount >= 2
      ? ' Consistent uploads beyond release day — Shorts, longform and supporting formats working together — continue to outperform single-drop strategies.'
      : ' Regular output and format diversity are compounding week over week.';
    insights.push(
      `The strongest campaign ecosystems this week came from ${ecoNames.join(', ')}.${ecosystemNote}`
    );
  } else if (signals.growing >= 2) {
    insights.push(
      `The channels in a growth state this week aren't the biggest — they're the ones that kept posting after release day. Cadence and format diversity continue to be the clearest differentiators.`
    );
  }

  // ── Narrative 4: Shorts → depth opportunity ──
  const shortsOnlyForNarrative = shortHeavy.filter(c => !earlierMentions.has(c.slug) || shortHeavy.length <= 2);
  if (shortsOnlyForNarrative.length >= 2) {
    const names = shortsOnlyForNarrative.slice(0, 2).map(c => c.name).join(' and ');
    const marketShortsNote = marketShortsRatio > 0.4
      ? ` Across the wider market, ${Math.round(marketShortsRatio * 100)}% of uploads are Shorts — but the channels growing fastest pair that with longform depth.`
      : '';
    insights.push(
      `${names} ${shortsOnlyForNarrative.length > 2 ? 'and others have' : 'have'} real Shorts discovery energy. The channels converting that into audience depth are the ones adding longform — even one deeper piece per cycle shifts the dynamic.${marketShortsNote}`
    );
  } else if (shortHeavy.length >= 2 && insights.length < 3) {
    insights.push(
      `Shorts discovery is strong across several channels. The campaigns bridging that into longform are the ones building deeper audience relationships — one deeper piece per cycle shifts the dynamic.`
    );
  }

  // ── Narrative 5: Follow-through window ──
  const noFollowUp = channels.filter(c =>
    c.campaignStartDate != null && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 10
  );
  if (noFollowUp.length >= 2 && insights.length < 4) {
    insights.push(
      `The clearest roster-wide pattern remains the 7–10 day follow-through window. Campaigns extending momentum are continuing the story after release day — BTS, reaction clips, a Shorts remix — rather than treating the official video as the endpoint.`
    );
  }

  return insights.slice(0, 4);
}

function generateMarketInsights(
  managed: PulseChannel[],
  market: PulseChannel[],
): string[] {
  if (market.length === 0) return [];
  const insights: string[] = [];

  // Cadence comparison
  const marketAvg = market.reduce((s, c) => s + c.uploads30d, 0) / market.length;
  const managedAvg = managed.length > 0
    ? managed.reduce((s, c) => s + c.uploads30d, 0) / managed.length
    : 0;

  if (marketAvg > managedAvg * 1.3 && market.length >= 2) {
    insights.push(
      `Market peers averaging ${marketAvg.toFixed(1)} uploads/30d compared to ${managedAvg.toFixed(1)} across the managed roster. The cadence gap is a useful reference point.`
    );
  }

  // Best consistency in market
  const consistentMarket = market
    .filter(c => c.uploads30d >= 5)
    .sort((a, b) => b.uploads30d - a.uploads30d);
  if (consistentMarket.length > 0) {
    const names = consistentMarket.slice(0, 3).map(c => c.name).join(', ');
    insights.push(
      `${names} at ${consistentMarket[0].uploads30d} uploads in 30 days — showing what sustained cadence looks like at a global level.`
    );
  }

  // Shorts usage in market
  const marketShortsRatio = market.reduce((s, c) => s + c.shorts30d, 0) /
    Math.max(market.reduce((s, c) => s + c.uploads30d, 0), 1);
  if (marketShortsRatio > 0.4) {
    insights.push(
      `Across the wider market, ${Math.round(marketShortsRatio * 100)}% of uploads are Shorts. Shorts-first discovery is the norm — but the channels growing fastest pair it with longform.`
    );
  }

  // Growing market channels
  const growingMarket = market.filter(c => c.classification === 'GROWING');
  if (growingMarket.length > 0) {
    const names = growingMarket.slice(0, 3).map(c => c.name).join(', ');
    insights.push(
      `${growingMarket.length} market channel${growingMarket.length > 1 ? 's' : ''} in a growth state this week — ${names}. Worth watching as reference points.`
    );
  }

  return insights.slice(0, 4);
}

function generatePlaybook(
  channels: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): PulseResponse['playbook'] {
  const activeNoRecent = channels.filter(c =>
    c.campaignStartDate != null && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 7
  );
  if (activeNoRecent.length >= 2) {
    return {
      title: 'The 7–10 Day Follow-Up Window',
      why: 'Channels that sustain uploads after an official video retain recommendation surface significantly longer. The strongest campaigns treat follow-through as part of the rollout, not an afterthought.',
      when: 'Day 1–10 after any official video, premiere, or major drop.',
      actions: [
        'Day 1–3: Release a Short clip from the video (best moment, reaction, behind the scenes)',
        'Day 3–7: Post a BTS or making-of video — even a simple 3-minute studio session works',
        'Day 7–10: Drop a lyric video, visualiser, or acoustic version to keep the track alive in recommendations',
      ],
    };
  }

  if (signals.weakConversion >= 2) {
    return {
      title: 'Turning Discovery Into Audience Depth',
      why: 'Views prove discoverability is working. The next step is giving viewers a reason to subscribe — and that\'s almost always depth and context, not volume.',
      when: '3+ uploads in 30 days with strong views and room to grow subscriber conversion.',
      actions: [
        'Add one artist-led context piece this week — a track breakdown, studio tour, or honest creative diary',
        'Pin a strong subscribe CTA as a comment on the top 3 recent videos',
        'Create a Short that teases upcoming content ("next week we\'re dropping...") to build anticipation',
      ],
    };
  }

  const shortHeavy = channels.filter(c => c.shorts30d > 3 && c.longform30d === 0);
  if (shortHeavy.length >= 1) {
    return {
      title: 'Shorts Ladder Around an Official Video',
      why: 'Shorts generate discovery reach but don\'t build watch time or loyalty alone. The campaigns bridging Shorts into deeper content are the ones building lasting audiences.',
      when: 'Active with Shorts but no longform in 14+ days.',
      actions: [
        'Build a 3-Short teaser sequence leading up to a longform drop (countdown, snippet, BTS)',
        'Release the longform video with a same-day Short that clips the best 15 seconds',
        'Follow up 3–5 days later with a reaction Short or outtake to drive back to the main video',
      ],
    };
  }

  if (signals.cold >= 2) {
    return {
      title: 'Turn One Video Into Five Uploads',
      why: 'Repurposing one video into multiple formats builds the cadence YouTube rewards — without requiring new production. The fastest way to restart a quiet channel.',
      when: 'Catalogue reawakening opportunity — channel ready for fresh content.',
      actions: [
        'Take the most recent video and extract 2–3 Short clips from the strongest moments',
        'Create a lyric video or visualiser using the same audio with minimal production',
        'Post a simple BTS photo montage or studio session clip to humanise the channel',
      ],
    };
  }

  return {
    title: 'Premiere + Community Post Sequence',
    why: 'Premieres drive simultaneous viewing and live chat. A Community Post 24 hours before builds anticipation.',
    when: 'Any major drop — official videos, documentaries, longform releases.',
    actions: [
      'Schedule the premiere 48–72 hours in advance to build YouTube\'s recommendation pre-load',
      'Post a Community Post 24 hours before with a teaser image and countdown',
      'Be active in the premiere chat for the first 30 minutes — YouTube\'s algorithm counts creator engagement',
    ],
  };
}
