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

      // Collect recent uploads for top videos (managed artists only)
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
  // Analyse the shape of the week
  const totalShorts = managed.reduce((s, c) => s + c.shorts30d, 0);
  const totalLongform = managed.reduce((s, c) => s + c.longform30d, 0);
  const shortsRatio = totalShorts / Math.max(totalShorts + totalLongform, 1);
  const growingCount = signals.growing;
  const issueCount = signals.weakConversion + signals.underfed + signals.cold;
  const topArtist = topVideos.length > 0 ? topVideos[0].channelName : null;

  // Build a narrative lede, not a stat dump
  if (growingCount >= issueCount && growingCount >= 3 && topArtist) {
    if (shortsRatio > 0.55) {
      return `Shorts are the engine this week — driving discovery across the roster while the channels converting that attention into subscribers are the ones building something lasting. ${topArtist} is leading the standout moments, but the real story is in the campaigns sustaining output beyond a single release.`;
    }
    return `A week of building momentum. ${growingCount} channels are in a growth state, and the pattern is clear: the ones posting consistently and mixing formats are the ones the algorithm is rewarding. ${topArtist} is setting the pace, but there's depth developing across the roster.`;
  }

  if (signals.underfed + signals.cold > growingCount) {
    if (topArtist) {
      return `Cadence is the story this week. There's real talent and campaign energy across the roster, but too many channels are going quiet between releases. The strongest moments — like ${topArtist} — show what happens when content keeps flowing. The opportunity is in follow-through.`;
    }
    return `The biggest lever this week is consistency. Several campaigns have strong foundations but are leaving momentum on the table between releases. The channels that are growing share one thing in common: they keep showing up.`;
  }

  if (signals.weakConversion >= 3) {
    return `The attention is there — the conversion isn't yet. Multiple channels are generating real reach this week, but subscriber growth isn't following at the same rate. The gap usually closes with deeper content: artist-led context, longform storytelling, and formats that give viewers a reason to subscribe.`;
  }

  if (shortsRatio > 0.65) {
    return `Shorts are doing the heavy lifting on discovery this week. The question is whether that attention has somewhere to go — channels pairing Shorts with longform and catalogue content are building audiences, while Shorts-only strategies are generating views without the deeper connection.`;
  }

  if (topArtist) {
    return `A mixed week across the roster. There are standout moments — ${topArtist} breaking through — alongside quieter campaigns where cadence and follow-through could shift the trajectory. The common thread among the channels that are growing: they're treating YouTube as an always-on ecosystem, not a release-day platform.`;
  }

  return `Steady week across the roster. The strongest signal remains cadence — channels that post consistently and diversify their content are the ones building real audience depth. Every campaign has a lever to pull.`;
}

