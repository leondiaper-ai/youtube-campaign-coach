import Link from 'next/link';
import { ARTISTS, fmtNum, daysSince, deriveFromLive, STATUS_COLOR, type Artist, type ChannelState } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { listPinned, listNotes, type PinnedCampaign, type CampaignNote } from '@/lib/campaignStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver, seriesForField } from '@/lib/snapshots';
import CampaignStatusBoard from '@/components/CampaignStatusBoard';

export const revalidate = 600;

export const metadata = {
  title: 'Campaign Status Board',
  description: 'Live campaign status at a glance.',
};

const PAPER = '#FAF7F2';
const INK = '#0E0E0E';

// ── Board uses the unified 5-state ChannelState from artists.ts ─────────────

function cadenceLine(uploads30d: number): string {
  if (uploads30d >= 10) return `Strong cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 3) return `Moderate cadence — ${uploads30d} uploads / 30d`;
  if (uploads30d >= 1) return `Light cadence — ${uploads30d} upload${uploads30d === 1 ? '' : 's'} / 30d`;
  return 'No recent cadence';
}

// ── Card data shape (serializable to client) ────────────────────────────────
export type StatusCardData = {
  slug: string;
  name: string;
  campaign?: string;
  pinnedAt: string;
  priority: 'high' | 'normal';
  // Hero metrics
  subs7Delta: number | null;
  views7Delta: number | null;
  // Unified status from deriveFromLive
  boardStatus: ChannelState;
  diagnosis: string;
  actions: string[];
  cadenceLine: string;
  // Sparkline (30d subs series)
  sparkline: { x: number; y: number }[];
  // Notes
  notes: CampaignNote[];
};

async function loadCard(
  pin: PinnedCampaign,
  allArtists: Artist[],
): Promise<StatusCardData | null> {
  const artist = allArtists.find((a) => a.slug === pin.slug);
  if (!artist) return null;

  const base: StatusCardData = {
    slug: artist.slug,
    name: artist.name,
    campaign: artist.campaign,
    pinnedAt: pin.pinnedAt,
    priority: pin.priority ?? 'normal',
    subs7Delta: null,
    views7Delta: null,
    boardStatus: 'COLD',
    diagnosis: 'No data yet',
    actions: ['Reawaken the page with 2–3 catalogue Shorts this week'],
    cadenceLine: cadenceLine(0),
    sparkline: [],
    notes: await listNotes(artist.slug),
  };

  const handle = artist.channelHandle ?? artist.name;
  if (!handle || !process.env.YOUTUBE_API_KEY) return base;

  const snap = await fetchChannelSnap(handle);
  if (!snap || snap.error) return { ...base, diagnosis: 'Could not fetch live data' };

  const history = snap.channelId ? await readHistory(snap.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const views7 = deltaOver(history, 7, 'views');
  const sparkline = seriesForField(history, 'subs', 30);

  const derived = deriveFromLive(snap, {
    subs7Delta: subs7?.delta ?? null,
    views7Delta: views7?.delta ?? null,
    phase: artist.phase,
  });

  return {
    ...base,
    subs7Delta: subs7?.delta ?? null,
    views7Delta: views7?.delta ?? null,
    boardStatus: derived?.status ?? 'COLD',
    diagnosis: derived?.reason ?? 'No data',
    actions: [derived?.nextAction ?? 'Ship something this week'],
    cadenceLine: cadenceLine(snap.uploads30d ?? 0),
    sparkline,
  };
}

export default async function CampaignsPage() {
  const pinned = await listPinned();
  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom].filter(
    (a, i, arr) => arr.findIndex((x) => x.slug === a.slug) === i,
  );

  const cards = (
    await Promise.all(pinned.map((p) => loadCard(p, allArtists)))
  ).filter((c): c is StatusCardData => c !== null);

  cards.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
  });

  const pinnedSlugs = new Set(pinned.map((p) => p.slug));
  const available = allArtists.filter((a) => !pinnedSlugs.has(a.slug));

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40 mb-1">
              YouTube Campaign System
            </div>
            <h1 className="font-black text-[28px] leading-tight">Campaign Status Board</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/cockpit"
              className="text-[11px] uppercase tracking-[0.14em] text-ink/35 hover:text-ink/60 transition-colors"
            >
              All Artists
            </Link>
            <span className="text-[10px] text-ink/20">·</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink/25">Live</span>
          </div>
        </div>

        <CampaignStatusBoard
          initialCards={cards}
          availableArtists={available.map((a) => ({ slug: a.slug, name: a.name }))}
        />
      </div>
    </div>
  );
}
