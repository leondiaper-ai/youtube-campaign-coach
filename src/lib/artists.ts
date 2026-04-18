// ─────────────────────────────────────────────────────────────────────────────
// 4-STATE CHANNEL SYSTEM — one state, one reason, one action. No ambiguity.
// ─────────────────────────────────────────────────────────────────────────────
export type ChannelState = 'HEALTHY' | 'BUILDING' | 'AT RISK' | 'COLD';

/** @deprecated Use ChannelState instead. Kept only for type compatibility during migration. */
export type Status = ChannelState;

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

export const STATUS_RANK: Record<ChannelState, number> = {
  'COLD': 0,
  'AT RISK': 1,
  'BUILDING': 2,
  'HEALTHY': 3,
};

export const STATUS_COLOR: Record<ChannelState, { bg: string; fg: string; dot: string }> = {
  'HEALTHY':   { bg: '#E6F8EE', fg: '#0C6A3F', dot: '#1FBE7A' },
  'BUILDING':  { bg: '#FFF5D6', fg: '#7A5A00', dot: '#FFD24C' },
  'AT RISK':   { bg: '#FFEAD6', fg: '#8A4A1A', dot: '#F08A3C' },
  'COLD':      { bg: '#FFE2D8', fg: '#8A1F0C', dot: '#FF4A1C' },
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
  status: ChannelState;
  reason: string;     // one-line WHY for this state
  nextAction: string; // one clear action
  watcherRead: string;
};

export type DeriveCtx = {
  daysToNextMoment?: number | null;
  phase?: Artist['phase'];
};

export function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * Derive ONE clear channel state from live YouTube data.
 *
 * Rules (in priority order):
 *  COLD       → 0 uploads in 60+ days (or no data at all)
 *  AT RISK    → 0 uploads in 30 days, OR active but very sparse (<2 in 30d with gap >14d)
 *  BUILDING   → Some activity but inconsistent (2-4 uploads/30d, or gap >7d)
 *  HEALTHY    → Consistent uploads (5+ in 30d and posted within last 7d)
 */
export function deriveFromLive(live: LiveSnap, ctx: DeriveCtx = {}): Derived | null {
  if (live.subs == null) return null;
  const u = live.uploads30d ?? 0;
  const last = daysSince(live.lastUploadAt);

  // ── COLD: silent channel ──────────────────────────────────────────────
  if (last == null || last >= 60 || (u === 0 && (last == null || last >= 30))) {
    const reason = last != null
      ? `No uploads in ${last} days`
      : 'No upload data';
    return {
      status: 'COLD',
      reason,
      watcherRead: reason,
      nextAction: 'Post 2 Shorts from catalogue this week',
    };
  }

  // ── AT RISK: channel cooling off ──────────────────────────────────────
  if (u === 0 || (last > 30) || (u < 2 && last > 14)) {
    const reason = u === 0
      ? `No uploads in 30 days`
      : `Only ${u} upload${u === 1 ? '' : 's'} in 30 days — channel cooling off`;
    return {
      status: 'AT RISK',
      reason,
      watcherRead: reason,
      nextAction: u === 0
        ? 'Ship something this week — a Short or Community Post'
        : 'Add a Short or Premiere this week to rebuild cadence',
    };
  }

  // ── HEALTHY: consistent output ────────────────────────────────────────
  if (u >= 5 && last <= 7) {
    const reason = `Strong output — ${u} uploads in 30 days`;
    return {
      status: 'HEALTHY',
      reason,
      watcherRead: reason,
      nextAction: 'Maintain cadence — layer a Short on the next drop',
    };
  }

  // ── BUILDING: active but inconsistent ─────────────────────────────────
  const reason = last > 7
    ? `${u} uploads in 30 days — last upload ${last}d ago`
    : `${u} uploads in 30 days — building cadence`;
  return {
    status: 'BUILDING',
    reason,
    watcherRead: reason,
    nextAction: u >= 3
      ? 'Lock weekly cadence — aim for 5+ uploads per month'
      : 'Increase output — post 2 Shorts this week',
  };
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}