function generateInsights(
  channels: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): string[] {
  const insights: string[] = [];

  // ── Narrative 1: The conversion story ──
  // Group conversion + content depth together as one read
  const weakConvChannels = channels.filter(c => c.classification === 'WEAK_CONVERSION');
  const shortHeavy = channels.filter(c => c.shorts30d > 3 && c.longform30d === 0);
  if (weakConvChannels.length >= 2 && shortHeavy.length >= 1) {
    const names = weakConvChannels.slice(0, 2).map(c => c.name).join(' and ');
    insights.push(
      `There's a conversion gap developing across channels like ${names}. Views are landing, but subscriber growth isn't following — often because the content mix leans heavily on Shorts without deeper formats to give viewers a reason to commit. Adding artist-led context, breakdowns, or even short longform can bridge that gap.`
    );
  } else if (weakConvChannels.length >= 2) {
    insights.push(
      `Several channels are generating real reach without converting it into lasting audience. The pattern tends to be the same: the content is reaching people, but there isn't enough depth — BTS, longform, artist-led storytelling — to turn a viewer into a subscriber. That's the gap to close.`
    );
  }

  // ── Narrative 2: The cadence story ──
  // Group low cadence + cold channels as one theme
  const lowCadence = channels.filter(c => c.uploads30d <= 2 && c.status !== 'COLD');
  const coldChannels = channels.filter(c => c.classification === 'COLD');
  if (lowCadence.length >= 2 || coldChannels.length >= 3) {
    const quietNames = lowCadence.slice(0, 2).map(c => c.name);
    const coldNames = coldChannels.slice(0, 2).map(c => c.name);
    const exampleNames = Array.from(new Set([...quietNames, ...coldNames])).slice(0, 2);
    const nameStr = exampleNames.length > 0 ? ` — including ${exampleNames.join(' and ')}` : '';
    insights.push(
      `Cadence remains the most controllable lever across the roster. A number of channels${nameStr} have gone quiet or are posting infrequently during what should be active campaign windows. YouTube's algorithm rewards consistency above almost everything else; even catalogue Shorts or behind-the-scenes clips can keep the signal alive between major releases.`
    );
  }

  // ── Narrative 3: What's actually working ──
  // Only celebrate channels that are genuinely GROWING + have healthy cadence
  // Exclude channels already mentioned negatively (weak conversion, cold, etc.)
  const negativeNames = new Set([
    ...weakConvChannels.map(c => c.slug),
    ...coldChannels.map(c => c.slug),
    ...lowCadence.map(c => c.slug),
    ...shortHeavy.map(c => c.slug),
  ]);
  const genuinelyGrowing = channels.filter(c =>
    c.classification === 'GROWING' &&
    c.uploads30d >= 4 &&
    c.longform30d >= 1 &&           // must have some format depth
    (c.viewsWoW ?? 0) >= 0 &&       // not declining week-over-week
    !negativeNames.has(c.slug)       // not mentioned in a negative narrative
  );
  if (genuinelyGrowing.length >= 2) {
    const momentumNames = genuinelyGrowing.slice(0, 3).map(c => c.name);
    insights.push(
      `The channels showing real momentum this week — ${momentumNames.join(', ')} — share a pattern: they're posting regularly, mixing formats, and building an ecosystem rather than relying on single releases. That's the model YouTube rewards, and it's compounding.`
    );
  } else if (signals.growing >= 2) {
    insights.push(
      `Growth is happening where cadence and content diversity meet. The channels in a growth state this week aren't necessarily the biggest — they're the ones treating YouTube as an ongoing conversation with their audience, not a series of isolated drops.`
    );
  }

  // ── Narrative 4: The format story ──
  // Shorts-to-longform ecosystem health — exclude channels already named above
  const shortsOnlyForNarrative = shortHeavy.filter(c => !negativeNames.has(c.slug) || shortHeavy.length <= 2);
  if (shortsOnlyForNarrative.length >= 2) {
    const names = shortsOnlyForNarrative.slice(0, 2).map(c => c.name).join(' and ');
    insights.push(
      `${names} ${shortsOnlyForNarrative.length > 2 ? 'and others are' : 'are'} building discovery momentum through Shorts, but without longform to support it. Shorts open the door — they bring new viewers in — but it's the deeper content that turns a scroll into a subscribe. Even one longform piece per cycle changes the dynamic.`
    );
  } else if (shortHeavy.length >= 2 && insights.length < 3) {
    // Fallback: use generic copy without names to avoid contradictions
    insights.push(
      `Several channels are building discovery momentum through Shorts, but without longform to support it. Shorts open the door — they bring new viewers in — but it's the deeper content that turns a scroll into a subscribe. Even one longform piece per cycle changes the dynamic.`
    );
  }

  // ── Narrative 5: Follow-through after release ──
  const noFollowUp = channels.filter(c =>
    c.campaignStartDate != null && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 10
  );
  if (noFollowUp.length >= 2 && insights.length < 4) {
    insights.push(
      `A few campaigns have gone quiet after their initial release — the 7 to 10 day window after a drop is when follow-through content matters most. Behind-the-scenes, reaction clips, performance edits, even a simple Shorts remix can extend a release's life on the platform significantly.`
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
