import Link from 'next/link';
import { ARTISTS, fmtNum, daysSince, type Artist } from '@/lib/artists';
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

// ── Board-level status: considers conversion, not just cadence ──────────────
export type BoardStatus =
  | 'HEALTHY'
  | 'PUSH — WEAK CONVERSION'
  | 'BUILDING'
  | 'COLD'
  | 'FIX';

export type BoardStatusStyle = { bg: string; fg: string };

export const BOARD_STATUS_STYLE: Record<BoardStatus, BoardStatusStyle> = {
  HEALTHY:                  { bg: '#E6F8EE', fg: '#0C6A3F' },
  'PUSH — WEAK CONVERSION': { bg: '#FFEAD6', fg: '#8A4A1A' },
  BUILDING:                 { bg: '#FFF5D6', fg: '#7A5A00' },
  COLD:                     { bg: '#FFE2D8', fg: '#8A1F0C' },
  FIX:                      { bg: '#FFE2D8', fg: '#8A1F0C' },
};

type BoardDecision = {
  status: BoardStatus;
  diagnosis: string;         // WHY — one sentence
  actions: string[];         // WHAT TO DO — 1-2 actions
  cadenceLine: string;       // single cadence summary
};

function deriveBoardDecision(
  views7Delta: number | null,
  subs7Delta: number | null,
  uploadsLast30d: number,
  daysSinceUpload: number | null,
  uploadsLast7d: number,
): BoardDecision {
  const cadenceLine =
    uploadsLast30d >= 10
      ? `Strong cadence — ${uploadsLast30d} uploads / 30d`
      : uploadsLast30d >= 3
        ? `Moderate cadence — ${uploadsLast30d} uploads / 30d`
        : uploadsLast30d >= 1
          ? `Light cadence — ${uploadsLast30d} upload${uploadsLast30d === 1 ? '' : 's'} / 30d`
          : 'No recent cadence';

  // ── COLD: no activity ──
  if (daysSinceUpload == null || daysSinceUpload >= 60 || (uploadsLast30d === 0 && daysSinceUpload >= 30)) {
    return {
      status: 'COLD',
      diagnosis: daysSinceUpload != null
        ? `No uploads in ${daysSinceUpload} days. The channel is inactive and the algorithm has stopped distributing.`
        : 'No upload data available. Cannot assess campaign state.',
      actions: [
        'Reawaken the page with 2–3 support pieces this week — catalogue Shorts, BTS, or artist-led clips.',
      ],
      cadenceLine,
    };
  }

  // ── FIX: structural issue ──
  if (uploadsLast30d === 0 || (daysSinceUpload > 21 && uploadsLast30d < 2)) {
    return {
      status: 'FIX',
      diagnosis: uploadsLast30d === 0
        ? 'No uploads in 30 days. Cadence has collapsed — the algorithm will deprioritise this channel.'
        : `Only ${uploadsLast30d} upload in 30 days with a ${daysSinceUpload}-day gap. Cadence is broken.`,
      actions: [
        'Lock weekly cadence before the next release window. Start with 2 Shorts from existing catalogue this week.',
      ],
      cadenceLine,
    };
  }

  const viewsUp = views7Delta != null && views7Delta > 0;
  const subsFlat = subs7Delta == null || subs7Delta <= 0;
  const subsUp = subs7Delta != null && subs7Delta > 0;
  const viewsStrong = views7Delta != null && views7Delta > 10000;

  // ── PUSH — WEAK CONVERSION: views converting but subs not ──
  if (viewsStrong && subsFlat && uploadsLast30d >= 3) {
    return {
      status: 'PUSH — WEAK CONVERSION',
      diagnosis: 'High output is driving views, but subscriber growth is flat. Content is reaching people but not building connection.',
      actions: [
        'Go deeper, not wider. Post a breakdown, BTS, studio moment, or artist-led context piece around the active content.',
        uploadsLast7d >= 2
          ? 'Prioritise depth formats over additional Shorts this week.'
          : 'Add a deeper format alongside your next Short.',
      ],
      cadenceLine,
    };
  }

  // ── BUILDING: early momentum, not enough evidence ──
  if (uploadsLast30d < 5 || (uploadsLast30d >= 3 && !viewsStrong)) {
    const buildDiag = viewsUp
      ? 'Activity is starting to generate views, but cadence needs to stay consistent for the algorithm to commit.'
      : 'Cadence is light. The algorithm needs consistent activity before it starts distributing.';
    return {
      status: 'BUILDING',
      diagnosis: buildDiag,
      actions: [
        uploadsLast30d < 3
          ? 'Add 2–3 Shorts this week to establish consistent cadence.'
          : 'Maintain cadence and layer a support format around the next release.',
      ],
      cadenceLine,
    };
  }

  // ── HEALTHY: cadence and conversion both look good ──
  if (viewsUp && subsUp && uploadsLast30d >= 5) {
    return {
      status: 'HEALTHY',
      diagnosis: 'Cadence and conversion are both positive. The algorithm is distributing and viewers are subscribing.',
      actions: [
        'Maintain current approach — don\'t add complexity while it\'s working.',
      ],
      cadenceLine,
    };
  }

  // ── Fallback: moderate activity, mixed signals ──
  if (viewsUp && subsFlat) {
    return {
      status: 'PUSH — WEAK CONVERSION',
      diagnosis: 'Views are growing but subscribers are not following. The content is discoverable but not compelling enough to convert.',
      actions: [
        'Add a deeper content piece: track breakdown, studio session, or artist-led moment.',
      ],
      cadenceLine,
    };
  }

  // Default to BUILDING if we can't clearly classify
  return {
    status: 'BUILDING',
    diagnosis: viewsUp
      ? 'Views are positive but evidence is thin. Keep cadence consistent and monitor conversion.'
      : 'Limited signals. Maintain output and build enough data for a clearer read next week.',
    actions: [
      'Stay consistent. Post 2–3 pieces this week to maintain momentum.',
    ],
    cadenceLine,
  };
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
  // Board decision
  boardStatus: BoardStatus;
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

  const defaultDecision = deriveBoardDecision(null, null, 0, null, 0);
  const base: StatusCardData = {
    slug: artist.slug,
    name: artist.name,
    campaign: artist.campaign,
    pinnedAt: pin.pinnedAt,
    priority: pin.priority ?? 'normal',
    subs7Delta: null,
    views7Delta: null,
    boardStatus: defaultDecision.status,
    diagnosis: defaultDecision.diagnosis,
    actions: defaultDecision.actions,
    cadenceLine: defaultDecision.cadenceLine,
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
  const lastDays = daysSince(snap.lastUploadAt);
  const sparkline = seriesForField(history, 'subs', 30);

  // Count uploads in last 7 days from recentUploads
  const now = Date.now();
  const uploads7d = (snap.recentUploads ?? []).filter(
    (u) => (now - new Date(u.publishedAt).getTime()) / 86400000 <= 7,
  ).length;

  const decision = deriveBoardDecision(
    views7?.delta ?? null,
    subs7?.delta ?? null,
    snap.uploads30d ?? 0,
    lastDays,
    uploads7d,
  );

  return {
    ...base,
    subs7Delta: subs7?.delta ?? null,
    views7Delta: views7?.delta ?? null,
    boardStatus: decision.status,
    diagnosis: decision.diagnosis,
    actions: decision.actions,
    cadenceLine: decision.cadenceLine,
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
