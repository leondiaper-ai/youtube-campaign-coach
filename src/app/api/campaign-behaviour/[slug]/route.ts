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
  type ShortType,
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

type FollowUpWindowContent = {
  uploads: { title: string; format: UploadFormat; shortTitle: string; daysAfter: number; isLongform: boolean }[];
  longformCount: number;
  shortsCount: number;
  summary: string;
};

type FollowUpSignal = '✓ Long-form follow-up' | 'Shorts only' | 'No follow-up activity';

type UploadObservation = {
  uploadId: string;
  title: string;
  shortTitle: string;
  format: UploadFormat;
  publishedAt: string;
  viewsBefore7d: number | null;
  viewsAfter7d: number | null;
  viewsAfter14d: number | null;
  subsBefore7d: number | null;
  subsAfter7d: number | null;
  subsAfter14d: number | null;
  viewVelocityChange: number | null;    // percentage
  subsVelocityChange: number | null;    // percentage
  nextUpload: { title: string; format: UploadFormat; daysAfter: number } | null;
  nextLongform: { title: string; format: UploadFormat; daysAfter: number } | null;
  followUpWindow: FollowUpWindowContent | null;  // Day +7 to Day +14 content
  followUpSignal: FollowUpSignal;
  observation: string;
};

type Learning = {
  text: string;
  evidence: string;
  confidence: 'observation' | 'pattern' | 'strong';
};

type Baseline = {
  period: { start: string; end: string; days: number };
  avgDailyViews: number | null;
  avgDailySubs: number | null;
  weeklyViews: number | null;
  weeklySubs: number | null;
};

type AvailableWindow = {
  days: number;
  label: string;
  available: boolean;
};

type ChannelStats = {
  totalSubs: number | null;
  totalViews: number | null;
  subsPerMille: number | null; // subs per 1,000 views
  weeklyAvgViews: number | null; // avg daily views × 7 from recent history
};

