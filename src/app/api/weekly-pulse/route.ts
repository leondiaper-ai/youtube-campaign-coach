/**
 * GET /api/weekly-pulse
 *
 * Aggregates all data needed for the Weekly Pulse page in one call:
 * - Team watcher entries with enriched YouTube data
 * - Weekly rollups for trend context
 * - Top-performing videos across all channels this week
 * - Classification counts and signal data
 * - Sync metadata for freshness
 */

import { NextResponse } from 'next/server';
import { listEntries, type TeamWatcherEntry, type CampaignState } from '@/lib/teamWatcherStore';
import { readLiveSnap, type CachedSnap } from '@/lib/kvCache';
import { readSyncMeta } from '@/lib/kvCache';
import {
  deriveFromLive,
  classifyArtist,
  fmtNum,
  daysSince,
  type LiveSnap,
  type Derived,
  type ChannelState,
  type ArtistClassification,
  type RecentUpload,
} from '@/lib/artists';
import { listRollups, type WeeklyRollup } from '@/lib/weeklySnapshotStore';
import { classifyUploadFormat, type UploadFormatLabel } from '@/lib/coach/matchEngine';

export const dynamic = 'force-dynamic';

// ── Response Types ────────────────────────────────────────────────────────────

type PulseChannel = {
  channelId: string;
  artistSlug: string;
  displayName: string;
  campaignName: string;
  campaignState: CampaignState;
  regionTag: string;
  // YouTube data
  subs: number | null;
  views: number | null;
  uploads30d: number;
  shorts30d: number;
  longform30d: number;
  lastUploadAt: string | null;
  lastUploadDaysAgo: number | null;
  thumbnail: string | null;
  // Health
  status: ChannelState | null;
  classification: ArtistClassification | null;
  reason: string;
  nextAction: string;
  watcherRead: string;
  // Notes
  teamNotes: string[];
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
};

type PulseSignals = {
  growing: number;
  weakConversion: number;
  underfed: number;
  cold: number;
  total: number;
};

