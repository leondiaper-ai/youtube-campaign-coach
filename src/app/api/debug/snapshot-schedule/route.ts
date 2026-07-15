import { NextResponse } from 'next/server';
import { ARTISTS, mergeArtistLists, deriveFromLive, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta, type CachedSnap } from '@/lib/kvCache';
import {
  classifySnapshotPriority,
  shouldFetchInRun,
  calculateQuotaBudget,
  type SnapshotSchedule,
  type SnapshotPriority,
} from '@/lib/snapshotScheduler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/snapshot-schedule
 *
 * Exposes per-artist snapshot scheduling info:
 *   snapshotPriority, lastSnapshotAt, nextSnapshotDueAt,
 *   snapshotFrequency, estimatedQuotaCost, dataFreshness
 *
 * Also returns the full quota budget summary.
 */
export async function GET() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const withHandles = allArtists.filter((a) => a.channelHandle);

  // Read all cached snaps
  const handles = withHandles.map(a => a.channelHandle!);
  const snapMap = await readAllLiveSnaps(handles);
  const syncMeta = await readSyncMeta();

  // Classify each artist
  const schedules: SnapshotSchedule[] = [];
  const artistDetails: {
    slug: string;
    name: string;
    handle: string;
    snapshotPriority: SnapshotPriority;
    reason: string;
    lastSnapshotAt: string | null;
    nextSnapshotDueAt: string | null;
    snapshotFrequency: string;
    estimatedWeeklyQuotaCost: number;
    dataFreshness: 'fresh' | 'stale' | 'no_data';
    channelState: ChannelState | null;
    wouldFetchMorning: boolean;
    wouldFetchEvening: boolean;
  }[] = [];

  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  for (const a of withHandles) {
    const handle = a.channelHandle!;
    const snap: CachedSnap | null = snapMap.get(handle) ?? null;

    // Derive channel state from cached data
    let channelState: ChannelState | null = null;
    if (snap && !snap.error) {
      const derived = deriveFromLive(snap, {
        subs7Delta: null,
        views7Delta: null,
      });
      channelState = derived?.status ?? null;
    }

    const schedule = classifySnapshotPriority(a, snap, channelState ?? undefined);
    schedules.push(schedule);

    // Compute next snapshot due
    const lastSnapshotAt = snap?.cachedAt ?? null;
    let nextSnapshotDueAt: string | null = null;
    if (lastSnapshotAt) {
      const last = new Date(lastSnapshotAt);
      switch (schedule.priority) {
        case 'HIGH':
          // Next run (morning or evening, whichever is sooner)
          nextSnapshotDueAt = nextRunTime('HIGH', last).toISOString();
          break;
        case 'MEDIUM':
          // Next morning run
          nextSnapshotDueAt = nextRunTime('MEDIUM', last).toISOString();
          break;
        case 'LOW':
          // Next Mon/Wed/Fri morning
          nextSnapshotDueAt = nextRunTime('LOW', last).toISOString();
          break;
      }
    }

    // Determine data freshness
    let dataFreshness: 'fresh' | 'stale' | 'no_data' = 'no_data';
    if (snap && !snap.error && snap.cachedAt) {
      const ageHours = (Date.now() - new Date(snap.cachedAt).getTime()) / (1000 * 60 * 60);
      const maxFreshHours = schedule.priority === 'HIGH' ? 14 : schedule.priority === 'MEDIUM' ? 26 : 74;
      dataFreshness = ageHours <= maxFreshHours ? 'fresh' : 'stale';
    }

    // Frequency label
    const freq = schedule.priority === 'HIGH' ? '2x daily (every run)'
      : schedule.priority === 'MEDIUM' ? '1x daily (morning only)'
      : '3x weekly (Mon/Wed/Fri morning)';

    artistDetails.push({
      slug: a.slug,
      name: a.name,
      handle,
      snapshotPriority: schedule.priority,
      reason: schedule.reason,
      lastSnapshotAt,
      nextSnapshotDueAt,
      snapshotFrequency: freq,
      estimatedWeeklyQuotaCost: schedule.weeklyQuotaCost,
      dataFreshness,
      channelState,
      wouldFetchMorning: shouldFetchInRun(schedule.priority, 'morning', dayOfWeek),
      wouldFetchEvening: shouldFetchInRun(schedule.priority, 'evening', dayOfWeek),
    });
  }

  // Quota budget
  const budget = calculateQuotaBudget(schedules);

  // Priority counts
  const priorityCounts: Record<SnapshotPriority, string[]> = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const d of artistDetails) {
    priorityCounts[d.snapshotPriority].push(d.slug);
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    totalArtists: withHandles.length,
    priorityCounts: {
      HIGH: priorityCounts.HIGH.length,
      MEDIUM: priorityCounts.MEDIUM.length,
      LOW: priorityCounts.LOW.length,
    },
    highPriorityArtists: priorityCounts.HIGH,
    quotaBudget: budget,
    lastSync: syncMeta,
    artists: artistDetails,
  });
}

/** Calculate the next expected run time for a given priority after a reference time. */
function nextRunTime(priority: SnapshotPriority, after: Date): Date {
  const next = new Date(after);

  if (priority === 'HIGH') {
    // Next 8am or 8pm UTC, whichever is sooner
    const h = next.getUTCHours();
    if (h < 8) {
      next.setUTCHours(8, 0, 0, 0);
    } else if (h < 20) {
      next.setUTCHours(20, 0, 0, 0);
    } else {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(8, 0, 0, 0);
    }
    return next;
  }

  if (priority === 'MEDIUM') {
    // Next 8am UTC
    if (next.getUTCHours() >= 8) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    next.setUTCHours(8, 0, 0, 0);
    return next;
  }

  // LOW: next Mon(1)/Wed(3)/Fri(5) at 8am UTC
  const day = next.getUTCDay();
  const lowDays = [1, 3, 5];
  // Find next eligible day
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = (day + offset) % 7;
    if (lowDays.includes(candidate)) {
      next.setUTCDate(next.getUTCDate() + offset);
      next.setUTCHours(8, 0, 0, 0);
      return next;
    }
  }
  // Fallback (shouldn't happen)
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(8, 0, 0, 0);
  return next;
}
