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

export async function GET() {
  try {
    // Load all artists (same as /growth page)
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
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
    const videoCutoff = 14 * 86400000; // 14 days for top videos

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

      // Collect recent uploads for top videos (managed artists only)
      if (isVirginOwned(a) && snap?.recentUploads) {
        for (const u of snap.recentUploads) {
          const ageMs = now - new Date(u.publishedAt).getTime();
          if (ageMs > videoCutoff || ageMs < 0) continue;
          const daysAgo = Math.max(1, Math.floor(ageMs / 86400000));
          const velocity = Math.round(u.viewCount / daysAgo);
          if (velocity < 50) continue;

          const fmt = classifyUploadFormat(u);
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
    const topShorts = allRecentVideos.filter(v => v.format === 'Short').slice(0, 24);

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
    const insights = generateInsights(managedChannels, signals, topVideos, topShorts);
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
  const parts: string[] = [];

  // Shorts dominance
  const totalShorts = managed.reduce((s, c) => s + c.shorts30d, 0);
  const totalLongform = managed.reduce((s, c) => s + c.longform30d, 0);
  const shortsRatio = totalShorts / Math.max(totalShorts + totalLongform, 1);

  if (shortsRatio > 0.6) {
    parts.push('Shorts are driving reach this week, but the strongest channels are the ones turning attention into repeat viewing through cadence and longform support');
  } else if (shortsRatio < 0.3 && totalLongform > 0) {
    parts.push('Longform content is leading this week — Shorts could extend discovery further');
  }

  // Growth vs issues
  if (signals.growing > signals.weakConversion + signals.underfed + signals.cold && signals.growing >= 2) {
    parts.push('more channels are growing than struggling — momentum is building');
  } else if (signals.underfed + signals.cold > signals.growing) {
    parts.push('cadence remains the biggest controllable gap across the roster');
  }

  // Conversion signal
  if (signals.weakConversion >= 2) {
    parts.push('several channels are generating reach without converting it into subscriber growth');
  }

  // Market comparison
  const marketAvgUploads = market.length > 0
    ? market.reduce((s, c) => s + c.uploads30d, 0) / market.length
    : 0;
  const managedAvgUploads = managed.length > 0
    ? managed.reduce((s, c) => s + c.uploads30d, 0) / managed.length
    : 0;
  if (market.length > 0 && marketAvgUploads > managedAvgUploads * 1.3) {
    parts.push('market peers are setting a higher baseline for upload consistency');
  }

  // Top video signal
  if (topVideos.length > 0 && topVideos[0].viewCount > 100000) {
    parts.push(`standout moments are breaking through — ${topVideos[0].channelName} leading the way`);
  }

  if (parts.length === 0) {
    return 'Steady week across the roster — consistency remains the strongest lever for long-term growth.';
  }

  const sentence = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
    (parts.length > 1 ? ', ' + parts.slice(1).join(', and ') : '') + '.';
  return sentence;
}

function generateInsights(
  channels: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): string[] {
  const insights: string[] = [];

  if (signals.weakConversion >= 2) {
    insights.push(
      `${signals.weakConversion} channels are generating views but not converting into subscriber growth. Deeper content — BTS, breakdowns, artist-led context — can close the gap.`
    );
  }

  const lowCadence = channels.filter(c => c.uploads30d <= 2 && c.status !== 'COLD');
  if (lowCadence.length >= 2) {
    insights.push(
      `${lowCadence.length} active channels have 2 or fewer uploads in 30 days. Channels with 5+ uploads generally show healthier momentum.`
    );
  }

  const shortHeavy = channels.filter(c => c.shorts30d > 3 && c.longform30d === 0);
  if (shortHeavy.length >= 1) {
    insights.push(
      `${shortHeavy.length} channel${shortHeavy.length > 1 ? 's are' : ' is'} Shorts-heavy with no longform support. Discovery is active, but deeper viewing support is limited.`
    );
  }

  if (signals.cold >= 2) {
    insights.push(
      `${signals.cold} channels are cold — no recent uploads during active campaign windows. Reactivation with catalogue Shorts could restart the algorithm.`
    );
  }

  const noFollowUp = channels.filter(c =>
    c.campaignStartDate != null && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 10
  );
  if (noFollowUp.length >= 1) {
    insights.push(
      `${noFollowUp.length} campaign channel${noFollowUp.length > 1 ? 's have' : ' has'} gone 10+ days without a new upload. Follow-up content in the 7–10 day window after a release keeps momentum alive.`
    );
  }

  if (signals.growing >= 3) {
    insights.push(
      `${signals.growing} channels are in a growth state — consistent cadence and conversion are the common thread.`
    );
  }

  // View momentum
  const bigViewers = channels.filter(c => c.views7d != null && c.views7d > 50000);
  if (bigViewers.length > 0) {
    const names = bigViewers.slice(0, 3).map(c => c.name).join(', ');
    insights.push(
      `Strong view momentum this week from ${names}. These channels are in a discovery window — supporting with Shorts and follow-up content can compound the effect.`
    );
  }

  return insights.slice(0, 5);
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
      `Market benchmark channels average ${marketAvg.toFixed(1)} uploads/30d vs ${managedAvg.toFixed(1)} for managed artists. Global peers are setting a higher consistency baseline.`
    );
  }

  // Best consistency in market
  const consistentMarket = market
    .filter(c => c.uploads30d >= 5)
    .sort((a, b) => b.uploads30d - a.uploads30d);
  if (consistentMarket.length > 0) {
    const names = consistentMarket.slice(0, 3).map(c => c.name).join(', ');
    insights.push(
      `Standout consistency from ${names} — ${consistentMarket[0].uploads30d} uploads in 30 days shows what sustained cadence looks like.`
    );
  }

  // Shorts usage in market
  const marketShortsRatio = market.reduce((s, c) => s + c.shorts30d, 0) /
    Math.max(market.reduce((s, c) => s + c.uploads30d, 0), 1);
  if (marketShortsRatio > 0.4) {
    insights.push(
      `Market peers are leaning heavily into Shorts (${Math.round(marketShortsRatio * 100)}% of uploads). Shorts-first discovery is becoming the norm globally.`
    );
  }

  // Growing market channels
  const growingMarket = market.filter(c => c.classification === 'GROWING');
  if (growingMarket.length > 0) {
    const names = growingMarket.slice(0, 3).map(c => c.name).join(', ');
    insights.push(
      `${growingMarket.length} market channel${growingMarket.length > 1 ? 's' : ''} in growth state: ${names}. Their strategies offer reference points for managed campaigns.`
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
      why: 'YouTube\'s algorithm rewards continued engagement after a release. Channels that go silent after an official video lose 40–60% of their recommendation surface within two weeks.',
      when: 'After any official video, premiere, or major content drop. The window is day 1–10 post-release.',
      actions: [
        'Day 1–3: Release a Short clip from the video (best moment, reaction, behind the scenes)',
        'Day 3–7: Post a BTS or making-of video — even a simple 3-minute studio session works',
        'Day 7–10: Drop a lyric video, visualiser, or acoustic version to keep the track alive in recommendations',
      ],
    };
  }

  if (signals.weakConversion >= 2) {
    return {
      title: 'When Reach Is High But Subs Are Flat',
      why: 'Views prove the content is discoverable. Flat subscribers mean the channel isn\'t giving viewers a reason to come back. The fix is almost always depth, not volume.',
      when: 'When a channel has 3+ uploads in 30 days, strong view counts, but subscriber growth is flat or negative.',
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
      why: 'Shorts generate reach but don\'t build watch time or subscriber loyalty on their own. The ladder bridges Shorts discovery into longform viewing.',
      when: 'When a channel is active with Shorts but hasn\'t released a longform video in 14+ days.',
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
      why: 'Cold channels need volume to restart the algorithm. Repurposing one video into multiple formats is the fastest way to rebuild cadence without new production.',
      when: 'When a channel has been silent for 14+ days and needs to reactivate quickly.',
      actions: [
        'Take the most recent video and extract 2–3 Short clips from the strongest moments',
        'Create a lyric video or visualiser using the same audio with minimal production',
        'Post a simple BTS photo montage or studio session clip to humanise the channel',
      ],
    };
  }

  return {
    title: 'Premiere + Community Post Sequence',
    why: 'Premieres create an event moment that drives simultaneous viewing and live chat engagement. Pairing with a Community Post 24 hours before builds anticipation.',
    when: 'For any major content drop — official videos, documentaries, or longform releases.',
    actions: [
      'Schedule the premiere 48–72 hours in advance to build YouTube\'s recommendation pre-load',
      'Post a Community Post 24 hours before with a teaser image and countdown',
      'Be active in the premiere chat for the first 30 minutes — YouTube\'s algorithm counts creator engagement',
    ],
  };
}
