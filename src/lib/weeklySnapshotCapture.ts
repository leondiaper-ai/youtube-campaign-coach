// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY SNAPSHOT CAPTURE — fetches live YouTube data for all Virgin Managed
// artists and saves weekly snapshots. Dedupes by ISO week per artist.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ARTISTS, mergeArtistLists, isManaged, classifyArtist, deriveFromLive, daysSince,
  type Artist, type ChannelState,
} from './artists';
import { listCustomArtists } from './artistStore';
import { readLiveSnapByHandle } from './kvCache';
import { readHistory, deltaOver } from './snapshots';
import { viewsToRevenue, subsToValue, detectOpportunity } from './valueModel';
import { getCampaignSignal, getChannelHealth, getYouTubeGrowthState, type GrowthInput } from './youtubeGrowthOS';
import {
  saveSnapshot, getISOWeekId, getWeekStartDate,
  computeRollup, saveRollup,
  type WeeklyChannelSnapshot, type MissedOpportunityType,
} from './weeklySnapshotStore';

export type CaptureResult = {
  captured: number;
  skipped: number;
  errors: { slug: string; error: string }[];
  weekId: string;
  total: number;
};

/**
 * Capture weekly snapshots for all Virgin Managed artists.
 * Dedupes by ISO week — safe to call multiple times in the same week.
 */
export async function captureWeeklySnapshots(): Promise<CaptureResult> {
  const now = new Date();
  const weekId = getISOWeekId(now);
  const weekStartDate = getWeekStartDate(now);
  const snapshotDate = now.toISOString();

  // Load all artists (hardcoded + custom)
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const managed = allArtists.filter(isManaged);

  const result: CaptureResult = {
    captured: 0,
    skipped: 0,
    errors: [],
    weekId,
    total: managed.length,
  };

  const weekSnapshots: WeeklyChannelSnapshot[] = [];

  await Promise.all(
    managed.map(async (artist) => {
      try {
        const snapshot = await captureArtistSnapshot(artist, {
          snapshotDate,
          weekId,
          weekStartDate,
        });
        const { saved, reason } = await saveSnapshot(snapshot);
        if (saved) {
          result.captured++;
          weekSnapshots.push(snapshot);
        } else if (reason === 'already_captured') {
          result.skipped++;
        } else {
          result.errors.push({ slug: artist.slug, error: reason ?? 'Unknown error' });
        }
      } catch (e: any) {
        result.errors.push({ slug: artist.slug, error: e?.message ?? String(e) });
      }
    }),
  );

  // Save weekly rollup if we captured anything
  if (weekSnapshots.length > 0) {
    try {
      const rollup = computeRollup(weekSnapshots, weekId, weekStartDate);
      await saveRollup(rollup);
    } catch {
      // Non-critical — rollup is a convenience layer
    }
  }

  return result;
}

// ── Per-artist snapshot capture ────────────────────────────────────────────

async function captureArtistSnapshot(
  artist: Artist,
  ctx: { snapshotDate: string; weekId: string; weekStartDate: string },
): Promise<WeeklyChannelSnapshot> {
  // Read from KV cache — NO YouTube API calls
  const handle = artist.channelHandle ?? artist.name;
  const snap = handle ? await readLiveSnapByHandle(handle) : null;

  // Read history for delta calculations
  const history = snap?.channelId && !snap.error
    ? await readHistory(snap.channelId)
    : [];

  const subs7 = deltaOver(history, 7, 'subs');
  const views7 = deltaOver(history, 7, 'views');
  const subs14 = deltaOver(history, 14, 'subs');
  const views14 = deltaOver(history, 14, 'views');

  // Week-on-week
  const prevSubsDelta = subs14 && subs7 ? subs14.delta - subs7.delta : null;
  const prevViewsDelta = views14 && views7 ? views14.delta - views7.delta : null;
  const subsWoW = prevSubsDelta != null && prevSubsDelta !== 0 && subs7
    ? ((subs7.delta - prevSubsDelta) / Math.abs(prevSubsDelta)) * 100 : null;
  const viewsWoW = prevViewsDelta != null && prevViewsDelta !== 0 && views7
    ? ((views7.delta - prevViewsDelta) / Math.abs(prevViewsDelta)) * 100 : null;

  // Derive state
  const derived = snap ? deriveFromLive(snap, {
    subs7Delta: subs7?.delta ?? null,
    views7Delta: views7?.delta ?? null,
  }) : null;
  const channelState: ChannelState = derived?.status ?? 'COLD';
  const uploads30d = snap?.uploads30d ?? 0;
  const classification = classifyArtist(channelState, uploads30d);

  // Growth OS signals
  const growthInput: GrowthInput = {
    subscribers: snap?.subs ?? undefined,
    views7d: views7?.delta ?? null,
    subscribers7d: subs7?.delta ?? null,
    uploads30d,
    shorts30d: snap?.shorts30d ?? 0,
    lastUploadDaysAgo: daysSince(snap?.lastUploadAt) ?? 60,
    hasActiveCampaign: !!artist.campaign,
    campaignName: artist.campaign,
  };
  const gsResult = getYouTubeGrowthState(growthInput);
  const campSig = getCampaignSignal(growthInput);

  // Value model
  const v7d = views7?.delta ?? 0;
  const s7d = subs7?.delta ?? 0;
  const revenue = viewsToRevenue(v7d);
  const subValue = subsToValue(Math.max(0, s7d));
  const estimatedValueLow = revenue.low + subValue.low;
  const estimatedValueHigh = revenue.high + subValue.high;

  // Conversion
  const subsPer1kViews = v7d > 0 ? (s7d / v7d) * 1000 : null;

  // Opportunity detection
  const opp = detectOpportunity({
    views7d: v7d,
    subs7d: s7d,
    subsPerKViews: subsPer1kViews,
    uploads30d,
    channelState,
  });

  let missedOpportunityType: MissedOpportunityType = 'none';
  if (channelState === 'COLD') {
    missedOpportunityType = 'cold_channel';
  } else if (opp?.gap === 'CONVERSION_GAP') {
    missedOpportunityType = 'conversion_gap';
  } else if (opp?.gap === 'VELOCITY_GAP') {
    missedOpportunityType = 'velocity_gap';
  } else if (uploads30d <= 2) {
    missedOpportunityType = 'cadence_gap';
  }

  return {
    snapshotDate: ctx.snapshotDate,
    weekId: ctx.weekId,
    weekStartDate: ctx.weekStartDate,
    artistSlug: artist.slug,
    artistName: artist.name,
    channelId: snap?.channelId ?? '',
    artistType: 'managed',
    currentClassification: classification,
    channelState,
    campaignState: campSig.label,
    subscriberTotal: snap?.subs ?? 0,
    viewTotal: snap?.views ?? 0,
    uploads30d,
    uploads7d: Math.round(uploads30d / 4.3), // Approximate
    shorts7d: Math.round((snap?.shorts30d ?? 0) / 4.3),
    views7d: v7d,
    subscribers7d: s7d,
    viewsWoW: viewsWoW != null ? Math.round(viewsWoW) : null,
    subscribersWoW: subsWoW != null ? Math.round(subsWoW) : null,
    subsPer1kViews,
    estimatedValueLow,
    estimatedValueHigh,
    missedOpportunityType,
    missedValueLow: opp?.missedValueRange.low ?? 0,
    missedValueHigh: opp?.missedValueRange.high ?? 0,
    recommendedAction: derived?.nextAction ?? 'No data available',
    notes: '',
  };
}
