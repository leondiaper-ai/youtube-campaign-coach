'use client';

import { useState, useEffect, useRef } from 'react';

// ── Design System ────────────────────────────────────────────────────────────

const INK    = '#0E0E0E';
const PAPER  = '#FAF7F2';
const SMOKE  = '#8A847A';
const GHOST  = '#C8C2B8';
const BONE   = '#E8E3DA';
const WHITE  = '#FFFFFF';
const WARM   = '#4A4640';
const YT_RED = '#FF0000';

const ACCENT = {
  green:  '#2D6A4F',
  amber:  '#9A6324',
  ochre:  '#7A6520',
  ember:  '#8A3A2A',
};

// ── Types ────────────────────────────────────────────────────────────────────

type PulseChannel = {
  slug: string; name: string; isVirgin: boolean; channelHandle: string | null;
  subs: number | null; totalViews: number | null; views7d: number | null; subs7d: number | null;
  viewsWoW: number | null; subsWoW: number | null;
  uploads30d: number; shorts30d: number; longform30d: number;
  lastUploadAt: string | null; lastUploadDaysAgo: number | null; thumbnail: string | null;
  phase: string; campaign: string | null; campaignStartDate: string | null;
  status: string; classification: string; reason: string; nextAction: string;
  watcherRead: string; cadenceLabel: string; subsPer1kViews: number | null;
};

type PulseVideo = {
  id: string; title: string; channelName: string; artistSlug: string;
  viewCount: number; likeCount: number; commentCount: number;
  publishedAt: string; durationSec: number; format: string;
  thumbnail: string; velocity: number; daysAgo: number;
};

type Playbook = { title: string; why: string; when: string; actions: string[] };

