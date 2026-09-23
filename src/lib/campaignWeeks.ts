import type { ChannelSnapshot } from '@/lib/snapshots';

/* ── WEEKLY WINDOWS ─────────────────────────────────────────────────
   Fixed 7-day windows from a campaign's start, each measured against
   the previous week's last snapshot so a missed day does not become a
   missing week. Lifted out of the campaigns page unchanged, so the
   regional team boards can draw the same weekly progress rather than
   a second version of it.

   The status field is the honest part: a delta is only `confirmed`
   when both endpoints carry real values. Two zeroes in an active
   campaign is a monitoring gap, not a flat week, and is labelled
   `missing` rather than drawn as truth.
   ─────────────────────────────────────────────────────────────────── */

export type WeeklyWindow = {
  week: number;
  views7d: number | null;
  subs7d: number | null;
  status: 'confirmed' | 'missing' | 'partial';
};

export function computeWeeklyWindows(
  history: ChannelSnapshot[],
  campaignStartDate: string,
): { week: number; views7d: number | null; subs7d: number | null; status: 'confirmed' | 'missing' | 'partial' }[] {
  if (history.length < 2) return [];
  const startTs = new Date(campaignStartDate).getTime();
  const windows: { week: number; views7d: number | null; subs7d: number | null; status: 'confirmed' | 'missing' | 'partial' }[] = [];
  // Filter to campaign-period history with at least one real metric, sorted by time
  const relevantHistory = history
    .filter((h) => new Date(h.ts).getTime() >= startTs && (h.views != null || h.subs != null))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  if (relevantHistory.length < 2) return [];

  // Use fixed 7-day windows from campaign start, with the previous
  // week's last snapshot as the baseline for the next week (no gaps).
  const firstSnap = relevantHistory[0];
  let weekNum = 1;
  let windowStart = startTs;
  let baseline = firstSnap; // running baseline from previous week

  while (windowStart < Date.now()) {
    const windowEnd = windowStart + 7 * 86400000;
    // Find the latest snapshot within this window that has real values
    const inWindow = relevantHistory.filter((h) => {
      const t = new Date(h.ts).getTime();
      return t >= windowStart && t < windowEnd;
    });
    const latestInWindow = inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;

    if (latestInWindow) {
      // SAFETY: Only compute delta when BOTH endpoints have real values.
      // If either is null, the delta is null (unknown), not zero.
      const viewsDelta = (latestInWindow.views != null && baseline.views != null)
        ? Math.max(0, latestInWindow.views - baseline.views)
        : null;
      const subsDelta = (latestInWindow.subs != null && baseline.subs != null)
        ? latestInWindow.subs - baseline.subs
        : null;

      // Determine status:
      // - Both metrics null → partial (snapshot exists but no usable values)
      // - One metric null → partial
      // - Both are exactly 0 → likely monitoring gap (stale API returned same totals)
      // - Otherwise → confirmed real movement
      let status: 'confirmed' | 'missing' | 'partial';
      if (viewsDelta == null && subsDelta == null) {
        status = 'partial';
      } else if (viewsDelta == null || subsDelta == null) {
        status = 'partial';
      } else if (viewsDelta === 0 && subsDelta === 0) {
        // Both metrics show exactly zero change — almost certainly a monitoring gap
        // in an active campaign (genuine zero growth in both is near-impossible)
        status = 'missing';
      } else {
        status = 'confirmed';
      }

      windows.push({
        week: weekNum,
        views7d: viewsDelta,
        subs7d: subsDelta,
        status,
      });
      baseline = latestInWindow; // carry forward for next week
    } else {
      // No snapshot this week at all — emit a missing entry to preserve timeline continuity
      if (windowStart < Date.now()) {
        windows.push({
          week: weekNum,
          views7d: null,
          subs7d: null,
          status: 'missing',
        });
      } else {
        break; // future weeks — stop
      }
    }
    weekNum++;
    windowStart = windowEnd;
    // Stop if we've gone past the last snapshot + 1 week
    if (windowStart > new Date(relevantHistory[relevantHistory.length - 1].ts).getTime() + 7 * 86400000) break;
  }
  return windows;
}