type PulseResponse = {
  weekRange: string;
  generatedAt: string;
  lastSyncAt: string | null;
  signals: PulseSignals;
  channels: PulseChannel[];
  topVideos: PulseVideo[];
  topShorts: PulseVideo[];
  rollups: WeeklyRollup[];
  editorial: string;
  insights: string[];
  playbook: { title: string; why: string; when: string; actions: string[] };
};

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const entries = await listEntries();

    // Enrich each entry with cached YouTube data
    const enrichedChannels: PulseChannel[] = [];
    const allRecentUploads: (RecentUpload & { channelName: string; artistSlug: string })[] = [];

    await Promise.all(
      entries.map(async (entry) => {
        const snap = await readLiveSnap(entry.channelId);
        const health = snap ? deriveFromLive(snap as LiveSnap) : null;
        const uploads30d = (snap?.uploads30d ?? 0);
        const shorts30d = (snap?.shorts30d ?? 0);

        const channel: PulseChannel = {
          channelId: entry.channelId,
          artistSlug: entry.artistSlug,
          displayName: entry.displayName,
          campaignName: entry.campaignName,
          campaignState: entry.campaignState,
          regionTag: entry.regionTag,
          subs: snap?.subs ?? null,
          views: snap?.views ?? null,
          uploads30d,
          shorts30d,
          longform30d: Math.max(0, uploads30d - shorts30d),
          lastUploadAt: snap?.lastUploadAt ?? null,
          lastUploadDaysAgo: daysSince(snap?.lastUploadAt),
          thumbnail: snap?.thumbnail ?? null,
          status: health?.status ?? null,
          classification: health ? classifyArtist(health.status, uploads30d) : null,
          reason: health?.reason ?? '',
          nextAction: health?.nextAction ?? '',
          watcherRead: health?.watcherRead ?? '',
          teamNotes: entry.teamNotes?.map(n => n.text) ?? [],
        };

        enrichedChannels.push(channel);

        // Collect recent uploads for top videos
        if (snap?.recentUploads) {
          for (const u of snap.recentUploads) {
            // Only include uploads from the last 10 days for "this week" feel
            const age = daysSince(u.publishedAt);
            if (age != null && age <= 10) {
              allRecentUploads.push({
                ...u,
                channelName: entry.displayName,
                artistSlug: entry.artistSlug,
              });
            }
          }
        }
      }),
    );

    // Sort and classify top videos
    const sortedVideos = allRecentUploads.sort((a, b) => b.viewCount - a.viewCount);

    const topVideos: PulseVideo[] = [];
    const topShorts: PulseVideo[] = [];

    for (const u of sortedVideos) {
      const fmt = classifyUploadFormat(u);
      const video: PulseVideo = {
        id: u.id,
        title: u.title,
        channelName: u.channelName,
        artistSlug: u.artistSlug,
        viewCount: u.viewCount,
        likeCount: u.likeCount,
        commentCount: u.commentCount,
        publishedAt: u.publishedAt,
        durationSec: u.durationSec,
        format: fmt,
        thumbnail: `https://i.ytimg.com/vi/${u.id}/mqdefault.jpg`,
      };

      if (fmt === 'Short') {
        if (topShorts.length < 8) topShorts.push(video);
      } else {
        if (topVideos.length < 8) topVideos.push(video);
      }
    }

    // Compute signals
    const signals: PulseSignals = {
      growing: enrichedChannels.filter(c => c.classification === 'GROWING').length,
      weakConversion: enrichedChannels.filter(c => c.classification === 'WEAK_CONVERSION').length,
      underfed: enrichedChannels.filter(c => c.classification === 'UNDERFED').length,
      cold: enrichedChannels.filter(c => c.classification === 'COLD').length,
      total: enrichedChannels.length,
    };

    // Fetch weekly rollups (last 4 weeks for trend)
    const rollups = await listRollups(4);

    // Sync metadata
    const syncMeta = await readSyncMeta();

    // Generate editorial read
    const editorial = generateEditorial(enrichedChannels, signals, topVideos, topShorts);

    // Generate insights
    const insights = generateInsights(enrichedChannels, signals, topVideos, topShorts);

    // Generate playbook
    const playbook = generatePlaybook(enrichedChannels, signals, topVideos, topShorts);

    // Week range
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
    const weekRange = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const response: PulseResponse = {
      weekRange,
      generatedAt: now.toISOString(),
      lastSyncAt: syncMeta?.lastSyncAt ?? null,
      signals,
      channels: enrichedChannels,
      topVideos,
      topShorts,
      rollups,
      editorial,
      insights,
      playbook,
    };

    return NextResponse.json(response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Insight Generation Engine ─────────────────────────────────────────────────

function generateEditorial(
  channels: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): string {
  const parts: string[] = [];

  // Shorts dominance check
  const totalShorts = channels.reduce((s, c) => s + c.shorts30d, 0);
  const totalLongform = channels.reduce((s, c) => s + c.longform30d, 0);
  const shortsRatio = totalShorts / Math.max(totalShorts + totalLongform, 1);

  if (shortsRatio > 0.6) {
    parts.push('Shorts are driving discovery this week');
  }

  // Growth vs issues
  if (signals.growing > signals.weakConversion + signals.underfed + signals.cold) {
    parts.push('more channels are growing than struggling');
  } else if (signals.underfed + signals.cold > signals.growing) {
    parts.push('cadence remains the biggest controllable gap across the roster');
  }

  // Conversion signal
  if (signals.weakConversion >= 2) {
    parts.push('several channels are generating reach without converting it into subscriber growth');
  }

  // Top video signal
  if (topVideos.length > 0) {
    const biggestView = topVideos[0].viewCount;
    if (biggestView > 100000) {
      parts.push(`standout moments are breaking through — ${topVideos[0].channelName} leading the way`);
    }
  }

  if (parts.length === 0) {
    return 'Steady week across the roster — consistency remains the strongest lever for long-term growth.';
  }

  // Capitalize first part, join with commas, end with period
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

  // Conversion insight
  if (signals.weakConversion >= 2) {
    insights.push(
      `${signals.weakConversion} channels are generating views but not converting into subscriber growth. Deeper content — BTS, breakdowns, artist-led context — can close the gap.`
    );
  }

  // Cadence insight
  const lowCadence = channels.filter(c => c.uploads30d <= 2 && c.status !== 'COLD');
  if (lowCadence.length >= 2) {
    insights.push(
      `${lowCadence.length} active channels have 2 or fewer uploads in 30 days. Channels with 5+ uploads generally show healthier momentum.`
    );
  }

  // Shorts vs longform balance
  const shortHeavy = channels.filter(c => c.shorts30d > 3 && c.longform30d === 0);
  if (shortHeavy.length >= 1) {
    insights.push(
      `${shortHeavy.length} channel${shortHeavy.length > 1 ? 's are' : ' is'} Shorts-heavy with no longform support. Discovery is active, but deeper viewing support is limited.`
    );
  }

  // Cold channels
  if (signals.cold >= 2) {
    insights.push(
      `${signals.cold} channels are cold — no recent uploads during active campaign windows. Reactivation with catalogue Shorts could restart the algorithm.`
    );
  }

  // Follow-up gap
  const noFollowUp = channels.filter(c => {
    return c.campaignState === 'Active' && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 10;
  });
  if (noFollowUp.length >= 1) {
    insights.push(
      `${noFollowUp.length} active campaign${noFollowUp.length > 1 ? 's have' : ' has'} gone 10+ days without a new upload. Follow-up content in the 7–10 day window after a release keeps momentum alive.`
    );
  }

  // Growing channels success
  if (signals.growing >= 3) {
    insights.push(
      `${signals.growing} channels are in a growth state — consistent cadence and conversion are the common thread.`
    );
  }

  return insights.slice(0, 5);
}

function generatePlaybook(
  channels: PulseChannel[],
  signals: PulseSignals,
  topVideos: PulseVideo[],
  topShorts: PulseVideo[],
): PulseResponse['playbook'] {
  // Choose playbook based on strongest pattern

  // Pattern: many channels with follow-up gaps
  const activeNoRecent = channels.filter(c =>
    c.campaignState === 'Active' && c.lastUploadDaysAgo != null && c.lastUploadDaysAgo > 7
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

  // Pattern: weak conversion
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

  // Pattern: Shorts-heavy, no longform
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

  // Pattern: cold channels
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

  // Default
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
