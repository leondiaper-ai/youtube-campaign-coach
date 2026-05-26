import { listEntries } from '@/lib/teamWatcherStore';
import { readLiveSnap } from '@/lib/kvCache';
import { deriveFromLive } from '@/lib/artists';
import TeamWatcherBoard, { type EnrichedEntry } from '@/components/TeamWatcherBoard';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Team YouTube Watcher',
  description: 'Shared team view — monitor channel health and campaign progress.',
};

const PAPER = '#FAF7F2';

export default async function TeamWatcherPage() {
  const entries = await listEntries();

  // Enrich with cached YouTube data — NO API calls, cache reads only
  const enriched: EnrichedEntry[] = await Promise.all(
    entries.map(async (entry) => {
      const snap = await readLiveSnap(entry.channelId);
      const youtube = snap
        ? {
            subs: snap.subs ?? null,
            views: snap.views ?? null,
            uploads30d: snap.uploads30d ?? null,
            shorts30d: snap.shorts30d ?? null,
            lastUploadAt: snap.lastUploadAt ?? null,
            thumbnail: snap.thumbnail ?? null,
            cachedAt: (snap as Record<string, unknown>).cachedAt as string | null ?? null,
          }
        : null;
      const health = snap ? deriveFromLive(snap) : null;
      return { ...entry, youtube, health };
    }),
  );

  return (
    <main className="min-h-screen" style={{ background: PAPER }}>
      <div className="max-w-[800px] mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/"
          style={{
            fontSize: 11,
            color: '#8A847A',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-block',
            marginBottom: 16,
          }}
        >
          ← Home
        </Link>

        <TeamWatcherBoard initialEntries={enriched} />
      </div>
    </main>
  );
}
