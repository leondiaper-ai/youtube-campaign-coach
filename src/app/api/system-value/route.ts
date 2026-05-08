import { NextResponse } from 'next/server';
import {
  ARTISTS, mergeArtistLists, isManaged, deriveFromLive, classifyArtist,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps } from '@/lib/kvCache';
import { readHistory } from '@/lib/snapshots';
import { normalizeChannelData, rawDelta } from '@/lib/youtube/normalizeChannelData';
import { computeSystemValue, type SystemValueSummary } from '@/lib/valueModel';

export const revalidate = 600;

/**
 * GET /api/system-value
 * Returns aggregated value summary across all managed artists,
 * grouped by classification. Uses ONLY KV cache —
 * zero YouTube API calls.
 */
export async function GET() {
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const managed = allArtists.filter(isManaged);

    // Batch-read all cached snaps from KV
    const handles = managed
      .map((a) => a.channelHandle)
      .filter(Boolean) as string[];
    const snapMap = await readAllLiveSnaps(handles);

    const artistData = await Promise.all(
      managed.map(async (a) => {
        const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;

        if (!snap || !snap.channelId || snap.error) {
          return {
            views7d: 0, subs7d: 0, uploads30d: 0,
            channelState: 'COLD' as const,
            classification: 'COLD' as const,
          };
        }

        const history = await readHistory(snap.channelId);
        const nc = normalizeChannelData(snap, history);

        const derived = deriveFromLive(snap, {
          subs7Delta: rawDelta(nc.subs7d),
          views7Delta: rawDelta(nc.views7d),
        });
        const status = derived?.status ?? 'COLD';

        return {
          views7d: rawDelta(nc.views7d) ?? 0,
          subs7d: rawDelta(nc.subs7d) ?? 0,
          uploads30d: nc.cadence.uploads30d,
          channelState: status,
          classification: classifyArtist(status, nc.cadence.uploads30d),
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
