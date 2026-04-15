export type Status = 'READY' | 'FIX FIRST' | 'ACTIVE BUT WEAK' | 'BUILDING' | 'MOMENTUM' | 'ALWAYS ON';

export type Artist = {
  slug: string;
  name: string;
  campaign: string;
  phase: 'PRE' | 'START' | 'RELEASE' | 'PUSH' | 'PEAK' | 'SUSTAIN';
  status: Status;
  nextMomentLabel: string;
  nextMomentDate: string;
  watcherRead: string;
  nextAction: string;
  subs: string;
  views30d: string;
  uploads30d: number;
  channelHandle?: string;
  lastCheckedMinsAgo: number;
};

export const ARTISTS: Artist[] = [
  {
    slug: 'ezra-collective',
    name: 'Ezra Collective',
    campaign: 'Album Cycle — TBD',
    phase: 'PRE',
    status: 'FIX FIRST',
    nextMomentLabel: 'Pre-campaign channel setup',
    nextMomentDate: '2026-04-22',
    watcherRead: 'Quiet 38 days. Trailer outdated.',
    nextAction: 'Refresh trailer & playlists before announce.',
    subs: '312K',
    views30d: '1.4M',
    uploads30d: 0,
    channelHandle: '@ezracollective',
    lastCheckedMinsAgo: 35,
  },
  {
    slug: 'k-trap',
    name: 'K-Trap',
    campaign: 'Change — Single Cycle',
    phase: 'PUSH',
    status: 'MOMENTUM',
    nextMomentLabel: 'PUSH content drop',
    nextMomentDate: '2026-04-19',
    watcherRead: 'Change at 1.2M, +18% week.',
    nextAction: 'Cut a BTS Short for drop day.',
    subs: '142K',
    views30d: '4.6M',
    uploads30d: 7,
    channelHandle: '@ktrap',
    lastCheckedMinsAgo: 120,
  },
  {
    slug: 'tom-odell',
    name: 'Tom Odell',
    campaign: 'Tour Announce',
    phase: 'START',
    status: 'BUILDING',
    nextMomentLabel: 'Tour announce video',
    nextMomentDate: '2026-04-28',
    watcherRead: 'Catalogue strong. No uploads in 21d.',
    nextAction: 'Schedule announce teaser + pinned post.',
    subs: '1.1M',
    views30d: '3.2M',
    uploads30d: 1,
    channelHandle: '@tomodell',
    lastCheckedMinsAgo: 240,
  },
  {
    slug: 'bad-omens',
    name: 'Bad Omens',
    campaign: 'Festival Run',
    phase: 'PEAK',
    status: 'ACTIVE BUT WEAK',
    nextMomentLabel: 'Coachella weekend recap',
    nextMomentDate: '2026-04-20',
    watcherRead: 'Watch-time flat 7d. Shorts gap.',
    nextAction: 'Cut 3 Shorts from festival within 24h.',
    subs: '2.4M',
    views30d: '5.8M',
    uploads30d: 5,
    channelHandle: 'UCre_5futd_kGkrSlL83n3pw',
    lastCheckedMinsAgo: 55,
  },
  {
    slug: 'james-blake',
    name: 'James Blake',
    campaign: 'Catalogue Sustain',
    phase: 'SUSTAIN',
    status: 'READY',
    nextMomentLabel: 'Live session premiere',
    nextMomentDate: '2026-05-02',
    watcherRead: 'Premieres converting 32%. Holding cadence.',
    nextAction: 'Schedule next premiere window.',
    subs: '895K',
    views30d: '2.1M',
    uploads30d: 3,
    channelHandle: '@jamesblake',
    lastCheckedMinsAgo: 18,
  },
];

export const STATUS_RANK: Record<Status, number> = {
  'FIX FIRST': 0,
  'ACTIVE BUT WEAK': 1,
  'BUILDING': 2,
  'MOMENTUM': 3,
  'READY': 4,
  'ALWAYS ON': 5,
};

export const STATUS_COLOR: Record<Status, { bg: string; fg: string; dot: string }> = {
  'READY':            { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  'MOMENTUM':         { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  'BUILDING':         { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'ACTIVE BUT WEAK':  { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  'FIX FIRST':        { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
  'ALWAYS ON':        { bg: '#EEECE6', fg: '#3A3A3A', dot: '#8A8A8A' },
};

export type RecentUpload = {
  id: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  live: 'none' | 'upcoming' | 'live';
  scheduledStart: string | null;
};

export type LiveSnap = {
  channelId?: string;
  title?: string;
  handle?: string;
  subs?: number;
  views?: number;
  uploads30d?: number;
  lastUploadAt?: string | null;
  thumbnail?: string;
  recentUploads?: RecentUpload[];
  shorts30d?: number;
  upcomingCount?: number;
  error?: string;
};

export type Derived = {
  status: Status;
  watcherRead: string;
  nextAction: string;
  objective?: string;
  impact?: string;
};

export type DeriveCtx = {
  daysToNextMoment?: number | null;
  phase?: Artist['phase'];
};

export function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function deriveFromLive(live: LiveSnap, ctx: DeriveCtx = {}): Derived | null {
  if (live.subs == null) return null;
  const u = live.uploads30d ?? 0;
  const last = daysSince(live.lastUploadAt);

  // Out-of-cycle: no near-term moment and channel is cold → ALWAYS ON
  const outOfCycle =
    (ctx.daysToNextMoment == null || ctx.daysToNextMoment > 21) &&
    (ctx.phase === 'SUSTAIN' || ctx.phase === 'PRE' || ctx.phase == null);
  if (outOfCycle && (last == null || last > 21 || u <= 1)) {
    return {
      status: 'ALWAYS ON',
      watcherRead:
        last != null
          ? `Out of cycle. Last upload ${last}d ago.`
          : 'Out of cycle. No recent uploads.',
      nextAction:
        'Post 2 Shorts from catalogue · recut top track vertical · 1 community post.',
      objective: 'Keep channel warm ahead of next moment.',
      impact: 'Maintains baseline momentum and lifts the next release.',
    };
  }

  if (last == null || last > 30 || u === 0) {
    return {
      status: 'FIX FIRST',
      watcherRead: last != null ? `Quiet ${last}d. ${u} uploads/30d.` : 'No upload data.',
      nextAction: 'Ship something this week.',
    };
  }
  if (last > 14 && u < 2) {
    return {
      status: 'ACTIVE BUT WEAK',
      watcherRead: `Only ${u} uploads/30d. Last ${last}d ago.`,
      nextAction: 'Add a Short or Premiere this week.',
    };
  }
  if (u >= 5 && last <= 3) {
    return {
      status: 'MOMENTUM',
      watcherRead: `${u} uploads/30d. Last ${last}d ago.`,
      nextAction: 'Layer a Short on the next drop.',
    };
  }
  if (u >= 2 && last <= 14) {
    return {
      status: 'BUILDING',
      watcherRead: `${u} uploads/30d. Building cadence.`,
      nextAction: 'Lock weekly cadence.',
    };
  }
  return {
    status: 'READY',
    watcherRead: `${u} uploads/30d. Cadence holding.`,
    nextAction: 'Hold cadence — schedule next moment.',
  };
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}
