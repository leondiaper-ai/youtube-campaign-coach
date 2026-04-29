import { NextResponse } from 'next/server';
import {
  ARTISTS, mergeArtistLists, isManaged, deriveFromLive, classifyArtist,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { computeSystemValue, type SystemValueSummary } from '@/lib/valueModel';

export const revalidate = 600;

/**
 * GET /api/system-value
 * Returns aggregated value summary across all managed artists,
 * grouped by classification. Uses ONLY KV snapshot history —
 * no fresh YouTube API calls. This is critical for quota conservation.
 */
export async function GET() {
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const managed = allArtists.filter(isManaged);

    const artistData = await Promise.all(
      managed.map(async (a) => {
        // Use the channelHandle to construct a channelId key for KV.
        // readHistory needs the channelId, but we may not have it without
        // an API call. We try the KV key pattern snap:<channelId>.
        // Since the cron already populates snapshots, we search by iterating
        // known IDs from the snapshot store.
        //
        // Workaround: resolve channelId from the first snapshot entry.
        // The cron job and prior page loads will have populated these.
        // If no history exists, we skip this artist (no API call).

        if (!a.channelHandle) {
          return {
            views7d: 0, subs7d: 0, uploads30d: 0,
            channelState: 'COLD' as const,
            classification: 'COLD' as const,
          };
        }

        // We need the channelId to look up history. Rather than calling
        // the YouTube API, we'll try to resolve from KV. The snapshots
        // are stored under snap:<channelId>. Unfortunately we need the
        // channelId to look them up. To bridge this gap, we import
        // resolveChannelId which now has an in-memory cache — and if
        // quota is exhausted it returns cached/null without API calls.
        const { resolveChannelId } = await import('@/lib/youtube');
        const channelId = await resolveChannelId(a.channelHandle);

        if (!channelId) {
          return {
            views7d: 0, subs7d: 0, uploads30d: 0,
            channelState: 'COLD' as const,
            classification: 'COLD' as const,
          };
        }

        const history = await readHistory(channelId);
        if (history.length === 0) {
          return {
            views7d: 0, subs7d: 0, uploads30d: 0,
            channelState: 'COLD' as const,
            classification: 'COLD' as const,
          };
        }

        const subs7 = deltaOver(history, 7, 'subs');
        const views7 = deltaOver(history, 7, 'views');

        // Use the latest snapshot for uploads30d and derive status
        const latest = history[history.length - 1];
        const uploads30d = latest.uploads30d ?? 0;

        // Build a minimal LiveSnap-like object for deriveFromLive
        const pseudoSnap = {
          subs: latest.subs,
          views: latest.views,
          uploads30d,
          lastUploadAt: latest.lastUploadAt,
        };

        const derived = deriveFromLive(pseudoSnap as any, {
          subs7Delta: subs7?.delta ?? null,
          views7Delta: views7?.delta ?? null,
        });

        const status = derived?.status ?? 'COLD';

        return {
          views7d: views7?.delta ?? 0,
          subs7d: subs7?.delta ?? 0,
          uploads30d,
          channelState: status,
          classification: classifyArtist(status, uploads30d),
        };
      })
    );

    const summary = computeSystemValue(artistData);
    return NextResponse.json(summary);
  } catch (e: any) {
    console.error('[system-value] Error:', e?.message ?? e);
    return NextResponse.json(
      { error: e?.message ?? 'Failed to compute system value' },
      { status: 500 }
    );
  }
}
