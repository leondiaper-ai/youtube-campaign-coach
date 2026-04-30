import Link from 'next/link';
import {
  ARTISTS, mergeArtistLists, daysSince, deriveFromLive,
  STATUS_RANK, classifyArtist, isVirginOwned,
  type Artist, type ChannelState,
} from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { readAllLiveSnaps, readSyncMeta } from '@/lib/kvCache';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import ChannelHealthBoard, { type RowData } from '@/components/ChannelHealthBoard';

export const revalidate = 600;

export const metadata = {
  title: 'Channel Health — YouTube Campaign System',
  description: 'Which channels are growing, flat, or at risk.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';

export default async function ControlPage() {
  const custom = await listCustomArtists();
  const allArtists = mergeArtistLists(ARTISTS, custom);
  const syncMeta = await readSyncMeta();

  // Batch-read all cached snaps from KV (zero YouTube API calls)
  const handles = allArtists
    .map((a) => a.channelHandle)
    .filter(Boolean) as string[];
  const snapMap = await readAllLiveSnaps(handles);

  const rows: RowData[] = await Promise.all(
    allArtists.map(async (a) => {
      const snap = a.channelHandle ? (snapMap.get(a.channelHandle) ?? null) : null;
      const history =
        snap?.channelId && !snap.error ? await readHistory(snap.channelId) : [];
      const subs7 = deltaOver(history, 7, 'subs');
      const views7 = deltaOver(history, 7, 'views');
      const subs14 = deltaOver(history, 14, 'subs');
      const views14 = deltaOver(history, 14, 'views');

      // Week-on-week: compare this 7d vs previous 7d
      const prevSubsDelta = subs14 && subs7 ? subs14.delta - subs7.delta : null;
      const prevViewsDelta = views14 && views7 ? views14.delta - views7.delta : null;
      const subsWoW = prevSubsDelta != null && prevSubsDelta !== 0 && subs7
        ? ((subs7.delta - prevSubsDelta) / Math.abs(prevSubsDelta)) * 100 : null;
      const viewsWoW = prevViewsDelta != null && prevViewsDelta !== 0 && views7
        ? ((views7.delta - prevViewsDelta) / Math.abs(prevViewsDelta)) * 100 : null;

      const uploads30d = snap?.uploads30d ?? 0;
      const subsSeries = seriesForField(history, 'subs', 30);
      const derived = snap ? deriveFromLive(snap, {
        subs7Delta: subs7?.delta ?? null,
        views7Delta: views7?.delta ?? null,
      }) : null;
      const status: ChannelState = derived?.status ?? 'COLD';
      const classification = classifyArtist(status, uploads30d);
      const reason = derived?.reason ?? 'No cached data yet';

      return {
        slug: a.slug,
        name: a.name,
        isVirgin: isVirginOwned(a),
        subs: snap?.subs ?? null,
        subs7Delta: subs7?.delta ?? null,
        views7Delta: views7?.delta ?? null,
        subsWoW,
        viewsWoW,
        uploads30d,
        shorts30d: snap?.shorts30d ?? 0,
        status,
        classification,
        reason,
        subsSeries,
      };
    })
  );

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
              YouTube Campaign System
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span
                className="px-3 py-1.5 rounded-md text-[13px] font-black"
                style={{ background: SOFT }}
              >
                Channel Health
              </span>
              <Link
                href="/cockpit"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                All Artists
              </Link>
              <Link
                href="/campaigns"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                Active Campaigns
              </Link>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 mt-2 text-right">
            {syncMeta ? (
              <>
                <span>Last sync: {new Date(syncMeta.lastSyncAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <br />
                <span className="text-ink/20">{syncMeta.artistsSuccess}/{syncMeta.artistsTotal} artists · from cache</span>
              </>
            ) : (
              <span>No sync data yet</span>
            )}
          </span>
        </div>

        {/* Client-side board with toggle */}
        <ChannelHealthBoard rows={rows} />

        {/* Navigation flow */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px]">
          <span className="font-black text-ink/60 px-3 py-1.5 rounded-md" style={{ background: SOFT }}>
            Channel Health
          </span>
          <span className="text-ink/25">→</span>
          <Link href="/campaigns" className="font-bold text-ink/40 hover:text-ink/70 px-3 py-1.5 rounded-md hover:bg-[#F6F1E7] transition-colors">
            Active Campaigns
          </Link>
          <span className="text-ink/25">→</span>
          <span className="font-bold text-ink/30 px-3 py-1.5">
            Coach (per artist)
          </span>
        </div>

        <div className="mt-8 text-[10px] uppercase tracking-[0.18em] text-ink/25">
          Channel Health watches · Watcher diagnoses · Coach plans
        </div>
      </div>
    </main>
  );
}
