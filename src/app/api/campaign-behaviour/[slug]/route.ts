/**
 * Campaign Behaviour API
 *
 * Assembles the complete data package for the Campaign Behaviour View:
 *   - View velocity series (daily gains + 7-day rolling average)
 *   - Subscriber gains series
 *   - Classified upload timeline
 *   - Content gaps (all-content and long-form-only)
 *   - Campaign/release milestones
 *   - Format performance breakdown
 *   - Deterministic campaign learnings (max 3)
 *   - Upload-specific observation windows (on demand via ?upload=videoId)
 *
 * Uses existing KV data — zero additional YouTube API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists } from '@/lib/artists';
import type { RecentUpload } from '@/lib/artists';
import { readLiveSnap, readLiveSnapByHandle } from '@/lib/kvCache';
import { readHistory, type ChannelSnapshot } from '@/lib/snapshots';
import { readChannelMapping } from '@/lib/kvCache';
import { listCustomArtists } from '@/lib/artistStore';
import { CAMPAIGN_CONFIGS } from '@/lib/campaignConfig';
import {
  classifyUploads,
  classifyUploadFormat,
  getFormatMeta,
  type ClassifiedUpload,
  type UploadFormat,
  type FormatMeta,
} from '@/lib/formatClassifier';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────

type VelocityPoint = {
  date: string;           // ISO date yyyy-mm-dd
  dailyViewGain: number | null;
  rollingAvg7d: number | null;
};

type SubsPoint = {
  date: string;
  dailySubGain: number | null;
  rollingAvg7d: number | null;
};

type ContentGap = {
  startDate: string;
  endDate: string;
  durationDays: number;
  type: 'all_content' | 'longform_only';
};

type Milestone = {
  date: string;
  label: string;
  type: 'campaign_start' | 'single' | 'album' | 'ep' | 'milestone';
};

type FormatBreakdown = {
  format: UploadFormat;
  meta: FormatMeta;
  count: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  recentDirection: 'accelerating' | 'stable' | 'declining' | 'insufficient';
};

type UploadObservation = {
  uploadId: string;
  title: string;
  format: UploadFormat;
  publishedAt: string;
  viewsBefore7d: number | null;
  viewsAfter7d: number | null;
  subsBefore7d: number | null;
  subsAfter7d: number | null;
  viewVelocityChange: number | null;    // percentage
  subsVelocityChange: number | null;    // percentage
  nextUpload: { title: string; format: UploadFormat; daysAfter: number } | null;
  nextLongform: { title: string; format: UploadFormat; daysAfter: number } | null;
  observation: string;
};

type Learning = {
  text: string;
  evidence: string;
  confidence: 'observation' | 'pattern' | 'strong';
};

type CampaignBehaviourResponse = {
  artist: { slug: string; name: string; channelState?: string };
  observationWindow: { startDate: string; endDate: string; days: number; label: string };
  viewVelocity: VelocityPoint[];
  subscriberGains: SubsPoint[];
  uploads: ClassifiedUpload[];
  gaps: ContentGap[];
  milestones: Milestone[];
  formatBreakdown: FormatBreakdown[];
  learnings: Learning[];
  uploadObservation: UploadObservation | null;
  lastUpdated: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function computeVelocity(history: ChannelSnapshot[], startDate: string): VelocityPoint[] {
  const startTs = new Date(startDate).getTime();
  const filtered = history.filter(
    (h) => new Date(h.ts).getTime() >= startTs && h.views != null
  );

  if (filtered.length < 2) return [];

  // Compute daily gains
  const dailyGains: VelocityPoint[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    if (prev.views == null || curr.views == null) {
      dailyGains.push({ date: curr.ts, dailyViewGain: null, rollingAvg7d: null });
      continue;
    }
    const gain = curr.views - prev.views;
    // Guard against negative gains (can happen if YouTube adjusts view counts)
    dailyGains.push({
      date: curr.ts,
      dailyViewGain: gain >= 0 ? gain : null,
      rollingAvg7d: null,
    });
  }

  // Compute 7-day rolling average
  for (let i = 0; i < dailyGains.length; i++) {
    const windowStart = Math.max(0, i - 6);
    const window = dailyGains.slice(windowStart, i + 1);
    const validGains = window
      .map((p) => p.dailyViewGain)
      .filter((g): g is number => g != null);
    if (validGains.length >= 3) {
      dailyGains[i].rollingAvg7d = Math.round(
        validGains.reduce((sum, g) => sum + g, 0) / validGains.length
      );
    }
  }

  return dailyGains;
}

function computeSubsGains(history: ChannelSnapshot[], startDate: string): SubsPoint[] {
  const startTs = new Date(startDate).getTime();
  const filtered = history.filter(
    (h) => new Date(h.ts).getTime() >= startTs && h.subs != null
  );

  if (filtered.length < 2) return [];

  const dailyGains: SubsPoint[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    if (prev.subs == null || curr.subs == null) {
      dailyGains.push({ date: curr.ts, dailySubGain: null, rollingAvg7d: null });
      continue;
    }
    dailyGains.push({
      date: curr.ts,
      dailySubGain: curr.subs - prev.subs,
      rollingAvg7d: null,
    });
  }

  // 7-day rolling average
  for (let i = 0; i < dailyGains.length; i++) {
    const windowStart = Math.max(0, i - 6);
    const window = dailyGains.slice(windowStart, i + 1);
    const valid = window
      .map((p) => p.dailySubGain)
      .filter((g): g is number => g != null);
    if (valid.length >= 3) {
      dailyGains[i].rollingAvg7d = Math.round(
        valid.reduce((sum, g) => sum + g, 0) / valid.length
      );
    }
  }

  return dailyGains;
}

function detectGaps(uploads: ClassifiedUpload[]): ContentGap[] {
  if (uploads.length < 2) return [];

  const gaps: ContentGap[] = [];

  // All-content gaps (≥7 days between any uploads)
  for (let i = 1; i < uploads.length; i++) {
    const prevDate = new Date(uploads[i - 1].publishedAt).getTime();
    const currDate = new Date(uploads[i].publishedAt).getTime();
    const daysBetween = Math.round((currDate - prevDate) / 86400000);
    if (daysBetween >= 7) {
      gaps.push({
        startDate: uploads[i - 1].publishedAt.slice(0, 10),
        endDate: uploads[i].publishedAt.slice(0, 10),
        durationDays: daysBetween,
        type: 'all_content',
      });
    }
  }

  // Long-form-only gaps (≥14 days between consecutive long-form uploads)
  const longformUploads = uploads.filter((u) => u.formatMeta.isLongform);
  for (let i = 1; i < longformUploads.length; i++) {
    const prevDate = new Date(longformUploads[i - 1].publishedAt).getTime();
    const currDate = new Date(longformUploads[i].publishedAt).getTime();
    const daysBetween = Math.round((currDate - prevDate) / 86400000);
    if (daysBetween >= 14) {
      // Only add if not already covered by an all-content gap
      const alreadyCovered = gaps.some(
        (g) =>
          g.type === 'all_content' &&
          g.startDate === longformUploads[i - 1].publishedAt.slice(0, 10) &&
          g.endDate === longformUploads[i].publishedAt.slice(0, 10)
      );
      if (!alreadyCovered) {
        gaps.push({
          startDate: longformUploads[i - 1].publishedAt.slice(0, 10),
          endDate: longformUploads[i].publishedAt.slice(0, 10),
          durationDays: daysBetween,
          type: 'longform_only',
        });
      }
    }
  }

  return gaps.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function buildMilestones(
  artist: { campaignStartDate?: string; campaign?: string },
  slug: string,
): Milestone[] {
  const milestones: Milestone[] = [];

  // Campaign start date
  if (artist.campaignStartDate) {
    milestones.push({
      date: artist.campaignStartDate,
      label: artist.campaign ? `${artist.campaign} — Campaign Start` : 'Campaign Start',
      type: 'campaign_start',
    });
  }

  // Known releases and milestones from CampaignConfig
  const config = CAMPAIGN_CONFIGS[slug];
  if (config) {
    for (const release of config.knownReleases ?? []) {
      if (release.dateISO) {
        milestones.push({
          date: release.dateISO,
          label: release.title,
          type: release.type === 'album'
            ? 'album'
            : release.type === 'ep'
              ? 'ep'
              : 'single',
        });
      }
    }
    for (const m of config.campaignMilestones ?? []) {
      if (m.dateISO) {
        milestones.push({
          date: m.dateISO,
          label: m.label,
          type: 'milestone',
        });
      }
    }
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}

function computeFormatBreakdown(uploads: ClassifiedUpload[]): FormatBreakdown[] {
  const groups = new Map<UploadFormat, ClassifiedUpload[]>();
  for (const u of uploads) {
    const list = groups.get(u.format) ?? [];
    list.push(u);
    groups.set(u.format, list);
  }

  const breakdowns: FormatBreakdown[] = [];
  groups.forEach((items: ClassifiedUpload[], format: UploadFormat) => {
    const views = items.map((u: ClassifiedUpload) => u.viewCount);
    const sorted = [...views].sort((a: number, b: number) => a - b);
    const totalViews = views.reduce((s: number, v: number) => s + v, 0);
    const avgViews = Math.round(totalViews / items.length);
    const medianViews = sorted[Math.floor(sorted.length / 2)] ?? 0;

    // Recent direction: compare last 3 vs first 3 average views (if enough data)
    let recentDirection: FormatBreakdown['recentDirection'] = 'insufficient';
    if (items.length >= 4) {
      const first3Avg = items.slice(0, 3).reduce((s: number, u: ClassifiedUpload) => s + u.viewCount, 0) / 3;
      const last3Avg = items.slice(-3).reduce((s: number, u: ClassifiedUpload) => s + u.viewCount, 0) / 3;
      if (first3Avg > 0) {
        const changePct = (last3Avg - first3Avg) / first3Avg;
        if (changePct > 0.15) recentDirection = 'accelerating';
        else if (changePct < -0.15) recentDirection = 'declining';
        else recentDirection = 'stable';
      }
    }

    breakdowns.push({
      format,
      meta: getFormatMeta(format),
      count: items.length,
      totalViews,
      avgViews,
      medianViews,
      recentDirection,
    });
  });

  // Sort by total views descending
  return breakdowns.sort((a, b) => b.totalViews - a.totalViews);
}

function computeUploadObservation(
  uploadId: string,
  uploads: ClassifiedUpload[],
  history: ChannelSnapshot[],
): UploadObservation | null {
  const upload = uploads.find((u) => u.id === uploadId);
  if (!upload) return null;

  const uploadTs = new Date(upload.publishedAt).getTime();
  const uploadDate = upload.publishedAt.slice(0, 10);

  // Find snapshots for 7 days before and after
  const dayMs = 86400000;
  const before7Start = uploadTs - 7 * dayMs;
  const after7End = uploadTs + 7 * dayMs;

  const snapsBeforeWindow = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts >= before7Start && ts < uploadTs && h.views != null;
  });
  const snapsAfterWindow = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after7End && h.views != null;
  });

  // Views gained in 7 days before/after
  let viewsBefore7d: number | null = null;
  if (snapsBeforeWindow.length >= 2) {
    const first = snapsBeforeWindow[0];
    const last = snapsBeforeWindow[snapsBeforeWindow.length - 1];
    if (first.views != null && last.views != null) {
      viewsBefore7d = last.views - first.views;
    }
  }

  let viewsAfter7d: number | null = null;
  // Use upload-day snapshot as baseline for "after"
  const uploadDaySnap = history.find((h) => h.ts === uploadDate && h.views != null);
  if (uploadDaySnap && snapsAfterWindow.length >= 1) {
    const lastAfter = snapsAfterWindow[snapsAfterWindow.length - 1];
    if (uploadDaySnap.views != null && lastAfter.views != null) {
      viewsAfter7d = lastAfter.views - uploadDaySnap.views;
    }
  }

  // Same for subscribers
  const subsBefore = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts >= before7Start && ts < uploadTs && h.subs != null;
  });
  const subsAfter = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after7End && h.subs != null;
  });

  let subsBefore7d: number | null = null;
  if (subsBefore.length >= 2) {
    const first = subsBefore[0];
    const last = subsBefore[subsBefore.length - 1];
    if (first.subs != null && last.subs != null) subsBefore7d = last.subs - first.subs;
  }

  let subsAfter7d: number | null = null;
  const uploadDaySubSnap = history.find((h) => h.ts === uploadDate && h.subs != null);
  if (uploadDaySubSnap && subsAfter.length >= 1) {
    const lastAfter = subsAfter[subsAfter.length - 1];
    if (uploadDaySubSnap.subs != null && lastAfter.subs != null) {
      subsAfter7d = lastAfter.subs - uploadDaySubSnap.subs;
    }
  }

  // Velocity change percentages
  let viewVelocityChange: number | null = null;
  if (viewsBefore7d != null && viewsAfter7d != null && viewsBefore7d > 0) {
    viewVelocityChange = Math.round(((viewsAfter7d - viewsBefore7d) / viewsBefore7d) * 100);
  }
  let subsVelocityChange: number | null = null;
  if (subsBefore7d != null && subsAfter7d != null && subsBefore7d > 0) {
    subsVelocityChange = Math.round(((subsAfter7d - subsBefore7d) / subsBefore7d) * 100);
  }

  // Next upload (any format) and next long-form
  const uploadIdx = uploads.findIndex((u) => u.id === uploadId);
  let nextUpload: UploadObservation['nextUpload'] = null;
  let nextLongform: UploadObservation['nextLongform'] = null;
  if (uploadIdx >= 0) {
    for (let i = uploadIdx + 1; i < uploads.length; i++) {
      const next = uploads[i];
      const daysAfter = Math.round(
        (new Date(next.publishedAt).getTime() - uploadTs) / dayMs
      );
      if (!nextUpload) {
        nextUpload = { title: next.title, format: next.format, daysAfter };
      }
      if (!nextLongform && next.formatMeta.isLongform) {
        nextLongform = { title: next.title, format: next.format, daysAfter };
      }
      if (nextUpload && nextLongform) break;
    }
  }

  // Generate observation text
  const observation = generateObservationText(
    upload, viewsBefore7d, viewsAfter7d, subsBefore7d, subsAfter7d
  );

  return {
    uploadId: upload.id,
    title: upload.title,
    format: upload.format,
    publishedAt: upload.publishedAt,
    viewsBefore7d,
    viewsAfter7d,
    subsBefore7d,
    subsAfter7d,
    viewVelocityChange,
    subsVelocityChange,
    nextUpload,
    nextLongform,
    observation,
  };
}

function generateObservationText(
  upload: ClassifiedUpload,
  viewsBefore: number | null,
  viewsAfter: number | null,
  subsBefore: number | null,
  subsAfter: number | null,
): string {
  const parts: string[] = [];

  if (viewsBefore != null && viewsAfter != null) {
    if (viewsAfter > viewsBefore * 1.2) {
      parts.push(
        `Channel view velocity increased in the 7 days following this ${upload.formatMeta.label.toLowerCase()} compared with the prior 7-day baseline.`
      );
    } else if (viewsAfter < viewsBefore * 0.8) {
      parts.push(
        `Channel view velocity declined in the 7 days following this ${upload.formatMeta.label.toLowerCase()} compared with the prior 7-day baseline.`
      );
    } else {
      parts.push(
        `Channel view velocity remained stable around this ${upload.formatMeta.label.toLowerCase()}.`
      );
    }
  }

  if (subsBefore != null && subsAfter != null) {
    if (subsAfter > subsBefore * 1.2) {
      parts.push('Subscriber growth also strengthened during this period.');
    } else if (subsAfter < subsBefore * 0.8) {
      parts.push('Subscriber growth slowed during this period.');
    }
  }

  if (parts.length === 0) {
    return 'Insufficient snapshot data around this upload to generate an observation.';
  }

  return parts.join(' ');
}

function generateLearnings(
  uploads: ClassifiedUpload[],
  velocity: VelocityPoint[],
  subsGains: SubsPoint[],
  gaps: ContentGap[],
  formatBreakdown: FormatBreakdown[],
): Learning[] {
  const learnings: Learning[] = [];

  // ── 1. Strongest format by average views ──
  const longformFormats = formatBreakdown.filter(
    (f) => f.meta.isLongform && f.count >= 1
  );
  if (longformFormats.length >= 2) {
    const best = longformFormats[0]; // already sorted by totalViews desc
    const confidence: Learning['confidence'] = best.count >= 4 ? 'pattern' : 'observation';
    const sampleNote = best.count === 1
      ? '1 upload analysed'
      : `${best.count} uploads analysed`;
    learnings.push({
      text: `${best.meta.label} is currently the strongest long-form format by average views.`,
      evidence: `${sampleNote}, averaging ${formatNumber(best.avgViews)} views per upload.`,
      confidence,
    });
  }

  // ── 2. Longest content gap and what happened during it ──
  const longestGap = gaps
    .filter((g) => g.type === 'all_content')
    .sort((a, b) => b.durationDays - a.durationDays)[0];
  if (longestGap && longestGap.durationDays >= 7) {
    // Check if velocity declined during the gap
    const gapVelocity = velocity.filter(
      (v) => v.date >= longestGap.startDate && v.date <= longestGap.endDate && v.rollingAvg7d != null
    );
    let gapNote = '';
    if (gapVelocity.length >= 3) {
      const first = gapVelocity[0].rollingAvg7d!;
      const last = gapVelocity[gapVelocity.length - 1].rollingAvg7d!;
      if (first > 0 && last < first * 0.8) {
        gapNote = ' Channel view velocity also declined during this period.';
      } else if (first > 0 && last > first * 1.1) {
        gapNote = ' Channel view velocity was maintained during this period.';
      }
    }
    learnings.push({
      text: `The longest content gap was ${longestGap.durationDays} days.${gapNote}`,
      evidence: `No uploads between ${longestGap.startDate} and ${longestGap.endDate}.`,
      confidence: 'observation',
    });
  }

  // ── 3. Shorts trend ──
  const shortsBreakdown = formatBreakdown.find((f) => f.format === 'short');
  if (shortsBreakdown && shortsBreakdown.count >= 4) {
    if (shortsBreakdown.recentDirection === 'declining') {
      learnings.push({
        text: 'Recent Shorts have progressively declined in views.',
        evidence: `${shortsBreakdown.count} Shorts analysed. Average views: ${formatNumber(shortsBreakdown.avgViews)}.`,
        confidence: 'pattern',
      });
    } else if (shortsBreakdown.recentDirection === 'accelerating') {
      learnings.push({
        text: 'Recent Shorts are gaining more views than earlier ones.',
        evidence: `${shortsBreakdown.count} Shorts analysed. Average views: ${formatNumber(shortsBreakdown.avgViews)}.`,
        confidence: 'pattern',
      });
    }
  }

  // ── 4. Upload cadence ──
  if (uploads.length >= 3) {
    const daysSinceValues = uploads
      .map((u) => u.daysSincePrevious)
      .filter((d): d is number => d != null);
    if (daysSinceValues.length >= 2) {
      const avgCadence = daysSinceValues.reduce((s, d) => s + d, 0) / daysSinceValues.length;
      if (learnings.length < 3) {
        learnings.push({
          text: `Average upload cadence is 1 upload every ${avgCadence.toFixed(1)} days.`,
          evidence: `${uploads.length} uploads in the observation window.`,
          confidence: uploads.length >= 10 ? 'pattern' : 'observation',
        });
      }
    }
  }

  // ── 5. Subscriber growth during most active period ──
  if (subsGains.length >= 14 && uploads.length >= 3 && learnings.length < 3) {
    // Find the most active 14-day window (most uploads)
    const windowSize = 14;
    let bestWindow = { start: 0, count: 0 };
    for (let i = 0; i <= uploads.length - 2; i++) {
      const windowEnd = new Date(uploads[i].publishedAt).getTime() + windowSize * 86400000;
      const inWindow = uploads.filter(
        (u) => new Date(u.publishedAt).getTime() >= new Date(uploads[i].publishedAt).getTime() &&
               new Date(u.publishedAt).getTime() <= windowEnd
      ).length;
      if (inWindow > bestWindow.count) {
        bestWindow = { start: i, count: inWindow };
      }
    }
    if (bestWindow.count >= 3) {
      const activeStart = uploads[bestWindow.start].publishedAt.slice(0, 10);
      const activeEnd = new Date(
        new Date(activeStart).getTime() + windowSize * 86400000
      ).toISOString().slice(0, 10);
      const activeSubs = subsGains
        .filter((s) => s.date >= activeStart && s.date <= activeEnd && s.dailySubGain != null);
      const totalSubGain = activeSubs.reduce((s, p) => s + (p.dailySubGain ?? 0), 0);
      if (totalSubGain > 0) {
        learnings.push({
          text: `Subscriber growth was strongest during the most active content period.`,
          evidence: `+${formatNumber(totalSubGain)} subscribers during ${bestWindow.count} uploads over ${windowSize} days.`,
          confidence: 'observation',
        });
      }
    }
  }

  return learnings.slice(0, 3);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Route handler ────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params;
  const uploadIdParam = req.nextUrl.searchParams.get('upload');
  const daysParam = req.nextUrl.searchParams.get('days');
  const observationDays = daysParam ? parseInt(daysParam, 10) : 90;

  // ── Resolve artist ──
  const customArtists = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, customArtists);
  const artist = allArtists.find((a) => a.slug === slug);
  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  // ── Resolve channel ID ──
  const handle = artist.channelHandle;
  if (!handle) {
    return NextResponse.json({ error: 'No channel handle configured' }, { status: 404 });
  }
  const channelId = await readChannelMapping(handle);
  if (!channelId) {
    return NextResponse.json({ error: 'Channel not mapped in KV' }, { status: 404 });
  }

  // ── Read data ──
  const [liveSnap, history] = await Promise.all([
    readLiveSnap(channelId),
    readHistory(channelId),
  ]);

  if (!liveSnap || history.length < 2) {
    return NextResponse.json(
      { error: 'Insufficient data — need at least 2 daily snapshots' },
      { status: 404 }
    );
  }

  // ── Determine observation window ──
  const latestDate = history[history.length - 1].ts;
  const latestTs = new Date(latestDate).getTime();
  const windowStartTs = latestTs - observationDays * 86400000;
  const windowStartDate = new Date(windowStartTs).toISOString().slice(0, 10);

  // How many days do we actually have?
  const earliestDate = history[0].ts;
  const actualStartDate = earliestDate > windowStartDate ? earliestDate : windowStartDate;
  const actualDays = Math.round(
    (latestTs - new Date(actualStartDate).getTime()) / 86400000
  );

  const windowLabel = actualDays < observationDays
    ? `Last ${actualDays} days`
    : `Last ${observationDays} days`;

  // ── Compute series ──
  const viewVelocity = computeVelocity(history, actualStartDate);
  const subscriberGains = computeSubsGains(history, actualStartDate);

  // ── Classify uploads ──
  const recentUploads = liveSnap.recentUploads ?? [];
  const uploads = classifyUploads(recentUploads, actualStartDate, latestDate);

  // ── Content gaps ──
  const gaps = detectGaps(uploads);

  // ── Milestones ──
  const milestones = buildMilestones(artist, slug);

  // ── Format breakdown ──
  const formatBreakdown = computeFormatBreakdown(uploads);

  // ── Learnings ──
  const learnings = generateLearnings(
    uploads, viewVelocity, subscriberGains, gaps, formatBreakdown
  );

  // ── Upload observation (optional) ──
  let uploadObservation: UploadObservation | null = null;
  if (uploadIdParam) {
    uploadObservation = computeUploadObservation(uploadIdParam, uploads, history);
  }

  // ── Derive current channel state for display ──
  const { deriveFromLive } = await import('@/lib/artists');
  const derived = deriveFromLive(liveSnap);

  const response: CampaignBehaviourResponse = {
    artist: {
      slug: artist.slug,
      name: artist.name,
      channelState: derived?.status,
    },
    observationWindow: {
      startDate: actualStartDate,
      endDate: latestDate,
      days: actualDays,
      label: windowLabel,
    },
    viewVelocity,
    subscriberGains,
    uploads,
    gaps,
    milestones,
    formatBreakdown,
    learnings,
    uploadObservation,
    lastUpdated: (liveSnap as any).cachedAt ?? new Date().toISOString(),
  };

  return NextResponse.json(response);
}
