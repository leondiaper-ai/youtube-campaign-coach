import { NextResponse } from 'next/server';
import {
  ARTISTS, mergeArtistLists, isManaged, deriveFromLive, classifyArtist,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps } from '@/lib/kvCache';
import { readHistory, deltaOver } from '@/lib/snapshots';
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
        const subs7 = deltaOver(history, 7, 'subs');
        const views7 = deltaOver(history, 7, 'views');
        const uploads30d = snap.uploads30d ?? 0;

        const derived = deriveFromLive(snap, {
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