type PulseData = {
  weekRange: string; generatedAt: string; lastSyncAt: string | null;
  signals: { growing: number; weakConversion: number; underfed: number; cold: number; totalManaged: number; totalMarket: number; total: number };
  managedChannels: PulseChannel[]; marketChannels: PulseChannel[];
  topVideos: PulseVideo[]; topShorts: PulseVideo[];
  rollups: unknown[]; editorial: string; insights: string[];
  playbook: Playbook; marketInsights: string[];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 7) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function ytUrl(id: string, dur: number): string {
  return dur <= 62 ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

function channelUrl(handle: string | null): string | null {
  if (!handle) return null;
  const h = handle.startsWith('@') ? handle : `@${handle}`;
  return `https://www.youtube.com/${h}`;
}

// ── Official Logo Components ─────────────────────────────────────────────────

/** Virgin Music logo — official brand PNG */
function VirginMusicLogo({ height = 36 }: { height?: number }) {
  return (
    <img
      src="/virgin-music-logo.png"
      alt="Virgin Music"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

/** YouTube logo — official play icon PNG + wordmark */
function YouTubeLogo({ height = 20 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.35 }}>
      <img
        src="/youtube-icon.png"
        alt=""
        style={{ height, width: 'auto', display: 'block' }}
      />
      <span style={{
        fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: height * 0.85,
        color: INK,
        letterSpacing: '-0.02em',
      }}>
        YouTube
      </span>
    </div>
  );
}

/** Small play icon for thumbnail overlays */
function PlayOverlay({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <svg width={size * 0.35} height={size * 0.4} viewBox="0 0 10 12" fill="none">
        <polygon points="0,0 10,6 0,12" fill={WHITE} />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyPulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'internal' | 'partner'>('internal');
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [slackCopied, setSlackCopied] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/weekly-pulse')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST }}>
        Preparing briefing
      </div>
    </main>
  );

  if (error || !data) return (
    <main style={{ background: PAPER, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: SMOKE }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Failed to load</div>
        <div style={{ fontSize: 11 }}>{error}</div>
      </div>
    </main>
  );

  const isPartner = viewMode === 'partner';
  const managed = data.managedChannels;
  const market = data.marketChannels;

  // Derived
  const momentumChannels = managed.filter(c => c.classification === 'GROWING')
    .sort((a, b) => (b.views7d ?? 0) - (a.views7d ?? 0)).slice(0, 5);
  const issueChannels = managed.filter(c => c.classification !== 'GROWING');
  type IssueGroup = { label: string; id: string; count: number; topChannels: PulseChannel[] };
  const issueGroups: IssueGroup[] = [
    { label: 'Audience Growth Opportunity', id: 'pulse-conversion', count: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').length, topChannels: issueChannels.filter(c => c.classification === 'WEAK_CONVERSION').slice(0, 4) },
    { label: 'Cadence Building', id: 'pulse-cadence', count: issueChannels.filter(c => c.classification === 'UNDERFED').length, topChannels: issueChannels.filter(c => c.classification === 'UNDERFED').slice(0, 4) },
    { label: 'Catalogue Reawakening', id: 'pulse-reactivation', count: issueChannels.filter(c => c.classification === 'COLD').length, topChannels: issueChannels.filter(c => c.classification === 'COLD').slice(0, 4) },
  ].filter(g => g.count > 0);

  const consistentMarket = market.filter(c => c.uploads30d >= 5 && c.classification === 'GROWING')
    .sort((a, b) => b.uploads30d - a.uploads30d).slice(0, 4);

  // Diverse Moments selection: max 1 video per artist so smaller acts surface
  const diverseVideos: PulseVideo[] = [];
  const videosPerArtist = new Map<string, number>();
  for (const v of data.topVideos) {
    const count = videosPerArtist.get(v.artistSlug) ?? 0;
    if (count < 1) {
      diverseVideos.push(v);
      videosPerArtist.set(v.artistSlug, count + 1);
    }
    if (diverseVideos.length >= 4) break;
  }
  const featureVideo = diverseVideos[0] ?? null;
  const supportingVideos = diverseVideos.slice(1, 4);
  // Diverse Shorts selection: 1 per artist first, then backfill up to 3 per artist, cap at 9
  const topShorts: PulseVideo[] = [];
  const shortsPerArtist = new Map<string, number>();
  const shortsDeferred: PulseVideo[] = [];
  // First pass: best 1 from each artist
  for (const v of data.topShorts) {
    const count = shortsPerArtist.get(v.artistSlug) ?? 0;
    if (count < 1) {
      topShorts.push(v);
      shortsPerArtist.set(v.artistSlug, count + 1);
    } else {
      shortsDeferred.push(v);
    }
    if (topShorts.length >= 9) break;
  }
  // Second pass: allow up to 3 per artist to fill remaining slots
  if (topShorts.length < 9) {
    for (const v of shortsDeferred) {
      const count = shortsPerArtist.get(v.artistSlug) ?? 0;
      if (count < 3) {
        topShorts.push(v);
        shortsPerArtist.set(v.artistSlug, count + 1);
      }
      if (topShorts.length >= 9) break;
    }
  }

  // Build slug→channelHandle lookup for linking video artist names to their YT channels
  const allChannels = [...managed, ...market];
  const slugToHandle = new Map<string, string>();
  allChannels.forEach(ch => { if (ch.channelHandle) slugToHandle.set(ch.slug, ch.channelHandle); });

  // Build name→URL lookup for linkifying artist names in editorial copy
  const nameToUrl = new Map<string, string>();
  allChannels.forEach(ch => {
    if (ch.channelHandle) {
      const url = channelUrl(ch.channelHandle);
      if (url) nameToUrl.set(ch.name, url);
    }
  });
  // Sort names longest-first so "Tove Lo" matches before "Lo" etc.
  const sortedNames = Array.from(nameToUrl.keys()).sort((a, b) => b.length - a.length);

  /** Scan a plain string for known artist names → return React nodes with YT links */
  function linkifyArtists(text: string): (string | JSX.Element)[] {
    if (sortedNames.length === 0) return [text];
    // Filter out very short names (≤3 chars) to avoid false matches inside words
    const safeNames = sortedNames.filter(n => n.length > 3);
    if (safeNames.length === 0) return [text];
    const escaped = safeNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Use word-boundary-like anchors: match only when surrounded by non-letter chars
    const re = new RegExp(`((?:^|(?<=[^a-zA-Z]))(?:${escaped.join('|')})(?=[^a-zA-Z]|$))`, 'g');
    const result: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }
      const name = match[1];
      const url = nameToUrl.get(name);
      if (url) {
        result.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
            className="pulse-link"
            style={{ color: INK, fontWeight: 700, textDecoration: 'underline', textDecorationColor: GHOST, textUnderlineOffset: '2px' }}>
            {name}
          </a>
        );
      } else {
        result.push(name);
      }
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }
    return result.length > 0 ? result : [text];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EDITORIAL INTELLIGENCE LAYER
  // Campaigns are selected for momentum, rollout behaviour and YouTube
  // strategy signals — not raw scale.
  // ══════════════════════════════════════════════════════════════════════════

  const allVideos = [...data.topVideos, ...data.topShorts];
  const videosBySlug = new Map<string, PulseVideo[]>();
  allVideos.forEach(v => {
    const arr = videosBySlug.get(v.artistSlug) ?? [];
    arr.push(v);
    videosBySlug.set(v.artistSlug, arr);
  });

  // ── Signal 1: Follow-Through Score ──
  // Did the campaign keep posting after a major release?
  type FollowThrough = 'strong' | 'some' | 'release-only' | 'unknown';
  function assessFollowThrough(ch: PulseChannel, vids: PulseVideo[]): FollowThrough {
    if (vids.length === 0) return 'unknown';
    // Find the "anchor" — the oldest video in the 14-day window (likely the official release)
    const sorted = [...vids].sort((a, b) => b.daysAgo - a.daysAgo);
    const anchor = sorted[0];
    if (!anchor) return 'unknown';
    // Count uploads that came after the anchor (within 7-10 days of it)
    const followUps = vids.filter(v => v.id !== anchor.id && v.daysAgo < anchor.daysAgo);
    if (followUps.length >= 3) return 'strong';
    if (followUps.length >= 1) return 'some';
    if (vids.length === 1) return 'release-only';
    return 'unknown';
  }

  // ── Signal 2: Multiformat Strategy Score ──
  // How diverse is the content rollout?
  type MultiformatLevel = 'full-rollout' | 'strong-followthrough' | 'ecosystem-build' | 'multiformat-active' | 'shorts-led' | 'thin';
  type FormatBreakdown = {
    hasShorts: boolean; hasOfficialVideo: boolean; hasBTS: boolean;
    hasVisualiser: boolean; hasLyric: boolean; hasLive: boolean;
    hasPremiere: boolean; hasFollowUp: boolean; richCount: number;
    formatTypes: string[];
  };

  function detectFormats(ch: PulseChannel, vids: PulseVideo[]): FormatBreakdown {
    const hasShorts = ch.shorts30d >= 2 || vids.some(v => v.format === 'Short');
    const titles = vids.map(v => v.title.toLowerCase());
    const formats = vids.map(v => v.format.toLowerCase());
    const all = [...titles, ...formats];

    const hasOfficialVideo = all.some(t => t.includes('official') || t.includes('music video'));
    const hasBTS = all.some(t => t.includes('bts') || t.includes('behind') || t.includes('making of') || t.includes('making-of'));
    const hasVisualiser = all.some(t => t.includes('visualis') || t.includes('visualiz'));
    const hasLyric = all.some(t => t.includes('lyric'));
    const hasLive = all.some(t => t.includes('live') || t.includes('session') || t.includes('performance') || t.includes('acoustic'));
    const hasPremiere = all.some(t => t.includes('premiere'));
    // Follow-up = more than 1 upload in the window
    const hasFollowUp = vids.length >= 2;

    const formatTypes: string[] = [];
    if (hasShorts) formatTypes.push('Shorts');
    if (hasOfficialVideo) formatTypes.push('official video');
    if (hasBTS) formatTypes.push('BTS');
    if (hasVisualiser) formatTypes.push('visualiser');
    if (hasLyric) formatTypes.push('lyric video');
    if (hasLive) formatTypes.push('live session');
    if (hasPremiere) formatTypes.push('premiere');
    if (hasFollowUp) formatTypes.push('follow-up uploads');

    const richCount = [hasOfficialVideo, hasBTS, hasVisualiser, hasLyric, hasLive, hasPremiere].filter(Boolean).length;

    return { hasShorts, hasOfficialVideo, hasBTS, hasVisualiser, hasLyric, hasLive, hasPremiere, hasFollowUp, richCount, formatTypes };
  }

  function assessMultiformat(ch: PulseChannel, vids: PulseVideo[]): MultiformatLevel {
    const f = detectFormats(ch, vids);
    const hasLongform = ch.longform30d >= 1;

    // Full Rollout: Shorts + longform + 3+ rich format types + follow-up content
    if (f.hasShorts && hasLongform && f.richCount >= 2 && f.hasFollowUp && ch.uploads30d >= 5) return 'full-rollout';
    // Strong Follow-Through: good follow-up output with some format diversity
    if (f.hasFollowUp && hasLongform && f.richCount >= 1 && ch.uploads30d >= 4) return 'strong-followthrough';
    // Ecosystem Build: Shorts + longform working together, building depth
    if (f.hasShorts && hasLongform && f.richCount >= 1) return 'ecosystem-build';
    // Multiformat Active: has multiple format types present
    if (f.hasShorts && hasLongform) return 'multiformat-active';
    // Shorts-Led: heavy Shorts, limited depth
    if (f.hasShorts && !hasLongform && ch.shorts30d >= 3) return 'shorts-led';
    return 'thin';
  }

  // Human-readable multiformat label for editorial use
  function multiformatLabel(level: MultiformatLevel): string {
    switch (level) {
      case 'full-rollout': return 'Full Rollout';
      case 'strong-followthrough': return 'Strong Follow-Through';
      case 'ecosystem-build': return 'Ecosystem Build';
      case 'multiformat-active': return 'Multiformat Active';
      case 'shorts-led': return 'Shorts-Led';
      case 'thin': return 'Thin Rollout';
    }
  }

  // ── Signal 3: Momentum Efficiency ──
  // Outperforming relative to channel size, not raw views
  type MomentumEfficiency = 'outperforming' | 'on-pace' | 'underperforming' | 'unknown';
  function assessMomentumEfficiency(ch: PulseChannel): MomentumEfficiency {
    const views7 = ch.views7d ?? 0;
    const totalViews = ch.totalViews ?? 0;
    const subs = ch.subs ?? 0;
    if (views7 === 0 || totalViews === 0) return 'unknown';
    // Views-to-subs ratio: a small channel pulling strong weekly views is outperforming
    const weeklyViewsPerSub = subs > 0 ? views7 / subs : 0;
    const wow = ch.viewsWoW ?? 0;
    const strongConversion = (ch.subsPer1kViews ?? 0) >= 3;
    // Outperforming: high views/sub ratio OR strong WoW growth + good conversion
    if (weeklyViewsPerSub >= 0.5 || (wow >= 20 && strongConversion)) return 'outperforming';
    if (weeklyViewsPerSub >= 0.15 || wow >= 5) return 'on-pace';
    return 'underperforming';
  }

  // ── Signal 4: Reactivation Signal ──
  // Channels that were cold but started posting again
  type ReactivationState = 'reactivating' | 'reawakening' | 'dormant' | 'not-applicable';
  function assessReactivation(ch: PulseChannel): ReactivationState {
    // Only relevant for channels that aren't already classified as growing
    if (ch.classification === 'GROWING') return 'not-applicable';
    const wasCold = ch.classification === 'COLD';
    const recentUpload = (ch.lastUploadDaysAgo ?? 999) <= 10;
    const hasCadence = ch.uploads30d >= 2;
    if (wasCold && recentUpload && hasCadence) return 'reactivating';
    if (wasCold && recentUpload) return 'reawakening';
    if (wasCold) return 'dormant';
    return 'not-applicable';
  }

  // ── Signal 5: Shorts-to-Longform Signal ──
  // Is Shorts discovery supported by deeper viewing paths?
  type ShortsLongform = 'discovery-converting' | 'discovery-depth-needed' | 'longform-led' | 'shorts-only' | 'balanced';
  function assessShortsLongform(ch: PulseChannel): ShortsLongform {
    const hasShorts = ch.shorts30d >= 2;
    const hasLongform = ch.longform30d >= 1;
    const strongConversion = (ch.subsPer1kViews ?? 0) >= 2;
    if (hasShorts && hasLongform && strongConversion) return 'discovery-converting';
    if (hasShorts && hasLongform) return 'balanced';
    if (hasShorts && !hasLongform) {
      return strongConversion ? 'shorts-only' : 'discovery-depth-needed';
    }
    if (!hasShorts && hasLongform) return 'longform-led';
    return 'balanced';
  }

  // Helper: is this a strong multiformat rollout? (top 3 tiers)
  function isStrongMultiformat(level: MultiformatLevel): boolean {
    return level === 'full-rollout' || level === 'strong-followthrough' || level === 'ecosystem-build';
  }

  // ── Signal 6: Campaign Distinctiveness ──
  // How unusual or interesting is this channel's behaviour?
  function distinctivenessScore(ch: PulseChannel, vids: PulseVideo[]): number {
    let d = 0;
    const wow = ch.viewsWoW ?? 0;
    const efficiency = assessMomentumEfficiency(ch);
    const followThrough = assessFollowThrough(ch, vids);
    const multiformat = assessMultiformat(ch, vids);
    const reactivation = assessReactivation(ch);

    if (wow >= 30) d += 15;                          // sudden growth
    if ((ch.subsPer1kViews ?? 0) >= 5) d += 15;     // unusually strong conversion
    if (ch.uploads30d >= 6 && (ch.subs ?? 0) < 50000) d += 10; // strong cadence, smaller channel
    if (isStrongMultiformat(multiformat)) d += 10;    // standout multiformat rollout
    if (followThrough === 'strong') d += 10;         // strong follow-through
    if (reactivation === 'reactivating') d += 15;    // reactivation after inactivity
    if (efficiency === 'outperforming') d += 10;     // overperforming vs size
    return d;
  }

  // ── Composite Campaign Score ──
  // Behaviour-led signals can surface interesting stories alongside manual tags
  type ChannelSignals = {
    followThrough: FollowThrough;
    multiformat: MultiformatLevel;
    efficiency: MomentumEfficiency;
    reactivation: ReactivationState;
    shortsLongform: ShortsLongform;
    distinctiveness: number;
  };

  function analyseChannel(ch: PulseChannel): ChannelSignals {
    const vids = videosBySlug.get(ch.slug) ?? [];
    return {
      followThrough: assessFollowThrough(ch, vids),
      multiformat: assessMultiformat(ch, vids),
      efficiency: assessMomentumEfficiency(ch),
      reactivation: assessReactivation(ch),
      shortsLongform: assessShortsLongform(ch),
      distinctiveness: distinctivenessScore(ch, vids),
    };
  }

  function campaignScore(ch: PulseChannel, signals: ChannelSignals): number {
    let s = 0;
    // Manual tags still matter
    if (ch.campaign) s += 25;
    if (ch.phase === 'PUSH') s += 20;
    // Classification
    if (ch.classification === 'GROWING') s += 25;
    // Cadence health
    if (ch.uploads30d >= 4) s += 15;
    // Behaviour-led signals
    if (signals.multiformat === 'full-rollout') s += 30;
    else if (isStrongMultiformat(signals.multiformat)) s += 25;
    else if (signals.multiformat === 'multiformat-active') s += 12;
    if (signals.followThrough === 'strong') s += 25;
    else if (signals.followThrough === 'some') s += 10;
    // Conversion
    if ((ch.subsPer1kViews ?? 0) >= 3) s += 20;
    else if ((ch.subsPer1kViews ?? 0) >= 1.5) s += 8;
    // Momentum efficiency — rewards outperforming vs size
    if (signals.efficiency === 'outperforming') s += 20;
    else if (signals.efficiency === 'on-pace') s += 8;
    // Week-over-week
    if ((ch.viewsWoW ?? 0) > 20) s += 15;
    else if ((ch.viewsWoW ?? 0) > 5) s += 6;
    // Recent activity
    if ((ch.lastUploadDaysAgo ?? 999) <= 7) s += 10;
    // Has strong visual asset
    if ((videosBySlug.get(ch.slug)?.length ?? 0) > 0) s += 10;
    // Reactivation — interesting narrative
    if (signals.reactivation === 'reactivating') s += 10;
    // Shorts-to-longform health
    if (signals.shortsLongform === 'discovery-converting') s += 15;
    else if (signals.shortsLongform === 'balanced') s += 8;
    // Distinctiveness bonus
    s += signals.distinctiveness;
    return s;
  }

  // ── Editorial Copy Generation ──
  // Uses the full signal set to produce richer, more specific observations

  function generateObservation(ch: PulseChannel, sig: ChannelSignals): string {
    const growing = ch.classification === 'GROWING';
    const inPush = ch.phase === 'PUSH';
    const wow = ch.viewsWoW ?? 0;

    // Reactivation stories — supportive, forward-looking
    if (sig.reactivation === 'reactivating') {
      return `Back in motion. Fresh content reconnecting with the catalogue audience — early signs of momentum returning.`;
    }
    if (sig.reactivation === 'reawakening') {
      return `Fresh content landing. The existing audience is there — new uploads starting to reactivate the catalogue.`;
    }
    // Strong follow-through + multiformat = the ideal story
    if (sig.followThrough === 'strong' && isStrongMultiformat(sig.multiformat)) {
      return `Strong follow-through with multiformat depth. Shorts, longform and supporting content keeping the campaign visible well beyond drop day.`;
    }
    if (sig.followThrough === 'strong' && growing) {
      return `Post-release follow-through sustaining reach. Continued uploads extending the campaign window — the pattern that keeps recommendation signals active.`;
    }
    // Efficiency stories
    if (sig.efficiency === 'outperforming' && !growing) {
      return `Engagement running ahead of channel size — the strategy is resonating beyond the existing audience.`;
    }
    if (sig.efficiency === 'outperforming' && growing) {
      return `Growth and engagement both outpacing baseline. The campaign is compounding.`;
    }
    // Shorts-to-longform narratives
    if (sig.shortsLongform === 'discovery-converting') {
      return `Shorts discovery converting into deeper engagement. The short-to-long pipeline is working.`;
    }
    if (sig.shortsLongform === 'discovery-depth-needed') {
      return `Shorts generating real discovery energy. Longform next would create a deeper audience path.`;
    }
    // Multiformat stories
    if (isStrongMultiformat(sig.multiformat) && inPush) {
      return `Active campaign with a rich content ecosystem. Multiple formats sustaining attention across the rollout.`;
    }
    if (sig.multiformat === 'full-rollout') {
      return `Full rollout in motion — Shorts, official video, supporting content all working as one ecosystem.`;
    }
    if (isStrongMultiformat(sig.multiformat)) {
      return `Diverse format strategy building audience depth. Shorts and supporting content working alongside the official video.`;
    }
    // In-campaign with push phase
    if (inPush && growing && sig.followThrough !== 'release-only') {
      return `Active rollout, sustained output. Cadence supporting discovery through the campaign window.`;
    }
    if (inPush && sig.followThrough === 'release-only') {
      return `Campaign anchor landed. Follow-through content — BTS, clips, reactions — would extend reach beyond release week.`;
    }
    // Strong conversion stories
    if ((ch.subsPer1kViews ?? 0) >= 4 && growing) {
      return `Strongest conversion signals this week. Identity and cadence compounding with each upload.`;
    }
    if ((ch.subsPer1kViews ?? 0) >= 3) {
      return `Efficient audience conversion. Content resonating deeply — quality over scale.`;
    }
    // High cadence + momentum
    if (ch.uploads30d >= 6 && growing && wow > 15) {
      return `Consistent output driving week-over-week gains. Cadence compounding audience depth.`;
    }
    // Shorts-led
    if (sig.shortsLongform === 'shorts-only' && growing) {
      return `Shorts-led discovery building well. Longform next would deepen the audience relationship.`;
    }
    // Longform-led
    if (sig.shortsLongform === 'longform-led' && growing) {
      return `Longform resonating well. Shorts could expand into broader discovery.`;
    }
    // General growing
    if (growing && wow > 10) {
      return `Steady growth with week-over-week gains. Audience responding to campaign continuity.`;
    }
    if (growing) {
      return `Growth signals building. Strategy beginning to compound.`;
    }
    // Fallback — always forward-looking
    if (ch.uploads30d >= 3) {
      return `Active output this week. Building foundation for the next phase.`;
    }
    return `Ecosystem developing. Strategy and cadence shaping the next opportunity.`;
  }

  function generateSignalTag(ch: PulseChannel, sig: ChannelSignals): string {
    if (sig.reactivation === 'reactivating') return 'Building Back';
    if (sig.reactivation === 'reawakening') return 'Reawakening';
    if (sig.multiformat === 'full-rollout') return 'Full Rollout';
    if (sig.followThrough === 'strong' && isStrongMultiformat(sig.multiformat)) return 'Full Rollout';
    if (sig.efficiency === 'outperforming') return 'Outpacing';
    if (sig.shortsLongform === 'discovery-converting') return 'Discovery → Depth';
    if (ch.classification === 'GROWING' && (ch.viewsWoW ?? 0) > 20) return 'Accelerating';
    if (isStrongMultiformat(sig.multiformat)) return 'Ecosystem';
    if (sig.followThrough === 'strong') return 'Strong Follow-Through';
    if (ch.classification === 'GROWING') return 'Building Momentum';
    if (ch.phase === 'PUSH') return 'In Campaign';
    if ((ch.subsPer1kViews ?? 0) >= 3) return 'Audience Deepening';
    if (ch.uploads30d >= 6) return 'High Cadence';
    if ((ch.lastUploadDaysAgo ?? 999) <= 3) return 'Just Dropped';
    return 'Active';
  }

  function generateOpportunity(ch: PulseChannel, sig: ChannelSignals): string {
    if (sig.followThrough === 'release-only') {
      return 'Opportunity: follow-through content — BTS, clips, reactions — to extend the campaign beyond release week.';
    }
    if (sig.shortsLongform === 'discovery-depth-needed') {
      return 'Opportunity: longform to create a deeper path from Shorts discovery.';
    }
    if (sig.shortsLongform === 'longform-led') {
      return 'Opportunity: Shorts to expand discovery for this already-engaged audience.';
    }
    if (sig.multiformat === 'thin') {
      return 'Opportunity: format diversity to extend campaign life.';
    }
    if (sig.multiformat === 'shorts-led') {
      return 'Opportunity: longform and supporting formats to deepen the audience relationship.';
    }
    if (sig.reactivation === 'reactivating') {
      return 'Opportunity: sustained cadence to build on this early momentum.';
    }
    if (sig.reactivation === 'reawakening') {
      return 'Opportunity: consistent uploads to reconnect with the existing catalogue audience.';
    }
    if (sig.efficiency === 'outperforming' && (ch.viewsWoW ?? 0) > 15) {
      return 'Opportunity: sustain cadence — the efficiency is there and compounding.';
    }
    if (ch.classification === 'WEAK_CONVERSION') {
      return 'Opportunity: deeper content — artist-led context, BTS, longform — to turn discovery into lasting audience.';
    }
    if (ch.classification === 'UNDERFED') {
      return 'Opportunity: cadence building to unlock the next growth phase.';
    }
    if ((ch.viewsWoW ?? 0) > 25) {
      return 'Opportunity: sustain output and format diversity while momentum is building.';
    }
    return 'Opportunity: keep building the content ecosystem.';
  }

  // ── Assemble campaign stories ──
  type CampaignStory = {
    channel: PulseChannel;
    signals: ChannelSignals;
    heroImage: string;
    signal: string;
    observation: string;
    opportunity: string;
  };

  // ── Hero eligibility: minimum scale for main placement ──
  // At least ONE of: 50K+ weekly views, 10K+ subs, active priority campaign, or major release
  const heroEligible = (ch: PulseChannel) =>
    (ch.views7d ?? 0) >= 50000 ||
    (ch.subs ?? 0) >= 10000 ||
    ch.campaign != null ||
    ch.phase === 'PUSH' || ch.phase === 'RELEASE';

  // ── Emerging Ecosystem Winner: best small artist ──
  const emergingWinner = managed
    .filter(ch => ch.thumbnail && !heroEligible(ch) && ch.uploads30d >= 3 && (ch.subs7d ?? 0) > 0)
    .map(ch => ({ ch, sig: analyseChannel(ch), score: campaignScore(ch, analyseChannel(ch)) }))
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const campaignStories: CampaignStory[] = managed
    .filter(ch => ch.thumbnail && heroEligible(ch))
    .map(ch => {
      const sig = analyseChannel(ch);
      return { ch, sig, score: campaignScore(ch, sig) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ ch, sig }) => {
      const chVideos = videosBySlug.get(ch.slug) ?? [];
      const bestVideo = [...chVideos].sort((a, b) => b.velocity - a.velocity)[0];
      const heroImage = bestVideo
        ? `https://i.ytimg.com/vi/${bestVideo.id}/hqdefault.jpg`
        : ch.thumbnail!;
      return {
        channel: ch,
        signals: sig,
        heroImage,
        signal: generateSignalTag(ch, sig),
        observation: generateObservation(ch, sig),
        opportunity: generateOpportunity(ch, sig),
      };
    });

  const featuredCampaign = campaignStories[0] ?? null;
  const secondaryCampaigns = campaignStories.slice(1, 4);

  // ── Best Multiformat Rollouts — editorial highlights ──
  // Surface campaigns with strong ecosystem behaviour, celebrate smart YouTube strategy
  const multiformatHighlights = managed
    .filter(ch => ch.thumbnail)
    .map(ch => {
      const sig = analyseChannel(ch);
      const vids = videosBySlug.get(ch.slug) ?? [];
      const fb = detectFormats(ch, vids);
      return { channel: ch, signals: sig, formats: fb };
    })
    .filter(({ signals }) =>
      signals.multiformat === 'full-rollout' ||
      signals.multiformat === 'strong-followthrough' ||
      signals.multiformat === 'ecosystem-build' ||
      signals.multiformat === 'multiformat-active'
    )
    .sort((a, b) => {
      const tierOrder: Record<MultiformatLevel, number> = {
        'full-rollout': 4, 'strong-followthrough': 3, 'ecosystem-build': 2,
        'multiformat-active': 1, 'shorts-led': 0, 'thin': 0,
      };
      return tierOrder[b.signals.multiformat] - tierOrder[a.signals.multiformat];
    })
    .slice(0, 3)
    .map(({ channel, signals, formats }) => {
      // Build a concise format description
      const activeFormats = formats.formatTypes.slice(0, 4).join(', ');
      // Generate a one-line editorial read
      let read = '';
      if (signals.multiformat === 'full-rollout') {
        read = `${activeFormats} extending momentum beyond release day.`;
      } else if (signals.multiformat === 'strong-followthrough') {
        read = `Consistent follow-through with ${activeFormats} sustaining audience engagement.`;
      } else if (signals.multiformat === 'ecosystem-build') {
        read = `Building content depth with ${activeFormats} across the campaign.`;
      } else {
        read = `${activeFormats} working together to broaden the campaign surface.`;
      }
      return {
        channel,
        label: multiformatLabel(signals.multiformat),
        read,
        formatTypes: formats.formatTypes,
      };
    });

  function generateEmailBody(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `${v.channelName} — "${v.title}" (${fmtNum(v.viewCount)} views)`);
    return `Subject: YouTube Pulse — ${data!.weekRange}\n\n${data!.editorial}\n\nTop moments:\n${topVids.map(v => `- ${v}`).join('\n')}\n\nSignals: ${data!.signals.growing} growing · ${data!.signals.cold} reawakening · ${data!.signals.weakConversion} audience building\n\nPlaybook: ${data!.playbook.title}`;
  }
  function generateSlackSummary(): string {
    const topVids = data!.topVideos.slice(0, 3).map(v => `• ${v.channelName} — ${fmtNum(v.viewCount)} views`);
    return `*YouTube Pulse — ${data!.weekRange}*\n\n${data!.editorial}\n\n*Top:*\n${topVids.join('\n')}\n\n*Signals:* ${data!.signals.growing} growing · ${data!.signals.cold} reawakening\n\n*Play:* ${data!.playbook.title}`;
  }
  function copyToClipboard(text: string, type: 'email' | 'slack') {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'email') { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }
      if (type === 'slack') { setSlackCopied(true); setTimeout(() => setSlackCopied(false), 2000); }
    });
  }

  return (
    <div ref={pageRef} className="pulse-page" style={{ background: PAPER, minHeight: '100vh', color: INK, overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Caveat:wght@400;500;600;700&display=swap');
        @media print { .no-print { display: none !important; } }
        a.pulse-link { text-decoration: none; color: inherit; }
        a.pulse-link:hover { opacity: 0.85; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-fade { animation: fadeUp 0.6s ease-out both; }

        /* Page-wide paper grain texture */
        .pulse-page::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px 256px;
          pointer-events: none;
          z-index: 9999;
          mix-blend-mode: multiply;
        }

        .shorts-cell { transition: transform 0.15s ease, box-shadow 0.15s ease; border-radius: 6px; overflow: hidden; }
        .shorts-cell:hover { transform: scale(1.03); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
        .momentum-row { transition: background 0.15s ease; }
        .momentum-row:hover { background: rgba(14,14,14,0.03); }

        /* Signal anchor hover — editorial, not dashboard */
        .signal-anchor {
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
          position: relative;
        }
        .signal-anchor::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 24px;
          height: 1.5px;
          background: currentColor;
          transition: transform 0.25s ease;
          opacity: 0.4;
        }
        .signal-anchor:hover {
          transform: translateY(-2px);
        }
        .signal-anchor:hover::after {
          transform: translateX(-50%) scaleX(1);
        }

        /* Campaign cards */
        .campaign-hero-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
        }
        .campaign-hero-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
        }
        .campaign-hero-card:hover .campaign-hero-img {
          transform: scale(1.02);
        }
        .campaign-secondary-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }
        .campaign-secondary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .campaign-secondary-card:hover .campaign-secondary-img {
          transform: scale(1.03);
        }
        .campaign-hero-img, .campaign-secondary-img {
          transition: transform 0.4s ease;
        }
        .campaign-signal-tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
      `}</style>


      {/* ═══════ TOP BAR ═══════ */}
      {!screenshotMode && (
        <div className="no-print" style={{
          maxWidth: 1200, margin: '0 auto', padding: '20px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <VirginMusicLogo height={30} />
            <div style={{ width: 1, height: 36, background: BONE, flexShrink: 0 }} />
            <YouTubeLogo height={22} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 10, color: SMOKE }}>
              {data.weekRange}
            </div>
            <button onClick={() => document.getElementById('pulse-share')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '4px 10px', borderRadius: 20, border: 'none', background: 'transparent', fontSize: 9, fontWeight: 600, color: GHOST, cursor: 'pointer' }}>
              Share
            </button>
          </div>
        </div>
      )}

      {screenshotMode && (
        <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
          <button onClick={() => setScreenshotMode(false)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: INK, fontSize: 10, fontWeight: 700, color: WHITE, cursor: 'pointer' }}>
            Exit
          </button>
        </div>
      )}


      {/* ═══════ HERO — Title left, Shorts grid right ═══════ */}
      <header className="pulse-fade" style={{
        maxWidth: 1200, margin: '0 auto', padding: '36px 40px 48px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 40, alignItems: 'start' }}>
          {/* Left — Title */}
          <div>
            <h1 style={{
              fontSize: 76, fontWeight: 900, lineHeight: 0.9,
              letterSpacing: '-0.04em', color: INK,
              margin: '0 0 0 -3px',
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: 'italic',
            }}>
              Virgin Music.<br />
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'normal', fontWeight: 900, letterSpacing: '-0.045em' }}>
                YouTube Pulse.
              </span>
            </h1>

            <div style={{
              marginTop: 24, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: SMOKE,
            }}>
              {data.weekRange}
            </div>

            {/* Evidence strip — not AI paragraph */}
            <div style={{ display: 'flex', gap: 20, marginTop: 24, fontSize: 11, color: SMOKE }}>
              <div>
                <span style={{ fontSize: 24, fontWeight: 900, color: INK, display: 'block', lineHeight: 1 }}>
                  {data.signals.growing}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em' }}>Growing</span>
              </div>
              <div style={{ width: 1, background: BONE }} />
              <div>
                <span style={{ fontSize: 24, fontWeight: 900, color: INK, display: 'block', lineHeight: 1 }}>
                  {data.signals.totalManaged}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em' }}>Managed channels</span>
              </div>
              <div style={{ width: 1, background: BONE }} />
              <div>
                <span style={{ fontSize: 24, fontWeight: 900, color: INK, display: 'block', lineHeight: 1 }}>
                  {data.signals.weakConversion}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em' }}>Conversion opportunity</span>
              </div>
            </div>

          </div>

          {/* Right — Shorts 3×2 thumbnail grid */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {topShorts.map((v) => (
                <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                  className="pulse-link shorts-cell" style={{ display: 'block', position: 'relative' }}>
                  <img src={v.thumbnail} alt="" loading="lazy"
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  {/* Dark gradient overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55) 100%)',
                  }} />
                  {/* Play icon + view count overlay */}
                  <div style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <PlayOverlay size={22} />
                    <span style={{
                      fontSize: 13, fontWeight: 800, color: WHITE,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}>
                      {fmtNum(v.viewCount)}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {/* Handwritten annotation */}
            <div style={{
              marginTop: 10, textAlign: 'right', paddingRight: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
            }}>
              <span style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 18, fontWeight: 500, color: SMOKE,
                fontStyle: 'italic',
              }}>
                Top Shorts this week across our roster
              </span>
              {/* Hand-drawn arrow */}
              <svg width="28" height="16" viewBox="0 0 28 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 10C6 8 14 4 22 6" stroke={SMOKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M18 3L23 6L18 9" stroke={SMOKE} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </header>


      {/* ═══════ SIGNALS BAR — navigational anchors ═══════ */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 40px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: `1px solid ${BONE}`, borderBottom: `1px solid ${BONE}`,
          padding: '28px 0',
        }}>
          {[
            { n: data.signals.growing, label: 'In Growth State', target: 'pulse-momentum', color: ACCENT.green },
            { n: data.signals.weakConversion, label: 'Audience Growth Opportunity', target: 'pulse-conversion', color: ACCENT.amber },
            { n: data.signals.underfed, label: 'Cadence Building', target: 'pulse-cadence', color: ACCENT.ochre },
            { n: data.signals.cold, label: 'Catalogue Reawakening', target: 'pulse-reactivation', color: ACCENT.ember },
          ].map((sig, i) => (
            <div
              key={i}
              className="signal-anchor"
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById(sig.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById(sig.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={{
                textAlign: 'center',
                borderLeft: i > 0 ? `1px solid ${BONE}` : 'none',
                padding: '8px 4px 16px',
                color: sig.color,
              }}
            >
              <div style={{
                fontSize: 48, fontWeight: 900, color: sig.color,
                lineHeight: 1, letterSpacing: '-0.03em',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {sig.n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: SMOKE, marginTop: 6, letterSpacing: '0.02em' }}>
                {sig.label}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* ═══════ THIS WEEK ACROSS VIRGIN ═══════ */}
      {featuredCampaign && (
        <section className="pulse-fade" style={{
          maxWidth: 1200, margin: '0 auto', padding: '48px 40px 0',
        }}>
          <div style={{ height: 1, background: BONE, marginBottom: 40 }} />

          {/* Section header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
              textTransform: 'uppercase' as const, color: GHOST, marginBottom: 10,
            }}>
              This Week Across Virgin
            </div>
            <p style={{
              fontSize: 15, fontWeight: 400, color: SMOKE, lineHeight: 1.5,
              maxWidth: 560, margin: 0,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              The campaigns shaping conversation, momentum and audience growth across YouTube this week.
            </p>
          </div>

          {/* Asymmetric layout: hero left, stack right */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

            {/* ── Featured campaign — large cinematic card ── */}
            {(() => {
              const fc = featuredCampaign;
              const chUrl = channelUrl(fc.channel.channelHandle);
              return (
                <a
                  href={chUrl ?? '#'}
                  target={chUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="pulse-link campaign-hero-card"
                  style={{ display: 'block', borderRadius: 8, overflow: 'hidden', background: INK, position: 'relative' }}
                >
                  {/* Cinematic hero image */}
                  <div style={{ position: 'relative', overflow: 'hidden' }}>
                    <img
                      src={fc.heroImage}
                      alt=""
                      loading="lazy"
                      className="campaign-hero-img"
                      style={{
                        width: '100%', height: 340, objectFit: 'cover', display: 'block',
                        filter: 'brightness(0.85)',
                      }}
                    />
                    {/* Gradient overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(transparent 20%, rgba(14,14,14,0.85) 100%)',
                    }} />
                    {/* Signal tag */}
                    <div style={{ position: 'absolute', top: 20, left: 20 }}>
                      <span className="campaign-signal-tag" style={{
                        background: 'rgba(255,255,255,0.15)',
                        color: WHITE,
                        backdropFilter: 'blur(8px)',
                      }}>
                        {fc.signal}
                      </span>
                    </div>
                    {/* Play indicator */}
                    <div style={{ position: 'absolute', top: 20, right: 20 }}>
                      <PlayOverlay size={36} />
                    </div>
                    {/* Content overlay */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '0 28px 28px',
                    }}>
                      {/* Channel avatar + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        {fc.channel.thumbnail && (
                          <img src={fc.channel.thumbnail} alt="" style={{
                            width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                            border: '2px solid rgba(255,255,255,0.3)',
                          }} />
                        )}
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                          letterSpacing: '0.04em', textTransform: 'uppercase' as const,
                        }}>
                          {fc.channel.name}
                        </span>
                      </div>
                      {/* Evidence stats — not AI commentary */}
                      <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
                        {fc.channel.views7d != null && (
                          <span><strong style={{ color: WHITE, fontWeight: 700 }}>{fmtNum(fc.channel.views7d)}</strong> views/wk</span>
                        )}
                        <span><strong style={{ color: WHITE, fontWeight: 700 }}>{fc.channel.uploads30d}</strong> uploads/30d</span>
                        {fc.channel.subs != null && (
                          <span><strong style={{ color: WHITE, fontWeight: 700 }}>{fmtNum(fc.channel.subs)}</strong> subs</span>
                        )}
                        {fc.channel.subs7d != null && fc.channel.subs7d > 0 && (
                          <span style={{ color: 'rgba(45,200,120,0.8)' }}>+{fmtNum(fc.channel.subs7d)} this week</span>
                        )}
                      </div>
                      {/* Format tags */}
                      {(() => {
                        const chVids = videosBySlug.get(fc.channel.slug) ?? [];
                        const fmts = new Set<string>();
                        for (const v of chVids) {
                          if (v.durationSec <= 62) fmts.add('Short');
                          if (/official video/i.test(v.format)) fmts.add('Official Video');
                          else if (/bts|behind/i.test(v.format)) fmts.add('BTS');
                          else if (/trailer/i.test(v.format)) fmts.add('Trailer');
                          else if (/live session/i.test(v.format)) fmts.add('Live Session');
                          else if (/visuali/i.test(v.format)) fmts.add('Visualiser');
                          else if (/lyric/i.test(v.format)) fmts.add('Lyric Video');
                        }
                        if (fmts.size === 0) return null;
                        return (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                            {Array.from(fmts).map(f => (
                              <span key={f} style={{
                                padding: '2px 7px', borderRadius: 8, fontSize: 8, fontWeight: 700,
                                textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                              }}>{f}</span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </a>
              );
            })()}

            {/* ── Secondary campaigns — stacked cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {secondaryCampaigns.map(story => {
                const chUrl = channelUrl(story.channel.channelHandle);
                return (
                  <a
                    key={story.channel.slug}
                    href={chUrl ?? '#'}
                    target={chUrl ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="pulse-link campaign-secondary-card"
                    style={{
                      display: 'grid', gridTemplateColumns: '140px 1fr',
                      borderRadius: 6, overflow: 'hidden',
                      background: WHITE,
                      border: `1px solid ${BONE}`,
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                      <img
                        src={story.heroImage}
                        alt=""
                        loading="lazy"
                        className="campaign-secondary-img"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 110 }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.3) 100%)',
                      }} />
                      <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                        <PlayOverlay size={22} />
                      </div>
                      {/* Signal tag */}
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <span className="campaign-signal-tag" style={{
                          background: 'rgba(0,0,0,0.5)',
                          color: WHITE,
                          backdropFilter: 'blur(6px)',
                          fontSize: 7,
                        }}>
                          {story.signal}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {story.channel.thumbnail && (
                          <img src={story.channel.thumbnail} alt="" style={{
                            width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                          }} />
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: INK,
                          letterSpacing: '0.02em', textTransform: 'uppercase' as const,
                        }}>
                          {story.channel.name}
                        </span>
                      </div>
                      {/* Evidence stats */}
                      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: SMOKE, flexWrap: 'wrap' as const }}>
                        {story.channel.views7d != null && (
                          <span><strong style={{ color: INK }}>{fmtNum(story.channel.views7d)}</strong> views/wk</span>
                        )}
                        <span><strong style={{ color: INK }}>{story.channel.uploads30d}</strong> uploads/30d</span>
                        {story.channel.subs7d != null && story.channel.subs7d > 0 && (
                          <span style={{ color: ACCENT.green }}>+{fmtNum(story.channel.subs7d)} subs</span>
                        )}
                        {story.channel.subs != null && (
                          <span>{fmtNum(story.channel.subs)} subs</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}

              {/* Handwritten annotation */}
              <div style={{
                marginTop: 4, paddingLeft: 4,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M10 2C10 8 10 14 10 18" stroke={GHOST} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray="2 3" />
                  <path d="M7 15L10 19L13 15" stroke={GHOST} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 16, fontWeight: 500, color: GHOST,
                  fontStyle: 'italic',
                }}>
                  campaigns we&apos;re actively watching and learning from
                </span>
              </div>
            </div>
          </div>
        </section>
      )}


      {/* ═══════ EMERGING ECOSYSTEM WINNER ═══════ */}
      {emergingWinner && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 32 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px', borderRadius: 10,
            background: WHITE, border: `1px solid ${BONE}`,
          }}>
            {emergingWinner.ch.thumbnail && (
              <img src={emergingWinner.ch.thumbnail} alt="" style={{
                width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                border: `2px solid ${BONE}`, flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: ACCENT.green }}>
                  Emerging Ecosystem Winner
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{emergingWinner.ch.name}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: SMOKE }}>
                {emergingWinner.ch.subs7d != null && emergingWinner.ch.subs7d > 0 && <span>+{emergingWinner.ch.subs7d} subs this week</span>}
                <span>{emergingWinner.ch.uploads30d} uploads / 30d</span>
                {emergingWinner.ch.subsPer1kViews != null && emergingWinner.ch.subsPer1kViews >= 2 && (
                  <span>{emergingWinner.ch.subsPer1kViews.toFixed(1)} subs per 1K views</span>
                )}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, color: ACCENT.green,
              padding: '4px 10px', borderRadius: 6, background: 'rgba(45,106,79,0.06)',
              whiteSpace: 'nowrap',
            }}>
              {emergingWinner.sig.multiformat === 'strong-followthrough' || emergingWinner.sig.multiformat === 'ecosystem-build'
                ? 'Multi-Format Active'
                : emergingWinner.ch.classification === 'GROWING' ? 'Growing' : 'Strong Execution'}
            </span>
          </div>
        </section>
      )}

      {/* ═══════ LONGFORM MOMENTS THIS WEEK ═══════ */}
      {(() => {
        // Artist diversity tracker — max 2 placements per artist across report
        const heroSlugs = new Set(campaignStories.map(s => s.channel.slug));
        const placementCount = new Map<string, number>();
        heroSlugs.forEach(s => placementCount.set(s, 1));
        const canPlace = (slug: string) => (placementCount.get(slug) ?? 0) < 2;
        const markPlaced = (slug: string) => placementCount.set(slug, (placementCount.get(slug) ?? 0) + 1);

        // Longform: use topVideos (already filtered by API as longform)
        const allLongform = [...data.topVideos]
          .sort((a, b) => b.velocity - a.velocity);
        const seenLF = new Set<string>();
        const longformMoments = allLongform.filter(v => {
          if (seenLF.has(v.artistSlug)) return false;
          if (!canPlace(v.artistSlug)) return false;
          seenLF.add(v.artistSlug);
          return true;
        }).slice(0, 4);
        // If diversity rule is too strict, relax and fill remaining slots
        if (longformMoments.length < 4) {
          const remaining = allLongform.filter(v => !seenLF.has(v.artistSlug)).slice(0, 4 - longformMoments.length);
          longformMoments.push(...remaining);
          remaining.forEach(v => seenLF.add(v.artistSlug));
        }
        longformMoments.forEach(v => markPlaced(v.artistSlug));

        // Shorts: use topShorts (already filtered by API as shorts)
        const allShorts = [...data.topShorts]
          .sort((a, b) => b.velocity - a.velocity);
        const seenSF = new Set<string>();
        const shortsMoments = allShorts.filter(v => {
          if (seenSF.has(v.artistSlug)) return false;
          if (!canPlace(v.artistSlug)) return false;
          seenSF.add(v.artistSlug);
          return true;
        }).slice(0, 3);
        shortsMoments.forEach(v => markPlaced(v.artistSlug));

        // Discovery moments — best conversion / growth from smaller artists
        const discoveryChannels = managed
          .filter(ch => canPlace(ch.slug) && (ch.subs ?? 0) < 100000 && (ch.subs7d ?? 0) > 0 && ch.uploads30d >= 2)
          .sort((a, b) => (b.subsPer1kViews ?? 0) - (a.subsPer1kViews ?? 0))
          .slice(0, 3);

        return (
          <>
            {longformMoments.length > 0 && (
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0' }}>
                <div style={{ height: 1, background: BONE, marginBottom: 32 }} />
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 20 }}>
                  Longform Moments This Week
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {longformMoments.map((v, i) => (
                    <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                      className="pulse-link shorts-cell" style={{ display: 'block', textDecoration: 'none' }}>
                      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                        <img src={v.thumbnail} alt="" loading="lazy"
                          style={{ width: '100%', height: i < 2 ? 200 : 160, objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.65) 100%)' }} />
                        <div style={{ position: 'absolute', top: 8, left: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' as const, background: 'rgba(26,86,184,0.85)', color: WHITE }}>{v.format}</span>
                        </div>
                        <div style={{ position: 'absolute', top: 8, right: 8 }}><PlayOverlay size={24} /></div>
                        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>{v.channelName}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: WHITE, lineHeight: 1.2 }}>{v.title.length > 60 ? v.title.slice(0, 57) + '...' : v.title}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 11, marginTop: 6, padding: '0 2px' }}>
                        <span style={{ fontWeight: 700, color: INK }}>{fmtNum(v.viewCount)} views</span>
                        <span style={{ color: YT_RED, fontWeight: 600 }}>{fmtNum(v.velocity)}/day</span>
                        <span style={{ color: SMOKE }}>{v.daysAgo}d ago</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ═══════ SHORTFORM MOMENTS THIS WEEK ═══════ */}
            {shortsMoments.length > 0 && (
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 16 }}>
                  Shortform Moments This Week
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {shortsMoments.map(v => (
                    <a key={v.id} href={ytUrl(v.id, v.durationSec)} target="_blank" rel="noopener noreferrer"
                      className="pulse-link shorts-cell" style={{ display: 'block', textDecoration: 'none' }}>
                      <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                        <img src={v.thumbnail} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', maxHeight: 180 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
                        <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const, marginBottom: 2 }}>{v.channelName}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: WHITE, lineHeight: 1.2 }}>{v.title.length > 40 ? v.title.slice(0, 37) + '...' : v.title}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, marginTop: 4 }}>
                        <span style={{ fontWeight: 700, color: INK }}>{fmtNum(v.viewCount)}</span>
                        <span style={{ color: SMOKE }}>{fmtNum(v.velocity)}/day</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ═══════ DISCOVERY MOMENTS ═══════ */}
            {discoveryChannels.length > 0 && (
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0' }}>
                <div style={{ height: 1, background: BONE, marginBottom: 24 }} />
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 16 }}>
                  Discovery Moments
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {discoveryChannels.map(ch => {
                    const chUrl = channelUrl(ch.channelHandle);
                    return (
                      <div key={ch.slug} style={{ padding: '14px 16px', borderRadius: 8, background: WHITE, border: `1px solid ${BONE}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {ch.thumbnail && <img src={ch.thumbnail} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                          {chUrl ? (
                            <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link">
                              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</span>
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: SMOKE }}>
                          {ch.subs7d != null && ch.subs7d > 0 && <span style={{ color: ACCENT.green, fontWeight: 700 }}>+{ch.subs7d} subs</span>}
                          {ch.subsPer1kViews != null && <span>{ch.subsPer1kViews.toFixed(1)} subs/1K views</span>}
                          <span>{ch.uploads30d} uploads/30d</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        );
      })()}


      {/* ═══════ MOMENTUM + OPPORTUNITIES — side by side ═══════ */}
      <section id="pulse-momentum" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0', scrollMarginTop: 24 }}>
        <div style={{ height: 1, background: BONE, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 48 }}>
          {/* LEFT — In Growth State */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 14 }}>
              In Growth State
            </div>
            {momentumChannels.map((ch, i) => {
              const chUrl = channelUrl(ch.channelHandle);
              return (
              <div key={ch.slug} className="momentum-row" style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px',
                borderBottom: i < momentumChannels.length - 1 ? `1px solid ${BONE}` : 'none',
              }}>
                {ch.thumbnail && (
                  chUrl ? (
                    <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link" style={{ flexShrink: 0 }}>
                      <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                    </a>
                  ) : (
                    <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  )
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {chUrl ? (
                    <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link">
                      <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</div>
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</div>
                  )}
                  <div style={{ fontSize: 9, color: SMOKE }}>{ch.uploads30d} uploads / 30d</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: ACCENT.green }}>{ch.views7d != null ? fmtNum(ch.views7d) : '—'}</span>
                  <div style={{ fontSize: 7, color: GHOST, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>views</div>
                </div>
              </div>
              );
            })}
          </div>

          {/* RIGHT — Opportunities (3 columns) */}
          {issueGroups.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 14 }}>
                Where There&apos;s Room to Grow
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                {issueGroups.map((group, gi) => (
                  <div key={gi} id={group.id} style={{ scrollMarginTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: INK, lineHeight: 1 }}>{group.count}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: SMOKE }}>{group.label}</span>
                    </div>
                    {group.topChannels.map(ch => {
                      const chUrl = channelUrl(ch.channelHandle);
                      return (
                      <div key={ch.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {ch.thumbnail && (
                          chUrl ? (
                            <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link" style={{ flexShrink: 0 }}>
                              <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                            </a>
                          ) : (
                            <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )
                        )}
                        {chUrl ? (
                          <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link">
                            <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>{ch.name}</span>
                          </a>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>{ch.name}</span>
                        )}
                      </div>
                      );
                    })}
                    {group.count > 4 && (
                      <div style={{ fontSize: 9, color: GHOST, marginTop: 4, marginLeft: 26 }}>+ {group.count - 4} more</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>


      {/* ═══════ BOTTOM STRIP — Market Watch + Playbook side by side ═══════ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0' }}>
        <div style={{ height: 1, background: BONE, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {/* LEFT — Reference Channels */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: GHOST, marginBottom: 6 }}>
              Reference Channels This Week
            </div>
            <p style={{ fontSize: 12, color: SMOKE, margin: '0 0 16px', lineHeight: 1.4, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Wider market channels we&apos;re watching — strong execution, consistent cadence, format variety worth learning from.
            </p>
            {consistentMarket.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {consistentMarket.slice(0, 6).map(ch => {
                    const chUrl = channelUrl(ch.channelHandle);
                    // One-line context from data
                    const longform = ch.longform30d;
                    const shorts = ch.shorts30d;
                    let context = `${ch.uploads30d} uploads/30d`;
                    if (longform > 0 && shorts > 0) context = `${longform} longform + ${shorts} Shorts in 30d`;
                    else if (shorts > 0) context = `${shorts} Shorts in 30d`;
                    if (ch.views7d != null && ch.views7d >= 10000) context += ` · ${fmtNum(ch.views7d)} views/wk`;
                    return (
                    <div key={ch.slug} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: `1px solid ${BONE}`,
                    }}>
                      {ch.thumbnail && (
                        chUrl ? (
                          <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link" style={{ flexShrink: 0 }}>
                            <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                          </a>
                        ) : (
                          <img src={ch.thumbnail} alt="" loading="lazy" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                        )
                      )}
                      <div style={{ flex: 1 }}>
                        {chUrl ? (
                          <a href={chUrl} target="_blank" rel="noopener noreferrer" className="pulse-link">
                            <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</div>
                          </a>
                        ) : (
                          <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{ch.name}</div>
                        )}
                        <div style={{ fontSize: 10, color: SMOKE }}>{context}</div>
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* RIGHT — Playbook */}
          <div style={{
            background: INK, color: PAPER, borderRadius: 8, padding: '28px 28px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Red top accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: YT_RED }} />
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(250,247,242,0.35)', marginBottom: 12 }}>
              Playbook of the Week
            </div>
            <h3 style={{
              fontSize: 22, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em',
              color: PAPER, margin: '0 0 12px', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {data.playbook.title}
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(250,247,242,0.6)', lineHeight: 1.5, margin: '0 0 16px' }}>
              {data.playbook.why}
            </p>
            {data.playbook.actions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{
                  fontSize: 16, fontWeight: 900, color: 'rgba(255,0,0,0.3)', lineHeight: 1,
                  minWidth: 18, fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  {i + 1}
                </span>
                <p style={{ fontSize: 11, color: 'rgba(250,247,242,0.75)', lineHeight: 1.45, margin: 0 }}>
                  {action}
                </p>
              </div>
            ))}
            {/* YouTube resource link */}
            {(data.playbook as any).resourceUrl && (
              <a
                href={(data.playbook as any).resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 14, padding: '6px 14px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(250,247,242,0.7)',
                  fontSize: 10, fontWeight: 600, textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <img src="/youtube-icon.png" alt="" style={{ width: 14, height: 14 }} />
                {(data.playbook as any).resourceLabel ?? 'YouTube for Artists Resource'}
              </a>
            )}
          </div>
        </div>
      </section>


      {/* Philosophy note */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 9, color: GHOST, letterSpacing: '0.06em', lineHeight: 1.6,
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          margin: 0,
        }}>
          Campaigns are selected for momentum, rollout behaviour and YouTube strategy signals — not raw scale.
        </p>
      </div>

      {/* ═══════ SHARE + FOOTER ═══════ */}
      {!screenshotMode && (
        <section id="pulse-share" className="no-print" style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 40px 0' }}>
          <div style={{ height: 1, background: BONE, marginBottom: 20 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: GHOST }}>
              Share This Briefing
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Pill label={emailCopied ? 'Copied' : 'Email summary'} onClick={() => copyToClipboard(generateEmailBody(), 'email')} active={emailCopied} />
              <Pill label={slackCopied ? 'Copied' : 'Slack summary'} onClick={() => copyToClipboard(generateSlackSummary(), 'slack')} active={slackCopied} />
            </div>
          </div>
        </section>
      )}

      <footer style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VirginMusicLogo height={16} />
          <div style={{ width: 1, height: 20, background: BONE }} />
          <YouTubeLogo height={13} />
        </div>
      </footer>
    </div>
  );
}

function Pill({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, border: 'none',
      background: active ? INK : WHITE, fontSize: 10, fontWeight: 600,
      color: active ? WHITE : INK, cursor: 'pointer', transition: 'all 0.2s',
    }}>
      {label}
    </button>
  );
}
