import Link from 'next/link';
import { ARTISTS, fmtNum, daysSince, type Artist } from '@/lib/artists';
import { listCustomArtists } from '@/lib/artistStore';
import { listPinned, listNotes, type PinnedCampaign, type CampaignNote } from '@/lib/campaignStore';
import { fetchChannelSnap } from '@/lib/youtube';
import { readHistory, deltaOver, campaignDelta } from '@/lib/snapshots';
import { deriveFromLive, type ChannelState, STATUS_COLOR } from '@/lib/artists';
import ActiveCampaignsClient from '@/components/ActiveCampaignsClient';

export const revalidate = 600;

export const metadata = {
  title: 'Active Campaigns — YouTube Campaign System',
  description: 'Focused operational workspace for pinned campaigns.',
};

const INK = '#0E0E0E';
const PAPER = '#FAF7F2';
const SOFT = '#F6F1E7';

type CampaignCardData = {
  slug: string;
  name: string;
  channelHandle?: string;
  campaign?: string;
  campaignStartDate?: string | null;
  phase: Artist['phase'];
  pinnedAt: string;
  priority: 'high' | 'normal';
  // Live metrics
  subs: number | null;
  views: number | null;
  subs7Delta: number | null;
  views7Delta: number | null;
  subs30Delta: number | null;
  campaignSubsDelta: number | null;
  campaignViewsDelta: number | null;
  campaignDays: number | null;
  uploadsLast30d: number;
  daysSinceUpload: number | null;
  state: ChannelState | null;
  stateReason: string | null;
  nextAction: string | null;
  // Signal / blocker
  signal: string | null;
  blocker: string | null;
  // Notes
  notes: CampaignNote[];
};

async function loadCampaignCard(
  pin: PinnedCampaign,
  allArtists: Artist[],
): Promise<CampaignCardData | null> {
  const artist = allArtists.find((a) => a.slug === pin.slug);
  if (!artist) return null;

  const handle = artist.channelHandle ?? artist.name;
  if (!handle || !process.env.YOUTUBE_API_KEY) {
    return {
      slug: artist.slug,
      name: artist.name,
      channelHandle: artist.channelHandle,
      campaign: artist.campaign,
      campaignStartDate: artist.campaignStartDate ?? null,
      phase: artist.phase,
      pinnedAt: pin.pinnedAt,
      priority: pin.priority ?? 'normal',
      subs: null, views: null,
      subs7Delta: null, views7Delta: null, subs30Delta: null,
      campaignSubsDelta: null, campaignViewsDelta: null, campaignDays: null,
      uploadsLast30d: 0, daysSinceUpload: null,
      state: null, stateReason: null, nextAction: null,
      signal: null, blocker: null,
      notes: await listNotes(artist.slug),
    };
  }

  const snap = await fetchChannelSnap(handle);
  if (!snap || snap.error) {
    return {
      slug: artist.slug,
      name: artist.name,
      channelHandle: artist.channelHandle,
      campaign: artist.campaign,
      campaignStartDate: artist.campaignStartDate ?? null,
      phase: artist.phase,
      pinnedAt: pin.pinnedAt,
      priority: pin.priority ?? 'normal',
      subs: null, views: null,
      subs7Delta: null, views7Delta: null, subs30Delta: null,
      campaignSubsDelta: null, campaignViewsDelta: null, campaignDays: null,
      uploadsLast30d: 0, daysSinceUpload: null,
      state: null, stateReason: 'Could not fetch live data', nextAction: null,
      signal: null, blocker: null,
      notes: await listNotes(artist.slug),
    };
  }

  const history = snap.channelId ? await readHistory(snap.channelId) : [];
  const subs7 = deltaOver(history, 7, 'subs');
  const subs30 = deltaOver(history, 30, 'subs');
  const views7 = deltaOver(history, 7, 'views');

  const campStart = artist.campaignStartDate ?? null;
  const campSubs = campStart ? campaignDelta(history, campStart, 'subs') : null;
  const campViews = campStart ? campaignDelta(history, campStart, 'views') : null;
  const campaignDays = campStart
    ? Math.floor((Date.now() - new Date(campStart).getTime()) / 86400000)
    : null;

  const derived = deriveFromLive(snap, { phase: artist.phase });

  // Determine signal & blocker
  let signal: string | null = null;
  let blocker: string | null = null;

  if (subs7 && subs7.delta > 0) {
    signal = `+${fmtNum(subs7.delta)} subs this week`;
  } else if (views7 && views7.delta > 50000) {
    signal = `+${fmtNum(views7.delta)} views this week`;
  }

  const lastDays = daysSince(snap.lastUploadAt);
  if (lastDays != null && lastDays > 14) {
    blocker = `No uploads in ${lastDays} days`;
  } else if ((snap.uploads30d ?? 0) < 2) {
    blocker = 'Low upload cadence — under 2 in 30 days';
  }

  return {
    slug: artist.slug,
    name: artist.name,
    channelHandle: artist.channelHandle,
    campaign: artist.campaign,
    campaignStartDate: campStart,
    phase: artist.phase,
    pinnedAt: pin.pinnedAt,
    priority: pin.priority ?? 'normal',
    subs: snap.subs ?? null,
    views: snap.views ?? null,
    subs7Delta: subs7?.delta ?? null,
    views7Delta: views7?.delta ?? null,
    subs30Delta: subs30?.delta ?? null,
    campaignSubsDelta: campSubs?.delta ?? null,
    campaignViewsDelta: campViews?.delta ?? null,
    campaignDays,
    uploadsLast30d: snap.uploads30d ?? 0,
    daysSinceUpload: lastDays,
    state: derived?.status ?? null,
    stateReason: derived?.reason ?? null,
    nextAction: derived?.nextAction ?? null,
    signal,
    blocker,
    notes: await listNotes(artist.slug),
  };
}

export default async function CampaignsPage() {
  const pinned = await listPinned();
  const custom = await listCustomArtists();
  const allArtists = [...ARTISTS, ...custom].filter(
    (a, i, arr) => arr.findIndex((x) => x.slug === a.slug) === i,
  );

  // Load data for each pinned campaign in parallel
  const cards = (
    await Promise.all(pinned.map((p) => loadCampaignCard(p, allArtists)))
  ).filter((c): c is CampaignCardData => c !== null);

  // Sort: high priority first, then by pinned date
  cards.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
  });

  // Available artists for the "Add" dropdown (not already pinned)
  const pinnedSlugs = new Set(pinned.map((p) => p.slug));
  const available = allArtists.filter((a) => !pinnedSlugs.has(a.slug));

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, color: INK, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-5xl mx-auto px-5 py-8">
        {/* Header + nav */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink/45">
              YouTube Campaign System
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Link
                href="/growth"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                Channel Health
              </Link>
              <Link
                href="/cockpit"
                className="px-3 py-1.5 rounded-md text-[13px] font-bold text-ink/50 hover:text-ink hover:bg-[#F6F1E7] transition-colors"
              >
                All Artists
              </Link>
              <span
                className="px-3 py-1.5 rounded-md text-[13px] font-black"
                style={{ background: SOFT }}
              >
                Active Campaigns
              </span>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink/35 mt-2">
            Live · YouTube API
          </span>
        </div>

        <div className="text-[13px] text-ink/50 mb-6">
          Pinned campaigns you&apos;re actively working. Each card pulls live data.
        </div>

        {/* Client component handles interactions */}
        <ActiveCampaignsClient
          initialCards={cards}
          availableArtists={available.map((a) => ({ slug: a.slug, name: a.name }))}
        />
      </div>
    </div>
  );
}
