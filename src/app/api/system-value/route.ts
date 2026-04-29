import { NextResponse } from 'next/server';
import {
  ARTISTS, mergeArtistLists, isManaged, deriveFromLive, classifyArtist,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver } from '@/lib/snapshots';
import { computeSystemValue, type SystemValueSummary } from '@/lib/valueModel';

export const revalidate = 600;

/**
 * GET /api/system-value
 * Returns aggregated value summary across all managed artists,
 * grouped by classification. Used by client-side pages that need
 * system-level value data without replicating server-side computation.
 */
export async function GET() {
  try {
    const custom = await listCustomArtists();
    const allArtists = mergeArtistLists(ARTISTS, custom);
    const managed = allArtists.filter(isManaged);

    const artistData = await Promise.all(
      managed.map(async (a) => {
        const snap = a.channelHandle ? await fetchChannelSnap(a.channelHandle) : null;
        const history =
          snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
        const subs7 = deltaOver(history, 7, 'subs');
        const views7 = deltaOver(history, 7, 'views');
        const derived = snap
          ? deriveFromLive(snap, {
              subs7Delta: subs7?.delta ?? null,
              views7Delta: views7?.delta ?? null,
            })
          : null;
        const status = derived?.status ?? 'COLD';
        const uploads30d = snap?.uploads30d ?? 0;
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
    return NextResponse.json(
      { error: e?.message ?? 'Failed to compute system value' },
      { status: 500 }
    );
  }
}
