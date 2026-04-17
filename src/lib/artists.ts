export type Status = 'READY' | 'FIX FIRST' | 'ACTIVE BUT WEAK' | 'BUILDING' | 'MOMENTUM' | 'ALWAYS ON';

/**
 * Core Artist record.
 *
 * IMPORTANT: this is intentionally minimal. Everything about the channel
 * (subs, views, uploads, cadence, status, watcher reads, next actions) comes
 * from the live YouTube Data API via fetchChannelSnap(). Campaign info
 * (nextMomentLabel/Date, campaign name) comes from a live Coach plan. No
 * fake strings are stored here.
 */
export type Artist = {
  slug: string;
  name: string;
  channelHandle?: string;
  phase: 'PRE' | 'START' | 'RELEASE' | 'PUSH' | 'PEAK' | 'SUSTAIN';
  // Optional plan metadata — present only when a real Coach timeline exists.
  campaign?: string;
  nextMomentLabel?: string;
  nextMomentDate?: string;
  // Marks this artist as user-added (vs a built-in seed entry).
  custom?: boolean;
};

export const ARTISTS: Artist[] = [
  {
    slug: 'ezra-collective',
    name: 'Ezra Collective',
    phase: 'PRE',
    channelHandle: '@ezracollective',
  },
  {
    slug: 'k-trap',
    name: 'K-Trap',
    phase: 'PUSH',
    channelHandle: '@ktrap',
  },
  {
    slug: 'tom-odell',
    name: 'Tom Odell',
    phase: 'START',
    channelHandle: '@tomodell',
  },
  {
    slug: 'bad-omens',
    name: 'Bad Omens',
    phase: 'PEAK',
    channelHandle: 'UCre_5futd_kGkrSlL83n3pw',
  },
  {
    slug: 'james-blake',
    name: 'James Blake',
    phase: 'SUSTAIN',
    channelHandle: '@jamesblake',
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

export type TopComment = {
  text: string;
  likeCount: number;
  authorName: string;
};

export type RecentUpload = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSec: number;
  live: 'none' | 'upcoming' | 'live';
  scheduledStart: string | null;
  captions: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  hasLyricSibling?: boolean;
  hasVisualizerSibling?: boolean;
  hasAudioSibling?: boolean;
  hasShortSibling?: boolean;
  isTopPerformer?: boolean;
  topComments?: TopComment[];
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
  topEverVideos?: RecentUpload[];
  shorts30d?: number;
  upcomingCount?: number;
  captionsMissing30d?: number;
  missingCaptionsVideos?: { id: string; title: string; viewCount: number }[];
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