type CampaignBehaviourResponse = {
  artist: { slug: string; name: string; channelState?: string };
  channelStats: ChannelStats;
  observationWindow: { startDate: string; endDate: string; days: number; label: string };
  projectedEndDate: string | null; // extends chart into future for planning windows
  viewVelocity: VelocityPoint[];
  subscriberGains: SubsPoint[];
  uploads: ClassifiedUpload[];
  gaps: ContentGap[];
  milestones: Milestone[];
  formatBreakdown: FormatBreakdown[];
  learnings: Learning[];
  uploadObservation: UploadObservation | null;
  baseline: Baseline | null;
  availableWindows: AvailableWindow[];
  lastUpdated: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function computeVelocity(
  history: ChannelSnapshot[],
  startDate: string,
  totalSubs: number | null = null,
): VelocityPoint[] {
  const startTs = new Date(startDate).getTime();
  const filtered = history.filter(
    (h) => new Date(h.ts).getTime() >= startTs && h.views != null
  );

  if (filtered.length < 2) return [];

  // Compute daily gains — time-aware: divide by actual days between snapshots
  // so multi-day gaps from LOW-priority scheduling don't create spikes.
  const dailyGains: VelocityPoint[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    if (prev.views == null || curr.views == null) {
      dailyGains.push({ date: curr.ts, dailyViewGain: null, rollingAvg7d: null });
      continue;
    }
    const totalGain = curr.views - prev.views;
    // Guard against negative gains (can happen if YouTube adjusts view counts)
    if (totalGain < 0) {
      dailyGains.push({ date: curr.ts, dailyViewGain: null, rollingAvg7d: null });
      continue;
    }

    // Calculate actual days between snapshots (may be >1 for LOW-priority channels)
    const daysBetween = Math.max(
      1,
      Math.round(
        (new Date(curr.ts).getTime() - new Date(prev.ts).getTime()) / 86400000
      )
    );

    // Distribute the gain evenly across the actual number of days
    const dailyRate = Math.round(totalGain / daysBetween);
    dailyGains.push({
      date: curr.ts,
      dailyViewGain: dailyRate,
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

  // Interpolate null gaps in rollingAvg7d so the velocity line stays continuous.
  // For each null run, linearly interpolate between the nearest valid values
  // on each side. Leading/trailing nulls carry forward/backward the nearest value.
  const interpolated = dailyGains.map((p) => ({ ...p }));
  let i = 0;
  while (i < interpolated.length) {
    if (interpolated[i].rollingAvg7d == null) {
      // Find the start of the null gap
      const gapStart = i;
      while (i < interpolated.length && interpolated[i].rollingAvg7d == null) i++;
      const gapEnd = i; // first non-null after gap (or length)

      const leftVal = gapStart > 0 ? interpolated[gapStart - 1].rollingAvg7d : null;
      const rightVal = gapEnd < interpolated.length ? interpolated[gapEnd].rollingAvg7d : null;

      for (let j = gapStart; j < gapEnd; j++) {
        if (leftVal != null && rightVal != null) {
          // Linear interpolation
          const t = (j - gapStart + 1) / (gapEnd - gapStart + 1);
          interpolated[j].rollingAvg7d = Math.round(leftVal + t * (rightVal - leftVal));
        } else if (leftVal != null) {
          // Trailing gap — carry forward
          interpolated[j].rollingAvg7d = leftVal;
        } else if (rightVal != null) {
          // Leading gap — carry backward
          interpolated[j].rollingAvg7d = rightVal;
        }
        // If both null, leave as null (no data at all)
      }
    } else {
      i++;
    }
  }

  // Second smoothing pass: 3-point weighted average to soften remaining spikes.
  // This produces a Spotify-style smooth line while preserving overall shape.
  // Weights: [0.2, 0.6, 0.2] — center-heavy to keep shape but gentle transitions.
  const smoothed = interpolated.map((p) => ({ ...p }));
  for (let j = 1; j < smoothed.length - 1; j++) {
    const prev = interpolated[j - 1].rollingAvg7d;
    const curr = interpolated[j].rollingAvg7d;
    const next = interpolated[j + 1].rollingAvg7d;
    if (prev != null && curr != null && next != null) {
      smoothed[j].rollingAvg7d = Math.round(prev * 0.2 + curr * 0.6 + next * 0.2);
    }
  }

  // ── Velocity floor for significant channels ──
  // YouTube's API can return stale/cached viewCounts, producing 0-gain periods
  // that drop the line to the floor. For channels with real audience (>50K subs
  // or >1M total views), this is almost never genuine — they're always getting
  // some passive views. Instead of nulling the data (which loses shape), we
  // apply a soft floor: the line can go low but never hits absolute zero.
  // Floor = 5% of the median non-zero velocity in the window.
  const lastViews = filtered[filtered.length - 1].views ?? 0;
  const isSignificant =
    (totalSubs != null && totalSubs > 50_000) || lastViews > 1_000_000;

  if (isSignificant) {
    const nonZeroVals = smoothed
      .map((p) => p.rollingAvg7d)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);

    if (nonZeroVals.length > 0) {
      const median = nonZeroVals[Math.floor(nonZeroVals.length / 2)];
      const floor = Math.max(1, Math.round(median * 0.05));

      for (const pt of smoothed) {
        if (pt.rollingAvg7d != null && pt.rollingAvg7d < floor) {
          pt.rollingAvg7d = floor;
        }
      }
    }
  }

  return smoothed;
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

  // Second smoothing pass: 3-point weighted average
  const smoothed = dailyGains.map((p) => ({ ...p }));
  for (let j = 1; j < smoothed.length - 1; j++) {
    const prev = dailyGains[j - 1].rollingAvg7d;
    const curr = dailyGains[j].rollingAvg7d;
    const next = dailyGains[j + 1].rollingAvg7d;
    if (prev != null && curr != null && next != null) {
      smoothed[j].rollingAvg7d = Math.round(prev * 0.2 + curr * 0.6 + next * 0.2);
    }
  }

  return smoothed;
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
  const dayMs = 86400000;

  // ── Before window (7 days) ──
  const before7Start = uploadTs - 7 * dayMs;
  const snapsBeforeWindow = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts >= before7Start && ts < uploadTs && h.views != null;
  });

  // ── After windows (7 days and 14 days) ──
  const after7End = uploadTs + 7 * dayMs;
  const after14End = uploadTs + 14 * dayMs;
  const snapsAfter7 = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after7End && h.views != null;
  });
  const snapsAfter14 = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after14End && h.views != null;
  });

  // Views gained in 7 days before
  let viewsBefore7d: number | null = null;
  if (snapsBeforeWindow.length >= 2) {
    const first = snapsBeforeWindow[0];
    const last = snapsBeforeWindow[snapsBeforeWindow.length - 1];
    if (first.views != null && last.views != null) {
      viewsBefore7d = last.views - first.views;
    }
  }

  // Views gained in 7 days after
  let viewsAfter7d: number | null = null;
  const uploadDaySnap = history.find((h) => h.ts === uploadDate && h.views != null);
  if (uploadDaySnap && snapsAfter7.length >= 1) {
    const lastAfter = snapsAfter7[snapsAfter7.length - 1];
    if (uploadDaySnap.views != null && lastAfter.views != null) {
      viewsAfter7d = lastAfter.views - uploadDaySnap.views;
    }
  }

  // Views gained in 14 days after (only if the full 14-day window has elapsed)
  let viewsAfter14d: number | null = null;
  if (after14End <= Date.now() && uploadDaySnap && snapsAfter14.length >= 1) {
    const lastAfter = snapsAfter14[snapsAfter14.length - 1];
    if (uploadDaySnap.views != null && lastAfter.views != null) {
      viewsAfter14d = lastAfter.views - uploadDaySnap.views;
    }
  }

  // Subscribers — before
  const subsBefore = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts >= before7Start && ts < uploadTs && h.subs != null;
  });
  let subsBefore7d: number | null = null;
  if (subsBefore.length >= 2) {
    const first = subsBefore[0];
    const last = subsBefore[subsBefore.length - 1];
    if (first.subs != null && last.subs != null) subsBefore7d = last.subs - first.subs;
  }

  // Subscribers — after 7d
  const subsAfter7 = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after7End && h.subs != null;
  });
  let subsAfter7d: number | null = null;
  const uploadDaySubSnap = history.find((h) => h.ts === uploadDate && h.subs != null);
  if (uploadDaySubSnap && subsAfter7.length >= 1) {
    const lastAfter = subsAfter7[subsAfter7.length - 1];
    if (uploadDaySubSnap.subs != null && lastAfter.subs != null) {
      subsAfter7d = lastAfter.subs - uploadDaySubSnap.subs;
    }
  }

  // Subscribers — after 14d (only if the full 14-day window has elapsed)
  const subsAfter14 = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts > uploadTs && ts <= after14End && h.subs != null;
  });
  let subsAfter14d: number | null = null;
  if (after14End <= Date.now() && uploadDaySubSnap && subsAfter14.length >= 1) {
    const lastAfter = subsAfter14[subsAfter14.length - 1];
    if (uploadDaySubSnap.subs != null && lastAfter.subs != null) {
      subsAfter14d = lastAfter.subs - uploadDaySubSnap.subs;
    }
  }

  // Velocity change percentages (7d window)
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

  // ── Follow-up window: Day +7 to Day +14 ──
  let followUpWindow: FollowUpWindowContent | null = null;
  let followUpSignal: FollowUpSignal = 'No follow-up activity';

  if (upload.formatMeta.isLongform) {
    const followStart = uploadTs + 7 * dayMs;
    const followEnd = uploadTs + 14 * dayMs;
    const followUploads = uploads
      .filter((u) => {
        const ts = new Date(u.publishedAt).getTime();
        return ts >= followStart && ts <= followEnd && u.id !== uploadId;
      })
      .map((u) => ({
        title: u.title,
        format: u.format,
        shortTitle: u.shortTitle,
        daysAfter: Math.round((new Date(u.publishedAt).getTime() - uploadTs) / dayMs),
        isLongform: u.formatMeta.isLongform,
      }));

    const lfCount = followUploads.filter((u) => u.isLongform).length;
    const shCount = followUploads.filter((u) => !u.isLongform).length;

    // Build summary text
    let summary = '';
    if (followUploads.length === 0) {
      summary = 'No content published in the Day 7–14 follow-up window.';
    } else {
      const parts: string[] = [];
      if (lfCount > 0) {
        const lfItems = followUploads.filter((u) => u.isLongform);
        parts.push(lfItems.map((u) => `${getFormatMeta(u.format).label} · Day +${u.daysAfter}`).join(', '));
      }
      if (shCount > 0) {
        parts.push(`${shCount} supporting Short${shCount !== 1 ? 's' : ''}`);
      }
      summary = parts.join(', ');
    }

    followUpWindow = {
      uploads: followUploads,
      longformCount: lfCount,
      shortsCount: shCount,
      summary,
    };

    // Classify follow-up signal
    if (lfCount > 0) {
      followUpSignal = '✓ Long-form follow-up';
    } else if (shCount > 0) {
      followUpSignal = 'Shorts only';
    } else {
      followUpSignal = 'No follow-up activity';
    }
  }

  // Generate observation text
  const observation = generateObservationText(
    upload, viewsBefore7d, viewsAfter7d, subsBefore7d, subsAfter7d
  );

  return {
    uploadId: upload.id,
    title: upload.title,
    shortTitle: upload.shortTitle,
    format: upload.format,
    publishedAt: upload.publishedAt,
    viewsBefore7d,
    viewsAfter7d,
    viewsAfter14d,
    subsBefore7d,
    subsAfter7d,
    subsAfter14d,
    viewVelocityChange,
    subsVelocityChange,
    nextUpload,
    nextLongform,
    followUpWindow,
    followUpSignal,
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
    return 'Not enough historical data is available before this upload for a reliable comparison.';
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

function computeBaseline(
  history: ChannelSnapshot[],
  uploads: ClassifiedUpload[],
  windowStart: string,
): Baseline | null {
  // Find the first upload in the window
  if (uploads.length === 0) return null;
  const firstUploadDate = uploads[0].publishedAt.slice(0, 10);
  const firstUploadTs = new Date(firstUploadDate).getTime();

  // Get snapshots before the first upload (within our window)
  const windowStartTs = new Date(windowStart).getTime();
  const preCampaignSnaps = history.filter((h) => {
    const ts = new Date(h.ts).getTime();
    return ts >= windowStartTs && ts < firstUploadTs;
  });

  if (preCampaignSnaps.length < 7) return null;

  // Compute daily view gains in the pre-campaign period
  const viewGains: number[] = [];
  const subGains: number[] = [];
  for (let i = 1; i < preCampaignSnaps.length; i++) {
    const prev = preCampaignSnaps[i - 1];
    const curr = preCampaignSnaps[i];
    if (prev.views != null && curr.views != null) {
      const gain = curr.views - prev.views;
      if (gain >= 0) viewGains.push(gain);
    }
    if (prev.subs != null && curr.subs != null) {
      subGains.push(curr.subs - prev.subs);
    }
  }

  const avgDailyViews = viewGains.length >= 3
    ? Math.round(viewGains.reduce((s, g) => s + g, 0) / viewGains.length)
    : null;
  const avgDailySubs = subGains.length >= 3
    ? Math.round(subGains.reduce((s, g) => s + g, 0) / subGains.length)
    : null;

  const periodStart = preCampaignSnaps[0].ts;
  const periodEnd = preCampaignSnaps[preCampaignSnaps.length - 1].ts;
  const periodDays = Math.round(
    (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000
  );

  return {
    period: { start: periodStart, end: periodEnd, days: periodDays },
    avgDailyViews,
    avgDailySubs,
    weeklyViews: avgDailyViews != null ? avgDailyViews * 7 : null,
    weeklySubs: avgDailySubs != null ? avgDailySubs * 7 : null,
  };
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
  // Default to max available — show all historical data
  const observationDays = daysParam && daysParam !== 'max'
    ? parseInt(daysParam, 10)
    : 9999; // Will be capped by actual available data

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

  const windowLabel = observationDays >= 9999
    ? `All available (${actualDays} days)`
    : actualDays < observationDays
      ? `Last ${actualDays} days`
      : `Last ${observationDays} days`;

  // Compute available window options
  const totalHistoryDays = Math.round(
    (latestTs - new Date(earliestDate).getTime()) / 86400000
  );
  // Window options — each only shows when it would display a meaningfully
  // different range than the next-largest option. Prevents e.g. 90D and MAX
  // showing identical data when totalHistoryDays < 90.
  const availableWindows: AvailableWindow[] = [
    { days: 30,   label: '30D',  available: totalHistoryDays > 35 },
    { days: 90,   label: '90D',  available: totalHistoryDays > 95 },
    { days: 180,  label: '180D', available: totalHistoryDays > 185 },
    { days: 9999, label: 'MAX',  available: true },
  ];

  // ── Compute series ──
  const viewVelocity = computeVelocity(history, actualStartDate, liveSnap.subs ?? null);
  const subscriberGains = computeSubsGains(history, actualStartDate);

  // ── Classify uploads ──
  const recentUploads = liveSnap.recentUploads ?? [];
  const uploads = classifyUploads(recentUploads, actualStartDate, latestDate, artist.name);

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

  // ── Baseline (pre-activity) ──
  const baseline = computeBaseline(history, uploads, actualStartDate);

  // ── Upload observation (optional) ──
  let uploadObservation: UploadObservation | null = null;
  if (uploadIdParam) {
    // Use 14-day after window for long-form, 7-day for shorts
    uploadObservation = computeUploadObservation(uploadIdParam, uploads, history);
  }

  // ── Derive current channel state for display ──
  const { deriveFromLive } = await import('@/lib/artists');
  const derived = deriveFromLive(liveSnap);

  // ── Project chart end date into future for planning windows ──
  // If the most recent long-form upload is within 14 days of the chart end,
  // extend the timeline so the full Day 7–14 follow-up window is visible.
  // ALWAYS guarantee at least 7 days of future space for planning purposes,
  // even when no recent long-form upload exists.
  let projectedEndDate: string | null = null;
  const longformUploads = uploads.filter((u) => u.formatMeta.isLongform);
  const latestDateTs = new Date(latestDate).getTime();
  if (longformUploads.length > 0) {
    const mostRecentLF = longformUploads.reduce((a, b) =>
      new Date(a.publishedAt) > new Date(b.publishedAt) ? a : b
    );
    const lfPublishTs = new Date(mostRecentLF.publishedAt).getTime();
    const day14End = lfPublishTs + 14 * 86400000;
    // Only project if the 14-day window extends beyond our data end
    if (day14End > latestDateTs) {
      projectedEndDate = new Date(day14End).toISOString().slice(0, 10);
    }
  }
  // Guarantee a minimum 7-day planning window for ALL channels
  if (!projectedEndDate) {
    projectedEndDate = new Date(latestDateTs + 7 * 86400000).toISOString().slice(0, 10);
  }

  // ── Channel stats for headline bar ──
  const totalSubs = liveSnap.subs ?? null;
  const totalViews = liveSnap.views ?? null;
  const subsPerMille =
    totalSubs != null && totalViews != null && totalViews > 0
      ? Math.round((totalSubs / totalViews) * 1000 * 10) / 10
      : null;

  // Weekly avg views from recent velocity data
  const recentVelocity = viewVelocity.slice(-14);
  const validDailyGains = recentVelocity
    .map((v) => v.dailyViewGain)
    .filter((g): g is number => g != null && g >= 0);
  const weeklyAvgViews =
    validDailyGains.length > 0
      ? Math.round(
          (validDailyGains.reduce((s, g) => s + g, 0) / validDailyGains.length) * 7
        )
      : null;

  const channelStats: ChannelStats = {
    totalSubs,
    totalViews,
    subsPerMille,
    weeklyAvgViews,
  };

  const response: CampaignBehaviourResponse = {
    artist: {
      slug: artist.slug,
      name: artist.name,
      channelState: derived?.status,
    },
    channelStats,
    observationWindow: {
      startDate: actualStartDate,
      endDate: latestDate,
      days: actualDays,
      label: windowLabel,
    },
    projectedEndDate,
    viewVelocity,
    subscriberGains,
    uploads,
    gaps,
    milestones,
    formatBreakdown,
    learnings,
    uploadObservation,
    baseline,
    availableWindows,
    lastUpdated: (liveSnap as any).cachedAt ?? new Date().toISOString(),
  };

  return NextResponse.json(response);
}
